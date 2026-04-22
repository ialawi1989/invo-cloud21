import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Company } from "@src/models/admin/company";
import { ProductRepo } from "../app/product/product.repo";
import { TimeHelper } from "@src/utilts/timeHelper";

import { PoolClient } from "pg";
import { CompanyRepo } from "../admin/company.repo";
import { BranchesRepo } from "../admin/branches.repo";
import { MatrixRepo } from "../app/product/matrix.repo";
import { ValidationException } from "@src/utilts/Exception";
import { CartRepo } from "./cart.repo";
import { Invoice } from "@src/models/account/Invoice";

export class ShopRepo {


    public static async getMenuSections(data: any, company: Company) {

        try {
            /**
             * the function will retrieve menu sections by compnayId or branchId 
             */
            const currentDate = await TimeHelper.getCurrentDateWithTimeZone(company.timeOffset)

            const currentHour = currentDate.getUTCHours();
            const currentMinutes = currentDate.getUTCMinutes();
            const currentSeconds = currentDate.getUTCSeconds();
            let currentTime = currentHour + ':' + currentMinutes + ':' + currentSeconds

            const filterId = data.branchId ?? company.id; // branchId أو companyId
            const branchIdFilter = data.branchId
                ? `bp."branchId" = $1`
                : `bp."companyId" = $1`;

            let companyOptions = await CompanyRepo.getCompanyWebsiteOptions(null, company.id);
            let hideOutOfStocks = false
            let enforceServiceSelection = false
            let menuId = null
            const sessionId = data.sessionId;
            const cartData = await CartRepo.getRedisCart(company.id, sessionId);
            // if (!cartData) {
            //     throw new Error("Cart is not created");
            // }

            let cart = new Invoice();
            cart.ParseJson(cartData);

            const serviceName = cart.serviceName
            if (companyOptions.success && companyOptions.data) {
                hideOutOfStocks = companyOptions.data.hideOutOfStocks
                enforceServiceSelection = companyOptions.data.enforceServiceSelection
                if (enforceServiceSelection && !serviceName) throw new ValidationException("Service Name Is Required");
                const menus = companyOptions.data.serviceMenus
                if (serviceName && menus && typeof menus === 'object') {
                    for (const [key, value] of Object.entries(menus)) {
                        if (key.toLowerCase() === serviceName.toLowerCase()) {
                            menuId = value;
                        }
                    }
                }


            }
            // فلترة الـ Menu بحسب الفرع/الشركة + الوقت + الإتاحة أونلاين
            let filter = 'WHERE ';
            if (data.branchId) {
                // تحقّق ان المينيو مرتبط بالفرع بدون تفجير الصفوف
                filter += `
                            EXISTS (
                            SELECT 1
                            FROM jsonb_array_elements(me."branchIds") AS branches(branch)
                            WHERE (branches.branch->>'branchId')::uuid = $1
                            AND ($4::uuid is null or me."id" = $4)
                            )
                        `;
            } else {
                filter += `me."companyId" = $1 AND ($4::uuid is null or me."id" = $4)`;
            }
            filter += `
                        AND me."availableOnline" = TRUE
                        AND me."startAt" <= $2::time
                        AND me."endAt"   >= $2::time
                        `;

            // الاستعلام النهائي
            const query = `with sections as (
                        SELECT DISTINCT ON (ms.id)
                        ms.id,
                        ms.name,
                        ms."index",
                        me."index" AS "menuIndex",
                        thumb.url->>'defaultUrl'   AS "defaultUrl",
                        (thumb.url IS NOT NULL) AS "hasImage"
                        FROM "MenuSection" AS ms
                        JOIN "Menu" AS me
                        ON me.id = ms."menuId"
                        LEFT JOIN LATERAL (
                        SELECT
                            msp."productId" AS product_id,
                            md.url          AS url
                        FROM "MenuSectionProduct" AS msp
                        JOIN "BranchProducts" AS bp
                            ON bp."productId" = msp."productId"
                        AND bp."availableOnline" = TRUE
                        AND (bp."notAvailableOnlineUntil" IS NULL OR bp."notAvailableOnlineUntil" < $3)
                        AND ${branchIdFilter}          -- e.g. bp."branchId" = $1
                        JOIN "Products" AS p ON p.id = msp."productId"
                        JOIN "Media"   AS md ON md.id = p."mediaId"
                        WHERE msp."menuSectionId" = ms.id
                            AND COALESCE(md.url->>'defaultUrl', '') <> ''
                        ORDER BY random() -- ← random pick
                        LIMIT 1
                        ) AS thumb ON TRUE
                        ${filter}
                        ORDER BY  ms.id, me."index" ASC, ms."index" ASC  
                         )
						
						select * from "sections"
						 order by "menuIndex" asc , "index" asc 
                        `;

            const values = [filterId, currentTime, currentDate, menuId];

            let sections = await DB.excu.query(query, values)

            /**
             * sorting the sections based on index 
             * didn't used order by because of  select distinct on ("MenuSection".id)
             * select distinct : is used because the menu is assigned to 
             * many branches when retrieving the sections using the compnayId it will retrieve 
             * duplicated sections  because of cross JOIN LATERAL JSONB_ARRAY_ELEMENTS("Menu"."branchIds") AS "branches"(branch)` 
             * cross JOIN LATERAL JSONB_ARRAY_ELEMENTS : is used to retrieve branchId from jsonb array to be used  when selecting menu sections for one branch only
             */
            // sections.rows.sort((a: any, b: any) => a.index - b.index)

            return new ResponseData(true, "", sections.rows)
        } catch (error: any) {


            throw new Error(error)
        }

    }

    public static async getMenuProducts(data: any, company: Company) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            let timeOffset

            if (company == undefined) {
                timeOffset = "";

            } else {

                timeOffset = company.timeOffset;
            }
            console.log(data)
            let companyOptions = await CompanyRepo.getCompanyWebsiteOptions(client, company.id);
            let hideOutOfStocks = false
            if (companyOptions.success && companyOptions.data) {
                hideOutOfStocks = companyOptions.data.hideOutOfStocks
            }

            let havingQuery = `     having  (${hideOutOfStocks} = false ) or (${hideOutOfStocks}  = true and "Products"."type" = any (array['inventory','batch','serialized','kit']) and ("BranchProducts"."onHand" >0) or count("ProductSerials".id) >0 or sum( "ProductBatches"."onHand") >0 ) 
								        or ("Products"."type" = any (array['menuItem','menuSelection','package']))`


            let branchId = data.branchId;
            let filterId = branchId ? data.branchId : company.id; // get all compnayProducts

            let tags = data.tags && data.tags.length > 0 ? data.tags : `{}`;
            let sectionId = data.sectionId && data.sessionId != "" ? data.sectionId : '00000000-0000-0000-0000-000000000000' // '000...0' == null so when sectionId is not provided will select all products without filter on sectionId


            let page = data.page ? data.page : 1;
            let offset = 0;

            let sort = data.sort || {};
            let sortValue = JSON.stringify(sort) == '{}' ? ' "MenuSection"."index"  ASC,  "MenuSectionProduct"."page" ASC,  "MenuSectionProduct"."index"  ' : '"' + sort.sortValue + '"';

            if (data.searchTerm) {
                sortValue = ' "Products"."createdAt" '
            }




            let sortDirection = JSON.stringify(sort) == '{}' ? "ASC" : sort.sortDirection;

            if (sort && sort.sortValue != null && sort.sortValue == "price" && data.branchId != null && data.branchId != "") {
                sortValue = ` ("BranchProducts"."price", "Products"."defaultPrice" ) `
            }
            let sortTerm = " ORDER BY " + sortValue + " " + sortDirection

            let count = 0;
            let pageCount = 0;

            const limit = ((data.limit == null) ? 12 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }



            let priceFilter = data.priceFilter

            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase() + `.*$` : '[A-Za-z0-9]*';

            const currentDate = await TimeHelper.getCurrentDateWithTimeZone(timeOffset)

            const currentHour = currentDate.getUTCHours();
            const currentMinutes = currentDate.getUTCMinutes();
            const currentSeconds = currentDate.getUTCSeconds();
            let currentTime = currentHour + ':' + currentMinutes + ':' + currentSeconds


            let values = [filterId, currentTime, searchValue, tags, sectionId, currentDate]



            let filterQuery = ` WHERE`
            filterQuery += branchId ? ` "BranchProducts"."branchId" = $1 and "BranchProducts"."availableOnline" = true ` : `  "Products"."companyId" =$1`
            filterQuery += ` AND "Products"."isDeleted" = false`
            filterQuery += ` AND "Products"."type" <> 'service'`
            filterQuery += ` AND "Menu"."startAt" <= $2::time AND  "Menu"."endAt" >= $2::time  and ("Menu"."availableOnline" = true or  "Menu"."availableOnline" is null ) `
            filterQuery += ` AND lower("Products".name) ~ lower($3)`
            filterQuery += data.tags ? ` AND "Products".tags   && $4::character varying[] ` : ` AND ("Products".tags is  null or  "Products".tags = '{}' or "Products".tags <> $4) `
            filterQuery += data.sectionId ? ` AND "MenuSection".id  =$5 ` : ` AND "MenuSection".id <> ($5) `
            filterQuery += `and("BranchProducts"."notAvailableOnlineUntil" is null or "BranchProducts"."notAvailableOnlineUntil" <$6 ) `
            let groupByQuery = `      group by  "Products".id ,  "MenuSectionProduct"."index" , "MenuSection".index , "Media"."url"->>'defaultUrl' ,  "MenuSectionProduct"."page" ,"BranchProducts".id`
            if (data.searchTerm) {
                groupByQuery = `  group by  "Products".id ,"Media"."url"->>'defaultUrl' ,"BranchProducts".id`
            }

            if (data.branchId) {
                groupByQuery += ` ,  "Branches".id ,"BranchProducts"."price" ,"BranchProducts".id`

            }
            const limitQuery = ` limit $7 offset $8`

            let countFilterQuery = filterQuery;
            values = [filterId, currentTime, searchValue, tags, sectionId, currentDate]

            if (priceFilter && priceFilter.max && priceFilter.min) {
                countFilterQuery += ` AND (("Products"."defaultPrice" >= $7 AND "Products"."defaultPrice" <= $8)  OR ("BranchProducts"."price" >= $7 AND "BranchProducts"."price"<= $8))`
                values = [filterId, currentTime, searchValue, tags, sectionId, currentDate, Number(priceFilter.min), Number(priceFilter.max)]
            }



            let joinsQuery = `  inner join "MenuSection" on "Menu".id = "MenuSection"."menuId"
                                inner join "MenuSectionProduct" on"MenuSection".id = "MenuSectionProduct"."menuSectionId"
                                inner join "Products" on "Products".id =  "MenuSectionProduct"."productId"
                                LEFT JOIN "Taxes" on "Taxes".id = "Products"."taxId"
                                cross JOIN LATERAL JSONB_ARRAY_ELEMENTS("Menu"."branchIds") AS "branches"(branch)
                                inner join "BranchProducts" on  "BranchProducts"."branchId" = replace(("branches".branch->'branchId')::text,'"','')::uuid and "Products".id = "BranchProducts"."productId" 
                                inner join "Branches" on  "Branches".id = "BranchProducts"."branchId"
                                left join "ProductBatches" on "ProductBatches"."branchProductId" =    "BranchProducts".id
								left join "ProductSerials" on "ProductSerials"."branchProductId" =    "BranchProducts" .id and "status" = 'available'
                                LEFT JOIN "Media" on  "Media".id = "Products"."mediaId"
                                `

            let countQuery = `SELECT 
                                   count( distinct "Products".id) as count
                                from "Menu" `



            countQuery += joinsQuery + countFilterQuery + groupByQuery + havingQuery;



            countQuery = ` with "counts" as ( ${countQuery} )
                select sum("count")  as "count" from "counts" `
            let selectCount = await client.query(countQuery, values)
            count = selectCount.rows && selectCount.rows.length > 0 ? Number(selectCount.rows[0].count) : 0;
            pageCount = Math.ceil(count / data.limit) + 1


            let query = `select  distinct on (COALESCE("Products"."productMatrixId",   "Products".id))
                            "Products".id,
                            "Products".name,
                            "Products".type,
                            "Products"."maxItemPerTicket", 
                            "Products".description,
                            "Products".translation,
                            "Products"."defaultPrice",
                            "Products"."productAttributes", 
                            "Products"."comparePriceAt",
                                 (
            select
            

                   json_agg(jsonb_build_object('id', "Media".id,'defaultUrl',"Media"."url"->>'defaultUrl')) as "productMedia"

            from  json_array_elements_text("productMedia") AS elem
            inner join "Media" on "Media".id  =elem::uuid

        
            ) AS "medias",
                                  JSONB_AGG("Taxes".*)->0 as "productTaxes",
                            "Media"."url"->>'defaultUrl' as "mediaUrl",
                            CASE WHEN ( ("Products"."defaultOptions" is not null or jsonb_array_length("Products"."defaultOptions") > 0 )or("Products"."optionGroups" is not null and json_array_length("Products"."optionGroups") > 0) ) THEN true ELSE false END AS "hasOptions",
                            (SELECT json_agg(json_build_object('id',"BranchProducts".id,
                                                        'branchId',"BranchProducts"."branchId",
                                                        'productId',"BranchProducts"."productId",
                                                        'price',"BranchProducts"."price",
                                                        'onHand',        CASE
                                                        WHEN "Products".type = 'serialized'::text THEN (SELECT count("ProductSerials".id) FROM "ProductSerials" WHERE "ProductSerials"."branchProductId" = "BranchProducts".id AND "ProductSerials"."status" = 'Available')
                                                        WHEN "Products".type = 'batch'::text THEN (SELECT count("ProductBatches"."onHand") FROM "ProductBatches" WHERE "ProductBatches"."branchProductId" = "BranchProducts".id)
                                                        ELSE "BranchProducts"."onHand"
                                                      END
                                                    )
                                                  ) 
                                                        FROM "BranchProducts"
                                                        WHERE "BranchProducts"."productId" = "Products".id 
                                                        ) AS "branches"
            from "Menu" `

            if (branchId) {
                query = `select 
                "Products".id,
                            "Products".name,
                            "Products".description,
                            "Products".translation,
                            "Products".type,
                            "Products"."defaultPrice",
                            "Products"."maxItemPerTicket", 
                            "Products"."productAttributes", 
                            "Products"."comparePriceAt",
                                 (
            select
            

                   json_agg(jsonb_build_object('id', "Media".id,'defaultUrl',"Media"."url"->>'defaultUrl')) as "productMedia"

            from  json_array_elements_text("productMedia") AS elem
            inner join "Media" on "Media".id  =elem::uuid

        
            ) AS "medias",
                            JSONB_AGG("Taxes".*)->0 as "productTaxes",
                            "Media"."url"->>'defaultUrl' as "mediaUrl",
                          CASE WHEN ( ("Products"."defaultOptions" is not null and jsonb_array_length("Products"."defaultOptions") > 0 )or("Products"."optionGroups" is not null and json_array_length("Products"."optionGroups") > 0) ) THEN true ELSE false END AS "hasOptions",

                            (SELECT json_agg(json_build_object('id',"BranchProducts".id,
                                                        'branchId',"BranchProducts"."branchId",
                                                        'productId',"BranchProducts"."productId",
                                                        'price',"BranchProducts"."price",
                                                        'onHand',        CASE
                                                        WHEN "Products".type = 'serialized'::text THEN (SELECT count("ProductSerials".id) FROM "ProductSerials" WHERE "ProductSerials"."branchProductId" = "BranchProducts".id AND "ProductSerials"."status" = 'Available')
                                                        WHEN "Products".type = 'batch'::text THEN (SELECT count("ProductBatches"."onHand") FROM "ProductBatches" WHERE "ProductBatches"."branchProductId" = "BranchProducts".id)
                                                        ELSE "BranchProducts"."onHand"
                                                      END
                                                    )
                                                  )FROM "BranchProducts"     
                WHERE "BranchProducts"."productId" = "Products".id and "BranchProducts"."branchId" = "Branches".id
                             ) AS "branches"
                from "Menu" `
            }


            values = [filterId, currentTime, searchValue, tags, sectionId, currentDate, limit, offset]
            if (priceFilter && priceFilter.max && priceFilter.min) {
                filterQuery += ` AND (("Products"."defaultPrice" >= $9 AND "Products"."defaultPrice" <= $10)  OR ("BranchProducts"."price" >= $9 AND "BranchProducts"."price"<= $10 AND "BranchProducts"."price" is not null ))`
                values = [filterId, currentTime, searchValue, tags, sectionId, currentDate, limit, offset, Number(priceFilter.min), Number(priceFilter.max)]
            }
            query += joinsQuery + filterQuery + groupByQuery + havingQuery + sortTerm + limitQuery


            let products = await client.query(query, values)
            let productList = products.rows

            const productIds = products.rows && products.rows.length > 0 ? products.rows.map((item: any) => item.id) : null;
            if (productIds && data.branchId != null && data.branchId != "") {
                let discounts = await this.getProductDiscounts(client, productIds, branchId, company.id)

                const combined = productList.map((item1: any) => {
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
                productList = combined
            }

            offset += 1
            let lastIndex = ((data.page) * data.limit)
            if (products.rows.length < data.limit || data.page == pageCount) {
                lastIndex = count
            }



            const resData = {
                list: productList,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }




            /* 
                 import stringSimilrity from "string-similarity"let names: any[] = [];
                 branches.rows.forEach((e: any) => { 
                   if (stringSimilrity.compareTwoStrings('Manama',e.name) > 0.5)
                   {names.push(e.name);}
                  })
                   console.log(names)
           
             */
            await client.query("COMMIT")


            return new ResponseData(true, "", resData)
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")


            throw new Error(error)
        } finally {
            client.release()
        }
    }



    // public static async getMenuProducts(data: any, company: Company) {
    //     try {
    //         let timeOffset

    //         if (company == undefined) {
    //              timeOffset =  "";

    //           }else{

    //             timeOffset =  company.timeOffset;
    //           }

    //           const currentDate = await TimeHelper.getCurrentDateWithTimeZone(timeOffset)

    //           const currentHour = currentDate.getUTCHours();
    //           const currentMinutes = currentDate.getUTCMinutes();
    //           const currentSeconds = currentDate.getUTCSeconds();
    //           let currentTime = currentHour + ':' + currentMinutes + ':' + currentSeconds
    //           let productName = data.productName == "" ? null: data.productName
    //           let tags = data.tags == "" ? null: data.tags
    //           let menuSectionId = data.menuSectionId == "" ? null: data.menuSectionId
    //           let branchId = data.branchId == "" ? null: data.branchId
    //           let priceFrom = data.priceFilter && data.priceFilter.min ? data.priceFilter.min: null
    //           let priceTo = data.priceFilter &&  data.priceFilter.max ?data.priceFilter.max  : null
    //           let limit =data.limit;
    //           let page = data.page
    //           let offset =0;
    //           if (page != 1) {
    //             offset = (limit * (page - 1))
    //         }



    //         // let countSelect ={
    //         //     text:`with "values" as (
    //         //         select $1::uuid  as "companyId",
    //         //                $2::uuid as  "productName",
    //         //                $3 as "tags",
    //         //                $4::uuid as "menuSectionId",
    //         //                $5::uuid as "branchId",
    //         //                $6::float4 as "priceFrom",
    //         //                $7::float4 as "priceTo",
    //         //                $8::time as "currentTime",


    //         //         ),
    //         //         "count" as  (select 
    //         //             count(distinct "Products".id)        
    //         //            from "Menu"
    //         //            inner join "MenuSection" on "Menu".id = "MenuSection"."menuId"
    //         //                     inner join "MenuSectionProduct" on"MenuSection".id = "MenuSectionProduct"."menuSectionId"
    //         //                     inner join "Products" on "Products".id =  "MenuSectionProduct"."productId"
    //         //                     cross JOIN LATERAL JSONB_ARRAY_ELEMENTS("Menu"."branchIds") AS "branches"(branch)
    //         //                     inner join "BranchProducts" on  "BranchProducts"."branchId" = replace(("branches".branch->'branchId')::text,'"','')::uuid and "Products".id = "BranchProducts"."productId"  AND "BranchProducts"."availableOnline" = true
    //         //                     LEFT JOIN "Media" on  "Media".id = "Products"."mediaId"
    //         //                     JOIN "values" ON true
    //         //              WHERE  "Products"."companyId"::text = "values"."companyId"
    //         //             AND "Products"."isDeleted" = false
    //         //         and ((("values"."productName") IS NULL) or ((lower("Products".name) ~ lower("values"."productName"))))
    //         //         and ((("values"."tags"::character varying[]) IS NULL) or ("Products".tags && "values"."tags"::character varying[] ))
    //         //         and ((("values"."menuSectionId"::uuid) IS NULL) or ("MenuSection".id = "values"."menuSectionId"))
    //         //         and ((("values"."time") IS NULL AND ("values"."currentTime") IS NULL ) or ("Menu"."time" <="values"."currentTime"::time AND  "Menu"."time" >= "values"."time"::time ))
    //         //         and ("values"."branchId" is null or ("BranchProducts"."branchId"=null))
    //         //         and ((((("values"."priceFrom"::float) IS NULL or "Products"."defaultPrice" >= "values"."priceFrom") AND (("values"."priceTo"::float) IS NULL or "Products"."defaultPrice" <= "values"."priceTo"))) OR  (((("values"."priceFrom"::float) IS NULL or "BranchProducts"."price" >= "values"."priceFrom") AND (("values"."priceTo"::float) IS NULL or "BranchProducts"."price" <= "values"."priceTo"))))
    //         //         ) 
    //         //         select * from count`,
    //         //     values:[company.id,productName,tags,menuSectionId,branchId,priceFrom,priceTo,currentTime]
    //         // }


