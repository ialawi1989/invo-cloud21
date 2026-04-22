import { Product } from "@src/models/product/Product";
import { ResponseData } from "@src/models/ResponseData";
import { ProductValidation } from "@src/validationSchema/product/product.Schema";
import { PoolClient } from "pg";
import { BranchProductsRepo } from "../branchProduct.repo";
import { ProductRepo } from "../product.repo";


import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { Helper } from "@src/utilts/helper";
export class MenuSelectionProductRepo {

  public static async addMenuSelection(client: PoolClient, data: any, company: Company, employeeId: string) {
    try {
      const companyId = company.id;

      const validate = await ProductValidation.MenuSelectionValidation(data);
      if (!validate.valid) {

        throw new ValidationException(validate.error)
      }

      const afterDecimal = company.afterDecimal;
      const product: Product = new Product();
      product.ParseJson(data);
      product.companyId = companyId;

      product.unitCost = Helper.roundNum(product.unitCost, afterDecimal);
      product.defaultPrice = +(product.defaultPrice).toFixed(afterDecimal);

      const productIds: any[string] = [];
      const uniqueProductIds = Array.from(
        new Set(
          product.selection.flatMap((element: any) =>
            element.items.map((item: any) => item.productId)
          )
        )
      );

      productIds.push(...uniqueProductIds);

      const types: any[string] = ['inventory', 'menuItem', 'kit']
      const isProductIdExist = await ProductRepo.checkIfProductsTypeValid(client, productIds, types, companyId);
      if (!isProductIdExist) {
        throw new ValidationException("Invalid Product")
      }

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

      product.updatedDate = new Date();
      const query: { text: string, values: any } = {
        text: `INSERT INTO "Products"
               (name, "barcode", "defaultPrice", description,
               translation, "categoryId", tags, type, warning, "serviceTime",
               "selection","companyId","productMedia", "priceModel","commissionPercentage","commissionAmount",color,"taxId","isDiscountable",  "mediaId","updatedDate","sku","alternativeProducts","maxItemPerTicket","kitchenName","reorderPoint","reorderLevel","productDeduction","logs","brandid","comparePriceAt","customFields","isSaleItem","isPurchaseItem","threeDModelId","categoryIndex","tabBuilder")
               VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37) RETURNING id`,
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
          product.serviceTime,
          JSON.stringify(product.selection),
          product.companyId,
          JSON.stringify(product.productMedia),
          product.priceModel,
          product.commissionPercentage,
          product.commissionAmount,
          product.color,
          product.taxId,
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
      //assign Option Group


      const resdata = {
        id: (<any>insert.rows[0]).id
      }

      for (let index = 0; index < product.branchProduct.length; index++) {
        const element = product.branchProduct[index];
        element.productId = resdata.id;
        let tempPrice = element.price == null ? product.defaultPrice : element.price

        const insertToBranch = await BranchProductsRepo.addProductToBranch(client, element, product.type, product.companyId, afterDecimal, tempPrice, employeeId)
      }
      // if (product.base64Image != "") {
      //   const storage = new FileStorage();
      //   const imagePath = await storage.saveItemImage(product.base64Image, companyId, product.id);
      //   await ProductRepo.updateProductSDeafultImage(product.id, imagePath, client)
      // }
      return new ResponseData(true, "", resdata)

    } catch (error: any) {


      throw new Error(error.message)
    }
  }

  public static async editMenuSelection(client: PoolClient, data: any, company: Company, employeeId: string) {

    try {
      const companyId = company.id;

      const validate = await ProductValidation.MenuSelectionValidation(data);
      if (!validate.valid) {

        throw new ValidationException(validate.error)
      }

      const afterDecimal = company.afterDecimal;
      const currencySymbol = company.currencySymbol

      const product = new Product();
      product.ParseJson(data)
      product.companyId = companyId;
      product.unitCost = Helper.roundNum(product.unitCost, afterDecimal);
      product.defaultPrice = +(product.defaultPrice).toFixed(afterDecimal);
      product.updatedDate = new Date()


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


      const productIds: any[string] = [];
      const uniqueProductIds = Array.from(
        new Set(
          product.selection.flatMap((element: any) =>
            element.items.map((item: any) => item.productId)
          )
        )
      );

      productIds.push(...uniqueProductIds);

      const types: any[string] = ['inventory', 'menuItem', 'kit']
      const isProductIdExist = await ProductRepo.checkIfProductsTypeValid(client, productIds, types, companyId);
      if (!isProductIdExist) {
        throw new ValidationException("Invalid Product")
      }


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
        text: `UPDATE "Products" SET name = ($1),barcode=($2), 
                                            "defaultPrice" = ($3),description = ($4),
                                            tags = ($5),warning = ($6),
                                            "serviceTime" = ($7),
                                            "categoryId" = ($8),
                                            "selection" = ($9),
                                            "productMedia" =($10),
                                            "priceModel" =($11),
                                            "updatedDate"=$12,
                                            "commissionPercentage"=$13,
                                            "commissionAmount"=$14,
                                            color =$15,
                                            "taxId"=$16,
                                            "isDiscountable"=$17,
                                            "mediaId"=$18,
                                            translation=$19,
                                            "sku"=$20,
                                            "alternativeProducts"=$21,
                                            "maxItemPerTicket"=$22,
                                            "kitchenName"=$23,
                                            "reorderPoint" =$24,
                                            "reorderLevel" =$25,
                                            "productDeduction"=$26,
                                            "logs"=$27,
                                            "brandid"=$28,
                                            "comparePriceAt"=$29,
                                            "customFields"=$30,
                                            "isSaleItem"=$31,
                                            "isPurchaseItem"=$32,
                                            "threeDModelId" = $33,
                                            "categoryIndex"=$34,
                                            "tabBuilder"=$35
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
          JSON.stringify(product.selection),
          JSON.stringify(product.productMedia),
          product.priceModel,
          product.updatedDate,
          product.commissionPercentage,
          product.commissionAmount,
          product.color,
          product.taxId,
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
      for (let index = 0; index < product.branchProduct.length; index++) {
        const branchProduct = product.branchProduct[index];
        branchProduct.productId = product.id;
        let tempPrice = branchProduct.price == null ? product.defaultPrice : branchProduct.price

        if (branchProduct.id == null || branchProduct.id == "" || branchProduct.id == undefined) {
          const insertToBranch = await BranchProductsRepo.addProductToBranch(client, branchProduct, product.type, product.companyId, afterDecimal, tempPrice, employeeId)
        } else {
          const editBranch = await BranchProductsRepo.editBranchProduct(client, branchProduct, product.companyId, afterDecimal, tempPrice, employeeId, currencySymbol)
        }
      }
      // if (product.base64Image != "") {
      //   const storage = new FileStorage();
      //   const imagePath = await storage.saveItemImage(product.base64Image, companyId, product.id);
      //   await ProductRepo.updateProductSDeafultImage(product.id, imagePath, client)
      // }


      return new ResponseData(true, "Updated Successfully", null);
    } catch (error: any) {



      throw new Error(error.message)
    }
  }


}