import { DB } from "@src/dbconnection/dbconnection";

import { BranchProducts } from "@src/models/product/BranchProducts";

import { ResponseData } from "@src/models/ResponseData";
import { SocketProductRepo } from "@src/repo/socket/product.socket";

import { BranchProductsValidation } from "@src/validationSchema/product/branchProducts.Schema";

import { PoolClient } from "pg";

import { InvoiceInventoryMovmentRepo } from "../accounts/InvoiceInventoryMovment.repo";

import { ManualAdjusmentRepo } from "../accounts/manualAdjusment.Repo";

import { ProductRepo } from "./product.repo";



import { BatchProductRepo } from "./productTypes/batchProduct.reps";
import { SerialProductRepo } from "./productTypes/serilizedProduct.repo";
import { Helper } from "@src/utilts/helper";
import { ValidationException } from "@src/utilts/Exception";
import { Company } from "@src/models/admin/company";
import { InventoryMovment } from "@src/models/account/InventoryMovment";
import moment from "moment";
import { MenuRepo } from "./menu.repo";
import { InventoryMovmentLine } from "@src/models/account/InventoryMovmentLine";
import { Log } from "@src/models/log";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";


export class BranchProductsRepo {


  public static async checkIfProductAlreadyExistInBarnch(client: PoolClient, productId: string, branchId: string | null) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "BranchProducts" where  "productId" = $1 and "branchId"=$2  `,
      values: [
        productId,
        branchId
      ],
    };
    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }
  public static async checkBranchProductIdExist(id: string, companyId: string) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "BranchProducts" where  id = $1 and "companyId" = $2 `,
      values: [
        id,
        companyId,

      ],
    };
    const resault = await DB.excu.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }
  public static async pricingValidation(branchProduct: BranchProducts, afterDecimal: number, price: number) {


    if (branchProduct.selectedPricingType == 'buyDownPrice') {
      branchProduct.priceByQty = null;
      branchProduct.buyDownPrice = +(branchProduct.buyDownPrice).toFixed(afterDecimal)
    } else if (branchProduct.selectedPricingType == 'priceByQty') {
      if (branchProduct.priceByQty == null) {
        throw new ValidationException("price By Qty is required");
      }
      branchProduct.buyDownPrice = null;
      branchProduct.buyDownQty = null;
      for (let index = 0; index < branchProduct.priceByQty.length; index++) {
        branchProduct.priceByQty[index].price = +(branchProduct.priceByQty[index].price).toFixed(afterDecimal)
      }
    } else if (branchProduct.selectedPricingType == "priceBoundary") {
      if (branchProduct.priceBoundriesFrom != null) {
        if (branchProduct.priceBoundriesTo != null && branchProduct.priceBoundriesFrom > branchProduct.priceBoundriesTo) {
          throw new ValidationException(" Price Boundries From must be less than Price Boundries To")
        }
        if (price < branchProduct.priceBoundriesFrom) {
          throw new ValidationException("Price Boundries From is greater than Product Default Price ")
        }

        if (branchProduct.priceBoundriesTo != null && price > branchProduct.priceBoundriesTo) {
          throw new ValidationException("Price Boundries To is less than Product Default Price ")
        }
        branchProduct.priceBoundriesFrom = +(branchProduct.priceBoundriesFrom).toFixed(afterDecimal)
        branchProduct.priceBoundriesTo = branchProduct.priceBoundriesTo ? +(branchProduct.priceBoundriesTo).toFixed(afterDecimal) : null
      } else {
        throw new ValidationException("Price Boundaries are Required");
      }
    }

    return branchProduct;
  }

  public static async validateBranchProduct(branchProduct: BranchProducts, productType: string) {

    let validate: any;

    if (productType == 'batch') {
      validate = await BranchProductsValidation.batchesBranchProduct(branchProduct);
    } else if (productType == 'serialized') {
      validate = await BranchProductsValidation.serialBranchProduct(branchProduct);

    } else if (productType == 'inventory') {
      validate = await BranchProductsValidation.inventoryBranchProduct(branchProduct);
    } else {
      validate = await BranchProductsValidation.branchProductValidation(branchProduct);
    }

    if (!validate.valid) {

      throw new ValidationException(validate.error)
    }
  }
  public static async insertBranchProduct(client: PoolClient, branchProduct: BranchProducts) {
    try {
      branchProduct.updatedTime = new Date()
      const query: { text: string, values: any } = {
        text: `INSERT INTO "BranchProducts"
                   ( "productId", "branchId" , available, price,
                   "onHand", "priceBoundriesFrom", "priceBoundriesTo", "buyDownPrice","priceByQty", "buyDownQty", "companyId","selectedPricingType","availableOnline","locationId","openingBalance","openingBalanceCost","reorderLevel","reorderPoint","updatedTime") 
                   VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
        values: [
          branchProduct.productId,
          branchProduct.branchId,
          branchProduct.available,
          branchProduct.price,
          branchProduct.onHand,
          branchProduct.priceBoundriesFrom,
          branchProduct.priceBoundriesTo,
          branchProduct.buyDownPrice,
          JSON.stringify(branchProduct.priceByQty),
          branchProduct.buyDownQty,
          branchProduct.companyId,
          branchProduct.selectedPricingType,
          branchProduct.availableOnline,
          branchProduct.locationId,
          branchProduct.openingBalance,
          branchProduct.openingBalanceCost,
          branchProduct.reorderLevel,
          branchProduct.reorderPoint,
          branchProduct.updatedTime
        ],
      };

      const insert = await client.query(query.text, query.values);

      return (insert.rows[0]).id
    } catch (error: any) {
    

      throw new Error(error)
    }
  }
  public static async addProductToBranch(client: PoolClient, branchProduct: BranchProducts, productType: string, companyId: string, afterDecimal: number, price: number, employeeId: string) {

    //validate BranchProduct Data
    await this.validateBranchProduct(branchProduct, productType);

    //check if product already exist in branch 
    const isProductAlreadyExist = await this.checkIfProductAlreadyExistInBarnch(client, branchProduct.productId, branchProduct.branchId)
    if (isProductAlreadyExist) {
      throw new ValidationException("Product Already Exist In Branch")
    }
    // Validate Pricing Types
    branchProduct = await this.pricingValidation(branchProduct, afterDecimal, price)
    //Insert branchProduct
    try {
      branchProduct.companyId = companyId;
      branchProduct.onHand = branchProduct.onHand + (branchProduct.openingBalance)
      branchProduct.id = await this.insertBranchProduct(client, branchProduct)

      const product = await ProductRepo.getProductUnitCost(client, branchProduct.productId);
      //product manual adjusment movment for inventory and kit 
      let inventoryMovmentId;
      // if ((productType == 'inventory' || productType == 'kit') && branchProduct.onHand != 0) {

      //   const currentCost = 0;
      //   const currentOnHand = 0;
      //   const totalCost = product.unitCost * branchProduct.onHand;
      //   const qty = branchProduct.onHand;
      //   inventoryMovmentId = await ManualAdjusmentRepo.manualAdjustmentMovment(client, employeeId, product.unitCost, qty, branchProduct.branchId, currentCost, currentOnHand, branchProduct.productId, afterDecimal, "Manual Adjusment", null, null);

      // }


      // insert branchProduct Batches 
      // if (branchProduct.openingBalance > 0) {
      //   await JournalTriggers.inventoryOpeningBalance(client, branchProduct.productId, companyId, branchProduct.branchId)
      // }
      if (branchProduct.batches) {
        inventoryMovmentId = await BatchProductRepo.insertBranchBatches(client, employeeId, branchProduct.batches, branchProduct.id, companyId, branchProduct.branchId, branchProduct.productId, afterDecimal)
      }
      // insert branchProduct Serials  
      if (branchProduct.serials) {
        inventoryMovmentId = await SerialProductRepo.saveBranchProductSerials(client, employeeId, branchProduct.serials, companyId, branchProduct.id, branchProduct.branchId, branchProduct.productId, afterDecimal)
      }
      //send new Product to POS 
      await SocketProductRepo.sendNewProduct(client, branchProduct.productId, branchProduct.branchId, companyId)

      return new ResponseData(true, "Added Successfully", { id: branchProduct.id, inventoryMovmentId: inventoryMovmentId })

    } catch (error: any) {
    
      throw new Error(error)
    }

  }
  public static async editBranchProduct(client: PoolClient, branchProduct: BranchProducts, companyId: string, afterDecimal: number, price: number, employeeId: string, currencySymbol: string) {
    try {


      const productType = await ProductRepo.getProductType(client, branchProduct.productId);
      const productData: any = await ProductRepo.getProductOnHandAndUnitCost(client, branchProduct.productId, branchProduct.branchId)

      //validate data
      await this.validateBranchProduct(branchProduct, productType)
      if (branchProduct.id == null || branchProduct.id == "") {
        throw new ValidationException("branch product id Is Required")
      }

      //Pricing types Validation [buyDownPrice,priceByQty,priceBoundary]
      branchProduct = await this.pricingValidation(branchProduct, afterDecimal, price);

      //update branch Product

      let inventoryMovmentId;
      // Manual Adjusment Movment on branch onHand Changed [inventory and kit]
      // if (productData) {
      //   if (productType == 'inventory' || productType == 'kit') {
      //     const currentOnHand = productData.onHand;
      //     const currentCost = productData.unitCost * currentOnHand;
      //     let qty=0;


      //     if (currentOnHand != branchProduct.onHand) {

      //       const qty = branchProduct.onHand - currentOnHand;
      //       inventoryMovmentId = await ManualAdjusmentRepo.manualAdjustmentMovment(client, employeeId, productData.unitCost, qty, branchProduct.branchId, currentOnHand, currentCost, branchProduct.productId, afterDecimal, "Manual Adjusment", null, null);
      //     }
      //   }
      // }
      // branchProduct.onHand =  branchProduct.onHand + (branchProduct.openingBalance   - productData.openingBalance  )

      const query: { text: string, values: any } = {
        text: `UPDATE "BranchProducts" SET
                      available= $1,
                       price= $2,
                        "priceBoundriesFrom"=$3,
                         "priceBoundriesTo"=$4,
                          "buyDownPrice"=$5,
                          "priceByQty"=$6,
                           "buyDownQty"=$7,
                            "selectedPricingType"=$8,
                            "availableOnline"=$9,
                            "locationId"=$10,
                            "reorderLevel"=$11,
                            "reorderPoint"=$12,
                            "updatedTime"=$13
              WHERE id=$14 `,
        values: [
          branchProduct.available,
          branchProduct.price,
          branchProduct.priceBoundriesFrom,
          branchProduct.priceBoundriesTo,
          branchProduct.buyDownPrice,
          JSON.stringify(branchProduct.priceByQty),
          branchProduct.buyDownQty,
          branchProduct.selectedPricingType,
          branchProduct.availableOnline,
          branchProduct.locationId,
          branchProduct.reorderLevel,
          branchProduct.reorderPoint,
          branchProduct.updatedTime,
          branchProduct.id],
      };
      await client.query(query.text, query.values)



      // await JournalTriggers.inventoryOpeningBalance(client, branchProduct.productId, companyId, branchProduct.branchId)

      //insert or update branch batches 
      if (branchProduct.batches != null) {
        inventoryMovmentId = await BatchProductRepo.insertBranchBatches(client, employeeId, branchProduct.batches, branchProduct.id, companyId, branchProduct.branchId, branchProduct.productId, afterDecimal)
      }
      //insert or update branch serials 
      if (branchProduct.serials != null) {
        inventoryMovmentId = await SerialProductRepo.saveBranchProductSerials(client, employeeId, branchProduct.serials, companyId, branchProduct.id, branchProduct.branchId, branchProduct.productId, afterDecimal)
      }

      let getEmployeeName = {
        text: `SELECT "Employees"."name" as "employeeName"
                  FROM "Employees"
                  WHERE "Employees".id = $1 and "Employees"."companyId" = $2
                        `,
        values: [employeeId, companyId]
      }
      let employeeName = (await client.query(getEmployeeName.text, getEmployeeName.values)).rows[0].employeeName;


      const getOldPriceProductName = {
        text: `SELECT "BranchProducts"."price", "Products"."name"
              FROM "BranchProducts" 
              INNER JOIN "Products" on "Products".id = "BranchProducts"."productId"
              WHERE "BranchProducts".id=$1
              AND "Products".id = $2`,
        values: [branchProduct.id, branchProduct.productId]
      }

      let getOldPriceProductNameResult = (await client.query(getOldPriceProductName.text, getOldPriceProductName.values))
      let oldPrice = getOldPriceProductNameResult.rows[0].price;
      let productName = getOldPriceProductNameResult.rows[0].name;


      if (branchProduct.price && oldPrice != branchProduct.price) {
        let log = new Log();
        log.employeeId = employeeId
        log.action = "Item Branch Price Changed"
        log.comment = `${employeeName} has changed the item (${productName}) branch (${branchProduct.name}) price from (${oldPrice}) to (${branchProduct.price})`

        log.metaData = {
          "itemName": productName,
          "branchId": branchProduct.branchId,
          "branchName": branchProduct.name,
          "oldPrice": oldPrice,
          "newPrice": branchProduct.price,
          "currency": currencySymbol
        }

        await LogsManagmentRepo.manageLogs(client, "Products", branchProduct.productId, [log], null, companyId, employeeId, "", "Cloud")

      }

      //send Updated Product to POS
      await SocketProductRepo.sendUpdatedProduct(client, branchProduct.productId, branchProduct.branchId, companyId)
      return new ResponseData(true, "Updated Successfully", { inventoryMovmentId: inventoryMovmentId })
    } catch (error: any) {
    

      throw new Error(error)
    }
  }

  //check Parent OnHand 

  public static async updateProductOnHand(client: PoolClient, branchId: string, qty: number, product: any, afterDecimal: number, parentsData: any, usages: number | null, employeeId: string, isInvoice = false, lineId: string | null = null) {
    try {


      /**
       * Note: this function is recursive
       * function check if the product has a parent and if the onHand of the current product 
       * is zero will find the nearest parent with onHnad greater than zero and edit the product onHand along with the parent onHand
       * 
       * in case the product is not a parent child product the function will only update the current onHand Product with Out recursive   
       */


      /**
       * qty: expected to received negative and positive
       * 
       *  negative: when returning product to inventory 
       * 
       *  positive: when reducing inventory 
       */


      const branchProduct = await InvoiceInventoryMovmentRepo.getBranchProduct(client, product.id, branchId);
      const currentOnHand = branchProduct.onHand;

      let usedQty = 0
      let childQty = 0
      if (parentsData && parentsData.length > 0) {
        let element = parentsData[0];
        const childOnhand = await InvoiceInventoryMovmentRepo.getBranchProduct(client, element.productId, branchId)
        childQty = element.childQty;
        do {
          usedQty++;
        } while ((childOnhand.onHand + (usedQty * element.childQty)) < qty);
      }


      if (qty > 0) { //Decrease on Inventory 

        if ((currentOnHand <= 0 || (currentOnHand > 0 && currentOnHand < qty)) && parentsData && parentsData.length > 0) { // case when product onHand =0 and it has A parent

          for (let index = 0; index < parentsData.length; index++) { // loop through parents  of the product 
            const element = parentsData[index];//parent data 
            const branchData = await InvoiceInventoryMovmentRepo.getBranchProduct(client, element.parentId, branchId) // get Parent OnHand

            if (branchData.onHand <= 0) { // if parent onHand = 0 

              /**
               * when all product parents onHand are 0 
               * reduce the current product onHand - qty  
               * so that the current product onHand = -qty 
               */
              if (parentsData && index == parentsData.length - 1) {
                //Here you can return Out of Stock 
                const newOnHand = branchProduct.onHand - qty

                // await this.setNewOnHand(client, branchId, product.id, newOnHand)
              }
              continue; // to continue  to the next parent hence the current parent onHand is zero 
            } else { // when the parent had onHand  >0 
              const childOnhand = await InvoiceInventoryMovmentRepo.getBranchProduct(client, element.productId, branchId)

              if (childOnhand.onHand <= 0 || (childOnhand.onHand > 0 && childOnhand.onHand < qty)) {

                //update parent
                // let usedQty = 0;
                //  do{
                //   usedQty ++;
                //  }while((childOnhand.onHand + (usedQty*element.childQty))<qty);
                if (index == parentsData.length - 1) {
                  let tempUsedQty = 0;
                  do {
                    tempUsedQty++;

                  } while ((childOnhand.onHand + (tempUsedQty * element.childQty * childQty)) <= (usedQty * childQty));
                  usedQty = tempUsedQty

                }


                const newOnHand = branchData.onHand - usedQty;
                const parentCurrentCost = branchData.onHand * (element.unitCost);
                const parentCost = (element.unitCost);
                const parentCurrentOnHand = branchData.onHand;

                /** Parent Cost will be calculated based on child cost to resolve divison difference*/
                // const chidlCost = Helper.roundDecimal(element.childUnitCost, afterDecimal);
                // let parentUnitCost = Helper.roundDecimal((element.childQty) * chidlCost, afterDecimal);
                // await ProductRepo.setProductUnitCost(client, parentUnitCost, element.parentId,afterDecimal) /** setting the new calcualted Cost */
                await this.setNewOnHand(client, branchId, element.parentId, newOnHand)

                await ManualAdjusmentRepo.manualAdjustmentMovment(client, employeeId, 0, (-1 * usedQty), branchId, parentCurrentOnHand, parentCurrentCost, element.parentId, afterDecimal, "Parent  Inventory Movment", element.productId, null, lineId, isInvoice)

                // update child

                const newQty = (childOnhand.onHand + (usedQty * element.childQty))
                await this.setNewOnHand(client, branchId, element.productId, newQty)
                await ManualAdjusmentRepo.manualAdjustmentMovment(client, employeeId, 0, element.childQty * usedQty, branchId, 0, 0, element.productId, afterDecimal, "Child Inventory Movment", element.parentId, null, lineId, isInvoice)

                //recursive
                await this.updateProductOnHand(client, branchId, qty, product, afterDecimal, parentsData, usages, employeeId, isInvoice, lineId)
                break;
              }
            }
          }


        } else { // when not a parent child product 
          let updatedOnHand;
          if (usages == null) { // usages is for recipe and menuItem 
            updatedOnHand = currentOnHand - qty;
          } else {
            updatedOnHand = currentOnHand - (qty * usages);

          }
          await this.setNewOnHand(client, branchId, product.id, updatedOnHand)


        }
      } else { //Increase on Inventory 
        /**
         * multiplying by (-1) because when qty received (negative)  
         * that means decreasing in the invoiceLine qty and increasing in inventory qty 
         */
        const newOnHand = currentOnHand + (qty * (-1));
        await this.setNewOnHand(client, branchId, product.id, newOnHand)
      }
      let currentCost = 0
      if (product.unitCost) {
        currentCost = Helper.multiply(branchProduct.onHand, product.unitCost, afterDecimal);
      }

      return {
        currentCost: currentCost,
        currentOnHand: currentOnHand,
        unitCost: product.unitCost
      }
    } catch (error: any) {
      console.log(error)
    
      throw new Error(error)
    }
  }



  public static async getChildParents(client: PoolClient | null, productId: string, branchId: string) {
    try {
      const query = {
        text: `WITH RECURSIVE generation AS (
                      SELECT id,
                           name,
                           "parentId",
                           "childQty",
                           "unitCost",
                           0 AS generation_number
                      FROM "Products"
                      where id =$1
                     
                   
                  UNION ALL
                   
                      SELECT parent.id,
                           parent.name,
                           parent."parentId",
                           parent."childQty",
                           parent."unitCost",
                           generation_number+1 AS generation_number
                      FROM "Products" as parent
                      JOIN generation g
                        ON g."parentId" = parent.id
                      
                   
                  )
                   
                  SELECT 
                          g.name AS child_name,
                          g.id AS "productId",
                    
                          g."childQty" As "childQty",
                          g.generation_number,
              parent.name as "parentName",
                          parent.id AS "parentId",
                          "childBranch"."onHand" as "childOnHand",
                          "parentBranch"."onHand" as "parentOnHand",
                          "childBranch"."productUnitCost" as "childUnitCost",
                          "parentBranch"."productUnitCost" as "parentUnitCost"
                  FROM generation g
                  JOIN "Products" parent
                  ON g."parentId" = parent.id
          INNER join "BranchProducts" "childBranch" on "childBranch"."productId" =  g.id and "childBranch"."branchId" = $2
          INNER join "BranchProducts" "parentBranch" on "parentBranch"."productId" =  parent.id and "parentBranch"."branchId" = $2
          ORDER BY generation_number;`,
        values: [productId, branchId]
      }

      const parents = client ? await client.query(query.text, query.values) : await DB.excu.query(query.text, query.values);

      if (parents && parents.rows && parents.rows.length > 0) {
        return parents.rows
      }

      return null


    } catch (error: any) {
      throw new Error(error)
    }
  }
  public static async setOnHandNew(client: PoolClient, productId: string, branchId: string, qty: number, employeeId: string, afterDecimal: number, invoiceLine: string | null = null, transferOut: string | null = null, insertMovments: boolean = true) {
    try {
      console.log(productId)
      let childs = await this.getChildParents(client, productId, branchId)
      let movment = new InventoryMovment();
      movment.invoiceLineId = invoiceLine
      movment.inventoryTransferLineId = transferOut
      movment.employeeId = employeeId;
      movment.branchId = branchId;
      if (childs) {
        let usedQty = 0
        let requiredQty = 0
        for (let index = 0; index < 2; index++) {
          const element = childs[index];
          console.log(element)
          if (index == 0) {
            usedQty = element.childOnHand > qty ? qty : element.childOnHand
            qty -= usedQty
            if (qty == 0) {
              console.log("here 1 111111")
              if (!insertMovments) {
                let cost = (await ProductRepo.getProductLatestCost(client, element.productId, branchId))?.cost ?? 0
                return { qty: element.childQty, cost: cost, id: null }

              } else {
                break
              }

            }
          }

          /** required child qty  */
          do {
            requiredQty += 1;

          } while (requiredQty * element.childQty < qty);


          /** if parentonHand covers all required qty of child */
          if (requiredQty < element.parentOnHand) {
            console.log(element)
            const line = new InventoryMovmentLine()
            line.productId = element.parentId;
            line.qty = requiredQty * -1;
            line.parentChildId = element.productId;

            const childLine = new InventoryMovmentLine();
            childLine.productId = element.productId;
            childLine.qty = requiredQty * element.childQty;
            childLine.parentChildId = element.parentId;
            movment.lines.push(childLine)
            movment.lines.push(line)
            console.log("here 222222222222222222222")
            if (!insertMovments) {
              let cost = (await ProductRepo.getProductLatestCost(client, element.parentId, branchId))?.cost ?? 0
              console.log(cost, element.childQty)
              return { qty: element.parentOnHand * element.childQty, cost: cost == 0 ? 0 : cost / element.childQty, id: null }
            } else {
              break;
            }

          } else {

            let nextParent = childs[index + 1]

            if (nextParent && nextParent.parentOnHand > 0) {
              let parentUsedQty = 0
              do {
                parentUsedQty = +1
              } while (parentUsedQty * nextParent.childQty < requiredQty);

              const appliedParentQty = parentUsedQty >= nextParent.parentOnHand ? nextParent.parentOnHand : parentUsedQty


              const line = new InventoryMovmentLine()
              line.productId = nextParent.parentId;
              line.qty = appliedParentQty * -1;
              line.parentChildId = nextParent.productId;

              const childLine = new InventoryMovmentLine();
              childLine.productId = nextParent.productId;
              childLine.qty = appliedParentQty * nextParent.childQty;
              childLine.parentChildId = nextParent.parentId;


              const line2 = new InventoryMovmentLine()
              line2.productId = element.parentId;
              line2.qty = requiredQty * -1;
              line2.parentChildId = element.productId;

              const childLine2 = new InventoryMovmentLine();
              childLine2.productId = element.productId;
              childLine2.qty = requiredQty * element.childQty;
              childLine2.parentChildId = element.parentId;
              movment.lines.push(childLine)
              movment.lines.push(line)
              movment.lines.push(childLine2)
              movment.lines.push(line2)
              console.log("here 333333333333333333333333333333")
              if (!insertMovments) {
                let cost = (await ProductRepo.getProductLatestCost(client, element.parentId, branchId))?.cost ?? 0
                return { qty: element.parentOnHand * element.childQty, cost: cost == 0 ? 0 : cost / element.childQty, id: null }
              } else {
                break;
              }
            } else {
              console.table(element)
              if (element.parentOnHand > 0) {
                const applyQty = element.parentOnHand
                const line = new InventoryMovmentLine()
                line.productId = element.parentId;
                line.qty = applyQty * -1;
                line.parentChildId = element.productId;

                const childLine = new InventoryMovmentLine();
                childLine.productId = element.productId;
                childLine.qty = applyQty * element.childQty;
                childLine.parentChildId = element.parentId;
                movment.lines.push(childLine)
                movment.lines.push(line)
                console.log("here 44444444444444444444444444444444444444444")

                if (!insertMovments) {
                  let cost = (await ProductRepo.getProductLatestCost(client, element.parentId, branchId))?.cost ?? 0
                  return { qty: element.parentOnHand * element.childQty, cost: cost == 0 ? 0 : cost / element.childQty, id: null }
                } else {
                  break;
                }
              } else {
                console.log("here 555555555555555555555555555555555555555555")
                if (!insertMovments) {
                  return { qty: 0, cost: 0, id: null }
                } else {
                  break;
                }
              }
            }
          }




        }
      }
      if (movment.lines.length > 0) {
        let id = await ManualAdjusmentRepo.serialAndBatchesKitManualAdjusmnets(client, movment, afterDecimal)

        return { qty: 0, cost: 0, id: id }
      }
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async setNewOnHand(client: PoolClient, branchId: string | null, productId: string | null, newOnHand: number, bulkUpdate = false) {
    try {
      if (!bulkUpdate) {


        const query: { text: string, values: any } = {
          text: `UPDATE "BranchProducts" 
                SET "onHand"=$1 , "updatedTime" = $4
                WHERE "branchId"=$2 AND "productId"=$3 `,
          values: [newOnHand, branchId, productId, new Date()]
        }

        await client.query(query.text, query.values)
      }

      await SocketProductRepo.onHandsync(client, newOnHand, productId, branchId)
    } catch (error: any) {
      console.log(error)
    
      throw new Error(error)
    }
  }
  public static async getBranchProductAndUnitCost(client: PoolClient, productId: string | null, branchId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT
        "BranchProducts".available,
        "BranchProducts"."branchId",
        "BranchProducts"."buyDownPrice",
        "BranchProducts"."buyDownQty",
        "BranchProducts"."companyId",
        "BranchProducts".id,
        "BranchProducts"."onHand",
        "BranchProducts".price,
        "BranchProducts"."priceBoundriesFrom",
        "BranchProducts"."priceBoundriesTo",
        "BranchProducts"."priceByQty",
        "BranchProducts"."productId",
        "BranchProducts"."openingBalance",
        "selectedPricingType",
        "Products"."unitCost"
        FROM "BranchProducts"
        INNER JOIN "Products"
        ON "BranchProducts"."productId" ="Products".id
        AND "BranchProducts"."productId"=$1
        AND "BranchProducts"."branchId"=$2`,
        values: [productId, branchId]
      }
      const branchProduct = await client.query(query.text, query.values);
      return branchProduct.rows[0]
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async getBranchProductId(client: PoolClient, productId: string | null, branchId: string) {
    try {

      const query: { text: string, values: any } = {
        text: `SELECT id 
        from "BranchProducts"
        where "BranchProducts"."productId"=$1
        AND "BranchProducts"."branchId"=$2`,
        values: [productId, branchId]
      }
      const branchProduct = await client.query(query.text, query.values);
      return branchProduct.rows[0].id
    } catch (error: any) {
    
      throw new Error(error)
    }
  }

  public static async getBranchProductAvailability(company: Company, data: any) {
    try {

      let branchId = data.branchId ? data.branchId : null;
      if (!branchId) { throw new ValidationException("branchId IS required"); }
      let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';

      let sort = data.sortBy;
      let sortValue = !sort ? 'prod."createdAt"' : '"' + sort.sortValue + '"';
      let sortDirection = !sort ? "DESC" : sort.sortDirection;
      let sortTerm = sortValue + " " + sortDirection
      let orderByQuery = ` Order by prod.id,` + sortTerm;


      let page = data.page ?? 1;
      let offset = 0;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }
      let count = 0;
      let pageCount = 0;

      const filter = data.filter;

      let types = ["inventory", "batch", "serialized", "service", "menuSelection", "menuItem", "package", "kit", "tailoring"]

      if (data.filter && data.filter.type && data.filter.type.length > 0) {
        types = data.filter.type;

      }
      const categories = filter && filter.categories ? filter.categories : [];
      const departments = filter && filter.departments ? filter.departments : [];


      const query: { text: string, values: any } = {
        text: `SELECT count(*) over(),
                      "productId", 
                      "branchProd".id as "branchProdId",
                      prod.name,
                      prod.type,
                      "Categories".name as "categoryName",
                      "Departments".name as "departmentName",
                      COALESCE(available,false) AS available ,
                      COALESCE("availableOnline",false) As "availableOnline",
                      case when  CURRENT_TIMESTAMP < "notAvailableUntil"::TIMESTAMP then "notAvailableUntil"::TIMESTAMP else null end as "notAvailableUntil" ,
                      case when  CURRENT_TIMESTAMP < "notAvailableOnlineUntil"::TIMESTAMP then "notAvailableOnlineUntil"::TIMESTAMP else null end as "notAvailableOnlineUntil",
                      json_array_length(COALESCE("optionGroups",'[]')) > 0 "hasOptions"
              FROM "BranchProducts" AS "branchProd"
              INNER JOIN "Products" As prod ON  prod.id = "branchProd"."productId"
              LEFT JOIN "Categories" on "Categories".id = prod."categoryId"
              LEFT JOIN "Departments" on "Departments".id = "Categories"."departmentId"
              WHERE "branchProd"."companyId" = $1 
              and  prod."isDeleted" = false 
                AND "branchId" = $2 
                 AND  (array_length($4::uuid[], 1) IS NULL OR ("Categories".id=any($4::uuid[])))
                 AND (array_length($5::uuid[], 1) IS NULL OR ("Departments".id=any($5::uuid[])))
                 AND  (array_length($6::varchar[], 1) IS NULL OR ( prod.type ilike any($6::varchar[])))
                AND (LOWER (prod.name) ~ $3
                OR LOWER (prod.barcode) ~ $3
                OR LOWER (prod.type) ~ $3
                OR LOWER (prod. "UOM") ~ $3
                OR LOWER ( (prod."translation" ->>'name')::jsonb->>'ar' ) ~ $3
                OR LOWER ( (prod."translation" ->>'name')::jsonb->>'en' ) ~ $3
                OR prod."defaultPrice"::varchar(255)~ $3 
                OR "branchProd".price ::varchar(255)~ $3
            
                
                )
     
                ${orderByQuery}
          Limit $7 offset $8`

        ,
        values: [company.id, branchId, searchValue, categories, departments, types, limit, offset]
      }
      const branchProducts = await DB.excu.query(query.text, query.values);

      if (branchProducts.rows.length > 0) {
        count = Number((<any>branchProducts.rows[0]).count)
        pageCount = Math.ceil(count / data.limit)

      }


      offset += 1
      let lastIndex = ((page) * limit)
      if (branchProducts.rows.length < limit || data.page == pageCount) {
        lastIndex = count
      }

      const resData = {
        list: branchProducts.rows,
        count: count,
        pageCount: pageCount,
        startIndex: offset,
        lastIndex: lastIndex
      }

      return new ResponseData(true, "", resData)

    } catch (error: any) {
    
      throw new Error(error)
    }
  }

  public static async UpdateBranchProductAvailability(client: PoolClient, companyId: string, data: any) {
    try {


      const branchProdId = data.branchProdId ? await this.checkBranchProductIdExist(data.branchProdId, companyId) ? data.branchProdId : null : null
      const available = data.available ?? null
      const availableOnline = data.availableOnline ?? null
      const pauseOnline = data.pauseOnline ?? null
      const branchProdIdAvailable = this.checkBranchProductIdExist(branchProdId, companyId)

      //onlineOption 

      let pauseUntil = null
      if (availableOnline == false) {
        let pauseUntil = null
      } else if (availableOnline == true && pauseOnline == true) {
        pauseUntil = moment(new Date()).add(1, 'day');
      }

      //Option 




      if (!branchProdId) { throw new ValidationException("Branch Product Id Doesn't Exist") }
      if (available == null) { throw new ValidationException("Available Status Doesn't Exist") }
      if (availableOnline == null) { throw new ValidationException("Online Available Status Doesn't Exist") }

      const query: { text: string, values: any } = {
        text: `UPDATE "BranchProducts" 
                set available = $1,
                    "availableOnline" = $2
                where id = $3 and "companyId" = $4`,
        values: [available, availableOnline, branchProdId, companyId]
      }
      await client.query(query.text, query.values);
      return new ResponseData(true, "Branch Product Availability Has Been Updated Successfully", [])
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async updateAvailability(client: PoolClient, companyId: string, data: any) {
    try {

      const branchProdId = data.branchProdId ? await this.checkBranchProductIdExist(data.branchProdId, companyId) ? data.branchProdId : null : null
      const available = data.available ?? null
      const pause = data.pause ?? null

      if (!branchProdId) { throw new ValidationException("Branch Product Id Doesn't Exist") }
      if (available == null) { throw new ValidationException("Available Status Doesn't Exist") }

      let notAvailableUntil = null
      if (available == false) {
        notAvailableUntil = null
      } else if (available == true && pause == true) {
        notAvailableUntil = moment(new Date()).add(1, 'day');
      }

      const query: { text: string, values: any } = {
        text: ` with "updatedStatus" as (
                UPDATE "BranchProducts" 
                    set available = $1,
                      "notAvailableUntil" = $2
                    where id = $3 and "companyId" = $4
                  RETURNING "productId" ,available ,"availableOnline" ,"branchId"
                )
                UPDATE "Products" 
                      set  "updatedDate"=$5 from (select "productId",available,"availableOnline","branchId" from "updatedStatus")t 
                      where id = t."productId"
                      RETURNING "Products".id  as "productId" ,"branchId","availableOnline" ,available
                `,
        values: [available, notAvailableUntil, branchProdId, companyId, new Date()]
      }
      let productData = await client.query(query.text, query.values);
      console.log(productData.rows)
      if (productData && productData.rows && productData.rows.length > 0) {
        await SocketProductRepo.updateProductAvailability(productData.rows[0], productData.rows[0].branchId)
      }

      return new ResponseData(true, "Branch Product Availability Has Been Updated Successfully", [])
    } catch (error: any) {
      console.log(error)
    
      throw new Error(error)
    }
  }

  public static async updateOnlineAvailability(client: PoolClient, companyId: string, data: any) {
    try {

      const branchProdId = data.branchProdId ? await this.checkBranchProductIdExist(data.branchProdId, companyId) ? data.branchProdId : null : null
      const available = data.available ?? null
      const pause = data.pause ?? null

      if (!branchProdId) { throw new ValidationException("Branch Product Id Doesn't Exist") }
      if (available == null) { throw new ValidationException("Available Status Doesn't Exist") }

      let notAvailableUntil = null
      if (available == false) {
        notAvailableUntil = null
      } else if (available == true && pause == true) {
        notAvailableUntil = moment(new Date()).add(1, 'day');
      }


      const query: { text: string, values: any } = {
        text: `UPDATE "BranchProducts" 
                set "availableOnline" = $1,
                    "notAvailableOnlineUntil" = $2
                where id = $3 and "companyId" = $4`,
        values: [available, notAvailableUntil, branchProdId, companyId]
      }
      await client.query(query.text, query.values);


      const branchQuery: { text: string, values: any } = {
        text: `select "branchId", "productId","availableOnline","available"  from "BranchProducts" bp where "id" = $1`,
        values: [data.branchProdId]
      }
      let Ids = (await client.query(branchQuery.text, branchQuery.values)).rows[0];
      let branchId = Ids.branchId
      let productId = Ids.productId


      await MenuRepo.GruptechItemAvailable(client, branchId, productId, available);

      console.log("idddddddddddddddd", Ids)
      if (Ids) {
        await SocketProductRepo.updateProductAvailability(Ids, Ids.branchId)
      }

      return new ResponseData(true, "Branch Product Availability Has Been Updated Successfully", [])

    } catch (error: any) {
    
      throw new Error(error)
    }
  }

  public static async reorderProducts(companyId: string | null, branchId: string | null, brancheList: []) {
    try {

      let branches = branchId ? [branchId] : brancheList;
      const query: { text: string, values: any } = {
        text: ` select "Products".id, "Products".name, "onHand", "Branches".name as "branchName", "branchId", type, "BranchProducts"."reorderLevel", "BranchProducts"."reorderPoint",
                case when ("onHand"+ COALESCE("BranchProducts"."openingBalance",0)) <=  "BranchProducts"."reorderPoint" then "BranchProducts"."reorderLevel" - ("onHand"+COALESCE("BranchProducts"."openingBalance",0) ) end as "reorderAmount"
                from "BranchProducts"
                inner join "Branches" on "branchId" = "Branches".id 
                inner join "Products" ON "Products".id = "BranchProducts"."productId"
                where "Products".type  = any(Array['inventory','batch','serialized']) 
                  and "Products"."companyId"= $1
                  and (($2::uuid[] IS NULL) OR "BranchProducts"."branchId" = any($2))
                group by "Products".id, "BranchProducts"."id","Branches".name
                having  "onHand" <=  "BranchProducts"."reorderPoint" and "BranchProducts"."reorderLevel" > 0 `,
        values: [companyId, branches]
      }
      const products = await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", products.rows.length > 0 ? products.rows : [])
    } catch (error: any) {
    
      throw new Error(error)
    }
  }


  public static async getChildParentCost(productId: string, branchId: string) {
    try {
      let parents = await this.getChildParents(null, productId, branchId);


      if (parents) {
        return this.calculateChildCost(parents);

      }
      return 0;
    } catch (error: any) {
      throw new Error(error)
    }
  }

  private static calculateChildCost(rows: any[]): number {
    if (!rows || rows.length === 0) return 0;

    const child = rows[0]; // always the first row is the child
    const parent = rows[1]; // optional
    let childUnitCost = 0

    const safe = (n: number | null | undefined) =>
      typeof n === "number" && !isNaN(n) ? n : 0;
    if (parent) {


      const childOnHand = safe(child.childOnHand);
      childUnitCost = safe(child.childUnitCost);
      const childQty = safe(child.childQty);

      const parentOnHand = child ? safe(child.parentOnHand) : 0;
      const parentUnitCost = child ? safe(child.parentUnitCost) : 0;
      const parentChildQty = parent ? parent.childQty : 0; // use childQty for calculation

      const grandParentOnHand = parent ? safe(parent.parentOnHand) : 0;
      const grandParentUnitCost = parent ? safe(parent.parentUnitCost) : 0;

      if (childOnHand > 0) return childUnitCost;
      if (parentOnHand > 0 && childQty > 0)
        return (parentUnitCost / childQty);
      if (grandParentOnHand > 0 && parentChildQty > 0 && childQty > 0)
        return (grandParentUnitCost / (parentChildQty * childQty))
    } else {

      const childOnHand = safe(child.childOnHand);
      childUnitCost = safe(child.childUnitCost);
      const childQty = safe(child.childQty);
      const parentOnHand = child ? safe(child.parentOnHand) : 0;
      const parentUnitCost = child ? safe(child.parentUnitCost) : 0;
      if (childOnHand > 0) return childUnitCost;
      if (parentOnHand > 0 && childQty > 0)
        return (parentUnitCost / childQty)
    }
    return childUnitCost ?? 0;
  }

}