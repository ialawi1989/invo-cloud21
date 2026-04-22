import { DB } from "@src/dbconnection/dbconnection";
import { Product } from "@src/models/product/Product";
import { ResponseData } from "@src/models/ResponseData";
import { ProductValidation } from "@src/validationSchema/product/product.Schema";

import { BranchProductsRepo } from "../branchProduct.repo";
import { ProductRepo } from "../product.repo";


import { PoolClient } from "pg";
import { Serials } from "@src/models/product/Serials";
import { ManualAdjusmentRepo } from "../../accounts/manualAdjusment.Repo";
import { SocketProductRepo } from "@src/repo/socket/product.socket";
import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { SupplierRepo } from "../../accounts/supplier.repo";
import { SupplierItem } from "@src/models/account/SupplierItem";
import { InventoryMovment } from "@src/models/account/InventoryMovment";
import { InventoryMovmentLine } from "@src/models/account/InventoryMovmentLine";
import { Helper } from "@src/utilts/helper";
export class SerialProductRepo {

  public static async addSerialItem(client: PoolClient, data: any, company: Company, employeeId: string) {

    try {
      const companyId = company.id;
      const validate = await ProductValidation.SerialValidation(data);
      if (!validate.valid) {

        throw new ValidationException(validate.error)
      }

      const afterDecimal = company.afterDecimal
      const product = new Product();
      product.ParseJson(data);
      product.companyId = companyId
      product.unitCost = Helper.roundNum(product.unitCost, afterDecimal);
      product.defaultPrice = +(product.defaultPrice).toFixed(afterDecimal);
      product.updatedDate = new Date();

      /* ***************** check Exist of barcode, sku, name ****************** */
      if (product.barcode != "") {
        const isBarcodeExists = await ProductRepo.checkIfBarcodeExists(client, null, product.barcode, product.companyId);
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

      if (product.categoryId) {
        product.categoryIndex = await ProductRepo.getProductCategoryMaxIndex(client, companyId, product.categoryId)
      }


      const query: { text: string, values: any } = {
        text: `INSERT INTO "Products"
                   (name, "barcode", "defaultPrice", description,
                   translation, "categoryId", tags, type, warning, "companyId","unitCost","productMedia","commissionPercentage","commissionAmount",color,"taxId","UOM","isDiscountable",  "mediaId","updatedDate","sku","alternativeProducts","maxItemPerTicket","kitchenName","reorderPoint","reorderLevel","productDeduction","logs","brandid","comparePriceAt","customFields","isSaleItem","isPurchaseItem","threeDModelId","categoryIndex","tabBuilder")
                   VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36) RETURNING id`,
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
          product.unitCost,
          JSON.stringify(product.productMedia),
          product.commissionPercentage,
          product.commissionAmount,
          product.color,
          product.taxId,
          product.UOM,
          product.isDiscountable,
          product.mediaId,
          product.updatedDate,
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
          product.isSaleItem,
          product.isPurchaseItem,
          product.threeDModelId,
          product.categoryIndex,
          JSON.stringify(product.tabBuilder)
        ],
      };
      const insert = await client.query(query.text, query.values);

      const productId = (<any>insert.rows[0]).id;
      //add To Branch
      let branchIds: any[] = [];
      let movments: any[] = [];
      for (let index = 0; index < product.branchProduct.length; index++) {
        const element = product.branchProduct[index];
        element.productId = productId;
        let tempPrice = element.price == null ? product.defaultPrice : element.price
        branchIds.push(element.branchId)
        const insertToBranch = await BranchProductsRepo.addProductToBranch(client, element, product.type, product.companyId, afterDecimal, tempPrice, employeeId)
        const branchProductId = <any>insertToBranch.data.id
        movments.push(<any>insertToBranch.data.inventoryMovmentId)

      }

      const resdata = {
        id: productId,
        branchIds: branchIds,
        movments: movments
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
      // if (product.base64Image != "") {
      //   const storage = new FileStorage();
      //   const imagePath = await storage.saveItemImage(product.base64Image, companyId, product.id);
      //   await ProductRepo.updateProductSDeafultImage(product.id, imagePath, client)
      // }

      return new ResponseData(true, "", resdata)
    } catch (error: any) {
      console.log(error)


      throw new Error(error.message)
    }
  }
  public static async editSerilized(client: PoolClient, data: any, company: Company, employeeId: string) {

    try {
      const companyId = company.id;
      const afterDecimal = company.afterDecimal
      const currencySymbol = company.currencySymbol


      const validate = await ProductValidation.SerialValidation(data);
      if (!validate.valid) {

        throw new ValidationException(validate.error)
      }

      const product = new Product();
      product.ParseJson(data)
      product.companyId = companyId;

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

      if (product.categoryId) {
        const oldProductCategoryId = await client.query(`SELECT "categoryId" FROM "Products" WHERE id = $1 AND "companyId" = $2`, [product.id, companyId])
        if (oldProductCategoryId.rowCount && oldProductCategoryId.rowCount > 0) {
          const oldCategoryId = oldProductCategoryId.rows[0].categoryId
          if (oldCategoryId != product.categoryId) {
            product.categoryIndex = await ProductRepo.getProductCategoryMaxIndex(client, companyId, product.categoryId)
          }
        }
      }

      product.updatedDate = new Date()
      const query: { text: string, values: any } = {
        text: `UPDATE "Products" SET name = ($1),barcode=($2), 
                                            "defaultPrice" = ($3),description = ($4),
                                            tags = ($5),warning = ($6),
                                            "serviceTime" = ($7),
                                            "categoryId" = ($8),
                                            "productMedia"=($9),
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
                                            "maxItemPerTicket"=$22,
                                            "kitchenName"=$23,
                                            "reorderPoint"=$24,
                                            "reorderLevel"=$25,
                                            "productDeduction"=$26,
                                            "logs" = $27,
                                            "brandid"=$28,
                                            "comparePriceAt"=$29,
                                            "customFields"=$30,
                                            "isSaleItem" = $31,
                                            "isPurchaseItem" =$32,
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
          product.maxItemPerTicket,
          product.kitchenName,
          product.reorderPoint,
          product.reorderLevel,
          JSON.stringify(product.productDeduction),
          JSON.stringify(product.logs),
          product.brandid,
          product.comparePriceAt,
          JSON.stringify(product.customFields),
          product.isSaleItem,
          product.isPurchaseItem,
          product.threeDModelId,
          product.categoryIndex,
          JSON.stringify(product.tabBuilder),
          product.id,
          product.companyId],
      };


      const update = await client.query(query.text, query.values);

      let branchIds: any[] = [];
      let movments: any[] = [];

      for (let index = 0; index < product.branchProduct.length; index++) {
        const branchProduct = product.branchProduct[index];
        branchProduct.productId = product.id;
        const tempPrice = branchProduct.price == null ? product.defaultPrice : branchProduct.price
        let branchProductId;
        branchIds.push(branchProduct.branchId)
        if (branchProduct.id == null || branchProduct.id == "") {
          const insertToBranch = await BranchProductsRepo.addProductToBranch(client, branchProduct, product.type, product.companyId, afterDecimal, tempPrice, employeeId)
          branchProductId = <any>insertToBranch.data.id
          movments.push(<any>insertToBranch.data.inventoryMovmentId)
        } else {
          const updateBranchProduct = await BranchProductsRepo.editBranchProduct(client, branchProduct, companyId, afterDecimal, tempPrice, employeeId, currencySymbol)
          branchProductId = branchProduct.id;
          movments.push(<any>updateBranchProduct.data.inventoryMovmentId)
        }


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

      const resData = {
        branchIds: branchIds,
        movments: movments
      }
      return new ResponseData(true, "Updated Successfully", resData);
    } catch (error: any) {
      console.log(error)

      throw new Error(error.message)
    }
  }

  public static async getSerialId(client: PoolClient, branchId: string, productId: string, serial: string) {
    try {
      const query = {
        text: `SELECT "ProductSerials".id from "ProductSerials"
                INNER JOIN "BranchProducts"
                ON "BranchProducts".id = "ProductSerials"."branchProductId"
                WHERE "BranchProducts"."branchId"=$1
                AND "BranchProducts"."productId"=$2
                AND "ProductSerials".serial =$3`,
        values: [branchId, productId, serial]
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
  public static async setSerialStatus(client: PoolClient, branchId: string, productId: string, status: string, serial: string) {
    try {
      const query = {
        text: `UPDATE "ProductSerials" SET 
                                  status = $1 
         WHERE "branchProductId"=(SELECT id FROM "BranchProducts" where "branchId"=$2 and "productId"=$3) 
         AND serial=$4 `,
        values: [status, branchId, productId, serial]
      }
      const serialData = {
        serial: serial,
        status: status
      }
      await SocketProductRepo.onHandsync(client, 0, productId, branchId, null, serialData)
      await client.query(query.text, query.values)
    } catch (error: any) {


      throw new Error(error.message)
    }
  }
  public static async createAndInsertSerial(client: PoolClient, obj: any, companyId: string, branchProductId: string, productId: string) {
    try {

      let isSerialExist = await SerialProductRepo.checkIfSerialExist(client, companyId, obj.serial, productId);
      if (isSerialExist) {
        throw new ValidationException("Serial Number Already Exist")
      }
      const serial = new Serials();
      serial.branchProductId = branchProductId;
      serial.serial = obj.serial;
      serial.unitCost = obj.unitCost;
      serial.status = "Available"
      serial.companyId = companyId;
      await SerialProductRepo.addSerial(client, serial, productId)
    } catch (error: any) {


      throw new Error(error.message)
    }
  }
  public static async checkIfSerialExist(client: PoolClient, companyId: string, serial: string, productId: string, id: string | null = null) {


    let query = {
      text: `select count(*) as qty from "ProductSerials"
      inner join "BranchProducts" 
      on "BranchProducts".id =  "ProductSerials"."branchProductId"
      where "BranchProducts"."productId"=$1
      and  lower("ProductSerials".serial)=$2
      `,
      values: [
        productId,
        serial.toLowerCase().trim()
      ],
    };

    if (id != null) {
      query.text = `select count(*) as qty from "ProductSerials"
      inner join "BranchProducts" 
      on "BranchProducts".id =  "ProductSerials"."branchProductId"
      where "BranchProducts"."productId"=$1
      and  lower("ProductSerials".serial)=$2
      and "ProductSerials".id<>$3`;
      query.values = [productId, serial.toLocaleLowerCase().trim(), id];
    }


    const resault = await client.query(query.text, query.values);

    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }
  public static async saveBranchProductSerials(client: PoolClient, employeeId: string, serials: Serials[], companyId: string, branchProductId: string, branchId: string, productId: string, afterDecimal: number) {
    try {

      let count = 0;
      let totalCost = 0;
      let currentOnHand = 0;
      let currentCost = 0;

      let inventoryMovment = new InventoryMovment();
      inventoryMovment.branchId = branchId
      inventoryMovment.employeeId = employeeId
      let availableSerials = serials.filter(f => f.status == 'Available')
      let availableCost = serials.reduce((sum, item: any) => {
        if (item.status === 'available') {
          return sum + item.cost;
        }
        return sum;
      }, 0);


      for (let index = 0; index < serials.length; index++) {

        const serialData = serials[index];
        const serial = new Serials();
        serial.ParseJson(serialData)
        serial.branchProductId = branchProductId;
        serial.companyId = companyId;


        let unitCost: any = serial.unitCost
        serial.unitCost = parseFloat(unitCost)
        if (serial.id == null || serial.id == "") {
          // Add New Serial  

          await this.addSerial(client, serial, productId);
          count++;

          totalCost += serial.unitCost
          let inventoryLine = new InventoryMovmentLine();
          inventoryLine.serial = serial.serial;
          inventoryLine.cost = serial.unitCost
          inventoryLine.qty = 1;
          inventoryLine.currentCost = availableCost;
          inventoryLine.currentOnHand = availableSerials.length;
          inventoryLine.productId = productId;
          inventoryMovment.lines.push(inventoryLine)
        } else {
          //Edit Serial 
          await this.editSerial(client, serial, productId)
          // if (serial.status == "Available") {
          //   currentCost +=  serial.unitCost;
          //   currentOnHand++;
          // }
        }

      }

      return await ManualAdjusmentRepo.serialAndBatchesKitManualAdjusmnets(client, inventoryMovment, afterDecimal)


      //add MaualAdjusment Movment 

    } catch (error: any) {
      console.log(error)

      throw new Error(error.message)
    }
  }
  public static async addSerial(client: PoolClient, serial: Serials, productId: string) {


    try {
      const isSerialExist = await this.checkIfSerialExist(client, serial.companyId, serial.serial, productId);
      if (isSerialExist) {
        throw new ValidationException("Serial Already Used");
      }
      const status = "Available"
      const query: { text: string, values: any } = {
        text: `INSERT INTO "ProductSerials"
                           ( "branchProductId" , serial,"companyId",status,"unitCost") 
                           VALUES($1, $2, $3,$4,$5) RETURNING id`,
        values: [
          serial.branchProductId,
          serial.serial,
          serial.companyId,
          status,
          serial.unitCost
        ],
      };

      const insert = await client.query(query.text, query.values);

      return new ResponseData(true, "Added Successfully", { id: (<any>insert.rows[0].id) })

    } catch (error: any) {
      console.log(error)

      throw new Error(error.message)
    }

  }
  public static async editSerial(client: PoolClient, serial: Serials, productId: string) {
    try {
      const isSerialExist = await this.checkIfSerialExist(client, serial.companyId, serial.serial, productId, serial.id);
      if (isSerialExist) {
        throw new ValidationException("Serial Already Used");
      }
      const query: { text: string, values: any } = {
        text: `UPDATE  "ProductSerials" SET serial=$1,"unitCost"=$2
          WHERE  id=$3 and "companyId"=$4 `,
        values: [
          serial.serial,
          serial.unitCost,
          serial.id,
          serial.companyId
        ],
      };

      const edit = await client.query(query.text, query.values);
      return new ResponseData(true, "Updated Successfully", [])
    } catch (error: any) {

      throw new Error(error.message)
    }
  }



  public static async getProductSerials(branchId: string, productId: string) {
    try {
      const query = {
        text: `SELECT 
         "ProductSerials".serial,
         "ProductSerials"."unitCost",
          "ProductSerials".status
        FROM "ProductSerials"
        INNER JOIN "BranchProducts"
        ON "BranchProducts".id = "ProductSerials"."branchProductId"
        AND "BranchProducts"."branchId"=$1
        AND "BranchProducts"."productId" =$2
        AND  "ProductSerials".status=$3`,
        values: [branchId, productId, 'Available']
      }
      const serials = await DB.excu.query(query.text, query.values)
      return new ResponseData(true, "", serials.rows)
    } catch (error: any) {


      return new ResponseData(false, error, [])
    }
  }
  public static async getSerialsOnHand(client: PoolClient, branchProductId: string) {
    try {
      const query = {
        text: `SELECT COUNT(*) AS qty FROM "ProductSerials" WHERE  status=$1 AND "branchProductId" =$2`,
        values: ['Available', branchProductId]
      }
      const serial = await client.query(query.text, query.values);
      return serial.rows[0]
    } catch (error: any) {

      throw new Error(error.message)
    }
  }
  public static async getSerialSoldDate(serial: string, branchId: string) {
    try {
      const query = {
        text: `SELECT  "Invoices".id FROM "Invoices"
        INNER JOIN "InvoiceLines" 
        ON "InvoiceLines"."invoiceId" = "Invoices".id
        WHERE "InvoiceLines".serial =$1 
        AND "Invoices"."branchId"=$2`,
        values: [serial, branchId],
      }
      const dataInfo = await DB.excu.query(query.text, query.values);


      const invoicId = (<any>dataInfo.rows[0]).id

      const data = {
        invoicId: invoicId
      }
      return data
    } catch (error: any) {

      throw new Error(error.message)
    }
  }

  public static async getSerialOnHandAndUnitCost(client: PoolClient, productId: string | null, branchId: string) {
    try {
      const serialData = {
        currentCost: 0,
        currentOnHand: 0
      }
      const query: { text: string, values: any } = {
        text: `SELECT SUM("unitCost") as "currentCost" , count(*) as "currentOnHand" from "ProductSerials"
        INNER JOIN "BranchProducts" ON "BranchProducts".id = "ProductSerials"."branchProductId"
        AND "BranchProducts"."productId" = $1
        AND "BranchProducts"."branchId" =$2 `,
        values: [productId, branchId]
      }
      const data = await client.query(query.text, query.values);

      if (data.rowCount != null && data.rowCount > 0) {
        const row: any = data.rows[0];
        serialData.currentCost = row.currentCost;
        serialData.currentOnHand = row.currentOnHand

      }
      return serialData;
    } catch (error: any) {

      throw new Error(error.message)
    }
  }
  public static async getSerialUnitCost(client: PoolClient, serial: string, branchId: string, productId: string) {
    try {


      const query = {
        text: `SELECT "unitCost"  from "ProductSerials"
        INNER JOIN "BranchProducts" ON "BranchProducts".id = "ProductSerials"."branchProductId"
        AND "BranchProducts"."productId" = $1
        AND "BranchProducts"."branchId" =$2
        AND serial =$3  `,
        values: [productId, branchId, serial]
      }

      const serialData = await client.query(query.text, query.values);
      if (serialData.rowCount == 0) {
        throw new ValidationException("Invalid Serial Number")
      }
      return { unitCost: serialData.rows[0].unitCost }
    } catch (error: any) {


      throw new Error(error.message)
    }
  }
  public static async deleteSerial(client: PoolClient, serial: string, branchId: string, productId: string) {
    try {
      const query = {
        text: `DELETE FROM "ProductSerials" WHERE serial=$1 and "branchProductId"=(select id from "BranchProducts" where "branchId"=$2 and "productId" =$3) `,
        values: [serial, branchId, productId]
      }
      await client.query(query.text, query.values)
    } catch (error: any) {


      throw new Error(error.message)
    }
  }



  public static async deleteProductSerials(client: PoolClient, productId: string) {
    try {
      const query = {
        text: `DELETE FROM "ProductSerials"
               USING "BranchProducts" 
               WHERE "BranchProducts".id =  "ProductSerials"."branchProductId"
               and "BranchProducts"."productId" = $1`,
        values: [productId]
      }

      await client.query(query.text, query.values)
    } catch (error: any) {


      throw new Error(error)
    }
  }

  public static async transferSerial(client: PoolClient, branchProductId: string, serial: string, produtId: string, branchId: string) {
    try {
      const query = {
        text: `with "serial" as (
          select "ProductSerials".id from "ProductSerials" 
          INNER JOIN "BranchProducts" on "BranchProducts".id = "ProductSerials"."branchProductId" 
          where "BranchProducts"."branchId" = $1
          and "BranchProducts"."productId" = $2
          and serial = $3
          )
          
          update "ProductSerials" set "branchProductId" = $4 where id = (select * from "serial")`,
        values: [branchId, produtId, serial, branchProductId]
      }

      await client.query(query.text, query.values)
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async isSerialsHasSales(client: PoolClient, productId: string, serial: any[]) {
    try {
      const query = {
        text: `SELECT conut("InvoiceLines".id) as "count" , Json_agg("InvoiceLines"."serial") as "serilas" FROM "InvoiceLines"
             where "productId" = $1
              and "serial" = any($2)
             `,
        values: [productId, serial]
      }

      let serials = await client.query(query.text, query.values);
      if (serials && serials.rows && serials.rows.length > 0 && serials.rows[0].count > 0) {

        throw new Error(`Cannot Delete Bill Due to Sales on Serials : ${serials.rows[0].serilas}`)

      }
    } catch (error: any) {
      throw new Error(error)
    }
  }
}