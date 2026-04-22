/* eslint-disable prefer-const */

import { Product } from "@src/models/product/Product";
import { PoolClient } from "pg";
import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Helper } from "@src/utilts/helper";

import { BranchProductsRepo } from "./branchProduct.repo";
import { BranchProducts } from "@src/models/product/BranchProducts";
import { Company } from "@src/models/admin/company";

export class ProductRepo {

  public static async checkIfProductIdExist(client: PoolClient, productIds: [string], companyId: string) {


    const query : { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Products" where id = ANY($1) and "companyId" = $2 `,
      values: [
        productIds,
        companyId
      ],
    };
    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty == productIds.length) {
      return true;
    }
    return false;
  }
  public static async checkIfBarcodeExists(client: PoolClient, productId: string | null, barcode: string, companyId: string): Promise<boolean> {

    //check product barcodes alias table
    let query : { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "ProductBarcodes" where lower(TRIM(barcode)) = lower(TRIM($1)) and "productId" <> $2 and "companyId" = $3`,
      values: [
        barcode,
        productId,
        companyId,
      ],
    };
    if (productId == null) {
      query.text = `SELECT count(*) as qty FROM "ProductBarcodes" where lower(TRIM(barcode)) = lower(TRIM($1)) and "companyId" = $2`;
      query.values = [barcode, companyId];
    }

    let resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }

    //check product table
     query= {
      text: `SELECT count(*) as qty FROM "Products" where  lower(TRIM(barcode)) = lower(TRIM($1)) and id <> $2 and "companyId" = $3`,
      values: [
        barcode,
        productId,
        companyId,
      ],
    };
    if (productId == null) {
      query.text = `SELECT count(*) as qty FROM "Products" where  lower(TRIM(barcode)) = lower(TRIM($1)) and "companyId" = $2`;
      query.values = [barcode, companyId];
    }

    resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }

    return false;
  }

  public static async getCompanyProductsIds(client: PoolClient, companyId: string) {
    try {
      const query : { text: string, values: any } = {
        text: `Select id,type from "Products" where "companyId" = $1`,
        values: [companyId]
      }

      const products = await client.query(query.text, query.values);
      return new ResponseData(true, "", products.rows)
    } catch (error: any) {
    

      throw new Error(error)
    }
  }
  public static async checkIfProductNameExists(productId: string | null, name: string, companyId: string): Promise<boolean> {

    const query : { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Products" where TRIM(LOWER(name)) = TRIM(LOWER($1)) and id <> $2 and "companyId" = $3`,
      values: [
        name,
        productId,
        companyId,
      ],
    };
    if (productId == null) {
      query.text = `SELECT count(*) as qty FROM "Products" where TRIM(LOWER(name)) = TRIM(LOWER($1)) and "companyId" = $2`;
      query.values = [name, companyId];
    }

    const resault = await DB.excu.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }

    return false;

  }
  public static async checkIfProductsTypeValid(Ids: [string], types: [string], companyId: string) {

    try {
      const uniqueIds = [... new Set(Ids)]

      const query : { text: string, values: any } = {
        text: `SELECT count(*) as qty FROM "Products" where id = ANY($1) and "companyId" = $2 and type = ANY($3) `,
        values: [
          uniqueIds,
          companyId,
          types
        ],
      };

      const resault = await DB.excu.query(query.text, query.values);

      if ((<any>resault.rows[0]).qty == uniqueIds.length) {
        return true;
      }
      return false;
    } catch (error: any) {
    

      return false
    }
  }



  public static async getProductOnHandAndUnitCost(client: PoolClient, productId: string, branchId: string) {


    try {
      const query : { text: string, values: any } = {
        text: `SELECT BranchProducts."onHand" , Products. "unitCost",Products."parentId"
                    FROM "BranchProducts" AS BranchProducts 
                    INNER JOIN "Products" AS Products
                    ON BranchProducts."productId" = Products.id 
                    AND "branchId"=$1 AND "productId"=$2`,
        values: [branchId, productId]
      }
      const product = await client.query(query.text, query.values);

      const data = {
        onHand: (<any>product.rows[0]).onHand,
        unitCost: (<any>product.rows[0]).unitCost,
        parentId: (<any>product.rows[0]).parentId
      }

      return data;
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async getProductUnitCost(client: PoolClient, productId: string | null) {
    try {
      const query : { text: string, values: any } = {
        text: `SELECT "unitCost" FROM "Products" where id =$1`,
        values: [productId]
      }
      const product = await client.query(query.text, query.values);

      const data = {
        unitCost: (<any>product.rows[0]).unitCost
      }

      return data;
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async getProductOnHand(client: PoolClient, productId: string, branchId: string | null) {
    const query : { text: string, values: any } = {
      text: `SELECT "onHand"  FROM "BranchProducts" where "productId"= ($1) AND "branchId"=$2`,
      values: [productId, branchId],
    };

    const onHand = await client.query(query.text, query.values);
    if (onHand.rowCount != null && onHand.rowCount > 0) {
      return (<any>onHand.rows[0]).onHand
    } else {
      return null;
    }
  }
  public static async getProductType(client: PoolClient, productId: string | null) {
    const query : { text: string, values: any } = {
      text: `SELECT type FROM "Products" where id= ($1)`,
      values: [productId],
    };

    const type = await client.query(query.text, query.values);
    if (type.rowCount != null && type.rowCount > 0) {
      return (<any>type.rows[0]).type
    } else {

      throw new Error("Product Not Found")
    }

  }

  public static async getProductBranchData(productId: string, branchId: string) {
    try {


      const query : { text: string, values: any } = {
        text: `SELECT price,
                     "Products".name,
                     "Products".type,
                     "onHand",
                     "defaultPrice",
                     "Media".url->>'defaultUrl' as "mediaUrl",
                     "Taxes".id as "taxId",
                     "Taxes"."taxes",
                     "Taxes"."taxPercentage",
                     "BranchProducts".price
              from "Products"
              INNER JOIN "BranchProducts" on "Products".id = "BranchProducts"."productId" 
              LEFT JOIN "Media" on "Media".id =  "Products"."mediaId"
              LEFT JOIN "Taxes" on "Products"."taxId" = "Taxes".id 
              WHERE "Products".id = $1 AND  "BranchProducts"."branchId" = $2
         `,
        values: [productId, branchId]
      }

      let prodDate = await DB.excu.query(query.text, query.values)
      if (prodDate.rowCount != null && prodDate.rowCount > 0) {
        return prodDate.rows[0]
      } else {
        throw new Error("Product Not Found")
      }
    } catch (error: any) {
    

      throw new Error(error)
    }
  }

  public static async getProductData(productId: string, companyId: string) {
    try {
      const query : { text: string, values: any } = {
        text: `SELECT
                     "defaultPrice",
                     "Products".name,
                     "Media".url->>'defaultUrl' as "mediaUrl",
                     "Taxes".id as "taxId",
                     "Taxes"."taxes",
                     "Taxes"."taxPercentage"
              from "Products"
              LEFT JOIN "Media" on "Media".id =  "Products"."mediaId"
              LEFT JOIN "Taxes" on "Products"."taxId" = "Taxes".id 
              WHERE  "Products".id=$1 and  "Products"."companyId" = $2
         `,
        values: [productId, companyId]
      }

      let prodDate = await DB.excu.query(query.text, query.values)
      if (prodDate.rowCount != null && prodDate.rowCount > 0) {
        return prodDate.rows[0]
      } else {
        throw new Error("Product Not Found")
      }
    } catch (error: any) {
    

      throw new Error(error)
    }
  }
  public static async getProduct(productId: string, company: Company) {
    try {
      const companyId = company.id;
      const query : { text: string, values: any } = {
        text: `SELECT
        Products.id ,
        Products."companyId",
        Products."parentId",
        Products."childQty",
        Products.name,
        Products."isDiscountable",
        Products."orderByWeight",
        Products. "preparationTime",
        Products.barcode,
        Products."defaultPrice",
        Products.description,
        Products.translation,
        Products."categoryId",
        Products."priceModel",
        Products.type,
        Products.taxes,
        Products.tags,
        Products.warning,
        Products."defaultImage",
        Products."weightUnit",
        Products."weightUnitEnabled",
        Products."serviceTime",
        Products."UOM",
        Products."unitCost",
        Products."kitBuilder",
        Products."package",
        Products.selection,
        Products."optionGroups",
        Products."quickOptions",
        Products.recipes,
        products.nutrition,
        Products."mediaId",
        Products."productMatrixId",
        Products."productMedia",
        Products."commissionPercentage",
        Products."commissionAmount",
        Products."productAttributes",
        Products."taxId",
        Products.translation,
	    	(SELECT "Categories"."departmentId" as "departmentId" from "Categories" WHERE "Categories".id =  Products."categoryId"),
        (SELECT "Media".url as "mediaUrl" from "Media" WHERE "Media".id =  Products."mediaId"),
        (SELECT json_agg(json_build_object('barcode', barcode )) AS barcodes from  "ProductBarcodes" WHERE "ProductBarcodes"."productId"= Products.id ),
        (SELECT json_agg(json_build_object('id',id,'employeeId', "employeeId" ,'price',price,'serviceTime',"serviceTime")) AS "employeePrices"   FROM "EmployeePrices"  WHERE "EmployeePrices"."productId"= Products.id  )
       
        FROM "Products" AS Products
	    	WHERE Products.id =$1
        AND Products."companyId" = $2
  
        `,
        values: [productId, companyId]
      }
      const productData = await DB.excu.query(query.text, query.values);


      const product: any = Helper.trim_nulls(productData.rows[0])
      const branchProduct = {
        text: `SELECT "BranchProducts".id,
        "branchId",
        "productId",
        available ,
        price,
        "onHand",
        "priceBoundriesFrom",
        "priceBoundriesTo",
        "buyDownPrice",
        "buyDownQty",
        "priceByQty",
        "availableOnline",
        "selectedPricingType",
        'serials',(SELECT json_agg(json_build_object('id',"ProductSerials".id,'serial', serial , 'status', "status",'unitCost',"unitCost", 'invoiceId',(select "Invoices".id FROM "Invoices" INNER JOIN "InvoiceLines" ON "InvoiceLines"."invoiceId" = "Invoices".id AND "InvoiceLines".serial = "ProductSerials".serial INNER JOIN "CreditNoteLines" ON "CreditNoteLines"."invoiceLineId" = "InvoiceLines".id AND "CreditNoteLines".serial = "InvoiceLines".serial AND "CreditNoteLines".id ISNULL ))) from "ProductSerials" WHERE   "BranchProducts".id = "ProductSerials"."branchProductId") AS serials,
        'batches',(SELECT json_agg(json_build_object('id',"ProductBatches".id,'batch', batch , 'unitCost', "unitCost", 'expireDate', "expireDate"::date,'prodDate',"prodDate",'onHand',  "onHand")) AS batches from "ProductBatches"  WHERE   "BranchProducts".id = "ProductBatches"."branchProductId" ) AS batches
        FROM  "BranchProducts"
		inner join "Branches" on "BranchProducts"."branchId" = "Branches".id 
		WHERE "BranchProducts"."productId"=$1
		order  by "Branches"."createdAt" asc  `,
        values: [productId]

      }
      const brachesData = await DB.excu.query(branchProduct.text, branchProduct.values)
      product.branchProduct = brachesData.rows


      if (product.quickOptions) {
        for (let index = 0; index < product.quickOptions.length; index++) {
          const element = product.quickOptions[index];
          product.quickOptions[index] = { id: element }
        }
      }
      return new ResponseData(true, "", product);

    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async listProductFilter(data: any, company: Company): Promise<ResponseData> {
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
      let types = ["inventory", "batch", "serialized", "service", "menuSelection", "menuItem", "package", "kit"]

      const selectText = `SELECT
                            id,
                            name,
                            barcode,
                            "defaultPrice",
                            type,
                            "UOM",
                            "translation"
                      FROM "Products"`
      const countText = `SELECT
                        count(*)
                    FROM "Products"`

      let filterQuery = ` WHERE "Products"."isDeleted" = false AND "companyId"=$1 AND "Products".type = ANY( $2) `
      filterQuery += ` AND (LOWER ("Products".name) ~ $3
                        OR LOWER ("Products".barcode) ~ $3
                        OR LOWER ("Products".type) ~ $3
                        OR LOWER ("Products". "UOM") ~ $3
                        OR LOWER ( ("translation" ->>'name')::jsonb->>'ar' ) ~ $3
                        OR LOWER ( ("translation" ->>'name')::jsonb->>'en' ) ~ $3
                        OR "Products"."defaultPrice"::varchar(255)~ $3)`

      const limitQuery = ` Limit $4 offset $5`

      let selectCount;
      let orderByQuery;
      selectQuery = selectText + filterQuery
      selectValues = [companyId, types, searchValue]


      if (data != null && data != '' && JSON.stringify(data) != '{}') {

        if (data.filter && data.filter.type && data.filter.type.length > 0) {
          types = data.filter.type;

        }
        sort = data.sortBy;
        sortValue = !sort ? '"Products"."createdAt"' : '"' + sort.sortValue + '"';
        sortDirection = !sort ? "DESC" : sort.sortDirection;
        sortTerm = sortValue + " " + sortDirection
        orderByQuery = ` Order by ` + sortTerm;

        if (data.searchTerm != "" && data.searchTerm != null) {
          searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`
        }

        selectQuery = selectText + filterQuery + orderByQuery + limitQuery
        selectValues = [companyId, types, searchValue, limit, offset]
        countQuery = countText + filterQuery
        countValues = [companyId, types, searchValue]

        selectCount = await DB.excu.query(countQuery, countValues)
        count = Number((<any>selectCount.rows[0]).count)
        pageCount = Math.ceil(count / data.limit)
      }


      const selectList: any = await DB.excu.query(selectQuery, selectValues)

      for (let index = 0; index < selectList.rows.length; index++) {
        const element = selectList.rows[index];
        if (element.type == "batch" || element.type == "serialized" || element.type == "inventory" || element.type == "kit") {
          const branchSummary = await this.getProductAvailability(element.id, companyId);
          if (branchSummary?.data) {
            selectList.rows[index].branchSummary = branchSummary.data
          }
        }
      }

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

    
      throw new Error(error)
    }
  }
  public static async getListOfProductsbyType(company: Company, types: [string], exclude: [string]) {
    try {
      const companyId = company.id;
      let filterType: any = types;
      const includedTypes = ['service', 'inventory', 'kit', 'package', 'menuItem', 'menuSelection', 'batch', 'serialized']
      if (exclude && exclude.length > 0) {
        filterType = includedTypes.filter(a => !exclude.includes(a));
      } else if (!types && !exclude) {
        filterType = includedTypes
      }

      const query : { text: string, values: any } = {
        text: `SELECT id,
                     name,
                     type,
                     "UOM",
                     "defaultPrice",
                      "barcode" 
                FROM "Products" 
                where  "companyId" = $1 
                and type = any($2) 
                AND "Products"."isDeleted" = false`,
        values: [
          companyId,
          filterType
        ],
      }
      const list = await DB.excu.query(query.text, query.values);
      const data: Product[] = [];
      list.rows.forEach((element: any) => {
        const temp = new Product();
        temp.ParseJson(element);
        data.push(temp);
      });

      // const resData = {
      //   list: data
      // }
      return new ResponseData(true, "", list.rows)
    } catch (error: any) {

      console.log(error)
    
      throw new Error(error);
    }
  }
  public static async getProductListByBrnachId(branchId: string) {
    try {
      const query : { text: string, values: any } = {
        text: `SELECT 
                  "Products".id,
                  "Products".name,
                  "Products"."defaultImage"
              FROM "Products"
              INNER JOIN "BranchProducts"
              ON "Products".id ="BranchProducts"."productId"
              WHERE "BranchProducts"."branchId"=$1 and "isDeleted" = false `,
        values: [branchId]
      }
      const list = await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", list.rows)
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async setProductColor(data: any) {
    try {
      const date = new Date();

      const query : { text: string, values: any } = {
        text: `UPDATE "Products"
                       SET color = $1,
                       "updatedDate"=$2
                       WHERE id = $3`,
        values: [data.color, date, data.productId]
      }


      await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", [])
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async updateProductSDeafultImage(productId: string, imagePath: string, client: PoolClient) {
    try {
      const query : { text: string, values: any } = {
        text: `UPDATE "Products" SET "defaultImage"=$1 WHERE id=$2 `,
        values: [imagePath, productId]
      }
      await client.query(query.text, query.values)
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async setProductUnitCost(client: PoolClient, unitCost: number, productId: string) {
    try {
      const query : { text: string, values: any } = {
        text: `UPDATE "Products" set "unitCost"=$1 where id =$2`,
        values: [unitCost, productId]
      }
      await client.query(query.text, query.values)
    } catch (error: any) {
      throw new Error(error)
    }
  }

  //calculate and set  product  avarge unit cost  and new   product  on HAND  
  public static async calculateUnitCostAvg(client: PoolClient, productId: any, branchId: string, qty: number, unitCost: number, afterDecimal: number) {
    const branchProductData = await BranchProductsRepo.getBranchProductAndUnitCost(client, productId, branchId);
    const branchProduct = new BranchProducts();
    branchProduct.ParseJson(branchProductData);

    //calculate new unitCost by Avarage
    // average = (oldUnitCost * oldOnHand) + (UnitCostAtPurchased * QtyAtPurchased) /  (oldOnHand +QtyAtPurchased)
    const oldonHand = branchProductData.onHand;
    const oldUnitCost = Helper.roundDecimal(branchProductData.unitCost, afterDecimal)// existing unitCost 
    const newQty = Helper.add(branchProduct.onHand, qty, afterDecimal)
    const oldCost = Helper.multiply(oldUnitCost, branchProduct.onHand, afterDecimal) // existing totalCost 
    const newCost = Helper.multiply(qty, unitCost, afterDecimal)  // new totalCost 
    const average = Helper.division((oldCost + newCost), newQty, afterDecimal)


    //update the current product unitCost 
    await ProductRepo.setProductUnitCost(client, average, productId)

    //update branchProduct on Hand 
    branchProduct.onHand = newQty;
    // await BranchProductsRepo.setNewOnHand(client, branchId, productId, newQty)

    return {
      newCost: newCost,
      oldCost: oldCost,
      oldonHand: oldonHand
    }
  }
  public static async getProductCommission(client: PoolClient, productId: string) {
    try {
      const query : { text: string, values: any } = {
        text: `SELECT "commissionPercentage","commissionAmount" FROM "Products" where id = $1`,
        values: [productId]
      }
      const data = await client.query(query.text, query.values);
      return data.rows[0]
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async getProductNameAndBarcode(client: PoolClient, productId: string) {
    try {
      const query : { text: string, values: any } = {
        text: `SELECT name,
                     barcode,
                     "unitCost",
                      type
                     from "Products" where id =$1
                     `,
        values: [productId]
      }

      let product = await client.query(query.text, query.values);
      return (<any>product.rows[0])
    } catch (error: any) {
    
      throw new Error(error)
    }
  }



  protected static async deleteProductBarcodes(client:PoolClient,productId:string)
  {
    try {
      const qty={
        text:`DELETE FROM "ProductBarcodes" where "productId" =$1`,
        values:[productId]
      }
      await client.query(qty.text,qty.values);
    
    } catch (error:any) {
      throw new Error(error)
    }
  }
  //Socket
  public static async getProductAvailability(productId: string, companyId: string) {

    try {

      const query : { text: string, values: any } = {
        text: `SELECT 
                  "branch",
                   sum("onHand") as "onHand" 
              FROM "ProductsOnHands"
              WHERE "companyId"=$1
              AND "productId"=$2
              group by "ProductsOnHands".branch`,
        values: [companyId, productId]
      }
      const branches = await DB.excu.query(query.text, query.values)

      return new ResponseData(true, "", branches.rows)


    } catch (error: any) {

    
    }
  }
  public static async getProductsOnHand(client: PoolClient, productIds: any[string], branchId: string) {
    try {
      const query : { text: string, values: any } = {
        text: `
                      SELECT "productId", "onHand", batch  FROM "ProductsOnHands"
                      where "productId"= any($1)
                      and "branchId" = $2`,
        values: [productIds, branchId]
      }
      const data = await client.query(query.text, query.values);
      return new ResponseData(true, "", data.rows)
    } catch (error: any) {
      throw new Error(error)
    }
  }
  public static async setProductAvailaibility(productId: string, branchId: string, availaibility: boolean) {
    try {
      const query : { text: string, values: any } = {
        text: `UPDATE "BranchProducts" 
                         SET available = $1
                         WHERE "branchId"=$2
                         AND "productId"=$3`,
        values: [availaibility, branchId, productId]
      }

      await DB.excu.query(query.text, query.values)

    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async getBranchProductById(client: PoolClient, productId: string, branchId: string) {
    try {
      const query : { text: string, values: any } = {
        text: `SELECT
        BranchProducts.available,
        BranchProducts.price,
        BranchProducts. "onHand",
        BranchProducts."priceBoundriesFrom",
        BranchProducts."priceBoundriesTo",
        BranchProducts."buyDownPrice",
        BranchProducts."buyDownQty",
        BranchProducts."buyDownQty",
        BranchProducts."priceByQty",
        Products.id ,
        Products."companyId" ,
        Products."parentId",
        Products."childQty",
        Products.name,
        "Media".id as "mediaId",
        "Media"."url" as "mediaUrl",
        Products.barcode,
        Products."defaultPrice",
        Products.description,
        Products.translation,
        Products."categoryId",
        Products.type,
        Products.taxes,
        Products.tags,
        Products.warning,
        Products."defaultImage",
        Products."weightUnit",
        Products."weightUnitEnabled",
        Products."serviceTime",
        Products."UOM",
        Products."unitCost",
        Products."kitBuilder",
        Products."package",
        Products.selection,
        Products."optionGroups",
        Products."quickOptions",
        Products.recipes,
        Products."productMatrixId",
        Products."productMedia",
        (select json_agg(json_build_object('batch', batch , 'unitCost', "unitCost", 'expireDate', "expireDate")) AS batches from  "ProductBatches" as ProductBatches where BranchProducts.id = ProductBatches."branchProductId"),
        (select json_agg(json_build_object('serial', serial , 'status', "status")) AS serials from  "ProductSerials" as ProductSerials where BranchProducts.id = ProductSerials."branchProductId"),
        (select json_agg(json_build_object('barcode', barcode )) AS barcodes from  "ProductBarcodes" as ProductBarcodes where Products.id = ProductBarcodes."productId"),
        (select json_agg(json_build_object('employeeId', "employeeId" ,'price',price,'serviceTime',"serviceTime")) AS EmployeePrices   FROM "EmployeePrices" as EmployeePrices where Products.id = EmployeePrices."productId")
        FROM "BranchProducts" AS BranchProducts 
        inner JOIN "Products" AS Products ON BranchProducts."productId" = Products.id 
        left join "Media" on "Media".id = Products."mediaId"

        where BranchProducts."branchId" = $1
        AND BranchProducts."productId"=$2 `,
        values: [branchId, productId]
      }
      const product = await client.query(query.text, query.values);

      return product.rows[0]
    } catch (error: any) {
      console.log(error)
    
      throw new Error(error)
    }
  }



}