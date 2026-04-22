import { BranchDeliveryAddress, Branches } from "@src/models/admin/Branches";
import { DB } from "../../dbconnection/dbconnection";

import { ResponseData } from "@src/models/ResponseData";
import { BranchValdation } from "@src/validationSchema/admin/branch.Schema";
import { PoolClient } from "pg";
import { ServiceRepo } from "./services.repo";
import { Service, ServiceSetting } from "@src/models/Settings/service";


import { Company } from "@src/models/admin/company";
import { FileStorage } from "@src/utilts/fileStorage";

import format from 'pg-format'


import { whatsappProduct } from "@src/Integrations/whatsapp/Product";


import { CartRepo } from "../ecommerce/cart.repo";
import { TablesRepo } from "../app/settings/tables.repo";
import { EmployeeRepo } from "./employee.repo";
import { string } from "pg-format";




import { CostExplorer } from "aws-sdk";
import { Console } from "console";
import { ValidationException } from "@src/utilts/Exception";
import { TimeHelper } from "@src/utilts/timeHelper";
import { CompanyGroupRepo } from "./companyGroups.repo";
import { TriggerQueue } from "../triggers/triggerQueue";
import { escape } from "lodash";
import { RedisCaching } from "@src/utilts/redisCaching";


export class BranchesRepo {
  static POSprivielges: any;