    //         let selectQuery ={
    //             text:`with "values" as (
    //                 select $1::uuid  as "companyId",
    //                         $2::text as  "productName",
    //                         $3 as "tags",
    //                         $4::uuid as "menuSectionId",
    //                         $5::uuid as "branchId",
    //                         $6::float4 as "priceFrom",
    //                         $7::float4 as "priceTo",
    //                         $8::time as "currentTime"

    //                 ),
    //                 "products" as  (select 
    // 					count ("Products".id) over(),
    //                     "Products".id,
    //                     "Products".name,
    //                     "Products".description,
    //                     "Products".translation::text,
    //                     "Products"."defaultPrice",
    //                     "Products"."maxItemPerTicket", 
    //                     "Products".type,
    //                     "Media"."url"->>'defaultUrl' as "mediaUrl",
    //                 json_agg(json_build_object('id',"BranchProducts".id,
    //                                                'branchId',"BranchProducts"."branchId",
    //                                                'productId',"BranchProducts"."productId",
    //                                                'price',"BranchProducts"."price",
    //                                                'onHand',"BranchProducts"."onHand")) as "Branches",

    //                     CASE WHEN ("Products"."optionGroups" is null or json_array_length("Products"."optionGroups") = 0 )  THEN FALSE ELSE TRUE END AS "hasOptions"
    //                      from "Menu"
    // 							join "values" on true
    // 					        inner join "MenuSection" on "Menu".id = "MenuSection"."menuId"
    //                             inner join "MenuSectionProduct" on"MenuSection".id = "MenuSectionProduct"."menuSectionId"
    //                             inner join "Products" on "Products".id =  "MenuSectionProduct"."productId"
    // 						     cross JOIN LATERAL JSONB_ARRAY_ELEMENTS("Menu"."branchIds") AS "branches"(branch)
    //                             inner join "BranchProducts" on  "BranchProducts"."branchId" = replace(("branches".branch->'branchId')::text,'"','')::uuid and "Products".id = "BranchProducts"."productId"  AND "BranchProducts"."availableOnline" = true

    //                             LEFT JOIN "Media" on  "Media".id = "Products"."mediaId"
    //                             WHERE  "Products"."companyId"::uuid = "values"."companyId"
    //                             AND "Products"."isDeleted" = false
    //                         and ((("values"."productName") IS NULL) or ((lower("Products".name) ~ lower("values"."productName"))))
    //                         and ((("values"."tags"::character varying[]) IS NULL) or ("Products".tags && "values"."tags"::character varying[] ))
    //                         and ((("values"."menuSectionId"::uuid) IS NULL) or ("MenuSection".id = "values"."menuSectionId"))
    //                         and ((("values"."currentTime") IS NULL AND ("values"."currentTime") IS NULL ) or ("Menu"."startAt" <="values"."currentTime"::time AND  "Menu"."endAt" >= "values"."currentTime"::time ))
    //                         and  ("values"."branchId" is null or ("BranchProducts"."branchId"=null))
    //                         and ((((("values"."priceFrom"::float) IS NULL or "Products"."defaultPrice" >= "values"."priceFrom") AND (("values"."priceTo"::float) IS NULL or "Products"."defaultPrice" <= "values"."priceTo"))) OR  (((("values"."priceFrom"::float) IS NULL or "BranchProducts"."price" >= "values"."priceFrom") AND (("values"."priceTo"::float) IS NULL or "BranchProducts"."price" <= "values"."priceTo"))))    
    //                         group by "Products".id ,"Media".id
    // 					    limit $9
    // 						offset $10
    //                 )

    // 				select * from "products"`,
    //             values:[company.id,productName,tags,menuSectionId,branchId,priceFrom,priceTo,currentTime,limit,offset]
    //         }




    //         let products = await DB.excu.query(selectQuery.text, selectQuery.values)

    //         let count = Number((<any>products.rows[0]).count)

    //          let   pageCount = Math.ceil(count / limit )






    //         offset += 1
    //         let lastIndex = ((data.page) * data.limit)
    //         if (products.rows.length < data.limit || data.page == pageCount) {
    //             lastIndex = count
    //         }

    //         const resData = {
    //             list: products.rows,
    //             count: count,
    //             pageCount: pageCount,
    //             startIndex: offset,
    //             lastIndex: lastIndex
    //         }

    //         return new ResponseData(true,"",resData)
    //     } catch (error: any) {
    //         console.log(error)
    //       
    //         throw new Error(error)
    //     }
    // }




    // public static async getMenuProducts(data: any, company: Company) {
    //     try {
    //         let timeOffset

    //         if (company == undefined) {
    //              timeOffset =  "";

    //           }else{

    //             timeOffset =  company.timeOffset;
    //           }

    //           const currentDate = await TimeHelper.getCurrentDateWithTimeZone(timeOffset)

    //           const currentHour = currentDate.getUTCHours();
    //           const currentMinutes = currentDate.getUTCMinutes();
    //           const currentSeconds = currentDate.getUTCSeconds();
    //           let currentTime = currentHour + ':' + currentMinutes + ':' + currentSeconds
    //           let productName = data.productName == "" ? null: data.productName
    //           let tags = data.tags == "" ? null: data.tags
    //           let menuSectionId = data.menuSectionId == "" ? null: data.menuSectionId
    //           let branchId = data.branchId == "" ? null: data.branchId
    //           let priceFrom = data.priceFilter.min ?? null
    //           let priceTo = data.priceFilter.max ?? null
    //           let limit =data.limit;
    //           let page = data.page
    //           let offset =0;
    //           if (page != 1) {
    //             offset = (limit * (page - 1))
    //         }



    //         let countSelect ={
    //             text:`with "values" as (
    //                 select $1::uuid  as "companyId",
    //                        $2::uuid as  "productName",
    //                        $3 as "tags",
    //                        $4::uuid as "menuSectionId",
    //                        $5::uuid as "branchId",
    //                        $6::float4 as "priceFrom",
    //                        $7::float4 as "priceTo",
    //                        $8::time as "currentTime",


    //                 ),
    //                 "count" as  (select 
    // 					count(distinct "Products".id)		 
    //                    from "Menu"
    //                    inner join "MenuSection" on "Menu".id = "MenuSection"."menuId"
    //                             inner join "MenuSectionProduct" on"MenuSection".id = "MenuSectionProduct"."menuSectionId"
    //                             inner join "Products" on "Products".id =  "MenuSectionProduct"."productId"
    // 							cross JOIN LATERAL JSONB_ARRAY_ELEMENTS("Menu"."branchIds") AS "branches"(branch)
    //                             inner join "BranchProducts" on  "BranchProducts"."branchId" = replace(("branches".branch->'branchId')::text,'"','')::uuid and "Products".id = "BranchProducts"."productId"  AND "BranchProducts"."availableOnline" = true
    //                             LEFT JOIN "Media" on  "Media".id = "Products"."mediaId"
    //                             JOIN "values" ON true
    //                      WHERE  "Products"."companyId"::text = "values"."companyId"
    // 					AND "Products"."isDeleted" = false
    //                 and ((("values"."productName") IS NULL) or ((lower("Products".name) ~ lower("values"."productName"))))
    // 				and ((("values"."tags"::character varying[]) IS NULL) or ("Products".tags && "values"."tags"::character varying[] ))
    //                 and ((("values"."menuSectionId"::uuid) IS NULL) or ("MenuSection".id = "values"."menuSectionId"))
    //                 and ((("values"."time") IS NULL AND ("values"."currentTime") IS NULL ) or ("Menu"."time" <="values"."currentTime"::time AND  "Menu"."time" >= "values"."time"::time ))
    //                 and ("values"."branchId" is null or ("BranchProducts"."branchId"=null))
    //                 and ((((("values"."priceFrom"::float) IS NULL or "Products"."defaultPrice" >= "values"."priceFrom") AND (("values"."priceTo"::float) IS NULL or "Products"."defaultPrice" <= "values"."priceTo"))) OR  (((("values"."priceFrom"::float) IS NULL or "BranchProducts"."price" >= "values"."priceFrom") AND (("values"."priceTo"::float) IS NULL or "BranchProducts"."price" <= "values"."priceTo"))))
    //                 ) 
    //                 select * from count`,
    //             values:[company.id,productName,tags,menuSectionId,branchId,priceFrom,priceTo,currentTime]
    //         }


    //         let selectQuery ={
    //             text:`with "values" as (
    //                 select $1::uuid  as "companyId",
    //                         $2::uuid as  "productName",
    //                         $3 as "tags",
    //                         $4::uuid as "menuSectionId",
    //                         $5::uuid as "branchId",
    //                         $6::float4 as "priceFrom",
    //                         $7::float4 as "priceTo",
    //                         $8::time as "currentTime",
    //                         $9::float4 as "limit",
    //                         $10::time as "offset",
    //                 ),
    //                 "products" as  (select 
    //                     "Products".id,
    //                     "Products".name,
    //                     "Products".description,
    //                     "Products".translation::text,
    //                     "Products"."defaultPrice",
    //                     "Products"."maxItemPerTicket", 
    //                     "Products".type,
    //                     "Media"."url"->>'defaultUrl' as "mediaUrl",
    //                     "Menu"."branchIds",
    // 					CASE WHEN ("Products"."optionGroups" is null or json_array_length("Products"."optionGroups") = 0 )  THEN FALSE ELSE TRUE END AS "hasOptions"
    //                      from "Menu"
    //                    inner join "MenuSection" on "Menu".id = "MenuSection"."menuId"
    //                             inner join "MenuSectionProduct" on"MenuSection".id = "MenuSectionProduct"."menuSectionId"
    //                             inner join "Products" on "Products".id =  "MenuSectionProduct"."productId"
    //                             LEFT JOIN "Media" on  "Media".id = "Products"."mediaId"
    //                             WHERE  "Products"."companyId"::text = "values"."companyId"
    //                             AND "Products"."isDeleted" = false
    //                         and ((("values"."productName") IS NULL) or ((lower("Products".name) ~ lower("values"."productName"))))
    //                         and ((("values"."tags"::character varying[]) IS NULL) or ("Products".tags && "values"."tags"::character varying[] ))
    //                         and ((("values"."menuSectionId"::uuid) IS NULL) or ("MenuSection".id = "values"."menuSectionId"))
    //                         and ((("values"."time") IS NULL AND ("values"."currentTime") IS NULL ) or ("Menu"."time" <="values"."currentTime"::time AND  "Menu"."time" >= "values"."time"::time ))

    //                         limit "values"."limit"
    //                         offset "values"."offset"
    //                 ) , branches as (
    //                 SELECT
    //                     "products".id,
    //                     "products".name,
    //                     "products".description,
    //                     "products".translation,
    //                     "products"."defaultPrice",
    //                     "products".type,
    //                     "products"."maxItemPerTicket",
    //                     "products"."mediaUrl",
    // 					"products"."hasOptions",
    //                     json_agg(json_build_object('id',"BranchProducts".id,
    //                                                'branchId',"BranchProducts"."branchId",
    //                                                'productId',"BranchProducts"."productId",
    //                                                'price',"BranchProducts"."price",
    //                                                'onHand',"BranchProducts"."onHand")) as "Branches"
    //                     FROM "products"
    //                     cross JOIN LATERAL JSONB_ARRAY_ELEMENTS("products"."branchIds") AS "branches"(branch)
    //                             inner join "BranchProducts" on  "BranchProducts"."branchId" = replace(("branches".branch->'branchId')::text,'"','')::uuid and "products".id = "BranchProducts"."productId"  AND "BranchProducts"."availableOnline" = true
    //                             JOIN "values" ON TRUE
    //                     where  ("values"."branchId" is null or ("BranchProducts"."branchId"=null))
    //                     and ((((("values"."priceFrom"::float) IS NULL or "Products"."defaultPrice" >= "values"."priceFrom") AND (("values"."priceTo"::float) IS NULL or "Products"."defaultPrice" <= "values"."priceTo"))) OR  (((("values"."priceFrom"::float) IS NULL or "BranchProducts"."price" >= "values"."priceFrom") AND (("values"."priceTo"::float) IS NULL or "BranchProducts"."price" <= "values"."priceTo"))))    
    //                     group by "products".id,
    //                     "products".name,
    //                     "products".description,
    //                     "products".translation,
    //                     "products"."defaultPrice",
    //                     "products".type,
    //                     "products"."maxItemPerTicket",
    //                     "products"."mediaUrl",
    // 					 "products"."hasOptions"

    //                 )

    //                 select * from branches`,
    //             values:[company.id,productName,tags,menuSectionId,branchId,priceFrom,priceTo,currentTime,limit,offset]
    //         }


    //         let selectCount = await DB.excu.query(countSelect.text, countSelect.values)
    //         let count = Number((<any>selectCount.rows[0]).count)

    //          let   pageCount = Math.ceil(count / limit )



    //         let products = await DB.excu.query(selectQuery.text, selectQuery.values)



    //         offset += 1
    //         let lastIndex = ((data.page) * data.limit)
    //         if (products.rows.length < data.limit || data.page == pageCount) {
    //             lastIndex = count
    //         }

    //         const resData = {
    //             list: products.rows,
    //             count: count,
    //             pageCount: pageCount,
    //             startIndex: offset,
    //             lastIndex: lastIndex
    //         }

    //         return new ResponseData(true,"",resData)
    //     } catch (error: any) {
    //         console.log(error)
    //       
    //         throw new Error(error)
    //     }
    // }



    public static async getMenuProductTags(data: any, companyId: string) {
        try {


            let filterId = data.branchId ? data.branchId : companyId;
            let priceFilter = data.priceFilter;
            let filter = ` WHERE`
            filter += data.branchId ? ` "Branches".id = $1` : ` "Products"."companyId" =$1`
            let values = [filterId]
            let outerQuery = `select tags, count (tags) from  (`
            if (priceFilter) {
                filter += ` AND (("Products"."defaultPrice" >= $2 AND "Products"."defaultPrice" <= $3)  OR ("BranchProducts"."price" >= $2 AND "BranchProducts"."price"<= $3))`
                values = [filterId, priceFilter.min, priceFilter.max]
            }
            let query = `select "Products".id , unnest(tags) tags
                            from "Products"
                        INNER JOIN "MenuSectionProduct" ON "MenuSectionProduct"."productId" = "Products".id
                        INNER JOIN "MenuSection" ON "MenuSection".id =  "MenuSectionProduct"."menuSectionId" 
                        INNER JOIN "Menu" ON "MenuSection"."menuId" =   "Menu".id 
                        CROSS JOIN LATERAL JSONB_ARRAY_ELEMENTS("Menu"."branchIds") AS "branchIds"("branch")
                        INNER JOIN "Branches" on "Branches".id = ("branchIds"."branch"->>'branchId')::uuid
                             `
            query += filter + ` group by "Products".id )t group by tags`

            outerQuery += query


            const tags = await DB.excu.query(outerQuery, values);

            return new ResponseData(true, "", tags.rows)
        } catch (error: any) {


            throw new Error(error)
        }
    }
    public static async getCatgorieProductsTags(data: any, companyId: string) {
        try {


            let filterId = data.branchId ? data.branchId : companyId;
            let priceFilter = data.priceFilter;
            let filter = ` WHERE "MenuSectionProduct".id is null `
            filter += data.branchId ? ` AND "BranchProducts"."branchId" = $1` : ` AND "Products"."companyId" =$1`
            let values = [filterId]

            if (priceFilter) {
                filter += ` AND (("Products"."defaultPrice" >= $2 AND "Products"."defaultPrice" <= $3)  OR ("BranchProducts"."price" >= $2 AND "BranchProducts"."price"<= $3))`
                values = [filterId, priceFilter.min, priceFilter.max]
            }
            let query = `select unnest(tags) tags, count(*) from "Products"
                                left join "Categories" on  "Products"."categoryId"  =  "Categories".id 
                                left join "MenuSectionProduct" on "MenuSectionProduct"."productId" = "Products".id 
                                left join "BranchProducts" on "BranchProducts"."productId" = "Products".id 
                             `
            query += filter + ` group by  unnest(tags)`




            const tags = await DB.excu.query(query, values);

            return new ResponseData(true, "", tags.rows)
        } catch (error: any) {


            throw new Error(error)
        }
    }

    // public static async getCompanyCategories(data: any, company: Company,types:any) {
    //     const client = await DB.excu.client();
    //     try {

    //         await client.query("BEGIN");
    //         const compnayId = company.id;

    //         const query : { text: string, values: any } = {
    //             text: `Select DISTINCT( "Departments".id), "Departments".name from "Departments" 
    //                    INNER JOIN "Categories" ON "Departments".id = "Categories"."departmentId"
    //                    INNER JOIN "Products" ON  "Products"."categoryId" = "Categories".id
    //                   where  "Departments"."companyId"=$1
    //                   and "Products".type = any($2)`,
    //             values: [compnayId,types]
    //         }

    //         const departments: any = await client.query(query.text, query.values);
    //         //load categories 

    //         for (let index = 0; index < departments.rows.length; index++) {
    //             const department = departments.rows[index];
    //             query.text = `select DISTINCT("Categories".id),"Categories".name from "Categories"
    //                          INNER JOIN "Products" ON  "Products"."categoryId" = "Categories".id
    //                          where "departmentId"=$1
    //                          and "Products".type = any($2)`,
    //                 query.values = [department.id,types];
    //             let categories = await client.query(query.text, query.values)
    //             departments.rows[index].categories = categories.rows
    //         }
    //         await client.query("COMMIT");
    //         return new ResponseData(true, "", departments.rows)
    //     } catch (error: any) {
    //         await client.query("ROLLBACK");
    //       

    //         throw new Error(error)
    //     } finally {
    //         client.release()
    //     }

    // }

    public static async getCompanyCategories(data: any, company: Company, types: any) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN");
            const compnayId = company.id;
            const branchId = data.branchId;
            let companyOptions = await CompanyRepo.getCompanyWebsiteOptions(client, company.id);
            let hideOutOfStocks = false
            if (companyOptions.success && companyOptions.data) {
                hideOutOfStocks = companyOptions.data.hideOutOfStocks
            }

            let havingQuery = `     having  (${hideOutOfStocks} = false ) or (${hideOutOfStocks}  = true and "Products"."type" = any (array['inventory','batch','serialized','kit']) and ("BranchProducts"."onHand" >0) or count("ProductSerials".id) >0 or sum( "ProductBatches"."onHand") >0 ) 
								        or ("Products"."type" = any (array['menuItem','menuSelection','package'])) `

