/* eslint-disable prefer-const */

import { Product } from "@src/models/product/Product";
import { PoolClient } from "pg";
import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Helper } from "@src/utilts/helper";

import { BranchProductsRepo } from "./branchProduct.repo";
import { BranchProducts } from "@src/models/product/BranchProducts";
import { Company } from "@src/models/admin/company";
import { MenuRepo } from "./menu.repo";
import { ManualAdjusmentRepo } from "../accounts/manualAdjusment.Repo";
import { SerialProductRepo } from "./productTypes/serilizedProduct.repo";
import { BatchProductRepo } from "./productTypes/batchProduct.reps";
import { Brands } from "@src/models/product/brands";
import { ProductValidation } from "@src/validationSchema/product/product.Schema";
import { TaxesRepo } from "../accounts/taxes.repo";
import { ValidationException } from "@src/utilts/Exception";
import { Log } from "@src/models/log";
import { InventoryLocation } from "@src/models/product/InventoryLocation";
import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { ProductController } from "@src/controller/app/products/product.controller";
import { CategoryRepo } from "./category.repo";
import { DepartmentRepo } from "./department.repo";
import { Department } from "@src/models/product/Department";
import { Category } from "@src/models/product/Category";
import { RedisClient } from "@src/redisClient";
import { createObjectCsvWriter } from 'csv-writer';
import xlsx from 'xlsx';
import format from 'pg-format'
import { MenuItemProductRepo } from "./productTypes/menuItemProduct.repo";
import { TableConfig, TableDataService, TableRequest } from "@src/utilts/TableDataService";
import { CustomizationRepo } from "../settings/Customization.repo";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";

interface SearchByBarcodesInput {
  barcodes: string[];
  supplierId?: string | null;
  type?: string | null;

}

interface SearchByBarcodesRow {
  id: string;
  barcode: string;
  name: string;
  type: string;
  UOM: string | null;
  taxId: string | null;
  unitCost: number | null;
  supplierCode: string | null;
}

