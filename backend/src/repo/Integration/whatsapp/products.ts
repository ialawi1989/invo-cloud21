import { DB } from "../../../dbconnection/dbconnection";

import { ResponseData } from "@src/models/ResponseData";
import { PoolClient } from "pg";


import { Company } from "@src/models/admin/company";
import { order } from "@src/Integrations/whatsapp/Order";

import { whatsappProduct } from "@src/Integrations/whatsapp/Product";
import { PluginRepo } from "@src/repo/app/accounts/plugin.repo";



export class ProductsRepo {
    static POSprivielges: any;

    public static async getMenuList( data: any , company: Company) {
      
      try {
       
        // "branches" :["b3cac885-ba05-4d0c-8a61-ac77da18a84d", "95afc684-7ddf-491b-ae9c-226bd5e8932f"]
        // "MenuId" : "88071810-69c0-441b-8818-481f70701df3"
        const branches = data.branches
        const menuId = data.menuId
        

        const query : { text: string, values: any } = {
          text: `SELECT "Menu".id,
          "Menu"."name",
          "Menu"."startAt",
          "Menu"."endAt",
          "Menu"."index"
          from "Menu"
          where "companyId" = $1 `,
          values: [company.id]
        }
  
  
        const menu = await DB.excu.query(query.text, query.values);
       

        if (menu.rows.length > 0){
          return new ResponseData(true, "", menu.rows)
        }

        return new ResponseData(false, "", {})

      } catch (error: any) {
      
        throw new Error(error.message)
      }
    }

  
    public static async pushProducts(company: Company,token:any) {
      
      try {
        
        const branches= ['b3cac885-ba05-4d0c-8a61-ac77da18a84d', '95afc684-7ddf-491b-ae9c-226bd5e8932f']

         // ------------------------------
        //test catalog
        // ------------------------------
  
        const query : { text: string, values: any } = {
          text: `WITH "OptionGroupsData" AS (
                        SELECT  "Products".id AS "productId","Products"."companyId",
                                CASE
                                WHEN json_array_length("optionGroups") > 0 THEN json_agg(
                                          json_build_object(
                                            'index', ("optionGroup"->>'index'),
                                            'optionGroupId', "OptionGroups".id,
                                            'title', "OptionGroups".title,
                                            'minSelectable',"OptionGroups"."minSelectable",
                                            'maxSelectable',"OptionGroups"."maxSelectable",
                                            'options', ( SELECT json_agg( json_build_object(  'index', (elem ->>'index'),
                                                                              'optionId', ("Options".id)
                                            ))
                                          FROM json_array_elements("OptionGroups"."options") AS elem
                                          INNER JOIN "Options" ON "Options".id = (elem->>'optionId')::uuid
                                        )
                                    )
                                )
                                END AS "optionGroups"
                        FROM "Products"
                        JOIN json_array_elements("Products"."optionGroups") AS "optionGroup" ON TRUE
                        LEFT JOIN "OptionGroups" ON "OptionGroups".id = ("optionGroup"->>'optionGroupId')::uuid
                        where "Products"."companyId" = $1
                        GROUP BY "Products".id 

                    ),

                    "BranchesData" AS ( 
                            SELECT "BranchProducts"."productId", 
                                    json_agg( json_build_object('available',(coalesce("BranchProducts"."availableOnline",false))  , 
                                                                'branchId', ("BranchProducts"."branchId"),
                                                                'price',("BranchProducts".price),
                                                                'onHand', ("BranchProducts"."onHand")
                                                                ))as "branches"
                            from "BranchProducts"
                            where "companyId" = $1  and "BranchProducts"."branchId" = any($2)
                            group by "productId"
                    )
                      
                    SELECT 
                        "Products".id,
                        "Products".name,
                        "BranchesData"."branches",
                        "Media".url->'defaultUrl' AS "imageUrl",
                        "Products".translation,
                                  "Products"."defaultPrice",
                                  "Products".description,
                                  "Products"."isDeleted",
                                  "Products"."taxId",
                                  "Products".type,
                                  "Products"."maxItemPerTicket",
                                  "Products"."alternativeProducts",
                                  "Products"."UOM",
                                  "Products"."maxItemPerTicket",
                                  "OptionGroupsData"."optionGroups",
                                  "Categories".name AS "categoryName",
                                  (select name from "MenuSection" where "MenuSection".id ="MenuSectionProduct"."menuSectionId") AS "menuSectionName",
                                  "Products"."quickOptions" ,
                                  CASE
                                  WHEN "Products"."taxId" is not null THEN ( select json_agg(
                                            json_build_object(
                                              'taxId', "Taxes".id,
                                              'taxName', "Taxes".name,
                                              'taxPercent', "Taxes"."taxPercentage"      
                                            
                              )) from "Taxes" where "Products"."taxId" = "Taxes".id )
                              END AS "taxesInfo"

                        FROM "Products" 
                        INNER JOIN "BranchesData" ON "Products".id = "BranchesData"."productId"
                        left join "OptionGroupsData" on "Products".id =  "OptionGroupsData"."productId"
                        left join "MenuSectionProduct" on "Products".id =  "MenuSectionProduct"."productId"
                        left join "Categories" on "Products"."categoryId" =  "Categories".id
                        LEFT JOIN "Media" ON "Media".id = "Products"."mediaId"
                        LEFT JOIN "Brands" on "Brands".id = "Products"."brandid"
                        where "Products"."isDeleted" = false  `,
          values: [company.id, branches]
        }
  
  
        const products = await DB.excu.query(query.text, query.values);

        if (products.rows.length > 0){
          const res = (await whatsappProduct.catalog(products.rows,company,token))
          return new ResponseData(res.success, res.msg, res.data)
        }

        return new ResponseData(true, "", {})

      } catch (error: any) {
      
        throw new Error(error.message)
      }
    }
    public static async pushMenuProducts(client:PoolClient, data: any , company: Company,token:any) {
      
      try {
       

        const branches = data.branches
        const menuId = data.menuId

        const query : { text: string, values: any } = {
          text: `WITH "OptionGroupsData" AS (
                      SELECT  "Products".id AS "productId","Products"."companyId",
                              CASE
                              WHEN json_array_length("optionGroups") > 0 THEN json_agg(
                                        json_build_object(
                                          'index', ("optionGroup"->>'index'),
                                          'optionGroupId', "OptionGroups".id,
                                          'title', "OptionGroups".title,
                                          'minSelectable',"OptionGroups"."minSelectable",
                                          'maxSelectable',"OptionGroups"."maxSelectable",
                                          'options', ( SELECT json_agg( json_build_object(  'index', (elem ->>'index'),
                                                                            'optionId', ("Options".id)
                                          ))
                                        FROM json_array_elements("OptionGroups"."options") AS elem
                                        INNER JOIN "Options" ON "Options".id = (elem->>'optionId')::uuid
                                      )
                                  )
                              )
                              END AS "optionGroups"
                      FROM "Products"
                      JOIN json_array_elements("Products"."optionGroups") AS "optionGroup" ON TRUE
                      LEFT JOIN "OptionGroups" ON "OptionGroups".id = ("optionGroup"->>'optionGroupId')::uuid
                      where "Products"."companyId" = $1
                      GROUP BY "Products".id 

                  ),

                  "BranchesData" AS ( 
                          SELECT "BranchProducts"."productId", 
                                  json_agg( json_build_object('available',(coalesce("BranchProducts"."availableOnline",false))  , 
                                                              'branchId', ("BranchProducts"."branchId"),
                                                              'price',("BranchProducts".price),
                                                              'onHand', ("BranchProducts"."onHand")
                                                              ))as "branches"
                          from "BranchProducts"
                          where "companyId" = $1 and "BranchProducts"."branchId" = any($2)
                          group by "productId"
                  )
                    
                  SELECT 
                      "Products".id,
                      "Products".name,
                      "Products".type,
                      (select  json_agg( case 
                                         when "Products".type ='menuItem' then 
                                          json_build_object('available',elem -> 'available',
                                                            'branchId', elem -> 'branchId',
                                                            'price',elem -> 'price',
                                                            'onHand', elem -> null
                                                  )
                                          else elem 
                                        end )  
                     from json_array_elements("BranchesData"."branches") AS elem) AS "branches",
                      "Media".url->'defaultUrl' AS "imageUrl",
                      "Products".translation,
                                "Products"."defaultPrice",
                                "Products".description,
                                "Products"."isDeleted",
                                "Products"."taxId",
                                
                                "Products"."maxItemPerTicket",
                                "Products"."alternativeProducts",
                                "Products"."UOM",
                                "Products"."maxItemPerTicket",
                                "OptionGroupsData"."optionGroups",
                                "Categories".name AS "categoryName",
                               "MenuSection".index,
                               "MenuSection".name  AS "menuSectionName",
                                "Products"."quickOptions",
                                CASE
                                WHEN "Products"."taxId" is not null THEN ( select json_agg(
                                      json_build_object(
                                        'taxId', "Taxes".id,
                                        'taxName', "Taxes".name,
                                        'taxPercent', "Taxes"."taxPercentage"      
                                      
                                )) from "Taxes" where "Products"."taxId" = "Taxes".id )
                               END AS "taxesInfo" 
                    FROM "Products"
                    INNER JOIN "BranchesData" ON "Products".id = "BranchesData"."productId"
                    LEFT JOIN "OptionGroupsData" ON "Products".id =  "OptionGroupsData"."productId"
                    INNER JOIN "MenuSectionProduct" ON "Products".id =  "MenuSectionProduct"."productId"
                    LEFT JOIN "MenuSection" ON "MenuSection".id = "MenuSectionProduct"."menuSectionId"
                    LEFT JOIN "Categories" ON "Products"."categoryId" =  "Categories".id
                    LEFT JOIN "Media" ON "Media".id = "Products"."mediaId"
                    LEFT JOIN "Brands" ON "Brands".id = "Products"."brandid"
                    where "Products"."isDeleted" = false and "MenuSection"."menuId" = $3
                    order by "MenuSection".index, "MenuSectionProduct".index`,
          values: [company.id, branches, menuId]
        }
  
  
        const products = await client.query(query.text, query.values);
        
        if (products.rows.length > 0){
          const res = (await whatsappProduct.catalog(products.rows,company,token))
          return new ResponseData(res.success, res.msg, res.data)
        }

        return new ResponseData(true, "", {})

      } catch (error: any) {
      
        throw new Error(error.message)
      }
    }

  
    public static async orderStatus( data: any , company: Company, token: any) {
      
      try {
       
       
        const orderId = data.orderId

        const query : { text: string, values: any } = {
          text: `select id as order_id,
                       "onlineData" ->>'onlineStatus' as status
                 from "Invoices"
                 where id = $1 `,
          values: [orderId]
        }
  
        const order_stutas = await DB.excu.query(query.text, query.values);

        
        
        if (order_stutas.rows.length > 0){
          const res = (await order.orderStatus(order_stutas.rows[0],token))
          return new ResponseData(res.success, res.msg, res.data)

        } else{
          
          return new ResponseData(false, "NO order with ID: "+orderId, {})
        }

        

        

      } catch (error: any) {
      
        throw new Error(error.message)
      }
    }

