import { DB } from "@src/dbconnection/dbconnection";
import { Recipe } from "@src/models/product/Recipe";
import { ResponseData } from "@src/models/ResponseData";
import { RecipeValidation } from "@src/validationSchema/product/recipe.Schema";
import { PoolClient } from "pg";


import { Company } from "@src/models/admin/company";
import { ProductRepo } from "./product.repo";
import { ValidationException } from "@src/utilts/Exception";
import { RedisClient } from "@src/redisClient";
import ExcelJS, { Borders } from 'exceljs'
import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { QuickRecipeManagment } from "./quickRecipeManagment.repo";
import { Log } from "@src/models/log";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";

export class RecipeRepo {

  public static async checkIfRecipeIdExist(client: PoolClient, ids: [string], companyId: string) {

    const type = 'inventory'; //TODO add constraint //index for type and companyId 
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Recipe" where id= ANY($1) and "companyId" = $2`,
      values: [ids, companyId],
    };

    const resault = await client.query(query.text, query.values);

    if ((<any>resault.rows[0]).qty == ids.length) {
      return true
    }

    return false

  }
  public static async checkIfRecipeNameExists(client: PoolClient, recipeId: string | null, name: string, companyId: string) {

    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Recipe" where LOWER(name) = LOWER($1) and id <> $2 and "companyId" = $3`,
      values: [
        name,
        recipeId,
        companyId,
      ],
    };
    if (recipeId == null) {
      query.text = `SELECT count(*) as qty FROM "Recipe" where LOWER(name) = LOWER($1) and "companyId" = $2`;
      query.values = [name, companyId];
    }

    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }

    return false;

  }
  public static async getRecipeName(recipeId: string, companyId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT name FROM "Recipe" WHERE id = $1 and "companyId"=$2`,
        values: [recipeId, companyId]
      }
      const data = await DB.excu.query(query.text, query.values);
      return (<any>data.rows[0]).name
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async addRecipe(data: any, company: Company) {
    const client = await DB.excu.client();
    try {
      const companyId = company.id;
      const validate = await RecipeValidation.addRecipeValidation(data)
      if (!validate.valid) {
        return new ResponseData(false, validate.error, null);
      }

      const recipe: Recipe = new Recipe();
      recipe.ParseJson(data);
      recipe.companyId = companyId;

      let inventoryIds: any = [];
      let types: any = ['inventory', 'kit']
      recipe.items.forEach((element: any) => {

        inventoryIds.push(element.inventoryId);

      });

      await client.query("BEGIN")
      const recipeProductType = await ProductRepo.checkIfProductsTypeValid(client, inventoryIds, types, companyId)
      if (!recipeProductType) {
        throw new ValidationException("Invalid recipe product Type");
      }
      const isNameExists = await RecipeRepo.checkIfRecipeNameExists(client, null, recipe.name, recipe.companyId);
      if (isNameExists) {
        throw new ValidationException("Product Name Already used");
      }
      const query: { text: string, values: any } = {
        text: `INSERT INTO "Recipe"
                   (name, "companyId", items,description) 
                   VALUES($1, $2, $3,$4) RETURNING id`,
        values: [
          recipe.name,
          recipe.companyId,
          JSON.stringify(recipe.items), recipe.description],
      };
      const insert = await client.query(query.text, query.values);
      //assign Option Group
      await client.query("COMMIT")

      return new ResponseData(true, "", { id: (<any>insert.rows[0]).id });

    } catch (error: any) {
      await client.query("ROLLBACK")

    
      throw new Error(error)
    } finally {
      client.release()
    }


  }
  public static async editRecipe(data: any, company: Company, employeeId: string) {
    const client = await DB.excu.client();
    try {
      const companyId = company.id;
      const validate = await RecipeValidation.addRecipeValidation(data)
      if (!validate.valid) {
        return new ResponseData(false, validate.error, null);
      }
      if (data.id == null || data.id == "") {
        throw new ValidationException("Recipe id Is Required")
      }

      const recipe = new Recipe();
      recipe.ParseJson(data);
      recipe.companyId = companyId;

      await client.query("BEGIN")
      const isNameExists = await RecipeRepo.checkIfRecipeNameExists(client, recipe.id, recipe.name, recipe.companyId);
      if (isNameExists) {
        throw new ValidationException("Product Name Already used");
      }

      let getEmployeeName = {
        text: `SELECT "Employees"."name" as "employeeName", "Recipe".name as "recipeName" , "Recipe"."items" 
                  FROM "Recipe"
                  INNER JOIN  "Employees" ON  "Employees".id = $1 and "Employees"."companyId" = $2
                  WHERE "Recipe".id = $3
                        `,
        values: [employeeId, companyId, recipe.id]
      }
      let recipeInfo = (await client.query(getEmployeeName.text, getEmployeeName.values)).rows[0]

      const query: { text: string, values: any } = {
        text: `Update  "Recipe" SET
                    name=$1  , items =$2,description=$3 WHERE
                    id=$4 AND "companyId"=$5 `,
        values: [
          recipe.name,
          JSON.stringify(recipe.items),
          recipe.description,
          recipe.id,
          recipe.companyId,
        ],
      };

      const edit = await DB.excu.query(query.text, query.values);





      const logs: Log[] = []
      const employeeName = recipeInfo.employeeName;

      if (recipeInfo.recipeName.toLowerCase().trim() != recipe.name.toLowerCase().trim()) {
        let log = new Log();
        log.employeeId = employeeId
        log.action = "Prep Recipe Modified"
        log.comment = `${employeeName} has modified the prep. Recipe Name from (${recipeInfo.recipeName}) to (${recipe.name})`

        log.metaData = {
          "recipeName": recipe.name,
          "recipeType": "prep"
        }
        logs.push(log)
      }

      const oldRecipeItems = recipeInfo.items
      oldRecipeItems.forEach((element: any) => {
        const temp = recipe.items.find((f: any) => element.inventoryId == f.inventoryId)
        if (temp && temp.usage != element.usage) {
          let log = new Log();
          log.employeeId = employeeId
          log.action = "Prep Recipe Modified"
          log.comment = `${employeeName} has modified the prep item Recipe of the item (${element.name})`
          log.metaData = {
            "recipeName": recipe.name,
            "itemName": element.name,
            "recipeType": "prep"
          }
          logs.push(log)
        } else if (!temp) {
          let log = new Log();
          log.employeeId = employeeId
          log.action = "Prep Recipe Modified"
          log.comment = `${employeeName} has Deleted item (${element.name}) from Recipe`
          log.metaData = {
            "recipeName": recipe.name,
            "itemName": element.name,
            "recipeType": "prep"
          }
          logs.push(log)
        }
      });

      recipe.items.forEach((element: any) => {
        const temp = oldRecipeItems.find((f: any) => element.inventoryId == f.inventoryId)
        if (!temp) {
          let log = new Log();
          log.employeeId = employeeId
          log.action = "Prep Recipe Modified"
          log.comment = `${employeeName} has add new item (${element.name}) to Recipe `
          log.metaData = {
            "recipeName": recipe.name,
            "itemName": element.name,
            "recipeType": "prep"
          }
          logs.push(log)
        }
      });

      if (logs.length > 0) {
        await LogsManagmentRepo.manageLogs(client, "Recipe", recipe.id, logs, null, companyId, employeeId, "", "Cloud")

      }



      await client.query("COMMIT")

      return new ResponseData(true, "Updated Successfully", [])
    } catch (error: any) {
      await client.query("ROLLBACK")
      console.log(error)
    
      throw new Error(error)
    } finally {
      client.release()
    }
  }
  public static async getRecipe(recipeId: string, company: Company) {
    try {
      const companyId = company.id;
      const query: { text: string, values: any } = {
        text: `SELECT id ,
                      name,
                      description,
                      items
               FROM "Recipe" WHERE id = ($1) AND "companyId" =$2 `,
        values: [recipeId, companyId],
      };

      const recipe = await DB.excu.query(query.text, query.values);
      if (recipe.rowCount == 0) {
        throw new ValidationException("Not Found");
      }


      const temp = new Recipe();
      temp.ParseJson(recipe.rows[0]);
      temp.items = await this.getRecipeItems(recipeId, company)
      // for (let index = 0; index < temp.items.length; index++) {
      //   const element:any = temp.items[index];
      //   if(element.name == null || element.name =="")
      //   {
      //   const name =await ProductRepo.getProductName(element.inventoryId)
      //   temp.items[index].name = name
      //   }
      //   if(element.type ==  null ||  element.type)
      //   {
      //     const type =await ProductRepo.getProductType(element.inventoryId)
      //     temp.items[index].type = type
      //   }


      // }
      return new ResponseData(true, "", temp);
    } catch (error: any) {
    
      throw new Error(error)
    }
  }

  public static async getRecipes(data: any, company: Company) {
    try {
      const companyId = company.id;
      let selectQuery;
      let selectValues;
      let countQuery;
      let countValues;
      let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';

      let sort = data.sortBy;
      let sortValue = !sort ? '"Recipe"."createdAt"' : '"' + sort.sortValue + '"';
      let sortDirection = !sort ? "DESC" : sort.sortDirection;
      let sortTerm = sortValue + " " + sortDirection
      let orderByQuery = ` Order by ` + sortTerm;




      let offset = 0;
      let page = data.page ?? 1
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }
      const query = {
        text: `SELECT count(*) over(),
                      id,
                      name
                FROM "Recipe"
              WHERE "companyId"=$1
              AND (LOWER ("Recipe".name) ~ $2)
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
  public static async getRecipeProducts(client: PoolClient, recipeId: string, usage: number) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT items FROM "Recipe" WHERE id = ($1)  `,
        values: [
          recipeId,
        ],
      };
      const recipeData = await client.query(query.text, query.values);

      const items: any[] = [];
      const item = (recipeData.rows) && (recipeData.rows.length > 0) ? (<any>recipeData.rows[0]).items : []
      for (let index = 0; index < item.length; index++) {
        const element = item[index];

        query.text = `SELECT id, "unitCost","parentId", "childQty" FROM "Products" WHERE id = $1`;
        query.values = [element.inventoryId];
        const productData = await client.query(query.text, query.values);

        const product = productData.rows[0];
        const data = {
          id: product.id,
          unitCost: product.unitCost,
          totalUsage: usage * element.usage,
          parentId: product.parentId,
          childQty: product.childQty
        }

        items.push(data);
      }
      return items;
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async getMenuItemRecipeList(data: any, company: Company) {
    try {
      const types = ['inventory', 'kit'];
      const companyId = company.id;
      let selectQuery;
      let selectValues;
      let countValues;
      let searchValue = '[A-Za-z0-9]*';
      let offset = 0;

      let count = 0;
      let pageCount = 0;

      let page = data.page ?? 1;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }

      const countText = `with "productCounts" as (
        select count(*) from "Products" 
         WHERE type = any($1)
         AND ( LOWER("Products".name) ~ $3 OR  LOWER("Products".barcode) ~ $3 )
         AND "Products"."companyId" =$2
         AND "Products"."isDeleted" = false
        ),"recipeCounts" as (
               SELECT count(*) as "count" 
                from "Recipe",jsonb_to_recordset( "Recipe".items) as "items" ("usage" float4,"inventoryId" uuid )
                INNER JOIN "Products" ON "Products".id = "items"."inventoryId"
                WHERE "Recipe"."companyId" =$2
                AND ( LOWER("Recipe".name) ~ $3)
        )
        select sum("productCounts".count) + sum("recipeCounts".count)  as "count" from "productCounts","recipeCounts"
        `

      selectQuery = `

SELECT 
    p.id,
    p.name,
    p.type,
    p."UOM",
    p."defaultPrice",
    p."barcode",
    latest."cost" AS "unitCost",
    c.name AS "categoryName",
    d.name AS "departmentName",
    CASE 
        WHEN m.id IS NOT NULL THEN 
            JSON_BUILD_OBJECT(
                'thumbnailUrl', 
                CONCAT(REPLACE(m.url->>'defaultUrl', split_part(m.url->>'defaultUrl', '/', -1), ''), 'Thumbnail_', split_part(m.url->>'defaultUrl', '/', -1))
            )::TEXT
    END AS "mediaUrl"
FROM "Products" p
LEFT JOIN LATERAL (
    SELECT imr."cost"
    FROM "InventoryMovmentRecords" imr
    WHERE imr."companyId" = p."companyId"
      AND imr."productId" = p.id
      AND imr."qty" >= 0
    ORDER BY imr."createdAt" DESC
    LIMIT 1
) latest ON TRUE
LEFT JOIN "Categories" c ON c.id = p."categoryId"
LEFT JOIN "Departments" d ON d.id = c."departmentId"
LEFT JOIN "Media" m ON m.id = p."mediaId"
WHERE p."companyId" =$2
  AND p.type = any($1)
  AND p."isDeleted" = false
   AND ( LOWER(p.name) ~ $3 OR  LOWER(p.barcode) ~ $3 )
UNION ALL

-- RECIPES PART
SELECT 
    r.id,
    r.name,
    'Recipe' AS type,
    '' AS "UOM",
    NULL::REAL AS "defaultPrice",
    '' AS "barcode",
    SUM(latest."cost" * items."usage") AS "unitCost",
    '' AS "categoryName",
    '' AS "departmentName",
    NULL::TEXT AS "mediaUrl"
FROM "Recipe" r
JOIN LATERAL jsonb_to_recordset(r.items) AS items("usage" float4, "inventoryId" uuid) ON TRUE
JOIN "Products" p ON p.id = items."inventoryId"
LEFT JOIN LATERAL (
    SELECT imr."cost"
    FROM "InventoryMovmentRecords" imr
    WHERE imr."companyId" = p."companyId"
      AND imr."productId" = p.id
      AND imr."qty" >= 0
    ORDER BY imr."createdAt" DESC
    LIMIT 1
) latest ON TRUE
WHERE r."companyId" =$2
      AND ( LOWER(r.name) ~ $3)
GROUP BY r.id, r.name
      limit $4 offset $5
      `
      if (data && data.searchTerm != "" && data.searchTerm != null) {
        searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`

      }
      selectValues = [types, companyId, searchValue, limit, offset]

      countValues = [types, companyId, searchValue]

      let selectCount = await DB.excu.query(countText, countValues)
      count = Number((<any>selectCount.rows[0]).count)
      pageCount = Math.ceil(count / data.limit)


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
      //   text: `SELECT id,name,type,"unitCost"  from "Products"
      //   WHERE type = any($1)
      //   AND "Products"."companyId" =$2
      //   UNION
      //   SELECT "Recipe".id,"Recipe".name, 'Recipe' as type, sum("Products"."unitCost" *"items". "usage" ) as "unitCost" 
      //   from "Recipe",jsonb_to_recordset( "Recipe".items) as "items" ("usage" float4,"inventoryId" uuid )
      //   INNER JOIN "Products" ON "Products".id = "items"."inventoryId"
      //   WHERE "Recipe"."companyId" =$2
      // 	GROUP BY "Recipe".id`,
      //   values: [types, companyId]
      // }

      // const listData = await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", resData)

    } catch (error: any) {
    

      throw new Error(error)
    }
  }

  public static async importFromCVS(data: any, company: Company, pageNumber: number, count: number) {

    let redisClient = RedisClient.getRedisClient();
    try {
      let errors = [];

      const companyId = company.id;

      let limit: any = process.env.NUMBER_OF_IMPORT_RECOREDS ?? 2000;
      const products: any[] = []

      for (let index = 0; index < data.length; index++) {

        let progress = Math.floor((((index + 1) + ((pageNumber - 1) * limit)) / count) * 100) + "%"
        await redisClient.set("recipeBulkImport" + company.id, JSON.stringify({ progress: progress }))

        const tempElement = { ...data[index] }

        let query: { text: string, values: any } = {
          text: `SELECT id as "inventoryId", barcode, name, type  FROM "Products" where id =$2::uuid and "companyId" = $1`,
          values: [companyId, tempElement.inventoryId]
        }

        if (!tempElement.inventoryId) {
          query.text = `SELECT id as "inventoryId" ,barcode, name, type  FROM "Products" where barcode ilike $2::text and "companyId" = $1`,
            query.values = [companyId, tempElement.barcode.trim()]
        }

        let product = await DB.excu.query(query.text, query.values);
        let element: { inventoryId: string, barcode: string, usage: number, name: string, type: string }

        if (product.rows && product.rows.length > 0) {
          let m = <any>product.rows[0]
          element = {
            inventoryId: m.inventoryId ?? null,
            barcode: m.barcode ?? tempElement.barcode,
            name: m.name ?? "",
            type: m.type ?? "",
            usage: Number.isNaN(parseFloat(tempElement.stock?.toString())) ? 0 : parseFloat(tempElement.stock.toString()),
          }



          if (element.type != 'inventory') {
            errors.push({ productbarcode: element.barcode, error: "invalid Type" })
            continue;
          }

          products.push(element)

        } else {
          errors.push({ productbarcode: tempElement.barcode, error: "barcode does not exist" })
          continue;
        }
      }


      return new ResponseData(true, "", { errors: errors, products: products })

    } catch (error: any) {
      console.log(error)
      return new ResponseData(false, error.message, [])

    }

  }

  public static async exportXslForRecipeImport(companyId: string) {
    try {


      let borderStyle: Partial<Borders> = {
        bottom: { style: 'medium' },
        right: { style: 'medium' },
        left: { style: 'medium' },
        top: { style: 'medium' },
      }

      // Create a new workbook and add a worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet 1');
      let header = worksheet.addRow(['Product Name', 'Ingredient Product', 'Usage'])
      header.font = { name: "Cambria", bold: true }
      header.getCell('A').border = borderStyle;
      header.getCell('B').border = borderStyle;
      header.getCell('C').border = borderStyle;
      worksheet.getColumn('A').width = 40;
      worksheet.getColumn('B').width = 40;
      worksheet.getColumn('C').width = 20;
      // Define the list of values
      const query = {
        text: `SELECT JSON_AGG(name) "products" from "Products" where "companyId" = $1 and "type"= 'menuItem' and "isDeleted" = false`,
        values: [companyId]
      }
      let products = await DB.excu.query(query.text, query.values);

      const listValues: any = (<any>products.rows[0]).products;


      const startRow = 2;
      const endRow = 101; // Maximum number of rows in Excel

      const listString = listValues.join(',');
      // worksheet.getColumn('A').eachCell()
      for (let rowNumber = startRow; rowNumber <= endRow; rowNumber++) {
        const cell = worksheet.getCell(`A${rowNumber}`);
        cell.dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`"${listString}"`],
        };
        cell.border = borderStyle
      }
      /**range  */
      /**
       * 
       * worksheet.getCell('A1').dataValidation = {
  type: 'list',
  allowBlank: true,
  formulae: ['$D$5:$F$5']
};

       */
      query.text = `SELECT JSON_AGG(name) "products" from "Products" where "companyId" = $1 and "type"= 'inventory' and "isDeleted" = false`
      products = await DB.excu.query(query.text, query.values);
      const listInventoryValues: any = (<any>products.rows[0]).products;




      const listInventoryString = listInventoryValues.join(',');
      for (let rowNumber = startRow; rowNumber <= endRow; rowNumber++) {
        const cell = worksheet.getCell(`B${rowNumber}`);
        cell.dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`"${listInventoryString}"`],
        };
        cell.border = borderStyle

      }

      // Add data validation to a cell (e.g., A1)
      // worksheet.getCell('A2:A100').dataValidation = {
      //   type: 'list',
      //   allowBlank: false,
      //   formulae: [`"${listString}"`],
      // };

      // Save the workbook to a file

      return workbook

    } catch (error: any) {
      console.log(error)
      throw new Error(error)
    }
  }




  public static async getRecipeItems(recipeId: string, company: Company) {
    try {

      const companyId = company.id;

      const query = {
        text: `SELECT  
                  (el->>'inventoryId') ::uuid AS "inventoryId",
                  p.name, p."unitCost",
                  (el->>'usage')::float AS "usage",
                  p."UOM",
                  p."barcode",
                  p."defaultPrice",
                  p."type"			  
                FROM "Recipe"
                CROSS JOIN jsonb_array_elements("items") el
                JOIN "Products" p ON p.id =(el->>'inventoryId')::uuid
                WHERE "Recipe".id = $1 AND "Recipe"."companyId" = $2 `,
        values: [recipeId, companyId]
      }

      let recipe = await DB.excu.query(query.text, query.values);
      let list: any[] = (recipe.rows && recipe.rows.length > 0) ? recipe.rows : []

      return list

    } catch (error: any) {
      throw new Error(error)
    }
  }


}