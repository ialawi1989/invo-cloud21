/* eslint-disable prefer-const */
import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { FileStorage } from "@src/utilts/fileStorage";
import { PoolClient } from "pg";


import { Company } from "@src/models/admin/company";
import { Helper } from "@src/utilts/helper";
import { S3Storage } from "@src/utilts/S3Storage";
import { ValidationException } from "@src/utilts/Exception";
import { TimeHelper } from "@src/utilts/timeHelper";

export class MenuRepo {
  static async getMenuProducts(data: any, company: any) {
    try {



      const query: { text: string, values: any } = {
        text: `SELECT
          BranchProducts.available,
          BranchProducts.price,
          BranchProducts. "onHand",
          BranchProducts."priceBoundriesFrom",
          BranchProducts."priceBoundriesTo",
          BranchProducts."buyDownPrice",
          BranchProducts."buyDownQty",
          BranchProducts."priceByQty",
          BranchProducts."selectedPricingType",
          Products.id ,
          Products."companyId" ,
          Products."parentId",
          Products."childQty",
          Products.name,
          Products.barcode,
          Products."defaultPrice",
          Products.description,
          Products."mediaId",
          Products.translation,
          Products."categoryId",
          Products. "preparationTime",
          Products."orderByWeight",
          Products. "preparationTime",
          Products.type,
          Products."taxId",
          Products.tags,
          Products.warning,
          Products."defaultImage",
          Products."weightUnit",
          Products."weightUnitEnabled",
          Products."serviceTime",
          products.nutrition,
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
          Products."commissionPercentage",
          Products."commissionAmount",
          Products."taxId",
          Products.color,
          Products."priceModel",
          products."maxItemPerTicket",
          "Media"."url"->>'defaultUrl' as "defaultImage",
          (select json_agg(json_build_object('batch', batch , 'unitCost', "unitCost", 'expireDate', "expireDate",'onHand',COALESCE("onHand",0))) AS batches from  "ProductBatches" as ProductBatches where BranchProducts.id = ProductBatches."branchProductId"),
          (select json_agg(json_build_object('serial', serial , 'status', "status")) AS serials from  "ProductSerials" as ProductSerials where BranchProducts.id = ProductSerials."branchProductId"),
          (select json_agg(json_build_object('barcode', barcode )) AS barcodes from  "ProductBarcodes" as ProductBarcodes where Products.id = ProductBarcodes."productId"),
          (select json_agg(json_build_object('employeeId', "employeeId" ,'price',price,'serviceTime',"serviceTime")) AS "employeePrices"   FROM "EmployeePrices" as EmployeePrices where Products.id = EmployeePrices."productId")
          FROM "Products" AS Products 
          inner join "BranchProducts" AS BranchProducts ON BranchProducts."productId" = Products.id 
          inner join "MenuSectionProduct" on  "MenuSectionProduct"."productId" =  Products.id 
              left join "Media" on "Media".id = Products."mediaId"
              where BranchProducts."branchId" =$1  and "MenuSectionProduct"."menuSectionId" = $2
            `,
        values: [data.branchId, data.sectionId]
      }




      const products: any = await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", products.rows)
    } catch (error: any) {
    
      throw new Error(error.message)
    }
  }