  public static async checkIfBranchNameExist(client: PoolClient, name: string, companyId: string, branchId: string | null) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty 
             FROM "Branches" 
             WHERE id <> $1 
             AND LOWER(name) = LOWER($2) 
             AND "companyId" = $3 `,
      values: [
        branchId,
        name,
        companyId,] as any,
    };

    if (branchId == null) {
      query.text = `SELECT count(*) as qty 
                    FROM "Branches" 
                    WHERE  LOWER(name) = LOWER($1) 
                    AND "companyId" = $2 `
      query.values = [name, companyId]
    }
    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }
  public static async checkIfCompanyIdExist(client: PoolClient, companyId: string) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Companies" where id =$1 `,
      values: [
        companyId,

      ],
    };

    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }
  public static async checkIfBranchIdExist(branchId: string) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Branches" Inner Join "Companies" On "Branches"."companyId" = "Companies".id and "Branches".id=$1 `,
      values: [
        branchId,
      ],
    };

    const resault = await DB.excu.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }


  public static async getBranchLastIndex(client: PoolClient, companyId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT MAX(index)as"index" FROM "Branches" where "Branches"."companyId" =$1`,
        values: [companyId]
      }

      let branch = await client.query(query.text, query.values);
      if (branch.rows && branch.rows.length > 0) {
        return branch.rows[0].index
      } else {
        return 0
      }
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async InsertBranch(client: PoolClient, data: any, isNew: boolean = false, adminId = null) {

    try {
      /** Validate Branch Data */
      const validate = await BranchValdation.branchValidation(data);
      if (!validate.valid) {
        throw new ValidationException(validate.error);
      }

      /** Check If Branch Name Already Used */
      const isBranchNameExist = await this.checkIfBranchNameExist(client, data.name, data.companyId, null)
      if (isBranchNameExist) {
        throw new ValidationException("Branch Name Already Exist")
      }

      /** Check Company Id of currently added branch is exist */
      const isBrandIdExist = await this.checkIfCompanyIdExist(client, data.companyId)
      if (!isBrandIdExist) {
        throw new ValidationException("Company Id Dosnt Exist")
      }


      const branch = new Branches();
      branch.ParseJson(data)
      branch.updatedTime = new Date();
      /**Set Branch Index by getting max index of branches */
      let branchIndex = await this.getBranchLastIndex(client, data.companyId);
      branch.index = branchIndex + 1;
      const query: { text: string, values: any } = {
        text: `INSERT INTO "Branches"("companyId",name,address,location,"workingHours","onlineAvailability", "deliveryTimes","coveredAddresses","phoneNumber","index","updatedTime","closingTime","isWearhouse") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        values: [branch.companyId,
        branch.name,
        branch.address,
        branch.location,
        branch.workingHours,
        branch.onlineAvailability,
        branch.deliveryTimes,
        branch.coveredAddresses,
        branch.phoneNumber,
        branch.index,
        branch.updatedTime,
        branch.closingTime,
        branch.isWearhouse
        ]
      }

      /** Insert Branch */
      const branchInsert = (await client.query(query.text, query.values)).rows;
      const branchId = (<any>branchInsert[0]).id

      if (adminId != null) {
        let logid = await CompanyGroupRepo.addAdminLog(client, `Add Branch`, `Added Branch ${branch.name}`, adminId, branchId);
      }


      /** add already existing products to the branch */
      const addProductsQuery = {
        text: `WITH "prodcuts" AS (
                SELECT "Products".id AS "productId", 
                      $1::uuid AS "companyId",
                      $2::uuid AS "branchId",
                      TRUE AS "availableOnline",
                      TRUE AS "available",
                      $3::timestamp as "updatedTime"
                FROM "Products" 
                WHERE "companyId" = $1 
            )
            INSERT INTO "BranchProducts" ("productId", "companyId", "branchId", "availableOnline", "available","updatedTime")
            SELECT "productId", "companyId", "branchId", "availableOnline", "available" ,"updatedTime"
            FROM "prodcuts"
            RETURNING "productId";`,
        values: [branch.companyId, branchId, new Date()]

      }

      let insertProducts = await client.query(addProductsQuery.text, addProductsQuery.values);
      const newProductIds = insertProducts.rows.map(f => { f.productId })

      // const companyProducts = await ProductRepo.getCompanyProductsIds(client, branch.companyId)
      // if (companyProducts.data.length > 0) {
      //   let branchProduct = new BranchProducts();
      //   for (let index = 0; index < companyProducts.data.length; index++) {
      //     const product = companyProducts.data[index];
      //     branchProduct.productId = product.id;
      //     branchProduct.branchId = branchId
      //     branchProduct.companyId = branch.companyId

      //     await BranchProductsRepo.insertBranchProduct(client, branchProduct)
      //   }
      // }


      /**Add super admin to branch */
      if (isNew == true) {
        let updateDate = new Date();
        let employeeQuery: { text: any, values: any } = {
          text: ` with "company" as (UPDATE "Employees"
            SET "branches" = jsonb_insert("branches", '{-1}', '{"id": "${branchId}"}'),
                 "updatedDate"=$2
            WHERE "Employees"."companyId" = $1 AND "superAdmin" = true Returning Id )
            ,"companyEmployee" as(
            UPDATE "CompanyEmployees"
            SET "branches" = jsonb_insert("branches", '{-1}', '{"id": "${branchId}"}'),
                 "updatedDate"=$2
            WHERE "CompanyEmployees"."companyId" = $1 AND "superAdmin" = true Returning Id
            )
             select * from "company"
             union all 
                select * from "companyEmployee"
            `,
          values: [branch.companyId, updateDate]
        }
        await client.query(employeeQuery.text, employeeQuery.values)


        // let employeeQuery: { text: any, values: any } = {
        //   text: `UPDATE "Employees"
        //     SET "branches" = jsonb_insert("branches", '{-1}', '{"id": "${branchId}"}'),
        //          "updatedDate"=$2
        //     WHERE "Employees"."companyId" = $1 AND "superAdmin" = true;`,
        //   values: [branch.companyId, updateDate]
        // }
        // await client.query(employeeQuery.text, employeeQuery.values)

        /** ADD SERVICES TO THE BRANCH */
        let servicesQuery = {
          text: `SELECT id,"branches","type" FROM "Services" where "companyId" =$1`,
          values: [branch.companyId]
        }

        let services = await client.query(servicesQuery.text, servicesQuery.values);
        if (services && services.rowCount && services.rowCount > 0) {
          let servicesTemp: Service[] = []
          let service = new Service()
          let serviceTypes = service.serviceTypes();
          for (let index = 0; index < services.rows.length; index++) {
            const element: Service = services.rows[index];
            let tempServise = serviceTypes.find(f => f.type == element.type)
            if (tempServise) {
              let setting = new ServiceSetting();
              setting.branchId = branchId
              setting.setting = tempServise.setting
              element.branches.push(setting)
              servicesTemp.push(element)
            }

          }

          if (servicesTemp.length > 0) {


            const transactionValues = servicesTemp.map(update => [update.id, JSON.stringify(update.branches)]);
            if (transactionValues.length > 0) {
              const updateQuery = `
                    UPDATE "Services" 
                    SET "branches" = data."branches"::json
                    FROM (VALUES %L) AS data("id", "branches")
                    WHERE "Services"."id"= data."id"::uuid
                    ;
                  `;
              const formattedQuery = format(updateQuery, transactionValues);
              await client.query(formattedQuery);

            }
          }
        }

      }




      let queueInstance = TriggerQueue.getInstance();
      queueInstance.createJob({ journalType: "Movment", type: "newProductCost", ids: newProductIds, branchId: branchId })



      return new ResponseData(true, "Added Successfully", { id: branchId })
    } catch (error: any) {

      throw new Error(error.message)
    }
  }

  public static async setBranchWorkingHour(data: any) {
    try {
      const query: { text: string, values: any } = {
        text: `UPDATE "Branches" set "workingHours"=$1 where id =$2`,
        values: [data.workingHours, data.branchId]
      }
      await DB.excu.query(query.text, query.values)
      return new ResponseData(true, "", [])
    } catch (error: any) {

      throw new Error(error)
    }
  }




  public static async setBranchZatca(data: any, branchId: any) {
    try {
      const query: { text: string, values: any } = {
        text: `UPDATE "Branches" SET "zatca" = $1, "zatca_startdate" = NOW() WHERE id = $2`,
        values: [data, branchId]
      };
      await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", []);
    } catch (error: any) {

      throw new Error(error);
    }
  }




  public static async editBranch(client: PoolClient, data: any, companyId: string) {

    try {

      /**validate branch data */
      const validate = await BranchValdation.branchValidation(data);
      if (!validate.valid) {
        throw new ValidationException(validate.error)
      }
      data.companyId = companyId;

      /** check if branch name  already used */
      const isBranchNameExist = await this.checkIfBranchNameExist(client, data.name, data.companyId, data.id)
      if (isBranchNameExist) {
        throw new ValidationException("Branch Name Already Exist")
      }

      const isCompanyIdExist = await this.checkIfCompanyIdExist(client, data.companyId)
      if (!isCompanyIdExist) {
        throw new ValidationException("Company Id Dosnt Exist")
      }



      const branch = new Branches();
      branch.ParseJson(data);
      branch.updatedTime = new Date();
      const query: { text: string, values: any } = {
        text: `UPDATE "Branches" 
                             SET name = ($1) , 
                                 address = ($2) ,
                                 location =($3),
                                 "coveredAddresses"=$4,
                                 "phoneNumber"=$5,
                                 "workingHours"=$6,
                                 "onlineAvailability" = case when  "isEcommerceDefault"  = true then true else $7 end ,
                                 "deliveryTimes" = $8,
                                 "updatedTime"=$9,
                                 "closingTime"=$10,
                                 "customFields"=$11,
                                 "translation"= $12
                              WHERE id = ($13) 
                              AND "companyId" = ($14)`,
        values: [branch.name, branch.address, branch.location, branch.coveredAddresses, branch.phoneNumber, branch.workingHours, branch.onlineAvailability, branch.deliveryTimes, branch.updatedTime, branch.closingTime, JSON.stringify(branch.customFields), branch.translation, branch.id, branch.companyId],

      };
      (await client.query(query.text, query.values)).rows;

      return new ResponseData(true, "Updated Successfully", [])
    } catch (error: any) {


      throw new Error(error.message)
    }
  }



  public static async getBranchById(branchId: string, company: Company) {
    try {
      const query: { text: string, values: any } = {
        text: 'SELECT * FROM "Branches" WHERE id = ($1)',
        values: [branchId],
      };
      const branch = (await DB.excu.query(query.text, query.values)).rows;

      const branchObj = new Branches()
      const storage = new FileStorage();
      /** retrive the file of branch addresses */
      const deliveryAddresses = (await storage.getDeliveryAddresses(company.country)).addresses;

      branchObj.ParseJson(branch[0])
      branchObj.countryAddresses = deliveryAddresses
      return new ResponseData(true, "", branchObj)
    } catch (error: any) {

      throw new Error(error.message)
    }
  }

  //"storeId": "8d7fcf9d-edff-441e-b3c0-3890546cde1e",


  public static async getBranchByStoreId(client: PoolClient, gruptechstoreid: string) {
    try {
      const query: { text: string, values: any } = {
        text: `select b.* from(     
              select jsonb_array_elements("settings"->'branches')->>'branchId' as  branchId ,jsonb_array_elements("settings"->'branches')->>'storeId' as storeID
              from "Plugins" p 
              where "pluginName" ='GrubTech' 
              ) as s join "Branches" b on s.branchId = b.id::text where storeID = $1`,
        values: [gruptechstoreid],
      };
      const branch = (await client.query(query.text, query.values)).rows;

      const branchObj = new Branches()
      const storage = new FileStorage();
      branchObj.ParseJson(branch[0])
      return branchObj
    } catch (error: any) {

      throw new Error(error.message)
    }
  }


  public static async getAllBranchesList(client: PoolClient) {
    try {

      //TODO: REPLACE 
      /**
       * SELECT 
        "Branches".id,
        "Branches".name,
        "Terminals".id as "terminalId" 
        FROM "Branches" 
        INNER JOIN "Companies" ON "Companies".id = "Branches"."companyId" 
        left JOIN "Terminals" ON "Terminals"."branchId" = "Branches".id 
        AND "Terminals"."parentId" is null  AND "Terminals".connected is true
        where "Companies" .id = $1 
        order by  "Branches"."createdAt" asc
       */
      const query: { text: string } = {
        text: `SELECT 
        Branches.name,
        Branches.id,
        Branches.address,
        Branches.location,
        Branches."phoneNumber",
        Branches."index",
        "isEcommerceDefault"
        FROM "Branches" AS Branches
        INNER JOIN "Companies" AS Companies 
        ON Companies.id = Branches."companyId"
        order by Branches."index" asc
        `
      }

      const branches = await client.query(query.text);


      return new ResponseData(true, "", branches.rows)

    } catch (error: any) {

      throw new Error(error.message)
    }
  }


  public static async getBranchList(client: PoolClient|null, companyId: string) {
    try {

      //TODO: REPLACE 
      /**
       * SELECT 
        "Branches".id,
        "Branches".name,
        "Terminals".id as "terminalId" 
        FROM "Branches" 
        INNER JOIN "Companies" ON "Companies".id = "Branches"."companyId" 
        left JOIN "Terminals" ON "Terminals"."branchId" = "Branches".id 
        AND "Terminals"."parentId" is null  AND "Terminals".connected is true
        where "Companies" .id = $1 
        order by  "Branches"."createdAt" asc
       */
      const query: { text: string, values: any } = {
        text: `SELECT 
        Branches.name,
        Branches.id,
        Branches.address,
        Branches.location,
        Branches."phoneNumber",
        Branches."index",
        Branches."startSubscriptionDate",
        Branches."endSubscriptionDate",
        "isEcommerceDefault"
        FROM "Branches" AS Branches
        INNER JOIN "Companies" AS Companies 
        ON Companies.id = Branches."companyId" AND 
        Companies.id = $1 
        order by Branches."index" asc
        `,
        values: [companyId]
      }

      const branches =client?  await client.query(query.text, query.values) :  await DB.excu.query(query.text, query.values);


      return new ResponseData(true, "", branches.rows)

    } catch (error: any) {

      throw new Error(error.message)
    }
  }

  public static async getBranchListTest(client: PoolClient, company: Company, token: any) {
    try {
      company.id = "97d49fa3-d473-48f3-ac56-17d7baad4c34"

      // ------------------------------
      //test branch
      // ------------------------------
      // const query : { text: string, values: any } = {
      //   text: `SELECT 
      //   Branches.name,
      //   Branches.id,
      //   Branches.address,
      //   Branches.location,
      //   Branches."phoneNumber",
      //   Branches."index",
      //   Branches."companyId",
      //   Branches."coveredAddresses",
      //   Companies.name as "merchantName"
      //   FROM "Branches" AS Branches
      //   INNER JOIN "Companies" AS Companies 
      //   ON Companies.id = Branches."companyId" AND 
      //   Companies.id = $1 
      //   order by Branches."index" asc
      //   `,
      //   values: [company.id]
      // }

      // const branches = await DB.excu.query(query.text, query.values);
      // const bb =  new BranchR()
      // for (const index in branches.rows){
      //  console.log((await bb.addBranch(branches.rows[index],company)).data)
      // }
      // return new ResponseData(true, "", branches.rows)

      // ------------------------------
      // test options
      // ------------------------------

      // console.log(company.id)

      // const query : { text: string, values: any } = {
      //   text: `SELECT
      //                 id,
      //                 name, 
      //                 price,
      //                 (case
      //                 when "Options"."translation"->'name' is not null  and  "Options"."translation"->>'name' != '{}'then

      //                 json_build_object('name',"Options"."translation"->'name') 
      //                 end) as "translation"
      //             FROM "Options"
      //             where "Options"."companyId" = $1
      //   `,
      //   values: [company.id]
      // }

      // const branches = await DB.excu.query(query.text, query.values);
      // const bb =  new whatsappProduct()
      // console.log((await bb.options(branches.rows,company)).data)

      // return new ResponseData(true, "", branches.rows)


      // ------------------------------
      //test catalog
      // ------------------------------


      const query: { text: string, values: any } = {
        text: `WITH "OptionGroupsData" AS (
                    SELECT  "Products".id AS "productId",
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
                    LEFT JOIN "Media" ON "Media".id = "Products"."mediaId"
                    LEFT JOIN "Brands" on "Brands".id = "Products"."brandid" 
                  where "Products"."companyId" = $1  `,
        values: [company.id]
      }


      const branches = await client.query(query.text, query.values);
      const bb = new whatsappProduct()

      return new ResponseData(true, "", branches.rows)

      // ------------------------------
      //get catalog list
      // ------------------------------

      // console.log(company.id)

      // const bb =  new whatsappProduct()
      // let res = (await bb.getCatalogList(company)).data
      // console.log(res)

      // return new ResponseData(true, "", res)

      // ------------------------------
      // test sections
      // ------------------------------

      // console.log(company.id)

      // const query : { text: string, values: any } = {
      //   text: `select 
      //             distinct on ("MenuSection".id) "MenuSection".id, 
      //             "MenuSection".name,
      //             "MenuSection".index,
      //             "productList"."products"
      //             from "MenuSection"
      //             INNER JOIN "Menu" ON "Menu".id =  "MenuSection"."menuId"
      //             left join lateral (SELECT  "menuSectionId",json_agg( "productId" )as "products"
      //                       from "MenuSectionProduct"
      //                       group by "menuSectionId"
      //                       ) as "productList" ON "productList"."menuSectionId" = "MenuSection".id
      //             cross JOIN LATERAL JSONB_ARRAY_ELEMENTS("Menu"."branchIds") AS "branches"(branch)
      //             where "Menu"."companyId" =$1
      //   `,
      //   values: [company.id]
      // }

      // const branches = await DB.excu.query(query.text, query.values);
      // const bb =  new whatsappProduct()
      // console.log((await bb.Groups(branches.rows,company)).data)

      // return new ResponseData(true, "", branches.rows)



    } catch (error: any) {

      throw new Error(error.message)
    }
  }



  public static async getBranchListTest3(client: PoolClient, company: Company) {
    try {

      //     // Render the HTML string


      //     //const url = "https://google.com";


      // const browser = await puppeteer.launch();
      // const page = await browser.newPage();

      // // Navigate the page to a URL
      // await page.goto('https://pptr.dev/');
      // await page.pdf({ path: './newfile.pdf' })



      //     // Set screen size
      //     //  await page.setViewport({width: 1080, height: 1024});

      //     //  // Type into search box
      //     //  await page.type('.devsite-search-field', 'automate beyond recorder');

      //     //  // Wait and click on first result
      //     //  const searchResultSelector = '.devsite-result-item-link';
      //     //  await page.waitForSelector(searchResultSelector);
      //     //  await page.click(searchResultSelector);

      //     // Locate the full title with a unique string
      //     //  const textSelector = await page.waitForSelector(
      //     //    'text/Customize and automate'
      //     //  );
      //     //  const fullTitle = await textSelector?.evaluate(el => el.textContent);

      //     //  // Print the full title
      //     //  console.log('The title of this blog post is "%s".', fullTitle);

      // await browser.close();


      return new ResponseData(true, "", {})



    } catch (error: any) {
      console.log(error)

      throw new Error(error.message)
    }
  }



  public static async getDeliveryAddresses(company: Company) {
    try {
      let fileStorage = new FileStorage();
      let addresses = await fileStorage.getDeliveryAddresses(company.country);
      return new ResponseData(true, "", addresses.addresses)

    } catch (error: any) {


      throw new Error(error)
    }
  }



  // public static async getBranches(data: any, companyId: string, employeeId: string) {
  //   try {




  //     let sort = data.sortBy;
  //     let sortValue = !sort ? ' Branches."index" ' : '"' + sort.sortValue + '"';



  //     let sortDirection = !sort ? "asc" : sort.sortDirection;
  //     let sortTerm = sortValue + " " + sortDirection
  //     let orderByQuery = ` Order by ` + sortTerm



  //     let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';


  //     let offset = 0
  //     let page = data.page ?? 1;

  //     const limit = ((data.limit == null) ? 15 : data.limit);
  //     if (page != 1) {
  //       offset = (limit * (page - 1))
  //     }

  //     let isSuperAdmin = await EmployeeRepo.isEmployeeSupperAdmin(employeeId);
  //     let isInvitedUser = await companyEmployeeRepo.checkInvitedEmployee(employeeId, companyId)
  //     let selectValues = [employeeId, searchValue, limit, offset]



  //     let filterQuery = ` where (Branches.id = any (select( jsonb_array_elements("branches")->>'id')::uuid
  //                                                         from "Employees" 
  //                                                         where "Employees".id =$1 ) )
  //                                                         and (LOWER(Branches.name) ~ $2 )

  //                                                   `
  //     if (isSuperAdmin) {
  //       filterQuery = ` WHERE Branches."companyId" = $1 and (LOWER(Branches.name) ~ $2 )`
  //       selectValues = [companyId, searchValue, limit, offset]
  //     }
  //     if (isInvitedUser) {
  //       filterQuery = ` where (Branches.id = any (select( jsonb_array_elements("branches")->>'id')::uuid
  //                                                         from "CompanyEmployees" 
  //                                                         where "CompanyEmployees"."employeeId" =$1 and "CompanyEmployees"."companyId" = $1  ) )
  //                                                         and (LOWER(Branches.name) ~ $2 )`
  //       selectValues = [companyId, searchValue, limit, offset]
  //     }

  //     let limitQuery = ` limit $3 offset $4 `

  //     const query: { text: string, values: any } = {
  //       text: `SELECT 
  //             COUNT(*) OVER(),
  //             Branches.name,
  //             Branches.id,
  //             Branches.address,
  //             Branches.location,
  //             Branches."phoneNumber",
  //             "startSubscriptionDate",
  //             "endSubscriptionDate",
  //             "isEcommerceDefault"
  //         FROM "Branches" AS Branches
  //         ${filterQuery}
  //         ${orderByQuery}
  //         ${limitQuery}
  //         `,
  //       values: selectValues
  //     }

  //     const selectList = await DB.excu.query(query.text, query.values)


  //     let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
  //     let pageCount = Math.ceil(count / data.limit)
  //     offset += 1;
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
  //   } catch (error: any) {
  //   

  //     throw new Error(error)
  //   }
  // }

  public static async getBranches(data: any, companyId: string, employeeId: string) {
    try {

      let withWearhouse = data.withWearhouse ?? false;

      //############## filter ##############
      let filterQuery = `where Branches."companyId" = $1 
                               AND Branches."endSubscriptionDate" is not null  AND  Branches."endSubscriptionDate" >= NOW()
                              and ( $2::uuid[] is null or  Branches.id = any($2::uuid[]) )`
      let searchValue = data.searchTerm ? `%` + data.searchTerm.toLowerCase().trim() + `%` : null;
      if (searchValue) {
        filterQuery += `and Branches.name ilike ${searchValue}
                          
                `
      }

      let branchIds = null;
      let isSuperAdmin = await EmployeeRepo.isEmployeeSupperAdmin(employeeId, companyId);
      if (!isSuperAdmin) {
        branchIds = await this.getEmployeeBranches(employeeId, companyId);
      }

      //############## Sort ##############
      let sort = data.sortBy;
      let sortValue = !sort ? ' Branches."index" ' : '"' + sort.sortValue + '"';
      let sortDirection = !sort ? "asc" : sort.sortDirection;
      let sortTerm = sortValue + " " + sortDirection
      let orderByQuery = `   Order by ` + sortTerm

      //############## limit ##############
      let offset = 0;
      const limit = ((data.limit == null) ? 15 : data.limit);
      let page = data.page ?? 1
      if (page != 1) {
        offset = (limit * (page - 1))
      }
      let limitQuery = ` limit $3 offset $4 `

      //############## Select ##############
      const query: { text: string, values: any } = {
        text: `
                  SELECT 
                        COUNT(*) OVER(),
                        Branches.name,
                        Branches.id,
                        Branches.address,
                        Branches.location,
                        Branches.translation,
                        Branches."phoneNumber",
                        "startSubscriptionDate",
                        "endSubscriptionDate",
                        "isWearhouse",
                        "isEcommerceDefault"
                    FROM "Branches" AS Branches
          ${filterQuery}
          ${orderByQuery}
          ${limitQuery}
          `,
        values: [companyId, branchIds, limit, offset]
      }
      const selectList = await DB.excu.query(query.text, query.values)


      let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
      let pageCount = Math.ceil(count / data.limit)
      offset += 1;
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



  public static async getBranchCompanyId(client: PoolClient | null, branchId: string) {
    try {
      let data;
      let cachedData = await RedisCaching.getCatchingData(`company_${branchId}_data`);
      if (cachedData && cachedData.success && cachedData.data) {
        try {
          data = JSON.parse(cachedData.data);
          return data
        } catch {
          data = null;
        }
      }
      const query: { text: string, values: any } = {
        text: `SELECT "companyId" , country , "Companies" ."hasCallCenter" from "Branches"
             inner join "Companies" on "Companies".id = "Branches"."companyId"
               where "Branches".id =$1
               `,
        values: [branchId]
      }

      const branch = client ? await client.query(query.text, query.values) : await DB.excu.query(query.text, query.values);

      data = { country: branch.rows.length > 0 ? (<any>branch.rows[0]).country : null, compayId: branch.rows.length > 0 ? (<any>branch.rows[0]).companyId : null, hasCallCenter: branch.rows.length > 0 ? (<any>branch.rows[0]).hasCallCenter : false }

      if (data) {
        await RedisCaching.setCatchData(`company_${branchId}_data`, data);
      }
      return data
    } catch (error: any) {

      throw new Error(error.message)
    }
  }
  public static async getCompanyBranchIds(client: PoolClient, companyId: string) {
    try {
      const query: { name: string, text: string, values: any } = {
        name: "getCompanyBranchIds",
        text: `SELECT id from "Branches" where "companyId" = $1`,
        values: [companyId]
      }
      const list = await client.query(query.text, query.values);
      const branchIds: any = [];
      list.rows.forEach((element: any) => {
        branchIds.push(element.id)
      });
      return branchIds
    } catch (error: any) {
      console.log(error)

      return null
    }
  }
  public static async getCompanyType(client: PoolClient, branchId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT type 
         FROM "Companies" AS Companies 
         INNER JOIN "Branches" AS Branches
         ON Companies.id = Branches."companyId"
         AND Branches.id =$1 `,
        values: [branchId]
      }
      const brand = await client.query(query.text, query.values);
      return brand.rows[0].type
    } catch (error: any) {

      throw new Error(error.message)
    }
  }
  public static async getBranchCoveredAddresses(client: PoolClient, branchId: string, date: any | null = null) {
    try {
      const query: { text: string, values: any } = {
        text: `Select "coveredAddresses" from "Branches" where id= $1`,
        values: [branchId]
      }
      if (date != null) {
        query.text = `Select "coveredAddresses" from "Branches" where id= $1 AND "updatedTime" >=$2 `
        query.values = [branchId, date]
      }
      const addresses = await client.query(query.text, query.values);

      return new ResponseData(true, "", { coveredAddresses: addresses.rows && addresses.rows.length > 0 ? (<any>addresses.rows[0]).coveredAddresses : null })
    } catch (error: any) {


      throw new Error(error)
    }
  }


  public static async getBranchAddresses(client: PoolClient, branchId: string, company: Company) {

    try {


      let addresses = (await BranchesRepo.getBranchCoveredAddresses(client, branchId)).data.coveredAddresses;

      const storage = new FileStorage();
      const deliveryAddresses = (await storage.getDeliveryAddresses(company.country)).addresses;


      let list: any[] = []

      if (addresses && JSON.stringify(addresses) != '{}') {

        let type = addresses.type;
        if (addresses.coveredAddresses) {
          addresses.coveredAddresses.forEach((coveredAddress: any) => {
            let temp = deliveryAddresses.filter((f: any) => f[type] == coveredAddress.address);
            temp.forEach((element: any) => {
              list.push(element)
            });
          });
        }

        addresses.list = list;
      } else {
        addresses = new BranchDeliveryAddress()
      }


      return new ResponseData(true, "", addresses)
    } catch (error: any) {



      throw new Error(error)
    }
  }

  public static async getBranchesWithStatus(company: Company) {
    try {


      const currentDate = await TimeHelper.getCurrentDateWithTimeZone(company.timeOffset)

      const query: { text: string, values: any } = {
        text: `select 
                    id, 
                    name,
                    address,
                    location,
                    "phoneNumber",
                    "onlineAvailability",
                    "workingHours" as "workingSchedule",
                    "workingHours"->> trim(TO_CHAR(CURRENT_DATE, 'Day')) as "workingHours",
                    "deliveryTimes" as "deliveryTimes", 
                    "ecommerceSettings",
                    case when  (((("ecommerceSettings"->>'delivery'))::jsonb)->>'pauseUntil')::TIMESTAMP >= $2  or   (((("ecommerceSettings"->>'delivery'))::jsonb)->>'active')::boolean  = false THEN TRUE ELSE FALSE END AS "deliveryIsBusy",
                    case when  (((("ecommerceSettings"->>'pickUp'))::jsonb)->>'pauseUntil')::TIMESTAMP >= $2 or   (((("ecommerceSettings"->>'pickUp'))::jsonb)->>'active')::boolean  = false THEN TRUE ELSE FALSE END AS "pickUpIsBusy"
                from "Branches"
                where "Branches"."companyId"=$1
                AND  "Branches"."endSubscriptionDate" is not null 
                AND "Branches"."endSubscriptionDate" >= NOW()
                and "onlineAvailability" = true 
                `,
        values: [company.id, currentDate]
      }


      //get all branches in the current company
      let branches: any = await DB.excu.query(query.text, query.values);
      // console.log(branches.rows);
      let timeOffset = 3;
      if (company.timeOffset.startsWith('+')) {
        let offset = Number(company.timeOffset.split("+")[1])
        timeOffset = offset
      } else {
        let offset = Number(company.timeOffset.split("-")[1])
        timeOffset = offset
      }

      let brancList: any[] = [];           // set branch list
      let currentTime = new Date();       //get current time to compare it with the working hours of the branch

      currentTime = await TimeHelper.getCurrentDateWithTimeZone(company.timeOffset)

      // check working hours of each branch and set the status of the branch(open or close)
      branches.rows.forEach((element: any) => {

        //if the working hour is null set branch status: open
        element.currentStatus = "open";

        if (element.workingHours != null && element.workingHours.length > 0) {

          let workingHours: any[] = JSON.parse(element.workingHours);

          for (const c of workingHours) {

            let fromHour = Number(c.from.split(":")[0])
            let fromMin = Number(c.from.split(":")[1])
            let openingTime = new Date();
            openingTime.setUTCHours(fromHour, fromMin, 0)
            openingTime.setUTCFullYear(currentTime.getFullYear())
            openingTime.setUTCMonth(currentTime.getMonth())
            openingTime.setUTCDate(currentTime.getDate())
            if (element.id == 'b3cac885-ba05-4d0c-8a61-ac77da18a84d') {
              // console.log("opening before",openingTime)
            }
            // openingTime = TimeHelper.convertTimeZone(openingTime,company.timeOffset)


            let toHour = Number(c.to.split(":")[0])
            let toMin = Number(c.to.split(":")[1])

            let closingTime = new Date();
            closingTime.setUTCHours(toHour, toMin, 0)
            closingTime.setUTCFullYear(currentTime.getFullYear())
            closingTime.setUTCMonth(currentTime.getMonth())
            closingTime.setUTCDate(currentTime.getDate())




            if (c.from == c.to) {
              element.currentStatus = "open";
              break;
            }
            console.log("testttttt", currentTime.getTime() >= openingTime.getTime())
            console.log("testttttt", currentTime.getTime() <= closingTime.getTime(), currentTime, closingTime)
            if (currentTime.getTime() >= openingTime.getTime() && currentTime.getTime() <= closingTime.getTime()) {
              element.currentStatus = "open";
              break;
            }
            element.currentStatus = "close";
          }

        } else {
          element.currentStatus = "close";
        }



        brancList.push(element)
      });

      return new ResponseData(true, "", brancList)

    } catch (error: any) {

      throw new Error(error)
    }
  }

  public static async getBranchesStatus(branchId: string, company: Company) {
    try {


      const currentDate = await TimeHelper.getCurrentDateWithTimeZone(company.timeOffset)

      const query: { text: string, values: any } = {
        text: `select 
                    id, 
                    name,
                    address,
                    location,
                    "phoneNumber",
                    "onlineAvailability",
                    "workingHours" as "workingSchedule",
                     "deliveryTimes" as  "deliveryTimes",
                    "workingHours"->> trim(TO_CHAR(CURRENT_DATE, 'Day')) as "workingHours",
                    "deliveryTimes"->> trim(TO_CHAR(CURRENT_DATE, 'Day'))  as "deliveryWorkingTimes", 
                    "ecommerceSettings",
                    case when  (((("ecommerceSettings"->>'delivery'))::jsonb)->>'pauseUntil')::TIMESTAMP >= $2  or   (((("ecommerceSettings"->>'delivery'))::jsonb)->>'active')::boolean  = false THEN TRUE ELSE FALSE END AS "deliveryIsBusy",
                    case when  (((("ecommerceSettings"->>'pickUp'))::jsonb)->>'pauseUntil')::TIMESTAMP >= $2 or   (((("ecommerceSettings"->>'pickUp'))::jsonb)->>'active')::boolean  = false THEN TRUE ELSE FALSE END AS "pickUpIsBusy"
                from "Branches"
                where "Branches".id  = $3
                
                and "Branches"."companyId"=$1
                
                `,
        values: [company.id, currentDate, branchId]
      }

      //get all branches in the current company
      let branches: any = await DB.excu.query(query.text, query.values);

      // console.log(branches.rows);
      let timeOffset = 3;
      if (company.timeOffset.startsWith('+')) {
        let offset = Number(company.timeOffset.split("+")[1])
        timeOffset = offset
      } else {
        let offset = Number(company.timeOffset.split("-")[1])
        timeOffset = offset
      }

      let currentTime = new Date();       //get current time to compare it with the working hours of the branch

      currentTime = await TimeHelper.getCurrentDateWithTimeZone(company.timeOffset)

      // check working hours of each branch and set the status of the branch(open or close)
      const element = branches.rows[0]

      //if the working hour is null set branch status: open
      element.pickUpStatus = "open";
      /** PickUp Timing */
      if (element.workingHours != null && element.workingHours.length > 0) {

        let workingHours: any[] = JSON.parse(element.workingHours);

        for (const c of workingHours) {

          let fromHour = Number(c.from.split(":")[0])
          let fromMin = Number(c.from.split(":")[1])
          let openingTime = new Date();
          openingTime.setUTCHours(fromHour, fromMin, 0)
          openingTime.setUTCFullYear(currentTime.getFullYear())
          openingTime.setUTCMonth(currentTime.getMonth())
          openingTime.setUTCDate(currentTime.getDate())

          let toHour = Number(c.to.split(":")[0])
          let toMin = Number(c.to.split(":")[1])

          let closingTime = new Date();
          closingTime.setUTCHours(toHour, toMin, 0)
          closingTime.setUTCFullYear(currentTime.getFullYear())
          closingTime.setUTCMonth(currentTime.getMonth())
          closingTime.setUTCDate(currentTime.getDate())



          if (c.from == c.to) {
            element.pickUpStatus = "open";
            break;
          }
          console.log("testttttt", currentTime.getTime() >= openingTime.getTime())
          console.log("testttttt", currentTime.getTime() <= closingTime.getTime(), currentTime, closingTime)
          if (currentTime.getTime() >= openingTime.getTime() && currentTime.getTime() <= closingTime.getTime()) {
            element.pickUpStatus = "open";
            break;
          }
          element.pickUpStatus = "close";
        }

      } else {
        element.pickUpStatus = "close";
      }

      /** Delivery Timing */
      element.deliveryStatus = "open";
      if (element.deliveryWorkingTimes != null && element.deliveryWorkingTimes.length > 0) {

        let deliveryWorkingTimes: any[] = JSON.parse(element.deliveryWorkingTimes);

        for (const c of deliveryWorkingTimes) {

          let fromHour = Number(c.from.split(":")[0])
          let fromMin = Number(c.from.split(":")[1])
          let openingTime = new Date();
          openingTime.setUTCHours(fromHour, fromMin, 0)
          openingTime.setUTCFullYear(currentTime.getFullYear())
          openingTime.setUTCMonth(currentTime.getMonth())
          openingTime.setUTCDate(currentTime.getDate())

          let toHour = Number(c.to.split(":")[0])
          let toMin = Number(c.to.split(":")[1])

          let closingTime = new Date();
          closingTime.setUTCHours(toHour, toMin, 0)
          closingTime.setUTCFullYear(currentTime.getFullYear())
          closingTime.setUTCMonth(currentTime.getMonth())
          closingTime.setUTCDate(currentTime.getDate())



          if (c.from == c.to) {
            element.deliveryStatus = "open";
            break;
          }
          console.log("testttttt", currentTime.getTime() >= openingTime.getTime())
          console.log("testttttt", currentTime.getTime() <= closingTime.getTime(), currentTime, closingTime)
          if (currentTime.getTime() >= openingTime.getTime() && currentTime.getTime() <= closingTime.getTime()) {
            element.deliveryStatus = "open";
            break;
          }
          element.deliveryStatus = "close";
        }

      } else {
        element.deliveryStatus = "close";
      }




      return new ResponseData(true, "", element)

    } catch (error: any) {

      throw new Error(error)
    }
  }
  public static async loadQrData(branchId: string, tableId: string, sessionId: string, company: Company) {
    try {

      let table = await TablesRepo.getTableName(tableId);

      let service = await ServiceRepo.getDineInService(company.id);
      let data = {
        branchId: branchId,
        tabelId: tableId,
        serviceId: service.data.id,
        serviceName: "DineIn",
        tableName: table.data.name,
        sessionId: sessionId
      }

      await CartRepo.createCart(data, company)

      //change this url based on stage (dev or test)
      let baseUrl = process.env.ECOMMERCE_BASE_URL;

      let httpString = baseUrl?.split('//')
      if (httpString) {
        let redirectUrl = "";
        if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing") {
          redirectUrl = httpString[0] + '//' + company.slug + '.' + httpString[1] + '/menu?branch_id=' + branchId + "&service_name=DineIn&table_id=" + tableId;
        } else {
          redirectUrl = httpString[0] + '//' + httpString[1] + '/menu?branch_id=' + branchId + "&service_name=DineIn&table_id=" + tableId;
        }
        return new ResponseData(true, "", redirectUrl)

      }

      return new ResponseData(false, "", []);
    } catch (error: any) {


      throw new Error(error)
    }
  }

  public static async loadPagerQrData(branchId: string, tableId: string, company: Company) {
    try {
      //change this url based on stage (dev or test)
      let baseUrl = process.env.ECOMMERCE_BASE_URL;

      let table = await TablesRepo.getTableName(tableId);
      const tableName = table.data.name

      if (!tableName) { throw new ValidationException("tableNumber not found") }


      let httpString = baseUrl?.split('//')
      if (httpString) {
        let redirectUrl = "";
        if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production" || process.env.NODE_ENV === "testing") {
          redirectUrl = httpString[0] + '//' + company.slug + '.' + httpString[1] + '/pager?branch_id=' + branchId + "&table_id=" + tableId + "&table_number=" + tableName;
        } else {
          redirectUrl = httpString[0] + '//' + httpString[1] + '/pager?branch_id=' + branchId + "&table_id=" + tableId + "&table_number=" + tableName;
        }
        console.log(redirectUrl)
        return new ResponseData(true, "", redirectUrl)

      }

      return new ResponseData(false, "", []);
    } catch (error: any) {


      throw new Error(error)
    }
  }

  public static async getCompanyDeliveryAddresses2(company: Company) {
    try {

      const query: { text: string, values: any } = {
        text: `	select 
               "coveredAddresses"->>'type'as "type",
                jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'address'as "addressKey",
                jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'minimumOrder'as "minimumOrder",
                jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'deliveryCharge'as "deliveryCharge"
                from "Branches"
                where "companyId"=$1
                `,
        values: [company.id]
      }

      let addressesKeys: any[] = []
      let addresses = await DB.excu.query(query.text, query.values);


      return new ResponseData(true, "", addresses.rows)
    } catch (error: any) {


      throw new Error(error)
    }
  }

  public static async getCompanyDeliveryAddresses(company: Company) {
    try {

      const deliveryType = {
        text: `SELECT "template"->>'deliveryAreaType' as "deliveryAreaType" FROM "WebSiteBuilder" where "companyId" = $1 and "type"  = 'ThemeSettings' `,
        values: [company.id]
      }

      let type = await DB.excu.query(deliveryType.text, deliveryType.values);
      let deliveryAreaType = ""
      if (type && type.rows && type.rows.length > 0) {
        deliveryAreaType = (<any>type.rows[0]).deliveryAreaType
      }

      let addresses;
      if (!deliveryAreaType) {
        let coveredAddress = await this.getCoveredAddresses(company.id)
        if (coveredAddress) {
          deliveryAreaType = 'addresses'
          addresses = coveredAddress;
        }
      } else if (deliveryAreaType == 'addresses') {
        let coveredAddress = await this.getCoveredAddresses(company.id)

        addresses = coveredAddress;


      } else if (deliveryAreaType == 'zones') {
        let zones = await this.getCompanyZones(company.id)
        addresses = zones.data.coveredZones == null ? null : zones.data

      }

      if (!addresses) {
        throw new ValidationException("no addresses is found")
      }
      let resData = {
        deliveryAreaType: deliveryAreaType,
        addresses: addresses
      }
      return new ResponseData(true, "", resData)
    } catch (error: any) {


      throw new Error(error)
    }
  }

  public static async getCoveredAddresses(companyId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `	select 
               "coveredAddresses"->>'type'as "type",
                jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'address'as "addressKey",
                jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'minimumOrder'as "minimumOrder",
                jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'deliveryCharge'as "deliveryCharge",
                jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'freeDeliveryOver'as "freeDeliveryOver",
                (jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'translation')::jsonb as "translation",
                         jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'note' as "note"
                from "Branches"
                
                where "companyId"=$1
                and "onlineAvailability" = true
                `,
        values: [companyId]
      }

      let addressesKeys: any[] = []
      let addresses = await DB.excu.query(query.text, query.values);
      if (addresses && addresses.rows && addresses.rows.length > 0) {
        return addresses.rows
      } else {
        return null
      }
    } catch (error: any) {
      throw new Error(error)
    }
  }


  public static async getAddressKeyBranchId(companyId: string, addressKey: string) {
    try {



      const query: { text: string, values: any } = {
        text: `with "addresses" as (select 
                  "coveredAddresses"->>'type' as type,
                  jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'address'as "addressKey",
                  jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'minimumOrder'as "minimumOrder",
                  jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'deliveryCharge'as "deliveryCharge",
                  jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'freeDeliveryOver'as "freeDeliveryOver",
                  jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'note'as "note",
                  "Branches".id as "branchId", 
                  "Branches"."name" as "branchName"
                  from "Branches"
                  where "companyId" = $1
                  and "Branches"."onlineAvailability" = true
                )
                  select * from "addresses"
                  where "addressKey" = $2 `,
        values: [companyId, addressKey]
      }

      let branch = await DB.excu.query(query.text, query.values);
      let data: any

      if (branch.rows.length > 0) {
        data = {
          id: (<any>branch.rows[0]).branchId,
          deliveryCharge: (<any>branch.rows[0]).deliveryCharge,
          minimumOrder: (<any>branch.rows[0]).minimumOrder,
          branchName: (<any>branch.rows[0]).branchName,
          freeDeliveryOver: (<any>branch.rows[0]).freeDeliveryOver,
          note: (<any>branch.rows[0]).note,
        }
      }
      if (branch.rows.length == 0) {
        data = null
      }
      return new ResponseData(true, "", data)
    } catch (error: any) {

      console.log(error)
      throw new Error(error)
    }
  }


  public static async getBranchName(branchId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT name from "Branches" where id =$1`,
        values: [branchId]
      }
      let branch = await DB.excu.query(query.text, query.values);
      return branch.rows && branch.rows.length > 0 ? (<any>branch.rows[0]).name : null
    } catch (error: any) {


      throw new Error(error)
    }
  }

  public static async rearrangeBranches(data: any) {
    const client = await DB.excu.client();
    try {
      await client.query("BEGIN")
      let updateDate = new Date()

      for (let index = 0; index < data.length; index++) {
        const element = data[index];

        let query = `UPDATE "Branches" set index=$1,"updatedTime"=$2 where id=$3`;
        let values = [element.index, element.updatedTime, element.id];

        await client.query(query, values)
      }
      await client.query("COMMIT")
      return new ResponseData(true, "", [])
    } catch (error: any) {
      await client.query("ROLLBACK")

      throw new Error(error)
    } finally {
      client.release()
    }
  }

  public static async getEmployeeBranches(employeeId: string, companyId: string) {
    try {
      let branchIds: any = [];
      const query: { text: string, values: any } = {
        text: `select branches from "Employees" where id =$1 and "companyId" = $2
              union 
              select branches from "CompanyEmployees" where "employeeId" =$1 and "companyId" = $2
              `,
        values: [employeeId, companyId]
      }

      let branch = await DB.excu.query(query.text, query.values);

      if (branch.rows && branch.rows.length > 0) {

        branch.rows[0].branches.forEach((element: any) => {
          branchIds.push(element.id);
        });
        return branchIds

      }
      return null;

    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async getBranchConnectionList(company: Company, employeeId: string) {
    const client = await DB.excu.client();
    try {
      await client.query("BEGIN");
      let isSuperAdmin = await EmployeeRepo.isEmployeeSupperAdmin(employeeId, company.id);

      let branchIds = [];
      if (!isSuperAdmin) {
        branchIds = await this.getEmployeeBranches(employeeId, company.id);
      }

      let query = `SELECT DISTINCT("Branches".id),
                      "Branches".name,
                      "Terminals".id as "terminalId", 
                      "Terminals".name as "terminalName"
               from "Branches"
               LEFT JOIN "Terminals" on "Terminals"."branchId" = "Branches".id and "Terminals"."token" is not null and "parentId" is null
               `
      let values;
      if (isSuperAdmin) {
        query += ` where "Branches"."companyId"= $1   and "Branches"."endSubscriptionDate" is not null  and "Branches"."endSubscriptionDate" >= NOW()  AND  "isWearhouse" = FALSE`,
          values = [company.id]
      } else {
        query += ` where "Branches".id = any($1)     and "Branches"."endSubscriptionDate" is not null AND "Branches"."endSubscriptionDate" >= NOW()   AND  "isWearhouse" = FALSE`,
          values = [branchIds]
      }

      let branchList = await client.query(query, values);
      await client.query("COMMIT");
      return new ResponseData(true, "", { list: branchList.rows })


    } catch (error: any) {

      await client.query("ROLLBACK");
      throw new Error(error);
    } finally {
      client.release()
    }
  }


  public static async getBranchClosingTime(client: PoolClient | null, branchId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `Select "closingTime" from "Branches" where id= $1`,
        values: [branchId]
      }

      const closingTime = await DB.excu.query(query.text, query.values);

      return new ResponseData(true, "", { closingTime: closingTime.rows && closingTime.rows.length > 0 ? (<any>closingTime.rows[0]).closingTime : '' })
    } catch (error: any) {


      throw new Error(error)
    }
  }

  public static async setDefaultEcommerceBranch(branchId: string, companyId: string) {
    try {
      const query = {
        text: `update "Branches" set "isEcommerceDefault" = case when id = $1::uuid then true else false end ,
                                  "onlineAvailability" = case when id = $1::uuid then true else   "onlineAvailability" end
                 where "companyId" = $2::uuid`,
        values: [branchId, companyId]
      }

      await DB.excu.query(query.text, query.values)
      return new ResponseData(true, "", [])

    } catch (error: any) {
      throw new Error(error)
    }
  }


  public static async getDefaultEcommerceBranch(companyId: string, client: PoolClient | null = null) {
    try {
      // `SELECT id,name from "Branches" where "companyId" = $1 and ("isEcommerceDefault" =$2)
      //                limit 1`
      const query = {
        text: `WITH BranchesCTE AS (
                  SELECT id, name, "isEcommerceDefault","index"
                  FROM "Branches"
            
                  WHERE "companyId" = $1
                        and "onlineAvailability" = true
              )
              SELECT id, name
              FROM BranchesCTE
              WHERE "isEcommerceDefault" =$2
              or(  "isEcommerceDefault" = false  and (SELECT COUNT(*) FROM BranchesCTE WHERE "isEcommerceDefault" = TRUE) = 0 and  ( "index" = $3 OR  "index" = 1 or "index" is null) )
              ORDER BY "isEcommerceDefault" DESC
              LIMIT 1`,
        values: [companyId, true, 0]
      }

      let branch

      if (client) {
        branch = await client.query(query.text, query.values)
      } else {
        branch = await DB.excu.query(query.text, query.values)
      }


      return { branch: branch.rows && branch.rows.length > 0 ? branch.rows[0] : null }
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async setMainBranch(branchId: string, mainBranch: boolean, companyId: string) {
    try {
      const query = {
        text: `update "Branches" set "mainBranch" = case when id = $1::uuid then $3 else false end 
                 where "companyId" = $2::uuid`,
        values: [branchId, companyId, mainBranch]
      }

      await DB.excu.query(query.text, query.values)
      return new ResponseData(true, "", [])

    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async getMainBranch(client: PoolClient | null, companyId: string) {
    try {
      // `SELECT id,name from "Branches" where "companyId" = $1 and ("isEcommerceDefault" =$2)
      //                limit 1`
      const query = {
        text: `WITH BranchesCTE AS (
                  SELECT id, name, "mainBranch","index"
                  FROM "Branches"
                  WHERE "companyId" = $1
              )
              SELECT id, name
              FROM BranchesCTE
              WHERE "mainBranch" =$2
              or(  ("mainBranch" = false  OR "mainBranch" is null  )    and (SELECT COUNT(*) FROM BranchesCTE WHERE "mainBranch" = TRUE) = 0 and  ( "index"=0 or "index" = 1 or "index" is null) )
              ORDER BY "mainBranch" DESC
              LIMIT 1;`,
        values: [companyId, true]
      }

      let branch = client ? await client.query(query.text, query.values) : await DB.excu.query(query.text, query.values)

      return { branch: branch.rows && branch.rows.length > 0 ? branch.rows[0] : null }
    } catch (error: any) {
      throw new Error(error)
    }
  }


  public static async validateServiceAvailability(client: PoolClient, serviceName: string | null, branchId: string, timeOffset: string) {
    try {


      let whereClause = `WHERE "Branches".id = $1`
      let values: any[] = [branchId];
      const currentDate = await TimeHelper.getCurrentDateWithTimeZone(timeOffset)
      if (!serviceName) {
        throw new ValidationException("Service Name Is Require")
      }
      switch (serviceName) {
        case 'Delivery':
          whereClause += ` and ( COALESCE(("ecommerceSettings"->>'disableDelivery')::boolean,false) = true
                            or "ecommerceSettings"->>'pauseDeliveryUntil' >=  $2 ) `;
          values.push(currentDate);
          break;
        case 'PickUp':
          whereClause += ` and( COALESCE(("ecommerceSettings"->>'disablePickup')::boolean,false) = true
          or "ecommerceSettings"->>'pausePickupUntil' >=  $2 ) `;
          values.push(currentDate);
          break;
        default:
          return;
      }


      let query = {
        text: `SELECT COUNT(*) FROM "Branches" ${whereClause} `,
        values: values
      }

      let branch = await client.query(query.text, query.values);
      if (branch && branch.rows && branch.rows.length > 0 && branch.rows[0].count > 0) {
        throw new ValidationException(`${serviceName} is Busy`)
      }
    } catch (error: any) {
      throw new Error(error)
    }
  }


  public static async saveBranchLocation(data: any, companyId: string) {
    try {

      let location = data.location
      let branchId = data.branchId;
      const validate = await BranchValdation.branchLocationValidation(data);
      if (!validate.valid) {
        throw new ValidationException(validate.error)
      }
      const query = {
        text: `UPDATE "Branches" SET "location" =$1 where "id" = $2 and "companyId"=$3`,
        values: [location, branchId, companyId]
      }

      await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", [])
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async setCompanyZones(data: any, companyId: string) {
    try {



      const validate = await BranchValdation.companyZonesValidation(data);
      let coveredZones = data.coveredZones
      if (!validate.valid) {
        throw new ValidationException(validate.error)
      }
      const query = {
        text: `UPDATE "Companies" SET "coveredZones" =$1 where "id"=$2`,
        values: [JSON.stringify(coveredZones), companyId]
      }

      await DB.excu.query(query.text, query.values);
      return new ResponseData(true, "", [])
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async getCompanyZones(companyId: string) {
    try {



      const query = {
        text: `select  "coveredZones" ,JSON_AGG(JSON_BUILD_OBJECT('id',"Branches".id,'name',"Branches"."name",'location',"Branches"."location")) as "branches" from   "Companies" 
                inner join "Branches" on "Branches"."companyId" =   "Companies".id
           where "Companies"."id"=$1
           and "onlineAvailability" = true
           group by  "Companies".id
           `,
        values: [companyId]
      }



      let data = await DB.excu.query(query.text, query.values);

      return new ResponseData(true, "", data.rows[0])
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async getbranchesIds(companyId: string) {
    try {

      const query = {
        text: `select  id from "Branches"
           where "Companies"."id"=$1
           `,
        values: [companyId]
      }

      let data = await DB.excu.query(query.text, query.values);
      const branches = (data.rows && data.rows.length > 0) ? data.rows : []

      return new ResponseData(true, "", branches)
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async setBranchSubscription(data: any, branchId: string) {
    const client = await DB.excu.client()
    try {


      client.query("BEGIN")
      let endSubscriptionDate = data.endSubscriptionDate;

      const query = {
        text: `UPDATE "Branches" SET "endSubscriptionDate"=$1 WHERE id=$2`,
        values: [endSubscriptionDate, branchId]
      }

      await client.query(query.text, query.values)

      await client.query(`update "Companies" set "updatedDate" = CURRENT_TIMESTAMP WHERE id=(select "companyId" from "Branches" where id =$1) `, [branchId])
      client.query("COMMIT")
      return new ResponseData(true, "", [])
    } catch (error: any) {
      client.query("ROLLBACK")
      throw new Error(error)
    } finally {
      client.release()
    }
  }


  public static async hasActiveBranches(companyId: string | null, branchId: string | null = null) {
    try {
      const query = {
        TEXT: `SELECT COUNT(*) FROM "Branches" where ($1::uuid is null or "companyId" =$1) and ($2::uuid is null or id = $2) and "Branches"."endSubscriptionDate" is not null and "Branches"."endSubscriptionDate" >= NOW()`,
        VALUES: [companyId, branchId]
      }

      let branches = await DB.excu.query(query.TEXT, query.VALUES);
      if (branches && branches.rows && branches.rows[0].count > 0) {
        return true
      }
      return false
    } catch (error: any) {
      throw new Error(error)
    }



  }

  public static async getAllBranches(compnayId: string, employeeId: string) {
    try {
      const query = {
        text: `SELECT b.id, b.name, b."translation"
                      FROM "Branches" b
                      JOIN "Employees" e ON  e."companyId" = $1 and e.id = $2
                      WHERE b."companyId" = $1
                        AND (
                            e."superAdmin" = true
                            OR (
                                e."superAdmin" = false
                                AND EXISTS (
                                    SELECT 1
                                    FROM jsonb_array_elements(e."branches") AS el
                                    WHERE (el->>'id')::uuid = b.id
                                )
                            )
                        )
             union  
             SELECT b.id, b.name, b."translation"
                      FROM "Branches" b
                      JOIN "CompanyEmployees" e ON  e."companyId" = $1 and e."employeeId" = $2
                      WHERE b."companyId" = $1
                        AND (
                            e."superAdmin" = true
                            OR (
                                e."superAdmin" = false
                                AND EXISTS (
                                    SELECT 1
                                    FROM jsonb_array_elements(e."branches") AS el
                                    WHERE (el->>'id')::uuid = b.id
                                )
                            )
                        )

        `,
        values: [compnayId, employeeId]
      }
      const branches = await DB.excu.query(query.text, query.values)

      return new ResponseData(true, "", branches.rows)
    } catch (error: any) {
      throw new Error(error)
    }
  }
}
