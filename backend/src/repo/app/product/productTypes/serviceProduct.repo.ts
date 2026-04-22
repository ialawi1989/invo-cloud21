import { EmployeePrice } from "@src/models/admin/EmployeePrice";
import { Product } from "@src/models/product/Product";
import { ResponseData } from "@src/models/ResponseData";
import { ProductValidation } from "@src/validationSchema/product/product.Schema";
import { PoolClient, QueryResult } from "pg";
import { BranchProductsRepo } from "../branchProduct.repo";
import { ProductRepo } from "../product.repo";


import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { Helper } from "@src/utilts/helper";
export class ServiceProductRepo {

  private static async checkIdEmployeePriceExist(client: PoolClient, productId: string, employeeId: string) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "EmployeePrices" where "productId" = ($1) and "employeeId" = $2 `,
      values: [
        productId,
        employeeId
      ],
    };
    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }
  public static async addService(client: PoolClient, data: any, company: Company, employeeId: string): Promise<ResponseData> {

    try {
      const companyId = company.id;
      const validate = await ProductValidation.serviceValidation(data);
      if (!validate.valid) {

        throw new ValidationException(validate.error)
      }

      const afterDecimal = company.afterDecimal;
      const product = new Product();
      product.ParseJson(data)
      product.companyId = companyId
      product.unitCost = Helper.roundNum(product.unitCost, afterDecimal);
      product.defaultPrice = +(product.defaultPrice).toFixed(afterDecimal);

      product.updatedDate = new Date();
      let isBarcodeExists;

      /* ***************** check Exist of barcode, sku, name ****************** */
      if (product.barcode != "") {
        isBarcodeExists = await ProductRepo.checkIfBarcodeExists(client, null, product.barcode, product.companyId);
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
                  (name,"barcode", "defaultPrice", description, 
                  translation,"categoryId",tags, type, warning,"companyId","serviceTime","productMedia","commissionPercentage","commissionAmount","taxId","isDiscountable",  "mediaId","updatedDate","kitchenName","reorderPoint","reorderLevel","productDeduction","logs","brandid","customFields","comparePriceAt","isSaleItem","isPurchaseItem","threeDModelId","categoryIndex","tabBuilder")
                  VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31) RETURNING id`,
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
          product.serviceTime,
          JSON.stringify(product.productMedia),
          product.commissionPercentage,
          product.commissionAmount,
          product.taxId,
          product.isDiscountable,
          product.mediaId,
          product.updatedDate,
          product.kitchenName,
          product.reorderPoint,
          product.reorderLevel,
          JSON.stringify(product.productDeduction),
          JSON.stringify(product.logs),
          product.brandid,
          JSON.stringify(product.customFields),
          product.comparePriceAt,
          product.isSaleItem,
          product.isPurchaseItem,
          product.threeDModelId,
          product.categoryIndex,
          JSON.stringify(product.tabBuilder)
        ],
      };
      const insert = await client.query(query.text, query.values);


      const productId = (<any>insert.rows[0]).id;

      for (let index = 0; index < product.employeePrices.length; index++) {
        const element = product.employeePrices[index];
        const employeePrice = new EmployeePrice()
        employeePrice.ParseJson(element);
        employeePrice.productId = productId
        employeePrice.companyId = product.companyId;
        employeePrice.price = +(employeePrice.price).toFixed(afterDecimal)


        await this.addEmployeePrice(client, employeePrice)

      }

      // if (product.base64Image != "") {
      //   const storage = new FileStorage();
      //   const imagePath = await storage.saveItemImage(product.base64Image, companyId, product.id);
      //   await ProductRepo.updateProductSDeafultImage(product.id, imagePath, client)
      // }

      //add To Branch
      for (let index = 0; index < product.branchProduct.length; index++) {
        const element = product.branchProduct[index];
        element.productId = productId;
        let tempPrice = element.price == null ? product.defaultPrice : element.price

        const insertToBranch = await BranchProductsRepo.addProductToBranch(client, element, product.type, product.companyId, afterDecimal, tempPrice, employeeId)
      }
      const resdata = {
        id: productId
      }

      return new ResponseData(true, "", resdata);
    } catch (error: any) {
      console.log(error)

      throw new Error(error.message)
    }
  }
  public static async editService(client: PoolClient, data: any, company: Company, employeeId: string) {

    try {
      const companyId = company.id
      const currencySymbol = company.currencySymbol


      const validate = await ProductValidation.serviceValidation(data);
      if (!validate.valid) {

        throw new ValidationException(validate.error)
      }

      const product = new Product();
      const afterDecimal = company.afterDecimal;

      product.ParseJson(data)
      product.companyId = companyId;
      product.unitCost = Helper.roundNum(product.unitCost, afterDecimal);
      product.defaultPrice = +(product.defaultPrice).toFixed(afterDecimal);


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
        text: `UPDATE "Products" SET 
                                            name = ($1),
                                            barcode=($2),
                                            "defaultPrice" = ($3),
                                            description = ($4),
                                            tags = ($5),
                                            warning = ($6),
                                            "serviceTime" = ($7),
                                            "categoryId" = ($8), 
                                            "productMedia"=($9),
                                            "updatedDate"=$10,
                                            "commissionPercentage"=$11,
                                            "commissionAmount"=$12,
                                            color=$13,
                                            "taxId"=$14,
                                            "isDiscountable"=$15,
                                            "mediaId"=$16,
                                            translation =$17,
                                            "kitchenName"=$18,
                                            "reorderPoint" =$19,
                                            "reorderLevel"=$20,
                                            "productDeduction"=$21,
                                            "logs" =$22,
                                            "brandid"=$23,
                                            "customFields"=$24,
                                            "comparePriceAt"=$25,
                                            "isSaleItem" = $26,
                                            "isPurchaseItem" = $27,
                                            "threeDModelId" = $28,
                                            "categoryIndex"=$29,
                                            "tabBuilder"=$30
                                            WHERE id = $31 and "companyId"= $32 RETURNING id`,
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
          product.isDiscountable,
          product.mediaId,
          product.translation,
          product.kitchenName,
          product.reorderPoint,
          product.reorderLevel,
          JSON.stringify(product.productDeduction),
          JSON.stringify(product.logs),
          product.brandid,
          JSON.stringify(product.customFields),
          product.comparePriceAt,
          product.isSaleItem,
          product.isPurchaseItem,
          product.threeDModelId,
          product.categoryIndex,
          JSON.stringify(product.tabBuilder),
          product.id,
          product.companyId],
      };
      const update = await client.query(query.text, query.values);

      if (product.employeePrices.length > 0) {

        //check if employees belong to the company
        const employeeIds: any[] = [];
        product.employeePrices.forEach((element: any) => {
          employeeIds.push(element.employeeId);
        });
        const resault: QueryResult<any> = await client.query(
          `select count(*) as qty from "Employees" where id = Any($1) and "companyId" = $2`,
          [employeeIds, product.companyId] as any);

        const employeeLength = resault.rows[0]['qty'];
        if (employeeLength != product.employeePrices.length) {
          throw new ValidationException("Error In Employee Id");
        }
        //===========================================================


        for (let index = 0; index < product.employeePrices.length; index++) {
          const element = product.employeePrices[index];
          const employeePrice = new EmployeePrice()
          employeePrice.ParseJson(element);
          employeePrice.productId = product.id
          employeePrice.companyId = product.companyId;
          employeePrice.price = +(employeePrice.price).toFixed(afterDecimal)
          const isEmployeePriceExit = await this.checkIdEmployeePriceExist(client, employeePrice.productId, employeePrice.employeeId)

          if (isEmployeePriceExit) {
            await this.editEmployeePrice(client, employeePrice)

          } else {
            await this.addEmployeePrice(client, employeePrice)
          }
        }
      }


      //add To Branch
      for (let index = 0; index < product.branchProduct.length; index++) {
        const branchProduct = product.branchProduct[index];
        branchProduct.productId = product.id;
        let tempPrice = branchProduct.price == null ? product.defaultPrice : branchProduct.price

        if (branchProduct.id == null || branchProduct.id == "") {
          const insertToBranch = await BranchProductsRepo.addProductToBranch(client, branchProduct, product.type, product.companyId, afterDecimal, tempPrice, employeeId)
        } else {
          const updateBranchProduct = await BranchProductsRepo.editBranchProduct(client, branchProduct, companyId, afterDecimal, tempPrice, employeeId, currencySymbol);
        }

      }
      // if (product.base64Image != "") {
      //   const storage = new FileStorage();
      //   const imagePath = await storage.saveItemImage(product.base64Image, companyId, product.id);
      //   await ProductRepo.updateProductSDeafultImage(product.id, imagePath, client)
      // }

      return new ResponseData(true, "Updated Successfully", null);

    } catch (error: any) {
      console.log(error)



      throw new Error(error.message)
    }

  }


  private static async addEmployeePrice(client: PoolClient, employeePrices: EmployeePrice) {
    try {


      const query: { text: string, values: any } = {
        text: `INSERT INTO "EmployeePrices"
      ("productId", price, "serviceTime", "employeeId", "companyId")
      VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        values: [employeePrices.productId, employeePrices.price, employeePrices.serviceTime, employeePrices.employeeId, employeePrices.companyId]
      }

      await client.query(query.text, query.values);
    } catch (error: any) {


      throw new Error(error.message)
    }

  }
  private static async editEmployeePrice(client: PoolClient, employeePrices: EmployeePrice) {
    try {


      const query: { text: string, values: any } = {
        text: `UPDATE  "EmployeePrices" SET
       price =$1, "serviceTime"=$2, "updatedDate"=$3 WHERE  "employeeId" =$4 AND "productId"=$5 
      `,
        values: [employeePrices.price, employeePrices.serviceTime, employeePrices.updatedDate, employeePrices.employeeId, employeePrices.productId]
      }

      await client.query(query.text, query.values);
    } catch (error: any) {

      throw new Error(error.message)
    }

  }
}