    public static async getServiceList( data: any , company: Company) {
      
      try {
        
        // "branches" :["b3cac885-ba05-4d0c-8a61-ac77da18a84d", "95afc684-7ddf-491b-ae9c-226bd5e8932f"]
        // "MenuId" : "88071810-69c0-441b-8818-481f70701df3"
        const branches = data.branches
    

        const query : { text: string, values: any } = {
          text: `SELECT 
                      "Services".id,
                      "Services".name,
                      "Services".type,
                      "Services".index,
                      "Services".translation,
                      "Services".default,
                json_agg( b->'branchId') as branches 
                      FROM "Services"
                join json_array_elements(branches) as b  on true 
                where "companyId" = $1
                and (type = 'Delivery' or type = 'PickUp')
                and  (b->'setting'->>'enabled'='true') and  ( b->>'branchId' = any($2))
                group by  "Services".id`,
          values: [company.id,branches ]
        }
  
  
        const services = await DB.excu.query(query.text, query.values);
       

        if (services.rows.length > 0){
          return new ResponseData(true, "", services.rows)
        }

        return new ResponseData(false, "", {})

      } catch (error: any) {
      
        throw new Error(error.message)
      }
    }

    public static async setServices( data: any , company: Company) {
      
      try {
        
        
        const services = await PluginRepo.editWhatsAppSetting(data,company.id)

        if (services.success){
          return new ResponseData(true, services.msg,{})
        }

        return new ResponseData(false, services.msg, {})

      } catch (error: any) {
      
        throw new Error(error.message)
      }
    }

