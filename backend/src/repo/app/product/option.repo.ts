import { DB } from "@src/dbconnection/dbconnection";
import { Option } from "@src/models/product/Option";
import { OptionGroup } from "@src/models/product/OptionGroup";
import { ResponseData } from "@src/models/ResponseData";
import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { SocketOption } from "@src/repo/socket/option.socket";
import { OptionValidation } from "@src/validationSchema/product/option.Schema";



import { Company } from "@src/models/admin/company";
import { PoolClient } from "pg";
import { ValidationException } from "@src/utilts/Exception";
import { RedisClient } from '@src/redisClient';
import { Helper } from "@src/utilts/helper";
import moment from "moment";
import { createObjectCsvWriter } from "csv-writer";
import xlsx from 'xlsx';
import format from 'pg-format'
import { MenuItemProductRepo } from "./productTypes/menuItemProduct.repo";
import { QuickRecipeManagment } from "./quickRecipeManagment.repo";
import { ShopRepo } from "@src/repo/ecommerce/shop.repo";
interface excludedOption { optionId: string | null, pauseUntil?: any }

export class OptionRepo {

  public static async checkIfOptionGroupsExist(client: PoolClient, Ids: [string], companyId: string) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "OptionGroups" where id = ANY($1) and "companyId" = $2 `,
      values: [
        Ids,
        companyId,
      ],
    };
    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }
  public static async checkIfOptioIdExist(client: PoolClient, ids: any[], companyId: string) {
    ids = [...new Set(ids.filter((id) => id))];
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Options" where id=ANY($1) and "companyId" = $2 `,
      values: [ids, companyId],
    };
    const resault = await client.query(query.text, query.values);

    if ((<any>resault.rows[0]).qty == ids.length) {
      return true
    }
    return false
  }
  public static async checkIfOptionNameExist(client: PoolClient, optionId: string | null, name: string, companyId: string) {

    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Options" where LOWER(name) = LOWER($1) and id <> $2 and "companyId" = $3`,
      values: [
        name,
        optionId,
        companyId,

      ],
    };
    if (optionId == null) {
      query.text = `SELECT count(*) as qty FROM "Options" where LOWER(name) = LOWER($1)  and "companyId" = $2 `;
      query.values = [name, companyId];
    }

    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }

    return false;

  }
  public static async checkIfOptionGroupTitleExist(client: PoolClient, optionGroupId: string | null, title: string, companyId: string) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "OptionGroups" where LOWER(title) = LOWER($1) and id <> $2 and "companyId" = $3`,
      values: [
        title,
        optionGroupId,
        companyId,

      ],
    };
    if (optionGroupId == null) {
      query.text = `SELECT count(*) as qty FROM "OptionGroups" where title = $1  and "companyId" = $2 `;
      query.values = [title, companyId];
    }

    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }

    return false;
  }



  // public static async getOptionsNameAndId(optionIds: [string], companyId: string) {
  //   try {
  //     const query : { text: string, values: any } = {
  //       text: `SELECT id as "optionId",name from "Options" WHERE id=ANY($1) and "companyId"=$2`,
  //       values: [optionIds, companyId]
  //     }
  //     const data = await DB.excu.query(query.text, query.values);
  //     return data.rows
  //   } catch (error: any) {
  //   
  //      throw new Error(error)
  //   }
  // }
  // public static async getOptionGroupTitle(optionGroupId: string, companyId: string) {
  //   try {
  //     const query : { text: string, values: any } = {
  //       text: `SELECT title from "OptionGroups" where  id =$1 AND "companyId"=$2`,
  //       values: [optionGroupId, companyId]
  //     }
  //     const data = await DB.excu.query(query.text, query.values);

  //     return (<any>data.rows[0]).name
  //   } catch (error: any) {
  //   
  //      throw new Error(error)
  //   }
  // }


  public static async InsertOptionGroup(client: PoolClient, data: any, company: Company) {
    try {
      const companyId = company.id;
      const validate = await OptionValidation.optionGroupValidation(data);
      if (!validate.valid) {
        return new ResponseData(false, validate.error, null);
      }
      const optionGroup = new OptionGroup();
      optionGroup.ParseJson(data);
      optionGroup.companyId = companyId;
      const optionIds: any[] = [];
      optionGroup.options.forEach(element => {
        optionIds.push(element.optionId);
      });

      const isNameExists = await this.checkIfOptionGroupTitleExist(client, null, optionGroup.title, optionGroup.companyId);
      if (isNameExists) {
        throw new ValidationException("Title Already Used")
      }
      const isOptionIdExist = await this.checkIfOptioIdExist(client, optionIds, optionGroup.companyId)
      if (!isOptionIdExist) {
        throw new ValidationException("Option Id dosn't exist")
      }

      if (optionGroup.minSelectable > optionGroup.options.length) {
        throw new ValidationException("Minimum Selectable can't be greater than options length")
      }

      optionGroup.updatedDate = new Date()
      const query: { text: string, values: any } = {
        text: 'INSERT INTO "OptionGroups"(title,"alias","minSelectable", "maxSelectable",translation,"companyId",options,"updatedDate","mediaId") VALUES($1, $2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
        values: [optionGroup.title,
        optionGroup.alias,
        optionGroup.minSelectable,
        optionGroup.maxSelectable,
        optionGroup.translation,
        optionGroup.companyId,
        JSON.stringify(optionGroup.options),
        optionGroup.updatedDate,
        optionGroup.mediaId
        ],
      };
      const insert = await client.query(query.text, query.values);
      optionGroup.id = (<any>insert.rows[0]).id

      const branchIds = await BranchesRepo.getCompanyBranchIds(client, companyId);
      await SocketOption.sendNewOptionGroup(optionGroup, branchIds)
      const resdata = {
        id: optionGroup.id
      }
      return new ResponseData(true, "", resdata)
    } catch (error: any) {

    
      throw new Error(error)
    }
  }
  public static async editOptionGroup(data: any, company: Company) {
    const client = await DB.excu.client();
    try {

      const companyId = company.id;
      const validate = await OptionValidation.optionGroupValidation(data);
      if (!validate.valid) {
        return new ResponseData(false, validate.error, null);
      }
      if (data.id == null || data.id == "") {
        throw new ValidationException("Option Group id Is Required")
      }
      const optionGroup = new OptionGroup();
      optionGroup.ParseJson(data);
      optionGroup.companyId = companyId

      if (optionGroup.minSelectable > optionGroup.options.length) {
        throw new ValidationException("Minimum Selectable can't be greater than options length")
      }
      await client.query("BEGIN");
      const isNameExists = await this.checkIfOptionGroupTitleExist(client, optionGroup.id, optionGroup.title, optionGroup.companyId);
      if (isNameExists) {
        throw new ValidationException("Title Already Used")
      }
      optionGroup.updatedDate = new Date()

      const query: { text: string, values: any } = {
        text: 'UPDATE "OptionGroups" SET title=$1,"alias" = $2,"minSelectable"=$3,"maxSelectable"=$4,translation=$5,options=$6,"updatedDate" =$7,"mediaId"=$8 WHERE id = $9 AND "companyId"=$10',
        values: [optionGroup.title, optionGroup.alias, optionGroup.minSelectable,
        optionGroup.maxSelectable,
        optionGroup.translation, JSON.stringify(optionGroup.options), optionGroup.updatedDate, optionGroup.mediaId, optionGroup.id, optionGroup.companyId],
      };
      const insert = await client.query(query.text, query.values);
      const branchIds = await BranchesRepo.getCompanyBranchIds(client, companyId);
      await SocketOption.sendUpdatedOptionGroup(optionGroup, branchIds)
      await client.query("COMMIT");
      return new ResponseData(true, "Updated Successfully", null)
    } catch (error: any) {
      await client.query("ROLLBACK");
    
      throw new Error(error)
    } finally {
      client.release()
    }
  }
  public static async getOptionGroupsList(data: any, company: Company) {

    try {
      const companyId = company.id;
      let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';



      let sort = data.sortBy;
      let sortValue = !sort ? '"OptionGroups"."createdAt"' : '"' + sort.sortValue + '"';
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
        text: `SELECT
        count(*) over(),
              id,
              title, 
              "alias",
              translation
              FROM "OptionGroups"
      WHERE "companyId"=$1
      AND (LOWER ("OptionGroups".title) ~ $2)
      ${orderByQuery}
      Limit $3 offset $4`,
        values: [company.id, searchValue, limit, offset]
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
  public static async getOptionGroups(company: Company, optionsGroupId: string, brandId: string) {
    try {
      const companyId = company.id;
      const query: { text: string, values: any } = {
        text: `with "optionGroups" as (
              SELECT "OptionGroups" .*, 
                     "Media"."url"->>'defaultUrl'
                  FROM "OptionGroups" 
                  Left JOIN "Media" on "Media".id = "OptionGroups"."mediaId"
                  WHERE "OptionGroups" ."companyId"=$1 AND "OptionGroups".id = $2 
          ), "optionGroup" as (
          select 
              "optionGroups".id,
              "optionGroups".title,
              "optionGroups"."alias",
              "minSelectable",
              "maxSelectable",
              "optionGroups".translation::text::jsonb,
              case when count("Options".id) > 0 then  json_agg(jsonb_build_object('index', ("elem"->>'index')::int,'optionId',"Options".id,'name',"Options".name,'price',"Options".price,'qty',COALESCE(("elem"->>'qty')::float,1::float) )) end  as "options"     
              from "optionGroups",json_array_elements("options") AS elem
              left JOIN "Options"  ON "Options".id = (elem->>'optionId')::uuid and  ("Options"."isDeleted" = false or "Options"."isDeleted" is null)
              
              group by "optionGroups".id,
                       "optionGroups".id,
                       "optionGroups".title,
                       "optionGroups"."alias",
                       "minSelectable",
                       "maxSelectable",
                       "optionGroups".translation::text::jsonb
          ) 
          select * from "optionGroup"`,
        values: [companyId, optionsGroupId],
      };
      const optionsGroupList = await DB.excu.query(query.text, query.values);
      if (optionsGroupList.rowCount == 0) {
        throw new ValidationException("Not Found");
      }
      const optionGroup: any = optionsGroupList.rows[0]

      return new ResponseData(true, "", optionGroup)
    } catch (error: any) {
    
      throw new Error(error)
    }
  }


  public static async getOptionRecipe(client: PoolClient, optionId: string) {
    try {

      const query: { text: string, values: any } = {
        text: `SELECT recipe FROM "Options" where id =$1`,
        values: [optionId]
      }

      let option = await client.query(query.text, query.values);
      if (option.rows.length == 0) {
        return [];
      }
      return option.rows[0].recipe

    } catch (error: any) {
      throw new Error(error)
    }
  }
  public static async addOption(client: PoolClient, data: any, company: Company) {

    try {
      const companyId = company.id;
      const validate = await OptionValidation.optionsValidation(data);
      if (!validate.valid) {
        return new ResponseData(false, validate.error, null);
      }

      const afterDecimal = company.afterDecimal
      const option = new Option();
      option.ParseJson(data);
      option.companyId = companyId;
      option.price = +(option.price).toFixed(afterDecimal)
      const isNameExists = await this.checkIfOptionNameExist(client, null, option.name, option.companyId);
      if (isNameExists) {
        throw new ValidationException("Option Name Already Exist")
      }
      option.updatedDate = new Date()

      const query: { text: string, values: any } = {
        text: `INSERT INTO  "Options"(name,"displayName",translation, price,"isMultiple","isVisible","companyId","updatedDate","mediaId","recipe","kitchenName","excludedBranches","weight") 
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        values: [option.name, option.displayName, option.translation, option.price, option.isMultiple, option.isVisible, option.companyId, option.updatedDate, option.mediaId, JSON.stringify(option.recipe), option.kitchenName, JSON.stringify(option.excludedBranches), option.weight],
      };
      const insert = await client.query(query.text, query.values);
      option.id = (<any>insert.rows[0]).id

      const resdata = {
        id: option.id
      }
      const branchIds = await BranchesRepo.getCompanyBranchIds(client, companyId);
      await SocketOption.sendNewOption(option, branchIds)
      return new ResponseData(true, "Option Added Successfully", resdata)
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async editOption(client: PoolClient, data: any, company: Company) {

    try {
      const companyId = company.id;
      const validate = await OptionValidation.optionsValidation(data);
      if (!validate.valid) {
        return new ResponseData(false, validate.error, null);
      }
      if (data.id == null || data.id == "") {
        throw new ValidationException("Option id Is Required")
      }

      const afterDecimal = company.afterDecimal
      const option = new Option();
      option.ParseJson(data);
      option.companyId = companyId;
      option.price = +(option.price).toFixed(afterDecimal)

      const isNameExists = await this.checkIfOptionNameExist(client, option.id, option.name, option.companyId);
      if (isNameExists) {
        throw new ValidationException("Option Name Already Exist")
      }
      option.updatedDate = new Date()

      const query: { text: string, values: any } = {
        text: `UPDATE "Options" SET name= $1,"displayName"= $2,translation= $3, price= $4,"isMultiple"= $5,"isVisible"= $6, "updatedDate"= $7 ,"mediaId"=$8 ,"recipe"=$9,"kitchenName"=$10,"weight"=$11
            WHERE id = $12 RETURNING id`,
        values: [option.name, option.displayName, option.translation, option.price, option.isMultiple, option.isVisible, option.updatedDate, option.mediaId, JSON.stringify(option.recipe), option.kitchenName, option.weight, option.id],
      };

      const insert = await DB.excu.query(query.text, query.values);
      const branchIds = await BranchesRepo.getCompanyBranchIds(client, companyId);
      await SocketOption.sendupdatedOption(option, branchIds)


      return new ResponseData(true, "Updated Successfully", [])
    } catch (error: any) {

    
      throw new Error(error)
    } finally {

    }
  }
  public static async getOptions(data: any, company: Company) {
    try {
      const companyId = company.id;
      let searchValue = data.searchTerm ? '%' + data.searchTerm.toLowerCase().trim() + '%' : null ;


      let sort = data.sortBy;
      let sortValue = !sort ? '"Options"."createdAt"' : '"' + sort.sortValue + '"';
      let sortDirection = !sort ? "DESC" : sort.sortDirection;
      let sortTerm = sortValue + " " + sortDirection
      let orderByQuery = ` Order by ` + sortTerm;


      let offset = 0;
      let page = data.page ?? 1;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }


      const query: { text: string, values: any } = {
        text: `SELECT
              count(*) over(),
              id,
              name,
              "Options"."displayName",
              "Options"."translation",
              "Options".price,
              "Options"."excludedBranches"
        FROM "Options"
      WHERE "companyId"=$1
      and    "Options"."isDeleted" = false 
      AND ($2::text is null or ( (LOWER ("Options".name) ilike $2 OR
      LOWER ("Options"."displayName") ilike $2 ))
      )
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



  public static async updateOptionGroupTranslation(data: any) {
    try {
      const query: { text: string } = {
        text: `UPDATE "OptionGroups" SET  translation=$2 WHERE id=$1;`
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
  public static async updateOptionTranslation(data: any) {
    try {
      const query: { text: string } = {
        text: `UPDATE "Options" SET  translation=$2 WHERE id=$1;`
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

  public static async getOptionRecipeItemsOld(optionId: string, companyId: string) {
    try {

      const mainBranch = await BranchesRepo.getMainBranch(null, companyId)
      const branchId = mainBranch && mainBranch.branch ? mainBranch.branch.id : null;

      const query = {
        text: `with "productRecipeBreak" as (
              select el->>'inventoryId' as "inventoryId" , el->>'recipeId' as "recipeId" , (el->>'usages') as "usages" from "Options" , jsonb_array_elements("recipe") el 
              where id  =$1
               ), "productRecipeInventory" as (

                  select distinct on ("Products"."id") "Products"."id" as "productId","Products".name, "cost" as "unitCost" , "Products"."parentId",  "productRecipeBreak"."usages"  from "productRecipeBreak"
                    inner join "Products" on "Products".id = "productRecipeBreak"."inventoryId"::uuid 
                    left join "InventoryMovmentRecords" on "InventoryMovmentRecords"."productId" = "productRecipeBreak"."inventoryId"::uuid and "InventoryMovmentRecords"."branchId" =$2	and "InventoryMovmentRecords".qty>=0
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
                      sum("recipeUsage"  * "latest"."cost") as "unitCost",
                      "usages"
             
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
              
                    group by "recipeItems"."productId", "recipeItems".id, "recipeItems".name,   "parentId",  "usages"
					       
                  )
                  select 
                  "productRecipeInventory"."productId" as "inventoryId",
                    null::uuid as "recipeId",
                        "productRecipeInventory".name,
                      'inventory' as "type",
                      "parentId",
                        "productRecipeInventory"."unitCost",
                      "usages"::float
                    from "productRecipeInventory"
                  union all 
                  select * from "recipeItemCost"
              `,
        values: [optionId, branchId]
      }

      let recipe = await DB.excu.query(query.text, query.values);
      let recipeData: any[] = recipe.rows && recipe.rows.length > 0 ? recipe.rows : []
      return { recipe: recipeData }
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async getOptionRecipeItems(optionId: string, companyId: string) {
    try {


      const query = {
        text: `SELECT  
                  el->>'inventoryId'        AS "inventoryId",
                  el->>'recipeId'           AS "recipeId",
                  (el->>'usages')::float  AS "usages",
                  COALESCE(ri.name, p.name) AS "name", 
                  COALESCE(p."type", 'Recipe') AS "type",
                  COALESCE(ri."unitCost", p."unitCost") AS "unitCost"

              FROM "Options"
              CROSS JOIN jsonb_array_elements("recipe") el
              LEFT JOIN LATERAL (
                  SELECT
                      r.id,
                      r.name,
                      SUM((elm->>'usage')::float   * pr."unitCost") AS "unitCost"
                  FROM "Recipe" r
                  CROSS JOIN jsonb_array_elements(r.items) elm
                  JOIN "Products" pr ON pr.id = (elm->>'inventoryId')::uuid
                  WHERE r."companyId" = $2
                    AND r.id = (el->>'recipeId')::uuid
                  GROUP BY r.id, r.name
                  LIMIT 1
              ) ri ON (el->>'recipeId' is not null)

              LEFT JOIN "Products" p ON p.id = (el->>'inventoryId')::uuid

              WHERE "Options".id = $1 and "Options"."companyId" = $2
              `,
        values: [optionId,companyId]
      }

      let recipe = await DB.excu.query(query.text, query.values);
      let list: any[] = recipe.rows && recipe.rows.length > 0 ? recipe.rows : []

      return { recipe: list }
    } catch (error: any) {
      throw new Error(error)
    }
  }


  public static async getOption(company: Company, optionId: string, brandId: string) {
    try {


      const companyId = company.id;
      const query: { text: string, values: any } = {
        text: `SELECT "Options".*,
                       "Media"."url" "mediaUrl",
                       "Media"."id"  as "mediaId"
                FROM "Options" 
                Left JOIN "Media" on "Media".id = "Options"."mediaId"
                WHERE "Options"."companyId"=$1 AND "Options".id=$2`,
        values: [companyId, optionId],
      };
      const option = await DB.excu.query(query.text, query.values);
      if (option.rowCount == 0) {
        throw new ValidationException("Not Found");
      }
      const temp = new Option();
      temp.ParseJson(option.rows[0]);
      temp.recipe = (await this.getOptionRecipeItems(optionId, companyId)).recipe
      return new ResponseData(true, "", temp)
    } catch (error: any) {
    
      throw new Error(error)
    }
  }






  /**Used to set Ecommerce OPtion price */
  public static async getOptionPrice(client: PoolClient, optionId: string, optionGroupId: string | null) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT "Options" .price,
                     "Options" ."name",
                     "Options" ."translation" , 
                     "Options" ."weight" , 
                      "OptionGroups"."title" as "optionGroupName" ,
                      "OptionGroups"."translation" as "optionGroupTranslation"
        from "Options" 
        left join "OptionGroups"  on  "OptionGroups".id = $2::uuid
        where "Options" .id = $1`,
        values: [optionId, optionGroupId]
      }

      let option = await client.query(query.text, query.values);

      return option.rows[0]
    } catch (error: any) {
    

      throw new Error(error)
    }
  }

  public static async getOptionGroupInfo(client: PoolClient, optionGroupId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT "title","translation" from "optionGroupId" where id = $1`,
        values: [optionGroupId]
      }

      let optionGroup = await client.query(query.text, query.values);
      return optionGroup.rows[0]
    } catch (error: any) {
    

      throw new Error(error)
    }
  }

  //------------------------------------deleted
  public static async UpdateBranchOptionsAvailability(client: PoolClient, options: any, optionGroupId: string) {
    try {

      const query: { text: string, values: any } = {
        text: `UPDATE "OptionGroups" 
                set options = $1
                where id = $2 `,
        values: [JSON.stringify(options), optionGroupId]
      }
      const branchOptions = await client.query(query.text, query.values);
      return true
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async getOptionsBranchAvailability(client: PoolClient, company: Company, branchProdId: string) {
    try {

      // const branchId = data.branchId ? data.branchId :null;
      // const prodId = data.productId ? data.productId :null;

      const query: { text: string, values: any } = {
        text: `SELECT 
                      "optionGroup"->>'index' AS "groupIndex",
                      "OptionGroups".id AS "groupId",
                      "OptionGroups".title AS "groupName",
                      elem ->>'index' AS "optionIndex",
                      "Options".id AS "optionId",
                      COALESCE(NULLIF("Options"."displayName",''), "Options".name) AS "optionName", 
                      case when "branchId"::text = any( Array(select json_array_elements_text(elem->'excludedBranches'))) then false else true end as available,
                      case when "branchId"::text = any( Array(select json_array_elements_text(elem->'onlineExcludedBranches'))) then false else true end as "availableOnline"
                  FROM "BranchProducts" AS "branchProd"
                  INNER JOIN "Products" As prod ON  prod.id = "branchProd"."productId"
                  LEFT JOIN json_array_elements(prod."optionGroups") AS "optionGroup" ON TRUE
                  LEFT JOIN "OptionGroups" ON "OptionGroups".id = ("optionGroup"->>'optionGroupId')::uuid AND "branchProd"."companyId" = "OptionGroups"."companyId"
                  JOIN json_array_elements("OptionGroups"."options") AS elem ON TRUE
                  LEFT JOIN "Options" ON "Options".id = (elem->>'optionId')::uuid
                  where "branchProd"."companyId" = $1
                    AND "branchProd".id::text  = $2::text`,
        values: [company.id, branchProdId]
      }

      const options = await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", options.rows)

    } catch (error: any) {
    

      throw new Error(error)
    }
  }
  public static async setOptionsBranchAvailabilityTest(client: PoolClient, company: Company, data: any) {
    try {

      const optionGroupId = data.optionGroupId ? data.optionGroupId : null;
      const options2 = data.options
      const branchId = data.branchId ? data.branchId : null;
      const optionId = data.optionId ? data.optionId : null;
      const available = data.available ?? null;
      const availableOnline = data.availableOnline ?? null;


      if (!optionGroupId) { throw new ValidationException("optionGroupId IS Required") }
      if (!optionId) { throw new ValidationException("Option Id IS Required ") }
      if (!branchId) { throw new ValidationException("Branch Id IS Required") }
      if (available == null) { throw new ValidationException("Available Status IS Required ") }
      if (availableOnline == null) { throw new ValidationException("Available Online Status IS Required") }

      const query: { text: string, values: any } = {
        text: `select json_array_elements("OptionGroups"."options") as option
                 from "OptionGroups"
                  where "companyId" = $1 
                  AND "OptionGroups".id = $2
                  `,
        values: [company.id, optionGroupId]
      }
      let options = await client.query(query.text, query.values);




      if (options.rows && options.rows.length > 0) {
        let optionList = options.rows.map((e) => e.option);

        optionList.map((x) => {
          x.optionId == optionId ? (
            x.excludedBranches = x.excludedBranches ?? [],
            x.excludedBranches = available == true ? x.excludedBranches.filter((branch: any) => branch != branchId) :
              [...new Set([...x.excludedBranches, branchId])],

            x.onlineExcludedBranches = x.onlineExcludedBranches ?? [],
            x.onlineExcludedBranches = availableOnline == true ? x.onlineExcludedBranches.filter((branch: any) => branch != branchId) :
              [...new Set([...x.onlineExcludedBranches, branchId])]) : x
        }
        )
        await this.UpdateBranchOptionsAvailability(client, optionList, optionGroupId)
        return new ResponseData(true, "option Availability Has Been Updated Successfully", [])
      }
      return new ResponseData(false, "OptionGroups Doesn't Exist", [])

    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  //------------------------------------

  public static async getOptionIdByName(client: PoolClient, productName: string, companyId: string) {
    try {
      const query: { text: string, values: any } = {

        text: `SELECT id FROM "Options" where TRIM(LOWER(name)) = TRIM(LOWER($1)) and "companyId" = $2`,
        values: [productName, companyId]
      }

      let option = await client.query(query.text, query.values);

      return option.rows && option.rows.length > 0 ? option.rows[0].id : "";
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async saveImportOptions(client: PoolClient, data: any, company: Company) {

    try {

      // let validate = await OptionValidation.optionsValidation(data);
      // if (validate && !validate.valid) {
      //   return new ResponseData(false, "", { OptionName: data.name, error: validate.error })
      // }

      data.createdAt = new Date();
      data.updatedDate = new Date();
      // data.taxId = (await TaxesRepo.getDefaultTax(client,company.id)).data.id;

      let option: Option = data
      option.id = Helper.createGuid()
      const query: { text: string, values: any } = {
        text: ` INSERT INTO  "Options" (name,"displayName",translation, price,"isMultiple","isVisible","companyId","createdAt","updatedDate","kitchenName") 
                   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        values: [option.name, option.displayName, option.translation, option.price, option.isMultiple, option.isVisible, option.companyId, option.createdAt, option.updatedDate, option.kitchenName]
      };
      let inster = await client.query(query) // await client.query(query.text, query.values);

      // product.id = inster.rows[0].id;

      return new ResponseData(true, "", []);
    }
    catch (error: any) {
      console.log(error)
      return new ResponseData(false, error.message, [])
    }
  }

  public static async updateImportOptions(client: PoolClient, data: any, company: Company) {

    let validate = await OptionValidation.optionsValidation(data);
    if (validate && !validate.valid) {
      return new ResponseData(false, "", { OptionName: data.name, error: validate.error })
    }

    data.createdAt = new Date();
    data.updatedDate = new Date();

    let option = data;
    const query: { text: string, values: any } = {

      text: `UPDATE "Options" SET name= $1,"displayName"= $2,translation= $3, price= $4,"isMultiple"= $5,"isVisible"= $6, "updatedDate"= $7 ,"kitchenName"=$8
            WHERE id = $9   RETURNING id`,
      values: [option.name, option.displayName, option.translation, option.price, option.isMultiple, option.isVisible, option.updatedDate, option.kitchenName, option.id],

    };

    let inster = await client.query(query.text, query.values);

    return new ResponseData(true, "", []);
  }

  public static async importFromCVS(data: any, company: Company, employeeId: string, pageNumber: number, count: number) {
    const client = await DB.excu.client(500);

    let redisClient = RedisClient.getRedisClient();
    try {
      let errors: any[] = [];
      await client.query("BEGIN")


      const companyId = company.id;

      let limit: any = process.env.NUMBER_OF_IMPORT_RECOREDS ?? 2000;
      data = data.filter((f: any) => f.name)
      let names = data.map((f: any) => { return f.name })

      const query = {
        text: `SELECT id, name from "Options" where "companyId" =$1 
                                              and trim(lower(name))=any(  SELECT trim(lower(unnested_value))
                                                                             FROM unnest($2::text[]) AS unnested_value ) `,
        values: [companyId, names]
      }
      let temp = await client.query(query.text, query.values);
      if (temp && temp.rows && temp.rows.length > 0) {
        data = data.map(((f: any) => {
          let option = temp.rows.find((op: any) => op.name == f.name)
          if (option) {
            f.id = option.id
          } else {
            console.log(f)
            f.id = Helper.createGuid()
          }
          return f
        }))
      }

      data = data.map(((f: any) => {
        let option = new Option()
        option.ParseJson(f)
        if (option.id == null || option.id == "") {
          option.id = Helper.createGuid()
        }
        return option
      }))

      // let inserts = data.filter((f:any)=>f.id==null)
      // let updates = data.filter((f:any)=>f.id!= null)
      let resault: any;

      // console.log(inserts)
      // for (let index = 0; index < inserts.length; index++) {
      //   const element: Option = data[index];
      //   element.companyId = companyId;
      //   resault = await OptionRepo.saveImportOptions(client, element, company);
      //   if (!resault.success) {
      //     errors.push(resault.data)
      //   }
      // }

      console.log(data.filter((f: any) => f.id == null || f.id == ""))
      const transactionValues = data.map((update: any) => [update.id,
      update.name,
      update.displayName,
      update.translation,
      update.price,
      update.isMultiple,
      update.isVisible,
      new Date(),
      update.kitchenName,
        companyId,
      new Date()
      ]);

      const updateQuery = `
                          INSERT INTO "Options" 
                          ("id", "name", "displayName", "translation", "price", "isMultiple", "isVisible", "updatedDate", "kitchenName", "companyId","createdAt")
                          VALUES 
                          %L
                          ON CONFLICT ("id") 
                          DO UPDATE SET
                            "name" = EXCLUDED."name",
                            "displayName" = EXCLUDED."displayName",
                            "translation" = EXCLUDED."translation",
                            "price" = EXCLUDED."price"::real,
                            "isMultiple" = EXCLUDED."isMultiple"::boolean,
                            "isVisible" = EXCLUDED."isVisible"::boolean,
                            "updatedDate" = EXCLUDED."updatedDate"::timestamp,
                            "kitchenName" = EXCLUDED."kitchenName"
                            RETURNING id, name 
                        `;
      const formattedQuery = format(updateQuery, transactionValues);
      let options = await client.query(formattedQuery);
      console.log(options.rows)
      // for (let index = 0; index < data.length; index++) {

      //   let progress = Math.floor((((index + 1) + ((pageNumber - 1) * limit)) / count) * 100) + "%"
      //   await redisClient.set("OptionBulkImport" + company.id, JSON.stringify({ progress: progress }))

      //   const element: Option = data[index];

      //   element.companyId = companyId;
      //   // element.id = await this.getOptionIdByName(client, element.name, companyId)


      //   let resault: any;
      //   //TODO check if product Exists by Name or Barcode
      //   element.companyId = companyId
      //   if (element.id != "" && element.id != null) {
      //     // let error = isNameExist ? "Product Name Already Used" : "Product Barcode Already Used"
      //     // errors.push ({productName:element.name, error:error})
      //     // continue;

      //     errors.push({ productName: element.name, error: "Product Name Already Used" })
      //     resault = await OptionRepo.updateImportOptions(client, element, company);


      //   } else {

      //     resault = await OptionRepo.saveImportOptions(client, element, company);
      //     if (!resault.success) {
      //       errors.push(resault.data)
      //     }
      //   }

      // }


      await client.query("COMMIT")

      return new ResponseData(true, "", errors)
    } catch (error: any) {
      console.log(error)
      await client.query("ROLLBACK")

      return new ResponseData(false, error.message, [])

    } finally {

      client.release()



    }
  }

  public static async UpdateOptionsAvailability(client: PoolClient, options: any | null, onlineOptionList: any | null, branchProductId: string) {
    try {




      const query: { text: string, values: any } = {
        text: `with "updatedStatus" as (
                UPDATE "BranchProducts"
                    set "excludedOptions" = case when ($1::jsonb is not null) then $1 else "excludedOptions" end, 
                        "onlineExcludedOptions" = case when ($2::jsonb is not null) then  $2 else "onlineExcludedOptions" end
                      where id = $3 RETURNING id,"productId","excludedOptions",  "onlineExcludedOptions" ,"branchId"
                )
                UPDATE "Products" 
                      set  "updatedDate"= $4 from  (select "productId",id ,"excludedOptions",  "onlineExcludedOptions"  ,"branchId"  from "updatedStatus")t 
                      where  "Products".id =  t. "productId" RETURNING  t.id  ,t. "productId" ,t."excludedOptions", t."onlineExcludedOptions"  ,t ."branchId" `,
        values: [options ? JSON.stringify(options) : null, onlineOptionList ? JSON.stringify(onlineOptionList) : null, branchProductId, new Date()]
      }

      const branchOptions = await client.query(query.text, query.values);

      if (branchOptions.rows && branchOptions.rows.length > 0) {
        return new ResponseData(true, "option Availability Has Been Updated Successfully", branchOptions.rows)
      }
      else return new ResponseData(false, "", [])

    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async setOptionsProductAvailability(client: PoolClient, company: Company, data: any) {
    try {

      const branchProductId = data.branchProdId ? data.branchProdId : null;
      const options2 = data.options
      const branchId = data.branchId ? data.branchId : null;
      const optionId = data.optionId ? data.optionId : null;
      const available = data.available ?? null;
      const availableOnline = data.availableOnline ?? null;
      const pauseOnline = data.pauseOnline ?? null;
      const pause = data.pause ?? null;



      if (!optionId || optionId == undefined) { throw new ValidationException("Option Id IS Required ") }
      if (available == null) { throw new ValidationException("Available Status IS Required ") }
      if (availableOnline == null) { throw new ValidationException("Available Online Status IS Required") }

      const query: { text: string, values: any } = {
        text: `select "onlineExcludedOptions", "excludedOptions"
                  from "BranchProducts" 
                  where id = $1::uuid 
                  `,
        values: [branchProductId]
      }



      let options = await client.query(query.text, query.values);
      let optionList: any = []
      let onlineOptionList: any = []

      if (options.rows && options.rows.length > 0) {
        optionList = options.rows[0].excludedOptions ?? []
        onlineOptionList = options.rows[0].onlineExcludedOptions ?? []

      }


      let option: any = { optionId: optionId, pauseUntil: null }
      let onlineOption: any = { optionId: optionId, pauseUntil: null }

      //onlineOption 
      let OnlineOptionIndex = onlineOptionList.findIndex((elem: any) => elem.optionId === optionId)

      if (OnlineOptionIndex != -1) {
        let currentOnlineOption = onlineOptionList.splice(OnlineOptionIndex, 1)[0]
      }

      if (availableOnline == false) {
        onlineOptionList.push(onlineOption)

      } else if (availableOnline == true && pauseOnline == true) {
        onlineOption.pauseUntil = moment(new Date()).add(1, 'day');
        onlineOptionList.push(onlineOption)
      }

      //Option 

      let optionIndex = optionList.findIndex((elem: any) => elem.optionId === optionId)

      if (optionIndex != -1) {
        let currentOption = optionList.splice(optionIndex, 1)[0]
      }

      if (available == false) {
        optionList.push(option)

      } else if (available == true && pause == true) {
        option.pauseUntil = moment(new Date()).add(1, 'day');
        optionList.push(option)
      }


      let response = await this.UpdateOptionsAvailability(client, optionList, onlineOptionList, branchProductId)

      return response


    } catch (error: any) {
    
      throw new Error(error)
    }
  }

  public static async updateProductOptionsAvailability(client: PoolClient, company: Company, data: any) {
    try {

      const branchProductId = data.branchProdId ? data.branchProdId : null;
      const optionId = data.optionId ? data.optionId : null;
      const available = data.available ?? null;
      const pause = data.pause ?? null;

      if (!optionId || optionId == undefined) { throw new ValidationException("Option Id IS Required ") }
      if (available == null) { throw new ValidationException("Available Status IS Required ") }

      const query: { text: string, values: any } = {
        text: `select "excludedOptions"
                  from "BranchProducts" 
                  where id = $1::uuid 
                  `,
        values: [branchProductId]
      }

      let options = await client.query(query.text, query.values);
      let optionList: excludedOption[] = []


      if (options.rows && options.rows.length > 0) {
        optionList = options.rows[0].excludedOptions ?? []

      }


      let option: excludedOption = { optionId: optionId, pauseUntil: null }
      let onlineOption: excludedOption = { optionId: optionId, pauseUntil: null }

      //Option 

      let optionIndex = optionList.findIndex((elem: excludedOption) => elem.optionId === optionId)

      if (optionIndex != -1) {
        let currentOption = optionList.splice(optionIndex, 1)[0]
      }

      if (available == false) {
        optionList.push(option)

      } else if (available == true && pause == true) {
        option.pauseUntil = moment(new Date()).add(1, 'day');
        optionList.push(option)
      }


      let response = await this.UpdateOptionsAvailability(client, optionList, null, branchProductId)
      console.log(response)
      if (response && response.data && response.data.length > 0) {
        SocketOption.updateProductOptionAvailabilty(response.data[0], response.data[0].branchId)

      }
      return response


    } catch (error: any) {
    
      throw new Error(error)
    }
  }



  public static async updateOnlineProductOptionsAvailability(client: PoolClient, company: Company, data: any) {
    try {

      const branchProductId = data.branchProdId ? data.branchProdId : null;
      const optionId = data.optionId ? data.optionId : null;
      const available = data.available ?? null;
      const pause = data.pause ?? null;

      if (!optionId || optionId == undefined) { throw new ValidationException("Option Id IS Required ") }
      if (available == null) { throw new ValidationException("Available Status IS Required ") }

      const query: { text: string, values: any } = {
        text: `select "onlineExcludedOptions"
                  from "BranchProducts" 
                  where id = $1::uuid 
                  `,
        values: [branchProductId]
      }

      let options = await client.query(query.text, query.values);
      let optionList: excludedOption[] = []


      if (options.rows && options.rows.length > 0) {
        optionList = options.rows[0].onlineExcludedOptions ?? []

      }


      let option: excludedOption = { optionId: optionId, pauseUntil: null }
      let optionIndex = optionList.findIndex((elem: any) => elem.optionId === optionId)

      if (optionIndex != -1) {
        let currentOption = optionList.splice(optionIndex, 1)[0]
      }

      if (available == false) {
        optionList.push(option)

      } else if (available == true && pause == true) {
        option.pauseUntil = moment(new Date()).add(1, 'day');
        optionList.push(option)
      }


      let response = await this.UpdateOptionsAvailability(client, null, optionList, branchProductId)
      if (response && response.data && response.data.length > 0) {
        SocketOption.updateProductOptionAvailabilty(response.data[0], response.data[0].branchId)

      }

      return response


    } catch (error: any) {
    
      throw new Error(error)
    }
  }

  public static async getOptionsProductAvailability(company: Company, branchProdId: string) {
    try {

      // const branchId = data.branchId ? data.branchId :null;
      // const prodId = data.productId ? data.productId :null;

      const query: { text: string, values: any } = {
        text: `	SELECT 
                  "optionGroup"->>'index' AS "groupIndex",
                  "OptionGroups".id AS "groupId",
                  "OptionGroups".title AS "groupName",
                  elem ->>'index' AS "optionIndex",
                  "Options".id AS "optionId",
                  COALESCE(NULLIF("Options"."displayName",''), "Options".name) AS "optionName", 
                  "branchProd"."excludedOptions",
                  COALESCE(t2->>'optionId' is null or (t2->>'optionId' is not null and  t2->>'pauseUntil' is not null), true) as available,
                  COALESCE(t1->>'optionId' is null or (t1->>'optionId' is not null and  t1->>'pauseUntil' is not null), true) as "availableOnline",
                  CASE WHEN "excludedBranches" @> jsonb_build_array("branchProd"."branchId") THEN true ELSE false END AS "isDisabled",
                  t2->>'pauseUntil' as "pauseUntil",
                  t1->>'pauseUntil' as "OnlinePauseUntil"
                FROM "BranchProducts" AS "branchProd"
                INNER JOIN "Products" As prod ON  prod.id = "branchProd"."productId"
                inner JOIN json_array_elements(prod."optionGroups") AS "optionGroup" ON TRUE
                inner JOIN "OptionGroups" ON "OptionGroups".id = ("optionGroup"->>'optionGroupId')::uuid AND "branchProd"."companyId" = "OptionGroups"."companyId"
                JOIN json_array_elements("OptionGroups"."options") AS elem ON TRUE
                left join jsonb_array_elements("excludedOptions") as t2 on (t2->>'optionId')::uuid = (elem->>'optionId')::uuid and (t2->>'pauseUntil' is null or CURRENT_TIMESTAMP < (t2->>'pauseUntil')::TIMESTAMP)
                left join jsonb_array_elements("onlineExcludedOptions") as t1 on (t1->>'optionId')::uuid = (elem->>'optionId')::uuid and (t1->>'pauseUntil' is null or CURRENT_TIMESTAMP < (t1->>'pauseUntil')::TIMESTAMP)
                LEFT JOIN "Options" ON "Options".id = (elem->>'optionId')::uuid
                  where "branchProd"."companyId" = $1
                    AND "branchProd".id::text  = $2::text`,
        values: [company.id, branchProdId]
      }

      const options = await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", options.rows)

    } catch (error: any) {
    

      throw new Error(error)
    }
  }

  public static async exprotOptions(company: Company): Promise<ResponseData> {
    try {
      const companyId = company.id;
      const selectQuery = `select 
                            o.name as "optionName",
                            o."displayName" as "displayName",
                            o."translation"->'name' ->> 'en' AS "English Name",
                            o."translation"->'name' ->> 'ar' AS "Arabic Name",
                            o."translation"->'description' ->> 'en' AS "English Description",
                            o."translation"->'description' ->> 'ar' AS "Arabic Description",
                            o."kitchenName",
                            o."isMultiple",
                            o."isVisible",
                            o.price

                            from "Options" as o 
                            where o."companyId" = $1`;

      const selectList: any = await DB.excu.query(selectQuery, [companyId]);

      // Define the CSV writer
      const csvWriter = createObjectCsvWriter({
        path: companyId + 'options.csv',
        header: [
          { id: 'optionName', title: 'Option Name' },
          { id: 'displayName', title: 'Display Name' },
          { id: 'Description', title: 'Description' },
          { id: 'English Name', title: 'English Name' },
          { id: 'Arabic Name', title: 'Arabic Name' },
          { id: 'English Description', title: 'English Description' },
          { id: 'Arabic Description', title: 'Arabic Description' },
          { id: 'kitchenName', title: 'Kitchen Name' },
          { id: 'isMultiple', title: 'Is Multiple' },
          { id: 'isVisible', title: 'Is Visible' },
          { id: 'price', title: 'Price' },

        ],
      });

      // Write the data to the CSV file
      await csvWriter.writeRecords(selectList.rows).then(() => console.log('csv file written successfully'));

      return new ResponseData(true, "", "Options exported successfully.");
    } catch (error: any) {
    
      throw new Error("Error exporting options: " + error.message); // Include the actual error message
    }
  }
  public static async exportOptions(company: Company, type: string = 'XLSX'): Promise<ResponseData> {
    try {
      const companyId = company.id;
      const selectQuery = `select 
                            o.name as "optionName",
                            o."displayName" as "displayName",
                            o."kitchenName",
                            o."isMultiple",
                            o."isVisible",
                            o.price,
                            o."translation"->'name' ->> 'en' AS "English Name",
                            o."translation"->'name' ->> 'ar' AS "Arabic Name"
              

                            from "Options" as o 
                            where o."companyId" = $1
                            and o."isDeleted" = false 
                            `;

      const selectList: any = await DB.excu.query(selectQuery, [companyId]);


      if (type.toLowerCase() == 'csv') {
        console.log(">>>>>>>>>>csv")
        const csvWriter = createObjectCsvWriter({

          path: companyId + 'options.csv',
          header: [
            { id: 'optionName', title: 'Option Name' },
            { id: 'displayName', title: 'Display Name' },
            { id: 'kitchenName', title: 'Kitchen Name' },
            { id: 'isMultiple', title: 'Is Multiple' },
            { id: 'isVisible', title: 'Is Visible' },
            { id: 'price', title: 'Price' },
            { id: 'English Name', title: 'English Name' },
            { id: 'Arabic Name', title: 'Arabic Name' }

          ],
        });

        // Write the data to the CSV file
        await csvWriter.writeRecords(selectList.rows);


      } else {


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
        xlsx.writeFile(workbook, companyId + 'options.xlsx');


      }


      return new ResponseData(true, "", "Options exported successfully.");
    } catch (error: any) {
    
      throw new Error("Error exporting options: " + error.message); // Include the actual error message
    }
  }

  public static async setOptionAvailability(data: any, companyId: string) {
    try {
      console.log(data)
      if (data && data.length > 0) {
        const transactionValues = data.map((update: any) => [update.id, JSON.stringify(update.excludedBranches), companyId, new Date()]);
        if (transactionValues) {
          const updateQuery = `
          UPDATE "Options" 
          SET "excludedBranches" = data."excludedBranches"::JSONB,
              "updatedDate" = data."updatedDate"::timestamp
          FROM (VALUES %L) AS data("id","excludedBranches","companyId","updatedDate")
          WHERE "Options"."id"= data."id"::uuid 
          and "Options"."companyId" =    data."companyId"::uuid 
        `;
          const formattedQuery = format(updateQuery, transactionValues);
          let options = await DB.excu.query(formattedQuery);
          let ids = data.map((f: any) => { return f.id })
          if (ids && ids.length > 0) {
            let ids = data.map((f: any) => { return f.id })

            const query = {
              text: `SELECT 
                        "Branches".id as "branchId", 
                        JSON_AGG(JSON_BUILD_OBJECT('optionId',"Options".id,'isAvailable',   CASE WHEN "excludedBranches" @> jsonb_build_array(   "Branches".id ) THEN false  END )) "availability"
                      from "Options"
                inner join "Branches" on "Branches"."companyId" = "Options"."companyId"
                where "Options"."id" = any($1) 
                group by    "branchId"
`,
              values: [ids]
            }
            let optionData = await DB.excu.query(query.text, query.values);

            await SocketOption.updateOptionAvailabilty(optionData.rows)
          }
        }

      }


      return new ResponseData(true, "", [])
    } catch (error: any) {
      console.log(error)
      throw new Error(error)
    }
  }

  public static async deleteOptions(optionId: string, companyId: string) {
    try {
      const query = {
        text: `UPDATE "Options" SET "name"= "name" || ' [Deleted]',"isDeleted" = true, "updatedDate"= $1 where id = $2 and "companyId"=$3 returning(select JSON_AGG(id) AS ids from "Branches" where "companyId" =$3)`,
        values: [new Date(), optionId, companyId]
      }

      let deleted = await DB.excu.query(query.text, query.values);

      if (deleted && deleted.rows && deleted.rows.length > 0) {
        const ids = (<any>deleted.rows[0]).ids
        console.log(ids)
        if (ids && ids.length > 0) {
          await SocketOption.optionDeleteSync([optionId], ids)
        }

      }
      return new ResponseData(true, "", [])
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async deleteOptionGroupFroMenuItemProduct(client: PoolClient, optionGroupId: string, companyId: string) {
    try {
      const query = {
        text: `with "products" as (select "Products".id , "optionGroups" from "Products", json_array_elements("optionGroups") as el 
          where "optionGroups" is not null  and "optionGroups"::text <> '[]'
		      and "type" = 'menuItem'
		      and "companyId" = $1
          and (el->>'optionGroupId') !=''
          and (el->>'optionGroupId')::uuid = $2
					
          group by  "Products".id), 
          
          "updatedProducts" as (
          select  products.id , json_agg(el) filter (where (el ->> 'optionGroupId')::uuid <> $2 )as "tempGroups" 
              from products , json_array_elements("optionGroups") as el 
          
             group by id
          )

		  
		  
          update "Products" set "optionGroups" = t ."tempGroups"  , "updatedDate" = current_timestamp  from (select * from "updatedProducts") t 
          where "Products".id = t .id
		  
          `,
        values: [companyId, optionGroupId]

      }

      await client.query(query.text, query.values)
    } catch (error: any) {
      throw new Error(error)
    }
  }
  public static async deleteOptionGroup(optionGroupId: string, company: Company) {
    const client = await DB.excu.client()
    try {
      await client.query("BEGIN")
      console.log(optionGroupId)
      await this.deleteOptionGroupFroMenuItemProduct(client, optionGroupId, company.id)
      await client.query(`DELETE FROM "OptionGroups" where id =$1 and "companyId"=$2`, [optionGroupId, company.id])
      await client.query("COMMIT")
      return new ResponseData(true, "", [])
    } catch (error: any) {
      console.log(error)
      await client.query("ROLLBACK")

      throw new Error(error)
    } finally {
      client.release()
    }
  }

  public static async getMinSelectionCount(client: PoolClient, groupIds: any[]) {
    try {
      const query = {
        text: `select sum("minSelectable")::float as "min" from "OptionGroups" where id = any($1)`,
        values: [groupIds]
      }

      const selection = await client.query(query.text, query.values);

      return selection && selection.rows && selection.rows.length > 0 ? selection.rows[0].min : 0
    } catch (error: any) {
      throw new Error(error)
    }
  }
}