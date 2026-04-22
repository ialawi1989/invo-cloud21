import { SupplierCreditLine } from "@src/models/account/supplierCreditLines";
import { PoolClient } from "pg";
import { BranchProductsRepo } from "../product/branchProduct.repo";
import { BranchProducts } from "@src/models/product/BranchProducts";
import { Helper } from "@src/utilts/helper";
import { ProductRepo } from "../product/product.repo";
import { BatchProductRepo } from "../product/productTypes/batchProduct.reps";
import { SerialProductRepo } from "../product/productTypes/serilizedProduct.repo";
import { BillingRepo } from "./billing.repo";

import { Batches } from "@src/models/product/Batches";
import { Serials } from "@src/models/product/Serials";
import { ValidationException } from "@src/utilts/Exception";

export class SupplierCreditMovmentRepo {


    public static async insertInventorySupplierCredit(client: PoolClient, supplerCreditLine: SupplierCreditLine, branchId: string, afterDecimal: number) {
        try {

            const branchProductData = await BranchProductsRepo.getBranchProductAndUnitCost(client, supplerCreditLine.productId, branchId);
            const branchProduct = new BranchProducts();
            branchProduct.ParseJson(branchProductData);
            const oldMovmentLine = await BillingRepo.getOldLine(client, supplerCreditLine.billingLineId);
            const productId: any = supplerCreditLine.productId;
            //calculate OriginalUnitCost of Product before first purchase of line   
            /**
             * Example: 
             * productUnitCost(original) = 10 , currentOnHand(stock) = 5
             * first purchase(bill) unitCost = 9 , purchasedQty = 8
             * 
             * productUnitCost(after first purchase) = (10*5) +(9*8) / 5+8 =9.385 
             * 
             * edit bill to  unitCost = 9 , purchasedQty = 4
             * calculate orginal (unitCost= 10 and onHand= 9 ) from old movment and currentOnHand and currentUnitCost
             * 1st: currentCost * currentOnhand = 9.385 * (8+5) = 122.005
             * 2nd: currentOnHand - oldMovmentQty = (5+8) - 8 = 5 =>> original onHand
             * 3rd: currentCost - oldMovmentQtycost= 122.005 - 72 =50.005 original cost 
             * 
             * recalculate cost => edit bill to  unitCost = 9 , purchasedQty = 4
             * 
             * (originalCost+new billing cost)/(orginial qty+ billing qty) = (50.005 +(9*4))/(5+4) = 9.556 
             * 
             * 
             */
            const currentOnHand = branchProduct.onHand;
            const oldLineCost =  oldMovmentLine.isInclusiveTax ? (oldMovmentLine.subTotal) - oldMovmentLine.taxTotal :  (oldMovmentLine.subTotal) 
            const currentCost = Helper.multiply(currentOnHand, branchProductData.unitCost, afterDecimal)
            const originalOnHand = Helper.sub(currentOnHand, oldMovmentLine.qty, afterDecimal)
            let originalCost = Helper.sub(currentCost,oldLineCost, afterDecimal)
            const billingCost = Helper.multiply(supplerCreditLine.qty, supplerCreditLine.unitCost, afterDecimal)


            //calculate new unitCost by Avarage
            // average = (oldUnitCost * oldOnHand) + (UnitCostAtPurchased * QtyAtPurchased) /  (oldOnHand +QtyAtPurchased)
            // originalCost = originalCost < 0 ? originalCost * (-1) : originalCost;
            let newOnHand = Helper.sub(oldMovmentLine.qty, supplerCreditLine.qty, afterDecimal)
            let newCost =0 ;


            if(supplerCreditLine.qty == oldMovmentLine.qty)
            {
                newOnHand = originalOnHand;
                newCost = originalCost == 0 ? oldMovmentLine.unitCost :Helper.division(originalCost , originalOnHand, afterDecimal)
              

            }else{
                let remainQty = newOnHand;
                let cost = supplerCreditLine.isInclusiveTax ? ( supplerCreditLine.unitCost * (remainQty)) - supplerCreditLine.taxTotal :( supplerCreditLine.unitCost * (remainQty)) 
                newOnHand += originalOnHand
                 newCost = Helper.division((originalCost +cost ), (newOnHand) , afterDecimal)
            }
            newCost = newCost<0 ? 0 : newCost

            //update the current product unitCost 
            await ProductRepo.setProductUnitCost(client, newCost, productId,afterDecimal)
            // set new Qty 
            branchProduct.onHand = newOnHand;

            //update branchProduct on Hand 
            // await BranchProductsRepo.setNewOnHand(client, branchId, supplerCreditLine.productId, newOnHand)

            // update movment corresponding  to edited Billing Line 
            // await InventoryMovmentRepo.updateMovmentCost(client, oldMovmentLine.movmentId, billingCost * (-1))
            // await InventoryMovmentRepo.updateMovmentLineCostQty(client, oldMovmentLine.lineId, billingCost, billingLine.qty, currentOnHand, currentCost)

        } catch (error: any) {
          
             throw new Error(error.message)
        }
    }
    public static async addBatchInventory(client: PoolClient, supplerCreditLine: SupplierCreditLine, branchId: string, companyId: string, afterDecimal: number) {
        try {
            let batch = new Batches()

            let branchProductId = await BranchProductsRepo.getBranchProductId(client, supplerCreditLine.productId, branchId);

            let batchOnhand
            if (supplerCreditLine.productId) {
                batch.id = await BatchProductRepo.getBatchId(client, branchId, supplerCreditLine.batch, supplerCreditLine.productId)
                batchOnhand = await BatchProductRepo.getBatchOnhandAndUnitCost(client, supplerCreditLine.batch, supplerCreditLine.productId, branchId)

            }

            console.log("hereeeeeeeeeeeeeeeeeeeeeeeeeeeee",batchOnhand.onHand - supplerCreditLine.qty)
            let newOnHand = batchOnhand.onHand - supplerCreditLine.qty;
            batch.unitCost = supplerCreditLine.unitCost;
            batch.onHand = newOnHand;
            batch.prodDate = supplerCreditLine.prodDate;
            batch.expireDate = supplerCreditLine.expireDate
            batch.branchProductId = branchProductId;
            batch.batch = supplerCreditLine.batch;
            await BatchProductRepo.editBatch(client, batch)


        } catch (error: any) {
          


            throw new Error(error)
        }
    }
    public static async addSerialInventory(client: PoolClient, supplerCreditLine: SupplierCreditLine, branchId: string, companyId: string, afterDecimal: number) {
        try {
            let serial = new Serials()
            let branchProductId = await BranchProductsRepo.getBranchProductId(client, supplerCreditLine.productId, branchId);



            serial.unitCost = supplerCreditLine.unitCost;
            serial.serial = supplerCreditLine.serial;
            serial.companyId = companyId
            serial.branchProductId = branchProductId;
            console.log(supplerCreditLine.qty)
            if(supplerCreditLine.qty>0)
            {
                if (supplerCreditLine.productId) {
                    serial.id = await SerialProductRepo.getSerialId(client, branchId, supplerCreditLine.productId, serial.serial)
                }
    
                if (supplerCreditLine.productId) {
                    await SerialProductRepo.deleteSerial(client, serial.serial, branchId, supplerCreditLine.productId)
                }
            }else{
                serial.unitCost = supplerCreditLine.unitCost;
                serial.serial = supplerCreditLine.serial;
                serial.companyId = companyId
                serial.branchProductId = branchProductId;
                if (supplerCreditLine.productId) {
                    let isSerialExist = await SerialProductRepo.checkIfSerialExist(client,companyId, serial.serial, supplerCreditLine.productId);
                    if (isSerialExist) {
                        throw new ValidationException("Serial Number Already Exist")
                    }
                    await SerialProductRepo.addSerial(client, serial, supplerCreditLine.productId)
                }
            }
        


        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    public static async getOldSupplierCreditLine(client:PoolClient,lineId:string)
    {
        try {
            const query={
                text:`SELECT qty,"unitCost","subTotal" from "SupplierCreditLines" where id =$1`,
                values:[lineId]
            }

            let supplierCredits = await client.query(query.text,query.values);

            return  supplierCredits.rows[0]
        } catch (error:any) {
            throw new Error(error)
        }
    }
    public static async updateProductUnitCost(client: PoolClient, branchId: string, supplerCreditLine: SupplierCreditLine, afterDecimal: number) {
        try {
            const branchProductData = await BranchProductsRepo.getBranchProductAndUnitCost(client, supplerCreditLine.productId, branchId);
            const branchProduct = new BranchProducts();
            branchProduct.ParseJson(branchProductData);
            const oldMovmentLine = await BillingRepo.getOldLine(client, supplerCreditLine.billingLineId);
            const oldSupplierLine = await this.getOldSupplierCreditLine(client,supplerCreditLine.id);

            //  if(qtyDifference<0)
            //  {
            //   return  await ProductRepo.calculateUnitCostAvg(client, billingLine.productId, branchId, qtyDifference *(-1), billingLine.unitCost, afterDecimal)
            //  }
            const productId: any = supplerCreditLine.productId;
            //calculate OriginalUnitCost of Product before first purchase of line   
            /**
             * Example: 
             * productUnitCost(original) = 10 , currentOnHand(stock) = 5
             * first purchase(bill) unitCost = 9 , purchasedQty = 8
             * 
             * productUnitCost(after first purchase) = (10*5) +(9*8) / 5+8 =9.385 
             * 
             * edit bill to  unitCost = 9 , purchasedQty = 4
             * calculate orginal (unitCost= 10 and onHand= 9 ) from old movment and currentOnHand and currentUnitCost
             * 1st: currentCost * currentOnhand = 9.385 * (8+5) = 122.005
             * 2nd: currentOnHand - oldMovmentQty = (5+8) - 8 = 5 =>> original onHand
             * 3rd: currentCost - oldMovmentQtycost= 122.005 - 72 =50.005 original cost 
             * 
             * recalculate cost => edit bill to  unitCost = 9 , purchasedQty = 4
             * 
             * (originalCost+new billing cost)/(orginial qty+ billing qty) = (50.005 +(9*4))/(5+4) = 9.556 
             * 
             * 
             */

            const currentOnHand = branchProduct.onHand;
            const currentCost = Helper.multiply(currentOnHand, branchProductData.unitCost, afterDecimal)
            const originalOnHand = Helper.sub(currentOnHand, (oldMovmentLine.qty-oldSupplierLine.qty) , afterDecimal)
            let originalCost = Helper.sub(currentCost, (oldMovmentLine.subTotal -oldSupplierLine.subTotal  ), afterDecimal)
            originalCost = originalCost < 0 ? originalCost * -1 : originalCost
            const billingCost = Helper.multiply(supplerCreditLine.qty, supplerCreditLine.unitCost, afterDecimal)

            //calculate new unitCost by Avarage
            // average = (oldUnitCost * oldOnHand) + (UnitCostAtPurchased * QtyAtPurchased) /  (oldOnHand +QtyAtPurchased)
            // originalCost = originalCost < 0 ? originalCost * (-1) :  originalCost; 
            let newOnHand = originalOnHand + branchProductData.openingBalance < 0 ? supplerCreditLine.qty : Helper.add(originalOnHand, supplerCreditLine.qty, afterDecimal)
            let newCost = 0;
            // if (billingLine.qty == oldMovmentLine.qty) {
            //     newOnHand = originalOnHand;
            //     newCost = Helper.division(originalCost, originalOnHand, afterDecimal)
            // } else {

            // newOnHand = originalOnHand + branchProductData.openingBalance < 0 ? billingLine.qty : Helper.add(originalOnHand, billingLine.qty, afterDecimal)
            newOnHand = Helper.add(originalOnHand, (oldMovmentLine.qty-oldSupplierLine.qty +supplerCreditLine.qty ), afterDecimal)

            // newCost = newOnHand == 0 || branchProduct.onHand < 0 || (originalCost + billingCost) == 0 ? billingLine.unitCost : Helper.division((originalCost + billingCost), newOnHand, afterDecimal)
            // }

             const cost = Helper.sub(oldMovmentLine.subTotal  ,oldSupplierLine.subTotal,afterDecimal)  + Helper.multiply(supplerCreditLine.qty,supplerCreditLine.unitCost,afterDecimal)
             
            newCost = currentOnHand <=0 || newOnHand <= 0  ? supplerCreditLine.unitCost :  Helper.division((originalCost + cost), newOnHand, afterDecimal)

            
            // newCost = newCost<0 && originalCost<0 ? billingLine.unitCost  : newCost <0 ? billingLine.unitCost  :newCost  

            //update the current product unitCost 
            await ProductRepo.setProductUnitCost(client, newCost, productId,afterDecimal)
            // set new Qty 

            branchProduct.onHand = newOnHand;



            //update branchProduct on Hand 
            // await BranchProductsRepo.setNewOnHand(client, branchId, supplerCreditLine.productId, newOnHand)

            // update movment corresponding  to edited Billing Line 
            // await InventoryMovmentRepo.updateMovmentCost(client, oldMovmentLine.movmentId, billingCost * (-1))
            // await InventoryMovmentRepo.updateMovmentLineCostQty(client, oldMovmentLine.lineId, billingCost, billingLine.qty, currentOnHand, currentCost)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
}