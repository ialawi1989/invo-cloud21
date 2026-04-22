import { DB } from "@src/dbconnection/dbconnection";
import { Product } from "@src/models/product/Product";
import { ResponseData } from "@src/models/ResponseData";
import { ProductValidation } from "@src/validationSchema/product/product.Schema";

import { BranchProductsRepo } from "../branchProduct.repo";
import { ProductRepo } from "../product.repo";


import { PoolClient } from "pg";
import { ManualAdjusmentRepo } from "../../accounts/manualAdjusment.Repo";
import { Batches } from "@src/models/product/Batches";
import { Helper } from "@src/utilts/helper";
import { SocketProductRepo } from "@src/repo/socket/product.socket";
import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { SupplierRepo } from "../../accounts/supplier.repo";
import { SupplierItem } from "@src/models/account/SupplierItem";
import { InventoryMovment } from "@src/models/account/InventoryMovment";
import { InventoryMovmentLine } from "@src/models/account/InventoryMovmentLine";
export class BatchProductRepo {

  public static async checkIfBatchNumberExist(client: PoolClient, batchId: string | null, batch: string, branchProductId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT count(*) as qty FROM "ProductBatches" where id <> $1 and batch = $2   and "branchProductId" = $3 `,
        values: [
          batchId,
          batch,
          branchProductId,
        ],
      };

      if (batchId == null) {
        query.text = `SELECT count(*) as qty FROM "ProductBatches" where  batch = $1 and "branchProductId" = $2 `
        query.values = [batch,
          branchProductId]
      }
      const resault = await client.query(query.text, query.values);


      if ((<any>resault.rows[0]).qty > 0) {
        return true;
      }
      return false;
    } catch (error: any) {
      console.log(error)

      throw new Error(error.message)
    }
  }

  public static async deleteBatch(client: PoolClient, branchId: string, batch: string) {
    try {
      const query: { text: string, values: any } = {
        text: `DELETE from "ProductBatches" 
              USING  "BranchProducts","Branches"
              where "ProductBatches"."branchProductId" = "BranchProducts".id 
              and "Branches".id ="BranchProducts"."branchId"
              and  "ProductBatches"."batch" = $1
              and "Branches".id=$2 `,
        values: [batch, branchId]
      }

      await client.query(query.text, query.values)
    } catch (error: any) {


      throw new Error(error)
    }
  }
  public static async createAndInsertBatch(client: PoolClient, obj: any, companyId: string, branchProductId: string) {
    try {
      const batch = new Batches();
      batch.batch = obj.batch;
      batch.companyId = companyId;
      batch.unitCost = obj.unitCost;
      batch.onHand = obj.qty;
      batch.branchProductId = branchProductId;
      batch.expireDate = obj.expireDate;
      batch.prodDate = obj.prodDate;

      await BatchProductRepo.addBatch(client, batch);
    } catch (error: any) {


      throw new Error(error.message)
    }
  }

  //Add And Edit Batch Product
  public static async addBatchItem(client: PoolClient, data: any, company: Company, employeeId: string) {



    try {
      const companyId = company.id;
      const afterDecimal = company.afterDecimal
      const validate = await ProductValidation.BatchValidation(data);
      if (!validate.valid) {

        throw new ValidationException(validate.error)
      }


      const product = new Product();
      product.ParseJson(data);
      product.companyId = companyId;

      product.defaultPrice = Helper.roundDecimal(product.defaultPrice, afterDecimal)
      product.unitCost = Helper.roundNum(product.unitCost, afterDecimal)

      /* ***************** check Exist of barcode, sku, name ****************** */
      if (product.barcode != "") {
        let isBarcodeExists = await ProductRepo.checkIfBarcodeExists(client, null, product.barcode, product.companyId);
        if (isBarcodeExists) {
          throw new ValidationException("Barcode Already used");
        }
      }

      if (product.sku) {
        const isSKUExists = await ProductRepo.checkProductSKU(product.sku, product.companyId, product.id);
        if (isSKUExists) {
          throw new ValidationException("sku Already used");
        }
      }

      const isNameExists = await ProductRepo.checkIfProductNameExists(client, null, product.name, product.companyId);
      if (isNameExists) {
        throw new ValidationException("Product Name Already used");
      }

      /* *********************************************************************** */

      product.updatedDate = new Date()

      if (product.categoryId) {
        product.categoryIndex = await ProductRepo.getProductCategoryMaxIndex(client, companyId, product.categoryId)
      }
      const query: { text: string, values: any } = {
        text: `INSERT INTO "Products"
                       (name, "barcode", "defaultPrice", description,
                       translation, "categoryId", tags, type, warning, "companyId","productMedia","commissionPercentage","commissionAmount",color,"taxId","UOM","isDiscountable","mediaId","updatedDate","unitCost","sku","alternativeProducts","maxItemPerTicket","kitchenName","reorderPoint","reorderLevel","productDeduction","logs","brandid","comparePriceAt","customFields","productAttributes","isPurchaseItem","isSaleItem","threeDModelId","categoryIndex","tabBuilder")
                       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37) RETURNING id`,
        values: [
          product.name,
          product.barcode,
          product.defaultPrice,
          product.description,
          product.translation,
          product.categoryId,
          product.tags,
          product.type,
          product.warning,
          product.companyId,
          JSON.stringify(product.productMedia),
          product.commissionPercentage,
          product.commissionAmount,
          product.color,
          product.taxId,
          product.UOM,
          product.isDiscountable,
          product.mediaId,
          product.updatedDate,
          product.unitCost,
          product.sku,
          JSON.stringify(product.alternativeProducts),
          product.maxItemPerTicket,
          product.kitchenName,
          product.reorderPoint,
          product.reorderLevel,
          JSON.stringify(product.productDeduction),
          JSON.stringify(product.logs),
          product.brandid,
          product.comparePriceAt,
          JSON.stringify(product.customFields),
          JSON.stringify(product.productAttributes),
          product.isPurchaseItem,
          product.isSaleItem,
          product.threeDModelId,
          product.categoryIndex,
          JSON.stringify(product.tabBuilder)
        ],
      };
      const insert = await client.query(query.text, query.values);
      const productId = (<any>insert.rows[0]).id
      //add To Branch
      let branchIds: any[] = [];
      let movments: any[] = [];

      for (let index = 0; index < product.branchProduct.length; index++) {
        const element = product.branchProduct[index];
        element.productId = productId;
        let tempPrice = element.price == null ? product.defaultPrice : element.price

        let branchProductId;
        if (element.id == null || element.id == "") {
          const insertToBranch = await BranchProductsRepo.addProductToBranch(client, element, product.type, product.companyId, afterDecimal, tempPrice, employeeId)
          branchProductId = <any>insertToBranch.data.id;
          movments.push(<any>insertToBranch.data.inventoryMovmentId);
        } else {
          branchProductId = element.id
        }

        branchIds.push(element.branchId);

      }


      if (product.suppliers && product.suppliers.length > 0) {
        for (let index = 0; index < product.suppliers.length; index++) {
          const element = product.suppliers[index];
          let supplierItem = new SupplierItem();

          supplierItem.ParseJson(element)
          supplierItem.productId = productId
          await SupplierRepo.addSupplierItems(client, supplierItem, company.id)
        }
      }

      const resdata = {
        id: productId,
        branchIds: branchIds,
        movments: movments
      }
      // if (product.base64Image != "") {
      //   const storage = new FileStorage();
      //   const imagePath = await storage.saveItemImage(product.base64Image, companyId, product.id);
      //   await ProductRepo.updateProductSDeafultImage(product.id, imagePath, client)
      // }
      return new ResponseData(true, "", resdata);
    } catch (error: any) {

      throw new Error(error.message)
    }
  }
  public static async editBatchItem(client: PoolClient, data: any, company: Company, employeeId: string) {

    try {
      const afterDecimal = company.afterDecimal;
      const companyId = company.id;
      const currencySymbol = company.currencySymbol


      const validate = await ProductValidation.BatchValidation(data);
      if (!validate.valid) {

        throw new Error(validate.error)
      }

      const product = new Product();
      product.ParseJson(data);
      product.companyId = companyId;

      product.defaultPrice = Helper.roundDecimal(product.defaultPrice, afterDecimal)
      product.unitCost = Helper.roundNum(product.unitCost, afterDecimal)

      if (product.categoryId) {
        const oldProductCategoryId = await client.query(`SELECT "categoryId" FROM "Products" WHERE id = $1 AND "companyId" = $2`, [product.id, companyId])
        if (oldProductCategoryId.rowCount && oldProductCategoryId.rowCount > 0) {
          const oldCategoryId = oldProductCategoryId.rows[0].categoryId
          if (oldCategoryId != product.categoryId) {
            product.categoryIndex = await ProductRepo.getProductCategoryMaxIndex(client, companyId, product.categoryId)
          }
        }
      }

      /* ***************** check Exist of barcode, sku, name ****************** */
      if (product.barcode != "") {
        const isBarcodeExists = await ProductRepo.checkIfBarcodeExists(client, product.id, product.barcode, product.companyId);
        if (isBarcodeExists) {
          throw new ValidationException("Barcode Already used");
        }
      }

      if (product.sku) {
        const isSKUExists = await ProductRepo.checkProductSKU(product.sku, product.companyId, product.id);
        if (isSKUExists) {
          throw new ValidationException("sku Already used");
        }
      }

      const isNameExists = await ProductRepo.checkIfProductNameExists(client, product.id, product.name, product.companyId);
      if (isNameExists) {
        throw new ValidationException("Product Name Already used");
      }

      /* *********************************************************************** */

      product.updatedDate = new Date();
      const query: { text: string, values: any } = {
        text: `UPDATE "Products" SET name = ($1),barcode=($2), 
                                                "defaultPrice" = ($3),description = ($4),
                                                tags = ($5),warning = ($6),
                                                "serviceTime" = ($7),
                                                "categoryId" = ($8),
                                                "productMedia" = ($9),
                                                "updatedDate"=$10,
                                                "commissionPercentage"=$11,
                                                "commissionAmount"=$12,
                                                 color=$13,
                                                 "taxId"=$14,
                                                 "UOM"=$15,
                                                 "isDiscountable"=$16,
                                                 "mediaId"=$17,
                                                 translation=$18,
                                                 "unitCost"=$19,
                                                 "sku"=$20,
                                                 "alternativeProducts"=$21,
                                                 "kitchenName"=$22,
                                                 "reorderPoint"=$23,
                                                 "reorderLevel"=$24,
                                                 "productDeduction"=$25,
                                                 "logs"=$26,
                                                 "brandid"=$27,
                                                 "comparePriceAt"=$28,
                                                 "customFields"=$29,
                                                 "productAttributes"=$30,
                                                 "isPurchaseItem" = $31,
                                                 "isSaleItem" = $32,
                                                 "threeDModelId" = $33,
                                                 "categoryIndex" = $34,
                                                 "tabBuilder" = $35
                                                 WHERE id = $36 AND "companyId"=$37 RETURNING id`,
        values: [
          product.name,
          product.barcode,
          product.defaultPrice,
          product.description,
          product.tags,
          product.warning,
          product.serviceTime,
          product.categoryId,
          JSON.stringify(product.productMedia),
          product.updatedDate,
          product.commissionPercentage,
          product.commissionAmount,
          product.color,
          product.taxId,
          product.UOM,
          product.isDiscountable,
          product.mediaId,
          product.translation,
          product.unitCost,
          product.sku,
          JSON.stringify(product.alternativeProducts),
          product.kitchenName,
          product.reorderPoint,
          product.reorderLevel,
          JSON.stringify(product.productDeduction),
          JSON.stringify(product.logs),
          product.brandid,
          product.comparePriceAt,
          JSON.stringify(product.customFields),
          JSON.stringify(product.productAttributes),
          product.isPurchaseItem,
          product.isSaleItem,
          product.threeDModelId,
          product.categoryIndex,
          JSON.stringify(product.tabBuilder),
          product.id,
          product.companyId,



        ],
      };
      const update = await client.query(query.text, query.values);
      let branchIds: any[] = [];
      let movments: any[] = [];
      //add To Branch
      for (let index = 0; index < product.branchProduct.length; index++) {
        const branchProduct = product.branchProduct[index];
        branchProduct.productId = product.id;

        let tempPrice = branchProduct.price == null ? product.defaultPrice : branchProduct.price

        let branchProductId;
        branchIds.push(branchProduct.branchId)
        if (branchProduct.id == null || branchProduct.id == "") {
          const insertToBranch = await BranchProductsRepo.addProductToBranch(client, branchProduct, product.type, product.companyId, afterDecimal, tempPrice, employeeId)
          branchProductId = <any>insertToBranch.data.id;
          movments.push(<any>insertToBranch.data.inventoryMovmentId)

        } else {
          const editBranch = await BranchProductsRepo.editBranchProduct(client, branchProduct, product.companyId, afterDecimal, tempPrice, employeeId, currencySymbol)
          movments.push(<any>editBranch.data.inventoryMovmentId)
          branchProductId = branchProduct.id;
        }
        //insert Batch

      }
      // if (product.base64Image != "") {
      //   const storage = new FileStorage();
      //   const imagePath = await storage.saveItemImage(product.base64Image, companyId, product.id);
      //   await ProductRepo.updateProductSDeafultImage(product.id, imagePath, client)
      // }

      if (product.suppliers && product.suppliers.length > 0) {
        for (let index = 0; index < product.suppliers.length; index++) {
          const element = product.suppliers[index];
          let isExist = await SupplierRepo.checkIfSupplierProductExist(client, element.supplierId, product.id)

          let supplierItem = new SupplierItem();

          supplierItem.ParseJson(element)
          supplierItem.productId = product.id
          if (element.isDeleted) {
            await SupplierRepo.deleteSupplierItem(client, supplierItem.id)
          } else {
            if (isExist) {
              await SupplierRepo.editSupplierItem(client, supplierItem)


            } else {
              await SupplierRepo.addSupplierItems(client, supplierItem, company.id)

            }
          }

        }
      }

      const resdata = {
        id: product.id,
        movments: movments,
        branchIds: branchIds
      }
      return new ResponseData(true, "Updated Successfully", resdata);
    } catch (error: any) {




      throw new Error(error.message)
    }
  }


  //Add Edit Batch "productBatches" 
  public static async addBatch(client: PoolClient, batch: Batches) {
    try {
      const isBatchExist = await this.checkIfBatchNumberExist(client, null, batch.batch, batch.branchProductId)
      if (isBatchExist) {
        throw new ValidationException("Batch Number already used")
      }

      const query: { text: string, values: any } = {
        text: `INSERT INTO "ProductBatches"
                   ( "branchProductId", "batch" , "onHand", "prodDate",
                   "expireDate", "companyId","unitCost") 
                   VALUES($1, $2, $3, $4, $5, $6,$7) RETURNING id`,
        values: [
          batch.branchProductId,
          batch.batch,
          batch.onHand,
          batch.prodDate,
          batch.expireDate,
          batch.companyId, batch.unitCost],
      };

      const insert = await client.query(query.text, query.values);
      return new ResponseData(true, "Added Successfully", { id: (<any>insert.rows[0]).id })
    } catch (error: any) {


      throw new Error(error.message)
    }
  }
  public static async editBatch(client: PoolClient, batch: Batches) {

    try {


      if (batch.id == null || batch.id == "") {
        throw new ValidationException("Batch id Is Required")
      }
      const isBatchExist = await this.checkIfBatchNumberExist(client, batch.id, batch.batch, batch.branchProductId)
      if (isBatchExist) {
        throw new ValidationException("Batch Number already used")
      }
      const query: { text: string, values: any } = {
        text: `UPDATE "ProductBatches" SET batch=$1, "onHand"=$2, "prodDate"=$3,"expireDate"=$4,"unitCost"=$5 WHERE id=$6 AND "branchProductId"=$7`,
        values: [batch.batch, batch.onHand, batch.prodDate, batch.expireDate, batch.unitCost, batch.id, batch.branchProductId]

      }
      const update = await client.query(query.text, query.values)
      return new ResponseData(true, "Updated Successfully", null);
    } catch (error: any) {

      console.log(error)
      throw new Error(error.message)
    }
  }
  public static async setBatchOnHand(client: PoolClient, batch: string, productId: string, branchId: string, onHand: number) {
    try {
      const query: { text: string, values: any } = {
        text: `  
              with "branchProducts" as (
              select id from "BranchProducts" where "branchId"= $2 and "productId"=$3
              ),"updateOnHand" as (

              UPDATE "ProductBatches" SET "onHand" = $1 from (select * from "branchProducts")t 
              where "ProductBatches"."branchProductId" = t.id and "ProductBatches"."batch" = $4 RETURNING "ProductBatches".id 
              ),"updateTime" as(
              UPDATE "BranchProducts" SET "updatedTime" = $5  from (select * from "branchProducts")t 
              where "BranchProducts"."id" = t.id  RETURNING "BranchProducts".id 
              )

