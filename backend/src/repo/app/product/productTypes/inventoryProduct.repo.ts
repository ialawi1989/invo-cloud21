import { DB } from "@src/dbconnection/dbconnection";
import { Product } from "@src/models/product/Product";
import { ResponseData } from "@src/models/ResponseData";
import { ProductValidation } from "@src/validationSchema/product/product.Schema";
import { BranchProductsRepo } from "../branchProduct.repo";
import { ProductRepo } from "../product.repo";



import { Helper } from "@src/utilts/helper";
import { Company } from "@src/models/admin/company";
import { InvoiceInventoryMovmentRepo } from "../../accounts/InvoiceInventoryMovment.repo";
import { PoolClient } from "pg";
import { ValidationException } from "@src/utilts/Exception";
import { SupplierRepo } from "../../accounts/supplier.repo";
import { SupplierItem } from "@src/models/account/SupplierItem";



export class InventoryProductRepo {

  public static async checkInventoryType(productIds: [string], companyId: string) {
    try {
      const IDs = Object.values(productIds).join(",");
      const type = 'inventory'; //TODO add constraint //index for type and companyId 
      const query: { text: string, values: any } = {
        text: `SELECT count(*) as qty FROM "Products" where id IN($1) and "companyId" = $2 and type = $3`,
        values: [IDs, companyId, type],
      };

      const resault = await DB.excu.query(query.text, query.values);

      if ((<any>resault.rows[0]).qty == productIds.length) {
        return true
      }

      return false
    } catch (error: any) {
    
      return error
    }

  }


  public static async calculateChildCost(client: PoolClient, productId: string) {
    try {


      //the unitcost of parent child product is calculated as so
      /**
       * example: 
       * 
       * parent:
       * unitCost = 10
       * 
       * child
       * childQty = 2
       * 
       * the unit cost of child => 10/2 => 5 
       * 
       * grand child 
       * childQty = 5
       * the unitCost of the grand child =>5/5 = 1
       * 
       */
      const parentsData = await InvoiceInventoryMovmentRepo.getParentsOfProduct(client, productId);
      let productUnitCost = 0;
      if (parentsData.length > 0) {
        if (parentsData.length == 1) // one level[ parent, child]
        {

          const parent = parentsData[parentsData.length - 1]

          productUnitCost = parent.unitCost / parent.childQty;

        } else { // two level [parent, child, grandChild]
          const parent = parentsData[parentsData.length - 1];
          const child = parentsData[parentsData.length - 2];
          const childUnitCost = parent.unitCost / parent.childQty;
          productUnitCost = childUnitCost / child.childQty;
        }
      }

      return { parentsData: parentsData, productUnitCost: productUnitCost }
    } catch (error: any) {
    

      throw new Error(error.message)
    }
  }



