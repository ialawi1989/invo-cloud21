// import { BillingLine } from "@src/models/account/BillingLine";
// import { InventoryMovment } from "@src/models/account/InventoryMovment";
// import { InventoryMovmentLine } from "@src/models/account/InventoryMovmentLine";
// import { Batches } from "@src/models/product/Batches";
// import { BranchProducts } from "@src/models/product/BranchProducts";
// import { Serials } from "@src/models/product/Serials";
// import { PoolClient } from "pg";

// import { BranchProductsRepo } from "../product/branchProduct.repo";
// import { ProductRepo } from "../product/product.repo";
// import { InvoiceInventoryMovmentRepo } from "./InvoiceInventoryMovment.repo";

// 
// import { BatchProductRepo } from "../product/productTypes/batchProduct.reps";
// import { SerialProductRepo } from "../product/productTypes/serilizedProduct.repo";
// import { Helper } from "@src/utilts/helper";
// import { InventoryMovmentRepo } from "./inventoryMovment.repo";
// import { Billing } from "@src/models/account/Billing";
// import { ResponseData } from "@src/models/ResponseData";
// export class BillingMovmentRepo {
//     /**
//      * 
//      * @param client 
//      * @param branchId 
//      * @param billingLine 
//      * @param afterDecimal
//      * 
//      * ONly Inventory/ serial and batch products are used in billing  
//      */
//     public static async inserInventoryMovment(client: PoolClient, branchId: string, billingLine: BillingLine, afterDecimal: number) {
//         try {
//             const productId = billingLine.productId
//             if (productId) {
//                 // check if product exist in branch if not then create and insert product into billing branch 
//                 const isProductExistInBranch = await BranchProductsRepo.checkIfProductAlreadyExistInBarnch(client, productId, branchId);
//                 if (!isProductExistInBranch) {
//                     const branchProduct = new BranchProducts();
//                     branchProduct.productId = productId;
//                     branchProduct.branchId = branchId;
//                     branchProduct.onHand = 0;
//                     await BranchProductsRepo.insertBranchProduct(client, branchProduct)
//                 }


//                 const productType = await ProductRepo.getProductType(client, productId);
//                 if (productType == "serialized" && (billingLine.serials.length <= 0 || billingLine.serials == null)) {
//                     throw new Error("Serials Are Required")
//                 }

//                 if (productType == "batch" && (billingLine.batches.length <= 0 || billingLine.batches == null)) {
//                     throw new Error("Batches Are Required")
//                 }


//                 switch (productType) {
//                     case "inventory":
//                         await this.insertInventoryProductMovment(client, branchId, billingLine, afterDecimal)
//                         break;
//                     case "batch":
//                         await this.insertbatchProductMovment(client, branchId, billingLine, afterDecimal)
//                         break;
//                     case "serialized":
//                         await this.insertSerializedProductMovment(client, branchId, billingLine, afterDecimal)
//                         break;

//                     default:
//                         break;
//                 }
//             }




//         } catch (error: any) {
//             
//             throw new Error(error.message)
//         }
//     }


//     private static async insertInventoryProductMovment(client: PoolClient, branchId: string, billingLine: BillingLine, afterDecimal: number) {
//         try {
         
        
//             if (billingLine.productId) {
//                 /** will apply average calcullation on product unit cost and update product onHand*/
//                 const updatedData = await ProductRepo.calculateUnitCostAvg(client, billingLine.productId, branchId, billingLine.qty, billingLine.unitCost, afterDecimal)
//                 await this.inserMovment(client, billingLine.employeeId, branchId, billingLine.id, billingLine.productId, updatedData.newCost, billingLine.qty, null, updatedData.oldCost, updatedData.oldonHand)

//             }

//         } catch (error: any) {
//             
//             throw new Error(error.message)
//         }
//     }
//     private static async insertbatchProductMovment(client: PoolClient, branchId: string, billingLine: BillingLine, afterDecimal: number) {
//         try {

//             const branchProductData = await BranchProductsRepo.getBranchProductAndUnitCost(client, billingLine.productId, branchId);
//             /** check if product exist on Branch if not add new branchProduct */
//             const branchProduct = new BranchProducts();
//             branchProduct.ParseJson(branchProductData);
//             let branchProductId = branchProduct.id;
//             if (!branchProduct.id) {

//                 branchProduct.branchId = branchId;
//                 if (billingLine.productId) {
//                     branchProduct.productId = billingLine.productId;
//                 }

//                 branchProductId = await BranchProductsRepo.insertBranchProduct(client, branchProduct)
//             }



//             for (let index = 0; index < billingLine.batches.length; index++) {
//                 //create new batch 
//                 const element: any = billingLine.batches[index]
//                 const batch = new Batches();
//                 batch.branchProductId = branchProductId;
//                 batch.companyId = branchProduct.companyId;
//                 batch.batch = element.batch;
//                 batch.onHand = element.onHand;
//                 batch.prodDate = element.prodDate;
//                 batch.expireDate = element.expireDate;
//                 batch.unitCost = Helper.roundNum(element.unitCost, afterDecimal)
//                 //insert batch 
//                 await BatchProductRepo.addBatch(client, batch)