              select * from "updateOnHand"
              union all 
              select * from "updateTime"
 `,
        values: [onHand, branchId, productId, batch, new Date()]
      }
      await client.query(query.text, query.values)
      await SocketProductRepo.onHandsync(client, onHand, productId, branchId, batch)
    } catch (error: any) {
      console.log(error)
      throw new Error(error.message)
    }
  }

  public static async getBatchOnhandAndUnitCost(client: PoolClient, batch: string, productId: string, branchId: string) {
    try {

      const query: { text: string, values: any } = {
        text: `SELECT "ProductBatches"."onHand", "unitCost" FROM "ProductBatches"
               INNER JOIN "BranchProducts"
               ON "BranchProducts".id = "ProductBatches"."branchProductId"
            WHERE "ProductBatches".batch=$1 AND "BranchProducts"."productId" =$2 AND "BranchProducts"."branchId"=$3`,
        values: [batch, productId, branchId]
      }

      const batchData = await client.query(query.text, query.values);

      return batchData.rows[0];
    } catch (error: any) {


      throw new Error(error.message);
    }
  }


  public static async insertBranchBatches(client: PoolClient, employeeId: string, batches: Batches[], branchProductId: string, companyId: string, branchId: string, productId: string, afterDecimal: number) {

    try {
      let inventoryMovment = new InventoryMovment();
      inventoryMovment.branchId = branchId
      inventoryMovment.employeeId = employeeId
      for (let index = 0; index < batches.length; index++) {
        const batch = batches[index];
        if (batch.id == "" || batch.id == null) {


          // Add new Batch
          batch.companyId = companyId;
          batch.branchProductId = branchProductId;
          await this.addBatch(client, batch);
          const newOnHand = batch.onHand;
          const unitCost = batch.unitCost;
          const currentOnHand = 0;
          const currentCost = 0
          const totalCost = newOnHand * unitCost
          let inventoryLine = new InventoryMovmentLine();
          inventoryLine.batch = batch.batch;
          inventoryLine.cost = unitCost;
          inventoryLine.qty = batch.onHand;
          inventoryLine.currentCost = currentCost;
          inventoryLine.currentOnHand = currentOnHand;
          inventoryLine.productId = productId;
          inventoryMovment.lines.push(inventoryLine);
          // await ManualAdjusmentRepo.manualAdjustmentMovment(client, employeeId, batch.unitCost, batch.onHand, branchId, currentOnHand, currentCost, productId,afterDecimal, "Manual Adjusment", null, batch.batch)

        } else {
          //Edit Batch


          batch.companyId = companyId;
          batch.branchProductId = branchProductId;
          const batchData = await this.getBatchOnhandAndUnitCost(client, batch.batch, productId, branchId)

          await this.editBatch(client, batch)

          const currentOnHand = batchData.onHand;
          const unitCost = batchData.unitCost;
          const newOnHand = batch.onHand;
          const onHandDiffrence = newOnHand - currentOnHand;
          const currentCost = currentOnHand * unitCost;
          if (currentOnHand != newOnHand) {
            let inventoryLine = new InventoryMovmentLine();
            inventoryLine.batch = batch.batch;
            inventoryLine.cost = onHandDiffrence < 0 ? unitCost * -1 : unitCost;
            inventoryLine.qty = onHandDiffrence;
            inventoryLine.currentCost = currentCost;
            inventoryLine.currentOnHand = currentOnHand;
            inventoryLine.productId = productId;
            inventoryMovment.lines.push(inventoryLine);
          }
          // await ManualAdjusmentRepo.manualAdjustmentMovment(client, employeeId, batchData.unitCost, onHandDiffrence, branchId, currentOnHand, currentCost, productId, afterDecimal, "Manual Adjusment", null, batch.batch)
        }
      }
      return await ManualAdjusmentRepo.serialAndBatchesKitManualAdjusmnets(client, inventoryMovment, afterDecimal)

    } catch (error: any) {


      throw new Error(error.message)

    }

  }
  public static async getProductBatches(branchId: string, productId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT batch,"unitCost","ProductBatches"."onHand","prodDate","expireDate"
                   FROM "ProductBatches"
                   INNER JOIN "BranchProducts"
                   ON "BranchProducts".id = "ProductBatches"."branchProductId"
                   WHERE "BranchProducts"."branchId" =$1
                   AND "BranchProducts"."productId" =$2`,
        values: [branchId, productId]
      }

      const data = await DB.excu.query(query.text, query.values)
      return new ResponseData(true, "", data.rows)
    } catch (error: any) {


      throw new Error(error.message)
    }
  }

  public static async getBatchId(client: PoolClient, branchId: string, batch: string, productId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT "ProductBatches".id from "ProductBatches"
                INNER JOIN "BranchProducts"
                ON "BranchProducts".id = "ProductBatches"."branchProductId"
                WHERE "BranchProducts"."branchId"=$1
                AND "BranchProducts"."productId"=$2
                AND "ProductBatches".batch =$3`,
        values: [branchId, productId, batch]
      }
      const batchData = await client.query(query.text, query.values);
      if (batchData.rowCount != null && batchData.rowCount > 0) {
        return batchData.rows[0].id
      } else {
        return null
      }
    } catch (error: any) {


      throw new Error(error.message)
    }
  }
  public static async deleteProductBatches(client: PoolClient, productId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `DELETE FROM "ProductBatches"
               USING "BranchProducts" 
               WHERE "BranchProducts".id =  "ProductBatches"."branchProductId"
               and "BranchProducts"."productId" = $1`,
        values: [productId]
      }

      await client.query(query.text, query.values)
    } catch (error: any) {


      throw new Error(error)
    }
  }

  public static async getBatch(client: PoolClient, batch: string, productId: string, branchId: string) {
    try {

      const query: { text: string, values: any } = {
        text: `SELECT batch,"unitCost","ProductBatches"."onHand","prodDate","expireDate"
        FROM "ProductBatches"
               INNER JOIN "BranchProducts"
               ON "BranchProducts".id = "ProductBatches"."branchProductId"
            WHERE "ProductBatches".batch=$1 AND "BranchProducts"."productId" =$2 AND "BranchProducts"."branchId"=$3`,
        values: [batch, productId, branchId]
      }

      const batchData = await client.query(query.text, query.values);

      return batchData.rows[0];
    } catch (error: any) {


      throw new Error(error.message);
    }
  }

}