  public static async setChildUnitCost(client: PoolClient, productId: string, unitCost: number) {
    try {
      const query: { text: string, values: any } = {
        text: `UPDATE "Products" SET "unitCost"=$1  where id =$2`,
        values: [unitCost, productId]
      }
      await client.query(query.text, query.values)
    } catch (error: any) {
    

      throw new Error(error.message)
    }
  }
  public static async addInventoryItem(client: PoolClient, data: any, company: Company, employeeId: string): Promise<ResponseData> {


    try {


      const companyId = company.id;
      const afterDecimal = company.afterDecimal



      const validate = await ProductValidation.InventoryValidation(data);
      if (!validate.valid) {

        throw new ValidationException(validate.error)
      }

      const product: Product = new Product();
      product.ParseJson(data);
      product.companyId = companyId;
      product.unitCost = Helper.roundNum(product.unitCost, afterDecimal)
      Helper.roundNumbers(afterDecimal, product);

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
      /* ****************************************************************** */

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
                       "productMedia",
                       "threeDModelId",
                      "categoryIndex",
                      "tabBuilder")
                       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44) RETURNING id`,
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
          JSON.stringify(product.productMedia),
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


      if (product.parentId != null && product.parentId != "") {
        const unitCost = (await this.calculateChildCost(client, productId)).productUnitCost;
        await this.setChildUnitCost(client, product.id, unitCost);
      }



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
  public static async editInventory(client: PoolClient, data: any, company: Company, employeeId: string) {


    try {

      const afterDecimal = company.afterDecimal;
      const companyId = company.id;
      const currencySymbol= company.currencySymbol
      const validate = await ProductValidation.InventoryValidation(data);
      if (!validate.valid) {

        throw new ValidationException(validate.error)
      }

      const product = new Product();
      product.ParseJson(data)
      product.companyId = companyId

      product.unitCost = Helper.roundNum(product.unitCost, afterDecimal)
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
                                           "threeDModelId" =$40,
                                           "categoryIndex"=$41,
                                           "tabBuilder"=$42
                                         WHERE id=$43 AND "companyId"=$44 RETURNING id`,
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
      if (product.parentId != null && product.parentId != "") {
        const unitCost = (await this.calculateChildCost(client, product.id)).productUnitCost;
        await this.setChildUnitCost(client, product.id, unitCost);
      }
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
  public static async listInventoryProducts(data: any, company: Company) {
    //id,name,type,"UOM","unitCost"


    try {
      const companyId = company.id


      const productId = data.productId == null ? '' : data.productId;
      let selectQuery;
      let selectValues;
      let countValues;
      let searchValue = '[A-Za-z0-9]*';
      let offset = 0;
      let sort: any;
      let sortValue;
      let sortDirection;
      let sortTerm;
      let count = 0;
      let pageCount = 0;
      let limitQuery
      let page = data.page ?? 1;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }
      const selectText = `SELECT
                        id,
                        name,
                        type,
                        "UOM",
                        "unitCost"
                        FROM "Products"`
      const countText = `SELECT
        count(*)
      FROM "Products"`

      let filterQuery = `  where "companyId" =$1 and type ='inventory' and "isDeleted" = false`
      filterQuery += ` AND (LOWER ("Products".name) ~ $2 OR
      LOWER ("Products".barcode) ~ $2
                       )`

      limitQuery = ` Limit $3 offset $4`


      let selectCount;
      let orderByQuery;
      selectQuery = selectText + filterQuery
      selectValues = [companyId, searchValue, limit, offset]


      if (data != null && data != '' && JSON.stringify(data) != '{}') {


        sort = data.sortBy;
        sortValue = !sort ? '"Products"."createdAt"' : '"' + sort.sortValue + '"';
        sortDirection = !sort ? "DESC" : sort.sortDirection;
        sortTerm = sortValue + " " + sortDirection
        orderByQuery = ` Order by ` + sortTerm;

        if (data.searchTerm != "" && data.searchTerm != null) {
          searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`

        }

        selectQuery = selectText + filterQuery + orderByQuery + limitQuery
        let countQuery = countText + filterQuery
        countValues = [companyId, searchValue]
        selectCount = await DB.excu.query(countQuery, countValues)
        count = Number((<any>selectCount.rows[0]).count)
        pageCount = Math.ceil(count / limit)
      }


      const selectList: any = await DB.excu.query(selectQuery, selectValues)

      offset += 1
      let lastIndex = ((page) * limit)
      if (selectList.rows.length < limit || page == pageCount) {
        lastIndex = count
      }

      const resData = {
        list: selectList.rows,
        count: count,
        pageCount: pageCount,
        startIndex: offset,
        lastIndex: lastIndex
      }
      return new ResponseData(true, "", resData)
    } catch (error: any) {
    

      throw new Error(error.message)
    }

  }

  public static async getInventoryChildProducts(data: any, company: Company) {
    try {
      const companyId = company.id;
      const productId = data.productId == null ? '' : data.productId;
      let selectQuery;
      let selectValues;
      let countValues;
      let searchValue = '[A-Za-z0-9]*';
      let offset = 0;
      let sort: any;
      let sortValue;
      let sortDirection;
      let sortTerm;
      let count = 0;
      let pageCount = 0;
      let limitQuery
      let page = data.page ?? 1;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }
      const selectText = `SELECT
      id,
      name
      FROM "Products"`
      const countText = `SELECT
        count(*)
      FROM "Products"`

      let filterQuery = `  where "companyId" =$1 and type ='inventory' and "isDeleted" = false`
      filterQuery += ` AND (LOWER ("Products".name) ~ $2
                            or LOWER ("Products".barcode) ~ $2
                       )`

      filterQuery += `AND "Products".id::text <>$3`
      limitQuery = ` Limit $4 offset $5`


      let selectCount;
      let orderByQuery;
      selectQuery = selectText + filterQuery


      if (data != null && data != '' && JSON.stringify(data) != '{}') {


        sort = data.sortBy;
        sortValue = !sort ? '"Products"."createdAt"' : '"' + sort.sortValue + '"';
        sortDirection = !sort ? "DESC" : sort.sortDirection;
        sortTerm = sortValue + " " + sortDirection
        orderByQuery = ` Order by ` + sortTerm;

        if (data.searchTerm != "" && data.searchTerm != null) {
          searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`

        }

        selectQuery = selectText + filterQuery + orderByQuery + limitQuery
        let countQuery = countText + filterQuery
        countValues = [companyId, searchValue, productId]
        selectCount = await DB.excu.query(countQuery, countValues)
        count = Number((<any>selectCount.rows[0]).count)
        pageCount = Math.ceil(count / data.limit)
      }

      selectValues = [companyId, searchValue, productId, limit, offset]

      const selectList: any = await DB.excu.query(selectQuery, selectValues)

      offset += 1
      let lastIndex = ((page) * limit)
      if (selectList.rows.length < limit || page == pageCount) {
        lastIndex = count
      }

      const resData = {
        list: selectList.rows,
        count: count,
        pageCount: pageCount,
        startIndex: offset,
        lastIndex: lastIndex
      }
      // const query : { text: string, values: any } = {
      //   text: `select id, name from "Products" where "companyId" =$1 `,
      //   values: [companyId]
      // }
      // if (productId != null && productId != "") {
      //   query.text = `select id, name from "Products" where "companyId" =$1 and type ='inventory' and id<> $2  and "isDeleted" = false`
      //   query.values = [companyId, productId]
      // }

      // const list = await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", resData)
    } catch (error: any) {
    

      throw new Error(error.message)
    }
  }


  public static async getChildProductList(data: any, company: Company) {
    try {

      const companyId = company.id;
      let selectQuery;
      let selectValues;
      let countQuery;
      let countValues;
      let searchValue = '[A-Za-z0-9]*';
      let offset = 0;
      let sort: any;
      let sortValue;
      let sortDirection;
      let sortTerm;
      let count = 0;
      let pageCount = 0;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (data.page != 1) {
        offset = (limit * (data.page - 1))
      }
      let types = ["inventory"]
      let productId = data.productId;
      let parentId = data.parentId;
      const selectText = `SELECT
                          id,
                          name,
                          barcode
                    FROM "Products"`
      const countText = `SELECT
                      count(*)
                  FROM "Products"`

      let filterQuery = ` WHERE "Products"."isDeleted" = false AND "companyId"=$1 AND "Products".type = ANY( $2) `
      filterQuery += ` AND (LOWER ("Products".name) ~ $3
                      OR LOWER ("Products".barcode) ~ $3
                      OR LOWER ( ("translation" ->>'name')::jsonb->>'ar' ) ~ $3
                      OR LOWER ( ("translation" ->>'name')::jsonb->>'en' ) ~ $3
                      OR "Products"."defaultPrice"::varchar(255)~ $3)
                      AND ($4::uuid is null or "Products".id <> $4)
                      `




      let selectCount;
      let orderByQuery;
      selectQuery = selectText + filterQuery
      selectValues = [companyId, types, searchValue, productId]


      if (data != null && data != '' && JSON.stringify(data) != '{}') {
        let limitQuery;
        limitQuery = ` Limit $5 offset $6`

        sort = data.sortBy;
        sortValue = !sort ? '"Products"."createdAt"' : '"' + sort.sortValue + '"';
        sortDirection = !sort ? "DESC" : sort.sortDirection;
        if (data.parentId != null && data.parentId != "") {
          sortValue = ` ("Products".id = ` + "'" + data.parentId + "'" + ` )`
        }
        sortTerm = sortValue + " " + sortDirection
        orderByQuery = ` Order by ` + sortTerm;

        if (data.searchTerm != "" && data.searchTerm != null) {
          searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`

        }

        selectQuery = selectText + filterQuery + orderByQuery + limitQuery
        selectValues = [companyId, types, searchValue, productId, limit, offset]
        countQuery = countText + filterQuery
        countValues = [companyId, types, searchValue, productId]

        selectCount = await DB.excu.query(countQuery, countValues)
        count = Number((<any>selectCount.rows[0]).count)
        pageCount = Math.ceil(count / data.limit)
      }


      const selectList: any = await DB.excu.query(selectQuery, selectValues)

      offset += 1
      let lastIndex = ((data.page) * data.limit)
      if (selectList.rows.length < data.limit || data.page == pageCount) {
        lastIndex = count
      }

      const resData = {
        list: selectList.rows,
        count: count,
        pageCount: pageCount,
        startIndex: offset,
        lastIndex: lastIndex
      }
      return new ResponseData(true, "", resData)
    } catch (error: any) {
      console.log(error)
    
      throw new Error(error)
    }

  }
}