export class ProductRepo {
  public static async checkIfProductIdExist(client: PoolClient, productIds: [string], companyId: string) {
    const query: { text: string, values: any } = {
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
    let query: { text: string, values: any } = {
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
    query = {
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

  public static async updateBrandTranslation(data: any) {
    try {
      const query: { text: string } = {
        text: `UPDATE "Brands" SET  translation=$2 WHERE id=$1;`
      }

      data.list.forEach(async (element: { id: any; translation: any; }) => {
        await DB.excu.query(query.text, [element.id, element.translation]);
      });

      return new ResponseData(true, "nope", [])
    } catch (error: any) {

      console.log(error);
    
      throw new Error(error)
    }
  }
  public static async updateInventoryLocationsTranslation(data: any) {
    try {
      const query: { text: string } = {
        text: `UPDATE "inventorylocations" SET  translation=$2 WHERE id=$1;`
      }

      data.list.forEach(async (element: { id: any; translation: any; }) => {
        await DB.excu.query(query.text, [element.id, element.translation]);
      });

      return new ResponseData(true, "nope", [])
    } catch (error: any) {

      console.log(error);
    
      throw new Error(error)
    }
  }


  public static async getCompanyProductsIds(client: PoolClient, companyId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `Select id,type from "Products" where "companyId" = $1`,
        values: [companyId]
      }

      const products = await client.query(query.text, query.values);
      return new ResponseData(true, "", products.rows)
    } catch (error: any) {
    

      throw new Error(error)
    }
  }
  public static async checkIfProductNameExists(client: PoolClient, productId: string | null, name: string, companyId: string): Promise<boolean> {

    const query: { text: string, values: any } = {
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

    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }

    return false;

  }
  public static async checkIfProductsTypeValid(client: PoolClient, Ids: string[], types: string[], companyId: string) {

    try {
      Ids = [... new Set(Ids)]
      const query: { text: string, values: any } = {
        text: `SELECT count(*) as qty FROM public."Products" where id = ANY($1::uuid[]) and "companyId" = $2 and type = ANY($3) `,
        values: [
          Ids,
          companyId,
          types
        ],
      };

      const resault = await client.query(query.text, query.values);
      console.log((<any>resault.rows[0]).qty, Ids.length, Ids)
      if ((<any>resault.rows[0]).qty == Ids.length) {
        return true;
      }
      return false;
    } catch (error: any) {
    
      console.log(error)
      throw new Error(error)
    }
  }


  public static async getProductOnHandAndUnitCost(client: PoolClient, productId: string, branchId: string) {


    try {
      const query: { text: string, values: any } = {
        text: `SELECT BranchProducts."onHand" , Products. "unitCost",Products."parentId" ,COALESCE( BranchProducts."openingBalance",0) as "openingBalance"
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
        parentId: (<any>product.rows[0]).parentId,
        openingBalance: (<any>product.rows[0]).openingBalance
      }

      return data;
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async getProductUnitCost(client: PoolClient, productId: string | null) {
    try {
      const query: { text: string, values: any } = {
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
    const query: { text: string, values: any } = {
      text: `SELECT "onHand"  FROM "BranchProducts" where "productId"= ($1) AND "branchId"=$2`,
      values: [productId, branchId],
    };

    const onHand = await client.query(query.text, query.values);
    if (onHand.rowCount && onHand.rowCount > 0) {
      return (<any>onHand.rows[0]).onHand
    } else {
      return null;
    }
  }
  public static async getProductType(client: PoolClient, productId: string | null) {
    const query: { text: string, values: any } = {
      text: `SELECT type FROM "Products" where id= ($1)`,
      values: [productId],
    };

    const type = await client.query(query.text, query.values);
    if (type.rowCount && type.rowCount > 0) {
      return (<any>type.rows[0]).type
    } else {

      throw new ValidationException("Product Not Found")
    }

  }

  public static async getProductBranchData(client: PoolClient, productId: string, branchId: string) {
    try {


      const query: { text: string, values: any } = {
        text: `SELECT price,
                     "Products".name,
                     "Products".type,    
                       "Products".translation,

                     case when type = 'inventory' or  type = 'kit' then "BranchProducts"."onHand" else case when type ='batch' then sum("ProductBatches"."onHand") else count("ProductSerials"."serial") end end as "onHand" ,
                     "defaultPrice",
                     "Products"."serviceTime",
                     COALESCE("Products"."maxItemPerTicket",0) as "maxItemPerTicket",
                     CASE WHEN "Media".id is not null then   CONCAT(REPLACE("Media".url->>'defaultUrl', split_part("Media".url->>'defaultUrl', '/', -1), ''), 'Thumbnail_', split_part("Media".url->>'defaultUrl', '/', -1)) end as "mediaUrl",
                     "Taxes".id as "taxId",
                     "Taxes"."taxes",
                     "Taxes"."taxPercentage",
                     "Taxes"."taxType",
                     "BranchProducts"."price",
                     "Products"."weight",
                     "Products"."weightuom",
                         "Products"."priceModel",
                          "Products"."optionGroups" 
              from "Products"
              INNER JOIN "BranchProducts" on "Products".id = "BranchProducts"."productId" 
              LEFT JOIN "ProductSerials" on "ProductSerials"."branchProductId" = "BranchProducts".id and "status"='Available'
              LEFT JOIN "ProductBatches" on "ProductBatches"."branchProductId" = "BranchProducts".id 
              LEFT JOIN "Media" on "Media".id =  "Products"."mediaId"
              LEFT JOIN "Taxes" on "Products"."taxId" = "Taxes".id 
              WHERE "Products".id = $1 AND  "BranchProducts"."branchId" = $2
              group by  "Products".id ,"BranchProducts".id , "Taxes".id ,"Media".id
         `,
        values: [productId, branchId]
      }

      let prodDate = await client.query(query.text, query.values)
      if (prodDate.rowCount && prodDate.rowCount > 0) {
        return prodDate.rows[0]
      } else {
        throw new ValidationException("Product Not Found")
      }
    } catch (error: any) {
      console.log(error);
    

      throw new Error(error)
    }
  }


  public static async getProductEmployeeData(client: PoolClient, productId: string, employeeId: string, comapanyId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT "productId", 
                       price, 
                       "serviceTime"
               FROM "EmployeePrices"
               where "productId" = $1 and "employeeId"= $2  and "companyId"=$3
         `,
        values: [productId, employeeId, comapanyId]
      }

      let prodDate = await client.query(query.text, query.values)

      return prodDate.rows[0]

    } catch (error: any) {
      console.log(error);
    

      throw new Error(error)
    }
  }

  public static async getProductData(client: PoolClient, productId: string, companyId: string) {
    try {

      if (productId == null || productId == "") {
        throw new ValidationException('Product Id is Required')
      }
      const query: { text: string, values: any } = {
        text: `SELECT
                     "defaultPrice",
                     "Products".name,
                     "Products". translation,
                     "Products".weight,
                     "Products".weightuom,
                     "Products"."maxItemPerTicket",
                     CASE WHEN "Media".id is not null then   CONCAT(REPLACE("Media".url->>'defaultUrl', split_part("Media".url->>'defaultUrl', '/', -1), ''), 'Thumbnail_', split_part("Media".url->>'defaultUrl', '/', -1)) end as "mediaUrl",
                     "Taxes".id as "taxId",
                     "Taxes"."taxType",
                     "Taxes"."taxes",
                     "Taxes"."taxPercentage",
                            "Products"."priceModel",
                                 "Products"."optionGroups" 
              from "Products"
              LEFT JOIN "Media" on "Media".id =  "Products"."mediaId"
              LEFT JOIN "Taxes" on "Products"."taxId" = "Taxes".id 
              WHERE  "Products".id=$1 and  "Products"."companyId" = $2
         `,
        values: [productId, companyId]
      }

      let prodDate = await client.query(query.text, query.values)
      if (prodDate.rowCount && prodDate.rowCount > 0) {
        return prodDate.rows[0]
      } else {
        throw new ValidationException("Product Not Found")
      }
    } catch (error: any) {
    

      throw new Error(error)
    }
  }

  public static async getProductRecipe(productId: string) {
    try {
      const query = {
        text: `with "items" as (
              select el->>'inventoryId' as "inventoryId" , el->>'recipeId' as "recipeId" , (el->>'usages') as "usages" from "Products" , json_array_elements("recipes") el 
              where id  =$1
              ),"recipes" as (
              select  "Recipe".id ,"Recipe".name ,sum(( el->>'usage')::numeric *  "Products"."unitCost"::text::numeric )::float as "unitCost"  ,"items"."usages"::float as "recipeUsage"
		        	from "Recipe"  
              inner join "items" on "items"."recipeId"::uuid = "Recipe".id
			        inner join  jsonb_array_elements("Recipe"."items") el on true 
			  	    inner join "Products" on "Products".id = ( (el->> 'inventoryId')::uuid )
				  group by "Recipe".id,"items"."usages"
              ), "products" as (
              select "recipes".id  as "recipeId" ,  null::uuid as "inventoryId", "recipes".name , cast (sum("recipes"."unitCost") as real) as "unitCost" ,  cast (sum("recipes"."recipeUsage") as real) as "usages" from "recipes"
              group by  "recipes".id ,"recipes".name 
              union all 
              select null::uuid "recipeId" ,"Products".id  as "inventoryId", "Products".name , ("Products"."unitCost" ) as  "unitCost",cast ("items"."usages" as real) as "usages"  from "items" 
              inner join "Products" on "items"."inventoryId"::uuid =  "Products".id 
              where "inventoryId" is not null 
              ) 
             select * from  "products"`,
        values: [productId]
      }

      let recipe = await DB.excu.query(query.text, query.values);

      return recipe && recipe.rows.length > 0 ? recipe.rows : []
    } catch (error: any) {
      throw new Error(error)
    }
  }


  public static async getProductRecipe2(productId: string, branchId: string) {

    try {


      /** get default branch */


      const query = {
        text: `with "productRecipeBreak" as (
                  select el->>'inventoryId' as "inventoryId" , el->>'recipeId' as "recipeId" , (el->>'usages') as "usages" from "Products" , json_array_elements("recipes") el 
                                where id  =$1
                  ), "productRecipeInventory" as (

                  select distinct on ("Products"."id") "Products"."id" as "productId","Products".name, "cost" , "Products"."parentId", "Products"."UOM", "productRecipeBreak"."usages"  from "productRecipeBreak"
                    inner join "Products" on "Products".id = "productRecipeBreak"."inventoryId"::uuid 
                    left join "InventoryMovmentRecords" on "InventoryMovmentRecords"."productId" = "productRecipeBreak"."inventoryId"::uuid and "InventoryMovmentRecords"."branchId" =$2::uuid 	and "InventoryMovmentRecords".qty>=0
                    where "inventoryId" is not null

                    order by  "productId","InventoryMovmentRecords"."createdAt" Desc
                  ), "recipeItems" as  (
                    select  "Recipe".id ,"Recipe".name ,"Products"."parentId",((el->> 'inventoryId')::uuid ) "productId" , (( el->>'usage')::numeric) as "recipeUsage"  ,"productRecipeBreak"."usages"::float 
                                from "Recipe"  
                                      inner join "productRecipeBreak" on "productRecipeBreak"."recipeId"::uuid = "Recipe".id
                                inner join  jsonb_array_elements("Recipe"."items") el on true 
                                inner join "Products" on "Products".id = ( (el->> 'inventoryId')::uuid )
                        
                  ), "recipeItemCost" as (
                  select 
                        distinct on ("recipeItems"."productId") "recipeItems"."productId",
                      "recipeItems".id  as "recipeId",
                        "recipeItems".name, 
                      'recipe' as "type",
                      "parentId",
                  "latest"."cost"   ::float  as  "cost",
                  
                      "usages",
                     "recipeUsage"
                        from "recipeItems"
                     LEFT JOIN LATERAL (
                        SELECT imr."cost"
                        FROM "InventoryMovmentRecords" imr
                    
                          WHERE imr."productId" = "recipeItems"."productId"
                          AND imr."branchId" = $2
                          AND imr."qty" >= 0
                        ORDER BY imr."createdAt" DESC
                        LIMIT 1
                    ) latest ON TRUE

                  )
                  select 
                      "productRecipeInventory"."productId",
                      null::uuid as "recipeId",
                      "productRecipeInventory".name,
                      'inventory' as "type",
                      "parentId",
                      "productRecipeInventory"."cost" as  "cost" ,
                      "usages"::float,
                      null::float as "recipeUsage",
                      "UOM"
                  from "productRecipeInventory"
                  union all 
                  select * ,
                  null as "UOM"
                  from "recipeItemCost"`,
        values: [productId, branchId]
      }

      let recipe = await DB.excu.query(query.text, query.values);

      let recipeList = recipe && recipe.rows.length > 0 ? recipe.rows : []
      const inventorys = recipeList.filter((f: any) => f.recipeId == null)
      const recipes: any[] = recipeList.filter((f: any) => f.recipeId != null)
      console.log(inventorys)
      const lists: any = []
      for (let index = 0; index < inventorys.length; index++) {
        const element: any = recipeList[index];
        let tempElement = {
          inventoryId: element.productId,
          name: element.name,
          recipeId: null,
          unitCost: element.cost,
          usages: element.usages,
          UOM: element.UOM
        }

        if (tempElement.unitCost != null) {
          lists.push(tempElement)
        } else {
          if (element.parentId == null) {
            tempElement.unitCost = 0
            lists.push(tempElement)
          } else {
            let data = await BranchProductsRepo.getChildParentCost(element.productId, branchId)
            console.log(data)
            tempElement.unitCost = data
            lists.push(tempElement)
          }
          /** parent cost  */

        }
      }

      const groupedList = recipes.reduce((acc, item) => {
        // Check if the productId already exists in the accumulator object
        if (!acc[item.recipeId]) {
          acc[item.recipeId] = { recipeId: item.recipeId, usages: item.usages, name: item.name, items: [] };
        }

        // Push the current item into the options array of the corresponding productId
        acc[item.recipeId].items.push({
          productId: item.productId,
          parentId: item.parentId,
          unitCost: item.cost,
          usages: item.usages,
          recipeUsage: item.recipeUsage,

        });

        return acc;
      }, {});
      let groupedData: any[] = [];
      for (let key in groupedList) {
        groupedData.push(groupedList[key]);
      }
      for (let index = 0; index < groupedData.length; index++) {
        const element = groupedData[index];
        let cost = 0;
        for (let index = 0; index < element.items.length; index++) {
          const item = element.items[index];
          console.log(item)

          if (item.unitCost != null) {
            cost += item.unitCost * item.recipeUsage
          } else {
            if (item.parentId != null) {
              /** parent cost */
              let data = await BranchProductsRepo.getChildParentCost(item.productId, branchId)
              console.log(data)
              cost += data * item.recipeUsage
            }
          }
        }
        let tempElement = {
          inventoryId: null,
          name: element.name,
          recipeId: element.recipeId,
          unitCost: cost,
          usages: element.usages,
          UOM: null
        }
        lists.push(tempElement)
      }



      return lists
    } catch (error: any) {
      console.log(error)

      throw new Error(error)
    }
  }





  public static async getBranchesUnitCost(branchIds: any[], productId: string) {
    try {
      const query = {
        text: `			
				
				with "costs" as (
				
				 select 
					          DISTINCT ON ("branchId") "branchId",
					      "InventoryMovmentRecords"."cost" as "unitCost"
            
                           from "InventoryMovmentRecords"  
                where "productId" = $1
               
				and "qty" >= 0 
					ORDER BY "branchId","createdAt" DESC 
					
				)
				
				SELECT * FROM "costs"
                         `,
        values: [productId]
      }

      let unitCosts = await DB.excu.query(query.text, query.values);

      return unitCosts.rows
    } catch (error: any) {
      throw new Error(error)
    }
  }



  public static async getProduct(productId: string, company: Company) {
    try {
      const companyId = company.id;
      // const query : { text: string, values: any } = {

      //   text: `SELECT
      //   Products.id ,
      //   Products."companyId",
      //   Products."parentId",
      //   Products."childQty",
      //   Products.name,
      //   Products."isDiscountable",
      //   Products."orderByWeight",
      //   Products. "preparationTime",
      //   Products.barcode,
      //   Products."defaultPrice",
      //   Products.description,
      //   Products.translation,
      //   Products."categoryId",
      //   Products."priceModel",
      //   Products.type,
      //   Products.taxes,
      //   Products.tags,
      //   Products.warning,
      //   Products."defaultImage",
      //   Products."weightUnit",
      //   Products."weightUnitEnabled",
      //   Products."serviceTime",
      //   Products."UOM",
      //   Products."unitCost",
      //   Products."kitBuilder",
      //   Products."package",
      //   Products.selection,
      //   Products."optionGroups",
      //   Products."quickOptions",
      //   Products.recipes,
      //   products.nutrition,
      //   Products."mediaId",
      //   Products."productMatrixId",
      //   Products."productMedia",
      //   Products."commissionPercentage",
      //   Products."commissionAmount",
      //   Products."productAttributes",
      //   Products."taxId",
      //   Products."brandid",
      //   Products.translation,
      //   Products."sku",
      //   Products."kitchenName",
      //   Products."alternativeProducts",
      //   Products."comparePriceAt",
      //   Products."customFields",
      //   Products."reorderPoint",
      //   Products."reorderLevel",
      //   Products."productDeduction",
      //   (select 
      //     json_agg(jsonb_build_object('id', "altProducts".id,'name',"altProducts".name))
      //      FROM jsonb_array_elements_text("alternativeProducts") AS elem
      //                                             INNER JOIN "Products" "altProducts" ON "altProducts".id = elem::uuid
      //     ) as "alternativeProductsTemp", 
      //   Products."maxItemPerTicket",
      //  (SELECT "Categories"."departmentId" as "departmentId" from "Categories" WHERE "Categories".id =  Products."categoryId"),
      //   (SELECT "Media".url as "mediaUrl" from "Media" WHERE "Media".id =  Products."mediaId"),
      //   (SELECT json_agg(json_build_object('barcode', barcode )) AS barcodes from  "ProductBarcodes" WHERE "ProductBarcodes"."productId"= Products.id ),
      //   (SELECT json_agg(json_build_object('id',id,'employeeId', "employeeId" ,'price',price,'serviceTime',"serviceTime")) AS "employeePrices"   FROM "EmployeePrices"  WHERE "EmployeePrices"."productId"= Products.id  ),
      //   (SELECT json_agg(json_build_object('id',"SupplierItems".id,'supplierId', "Suppliers".id ,'cost',"SupplierItems".cost,'minimumOrder',"SupplierItems"."minimumOrder",'supplierCode',"SupplierItems"."supplierCode",'supplierName',"Suppliers".name)) AS "suppliers"   FROM "SupplierItems" INNER JOIN "Suppliers" ON "Suppliers".id = "SupplierItems"."supplierId" WHERE "SupplierItems"."productId"= Products.id  )

      //   FROM "Products" AS Products
      //  WHERE Products.id =$1
      //   AND Products."companyId" = $2

      //   `,
      //   values: [productId, companyId]
      // }

      const query: { text: string, values: any } = {
        text: `with "product" as (
          SELECT
                  Products.id ,
                      Products."threeDModelId",
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
                  Products."measurements",
                  Products.tags,
                  Products.warning,
                  Products."defaultImage",
                 Products."weight",
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
                  Products."maxItemPerTicket",
                  Products."taxId",
                  Products."brandid",
                  Products."sku",
                  Products."kitchenName",
                  Products."alternativeProducts",
                  Products."comparePriceAt",
                  Products."customFields",
                  Products."reorderPoint",
                  Products."reorderLevel",
                  Products."productDeduction",
                  Products."isSaleItem",
                  Products."isPurchaseItem",
                  Products."saleAccountId",
                  Products."purchaseAccountId",
                  Products."defaultOptions",
                  Products."isTaxable",
                  Products."tabBuilder"
                FROM "Products" AS Products
                 WHERE Products.id =$1
               and Products."companyId" =$2
        
          ), "alternativeProducts" as (
          select
                   "product".id,
                 json_agg(jsonb_build_object('id', "altProducts".id,'name',"altProducts".name)) as "alternativeProducts"
          from "product" , jsonb_array_elements_text("alternativeProducts") AS elem
          INNER JOIN "Products" "altProducts" ON "altProducts".id = elem::uuid

          group by  "product".id
          ), "department" as (
          select
                   "product".id,
                 "Categories"."departmentId"
          from "product" 
          INNER JOIN "Categories" on "Categories".id = "product" ."categoryId" 
          ) , "media" as (
          select
                   "product".id,
                 "Media".url as "mediaUrl"
          from "product" 
          INNER JOIN "Media" on "Media".id = "product" ."mediaId" 
          )  , "barcode" as (
          select
                   "product".id,
                 json_agg(json_build_object('barcode',"ProductBarcodes".barcode )) as barcodes
          from "product" 
          INNER JOIN "ProductBarcodes" on "ProductBarcodes"."productId" = "product" .id 
          group by  "product".id
          )   , "employeePrices" as (
          select
                   "product".id,
               json_agg(json_build_object('name',"Employees"."name",'id', "EmployeePrices".id,'employeeId', "employeeId" ,'price',price,'serviceTime', "EmployeePrices"."serviceTime")) AS "employeePrices"
          from "product" 
          INNER JOIN "EmployeePrices" on "EmployeePrices"."productId" = "product" .id 
          inner join "Employees" on "Employees".id = "employeeId"
          group by  "product".id
          ) 
            , "supplierItem" as (
          select
                   "product".id,
          json_agg(json_build_object('id',"SupplierItems".id,'supplierId', "Suppliers".id ,'cost',"SupplierItems".cost,'minimumOrder',"SupplierItems"."minimumOrder",'supplierCode',"SupplierItems"."supplierCode",'supplierName',"Suppliers".name)) AS "suppliers" 
          from "product" 
          INNER JOIN "SupplierItems" on "SupplierItems"."productId" = "product" .id 
          INNER JOIN "Suppliers" ON "Suppliers".id = "SupplierItems"."supplierId"
          group by  "product".id
          ), "optionGroup" as (
          select
                   "product".id,
                 json_agg(jsonb_build_object('index', ("elem"->>'index')::int,'optionGroupId',"OptionGroups".id,'title',"OptionGroups".title)) as "optionGroups"
          from "product" , json_array_elements("optionGroups") AS elem
          INNER JOIN "OptionGroups"  ON "OptionGroups".id = (elem->>'optionGroupId')::uuid
          group by  "product".id
          ), "quickOption" as (
          select
                   "product".id,
                 json_agg(jsonb_build_object('id', "Options".id,'name',"Options".name)) as "quickOptions"
          from "product" , json_array_elements_text("quickOptions") AS elem
          INNER JOIN "Options" ON "Options".id = elem::uuid
          where ("Options"."isDeleted" = false or"Options"."isDeleted" is null )
          group by  "product".id
          ), "defaultOptions" as (
          select
                   "product".id,
                 json_agg(jsonb_build_object('optionId', "Options".id,'name',"Options".name,'qty',(elem->>'qty')::float,'index',(elem->>'index')::int)) as "defaultOptions"
          from "product" , jsonb_array_elements("defaultOptions") AS elem
          INNER JOIN "Options" ON "Options".id = (elem->>'optionId')::uuid
          where ("Options"."isDeleted" = false or"Options"."isDeleted" is null )
          group by  "product".id
          ),"medias" as
            (
            select
            
            "product".id,
                   json_agg(jsonb_build_object('id', "Media".id,'defaultUrl',"Media"."url"->>'defaultUrl')          order by "elem"."index") as "productMedia"

            from "product" , json_array_elements_text("productMedia") WITH ORDINALITY AS elem(value, index)
            inner join "Media" on "Media".id  =elem.value::uuid

                  group by  "product".id
            ), "3dModel" as(
            select "product".id, JSONB_BUILD_OBJECT('id', "Media".id , 'name',  "Media"."name",'defaultUrl',"Media"."url"->>'downloadUrl') as "threeDModel"   from "product"
            inner join "Media" on "Media".id = "product"."threeDModelId"
            
            )
          
          select     "product".id ,
                     "product"."companyId",
                     "product"."parentId",
                     "product"."childQty",
                     "product".name,
                     "product"."isDiscountable",
                     "product"."orderByWeight",
                     "product". "preparationTime",
                     "product".barcode,
                     "product"."defaultPrice",
                     "product".description,
                     "product"."translation",
                     "product"."categoryId",
                     "product"."priceModel",
                     "product".type,
                     "product".taxes,
                     "product".tags,
                     "product".warning,
                     "product"."defaultImage",
                     "product"."weight",
                     "product"."weightUnit",
                     "product"."weightUnitEnabled",
                     "product"."serviceTime",
                     "product"."saleAccountId",
                    "product"."purchaseAccountId",
                     "product"."UOM",
                     "product"."unitCost",
                     "product"."package",
                     "product".selection,
                     "product".recipes,
                     "product".nutrition,
                     "product"."mediaId",
                     "product"."productMatrixId",
                     "medias"."productMedia",
                     "product"."commissionPercentage",
                     "product"."commissionAmount",
                     "product"."productAttributes",
                     "product"."taxId",
                     "product"."brandid",
                     "product"."sku",
                     "product"."kitchenName",
                     "product"."alternativeProducts",
                                  "product"."maxItemPerTicket",
                     "product"."comparePriceAt",
                     "product"."customFields",
                     "product"."reorderPoint",
                     "product"."reorderLevel",
                     "product"."productDeduction",
                     "product"."isTaxable",
                     "product"."isSaleItem",
                     "product"."isPurchaseItem",
                     "product"."tabBuilder",
                               "product"."measurements",
                   "alternativeProducts". "alternativeProducts" as  "alternativeProductsTemp",
               "department"."departmentId",
               "media"."mediaUrl",
               "barcode"."barcodes",
               "employeePrices"."employeePrices",
               "supplierItem"."suppliers",
               "optionGroup"."optionGroups",
               "defaultOptions"."defaultOptions",
               "quickOption"."quickOptions",
                "product"."threeDModelId",
               "3dModel"."threeDModel"
          from "product"
          left join "alternativeProducts" on "alternativeProducts".id = "product".id
          left join "department" on "department".id = "product".id
          left join "media" on "media".id = "product".id
          left join "barcode" on "barcode".id = "product".id
          left join "employeePrices" on "employeePrices".id = "product".id
          left join "medias" on "medias".id = "product".id
          left join "supplierItem" on "supplierItem".id = "product".id
          left join "optionGroup" on "optionGroup".id = "product".id
          left join "quickOption" on "quickOption".id = "product".id
          left join "defaultOptions" on "defaultOptions".id = "product".id
          left join "3dModel" on "3dModel".id = "product".id  
          `,
        values: [productId, companyId]
      }
      const productData = await DB.excu.query(query.text, query.values);


      const product: any = Helper.trim_nulls(productData.rows[0])
      if (product != null) {


        const branchProduct = {
          text: `SELECT "BranchProducts".id,
        "branchId",
        "productId",
        available ,
        price,
        COALESCE("onHand",0) as "onHand",
 
        "priceBoundriesFrom",
        "priceBoundriesTo",
        "buyDownPrice",
        "buyDownQty",
        "priceByQty",
        "availableOnline",
        "locationId",
        "availableOnline",
        COALESCE("openingBalance",0) as "openingBalance",
        COALESCE("openingBalanceCost",0)as "openingBalanceCost",
        "selectedPricingType",
        "reorderLevel",
        "reorderPoint",
        'serials',(SELECT json_agg(json_build_object('id',"ProductSerials".id,'serial', serial , 'status', "status",'unitCost',"unitCost", 'invoiceId',(select "Invoices".id FROM "Invoices" INNER JOIN "InvoiceLines" ON "InvoiceLines"."invoiceId" = "Invoices".id AND "InvoiceLines".serial = "ProductSerials".serial INNER JOIN "CreditNoteLines" ON "CreditNoteLines"."invoiceLineId" = "InvoiceLines".id AND "CreditNoteLines".serial = "InvoiceLines".serial AND "CreditNoteLines".id ISNULL ))) from "ProductSerials" WHERE   "BranchProducts".id = "ProductSerials"."branchProductId") AS serials,
        'batches',(SELECT json_agg(json_build_object('id',"ProductBatches".id,'batch', batch , 'unitCost', "unitCost", 'expireDate', "expireDate"::date,'prodDate',"prodDate",'onHand',  "onHand")) AS batches from "ProductBatches"  WHERE   "BranchProducts".id = "ProductBatches"."branchProductId" ) AS batches
        FROM  "BranchProducts"
    inner join "Branches" on "BranchProducts"."branchId" = "Branches".id 
    WHERE "BranchProducts"."productId"=$1
    order  by "Branches".index asc  `,
          values: [productId]

        }
        const brachesData = await DB.excu.query(branchProduct.text, branchProduct.values)

        let branchData = await BranchesRepo.getMainBranch(null, companyId)
        let branchId = branchData.branch.id
        let recipe = await this.getProductRecipe2(productId, branchId);

        product.recipes = recipe

        if (brachesData && brachesData.rows && brachesData.rows.length > 0) {
          let branchesIds = brachesData.rows.map((f: any) => { return f.branchId });
          const unitCosts: any = await this.getBranchesUnitCost(branchesIds, productId);
          console.log(unitCosts)
          if (unitCosts && unitCosts.length > 0) {
            const firstUnitCost = unitCosts[0].unitCost;
            const allSame = unitCosts.every((branch: any) => branch.unitCost === firstUnitCost);
            product.unitCost = allSame && branchesIds.length == unitCosts.length ? firstUnitCost : 0
            product.branchesUnitCost = (!allSame) || branchesIds.length != unitCosts.length ? unitCosts : null;
            if ((!allSame || branchesIds.length != unitCosts.length) && (unitCosts && unitCosts.length > 0)) {
              brachesData.rows = brachesData.rows.map((branch: any) => {
                let unitCost = unitCosts.find((f: any) => branch.branchId == f.branchId)
                if (unitCost) {
                  branch.unitCost = unitCost.unitCost
                } else {
                  branch.unitCost = 0
                }
                return branch
              })
            }
          }
        }
        product.branchProduct = brachesData.rows

        if (product.type === 'kit') {
          product.kitBuilder = await this.getProductKitBuilder(productId, branchId);
        }
      }
      // if (product.quickOptions) {
      //   for (let index = 0; index < product.quickOptions.length; index++) {
      //     const element = product.quickOptions[index];
      //     product.quickOptions[index] = { id: element }
      //   }
      // }
      return new ResponseData(true, "", product);

    } catch (error: any) {
      console.log(error)
    
      throw new Error(error)
    }
  }


  public static async getProductByBarcode(branchId: string, barcode: string, company: Company) {
    try {
      const companyId = company.id;
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
        Products."brandid",
        Products.translation,
        Products."sku",
        Products."kitchenName",
        Products."alternativeProducts",
        (select 
          json_agg(jsonb_build_object('id', "altProducts".id,'name',"altProducts".name))
           FROM jsonb_array_elements_text("alternativeProducts") AS elem
                                                  INNER JOIN "Products" "altProducts" ON "altProducts".id = elem::uuid
          ) as "alternativeProductsTemp", 
        Products."maxItemPerTicket",
	    	(SELECT "Categories"."departmentId" as "departmentId" from "Categories" WHERE "Categories".id =  Products."categoryId"),
        (SELECT "Media".url as "mediaUrl" from "Media" WHERE "Media".id =  Products."mediaId"),
        (SELECT json_agg(json_build_object('id',id,'employeeId', "employeeId" ,'price',price,'serviceTime',"serviceTime")) AS "employeePrices"   FROM "EmployeePrices"  WHERE "EmployeePrices"."productId"= Products.id  ),
        (SELECT json_agg(json_build_object('id',"SupplierItems".id,'supplierId', "Suppliers".id ,'cost',"SupplierItems".cost,'minimumOrder',"SupplierItems"."minimumOrder",'supplierCode',"SupplierItems"."supplierCode",'supplierName',"Suppliers".name)) AS "suppliers"   FROM "SupplierItems" INNER JOIN "Suppliers" ON "Suppliers".id = "SupplierItems"."supplierId" WHERE "SupplierItems"."productId"= Products.id  )
       
        FROM "Products" AS Products
        LEFT JOIN "ProductBarcodes" on "ProductBarcodes"."productId"  = Products.id
	    	WHERE Products."companyId" = $2
        AND  ( Products."barcode"=$1 or"ProductBarcodes".barcode=$1 )
  
        `,
        values: [barcode, companyId]
      }
      const productData = await DB.excu.query(query.text, query.values);


      if (productData.rows && productData.rows.length) {
        const product: any = Helper.trim_nulls(productData.rows[0])
        const productId = product.id;
        const branchProduct = {
          text: `SELECT "BranchProducts".id,
          "branchId",
          "productId",
          available ,
          price,
          COALESCE("onHand",0) as "onHand",
          "priceBoundriesFrom",
          "priceBoundriesTo",
          "buyDownPrice",
          "buyDownQty",
          "priceByQty",
          "availableOnline",
          "selectedPricingType",
          "openingBalance",
          "openingBalanceCost",
          "selectedPricingType",
          'serials',(SELECT json_agg(json_build_object('id',"ProductSerials".id,'serial', serial , 'status', "status",'unitCost',"unitCost", 'invoiceId',(select "Invoices".id FROM "Invoices" INNER JOIN "InvoiceLines" ON "InvoiceLines"."invoiceId" = "Invoices".id AND "InvoiceLines".serial = "ProductSerials".serial INNER JOIN "CreditNoteLines" ON "CreditNoteLines"."invoiceLineId" = "InvoiceLines".id AND "CreditNoteLines".serial = "InvoiceLines".serial AND "CreditNoteLines".id ISNULL ))) from "ProductSerials" WHERE   "BranchProducts".id = "ProductSerials"."branchProductId") AS serials,
          'batches',(SELECT json_agg(json_build_object('id',"ProductBatches".id,'batch', batch , 'unitCost', "unitCost", 'expireDate', "expireDate"::date,'prodDate',"prodDate",'onHand',  "onHand")) AS batches from "ProductBatches"  WHERE   "BranchProducts".id = "ProductBatches"."branchProductId" ) AS batches
          FROM  "BranchProducts"
      inner join "Branches" on "BranchProducts"."branchId" = "Branches".id 
      WHERE "BranchProducts"."productId"=$1
      AND "BranchProducts"."branchId"=$2
      order  by "Branches".index asc  `,
          values: [productId, branchId]

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
      }
      return new ResponseData(true, "", []);

    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async getBarcodesProducts(data: any, company: Company) {
    try {

      const companyId = company.id;

      const branchId = data.branchId;
      const barcodes = data.barcodes
      const query: { text: string, values: any } = {
        text: `SELECT
      distinct on(Products.id) Products.id ,
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
        Products."brandid",
        Products.translation,
        Products."sku",
        Products."kitchenName",
        Products."alternativeProducts",
        (select 
          json_agg(jsonb_build_object('id', "altProducts".id,'name',"altProducts".name))
           FROM jsonb_array_elements_text("alternativeProducts") AS elem
                                                  INNER JOIN "Products" "altProducts" ON "altProducts".id = elem::uuid
          ) as "alternativeProductsTemp", 
        Products."maxItemPerTicket",
	    	(SELECT "Categories"."name" as "categoryName" from "Categories" WHERE "Categories".id =  Products."categoryId"),
        (SELECT "Media".url as "mediaUrl" from "Media" WHERE "Media".id =  Products."mediaId"),
        (SELECT json_agg(json_build_object('id',id,'employeeId', "employeeId" ,'price',price,'serviceTime',"serviceTime")) AS "employeePrices"   FROM "EmployeePrices"  WHERE "EmployeePrices"."productId"= Products.id  ),
        (SELECT json_agg(json_build_object('id',"SupplierItems".id,'supplierId', "Suppliers".id ,'cost',"SupplierItems".cost,'minimumOrder',"SupplierItems"."minimumOrder",'supplierCode',"SupplierItems"."supplierCode",'supplierName',"Suppliers".name)) AS "suppliers"   FROM "SupplierItems" INNER JOIN "Suppliers" ON "Suppliers".id = "SupplierItems"."supplierId" WHERE "SupplierItems"."productId"= Products.id  )
       
        FROM "Products" AS Products
        LEFT JOIN "ProductBarcodes" on "ProductBarcodes"."productId"  = Products.id
	    	WHERE Products."companyId" = $2
        AND  ( Products."barcode"= any($1) or"ProductBarcodes".barcode=any($1) )
           ORDER BY  Products.id  ,array_position($1, Products.barcode)
        `,
        values: [barcodes, companyId]
      }
      const productData = await DB.excu.query(query.text, query.values);


      const productIds: any[] = []
      let productList: any[] = [];
      if (productData.rows && productData.rows.length > 0) {
        productData.rows.forEach((element: any) => {
          productIds.push(element.id)
        });
        productList = productData.rows
        if (data.branchId) {
          const branchProduct = {
            text: `SELECT "BranchProducts".id,
            "branchId",
            "productId",
            available ,
            price,
            COALESCE("onHand",0) as "onHand",
            "priceBoundriesFrom",
            "priceBoundriesTo",
            "buyDownPrice",
            "buyDownQty",
            "priceByQty",
            "availableOnline",
            "selectedPricingType",
            "openingBalance",
            "openingBalanceCost",
            "selectedPricingType",
            'serials',(SELECT json_agg(json_build_object('id',"ProductSerials".id,'serial', serial , 'status', "status",'unitCost',"unitCost", 'invoiceId',(select "Invoices".id FROM "Invoices" INNER JOIN "InvoiceLines" ON "InvoiceLines"."invoiceId" = "Invoices".id AND "InvoiceLines".serial = "ProductSerials".serial INNER JOIN "CreditNoteLines" ON "CreditNoteLines"."invoiceLineId" = "InvoiceLines".id AND "CreditNoteLines".serial = "InvoiceLines".serial AND "CreditNoteLines".id ISNULL ))) from "ProductSerials" WHERE   "BranchProducts".id = "ProductSerials"."branchProductId") AS serials,
            'batches',(SELECT json_agg(json_build_object('id',"ProductBatches".id,'batch', batch , 'unitCost', "unitCost", 'expireDate', "expireDate"::date,'prodDate',"prodDate",'onHand',  "onHand")) AS batches from "ProductBatches"  WHERE   "BranchProducts".id = "ProductBatches"."branchProductId" ) AS batches
            FROM  "BranchProducts"
        inner join "Branches" on "BranchProducts"."branchId" = "Branches".id 
        WHERE "BranchProducts"."productId"=any($1)
        AND ($2::uuid is null or "BranchProducts"."branchId"=$2)
        order  by "Branches".index asc  `,
            values: [productIds, branchId]

          }
          const brachesData = await DB.excu.query(branchProduct.text, branchProduct.values)


          if (productIds && data.branchId != null && data.branchId != "") {
            const combined: any = productData.rows.map((item1: any) => {
              const item2: any = brachesData.rows.filter((item2: any) => item2.productId === item1.id);
              if (item1.quickOptions) {
                for (let index = 0; index < item1.quickOptions.length; index++) {
                  const element = item1.quickOptions[index];
                  item1.quickOptions[index] = { id: element }
                }
              }
              if (item2) {

                item1.branchProduct = item2

                return item1
              } else {
                return item1
              }

            }).filter(item => item !== null);
            productList = combined
          }
        }


        return new ResponseData(true, "", productList);
      }
      return new ResponseData(true, "", []);

    } catch (error: any) {
    
      throw new Error(error)
    }
  }

  //for PO and bill import products , retrieve minimum data
  public static async searchByBarcodes(
    data: SearchByBarcodesInput,
    company: Company
  ): Promise<SearchByBarcodesRow[]> {
    try {
      const companyId: string = company.id;
      const supplierId: string | null = data.supplierId ?? null;
      const barcodes: string[] = data.barcodes;
      const type = data.type;
        const types = type && type == 'invoice' ? null : ['inventory', 'batch', 'serialized']
      if (!barcodes || barcodes.length === 0) return [];

      const query = {
        text: `
          WITH matched AS (
              SELECT
                p.id,
                COALESCE(pb.barcode, p.barcode)                               AS barcode,
                p.name,
                p.type,
                p."UOM",
                p."taxId",
                COALESCE(si.cost, p."unitCost")                               AS "unitCost",
                si."supplierCode",
                array_position($1::text[], COALESCE(pb.barcode, p.barcode))   AS ord
              FROM "Products" p
              LEFT JOIN "ProductBarcodes" pb
                ON pb."productId" = p.id
              AND pb.barcode = ANY($1::text[])           -- filter in JOIN to keep LEFT join semantics
              LEFT JOIN "SupplierItems" si
                ON si."productId" = p.id
              AND ($3::uuid IS NULL OR si."supplierId" = $3)
              WHERE  p."companyId" = $2
              AND ($4::text[] is null or p.type = ANY($4))
              AND p."isDeleted"=false
              AND (p."isPurchaseItem" = true or  p."isPurchaseItem" is null) 
              AND ( 
                p.barcode = ANY($1::text[])           -- match primary barcode
                OR pb.barcode IS NOT NULL                -- or any matched alt barcode
              )
            )
            SELECT DISTINCT ON (id)
              id, barcode, name, type, "UOM", "taxId", "unitCost", "supplierCode"
            FROM matched
            WHERE ord IS NOT NULL
            ORDER BY id, ord;                              -- keeps first occurrence by input order
        `,
        values: [barcodes, companyId, supplierId, types],
      };

      const productData = await DB.excu.query(query.text, query.values);
      return productData.rows;
    } catch (error) {
      console.error("searchByBarcodes error:", error);
      return [];
    }
  }

  public static async getCategoryProducts(productId: string, company: Company) {
    try {
      const companyId = company.id;
      const query: { text: string, values: any } = {
        text: `SELECT
        Products.id ,
        Products.name,
        Products.translation
        FROM "Products" AS Products
	    	WHERE "categoryId" =$1
        AND Products."companyId" = $2
        AND Products."isDeleted" = false 
        order by Products."categoryIndex" asc
        `,
        values: [productId, companyId]
      }
      const productData = await DB.excu.query(query.text, query.values);



      return new ResponseData(true, "", productData.rows);

    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async oldlistProductFilter(data: any, company: Company): Promise<ResponseData> {
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
      let page = data.page ?? 1;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (data.page != 1) {
        offset = (limit * (data.page - 1))
      }
      let types = ["inventory", "batch", "serialized", "service", "menuSelection", "menuItem", "package", "kit", "tailoring"]

      const selectText = `SELECT  
                                  
                                  id,
                                  name,
                                  "categoryId",
                                  barcode,
                                  "defaultPrice",
                                  type,
                                  "UOM",
                                  "translation",
                                    case when type::text = 'inventory'::text  or  type::text = 'kit'::text    then
                                    (select json_build_object('qtySum',sum ( "BranchProducts"."onHand") ,'stockValue',sum ( "BranchProducts"."onHand") *  "Products"."unitCost"  )
                                            from "BranchProducts"   where "BranchProducts"."productId" = "Products".id  )
                                    else case when type::text = 'batch'::text then 
                                    (select 
                                    json_build_object('qtySum',sum ( "ProductBatches"."onHand") ,'stockValue',sum ( "ProductBatches"."onHand" *  "ProductBatches"."unitCost" )  )
                                              from "BranchProducts" 
                                              inner join "ProductBatches" on "BranchProducts".id ="ProductBatches"."branchProductId"
                                                inner join "Branches" on "BranchProducts"."branchId" = "Branches".id
                                                where "BranchProducts"."productId" = "Products".id 
                                              and"Branches"."companyId" = "Products"."companyId"
                                          
                                    )
                                    else case when type::text ='serialized'::text then 
                                    (select json_build_object('qtySum',count( "ProductSerials".id),'stockValue',sum("ProductSerials"."unitCost") )
                                              from "BranchProducts" 
                                              inner join "ProductSerials" on "BranchProducts".id ="ProductSerials"."branchProductId"
                                                inner join "Branches" on "BranchProducts"."branchId" = "Branches".id
                                                where "BranchProducts"."productId" = "Products".id 
                                              and"Branches"."companyId" = "Products"."companyId"
                                              and "ProductSerials".status = 'Available'
                                    ) 
                                    end 
                                    end 
                                    end as "inventorySummary"
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

      /**TODO REMOVE THIS FROM HERE MAKE AS INDIVADUAL ROUTE */
      // for (let index = 0; index < selectList.rows.length; index++) {
      //   const element = selectList.rows[index];
      //   if (element.type == "batch" || element.type == "serialized" || element.type == "inventory" || element.type == "kit") {
      //     const branchSummary = await this.getProductAvailability(element.id, companyId);
      //     if (branchSummary?.data) {
      //       selectList.rows[index].branchSummary = branchSummary.data
      //     }
      //   }
      // }

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

    
      throw new Error(error)
    }
  }

  
  public static async listProductFilter(data: any, company: Company): Promise<ResponseData> {
    try {
      const companyId = company.id;

      let searchValue = data.searchTerm ? `%` + data.searchTerm.toLowerCase().trim() + `%` : null;
      const filter = data.filter;

      let types = ["inventory", "batch", "serialized", "service", "menuSelection", "menuItem", "package", "kit", "matrix", "tailoring"];

      if (data.filter && data.filter.type && data.filter.type.length > 0) {
        types = data.filter.type;
      }

      let productMatrixQuery = types.includes('matrix')
        ? ` or  "Products"."productMatrixId" is not null `
        : `and "Products"."productMatrixId" is null `;

      let sort = data.sortBy;
      let sortValue = !sort ? '"createdAt"' : '"' + sort.sortValue + '"';
      let sortDirection = !sort ? "DESC" : sort.sortDirection;
      let sortTerm = sortValue + " " + sortDirection;
      let orderByQuery = ` Order by ` + sortTerm;

      let page = data.page ?? 1;
      let offset = 0;
      const limit = (data.limit == null) ? 15 : data.limit;
      if (page != 1) {
        offset = (limit * (page - 1));
      }

      const categories = filter && filter.categories ? filter.categories : [];
      const departments = filter && filter.departments ? filter.departments : [];

      // NEW: tags filter (text[] column: {tag1,tag2})
      const tags: string[] | null =
        filter && filter.tags && filter.tags.length > 0 ? filter.tags : null;

      const query: { text: string; values: any } = {
        text: `
        WITH "parentIds" AS (
          SELECT DISTINCT "parentId"
          FROM "Products"
          LEFT JOIN "Categories"  ON "Categories".id  = "Products"."categoryId"
          LEFT JOIN "Departments" ON "Departments".id = "Categories"."departmentId"
          LEFT JOIN "ProductBarcodes" ON "Products".id = "ProductBarcodes"."productId"
          WHERE "Products"."companyId" = $1
            AND "Products"."isDeleted" = false
            AND "parentId" IS NOT NULL
            AND (
              $3::text IS NULL OR
              "Products".name ILIKE $3 OR
              "Products".barcode ILIKE $3 OR
              "ProductBarcodes".barcode ILIKE $3 OR
              "Products".type ILIKE $3 OR
              "Products"."UOM" ILIKE $3 OR
              (("Products"."translation" ->> 'name')::jsonb ->> 'ar') ILIKE $3 OR
              (("Products"."translation" ->> 'name')::jsonb ->> 'en') ILIKE $3 OR
              "Products"."defaultPrice"::varchar(255) ILIKE $3 OR
              "Departments".name ILIKE $3 OR
              "Categories".name ILIKE $3
            )
            -- NEW: tags filter in parentIds
            AND (
              $8::varchar[] IS NULL
              OR "Products"."tags" && $8::varchar[]
            )
          GROUP BY "Products".id, "Categories".id, "Departments".id
        ),
        "produts" AS (
          SELECT DISTINCT ON (COALESCE("Products"."productMatrixId", "Products".id))
            "Products".id,
            "Products".name,
            "Products".type,
            "Products"."UOM",
            "Products".barcode,
            "Products"."unitCost",
            "Products"."companyId",
            "Products"."createdAt",
            "Products"."categoryId",
            "Products"."translation"::text::json,
            "Products"."defaultPrice",
            "Products"."productMatrixId",
            "Products".tags,
            "Categories".name AS "categoryName",
            "Departments".name AS "departmentName"
          FROM "Products"
          LEFT JOIN "Categories"  ON "Categories".id  = "Products"."categoryId"
          LEFT JOIN "Departments" ON "Departments".id = "Categories"."departmentId"
          LEFT JOIN "ProductBarcodes" ON "Products".id = "ProductBarcodes"."productId"
          WHERE "Products"."isDeleted" = false
            AND "Products"."companyId" = $1
            AND ("Products".type = ANY($2) ${productMatrixQuery})
            AND (
              $3::text IS NULL OR
              "Products".name ILIKE $3 OR
              "Products".barcode ILIKE $3 OR
              "ProductBarcodes".barcode ILIKE $3 OR
              "Products".type ILIKE $3 OR
              "Products"."UOM" ILIKE $3 OR
              (("Products"."translation" ->> 'name')::jsonb ->> 'ar') ILIKE $3 OR
              (("Products"."translation" ->> 'name')::jsonb ->> 'en') ILIKE $3 OR
              "Products"."defaultPrice"::varchar(255) ILIKE $3 OR
              "Departments".name ILIKE $3 OR
              "Categories".name ILIKE $3 OR
              "Products".id IN (SELECT * FROM "parentIds")
            )
            AND (
              array_length($4::uuid[], 1) IS NULL
              OR "Categories".id = ANY($4::uuid[])
            )
            AND (
              array_length($5::uuid[], 1) IS NULL
              OR "Departments".id = ANY($5::uuid[])
            )
            -- NEW: tags filter in main product list
            AND (
              $8::varchar[] IS NULL
              OR "Products"."tags" && $8::varchar[]
            )
          GROUP BY "Products".id, "Categories".id, "Departments".id
        ),
        "produtList" AS (
          SELECT
            COUNT(*) OVER(),
            CASE WHEN COUNT("Products".id) > 0 THEN true END AS "isParent",
            "produts".id,
            "produts".name,
            "produts".type,
            "produts"."UOM",
            "produts".barcode,
            "produts"."unitCost",
            "produts"."companyId",
            "produts"."createdAt",
            "produts"."categoryId",
            "produts"."translation"::text,
            "produts"."defaultPrice",
            "produts"."productMatrixId",
            "produts".tags,
            "produts"."categoryName",
            "produts"."departmentName"
          FROM "produts"
          LEFT JOIN "Products"
            ON "Products"."companyId" = "produts"."companyId"
           AND "Products"."parentId" = "produts".id
          GROUP BY
            "produts".id,
            "produts".name,
            "produts".type,
            "produts"."UOM",
            "produts".barcode,
            "produts"."unitCost",
            "produts"."companyId",
            "produts"."createdAt",
            "produts"."categoryId",
            "produts"."translation"::text,
            "produts"."defaultPrice",
            "produts"."productMatrixId",
            "produts".tags,
            "produts"."categoryName",
            "produts"."departmentName"
          ${orderByQuery}
          LIMIT $6 OFFSET $7
        )
        SELECT
          count,
          "isParent",
          COALESCE("ProductMatrix"."id", "produtList"."id") AS "id",
          COALESCE("ProductMatrix".name, "produtList".name) AS "name",
          COALESCE("ProductMatrix".barcode, "produtList".barcode) AS "barcode",
          COALESCE("ProductMatrix"."unitCost", "produtList"."unitCost") AS "unitCost",
          COALESCE("ProductMatrix"."defaultPrice", "produtList"."defaultPrice") AS "defaultPrice",
          COALESCE("ProductMatrix".translation, "produtList".translation::jsonb) AS "translation",
          CASE
            WHEN "productMatrixId" IS NOT NULL THEN 'matrix'
            ELSE "produtList".type
          END AS type,
          "produtList"."categoryId",
          "produtList"."companyId",
          "produtList"."createdAt",
          "produtList"."productMatrixId",
          "produtList".tags,
          "categoryName",
          "departmentName",
          CASE
            WHEN type::text = 'inventory'::text OR type::text = 'kit'::text THEN
              (
                SELECT json_build_object(
                  'qtySum', COALESCE(SUM("InventoryMovmentRecords"."qty"::text::numeric(32, 6)), 0),
                  'stockValue', SUM("InventoryMovmentRecords"."qty"::text::numeric(32, 6) * "InventoryMovmentRecords"."cost"::text::numeric(32, 6))
                )
                FROM "InventoryMovmentRecords"
                WHERE "InventoryMovmentRecords"."productId" = "produtList".id
              )
            ELSE CASE
              WHEN type::text = 'batch'::text THEN
                (
                  SELECT json_build_object(
                    'qtySum', SUM("ProductBatches"."onHand"::text::numeric),
                    'stockValue', SUM("ProductBatches"."onHand" * "ProductBatches"."unitCost")
                  )
                  FROM "BranchProducts"
                  INNER JOIN "ProductBatches" ON "BranchProducts".id = "ProductBatches"."branchProductId"
                  INNER JOIN "Branches" ON "BranchProducts"."branchId" = "Branches".id
                  WHERE "BranchProducts"."productId" = "produtList".id
                    AND "Branches"."companyId" = "produtList"."companyId"
                )
              ELSE CASE
                WHEN type::text = 'serialized'::text THEN
                  (
                    SELECT json_build_object(
                      'qtySum', COUNT("ProductSerials".id),
                      'stockValue', SUM("ProductSerials"."unitCost")
                    )
                    FROM "BranchProducts"
                    INNER JOIN "ProductSerials" ON "BranchProducts".id = "ProductSerials"."branchProductId"
                    INNER JOIN "Branches" ON "BranchProducts"."branchId" = "Branches".id
                    WHERE "BranchProducts"."productId" = "produtList".id
                      AND "Branches"."companyId" = "produtList"."companyId"
                      AND "ProductSerials".status = 'Available'
                  )
              END
            END
          END AS "inventorySummary"
        FROM "produtList"
        LEFT JOIN "ProductMatrix" ON "produtList"."productMatrixId" = "ProductMatrix"."id"
        ${orderByQuery}
      `,
        // NOTE: $8 = tags
        values: [companyId, types, searchValue, categories, departments, limit, offset, tags]
      };

      let list = await DB.excu.query(query.text, query.values);
      let count = list.rows && list.rows.length > 0 ? Number((<any>list.rows[0]).count) : 0;
      let pageCount = Math.ceil(count / limit);

      offset += 1;
      let lastIndex = (page * limit);
      if (list.rows.length < limit || page == pageCount) {
        lastIndex = count;
      }

      const resData = {
        list: list.rows,
        count: count,
        pageCount: pageCount,
        startIndex: offset,
        lastIndex: lastIndex
      };

      return new ResponseData(true, "", resData);
    } catch (error: any) {
    
      throw new Error(error);
    }
  }

  
  public static async listProductFilter3(data: any, company: Company): Promise<ResponseData> {
    try {
      const companyId = company.id;

      // ---------- Normalize inputs ----------
      const page = Number.isFinite(+data?.page) && +data.page > 0 ? +data.page : 1;
      const limit = Number.isFinite(+data?.limit) && +data.limit > 0 ? +data.limit : 15;
      const searchTerm: string | undefined =
        typeof data?.searchTerm === 'string' && data.searchTerm.trim() !== ''
          ? data.searchTerm.trim()
          : undefined;

      // Types
      let types: string[] = [
        "inventory", "batch", "serialized", "service",
        "menuSelection", "menuItem", "package", "kit", "matrix", "tailoring"
      ];
      if (Array.isArray(data?.filter?.type) && data.filter.type.length > 0) {
        types = data.filter.type.map(String);
      }

      // Sort
      const sort = data?.sortBy;
      const sortBy: string | undefined = sort?.sortValue ? String(sort.sortValue) : 'createdAt';
      const sortOrder: 'ASC' | 'DESC' = (sort?.sortDirection === 'ASC' ? 'ASC' : 'DESC');

      // Filters: categories / departments / tags
      const filter = data.filter;
      const categories: string[] = Array.isArray(filter?.categories) ? filter.categories : [];
      const departments: string[] = Array.isArray(filter?.departments) ? filter.departments : [];
      const tags: string[] = Array.isArray(filter?.tags) && filter.tags.length > 0 ? filter.tags : [];

      // ---------- columnMap (+ customFields via jsonKV) ----------
      const columnMap: TableConfig['columnMap'] = {
        id: { rawExpr: `COALESCE(pm."id", p."id")`, table: 'p', dbCol: 'id', joinRequired: 'joinMatrix' },
        name: { rawExpr: `COALESCE(pm."name", p."name")`, table: 'p', dbCol: 'name', joinRequired: 'joinMatrix' },
        barcode: { rawExpr: `COALESCE(pm."barcode", p."barcode")`, table: 'p', dbCol: 'barcode', joinRequired: 'joinMatrix' },
        unitCost: { rawExpr: `COALESCE(pm."unitCost", p."unitCost")`, table: 'p', dbCol: 'unitCost', cast: 'numeric', joinRequired: 'joinMatrix' },
        defaultPrice: { rawExpr: `COALESCE(pm."defaultPrice", p."defaultPrice")`, table: 'p', dbCol: 'defaultPrice', cast: 'numeric', joinRequired: 'joinMatrix' },
        translation: { rawExpr: `COALESCE(pm."translation"::jsonb, p."translation"::jsonb)::text`, table: 'p', dbCol: 'translation', cast: 'text', joinRequired: 'joinMatrix' },

        type: { rawExpr: `CASE WHEN p."productMatrixId" IS NOT NULL THEN 'matrix' ELSE p."type" END`, table: 'p', dbCol: 'type' },
        isDeleted: { table: 'p', dbCol: 'isDeleted', cast: 'boolean' },
        UOM: { table: 'p', dbCol: 'UOM' },
        categoryId: { table: 'p', dbCol: 'categoryId' },
        companyId: { table: 'p', dbCol: 'companyId' },
        createdAt: { table: 'p', dbCol: 'createdAt', cast: 'timestamp' },
        productMatrixId: { table: 'p', dbCol: 'productMatrixId' },
        tags: { table: 'p', dbCol: 'tags' },

        categoryName: { table: 'c', dbCol: 'name', joinRequired: 'joinCategory' },
        departmentName: {
          rawExpr: `(SELECT "Departments"."name" FROM "Departments" WHERE "Departments"."id" = c."departmentId" LIMIT 1)`,
          table: 'c', dbCol: 'departmentId', joinRequired: 'joinCategory'
        },

        parentIdIsNull: { rawExpr: `(p."parentId" IS NULL)`, table: 'p', dbCol: 'parentId', cast: 'boolean' },

        customFieldsJson: {
          rawExpr: `COALESCE(pm."customFields"::jsonb, p."customFields"::jsonb)`,
          table: 'p', dbCol: 'customFields', joinRequired: 'joinMatrix'
        },

        _t_ar: { rawExpr: `LOWER((COALESCE(pm."translation"::jsonb, p."translation"::jsonb)->>'name')::jsonb->>'ar')`, table: 'p', dbCol: 'translation', joinRequired: 'joinMatrix' },
        _t_en: { rawExpr: `LOWER((COALESCE(pm."translation"::jsonb, p."translation"::jsonb)->>'name')::jsonb->>'en')`, table: 'p', dbCol: 'translation', joinRequired: 'joinMatrix' },
      };

      // Load custom fields config and add columns
      // Product customFields can be either:
      //   object: {"uuid": "value", ...}
      //   array:  [{"id":"uuid","name":"fieldName","value":"val"}, ...]
      const cfConfig = await CustomizationRepo.getCustomizationByKey('product', 'customFields', company);
      for (const field of (cfConfig?.data?.customFields || [])) {
        if (!field.name || field.name.trim() === '') continue;
        const safeKey = String(field.name).trim().replace(/\s+/g, '_');
        const escapedId = String(field.id).replace(/'/g, "''");
        const escapedName = String(field.name).replace(/'/g, "''");
        columnMap[safeKey] = {
          rawExpr: `CASE WHEN jsonb_typeof(p."customFields"::jsonb) = 'object' THEN p."customFields"::jsonb ->> '${escapedId}' ELSE (SELECT e->>'value' FROM jsonb_array_elements(p."customFields"::jsonb) AS e WHERE e->>'name' = '${escapedName}' LIMIT 1) END`,
          table: 'p',
          dbCol: 'customFields'
        } as any;
      }

      // ---------- alias & joins ----------
      // Subquery collapses matrix children into one row per matrix parent
      const productsSubquery = `(SELECT DISTINCT ON (COALESCE("productMatrixId", id)) * FROM "Products" ORDER BY COALESCE("productMatrixId", id), "createdAt" DESC)`;

      const ProductConfig: TableConfig = {
        aliasMap: {
          p: productsSubquery,
          c: 'Categories',
          d: 'Departments',
          pb: 'ProductBarcodes',
          pm: 'ProductMatrix',
        },
        columnMap,
        joinDefs: {
          joinCategory: { joinTable: 'c', onLocal: 'p.categoryId', onForeign: 'c.id' },
          joinMatrix: { joinTable: 'pm', onLocal: 'p.productMatrixId', onForeign: 'pm.id' },
        },
        searchableColumns: ['name', 'barcode', 'type', 'UOM', '_t_ar', '_t_en'],
        selectableColumns: [
          'id', 'name', 'type', 'UOM', 'barcode', 'unitCost', 'defaultPrice', 'companyId', 'createdAt',
          'categoryId', 'categoryName', 'departmentName', 'productMatrixId', 'tags', 'translation',
          'isDeleted',
          ...Object.keys(columnMap).filter(k => ![
            'id', 'name', 'type', 'UOM', 'barcode', 'unitCost', 'defaultPrice', 'companyId', 'createdAt',
            'categoryId', 'categoryName', 'departmentName', 'productMatrixId', 'tags', 'translation',
            'isDeleted'
          ].includes(k))
        ],
      };

      const service = new TableDataService(ProductConfig);

      // ---------- Build filters ----------
      const filters: TableRequest['filters'] = [
        { column: 'companyId', operator: 'eq', value: companyId },
        { column: 'type', operator: 'in', value: types },
        { column: 'isDeleted', operator: 'eq', value: false },
      ];

      if (categories.length > 0) {
        filters.push({ column: 'categoryId', operator: 'in', value: categories });
      }
      if (departments.length > 0) {
        filters.push({ column: 'departmentName', operator: 'in', value: departments });
      }
      if (tags.length > 0) {
        filters.push({ column: 'tags', operator: 'array_overlap', value: tags });
      }

      // ---------- Select columns ----------
      const defaultCols = [
        'id', 'name', 'barcode', 'unitCost', 'defaultPrice', 'type', 'UOM',
        'categoryId', 'categoryName', 'departmentName', 'createdAt', 'tags', 'translation'
      ];

      const whitelist = ProductConfig.selectableColumns ?? Object.keys(ProductConfig.columnMap);
      const userCols = Array.isArray(data?.columns) ? (data.columns as string[]).map(String) : defaultCols;
      let selectColumns = userCols.filter(c => whitelist.includes(c));
      if (selectColumns.length === 0) selectColumns = defaultCols;
      // Always include id, name, type
      for (const required of ['id', 'name', 'type']) {
        if (!selectColumns.includes(required)) selectColumns.push(required);
      }

      // ---------- Execute via TableDataService ----------
      const req: TableRequest = {
        table_name: productsSubquery,
        select_columns: selectColumns as any,
        filters,
        search_term: searchTerm,
        sort_by: (whitelist.includes(String(sortBy)) ? String(sortBy) as any : 'createdAt' as any),
        sort_order: sortOrder,
        page_number: page,
        page_size: limit,
      };

      const result = await service.getTableData<any>(req);

      // Compute isParent always; inventory summary only when needed
      const needsQty = userCols.includes('qtySum');
      const needsVal = userCols.includes('stockValue');
      const needsInventory = userCols.includes('inventorySummary');

      if (result.data.length) {
        const pageIds = result.data.map((r: any) => r.id);

        const extraSql = `
          WITH page(id) AS (SELECT UNNEST($1::uuid[]))
          SELECT
            p.id AS id,
            (SELECT COUNT(*) > 0 FROM "Products" child
             WHERE child."parentId" = p.id AND child."companyId" = $2) AS "isParent",
            CASE
              WHEN p.type IN ('inventory','kit') THEN
                COALESCE((
                  SELECT SUM((imr.qty)::numeric)
                  FROM "InventoryMovmentRecords" imr
                  WHERE imr."productId" = p.id
                ),0)
              WHEN p.type = 'batch' THEN
                COALESCE((
                  SELECT SUM(pb."onHand"::numeric)
                  FROM "BranchProducts" bp
                  JOIN "ProductBatches" pb ON bp.id = pb."branchProductId"
                  JOIN "Branches" b ON bp."branchId" = b.id
                  WHERE bp."productId" = p.id AND b."companyId" = $2
                ),0)
              WHEN p.type = 'serialized' THEN
                COALESCE((
                  SELECT COUNT(ps.id)::numeric
                  FROM "BranchProducts" bp
                  JOIN "ProductSerials" ps ON bp.id = ps."branchProductId"
                  JOIN "Branches" b ON bp."branchId" = b.id
                  WHERE bp."productId" = p.id AND b."companyId" = $2 AND ps.status = 'Available'
                ),0)
              ELSE 0
            END AS "qtySum",
            CASE
              WHEN p.type IN ('inventory','kit') THEN
                COALESCE((
                  SELECT SUM((imr.qty)::numeric * (imr.cost)::numeric)
                  FROM "InventoryMovmentRecords" imr
                  WHERE imr."productId" = p.id
                ),0)
              WHEN p.type = 'batch' THEN
                COALESCE((
                  SELECT SUM(pb."onHand"::numeric * pb."unitCost"::numeric)
                  FROM "BranchProducts" bp
                  JOIN "ProductBatches" pb ON bp.id = pb."branchProductId"
                  JOIN "Branches" b ON bp."branchId" = b.id
                  WHERE bp."productId" = p.id AND b."companyId" = $2
                ),0)
              WHEN p.type = 'serialized' THEN
                COALESCE((
                  SELECT SUM(ps."unitCost"::numeric)
                  FROM "BranchProducts" bp
                  JOIN "ProductSerials" ps ON bp.id = ps."branchProductId"
                  JOIN "Branches" b ON bp."branchId" = b.id
                  WHERE bp."productId" = p.id AND b."companyId" = $2 AND ps.status = 'Available'
                ),0)
              ELSE 0
            END AS "stockValue"
          FROM page
          JOIN "Products" p ON p.id = page.id
        `;

        const { rows: extras } = await DB.excu.query(extraSql, [pageIds, companyId]);
        const extrasById = new Map(extras.map((r: any) => [r.id, r]));

        for (const row of result.data) {
          const e = extrasById.get(row.id);
          if (e) {
            row.isParent = e.isParent || false;
            if (needsQty) row.qtySum = e.qtySum;
            if (needsVal) row.stockValue = e.stockValue;
            if (needsInventory) row.inventorySummary = { qtySum: e.qtySum, stockValue: e.stockValue };
          } else {
            row.isParent = false;
            if (needsQty) row.qtySum = 0;
            if (needsVal) row.stockValue = 0;
            if (needsInventory) row.inventorySummary = { qtySum: 0, stockValue: 0 };
          }
        }
      }

      // ---------- Response shape ----------
      const { total_count } = result;
      const pageCount = Math.ceil(total_count / limit) || 1;
      const startIndex = (page - 1) * limit + 1;
      const lastIndex = Math.min(page * limit, total_count);

      const resData = {
        list: result.data,
        count: total_count,
        pageCount,
        startIndex,
        lastIndex,
      };

      return new ResponseData(true, "", resData);
    } catch (error: any) {

      throw new Error(error?.message ?? String(error));
    }
  }


  public static async listProductFilter1(data: any, company: Company): Promise<ResponseData> {
    try {
      const companyId = company.id;

      // ---------- Normalize inputs ----------
      const page = Number.isFinite(+data?.page) && +data.page > 0 ? +data.page : 1;
      const limit = Number.isFinite(+data?.limit) && +data.limit > 0 ? +data.limit : 15;
      const searchTerm: string | undefined =
        typeof data?.searchTerm === 'string' && data.searchTerm.trim() !== ''
          ? data.searchTerm.trim()
          : undefined;

      // Types
      let types: string[] = [
        "inventory", "batch", "serialized", "service",
        "menuSelection", "menuItem", "package", "kit", "matrix", "tailoring"
      ];
      if (Array.isArray(data?.filter?.type) && data.filter.type.length > 0) {
        types = data.filter.type.map(String);
      }

      // Sort
      const sort = data?.sortBy;
      const sortBy: string | undefined = sort?.sortValue ? String(sort.sortValue) : 'createdAt';
      const sortOrder: 'ASC' | 'DESC' = (sort?.sortDirection === 'ASC' ? 'ASC' : 'DESC');

      // Filters: categories / departments
      const categories: string[] = Array.isArray(data?.filter?.categories) ? data.filter.categories : [];
      const departments: string[] = Array.isArray(data?.filter?.departments) ? data.filter.departments : [];

      // ---------- columnMap (+ customFields via jsonKV) ----------
      const columnMap: TableConfig['columnMap'] = {
        id: { rawExpr: `COALESCE(pm."id", p."id")`, table: 'p', dbCol: 'id', joinRequired: 'joinMatrix' },
        name: { rawExpr: `COALESCE(pm."name", p."name")`, table: 'p', dbCol: 'name', joinRequired: 'joinMatrix' },
        barcode: { rawExpr: `COALESCE(pm."barcode", p."barcode")`, table: 'p', dbCol: 'barcode', joinRequired: 'joinMatrix' },
        unitCost: { rawExpr: `COALESCE(pm."unitCost", p."unitCost")`, table: 'p', dbCol: 'unitCost', cast: 'numeric', joinRequired: 'joinMatrix' },
        defaultPrice: { rawExpr: `COALESCE(pm."defaultPrice", p."defaultPrice")`, table: 'p', dbCol: 'defaultPrice', cast: 'numeric', joinRequired: 'joinMatrix' },
        translation: { rawExpr: `COALESCE(pm."translation"::jsonb, p."translation"::jsonb)::text`, table: 'p', dbCol: 'translation', cast: 'text', joinRequired: 'joinMatrix' },

        // Computed type: call it 'matrix' if this parent has a productMatrixId, otherwise keep p.type
        type: { rawExpr: `CASE WHEN p."productMatrixId" IS NOT NULL THEN 'matrix' ELSE p."type" END`, table: 'p', dbCol: 'type' },
        isDeleted: { table: 'p', dbCol: 'isDeleted', cast: 'boolean' },
        // Base columns from Products
        UOM: { table: 'p', dbCol: 'UOM' },
        categoryId: { table: 'p', dbCol: 'categoryId' },
        companyId: { table: 'p', dbCol: 'companyId' },
        createdAt: { table: 'p', dbCol: 'createdAt', cast: 'timestamp' },
        productMatrixId: { table: 'p', dbCol: 'productMatrixId' },

        // category/department names
        categoryName: { table: 'c', dbCol: 'name', joinRequired: 'joinCategory' },
        departmentName: { table: 'd', dbCol: 'name', joinRequired: 'joinDepartment' },

        // Parent-only guard: we will filter by this
        parentIdIsNull: { rawExpr: `(p."parentId" IS NULL)`, table: 'p', dbCol: 'parentId', cast: 'boolean' },

        // Combined customFields JSON (prefer matrix over product)
        customFieldsJson: {
          rawExpr: `COALESCE(pm."customFields"::jsonb, p."customFields"::jsonb)`,
          table: 'p', dbCol: 'customFields', joinRequired: 'joinMatrix'
        },

        // Two virtuals to search translation names easily (lowercased)
        _t_ar: { rawExpr: `LOWER((COALESCE(pm."translation"::jsonb, p."translation"::jsonb)->>'name')::jsonb->>'ar')`, table: 'p', dbCol: 'translation', joinRequired: 'joinMatrix' },
        _t_en: { rawExpr: `LOWER((COALESCE(pm."translation"::jsonb, p."translation"::jsonb)->>'name')::jsonb->>'en')`, table: 'p', dbCol: 'translation', joinRequired: 'joinMatrix' },
      };

      // Load custom fields config and add jsonKV columns { id: value }
      const cfConfig = await CustomizationRepo.getCustomizationByKey('product', 'customFields', company);
      for (const field of (cfConfig?.data?.customFields || [])) {
        const safeKey = String(field.name ?? field.id).trim().replace(/\s+/g, '_'); // column name exposed to UI
        columnMap[safeKey] = {
          table: 'p',
          dbCol: 'customFields',
          jsonKV: { key: String(field.id), cast: 'text' } // { "<uuid>": "<value>" }
        } as any;
      }

      // ---------- alias & joins ----------
      const ProductConfig: TableConfig = {
        aliasMap: {
          p: 'Products',
          c: 'Categories',
          d: 'Departments',
          pb: 'ProductBarcodes',
          pm: 'ProductMatrix',
        },
        columnMap,
        joinDefs: {
          joinCategory: { joinTable: 'c', onLocal: 'p.categoryId', onForeign: 'c.id' },
          joinMatrix: { joinTable: 'pm', onLocal: 'p.productMatrixId', onForeign: 'pm.id' },
        },
        // You can search these even if they aren't selected
        searchableColumns: ['name', 'barcode', 'type', 'UOM', '_t_ar', '_t_en'],
        // Whitelist of selectable/sortable/filterable columns:
        selectableColumns: [
          'id', 'name', 'type', 'UOM', 'barcode', 'unitCost', 'defaultPrice', 'companyId', 'createdAt',
          'categoryId', 'categoryName', 'departmentName', 'productMatrixId',
          'translationNameAr', 'translationNameEn', 'isDeleted',
          ...Object.keys(columnMap).filter(k => ![
            // keep cf keys; exclude derived search-only fields if needed
            'id', 'name', 'type', 'UOM', 'barcode', 'unitCost', 'defaultPrice', 'companyId', 'createdAt',
            'categoryId', 'categoryName', 'departmentName', 'productMatrixId',
            'translationNameAr', 'translationNameEn', 'anyBarcode'
          ].includes(k))
        ],
      };

      const service = new TableDataService(ProductConfig);

      // ---------- Build filters ----------
      const filters: TableRequest['filters'] = [
        { column: 'companyId', operator: 'eq', value: companyId },
        { column: 'type', operator: 'in', value: types },
        { column: 'isDeleted', operator: 'eq', value: false },
      ];

      if (categories.length > 0) {
        filters.push({ column: 'categoryId', operator: 'in', value: categories });
      }
      if (departments.length > 0) {
        // filtering by department through joined column (need join 'dep')
        filters.push({ column: 'departmentName', operator: 'in', value: departments }); // or make a departmentId column if you prefer
      }

      // NOTE about `matrix`:
      // If you want to EXCLUDE records where productMatrixId IS NOT NULL when 'matrix' is NOT selected,
      // add a tiny extension to TableDataService to support 'isnull'/'notnull' operators, then:
      //
      // if (!types.includes('matrix')) {
      //   filters.push({ column: 'productMatrixId', operator: 'isnull', value: true } as any);
      // }

      // ---------- Select columns ----------
      const defaultCols = [
        'id', 'name', 'barcode', 'unitCost', 'defaultPrice', 'type', 'UOM',
        'categoryId', 'categoryName', 'departmentName', 'createdAt'
      ];

      const whitelist = ProductConfig.selectableColumns ?? Object.keys(ProductConfig.columnMap);
      const userCols = Array.isArray(data?.columns) ? (data.columns as string[]).map(String) : defaultCols;
      let selectColumns = userCols.filter(c => whitelist.includes(c));
      if (selectColumns.length === 0) selectColumns = defaultCols;
      if (!selectColumns.includes('id')) selectColumns.push('id');

      // ---------- Execute via TableDataService ----------
      const req: TableRequest = {
        table_name: 'Products',
        select_columns: selectColumns as any,
        filters,
        search_term: searchTerm,
        sort_by: (whitelist.includes(String(sortBy)) ? String(sortBy) as any : 'createdAt' as any),
        sort_order: sortOrder,
        page_number: page,
        page_size: limit,
      };

      const result = await service.getTableData<any>(req);

      // only compute when asked for
      const needsQty = userCols.includes('qtySum');
      const needsVal = userCols.includes('stockValue');

      if (result.data.length && (needsQty || needsVal)) {
        const pageIds = result.data.map(r => r.id);
        const sumSql = `
            WITH page(id) AS (SELECT UNNEST($1::uuid[]))
            SELECT
              COALESCE(pm.id, p.id) AS id,
              -- qtySum
              CASE
                WHEN COALESCE(pm.type, p.type) IN ('inventory','kit') THEN
                  COALESCE((
                    SELECT SUM((imr.qty)::numeric)
                    FROM "InventoryMovmentRecords" imr
                    WHERE imr."productId" = p.id
                  ),0)
                WHEN COALESCE(pm.type, p.type) = 'batch' THEN
                  COALESCE((
                    SELECT SUM(pb."onHand"::numeric)
                    FROM "BranchProducts" bp
                    JOIN "ProductBatches" pb ON bp.id = pb."branchProductId"
                    JOIN "Branches" b ON bp."branchId" = b.id
                    WHERE bp."productId" = p.id AND b."companyId" = $2
                  ),0)
                WHEN COALESCE(pm.type, p.type) = 'serialized' THEN
                  COALESCE((
                    SELECT COUNT(ps.id)::numeric
                    FROM "BranchProducts" bp
                    JOIN "ProductSerials" ps ON bp.id = ps."branchProductId"
                    JOIN "Branches" b ON bp."branchId" = b.id
                    WHERE bp."productId" = p.id AND b."companyId" = $2 AND ps.status = 'Available'
                  ),0)
                ELSE 0
              END AS "qtySum",
              -- stockValue
              CASE
                WHEN COALESCE(pm.type, p.type) IN ('inventory','kit') THEN
                  COALESCE((
                    SELECT SUM((imr.qty)::numeric * (imr.cost)::numeric)
                    FROM "InventoryMovmentRecords" imr
                    WHERE imr."productId" = p.id
                  ),0)
                WHEN COALESCE(pm.type, p.type) = 'batch' THEN
                  COALESCE((
                    SELECT SUM(pb."onHand"::numeric * pb."unitCost"::numeric)
                    FROM "BranchProducts" bp
                    JOIN "ProductBatches" pb ON bp.id = pb."branchProductId"
                    JOIN "Branches" b ON bp."branchId" = b.id
                    WHERE bp."productId" = p.id AND b."companyId" = $2
                  ),0)
                WHEN COALESCE(pm.type, p.type) = 'serialized' THEN
                  COALESCE((
                    SELECT SUM(ps."unitCost"::numeric)
                    FROM "BranchProducts" bp
                    JOIN "ProductSerials" ps ON bp.id = ps."branchProductId"
                    JOIN "Branches" b ON bp."branchId" = b.id
                    WHERE bp."productId" = p.id AND b."companyId" = $2 AND ps.status = 'Available'
                  ),0)
                ELSE 0
              END AS "stockValue"
            FROM page
            JOIN "Products" p ON p.id = page.id
            LEFT JOIN "ProductMatrix" pm ON p."productMatrixId" = pm.id
          `;

        const { rows: sums } = await DB.excu.query(sumSql, [pageIds, companyId]);
        const sumsById = new Map(sums.map((r: any) => [r.id, r]));

        // merge into result.rows
        for (const row of result.data) {
          const s = sumsById.get(row.id);
          if (s) {
            if (needsQty) row.qtySum = s.qtySum;
            if (needsVal) row.stockValue = s.stockValue;
          } else {
            if (needsQty) row.qtySum = 0;
            if (needsVal) row.stockValue = 0;
          }
        }
      }
      // ---------- Response shape (compatible with your current consumer) ----------
      const { total_count } = result;
      const pageCount = Math.ceil(total_count / limit) || 1;
      const startIndex = (page - 1) * limit + 1;
      const lastIndex = Math.min(page * limit, total_count);

      const resData = {
        list: result.data,
        count: total_count,
        pageCount,
        startIndex,
        lastIndex,
      };

      return new ResponseData(true, "", resData);

    } catch (error: any) {
    
      throw new Error(error?.message ?? String(error));
    }
  }

  public static async listProductFilter2(data: any, company: Company): Promise<ResponseData> {
    try {
      const companyId = company.id;

      let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';


      let types = ["inventory", "batch", "serialized", "service", "menuSelection", "menuItem", "package", "kit", 'tailoring']

      if (data.filter && data.filter.type && data.filter.type.length > 0) {
        types = data.filter.type;

      }
      let sort = data.sortBy;
      let sortValue = !sort ? '"createdAt"' : '"' + sort.sortValue + '"';
      let sortDirection = !sort ? "DESC" : sort.sortDirection;
      let sortTerm = sortValue + " " + sortDirection
      let orderByQuery = ` Order by ` + sortTerm;

      let page = data.page ?? 1;
      let offset = 0;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }



      const query: { text: string, values: any } = {
        text: `with "produtList" as (

          SELECT 
                 COUNT(*)OVER(),
                 "Products".id,
                 "Products".name,
                 "Products"."categoryId",
                 "Products".barcode,
                 "Products"."defaultPrice",
                 "Products".type,
                 "Products"."UOM",
                 "Products"."translation",
                 "Products"."unitCost",
                 "Products"."companyId",
                 "Products"."createdAt",
                 "Categories".name as "categoryName",
                 "Departments".name as "departmentName"
                 from "Products"
                 LEFT JOIN "Categories" on "Categories".id = "Products"."categoryId"
                 LEFT JOIN "Departments" on "Departments".id = "Categories"."departmentId"
                 LEFT JOIN "ProductBarcodes" on "Products".id = "ProductBarcodes"."productId"
           WHERE "Products"."isDeleted" = false 
          
           AND "Products"."companyId"=$1 
           AND "Products".type = ANY( $2)
           AND (LOWER ("Products".name) ~ $3
                OR LOWER ("Products".barcode) ~ $3
                OR LOWER ("Products".type) ~ $3
                OR LOWER ("Products". "UOM") ~ $3
                OR LOWER ( ("Products"."translation" ->>'name')::jsonb->>'ar' ) ~ $3
                OR LOWER ( ("Products"."translation" ->>'name')::jsonb->>'en' ) ~ $3
                OR "Products"."defaultPrice"::varchar(255)~ $3
                OR LOWER ("ProductBarcodes"."barcode") ~ $3 
                )
           
                ${orderByQuery}
          Limit $4 offset $5) 
          
        select 
          "produtList".*,
             case when type::text = 'inventory'::text  or  type::text = 'kit'::text    then
              (select json_build_object('qtySum',sum ( "BranchProducts"."onHand") + COALESCE(sum("BranchProducts"."openingBalance"),0) ,'stockValue',(sum ( "BranchProducts"."onHand") *  "produtList"."unitCost") +(  COALESCE(sum("BranchProducts"."openingBalance"),0) * COALESCE(sum("BranchProducts"."openingBalanceCost"),0) )  )
                from "BranchProducts"   where "BranchProducts"."productId" = "produtList".id  )
                  else case when type::text = 'batch'::text then 
               (select 
                   json_build_object('qtySum',sum ( "ProductBatches"."onHand") ,'stockValue',sum ( "ProductBatches"."onHand" *  "ProductBatches"."unitCost" )  )
                   from "BranchProducts" 
                   inner join "ProductBatches" on "BranchProducts".id ="ProductBatches"."branchProductId"
                   inner join "Branches" on "BranchProducts"."branchId" = "Branches".id
                   where "BranchProducts"."productId" = "produtList".id 
                   and"Branches"."companyId" = "produtList"."companyId")
                    else case when type::text ='serialized'::text then 
              (select json_build_object('qtySum',count( "ProductSerials".id),'stockValue',sum("ProductSerials"."unitCost") )
                    from "BranchProducts" 
                inner join "ProductSerials" on "BranchProducts".id ="ProductSerials"."branchProductId"
                inner join "Branches" on "BranchProducts"."branchId" = "Branches".id
                where "BranchProducts"."productId" = "produtList".id 
                and"Branches"."companyId" = "produtList"."companyId"
                and "ProductSerials".status = 'Available') 
                end 
                end 
                end as "inventorySummary"
          FROM "produtList"
          ${orderByQuery}
      `,
        values: [companyId, types, searchValue, limit, offset]
      }

      let list = await DB.excu.query(query.text, query.values);
      let count = list.rows && list.rows.length > 0 ? Number((<any>list.rows[0]).count) : 0
      let pageCount = Math.ceil(count / limit)

      offset += 1
      let lastIndex = ((page) * limit)
      if (list.rows.length < limit || page == pageCount) {
        lastIndex = count
      }
      const resData = {
        list: list.rows,
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


  public static async listProductFilterNonBranded(data: any, company: Company): Promise<ResponseData> {
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
      let page = data.page ?? 1
      let brandId = data.filter ? data.filter.brandId : null;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }
      let types = ["inventory", "batch", "serialized", "kit"]

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

      let filterQuery = ` WHERE "Products"."isDeleted" = false AND "companyId"=$1 AND "Products".type = ANY( $2)`
      filterQuery += ` AND (LOWER ("Products".name) ~ $3
                        OR LOWER ("Products".barcode) ~ $3
                        OR LOWER ("Products".type) ~ $3
                        OR LOWER ("Products". "UOM") ~ $3
                        OR LOWER ( ("translation" ->>'name')::jsonb->>'ar' ) ~ $3
                        OR LOWER ( ("translation" ->>'name')::jsonb->>'en' ) ~ $3
                        OR "Products"."defaultPrice"::varchar(255)~ $3)
                        And (($4::uuid is not null and "brandid" =$4::uuid) or "brandid" is null)
                        `

      const limitQuery = ` Limit $5 offset $6`

      let selectCount;
      let orderByQuery;
      selectQuery = selectText + filterQuery
      selectValues = [companyId, types, searchValue, brandId]


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
        selectValues = [companyId, types, searchValue, brandId, limit, offset]
        countQuery = countText + filterQuery
        countValues = [companyId, types, searchValue, brandId]

        selectCount = await DB.excu.query(countQuery, countValues)
        count = Number((<any>selectCount.rows[0]).count)
        pageCount = Math.ceil(count / data.limit)
      }


      const selectList: any = await DB.excu.query(selectQuery, selectValues)

      // for (let index = 0; index < selectList.rows.length; index++) {
      //   const element = selectList.rows[index];
      //   if (element.type == "batch" || element.type == "serialized" || element.type == "inventory" || element.type == "kit") {
      //     const branchSummary = await this.getProductAvailability(element.id, companyId);
      //     if (branchSummary?.data) {
      //       selectList.rows[index].branchSummary = branchSummary.data
      //     }
      //   }
      // }

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

    
      throw new Error(error)
    }
  }




  public static async listProductFilterNonInventoryLocations(data: any, company: Company): Promise<ResponseData> {
    try {
      const companyId = company.id;
      const branchId = data.branchId;
      let types = ["inventory", "batch", "serialized", "service", "menuSelection", "menuItem", "package", "kit"]

      let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';
      if (data.filter && data.filter.type && data.filter.type.length > 0) {
        types = data.filter.type;

      }
      let sort = data.sortBy;
      let sortValue = !sort ? '"Products"."createdAt"' : '"' + sort.sortValue + '"';
      if (data.productId != null && data.productId != "") {
        sortValue = ` ("Products".id = ` + "'" + data.productId + "'" + ` )`
      }
      let sortDirection = !sort ? "DESC" : sort.sortDirection;
      let sortTerm = sortValue + " " + sortDirection
      let orderByQuery = ` Order by ` + sortTerm;
      let locationId = data.filter ? data.filter.locationId : null

      let offset = 0;
      let page = data.page ?? 1
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }

      const query: { text: string, values: any } = {
        text: `     SELECT count(*) over(),
                       
                            "Products". id,
                            "Products".name,
                            "Products".barcode,
                            "Products"."defaultPrice",
                            "Products".type,
                            "Products"."UOM",
                            "Products"."translation"
                      FROM "Products"
                      inner join "BranchProducts" on "Products".id = "BranchProducts"."productId" 
                      WHERE "Products"."isDeleted" = false AND "Products"."companyId"=$1 AND "Products".type = ANY( $2)
                      AND (LOWER ("Products".name) ~ $3
                        OR LOWER ("Products".barcode) ~ $3
                        OR LOWER ("Products".type) ~ $3
                        OR LOWER ("Products". "UOM") ~ $3
                        OR LOWER ( ("translation" ->>'name')::jsonb->>'ar' ) ~ $3
                        OR LOWER ( ("translation" ->>'name')::jsonb->>'en' ) ~ $3
                        OR "Products"."defaultPrice"::varchar(255)~ $3)
                        AND "BranchProducts"."branchId"=$4
                         AND (($5::uuid is not null and "BranchProducts"."locationId" =$5) or "BranchProducts"."locationId" is null)
                        ${orderByQuery}
                        Limit $6 offset $7`,
        values: [companyId, types, searchValue, branchId, locationId, limit, offset]
      }

      let list = await DB.excu.query(query.text, query.values);
      let count = list.rows && list.rows.length > 0 ? Number((<any>list.rows[0]).count) : 0
      let pageCount = Math.ceil(count / limit)

      offset += 1
      let lastIndex = ((page) * limit)
      if (list.rows.length < limit || page == pageCount) {
        lastIndex = count
      }
      const resData = {
        list: list.rows,
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












  // public static async getListOfProductsbyType(company: Company, data: any) {
  //   try {
  //     const types: [string] = data.types;
  //     const exclude: [string] = data.exclude;
  //     const companyId = company.id;
  //     let selectQuery;
  //     let selectValues;
  //     let countValues;
  //     let searchValue = '[A-Za-z0-9]*';
  //     let offset = 0;
  //     let sort: any;
  //     let sortValue;
  //     let sortDirection;
  //     let sortTerm;
  //     let count = 0;
  //     let pageCount = 0;
  //     let orderByQuery = ""
  //     let page = 1
  //     const limit = ((data.limit == null) ? 15 : data.limit);
  //     if (page != 1) {
  //       offset = (limit * (page - 1))
  //     }
  //     let filterType: any = types;
  //     const includedTypes = ['service', 'inventory', 'kit', 'package', 'menuItem', 'menuSelection', 'batch', 'serialized']
  //     if (exclude && exclude.length > 0) {
  //       filterType = includedTypes.filter(a => !exclude.includes(a));
  //     } else if (!types && !exclude) {
  //       filterType = includedTypes
  //     }


  //     let productId = data.productId == null ? "" : data.productId
  //     if (data && data.searchTerm != "" && data.searchTerm != null) {
  //       searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`

  //     }
  //     let filterQuery = `    where  "companyId" = $1 
  //                           and type = any($2) 
  //                           and "Products".id::text <>$3
  //                           AND "Products"."isDeleted" = false
  //                           and ( LOWER("Products".name) ~$4 or  LOWER("Products".barcode) ~$4)
  //                           `
  //     let limitQuery = ` limit $5 offset $6`
  //     const query : { text: string, values: any } = {
  //       text: `SELECT id,
  //                    name,
  //                    type,
  //                    "UOM",
  //                    "defaultPrice",
  //                     "barcode",
  //                     "unitCost"  
  //               FROM "Products" \

  //           ` + filterQuery + limitQuery,
  //       values: [
  //         companyId,
  //         filterType, productId, searchValue, limit, offset
  //       ],
  //     }

  //     const countQuery = {
  //       text: `SELECT COUNT(*) FROM "Products"` + filterQuery,
  //       values: [
  //         companyId,
  //         filterType,
  //         productId,
  //         searchValue
  //       ]
  //     }




  //     if (data != null && data != '' && JSON.stringify(data) != '{}') {
  //       let limitQuery;


  //       sort = data.sortBy;
  //       sortValue = !sort ? '"Products"."createdAt"' : '"' + sort.sortValue + '"';
  //       sortDirection = !sort ? "DESC" : sort.sortDirection;
  //       sortTerm = sortValue + " " + sortDirection
  //       orderByQuery = ` Order by ` + sortTerm;



  //       let selectCount = await DB.excu.query(countQuery.text, countQuery.values)
  //       count = Number((<any>selectCount.rows[0]).count)
  //       pageCount = Math.ceil(count / limit)
  //     }


  //     const selectList: any = await DB.excu.query(query.text, query.values)

  //     offset += 1
  //     let lastIndex = ((page) * limit)
  //     if (selectList.rows.length < limit || page == pageCount) {
  //       lastIndex = count
  //     }

  //     const resData = {
  //       list: selectList.rows,
  //       count: count,
  //       pageCount: pageCount,
  //       startIndex: offset,
  //       lastIndex: lastIndex
  //     }
  //     return new ResponseData(true, "", resData)



  //     // const list = await DB.excu.query(query.text, query.values);
  //     // const product: Product[] = [];
  //     // list.rows.forEach((element: any) => {
  //     //   const temp = new Product();
  //     //   temp.ParseJson(element);
  //     //   product.push(temp);
  //     // });

  //     // const resData = {
  //     //   list: data
  //     // }
  //     // return new ResponseData(true, "", list.rows)
  //   } catch (error: any) {

  //     console.log(error)
  //   
  //     throw new Error(error);
  //   }
  // }


  public static async getListOfProductsbyType(company: Company, data: any): Promise<ResponseData> {
    try {
      const companyId = company.id;
      const types: [string] = data.types;
      const exclude: [string] = data.exclude;
      const encoleded: [string] = data.include && data.include.length > 0 ? data.include : null;
      let filterType: any = types;
      const filter = data.filter;
      const mainBranch = await BranchesRepo.getMainBranch(null, companyId)
      const branchId = mainBranch && mainBranch.branch ? mainBranch.branch.id : null;

      const includedTypes = encoleded ? encoleded : ['service', 'inventory', 'kit', 'package', 'menuItem', 'menuSelection', 'batch', 'serialized']
      if (exclude && exclude.length > 0) {
        filterType = includedTypes.filter(a => !exclude.includes(a));
      } else if (!types && !exclude) {
        filterType = includedTypes
      }

      let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';



      let productId = data.productId ?? null;
      let selectedProductId = data.selectedProductId && Array.isArray(data.selectedProductId) ? data.selectedProductId : data.selectedProductId;
      let sort = data.sortBy;
      let sortValue = !sort ? '"Products"."createdAt"' : '"' + sort.sortValue + '"';
      if (selectedProductId != null && selectedProductId != "") {
        if (Array.isArray(data.selectedProductId)) {
          const ids = data.selectedProductId;

          sortValue = `
         ("Products".id in (${ids.map((id:any) => `'${id}'`).join(",")}))
            `;
        } else {
          sortValue = `("Products".id = '${data.selectedProductId}')`;
        }
      }
      let sortDirection = !sort ? "DESC" : sort.sortDirection;
      let sortTerm = sortValue + " " + sortDirection
      let orderByQuery = ` Order by ` + sortTerm;

      const categories = filter && filter.categories ? filter.categories : [];
      const departments = filter && filter.departments ? filter.departments : [];




      let page = data.page ?? 1;
      let offset = 0;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }


      const query: { text: string, values: any } = {
        text: `

         with "pro" as ( SELECT 
                 COUNT(*)OVER(),
                 "Products".id,
                 "Products".name,
                 "Products".type,
                 "Products"."UOM",
                 "Products"."defaultPrice",
                 "Products"."barcode",
                 "Products"."unitCost",
          
                 "Categories".name as "categoryName",
                 "Departments".name as "departmentName",
                 case when "Media".id is not null then  JSON_BUILD_OBJECT('thumbnailUrl', CONCAT(REPLACE("url"->>'defaultUrl', split_part("url"->>'defaultUrl', '/', -1) , '') ,'Thumbnail_' ,split_part("url"->>'defaultUrl', '/', -1))) end as "mediaUrl"
                 from "Products"
                 LEFT JOIN "Categories" on "Categories".id = "Products"."categoryId"
                 LEFT JOIN "Departments" on "Departments".id = "Categories"."departmentId"
                 LEFT JOIN "Media" ON "Media".id = "Products"."mediaId"
                  
           WHERE "Products"."isDeleted" = false 
          
           AND "Products"."companyId"=$1 
           AND "Products".type = ANY( $2)
           AND (LOWER ("Products".name) ~ $3
                OR LOWER ("Products".barcode) ~ $3
                OR LOWER ("Products".type) ~ $3
                OR LOWER ("Products". "UOM") ~ $3
                OR LOWER ( ("Products"."translation" ->>'name')::jsonb->>'ar' ) ~ $3
                OR LOWER ( ("Products"."translation" ->>'name')::jsonb->>'en' ) ~ $3
                OR "Products"."defaultPrice"::varchar(255)~ $3
                OR LOWER("Departments".name ) ~ $3
                OR LOWER("Categories".name ) ~ $3
                )
          AND ($4::uuid is null or "Products".id <> $4)
          AND  (array_length($5::uuid[], 1) IS NULL OR ("Categories".id=any($5::uuid[])))
          AND (array_length($6::uuid[], 1) IS NULL OR ("Departments".id=any($6::uuid[])))
                ${orderByQuery}
          Limit $7 offset $8)
          select "pro".*,    COALESCE(NULLIF("latest"."cost" , 0), "pro"."unitCost")      as "unitCost"  from "pro"
           LEFT JOIN LATERAL (
                        SELECT imr."cost"
                        FROM "InventoryMovmentRecords" imr
                    
                          WHERE imr."productId" = "pro".id
                          AND imr."branchId" = $9
                          AND imr."qty" >= 0
                        ORDER BY imr."createdAt" DESC
                        LIMIT 1
                    ) latest ON TRUE
      `,
        values: [companyId, filterType, searchValue, productId, categories, departments, limit, offset, branchId]
      }
      let list = await DB.excu.query(query.text, query.values);
      let count = list.rows && list.rows.length > 0 ? Number((<any>list.rows[0]).count) : 0
      let pageCount = Math.ceil(count / limit)

      offset += 1
      let lastIndex = ((page) * limit)
      if (list.rows.length < limit || page == pageCount) {
        lastIndex = count
      }
      const resData = {
        list: list.rows,
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

  public static async getProductsListForSupplier(company: Company, data: any): Promise<ResponseData> {
    try {
      const companyId = company.id;
      const types: [string] = data.types;
      const exclude: [string] = data.exclude;
      const encoleded: [string] = data.include && data.include.length > 0 ? data.include : null;
      let filterType: any = types;
      const filter = data.filter;


      const includedTypes = encoleded ? encoleded : ['service', 'inventory', 'kit', 'package', 'menuItem', 'menuSelection', 'batch', 'serialized']
      if (exclude && exclude.length > 0) {
        filterType = includedTypes.filter(a => !exclude.includes(a));
      } else if (!types && !exclude) {
        filterType = includedTypes
      }

      let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';
      let supplierId = data.supplierId ?? null



      let productId = data.productId ?? null;
      let selectedProductId = data.selectedProductId ?? null;
      let sort = data.sortBy;
      let sortValue = !sort ? '"Products"."createdAt"' : '"' + sort.sortValue + '"';
      if (data.selectedProductId != null && data.selectedProductId != "") {
        sortValue = ` ("Products".id = ` + "'" + data.selectedProductId + "'" + ` )`
      }
      let sortDirection = !sort ? "DESC" : sort.sortDirection;
      let sortTerm = sortValue + " " + sortDirection
      let orderByQuery = ` Order by ` + sortTerm;

      const categories = filter && filter.categories ? filter.categories : [];
      const departments = filter && filter.departments ? filter.departments : [];




      let page = data.page ?? 1;
      let offset = 0;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }


      const query: { text: string, values: any } = {
        text: `

          SELECT 
                 COUNT(*)OVER(),
                 "Products".id,
                 "Products".name,
                 "Products".type,
                 "Products"."UOM",
                 "Products"."barcode",
                 "Categories".name as "categoryName",
                 "Departments".name as "departmentName",
                 case when "Media".id is not null then  JSON_BUILD_OBJECT('thumbnailUrl', CONCAT(REPLACE("url"->>'defaultUrl', split_part("url"->>'defaultUrl', '/', -1) , '') ,'Thumbnail_' ,split_part("url"->>'defaultUrl', '/', -1))) end as "mediaUrl"
                 from "Products"
                 LEFT JOIN "Categories" on "Categories".id = "Products"."categoryId"
                 LEFT JOIN "Departments" on "Departments".id = "Categories"."departmentId"
                 LEFT JOIN "Media" ON "Media".id = "Products"."mediaId"
                 LEFT JOIN "SupplierItems" ON "SupplierItems"."productId" = "Products".id and "SupplierItems"."supplierId" = $7
           WHERE "Products"."isDeleted" = false and "SupplierItems"."productId" is null
          
           AND "Products"."companyId"=$1 
           AND "Products".type = ANY( $2)
           AND (LOWER ("Products".name) ~ $3
                OR LOWER ("Products".barcode) ~ $3
                OR LOWER ("Products".type) ~ $3
                OR LOWER ("Products". "UOM") ~ $3
                OR LOWER ( ("Products"."translation" ->>'name')::jsonb->>'ar' ) ~ $3
                OR LOWER ( ("Products"."translation" ->>'name')::jsonb->>'en' ) ~ $3
                OR "Products"."defaultPrice"::varchar(255)~ $3
                OR LOWER("Departments".name ) ~ $3
                OR LOWER("Categories".name ) ~ $3
                )
          AND ($4::uuid is null or "Products".id <> $4)
          AND  (array_length($5::uuid[], 1) IS NULL OR ("Categories".id=any($5::uuid[])))
          AND (array_length($6::uuid[], 1) IS NULL OR ("Departments".id=any($6::uuid[])))
                ${orderByQuery}
          Limit $8 offset $9
      `,
        values: [companyId, filterType, searchValue, productId, categories, departments, supplierId, limit, offset]
      }
      let list = await DB.excu.query(query.text, query.values);
      let count = list.rows && list.rows.length > 0 ? Number((<any>list.rows[0]).count) : 0
      let pageCount = Math.ceil(count / limit)

      offset += 1
      let lastIndex = ((page) * limit)
      if (list.rows.length < limit || page == pageCount) {
        lastIndex = count
      }
      const resData = {
        list: list.rows,
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

  public static async getProductListByBrnachId(branchId: string) {
    try {
      const query: { text: string, values: any } = {
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

  public static async getBrand(brandId: string) {
    try {
      const query: { text: string, values: any } = {

        text: `SELECT id, "name", "createdAt", "updatedDate", companyid , translation FROM "Brands" WHERE id= $1`,
        values: [brandId]
      }
      const list = await DB.excu.query(query.text, query.values);

      const productQuery = {
        text: `SELECT * FROM "Products" WHERE brandId= $1`,
        values: [brandId]
      }


      const productList = await DB.excu.query(productQuery.text, productQuery.values);
      (<any>list.rows[0]).options = productList.rows;



      return new ResponseData(true, "", list.rows)
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async getInventoryLocations(brandId: string) {
    try {
      const query: { text: string, values: any } = {

        text: `SELECT id, "name", "createdAt", "updatedDate", companyid , translation,"branchId" FROM "inventorylocations" WHERE id= $1`,
        values: [brandId]
      }
      const list = await DB.excu.query(query.text, query.values);

      const productQuery = {
        text: `SELECT "Products".id , "Products".name 
                FROM "BranchProducts"
               inner join "Products" on "BranchProducts"."productId" = "Products".id 
              WHERE "locationId"= $1`,
        values: [brandId]
      }


      const productList = await DB.excu.query(productQuery.text, productQuery.values);
      (<any>list.rows[0]).products = productList.rows;



      return new ResponseData(true, "", list.rows[0])
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async checkIfOrderNameExist(BrandId: string | null, name: string, companyId: string) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Orders" where LOWER(name) = LOWER($1) and id <> $2 and "companyid" = $3`,
      values: [
        name,
        BrandId,
        companyId,

      ],
    };
    if (BrandId == null) {
      query.text = `SELECT count(*) as qty FROM "Orders" where name = $1  and "companyId" = $2 `;
      query.values = [name, companyId];
    }

    const resault = await DB.excu.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }

    return false;
  }
  public static async checkIfBrandNameExist(BrandId: string | null, name: string, companyId: string) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Brands" where LOWER(name) = LOWER($1) and id <> $2 and "companyid" = $3`,
      values: [
        name,
        BrandId,
        companyId,

      ],
    };
    if (BrandId == null) {
      query.text = `SELECT count(*) as qty FROM "Brands" where LOWER(trim(name)) = LOWER(trim($1)) and "companyid" = $2 `;
      query.values = [name, companyId];
    }

    const resault = await DB.excu.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }

    return false;
  }
  public static async insertBrand(client: PoolClient, data: any, company: Company) {
    try {
      const companyId = company.id;
      const brand = new Brands();
      brand.ParseJson(data);
      brand.companyid = companyId;
      const product = data.options;

      let productIds: any[]
      if (product) {

        productIds = product.map((option: { id: string; }) => option.id);
      } else {
        productIds = [];

      }
      brand.updatedDate = new Date();
      const query: { text: string, values: any } = {
        text: 'INSERT INTO "Brands"(name, "companyid", "updatedDate", "translation") VALUES ($1, $2, $3,$4) RETURNING id',
        values: [brand.name, brand.companyid, brand.updatedDate, brand.translation],
      };

      const insert = await client.query(query.text, query.values);
      brand.id = insert.rows[0].id;

      // Update the product table in batches by setting the brand column for options
      const batchSize = 100; // Set the batch size as per your requirement
      const batches = Math.ceil(productIds.length / batchSize);

      for (let i = 0; i < batches; i++) {
        const start = i * batchSize;
        const end = (i + 1) * batchSize;
        const batchProductIds = productIds.slice(start, end);

        const updateQuery: { text: string, values: any } = {
          text: 'UPDATE "Products" SET brandid = $1 , "updatedDate"=$2 WHERE id = ANY ($3::uuid[])',
          values: [brand.id, new Date(), batchProductIds],
        };


        await client.query(updateQuery.text, updateQuery.values);
      }

      const resdata = {
        id: brand.id,
      };
      return new ResponseData(true, "", resdata);
    } catch (error: any) {
    
      throw new Error(error);
    }
  }
  public static async updateBrand(client: PoolClient, data: any, company: Company) {
    try {
      const companyId = company.id;
      const brand = new Brands();
      brand.ParseJson(data);

      brand.companyid = companyId;
      const product = data.options;

      let productIds: any[]
      if (product) {

        productIds = product.map((option: { id: string; }) => option.id);
      } else {
        productIds = [];

      }


      brand.updatedDate = new Date();
      const query: { text: string, values: any } = {
        text: 'UPDATE "Brands" SET name = $1, translation = $2 , "updatedDate" =$3 WHERE id = $4;',
        values: [brand.name, brand.translation, brand.updatedDate, brand.id],
      };

      const resetBrandProducts: { text: string, values: any } = {
        text: 'UPDATE "Products" SET brandid = Null , "updatedDate" =$1  WHERE brandid =  $2',
        values: [brand.updatedDate, brand.id],
      };


      await client.query(query.text, query.values);
      await client.query(resetBrandProducts.text, resetBrandProducts.values);
      // brand.id = insert.rows[0].id;

      // Update the product table in batches by setting the brand column for options
      const batchSize = 100; // Set the batch size as per your requirement
      const batches = Math.ceil(productIds.length / batchSize);

      for (let i = 0; i < batches; i++) {
        const start = i * batchSize;
        const end = (i + 1) * batchSize;
        const batchProductIds = productIds.slice(start, end);

        const updateQuery: { text: string, values: any } = {
          text: 'UPDATE "Products" SET brandid = $1 WHERE id = ANY ($2::uuid[])',
          values: [brand.id, batchProductIds],
        };

        await client.query(updateQuery.text, updateQuery.values);
      }

      const resdata = {
        id: brand.id,
      };
      return new ResponseData(true, "", resdata);
    } catch (error: any) {
    
      throw new Error(error);
    }
  }



  public static async checkIfInventoryLocaionNameExist(client: PoolClient, id: string | null, name: string, branchId: string) {
    try {
      id = id ?? '';

      const query: { text: string, values: any } = {
        text: `SELECT count(*) as qty FROM "inventorylocations" where TRIM(LOWER(name)) = TRIM(LOWER($1)) and id::text <> $2 and "branchId" = $3`,
        values: [
          name,
          id,
          branchId,
        ],
      };

      let resault = await client.query(query.text, query.values);
      if ((<any>resault.rows[0]).qty > 0) {
        return true;
      }

    } catch (error: any) {
      throw new Error(error)
    }
  }


  public static async insertInventoryLocations(client: PoolClient, data: any, company: Company) {
    try {
      const companyId = company.id;
      const inventorylocations = new InventoryLocation();
      inventorylocations.ParseJson(data);
      inventorylocations.companyid = companyId;
      const product = inventorylocations.products;
      let productIds: any[]
      if (product) {

        productIds = product.map((option: { id: string; }) => option.id);
      } else {
        productIds = [];

      }
      let isNameExist = await this.checkIfInventoryLocaionNameExist(client, null, inventorylocations.name, inventorylocations.branchId);
      if (isNameExist) {
        throw new ValidationException("Name Already Used")
      }

      inventorylocations.updatedDate = new Date();
      const query: { text: string, values: any } = {
        text: 'INSERT INTO "inventorylocations"(name, "companyid", "updatedDate", "translation","branchId") VALUES ($1, $2, $3,$4,$5) RETURNING id',
        values: [inventorylocations.name, inventorylocations.companyid, inventorylocations.updatedDate, inventorylocations.translation, inventorylocations.branchId],
      };

      const insert = await client.query(query.text, query.values);
      inventorylocations.id = insert.rows[0].id;

      // Update the product table in batches by setting the brand column for options
      const batchSize = 100; // Set the batch size as per your requirement
      const batches = Math.ceil(productIds.length / batchSize);

      for (let i = 0; i < inventorylocations.products.length; i++) {

        const element: any = inventorylocations.products[i];
        const updateQuery = {
          text: 'UPDATE "BranchProducts" SET "locationId" = $1 WHERE "branchId"=$2 and "productId" = $3',
          values: [inventorylocations.id, inventorylocations.branchId, element.id],
        };


        await client.query(updateQuery.text, updateQuery.values);
      }

      const resdata = {
        id: inventorylocations.id,
      };
      return new ResponseData(true, "", resdata);
    } catch (error: any) {
    
      console.log(error)
      throw new Error(error);
    }
  }
  public static async updateInventoryLocations(client: PoolClient, data: any, company: Company) {
    try {
      const companyId = company.id;
      const inventorylocations = new InventoryLocation();
      inventorylocations.ParseJson(data);

      inventorylocations.companyid = companyId;

      const product = data.options;
      let productIds: any[]
      if (product) {

        productIds = product.map((option: { id: string; }) => option.id);
      } else {
        productIds = [];

      }
      let isNameExist = await this.checkIfInventoryLocaionNameExist(client, inventorylocations.id, inventorylocations.name, inventorylocations.branchId);
      if (isNameExist) {
        throw new ValidationException("Name Already Used")
      }
      inventorylocations.updatedDate = new Date();
      const query: { text: string, values: any } = {
        text: 'UPDATE "inventorylocations" SET name = $1, translation = $2 WHERE id = $3;',
        values: [inventorylocations.name, inventorylocations.translation, inventorylocations.id],
      };

      // const resetBrandProducts = {
      //   text: 'UPDATE "BranchProducts" SET "locationId" = $1 WHERE "branchId"=$2 and "productId" = ANY ($3::uuid[])',
      //   values: [inventorylocations.id],
      // };


      await client.query(query.text, query.values);
      // await client.query(resetBrandProducts.text, resetBrandProducts.values);
      // brand.id = insert.rows[0].id;

      // Update the product table in batches by setting the brand column for options
      const batchSize = 100; // Set the batch size as per your requirement
      const batches = Math.ceil(productIds.length / batchSize);

      for (let i = 0; i < inventorylocations.products.length; i++) {

        const element: any = inventorylocations.products[i];
        let locationId = element.isDeleted ? null : inventorylocations.id
        const updateQuery = {
          text: 'UPDATE "BranchProducts" SET "locationId" = $1 WHERE "branchId"=$2 and "productId" = $3',
          values: [locationId, inventorylocations.branchId, element.id],
        };


        await client.query(updateQuery.text, updateQuery.values);
      }

      const resdata = {
        id: inventorylocations.id,
      };
      return new ResponseData(true, "", resdata);
    } catch (error: any) {
    
      throw new Error(error);
    }
  }













  public static async saveCategoryProducts(client: PoolClient, data: any, company: Company) {
    try {
      const companyId = company.id;
      const CategoryId = data.id;
      const product = data.options;

      const productIds: any[] = product ? product.map((option: { id: string; }) => option.id) : [];



      const resetBrandProducts = {
        text: 'UPDATE "Products" SET "categoryId" = Null WHERE "categoryId" =  $1',
        values: [CategoryId],
      };

      await client.query(resetBrandProducts.text, resetBrandProducts.values);
      const values = product.map((product: any, index: number) => [
        product.id,
        CategoryId,
        index, // or index + 1 if you want 1-based index
        new Date()
      ]);

      if (values.length > 0) {
        const updateQuery = `
              UPDATE "Products"
              SET 
                "categoryId" = data."categoryId"::uuid,
                "categoryIndex" = data."categoryIndex"::int,
                "updatedDate"= data."updatedDate"::timestamp
              FROM (VALUES %L) AS data("id", "categoryId", "categoryIndex","updatedDate")
              WHERE "Products"."id" = data."id"::uuid;
             `;

        const formattedQuery = format(updateQuery, values);
        await client.query(formattedQuery);
      }

      // const batchSize = 100;
      // const batches = Math.ceil(productIds.length / batchSize);

      // for (let i = 0; i < batches; i++) {
      //   const start = i * batchSize;
      //   const end = (i + 1) * batchSize;
      //   const batchProductIds = productIds.slice(start, end);

      //   const updateQuery = {
      //     text: 'UPDATE public."Products" SET "categoryId" = $1 WHERE id = ANY ($2::uuid[])',
      //     values: [CategoryId, batchProductIds],
      //   };

      //   await client.query(updateQuery.text, updateQuery.values);
      // }

      const resdata = {

      };
      return new ResponseData(true, "", resdata);
    } catch (error: any) {
    
      throw new Error(error);
    }
  }
  public static async getProductListByBrnach(data: any, company: any) {
    try {


      const companyId = company.id;
      let selectQuery;
      let selectValues;
      let countValues;
      let searchValue = '[A-Za-z0-9]*';
      let offset = 0;

      let count = 0;
      let pageCount = 0;

      let page = data.page ?? 1;
      let types = ["inventory", "batch", "serialized", "service", "menuSelection", "menuItem", "package", "kit", 'tailoring']
      if (data.filter && data.filter.type && data.filter.type.length > 0) {
        types = data.filter.type;

      }
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }
      const categories = data.filter && data.filter.categories ? data.filter.categories : [];
      const departments = data.filter && data.filter.departments ? data.filter.departments : [];
      let sort = data.sortBy;
      let sortValue = !sort ? '"Products"."createdAt"' : '"' + sort.sortValue + '"';
      let outerSortValue = !sort ? '"products"."createdAt"' : '"' + sort.sortValue + '"';
      let sortDirection = !sort ? "DESC" : sort.sortDirection;
      let sortTerm = sortValue + " " + sortDirection
      let outerSortTerm = outerSortValue + " " + sortDirection
      let orderByQuery = ` Order by ` + sortTerm;
      let outerOrderByQuery = ` Order by ` + outerSortTerm;
      selectQuery = `with "products" as (
        select
        count(*) over(),
        "Products".id as "productId",
        "Products".name as "productName",
        "Products"."createdAt",
          "Products"."defaultPrice"
        from "Products"
                 LEFT JOIN "Categories" on "Categories".id = "Products"."categoryId"
                 LEFT JOIN "Departments" on "Departments".id = "Categories"."departmentId"
        where "Products"."companyId" = $1
        AND (lower ("Products".name) ~ $2 OR lower ("Products".barcode) ~ $2     OR LOWER("Departments".name ) ~ $2
        OR LOWER("Categories".name ) ~ $2)
        AND "Products".type = ANY( $3)
                 AND  (array_length($4::uuid[], 1) IS NULL OR ("Categories".id=any($4::uuid[])))
            AND (array_length($5::uuid[], 1) IS NULL OR ("Departments".id=any($5::uuid[])))
        AND "Products"."isDeleted" = false
        ${orderByQuery}
        limit $6 offset $7
        
     ),
     "branches" as (
     select "products"."productId",
       "Branches".id as "branchId",
          "Branches".name as "branchName",
          "BranchProducts"."price"
           from "products"
     left join "BranchProducts" on "BranchProducts"."productId" = "products"."productId" 
       left join "Branches" on  "BranchProducts"."branchId" = "Branches".id
     )     
   select "products".* ,
          (select json_agg(json_build_object('branchName',"branches"."branchName",'price',"branches"."price",'branchId',"branches"."branchId")) from "branches" where "branches"."productId" = "products"."productId") as "branches"
   from "products"
   ${outerOrderByQuery}
      `
      if (data && data.searchTerm != "" && data.searchTerm != null) {
        searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`

      }
      selectValues = [companyId, searchValue, types, categories, departments, limit, offset]

      countValues = [companyId, searchValue]



      const selectList: any = await DB.excu.query(selectQuery, selectValues)
      count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
      pageCount = Math.ceil(count / data.limit)

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
      //   text: ``, values: [company.id]

      // }
      // const list = await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", resData)
    } catch (error: any) {
    
      throw new Error(error)
    }
  }

  // select id ,"name", "translation"  from "Brands" where companyid = $1
  public static async getBrandList(data: any, company: any) {
    try {
      const companyId = company.id;

      let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';

      let sort = data.sortBy;
      let sortValue = !sort ? '"Brands"."createdAt"' : '"' + sort.sortValue + '"';
      let sortDirection = !sort ? "DESC" : sort.sortDirection;

      if (data.brandId != null && data.brandId != "") {
        sortValue = ` ("Brands".id = ` + "'" + data.brandId + "'" + ` )`
      }
      let sortTerm = sortValue + " " + sortDirection
      let orderByQuery = ` Order by ` + sortTerm;


      let offset = 0;
      let page = data.page ?? 1
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }

      const query: { text: string, values: any } = {
        text: `select 
      count(*) over(),
      id ,"name", "translation"  
      from "Brands"
      WHERE companyId=$1
      AND (LOWER ("Brands".name) ~ $2
           OR LOWER ( ("translation" ->>'name')::jsonb->>'ar' ) ~ $2
           OR LOWER ( ("translation" ->>'name')::jsonb->>'en' ) ~ $2)
      ${orderByQuery}
      Limit $3 offset $4`,
        values: [companyId, searchValue, limit, offset]
      }
      let list = await DB.excu.query(query.text, query.values);
      let count = list.rows && list.rows.length > 0 ? Number((<any>list.rows[0]).count) : 0
      let pageCount = Math.ceil(count / limit)

      offset += 1
      let lastIndex = ((page) * limit)
      if (list.rows.length < limit || page == pageCount) {
        lastIndex = count
      }
      const resData = {
        list: list.rows,
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
  //select id ,"name", "translation"  from "inventorylocations" where companyid = $1
  public static async getInventoryLocationsList(data: any, company: any) {
    try {
      const companyId = company.id;
      const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : [];

      let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';
      let sort = data.sortBy;
      let sortValue = !sort ? '"inventorylocations"."createdAt"' : '"' + sort.sortValue + '"';
      let sortDirection = !sort ? "DESC" : sort.sortDirection;
      if (data.locationId != null && data.locationId != "") {
        sortValue = ` ("inventorylocations".id = ` + "'" + data.locationId + "'" + ` )`
      }
      let sortTerm = sortValue + " " + sortDirection
      let orderByQuery = ` Order by ` + sortTerm;


      let offset = 0;
      let page = data.page ?? 1;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }

      const query: { text: string, values: any } = {
        text: `select count(*) over(),
                     "inventorylocations".id ,
                      "inventorylocations"."name",
                      "inventorylocations"."translation",
                      "Branches".name as "branchName" 
              from "inventorylocations"
              LEFT JOIN "Branches" ON "Branches".id = "inventorylocations"."branchId"
              WHERE "inventorylocations".companyId=$1
              AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
              AND (LOWER ("inventorylocations".name) ~ $3
                      OR LOWER ( ("inventorylocations"."translation" ->>'name')::jsonb->>'ar' ) ~ $3
                      OR LOWER ( ("inventorylocations"."translation" ->>'name')::jsonb->>'en' ) ~ $3)
                      ${orderByQuery}
              Limit $4 offset $5`,
        values: [companyId, branches, searchValue, limit, offset]
      }

      let list = await DB.excu.query(query.text, query.values);
      let count = list.rows && list.rows.length > 0 ? Number((<any>list.rows[0]).count) : 0
      let pageCount = Math.ceil(count / limit)

      offset += 1
      let lastIndex = ((page) * limit)
      if (list.rows.length < limit || page == pageCount) {
        lastIndex = count
      }
      const resData = {
        list: list.rows,
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
  public static async updateBulkPrices(data: any) {
    try {
      const query: { text: string } = {
        text: `UPDATE "BranchProducts" SET  price=$1 WHERE "productId"=$2 and  "branchId"=$3;`
      }

      // data.list.forEach(async (element: { id: any; price: any; }) => {


      //   await DB.excu.query(query.text, [element.id, element.price]);
      // });

      for (let index = 0; index < data.length; index++) {
        const element = data[index];
        for (let index = 0; index < element.branches.length; index++) {
          const branch = element.branches[index];
          await DB.excu.query(query.text, [branch.price, element.productId, branch.branchId])
        }
      }
      return new ResponseData(true, "", [])
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async updateTranslation(data: any) {
    try {
      const query: { text: string } = {
        text: `UPDATE "Products" SET  translation=$2 WHERE id=$1;`
      }

      data.list.forEach(async (element: { id: any; translation: any; }) => {
        await DB.excu.query(query.text, [element.id, element.translation]);
      });

      return new ResponseData(true, "", [])
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async setProductColor(data: any) {
    try {
      const date = new Date();

      const query: { text: string, values: any } = {
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
      const query: { text: string, values: any } = {
        text: `UPDATE "Products" SET "defaultImage"=$1 WHERE id=$2 `,
        values: [imagePath, productId]
      }
      await client.query(query.text, query.values)
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async setProductUnitCost(client: PoolClient, unitCost: number, productId: string, afterDecimal: number) {
    try {
      const query: { text: string, values: any } = {
        text: `UPDATE "Products" set "unitCost"=$1 where id =$2`,
        values: [unitCost, productId]
      }




      await client.query(query.text, query.values)
      await this.setChildsUnitCost(client, productId, afterDecimal)
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async setChildsUnitCost(client: PoolClient, productId: string, afterDecimal: number) {
    try {
      const query = {
        text: `with "childUnitCost" as (
              select "Products".id,
              ("parentPro"."unitCost"/"Products"."childQty") as "unitCost"
                from "Products" 
              inner join "Products" "parentPro" on "Products" ."parentId" ="parentPro".id
              where "Products"."parentId" =$1

              ) 

              update "Products"  set "unitCost" = t."unitCost" from (select * from   "childUnitCost" )t
              where "Products".id = t.id `,
        values: [productId]
      }

      await client.query(query.text, query.values)
    } catch (error: any) {
      throw new Error(error)
    }
  }
  //calculate and set  product  avarge unit cost  and new   product  on HAND  
  public static async calculateUnitCostAvg(client: PoolClient, productId: any, branchId: string, qty: number, unitCost: number, afterDecimal: number, isInclusiveTax: boolean | null = null, taxTotal: number | null = null) {
    const branchProductData = await BranchProductsRepo.getBranchProductAndUnitCost(client, productId, branchId);
    const branchProduct = new BranchProducts();
    branchProduct.ParseJson(branchProductData);

    //calculate new unitCost by Avarage
    // average = (oldUnitCost * oldOnHand) + (UnitCostAtPurchased * QtyAtPurchased) /  (oldOnHand +QtyAtPurchased)
    const oldonHand = branchProductData.onHand;
    const oldUnitCost = Helper.roundDecimal(branchProductData.unitCost, afterDecimal)// existing unitCost 
    const newQty = Helper.add(branchProduct.onHand, qty, afterDecimal)
    // const newQty = branchProductData.onHand + branchProductData.openingBalance < 0 ? qty : Helper.add(branchProduct.onHand, qty, afterDecimal)
    const oldCost = Helper.multiply(oldUnitCost, branchProduct.onHand, afterDecimal) // existing totalCost 
    const newCost = isInclusiveTax && taxTotal ? Helper.multiply(qty, unitCost, afterDecimal) - taxTotal : Helper.multiply(qty, unitCost, afterDecimal)   // new totalCost 
    const average = newQty == 0 || branchProduct.onHand < 0 || (oldCost + newCost) == 0 ? unitCost : Helper.division((oldCost + newCost), newQty, afterDecimal)

    //update the current product unitCost 
    await ProductRepo.setProductUnitCost(client, average, productId, afterDecimal)

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
      const query: { text: string, values: any } = {
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
      const query: { text: string, values: any } = {
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

  public static async deleteInventoryProductFromRecipes(client: PoolClient, productId: string) {
    try {
      const query = {
        text: `with "products" as (select "Products".id , recipes from "Products", json_array_elements(recipes) as el 
        where "recipes" is not null  and recipes::text <> '[]'
        and (el->>'inventoryId') !=''
        and (el->>'inventoryId')::uuid = $1
        group by  "Products".id), 
        
        "updatedProducts" as (
        select  products.id , json_agg(el) filter (where (el ->> 'inventoryId')::uuid <> $1 )as "tempRecipes" 
            from products , json_array_elements(recipes) as el 
        
           group by id
        )
        update "Products" set recipes = t ."tempRecipes"  from (select * from "updatedProducts") t 
        where "Products".id = t .id 
        `,
        values: [productId]

      }

      await client.query(query.text, query.values)
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async deleteInventoryProductFromOptionsRecipes(client: PoolClient, productId: string) {
    try {
      const query = {
        text: `with "options" as (select "Options".id , recipe from "Options", jsonb_array_elements(recipe) as el 
        where "recipe" is not null  and recipe::text <> '[]'
        and (el->>'inventoryId') !=''
        and (el->>'inventoryId')::uuid = $1
        group by  "Options".id), 
        
        "updatedOptions" as (
        select  "options".id , json_agg(el) filter (where (el ->> 'inventoryId')::uuid <> $1 )as "tempRecipes" 
        from "options" , jsonb_array_elements(recipe) as el 
     
           group by id
        )
        update "Options" set recipe = t ."tempRecipes"  from (select * from "updatedOptions") t 
        where "Options".id = t .id 
        `,
        values: [productId]

      }

      await client.query(query.text, query.values)
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async deleteRecipeItems(client: PoolClient, productId: string) {
    try {
      const query = {
        text: `with "recipes" as (select "Recipe".id , items from "Recipe", jsonb_array_elements(items) as el 
        where "items" is not null  and items::text <> '[]'
        and (el->>'inventoryId') !=''
        and (el->>'inventoryId')::uuid = $1
        group by  "Recipe".id), 
        
        "updatedOptions" as (
        select  "recipes".id , json_agg(el) filter (where (el ->> 'inventoryId')::uuid <> $1 )as "tempRecipes" 
        from "recipes" , jsonb_array_elements(items) as el 
           group by id
		
        )
        update "Recipe" set items =  case when t ."tempRecipes" is null then '[]' else t ."tempRecipes" end   from (select * from "updatedOptions") t 
        where "Recipe".id = t .id 
        `,
        values: [productId]

      }

      await client.query(query.text, query.values)
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async deleteProduct(productId: string, employeeId: string, company: Company) {
    const client = await DB.excu.client();
    try {

      await client.query("BEGIN")
      let product = await this.getProductNameAndBarcode(client, productId);
      let name = product.name;
      let barcode = product.barcode;
      let type = product.type;
      const afterDecimal = company.afterDecimal

      /**Calculate Inventory Movment*/
      let res = new ResponseData(true, "", { "movments": [] });
      switch (type) {
        case "inventory":

          res = await this.deleteInventoryProduct(client, productId, employeeId, afterDecimal)
          break;
        case "batch":
          res = await this.deleteBatcProduct(client, productId, employeeId, afterDecimal)

          break;
        case "serialized":
          res = await this.deleteSerialProduct(client, productId, employeeId, afterDecimal)
          break;
        default:
          break;
      }
      /**Delete Product Barcodes Alias */
      await this.deleteProductBarcodes(client, productId)
      /**Remove Product From Menu */
      await MenuRepo.deleteMenuSectionProduct(client, productId)



      //TODO: TEST THE BELOW TO DELETE INVENTORY FROM RECIPES 

      // /** Remove from other products recipes */
      // await this.deleteInventoryProductFromRecipes(client, productId)
      // /** Remove from options recipe */
      // await this.deleteInventoryProductFromOptionsRecipes(client, productId);
      // /**Delete Product From Recipes */
      // await this.deleteInventoryProductFromRecipes(client,product)

      /**Update Product set isDeleted = true and change product name and barcode */
      if (name) {
        name += ' [Deleted]'
        if (barcode != null && barcode != "") {
          barcode += ' [Deleted]'
        }

        let updateDate = new Date();
        const query: { text: string, values: any } = {
          text: `UPDATE "Products" set "name"=$1,barcode=$2, "isDeleted"=true ,"updatedDate"=$3 where id=$4 `,
          values: [name, barcode, updateDate, productId]
        }
        await client.query(query.text, query.values);

        let getEmployeeName = {
        text: `SELECT "Employees"."name" as "employeeName"
                  FROM "Employees"
                  WHERE "Employees".id = $1 and "Employees"."companyId" = $2
                        `,
        values: [employeeId, company.id]
      }
      let employeeName = (await client.query(getEmployeeName.text, getEmployeeName.values)).rows[0].employeeName;



        let log = new Log();
        log.employeeId = employeeId
        log.action = "Item Deleted"
        log.comment = `${employeeName} has deleted the item (${product.name})`

        log.metaData = {
          "itemName": product.name,
          "deleted": true
        }

        await LogsManagmentRepo.manageLogs(client, "Products", productId, [log],null, company.id, employeeId, "", "Cloud")




        await client.query("COMMIT")

        return new ResponseData(true, "Deleted Successfully", res.data)
      }

      return new ResponseData(false, "", [])

    } catch (error: any) {
      await client.query("ROLLBACK")

      throw new Error(error)
    } finally {
      client.release()
    }
  }
  public static async deleteSerialProduct(client: PoolClient, productId: string, employeeId: string, afterDecimal: number) {
    try {

      const query: { text: string, values: any } = {
        text: `SELECT 
                     sum("ProductSerials"."unitCost")as "totalUnitCost",
                     count("ProductSerials".id) as "onHand" ,
                     "BranchProducts"."branchId"
                     FROM "BranchProducts" 
                     inner join "ProductSerials" on "ProductSerials"."branchProductId" = "BranchProducts".id
                     where "productId" =$1
                     group by "branchId"
                     `,
        values: [productId]
      }

      let products = await client.query(query.text, query.values);
      let movments = [];
      let branches = []
      for (let index = 0; index < products.rows.length; index++) {
        const element = products.rows[index];
        let onHand = element.onHand * (-1);
        let totalCost = element.totalUnitCost * (-1); //deleted product *(-1) decrease in qty
        let branchId = element.branchId;
        let movmentId = await ManualAdjusmentRepo.manualAdjustmentMovment(client, employeeId, element.totalUnitCost, onHand, branchId, onHand * (-1), totalCost * (-1), productId, afterDecimal, "Manual Adjusment", null, null)
        branches.push(branchId)
        movments.push(movmentId)
      }
      await SerialProductRepo.deleteProductSerials(client, productId)

      return new ResponseData(true, "", { movments: movments, branches: branches, type: 'inventory' })
    } catch (error: any) {
      throw new Error(error)
    }
  }
  public static async deleteBatcProduct(client: PoolClient, productId: string, employeeId: string, afterDecimal: number) {
    try {


      const query: { text: string, values: any } = {
        text: `SELECT 
                     "ProductBatches"."unitCost"as "unitCost",
                     COALESCE("ProductBatches"."onHand",0) as "onHand" ,
                      "BranchProducts"."branchId"
                      FROM "BranchProducts" 
                      inner join "ProductBatches" on "ProductBatches"."branchProductId" = "BranchProducts".id
                      where  "BranchProducts"."productId" =$1
                      group by "ProductBatches"."onHand" ,  "BranchProducts".id,   "ProductBatches"."unitCost" 
                     `,
        values: [productId]
      }
      let products = await client.query(query.text, query.values);
      let movments = [];
      for (let index = 0; index < products.rows.length; index++) {
        const element = products.rows[index];
        let onHand = element.onHand * (-1);
        let totalCost = element.unitCost * element.onHand * (-1); //deleted product *(-1) decrease in qty
        let branchId = element.branchId;
        let movmentId = await ManualAdjusmentRepo.manualAdjustmentMovment(client, employeeId, element.unitCost, onHand, branchId, onHand * (-1), totalCost * (-1), productId, afterDecimal, "Manual Adjusment", null, null)
        movments.push(movmentId)
      }

      await BatchProductRepo.deleteProductBatches(client, productId)
      return new ResponseData(true, "", { movments: movments })
    } catch (error: any) {
      throw new Error(error)
    }
  }
  public static async deleteInventoryProduct(client: PoolClient, productId: string, employeeId: string, afterDecimal: number) {
    try {
      const query: { text: string, values: any } = {
        text: `WITH branchProducts AS (
    SELECT *
    FROM "BranchProducts"
    WHERE "productId" = $1
      AND "onHand" > 0
),
Costs AS (
    SELECT 
        pc."branchId",
        pc."productId",
        pc."qty" AS "costQty",
        pc."cost" AS "costPerUnit",
        bp."onHand",
        SUM(pc."qty") OVER (PARTITION BY pc."branchId", pc."productId" ORDER BY pc."createdAt" DESC) AS "cumulativeQty"
    FROM "ProductCosts" pc
    INNER JOIN branchProducts bp
      ON bp."branchId" = pc."branchId"
     AND bp."productId" = pc."productId"
),
FilteredCosts AS (
    SELECT *,
           CASE 
               WHEN "cumulativeQty" - "costQty" < "onHand" 
                    AND "cumulativeQty" >= "onHand"
               THEN "onHand" - ("cumulativeQty" - "costQty")
               WHEN "cumulativeQty" <= "onHand" THEN "costQty"
               ELSE 0
           END AS "appliedQty"
    FROM Costs
    WHERE "cumulativeQty" - "costQty" < "onHand" -- Include only relevant rows
)
SELECT 
    "branchId",
    "productId",
    "costQty",
    "costPerUnit",
    "appliedQty"
FROM FilteredCosts
WHERE "appliedQty" > 0;
                     `,
        values: [productId]
      }
      let products = await client.query(query.text, query.values);
      let movments = [];
      let branches = [];
      for (let index = 0; index < products.rows.length; index++) {
        const element = products.rows[index];
        console.log("eeeeeeeeeeeeeeeeeeeeeeeeeeee", element)
        let onHand = element.appliedQty * (-1);
        let totalCost = element.appliedQty * element.costPerUnit; //deleted product *(-1) decrease in qty
        let branchId = element.branchId;
        branches.push(branchId)
        if (element.appliedQty > 0) {
          let movmentId = await ManualAdjusmentRepo.manualAdjustmentMovment(client, employeeId, element.costPerUnit, onHand, branchId, onHand, totalCost, productId, afterDecimal, "Manual Adjusment", null, null)
          movments.push(movmentId)
        }

        await this.setOnHandOpeningBalanceToZero(client, branchId, productId)
      }


      console.log(movments)
      return new ResponseData(true, "", { movments: movments, type: 'inventory', branches: branches })
    } catch (error: any) {
      console.log(error)
      throw new Error(error)
    }
  }
  protected static async deleteProductBarcodes(client: PoolClient, productId: string) {
    try {
      const qty = {
        text: `DELETE FROM "ProductBarcodes" where "productId" =$1`,
        values: [productId]
      }
      await client.query(qty.text, qty.values);

    } catch (error: any) {
      throw new Error(error)
    }
  }
  //Socket
  public static async branchesAvailability(client: PoolClient, productId: string, companyId: string) {

    try {

      const query: { text: string, values: any } = {
        text: `SELECT 
                  "branch",
                   sum("onHand") as "onHand" 
              FROM "ProductsOnHands"
              WHERE "companyId"=$1
              AND "productId"=$2
              group by "ProductsOnHands".branch`,
        values: [companyId, productId]
      }
      const branches = await client.query(query.text, query.values)

      return new ResponseData(true, "", branches.rows)


    } catch (error: any) {

    
    }
  }
  public static async getProductsOnHand(client: PoolClient, productIds: any[string], branchId: string) {
    try {
      const query: { text: string, values: any } = {
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

  public static async getItemAvailability(data: any, branchId: string) {
    try {


      let searchValue = data.searchTerm && data.searchTerm.trim() != '' && data.searchTerm != null ? data.searchTerm.toLowerCase().trim() : null;

      let page = data.page ?? 1;
      const limit = ((data.limit == null) ? 7 : data.limit);
      let offset = (limit * (page - 1))

      let categoryId = data.categoryId;
      let brandId = data.brandId;
      let type = data.type;
      let minPrice = data.minPrice;
      let maxPrice = data.maxPrice;

      console.log(data)
      if (data == null || data.page == null) {


        const query: { text: string, values: any } = {
          text: `Select "productId","Products".name as "productName",     case when "isSaleItem" = false then false else  "BranchProducts".available end as "available","availableOnline" , "Products"."categoryId"
                from "BranchProducts" 
                inner join "Products" on "Products".id = "BranchProducts"."productId"
                where "branchId" = $1
                and "Products"."isDeleted" = false
                 
                `,
          values: [branchId]
        }
        const items = await DB.excu.query(query.text, query.values);
        return new ResponseData(true, "", items.rows)
      } else {
        const query: { text: string, values: any } = {
          text: `Select 
                count(*) over() as "count",  
               "productId","Products".name as "productName",     case when "isSaleItem" = false then false else  "BranchProducts".available end as "available","availableOnline" , "Products"."categoryId" , CASE WHEN  json_array_length(COALESCE("optionGroups",'[]')) > 0 OR  json_array_length(COALESCE("quickOptions",'[]')) > 0 THEN TRUE ELSE FALSE  END "hasOptions"
                from "BranchProducts" 
                inner join "Products" on "Products".id = "BranchProducts"."productId"
                where "branchId" = $1
                AND ($2::text IS NULL OR trim(Lower("Products".name))  ~ $2::text)
                and "Products"."isDeleted" = false
                and($3::uuid is null or  "Products"."categoryId"=$3)
                and($4::uuid is null or  "Products"."brandid"=$4)
                and($5::text is null or  "Products"."type"=$5)
                and($6::float is null or COALESCE( "BranchProducts"."price","Products"."defaultPrice" ) >= $6 )
                and($7::float is null or COALESCE( "BranchProducts"."price","Products"."defaultPrice" ) <= $7 )
                order by "Products"."createdAt" DESC
                limit $8
                offset $9 
                `,
          values: [branchId, searchValue, categoryId, brandId, type, minPrice, maxPrice, limit, offset]
        }
        const items = await DB.excu.query(query.text, query.values);

        let count = items.rows && items.rows.length > 0 ? Number((<any>items.rows[0]).count) : 0
        let pageCount = Math.ceil(count / limit)

        return new ResponseData(true, "", { items: items.rows, pageCount: pageCount })
      }
    } catch (error: any) {
      console.log(error)
      throw new Error(error)
    }
  }





  public static async setProductAvailaibility(data: any, branchId: string) {
    const client = await DB.excu.client();
    try {
      await client.query("BEGIN")
      const query: { text: string } = {
        text: `UPDATE "BranchProducts" 
                         SET available = $1, 
                         "availableOnline" = $2
                         WHERE "branchId"=$3
                         AND "productId"=$4`
      }

      for (let index = 0; index < data.length; index++) {

        const element = data[index];
        //TODO Batch
        await client.query(query.text, [element.available, element.availableOnline, branchId, element.productId]);
        await MenuRepo.GruptechItemAvailable(client, branchId, element.productId, element.availableOnline)
        await client.query("COMMIT")
      }
    } catch (error: any) {
      await client.query("ROLLBACK")
    
      throw new Error(error)
    } finally {
      client.release()
    }
  }

  public static async getProductAvailability(productId: string, companyId: string) {

    try {


      const data = await this.getFIFOProductAvailablity(productId, companyId)

      return data


    } catch (error: any) {
    
      throw new Error(error)

    }
  }


  public static async getUnitCost(client: PoolClient, prodcutIds: any[], branchId: string) {
    try {
      const query = {
        text: `with "products" as (
                select "ProductCosts"."lineId", 
                        "ProductCosts"."productId",
                        "ProductCosts"."cost",
                        "ProductCosts"."branchId",
                        "Branches"."name" as "branchName",
                        COALESCE( sum("InventoryMovmentRecords"."qty"),0) as "remainingQty"
                  from "ProductCosts"
                      left JOIN "InventoryMovmentRecords" on "InventoryMovmentRecords"."costId" =  "ProductCosts"."lineId"
                      INNER JOIN "Branches" on "Branches".id = "ProductCosts"."branchId"
                       where  "ProductCosts"."productId" =any($1)
                      and  "ProductCosts"."branchId" =$2
                  group by "ProductCosts"."lineId" , "ProductCosts"."cost" ,   "ProductCosts"."qty","Branches"."name", "ProductCosts"."branchId"), "productQty" as (
                              select
                                      "products"."branchId",
                                      "branchName" as "branch", 
                                      "cost" as  "unitCost",
                                "productId"
                              row_number() over(partition by "productId" order by "createdAt" asc) as "rowNumber"
                                      from "products"
                                      where "remainingQty" > 0 
                              group by  "products"."branchId",  "branchName"
                          )
                              
                              select * from "productQty"
                              where "rowNumber" = 1 

                `,
        values: [prodcutIds, branchId]
      }
    } catch (error: any) {
      throw new Error(error)
    }
  }
  public static async getBranchProductById(client: PoolClient, productId: string, branchId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT
        case when "isSaleItem" = false then false else  BranchProducts.available end as "available",
        BranchProducts.price,
        BranchProducts. "onHand" as "onHand",
        BranchProducts."priceBoundriesFrom",
        BranchProducts."priceBoundriesTo",
        BranchProducts."buyDownPrice",
        BranchProducts."buyDownQty",
        BranchProducts."buyDownQty",
        BranchProducts."priceByQty",
        BranchProducts."selectedPricingType",
        BranchProducts."notAvailableOnlineUntil",
        Products.id ,
          Products."defaultOptions" ,
        Products."companyId" ,
        Products."parentId",
         Products."measurements",
        Products."childQty",
        Products.name,
           Products."productAttributes",
        "Media".id as "mediaId",
        "Media"."url" as "mediaUrl",
        Products.barcode,
        Products."defaultPrice",
        Products.description,
        Products.translation,
        Products."categoryId",
        Products."preparationTime",
        Products.type,
        Products.taxes,
        Products."taxId",
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
        Products."orderByWeight",
        Products."commissionPercentage",
        Products."commissionAmount",
        Products."sku",
        Products."priceModel",
              Products."isDiscountable",
        Products."alternativeProducts",
        Products."kitchenName",
        Products."maxItemPerTicket",
        "Brands".name as "brandName",
                           case when "customFields" is not null and jsonb_typeof("customFields") = 'object' then  (SELECT jsonb_agg(jsonb_build_object('id', key, 'value', value)) AS "customFields"
FROM      jsonb_each("customFields") AS kv(key, value)) else  "customFields" end  as "customFields",
        Products."brandid",
        BranchProducts.id as "branchProductId",
          BranchProducts."excludedOptions",
        (select json_agg(json_build_object('batch', batch , 'unitCost', "unitCost", 'expireDate', "expireDate",'onHand', ProductBatches."onHand")) AS batches from  "ProductBatches" as ProductBatches where BranchProducts.id = ProductBatches."branchProductId"),
        (select json_agg(json_build_object('serial', serial , 'status', "status")) AS serials from  "ProductSerials" as ProductSerials where BranchProducts.id = ProductSerials."branchProductId"),
        (select json_agg(json_build_object('barcode', barcode )) AS barcodes from  "ProductBarcodes" as ProductBarcodes where Products.id = ProductBarcodes."productId"),
        (select json_agg(json_build_object('employeeId', "employeeId" ,'price',price,'serviceTime',"serviceTime")) AS EmployeePrices   FROM "EmployeePrices" as EmployeePrices where Products.id = EmployeePrices."productId")
        FROM "BranchProducts" AS BranchProducts 
        inner JOIN "Products" AS Products ON BranchProducts."productId" = Products.id 
        left join "Media" on "Media".id = Products."mediaId"
        LEFT JOIN "Brands" on "Brands".id = Products."brandid"
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



  public static async checkImportProductType(data: any) {
    let resault;
    switch (data.type) {
      case "service":
        resault = await ProductValidation.serviceValidation(data);
        break;
      case "inventory":
        resault = await ProductValidation.InventoryValidation(data);
        break;
      case "kit":
        resault = await ProductValidation.kitValidation(data);
        break;
      case "package":
        resault = await ProductValidation.packageValidation(data);
        break;
      case "menuItem":
        resault = await ProductValidation.MenuItemValidation(data);
        break;
      case "menuSelection":
        resault = await ProductValidation.MenuSelectionValidation(data);
        break;
      case "batch":
        resault = await ProductValidation.BatchValidation(data);
        break;
      case "serialized":
        resault = await ProductValidation.SerialValidation(data);
        break;
      case "tailoring":

        break;
      default:
        resault = { valid: false, error: "invalid type" };
        break;
    }
    return resault;
  }


  public static async saveImportProducts(client: PoolClient, data: any, company: Company) {

    let validate = await this.checkImportProductType(data);
    if (validate && !validate.valid) {
      return new ResponseData(false, "", { productName: data.name, error: validate.error })
    }
    data.isDeleted = false;
    data.createdAt = new Date();
    data.updatedDate = new Date();
    // data.taxId = (await TaxesRepo.getDefaultTax(client,company.id)).data.id;

    let product = data
    product.id = Helper.createGuid()
    const query: { name: string, text: string, values: any } = {
      name: 'importProductInsert',
      text: `INSERT INTO "Products"
                     (id,
                      name,
                      "barcode",
                      "defaultPrice",
                      description,
                      "categoryId",
                      tags,
                      type,
                      warning,
                     "UOM",
                     "unitCost",
                     "companyId",
                     "commissionPercentage",
                     "commissionAmount",
                     "isDiscountable",
                     "updatedDate",
                     "serviceTime",
                     "isDeleted",
                     "taxId",
                     "createdAt",
                     "translation",
                     "brandid",
                     "kitchenName",
                     "isTaxable",
                     "sku"
                   ) 
                     VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) `,
      values: [
        product.id,
        product.name,
        product.barcode,
        product.defaultPrice,
        product.description,
        product.categoryId,
        product.tags,
        product.type,
        product.warning,
        product.UOM,
        product.unitCost,
        product.companyId,
        product.commissionPercentage,
        product.commissionAmount,
        product.isDiscountable,
        product.updatedDate,
        product.serviceTime,
        product.isDeleted,
        product.taxId,
        product.createdAt,
        product.translation,
        product.brandid,
        product.kitchenName,
        product.isTaxable,
        product.sku
      ],
    };
    let inster = await client.query(query) // await client.query(query.text, query.values);
    //  const productId  = inster.rows[0].id;
    // product.id = inster.rows[0].id;
    for (let index = 0; index < product.branchProduct.length; index++) {
      const element = product.branchProduct[index];
      element.productId = product.id;
      element.available = true;
      element.openingBalanceCost = product.unitCost
      query.name = `branchProductInsert`
      query.text = `INSERT INTO "BranchProducts" ("productId","branchId","companyId","openingBalanceCost") VALUES ($1,$2,$3,$4)`
      // query.text = `EXECUTE BranchProductInsert ($1,$2,$3)`
      query.values = [element.productId, element.branchId, product.companyId, product.unitCost];
      await client.query(query.text, query.values);
    }


    if (product.barcodes && product.barcodes.length > 0) {
      for (let index = 0; index < product.barcodes.length; index++) {
        const barcode: any = product.barcodes[index].barcode;
        // const isBarcodeExist = await ProductRepo.checkIfBarcodeExists(client,null,barcode,company.id);
        // if(isBarcodeExist)
        // {
        //   return new ResponseData(false,"",{ productName: data.name, error: "Product Barcode Already Used, Barcode = " + barcode })
        // }
        await ProductRepo.insertProductBarcodes(client, barcode, product.id, company.id)
      }
    }



    return new ResponseData(true, "", { productId: product.id });
  }

  /** TODO:VALIDATION OF PRODUCTS */
  public static async updateImportProducts(client: PoolClient, data: any, company: Company) {

    let validate = await this.checkImportProductType(data);
    if (validate && !validate.valid) {
      return new ResponseData(false, "", { productName: data.name, error: validate.error })
    }
    data.isDeleted = false;
    data.createdAt = new Date();
    data.updatedDate = new Date();
    // data.taxId = (await TaxesRepo.getDefaultTax(client,company.id)).data.id;

    let product = data;
    const query: { name: string, text: string, values: any } = {
      name: "updateImportProduct",
      text: `UPDATE "Products"
                       set 
                      "barcode"=$1,
                      "defaultPrice"=$2,
                      description=$3,
                      "categoryId"=$4,
                      tags=$5,
                      warning=$6,
                     "UOM"=$7,
                     "unitCost"=$8,
                     "commissionPercentage"=$9,
                     "commissionAmount"=$10,
                     "isDiscountable"=$11,
                     "updatedDate"=$12,
                     "serviceTime"=$13,
                     "isDeleted"=$14,
                     "taxId"=$15 ,
                     "translation"=$16,
                     "brandid"=$17,
                     "sku"=$18,
                     "kitchenName" = $19,
                     "name"=$20
                     WHERE id=$21`,
      values: [

        product.barcode,
        product.defaultPrice,
        product.description,
        product.categoryId,
        product.tags,
        product.warning,
        product.UOM,
        product.unitCost,
        product.commissionPercentage,
        product.commissionAmount,
        product.isDiscountable,
        product.updatedDate,
        product.serviceTime,
        product.isDeleted,
        product.taxId,
        product.translation,
        product.brandid,
        product.sku,
        product.kitchenName,
        product.name,
        product.id
      ],
    };
    console.log(query.values)
    let inster = await client.query(query.text, query.values);

    // for (let index = 0; index < product.branchProduct.length; index++) {
    //   const element = product.branchProduct[index];
    //   element.productId = product.id;
    //   element.available = true;

    //   query.text = `update "BranchProducts" set "openingBalanceCost" = $1 where "branchId"=$3 and "productId"=$2`
    //   query.values = [product.unitCost, element.branchId,product.id];
    //   await client.query(query.text, query.values);
    // }

    if (product.barcodes && product.barcodes.length > 0) {
      for (let index = 0; index < product.barcodes.length; index++) {
        const barcode: any = product.barcodes[index].barcode;
        // const isBarcodeExist = await ProductRepo.checkIfBarcodeExists(client,product.id,barcode,company.id);
        // if(isBarcodeExist)
        // {
        //   return new ResponseData(false,"",{ productName: data.name, error: "Product Barcode Already Used, Barcode = " + barcode })
        // }

        await ProductRepo.insertProductBarcodes(client, barcode, product.id, company.id)
      }
    }



    return new ResponseData(true, "", { id: product.id });
  }







  public static async setProductMediaId(data: any) {
    try {

      let updatedDate = new Date();
      const query: { text: string, values: any } = {
        text: `UPDATE "Products" set "mediaId" =$1,"updatedDate"=$2 where id =$3`,
        values: [data.mediaId, updatedDate, data.productId]
      }

      await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", [])
    } catch (error: any) {
      throw new Error(error)
    }
  }



  public static async getProductLogs(client: PoolClient, productId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT logs FROM "Products" where id =$1`,
        values: [productId]
      }

      let product = await client.query(query.text, query.values);
      return product.rows[0].logs ?? []
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async setProductLogs(client: PoolClient, productId: string, logs: Log[]) {
    try {
      const query: { text: string, values: any } = {
        text: `UPDATE  "Products" SET  logs=$1  where id =$2`,
        values: [JSON.stringify(logs), productId]
      }
      await client.query(query.text, query.values);
    } catch (error: any) {
      throw new Error(error)
    }
  }


  public static async getLocationListByBranch(branchId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT id,name from "inventorylocations" where "branchId"=$1`,
        values: [branchId]
      }

      let locations = await DB.excu.query(query.text, query.values);

      return new ResponseData(true, "", { list: locations.rows })
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async insertProductBarcodes(client: PoolClient, barcode: string, productId: string, companyId: string) {
    try {
      const query: { name: string, text: string, values: any } = {
        name: "InsertProductBarcode",
        text: `INSERT INTO "ProductBarcodes" ("productId", barcode, "companyId")
        VALUES ($1, $2, $3)`,
        values: [productId, barcode, companyId]
      }

      // await client.query(query.text,query.values)
      await client.query(query.text, query.values)
    } catch (error: any) {
      throw new Error(error)
    }
  }
  public static async getBrandIdByName(client: PoolClient, brandName: string, companyId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT id FROM "Brands" where "companyid"=$1 and LOWER(name)=LOWER($2)`,
        values: [companyId, brandName]
      }

      let brand = await client.query(query.text, query.values);
      return brand.rows && brand.rows.length > 0 ? brand.rows[0].id : null
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async getProductIdByName(client: PoolClient, productName: string, companyId: string) {
    try {
      const query: { name: string, text: string, values: any } = {
        name: "getProductIdByName",
        text: `SELECT id FROM "Products" where TRIM(LOWER(name)) = TRIM(LOWER($1)) and "companyId" = $2`,
        values: [productName, companyId]
      }

      let product = await client.query(query.text, query.values);

      return product.rows && product.rows.length > 0 ? product.rows[0].id : "";
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async getProductIdByNameAndBarcode(client: PoolClient, productName: string, barcode: string, companyId: string) {
    try {
      const query: { name: string, text: string, values: any } = {
        name: "getProductIdByName",
        text: `SELECT id FROM "Products" where  "companyId" = $3 and(TRIM(LOWER(name)) = TRIM(LOWER($1)) or "barcode" = $2 )`,
        values: [productName, barcode, companyId]
      }

      let product = await client.query(query.text, query.values);

      return product.rows && product.rows.length > 0 ? product.rows[0].id : "";
    } catch (error: any) {
      throw new Error(error)
    }
  }
  // public static async importFromCVS(data: any, company: Company, employeeId: string, pageNumber: number, count: number) {
  //   const client = await DB.excu.client(500);

  //   let redisClient = RedisClient.getRedisClient();
  //   try {
  //     let errors = [];
  //     await client.query("BEGIN")


  //     const companyId = company.id;
  //     let branchProducts: BranchProducts[] = [];
  //     const branches = await BranchesRepo.getCompanyBranchIds(client, company.id);
  //     branches.forEach((branchId: any) => {
  //       let brancProduct = new BranchProducts();
  //       brancProduct.branchId = branchId
  //       branchProducts.push(brancProduct)
  //     });
  //     let taxId = (await TaxesRepo.getDefaultTax(client, company.id)).data.id;
  //     let brands = [];
  //     let departments = [];
  //     let categories = [];
  //     let newProducts = []
  //     let updateProducts = []
  //     let limit: any = process.env.NUMBER_OF_IMPORT_RECOREDS ?? 2000;

  //     for (let index = 0; index < data.length; index++) {



  //       let progress = Math.floor((((index + 1) + ((pageNumber - 1) * limit)) / count) * 100) + "%"





  //       await redisClient.set("BulkImport" + company.id, JSON.stringify({ progress: progress }))

  //       const element: Product = data[index];
  //       element.taxId = element.defaultTax ? taxId : null;
  //       element.branchProduct = branchProducts;
  //       element.companyId = companyId;
  //       element.id = await ProductRepo.getProductIdByNameAndBarcode(client, element.name, element.barcode, companyId)

  //       let barcodes: any[] = []
  //       barcodes.push(element.barcode)

  //       if (element.barcodes && element.barcodes.length > 0) {
  //         const uniqueBarcodes: any = Array.from(new Set(element.barcodes.map(item => item.barcode)))
  //           .map(barcode => ({ barcode }));
  //         if (uniqueBarcodes) {
  //           element.barcodes = uniqueBarcodes;
  //         }
  //       }


  //       if (element.barcodes && element.barcodes.length > 0) {
  //         element.barcodes.forEach((element) => {
  //           barcodes.push(element.barcode);
  //         });
  //       }
  //       const isBarcodeExist = await ProductController.checkProductBarcodes(client, barcodes, companyId, element.id)

  //       if (isBarcodeExist) {
  //         errors.push({ productName: element.name, error: "barcode already used" })
  //         continue;
  //       }

  //       if (element.sku) {
  //         const isSKUExist = await ProductRepo.checkProductSKU(element.sku, companyId, element.id)

  //         if (isSKUExist) {
  //           errors.push({ productName: element.name, error: "SKU already used" })
  //           continue;
  //         }

  //       }

  //       if (element.departmentName != "" && element.departmentName != null && element.categoryName != "" && element.categoryName != null) {
  //         let categoryRes = categories.find(f => f.name == element.categoryName);
  //         if (categoryRes !== undefined) {
  //           element.categoryId = categoryRes.id;
  //         } else {
  //           const categoryId: any = await CategoryRepo.getCategoryIdByName(client, element.categoryName.trim(), companyId);
  //           if (categoryId.id == null) {
  //             let departmentId: any = null;
  //             let departmentRes = departments.find(f => f.name == element.departmentName);
  //             if (departmentRes !== undefined) {
  //               departmentId = departmentRes.id;
  //             } else {
  //               departmentId = (await DepartmentRepo.getDepartmentId(client, element.departmentName, companyId)).id;
  //             }

  //             if (departmentId == null) {
  //               const department = new Department();
  //               department.companyId = companyId;
  //               department.name = element.departmentName;
  //               departmentId = (await DepartmentRepo.addDepartment(client, department, company)).data.id;
  //               departments.push({ id: departmentId, name: element.departmentName });
  //             }
  //             element.departmentId = departmentId;

  //             const category = new Category();
  //             category.companyId = companyId;
  //             category.name = element.categoryName;
  //             category.departmentId = departmentId;
  //             const categoryId = await CategoryRepo.addCategory(client, category, company);
  //             element.categoryId = categoryId.data.id;
  //             categories.push({ id: element.categoryId, name: element.categoryName });
  //           } else {
  //             element.categoryId = categoryId.id;
  //             categories.push({ id: element.categoryId, name: element.categoryName });
  //           }
  //         }
  //       }


  //       if (element.brand != "" && element.brand != null) {
  //         //check local array
  //         let brandRes = brands.find(f => f.name == element.brand);
  //         if (brandRes !== undefined) {
  //           element.brandid = brandRes.id;
  //         } else {
  //           let brandId = await ProductRepo.getBrandIdByName(client, element.brand, company.id);
  //           if (brandId == null) {
  //             let brand = new Brands();
  //             brand.companyid = company.id;
  //             brand.name = element.brand;
  //             let brandData = await ProductRepo.insertBrand(client, brand, company);
  //             brandId = brandData.data.id
  //           }

  //           element.brandid = brandId
  //           brands.push({ id: brandId, name: element.brand });
  //         }
  //       }


  //       // let barcodeFlag = true;
  //       // let barcodeExisted = "";

  //       // if (!barcodeFlag) {
  //       //     let error = "Product Barcode Already Used, Barcode = " + barcodeExisted;
  //       //     errors.push({ productName: element.name, error: error })
  //       // }

  //       let resault: any;
  //       //TODO check if product Exists by Name or Barcode
  //       element.companyId = companyId
  //       if (element.id != "" && element.id != null) {
  //         // let error = isNameExist ? "Product Name Already Used" : "Product Barcode Already Used"
  //         // errors.push ({productName:element.name, error:error})
  //         // continue;

  //         //errors.push({ productName: element.name, error: "Product Name Already Used" })
  //         resault = await ProductRepo.updateImportProducts(client, element, company);
  //         updateProducts.push(resault.data.id)

  //       } else {
  //         console.log("imporrrrrrrrrrrrrrrt", element)
  //         resault = await ProductRepo.saveImportProducts(client, element, company);
  //         newProducts.push(resault.data.productId)

  //       }

  //       if (!resault.success) {
  //         errors.push(resault.data)
  //       }

  //     }
  //     await client.query("COMMIT")


  //     return new ResponseData(true, "", { errors: errors, prodcutIds: newProducts, updatProdcutIds: updateProducts })
  //   } catch (error: any) {
  //     console.log(error)
  //     await client.query("ROLLBACK")
  //   
  //     return new ResponseData(false, error.message, [])

  //   } finally {

  //     client.release()



  //   }
  // }

  public static async getUnCategoriesedProductList(data: any, company: Company): Promise<ResponseData> {
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
      let page = data.page ?? 1
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }
      let types = ["inventory", "batch", "serialized", "service", "menuSelection", "menuItem", "package", "kit", "tailoring"]

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

      let filterQuery = ` WHERE "Products"."isDeleted" = false AND "companyId"=$1 AND "Products".type = ANY( $2) And "categoryId" IS NULL`
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

      // for (let index = 0; index < selectList.rows.length; index++) {
      //   const element = selectList.rows[index];
      //   if (element.type == "batch" || element.type == "serialized" || element.type == "inventory" || element.type == "kit") {
      //     const branchSummary = await this.getProductAvailability(element.id, companyId);
      //     if (branchSummary?.data) {
      //       selectList.rows[index].branchSummary = branchSummary.data
      //     }
      //   }
      // }

      offset += 1
      let lastIndex = ((page) * limit)
      if (selectList.rows.length < limit || data.page == pageCount) {
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




  public static async exprotProducts(company: Company): Promise<ResponseData> {
    try {
      const companyId = company.id;
      const selectQuery = `SELECT
          p."type" AS "Product Type",
          p."name" AS "Product Name",
          p.description AS "Description",
          p.barcode as "Barcode",
          d."name" AS "Department",
          c."name" AS "Category",
          p."defaultPrice" AS "Default Price",
          p."isDiscountable" AS "Is Discountable",
          array_to_string(p.tags, ';') AS "Tags",
          p."UOM",
          p."unitCost" AS "Unit Cost",
          CASE 
              WHEN p."commissionPercentage" THEN '%'
              ELSE 'cash'
          END AS "Commission Type",
          p."commissionAmount" AS "Commission Value",
          p."serviceTime" AS "Duration",
          p."translation"->'name' ->> 'en' AS "English Name",
          p."translation"->'name' ->> 'ar' AS "Arabic Name",
          p."translation"->'description' ->> 'en' AS "English Description",
          p."translation"->'description' ->> 'ar' AS "Arabic Description",
          b."name" AS "Brand",
          barcodes_concatenated.barcodes AS "Barcodes",
          case when p."taxId" is not null then 'yes' else 'no'  end as "defaultTax" ,
          "kitchenName",
           p."sku"
      FROM
          "Products" p 
      LEFT JOIN
          "Categories" c ON p."categoryId" = c.id
      LEFT JOIN "Taxes" ON "Taxes".id = "p"."taxId"
      LEFT JOIN
          "Departments" d ON c."departmentId" = d.id 
      LEFT JOIN
          "Brands" b ON p.brandid = b.id 
      LEFT  JOIN
          (
              SELECT
                  pb."productId",
                  STRING_AGG(pb.barcode, ';') AS barcodes
              FROM
                  "ProductBarcodes" pb
              GROUP BY
                  pb."productId"
          ) AS barcodes_concatenated ON p.id = barcodes_concatenated."productId"
      WHERE
          p."isDeleted" = false 
          AND p."companyId" = $1`;

      const selectList: any = await DB.excu.query(selectQuery, [companyId]);

      // Define the CSV writer
      const csvWriter = createObjectCsvWriter({
        path: companyId + 'products.csv',
        header: [
          { id: 'Product Type', title: 'Product Type' },
          { id: 'Product Name', title: 'Product Name' },
          { id: 'Description', title: 'Description' },
          { id: 'Barcode', title: 'Barcode' },
          { id: 'Department', title: 'Department' },
          { id: 'Category', title: 'Category' },
          { id: 'Default Price', title: 'Default Price' },
          { id: 'Is Discountable', title: 'Is Discountable' },
          { id: 'Tags', title: 'Tags' },
          { id: 'UOM', title: 'UOM' },
          { id: 'Unit Cost', title: 'Unit Cost' },
          { id: 'Commission Type', title: 'Commission Type' },
          { id: 'Commission Value', title: 'Commission Value' },
          { id: 'Duration', title: 'Duration' },
          { id: 'English Name', title: 'English Name' },
          { id: 'Arabic Name', title: 'Arabic Name' },
          { id: 'English Description', title: 'English Description' },
          { id: 'Arabic Description', title: 'Arabic Description' },
          { id: 'Brand', title: 'Brand' },
          { id: 'Barcodes', title: 'Barcodes' },
          { id: 'defaultTax', title: 'Default Tax' },
          { id: 'kitchenName', title: 'Kitchen Name' },
          { id: 'sku', title: 'SKU' },
        ],
      });

      // Write the data to the CSV file
      await csvWriter.writeRecords(selectList.rows);

      return new ResponseData(true, "", "Products exported successfully.");
    } catch (error: any) {
    
      throw new Error("Error exporting products: " + error.message); // Include the actual error message
    }
  }



  public static async productChildsList(data: any, company: Company): Promise<ResponseData> {
    try {
      const companyId = company.id;

      let searchValue = data.searchTerm ? `%` + data.searchTerm.toLowerCase().trim() + `%` : null;
      const filter = data.filter;


      let types = ["inventory", "batch", "serialized", "service", "menuSelection", "menuItem", "package", "kit", "matrix"]

      if (data.filter && data.filter.type && data.filter.type.length > 0) {
        types = data.filter.type;

      }
      let productMatrixQuery = types.includes('matrix') ? ` or  "Products"."productMatrixId" is not null ` : `and "Products"."productMatrixId" is null `


      let sort = data.sortBy;
      let sortValue = !sort ? '"createdAt"' : '"' + sort.sortValue + '"';
      let sortDirection = !sort ? "DESC" : sort.sortDirection;
      let sortTerm = sortValue + " " + sortDirection
      let orderByQuery = ` Order by ` + sortTerm;
      let id = data.id

      let page = data.page ?? 1;
      let offset = 0;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }

      const categories = filter && filter.categories ? filter.categories : [];
      const departments = filter && filter.departments ? filter.departments : [];

      const query: { text: string, values: any } = {
        text: `with  "produtList" as (
               

                SELECT   COUNT(*) OVER(),

                  "Products".id,
                  "Products".name,
                  "Products".type,
                  "Products"."UOM",
                  "Products".barcode,
                  "Products"."unitCost",
                  "Products"."companyId",
                  "Products"."createdAt",
                  "Products"."categoryId",
                  "Products"."translation",
                  "Products"."defaultPrice",
                 
                  "Categories".name as "categoryName",
                  "Departments".name as "departmentName"
                FROM "Products"
                  
                LEFT JOIN "Categories" 		on "Categories".id	= "Products"."categoryId"
                LEFT JOIN "Departments"	    on "Departments".id = "Categories"."departmentId"
                LEFT JOIN "ProductBarcodes" on "Products". id 	= "ProductBarcodes"."productId"
                  
                WHERE "Products"."isDeleted" = false 
                  AND "Products"."companyId"= $1
                  AND ("parentId" = $8 or  "productMatrixId" =$8)
                  AND ("Products".type = ANY($2) )
                         
                  AND ($3::text is null or "Products".name ilike $3
                        OR  ("Products".barcode)  ilike $3
                        OR  ("ProductBarcodes".barcode)  ilike $3
                        OR  ("Products".type)  ilike $3
                        OR  ("Products". "UOM")  ilike $3
                        OR  ( ("Products"."translation" ->>'name')::jsonb->>'ar' )  ilike $3
                        OR  ( ("Products"."translation" ->>'name')::jsonb->>'en' )  ilike $3
                        OR "Products"."defaultPrice"::varchar(255) ilike $3
                        OR ("Departments".name )  ilike $3
                        OR ("Categories".name ) ilike $3
                        )
               
                  AND  (array_length($4::uuid[], 1) IS NULL OR ("Categories".id=any($4::uuid[])))
                  AND (array_length($5::uuid[], 1) IS NULL OR ("Departments".id=any($5::uuid[])))
                  group by    "Products".id,      "Categories".id, "Departments".id
                   ${orderByQuery}
                  Limit $6 offset $7   
      
                ) 
                
                select count, 
                    "produtList"."id"  ,
                    "produtList".name, 
                    "produtList".barcode , 
                    "produtList"."unitCost"  , 
                    "defaultPrice" ,  
                    "produtList".translation,   
                    "produtList".type  ,       
                    "produtList"."categoryId",
                    "produtList"."companyId",
                    "produtList"."createdAt",
                    "categoryName",
                    "departmentName",
                    case when type::text = 'inventory'::text  or  type::text = 'kit'::text    then
                      (select json_build_object('qtySum',sum ( "BranchProducts"."onHand")  ,'stockValue', sum("BranchProducts"."onHand"  * "produtList"."unitCost"    ) )
                      from "BranchProducts"   where "BranchProducts"."productId" = "produtList".id  )
                        else case when type::text = 'batch'::text then 
                      (select 
                        json_build_object('qtySum',sum ( "ProductBatches"."onHand") ,'stockValue',sum ( "ProductBatches"."onHand" *  "ProductBatches"."unitCost" )  )
                        from "BranchProducts" 
                        inner join "ProductBatches" on "BranchProducts".id ="ProductBatches"."branchProductId"
                        inner join "Branches" on "BranchProducts"."branchId" = "Branches".id
                        where "BranchProducts"."productId" = "produtList".id 
                        and"Branches"."companyId" = "produtList"."companyId")
                        else case when type::text ='serialized'::text then 
                      (select json_build_object('qtySum',count( "ProductSerials".id),'stockValue',sum("ProductSerials"."unitCost") )
                        from "BranchProducts" 
                      inner join "ProductSerials" on "BranchProducts".id ="ProductSerials"."branchProductId"
                      inner join "Branches" on "BranchProducts"."branchId" = "Branches".id
                      where "BranchProducts"."productId" = "produtList".id 
                      and"Branches"."companyId" = "produtList"."companyId"
                      and "ProductSerials".status = 'Available') 
                      end 
                      end 
                      end as "inventorySummary"
                FROM "produtList" 
              
                ${orderByQuery}`,
        values: [companyId, types, searchValue, categories, departments, limit, offset, id]
      }



      let list = await DB.excu.query(query.text, query.values);
      let count = list.rows && list.rows.length > 0 ? Number((<any>list.rows[0]).count) : 0
      let pageCount = Math.ceil(count / limit)

      offset += 1
      let lastIndex = ((page) * limit)
      if (list.rows.length < limit || page == pageCount) {
        lastIndex = count
      }
      const resData = {
        list: list.rows,
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




  // public static async exprotProducts(company: Company): Promise<ResponseData> {
  //   try {
  //     const companyId = company.id;
  //     const selectQuery = `SELECT
  //         p."type" AS "Product Type",
  //         p."name" AS "Product Name",
  //         p.description AS "Description",
  //         p.barcode as "Barcode",
  //         d."name" AS "Department",
  //         c."name" AS "Category",
  //         p."defaultPrice" AS "Default Price",
  //         p."isDiscountable" AS "Is Discountable",
  //         array_to_string(p.tags, ';') AS "Tags",
  //         p."UOM",
  //         p."unitCost" AS "Unit Cost",
  //         CASE 
  //             WHEN p."commissionPercentage" THEN '%'
  //             ELSE 'cash'
  //         END AS "Commission Type",
  //         p."commissionAmount" AS "Commission Value",
  //         p."serviceTime" AS "Duration",
  //         p."translation"->'name' ->> 'en' AS "English Name",
  //         p."translation"->'name' ->> 'ar' AS "Arabic Name",
  //         p."translation"->'description' ->> 'en' AS "English Description",
  //         p."translation"->'description' ->> 'ar' AS "Arabic Description",
  //         b."name" AS "Brand",
  //         barcodes_concatenated.barcodes AS "Barcodes"
  //     FROM
  //         "Products" p 
  //     JOIN
  //         "Categories" c ON p."categoryId" = c.id
  //     JOIN
  //         "Departments" d ON c."departmentId" = d.id 
  //     JOIN
  //         "Brands" b ON p.brandid = b.id 
  //     JOIN
  //         (
  //             SELECT
  //                 pb."productId",
  //                 STRING_AGG(pb.barcode, ';') AS barcodes
  //             FROM
  //                 "ProductBarcodes" pb
  //             GROUP BY
  //                 pb."productId"
  //         ) AS barcodes_concatenated ON p.id = barcodes_concatenated."productId"
  //     WHERE
  //         p."isDeleted" = false 
  //         AND p."companyId" = $1`;

  //     const selectList: any = await DB.excu.query(selectQuery, [companyId]);

  //     // Convert the result to CSV string
  //     const csvString = await fastCsv.writeToString(selectList.rows, { headers: true });

  //     return new ResponseData(true, "", csvString);
  //   } catch (error: any) {
  //   
  //     throw new Error("Error exporting products: " + error.message); // Include the actual error message
  //   }
  // }






  // public static async exprotProducts(company: Company): Promise<ResponseData> {
  //   try {
  //     const companyId = company.id;
  //     const selectQuery = `SELECT
  //     p."type" AS "Product Type",
  //     p."name" AS "Product Name",
  //     p.description AS "Description",
  //     p.barcode as "Barcode",
  //     d."name" AS "Department",
  //     c."name" AS "Category",
  //     p."defaultPrice" AS "Default Price",
  //     p."isDiscountable" AS "Is Discountable",
  //   array_to_string(p.tags, ';') AS "Tags",
  //     p."UOM",
  //     p."unitCost" AS "Unit Cost",
  //     CASE 
  //         WHEN p."commissionPercentage" THEN '%'
  //         ELSE 'cash'
  //     END AS "Commission Type",
  //     p."commissionAmount" AS "Commission Value",
  //     p."serviceTime" AS "Duration",
  //     p."translation"->'name' ->> 'en' AS "English Name",
  //     p."translation"->'name' ->> 'ar' AS "Arabic Name",
  //     p."translation"->'description' ->> 'en' AS "English Description",
  //     p."translation"->'description' ->> 'ar' AS "Arabic Description",
  //     b."name" AS "Brand",
  //     barcodes_concatenated.barcodes AS "Barcodes"
  // FROM
  //     "Products" p 
  // JOIN
  //     "Categories" c ON p."categoryId" = c.id
  // JOIN
  //     "Departments" d ON c."departmentId" = d.id 
  // JOIN
  //     "Brands" b ON p.brandid = b.id 
  // JOIN
  //     (
  //         SELECT
  //             pb."productId",
  //             STRING_AGG(pb.barcode, ';') AS barcodes
  //         FROM
  //             "ProductBarcodes" pb
  //         GROUP BY
  //             pb."productId"
  //     ) AS barcodes_concatenated ON p.id = barcodes_concatenated."productId"
  // WHERE
  //     p."isDeleted" = false 
  //     AND p."companyId" = $1`




  //     const selectList: any = await DB.excu.query(selectQuery, [companyId])

  //     const resData = {
  //       list: selectList.rows,
  //     }
  //     return new ResponseData(true, "", resData)
  //   } catch (error: any) {

  //   
  //     throw new Error(error)
  //   }
  // }







  // public static  async exprotProducts(company: Company) {
  //   try {
  //     const companyId = company.id;
  //     console.log("companyId" , companyId)
  //     const selectQuery = `SELECT
  //       p."type" AS "Product Type",
  //       p."name" AS "Product Name",
  //       p.description AS "Description",
  //       p.barcode as "Barcode",
  //       d."name" AS "Department",
  //       c."name" AS "Category",
  //       p."defaultPrice" AS "Default Price",
  //       p."isDiscountable" AS "Is Discountable",
  //       array_to_string(p.tags, ';') AS "Tags",
  //       p."UOM",
  //       p."unitCost" AS "Unit Cost",
  //       CASE 
  //           WHEN p."commissionPercentage" THEN '%'
  //           ELSE 'cash'
  //       END AS "Commission Type",
  //       p."commissionAmount" AS "Commission Value",
  //       p."serviceTime" AS "Duration",
  //       p."translation"->'name' ->> 'en' AS "English Name",
  //       p."translation"->'name' ->> 'ar' AS "Arabic Name",
  //       p."translation"->'description' ->> 'en' AS "English Description",
  //       p."translation"->'description' ->> 'ar' AS "Arabic Description",
  //       b."name" AS "Brand",
  //       barcodes_concatenated.barcodes AS "Barcodes"
  //     FROM
  //       "Products" p 
  //     JOIN
  //       "Categories" c ON p."categoryId" = c.id
  //     JOIN
  //       "Departments" d ON c."departmentId" = d.id 
  //     JOIN
  //       "Brands" b ON p.brandid = b.id 
  //     JOIN
  //       (
  //       SELECT
  //         pb."productId",
  //         STRING_AGG(pb.barcode, ';') AS barcodes
  //       FROM
  //         "ProductBarcodes" pb
  //       GROUP BY
  //         pb."productId"
  //       ) AS barcodes_concatenated ON p.id = barcodes_concatenated."productId"
  //     WHERE
  //       p."isDeleted" = false 
  //       AND p."companyId" = $1`;

  //     const selectList = await DB.excu.query(selectQuery, [companyId]);

  //     const csvWriter = createObjectCsvWriter({
  //       path: 'products.csv',
  //       header: [
  //         { id: 'Product Type', title: 'Product Type' },
  //         { id: 'Product Name', title: 'Product Name' },
  //         { id: 'Description', title: 'Description' },
  //         { id: 'Barcode', title: 'Barcode' },
  //         { id: 'Department', title: 'Department' },
  //         { id: 'Category', title: 'Category' },
  //         { id: 'Default Price', title: 'Default Price' },
  //         { id: 'Is Discountable', title: 'Is Discountable' },
  //         { id: 'Tags', title: 'Tags' },
  //         { id: 'UOM', title: 'UOM' },
  //         { id: 'Unit Cost', title: 'Unit Cost' },
  //         { id: 'Commission Type', title: 'Commission Type' },
  //         { id: 'Commission Value', title: 'Commission Value' },
  //         { id: 'Duration', title: 'Duration' },
  //         { id: 'English Name', title: 'English Name' },
  //         { id: 'Arabic Name', title: 'Arabic Name' },
  //         { id: 'English Description', title: 'English Description' },
  //         { id: 'Arabic Description', title: 'Arabic Description' },
  //         { id: 'Brand', title: 'Brand' },
  //         { id: 'Barcodes', title: 'Barcodes' },
  //       ],
  //     });





  //     // await csvWriter.writeRecords(selectList.rows);
  //     const csvData = createObjectCsvStringifier(data)

  //     const resData = {
  //       list: selectList.rows,
  //     };
  //     return new ResponseData(true, '', csvData);
  //   } catch (error) {
  //   
  //     throw new Error("Error");
  //   }
  // }


















  public static async getExpireBatches(data: any, company: Company, branchList: []) {
    try {

      let date = new Date()
      let filter = data.filter;
      const branches = filter && filter.branches && filter.branches.length > 0 ? filter.branches : branchList;

      const page = data && data.page ? data.page : 1;
      const limit = data && data.limit ? data.limit : 50;
      let offset = limit * (page - 1);



      const query: { text: string, values: any } = {

        text: `  select count(*) over(), "Branches".id as "branchId", "Branches".name as "branchName",
                 "Products".name as "productName", (batch),
                                             "ProductBatches"."onHand", "ProductBatches"."expireDate", 
                                              "ProductBatches"."prodDate"
                  
                  FROM "ProductBatches" 
                  INNER JOIN "BranchProducts" ON "BranchProducts".id = "ProductBatches"."branchProductId"
                  INNER JOIN "Products" on  "Products".id = "BranchProducts"."productId" AND "ProductBatches"."companyId" = "Products"."companyId"
                  INNER JOIN "Branches" ON "Branches".id = "BranchProducts"."branchId"
                  where "ProductBatches"."companyId" = $1
                    AND "expireDate" <= $2::timestamp 
                    AND  "ProductBatches"."onHand"> 0
                  and ($3::uuid[] is null or "BranchProducts"."branchId" = any($3::uuid[]))
				         order by "Branches".id, "ProductBatches"."expireDate", "ProductBatches".id
                 limit ${limit}
                 offset ${offset}
                  `,
        values: [company.id, date, branches],
      };





      const records = await DB.excu.query(query.text, query.values);
      let count = records.rows && records.rows.length > 0 ? (<any>records.rows[0]).count : 0

      let pageCount = Math.ceil(count / limit)
      offset += 1
      let lastIndex = ((page) * limit)
      if (records.rows.length < limit || page == pageCount) {
        lastIndex = count
      }

      let resData = {
        records: records.rows,
        count: count,
        pageCount: pageCount,
        startIndex: offset,
        lastIndex: lastIndex
      }


      return new ResponseData(true, "", resData)


    } catch (error: any) {
    
      throw new Error(error)
    }

  } catch(error: any) {
  
    throw new Error(error)
  }


  public static async setOnHandOpeningBalanceToZero(client: PoolClient, branchId: string, productId: string) {
    try {
      const query = {
        text: `UPDATE  "BranchProducts" SET "onHand" = 0 , "openingBalance"=0 where "branchId"=$1 and "productId"=$2`,
        values: [branchId, productId]
      }

      await client.query(query.text, query.values)
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async validateTaxId(taxId: string, companyId: string) {
    try {
      const query = {
        text: `SELECT count(id) FROM "Taxes" where id=$1 and "companyId"=$2`,
        values: [taxId, companyId]
      }

      let taxes = await DB.excu.query(query.text, query.values)

      if (taxes && taxes.rows && taxes.rows.length > 0 && (<any>taxes.rows[0]).count > 0) {
        return true
      }
      return false
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async assignProductTax(data: any, company: Company) {
    try {
      let departmentId = data.departmentId ?? null
      let categoryId = data.categoryId ?? null
      let productIds = data.productIds ?? null
      let brandId = data.brandId ?? null
      let types = data.types && data.types.length > 0 ? data.types : null
      let taxId = data.taxId ?? null
      let companyId = company.id
      let filterType = data.filterType ?? null


      if (filterType == 'All' || filterType == null || filterType == undefined || filterType == '') {
        departmentId = null;
        categoryId = null;
        brandId = null;
        types = null
      }
      if (!taxId) {
        throw new ValidationException("Tax Id Is Required")
      }

      /** validate tax ID */

      let isTaxIdExist = await this.validateTaxId(taxId, companyId)
      if (!isTaxIdExist) {
        throw new ValidationException("Tax Id Is Not Valide")
      }
      const query = {
        text: ` WITH "product" as(
                  select "Products".id from "Products"
                  left join "Categories" on "Categories".id =  "categoryId"
                  left join "Departments" on "Departments".id = "Categories"."departmentId"
                  where "Products"."companyId" = $1 
              AND ($2::UUID[]  IS NULL OR "Products".id = any($2))
              AND ($3::UUID  IS NULL OR "Departments".id = $3)
              AND ($4::UUID  IS NULL OR "categoryId" = $4)
              AND ($5::UUID  IS NULL OR "brandid" = $5)
              AND ($6::text[]  IS NULL OR "type" = any($6))
                ) 

                update "Products" set "taxId" = $7, "updatedDate"=$8 from(select * from "product")t
                where "Products".id = t."id"
              `,
        values: [companyId, productIds, departmentId, categoryId, brandId, types, taxId, new Date()]
      }
      await DB.excu.query(query.text, query.values)
      return new ResponseData(true, "", [])
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async getProductIdByBarcode(client: PoolClient, barcode: string, companyId: string) {
    try {
      const query: { name: string, text: string, values: any } = {
        name: "getProductIdByBarcode",
        text: `SELECT id FROM "Products" where TRIM(LOWER(barcode)) = TRIM(LOWER($1)) and "companyId" = $2`,
        values: [barcode, companyId]
      }

      let product = await DB.excu.query(query.text, query.values);

      return (product.rows && product.rows.length > 0) ? (<any>product.rows[0]).id : "";
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async checkProductSKU(SKU: string, companyId: string, productId: string = '') {
    try {

      const query: { text: string, values: any } = {

        text: `select count(*) from "Products" 
            where "Products"."companyId" = $2 and ("Products"."sku" = $1 )
            and "Products".id::text <> $3` ,
        values: [SKU, companyId, productId]
      }



      let product = await DB.excu.query(query.text, query.values);

      if (product.rows && product.rows.length > 0) {
        console.log(product.rows[0])
        return ((<any>product.rows[0]).count > 0) ? true : false
      }

      return false

    } catch (error: any) {
      console.log(error)
      throw new Error(error)
    }
  }

  public static async getProductColumns(company: Company): Promise<ResponseData> {
    try {
      const companyId = company.id;
      const query: { text: string, values: any } = {
        text: `with t1 as (
            select  case when  "CustomizationSettings".id is null then  (  "Companies"."productOptions"->> 'customFields' )::jsonb else  ( "CustomizationSettings"."settings"->>'customFields')::jsonb  end as "customFields" 
            from "Companies"  
            LEFT JOIN "CustomizationSettings" ON "CustomizationSettings"."companyId" =  "Companies".id and "CustomizationSettings"."type" = 'product'
            where  "Companies".id = $1
            )
            select 'customFields' as  "column",   jsonb_object_agg(elem ->>'id', elem->>'name')  as  "childCol" 
            from t1 , jsonb_array_elements("customFields") as elem

            union all 	

            select column_name as "column",
            null as "childCol" 
            from information_schema.columns 
            where table_schema = 'public'
            and table_name = 'Products'
            and column_name not ilike '%id'  
                    
            `,
        values: [companyId]
      }

      let list = await DB.excu.query(query.text, query.values);
      let resData
      if (list.rows && list.rows.length > 0) {
        resData = list.rows
      }
      return new ResponseData(true, "", resData ?? [])

    } catch (error: any) {
    
      throw new Error(error)
    }
  }


  public static async productListWithCustomeFields(data: any, company: Company): Promise<ResponseData> {
    try {

      //########################## filter ##########################
      const companyId = company.id;
      const filter = data.filter;

      let types = ["inventory", "batch", "serialized", "service", "menuSelection", "menuItem", "package", "kit"]
      types = (filter.type && data.filter.type.length > 0) ? data.filter.type : types
      let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';

      //########################## Sort ##########################
      let sort = data.sortBy;
      let sortValue = !sort ? '"createdAt"' : '"' + sort.sortValue + '"';
      let sortDirection = !sort ? "DESC" : sort.sortDirection ?? "";
      let sortTerm = sortValue + " " + sortDirection
      let orderByQuery = ` Order by ` + sortTerm;


      //########################## initiate Queries ##########################
      let selectedQuery = `with "produtList" as (
      SELECT 
      COUNT(*) OVER(),
      "Products".id,
      "Products".name,
      "Products".type,
      "Products"."createdAt" 
    `
      let joinQuery = ``
      let filterQuery = ``
      let serachQuery = ``
      let groupByQuery = ` group by "Products".id`
      let q2 = ``
      let values = [companyId, types, searchValue]

      //######################## custome columns ##################
      let mainColumns = []
      let selectedColumns = data.customeColumns ?? ["categoryId", "barcode", "defaultPrice", "UOM", "translation", "unitCost", "category", "department", "companyId", 'inventorySummary']
      let tableColumns = (await this.getProductColumns(company)).data
      // let columns  = selectedColumns.filter( (e:any) => tableColumns.includes(e))
      let columns = selectedColumns
      const extractedValues = data
      let customFields = tableColumns.find((item: { column: string; childCol: string[] }) => item.column === "customFields")?.childCol
        ? Object.values(tableColumns.find((item: { column: string; }) => item.column === "customFields")?.childCol)
        : [];

      console.log(customFields);


      const categories = filter && filter.categories ? filter.categories : [];
      const departments = filter && filter.departments ? filter.departments : [];

      if (categories.length > 0) {
        columns.push('category')
        filterQuery += ` AND  (array_length($4::uuid[], 1) IS NULL OR ("Categories".id=any($4::uuid[])))`
        values = [companyId, types, searchValue, categories]
      }
      if (departments.length > 0) {
        columns.push('department')
        columns.push('category'); filterQuery += `AND  (array_length($5::uuid[], 1) IS NULL OR ("Departments".id=any($5::uuid[])))`
        values: [companyId, types, searchValue, categories, departments]
      }
      if (columns.includes('inventorySummary')) { columns.push('unitCost') }

      const uniqueColumns = new Set(columns)
      columns = [...uniqueColumns]

      if (columns?.length > 0) {

        columns.forEach((col: string) => {

          // check if col exsit in table or not
          switch (col) {
            case 'category':
              selectedQuery += `,"Categories".name as "categoryName"`
              joinQuery += ' LEFT JOIN "Categories" on "Categories".id = "Products"."categoryId"'
              groupByQuery += ',"Categories".id'
              serachQuery + `OR LOWER("Categories".name ) ~ $3`
              break;
            case 'department':
              selectedQuery += ` ,"Departments".name as "departmentName"`
              joinQuery += `LEFT JOIN "Departments" on "Departments".id = "Categories"."departmentId"`
              groupByQuery += ' ,"Departments".id'
              serachQuery += `OR LOWER("Departments".name ) ~ $3`
              break;
            case 'inventorySummary':
              q2 = `,
           case when type::text = 'inventory'::text  or  type::text = 'kit'::text    then
            (select json_build_object('qtySum',sum ( "BranchProducts"."onHand")  ,'stockValue', sum("BranchProducts"."onHand"  * "produtList"."unitCost"    ) )
              from "BranchProducts"   where "BranchProducts"."productId" = "produtList".id  )
                else case when type::text = 'batch'::text then 
             (select 
                 json_build_object('qtySum',sum ( "ProductBatches"."onHand") ,'stockValue',sum ( "ProductBatches"."onHand" *  "ProductBatches"."unitCost" )  )
                 from "BranchProducts" 
                 inner join "ProductBatches" on "BranchProducts".id ="ProductBatches"."branchProductId"
                 inner join "Branches" on "BranchProducts"."branchId" = "Branches".id
                 where "BranchProducts"."productId" = "produtList".id 
                 and"Branches"."companyId" = $1)
                  else case when type::text ='serialized'::text then 
            (select json_build_object('qtySum',count( "ProductSerials".id),'stockValue',sum("ProductSerials"."unitCost") )
                  from "BranchProducts" 
              inner join "ProductSerials" on "BranchProducts".id ="ProductSerials"."branchProductId"
              inner join "Branches" on "BranchProducts"."branchId" = "Branches".id
              where "BranchProducts"."productId" = "produtList".id 
              and"Branches"."companyId" = $1
              and "ProductSerials".status = 'Available') 
              end 
              end 
              end as "inventorySummary"`

              break;
            case 'customFields':
              customFields.forEach(c => {
                selectedQuery += `,jsonb_path_query_array("customFields", '$[*] ? (@.name == "${c}")')->0->>'value' AS  "${c}"`
              })

              break;
            default:
              selectedQuery += `,"Products"."${col}"`
              break;
          }
        })

      }

      //########################## Limit  ##########################
      let page = data.page ?? 1;
      let offset = 0;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }
      let limitQuery = ` Limit ${limit} offset ${offset}`

      //########################## query  ##########################

      const query: { text: string } = {
        text: selectedQuery
          + `
               from "Products"
               left join "ProductBarcodes" on "Products". id = "ProductBarcodes"."productId"
         ${joinQuery}
         WHERE "Products"."isDeleted" = false 
        
         AND "Products"."companyId"=$1 
         AND "Products".type = ANY( $2)
        ${filterQuery}
         AND (LOWER ("Products".name) ~ $3
              OR LOWER ("Products".barcode) ~ $3
              OR LOWER ("ProductBarcodes".barcode) ~ $3
              OR LOWER ("Products".type) ~ $3
              OR LOWER ("Products". "UOM") ~ $3
              OR LOWER ( ("Products"."translation" ->>'name')::jsonb->>'ar' ) ~ $3
              OR LOWER ( ("Products"."translation" ->>'name')::jsonb->>'en' ) ~ $3
              OR "Products"."defaultPrice"::varchar(255)~ $3
              ${serachQuery}
              )
          ${groupByQuery}
          ${orderByQuery}
          ${limitQuery}
       
      ) 
        
      select 
        "produtList".*
        ${q2}
        FROM "produtList"
        ${orderByQuery}
    `,

      }

      let list = await DB.excu.query(query.text, values);

      //########################## pagination  ##########################
      let count = (list.rows && list.rows.length > 0) ? Number((<any>list.rows[0]).count) : 0
      let pageCount = Math.ceil(count / limit)

      offset += 1
      let lastIndex = ((page) * limit)
      if (list.rows.length < limit || page == pageCount) {
        lastIndex = count
      }

      //########################## res Data  ##########################
      const resData = {
        list: list.rows,
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






  public static async getLatestFIFOProductUnitCost(productIds: any[], branchId: string) {
    try {
      const query = {
        text: `select distinct on ("productId") "productId", "qty" ,"cost"  from "InventoryMovmentRecords" 
                where  "branchId" = $1
				and "productId" = any($2)
               
				and "qty" >= 0 
                order by  "productId" ,"createdAt" desc 
				
                    `,
        values: [branchId, productIds]
      }
      const costs = await DB.excu.query(query.text, query.values);

      return costs.rows
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async getFIFOProductAvailablity(productId: string, companyId: string) {
    try {
      const query = {
        text: `select "Branches".id  as "branchId", 
                      "Branches"."name" as "branch" ,
                      COALESCE(sum ( "qty"::text::numeric(32,6)),0)::float "onHand" , 
                      COALESCE(sum ( "qty"::text::numeric(32,6) * "cost"::text::numeric(32,6)),0) AS "stockValue",
                      "BranchProducts"."reorderLevel"  
                from "Branches"
                LEFT JOIN "BranchProducts" on "BranchProducts"."branchId" ="Branches"."id" AND "BranchProducts"."productId" = $1
                LEFT JOIN "InventoryMovmentRecords" on "Branches".id ="InventoryMovmentRecords"."branchId" AND "InventoryMovmentRecords"."productId" = $1
                where "Branches"."companyId" = $2
                group by "Branches".id,"BranchProducts"."reorderLevel" `,
        values: [productId, companyId]
      }
      const costs = await DB.excu.query(query.text, query.values);
      for (let index = 0; index < costs.rows.length; index++) {
        const element = costs.rows[index];
        //show status 'Out of Stock' , 'Low Stock' , 'In Stock'
        if (element.onHand <= 0) {
          element.status = 'Out of Stock';
        } else if (element.onHand < element.reorderLevel) {
          element.status = 'Low Stock';
        } else {
          element.status = 'In Stock';
        }
      }
      return new ResponseData(true, "", costs.rows)
    } catch (error: any) {
      throw new Error(error)
    }
  }
  public static async exportProducts(company: Company, type: string = 'XLSX'): Promise<ResponseData> {
    try {
      const companyId = company.id;

      const selectQuery = `SELECT
          p."type" AS "Product Type",
          p."name" AS "Product Name",
          p.description AS "Description",
          p.barcode as "Barcode",
          d."name" AS "Department",
          c."name" AS "Category",
          p."defaultPrice" AS "Default Price",
          p."isDiscountable" AS "Is Discountable",
          array_to_string(p.tags, ';') AS "Tags",
          p."UOM",
          p."unitCost" AS "Unit Cost",
          CASE 
              WHEN p."commissionPercentage" THEN '%'
              ELSE 'cash'
          END AS "Commission Type",
          p."commissionAmount" AS "Commission Value",
          p."serviceTime" AS "Duration",
          p."translation"->'name' ->> 'en' AS "English Name",
          p."translation"->'name' ->> 'ar' AS "Arabic Name",
          p."translation"->'description' ->> 'en' AS "English Description",
          p."translation"->'description' ->> 'ar' AS "Arabic Description",
          b."name" AS "Brand",
          barcodes_concatenated.barcodes AS "Barcodes",
          case when p."taxId" is not null then 'yes' else 'no'  end as "defaultTax" ,
          "kitchenName",
           p."sku"
      FROM
          "Products" p 
      LEFT JOIN
          "Categories" c ON p."categoryId" = c.id
      LEFT JOIN "Taxes" ON "Taxes".id = "p"."taxId"
      LEFT JOIN
          "Departments" d ON c."departmentId" = d.id 
      LEFT JOIN
          "Brands" b ON p.brandid = b.id 
      LEFT  JOIN
          (
              SELECT
                  pb."productId",
                  STRING_AGG(pb.barcode, ';') AS barcodes
              FROM
                  "ProductBarcodes" pb
              GROUP BY
                  pb."productId"
          ) AS barcodes_concatenated ON p.id = barcodes_concatenated."productId"
      WHERE
          p."isDeleted" = false 
          AND p."companyId" = $1`;

      const selectList: any = await DB.excu.query(selectQuery, [companyId]);



      if (type.toLowerCase() == 'csv') {
        console.log(">>>>>>>>>>csv")
        const csvWriter = createObjectCsvWriter({
          path: companyId + 'products.csv',
          header: [
            { id: 'Product Type', title: 'Product Type' },
            { id: 'Product Name', title: 'Product Name' },
            { id: 'Description', title: 'Description' },
            { id: 'Barcode', title: 'Barcode' },
            { id: 'Department', title: 'Department' },
            { id: 'Category', title: 'Category' },
            { id: 'Default Price', title: 'Default Price' },
            { id: 'Is Discountable', title: 'Is Discountable' },
            { id: 'Tags', title: 'Tags' },
            { id: 'UOM', title: 'UOM' },
            { id: 'Unit Cost', title: 'Unit Cost' },
            { id: 'Commission Type', title: 'Commission Type' },
            { id: 'Commission Value', title: 'Commission Value' },
            { id: 'Duration', title: 'Duration' },
            { id: 'English Name', title: 'English Name' },
            { id: 'Arabic Name', title: 'Arabic Name' },
            { id: 'English Description', title: 'English Description' },
            { id: 'Arabic Description', title: 'Arabic Description' },
            { id: 'Brand', title: 'Brand' },
            { id: 'Barcodes', title: 'Barcodes' },
            { id: 'defaultTax', title: 'Default Tax' },
            { id: 'kitchenName', title: 'Kitchen Name' },
            { id: 'sku', title: 'SKU' },
          ],
        });

        // Write the data to the CSV file
        await csvWriter.writeRecords(selectList.rows);


      } else {
        console.log(">>>>>>>>>>xlsx")

        // Create a new workbook
        const workbook = xlsx.utils.book_new()

        // Specify the headers based on your data keys
        const headers = Object.keys(selectList.rows[0]); // Get headers from the first object

        // Convert the array to a worksheet
        const worksheet = xlsx.utils.json_to_sheet(selectList.rows, { header: headers, skipHeader: false });

        // Calculate maximum width for each column based on the content
        const colWidths = headers.map(header => {
          // Get maximum length of corresponding column values
          const maxLength = Math.max(
            ...selectList.rows.map((row: any) => {
              const value = row[header];
              return value ? value.toString().length : 0; // Use 0 for empty values
            })
          );

          // Return the width in pixels, ensuring a minimum width
          return { wpx: Math.max(maxLength * 10, 50) }; // Adjust multiplier as needed
        });

        // Set the column widths
        worksheet['!cols'] = colWidths;

        // Append the worksheet to the workbook
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Data');

        // Generate a binary string for the workbook
        xlsx.writeFile(workbook, companyId + 'products.xlsx');


      }


      return new ResponseData(true, "", "Products exported successfully.");
    } catch (error: any) {
    
      throw new Error("Error exporting products: " + error.message); // Include the actual error message
    }
  }


  public static async getProductsTags(data: any, companyId: string) {
    try {



      let offset = 0;
      let page = data.page ?? 1;
      let searchTerm = data.searchTerm ? data.searchTerm.toLowerCase().trim() : null
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }
      console.log(searchTerm)
      let values = [companyId, searchTerm, limit, offset]


      let query = `with "tags" as (select distinct unnest(tags) tag, count(*) from "Products"
                                  WHERE "Products"."companyId" =$1
    
                                  group by  unnest(tags)
                                )

                                select * from "tags"
                                  where ($2::text is null or lower(tag) ~ $2)
                                  order by "tags" 
                                  limit $3
                                  offset $4
                               `





      const tags = await DB.excu.query(query, values);
      let count = tags.rows && tags.rows.length > 0 ? Number((<any>tags.rows[0]).count) : 0
      let pageCount = Math.ceil(count / limit)

      offset += 1
      let lastIndex = ((page) * limit)
      if (tags.rows.length < limit || page == pageCount) {
        lastIndex = count
      }
      const resData = {
        list: tags.rows,
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


  public static async getProductLatestCost(client: PoolClient, productId: string, branchId: string) {
    try {
      const query = {
        text: `SELECT "cost" FROM "InventoryMovmentRecords" 
              where "branchId" = $1
              and "productId" = $2
                AND qty >= 0
                        AND cost IS NOT NULL
                        AND "referenceTable" <> 'FIFO Cost Adjusment'
              order by "createdAt" DESC 
              LIMIT 1 
         `,
        values: [branchId, productId]
      }

      const product = await client.query(query.text, query.values);
      if (product && product.rows && product.rows.length > 0) {
        const cost = product.rows[0].cost ?? 0
        return {
          cost: cost
        }

      }
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async get_avg_available_UnitCost(productId: string, requiredQty: number, branchId: string) {
    try {
      const query = {
        text: `WITH picked AS (
                SELECT 
                  "productId",
                    "createdAt",
                    qty,
                    cost,
                    SUM(qty::text::numeric) OVER (PARTITION BY "productId" ORDER BY "createdAt" DESC ROWS UNBOUNDED PRECEDING) AS running_total
                FROM "InventoryMovmentRecords" 
                WHERE "productId" = $1 and "branchId" = $2
            ),
            needed AS (
                SELECT *,
                      CASE 
                          WHEN running_total > $3 THEN $3 - (running_total::text::numeric - qty::text::numeric)
                          ELSE qty
                      END AS taken_qty
                FROM picked
            )
            SELECT 
                SUM(taken_qty::text::numeric) AS total_taken,
                SUM(taken_qty::text::numeric * cost::text::numeric) * 1.0 / SUM(taken_qty::text::numeric) AS "cost"
            FROM needed
            WHERE taken_qty > 0
                    `,
        values: [productId, branchId, requiredQty]
      }
      let cost = 0
      let taken_qty = 0

      const product = await DB.excu.query(query.text, query.values);
      if (product && product.rows && product.rows.length > 0) {
        cost = Number(product.rows[0].cost ?? 0)
        taken_qty = Number(product.rows[0].total_taken ?? 0)
      }
      return { cost: cost, taken_qty: taken_qty }
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async get_avg_available_UnitCost_Bulk(
    productIds: string[],
    branchId: string,
    requiredQtyMap: Record<string, number> // productId -> requiredQty
  ) {
    try {
      const query = {
        text: `
        WITH picked AS (
          SELECT 
            "productId",
            "createdAt",
            qty,
            cost,
            SUM(qty::text::numeric) OVER (
              PARTITION BY "productId"
              ORDER BY "createdAt" DESC ROWS UNBOUNDED PRECEDING
            ) AS running_total
          FROM "InventoryMovmentRecords"
          WHERE "productId" = ANY($1::uuid[]) AND "branchId" = $2
        ),
        needed AS (
          SELECT *,
            CASE 
              WHEN running_total > COALESCE((jsonb_extract_path_text($3::jsonb, "productId"::text))::numeric, 0) 
                THEN (jsonb_extract_path_text($3::jsonb, "productId"::text))::numeric - (running_total::numeric - qty::numeric)
              ELSE qty
            END AS taken_qty
          FROM picked
        )
        SELECT 
          "productId",
          SUM(taken_qty::numeric) AS total_taken,
          SUM(taken_qty::numeric * cost::numeric) * 1.0 / NULLIF(SUM(taken_qty::numeric), 0) AS cost
        FROM needed
        WHERE taken_qty > 0
        GROUP BY "productId"
      `,
        values: [
          productIds,
          branchId,
          JSON.stringify(requiredQtyMap) // pass required qty as JSON object
        ]
      };

      const result = await DB.excu.query(query.text, query.values);

      const costs: Record<string, { cost: number; taken_qty: number }> = {};
      for (const row of result.rows) {
        costs[row.productId] = {
          cost: Number(row.cost ?? 0),
          taken_qty: Number(row.total_taken ?? 0)
        };
      }

      return costs;
    } catch (error: any) {
      throw new Error(error);
    }
  }



  public static async getParentInfo(productId: string, branchId: string) {
    try {
      const query = {
        text: `select p.id as "productId",
        p."parentId",
        bp."onHand",
        p."childQty"
        from "BranchProducts" bp  
        JOIN "Products" p ON bp."productId" = p."id"
        where bp."productId" =$1 and "branchId" =$2 `,
        values: [productId, branchId]
      }
      let product = null

      const records = await DB.excu.query(query.text, query.values);
      if (records && records.rows && records.rows.length > 0) {
        product = records.rows[0]
      }
      return product
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async getProductKitBuilder(productId: string, branchId: string) {
    try {
      const query = {
        text: `SELECT 
                  p.id,
                  json_agg(
                      json_build_object(
                          'productId', el->>'productId',
                          'qty', (el->>'qty')::float,
                          'parentId', kitProducts."parentId",
                          'unitCost', COALESCE(NULLIF(bp."productUnitCost", 0),kitProducts."unitCost"),
                          'name', kitProducts."name",
                          'UOM', kitProducts."UOM"
                      )
                  ) AS kit_items
              FROM "Products" p
              JOIN LATERAL json_array_elements(p."kitBuilder") AS el ON TRUE
              JOIN "Products" kitProducts ON kitProducts.id::text = el->>'productId'
              INNER JOIN "BranchProducts" bp 
                  ON bp."productId" = kitProducts.id 
                  AND bp."branchId" = $2
              WHERE p.id = $1
              GROUP BY p.id;
                    `,
        values: [productId, branchId]
      }
      const kitBuilder = await DB.excu.query(query.text, query.values);
      let kitItems: any[] = []
      if (kitBuilder && kitBuilder.rows && kitBuilder.rows.length > 0) {
        let items = kitBuilder.rows[0].kit_items
        for (let index = 0; index < items.length; index++) {
          const element = items[index];
          if (element.parentId) {
            element.unitCost = await BranchProductsRepo.getChildParentCost(element.productId, branchId)
          }
          kitItems.push(element)
        }

      }
      return kitItems
    } catch (error: any) {
      throw new Error(error)
    }
  }


  public static async getProductCategoryMaxIndex(client: PoolClient, companyId: string, categoryId: string) {
    try {
      const query = {
        text: `select COALESCE(max("categoryIndex"),0) + 1  as "max" from "Products" where "companyId"= $1 and "categoryId" = $2`,
        values: [companyId, categoryId]
      }
      let maximum = await client.query(query.text, query.values);

      return maximum && maximum.rows && maximum.rows.length > 0 && maximum.rows[0].max ? maximum.rows[0].max : 1
    } catch (error: any) {
      throw new Error(error)
    }
  }
}


