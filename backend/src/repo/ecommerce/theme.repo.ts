import { ResponseData } from "@src/models/ResponseData";
import { Invoice } from "@src/models/account/Invoice";
import { Company } from "@src/models/admin/company";

import { ThawaniPayment } from "@src/paymentGateways/Thawani";
import { PoolClient } from "pg";
import { DB } from "@src/dbconnection/dbconnection";
import { InvoiceRepo } from "../app/accounts/invoice.repo";
import { SocketInvoiceRepo } from "../socket/invoice.socket";
import { PaymentInterFace } from "@src/paymentGateways/paymentInterFace";
import { CartRepo } from "./cart.repo";
import { CustomerRepo } from "../app/accounts/customer.repo";


import { filter } from "lodash";
import { CompanyRepo } from "../admin/company.repo";
import { ShopRepo } from "./shop.repo";
import { RedisClient } from "@src/redisClient";

export class ThemeRepo {
 
    public static async getMenus(company: Company) {
        try {
            const query = {
                text: `with "menuElements" as (
                    SELECT jsonb_array_elements((jsonb_array_elements((("template"->>'menus')::jsonb))->>'menuChilds')::jsonb)->>'elementId' AS "elementId",
                      jsonb_array_elements((jsonb_array_elements((("template"->>'menus')::jsonb))->>'menuChilds')::jsonb)->>'id' AS "menuId",
                      jsonb_array_elements((jsonb_array_elements((("template"->>'menus')::jsonb))->>'menuChilds')::jsonb)->>'title' AS "title",
                      jsonb_array_elements((jsonb_array_elements((("template"->>'menus')::jsonb))->>'menuChilds')::jsonb)->>'slug' AS "slug",
                          jsonb_array_elements((jsonb_array_elements((("template"->>'menus')::jsonb))->>'menuChilds')::jsonb)->>'type' AS "type",
                          jsonb_array_elements((jsonb_array_elements((("template"->>'menus')::jsonb))->>'menuChilds')::jsonb)->>'customUrl' AS "customUrl",
                              jsonb_array_elements((jsonb_array_elements((("template"->>'menus')::jsonb))->>'menuChilds')::jsonb)->>'parentId' AS "parentId",
                           jsonb_array_elements((("template"->>'menus')::jsonb))->>'options' as "options",
                           jsonb_array_elements((("template"->>'menus')::jsonb))->>'menuName' as "menuName",
                           "WebSiteBuilder".id 
                   FROM "WebSiteBuilder"
                    WHERE type = 'Menus'
                   AND "companyId"=$1
                  ) ,"collections" as (
                  
                      select "menuElements"."options"::json,
                             "menuElements"."menuName",
                             jsonb_agg(jsonb_build_object('id',case when "ProductCollections".id is NULL then "menuElements"."menuId"   else  "ProductCollections".id::text end ,
                                                          'title',case when "ProductCollections".id is NULL then  "menuElements"."title"  else"ProductCollections".title end,
                                                          'translation',case when "ProductCollections".id is NULL then  null  else"ProductCollections".translation end,
                                                          'slug',case when "ProductCollections".id is NULL then "menuElements"."slug" else "ProductCollections".slug end,
                                                          'type',  "menuElements"."type",
                                                          'customUrl',"menuElements"."customUrl"
                                                         )) as"menuChilds"	
                      from "menuElements" 
                      left join"ProductCollections" on "ProductCollections".id =  "menuElements"."elementId"::uuid
                      group by "menuElements"."options"::text,"menuElements"."menuName"
                   )
                  select * from "collections"
                
                `,
                values: [company.id]
            }

            let Menus = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", Menus.rows)
        } catch (error: any) {
           

            throw new Error(error)
        }
    }
    public static async getHomeSections(company: Company) {
        try {
            const query = {
                text: `with "menuElements" as (
                                            SELECT jsonb_array_elements(("template"->>'homeSections')::jsonb)->>'elementId' AS "elementId",
                                            jsonb_array_elements(("template"->>'homeSections')::jsonb)->>'id' AS "menuId",
                                            jsonb_array_elements(("template"->>'homeSections')::jsonb)->>'title' AS "title",
                                            jsonb_array_elements(("template"->>'homeSections')::jsonb)->>'type' AS "type",
                                            jsonb_array_elements(("template"->>'homeSections')::jsonb)->>'slug' AS "slug",
                                            jsonb_array_elements(("template"->>'homeSections')::jsonb)->>'style' AS "style"
                                        FROM "WebSiteBuilder"
                                            WHERE type = 'ThemeSettings'
                                        AND "companyId" = $1 
                                        ) ,
                        "collections" as ( 
                                        SELECT
                                        case when "ProductCollections".id is NULL then "menuElements"."elementId"   else  "ProductCollections".id::text end  as "id",
                                        case when "ProductCollections".id is NULL then  "menuElements"."title"  else"ProductCollections".title end as "title",
                                        case when "ProductCollections".id is NULL then  null  else "ProductCollections".translation end as "translation",
                                        case when "ProductCollections".id is NULL then "menuElements"."slug" else"ProductCollections".slug end as "slug", 
                                        "menuElements"."style" 
                                        
                                        from "menuElements" 
                                        left join"ProductCollections" on "ProductCollections".id =  "menuElements"."elementId"::uuid
                                        )
                        select * from "collections"
                      `,
                values: [company.id]
            }

            let sections = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", sections.rows)
        } catch (error: any) {
  

            throw new Error(error)
        }
    }