//                 //insert movment 
//                 const cost = Helper.multiply(billingLine.qty, batch.unitCost, afterDecimal)
//                 if (billingLine.productId) {
//                     await this.inserMovment(client, billingLine.employeeId, branchId, billingLine.id, billingLine.productId, cost, batch.onHand, batch.batch, 0, 0)
//                 }
//             }





//         } catch (error: any) {
//             
//             throw new Error(error.message)
//         }
//     }
//     private static async insertSerializedProductMovment(client: PoolClient, branchId: string, billingLine: BillingLine, afterDecimal: number) {
//         try {

//             const branchProductData = await BranchProductsRepo.getBranchProductAndUnitCost(client, billingLine.productId, branchId);
//             const branchProduct = new BranchProducts();
//             branchProduct.ParseJson(branchProductData);
//             let branchProductId = branchProduct.id;
//             if (!branchProduct.id) {
//                 branchProduct.branchId = branchId;
//                 if (billingLine.productId) {
//                     branchProduct.productId = billingLine.productId;
//                 }

//                 branchProductId = await BranchProductsRepo.insertBranchProduct(client, branchProduct)
//             }
//             let cost = 0;
//             const serialData = await SerialProductRepo.getSerialOnHandAndUnitCost(client, billingLine.productId, branchId)

//             for (let index = 0; index < billingLine.serials.length; index++) {
//                 const element: any = billingLine.serials[index];

//                 const serial = new Serials();
//                 serial.branchProductId = branchProduct.id;
//                 serial.companyId = branchProduct.companyId;
//                 serial.serial = element.serial
//                 serial.unitCost = Helper.roundNum(element.unitCost, afterDecimal)

//                 //Insert new Serial 
//                 if (billingLine.productId) {
//                     await SerialProductRepo.addSerial(client, serial, billingLine.productId);
//                 }

//                 //Calculate Cost 
//                 cost += element.unitCost
//             }

//             if (billingLine.productId) {

//                 await this.inserMovment(client, billingLine.employeeId, branchId, billingLine.id, billingLine.productId, cost, billingLine.serials.length, null, serialData.currentCost, serialData.currentOnHand)
//             }

//         } catch (error: any) {
//             
//             throw new Error(error.message)
//         }
//     }
//     private static async inserMovment(client: PoolClient, employeeId: string, branchId: string, billingLineId: string, productId: string, cost: number, qty: number, batch: string | null, currentCost: number, currentOnHand: number) {
//         try {
//             //Insert Product Movment 

//             qty = qty * (-1);
//             cost = cost * (-1);
//             const movmentData = {
//                 qty: qty,
//                 cost: cost,
//                 lineId: billingLineId,
//                 refrenceTable: "Billing",
//                 currentCost: currentCost,
//                 currentOnHand: currentOnHand,
//                 productId: productId,
//                 branchId: branchId,
//                 employeeId: employeeId
//             }
//             await InventoryMovmentRepo.createAndInsertMovment(client, movmentData)

//         } catch (error: any) {
//             throw new Error(error.message)
//         }
//     }

//     //when editing Billing Line 
//     public static async updateInventoryMovment(client: PoolClient, branchId: string, billingLine: BillingLine, afterDecimal: number) {
//         try {
//             const productType = await ProductRepo.getProductType(client, billingLine.productId);
//             switch (productType) {
//                 case "inventory":
//                     // await this.updateInventoryProductMovment(client, branchId, billingLine, afterDecimal)
//                     break;
//                 case "batch":
//                     await this.updatebatchProductMovment(client, branchId, billingLine, afterDecimal)
//                     break;
//                 case "serialized":
//                     await this.updateSerializedProductMovment(client, branchId, billingLine, afterDecimal)
//                     break;

//                 default:
//                     break;
//             }


//         } catch (error: any) {
//             
//             throw new Error(error.message)
//         }
//     }

//     public static async getOldLine(client: PoolClient, billingLineId: string) {
//         try {
//             const query : { text: string, values: any } = {
//                 text: `SELECT * FROM "BillingLines" where id=$1`,
//                 values: [billingLineId]
//             }

//             const line = await client.query(query.text, query.values);
//             return line.rows[0]
//         } catch (error: any) {
//             throw new Error(error)
//         }
//     }

//     private static async updatebatchProductMovment(client: PoolClient, branchId: string, billingLine: BillingLine, afterDecimal: number) {
//         try {
//             const branchProductData = await BranchProductsRepo.getBranchProductAndUnitCost(client, billingLine.productId, branchId);
//             const branchProduct = new BranchProducts();
//             branchProduct.ParseJson(branchProductData);