  public static async getMenuSections(data: any, company: Company) {

    try {
      /**
       * the function will retrieve menu sections by compnayId or branchId 
       */
      // const currentDate = await TimeHelper.getCurrentDateWithTimeZone(company.timeOffset);   
      const currentDate = new Date();
      const currentHour = currentDate.getUTCHours();
      const currentMinutes = currentDate.getUTCMinutes();
      const currentSeconds = currentDate.getUTCSeconds();
      let currentTime = currentHour + ':' + currentMinutes + ':' + currentSeconds

      const filterId = data.branchId ? data.branchId : company.id; // determine filter id [companyId || brnachId]
      let filter = ` WHERE `
      filter += data.branchId ? `replace(("branches".branch->'branchId')::text,'"','') =$1 ` : ` "Menu"."companyId" = $1`  // determine filter query  by [companyId || brnachId]
      filter += ` AND "Menu"."startAt" <= $2::time AND  "Menu"."endAt" >= $2::time  `




      let query = `select 
                        distinct on ("MenuSection".id) "MenuSection".id, 
                        "MenuSection".name,
                        "MenuSection".index
                    from "MenuSection"
                    INNER JOIN "Menu" ON "Menu".id =  "MenuSection"."menuId"
                    cross JOIN LATERAL JSONB_ARRAY_ELEMENTS("Menu"."branchIds") AS "branches"(branch)`

      query += filter

      let values = [filterId, currentTime]

      let sections = await DB.excu.query(query, values)

      /**
       * sorting the sections based on index 
       * didn't used order by because of  select distinct on ("MenuSection".id)
       * select distinct : is used because the menu is assigned to 
       * many branches when retrieving the sections using the compnayId it will retrieve 
       * duplicated sections  because of cross JOIN LATERAL JSONB_ARRAY_ELEMENTS("Menu"."branchIds") AS "branches"(branch)` 
       * cross JOIN LATERAL JSONB_ARRAY_ELEMENTS : is used to retrieve branchId from jsonb array to be used  when selecting menu sections for one branch only
       */
      sections.rows.sort((a: any, b: any) => a.index - b.index)

      return new ResponseData(true, "", sections.rows)
    } catch (error: any) {
      console.log(error);
    

      throw new Error(error)
    }

  }