    public static async getMenuProducts2(data: any, company: Company, types: any[]) {
        try {
            let branchId = data.branchId;
            let filterId = branchId ? data.branchId : company.id; // get all compnayProducts
            let slug = data.slug;
            console.log(slug)

            let tags = data.tags ? data.tags : `{}`;

            let departmentId = data.departmentId ? data.departmentId : '00000000-0000-0000-0000-000000000000' // '000...0' == null so when sectionId is not provided will select all products without filter on sectionId
            let categoryId = data.categoryId ? data.categoryId : '00000000-0000-0000-0000-000000000000' // '000...0' == null so when sectionId is not provided will select all products without filter on sectionId
            let brandId = data.brandId ? data.brandId : '00000000-0000-0000-0000-000000000000'

            let page = data.page ? data.page : 1;
            let offset = 0;

            let sort = data.sort
            let sortValue = !sort || !sort ? ' "Products"."createdAt" ' : '"' + sort.sortValue + '"';
            let sortTerm = "";
            if (sort && sort.sortValue != null && sort.sortDirection != null) {
                let sortDirection = !sort || !sort ? "DESC" : sort.sortDirection;
                sortTerm = " ORDER BY " + sortValue + " " + sortDirection;
            }

            let count = 0;
            let pageCount = 0;

            const limit = ((data.limit == null) ? 12 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }


            let priceFilter = data.priceFilter


            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase() + `.*$` : '[A-Za-z0-9]*';
            let values = [filterId, slug, searchValue, tags, departmentId, categoryId]


            let joinQuery = `inner join lateral (select trim ('"' from jsonb_array_elements(data->'ids')::text)as "productId"
                                        from "ProductCollections"
                                        where slug = $2
                            )t on "productId" = id::text 
                LEFT JOIN "Categories" on "Categories".id = "Products"."categoryId"
                             LEFT JOIN "Departments" on "Departments".id = "Categories"."departmentId"
                             INNER JOIN "BranchProducts" on "BranchProducts"."productId" = "Products".id and  "BranchProducts"."availableOnline" = true
                             LEFT  JOIN "MenuSectionProduct" on "MenuSectionProduct"."productId" = "Products".id 
                             INNER JOIN "Branches" on "Branches".id =  "BranchProducts"."branchId"
                             LEFT JOIN "Media" on  "Media".id = "Products"."mediaId"
                             LEFT join "Brands" on "Brands".id = "Products"."brandid" 
                             `
            if (types.find(f => f == 'service')) {
                joinQuery += ` LEFT JOIN "EmployeePrices"  ON "EmployeePrices"."productId" = "Products".id`
            }


            let filterQuery = `  WHERE`
            filterQuery += branchId ? ` "BranchProducts"."branchId" = $1 ` : `  "Products"."companyId" =$1`
            filterQuery += ` AND "Products"."isDeleted" = false`
            if (types.find(f => f == 'service')) {
                filterQuery += ` AND ( "Products"."type" = any($3)) `

            } else {
                filterQuery += ` AND ( "Products"."type" = any($3) OR ("Products"."type" ='package' and "Products"."package" is not null and "Products"."package"::TEXT <> '[]')) `

            }

            //  filterQuery += ` AND "MenuSectionProduct".id is null ` 
            filterQuery += ` AND (lower("Products".name) ~ lower($4))`
            filterQuery += data.tags ? ` AND "Products".tags   && $5::character varying[] ` : ` AND ("Products".tags is  null or  "Products".tags = '{}' or "Products".tags <> $5) `
            filterQuery += data.departmentId ? ` AND  "Departments".id = $6 ` : ` AND( "Departments".id <> $6 OR "Departments".id IS NULL) `
            filterQuery += data.categoryId ? ` AND  "Categories".id = $7 ` : ` AND ("Categories".id <> $7 OR "Categories".id IS NULL)`
            filterQuery += data.brandId ? ` AND "Products"."brandid" =$8 ` : ` AND ("Products"."brandid" <> $8 OR "Products"."brandid" IS NULL) `

            let groupByQuery = `      group by  "Products".id  , "Media"."url"->>'defaultUrl'`
            const limitQuery = ` limit $9 offset $10`

            let countFilterQuery = filterQuery;
            values = [filterId, slug, types, searchValue, tags, departmentId, categoryId, brandId]

            if (priceFilter) {
                countFilterQuery += ` AND (("Products"."defaultPrice" >= $9 AND "Products"."defaultPrice" <= $10)  OR ("BranchProducts"."price" >= $9 AND "BranchProducts"."price"<= $10))`
                values = [filterId, slug, types, searchValue, tags, departmentId, categoryId, brandId, priceFilter.min, priceFilter.max]
            }



            let countQuery = `SELECT 
                        count( distinct "Products".id) as count
                        from "Products"
                     `

            countQuery += joinQuery + countFilterQuery;
            let selectCount = await DB.excu.query(countQuery, values)
            count = Number((<any>selectCount.rows[0]).count)
            pageCount = Math.ceil(count / data.limit)




            let selectQuery = `select 
                                "Products".id,
                                "Products".name,
                                "Products".description,
                                "Products".translation,
                                "Products"."defaultPrice",
                                "Products"."maxItemPerTicket", 
                                "Products".type,
                                "Products"."maxItemPerTicket",
                                "Media"."url"->>'defaultUrl' as "mediaUrl",
                                 (SELECT json_agg(json_build_object('id',"BranchProducts".id,
                                                                     'branchId',"BranchProducts"."branchId",
                                                                     'productId',"BranchProducts"."productId",
                                                                     'price',"BranchProducts"."price",
                                                                     'onHand',"BranchProducts"."onHand")) FROM public."BranchProducts"
                                    WHERE "BranchProducts"."productId" = "Products".id ) AS "branches"
                         `

            if (branchId) {
                selectQuery = `select 
                "Products".id,
                                    "Products".name,
                                    "Products".description,
                                    "Products".translation,
                                    "Products"."defaultPrice",
                                    "Products".type,
                                    "Products"."maxItemPerTicket",
                                    "Media"."url"->>'defaultUrl' as "mediaUrl",
                                 (SELECT json_agg(json_build_object('id',"BranchProducts".id,
                                                                     'branchId',"BranchProducts"."branchId",
                                                                     'productId',"BranchProducts"."productId",
                                                                     'price',"BranchProducts"."price",
                                                                     'onHand',"BranchProducts"."onHand")) FROM public."BranchProducts"
                                    WHERE "BranchProducts"."productId" = "Products".id  and "BranchProducts"."branchId" = "Branches".id ) AS "branches"
                        `
                groupByQuery += `, "Branches".id `
            }

            if (types.find(f => f == 'service')) {
                selectQuery += `, min("EmployeePrices".price) as "minPrice",
                                  max("EmployeePrices".price) as "maxPrice"
                                 `
            }

            selectQuery += ` from "Products" `


            values = [filterId, slug, types, searchValue, tags, departmentId, categoryId, brandId, limit, offset]
            if (priceFilter) {

                filterQuery += ` AND (("Products"."defaultPrice" >= $11 AND "Products"."defaultPrice" <= $12)  OR ("BranchProducts"."price" >= $11 AND "BranchProducts"."price"<= $12))`
                values = [filterId, slug, types, searchValue, tags, departmentId, categoryId, branchId, limit, offset, priceFilter.min, priceFilter.max]
            }



            selectQuery += joinQuery + filterQuery + groupByQuery + sortTerm + limitQuery

            let products = await DB.excu.query(selectQuery, values)


            offset += 1
            let lastIndex = ((data.page) * data.limit)
            if (products.rows.length < data.limit || data.page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: products.rows,
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

    public static async getMenuProducts(data: any, company: Company, types: any[]) {
        const client = await DB.excu.client();
        try {


            await client.query("BEGIN")

            console.log(data.page)
            let slug = data.slug ? data.slug.replace("\\", "") : null;
            let isCatch = data.cache;
            if (slug == "" || slug == null) {
                throw ("slug is required")
            }

            let sortTerm = "";
            let sort = data.sort
            let sortValue = !sort || !sort ? ' "Products"."createdAt" ' : '"' + sort.sortValue + '"';
            if (sort && sort.sortValue != null && sort.sortDirection != null) {
                let sortDirection = !sort || !sort ? "DESC" : sort.sortDirection;
                sortTerm = " ORDER BY " + sortValue + " " + sortDirection;
            }



            const query = {
                text: ` select  data ->> 'match' as match,
                                 data ->> 'sortBy' as "sortBy",
                               data -> 'conditions' as cond
                        from "ProductCollections"
                        where slug = $1
                        and "companyId"= $2 and type= 'Auto'
                     `,
                values: [slug, company.id]
            }

            let ConditionInfo = await client.query(query.text, query.values);
            console.log(ConditionInfo.rows.length)
            let prodQuery = ConditionInfo.rows && ConditionInfo.rows.length > 0 && ConditionInfo.rows[0].cond && ConditionInfo.rows[0].cond.length > 0 ? ` and ` : ` and t."productId" = "Products".id::text `

            if (ConditionInfo.rows.length > 0) {
                let d: any = ConditionInfo.rows[0]

                const match = d.match == "all" ? ` AND ` : ` OR `
                const conditions = d.cond


                const typeToColumnName: any = {
                    "Name": `"Products".name`,
                    "Type": `"Products".type`,
                    "Tag": `"Products".tags`,
                    "Category": `"Categories".name`,
                    "Department": `"Departments".name`,

                    "Price": `"Products"."defaultPrice"`,
                    "On hand": `"BranchProducts"."onHand"`,
                }


                for (const [i, condition] of conditions.entries()) {

                    let filter = typeToColumnName[condition.type]
                    if (condition.type == "Tag") {
                        prodQuery += ` exists(select 1 
                            from unnest("Products".tags)s
                           where s  `
                    } else {
                        prodQuery += filter
                    }


                    //prodQuery += condition.type.toLowerCase() != "price" ? condition.type.toLowerCase():`"defaultPrice"`
                    //condition.condition = ["Price","On hand"].includes(condition.type) &&  condition.condition == "startsWith" ? "graterThan" : condition.condition
                    // condition.condition = ["Price","On hand"].includes(condition.type) &&  condition.condition == "endsWith" ? "lessThan" : condition.condition

                    switch (condition.condition) {
                        case "isEqual":
                            prodQuery += ["Price", "On hand"].includes(condition.type) ? ` = ` + condition.value : ` ilike '` + condition.value + `'`
                            break;
                        case "isNotEqual":
                            prodQuery += ["Price", "On hand"].includes(condition.type) ? `! = ` + condition.value : ` not ilike '` + condition.value + `'`
                            break;

                        case "startsWith":
                            prodQuery += ["Price", "On hand"].includes(condition.type) ? ` > ` + condition.value : ` ilike ` + `'` + condition.value + `%'`
                            break;
                        case "endsWith":
                            prodQuery += ["Price", "On hand"].includes(condition.type) ? ` < ` + condition.value : ` ilike '%` + condition.value + `'`
                            break;
                        case "contains":
                            prodQuery += ` ilike '%` + condition.value + `%'`
                            break;
                        case "notContain":
                            prodQuery += ` not ilike '%` + condition.value + `%'`
                            break;
                    }

                    if (condition.type == "Tag") {
                        prodQuery += `) `
                    }
                    if (i == conditions.length - 1) { continue; }


                    //const sql = convertToSql[condition.condition]

                    prodQuery += match

                }


            }
            let sortByInfo = data.sortBy;
            let selectQuery = ''
            let bestSellingQuery = false;
            let limitQuery = ''
            if ((ConditionInfo.rows.length > 0 && ConditionInfo.rows[0].sortBy) || sortByInfo != null) {
                sortByInfo = data.sortBy ?? ConditionInfo.rows[0].sortBy


                switch (sortByInfo) {
                    case 'productTitleAsc':
                        sortTerm = 'Order By "Products".name ASC'
                        break;
                    case 'productTitleDesc':
                        sortTerm = 'Order By "Products".name DESC'
                        break;
                    case 'highestPrice':
                        sortTerm = 'Order By "Products"."defaultPrice" DESC'
                        break;

                    case 'lowPrice':
                        sortTerm = 'Order By "Products"."defaultPrice" ASC'
                        break;

                    case 'newest':
                        sortTerm = 'Order By "Products"."createdAt" DESC'
                        break;
                    case 'oldest':
                        sortTerm = 'Order By "Products"."createdAt" ASC'
                        break;
                    case 'bestSelling':
                        sortTerm = 'Order By "invoiceCount" DESC '
                        bestSellingQuery = true;
                        break;
                    default:
                        break;
                }
            }


            let branchId = data.branchId;
            let filterId = branchId ? data.branchId : company.id; // get all compnayProducts


            let tags = data.tags ? data.tags : `{}`;

            let departmentId = data.departmentId ? data.departmentId : '00000000-0000-0000-0000-000000000000' // '000...0' == null so when sectionId is not provided will select all products without filter on sectionId
            let categoryId = data.categoryId ? data.categoryId : '00000000-0000-0000-0000-000000000000' // '000...0' == null so when sectionId is not provided will select all products without filter on sectionId
            let brandId = data.brandId ? data.brandId : '00000000-0000-0000-0000-000000000000'

            let page = data.page ? data.page : 1;
            let offset = 0;



            let companyOptions = await CompanyRepo.getCompanyWebsiteOptions(client, company.id);
            let hideOutOfStocks = false
            if (companyOptions.success && companyOptions.data) {
                hideOutOfStocks = companyOptions.data.hideOutOfStocks
            }
            let havingQuery = ``;
            if (branchId) {
                havingQuery = `     having  (${hideOutOfStocks} = false ) or (${hideOutOfStocks}  = true and "Products"."type" = any (array['inventory','batch','serialized','kit']) and ("BranchProducts"."onHand" >0) or count("ProductSerials".id) >0 or sum( "ProductBatches"."onHand") >0 ) 
                or ("Products"."type" = any (array['service','menuItem','menuSelection','package']))`

            }
            let count = 0;
            let pageCount = 0;

            const limit = ((data.limit == null) ? 12 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }


            let priceFilter = data.priceFilter


            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase() + `.*$` : '[A-Za-z0-9]*';
            let values = [filterId, slug, searchValue, tags, departmentId, categoryId]


            let joinQuery = `LEFT join lateral (select trim ('"' from jsonb_array_elements(data->'ids')::text)as "productId"
                                        from "ProductCollections"
                                        where slug = $2
                             )t on t."productId" = "Products".id::text 
                             LEFT JOIN "Categories" on "Categories".id = "Products"."categoryId"
                             LEFT JOIN "Departments" on "Departments".id = "Categories"."departmentId"
                             INNER JOIN "BranchProducts" on "BranchProducts"."productId" = "Products".id and  "BranchProducts"."availableOnline" = true
                             LEFT  JOIN "MenuSectionProduct" on "MenuSectionProduct"."productId" = "Products".id 
                             INNER JOIN "Branches" on "Branches".id =  "BranchProducts"."branchId"
                             LEFT JOIN "Media" on  "Media".id = "Products"."mediaId"
                             LEFT JOIN "Taxes" on "Taxes".id = "Products"."taxId"
                             LEFT join "ProductBatches" on "ProductBatches"."branchProductId" =    "BranchProducts".id
							 LEFT join "ProductSerials" on "ProductSerials"."branchProductId" =    "BranchProducts" .id and "status" = 'available'
                             LEFT join "Brands" on "Brands".id = "Products"."brandid" 
                             `
            if (types.find(f => f == 'service')) {
                joinQuery += ` LEFT JOIN "EmployeePrices"  ON "EmployeePrices"."productId" = "Products".id`
            }


            let filterQuery = `  WHERE`
            filterQuery += branchId ? ` "BranchProducts"."branchId" = $1 ` : `  "Products"."companyId" =$1`
            filterQuery += prodQuery
            filterQuery += ` AND "Products"."isDeleted" = false`
            if (types.find(f => f == 'service')) {
                filterQuery += ` AND ( "Products"."type" = any($3)) `

            } else {
                filterQuery += ` AND ( "Products"."type" = any($3) OR ("Products"."type" ='package' and "Products"."package" is not null and "Products"."package"::TEXT <> '[]')) `

            }

            //  filterQuery += ` AND "MenuSectionProduct".id is null ` 
            filterQuery += ` AND (lower("Products".name) ~ lower($4))`
            filterQuery += data.tags ? ` AND "Products".tags   && $5::character varying[] ` : ` AND ("Products".tags is  null or  "Products".tags = '{}' or "Products".tags <> $5) `
            filterQuery += data.departmentId ? ` AND  "Departments".id = $6 ` : ` AND( "Departments".id <> $6 OR "Departments".id IS NULL) `
            filterQuery += data.categoryId ? ` AND  "Categories".id = $7 ` : ` AND ("Categories".id <> $7 OR "Categories".id IS NULL)`
            filterQuery += data.brandId ? ` AND "Products"."brandid" =$8 ` : ` AND ("Products"."brandid" <> $8 OR "Products"."brandid" IS NULL) `

            let groupByQuery = `      group by  "Products".id  , "Media".id`
            limitQuery = ` limit $9 offset $10`

            let countFilterQuery = filterQuery;
            values = [filterId, slug, types, searchValue, tags, departmentId, categoryId, brandId]

            if (priceFilter) {
                countFilterQuery += ` AND (("Products"."defaultPrice" >= $9 AND "Products"."defaultPrice" <= $10)  OR ("BranchProducts"."price" >= $9 AND "BranchProducts"."price"<= $10))`
                values = [filterId, slug, types, searchValue, tags, departmentId, categoryId, brandId, priceFilter.min, priceFilter.max]
            }



            let countQuery = `SELECT 
                        count( distinct "Products".id) as count
                        from "Products"
                     `

            countQuery += joinQuery + countFilterQuery;
            countQuery = ` with "counts" as ( ${countQuery} )
                select sum("count")  as "count" from "counts" `
            console.log(countQuery)
            let selectCount = await client.query(countQuery, values)

            count = selectCount.rows && selectCount.rows.length > 0 ? Number(selectCount.rows[0].count) : 0;
            pageCount = Math.ceil(count / data.limit)




            selectQuery = `select 
                                "Products".id,
                                "Products".name,
                                "Products".description,
                                "Products".translation,
                                "Products"."defaultPrice",
                                "Products"."maxItemPerTicket", 
                                "Products".type,
                                CASE WHEN ( ("Products"."defaultOptions" is not null or jsonb_array_length("Products"."defaultOptions") > 0 )or("Products"."optionGroups" is not null and json_array_length("Products"."optionGroups") > 0) ) THEN true ELSE false END AS "hasOptions",
                                "Products"."productAttributes", 
                                    JSONB_AGG("Taxes".*)->0 as "productTaxes",
                                "Products"."comparePriceAt",
                                     "Products"."taxId",
                                "Media"."url" as "mediaUrl",
                                 (SELECT json_agg(json_build_object('id',"BranchProducts".id,
                                                                     'branchId',"BranchProducts"."branchId",
                                                                     'productId',"BranchProducts"."productId",
                                                                     'price',"BranchProducts"."price",
                                                                     'onHand',"BranchProducts"."onHand")) FROM public."BranchProducts"
                                    WHERE "BranchProducts"."productId" = "Products".id ) AS "branches"
                         `

            if (branchId) {
                selectQuery = `select 
                "Products".id,
                                    "Products".name,
                                    "Products".description,
                                    "Products".translation,
                                    "Products"."defaultPrice",
                                    "Products".type,
 CASE WHEN ( ("Products"."defaultOptions" is not null or jsonb_array_length("Products"."defaultOptions") > 0 )or("Products"."optionGroups" is not null and json_array_length("Products"."optionGroups") > 0) ) THEN true ELSE false END AS "hasOptions",
                                    "Products"."maxItemPerTicket",
                                    "Products"."productAttributes", 
                                     "Products"."comparePriceAt",
                                         JSONB_AGG("Taxes".*)->0 as "productTaxes",
                                             "Products"."taxId",
                                    "Media"."url" as "mediaUrl",
                                 (SELECT json_agg(json_build_object('id',"BranchProducts".id,
                                                                     'branchId',"BranchProducts"."branchId",
                                                                     'productId',"BranchProducts"."productId",
                                                                     'price',"BranchProducts"."price",
                                                                     'onHand',"BranchProducts"."onHand")) FROM public."BranchProducts"
                                    WHERE "BranchProducts"."productId" = "Products".id  and "BranchProducts"."branchId" = "Branches".id ) AS "branches"
                        `
                groupByQuery += `, "Branches".id ,"BranchProducts".id    `
            }

            if (types.find(f => f == 'service')) {
                selectQuery += `, min("EmployeePrices".price) as "minPrice",
                                  max("EmployeePrices".price) as "maxPrice"
                                 `
            }

            selectQuery += ` from "Products" `


            values = [filterId, slug, types, searchValue, tags, departmentId, categoryId, brandId, limit, offset]
            if (priceFilter) {

                filterQuery += ` AND (("Products"."defaultPrice" >= $11 AND "Products"."defaultPrice" <= $12)  OR ("BranchProducts"."price" >= $11 AND "BranchProducts"."price"<= $12))`
                values = [filterId, slug, types, searchValue, tags, departmentId, categoryId, branchId, limit, offset, priceFilter.min, priceFilter.max]
            }




            if (bestSellingQuery) {
                selectQuery += joinQuery + filterQuery + groupByQuery + havingQuery
                selectQuery = `WITH "products" as (
                             ${selectQuery}
                            ), "invoiceCounts" as (
                          select "products".id,
                                "products".name,
                                "products".description,
                                "products".translation::text::json,
                                "products"."defaultPrice",
                                "products"."maxItemPerTicket",
                                "products".type,
                                "products"."productAttributes",
                                "products"."comparePriceAt",
                                "products"."hasOptions",
                                "mediaUrl",
                                "products"."branches"::text::jsonb,
                                 "productTaxes",
                                 count( "InvoiceLines".id) as "invoiceCount" from "products"
                           
                            inner join "InvoiceLines" on "InvoiceLines"."productId" =  "products".id
                            group by
                               "products".id,
                                "products".name,
                                "products".description,
                                "products".translation::text,
                                "products"."defaultPrice",
                                "products"."maxItemPerTicket",
                                "products".type,
                                "products"."productAttributes",
                                         "products"."hasOptions",
                                "products"."comparePriceAt",
                                "mediaUrl",
                                "branches"::text,
                                  "productTaxes"
                            ) 
                             select * from "invoiceCounts"
                             ${sortTerm}
                             ${limitQuery}
                            `
            } else {
                selectQuery += joinQuery + filterQuery + groupByQuery + havingQuery + sortTerm + limitQuery
            }



            console.log(selectQuery)

            let products = await client.query(selectQuery, values)

            const productIds = products.rows && products.rows.length > 0 ? products.rows.map((item: any) => item.id) : null;
            if (productIds && data.branchId != null && data.branchId != "") {
                let discounts = await ShopRepo.getProductDiscounts(client, productIds, branchId, company.id)

                const combined = products.rows.map((item1: any) => {
                    const item2: any = discounts.find(item2 => item2.productId === item1.id);

                    if (item2) {
                        item1.discountPercentage = item2.percentage;
                        item1.isDiscountable = true;
                        item1.discountAmount = item2.amount;
                        return item1
                    } else {
                        return item1
                    }

                }).filter(item => item !== null);
                products.rows = combined
            }
            offset += 1
            let lastIndex = ((data.page) * data.limit)
            if (products.rows.length < data.limit || data.page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: products.rows,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            await client.query("COMMIT")

            if(isCatch)
            {
                await this.cacheCollection('Collection_' + company.id + '_' + data.slug,resData)
            }
            
            return new ResponseData(true, "", resData)


        } catch (error: any) {
            await client.query("ROLLBACK")

            console.log(error)
            throw new Error(error)
        } finally {
            client.release()
        }
    }







    public static async getCutomerList(data: any, company: Company) {
        try {
            const companyId = company.id;
            let selectQuery;
            let selectValues;

            let countQuery;
            let countValues;

            let prodQuery = "";

            let slug = data.slug ? data.slug.replace("\\", "") : null;
            if (slug == "" || slug == null) {
                throw ("slug is required")
            }


            const query = {
                text: ` select  data ->> 'match' as match,
                               data -> 'conditions' as cond
                        from "CustomerSegments"
                        where slug = $1
                        and "companyId"= $2 and type= 'Auto'
                     `,
                values: [slug, company.id]
            }

            let ConditionInfo = await DB.excu.query(query.text, query.values);
            console.log(ConditionInfo.rows)

            let SegmentQuery = ConditionInfo.rows.length > 0 ? ` and ` : ` and t."customerId" = "Customers".id::text `

            if (ConditionInfo.rows.length > 0) {
                let d: any = ConditionInfo.rows[0]

                const match = d.match == "all" ? ` AND ` : ` OR `
                const conditions = [
                    {
                        "type": "First Order Date",
                        "value": "2024-2-19",
                        "condition": "startsWith"
                    }
                ]

                const typeToColumnName: any = {
                    "Country": `"Companies".name`,
                    "Age": `(extract(year from Age( "birthDay")) || '.' ||
                                                       extract(month from Age( "birthDay"))  
                                                       ):: decimal `,

                    "Domain Email": `substring("Customers".email from '@(.*)$')`,

                    "No. Of Orders": `count("Invoices".*) `, // group by "customerId"
                    "Amount Spent": `sum("Invoices".total)`, // group by "customerId"
                    "Order Date": `"Invoices"."invoiceDate" `,
                    "First Order Date": `min("Invoices"."invoiceDate")`, // group by "customerId"
                    "Last Order Date": `max("Invoices"."invoiceDate")`, // group by "customerId"
                }


                for (const [i, condition] of conditions.entries()) {

                    let filter = typeToColumnName[condition.type]
                    let arr_type = ["No. Of Orders", "Amount Spent", "First Order Date", "Last Order Date"]


                    SegmentQuery += filter

                    //prodQuery += condition.type.toLowerCase() != "price" ? condition.type.toLowerCase():`"defaultPrice"`
                    //condition.condition = ["Price","On hand"].includes(condition.type) &&  condition.condition == "startsWith" ? "graterThan" : condition.condition
                    // condition.condition = ["Price","On hand"].includes(condition.type) &&  condition.condition == "endsWith" ? "lessThan" : condition.condition

                    switch (condition.condition) {
                        case "isEqual":
                            SegmentQuery += ["Country", "Domain Email"].includes(condition.type) ? ` ilike '` + condition.value + `'` : ` = ` + condition.value
                            break;
                        case "isNotEqual":
                            SegmentQuery += ["Country", "Domain Email"].includes(condition.type) ? ` not ilike '` + condition.value + `'` : `! = ` + condition.value
                            break;
                        case "startsWith":
                            SegmentQuery += ["Country", "Domain Email"].includes(condition.type) ? ` ilike ` + `'` + condition.value + `%'` : ` > ` + condition.value
                            break;
                        case "endsWith":
                            SegmentQuery += ["Country", "Domain Email"].includes(condition.type) ? ` ilike '%` + condition.value + `'` : ` < ` + condition.value
                            break;
                        case "contains":
                            SegmentQuery += ` ilike '%` + condition.value + `%'`
                            break;
                        case "notContain":
                            SegmentQuery += ` not ilike '%` + condition.value + `%'`
                            break;
                    }

                    if (i == conditions.length - 1) { continue; }


                    //const sql = convertToSql[condition.condition]

                    SegmentQuery += match

                }

                console.log(SegmentQuery)

            }



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
                                  "Customers".id,
                                   name,
                                   email,
                                   phone,
                                   "outStandingRecivable"("Customers".id) AS "outStandingRecivable", 
                                   saluation
            FROM public."Customers"`

            const countText = `SELECT COUNT(distinct "Customers".id)
                             FROM public."Customers"`

            let joinQuery = ` LEFT join lateral (select trim ('"' from jsonb_array_elements(data->'ids')::text) as "customerId"
                                            from "CustomerSegments"
                                            where slug = $2
                                )t on t."customerId" = "Customers".id::text 
                                left join "Invoices" on "Invoices"."customerId" = "Customers".id  `

            let filterQuery = ` WHERE "Customers"."companyId" =$1`
            filterQuery += SegmentQuery
            filterQuery += ` and ((LOWER("Customers".name) ~ $3)or (LOWER("Customers".phone) ~ $3) or (LOWER("Customers".mobile) ~ $3) )`
            let groupByQuery = `  group by "Customers".id  `;
            let orderByQuery = `Order By` + sortTerm



            const limitQuery = ` limit $4 offset $5`

            let selectCount;
            selectQuery = selectText + joinQuery + filterQuery + groupByQuery + ` ORDER BY "Customers"."createdAt" DESC`
            selectValues = [companyId, slug, searchValue]





            if (data != null && data != '' && JSON.stringify(data) != '{}') {

                sort = data.sortBy;
                sortValue = !sort ? '"Customers"."createdAt"' : '"' + sort.sortValue + '"';
                sortDirection = !sort ? "DESC" : sort.sortDirection;
                if (data.customerId) {
                    sortValue = ` "Customers".id = $6`;
                }
                sortTerm = sortValue + " " + sortDirection
                orderByQuery = ` Order by ` + sortTerm;
                if (data.searchTerm != "" && data.searchTerm != null) {
                    searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`
                }

                selectQuery = selectText + joinQuery + filterQuery + groupByQuery + orderByQuery + limitQuery
                selectValues = data.customerId ? [companyId, slug, searchValue, limit, offset, data.customerId] : [companyId, slug, searchValue, limit, offset]
                countQuery = countText + joinQuery + filterQuery
                countValues = [companyId, slug, searchValue]
                console.log(countQuery)
                selectCount = await DB.excu.query(countQuery, countValues)

                count = Number((<any>selectCount.rows[0]).count)
                pageCount = Math.ceil(count / data.limit)
            }
            console.log(selectQuery)
            const selectList: any = await DB.excu.query(selectQuery, selectValues)

            // for (let index = 0; index < selectList.rows.length; index++) {
            //     const element = selectList.rows[index];
            //     selectList.rows[index].outStandingRecivable = (await this.getCustomerOutStandingReceivable(element.id)).data.outStandingRecivables;
            // }

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


            throw new Error(error.message)
        }
    }

    public static async getPageSlug(slug: string, compnay: Company) {
        try {

            let filter = `where "companyId"=$1 and "template"->>'slug' =$2`;
            let values = [compnay.id, slug]
            if (slug.toLowerCase() == 'home') {
                filter = `where "companyId"=$1 and "isHomePage" = true`
                values = [compnay.id]
            }
            const query = {
                text: `SELECT "name","template"
                 FROM "WebSiteBuilder" 
                 ${filter}
                 order by "createdAt" desc  
                 limit 1 
                 `
            }

            let page = await DB.excu.query(query.text, values);

            return new ResponseData(true, "", page.rows[0])
        } catch (error: any) {

            throw new Error(error)
        }
    }

    public static async getWebsiteMenu(compnayId: string) {
        try {


            const query = {
                text: `
                 WITH "primary" as (SELECT "name","template","isPrimaryMenu", "isFooterMenu"
                 FROM "WebSiteBuilder"
                 where "companyId" = $1
                 and "isPrimaryMenu" = true 
                 order by "createdAt" DESC 
                 limit 1 )
                 ,"footer" as(
                 SELECT "name","template", "isPrimaryMenu", "isFooterMenu"
                 FROM "WebSiteBuilder"
                 where "companyId" = $1
                 and "isFooterMenu" = true 
                 order by "createdAt" DESC 
                 )
                 select * from "primary"
                 union all 
                 select * from "footer"
                 `,
                values: [compnayId]
            }

            let page = await DB.excu.query(query.text, query.values);

            let menus = page.rows

            const resData = {
                footerMenu: menus.filter((f: any) => f.isFooterMenu),
                primaryMenu: menus.filter((f: any) => f.isPrimaryMenu)
            }
            return new ResponseData(true, "", resData)
        } catch (error: any) {

            throw new Error(error)
        }
    }

    public static async getSectionData(data: any, company: Company) {
        try {
            const ids = data.ids;
            const type = data.type;

            let sqlQuery;
            let vales = [company.id, ids]
            switch (type) {
                case 'category':
                    sqlQuery = `SELECT "Categories"."name",
                                       "Categories".id,
                                        "Categories"."departmentId",
                                         "Categories"."translation",
                                      "Media".url as "mediaUrl" 
                                FROM "Categories" 
                                left join "Media" on "Media".id = "Categories"."mediaId"
                                where "Categories"."companyId" =$1
                                and "Categories"."id" = any($2)
                              `
                    break;

                default:
                    break;
            }

            if (sqlQuery) {
                const data = await DB.excu.query(sqlQuery, vales)
                return new ResponseData(false, "", data.rows)
            }

            return new ResponseData(false, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async cacheCollection(key: string, collection: any) {
        try {
            let redisClient = RedisClient.getRedisClient();
            return await redisClient.set(key, JSON.stringify(collection), 86400);


        } catch (error:any) {
            throw new Error(error)
        }
    }

    public static async getCacheCollection(key:string) {
        try {
            let redisClient = RedisClient.getRedisClient();
            return await redisClient.get(key);
        } catch (error) {

        }
    }
}