//             for (let index = 0; index < billingLine.batches.length; index++) {
//                 const element: any = billingLine.batches[index];
//                 const batch = new Batches();
//                 batch.ParseJson(element)
//                 batch.branchProductId = branchProduct.id;
//                 batch.companyId = branchProduct.companyId;
//                 const currentOnHand = branchProduct.onHand;
//                 const currentCost = Helper.multiply(currentOnHand, branchProductData.unitCost, afterDecimal)
//                 const oldLine = await this.getBillingMovment(client, billingLine.id, batch.batch);
//                 if (billingLine.productId) {
//                     batch.id = await BatchProductRepo.getBatchId(client, branchId, batch.batch, billingLine.productId)
//                 }

//                 if (element.isDeleted) {
//                     await BatchProductRepo.deleteBatch(client, branchId, element.batch);
//                     await InventoryMovmentRepo.deleteInventoryMovmentLine(client, oldLine.lineId, oldLine.movmentId)
//                     continue;
//                 }
//                 // edit batch 
//                 if (batch.id != null && batch.id != "") {
//                     await BatchProductRepo.editBatch(client, batch)

//                     const cost = Helper.multiply(billingLine.qty, billingLine.unitCost, afterDecimal)
//                     // update movment corresponding  to edited Billing Line 
//                     await InventoryMovmentRepo.updateMovmentCost(client, oldLine.movmentId, cost * (-1))
//                     await InventoryMovmentRepo.updateMovmentLineCostQty(client, oldLine.lineId, batch.unitCost, batch.onHand, currentOnHand, currentCost)
//                 } else {
//                     await BatchProductRepo.addBatch(client, batch)
//                     const cost = Helper.multiply(batch.onHand, batch.unitCost, afterDecimal)
//                     if (billingLine.productId) {
//                         await this.inserMovment(client, billingLine.employeeId, branchId, billingLine.id, billingLine.productId, cost, billingLine.serials.length, null, 0, 0)
//                     }
//                 }
//             }
//         } catch (error: any) {
//             
//             throw new Error(error.message)
//         }
//     }
//     private static async updateSerializedProductMovment(client: PoolClient, branchId: string, billingLine: BillingLine, afterDecimal: number) {
//         try {
//             const branchProductData = await BranchProductsRepo.getBranchProductAndUnitCost(client, billingLine.productId, branchId);
//             const branchProduct = new BranchProducts();
//             branchProduct.ParseJson(branchProductData);
//             const productId: any = billingLine.productId;
//             const oldLine = await this.getBillingMovment(client, billingLine.id, null);
//             let cost = 0;
//             const serialData = await SerialProductRepo.getSerialOnHandAndUnitCost(client, billingLine.productId, branchId)
//             const currentOnHand = serialData.currentOnHand;
//             const currentCost = serialData.currentCost
//             for (let index = 0; index < billingLine.serials.length; index++) {
//                 const element: any = billingLine.serials[index];
//                 const serial = new Serials();
//                 serial.branchProductId = branchProduct.id;
//                 serial.companyId = branchProduct.companyId;
//                 serial.serial = element.serial;
//                 serial.unitCost = element.unitCost;
//                 if (billingLine.productId) {
//                     serial.id = await SerialProductRepo.getSerialId(client, branchId, billingLine.productId, serial.serial)
//                 }

//                 // edit serial 

//                 if (element.isDeleted) {
//                     await SerialProductRepo.deleteSerial(client, serial.serial, branchId, productId);
//                     continue;
//                 }
//                 if (serial.id != "" && serial.id != null && billingLine.productId) {
//                     await SerialProductRepo.editSerial(client, serial, productId);
//                     cost += Helper.roundNum(serial.unitCost, afterDecimal)
//                 } else {
//                     SerialProductRepo.addSerial(client, serial, productId)
//                 }

//             }

//             // update movment corresponding  to edited Billing Line 
//             await InventoryMovmentRepo.updateMovmentCost(client, oldLine.movmentId, cost * (-1))
//             await InventoryMovmentRepo.updateMovmentLineCostQty(client, oldLine.lineId, cost, 1, currentOnHand, currentCost)

//         } catch (error: any) {
//             
//             throw new Error(error.message)
//         }
//     }

//     public static async getBillingMovment(client: PoolClient, billingLineId: string, batch: string | null) {
//         try {
//             const query : { text: string, values: any } = {
//                 text: `SELECT 
//                         "InventoryMovmentLines".id AS "lineId",
//                         "InventoryMovments".id AS "movmentId",
//                         "InventoryMovmentLines".qty,
//                         "InventoryMovmentLines".cost
//                 FROM "InventoryMovments"
//                 INNER JOIN "InventoryMovmentLines"
//                 ON "InventoryMovmentLines"."inventoryMovmentId" = "InventoryMovments".id
//                 where "InventoryMovments"."billingLineId" =$1 
//              `,
//                 values: [billingLineId]
//             }
//             const movment = await client.query(query.text, query.values);
//             return movment.rows[0]
//         } catch (error: any) {
//             
//             throw new Error(error.message)
//         }
//     }
// }