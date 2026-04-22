/* eslint-disable prefer-const */
// import { DB } from "@src/dbconnection/dbconnection";
// import { FileStorage } from "@src/utilts/fileStorage";
import { Product } from "@src/models/product/Product";
import { ResponseData } from "@src/models/ResponseData";
// import { CompanyRepo } from "@src/repo/admin/company.repo";
import { ProductValidation } from "@src/validationSchema/product/product.Schema";
import { PoolClient } from "pg";
// import { InvoiceInventoryMovmentRepo } from "../../accounts/InvoiceInventoryMovment.repo";
// import { BranchProductsRepo } from "../branchProduct.repo";
import { ProductRepo } from "../product.repo";


import { Company } from "@src/models/admin/company";
export class MenuSelectionProductRepo {

  public static async addMenuSelection(client: PoolClient, data: any, company: Company, employeeId: string) {
    try {
      const companyId = company.id;

      const validate = await ProductValidation.MenuSelectionValidation(data);
      if (!validate.valid) {

        throw new Error(validate.error)
      }

      const afterDecimal = company.afterDecimal;
      const product: Product = new Product();
      product.ParseJson(data);
      product.companyId = companyId;

      product.unitCost = +(product.unitCost).toFixed(afterDecimal);
      product.defaultPrice = +(product.defaultPrice).toFixed(afterDecimal);

      const isNameExists = await ProductRepo.checkIfProductNameExists(null, product.name, product.companyId);
      if (isNameExists) {
        throw new Error("Product Name Already used");
      }
      product.updatedDate = new Date();
      const query: { text: string, values: any } = {
        text: `INSERT INTO "Products"
               (name, "barcode", "defaultPrice", description,
               translation, "categoryId", tags, type, warning, "serviceTime",
               "selection","companyId","productMedia", "priceModel","commissionPercentage","commissionAmount",color,"taxId","isDiscountable",  "mediaId","updatedDate") 
               VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING id`,
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
          product.updatedDate
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

        // const insertToBranch = await BranchProductsRepo.addProductToBranch(client, element, product.type, product.companyId,afterDecimal, tempPrice,employeeId)
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

  // public static async editMenuSelection(data: any, company: Company,employeeId:string) {
  //   const client = await DB.excu.client();
  //   try {
  //     const companyId =company.id;
  //     await client.query("BEGIN");
  //     const validate = await ProductValidation.MenuSelectionValidation(data);
  //     if (!validate.valid) {

  //       throw new Error(validate.error)
  //     }

  //     const afterDecimal = company.afterDecimal;
  //     const product = new Product();
  //     product.ParseJson(data)
  //     product.companyId = companyId;
  //     product.unitCost = +(product.unitCost).toFixed(afterDecimal);
  //     product.defaultPrice = +(product.defaultPrice).toFixed(afterDecimal);
  //     product.updatedDate = new Date()
  //     const isNameExists = await ProductRepo.checkIfProductNameExists(product.id, product.name, product.companyId);
  //     if (isNameExists) {
  //       throw new Error("Product Name Already used");
  //     }
  //     const query : { text: string, values: any } = {
  //       text: `UPDATE "Products" SET name = ($1),barcode=($2), 
  //                                           "defaultPrice" = ($3),description = ($4),
  //                                           tags = ($5),warning = ($6),
  //                                           "serviceTime" = ($7),
  //                                           "categoryId" = ($8),
  //                                           "selection" = ($9),
  //                                           "productMedia" =($10),
  //                                           "priceModel" =($11),
  //                                           "updatedDate"=$12,
  //                                           "commissionPercentage"=$13,
  //                                           "commissionAmount"=$14,
  //                                           color =$15,
  //                                           "taxId"=$16,
  //                                           "isDiscountable"=$17,
  //                                           "mediaId"=$18,
  //                                           translation=$19,
  //                                            WHERE id = $20 AND "companyId"=$21 RETURNING id`,
  //       values: [
  //         product.name,
  //         product.barcode,
  //         product.defaultPrice,
  //         product.description,
  //         product.tags,
  //         product.warning,
  //         product.serviceTime,
  //         product.categoryId,
  //         JSON.stringify(product.selection),
  //         JSON.stringify(product.productMedia),
  //         product.priceModel,
  //         product.updatedDate,
  //         product.commissionPercentage,
  //         product.commissionAmount,
  //         product.color,
  //         product.taxId,
  //         product.isDiscountable,
  //         product.mediaId,
  //         product.translation,
  //         product.id,
  //         product.companyId],
  //     };
  //     const update = await client.query(query.text, query.values);
  //     for (let index = 0; index < product.branchProduct.length; index++) {
  //       const branchProduct = product.branchProduct[index];
  //       branchProduct.productId = product.id;
  //       let tempPrice =  branchProduct.price == null ? product.defaultPrice : branchProduct.price

  //       if (branchProduct.id == null || branchProduct.id == "" || branchProduct.id == undefined) {
  //         const insertToBranch = await BranchProductsRepo.addProductToBranch(client, branchProduct, product.type, product.companyId,afterDecimal, tempPrice,employeeId)
  //       } else {
  //         const editBranch = await BranchProductsRepo.editBranchProduct(client, branchProduct, product.companyId,afterDecimal, tempPrice,employeeId)
  //       }
  //     }
  //     // if (product.base64Image != "") {
  //     //   const storage = new FileStorage();
  //     //   const imagePath = await storage.saveItemImage(product.base64Image, companyId, product.id);
  //     //   await ProductRepo.updateProductSDeafultImage(product.id, imagePath, client)
  //     // }
  //     await client.query("COMMIT");

  //     return new ResponseData(true, "Updated Successfully", null);
  //   } catch (error: any) {

  //     
  //     await client.query("ROLLBACK");
  //      throw new Error(error.message)
  //       } finally {
  //     client.release()
  //   }
  // }


}