  public static async getMenuId(client: PoolClient, menuName: string, companyId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT id from "Menu" where lower(name)=lower($1) and "companyId"=$2`,
        values: [menuName, companyId]
      }

      let menu = await client.query(query.text, query.values);
      return menu.rows[0].id
    } catch (error: any) {
    

      throw new Error(error)
    }
  }


  public static async getMenuList2(data: any) {
    try {
      //  const companyId = company.id;
      const branchId = data.branchId
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

      const selectText =
        `SELECT "Menu".id,
      "Menu"."name",
      "Menu"."startAt",
      "Menu"."endAt",
      "Menu"."index"
                    from "Menu"`

      let filterQuery = ` WHERE EXISTS (SELECT 1 FROM jsonb_array_elements("Menu"."branchIds") AS elements WHERE elements->>'branchId' = $1) `

      filterQuery += ` AND (LOWER ("Menu".name) ~ $2)`



      selectQuery = selectText + filterQuery;
      selectValues = [branchId, searchValue]



      const selectList = await DB.excu.query(selectQuery, selectValues)


      const resData = selectList.rows


      return new ResponseData(true, "", resData)

    } catch (error: any) {
    
      throw new Error(error)
    }
  }



  public static async getBranchMenubyId(branchId: string, menuId: string) {

    const client = await DB.excu.client();
    try {

      await client.query("BEGIN")
      const query: { text: string, values: any } = {
        text: `SELECT id,
         "name",
        "startAt",
        "branchIds"
         FROM "Menu" 
         WHERE "Menu".id = $1
         `,
        values: [menuId]
      }
      const menu: any = await client.query(query.text, query.values)
      menu.rows[0].sections = []
      query.text = `SELECT id,
                        name,
                        translation,
                        image,
                        index,
                        properties
                  FROM "MenuSection"
                  WHERE "MenuSection"."menuId"=$1 `;
      query.values = [menuId];
      const menuSection: any = await client.query(query.text, query.values)

      for (let index = 0; index < menuSection.rows.length; index++) {
        const element = menuSection.rows[index];
        element.products = [];
        query.text = `SELECT "MenuSectionProduct".id,
                            index,
                            "doubleWidth",
                            "doubleHeight",
                            "productId",
                            "Products".name "productName", 
                            "Products"."defaultImage",
                            color
                            FROM "MenuSectionProduct" 
                            INNER JOIN "Products"
                            ON "Products".id = "MenuSectionProduct".  "productId"
                            WHERE "MenuSectionProduct"."menuSectionId" = $1
                            `
        query.values = [element.id]


        const products = await client.query(query.text, query.values);
        element.products.push(products.rows)
        menu.rows[0].sections[index].push(element)
      }
      await client.query("COMMIT")
      return new ResponseData(true, "", menu.rows[0])
    } catch (error: any) {
    
      await client.query("ROLLBACK")
      throw new Error(error)
    } finally {
      client.release();
    }
  }

  public static async getMenuById(menuId: string, company: Company) {

    try {
      const companyId = company.id
      const sql = `SELECT menu.id,
      menu."name",
      menu."startAt",
      menu."endAt",
      menu.index,
                  (SELECT
                     json_agg(json_build_object(
                           'id',id,
                          'name',name,
                          'translation',translation,
                          'image',image,
                          'index',index,
                          'properties',properties,
                          'products',(
                               SELECT json_agg(json_build_object('id',"MenuSectionProduct".id,'index',index,'doubleWidth',"doubleWidth",'doubleHeight',"doubleHeight",'productId',"productId",'color',"Products".color,'defaultImage',"Products"."defaultImage",'productName',"Products".name,'page',page,'url',"Media".url,'mediaType',"Media"."mediaType"))
                               FROM "MenuSectionProduct" 
                               INNER JOIN "Products"
                               ON "Products".id = "MenuSectionProduct"."productId"
                               left join "Media"
                               on "Media".id = "Products"."mediaId"
                               WHERE "MenuSectionProduct". "menuSectionId" = "MenuSection".id

                               )
                  )) FROM "MenuSection"
                   WHERE menu.id = "MenuSection"."menuId") AS sections
                FROM "Menu" AS menu
                WHERE menu.id =$1
                and "companyId" = $2
                `;
      const query: { text: string, values: any } = {
        text: sql,
        values: [menuId, companyId]
      }
      const file = new FileStorage();
      const menus = await DB.excu.query(query.text, query.values);
      const menu: any = menus.rows[0]

      if (menu.sections) {
        for (let index = 0; index < menu.sections.length; index++) {
          const element = menu.sections[index];
          if (element.products) {
            for (let i = 0; i < element.products.length; i++) {
              const product = element.products[i];
              const type = await file.getImageType(companyId, product.productId)

              if (product.url != null) {
                menu.sections[index].products[i].defaultImage = product.url.defaultUrl
                const imageType = type?.split("/")[1];
                menu.sections[index].products[i].imageType = imageType;
              }

            }
          }

        }

      }

      return new ResponseData(true, "", menu)
    } catch (error: any) {

    
      throw new Error(error)
    }
  }

  public static async MenuProductList(company: Company): Promise<ResponseData> {
    try {
      const companyId = company.id;



      let query: { text: string, values: any } = {
        text: `
          Select "p"."id",
  "parentId",
  "name",
  "color",
  "commissionAmount",
  "commissionPercentage",
  "barcode", 
  "defaultPrice" ,
  "description",
  "type",
  "warning",
  "UOM",
  "unitCost",
  "priceModel",
  "barcode",
  "taxId",
"translation",
  "serviceTime",
  "quickOptions",
 "optionGroups",
  "package",
  "selection",
  "priceModel",
  "categoryId",
  "maxItemPerTicket"
  from "Products" p
  join "BranchProducts" bp  on bp."productId"  = p.id
  where p."companyId" = $1
          `,

        values: [
          companyId,
        ],
      }


      const list: any = await DB.excu.query(query.text, query.values);
      for (let index = 0; index < list.rows.length; index++) {
        const element = list.rows[index];
        if (list.rows[index].url)
          list.rows[index].defaultImage = list.rows[index].url.thumbnailUrl
      }
      return new ResponseData(true, "", list.rows)
    } catch (error: any) {
    
      throw new Error(error)
    }

  }

  public static async deleteMenuSectionProduct(client: PoolClient, productId: string) {
    try {

      const query: { text: string, values: any } = {
        text: `DELETE FROM "MenuSectionProduct" where "productId"=$1`,
        values: [productId]
      }
      await client.query(query.text, query.values)
    } catch (error: any) {
    

      throw new Error(error)
    }
  }

  //-------------

  public static async getMenuList(company: Company, branchId: string) {
    try {


      const companyId = company.id
      const currentDate = await TimeHelper.getCurrentDateWithTimeZone(company.timeOffset)
      const currentHour = currentDate.getUTCHours();
      const currentMinutes = currentDate.getUTCMinutes();
      const currentSeconds = currentDate.getUTCSeconds();
      let currentTime = currentHour + ':' + currentMinutes + ':' + currentSeconds

      const query: { text: string, values: any } = {
        text: `SELECT "Menu".id,
                          "Menu"."name",
                          "Menu"."startAt",
                          "Menu"."endAt",
                          "Menu"."index"
                    from "Menu"
                    WHERE "Menu"."companyId" = $1
                          AND  EXISTS (SELECT 1 FROM jsonb_array_elements("Menu"."branchIds") AS elements WHERE elements->>'branchId' = $2)
                          AND "Menu"."startAt" <= $3::time AND  "Menu"."endAt" >= $3::time
                       `,
        values: [companyId, branchId, currentTime]
      }
      const records = await DB.excu.query(query.text, query.values)
      const resData = records.rows && records.rows.length > 0 ? records.rows : []
      return new ResponseData(true, "", resData)

    } catch (error: any) {
    
      throw new Error(error)
    }
  }

  public static async getMenuSectionList(data: any, company: Company) {

    try {
      /**
       * the function will retrieve menu sections by compnayId or branchId 
       */
      // const currentDate = await TimeHelper.getCurrentDateWithTimeZone(company.timeOffset);   


      const currentDate = new Date();
      const currentHour = currentDate.getUTCHours();
      const currentMinutes = currentDate.getUTCMinutes();
      const currentSeconds = currentDate.getUTCSeconds();
      let currentTime = currentHour + ':' + currentMinutes + ':' + currentSeconds
      let companyId = company.id
      let branchId = data.branchId ? data.branchId : null
      let menuId = data.menuId ? data.menuId : null
      let query = `SELECT
                    menuSection.id ,
                    menuSection.name,
                    menuSection.translation,
                    menuSection.color,
                    menuSection.image,
                    menuSection.index,
                    (
                      SELECT json_agg(json_build_object('id',id,'index',index,'doubleWidth',"doubleWidth",'doubleHeight',"doubleHeight",'productId',"productId"))
                      FROM "MenuSectionProduct" 
                      WHERE "MenuSectionProduct". "menuSectionId" = menuSection.id
                      ) as "Products"
                  FROM "MenuSection" as menuSection
                  INNER JOIN "Menu" ON "Menu".id =  menuSection."menuId"
                  WHERE "Menu"."companyId" = $1
                    AND  EXISTS (SELECT 1 FROM jsonb_array_elements("Menu"."branchIds") AS elements WHERE elements->>'branchId' = $2)
                    And "Menu".id = $3
                    AND "Menu"."startAt" <= $4::time AND  "Menu"."endAt" >= $4::time        
                  `

      let values = [companyId, branchId, menuId, currentTime]

      let records = await DB.excu.query(query, values)
      records.rows.sort((a: any, b: any) => a.index - b.index)

      const resData = records.rows && records.rows.length > 0 ? records.rows : []
      return new ResponseData(true, "", resData)

    } catch (error: any) {
      console.log(error);
    

      throw new Error(error)
    }

  }

  public static async getProduct(productId: string) {
    try {

      //     const companyId = company.id;
      const query: { text: string, values: any } = {
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
        (SELECT "Media".url as "defualtURL" from "Media" WHERE "Media".id =  Products."mediaId"),
        (SELECT json_agg(json_build_object('barcode', barcode )) AS barcodes from  "ProductBarcodes" WHERE "ProductBarcodes"."productId"= Products.id ),
        (SELECT json_agg(json_build_object('id',id,'employeeId', "employeeId" ,'price',price,'serviceTime',"serviceTime")) AS "employeePrices"   FROM "EmployeePrices"  WHERE "EmployeePrices"."productId"= Products.id  )
       
        FROM "Products" AS Products
	    	WHERE Products.id =$1
    
  
        `,
        values: [productId]
      }
      const productData = await DB.excu.query(query.text, query.values);