    public static async pushProductstest(company: Company,token:any) {
      
      try {
        
        const branches= ['b3cac885-ba05-4d0c-8a61-ac77da18a84d', '95afc684-7ddf-491b-ae9c-226bd5e8932f']
        

         // ------------------------------
        //test catalog
        // ------------------------------
  
        const query : { text: string, values: any } = {
          text: `WITH "OptionGroupsData" AS (
                                  SELECT  "Products".id AS "productId","Products"."companyId",
                                          CASE
                                          WHEN json_array_length("optionGroups") > 0 THEN json_agg(
                                                    json_build_object(
                                                      'index', ("optionGroup"->>'index'),
                                                      'optionGroupId', "OptionGroups".id,
                                                      'title', "OptionGroups".title,
                                                      'minSelectable',"OptionGroups"."minSelectable",
                                                      'maxSelectable',"OptionGroups"."maxSelectable",
                                                      'options', ( SELECT json_agg( json_build_object(  'index', (elem ->>'index'),
                                                                                        'optionId', ("Options".id)
                                                      ))
                                                    FROM json_array_elements("OptionGroups"."options") AS elem
                                                    INNER JOIN "Options" ON "Options".id = (elem->>'optionId')::uuid
                                                  )
                                              )
                                          )
                                          END AS "optionGroups"
                                  FROM "Products"
                                  JOIN json_array_elements("Products"."optionGroups") AS "optionGroup" ON TRUE
                                  LEFT JOIN "OptionGroups" ON "OptionGroups".id = ("optionGroup"->>'optionGroupId')::uuid
                        where "Products"."companyId" = $1
                                  GROUP BY "Products".id 

                              ),

                              "BranchesData" AS ( 
                                      SELECT "BranchProducts"."productId", 
                                              json_agg( json_build_object('available',(coalesce("BranchProducts".available,false))  , 
                                                                          'branchId', ("BranchProducts"."branchId"),
                                                                          'price',("BranchProducts".price),
                                                                          'onHand', ("BranchProducts"."onHand")
                                                                          ))as "branches"
                                      from "BranchProducts"
                        where "companyId" = $1 and "BranchProducts"."branchId" = any($2)
                                      group by "productId"
                                )
                                
                              SELECT 
                                  "Products".id,
                                  "Products".name,
                                  "BranchesData"."branches",
                                  "Media".url->'defaultUrl' AS "imageUrl",
                                  "Products".translation,
                                            "Products"."defaultPrice",
                                            "Products".description,
                                            "Products"."isDeleted",
                                            "Products"."taxId",
                                            "Products".type,
                                            "Products"."maxItemPerTicket",
                                            "Products"."alternativeProducts",
                                            "Products"."UOM",
                                          "Products"."maxItemPerTicket",
                                            "OptionGroupsData"."optionGroups",
                                  "Products"."quickOptions" 
                                  FROM "Products" 
                                  INNER JOIN "BranchesData" ON "Products".id = "BranchesData"."productId"
                                  left join "OptionGroupsData" on "Products".id =  "OptionGroupsData"."productId"
                                  LEFT JOIN "Media" ON "Media".id = "Products"."mediaId"
                                  LEFT JOIN "Brands" on "Brands".id = "Products"."brandid"  `,
          values: [company.id,branches]
        }
  
  
        const products = await DB.excu.query(query.text, query.values);

        if (products.rows.length > 0){
          const res = (await whatsappProduct.catalog(products.rows,company,token))
          return new ResponseData(res.success, res.msg, res.data)
        }

        return new ResponseData(true, "", {})

      } catch (error: any) {
      
        throw new Error(error.message)
      }
    }

