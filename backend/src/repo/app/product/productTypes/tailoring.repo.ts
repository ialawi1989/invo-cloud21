import { Product } from "@src/models/product/Product";
import { Helper } from "@src/utilts/helper";
import { ProductRepo } from "../product.repo";
import { ValidationException } from "@src/utilts/Exception";
import { BranchProductsRepo } from "../branchProduct.repo";
import { SupplierItem } from "@src/models/account/SupplierItem";
import { ResponseData } from "@src/models/ResponseData";
import { SupplierRepo } from "../../accounts/supplier.repo";

import { PoolClient } from "pg";
import { Company } from "@src/models/admin/company";

export class TailoringProduct {
  public static async addTailoringItem(client: PoolClient, data: any, company: Company, employeeId: string): Promise<ResponseData> {


    try {


      const companyId = company.id;
      const afterDecimal = company.afterDecimal



      //   const validate = await ProductValidation.InventoryValidation(data);
      //   if (!validate.valid) {

      //     throw new ValidationException(validate.error)
      //   }

      const product: Product = new Product();
      product.ParseJson(data);
      product.companyId = companyId;
      product.unitCost = Helper.roundNum(product.unitCost, afterDecimal)
      Helper.roundNumbers(afterDecimal, product);

      let isBarcodeExists;
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
      product.updatedDate = new Date();
      if (product.categoryId) {
        product.categoryIndex = await ProductRepo.getProductCategoryMaxIndex(client, companyId, product.categoryId)
      }
      const query: { text: string, values: any } = {
        text: `INSERT INTO "Products"
                           (name,
                           "parentId",
                           "barcode",
                           "defaultPrice",
                           description,
                           translation,
                           "categoryId",
                           tags,
                           type,
                           warning,
                           "UOM",
                           "unitCost",
                           "childQty",
                           "companyId",
                           "commissionPercentage",
                           "commissionAmount",
                           color,
                           "taxId",
                           "mediaId",
                           "orderByWeight",
                           "isDiscountable",
                           "updatedDate",
                           "sku",
                           "alternativeProducts",
                           "maxItemPerTicket",
                           "kitchenName",
                           "reorderPoint",
                           "reorderLevel",
                           "productDeduction",
                           "logs",
                           "brandid",
                           "customFields",
                           "comparePriceAt",
                           "productAttributes",
                           "weight",
                           "weightuom",
                           "isPurchaseItem",
                           "isSaleItem",
                           "saleAccountId",
                           "purchaseAccountId",
                           "measurements",
                           "optionGroups",
                           "productMedia",
                           "threeDModelId",
                           "categoryIndex",
                           "tabBuilder"
                           )
                           VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46) RETURNING id`,
        values: [
          product.name,
          product.parentId,
          product.barcode,
          product.defaultPrice,
          product.description,
          product.translation,
          product.categoryId,
          product.tags,
          product.type,
          product.warning,
          product.UOM,
          product.unitCost,
          product.childQty,
          product.companyId,
          product.commissionPercentage,
          product.commissionAmount,
          product.color,
          product.taxId,
          product.mediaId,
          product.orderByWeight,
          product.isDiscountable,
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
          JSON.stringify(product.customFields),
          product.comparePriceAt,
          JSON.stringify(product.productAttributes),
          product.weight,
          product.weightUOM,
          product.isPurchaseItem,
          product.isSaleItem,
          product.saleAccountId,
          product.purchaseAccountId,
          product.measurements,
          JSON.stringify(product.optionGroups),
          product.productMedia ? JSON.stringify(product.productMedia) : null,
          product.threeDModelId,
          product.categoryIndex,
          JSON.stringify(product.tabBuilder)
        ],
      };
      const insert = await client.query(query.text, query.values);
      const productId = (<any>insert.rows[0]).id;
      product.id = productId;
      const extraBarcodeQuery =
        `INSERT INTO "ProductBarcodes" ("productId", barcode, "companyId")
                                                        VALUES ($1, $2, $3)`;
      for (let index = 0; index < product.barcodes.filter(f => f.barcode != "" && f.barcode != null).length; index++) {
        const element = product.barcodes[index];

        //Check if Barcode not exists
        isBarcodeExists = await ProductRepo.checkIfBarcodeExists(client, productId, element.barcode, product.companyId);
        if (isBarcodeExists) {
          throw new ValidationException("Barcode Already used");
        }
        await client.query(extraBarcodeQuery, [productId, element.barcode, product.companyId]);
      }


      //   if (product.parentId != null && product.parentId != "") {
      //     const unitCost = (await this.calculateChildCost(client, productId)).productUnitCost;
      //     await this.setChildUnitCost(client, product.id, unitCost);
      //   }



      // if(product.base64Image !="")
      // {  const storage = new FileStorage();
      //   const imagePath =  await storage.saveItemImage(product.base64Image,companyId,product.id);
      //   await ProductRepo.updateProductSDeafultImage(product.id,imagePath,client)
      // }

      let branchIds: any[] = [];
      let movments: any[] = [];
      for (let index = 0; index < product.branchProduct.length; index++) {
        const element = product.branchProduct[index];
        element.productId = product.id;
        branchIds.push(element.branchId);
        let tempPrice = element.price == null ? product.defaultPrice : element.price


        if (element.openingBalanceCost) {
          element.openingBalanceCost = +element.openingBalanceCost.toFixed(afterDecimal)
        }
        const insertToBranch = await BranchProductsRepo.addProductToBranch(client, element, product.type, product.companyId, afterDecimal, tempPrice, employeeId)
        movments.push(<any>insertToBranch.data.inventoryMovmentId);
      }
      const resdata = {
        id: productId,
        movments: movments,
        branchIds: branchIds
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


      await ProductRepo.setChildsUnitCost(client, productId, afterDecimal)

      return new ResponseData(true, "", resdata);
    } catch (error: any) {



      throw new Error(error.message)
    }
  }
  public static async editTailoring(client: PoolClient, data: any, company: Company, employeeId: string) {


    try {

      const afterDecimal = company.afterDecimal;
      const companyId = company.id;
      const currencySymbol = company.currencySymbol

      //   const validate = await ProductValidation.InventoryValidation(data);
      //   if (!validate.valid) {

      //     throw new ValidationException(validate.error)
      //   }

      const product = new Product();
      product.ParseJson(data)
      product.companyId = companyId

      product.unitCost = Helper.roundNum(product.unitCost, afterDecimal)
      product.defaultPrice = +(product.defaultPrice).toFixed(afterDecimal);
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
      product.updatedDate = new Date();


      if (product.categoryId) {
        const oldProductCategoryId = await client.query(`SELECT "categoryId" FROM "Products" WHERE id = $1 AND "companyId" = $2`, [product.id, companyId])
        if (oldProductCategoryId.rowCount && oldProductCategoryId.rowCount > 0) {
          const oldCategoryId = oldProductCategoryId.rows[0].categoryId
          if (oldCategoryId != product.categoryId) {
            product.categoryIndex = await ProductRepo.getProductCategoryMaxIndex(client, companyId, product.categoryId)
          }
        }
      }

      const query: { text: string, values: any } = {
        text: `UPDATE "Products" SET name = ($1),
                                                "parentId"=($2),
                                                barcode=($3), 
                                               "defaultPrice" = ($4),
                                               description = ($5),
                                               tags = ($6),
                                               warning = ($7),
                                               "UOM" = ($8),
                                               "unitCost" = ($9),
                                               "categoryId" = ($10),
                                               "childQty"  = ($11),
                                               "productMedia"=($12),
                                               "updatedDate"=$13,
                                               "commissionPercentage"=$14,
                                               "commissionAmount"=$15,
                                               color=$16,
                                               "taxId"=$17,
                                               "orderByWeight"=$18,
                                               "isDiscountable"=$19,
                                               "mediaId"=$20,
                                               translation=$21,
                                               "sku" = $22,
                                               "alternativeProducts"=$23,
                                               "maxItemPerTicket"=$24,
                                               "kitchenName" = $25,
                                               "reorderPoint" =$26,
                                               "reorderLevel"=$27,
                                               "productDeduction" =$28,
                                               "logs" =$29,
                                               "brandid"=$30,
                                               "customFields"=$31,
                                               "comparePriceAt"=$32,
                                               "productAttributes"=$33,
                                               "weight"=$34,
                                               "weightuom"=$35,
                                               "isPurchaseItem"=$36,
                                               "isSaleItem"=$37,
                                               "saleAccountId"=$38,
                                               "purchaseAccountId"=$39,
                                               "measurements" = $40,
                                               "optionGroups" = $41,
                                               "threeDModelId" = $42,
                                               "categoryIndex" = $43,
                                               "tabBuilder" = $44
                                             WHERE id=$45 AND "companyId"=$46 RETURNING id`,
        values: [
          product.name,
          product.parentId,
          product.barcode,
          product.defaultPrice,
          product.description,
          product.tags,
          product.warning,
          product.UOM,
          product.unitCost,
          product.categoryId,
          product.childQty,
          JSON.stringify(product.productMedia),
          product.updatedDate,
          product.commissionPercentage,
          product.commissionAmount,
          product.color,
          product.taxId,
          product.orderByWeight,
          product.isDiscountable,
          product.mediaId,
          product.translation,
          product.sku,
          JSON.stringify(product.alternativeProducts),
          product.maxItemPerTicket,
          product.kitchenName,
          product.reorderPoint,
          product.reorderLevel,
          JSON.stringify(product.productDeduction),
          JSON.stringify(product.logs),
          product.brandid,
          JSON.stringify(product.customFields),
          product.comparePriceAt,
          JSON.stringify(product.productAttributes),
          product.weight,
          product.weightUOM,
          product.isPurchaseItem,
          product.isSaleItem,
          product.saleAccountId,
          product.purchaseAccountId,
          product.measurements,
          JSON.stringify(product.optionGroups),
          product.threeDModelId,
          product.categoryIndex,
          JSON.stringify(product.tabBuilder),
          product.id,
          product.companyId


        ],
      };
      const update = await client.query(query.text, query.values);
      const deletFromBarcodes = `DELETE FROM "ProductBarcodes" WHERE "productId"=$1 AND "companyId"=$2 `
      await client.query(deletFromBarcodes, [product.id, product.companyId]);
      //update product Barcodes 
      const extraBarcodeQuery =
        `INSERT INTO "ProductBarcodes" ("productId", barcode, "companyId")
                                                  VALUES ($1, $2, $3)`;
      for (let index = 0; index < product.barcodes.filter(f => f.barcode != "" && f.barcode != null).length; index++) {
        const element = product.barcodes[index];

        //Check if Barcode not exists
        const isBarcodeExists = await ProductRepo.checkIfBarcodeExists(client, product.id, element.barcode, product.companyId);
        if (isBarcodeExists) {
          throw new ValidationException("Barcode Already used");
        }

        await client.query(extraBarcodeQuery, [product.id, element.barcode, product.companyId]);
      }
      let branchIds: any[] = [];
      let movments: any[] = [];


      for (let index = 0; index < product.branchProduct.length; index++) {
        const branchProduct = product.branchProduct[index];
        branchProduct.productId = product.id;
        let tempPrice = branchProduct.price == null ? product.defaultPrice : branchProduct.price
        branchIds.push(branchProduct.branchId)


        if (branchProduct.openingBalanceCost) {
          branchProduct.openingBalanceCost = +branchProduct.openingBalanceCost.toFixed(afterDecimal)
        }
        if (branchProduct.id == null || branchProduct.id == '') {
          const insertToBranch = await BranchProductsRepo.addProductToBranch(client, branchProduct, product.type, product.companyId, afterDecimal, tempPrice, employeeId)
          if (<any>insertToBranch.data.inventoryMovmentId) {
            movments.push(<any>insertToBranch.data.inventoryMovmentId)
          }

        } else {
          const updateBranchProduct = await BranchProductsRepo.editBranchProduct(client, branchProduct, companyId, afterDecimal, tempPrice, employeeId, currencySymbol);
          if (<any>updateBranchProduct.data.inventoryMovmentId) {
            movments.push(<any>updateBranchProduct.data.inventoryMovmentId)
          }

        }

      }
      //   if (product.parentId != null && product.parentId != "") {
      //     const unitCost = (await this.calculateChildCost(client, product.id)).productUnitCost;
      //     await this.setChildUnitCost(client, product.id, unitCost);
      //   }
      // if(product.base64Image !="")
      // {  const storage = new FileStorage();
      //   const imagePath =  await storage.saveItemImage(product.base64Image,companyId,product.id);
      //   await ProductRepo.updateProductSDeafultImage(product.id,imagePath,client)
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
      await ProductRepo.setChildsUnitCost(client, product.id, afterDecimal)
      const resData = {
        movments: movments,
        branchIds: branchIds
      }
      return new ResponseData(true, "Updated Successfully", resData);
    } catch (error: any) {
      console.log(error)


      throw new Error(error.message)
    }

  }
}