            const query: { text: string, values: any } = {
                text: `WITH "departments" AS (
                            SELECT DISTINCT "Departments".id AS id, "Departments".name , "Departments"."translation"
                            FROM "Departments"
                            INNER JOIN "Categories" ON "Departments".id = "Categories"."departmentId"
                            INNER JOIN "Products" ON "Products"."categoryId" = "Categories".id
                            inner join "BranchProducts" on "BranchProducts"."productId" = "Products".id and "BranchProducts"."availableOnline" = true and ("BranchProducts"."branchId" = $3 or( $3::uuid is null and "BranchProducts"."companyId" = "Products"."companyId") )
                            left join "ProductBatches"  on "ProductBatches"."branchProductId" =  "BranchProducts".id
                            left join "ProductSerials"  on "ProductSerials"."branchProductId" =  "BranchProducts".id and "status" = 'Available'
                            WHERE "Departments"."companyId" = $1
                                     and "Products".type = any($2)
                  
                            group by  "Departments".id , "Products".type, "BranchProducts"."onHand"
                                      ${havingQuery}
                        ),
                        "categories" AS (
                            SELECT DISTINCT "Categories".id AS id,
                                            "Categories".name,
                                            "Categories"."translation",
                                            "Categories"."departmentId",
                                            "Categories"."index",
                                                 "Media"."url"->>'defaultUrl' as "mediaUrl"
                            FROM "Categories"
                            INNER JOIN "Products" ON "Products"."categoryId" = "Categories".id
                            
                            INNER JOIN "Departments" ON "Categories"."departmentId" = "Departments".id
                            inner join "BranchProducts" on "BranchProducts"."productId" = "Products".id  and "BranchProducts"."availableOnline" = true and ("BranchProducts"."branchId" = $3  or ( $3::uuid is null and  "BranchProducts"."companyId" = "Products"."companyId") )
                            left join "ProductBatches"  on "ProductBatches"."branchProductId" =  "BranchProducts".id
                            left join "ProductSerials"  on "ProductSerials"."branchProductId" =  "BranchProducts".id and "status" = 'Available'
                            left join "Media" on "Media".id = "Categories"."mediaId"
                            where "Categories"."companyId" =   $1
                              and "Products".type = any($2)
                                     group by  "Categories".id , "Products".type, "BranchProducts"."onHand",  "Media".id
                                         ${havingQuery}
                         ),
                        "final" AS (
                            SELECT 
                                "departments".*, 
                            case when count("categories".id) > 0 then JSON_AGG(
                                    json_build_object('id', "categories".id, 'name', "categories".name,'mediaUrl',"categories"."mediaUrl",'translation',"categories"."translation")
                                    ORDER BY "categories"."index"
                                ) else null end  AS "categories",
                                MIN("categories"."index") AS min_index
                            FROM "departments"
                            LEFT JOIN "categories" ON "departments".id = "categories"."departmentId"
                            GROUP BY "departments".id, "departments".name,"departments"."translation"
                            
                        )
                        SELECT id, name,"translation", categories
                        FROM "final"
                        where "categories" is not null 
                        ORDER BY min_index ASC;
                    `,
                values: [compnayId, types, branchId]
            }
            console.log(query.text, query.values)
            const departments: any = await client.query(query.text, query.values);
            //load categories 