    public static async getCatalog(company: Company, token:any) {
        try {
         
    
          let res = (await whatsappProduct.getCatalogList(company,token)).data
    
          return new ResponseData(true, "", res)

        } catch (error: any) {
        
          throw new Error(error.message)
        }
    }

    public static async pushCompanyOptions(client:PoolClient, company: Company,token:any) {
        try {
          

            // ------------------------------
            // test options
            // ------------------------------
        
            const query : { text: string, values: any } = {
                text: `SELECT
                            id,
                            name, 
                            price,
                            (case
                            when "Options"."translation"->'name' is not null  and  "Options"."translation"->>'name' != '{}'then
                            json_build_object('name',"Options"."translation"->'name') 
                            end) as "translation"
                        FROM "Options"
                        where "Options"."companyId" = $1
                `,
                values: [company.id]
            }
        
            const options = await client.query(query.text, query.values);
            
            if (options.rows.length > 0){
              const res = (await whatsappProduct.options(options.rows,company,token))
              return new ResponseData(res.success, res.msg, res.data)
            }

            return new ResponseData(true, "", {})
            
        } catch (error: any) {
        
          throw new Error(error.message)
        }
    }


    public static async pushMenuSections(client:PoolClient, data:any, company: Company,token:any) {
      try {
          
          const branches = data.branches
          const menuId   = data.menuId
          

          // ------------------------------
          // test sections
          // ------------------------------
      
          const query : { text: string, values: any } = {
              text: ` select 
                      distinct on ("MenuSection".id) "MenuSection".id, 
                      "MenuSection".name,
                      "MenuSection".index,
                      "productList"."products"
                      from "MenuSection"
                      INNER JOIN "Menu" ON "Menu".id =  "MenuSection"."menuId"
                      left join lateral (SELECT  "menuSectionId",json_agg( "MenuSectionProduct"."productId" )as "products"
                                from "MenuSectionProduct"
							                  inner join "BranchProducts" on "BranchProducts"."branchId" = any($2)
                                                          and "MenuSectionProduct"."productId"  ="BranchProducts"."productId"  
                                                          and "BranchProducts"."availableOnline" = true
                                group by "menuSectionId"
                                ) as "productList" ON "productList"."menuSectionId" = "MenuSection".id
                      cross JOIN LATERAL JSONB_ARRAY_ELEMENTS("Menu"."branchIds") AS "branches"(branch)
                      where "Menu"."companyId" = $1  and "MenuSection".name <> '' and "Menu".id = $3
              `,
              values: [company.id, branches, menuId]
          }
      
          const sections = await client.query(query.text, query.values);

          if (sections.rows.length > 0){
            const res = (await whatsappProduct.Groups(sections.rows,company,token))
            return new ResponseData(res.success, res.msg, res.data)
          }

          return new ResponseData(true, "", {})

      } catch (error: any) {
      
        throw new Error(error.message)
      }
    }

  
  }
