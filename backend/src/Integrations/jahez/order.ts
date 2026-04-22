// public static async getBranchListTest2(company: Company) {
//     try {
//       company.id = "97d49fa3-d473-48f3-ac56-17d7baad4c34"

//       // ------------------------------
//       //test branch
//       // ------------------------------
//       // const query : { text: string, values: any } = {
//       //   text: `SELECT 
//       //   Branches.name,
//       //   Branches.id,
//       //   Branches.address,
//       //   Branches.location,
//       //   Branches."phoneNumber",
//       //   Branches."index",
//       //   Branches."companyId"
//       //   FROM "Branches" AS Branches
//       //   INNER JOIN "Companies" AS Companies 
//       //   ON Companies.id = Branches."companyId" AND 
//       //   Companies.id = $1 
//       //   order by Branches."index" asc
//       //   `,
//       //   values: [company.id]
//       // }

//       // const branches = await DB.excu.query(query.text, query.values);
//       // const bb =  new jahezBranch()

//       //  console.log((await bb.uploadBranches(branches.rows,company)).data)

//       // return new ResponseData(true, "", branches.rows)

//       // ------------------------------
//       // test options
//       // ------------------------------

//       // console.log(company.id)

//       // const query : { text: string, values: any } = {
//       //   text: `SELECT
//       //                 id,
//       //                 name, 
//       //                 price,
//       //                 (case
//       //                 when "Options"."translation"->'name' is not null  and  "Options"."translation"->>'name' != '{}'then

//       //                 json_build_object('name',"Options"."translation"->'name') 
//       //                 end) as "translation"
//       //             FROM "Options"
//       //             where "Options"."companyId" = $1
//       //   `,
//       //   values: [company.id]
//       // }

//       // const branches = await DB.excu.query(query.text, query.values);
//       // const bb =  new whatsappProduct()
//       // console.log((await bb.options(branches.rows,company)).data)

//       // return new ResponseData(true, "", branches.rows)


//       // ------------------------------
//       //test catalog
//       // ------------------------------

//       // console.log(company.id)

//       const query : { text: string, values: any } = {
//         text: `WITH "OptionGroupsData" AS (
//           SELECT  "Products".id AS "productId",
//                   CASE
//                   WHEN json_array_length("optionGroups") > 0 THEN json_agg(
//                             json_build_object(
//                               'index', ("optionGroup"->>'index'),
//                               'optionGroupId', "OptionGroups".id,
//                               'title', "OptionGroups".title,
//                               'translation',  "OptionGroups"."translation",
//                               'minSelectable',"OptionGroups"."minSelectable",
//                               'maxSelectable',"OptionGroups"."maxSelectable",
//                               'options', ( SELECT json_agg( json_build_object(
//                                               'index', (elem ->>'index'),
//                                               'optionId', ("Options".id),
//                                               'name',("Options".name),
//                                               'translation',("Options".translation),
//                                               'price',("Options".price)
            
//                                ))
//                             FROM json_array_elements("OptionGroups"."options") AS elem
//                             INNER JOIN "Options" ON "Options".id = (elem->>'optionId')::uuid
//                           )
//                       )
//                   )
//                   END AS "optionGroups"
//           FROM "Products"
//           JOIN json_array_elements("Products"."optionGroups") AS "optionGroup" ON TRUE
//           LEFT JOIN "OptionGroups" ON "OptionGroups".id = ("optionGroup"->>'optionGroupId')::uuid
//           GROUP BY "Products".id
//       ),

//       "BranchesData" AS ( 
//               SELECT "BranchProducts"."productId", 
//                       json_agg( json_build_object('available',(coalesce("BranchProducts".available,false))  , 
//                                                   'branchId', ("BranchProducts"."branchId") ))as "branches"
//               from "BranchProducts"
//               group by "productId"
//         )
        
//       SELECT 
//           "Products".id,
//           "Products".name,
//           "Products"."defaultPrice",
//           "Products"."categoryId",
//           "Products".translation,
//           "Products".description,
//           "BranchesData"."branches",
//           "Media".url->'defaultUrl' AS "imageUrl",
//           "Products"."isDeleted",

//           "Products"."taxId",
//           "Products".type,
//           "Products"."maxItemPerTicket",
//           "Products"."alternativeProducts",
//           "Products"."UOM",
//           "OptionGroupsData"."optionGroups",
//           "Products"."quickOptions" 
//           FROM "Products" 
//           INNER JOIN "BranchesData" ON "Products".id = "BranchesData"."productId"
//           left join "OptionGroupsData" on "Products".id =  "OptionGroupsData"."productId"
//           LEFT JOIN "Media" ON "Media".id = "Products"."mediaId"
//           LEFT JOIN "Brands" on "Brands".id = "Products"."brandid" 
//         where "Products"."companyId" = $1
//         `,
//         values: [company.id]
//       }


//       const branches = await DB.excu.query(query.text, query.values);
//       const bb = new jahezProduct()
//       console.log((await bb.createProduct(branches.rows[39], company)).data)

//       return new ResponseData(true, "", branches.rows)

//       // ------------------------------
//       //get catalog list
//       // ------------------------------

//       // console.log(company.id)

//       // const bb =  new whatsappProduct()
//       // let res = (await bb.getCatalogList(company)).data
//       // console.log(res)

//       // return new ResponseData(true, "", res)

//       // ------------------------------
//       // test sections
//       // ------------------------------

//       console.log(company.id)

//       // const query : { text: string, values: any } = {
//       //   text: `select 
//       //             distinct on ("MenuSection".id) "MenuSection".id, 
//       //             "MenuSection".name,
//       //             "MenuSection".translation,
//       //             "MenuSection".index,
//       //             "Menu".name,
//       //             (select json_agg(x) from unnest((select array_agg((id::text))
//       //             from "Branches" where "Branches"."companyId" = $1 )) as x where x <> all(array_agg(elem->>'branchId'))) as "exclude_branches"

//       //             from "MenuSection"
//       //             INNER JOIN "Menu" ON "Menu".id =  "MenuSection"."menuId"
//       //             cross JOIN LATERAL jsonb_array_elements("Menu"."branchIds") AS elem
//       //             where "Menu"."companyId" = $1
//       //             group by "Menu".id,"MenuSection".id
//       //             `,
//       //   values: [company.id]
//       // }

//       // const branches = await DB.excu.query(query.text, query.values);
//       // const bb =  new jahezCategory()

//       //  console.log((await bb.createCategory(branches.rows[0],company)).data)

//       // return new ResponseData(true, "", branches.rows)



//     } catch (error: any) {
//       
//       throw new Error(error.message)
//     }
//   }