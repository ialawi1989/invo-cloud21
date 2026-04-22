import { Product } from "@src/models/product/Product";
import { ResponseData } from "@src/models/ResponseData";
import { ProductValidation } from "@src/validationSchema/product/product.Schema";
import { BranchProductsRepo } from "../branchProduct.repo";
import { OptionRepo } from "../option.repo";
import { ProductRepo } from "../product.repo";
import { RecipeRepo } from "../recipe.repo";

import { PoolClient } from "pg";
import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { Helper } from "@src/utilts/helper";
import { createObjectCsvWriter } from "csv-writer";
import { DB } from "@src/dbconnection/dbconnection";
import { exportHelper } from "@src/utilts/ExportHelper";
import { RedisClient } from "@src/redisClient";
import { values } from "lodash";
import { QuickRecipeManagment } from "../quickRecipeManagment.repo";
import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { Log } from "@src/models/log";
import { LogsManagmentRepo } from "../../settings/LogSetting.repo";
export class MenuItemProductRepo {


  public static async getRecipeTotalUnitCost(client: PoolClient, inventoryIds: any[], recipeIds: any[]) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT  "Recipe".id, sum("Products"."unitCost" *(arr.items->>'usage')::numeric) as "usage"
        FROM "Recipe", jsonb_array_elements("Recipe".items) with ordinality arr(items, position) 
        INNER JOIN "Products"
        ON "Products".id = (arr.items->>'inventoryId')::uuid
        where "Recipe".id = any($1)
	          	group by "Recipe".id
            union all 
            select 
            "Products".id, "Products"."unitCost" as "usage"
                    FROM "Products"
                    where "Products".id = any($2)`,
        values: [recipeIds, inventoryIds]
      }

      const unitCost = await client.query(query.text, query.values)

      return unitCost.rows
    } catch (error: any) {
      throw new Error(error.message)
    }
  }
  public static async addMenuItem(client: PoolClient, data: any, company: Company, employeeId: string) {

    try {
      const companyId = company.id;

      const validate = await ProductValidation.MenuItemValidation(data);
      if (!validate.valid) {

        throw new ValidationException(validate.error)
      }

      const afterDecimal = company.afterDecimal
      const product: Product = new Product();
      product.ParseJson(data);
      product.companyId = companyId;
      const totalUnitCost = 0;



      product.defaultPrice = +(product.defaultPrice).toFixed(afterDecimal);
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




      const recipeIds: any[string] = [];
      const inventoryIds: any[string] = [];
      if (product.recipes.length > 0) {
        product.recipes.forEach((element: any) => {
          if (element.recipeId) {
            recipeIds.push(element.recipeId);

          } else {
            inventoryIds.push(element.inventoryId);
          }

        });

        // let recipe = await this.getRecipeTotalUnitCost(client, inventoryIds, recipeIds)


        // let unitCost = 0;
        //  for (let index = 0; index < product.recipes.length; index++) {
        //   const element = product.recipes[index];
        //   const proId = element.recipeId ?? element.inventoryId 
        //   const pro = recipe.find((f:any) =>f.id == proId);
        //   unitCost += Helper.multiply( element.usages , pro.unitCost,afterDecimal)
        //  }

        //  product.unitCost = unitCost

        const isRecipeIdExist = await RecipeRepo.checkIfRecipeIdExist(client, recipeIds, product.companyId);
        if (!isRecipeIdExist) {
          throw new ValidationException("Recipe Id dosnt Exist")
        }
        let inventoryTypes: any = ['inventory', 'kit'];
        const isInventory = await ProductRepo.checkIfProductsTypeValid(client, inventoryIds, inventoryTypes, companyId);
        if (!isInventory) {
          throw new ValidationException("Error In Recipe Inventroy Id")
        }
      }
      const optionGroupsIds: any[string] = [];

      if (product.optionGroups.length > 0) {
        product.optionGroups.forEach((element: any) => {
          optionGroupsIds.push(element.optionGroupId);
        });

        const isOptionGroupIdExist = await OptionRepo.checkIfOptionGroupsExist(client, optionGroupsIds, companyId);
        if (!isOptionGroupIdExist) {
          throw new ValidationException("Option Group not Exist")
        }
      }
      const optionIds: any[string] = [];
      if (product.quickOptions.length > 0) {

        product.quickOptions.forEach((element: any) => {
          optionIds.push(element.id);
        });

        product.defaultOptions.forEach((element) => {
          if (element.optionId)
            optionIds.push(element.optionId);
        })
        if (product.defaultOptions) {
          product.defaultOptions = product.defaultOptions.map(f => {
            return {
              "optionId": f.optionId,
              index: f.index,
              qty: f.qty
            }
          })
        }
        const isOptionIdExist = await OptionRepo.checkIfOptioIdExist(client, optionIds, companyId);
        if (!isOptionIdExist) {
          throw new ValidationException("Option not Exist")
        }
      }

      product.updatedDate = new Date();

      if (product.categoryId) {
        product.categoryIndex = await ProductRepo.getProductCategoryMaxIndex(client, companyId, product.categoryId)
      }

      const query: { text: string, values: any } = {
        text: `INSERT INTO "Products"
                   (name, "barcode", "defaultPrice", description,
                   translation, "categoryId", tags, type, warning, "serviceTime","optionGroups","quickOptions",recipes,
                   "companyId","productMedia","commissionPercentage","commissionAmount",color,"taxId","preparationTime","isDiscountable",  nutrition,"mediaId","productAttributes","updatedDate","sku","alternativeProducts","maxItemPerTicket","kitchenName","reorderPoint","reorderLevel","productDeduction","logs","brandid","comparePriceAt","customFields","isSaleItem","isPurchaseItem","threeDModelId","weight","weightuom","defaultOptions","categoryIndex","tabBuilder")
                   VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44) RETURNING id`,
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
          JSON.stringify(product.optionGroups),
          JSON.stringify(optionIds),
          JSON.stringify(product.recipes),
          product.companyId,
          JSON.stringify(product.productMedia),
          product.commissionPercentage,
          product.commissionAmount,
          product.color,
          product.taxId,
          product.preparationTime,
          product.isDiscountable,
          product.nutrition,
          product.mediaId,
          JSON.stringify(product.productAttributes),
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
          product.weight,
          product.weightUOM,
          JSON.stringify(product.defaultOptions),
          product.categoryIndex,
          JSON.stringify(product.tabBuilder)
        ],
      };
      const insert = await client.query(query.text, query.values);

      //assign Option Group

      const resdata = {
        id: (<any>insert.rows[0]).id
      }
      // if (product.base64Image != "") {
      //   const storage = new FileStorage();
      //   const imagePath = await storage.saveItemImage(product.base64Image, companyId, product.id);
      //   await ProductRepo.updateProductSDeafultImage(product.id, imagePath, client)
      // }
      for (let index = 0; index < product.branchProduct.length; index++) {
        const element = product.branchProduct[index];
        element.productId = resdata.id;
        let tempPrice = element.price == null ? product.defaultPrice : element.price

        const insertToBranch = await BranchProductsRepo.addProductToBranch(client, element, product.type, product.companyId, afterDecimal, tempPrice, employeeId)
      }


      return new ResponseData(true, "", resdata)

    } catch (error: any) {

      console.log(error)

      throw new Error(error.message)
    }

  }
  public static async editMenuItem(client: PoolClient, data: any, company: Company, employeeId: string, employeeName: string) {

    try {
      const companyId = company.id;

      const validate = await ProductValidation.MenuItemValidation(data);
      if (!validate.valid) {

        throw new ValidationException(validate.error)
      }

      const afterDecimal = company.afterDecimal
      const currencySymbol = company.currencySymbol

      const product = new Product();
      product.ParseJson(data)
      product.companyId = companyId
      let productUnitCost: any = product.unitCost;
      product.unitCost = Helper.roundNum(Number(parseFloat(productUnitCost)), afterDecimal);
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



      const recipeIds: any[string] = [];
      const inventoryIds: any[string] = [];
      if (product.recipes.length > 0) {
        product.recipes.forEach((element: any) => {
          if (element.recipeId) {
            recipeIds.push(element.recipeId);

          } else {
            inventoryIds.push(element.inventoryId);
          }

        });

        // let recipe = await this.getRecipeTotalUnitCost(client, inventoryIds, recipeIds)


        // let unitCost = 0;
        //  for (let index = 0; index < product.recipes.length; index++) {
        //   const element = product.recipes[index];
        //   const proId = element.recipeId ?? element.inventoryId 

        //   const pro = recipe.find((f:any) =>f.id == proId);
        //   unitCost += Helper.multiply( element.usages , pro.unitCost,afterDecimal)
        //  }

        //  product.unitCost = unitCost
        const isRecipeIdExist = await RecipeRepo.checkIfRecipeIdExist(client, recipeIds, product.companyId);
        if (!isRecipeIdExist) {
          throw new ValidationException("Recipe Id dosnt Exist")
        }
        let inventoryTypes: any = ['inventory', 'kit'];
        const isInventory = await ProductRepo.checkIfProductsTypeValid(client, inventoryIds, inventoryTypes, companyId);
        if (!isInventory) {
          throw new ValidationException("Error In Recipe Inventroy Id")
        }

        const logs: Log[] = [];
        const oldRecipe = await this.getOld(data.id, company.id)

        for (const r of product.recipes) {

          let findResult = oldRecipe.find(old => (old.inventoryId && old.inventoryId === r.inventoryId) ||
            (old.recipeId && old.recipeId === r.recipeId))
          const usageChanged = findResult && findResult.usages != r.usages

          if (usageChanged && findResult) {
            let log = new Log();
            log.employeeId = employeeId
            log.action = "Menu Recipe Modified"
            log.comment = `${employeeName} has modified the menu Recipe of the item (${r.name})`
            log.metaData = {
              "recipeItemName": r.name,
              "productName": data.name,
              "recipeType": "menu"
            }
            logs.push(log)
          } else if (!findResult) {
            let log = new Log();
            log.employeeId = employeeId
            log.action = "Menu Recipe Modified"
            log.comment = `${employeeName} has add item (${r.name}) to Menu Item Recipe `
            log.metaData = {
              "recipeItemName": r.name,
              "productName": data.name,
              "recipeType": "menu"
            }
            logs.push(log)
          }

        }

        if (oldRecipe && oldRecipe.length > 0) {
          oldRecipe.forEach(element => {

            let findResult = product.recipes.find((old: any) => (old.inventoryId && old.inventoryId === element.inventoryId) ||
              (old.recipeId && old.recipeId === element.recipeId))


            if (!findResult) {
              let log = new Log();
              log.employeeId = employeeId
              log.action = "Menu Recipe Modified"
              log.comment = `${employeeName} has deleted item (${element.name}) from Menu Item Recipe `
              log.metaData = {
                "recipeItemName": element.name,
                "productName": data.name,
                "recipeType": "menu"
              }
              logs.push(log)
            }
          })
        }
        if (logs && logs.length > 0) {
          await LogsManagmentRepo.manageLogs(null, 'MenuRecipe', product.id, logs, null, companyId, employeeId, "", "Cloud")

        }

        // if (isRecipeIdExist || isInventory)
        //   for (let r of product.recipes) {

        //     if (r.usages != ) {
        //       let log = new Log();
        //       log.employeeId = employeeId
        //       log.action = "Menu Recipe Modified"
        //       log.comment = `${employeeName} has modified the menu Recipe of the item (${r.name})`
        //       log.metaData = {
        //         "recipeName": data.name,
        //         "itemName": r.name,
        //         "recipeType": "menu"
        //       }

        //       await LogsManagmentRepo.manageLogs(null, 'MenuRecipe', data.id, [log], null, companyId, employeeId, "", "Cloud")


        //     }

        //   }





      }

      const optionGroupsIds: any[string] = [];

      if (product.optionGroups.length > 0) {
        product.optionGroups.forEach((element: any) => {
          optionGroupsIds.push(element.optionGroupId);
        });

        const isOptionGroupIdExist = await OptionRepo.checkIfOptionGroupsExist(client, optionGroupsIds, companyId);
        if (!isOptionGroupIdExist) {
          throw new ValidationException("Option Group not Exist")
        }
      }


      const optionIds: any[string] = [];
      if (product.quickOptions.length > 0) {
        product.quickOptions.forEach((element: any) => {
          optionIds.push(element.id);
        });

        product.defaultOptions.forEach((element) => {
          if (element.optionId)
            optionIds.push(element.optionId);
        })

        const isOptionIdExist = await OptionRepo.checkIfOptioIdExist(client, optionIds, companyId,);
        if (!isOptionIdExist) {
          throw new ValidationException("Option not Exist")
        }
      }

      product.updatedDate = new Date();
      if (product.defaultOptions) {
        product.defaultOptions = product.defaultOptions.map(f => {
          return {
            "optionId": f.optionId,
            index: f.index,
            qty: f.qty
          }
        })
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
                                              "optionGroups" = ($9),
                                              "quickOptions" = ($10),
                                              recipes = ($11) ,
                                              "productMedia"=($12), 
                                              "updatedDate"=$13, 
                                              "commissionPercentage" = $14,
                                              "commissionAmount"=$15,
                                              color =$16,
                                              "taxId"=$17,
                                              "preparationTime"=$18,
                                              "isDiscountable"=$19,
                                              nutrition=$20,
                                              "mediaId"=$21,
                                              "productAttributes"=$22,
                                              translation=$23,
                                              "sku"=$24,
                                              "alternativeProducts"=$25,
                                              "maxItemPerTicket"=$26,
                                              "kitchenName"= $27,
                                              "reorderPoint" = $28,
                                              "reorderLevel" = $29,
                                              "productDeduction"=$30,
                                              "logs"=$31,
                                              "brandid"=$32,
                                              "comparePriceAt"=$33,
                                              "customFields"=$34,
                                              "isSaleItem"=$35,
                                              "isPurchaseItem"=$36,
                                              "threeDModelId" = $37,
                                              "weight" = $38,
                                              "weightuom" = $39,
                                              "defaultOptions"=$40,
                                              "categoryIndex"=$41,
                                              "tabBuilder"=$42
                                              WHERE id = $43 AND "companyId"=$44 RETURNING id`,
        values: [
          product.name,
          product.barcode,
          product.defaultPrice,
          product.description,
          product.tags,
          product.warning,
          product.serviceTime,
          product.categoryId,
          JSON.stringify(product.optionGroups),
          JSON.stringify(optionIds),
          JSON.stringify(product.recipes),
          JSON.stringify(product.productMedia),
          product.updatedDate,
          product.commissionPercentage,
          product.commissionAmount,
          product.color,
          product.taxId,
          product.preparationTime,
          product.isDiscountable,
          product.nutrition,
          product.mediaId,
          JSON.stringify(product.productAttributes),
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
          product.weight,
          product.weightUOM,
          JSON.stringify(product.defaultOptions),
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

        if (branchProduct.id == null || branchProduct.id == "") {
          const insertToBranch = await BranchProductsRepo.addProductToBranch(client, branchProduct, product.type, product.companyId, afterDecimal, tempPrice, employeeId)
        } else {
          const editToBranch = await BranchProductsRepo.editBranchProduct(client, branchProduct, product.companyId, afterDecimal, tempPrice, employeeId, currencySymbol)
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



  public static async getMenuItemList(company: Company, data: any) {
    try {

      //############## filter ##############
      const companyId = company.id;
      let filterQuery = ` where "Products"."companyId" = $1 and "Products"."type"= 'menuItem'
                                  and  ($2::uuid is null or "Products"."categoryId" = $2::uuid)`

      let searchValue = data.searchTerm ? `'%` + Helper.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `%'` : null;
      if (searchValue) {
        filterQuery += `and (LOWER("Products".name) ilike ${searchValue}
                                      OR  exists(select 1 from json_array_elements("recipes") elem where elem->>'name' ilike ${searchValue} )    
                                )`
      }

      //############## Sort ##############
      let sort = data.sortBy;
      let sortValue = !sort ? ' "Products"."createdAt"' : '"' + sort.sortValue + '"';
      let sortDirection = !sort ? "DESC" : sort.sortDirection;
      let sortTerm = sortValue + " " + sortDirection
      let orderByQuery = ` Order by` + sortTerm

      //############## Counter ##############
      const counterQuery: { text: string, values: any } = {
        text: `select count(*)
                         from "Products"  
                         left join "Categories" on "Categories"."companyId" = $1 and "Categories".id = "Products"."categoryId"
                        ${filterQuery}
                        `,
        values: [companyId, data.categoryId ?? null]
      }
      const counter = await DB.excu.query(counterQuery.text, counterQuery.values)

      //############## limit ##############
      let offset = 0;
      const limit = data.limit ?? 15;
      let page = data.page ?? 1
      if (page != 1) {
        offset = (limit * (page - 1))
      }

      //############## Select ##############
      const selectQuery: { text: string, values: any } = {
        text: `SELECT 	"Products".id,
                        "Products".name,
                        "Products"."barcode",
                        "Products".sku, 
                        "Categories".name as "categoryName",
                        "serviceTime",
                        "recipes"
                        from "Products"  
                    left join "Categories" on "Categories"."companyId" = $1 and "Categories".id = "Products"."categoryId"
                    ${filterQuery}
                    ${orderByQuery}
                    limit $3 offset $4`,
        values: [companyId, data.categoryId ?? null, limit, offset]
      }
      const selectList: any = await DB.excu.query(selectQuery.text, selectQuery.values);
      let list: any[] = []

      let branchData = await BranchesRepo.getMainBranch(null, companyId)
      let branchId = branchData.branch.id
      if (selectList.rows && selectList.rows.length > 0) {

        for (let index = 0; index < selectList.rows.length; index++) {
          let product = { ...selectList.rows[index] }

          if (product.recipes && product.recipes.length > 0) {
            let recipe = await ProductRepo.getProductRecipe2(product.id, branchId);
            product.recipes = recipe
            let unitCost = recipe.reduce((sum: number, item: any) => sum + ((item.usages || 0) * (item.unitCost || 0)), 0)
            product.unitCost = unitCost
          }
          list.push(product)

        }
      }

      //############## pagination ##############
      let count = counter.rows && counter.rows.length > 0 ? Number((<any>counter.rows[0]).count) : 0
      let pageCount = Math.ceil(count / data.limit)
      offset += 1;
      let lastIndex = ((page) * limit)
      if (selectList.rows.length < limit || page == pageCount) {
        lastIndex = count
      }

      //############## response ##############

      const resData = {
        list: list,
        count: count,
        pageCount: pageCount,
        startIndex: offset,
        lastIndex: lastIndex
      }

      return new ResponseData(true, "", resData)


    } catch (error: any) {

      throw new Error(error.message); // Include the actual error message
    }
  }


  public static async getOld(productId: string, compnayId: string) {
    let oldreceipe = await this.getProductRecipeItems(productId, compnayId);

    return oldreceipe
  }



  public static async getProductRecipeItems(optionId: string, companyId: string) {
    try {

      const mainBranch = await BranchesRepo.getMainBranch(null, companyId)
      const branchId = mainBranch && mainBranch.branch ? mainBranch.branch.id : null;

      const query = {
        text: `WITH "productRecipeBreak" AS (
                SELECT  
                  el->>'inventoryId' AS "inventoryId",
                  el->>'recipeId' AS "recipeId",
                  (el->>'usages')::float AS "usages",
                  ri.name AS "recipeName",
                  COALESCE(ri."inventoryId", el->>'inventoryId') AS "productId",
                  COALESCE(ri."usages", 1) AS "totalUsages"
                FROM "Products"
                CROSS JOIN jsonb_array_elements("recipes"::jsonb) el
                LEFT JOIN LATERAL (
                  SELECT 
                    r.id, 
                    r.name,
                    elm->>'inventoryId' AS "inventoryId",
                    (elm->>'usages')::float AS "usages"
                  FROM "Recipe" r,
                      jsonb_array_elements(r.items) elm
                  WHERE r.id = (el->>'recipeId')::uuid
                ) ri ON TRUE
                WHERE "Products".id = $1 and "Products"."companyId" = $2
              ),
              "requiredQty" AS (
                SELECT 
                  prb.*,
                  (prb.usages * prb."totalUsages") AS "requiredQty"
                FROM "productRecipeBreak" prb
              )
  
              select rq.*, 
              case when "inventoryId" is not null then p.name end as "productName",
              p."parentId",
              p."childQty", 
              p."UOM",
              p.type,
              bp."onHand"
              FROM "requiredQty" rq
              JOIN "Products" p ON p.id = rq."productId"::uuid
              JOIN "BranchProducts" bp ON bp."productId" = rq."productId"::uuid and "branchId" =$3
                `,
        values: [optionId, companyId, branchId]
      }

      let recipe = await DB.excu.query(query.text, query.values);
      let recipeData: any[] = recipe.rows && recipe.rows.length > 0 ? recipe.rows : []
      let list: any[] = []
      for (let i = 0; i < recipeData.length; i++) {
        let prod = recipeData[i]
        prod.unitCost = await QuickRecipeManagment.calculateUnitCost(prod, branchId, 0);

        if (prod.recipeId) {


          // Check if recipe already exists in list
          const existing = list.find(item => item.recipeId === prod.recipeId);
          if (existing) {
            // Update unitCost
            existing.unitCost += prod.unitCost;
            continue; // skip pushing new entry
          }
        }

        list.push({
          name: prod.recipeName ?? prod.productName,
          ...(prod.usages && { usages: prod.usages }),
          ...(prod.usage && { usage: prod.usage }),
          ...(prod.inventoryId && { inventoryId: prod.inventoryId }),
          ...(prod.recipeId && { recipeId: prod.recipeId }),
          unitCost: prod.unitCost,
          type: prod.recipeId ? 'recipe' : prod.type,
          UOM: prod.recipeId ? null : prod.UOM
        })

      }



      return list
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async importFromCVS(data: any, mode: string, company: Company, pageNumber: number, count: number) {

    let redisClient = RedisClient.getRedisClient();
    try {
      let errors = [];

      const companyId = company.id;

      let limit: any = process.env.NUMBER_OF_IMPORT_RECOREDS ?? 2000;
      const products: any[] = []

      for (let index = 0; index < data.length; index++) {

        let progress = Math.floor((((index + 1) + ((pageNumber - 1) * limit)) / count) * 100) + "%"
        await redisClient.set("BulkImport" + company.id, JSON.stringify({ progress: progress }))

        const item = { ...data[index] }

        let menuItem

        let query: { text: string, values: any } = {
          text: `select id, barcode, type, recipes from "Products" where "companyId" = $1 and barcode ilike $2  `,
          values: [companyId, item.barcode]
        }
        let records = await DB.excu.query(query.text, query.values);
        if (records.rows && records.rows.length > 0) {
          menuItem = records.rows[0]
          if (menuItem.type != 'menuItem') {
            errors.push({ productbarcode: item.barcode, error: "invalid Type" })
            continue;
          }

        }

        if (!menuItem) {
          errors.push({ productbarcode: item.barcode, error: "Menu item not found" });
          continue;
        }

        let validIngredients: {
          "usages": number,
          "inventoryId": string,
          "name": string,
          "UOM": string,
          "unitCost": number
        }[] = [];

        menuItem.recipe = menuItem.recipe ?? []

        if (mode != 'override') {
          validIngredients = { ...menuItem.recipe }
        }

        for (const ingredient of item.recipe) {
          let recipeProduct: { id: string, name: string, type: string, unitCost: number, UOM: string } | null = null
          query = {
            text: `SELECT id,name,type,"unitCost", "UOM"  from "Products" 
              where "companyId" = $1 and  barcode ilike $2::text and( $3::text is null  or $3::text ilike sku)  `,
            values: [companyId, ingredient.barcode, ingredient.sku]
          }
          let records = await DB.excu.query(query.text, query.values);

          if (records.rows && records.rows.length > 0) {
            recipeProduct = records.rows[0]
          }

          if (!recipeProduct) {
            errors.push({ productbarcode: item.barcode, error: `Recipe item not found: ${ingredient} ` });
            continue;
          }

          if (recipeProduct && mode != 'override') {
            const index = validIngredients.findIndex((obj: any) => obj.inventoryId === recipeProduct?.id)
            if (index != -1) {
              if (mode == 'add only') continue;
              else { validIngredients.splice(index, 1) }
            }

          }

          if (!['inventory', 'kit'].includes(recipeProduct.type)) {
            errors.push({ productbarcode: item.barcode, error: `Invalid type for recipe item ${ingredient.barcode} (must be 'inventory' or 'kit' )` });
            continue;
          }

          if (!(ingredient.usages > 0)) {
            errors.push({ productbarcode: item.barcode, error: `usages for recipe item ${ingredient.barcode} must be grater than zero` })
          }

          validIngredients.push({
            usages: ingredient.usages,
            inventoryId: recipeProduct.id,
            name: recipeProduct.name,
            UOM: recipeProduct.UOM,
            unitCost: recipeProduct.unitCost
          });
        }



        // Only update if all ingredients are valid
        if (validIngredients.length === item.recipe.length) {
          query = {
            text: `
        UPDATE "Products"
        SET recipes = $1
        WHERE id = $2 AND "companyId" = $3
      `, values: [JSON.stringify(validIngredients), menuItem.id, companyId]
          }

          const result = await DB.excu.query(query.text, query.values);

          if (result.rowCount === 0) {
            errors.push({ productbarcode: item.barcode, error: `recipe not updated due to validation errors ` });
          }
        } else {
          errors.push({ productbarcode: item.barcode, error: `recipe not updated due to validation errors ` });
        }
      }

      const isSuccess = errors.length === 0;
      return new ResponseData(isSuccess, isSuccess ? 'Imported successfully' : 'Imported with errors', {
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error: any) {
      console.log(error)
      return new ResponseData(false, error.message, [])

    }

  }


  public static async exportProductsRecipe(company: Company, type: string = 'XLSX'): Promise<string> {
    try {
      const companyId = company.id;
      const selectQuery = `SELECT p.name as "productName" ,
                                    p."barcode" as "prodcutBarcode",
                                    recipeProd."name" as "recipeItemName",
                                    recipeProd."barcode" as "recipeItemBarcode",
                                    recipeProd."sku" as "recipeItemSKU",
                                    recipeProd."UOM" as "UOM",
                                    (elem->>'usages') as usages

                                  from "Products"  p,  jsonb_array_elements("recipes"::jsonb) elem
                                  join "Products" recipeProd on recipeProd.id = ((elem->>'inventoryId')::uuid)
                                  where p."companyId" = $1 and p."type"= 'menuItem' and p."isDeleted" = false`;

      const selectList: any = await DB.excu.query(selectQuery, [companyId]);

      let header = [

        { id: 'productName', title: 'product Name' },
        { id: 'prodcutBarcode', title: 'Product Barcode' },
        { id: 'recipeItemName', title: 'recipe Item Name' },
        { id: 'recipeItemBarcode', title: 'recipe Item Barcode' },
        { id: 'recipeItemSKU', title: 'recipe Item SKU' },
        { id: 'UOM', title: 'UOM' },
        { id: 'usages', title: 'usages' }

      ]

      let fileName = await exportHelper.exportCsvAndXlsx(company, type, 'ProductsRecipe', selectList.rows, header)
      return fileName;



    } catch (error: any) {

      throw new Error("Error exporting Suppliers: " + error.message); // Include the actual error message
    }
  }

  // public static async validateProductRecipeItem( data: any, company: Company) {

  //   try {
  //     const companyId = company.id;

  //     let item = {...data.item}
  //     let query: { text: string, values: any } = {text:'', values:[]}

  //     if (!(item.usages > 0)) {
  //           throw new ValidationException( `usages for recipe item ${item.name} must be grater than zero` )
  //     }

  //     if (item.inventoryId){
  //       query = {text : `SELECT id,name,type,"unitCost", "UOM"  from "Products" 
  //             where "companyId" = $1 and id= $2 `,
  //            values: [companyId, item.inventoryId]}

  //     }else if (item.recipeId){
  //       query = {text : `SELECT 
  //                         r.id,
  //                         r.name,
  //                         'Recipe' AS type,
  //                         '' AS "UOM",
  //                         SUM(latest."cost" * items."usage") AS "unitCost"
  //                     FROM "Recipe" r
  //                     JOIN LATERAL jsonb_to_recordset(r.items) AS items("usage" float4, "inventoryId" uuid) ON TRUE
  //                     JOIN "Products" p ON p.id = items."inventoryId"
  //                     LEFT JOIN LATERAL (
  //                         SELECT imr."cost"
  //                         FROM "InventoryMovmentRecords" imr
  //                         WHERE imr."companyId" = p."companyId"
  //                           AND imr."productId" = p.id
  //                           AND imr."qty" >= 0
  //                         ORDER BY imr."createdAt" DESC
  //                         LIMIT 1
  //                     ) latest ON TRUE
  //                     WHERE r.id = $2 and r."companyId" =$1
  //                     GROUP BY r.id, r.name `,
  //            values: [companyId, item.recipeId]}

  //     }else{ throw new ValidationException('item inventoryId or recipeId is required')}


  //     let records = await DB.excu.query(query.text, query.values);


  //         let recipeProduct :{id:string, name:string,type:string,unitCost:number, UOM:string }| null = null
  //         if (records.rows && records.rows.length > 0) {
  //           recipeProduct = records.rows[0]
  //         }


  //       if (!recipeProduct) {
  //           throw new ValidationException("item not found");
  //         }

  //           if (!['inventory', 'kit', 'menuItem', 'Recipe'].includes(recipeProduct.type)) {
  //           throw new ValidationException(`Invalid type for recipe item "${recipeProduct.name}"  must be 'inventory' or 'kit' or 'menItem' or 'recipe'` );

  //           }



  //         return(item.recipeId)?{
  //           usages: item.usages,
  //           recipeId: recipeProduct.id,
  //           name: recipeProduct.name,
  //           unitCost: recipeProduct.unitCost * item.usages
  //         }: {
  //           usages: item.usages,
  //           inventoryId: recipeProduct.id,
  //           name: recipeProduct.name,
  //           unitCost: recipeProduct.unitCost * item.usages
  //         };


  //   } catch (error: any) {
  //   


  //     throw new Error(error.message)
  //   }
  // }

  //  public static async saveProductRecipeItem( data: any, company: Company) {

  //   try {
  //     const companyId = company.id;
  //      let menuItem

  //      if(!data.productId){
  //       throw new ValidationException('productId is required')
  //      }

  //       let query: { text: string, values: any } = {
  //         text: `select id, recipes from "Products" where "companyId" = $1 and id = $2 amd tpe = 'menuItem'  `,
  //         values: [companyId, data.productId]
  //       }
  //       let records = await DB.excu.query(query.text, query.values);
  //       if (records.rows && records.rows.length > 0) {
  //         menuItem = records.rows[0]


  //       }

  //       if (!menuItem) {
  //        throw new ValidationException( "Menu item not found" );
  //       }


  //     let item = {...data.item}
  //     let menuItemRecipe = menuItem.recipe||[]

  //     const recipeItem = await this.validateProductRecipeItem({item:item}, company)

  //      const index = menuItemRecipe.findIndex((obj:any )=> obj.inventoryId === recipeItem?.inventoryId || obj.recipeId === recipeItem?.recipeId )
  //           if (index == -1 ){
  //             menuItemRecipe.push(recipeItem)

  //           }else{
  //           menuItemRecipe[index] =   recipeItem
  //           }

  //            query = {
  //           text: `
  //       UPDATE "Products"
  //       SET recipes = $1
  //       WHERE id = $2 AND "companyId" = $3
  //     `, values: [JSON.stringify(menuItemRecipe), menuItem.id, companyId]
  //         }

  //         const result = await DB.excu.query(query.text, query.values);

  //         return new ResponseData(true, "Updated Successfully", null)








  //   } catch (error: any) {
  //   


  //     throw new Error(error.message)
  //   }
  // }
  public static async validateRecipeItem(itemData: { usages: number; inventoryId?: string; recipeId?: string; name?: string; }, company: Company, validTypes?: string[]) {

    const { id: companyId } = company;
    const item = { ...itemData };
    const allowedTypes = validTypes && validTypes.length > 0 ? validTypes : ['inventory', 'kit'];

    // 1. Core input validation
    if (item.usages <= 0) {
      throw new ValidationException(`Usages for recipe item "${item.name || 'unknown'}" must be greater than zero.`);
    }

    // 2. Determine the query based on item type
    let query: { text: string; values: any[] };

    if (item.inventoryId) {
      query = {
        text: ` SELECT id, name, type, "unitCost", "UOM"
            FROM "Products"
            WHERE "companyId" = $1 AND id = $2`,
        values: [companyId, item.inventoryId],
      };

    } else if (allowedTypes.includes('Recipe') && item.recipeId) {
      query = {
        text: `
        SELECT
          r.id,
          r.name,
          'Recipe' AS type,
          '' AS "UOM",
          COALESCE(SUM(latest."cost" * items."usage"), 0) AS "unitCost"
        FROM "Recipe" r
        JOIN LATERAL jsonb_to_recordset(r.items) AS items("usage" float4, "inventoryId" uuid) ON TRUE
        JOIN "Products" p ON p.id = items."inventoryId"
        LEFT JOIN LATERAL (
          SELECT
            imr."cost"
          FROM "InventoryMovmentRecords" imr
          WHERE imr."companyId" = p."companyId"
            AND imr."productId" = p.id
            AND imr."qty" >= 0
          ORDER BY imr."createdAt" DESC
          LIMIT 1
        ) latest ON TRUE
        WHERE r.id = $2 AND r."companyId" = $1
        GROUP BY r.id, r.name
      `,
        values: [companyId, item.recipeId],
      };
    } else {
      const validIdTypes = allowedTypes.includes('Recipe') ? 'EitherinventoryId or recipeId' : 'inventoryId';
      throw new ValidationException(`${validIdTypes} is required.`);
    }

    try {
      const result = await DB.excu.query(query.text, query.values);
      const recipeProduct = result.rows?.[0];

      // 3. Post-query validation
      if (!recipeProduct) {
        throw new ValidationException('Item not found.');
      }

      if (!allowedTypes.includes(recipeProduct.type)) {
        throw new ValidationException(
          `Invalid type "${recipeProduct.type}" for item "${recipeProduct.name}". Must be one of: ${allowedTypes.join(', ')}.`
        );
      }

      // 4. Transform and return the result
      const baseItem = {
        usages: item.usages,
        name: recipeProduct.name,
        unitCost: recipeProduct.unitCost,
        ...(item.inventoryId && { inventoryId: recipeProduct.id }),
        ...(item.recipeId && { recipeId: recipeProduct.id }),
      };

      return baseItem;
    } catch (error: any) {
      // Re-throw ValidationException to avoid losing specific error messages
      if (error instanceof ValidationException) {
        throw error;
      }
      // For all other errors, provide a generic message for security and re-throw
      // while ensuring the original error is logged.
      console.error('An unexpected error occurred during validation.', error);
      throw new Error('Validation failed due to an internal error.');
    }
  }

  /**
   * Adds or updates a recipe item in a menu item product.
   */
  public static async saveProductRecipeItem(data: any, productId: string, company: Company): Promise<ResponseData> {
    try {
      const companyId = company.id;
      const item = data;

      // Fetch the menu item
      const fetchQuery = {
        text: `
          SELECT id, recipes
          FROM "Products"
          WHERE "companyId" = $1 AND id = $2 AND type = 'menuItem'
        `,
        values: [companyId, productId],
      };

      const fetchResult = await DB.excu.query(fetchQuery.text, fetchQuery.values);
      const menuItem = fetchResult.rows?.[0];

      if (!menuItem || menuItem == undefined) {
        throw new ValidationException('Menu item not found');
      }

      const validatedItem = await this.validateRecipeItem(item, company, ['inventory', 'kit', 'Recipe']);

      let recipe = menuItem.recipes ?? [];

      const index = recipe.findIndex((entry: any) =>
        ('inventoryId' in validatedItem && validatedItem.inventoryId && entry.inventoryId === validatedItem.inventoryId) ||
        ('recipeId' in validatedItem && entry.recipeId === validatedItem.recipeId)
      );

      if (index >= 0) {
        recipe[index] = validatedItem;
      } else {
        recipe.push(validatedItem);
      }

      const updateQuery = {
        text: `
          UPDATE "Products"
          SET recipes = $3 , "updatedDate" = $4
          WHERE id = $1 AND "companyId" = $2
        `,
        values: [productId, companyId, JSON.stringify(recipe), new Date()],
      };

      await DB.excu.query(updateQuery.text, updateQuery.values);

      return new ResponseData(true, 'Recipe item saved successfully', validatedItem);
    } catch (error: any) {

      throw new Error(error.message || 'Failed to save recipe item');
    }
  }

  public static async deleteProductRecipeItem(itemId: string, productId: string, companyId: string): Promise<ResponseData> {
    try {

      // '    WITH filtered AS (
      //     SELECT id,
      //           json_agg(elem) AS new_recipes
      //     FROM "Products",
      //         json_array_elements(recipes) AS elem
      //     WHERE "companyId" = $1
      //     and id =$2 
      //     and (elem->>'inventoryId' != $3 or elem->>'recipeId' != $3)
      //     GROUP BY id
      //   )
      //     UPDATE "Products"
      //     SET recipes = filtered.new_recipes  , "updatedDate" = $4
      //     from filtered
      //     WHERE "Products".id = filtered.id
      //     returning recipes'

      const updateQuery = {
        text: `
        UPDATE "Products"
        SET recipes = (
          SELECT jsonb_agg(elem)::json
          FROM jsonb_array_elements(recipes::jsonb) AS elem
          WHERE NOT (elem->>'inventoryId' = $3 AND elem->>'recipeId' = $3)
        ), 
        "updatedDate" = $4
          WHERE "companyId" = $1 
          AND id = $2
          AND ((recipes::jsonb) @> '[{"inventoryId": "${itemId}"}]'
          or (recipes::jsonb) @> '[{ "recipeId": "${itemId}"}]') returning id 
        `,
        values: [companyId, productId, itemId, new Date()],
      };

      const record = await DB.excu.query(updateQuery.text, updateQuery.values);

      if (record.rows && record.rows.length > 0) {
        return new ResponseData(true, 'Recipe item deleted successfully', {});
      }

      return new ResponseData(false, 'Recipe item not found', {});
    } catch (error: any) {

      throw new Error(error.message || 'Failed to delete recipe item');
    }
  }





}