      const product: any = Helper.trim_nulls(productData.rows[0])
      // product.branchProduct = [];
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
		WHERE "BranchProducts"."productId"=$1 and "BranchProducts"."branchId"
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
      console.log(error);
    
      throw new Error(error)
    }
  }

  public static async getProductByBranchId(productId: string, branchId: string,) {
    try {

      //     const companyId = company.id;
      const query: { text: string, values: any } = {
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
        (SELECT "Media".url as "defualtURL" from "Media" WHERE "Media".id =  Products."mediaId"),
        (SELECT json_agg(json_build_object('barcode', barcode )) AS barcodes from  "ProductBarcodes" WHERE "ProductBarcodes"."productId"= Products.id ),
        (SELECT json_agg(json_build_object('id',id,'employeeId', "employeeId" ,'price',price,'serviceTime',"serviceTime")) AS "employeePrices"   FROM "EmployeePrices"  WHERE "EmployeePrices"."productId"= Products.id  ),
       
        "BranchProducts"."branchId",
    
       "BranchProducts". available ,
        "BranchProducts".price,
        "BranchProducts"."onHand",
        "BranchProducts"."priceBoundriesFrom",
       "BranchProducts". "priceBoundriesTo",
        "BranchProducts"."buyDownPrice",
        "BranchProducts"."buyDownQty",
        "BranchProducts"."priceByQty",
        "BranchProducts"."availableOnline",
        "BranchProducts"."selectedPricingType",
        (SELECT json_agg(json_build_object('id',"ProductSerials".id,'serial', serial , 'status', "status",'unitCost',"unitCost", 'invoiceId',(select "Invoices".id FROM "Invoices" INNER JOIN "InvoiceLines" ON "InvoiceLines"."invoiceId" = "Invoices".id AND "InvoiceLines".serial = "ProductSerials".serial INNER JOIN "CreditNoteLines" ON "CreditNoteLines"."invoiceLineId" = "InvoiceLines".id AND "CreditNoteLines".serial = "InvoiceLines".serial AND "CreditNoteLines".id ISNULL ))) from "ProductSerials" WHERE   "BranchProducts".id = "ProductSerials"."branchProductId") AS serials,
        (SELECT json_agg(json_build_object('id',"ProductBatches".id,'batch', batch , 'unitCost', "unitCost", 'expireDate', "expireDate"::date,'prodDate',"prodDate",'onHand',  "onHand")) AS batches from "ProductBatches"  WHERE   "BranchProducts".id = "ProductBatches"."branchProductId" ) AS batches
       

        FROM "Products" AS Products
        inner join "BranchProducts" on "BranchProducts"."productId" = Products.id
	    	WHERE Products.id =$1 and "BranchProducts"."branchId" =$2
    
  
        `,
        values: [productId, branchId]
      }
      const productData = await DB.excu.query(query.text, query.values);

      const product: any = Helper.trim_nulls(productData.rows[0])


      if (product.quickOptions) {
        for (let index = 0; index < product.quickOptions.length; index++) {
          const element = product.quickOptions[index];
          product.quickOptions[index] = { id: element }
        }
      }
      return new ResponseData(true, "", product);

    } catch (error: any) {
      console.log(error);
    
      throw new Error(error)
    }
  }


  public static async getProducts(productIds: string[], branchId: string,) {
    try {

      //     const companyId = company.id;
      const query: { text: string, values: any } = {
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
        (SELECT "Media".url as "defualtURL" from "Media" WHERE "Media".id =  Products."mediaId"),
        (SELECT json_agg(json_build_object('barcode', barcode )) AS barcodes from  "ProductBarcodes" WHERE "ProductBarcodes"."productId"= Products.id ),
        (SELECT json_agg(json_build_object('id',id,'employeeId', "employeeId" ,'price',price,'serviceTime',"serviceTime")) AS "employeePrices"   FROM "EmployeePrices"  WHERE "EmployeePrices"."productId"= Products.id  ),
       
        "BranchProducts"."branchId",
    
       "BranchProducts". available ,
        "BranchProducts".price,
        "BranchProducts"."onHand",
        "BranchProducts"."priceBoundriesFrom",
       "BranchProducts". "priceBoundriesTo",
        "BranchProducts"."buyDownPrice",
        "BranchProducts"."buyDownQty",
        "BranchProducts"."priceByQty",
        "BranchProducts"."availableOnline",
        "BranchProducts"."selectedPricingType",
        (SELECT json_agg(json_build_object('id',"ProductSerials".id,'serial', serial , 'status', "status",'unitCost',"unitCost", 'invoiceId',(select "Invoices".id FROM "Invoices" INNER JOIN "InvoiceLines" ON "InvoiceLines"."invoiceId" = "Invoices".id AND "InvoiceLines".serial = "ProductSerials".serial INNER JOIN "CreditNoteLines" ON "CreditNoteLines"."invoiceLineId" = "InvoiceLines".id AND "CreditNoteLines".serial = "InvoiceLines".serial AND "CreditNoteLines".id ISNULL ))) from "ProductSerials" WHERE   "BranchProducts".id = "ProductSerials"."branchProductId") AS serials,
        (SELECT json_agg(json_build_object('id',"ProductBatches".id,'batch', batch , 'unitCost', "unitCost", 'expireDate', "expireDate"::date,'prodDate',"prodDate",'onHand',  "onHand")) AS batches from "ProductBatches"  WHERE   "BranchProducts".id = "ProductBatches"."branchProductId" ) AS batches
       

        FROM public."Products" AS Products
        inner join "BranchProducts" on "BranchProducts"."productId" = Products.id
	    	WHERE Products.id = ANY($1) and "BranchProducts"."branchId" =$2
    
  
        `,
        values: [productIds, branchId]
      }
      const productData = await DB.excu.query(query.text, query.values);

      if (!productData.rows || productData.rows.length === 0) {
        return new ResponseData(false, "No products found for the given IDs", []);
      }
      const products: any[] = productData.rows.map((row: any) => Helper.trim_nulls(row));
      return new ResponseData(true, "", products);

    } catch (error: any) {
      console.log(error);
    
      throw new Error(error)
    }
  }


  public static async getOptionGroupsList(data: any, company: Company) {

    try {
      const companyId = company.id;

      const query: { text: string, values: any } = {
        text: `SELECT  "OptionGroups".*
               from "OptionGroups"                
               where "OptionGroups"."companyId"  =   $1`,
        values: [companyId]
      }

      let records = await DB.excu.query(query.text, query.values);

      const resData = records.rows && records.rows.length > 0 ? records.rows : []
      return new ResponseData(true, "", resData)

    } catch (error: any) {

    
      throw new Error(error)
    }
  }

  public static async getOptions(data: any, company: Company) {
    try {

      const companyId = company.id;
      const query: { text: string, values: any } = {
        text: `SELECT   "Options".*,
                        "Media".id as "mediaId",
                        "Media".url as "mediaUrl"
               FROM "Options" 
              LEFT JOIN "Media" on "Media".id = "Options"."mediaId"
               where "Options" ."companyId"=$1`,
        values: [companyId]
      }

      const options = await DB.excu.query(query.text, query.values);


      if (options.rows && options.rows.length > 0) {

        for (let index = 0; index < options.rows.length; index++) {
          const newData: any = options.rows[index];

          if (newData.mediaId != null && newData.mediaId != "" && newData.mediaUrl && newData.mediaUrl.defaultUrl) {
            const mediaName = newData.mediaUrl.defaultUrl.substring(newData.mediaUrl.defaultUrl.lastIndexOf('/') + 1)
            let imageData: any = await S3Storage.getImageUrl(mediaName, newData.companyId)

            if (imageData) {
              imageData = imageData.split(';base64,').pop();
              (<any>options.rows[index]).imageUrl = imageData
            }

          }

        }

      }


      const resData = options.rows && options.rows.length > 0 ? options.rows : []
      return new ResponseData(true, "", resData)

    } catch (error: any) {

    
      throw new Error(error)
    }
  }

  static async getProductsByBranchId(data: any, company: any) {
    try {

      const companyId = company.id;
      const branchId = data.branchId ? data.branchId : null
      if (!branchId) { throw new ValidationException("branchId is required") }
      let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*'



      let count = 0
      const page = data.page ? data.page : 1;
      const limit = data.limit ? data.limit : 50;

      let offset = limit * (page - 1);


      const query: { text: string, values: any } = {
        text: `select count(*) over(),
                prod.id,	
                prod.name, 
                prod."barcode" as barcode, 
                COALESCE(BranchProducts.price,prod."defaultPrice") as price, 
                BranchProducts."onHand",
                BranchProducts."available" as "available"
                from "Products"	as prod
                inner join "BranchProducts" AS BranchProducts ON BranchProducts."productId" = prod.id
                where  BranchProducts."companyId" = $1 and "branchId" = $2
                and prod."isDeleted" = false
                and (LOWER (prod.name) ~ $3 OR LOWER (prod.barcode) ~ $3
                     OR LOWER ( (prod."translation" ->>'name')::jsonb->>'ar' ) ~ $3
                     OR LOWER ( (prod."translation" ->>'name')::jsonb->>'en' ) ~ $3
                    )
                order by prod.name
                

                limit ${limit}
                offset ${offset}
            `,
        values: [companyId, branchId, searchValue]
      }

      const products: any = await DB.excu.query(query.text, query.values);


      count = products.rows && products.rows.length > 0 ? Number((<any>products.rows[0]).count) : 0
      let pageCount = Math.ceil(count / limit)
      offset += 1
      let lastIndex = ((page) * limit)


      let resData = {
        records: products.rows,
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

  // public static async getProductAvailability(productId: string, companyId: string) {

  //   try {

  //     const query: { text: string, values: any } = {
  //       text: `SELECT 
  //                 "branch",
  //                 "branchId",
  //                  sum("onHand") as "onHand" 
  //             FROM "ProductsOnHands"
  //             WHERE "companyId"=$1
  //             AND "productId"=$2
  //             group by "ProductsOnHands".branch,    "branchId"`,
  //       values: [companyId, productId]
  //     }
  //     const branches = await DB.excu.query(query.text, query.values)

  //     return new ResponseData(true, "", branches.rows)


  //   } catch (error: any) {

  //   
  //   }
  // }





  static async getMenuSectionProducts(data: any, company: any) {
    try {

      const companyId = company.id;
      const branchId = data.branchId ? data.branchId : null;
      const menuSectionId = data.sectionId ? data.sectionId : null;

      const query: { text: string, values: any } = {
        text: `SELECT
          BranchProducts.available,
          BranchProducts.price,
          BranchProducts. "onHand",
          BranchProducts."priceBoundriesFrom",
          BranchProducts."priceBoundriesTo",
          BranchProducts."buyDownPrice",
          BranchProducts."buyDownQty",
          BranchProducts."priceByQty",
          BranchProducts."selectedPricingType",
          Products.id ,
          Products."companyId" ,
          Products."parentId",
          Products."childQty",
          Products.name,
          Products.barcode,
          Products."defaultPrice",
          Products.description,
          Products."mediaId",
          Products.translation,
          Products."categoryId",
          Products. "preparationTime",
          Products."orderByWeight",
          Products. "preparationTime",
          Products.type,
          Products."taxId",
          Products.tags,
          Products.warning,
          Products."defaultImage",
          Products."weightUnit",
          Products."weightUnitEnabled",
          Products."serviceTime",
          products.nutrition,
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
          Products."commissionPercentage",
          Products."commissionAmount",
          Products.color,
          Products."priceModel",
          products."maxItemPerTicket",
          "Media"."url",
          (select json_agg(json_build_object('batch', batch , 'unitCost', "unitCost", 'expireDate', "expireDate",'onHand',COALESCE("onHand",0))) AS batches from  "ProductBatches" as ProductBatches where BranchProducts.id = ProductBatches."branchProductId"),
          (select json_agg(json_build_object('serial', serial , 'status', "status")) AS serials from  "ProductSerials" as ProductSerials where BranchProducts.id = ProductSerials."branchProductId"),
          (select json_agg(json_build_object('barcode', barcode )) AS barcodes from  "ProductBarcodes" as ProductBarcodes where Products.id = ProductBarcodes."productId"),
          (select json_agg(json_build_object('employeeId', "employeeId" ,'price',price,'serviceTime',"serviceTime")) AS "employeePrices"   FROM "EmployeePrices" as EmployeePrices where Products.id = EmployeePrices."productId")
          FROM "Products" AS Products 
          inner join "BranchProducts" AS BranchProducts ON BranchProducts."productId" = Products.id 
          inner join "MenuSectionProduct" on  "MenuSectionProduct"."productId" =  Products.id 
              left join "Media" on "Media".id = Products."mediaId"
              where Products."companyId" = $1 and  BranchProducts."branchId" =$2  and "MenuSectionProduct"."menuSectionId" = $3
            `,
        values: [company, branchId, menuSectionId]
      }




      const products: any = await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", products.rows)
    } catch (error: any) {
    
      throw new Error(error.message)
    }
  }













}