            // for (let index = 0; index < departments.rows.length; index++) {
            //     const department = departments.rows[index];
            //     query.text = `select DISTINCT("Categories".id),"Categories".name from "Categories"
            //                  INNER JOIN "Products" ON  "Products"."categoryId" = "Categories".id
            //                  where "departmentId"=$1
            //                  and "Products".type = any($2)`,
            //         query.values = [department.id,types];
            //     let categories = await client.query(query.text, query.values)
            //     departments.rows[index].categories = categories.rows
            // }
            await client.query("COMMIT");
            return new ResponseData(true, "", departments.rows)
        } catch (error: any) {
            await client.query("ROLLBACK");


            throw new Error(error)
        } finally {
            client.release()
        }

    }


    public static async getServicesListById(data: any, company: Company) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN");
            const compnayId = company.id;
            let branchId = data.branchId ? (data.branchId).trim() ? (data.branchId).trim() : null : null;
            let employeeId = data.employeeId ? (data.employeeId).trim() ? (data.employeeId).trim() : null : null

            const query: { text: string, values: any } = {
                text: `SELECT
                Products.name,
                Products.type,
                BranchProducts.available,
                 BranchProducts.price,
                 BranchProducts. "onHand",
                 BranchProducts."branchId",
                emp."employeeId" as "employeeId",
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
                 Products.barcode,
                 Products."defaultPrice",
                 Products.description,
                 Products."mediaId",
                 Products.translation,
                 Products."categoryId",
                 Products. "preparationTime",
                 Products."taxId",
                 Products.tags,
                 Products.warning,
                 Products."defaultImage",
                 Products."serviceTime",
                 Products."UOM",
                 Products."unitCost",
                 Products.selection,
                 Products."optionGroups",
                 Products."quickOptions",
                 Products."productMatrixId",
                 Products."productMedia",
                 Products."commissionPercentage",
                 Products."commissionAmount",
                 Products.color,
                        JSONB_AGG("Taxes".*)->0 as "productTaxes",
                 Products."priceModel",
                 "Media"."url",
                  
                 (select json_agg(json_build_object('serial', serial , 'status', "status")) AS serials from  "ProductSerials" as ProductSerials where BranchProducts.id = ProductSerials."branchProductId"),
                 (select json_agg(json_build_object('barcode', barcode )) AS barcodes from  "ProductBarcodes" as ProductBarcodes where Products.id = ProductBarcodes."productId"),
                 cast((select json_agg(json_build_object('employeeId', "employeeId" ,'price',price,'serviceTime',"serviceTime")) AS "employeePrices"   FROM "EmployeePrices" as EmployeePrices where Products.id = EmployeePrices."productId") as jsonb)
                 FROM "Products" AS Products 
                 inner JOIN "BranchProducts" AS BranchProducts
                 ON BranchProducts."productId" = Products.id 
                 left JOIN "EmployeePrices" AS emp
                 ON emp."productId" = Products.id 
                 LEFT JOIN "Taxes" on "Taxes".id = "Products"."taxId"
                 left join "Media" on "Media".id = Products."mediaId"
                 where  Products.type = 'service' and ((($1::uuid) IS NULL) or (emp."employeeId" = $1)) and ((($2::uuid) IS NULL) or (BranchProducts."branchId" = $2)) and ((($3::uuid) IS NULL) or (Products."companyId" = $3))`,
                values: [employeeId, branchId, compnayId]
            }

            const departments: any = await client.query(query.text, query.values);


            await client.query("COMMIT");
            return new ResponseData(true, "", departments.rows)
        } catch (error: any) {
            await client.query("ROLLBACK");


            throw new Error(error)
        } finally {
            client.release()
        }

    }

    public static async getServicesList(data: any, company: Company) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN");
            const compnayId = company.id;
            let branchId = data.branchId ? (data.branchId).trim() ? (data.branchId).trim() : null : null;
            let employeeId = data.employeeId ? (data.employeeId).trim() ? (data.employeeId).trim() : null : null

            const query: { text: string, values: any } = {
                text: `with prod as(SELECT Products.name,
                Products.id ,
                Products."companyId" ,
                Products.barcode,
                Products."defaultPrice",
                Products.description,
                Products."mediaId",
                Products.translation,
                Products."categoryId",
                Products."taxId",
                Products.tags,
                Products.warning,
                Products."defaultImage",
                Products."serviceTime",
                Products."UOM",
                Products."productMatrixId",
                Products."productMedia",
                Products."commissionPercentage",
                Products."commissionAmount",
                Products.color,
                    JSONB_AGG("Taxes".*)->0 as "productTaxes",
                cast((select json_agg(json_build_object('employeeId', "employeeId" ,'price',price,'serviceTime',"serviceTime")) AS "employeePrices"   FROM "EmployeePrices" as EmployeePrices where Products.id = EmployeePrices."productId" and Products."companyId" = EmployeePrices."companyId") as jsonb)
                FROM  "Products" as Products
                     LEFT JOIN "Taxes" on "Taxes".id = Products."taxId"
                where Products.type= 'service' and      Products."companyId" = $1
                      group by      Products.id
                ),
                
                branchProd as (select  
                BranchProducts."productId",
                BranchProducts.available,
                BranchProducts.price,
                BranchProducts."branchId",
                BranchProducts."priceBoundriesFrom",
                BranchProducts."priceBoundriesTo",
                BranchProducts."buyDownPrice",
                BranchProducts."buyDownQty",
                BranchProducts."priceByQty",
                BranchProducts."selectedPricingType",
                
                (select json_agg(json_build_object('serial', serial , 'status', "status")) AS serials from  "ProductSerials" as ProductSerials where BranchProducts.id = ProductSerials."branchProductId")
                
                FROM  "BranchProducts" AS BranchProducts 
                where BranchProducts.available = true and ($2::uuid) is not null and BranchProducts."branchId" = ($2::uuid)
                )
                
                select * from prod
                inner join lateral( select * from branchProd where ($2::uuid) is not null and branchProd."branchId" = ($2::uuid))n on true and Prod.id = n."productId" and($2::uuid) is not null
                union all
                select * from prod
                left join lateral( select * from branchProd where ($2::uuid) is not null and branchProd."branchId" = ($2::uuid))n on true and Prod.id = n."productId" where ($2::uuid) is null
                `,
                values: [compnayId, branchId]
            }
            let list: any = await DB.excu.query(query.text, query.values);


            if (employeeId) {
                let newList: any[] = [];
                list.rows.forEach((element: any) => {
                    let s = element.employeePrices ? element.employeePrices.find((f: any) => f.employeeId == employeeId) : null
                    if (s) {
                        element.price = s.price;
                        element.serviceTime = s.serviceTime;
                    }
                    newList.push(element)
                })

            }

            await client.query("COMMIT");
            return new ResponseData(true, "", list.rows)

        } catch (error: any) {
            await client.query("ROLLBACK");


            throw new Error(error)
        } finally {
            client.release()
        }

    }

    // public static async getCategoriesProducts(data: any, company: Company, types: any[]) {
    //     try {
    //         let branchId = data.branchId;
    //         let filterId = branchId ? data.branchId : company.id; // get all compnayProducts

    //         let tags = data.tags ? data.tags : `{}`;

    //         let departmentId = data.departmentId ? data.departmentId : '00000000-0000-0000-0000-000000000000' // '000...0' == null so when sectionId is not provided will select all products without filter on sectionId
    //         let categoryId = data.categoryId ? data.categoryId : '00000000-0000-0000-0000-000000000000' // '000...0' == null so when sectionId is not provided will select all products without filter on sectionId
    //         let brandId = data.brandId ? data.brandId :'00000000-0000-0000-0000-000000000000'

    //         let page = data.page ? data.page : 1;
    //         let offset = 0;

    //         let sort = data.sort
    //         let sortValue = !sort || !sort ? ' "Products"."createdAt" ' : '"' + sort.sortValue + '"';
    //         let sortTerm = "";
    //         if (sort &&sort.sortValue != null && sort.sortDirection != null) {
    //             let sortDirection = !sort || !sort ? "DESC" : sort.sortDirection;
    //             sortTerm = " ORDER BY " + sortValue + " " + sortDirection;
    //         }

    //         let count = 0;
    //         let pageCount = 0;

    //         const limit = ((data.limit == null) ? 12 : data.limit);
    //         if (page != 1) {
    //             offset = (limit * (page - 1))
    //         }


    //         let priceFilter = data.priceFilter


    //         let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase() + `.*$` : '[A-Za-z0-9]*';
    //         let values = [filterId, searchValue, tags, departmentId, categoryId]


    //         let joinQuery = `LEFT JOIN "Categories" on "Categories".id = "Products"."categoryId"
    //                          LEFT JOIN "Departments" on "Departments".id = "Categories"."departmentId"
    //                          INNER JOIN "BranchProducts" on "BranchProducts"."productId" = "Products".id and  "BranchProducts"."availableOnline" = true
    //                          LEFT  JOIN "MenuSectionProduct" on "MenuSectionProduct"."productId" = "Products".id 
    //                          INNER JOIN "Branches" on "Branches".id =  "BranchProducts"."branchId"
    //                          LEFT JOIN "Media" on  "Media".id = "Products"."mediaId"
    //                          LEFT join "Brands" on "Brands".id = "Products"."brandid" 
    //                          `
    //         if (types.find(f => f == 'service')) {
    //             joinQuery += ` LEFT JOIN "EmployeePrices"  ON "EmployeePrices"."productId" = "Products".id`
    //         }


    //         let filterQuery = `  WHERE`
    //         filterQuery += branchId ? ` "BranchProducts"."branchId" = $1 ` : `  "Products"."companyId" =$1`
    //         filterQuery += ` AND "Products"."isDeleted" = false`
    //         if(types.find(f => f == 'service'))
    //         {
    //             filterQuery += ` AND ( "Products"."type" = any($2)) `

    //         }else{
    //             filterQuery += ` AND ( "Products"."type" = any($2) OR ("Products"."type" ='package' and "Products"."package" is not null and "Products"."package"::TEXT <> '[]')) `

    //         }

    //         filterQuery += ` AND "MenuSectionProduct".id is null ` //remove
    //         filterQuery += ` AND (lower("Products".name) ~ lower($3))`
    //         filterQuery += data.tags ? ` AND "Products".tags   && $4::character varying[] ` : ` AND ("Products".tags is  null or  "Products".tags = '{}' or "Products".tags <> $4) `
    //         filterQuery += data.departmentId ? ` AND  "Departments".id = $5 ` : ` AND( "Departments".id <> $5 OR "Departments".id IS NULL) `
    //         filterQuery += data.categoryId ? ` AND  "Categories".id = $6 ` : ` AND ("Categories".id <> $6 OR "Categories".id IS NULL)`
    //         filterQuery += data.brandId ? ` AND "Products"."brandid" =$7 ` : ` AND ("Products"."brandid" <> $7 OR "Products"."brandid" IS NULL) `

    //         let groupByQuery = `      group by  "Products".id  , "Media"."url"->>'defaultUrl'`
    //         const limitQuery = ` limit $8 offset $9`

    //         let countFilterQuery = filterQuery;
    //         values = [filterId,types, searchValue, tags, departmentId, categoryId,brandId]

    //         if (priceFilter) {
    //             countFilterQuery += ` AND (("Products"."defaultPrice" >= $8 AND "Products"."defaultPrice" <= $9)  OR ("BranchProducts"."price" >= $8 AND "BranchProducts"."price"<= $9))`
    //             values = [filterId,types, searchValue, tags, departmentId, categoryId,brandId, priceFilter.min, priceFilter.max]
    //         }



    //         let countQuery = `SELECT 
    //                     count( distinct "Products".id) as count
    //                     from "Products"
    //                  `

    //         countQuery += joinQuery + countFilterQuery;
    //         let selectCount = await DB.excu.query(countQuery, values)
    //         count = Number((<any>selectCount.rows[0]).count)
    //         pageCount = Math.ceil(count / data.limit)




    //         let selectQuery = `select 
    //                             "Products".id,
    //                             "Products".name,
    //                             "Products".description,
    //                             "Products".translation,
    //                             "Products"."defaultPrice",
    //                             "Products"."maxItemPerTicket", 
    //                             "Products".type,
    //                             "Products"."maxItemPerTicket",
    //                             "Media"."url"->>'defaultUrl' as "mediaUrl",
    //                              (SELECT saveNewInventoryLocations FROM "BranchProducts"
    //                                 WHERE "BranchProducts"."productId" = "Products".id ) AS "branches"
    //                      `

    //         if (branchId) {
    //             selectQuery = `select 
    //             "Products".id,
    //                                 "Products".name,
    //                                 "Products".description,
    //                                 "Products".translation,
    //                                 "Products"."defaultPrice",
    //                                 "Products".type,
    //                                 "Products"."maxItemPerTicket",
    //                                 "Media"."url"->>'defaultUrl' as "mediaUrl",
    //                              (SELECT json_agg(json_build_object('id',"BranchProducts".id,
    //                                                                  'branchId',"BranchProducts"."branchId",
    //                                                                  'productId',"BranchProducts"."productId",
    //                                                                  'price',"BranchProducts"."price",
    //                                                                  'onHand',"BranchProducts"."onHand")) FROM "BranchProducts"
    //                                 WHERE "BranchProducts"."productId" = "Products".id  and "BranchProducts"."branchId" = "Branches".id ) AS "branches"
    //                     `
    //             groupByQuery += `, "Branches".id `
    //         }

    //         if (types.find(f => f == 'service')) {
    //             selectQuery += `, min("EmployeePrices".price) as "minPrice",
    //                               max("EmployeePrices".price) as "maxPrice"
    //                              `
    //         }

    //         selectQuery += ` from "Products" `


    //         values = [filterId,types, searchValue, tags, departmentId, categoryId,brandId, limit, offset]
    //         if (priceFilter) {

    //             filterQuery += ` AND (("Products"."defaultPrice" >= $10 AND "Products"."defaultPrice" <= $11)  OR ("BranchProducts"."price" >= $10 AND "BranchProducts"."price"<= $11))`
    //             values = [filterId,types, searchValue, tags, departmentId, categoryId,branchId, limit, offset, priceFilter.min, priceFilter.max]
    //         }



    //         selectQuery += joinQuery + filterQuery + groupByQuery + sortTerm + limitQuery

    //         let products = await DB.excu.query(selectQuery, values)


    //         offset += 1
    //         let lastIndex = ((data.page) * data.limit)
    //         if (products.rows.length < data.limit || data.page == pageCount) {
    //             lastIndex = count
    //         }

    //         const resData = {
    //             list: products.rows,
    //             count: count,
    //             pageCount: pageCount,
    //             startIndex: offset,
    //             lastIndex: lastIndex
    //         }

    //         return new ResponseData(true, "", resData)

    //     } catch (error: any) {
    //       
    //         console.log(error)
    //         throw new Error(error)
    //     }
    // }


    public static async getCategoriesProducts2(data: any, company: Company, types: any[]) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            let branchId = data.branchId;
            let filterId = branchId ? data.branchId : company.id; // get all compnayProducts

            let tags = data.tags ? data.tags : `{}`;

            let departmentId = data.departmentId ? data.departmentId : '00000000-0000-0000-0000-000000000000' // '000...0' == null so when sectionId is not provided will select all products without filter on sectionId
            let categoryId = data.categoryId ? data.categoryId : '00000000-0000-0000-0000-000000000000' // '000...0' == null so when sectionId is not provided will select all products without filter on sectionId
            let brandId = data.brandId ? data.brandId : '00000000-0000-0000-0000-000000000000'


            let page = data.page ? data.page : 1;
            let offset = 0;

            let sort = data.sort
            let sortTerm = "";

            let sortValue;
            if (!sort || JSON.stringify(sort) == '{}' || (sort && sort.sortValue && sort.sortValue == 'default')) {
                sortTerm = ' Order By "Categories"."index" ASC, "Products"."categoryIndex" ASC';
            } else {
                if (sort && sort.sortValue != null && sort.sortDirection != null) {
                    sortValue = sort.sortValue
                    let sortDirection = !sort || !sort ? "DESC" : sort.sortDirection;
                    sortTerm = " ORDER BY " + '"' + sortValue + '"' + " " + sortDirection;
                }

            }

            let serviceId = null;
            const menuId = data.menuId;
            const sessionId = data.sessionId;
            let cartData = await CartRepo.getRedisCart(company.id, sessionId);
            let cart = new Invoice();
            if (cartData) {
                cart.ParseJson(cartData);
                serviceId = cart.serviceId;
            }
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
            let values = [filterId, searchValue, tags, departmentId, categoryId, brandId]




            let joinQuery = `LEFT JOIN "Categories" on "Categories".id = "Products"."categoryId"
                             LEFT JOIN "Departments" on "Departments".id = "Categories"."departmentId"
                             INNER JOIN "BranchProducts" on "BranchProducts"."productId" = "Products".id and  "BranchProducts"."availableOnline" = true
                             INNER JOIN "Branches" on "Branches".id =  "BranchProducts"."branchId"
                             LEFT join "ProductBatches" on "ProductBatches"."branchProductId" =    "BranchProducts".id
							 LEFT join "ProductSerials" on "ProductSerials"."branchProductId" =    "BranchProducts" .id and "status" = 'available'
                             LEFT JOIN "Media" on  "Media".id = "Products"."mediaId"
                             LEFT join "Brands" on "Brands".id = "Products"."brandid" 
                                         LEFT JOIN "Taxes" on "Taxes".id = "Products"."taxId"
                             `
            if (types.find(f => f == 'service')) {
                joinQuery += ` LEFT JOIN "EmployeePrices"  ON "EmployeePrices"."productId" = "Products".id`
            }


            let filterQuery = `  WHERE`
            filterQuery += branchId ? ` "BranchProducts"."branchId" = $1 ` : `  "Products"."companyId" =$1`
            filterQuery += ` AND "Products"."isDeleted" = false`
            if (types.find(f => f == 'service')) {
                filterQuery += ` AND ( "Products"."type" = any($2)) `

            } else {
                filterQuery += ` AND ( "Products"."type" = any($2) OR ("Products"."type" ='package' and "Products"."package" is not null and "Products"."package"::TEXT <> '[]')) `

            }


            filterQuery += ` AND (lower("Products".name) ~ lower($3))`
            filterQuery += data.tags ? ` AND "Products".tags   && $4::character varying[] ` : ` AND ("Products".tags is  null or  "Products".tags = '{}' or "Products".tags <> $4) `
            filterQuery += data.departmentId ? ` AND  "Departments".id = $5 ` : ` AND( "Departments".id <> $5 OR "Departments".id IS NULL) `
            filterQuery += data.categoryId ? ` AND  "Categories".id = $6 ` : ` AND ("Categories".id <> $6 OR "Categories".id IS NULL)`
            filterQuery += data.brandId ? ` AND "Products"."brandid" = $7 ` : ` AND ("Products"."brandid" <> $7 OR "Products"."brandid" IS NULL) `

            let groupByQuery = `      group by  "Products".id  ,"Categories"."index" , "Products"."categoryIndex"  , "Media"."url"->>'defaultUrl',"BranchProducts".id `
            const limitQuery = ` limit $8 offset $9`

            let countFilterQuery = filterQuery;
            values = [filterId, types, searchValue, tags, departmentId, categoryId, brandId]

            if (priceFilter) {
                countFilterQuery += ` AND (("Products"."defaultPrice" >= $8 AND "Products"."defaultPrice" <= $9)  OR ("BranchProducts"."price" >= $8 AND "BranchProducts"."price"<= $9))`
                values = [filterId, types, searchValue, tags, departmentId, categoryId, brandId, priceFilter.min, priceFilter.max]
            }



            let countQuery = `SELECT 
                        count( distinct "Products".id) as count
                        from "Products"
                     `

            countQuery += joinQuery + countFilterQuery + groupByQuery + havingQuery;
            countQuery = ` with "counts" as ( ${countQuery} )
                select sum("count")  as "count" from "counts" `
            let selectCount = await client.query(countQuery, values)
            count = selectCount.rows && selectCount.rows.length > 0 ? Number(selectCount.rows[0].count) : 0;
            pageCount = Math.ceil(count / data.limit) + 1




            let selectQuery = `select distinct on (COALESCE("Products"."productMatrixId",   "Products".id))
                                "Products".id,
                                "Products".name,
                                "Products".description,
                                "Products".translation,
                                "Products"."defaultPrice",
                                "Products"."maxItemPerTicket", 
                                "Products".type,
                                "Products"."maxItemPerTicket",
                                "Products"."productAttributes", 
                                
              (
            select
            

                   json_agg(jsonb_build_object('id', "Media".id,'defaultUrl',"Media"."url"->>'defaultUrl')) as "productMedia"

            from  json_array_elements_text("productMedia") AS elem
            inner join "Media" on "Media".id  =elem::uuid

        
            ) AS "medias",
                                "Products"."comparePriceAt",
                                    JSONB_AGG("Taxes".*)->0 as "productTaxes",
                                   "Products"."taxId",
 CASE WHEN ( ("Products"."defaultOptions" is not null and jsonb_array_length("Products"."defaultOptions") > 0 )or("Products"."optionGroups" is not null and json_array_length("Products"."optionGroups") > 0) ) THEN true ELSE false END AS "hasOptions",
                                "Media"."url"->>'defaultUrl' as "mediaUrl",
                                 (SELECT json_agg(json_build_object('id',"BranchProducts".id,
                                                                     'branchId',"BranchProducts"."branchId",
                                                                     'productId',"BranchProducts"."productId",
                                                                     'price',"BranchProducts"."price",
                                                                     'onHand',   CASE
                                                        WHEN "Products".type = 'serialized'::text THEN (SELECT count("ProductSerials".id) FROM "ProductSerials" WHERE "ProductSerials"."branchProductId" = "BranchProducts".id AND "ProductSerials"."status" = 'Available')
                                                        WHEN "Products".type = 'batch'::text THEN (SELECT count("ProductBatches"."onHand") FROM "ProductBatches" WHERE "ProductBatches"."branchProductId" = "BranchProducts".id)
                                                        ELSE "BranchProducts"."onHand" end )) FROM "BranchProducts"
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
                                    "Products"."productAttributes", 
                                    "Products"."comparePriceAt",
                                         (
            select
            

                   json_agg(jsonb_build_object('id', "Media".id,'defaultUrl',"Media"."url"->>'defaultUrl')) as "productMedia"

            from  json_array_elements_text("productMedia") AS elem
            inner join "Media" on "Media".id  =elem::uuid

        
            ) AS "medias",
                                        JSONB_AGG("Taxes".*)->0 as "productTaxes",
                                      "Products"."taxId",
 CASE WHEN ( ("Products"."defaultOptions" is not null and jsonb_array_length("Products"."defaultOptions") > 0 )or("Products"."optionGroups" is not null and json_array_length("Products"."optionGroups") > 0) ) THEN true ELSE false END AS "hasOptions",
                                    "Media"."url"->>'defaultUrl' as "mediaUrl",
                                 (SELECT json_agg(json_build_object('id',"BranchProducts".id,
                                                                     'branchId',"BranchProducts"."branchId",
                                                                     'productId',"BranchProducts"."productId",
                                                                     'price',"BranchProducts"."price",
                                                                     'onHand',   CASE
                                                        WHEN "Products".type = 'serialized'::text THEN (SELECT count("ProductSerials".id) FROM "ProductSerials" WHERE "ProductSerials"."branchProductId" = "BranchProducts".id AND "ProductSerials"."status" = 'Available')
                                                        WHEN "Products".type = 'batch'::text THEN (SELECT count("ProductBatches"."onHand") FROM "ProductBatches" WHERE "ProductBatches"."branchProductId" = "BranchProducts".id)
                                                        ELSE "BranchProducts"."onHand" end )) FROM "BranchProducts"
                                    WHERE "BranchProducts"."productId" = "Products".id  and "BranchProducts"."branchId" = "Branches".id ) AS "branches"
                        `
                groupByQuery += `, "Branches".id ,"BranchProducts".id ,"Categories"."index" , "Products"."categoryIndex"  `
            }

            if (types.find(f => f == 'service')) {
                selectQuery += `, min("EmployeePrices".price) as "minPrice",
                                  max("EmployeePrices".price) as "maxPrice"
                                 `
            }

            selectQuery += ` from "Products" `


            values = [filterId, types, searchValue, tags, departmentId, categoryId, brandId, limit, offset]
            if (priceFilter) {

                filterQuery += ` AND (("Products"."defaultPrice" >= $10 AND "Products"."defaultPrice" <= $11)  OR ("BranchProducts"."price" >= $10 AND "BranchProducts"."price"<= $11))`
                values = [filterId, types, searchValue, tags, departmentId, categoryId, brandId, limit, offset, priceFilter.min, priceFilter.max]
            }




            selectQuery += joinQuery + filterQuery + groupByQuery + havingQuery + sortTerm + limitQuery



            let products = await client.query(selectQuery, values)

            const productIds = products.rows && products.rows.length > 0 ? products.rows.map((item: any) => item.id) : null;
            if (productIds && data.branchId != null && data.branchId != "") {
                let discounts = await this.getProductDiscounts(client, productIds, branchId, company.id)

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
                const productsTemp = productIds.map(m => {
                    return { id: m }
                })
                let prices = await ShopRepo.getProductPrices(client, productsTemp, data.branchId, [], serviceId)
                if (prices && prices.length > 0) {
                    products.rows = products.rows.map(p => {
                        const price = prices ? prices.find(pp => pp.id == p.id) : null
                        if (price) {
                            p.price = price.price
                        }
                        return p
                    })
                }
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

            return new ResponseData(true, "", resData)

        } catch (error: any) {

            console.log(error)
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }

 public static async getCategoriesProducts(data: any, company: Company, types: any[]) {
    const client = await DB.excu.client();
    try {

        await client.query("BEGIN")

        let branchId = data.branchId;
        let filterId = branchId ? data.branchId : company.id;

        let tags = data.tags ? data.tags : `{}`;

        let departmentId = data.departmentId ? data.departmentId : '00000000-0000-0000-0000-000000000000'
        let categoryId = data.categoryId ? data.categoryId : '00000000-0000-0000-0000-000000000000'
        let brandId = data.brandId ? data.brandId : '00000000-0000-0000-0000-000000000000'

        let page = data.page ? data.page : 1;
        let offset = 0;

        let sort = data.sort;
        let sortTerm = "";
        let sortValue;

        // ✅ FIX: required DISTINCT ON expression
        const distinctOnExpr = `COALESCE("Products"."productMatrixId", "Products".id)`;

        if (!sort || JSON.stringify(sort) == '{}' || (sort && sort.sortValue && sort.sortValue == 'default')) {
            sortTerm = ` ORDER BY ${distinctOnExpr}, "Categories"."index" ASC, "Products"."categoryIndex" ASC`;
        } else {
            if (sort && sort.sortValue != null && sort.sortDirection != null) {
                sortValue = sort.sortValue;
                let sortDirection = sort.sortDirection || "DESC";
                sortTerm = ` ORDER BY ${distinctOnExpr}, "${sortValue}" ${sortDirection}`;
            }
        }

        let serviceId = null;
        const sessionId = data.sessionId;

        let cartData = await CartRepo.getRedisCart(company.id, sessionId);
        let cart = new Invoice();

        if (cartData) {
            cart.ParseJson(cartData);
            serviceId = cart.serviceId;
        }

        let companyOptions = await CompanyRepo.getCompanyWebsiteOptions(client, company.id);
        let hideOutOfStocks = false;

        if (companyOptions.success && companyOptions.data) {
            hideOutOfStocks = companyOptions.data.hideOutOfStocks;
        }

        let havingQuery = ``;

        if (branchId) {
            havingQuery = ` having (${hideOutOfStocks} = false )
                or (${hideOutOfStocks} = true and "Products"."type" = any (array['inventory','batch','serialized','kit'])
                and ("BranchProducts"."onHand" > 0)
                or count("ProductSerials".id) > 0
                or sum("ProductBatches"."onHand") > 0 )
                or ("Products"."type" = any (array['service','menuItem','menuSelection','package']))`
        }

        let count = 0;
        let pageCount = 0;

        const limit = ((data.limit == null) ? 12 : data.limit);

        if (page != 1) {
            offset = (limit * (page - 1))
        }

        let priceFilter = data.priceFilter;

        let searchValue = data.searchTerm
            ? `^.*` + data.searchTerm.toLowerCase() + `.*$`
            : '[A-Za-z0-9]*';

        let values = [filterId, searchValue, tags, departmentId, categoryId, brandId];

        let joinQuery = `
            LEFT JOIN "Categories" on "Categories".id = "Products"."categoryId"
            LEFT JOIN "Departments" on "Departments".id = "Categories"."departmentId"
            INNER JOIN "BranchProducts" on "BranchProducts"."productId" = "Products".id and "BranchProducts"."availableOnline" = true
            INNER JOIN "Branches" on "Branches".id = "BranchProducts"."branchId"
            LEFT join "ProductBatches" on "ProductBatches"."branchProductId" = "BranchProducts".id
            LEFT join "ProductSerials" on "ProductSerials"."branchProductId" = "BranchProducts".id and "status" = 'available'
            LEFT JOIN "Media" on "Media".id = "Products"."mediaId"
            LEFT join "Brands" on "Brands".id = "Products"."brandid"
            LEFT JOIN "Taxes" on "Taxes".id = "Products"."taxId"
            LEFT JOIN "ProductMatrix" ON "ProductMatrix".id = "Products"."productMatrixId"
        `;

        if (types.find(f => f == 'service')) {
            joinQuery += ` LEFT JOIN "EmployeePrices" ON "EmployeePrices"."productId" = "Products".id`
        }

        let filterQuery = ` WHERE`;

        filterQuery += branchId
            ? ` "BranchProducts"."branchId" = $1 `
            : ` "Products"."companyId" =$1`;

        filterQuery += ` AND "Products"."isDeleted" = false`;

        if (types.find(f => f == 'service')) {
            filterQuery += ` AND ("Products"."type" = any($2))`
        } else {
            filterQuery += ` AND ("Products"."type" = any($2) OR ("Products"."type" ='package' and "Products"."package" is not null and "Products"."package"::TEXT <> '[]'))`
        }

        filterQuery += ` AND (lower("Products".name) ~ lower($3))`;

        filterQuery += data.tags
            ? ` AND "Products".tags && $4::character varying[] `
            : ` AND ("Products".tags is null or "Products".tags = '{}' or "Products".tags <> $4) `;

        filterQuery += data.departmentId
            ? ` AND "Departments".id = $5 `
            : ` AND ("Departments".id <> $5 OR "Departments".id IS NULL) `;

        filterQuery += data.categoryId
            ? ` AND "Categories".id = $6 `
            : ` AND ("Categories".id <> $6 OR "Categories".id IS NULL) `;

        filterQuery += data.brandId
            ? ` AND "Products"."brandid" = $7 `
            : ` AND ("Products"."brandid" <> $7 OR "Products"."brandid" IS NULL) `;

        let groupByQuery = `
            group by "Products".id,
                     "Categories"."index",
                     "Products"."categoryIndex",
                     "Media"."url"->>'defaultUrl',
                     "BranchProducts".id,
                     "ProductMatrix".id
        `;

        const limitQuery = ` limit $8 offset $9`;

        let countFilterQuery = filterQuery;

        values = [filterId, types, searchValue, tags, departmentId, categoryId, brandId];

        if (priceFilter) {
            countFilterQuery += `
                AND (("Products"."defaultPrice" >= $8 AND "Products"."defaultPrice" <= $9)
                OR ("BranchProducts"."price" >= $8 AND "BranchProducts"."price" <= $9))
            `;

            values = [filterId, types, searchValue, tags, departmentId, categoryId, brandId, priceFilter.min, priceFilter.max];
        }

        let countQuery = `
            SELECT distinct ${distinctOnExpr} 
            FROM "Products"
        `;

        countQuery += joinQuery + countFilterQuery + groupByQuery + havingQuery;

        countQuery = `with "counts" as (${countQuery})
                      select count(*) as "count" from "counts"`;

        console.log(countQuery)
        let selectCount = await client.query(countQuery, values);

        count = selectCount.rows?.length > 0 ? Number(selectCount.rows[0].count) : 0;
        pageCount = Math.ceil(count / data.limit) + 1;

        let selectQuery = `
            select distinct on (${distinctOnExpr})
                "Products".id,
                COALESCE("ProductMatrix".name,"Products".name) as "name",
                "Products".description,
                "Products".translation,
                "Products"."defaultPrice",
                "Products"."maxItemPerTicket",
                "Products".type,
                "Products"."productAttributes",
                (
                    select json_agg(jsonb_build_object(
                        'id', "Media".id,
                        'defaultUrl', "Media"."url"->>'defaultUrl'
                    ))
                    from json_array_elements_text("productMedia") AS elem
                    inner join "Media" on "Media".id = elem::uuid
                ) AS "medias",
                "Products"."comparePriceAt",
                JSONB_AGG("Taxes".*)->0 as "productTaxes",
                "Products"."taxId",
                CASE
                    WHEN (("Products"."defaultOptions" is not null and jsonb_array_length("Products"."defaultOptions") > 0)
                    or ("Products"."optionGroups" is not null and json_array_length("Products"."optionGroups") > 0))
                    THEN true ELSE false
                END AS "hasOptions",
                "Media"."url"->>'defaultUrl' as "mediaUrl",
                (
                    SELECT json_agg(json_build_object(
                        'id',"BranchProducts".id,
                        'branchId',"BranchProducts"."branchId",
                        'productId',"BranchProducts"."productId",
                        'price',"BranchProducts"."price",
                        'onHand',
                        CASE
                            WHEN "Products".type = 'serialized'
                                THEN (SELECT count("ProductSerials".id)
                                      FROM "ProductSerials"
                                      WHERE "ProductSerials"."branchProductId" = "BranchProducts".id
                                      AND "ProductSerials"."status" = 'Available')
                            WHEN "Products".type = 'batch'
                                THEN (SELECT count("ProductBatches"."onHand")
                                      FROM "ProductBatches"
                                      WHERE "ProductBatches"."branchProductId" = "BranchProducts".id)
                            ELSE "BranchProducts"."onHand"
                        END
                    ))
                    FROM "BranchProducts"
                    WHERE "BranchProducts"."productId" = "Products".id
                ) AS "branches"
        `;

        if (branchId) {
            selectQuery = `select
            distinct on (${distinctOnExpr})
               "Products".id,
                    COALESCE("ProductMatrix".name,"Products".name) as "name" ,
                "Products".description,
                "Products".translation,
                "Products"."defaultPrice",
                "Products".type,
                "Products"."maxItemPerTicket",
                "Products"."productAttributes",
                "Products"."comparePriceAt",
                (
                    select json_agg(jsonb_build_object(
                        'id', "Media".id,
                        'defaultUrl', "Media"."url"->>'defaultUrl'
                    ))
                    from json_array_elements_text("productMedia") AS elem
                    inner join "Media" on "Media".id = elem::uuid
                ) AS "medias",
                JSONB_AGG("Taxes".*)->0 as "productTaxes",
                "Products"."taxId",
                CASE
                    WHEN (("Products"."defaultOptions" is not null and jsonb_array_length("Products"."defaultOptions") > 0)
                    or ("Products"."optionGroups" is not null and json_array_length("Products"."optionGroups") > 0))
                    THEN true ELSE false
                END AS "hasOptions",
                "Media"."url"->>'defaultUrl' as "mediaUrl",
                (
                    SELECT json_agg(json_build_object(
                        'id',"BranchProducts".id,
                        'branchId',"BranchProducts"."branchId",
                        'productId',"BranchProducts"."productId",
                        'price',"BranchProducts"."price",
                        'onHand',
                        CASE
                            WHEN "Products".type = 'serialized'
                                THEN (SELECT count("ProductSerials".id)
                                      FROM "ProductSerials"
                                      WHERE "ProductSerials"."branchProductId" = "BranchProducts".id
                                      AND "ProductSerials"."status" = 'Available')
                            WHEN "Products".type = 'batch'
                                THEN (SELECT count("ProductBatches"."onHand")
                                      FROM "ProductBatches"
                                      WHERE "ProductBatches"."branchProductId" = "BranchProducts".id)
                            ELSE "BranchProducts"."onHand"
                        END
                    ))
                    FROM "BranchProducts"
                    WHERE "BranchProducts"."productId" = "Products".id
                    and "BranchProducts"."branchId" = "Branches".id
                ) AS "branches"
            `;
            groupByQuery += `  , "Branches".id ,"BranchProducts".id ,"Categories"."index" , "Products"."categoryIndex"`;
        }

        if (types.find(f => f == 'service')) {
            selectQuery += `, min("EmployeePrices".price) as "minPrice",
                             max("EmployeePrices".price) as "maxPrice"`
        }

        selectQuery += ` from "Products"`;

        values = [filterId, types, searchValue, tags, departmentId, categoryId, brandId, limit, offset];

        if (priceFilter) {
            filterQuery += `
                AND (("Products"."defaultPrice" >= $10 AND "Products"."defaultPrice" <= $11)
                OR ("BranchProducts"."price" >= $10 AND "BranchProducts"."price" <= $11))
            `;

            values = [filterId, types, searchValue, tags, departmentId, categoryId, brandId, limit, offset, priceFilter.min, priceFilter.max];
        }

        selectQuery += joinQuery + filterQuery + groupByQuery + havingQuery + sortTerm + limitQuery;

        let products = await client.query(selectQuery, values);

        const productIds = products.rows?.length > 0 ? products.rows.map((item: any) => item.id) : null;

        if (productIds && data.branchId) {
            let discounts = await this.getProductDiscounts(client, productIds, branchId, company.id);

            products.rows = products.rows.map((item1: any) => {
                const item2: any = discounts.find(item2 => item2.productId === item1.id);

                if (item2) {
                    item1.discountPercentage = item2.percentage;
                    item1.isDiscountable = true;
                    item1.discountAmount = item2.amount;
                }
                return item1;
            });

            let productsTemp = productIds.map(id => ({ id }));

            let prices = await ShopRepo.getProductPrices(client, productsTemp, data.branchId, [], serviceId);

            if (prices&&prices?.length > 0) {
                products.rows = products.rows.map(p => {
          const price = prices ? prices.find(pp => pp.id == p.id) : null
                              if (price) p.price = price.price;
                    return p;
                });
            }
        }

        let lastIndex = (data.page * data.limit);
        if (products.rows.length < data.limit || data.page == pageCount) {
            lastIndex = count;
        }

        const resData = {
            list: products.rows,
            count,
            pageCount,
            startIndex: offset + 1,
            lastIndex
        };

        await client.query("COMMIT");

        return new ResponseData(true, "", resData);

    } catch (error: any) {
        console.log(error);
        await client.query("ROLLBACK");
        throw new Error(error);
    } finally {
        client.release();
    }
}


    // public static async getCategoriesProducts(data: any, company: Company, types: any[]) {
    //     try {



    //         let companyId = company.id;
    //         let productName = data.searchTerm == null ?null: data.searchTerm 
    //         let tags = data.tags == null ?null: data.tags 
    //         let brands = data.brands ? data.brands : null
    //         let  departmentId  = data.departmentId   ? (data.departmentId).trim()   ? (data.departmentId).trim()   : null : null;
    //         let  categoryId    = data.categoryId     ? (data.categoryId).trim()     ? (data.categoryId).trim()   : null : null;
    //         let  branchId      = data.branchId       ? (data.branchId).trim()       ? (data.branchId).trim()   : null : null;

    //         let priceFrom =  data.priceFilter == null ||  !data.priceFilter.min ? null : data.priceFilter.min
    //         let priceTo =  data.priceFilter == null ||  !data.priceFilter.max ? null : data.priceFilter.max
    //         let count = 0;
    //         let pageCount = 0;
    //         let page = data.page??1
    //         let offset = 0

    //         let sort = data.sort
    //         let sortValue = !sort || !sort ? ' "branches"."createdAt" ' : '"' + sort.sortValue + '"';
    //         let sortTerm = "";
    //         if (sort &&sort.sortValue != null && sort.sortDirection != null) {
    //             let sortDirection = !sort || !sort ? "DESC" : sort.sortDirection;
    //             sortTerm = " ORDER BY " + sortValue + " " + sortDirection;
    //         }



    //         const limit = ((data.limit == null) ? 12 : data.limit);
    //         if (page != 1) {
    //             offset = (limit * (page - 1))
    //         }
    // //         let countQuery={
    // //             text:`with "values" as (
    // //                     select $1 :: uuid as "companyId",
    // //                             $2 ::text as  "productName",
    // //                             $3 ::character varying[] as "tags",
    // //                             $4 ::uuid as "departmentId",
    // //                             $5 ::uuid as "categoryId",
    // //                             $6 ::uuid[] as "brands",
    // //                             $7 ::uuid as  "branchId",
    // //                             $8 ::float as "priceFrom",
    // //                             $9 ::float as "priceTo"

    // //                 ),
    // //                 "count" as  (select 
    // //                     count( distinct "Products".id)
    // //         from "Products"
    // //         LEFT JOIN "Categories" on "Categories".id = "Products"."categoryId"
    // //         LEFT JOIN "Departments" on "Departments".id = "Categories"."departmentId"
    // //         LEFT  JOIN "MenuSectionProduct" on "MenuSectionProduct"."productId" = "Products".id 
    // //         LEFT JOIN "Media" on  "Media".id = "Products"."mediaId"
    // //         LEFT join "Brands" on "Brands".id = "Products"."brandid" 
    // //        left join "BranchProducts" ON "Products".id = "BranchProducts"."productId"

    // //         JOIN "values" ON true
    // //         WHERE  "MenuSectionProduct".id is null
    // //         AND  "Products"."companyId" = "values"."companyId"
    // //        AND "Products"."isDeleted" = false
    // //        AND "BranchProducts"."availableOnline" = true
    // //        AND ( "Products"."type" = any($10) OR ( "Products"."type" = any($10) and "Products"."type" ='package'  and "Products"."package" is not null and "Products"."package"::TEXT <> '[]'))

    // //    and ((("values"."productName"::text) IS NULL) or ((lower("Products".name) ~ lower("values"."productName"))))
    // //    and ((("values"."tags"::character varying[]) IS NULL) or ("Products".tags && "values"."tags"::character varying[] ))
    // //    and ((("values"."departmentId"::uuid) IS NULL) or ("Departments".id = "values"."departmentId"))
    // //    and ((("values"."categoryId"::uuid) IS NULL) or ("Categories".id = "values"."categoryId"))
    // //    and ((("values"."brands"::uuid[]) IS NULL) or ("Brands".id = any ("values"."brands")))
    // //    and   ((("values"."branchId" ::uuid) IS NULL) or ("BranchProducts"."branchId"="values"."branchId"))
    // //    and( (((("values"."priceFrom") IS NULL or "Products"."defaultPrice" >= "values"."priceFrom") AND (("values"."priceTo") IS NULL or "Products"."defaultPrice" <= "values"."priceTo"))) 
    // //    OR  (((("values"."priceFrom") IS NULL or "BranchProducts"."price" >= "values"."priceFrom") AND (("values"."priceTo") IS NULL or "BranchProducts"."price" <= "values"."priceTo")))) 



    // //    ) 

    // //    select * from "count"`,
    // //                 values:[companyId,productName,tags,departmentId,categoryId,brands,branchId,priceFrom,priceTo, types]
    // //             }





    //         let selectQuery={
    //             text:`with "values" as (
    //                 select $1 :: uuid as "companyId",
    //                        $2 ::text as  "productName",
    //                        $3 ::character varying[] as "tags",
    //                        $4 ::uuid as "departmentId",
    //                        $5 ::uuid as "categoryId",
    //                        $6 ::uuid[] as "brands",
    //                        $7 ::uuid as  "branchId",
    //                        $8 ::float as "priceFrom",
    //                        $9 ::float as "priceTo"



    //                 ),
    //                 "products" as  (
    //                     select 
    // 					count(  "Products".id) over(),
    //                     "Products".id,
    //                     "Products".name,
    //                     "Products".description,
    //                     "Products".translation::text,
    //                     "Products"."defaultPrice",
    //                     "Products"."maxItemPerTicket", 
    //                     "Products".type,
    //                     "Media"."url"->>'defaultUrl' as "mediaUrl",
    // 					json_agg(json_build_object('id',"BranchProducts".id,
    //                                                'branchId',"BranchProducts"."branchId",
    //                                                'productId',"BranchProducts"."productId",
    //                                                'price',"BranchProducts"."price",
    //                                                'onHand',"BranchProducts"."onHand")) as "Branches"

    //                      from "Products"
    //                      LEFT JOIN "Categories" on "Categories".id = "Products"."categoryId"
    //                      LEFT JOIN "Departments" on "Departments".id = "Categories"."departmentId"
    //                      LEFT  JOIN "MenuSectionProduct" on "MenuSectionProduct"."productId" = "Products".id 
    //                      LEFT JOIN "Media" on  "Media".id = "Products"."mediaId"
    //                      LEFT join "Brands" on "Brands".id = "Products"."brandid" 
    //                      join "values" on true
    // 					left join "BranchProducts" ON "Products".id = "BranchProducts"."productId" and ((("values"."branchId"::uuid) IS NULL) or ("BranchProducts"."branchId" = "values"."branchId"))
    //                      WHERE  "MenuSectionProduct".id is null
    //                      AND  "Products"."companyId" = "values"."companyId"
    //                     AND "Products"."isDeleted" = false
    //                     AND ( "Products"."type" = any($10) OR ("Products"."type" ='package' and "Products"."package" is not null and "Products"."package"::TEXT <> '[]'))
    //                     and ((("values"."productName"::text) IS NULL) or ((lower("Products".name) ~ lower("values"."productName"::TEXT))))
    //                     and ((("values"."tags"::character varying[]) IS NULL) or ("Products".tags && "values"."tags"::character varying[] ))
    //                     and ((("values"."departmentId"::uuid) IS NULL) or ("Departments".id = "values"."departmentId"))
    //                     and ((("values"."categoryId"::uuid) IS NULL) or ("Categories".id = "values"."categoryId"))
    //                     and ((("values"."brands"::uuid[]) IS NULL) or ("Brands".id = any ("values"."brands")))
    // 					and    ( (((("values"."priceFrom") IS NULL or "Products"."defaultPrice" >= "values"."priceFrom") AND (("values"."priceTo") IS NULL or "Products"."defaultPrice" <= "values"."priceTo"))) 
    //                         OR  (((("values"."priceFrom") IS NULL or "BranchProducts"."price" >= "values"."priceFrom") AND (("values"."priceTo") IS NULL or "BranchProducts"."price" <= "values"."priceTo")))) 

    //                     group by  "Products".id,"Media".id
    // 					limit $11
    //                     offset $12

    //                 ) 
    //                 select * from products

    //                 `,
    //             values:[companyId,productName,tags,departmentId,categoryId,brands,branchId,priceFrom,priceTo,types, limit,offset]
    //         }

    //                 //    let selectCount = await DB.excu.query(countQuery.text , countQuery.values)

    //         let products = await DB.excu.query(selectQuery.text, selectQuery.values)   
    //                         count = Number((<any>products.rows[0]).count)
    //                         pageCount = Math.ceil(count / data.limit)

    //                         console.log(count)




    //         offset += 1
    //         let lastIndex = ((data.page) * data.limit)
    //         if (products.rows.length < data.limit || data.page == pageCount) {
    //             lastIndex = count
    //         }

    //         const resData = {
    //                         list: products.rows,
    //                         count: count,
    //                         pageCount: pageCount,
    //                         startIndex: offset,
    //                         lastIndex: lastIndex
    //                     }
    //         return new ResponseData(true, "", resData)
    //     } catch (error: any) {
    //       
    //         console.log(error)
    //         throw new Error(error)
    //     }
    // }



    public static async getProduct(data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            const productId = data.productId;

            await client.query("BEGIN")
            let type = await ProductRepo.getProductType(client, productId)

            let product;
            let serviceId = null;
            const menuId = data.menuId;
            const sessionId = data.sessionId;
            let cartData = await CartRepo.getRedisCart(company.id, sessionId);
            let cart = new Invoice();
            if (cartData) {
                cart.ParseJson(cartData);
                serviceId = cart.serviceId;
            }
            switch (type) {
                case "kit":
                    product = (await this.getKitProduct(client, productId)).data
                    break;
                case "package":
                    product = (await this.getPackageProduct(client, productId, data.branchId, menuId, serviceId, company.id)).data
                    break;
                case "menuSelection":
                    product = (await this.getMenuSelectionProduct(client, productId, data.branchId)).data
                    break;
                case "menuItem":
                    product = (await this.getMenuItemProduct(client, productId, data.branchId)).data
                    break;
                case "service":
                    product = (await this.getServiceProduct(client, productId)).data
                    break;
                case "tailoring":
                    product = (await this.getTailoringProduct(client, productId, data.branchId)).data
                    break;
                default:
                    product = (await this.getInventoryProduct(client, productId, company.id, data.branchId)).data
                    break;
            }

            if (type != 'tailoring' || type != 'service') {


                let filterId = data.branchId ? data.branchId : company.id;
                let filter = ` WHERE "BranchProducts"."productId" = $1`
                filter += data.branchId ? ` AND "BranchProducts"."branchId"=$2 ` : ` AND "Branches"."companyId"=$2 `
                let groupByQuery = ` GROUP BY "Branches".id ,"BranchProducts".id `
                let query = `SELECT
                            "Branches".name ,
                            "Branches".id as "branchId",
                            case when $3 = 'serialized' then count("ProductSerials".serial) 
                            else case when $3 = 'batch' then sum("ProductBatches"."onHand")
                            else "BranchProducts"."onHand" end end as "onHand" ,
                            "BranchProducts".price
                        FROM "BranchProducts" 
                        INNER JOIN "Branches" on "Branches".id = "BranchProducts"."branchId"
                        LEFT JOIN "ProductSerials" on "ProductSerials"."branchProductId"  = "BranchProducts".id and "ProductSerials"."status" = 'Available'
                        LEFT JOIN  "ProductBatches" on "ProductBatches"."branchProductId"  = "BranchProducts".id
                        
                        `

                query += filter + groupByQuery;
                let values = [productId, filterId, type]

                const branches = await client.query(query, values);
                if (product != null || product != undefined) {
                    product.branchProduct = branches.rows
                }
            } else {
                product.branchProduct = []
            }
            if (data.branchId || cart.branchId) {

                const branchId = data.branchId ? data.branchId : cart.branchId
                if (productId && branchId != null && branchId != "") {
                    let discounts = await this.getProductDiscounts(client, [productId], branchId, company.id)
                    if (discounts && discounts.length > 0) {
                        product.isDiscountable = true;
                        product.discountPercentage = discounts[0].percentage;
                        product.discountAmount = discounts[0].amount
                    }
                }
                let prices = await ShopRepo.getProductPrices(client, [{ id: productId, menuId: menuId }], branchId, menuId ? [menuId] : [], cart.serviceId)
                if (prices && prices.length > 0) {
                    product.price = prices[0].price
                }



                if (product?.optionGroups?.length) {

                    product.optionGroups = await Promise.all(
                        product.optionGroups.map(async (optionGroup: any) => {

                            if (optionGroup.options?.length) {

                                const optionIds = optionGroup.options.map((m: any) => ({
                                    id: m.optionId
                                }));

                                const prices = await ShopRepo.getOptionPrices(
                                    client,
                                    optionIds,
                                    branchId,
                                    menuId ? [menuId] : [],
                                    cart.serviceId
                                );

                                if (prices?.length) {
                                    const priceMap = new Map(prices.map((p: any) => [p.id, p]));

                                    optionGroup.options = optionGroup.options.map((option: any) => {
                                        const optionPrice = priceMap.get(option.optionId);
                                        if (optionPrice && optionPrice.price) {
                                            option.optionPrice = optionPrice.price;
                                        }
                                        return option;
                                    });
                                }
                            }

                            return optionGroup; // ✅ REQUIRED
                        })
                    );
                }
                if (product?.defaultOptions?.length) {
                    const optionIds = product.defaultOptions.map((m: any) => ({ id: m.optionId }));

                    const prices = await ShopRepo.getOptionPrices(
                        client,
                        optionIds,
                        branchId,
                        menuId ? [menuId] : [],
                        cart.serviceId
                    );

                    if (prices?.length) {
                        const priceMap = new Map(prices.map((p: any) => [p.id, p]));

                        product.defaultOptions = product.defaultOptions.map((option: any) => {
                            const optionPrice = priceMap.get(option.optionId);
                            if (optionPrice && optionPrice.price) {
                                option.optionPrice = optionPrice.price;
                            }
                            return option;
                        });
                    }
                }


            }

            await client.query("COMMIT")

            return new ResponseData(true, "", product)
        } catch (error: any) {
            await client.query("ROLLBACK")


            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async getKitProduct(client: PoolClient, productId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `select 
                "Products".id,
                "Products".name,
                "Products"."defaultPrice",
                "Products".description,
                "Products".translation,
                "Products".warning,
                 "Products"."taxId",
                 "Products"."threeDModelId",
                 "3dMedia".url->>'downloadUrl' as "threeDModelUrl",
                      (
            select
            

                   json_agg(jsonb_build_object('id', "Media".id,'defaultUrl',"Media"."url"->>'defaultUrl', '3dUrl',"Media"."url"->>'downloadUrl' )) as "productMedia"

            from  json_array_elements_text("Products"."productMedia") AS elem
            inner join "Media" on "Media".id  =elem::uuid

        
            ) AS "medias",
                "Products".type,
                    "Products"."priceModel",
                "Products"."maxItemPerTicket",
                "Products"."alternativeProducts",
                    JSONB_AGG("Taxes".*)->0 as "productTaxes",
                "Products"."UOM",
                "Brands".name as "brandName",
                "Products"."productAttributes", 
                            "Products"."comparePriceAt",
                "Media".url->'defaultUrl' as "mediaUrl",
                json_agg(json_build_object('productId',("kitBuilderData"."kitBuilder"->>'productId')::uuid,
                                           'productName',"kitProducts".name,
                                            'qty',("kitBuilderData"."kitBuilder"->>'qty')::real,
                                            'mediaUrl',"kitMedias".url->>'defaultUrl')) as "kitBuilder"					  
              FROM "Products"
              CROSS JOIN LATERAL JSON_ARRAY_ELEMENTS("Products"."kitBuilder") AS "kitBuilderData"("kitBuilder")
              INNER JOIN "Products" "kitProducts" on  "kitProducts".id = ("kitBuilderData"."kitBuilder"->>'productId')::uuid
              LEFT JOIN "Media" "kitMedias" on "kitMedias".id = "kitProducts"."mediaId"
              LEFT JOIN "Media" on "Media".id = "Products"."mediaId"
              			  LEFT JOIN "Media" as  "3dMedia" on "3dMedia".id = "Products"."threeDModelId" AND "3dMedia"."contentType" = 'model'

              LEFT JOIN "Brands" on "Brands".id = "Products"."brandid" 
                          LEFT JOIN "Taxes" on "Taxes".id = "Products"."taxId"
              WHERE "Products".id =$1
              GROUP BY "Products".id , "Media".id,    "Brands".name , "3dMedia".id`,
                values: [productId]
            }

            let product = await client.query(query.text, query.values)

            return new ResponseData(true, "", product.rows[0])
        } catch (error: any) {


            throw new Error(error)
        }
    }
    public static async getPackageProduct(client: PoolClient, productId: string, branchId: string | null, menuId: string | null, serviceId: string | null, companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `select 
                "Products".id,
                "Products".name,
                "Products"."defaultPrice",
                "Products".description,
                "Products".translation,
                "Products".warning,
                "Products".type,
                "Products"."threeDModelId",
                "3dMedia".url->>'downloadUrl' as "threeDModelUrl",
                     (
            select
            

                   json_agg(jsonb_build_object('id', "Media".id,'defaultUrl',"Media"."url"->>'defaultUrl', '3dUrl',"Media"."url"->>'downloadUrl')) as "productMedia"

            from  json_array_elements_text("Products"."productMedia") AS elem
            inner join "Media" on "Media".id  =elem::uuid

        
            ) AS "medias",
                          "Products"."taxId",
                "Products"."maxItemPerTicket",
                "Products"."alternativeProducts",
                "Products"."UOM",
                "Brands".name as "brandName",
                "Products"."productAttributes", 
                "Products"."comparePriceAt",
                       "Products"."priceModel", 
                           JSONB_AGG("Taxes".*)->0 as "productTaxes",
                "Media".url->'defaultUrl' as "mediaUrl",
               (select  json_agg(json_build_object('productId',("packageData"."package"->>'productId')::uuid,
                                           'productName',"packageProducts".name,
                                            'qty',("packageData"."package"->>'qty')::real,
                                            'mediaUrl',"packageMedias".url->>'defaultUrl')) as "package"	
                                  from JSON_ARRAY_ELEMENTS("Products"."package") AS "packageData"("package")
              INNER JOIN "Products" "packageProducts" on  "packageProducts".id = ("packageData"."package"->>'productId')::uuid
              inner JOIN "BranchProducts" "BranchProductsPackage" on  "BranchProductsPackage"."productId"= "packageProducts".id and "BranchProductsPackage"."branchId" = $2 and "availableOnline" = true
              and ("packageProducts"."type" NOT IN  ('inventory','kit')  or( "packageProducts"."type" in ('inventory','kit') and "BranchProductsPackage"."onHand" > 0))
              LEFT JOIN "Media" "packageMedias" on "packageMedias".id = "packageProducts"."mediaId"

              ) as "package"
              FROM "Products"
              LEFT JOIN "Media" on "Media".id = "Products"."mediaId"
              left JOIN "Media" as  "3dMedia" on "3dMedia".id = "Products"."threeDModelId" AND "3dMedia"."contentType" = 'model'
              LEFT JOIN "Brands" on "Brands".id = "Products"."brandid" 
                          LEFT JOIN "Taxes" on "Taxes".id = "Products"."taxId"
              WHERE "Products".id =$1
              GROUP BY "Products".id , "Media".id,    "Brands".name, "3dMedia".id`,
                values: [productId, branchId]
            }

            let product = await client.query(query.text, query.values)
            if (product.rows.length > 0 && product.rows[0] && product.rows[0].package) {
                let packageProducts: any[] = product.rows[0].package;
                let packageIds: any[] = [];

                packageProducts.forEach((element: any) => {
                    packageIds.push(element.productId)
                });

                query.text = `SELECT "Products" .id,
                      "Products"."taxId",
                           (
            select
            

                   json_agg(jsonb_build_object('id', "Media".id,'defaultUrl',"Media"."url"->>'defaultUrl')) as "productMedia"

            from  json_array_elements_text("Products"."productMedia") AS elem
            inner join "Media" on "Media".id  =elem::uuid

        
            ) AS "medias",
                          JSONB_AGG("Taxes".*)->0 as "productTaxes",
                                CASE
                            WHEN json_array_length("optionGroups") > 0 THEN json_agg(
                                json_build_object(
                                    'index', ("optionGroup"->>'index'),
                                    'title', "OptionGroups".title,
                                    'alias',  "OptionGroups".alias,
                                    'translation', "OptionGroups"."translation",
                                    'optionGroupId', "OptionGroups".id,
                                    'minSelectable',"OptionGroups"."minSelectable",
                                    'maxSelectable',"OptionGroups"."maxSelectable",
                                    'options', (
                                        SELECT json_agg(
                                            json_build_object(
                                                'optionName', ("Options".name),
                                                'translation', ("Options"."translation"),
                                                'optionId', ("Options".id),
                                                'optionPrice', ("Options".price)
                                            )
                                        )
                                        FROM json_array_elements("OptionGroups"."options") AS elem 
                                        left join jsonb_array_elements("onlineExcludedOptions") as t1 on (t1->>'optionId')::uuid = (elem->>'optionId')::uuid and (t1->>'pauseUntil' is null or CURRENT_TIMESTAMP < (t1->>'pauseUntil')::TIMESTAMP)
                                        INNER JOIN "Options" ON "Options".id = (elem->>'optionId')::uuid and  (($2::uuid is null) or COALESCE(t1->>'optionId' is null, true))
										 where NOT ( $2::uuid  is not null and $2::uuid = ANY(select "excludedId"::uuid FROM JSONb_ARRAY_ELEMENTs_TEXT("Options"."excludedBranches") "excludedId"))

                                    )
                                )
                            )
                        END AS "optionGroups"
                        from "Products" 
						 left join "BranchProducts" ON  "BranchProducts"."productId" = "Products".id and (($2::uuid is not null) and  "BranchProducts"."branchId" = $2::uuid)
						       JOIN json_array_elements("Products"."optionGroups") AS "optionGroup" ON TRUE
                    LEFT JOIN "OptionGroups" ON "OptionGroups".id = ("optionGroup"->>'optionGroupId')::uuid
                                LEFT JOIN "Taxes" on "Taxes".id = "Products"."taxId"
                        where "Products".id = any($1)
                        group by "Products" .id 
                        `
                query.values = [packageIds, branchId]


                let packageItmesFetch = await client.query(query.text, query.values);
                let packageItmes = packageItmesFetch.rows && packageItmesFetch.rows.length > 0 ? packageItmesFetch.rows : []
                if (packageItmes.length > 0 && product.rows && product.rows.length > 0 && product.rows[0].package && branchId) {


                    const productIds = product.rows[0].package.map((pro: any) => pro.id)
                    let discounts = await this.getProductDiscounts(client, productIds, branchId, companyId)

                    if (discounts) {

                        product.rows[0].package = product.rows[0].package.map((pro: any) => {
                            let discount = discounts.find(f => f.productId == pro.id)
                            if (discount) {

                                pro.isDiscountable = true;
                                pro.discountPercentage = discount.percentage;
                                pro.discountAmount = discount.amount

                            }
                            return pro
                        })
                    }
                    const productPricesIds = product.rows[0].package.map((pro: any) => { return { id: pro.productId, menuId: menuId } })
                    let prices = await ShopRepo.getProductPrices(client, productPricesIds, branchId, menuId ? [menuId] : [], serviceId)
                    if (prices) {
                        product.rows[0].package = product.rows[0].package.map((pro: any) => {
                            let price = prices ? prices.find(f => f.id == pro.productId) : null
                            if (price) {
                                pro.price = price.price
                            }
                            return pro
                        })
                    }

                    product.rows[0].package = product.rows[0].package.map((f: any) => {
                        let product = packageItmes.find((item: any) => item.id == f.productId);
                        if (product) {
                            f.optionGroups = product.optionGroups

                        }
                        return f
                    })
                    product.rows[0].package = await Promise.all(
                        product.rows[0].package.map(async (pro: any) => {

                            if (pro?.optionGroups?.length) {

                                pro.optionGroups = await Promise.all(
                                    pro.optionGroups.map(async (optionGroup: any) => {

                                        if (optionGroup.options?.length) {

                                            const optionIds = optionGroup.options.map((m: any) => ({
                                                id: m.optionId
                                            }));

                                            const prices = await ShopRepo.getOptionPrices(
                                                client,
                                                optionIds,
                                                branchId,
                                                menuId ? [menuId] : [],
                                                serviceId
                                            );

                                            if (prices?.length) {
                                                const priceMap = new Map(prices.map((p: any) => [p.id, p]));

                                                optionGroup.options = optionGroup.options.map((option: any) => {
                                                    const optionPrice = priceMap.get(option.optionId);
                                                    if (optionPrice && optionPrice.price) {
                                                        option.optionPrice = optionPrice.price;
                                                    }
                                                    return option;
                                                });
                                            }
                                        }

                                        return optionGroup;
                                    })
                                );
                            }

                            if (pro?.defaultOptions?.length) {
                                const optionIds = pro.defaultOptions.map((m: any) => ({ id: m.optionId }));

                                const prices = await ShopRepo.getOptionPrices(
                                    client,
                                    optionIds,
                                    branchId,
                                    menuId ? [menuId] : [],
                                    serviceId
                                );

                                if (prices?.length) {
                                    const priceMap = new Map(prices.map((p: any) => [p.id, p]));

                                    pro.defaultOptions = pro.defaultOptions.map((option: any) => {
                                        const optionPrice = priceMap.get(option.optionId);
                                        if (optionPrice && optionPrice.price) {
                                            option.optionPrice = optionPrice.price;
                                        }
                                        return option;
                                    });
                                }
                            }

                            return pro;
                        })
                    );
                }

            }


            return new ResponseData(true, "", product.rows[0])
        } catch (error: any) {


            throw new Error(error)
        }
    }
    public static async getMenuSelectionProduct(client: PoolClient, productId: string, branchId: string | null) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT 
                "Products".id,
                "Products".name,
                "Products"."defaultPrice",
                "Products".description,
                "Products".translation,
                "Products".warning,
                "Products".type,
                        "3dMedia".url->>'downloadUrl' as "threeDModelUrl",
                     (
            select
            

                   json_agg(jsonb_build_object('id', "Media".id,'defaultUrl',"Media"."url"->>'defaultUrl', '3dUrl',"Media"."url"->>'downloadUrl')) as "productMedia"

            from  json_array_elements_text("Products"."productMedia") AS elem
            inner join "Media" on "Media".id  =elem::uuid

        
            ) AS "medias",
                    JSONB_AGG("Taxes".*)->0 as "productTaxes",
                          "Products"."taxId",
                "Products"."maxItemPerTicket",
                "Products"."alternativeProducts",
                "Products"."UOM",
                "Products"."productAttributes", 
                   "Products"."priceModel", 
                "Products"."comparePriceAt",
                "Media".url->'defaultUrl' as "mediaUrl",
                "Brands".name as "brandName",
                json_agg(
                  json_build_object(
                    'index', ("selectionData"."selection"->'index'),
                     'name', ("selectionData"."selection"->'name'),
                    'noOfSelection', ("selectionData"."selection"->'noOfSelection'),
                    'items', items_agg
                  )
                ) as "selection"				  
              FROM "Products"
              CROSS JOIN LATERAL JSON_ARRAY_ELEMENTS("Products"."selection") AS "selectionData"("selection")
              CROSS JOIN LATERAL (
                SELECT json_agg(
                    json_build_object(
                      'index', "selectionItemData"."selectionItem"->'index',
                      'productId', "selectionItemData"."selectionItem"->'productId',
                      'productName', "selectionProducts".name,
                            'translation', "selectionProducts"."translation",
                      'mediaUrl', "selectionMedia".url->'defaultUrl'
                    )
                ) AS items_agg
                FROM JSON_ARRAY_ELEMENTS("selectionData"."selection"->'items') AS "selectionItemData"("selectionItem")
                INNER JOIN "Products" "selectionProducts" ON "selectionProducts".id = ("selectionItemData"."selectionItem"->>'productId')::uuid
                 INNER JOIN "BranchProducts" "BranchProductsPackage" on  "BranchProductsPackage"."productId"= "selectionProducts".id and "BranchProductsPackage"."branchId" = $2 and "availableOnline" = true
                 and ("selectionProducts"."type" NOT IN  ('inventory','kit')  or( "selectionProducts"."type" in ('inventory','kit') and "BranchProductsPackage"."onHand" > 0))
                LEFT JOIN "Media" "selectionMedia" ON "selectionMedia".id = "selectionProducts"."mediaId"
              ) AS "selectionItems"
              LEFT JOIN "Media" ON "Media".id = "Products"."mediaId"
              LEFT JOIN "Brands" on "Brands".id = "Products"."brandid" 
                          LEFT JOIN "Taxes" on "Taxes".id = "Products"."taxId"
                          						                left JOIN "Media" as  "3dMedia" on "3dMedia".id = "Products"."threeDModelId" AND "3dMedia"."contentType" = 'model'

              WHERE "Products".id =$1
              GROUP BY "Products".id, "Media".id,    "Brands".name, "3dMedia".id`,
                values: [productId, branchId]
            }

            let product = await client.query(query.text, query.values)

            return new ResponseData(true, "", product.rows[0])
        } catch (error: any) {


            throw new Error(error)
        }
    }
    public static async getMenuItemProduct(client: PoolClient, productId: string, branchId: string | null) {
        try {





            const query: { text: string, values: any } = {
                text: `WITH "OptionGroupsData" AS (
                    SELECT  
                        "Products".id AS "productId",
                                  "Products"."taxId",
                          
                        CASE
                            WHEN json_array_length("optionGroups") > 0 THEN json_agg(
                                json_build_object(
                                    'index', ("optionGroup"->>'index'),
                                    'title', "OptionGroups".title,
                                    'alias',  "OptionGroups".alias,
                                    'translation', "OptionGroups"."translation",
                                    'optionGroupId', "OptionGroups".id,
                                    'minSelectable',"OptionGroups"."minSelectable",
                                    'maxSelectable',"OptionGroups"."maxSelectable",
                                    'options',  (
                                        SELECT  case when count("Options".id) > 0 then  json_agg(
                                          json_build_object(
                                                'optionName', ("Options".name),
                                                'translation', ("Options"."translation"),
                                                'translation', ("Options"."translation"),
                                                'mediaUrl', ("Media".url->'defaultUrl'),
                                                'optionId', ("Options".id),
                                                'optionPrice', ("Options".price),
                                                'index',( (elem->>'index'))::int
                                            )  
                                        ) end
                                        FROM json_array_elements("OptionGroups"."options") AS elem 
                                        left join jsonb_array_elements("onlineExcludedOptions") as t1 on (t1->>'optionId')::uuid = (elem->>'optionId')::uuid and (t1->>'pauseUntil' is null or CURRENT_TIMESTAMP < (t1->>'pauseUntil')::TIMESTAMP)
                                        left JOIN "Options" ON "Options".id = (elem->>'optionId')::uuid and  (($2::uuid is null) or COALESCE(t1->>'optionId' is null, true)) and ("Options"."isDeleted" = false or "Options"."isDeleted" is null) 
										  
                                        left join "Media" on "Media".id = "Options"."mediaId"
                                        where "Options".id is not null 
                                                                                AND NOT ( $2::uuid  is not null and $2::uuid = ANY(select "excludedId"::uuid FROM JSONb_ARRAY_ELEMENTs_TEXT("Options"."excludedBranches") "excludedId"))

                                    )
                                )
                            )
                        END AS "optionGroups"
                        
                    FROM "Products"
                    left join "BranchProducts" ON  "BranchProducts"."productId" = "Products".id and (($2::uuid is not null) and  "BranchProducts"."branchId" = $2::uuid)
                    JOIN json_array_elements("Products"."optionGroups") AS "optionGroup" ON TRUE
                    LEFT JOIN "OptionGroups" ON "OptionGroups".id = ("optionGroup"->>'optionGroupId')::uuid
           
                    WHERE "Products".id = $1
                    GROUP BY "Products".id
                )
                SELECT 
                    "Products".id,
                    "Products".name,
                    "Products"."defaultPrice",
                    "Products".description,
                    "Products".translation,
                    "Products".warning,
                    "Products".type,
                    JSONB_AGG("Taxes".*)->0 as "productTaxes",
                    "Products"."maxItemPerTicket",
                    "Products"."alternativeProducts",
                    "Products"."UOM",
					(
                        SELECT  case when count("Options".id) > 0 then  json_agg(
                                          json_build_object(
                                                'optionName', ("Options".name),
                                                'translation', ("Options"."translation"),
                                                'translation', ("Options"."translation"),
                                                'mediaUrl', ("Media".url->'defaultUrl'),
                                                'optionId', ("Options".id),
                                                'optionPrice', ("Options".price),
                                                'index',( (elem->>'index'))::int,
                                                'qty', ( (elem->>'qty'))::float
                                            )  
                                        ) end  as "defaultOptions"
                                        FROM jsonb_array_elements("Products"."defaultOptions") AS elem 
                                      left join "BranchProducts" ON  "BranchProducts"."productId" = "Products".id and (($2::uuid is not null) and  "BranchProducts"."branchId" = $2::uuid)
                                        left join jsonb_array_elements("onlineExcludedOptions") as t1 on (t1->>'optionId')::uuid = (elem->>'optionId')::uuid and (t1->>'pauseUntil' is null or CURRENT_TIMESTAMP < (t1->>'pauseUntil')::TIMESTAMP)
                                        left JOIN "Options" ON "Options".id = (elem->>'optionId')::uuid and  (($2::uuid is null) or COALESCE(t1->>'optionId' is null, true)) and ("Options"."isDeleted" = false or "Options"."isDeleted" is null) 
										  
                                        left join "Media" on "Media".id = "Options"."mediaId"
                                        where "Options".id is not null 
                                        AND NOT ( $2::uuid  is not null and $2::uuid = ANY(select "excludedId"::uuid FROM JSONb_ARRAY_ELEMENTs_TEXT("Options"."excludedBranches") "excludedId"))

                        ) AS "defaultOptions",
                         (
            select
            

                   json_agg(jsonb_build_object('id', "Media".id,'defaultUrl',"Media"."url"->>'defaultUrl', '3dUrl',"Media"."url"->>'downloadUrl')) as "productMedia"

            from  json_array_elements_text("Products"."productMedia") AS elem
            inner join "Media" on "Media".id  =elem::uuid

        
            ) AS "medias",
                    "Brands".name as "brandName",
                              "Products"."taxId",
                    "Products"."productAttributes", 
                    "Products"."comparePriceAt",
                           "Products"."priceModel", 
                           "Products"."threeDModelId",
                    "3dMedia".url->>'downloadUrl' as "threeDModelUrl",
                    "Media".url->'defaultUrl' AS "mediaUrl",
                    (SELECT json_agg(elem) FROM "OptionGroupsData", json_array_elements("optionGroups")as elem where elem->>'options' is not null ) AS "optionGroups"
                FROM "Products"
                LEFT JOIN "OptionGroupsData" ON "OptionGroupsData"."productId" = "Products".id
                LEFT JOIN "Options" ON "Options".id = ANY(SELECT DISTINCT elem::uuid FROM json_array_elements_text("Products"."quickOptions") AS elem)
                LEFT JOIN "Media" ON "Media".id = "Products"."mediaId"
                LEFT JOIN "Media" as  "3dMedia" on "3dMedia".id = "Products"."threeDModelId" AND "3dMedia"."contentType" = 'model'
                     LEFT JOIN "Taxes" on "Taxes".id = "Products"."taxId"
                LEFT JOIN "Brands" on "Brands".id = "Products"."brandid" 
                           
                WHERE "Products".id = $1
                GROUP BY "Products".id, "Media".id ,   "Brands".name , "3dMedia".id`,
                values: [productId, branchId]
            }

            let product = await client.query(query.text, query.values)


            return new ResponseData(true, "", product.rows[0])
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async getServiceProduct(client: PoolClient, productId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT  
                        "Products".id,
                        "Products".name,
                        "Products"."defaultPrice",
                        "Products".description,
                        "Products".translation,
                        "Products".warning,
                        "Products"."taxId",
                        JSONB_AGG("Taxes".*)->0 as "productTaxes",
                        "Products".type,
                        "Products"."maxItemPerTicket",
                        "Products"."alternativeProducts",
                        "Products"."UOM",
                        "Brands".name as "brandName",
                        "Products"."productAttributes",
                        "Products"."threeDModelId",
                        "3dMedia".url->>'downloadUrl' as "threeDModelUrl",
                             (
            select
            

                   json_agg(jsonb_build_object('id', "Media".id,'defaultUrl',"Media"."url"->>'defaultUrl', '3dUrl',"Media"."url"->>'downloadUrl')) as "productMedia"

            from  json_array_elements_text("Products"."productMedia") AS elem
            inner join "Media" on "Media".id  =elem::uuid

        
            ) AS "medias", 
                        "Products"."comparePriceAt",
                        "Media".url->'defaultUrl' as "mediaUrl",
                        json_agg(json_build_object('employeeName',"Employees".name,
                                                    'price',"EmployeePrices".price,
                                                    'employeeId',"Employees".id,
                                                    'mediaUrl' , "employeeMedia".url->'defaultUrl'
                                            )) as "employeePrices"	
                        FROM "Products"
                        LEFT JOIN "Media" on "Media".id = "Products"."mediaId"
                        LEFT JOIN "Media" as  "3dMedia" on "3dMedia".id = "Products"."threeDModelId" AND "3dMedia"."contentType" = 'model'
                        LEFT JOIN "EmployeePrices" on "EmployeePrices"."productId" =  "Products".id
                        LEFT JOIN "Employees" on "EmployeePrices"."employeeId" =  "Employees".id 
                        LEFT JOIN "Media" "employeeMedia" on "employeeMedia".id = "Employees"."mediaId"
                        LEFT JOIN "Brands" on "Brands".id = "Products"."brandid" 
                                    LEFT JOIN "Taxes" on "Taxes".id = "Products"."taxId"
                        where "Products".id =$1
                        GROUP BY "Products".id , "Media".id,   "Brands".name, "3dMedia".id`,
                values: [productId]
            }

            let product = await client.query(query.text, query.values)

            return new ResponseData(true, "", product.rows[0])
        } catch (error: any) {


            throw new Error(error)
        }
    }
    public static async getInventoryProduct(client: PoolClient, productId: string, companyId: string, branchId: string) {
        try {

            if (!branchId) {
                let defaultBranch: any = await BranchesRepo.getDefaultEcommerceBranch(companyId, client)
                branchId = defaultBranch.branch.id
            }
            const query: { text: string, values: any } = {
                text: `select 
                "Products".id,
                "Products".name,
                "Products"."defaultPrice",
                "Products".description,
                "Products".translation,
                "Products".warning,
                "Products".type,
                JSONB_AGG("Taxes".*)->0 as "productTaxes",
                "Products"."taxId",
                "Products"."maxItemPerTicket",
                "Products"."UOM",
                "Products"."sku",
                "ProductMatrix".barcode as "matrixBarcode",
                "ProductMatrix".name as "matrixName",
                                 (
            select
            

                   json_agg(jsonb_build_object('id', "Media".id,'defaultUrl',"Media"."url"->>'defaultUrl', '3dUrl',"Media"."url"->>'downloadUrl')) as "productMedia"

            from  json_array_elements_text("Products"."productMedia") AS elem
            inner join "Media" on "Media".id  =elem::uuid

        
            ) AS "medias", 
                "ProductMatrix".dimensions,
                (select
                jsonb_agg(jsonb_build_object('id',prod.id, 'name',prod.name, 'sku',prod.sku,'price', prod."defaultPrice", 
                'attributes', elem->'attributes', 'mediaUrl', "Media"."url"->>'defaultUrl',
                'inventory', jsonb_build_object('branchId', "BranchProducts"."branchId", 'onHand', "BranchProducts"."onHand", 'price', "BranchProducts"."price") )) 
                from  jsonb_array_elements( "ProductMatrix".products ) AS elem
                inner join "Products"  prod on prod.id =((elem->>'productId')::uuid ) and prod."isDeleted" = false
				join "BranchProducts" on "prod".id = "BranchProducts"."productId" and "branchId" = $2::uuid and "BranchProducts"."availableOnline" = true
                left join "Media" on "Media".id = COALESCE( "prod"."mediaId" ,"ProductMatrix"."mediaId" ) 
                ) AS "variants", 

                "Products"."alternativeProducts",
                "Brands".name as "brandName",
                "Products"."productAttributes", 
                "Products"."comparePriceAt",
                "Media".url->'defaultUrl' as "mediaUrl"	,
				"Products"."threeDModelId",
				"3dMedia"."url"->>'downloadUrl' as "threeDModelUrl"
              FROM "Products"
          
			  LEFT JOIN "Media" as  "3dMedia" on "3dMedia".id = "Products"."threeDModelId" AND "3dMedia"."contentType" = 'model'
              LEFT JOIN "Brands" on "Brands".id = "Products"."brandid" 
              LEFT JOIN "Taxes" on "Taxes".id = "Products"."taxId"
              LEFT JOIN "ProductMatrix" on  "Products"."productMatrixId" = "ProductMatrix"."id"
            LEFT JOIN "Media" on "Media".id = COALESCE(  "Products"."mediaId" ,"ProductMatrix"."mediaId" ) 
              WHERE "Products".id =$1
              GROUP BY "Products".id , "Media".id, "Brands".name , "3dMedia".id, "ProductMatrix".id`,
                values: [productId, branchId]
            }

            let records = await client.query(query.text, query.values)
            let product: any

            if (records.rows && records.rows.length > 0) {
                product = records.rows[0]
                if (product.matrixBarcode) {
                    product.index = MatrixRepo.createVariantIndex(product.dimensions, product.variants)
                }

            }

            return new ResponseData(true, "", product)
        } catch (error: any) {


            throw new Error(error)
        }
    }


    public static async getTailoringProduct(client: PoolClient, productId: string, branchId: string) {
        try {





            const query: { text: string, values: any } = {
                text: `WITH "OptionGroupsData" AS (
                    SELECT  
                        "Products".id AS "productId",
                                  "Products"."taxId",
                          
                        CASE
                            WHEN json_array_length("optionGroups") > 0 THEN json_agg(
                                json_build_object(
                                    'index', ("optionGroup"->>'index'),
                                    'title', "OptionGroups".title,
                                    'alias',  "OptionGroups".alias,
                                    'translation', "OptionGroups"."translation",
                                    'optionGroupId', "OptionGroups".id,
                                    'minSelectable',"OptionGroups"."minSelectable",
                                    'maxSelectable',"OptionGroups"."maxSelectable",
                                    'options',  (
                                        SELECT  case when count("Options".id) > 0 then  json_agg(
                                            json_build_object(
                                                'optionName', ("Options".name),
                                                'translation', ("Options"."translation"),
                                                'translation', ("Options"."translation"),
                                                'mediaUrl', ("Media".url->'defaultUrl'),
                                                'optionId', ("Options".id),
                                                'optionPrice', ("Options".price),
                                                'index',( (elem->>'index'))::int
                                            )  
                                        ) end
                                        FROM json_array_elements("OptionGroups"."options") AS elem 
                                        left join jsonb_array_elements("onlineExcludedOptions") as t1 on (t1->>'optionId')::uuid = (elem->>'optionId')::uuid and (t1->>'pauseUntil' is null or CURRENT_TIMESTAMP < (t1->>'pauseUntil')::TIMESTAMP)
                                        left JOIN "Options" ON "Options".id = (elem->>'optionId')::uuid and  (($2::uuid is null) or COALESCE(t1->>'optionId' is null, true)) and ("Options"."isDeleted" = false or "Options"."isDeleted" is null) 
										  
                                        left join "Media" on "Media".id = "Options"."mediaId"
                                      where NOT ( $2::uuid  is not null and $2::uuid = ANY(select "excludedId"::uuid FROM JSONb_ARRAY_ELEMENTs_TEXT("Options"."excludedBranches") "excludedId"))

                                    )
                                )
                            )
                        END AS "optionGroups"
                    FROM "Products"
                    left join "BranchProducts" ON  "BranchProducts"."productId" = "Products".id and (($2::uuid is not null) and  "BranchProducts"."branchId" = $2::uuid)
                    JOIN json_array_elements("Products"."optionGroups") AS "optionGroup" ON TRUE
                    LEFT JOIN "OptionGroups" ON "OptionGroups".id = ("optionGroup"->>'optionGroupId')::uuid
            
                    WHERE "Products".id = $1
                    GROUP BY "Products".id
                )
                SELECT 
                    "Products".id,
                    "Products".name,
                    "Products"."defaultPrice",
                    "Products".description,
                    "Products".translation,
                    "Products".warning,
                    "Products".type,
                    JSONB_AGG("Taxes".*)->0 as "productTaxes",
                    "Products"."maxItemPerTicket",
                    "Products"."alternativeProducts",
                    "Products"."UOM",
                         (
            select
            

                   json_agg(jsonb_build_object('id', "Media".id,'defaultUrl',"Media"."url"->>'defaultUrl', '3dUrl',"Media"."url"->>'downloadUrl')) as "productMedia"

            from  json_array_elements_text("Products"."productMedia") AS elem
            inner join "Media" on "Media".id  =elem::uuid

        
            ) AS "medias",
                    "Brands".name as "brandName",
                    "Products"."taxId",
                    "Products"."productAttributes", 
                    "Products"."comparePriceAt",
                    "Products"."priceModel", 
                    "Products"."measurements", 
                    "Media".url->'defaultUrl' AS "mediaUrl",
                    "Products"."threeDModelId",
                    "3dMedia".url->>'downloadUrl' as "threeDModelUrl",
                    (SELECT json_agg(elem) FROM "OptionGroupsData", json_array_elements("optionGroups")as elem where elem->>'options' is not null ) AS "optionGroups"
                FROM "Products"
                LEFT JOIN "OptionGroupsData" ON "OptionGroupsData"."productId" = "Products".id
                LEFT JOIN "Options" ON "Options".id = ANY(SELECT DISTINCT elem::uuid FROM json_array_elements_text("Products"."quickOptions") AS elem)
                LEFT JOIN "Media" ON "Media".id = "Products"."mediaId"
                LEFT JOIN "Media" as  "3dMedia" on "3dMedia".id = "Products"."threeDModelId" AND "3dMedia"."contentType" = 'model'
                     LEFT JOIN "Taxes" on "Taxes".id = "Products"."taxId"
                LEFT JOIN "Brands" on "Brands".id = "Products"."brandid" 
                           
                WHERE "Products".id = $1
                GROUP BY "Products".id, "Media".id ,   "Brands".name, "3dMedia".id `,
                values: [productId, branchId]
            }

            let product = await client.query(query.text, query.values)

            return new ResponseData(true, "", product.rows[0])
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async getaAlternativeProducts(data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            const productId = data.productId;
            const branchId = data.branchId;

            let companyOptions = await CompanyRepo.getCompanyWebsiteOptions(client, company.id);
            let hideOutOfStocks = false
            if (companyOptions.success && companyOptions.data) {
                hideOutOfStocks = companyOptions.data.hideOutOfStocks
            }
            let havingQuery = ``;
            let groupBy = ''
            if (branchId) {
                havingQuery = `     having  (${hideOutOfStocks} = false ) or (${hideOutOfStocks}  = true and "Products"."type" = any (array['inventory','batch','serialized','kit']) and ("BranchProducts"."onHand" >0) or count("ProductSerials".id) >0 or sum( "ProductBatches"."onHand") >0 ) 
                or ("Products"."type" = any (array['service','menuItem','menuSelection','package']))`
                groupBy = ' Group by "Products".id ,"BranchProducts".id  '
            }
            const query: { text: string, values: any } = {
                text: `Select  "Products".*,
                     (
            select
            

                   json_agg(jsonb_build_object('id', "Media".id,'defaultUrl',"Media"."url"->>'defaultUrl')) as "productMedia"

            from  json_array_elements_text("productMedia") AS elem
            inner join "Media" on "Media".id  =elem::uuid

        
            ) AS "medias",
                              "Media".url->'defaultUrl' as "mediaUrl",			
                              (SELECT json_agg(json_build_object('id',"BranchProducts".id,
                                                                'branchId',"BranchProducts"."branchId",
                                                                'productId',"BranchProducts"."productId",
                                                                'price',"BranchProducts"."price",
                                                                'onHand',        CASE
                                                                     WHEN "Products".type = 'serialized'::text THEN (SELECT count("ProductSerials".id) FROM "ProductSerials" WHERE "ProductSerials"."branchProductId" = "BranchProducts".id AND "ProductSerials"."status" = 'Available')
                                                                     WHEN "Products".type = 'batch'::text THEN (SELECT count("ProductBatches"."onHand") FROM "ProductBatches" WHERE "ProductBatches"."branchProductId" = "BranchProducts".id)
                                                                    ELSE "BranchProducts"."onHand"
                                                                    END
                                                                    )
                                )FROM "BranchProducts"     
                                  LEFT join "ProductBatches" on "ProductBatches"."branchProductId" =    "BranchProducts".id
			                 	  LEFT join "ProductSerials" on "ProductSerials"."branchProductId" =    "BranchProducts" .id and "status" = 'available'
                                  WHERE "BranchProducts"."productId" = "Products".id 
                                 	  and "BranchProducts"."branchId" = $2
                                              ${groupBy}
                                              ${havingQuery}  
                                ) AS "branches"
                from "Products" 
                LEFT JOIN "Taxes" on "Taxes".id = "Products"."taxId"
                LEFT JOIN "Media" on "Media".id = "Products"."mediaId"
                where "Products".id::text in (
                (select  jsonb_array_elements_text("alternativeProducts")  from "Products" 
                          where id = $1 ))
               
                          
                
                `,
                values: [productId, branchId]
            }



            let products = await DB.excu.query(query.text, query.values)



            return new ResponseData(true, "", products.rows);

        } catch (error: any) {
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async getBrands(client: PoolClient, company: Company) {
        try {

            const types: any[] = ["inventory", "kit", "package", "batch", "serialized"]

            let query: { text: string, values: any } = {
                text: ` select distinct("Brands".id),
                "Brands".name ,
               "Brands"."translation"::text::jsonb,
                count("Products".id) as "count"
                from "Brands"
                inner join "Products" on "Brands".id = "Products"."brandid"
                where "Products"."companyId"=$1
                and "Products".type = any($2)
                group by "Brands".id
                `,
                values: [company.id, types]
            }

            let brands = await client.query(query.text, query.values);

            return new ResponseData(true, "", brands.rows);

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getProductDiscounts(client: PoolClient, productIds: any[], branchId: string, companyId: string) {
        try {

            let branches = `["${branchId}"]`
            const query = {
                text: `with "productDiscount" as (
                                        select "Products".id as "productId", "Discounts"."quantityBasedCashDiscount", "Discounts"."percentage" , "Discounts"."amount","Discounts"."createdAt" ,"Discounts".id as "discountId"    from "Discounts" 
                                        cross JOIN LATERAL jsonb_array_elements_text(items) AS el
                                        inner join "Products" on "Products".id = (el::text)::uuid  and "Products".id = any($1)
                                        where "Discounts"."type" = 'automatic'
                                        and "Discounts"."applyTo" ='product'
                                        and "Discounts"."availableOnline" = true
                                        and "Discounts"."companyId" = $2
                                        and "Discounts"."startDate" <= current_date
                                        and ("Discounts"."expireDate" >= current_date or "Discounts"."expireDate" is null )
                                        and ("Discounts"."branches"  @> $3::jsonb) 
                                        union all 
                                            
                                        select  "Products".id as "productId", "Discounts"."quantityBasedCashDiscount",  "Discounts"."percentage" , "Discounts"."amount", "Discounts"."createdAt","Discounts".id as "discountId"  from "Discounts" 
                                        cross JOIN LATERAL jsonb_array_elements_text(items) AS el
                                        inner join "Categories" on "Categories".id = (el::text)::uuid 
                                        inner join "Products" on "Products"."categoryId" ="Categories".id and "Products".id = any($1)
                                        where "Discounts"."type" = 'automatic'
                                        and "Discounts"."applyTo" ='category'
                                               and "Discounts"."availableOnline" = true
                                        and "Discounts"."companyId" = $2 
                                        and "Discounts"."startDate" <= current_date
                                        and ("Discounts"."expireDate" >= current_date or "Discounts"."expireDate" is null )
                                         and ("Discounts"."branches"  @> $3::jsonb)    
                                        )

                                        select 
                                         "productDiscount"."discountId",
                                        "productDiscount"."productId",
                                         "productDiscount"."quantityBasedCashDiscount",
                                        "productDiscount"."percentage",
                                        "productDiscount"."amount",
                                        max("productDiscount"."createdAt")
                                        from "productDiscount"
                                        group by "productDiscount"."productId",
                                        "productDiscount"."percentage",
                                        "productDiscount"."amount",
                                           "productDiscount"."discountId",
                                            "productDiscount"."quantityBasedCashDiscount"
                                           `,
                values: [productIds, companyId, branches]
            }

            let discounts = await client.query(query.text, query.values);

            let discountList = discounts.rows && discounts.rows.length > 0 ? discounts.rows : []

            return discountList
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async generalSearch(data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");

            const searchTerm: string | null = data.searchTerm
                ? data.searchTerm.trim().toLowerCase()
                : null;

            let page: number = data.page ? data.page : 1;
            let offset = 0;

            let count = 0;
            let pageCount = 0;

            let branchId: string | null = data.branchId ?? null;

            const limit: number = data.limit == null ? 12 : data.limit;
            if (page !== 1) {
                offset = limit * (page - 1);
            }

            if (!branchId) {
                const defaultBranch: any = await BranchesRepo.getDefaultEcommerceBranch(
                    company.id,
                    client
                );
                branchId = defaultBranch.branch.id;
            }

            const companyOptions = await CompanyRepo.getCompanyWebsiteOptions(
                client,
                company.id
            );

            let hideOutOfStocks = false;
            if (companyOptions.success && companyOptions.data) {
                hideOutOfStocks = companyOptions.data.hideOutOfStocks;
            }

            let enforceServiceSelection = false
            let menuId = null

            const sessionId = data.sessionId;
            const cartData = await CartRepo.getRedisCart(company.id, sessionId);


            let cart = new Invoice();
            cart.ParseJson(cartData);

            const serviceName = cart.serviceName
            const serviceId = cart.serviceId;
            if (companyOptions.success && companyOptions.data) {
                hideOutOfStocks = companyOptions.data.hideOutOfStocks
                enforceServiceSelection = companyOptions.data.enforceServiceSelection
                if (enforceServiceSelection && !serviceName) throw new ValidationException("Service Name Is Required");
                const menus = companyOptions.data.serviceMenus
                if (serviceName && menus && typeof menus === 'object') {
                    for (const [key, value] of Object.entries(menus)) {
                        if (key.toLowerCase() === serviceName.toLowerCase()) {
                            menuId = value;
                        }
                    }
                }


            }
            let menuJoin = '';
            const removeServiceType = (!serviceName) || (serviceName && serviceName.toLowerCase() != 'salon') ? `AND "Products".type != 'service'` : ''
            if (menuId) {
                menuJoin = `INNER JOIN "MenuSectionProduct" ON "MenuSectionProduct"."productId" = "Products".id 
                             INNER JOIN "MenuSection" on "MenuSection".id = "MenuSectionProduct"."menuSectionId" and "MenuSection"."menuId" = $6 `
            }
            let havingQuery = ``;

            if (branchId) {
                havingQuery = `
        having  
          (${hideOutOfStocks} = false)
          or (
            ${hideOutOfStocks} = true
            and "Products"."type" = any (array['inventory','batch','serialized','kit'])
            and (
              "BranchProducts"."onHand" > 0
              or count("ProductSerials".id) > 0
              or sum("ProductBatches"."onHand") > 0
            )
          )
          or ("Products"."type" = any (array['service','menuItem','menuSelection','package']))
          or "Products"."productMatrixId" is not null
      `;
            }

            const query: { text: string, values: any } = {
                text: `
        WITH "products" AS (
          SELECT DISTINCT ON (COALESCE("Products"."productMatrixId", "Products".id)) 
            count(*) OVER(),
            "Products"."id" AS "id",
            COALESCE("ProductMatrix"."name", "Products"."name") AS "name",
            COALESCE("ProductMatrix"."defaultPrice", "Products"."defaultPrice") AS "defaultPrice",
           JSON_BUILD_OBJECT('defaultUrl',     CASE WHEN "Media".id is not null then   CONCAT(REPLACE("Media".url->>'defaultUrl', split_part("Media".url->>'defaultUrl', '/', -1), ''), 'Thumbnail_', split_part("Media".url->>'defaultUrl', '/', -1)) end) AS "mediaUrl",
            COALESCE(("ProductMatrix"."translation"::json), "Products"."translation") AS "translation",
            CASE 
              WHEN "productMatrixId" IS NOT NULL THEN 'matrix'
              ELSE "Products".type 
            END AS type,
            CASE 
              WHEN "productMatrixId" IS NOT NULL THEN NULL 
              ELSE "Products"."taxId" 
            END AS "taxId",
            "Products"."productMatrixId",
            JSONB_AGG("Taxes".*)->0 AS "productTaxes",
            CASE 
              WHEN (
                ("Products"."defaultOptions" IS NOT NULL AND jsonb_array_length("Products"."defaultOptions") > 0) OR
                ("Products"."optionGroups" IS NOT NULL AND json_array_length("Products"."optionGroups") > 0)
              )
              THEN true
              ELSE false
            END AS "hasOptions",
            'Products' AS "groupType",
            (
              SELECT json_agg(
                jsonb_build_object(
                  'id', "Media".id,
                  'defaultUrl', "Media"."url"->>'defaultUrl'
                )
              ) AS "productMedia"
              FROM json_array_elements_text("productMedia") AS elem
              INNER JOIN "Media" ON "Media".id = elem::uuid
            ) AS "medias",
            (
              SELECT json_agg(
                json_build_object(
                  'id', "BranchProducts".id,
                  'branchId', "BranchProducts"."branchId",
                  'productId', "BranchProducts"."productId",
                  'price', "BranchProducts"."price",
                  'onHand',
                  CASE
                    WHEN "Products".type = 'serialized'::text THEN (
                      SELECT count("ProductSerials".id)
                      FROM "ProductSerials"
                      WHERE "ProductSerials"."branchProductId" = "BranchProducts".id
                        AND "ProductSerials"."status" = 'Available'
                    )
                    WHEN "Products".type = 'batch'::text THEN (
                      SELECT count("ProductBatches"."onHand")
                      FROM "ProductBatches"
                      WHERE "ProductBatches"."branchProductId" = "BranchProducts".id
                    )
                    ELSE "BranchProducts"."onHand"
                  END
                )
              )
              FROM public."BranchProducts"
              WHERE "BranchProducts"."productId" = "Products".id
                AND "productMatrixId" IS NULL 
                AND "BranchProducts"."branchId" = $5::uuid
                AND "BranchProducts"."availableOnline" = true
            ) AS "branches"
          FROM "Products"
          INNER JOIN "BranchProducts"
            ON "BranchProducts"."productId" = "Products"."id"
           AND "BranchProducts"."availableOnline" = true
          LEFT JOIN "ProductMatrix"
            ON "Products"."productMatrixId" = "ProductMatrix"."id"
          LEFT JOIN "Taxes" ON "Taxes".id = "Products"."taxId"
          LEFT JOIN "Media" ON "Media".id = COALESCE("ProductMatrix"."mediaId", "Products"."mediaId") 
          LEFT JOIN "ProductBatches" ON "ProductBatches"."branchProductId" = "BranchProducts".id
          LEFT JOIN "ProductSerials" ON "ProductSerials"."branchProductId" = "BranchProducts".id   AND "status" = 'available'
          ${menuJoin}
          
          WHERE "Products"."companyId" = $1
            AND "Products"."isDeleted" = false
            AND "BranchProducts"."branchId" = $5
            ${removeServiceType}
            AND (
              lower("Products".name) ~ $2
              OR EXISTS (
                SELECT 1
                FROM unnest("Products"."tags") AS t(tag)
                WHERE lower(t.tag) ~ $2
              )
            )
          GROUP BY 
            "Products".id,
            "Media".id,
            "BranchProducts"."onHand",
            "ProductMatrix".id
          ${havingQuery}
          LIMIT $3
          OFFSET $4
        ),
        "categories" AS (
          SELECT  
            count(*) OVER(),
            "Categories".id, 
            "Categories".name,
            NULL::numeric AS "defaultPrice",
            "Media"."url" AS "mediaUrl",
            translation::json,
            NULL::text AS type, 
            NULL::uuid AS "taxId",
            NULL::uuid AS "productMatrixId",
            NULL::jsonb AS "productTaxes", 
            NULL::boolean AS "hasOptions",
            'Categories' AS "groupType",
            NULL::json AS "medias",
            NULL::json AS "branches"
          FROM "Categories" 
          LEFT JOIN "Media" ON "Media"."id" = "Categories"."mediaId"
          WHERE "Categories"."companyId" = $1
            AND lower("Categories".name) ~ $2
          LIMIT $3
          OFFSET $4 
        ),
        "collections" AS (
          SELECT  
            count(*) OVER(),
            "ProductCollections".id, 
            "ProductCollections"."title" AS "name",
            NULL::numeric AS "defaultPrice",
            "Media"."url" AS "mediaUrl",
            translation,
            NULL::text AS type, 
            NULL::uuid AS "taxId",
            NULL::uuid AS "productMatrixId",
            NULL::jsonb AS "productTaxes", 
            NULL::boolean AS "hasOptions",
            'Collections' AS "groupType",
            NULL::json AS "medias",
            NULL::json AS "branches"
          FROM "ProductCollections" 
          LEFT JOIN "Media" ON "Media"."id" = "ProductCollections"."mediaId"
          WHERE "ProductCollections"."companyId" = $1
            AND lower("ProductCollections".title) ~ $2
          LIMIT $3
          OFFSET $4
        ),
        "all" AS (
          SELECT * FROM "products"
          UNION ALL
          SELECT * FROM "categories"
          UNION ALL
          SELECT * FROM "collections"
        )
        SELECT "all".*, max("all"."count") OVER() AS "count"
        FROM "all"
      `,
                values: [company.id, searchTerm, limit, offset, branchId]
            };

            if (menuId) query.values.push(menuId);
            console.log(query.text, query.values);

            const products = await DB.excu.query(query.text, query.values);

            const productIds = products.rows
                .filter((f: any) => f.groupType === "Products")
                .map((f: any) => f.id);

            if (branchId) {
                const discounts = await this.getProductDiscounts(
                    client,
                    productIds,
                    branchId,
                    company.id
                );

                products.rows = products.rows.map((product: any) => {
                    const discount = discounts.find((f: any) => f.productId === product.id);
                    if (discount) {
                        product.discountPercentage = discount.percentage;
                        product.isDiscountable = true;
                        product.discountAmount = discount.amount;
                    }
                    return product;
                });
                const productIdPrice = products.rows
                    .filter((f: any) => f.groupType === "Products")
                    .map((f: any) => { return { id: f.id } });
                let prices = await ShopRepo.getProductPrices(client, productIdPrice, data.branchId, [], serviceId)
                if (prices && prices.length > 0) {
                    products.rows = products.rows.map((product: any) => {
                        const price = prices ? prices.find(pp => pp.id == product.id) : null
                        if (price) {
                            product.price = price.price
                        }
                        return product
                    })
                }
            }

            count =
                products.rows && products.rows.length > 0
                    ? Number((products.rows[0] as any).count)
                    : 0;
            pageCount = Math.ceil(count / limit) + 1;

            offset += 1;
            let lastIndex = page * limit;
            if (products.rows.length < limit || data.page === pageCount) {
                lastIndex = count;
            }

            const resData = {
                list: products.rows,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex,
                types: ["Categories", "Products", "Collections"]
            };

            await client.query("COMMIT");
            return new ResponseData(true, "", resData);
        } catch (error: any) {
            await client.query("ROLLBACK");
            console.log(error);
            throw error;
        } finally {
            client.release();
        }
    }

    public static async getCompanyMenu(data: any, company: Company) {

        try {


            let branchId = data.branchId ?? null;
            if (!branchId) {

                let defaultBranch: any = await BranchesRepo.getDefaultEcommerceBranch(company.id)


                if (defaultBranch.branch) {
                    branchId = defaultBranch.branch.id

                }
            }


            const currentDate = await TimeHelper.getCurrentDateWithTimeZone(company.timeOffset)
            const currentHour = currentDate.getUTCHours();
            const currentMinutes = currentDate.getUTCMinutes();
            const currentSeconds = currentDate.getUTCSeconds();
            let currentTime = currentHour + ':' + currentMinutes + ':' + currentSeconds
            let companyOptions = await CompanyRepo.getCompanyWebsiteOptions(null, company.id);
            let hideOutOfStocks = false
            let enforceServiceSelection = false
            let menuId = null
            const sessionId = data.sessionId;
            let serviceId = null;
            if (companyOptions.success && companyOptions.data) {
                hideOutOfStocks = companyOptions.data.hideOutOfStocks
                enforceServiceSelection = companyOptions.data.enforceServiceSelection
                if (enforceServiceSelection) {
                    const cartData = await CartRepo.getRedisCart(company.id, sessionId);
                    let cart = new Invoice();
                    cart.ParseJson(cartData);
                    const serviceName = cart.serviceName
                    serviceId = cart.serviceId
                    if (!serviceName) throw new ValidationException("Service Name Is Required");
                    const menus = companyOptions.data.serviceMenus
                    if (serviceName && menus && typeof menus === 'object') {
                        for (const [key, value] of Object.entries(menus)) {
                            if (key.toLowerCase() === serviceName.toLowerCase()) {
                                menuId = value;
                            }
                        }
                    }
                }

            }
            let havingQuery = ``;
            let branches = `["${branchId}"]`
            if (branchId) {
                havingQuery = `     having  (${hideOutOfStocks} = false ) or (${hideOutOfStocks}  = true and "Products"."type" = any (array['inventory','batch','serialized','kit']) and ("BranchProducts"."onHand" >0) or count("ProductSerials".id) >0 or sum( "ProductBatches"."onHand") >0 ) 
                or ("Products"."type" = any (array['service','menuItem','menuSelection','package']))`

            }
            const query = {
                text: `with "sections" as (
                        select "MenuSection".id,"MenuSection"."translation" as "sectionTranslation", "MenuSection"."name" as "sectionName" , "Menu"."index" AS "menuIndex" ,  "MenuSection"."index" as "sectionIndex"from "Menu"
                        inner join "MenuSection" on "MenuSection"."menuId" = "Menu".id
                                            inner JOIN jsonB_array_elements("branchIds")el on (el ->>'branchId')::uuid = $3::uuid

                        where "companyId" = $1
                        and ( $5::uuid is null  or "Menu".id = $5::uuid)
                        AND "Menu"."startAt" <= $2 AND  "Menu"."endAt" >=  $2::time  and ("Menu"."availableOnline" = true or  "Menu"."availableOnline" is null )

                        order by  "Menu"."index" ASC ,  "MenuSection"."index" ASC 
                        ), "products" as (
                        select "Products".id,
                                "MenuSectionProduct"."menuSectionId",
                                "sections"."sectionName" ,
                                "sections"."sectionTranslation"::text::jsonb ,
                                "Products".name as "productName",
                            "Products".id as "productId",
                                "Products".type,
                                "Products"."maxItemPerTicket",
                                "Products".description,
                                        "Products".tags,
                                "Products".translation,
                                "Products"."defaultPrice",

                                "Products"."productAttributes", 
                                "MenuSectionProduct"."page",
                                "MenuSectionProduct"."index" "productIndex",
                                	 "menuIndex" ,
							  "sectionIndex",
                              "Products"."comparePriceAt",
                               CASE WHEN ( ("Products"."defaultOptions" is not null and jsonb_array_length("Products"."defaultOptions") > 0 )or("Products"."optionGroups" is not null and json_array_length("Products"."optionGroups") > 0) ) THEN true ELSE false END AS "hasOptions",
                               JSONB_AGG("Taxes".*)->0 as "productTaxes",
                                  CASE WHEN "Media".id is not null then   CONCAT(REPLACE("Media".url->>'defaultUrl', split_part("Media".url->>'defaultUrl', '/', -1), ''), 'Thumbnail_', split_part("Media".url->>'defaultUrl', '/', -1)) end as "mediaUrl",
                               (SELECT json_agg(json_build_object('id',"BranchProducts".id,
                                                        'branchId',"BranchProducts"."branchId",
                                                        'productId',"BranchProducts"."productId",
                                                        'price',"BranchProducts"."price",
                                                        'onHand',        CASE
                                                        WHEN "Products".type = 'serialized'::text THEN (SELECT count("ProductSerials".id) FROM "ProductSerials" WHERE "ProductSerials"."branchProductId" = "BranchProducts".id AND "ProductSerials"."status" = 'Available')
                                                        WHEN "Products".type = 'batch'::text THEN (SELECT count("ProductBatches"."onHand") FROM "ProductBatches" WHERE "ProductBatches"."branchProductId" = "BranchProducts".id)
                                                        ELSE "BranchProducts"."onHand"
                                                      END
                                                    )
                                                  ) 
                                                        FROM "BranchProducts"
                                                        WHERE "BranchProducts"."productId" = "Products".id 
                                                              and "BranchProducts"."branchId"= $3::uuid
                                                                  and "BranchProducts"."availableOnline" = true
                                 ) AS "branches"
                            from "sections"
                        inner join "MenuSectionProduct" on "MenuSectionProduct"."menuSectionId" =  "sections".id
                        inner join "Products" on "Products".id = "MenuSectionProduct"."productId"  and "Products"."isDeleted" = false
                        inner join "BranchProducts" ON "BranchProducts"."productId" = "Products"."id"
                        left join "Taxes" on "Taxes".id = "Products"."taxId"
                        left join "Media" on "Media".id = "Products"."mediaId"
							            left join "ProductBatches" on "ProductBatches"."branchProductId" =    "BranchProducts".id
								left join "ProductSerials" on "ProductSerials"."branchProductId" =    "BranchProducts" .id and "status" = 'available'
                        where "BranchProducts"."branchId"= $3
                        and "BranchProducts"."availableOnline" = true
                        group by "Products".id ,"Taxes" ,	 "menuIndex" ,
							  "sections"."sectionTranslation"::text::jsonb, "sectionIndex",   "MenuSectionProduct"."index" ,   "MenuSectionProduct"."page",	"Media".id, "MenuSectionProduct"."menuSectionId" , "sections"."sectionName","BranchProducts"."onHand"
                          ${havingQuery}
                        ),"productDiscount" as (
                                        select "Products".id as "productId",  "Discounts"."percentage" , "Discounts"."amount","Discounts"."createdAt" ,"Discounts".id as "discountId"    from "Discounts" 
                                        cross JOIN LATERAL jsonb_array_elements_text(items) AS el
                                        inner join "Products" on "Products".id = (el::text)::uuid  and "Products".id = any(select id from "products")
                                        where "Discounts"."type" = 'automatic'
                                        and "Discounts"."applyTo" ='product'
                                        and "Discounts"."companyId" = $1
                                                and "Discounts"."availableOnline" = true
                                        and "Discounts"."startDate" <= current_date
                                        and ("Discounts"."expireDate" >= current_date or "Discounts"."expireDate" is null )
                                        and ("Discounts"."branches"  @> $4::jsonb) 
                                        union all 
                                            
                                        select  "Products".id as "productId",  "Discounts"."percentage" , "Discounts"."amount", "Discounts"."createdAt","Discounts".id as "discountId"  from "Discounts" 
                                        cross JOIN LATERAL jsonb_array_elements_text(items) AS el
                                        inner join "Categories" on "Categories".id = (el::text)::uuid 
                                        inner join "Products" on "Products"."categoryId" ="Categories".id and "Products".id =  any(select id from "products")
                                        where "Discounts"."type" = 'automatic'
                                        and "Discounts"."applyTo" ='category'
                                                and "Discounts"."availableOnline" = true
                                        and "Discounts"."companyId" = $1
                                        and "Discounts"."startDate" <= current_date
                                        and ("Discounts"."expireDate" >= current_date or "Discounts"."expireDate" is null )
                                         and ("Discounts"."branches"  @> $4::jsonb)    
                                        ),"discounts" as (
										    select 
                                         "productDiscount"."discountId",
                                        "productDiscount"."productId",
                                        "productDiscount"."percentage" as "discountPercentage",
                                        "productDiscount"."amount" as "discountAmount",
											true as "isDiscountable",
                                        max("productDiscount"."createdAt")
                                        from "productDiscount"
                                        group by "productDiscount"."productId",
                                        "productDiscount"."percentage",
                                        "productDiscount"."amount",
                                           "productDiscount"."discountId"
											
										)

                        select "menuSectionId",
                                "sectionName",
                                	 "menuIndex" ,"products"."sectionTranslation"::text::jsonb as "translation",
									 
							 "sectionIndex",
                                JSON_AGG(JSON_BUILD_OBJECT('id', "products"."productId",
                                                        'name',"productName",
                                                        'type',"type",
                                                        'tags',"tags",
                                                        'hasOptions',"hasOptions",
                                                        'maxItemPerTicket',"maxItemPerTicket",
                                                        'description',"description",
                                                        'translation',"translation",
                                                        'defaultPrice',"defaultPrice",
                                                        'productAttributes',"productAttributes",
                                                        'comparePriceAt',"comparePriceAt",
                                                        'productTaxes',"productTaxes",
                                                        'mediaUrl',"mediaUrl",
                                                        'branches',"branches",
														'isDiscountable',"isDiscountable",
														'discountPercentage',"discountPercentage",
														'discountAmount',"discountAmount"
                                                        ) order by     "products"."page" asc , "productIndex" asc  ) AS "products"
                        from "products"
						left join "discounts" on "discounts"."productId" = "products".id
                        group by "menuSectionId","sectionName",	 "menuIndex" ,"products"."sectionTranslation"::text::jsonb,
							 "sectionIndex"
                              order by "menuIndex" asc ,  "sectionIndex" asc
                             `,
                values: [company.id, currentTime, branchId, branches, menuId]
            }

            const menus = await DB.excu.query(query.text, query.values);

            let products: any[] = []
            let menuIds = new Set()
            let distinctMenuId: any[] = []
            if (menus && menus.rows && menus.rows.length > 0) {
                menus.rows.forEach(element => {
                    const arryOfProducts = element.products;

                    arryOfProducts.forEach((prod: any) => {
                        menuIds.add(prod.menuId)
                        products.push({ id: prod.id, menuId: prod.menuId })
                    })

                })
                if (menuIds.size > 0) {
                    distinctMenuId = [...menuIds]
                }
                let prices = await this.getProductPrices(null, products, branchId, distinctMenuId, serviceId)

                if (prices && prices != null) {
                    menus.rows = menus.rows.map(m => {
                        m.products = m.products.map((p: any) => {
                            let price = prices ? prices.find(pro => pro.id == p.id) : null
                            if (price && price.price) {
                                p.price = price.price
                            }
                            return p
                        })
                        return m
                    })
                }
            }
            return new ResponseData(true, "", menus.rows)
        } catch (error: any) {

            throw new Error(error)
        }
    }

    public static async getParentChildOnHand(productIds: any[], branchId: string) {
        try {
            const query = {
                text: `WITH RECURSIVE Hierarchy AS (
                       -- Start from the child
                    SELECT 
                        "Products".Id,
                        Name,
                        "parentId",
                        "childQty",
                    "BranchProducts"."onHand"  as Stock,
                        1.0::double precision AS Multiplier
                    FROM "Products"
                    inner join "BranchProducts" on "BranchProducts"."productId" = "Products".id and "BranchProducts"."branchId"= '56033816-8b42-42f4-90b7-3fa8bf7ecae1'
                    WHERE "Products".id = '728a3138-0716-4bca-bfd7-7bf50b41b93d'

                    UNION ALL

                    -- Climb up the parent hierarchy
                    SELECT 
                        h.Id,
                        p."name",
                        p."parentId",
                        p."childQty",
                        "BranchProducts"."onHand",
                        (h.Multiplier * h."childQty")::double precision AS Multiplier
                    FROM "Products" p
                        inner join "BranchProducts" on "BranchProducts"."productId" = p.id and "BranchProducts"."branchId"= '56033816-8b42-42f4-90b7-3fa8bf7ecae1'
                    JOIN Hierarchy h ON h."parentId" = p.Id
                )

                SELECT 
                    id 
                    SUM(Stock * Multiplier) AS TotalChildStock
                FROM Hierarchy;`
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getProductMedia(company: Company, productId: string) {
        try {
            const query = {
                text: `select(
                            select
                                json_agg(jsonb_build_object('id', "Media".id,'defaultUrl',"Media"."url"->>'defaultUrl', '3dUrl',"Media"."url"->>'downloadUrl')) as "productMedia"
                            from  json_array_elements_text("Products"."productMedia") AS elem
                            inner join "Media" on "Media".id  =elem::uuid
                            ) AS "medias"
                from "Products" where id  = $1 and "companyId" = $2`,
                values: [productId, company.id]
            }
            const result = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", result.rows[0])

        } catch (error: any) {
            throw new Error(error)

        }

    }


    public static async getProductPrices(client: PoolClient | null, productIds: any[], branchId: string, menuIds: any[], serviceId: string | null) {
        try {
            let priceLabel: any;
            // if (menuIds && menuIds.length > 0) {
            //     const menuQuery = {
            //         text: `SELECT "Menu" .id,"priceLabelId" ,"PriceLabels"."productsPrices" FROM "Menu" 
            //                                              inner join "PriceLabels" on "PriceLabels"."id" = "Menu"."priceLabelId"
            //                                              where "Menu" ."id" = any($1)`,
            //         values: [menuIds]
            //     }
            //     const menuPriceLabel = client ? await client.query(menuQuery.text, menuQuery.values) : await DB.excu.query(menuQuery.text, menuQuery.values)
            //     priceLabel = menuPriceLabel.rows;
            //     if (priceLabel && priceLabel.length > 0) {
            //         productIds = productIds.map((m: any) => {
            //             const menuPriceLabel = priceLabel.find((pl: any) => pl.id == m.menuId)
            //             if (menuPriceLabel && menuPriceLabel.productsPrices) {
            //                 const price = menuPriceLabel.productsPrices.find((f: any) => f.productId == m.id)
            //                 if (price) {
            //                     m.price = price.price
            //                 }
            //             }
            //             return m
            //         })

            //         return productIds;
            //     }

            // }

            if (serviceId && branchId) {
                const serviceQuery = {
                    text: `SELECT "Services".id, el->>'priceLabelId'  as "priceLabelId" ,"PriceLabels"."productsPrices" FROM "Services" 
                                                         inner join json_array_elements("branches") el on true 
                                                         inner join "PriceLabels" on "PriceLabels"."id"::text = el->>'priceLabelId' 
                                                         where "Services" ."id" = $1
                                                         and el->>'branchId'  =  $2`,
                    values: [serviceId, branchId]
                }
                const servicePriceLabel = client ? await client.query(serviceQuery.text, serviceQuery.values) : await DB.excu.query(serviceQuery.text, serviceQuery.values)

                priceLabel = servicePriceLabel.rows;
                priceLabel = servicePriceLabel.rows[0];
                if (priceLabel) {
                    const productPrices = priceLabel.productsPrices
                    productIds = productIds.map((m: any) => {
                        let price = productPrices.find((f: any) => f.productId == m.id)
                        if (price) {
                            m.price = price.price
                        }
                        return m
                    })
                }

                return productIds
            }

            return null

        } catch (error: any) {
            throw new Error(error);
        }

    }
    public static async getOptionPrices(client: PoolClient | null, optionIds: any[], branchId: string, menuIds: any[], serviceId: string | null) {
        try {
            let priceLabel: any;
            // if (menuIds && menuIds.length > 0) {
            //     const menuQuery = {
            //         text: `SELECT "Menu" .id,"priceLabelId" ,"PriceLabels"."productsPrices" FROM "Menu" 
            //                                              inner join "PriceLabels" on "PriceLabels"."id" = "Menu"."priceLabelId"
            //                                              where "Menu" ."id" = any($1)`,
            //         values: [menuIds]
            //     }
            //     const menuPriceLabel = client ? await client.query(menuQuery.text, menuQuery.values) : await DB.excu.query(menuQuery.text, menuQuery.values)
            //     priceLabel = menuPriceLabel.rows;
            //     if (priceLabel && priceLabel.length > 0) {
            //         productIds = productIds.map((m: any) => {
            //             const menuPriceLabel = priceLabel.find((pl: any) => pl.id == m.menuId)
            //             if (menuPriceLabel && menuPriceLabel.productsPrices) {
            //                 const price = menuPriceLabel.productsPrices.find((f: any) => f.productId == m.id)
            //                 if (price) {
            //                     m.price = price.price
            //                 }
            //             }
            //             return m
            //         })

            //         return productIds;
            //     }

            // }

            if (serviceId && branchId) {
                const serviceQuery = {
                    text: `SELECT "Services".id, el->>'priceLabelId'  as "priceLabelId" ,"PriceLabels"."optionsPrices" FROM "Services" 
                                                         inner join json_array_elements("branches") el on true 
                                                         inner join "PriceLabels" on "PriceLabels"."id"::text = el->>'priceLabelId' 
                                                         where "Services" ."id" = $1
                                                         and el->>'branchId'  =  $2`,
                    values: [serviceId, branchId]
                }
                const servicePriceLabel = client ? await client.query(serviceQuery.text, serviceQuery.values) : await DB.excu.query(serviceQuery.text, serviceQuery.values)

                priceLabel = servicePriceLabel.rows;
                priceLabel = servicePriceLabel.rows[0];
                if (priceLabel) {
                    const optionPrices = priceLabel.optionsPrices
                    optionIds = optionIds.map((m: any) => {
                        let price = optionPrices.find((f: any) => f.optionId == m.id)
                        if (price) {
                            m.price = price.price
                        }
                        return m
                    })
                }

                return optionIds
            }

            return null

        } catch (error: any) {
            throw new Error(error);
        }

    }
}