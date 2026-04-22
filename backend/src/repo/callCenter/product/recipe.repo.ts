
import { DB } from "@src/dbconnection/dbconnection";
import { Recipe } from "@src/models/product/Recipe";
import { ResponseData } from "@src/models/ResponseData";
import { RecipeValidation } from "@src/validationSchema/product/recipe.Schema";
import { PoolClient } from "pg";
// import { InventoryProductRepo } from "./productTypes/inventoryProduct.repo";

import { Company } from "@src/models/admin/company";
export class RecipeRepo {

  public static async checkIfRecipeIdExist(ids: [string], companyId: string) {

    const type = 'inventory'; //TODO add constraint //index for type and companyId 
    const query : { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Recipe" where id= ANY($1) and "companyId" = $2`,
      values: [ids, companyId],
    };

    const resault = await DB.excu.query(query.text, query.values);

    if ((<any>resault.rows[0]).qty == ids.length) {
      return true
    }

    return false

  }


  public static async checkIfRecipeNameExists(recipeId: string | null, name: string, companyId: string) {

    const query : { text: string, values: any } = {
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

    const resault = await DB.excu.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }

    return false;

  }
  public static async getRecipeName(recipeId:string,companyId:string){
    try {
      const query={
        text:`SELECT name FROM "Recipe" WHERE id = $1 and "companyId"=$2`,
        values:[recipeId,companyId]
      }
      const data = await DB.excu.query(query.text,query.values);
       return (<any>data.rows[0]).name 
    } catch (error:any) {
    
        throw new Error(error)
    }
  }
  // public static async addRecipe(data: any, company: Company) {
  //   try {
  //     const companyId = company.id;
  //     const validate = await RecipeValidation.addRecipeValidation(data)
  //     if (!validate.valid) {
  //       return new ResponseData(false, validate.error, null);
  //     }

  //     const recipe: Recipe = new Recipe();
  //     recipe.ParseJson(data);
  //     recipe.companyId = companyId;


  //     const recipeProductType = await InventoryProductRepo.checkInventoryType([(<any>recipe.items[0]).inventoryId], recipe.companyId);
  //     if (!recipeProductType) {
  //       throw new Error("Invalid recipe product Type");
  //     }
  //     const isNameExists = await RecipeRepo.checkIfRecipeNameExists(null, recipe.name, recipe.companyId);
  //     if (isNameExists) {
  //       throw new Error("Product Name Already used");
  //     }
  //     const query : { text: string, values: any } = {
  //       text: `INSERT INTO "Recipe"
  //                  (name, "companyId", items,description) 
  //                  VALUES($1, $2, $3,$4) RETURNING id`,
  //       values: [
  //         recipe.name,
  //         recipe.companyId,
  //         JSON.stringify(recipe.items),recipe.description],
  //     };
  //     const insert = await DB.excu.query(query.text, query.values);
  //     //assign Option Group

  //     return new ResponseData(true, "", { id: (<any>insert.rows[0]).id });

  //   } catch (error: any) {
  //   
  //     return new ResponseData(false, error, [])
  //   }


  // }
  public static async editRecipe(data: any, company: Company) {
    try {
      const companyId  = company.id;
      const validate = await RecipeValidation.addRecipeValidation(data)
      if (!validate.valid) {
        return new ResponseData(false, validate.error, null);
      }
      if (data.id == null || data.id == "") {
        throw new Error("Recipe id Is Required")
      }
      const recipe = new Recipe();
      recipe.ParseJson(data);
      recipe.companyId = companyId;
      const query : { text: string, values: any } = {
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
      return new ResponseData(true, "Updated Successfully", [])
    } catch (error: any) {
    
      return new ResponseData(false, error, [])
    }
  }
  public static async getRecipe(recipeId: string, company: Company) {
    try {
      const companyId =company.id;
      const query : { text: string, values: any } = {
        text: `SELECT * FROM "Recipe" WHERE id = ($1) and "companyId"=($2) `,
        values: [
          recipeId,
          companyId],
      };

      const recipe = await DB.excu.query(query.text, query.values);
      if (recipe.rowCount == 0) {
        throw new Error("Not Found");
      }


      const temp = new Recipe();
      temp.ParseJson(recipe.rows[0]);
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


  public static async getRecipes(data:any,company: Company){
    try {
      const companyId =company.id;
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


      const selectText = `SELECT
                            id,
                            name
                    
                      FROM "Recipe"`
      const countText = `SELECT
                        count(*)
                    FROM "Recipe"`

      let filterQuery = ` WHERE "companyId"=$1  `
      filterQuery += ` AND (LOWER ("Recipe".name) ~ $2)`
      const limitQuery = ` Limit $3 offset $4`

      let selectCount;
      let orderByQuery;
      selectQuery = selectText + filterQuery
      selectValues = [companyId,searchValue]


      if (data != null && data != '' && JSON.stringify(data) != '{}') {

       
        sort = data.sortBy;
        sortValue = !sort ? '"Recipe"."createdAt"' : '"' + sort.sortValue + '"';
        sortDirection = !sort ? "DESC" : sort.sortDirection;
        sortTerm = sortValue + " " + sortDirection
        orderByQuery = ` Order by ` + sortTerm;
        if (data.searchTerm != "" && data.searchTerm != null) {
          searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`
        }
        selectQuery = selectText + filterQuery + orderByQuery + limitQuery
        selectValues = [companyId,searchValue , limit, offset]
        countQuery = countText + filterQuery
        countValues = [companyId,searchValue]

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

    
       throw new Error(error)
    }
  }
  public static async getRecipeProducts(client: PoolClient, recipeId: string,usage:number, companyId: string) {
    try {

      const query : { text: string, values: any } = {
        text: `SELECT items FROM "Recipe" WHERE id = ($1) and "companyId"=($2) `,
        values: [
          recipeId,
          companyId],
      };
      const recipeData = await client.query(query.text, query.values);
      
      const items:any[]=[];
      const item = (<any>recipeData.rows[0]).items
      for (let index = 0; index < item.length; index++) {
        const element = item[index];
  
        query.text = `SELECT id, "unitCost","parentId", "childQty" FROM "Products" WHERE id = $1`;
        query.values=[element.inventoryId];
        const productData = await client.query(query.text,query.values);
  
        const product = productData.rows[0];
        const data ={
          id: product.id,
          unitCost:product.unitCost,
          totalUsage:  usage*element.usage
        }
      
        items.push(data);
      }
   
      return items;
    } catch (error:any) {
    
        throw new Error(error)
    }
  }
  public static async getMenuItemRecipeList(companyId:string){
    try {
      const types = ['inventory']
      const query : { text: string, values: any } = {
        text:`SELECT id,name,type,"unitCost"  from "Products"
        WHERE type = any($1)
        AND "Products"."companyId" =$2
        UNION
        SELECT "Recipe".id,"Recipe".name, 'Recipe' as type, sum("Products"."unitCost" *"items". "usage" ) as "unitCost" 
        from "Recipe",jsonb_to_recordset( "Recipe".items) as "items" ("usage" float4,"inventoryId" uuid )
        INNER JOIN "Products" ON "Products".id = "items"."inventoryId"
        WHERE "Recipe"."companyId" =$2
	    	GROUP BY "Recipe".id`,
        values:[types,companyId]
      }

      const listData = await DB.excu.query(query.text,query.values);
      return new ResponseData(true,"",listData.rows)

    } catch (error:any) {
    

        throw new Error(error)
    }
  }
}