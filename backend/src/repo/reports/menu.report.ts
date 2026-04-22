import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Company } from "@src/models/admin/company";
import { Helper } from "@src/utilts/helper";
import { TimeHelper } from "@src/utilts/timeHelper";
import moment from "moment-timezone"

import _ from 'lodash';
import { DataColumn, ReportData } from "@src/utilts/xlsxGenerator";
import { BranchesRepo } from "../admin/branches.repo";

export class MenuReports {

    public static async salesByProduct(data: any, company: Company, branchList: any[]) {

        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal

            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let applyOpeningHour = data.applyOpeningHour ?? false

            if (applyOpeningHour == true) {
                let branchId = branchList[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
            }

            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------

            let branches = data.branchId ? [data.branchId] : branchList;

            /**Limit, Order By and Having query are only used for dashboard */
            let limit = data.limit;
            let orderBy = '';
            let having = '';
            let limitQuery = ''
            if (limit) {
                orderBy = ` ORDER BY  CAST (SUM(T.sales) AS REAL)::NUMERIC DESC `
                having = ` Having  CAST (SUM(T.sales) AS REAL)::NUMERIC > 0  `
                limitQuery = `limit ${limit}`
            }

            const query = {
                text: `SELECT 
                            T."barcode",
                            T."productName",
                            T."categoryName",
                            SUM(T.qty)::NUMERIC AS qty,
                            SUM(COALESCE(T.sales,0)::text::numeric)  as sales
                            FROM (SELECT
                                    "Products"."barcode",
                                    COALESCE("Products".name, "InvoiceLines".note) as "productName",
                                    "Categories".name as "categoryName",
                                    COALESCE(sum("InvoiceLines".qty),0) as qty,
                                    sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end)) as sales
                                    from "InvoiceLines"
                                    INNER JOIN "Invoices" ON "InvoiceLines" ."invoiceId" = "Invoices".id
                                    LEFT JOIN "Products" ON "InvoiceLines"."productId" = "Products".id
                                    INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id
                                    LEFT JOIN"Categories" ON  "Categories".id = "Products"."categoryId"
                                    WHERE
                                    "Branches"."companyId"=$1  AND
								  ($2::uuid[] is null or "Branches".id = any($2))				
								  AND "Invoices"."status" <>'Draft' AND  "InvoiceLines"."createdAt" >=$3 AND"InvoiceLines"."createdAt" <$4
                                   GROUP BY "Products".id , "Categories".id,"InvoiceLines"."createdAt","productName"
                                 UNION ALL SELECT
             "Products"."barcode",
             COALESCE("Products".name, "CreditNoteLines".note) as "productName",
             "Categories".name as "categoryName",
             COALESCE(sum("CreditNoteLines".qty),0) *(-1) as qty,
             sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)) end))*(-1)as sales
             from "CreditNoteLines"
             INNER JOIN "CreditNotes" ON "CreditNoteLines" ."creditNoteId" = "CreditNotes".id
             LEFT  JOIN "Products" ON "CreditNoteLines"."productId" = "Products".id
             INNER JOIN "Branches" ON "CreditNotes"."branchId" = "Branches".id
             LEFT JOIN"Categories" ON  "Categories".id = "Products"."categoryId" WHERE
             "Branches"."companyId"=$1 AND 
				($2::uuid[] is null or "Branches".id = any($2))		AND		  
				"CreditNoteLines"."createdAt" >=$3 AND "CreditNoteLines"."createdAt" <$4
                              GROUP BY "Products".id , "Categories".id,"CreditNoteLines"."createdAt", "productName")T
                           
                              GROUP BY T."barcode",T."productName",T."categoryName"
                              ${having}
                                  ${orderBy}
                              ${limitQuery}
                              `,
                values: [company.id, branches, from, to]
            }

            const reports = await DB.excu.query(query.text, query.values);
            await Helper.roundNumbers(afterDecimal, reports.rows)
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {


            throw new Error(error.message)
        }
    }

    public static async getSalesByBrand(data: any, company: Company, branchList: any[]) {

        try {


            const companyId = company.id;
            const afterDecimal = company.afterDecimal
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let applyOpeningHour = data.applyOpeningHour ?? false

            if (applyOpeningHour == true) {
                let branchId = branchList[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
            }

            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------
            let limit = data.limit;
            let orderBy = '';
            let having = '';
            if (limit) {
                orderBy = ` ORDER BY  CAST (SUM(T.sales) AS REAL)::NUMERIC DESC `
                having = ` Having  CAST (SUM(T.sales) AS REAL)::NUMERIC > 0  `
            }
            const branches = data.branchId ? [data.branchId] : branchList;
            const filterId = (branches != null && branches.length > 0) ? branches : companyId;
            let filter = `"Branches"."companyId"=$1`
            if (branches != null && branches.length > 0) {
                filter = `"Branches".id=any($1)`
            }
            let query = `SELECT 
                            T."brandName",
                            SUM(COALESCE(T.sales,0)::text::numeric) as sales
                        FROM ( `
            let invoiceFilter = filter
            invoiceFilter += ` AND "Invoices"."status" <>'Draft' AND  "InvoiceLines"."createdAt" >=$2 AND"InvoiceLines"."createdAt" <$3
                                    GROUP BY  "Brands".id,"InvoiceLines"."createdAt"
                                    `
            let invoiceSales = `SELECT 
                                    COALESCE("Brands".name,'Unbranded')as "brandName",
                                    sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end)) as sales
                                from "InvoiceLines" 
                                INNER JOIN "Invoices" ON "InvoiceLines" ."invoiceId" = "Invoices".id 
                                INNER JOIN "Products" ON "InvoiceLines"."productId" = "Products".id 
                                INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id 
                                LEFT JOIN "Brands" ON  "Brands".id = "Products"."brandid"
                                WHERE 
                                        `
            invoiceSales += invoiceFilter;
            const unionQuery = "UNION ALL "
            let creditFilter = filter
            creditFilter += ` AND  "CreditNoteLines"."createdAt" >=$2 AND "CreditNoteLines"."createdAt" <$3
                                GROUP BY  "Brands".id,"CreditNoteLines"."createdAt"`
            let creditNoteSales = `SELECT 
                                        COALESCE("Brands".name,'Unbranded')as "brandName",
                                        sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)) end)) *(-1) as sales
                                    from "CreditNoteLines" 
                                    INNER JOIN "CreditNotes" ON "CreditNoteLines" ."creditNoteId" = "CreditNotes".id 
                                    INNER JOIN "Products" ON "CreditNoteLines"."productId" = "Products".id 
                                    INNER JOIN "Branches" ON "CreditNotes"."branchId" = "Branches".id 
                                    LEFT JOIN "Brands" ON  "Brands".id = "Products"."brandid"
                                    WHERE 
                    `
            creditNoteSales += creditFilter
            const groupByQuery = `)T
                    GROUP BY T."brandName"
                    `

            query += invoiceSales + unionQuery + creditNoteSales + groupByQuery;
            let values = [filterId, from, to]
            if (limit) {
                query += having + orderBy + "limit $4"
                values = [filterId, from, to, limit];
            }
            const reports = await DB.excu.query(query, values);

            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {

            throw new Error(error)
        }
    }

    public static async SalesByCategory(data: any, company: Company, brancheList: any[]) {

        try {


            const companyId = company.id;
            const afterDecimal = company.afterDecimal
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let applyOpeningHour = data.applyOpeningHour ?? false

            if (applyOpeningHour == true) {
                let branchId = brancheList[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
            }

            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------

            let limit = data.limit;
            let orderBy = '';
            let having = '';
            let limitQuery = '';
            let branches = data.branchId ? [data.branchId] : brancheList
            if (limit) {
                orderBy = ` ORDER BY  CAST (SUM(T.sales)::NUMERIC AS REAL) DESC `
                having = ` Having  CAST (SUM(T.sales)::NUMERIC AS REAL) > 0  `
                limitQuery = ` limit ${limit} `
            }


            const query = {
                text: `SELECT 
                            T."categoryName",
                            SUM(COALESCE(T.sales,0)::text::numeric) as sales
                        FROM ( SELECT
                                    COALESCE("Categories".name,'Uncategorized')as "categoryName",
                                    sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end)) as sales
                                from "InvoiceLines"
                                INNER JOIN "Invoices" ON "InvoiceLines" ."invoiceId" = "Invoices".id
                                LEFT JOIN "Products" ON "InvoiceLines"."productId" = "Products".id
                                INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id
                                LEFT JOIN"Categories" ON  "Categories".id = "Products"."categoryId"
                                WHERE "Branches"."companyId"=$1  
							    and ($2::uuid[] is null or "Branches".id = any($2))
							    AND "Invoices"."status" <>'Draft' AND  "InvoiceLines"."createdAt" >=$3 AND"InvoiceLines"."createdAt" <$4
                                
                                GROUP BY  "Categories".id,"InvoiceLines"."createdAt"
                                
                                      UNION ALL SELECT
                                        COALESCE("Categories".name,'Uncategorized')as "categoryName",
                                        sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)) end)) *(-1) as sales                                     from "CreditNoteLines"
                                    INNER JOIN "CreditNotes" ON "CreditNoteLines" ."creditNoteId" = "CreditNotes".id
                                    LEFT JOIN "Products" ON "CreditNoteLines"."productId" = "Products".id
                                    INNER JOIN "Branches" ON "CreditNotes"."branchId" = "Branches".id
                                    LEFT JOIN "Categories" ON  "Categories".id = "Products"."categoryId"
                                    WHERE
                                   "Branches"."companyId"=$1 AND 
							       ($2::uuid[] is null or "Branches".id = any($2)) AND
							  "CreditNoteLines"."createdAt" >=$3 AND "CreditNoteLines"."createdAt" <$4
                                GROUP BY  "Categories".id,"CreditNoteLines"."createdAt")T
                       

                    GROUP BY T."categoryName"
                       ${having}
                                   ${orderBy}
                       ${limitQuery}
                    `,
                values: [companyId, branches, from, to]
            }


            const reports = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {

            throw new Error(error.message)
        }
    }

    public static async SalesByDepartment(data: any, company: Company, brancheList: any[]) {

        try {


            const companyId = company.id;
            const afterDecimal = company.afterDecimal
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let applyOpeningHour = data.applyOpeningHour ?? false

            if (applyOpeningHour == true) {
                let branchId = brancheList[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
            }

            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------
            let limit = data.limit;
            /**Limit, Order By and Having query are only used for dashboard */
            let orderBy = '';
            let having = '';
            let limitQuery = '';
            if (limit) {
                orderBy = ` ORDER BY  CAST (SUM(T.sales)::NUMERIC  AS REAL)DESC `
                having = ` Having  CAST (SUM(T.sales)::NUMERIC AS REAL) > 0  `
                limitQuery = ` limit ${limit}`
            }

            let branches = data.branchId ? [data.branchId] : brancheList
            const query = {
                text: `SELECT 
                                T."departmentName",
                                SUM(COALESCE(T.sales,0)::text::numeric) as sales

                            FROM (SELECT
                                    COALESCE("Departments".name,'Others')as "departmentName",
                                    sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end))as sales

                                    FROM "InvoiceLines"
                                    INNER JOIN "Invoices" ON "InvoiceLines" ."invoiceId" = "Invoices".id


                                LEFT JOIN "Products" ON "InvoiceLines"."productId" = "Products".id
                                INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id
                                LEFT JOIN"Categories" ON  "Categories".id = "Products"."categoryId"
                                LEFT JOIN "Departments" ON  "Departments".id = "Categories"."departmentId"
                                WHERE
                                    "Branches"."companyId"=$1  AND
								    ($2::uuid[] is null or "Branches".id = any($2)) AND
								  "Invoices"."status" <>'Draft' AND  "InvoiceLines"."createdAt" >=$3 AND"InvoiceLines"."createdAt" <$4
                                   GROUP BY  "Departments".id,"InvoiceLines"."createdAt"
                                 UNION ALL SELECT
                                        COALESCE("Departments".name,'Others')as "departmentName",
                                        sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)) end)) *(-1) as sales
                                    from "CreditNoteLines"
                                    INNER JOIN "CreditNotes" ON "CreditNoteLines" ."creditNoteId" = "CreditNotes".id
                                    LEFT JOIN "Products" ON "CreditNoteLines"."productId" = "Products".id
                                    INNER JOIN "Branches" ON "CreditNotes"."branchId" = "Branches".id
                                    LEFT JOIN"Categories" ON  "Categories".id = "Products"."categoryId"
                                    LEFT JOIN "Departments" ON  "Departments".id = "Categories"."departmentId"
                                    WHERE
                                    "Branches"."companyId"=$1 AND
								  		    ($2::uuid[] is null or "Branches".id = any($2)) AND
								  "CreditNoteLines"."createdAt" >=$3 AND "CreditNoteLines"."createdAt" <$4      
                              GROUP BY  "Departments".id,"CreditNoteLines"."createdAt")T
                             
                              GROUP BY T."departmentName"
            ${having}
             ${orderBy}
            ${limitQuery}
            `,
                values: [companyId, branches, from, to]
            }

            const reports = await DB.excu.query(query.text, query.values);

            // await Helper.roundNumbers(afterDecimal, reports.rows)
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {



            throw new Error(error.message)
        }
    }

    public static async salesByMenu(data: any, company: Company, branchList: []) {
        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------

            const branches = data.branchId ? [data.branchId] : branchList;
            const query = {
                text: `select 
                            T."menuName",
                            SUM(COALESCE(T."salesTotal",0)::text::numeric) as "salesTotal"
                         from( SELECT  COALESCE("Menu".name,'Others') as "menuName",
            sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end)) as "salesTotal"
                            FROM "InvoiceLines"
                            LEFT join "Products" on "InvoiceLines"."productId" =  "Products".id
                            inner join "Invoices" on "InvoiceLines"."invoiceId" =  "Invoices".id
                            inner join "Branches" on "Invoices"."branchId" =  "Branches".id
                            LEFT join "MenuSectionProduct" on "MenuSectionProduct"."productId" =  "Products".id
                            LEFT join "MenuSection" on "MenuSectionProduct"."menuSectionId" =  "MenuSection".id
                            LEFT join "Menu" on "MenuSection"."menuId" =  "Menu".id
                             WHERE  "Branches"."companyId"=$1 
							 AND ($2::UUID[] IS NULL OR "Branches".id = any($2)) 
							 AND "Invoices"."status" <>'Draft' AND   "InvoiceLines"."createdAt" >=$3 AND "InvoiceLines"."createdAt" <$4  group by "Menu".id  union all SELECT  COALESCE("Menu".name,'Others') as "menuName",
            sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)) end)) *(-1)  as "salesTotal"
                        FROM "CreditNoteLines"
                        LEFT join "Products" on "CreditNoteLines"."productId" =  "Products".id
                        inner join "CreditNotes" on "CreditNoteLines"."creditNoteId" =  "CreditNotes".id
                        inner join "Branches" on "CreditNotes"."branchId" =  "Branches".id
                        LEFT join "MenuSectionProduct" on "MenuSectionProduct"."productId" =  "Products".id
                        LEFT join "MenuSection" on "MenuSectionProduct"."menuSectionId" =  "MenuSection".id
                        LEFT join "Menu" on "MenuSection"."menuId" =  "Menu".id  WHERE  "Branches"."companyId"=$1 
					     AND ($2::UUID[] IS NULL OR "Branches".id = any($2)) 
						AND   "CreditNoteLines"."createdAt" >=$3 AND "CreditNoteLines"."createdAt" <$4 group by "Menu".id  )T GROUP BY T."menuName"`,
                values: [companyId, branches, from, to]
            }

            let report = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", report.rows)
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async salesByMenuSections(data: any, company: Company, brancheList: []) {
        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------
            const branches = data.branchId ? [data.branchId] : brancheList;

            const query = {
                text: `select 
                            T."menuSectionName",
                            SUM(COALESCE(T."salesTotal",0)::text::numeric) as "salesTotal"
                         from( SELECT COALESCE("MenuSection".name,'Others') as "menuSectionName",
            sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end))  as "salesTotal"
                            FROM "InvoiceLines"
                            LEFT join "Products" on "InvoiceLines"."productId" =  "Products".id
                            inner join "Invoices" on "InvoiceLines"."invoiceId" =  "Invoices".id
                            inner join "Branches" on "Invoices"."branchId" =  "Branches".id
                            LEFT join "MenuSectionProduct" on "MenuSectionProduct"."productId" =  "Products".id
                            LEFT join "MenuSection" on "MenuSectionProduct"."menuSectionId" =  "MenuSection".id
                            LEFT join "Menu" on "MenuSection"."menuId" =  "Menu".id
                             WHERE  "Branches"."companyId"=$1  AND "Invoices"."status" <>'Draft' 
							  AND ($2::UUID[] IS NULL OR "Branches".id = any($2))
							  AND   "InvoiceLines"."createdAt" >=$3 AND "InvoiceLines"."createdAt" <$4  group by "MenuSection".id  union all SELECT COALESCE("MenuSection".name,'Others') as "menuSectionName",
            sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)) end)) *(-1) as "salesTotal"
                        FROM "CreditNoteLines"
                        LEFT join "Products" on "CreditNoteLines"."productId" =  "Products".id
                        inner join "CreditNotes" on "CreditNoteLines"."creditNoteId" =  "CreditNotes".id
                        inner join "Branches" on "CreditNotes"."branchId" =  "Branches".id
                        LEFT join "MenuSectionProduct" on "MenuSectionProduct"."productId" =  "Products".id
                        LEFT join "MenuSection" on "MenuSectionProduct"."menuSectionId" =  "MenuSection".id
                        LEFT join "Menu" on "MenuSection"."menuId" =  "Menu".id  WHERE  "Branches"."companyId"=$1 
							  AND ($2::UUID[] IS NULL OR "Branches".id = any($2))  
						AND   "CreditNoteLines"."createdAt" >=$3 AND "CreditNoteLines"."createdAt" <$4 group by "MenuSection".id  )T GROUP BY T."menuSectionName"`,

                values: [companyId, branches, from, to]
            }
            let report = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", report.rows)
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async salesByMenuProductsCategory(data: any, company: Company, brancheList: []) {
        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------
            const branches = data.branchId ? [data.branchId] : brancheList;

            const query = {
                text: `select 
                            T."categoryName",
                            T."productName",
                        sum(T."qtyTotal") as "qtyTotal",
                        SUM(COALESCE(T."totalSales",0)::text::numeric) as "totalSales"
                        from ( select
                               COALESCE("Categories".name,'Uncategorized') "categoryName",
                               COALESCE("Products".name,"InvoiceLines".note ) as "productName",
                                sum(COALESCE("InvoiceLines".qty,0)) as "qtyTotal",
                                sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end)) as "totalSales"
                            from "InvoiceLines"
                            inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId"
                            inner join "Branches" on "Branches".id = "Invoices"."branchId"
                            left join "Products" on "InvoiceLines"."productId" = "Products".id
                            left join "Categories" on "Categories".id = "Products"."categoryId"
                                             WHERE  "Branches"."companyId"=$1 
							    AND ($2::uuid[] is null or "Branches".id= any($2))
							                AND "Invoices"."status" <>'Draft' AND   "InvoiceLines"."createdAt" >=$3 AND "InvoiceLines"."createdAt" <$4   GROUP BY "Products".id, "Categories".id, "productName" union all select
                                        COALESCE("Categories".name,'Uncategorized') "categoryName",
                                        COALESCE("Products".name,"CreditNoteLines".note ) as "productName",
                                        sum(COALESCE("CreditNoteLines".qty,0)) * (-1) as "qtyTotal",
                                              sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)) end)) *(-1) as "totalSales"
                                    from "CreditNoteLines"
                                    inner join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId"
                                    inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
                                    left join "Products" on "CreditNoteLines"."productId" = "Products".id
                                    left join "Categories" on "Categories".id = "Products"."categoryId"  WHERE  "Branches"."companyId"=$1 
							         AND ($2::uuid[] is null or "Branches".id= any($2))
							         AND   "CreditNoteLines"."createdAt" >=$3 AND "CreditNoteLines"."createdAt" <$4  GROUP BY "Products".id, "Categories".id, "productName" )T
                group by T."categoryName",T."productName"
                order by T."categoryName"`,

                values: [companyId, branches, from, to]
            }


            let report = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", report.rows)
        } catch (error: any) {


            throw new Error(error)
        }
    }


    public static async salesByMenuItemsProductsVsOptions(data: any, company: Company, branchList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------
            const branches = data.branchId ? [data.branchId] : branchList;
            const query = {
                text: `SELECT  
                        COALESCE("Categories".name , 'Uncategorized') as "categoryName",
                        "Products".name as "productName",
                        case when sum("InvoiceLineOptions".qty) is null then sum("InvoiceLines".qty) else sum("InvoiceLineOptions".qty) end as qty,
                        "Options".name as "optionName",
                        sum(COALESCE("InvoiceLineOptions".price,0)) as "optionPrice"
                    from "InvoiceLines"
                    INNER JOIN "Products" on  "InvoiceLines"."productId" = "Products".id and "Products".type = 'menuItem'
                    LEFT JOIN "InvoiceLineOptions" on  "InvoiceLineOptions"."invoiceLineId" = "InvoiceLines".id
                    LEFT JOIN "Categories" on "Categories".id = "Products"."categoryId"
                    LEFT JOIN "Options" on "Options".id =  "InvoiceLineOptions"."optionId"
                    INNER JOIN "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId"
                    INNER JOIN "Branches" on "Invoices"."branchId" = "Branches".id
                 WHERE  "Branches"."companyId"=$1 
				 AND ($2::UUID[] IS NULL OR "Branches".id = any($2))
				 AND "Invoices"."status" <>'Draft' AND   "InvoiceLines"."createdAt" >=$3 AND "InvoiceLines"."createdAt" <$4   group by "Products".id,"Categories".name,  "Options".name`,

                values: [companyId, branches, from, to]
            }


            let reports = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async salesByServiceVsMenuItemProducts(data: any, company: Company, brancheList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------
            const branches = data.branchId ? [data.branchId] : brancheList;
            const query = {
                text: `with "values" as (
                    select $1::uuid as "companyId",
                           $2::uuid[] as "branchId",
                           $3::timestamp as "fromDate",
                           $4::timestamp as "toDate"
                    
                    ) , "Reports" as (
                    SELECT  
                      COALESCE("Services".name , 'Others') as "serviceName",
                      COALESCE("Categories".name , 'Uncategorized') as "categoryName",
                      COALESCE("Products".name,"InvoiceLines".note ) as "productName",
                      sum("InvoiceLines".qty)  as "qty",
                      sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end))  as "salesTotal"
                     from "InvoiceLines" 
                    JOIN "values" on true
                    LEFT JOIN "Products" on  "InvoiceLines"."productId" = "Products".id 
                    LEFT JOIN "Categories" on "Categories".id = "Products"."categoryId"
                    INNER JOIN "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId"
                     INNER JOIN "Branches" on "Invoices"."branchId" = "Branches".id
                    LEFT  JOIN "Services" on "Invoices"."serviceId" = "Services".id
                    where "Branches"."companyId" = "values"."companyId"
                    AND "Invoices"."status" <>'Draft'   
                    and("values"."branchId" is null or   "Branches".id = any("values"."branchId"))
                    AND "InvoiceLines"."createdAt" >="values"."fromDate" AND "InvoiceLines"."createdAt" <"values"."toDate"
                        group by "serviceName",  "categoryName","productName"
                    UNION ALL 
                    SELECT  
                      COALESCE("Services".name , 'Others') as "serviceName",
                      COALESCE("Categories".name , 'Uncategorized') as "categoryName",
                      COALESCE("Products".name,"CreditNoteLines".note ) as "productName",
                      sum("CreditNoteLines".qty) *(-1) as "qty",
                       sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)) end)) *(-1) as "salesTotal"
                    
                     from "CreditNoteLines" 
                        JOIN "values" on true
                    LEFT JOIN "Products" on  "CreditNoteLines"."productId" = "Products".id 
                    LEFT JOIN "Categories" on "Categories".id = "Products"."categoryId"
                    INNER JOIN "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId"
                    INNER JOIN "Invoices" on "Invoices".id = "CreditNotes"."invoiceId"
                     INNER JOIN "Branches" on "CreditNotes"."branchId" = "Branches".id
                    LEFT  JOIN "Services" on "Invoices"."serviceId" = "Services".id
                    where "Branches"."companyId" = "values"."companyId"
                    AND "Invoices"."status" <>'Draft'   
                    and("values"."branchId" is null or  "Branches".id = any("values"."branchId") )
                    
                    AND "CreditNoteLines"."createdAt" >="values"."fromDate" AND "CreditNoteLines"."createdAt" <"values"."toDate"
                    group by "serviceName",  "categoryName","productName"
                    )
                    
                    select 
                    "Reports"."serviceName",
                    "Reports"."categoryName",
                    "Reports"."productName",
                    sum("qty") as "qty",
                    sum("salesTotal") as "price"
                    from "Reports"
                    group by "serviceName","categoryName","productName"`,
                values: [companyId, branches, from, to]
            }
            let reports = await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async productPreparedTimeSummary(data: any, company: Company, brancheList: []) {
        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------
            const branches = data.branchId ? [data.branchId] : brancheList;

            const query = {
                text: `select    
            "Products".id,
            COALESCE("Products".name,"InvoiceLines".note ) as name,
            sum("InvoiceLines".qty) as "qty",
            SUM(EXTRACT(EPOCH FROM ("InvoiceLines"."readyTime"::timestamp - "InvoiceLines"."createdAt"::timestamp))) as "totalPreparedTime",
            avg(EXTRACT(EPOCH FROM ("InvoiceLines"."readyTime"::timestamp - "InvoiceLines"."createdAt"::timestamp))) as "avgReadyTime"
            from "InvoiceLines"
            LEFT JOIN "Products" on"Products".id = "InvoiceLines"."productId"
            INNER JOIN "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId"
            INNER JOIN "Branches" on "Branches".id = "Invoices"."branchId"
             WHERE  "Branches"."companyId"=$1  
			 AND ($2::UUID[] IS NULL OR "Branches".id = any($2))
			 AND "Invoices"."status" <>'Draft' AND   "InvoiceLines"."createdAt" >=$3 AND "InvoiceLines"."createdAt" <$4  AND "Invoices"."readyTime" is not null   group by "InvoiceLines".note , "Products".id`,

                values: [companyId, branches, from, to]
            }



            let reports = await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {


            throw new Error(error)
        }
    }


    /**new Reports */

    public static async salesByServices(data: any, company: Company, brancheList: []) {

        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : brancheList;

            let timeOffset = company.timeOffset



            let NoOfperiod = filter && filter.periodQty ? filter.periodQty : null;
            let period = filter && filter.period ? filter.period : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : 'none';
            let columns = ["Total"]
            let results: any = []


            //######## set time ##########
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;


            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
            }

            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to

            //##########################
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };



            let query = {
                text: `WITH "services" as (
select "name" as "serviceName",
	   "id" as "serviceId"
	from "Services" 
        where "Services"."companyId" = $1

) ,"lines" AS  (			
                        select      				     
                        (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
                        "InvoiceLines"."taxTotal" as "taxTotal",
                        "InvoiceLines"."discountTotal" as "discountTotal",
                         "InvoiceLines".total as "total",
                        "InvoiceLines"."invoiceId",
                        "InvoiceLines"."createdAt",
                        "InvoiceLines"."branchId",
                        "InvoiceLines"."productId",
                        "InvoiceLines"."companyId"
                    from "InvoiceLines"
                    where "InvoiceLines"."companyId" = $1
                    and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any ($2::uuid[]))
                    and ("InvoiceLines"."createdAt" >=case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
                                                    when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
                                                    else $3::timestamp 	END and "InvoiceLines"."createdAt" < $4)
                    ),
                    "invoiceData" as (
                    select  "services". "serviceId",
                           COALESCE("services"."serviceName",'Others')as "serviceName",
						    "lines"."sales",
                            "lines"."taxTotal",
                            "lines"."discountTotal",
                            "lines"."total",
                            case when  lower($5::TEXT)  = 'branch' then COALESCE("Branches" .name,'other') 
                            when   lower($5::TEXT)  = 'period' and      lower($6::TEXT)  = 'month'  then to_char( "lines"."createdAt"::TIMESTAMP,'Mon/YYYY') 
                            when  lower($5::TEXT) = 'period' and     lower($6::TEXT) = 'year'  then  to_char( "lines"."createdAt"::TIMESTAMP,'YYYY') 
                            else 'Total' end as "key",
                                 'invoice' as "transactionType"
                    from "lines"
                    inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                    LEFT join "services" on "services"."serviceId" = "Invoices"."serviceId"
					inner join "Branches"   on  "Branches".id = "lines"."branchId"
           
                                    ),
                    "creditNoteLines" as (

                                        
                        select      				     
                        (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end) as "sales",
                       "CreditNoteLines"."taxTotal" as "taxTotal",
                       "CreditNoteLines"."discountTotal" as "discountTotal",
                       "CreditNoteLines".total as "total",
                      "CreditNoteLines"."creditNoteId",
                        "CreditNoteLines"."createdAt",
                        "CreditNoteLines"."branchId",
                        "CreditNoteLines"."productId",
                        "CreditNoteLines"."companyId"
                    from "CreditNoteLines"
                    where "CreditNoteLines"."companyId" = $1
                    and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId" =any($2::uuid[]))
                    and ("CreditNoteLines"."createdAt" >=case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
                                                    when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
                                                    else $3::timestamp 	END and "CreditNoteLines"."createdAt" < $4)
                
                    ),
                    "creditNoteData" as (
                    select  "services". "serviceId",
                           COALESCE("services"."serviceName",'Others')as "serviceName",
                          "creditNoteLines"."sales",
                            "creditNoteLines"."taxTotal",
                            "creditNoteLines"."discountTotal",
                            "creditNoteLines"."total",
                            case when  lower($5::TEXT)   = 'branch' then COALESCE("Branches" .name,'other') 
                            when   lower($5::TEXT)   = 'period' and   lower($6::TEXT)  = 'month'  then to_char( "creditNoteLines"."createdAt"::TIMESTAMP,'Mon/YYYY') 
                            when lower($5::TEXT)   = 'period' and      lower($6::TEXT)  = 'year'  then  to_char( "creditNoteLines"."createdAt"::TIMESTAMP,'YYYY') 
                            else 'Total' end as "key",
                            'creditNote' as "transactionType"
                    from "creditNoteLines"
                    inner join "Branches"   on   "Branches".id = "creditNoteLines"."branchId"
					inner join "CreditNotes" on "CreditNotes".id = "creditNoteLines"."creditNoteId" 
					inner join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId" 
						    LEFT join "services" on "services"."serviceId" = "Invoices"."serviceId"
                ),
                    T AS (          
                    select * from "invoiceData" union all select * from "creditNoteData"
                    ),
                    "Total" as (
						SELECT 
                        "serviceId",
                       "serviceName",
                        "key",
                           sum(case when "transactionType" = 'invoice' then "sales" else "sales" *(-1) end ::TEXT::NUMERIC) as "sales",
                            sum(case when "transactionType" = 'invoice' then   "taxTotal" else   "taxTotal" *(-1) end::TEXT::NUMERIC) as "taxTotal",
                            sum(case when "transactionType" = 'invoice' then "discountTotal"   else   "discountTotal" *(-1) end ::TEXT::NUMERIC) as "discountTotal",
                            sum(case when "transactionType" = 'invoice' then "total"  else   "total" *(-1) end ::TEXT::NUMERIC) as "total"
                    from T
                
                   
                    group by "serviceId" ,   "serviceName",   "key"
                    order by  "serviceId"
                    )
                    select "serviceId", "serviceName",
                    (select array_agg(distinct "key")  from "Total")  as "columns",
                    JSON_AGG(JSON_BUILD_OBJECT("key",JSON_BUILD_OBJECT('salesAmount',COALESCE("sales",0),
                                                                    'discountTotal',COALESCE("discountTotal",0),
                                                                        'salesAfterDiscount',COALESCE("sales",0) - COALESCE("discountTotal",0),
                                                                        'taxTotal',COALESCE("taxTotal",0),
                                                                        'total',COALESCE("total",0)
                                                                        ))) as "summary"

                    from "Total"
                    group by "serviceId", "serviceName"
                    order by "serviceId"
                    
                `,
                values: [companyId, branches, from, to, compareType, period, NoOfperiod]
            }


            const records = await DB.excu.query(query.text, query.values);

            if (records.rows && records.rows.length > 0) {
                columns = (<any>records.rows[0]).columns ? (<any>records.rows[0]).columns : columns
                results = records.rows
            }


            try {
                columns.sort((a, b) => {
                    const aa = moment(a, 'MMM/YYYY')
                    const bb = moment(b, 'MMM/YYYY')
                    return aa.diff(bb)
                })
            } catch { columns = columns }


            const DefaultSubColumns = ['salesAmount', 'discountTotal', 'salesAfterDiscount', 'taxTotal', 'total'];
            const selectedSubColumns = filter.subColumns ?? ['salesAmount'];
            const validSubColumns = selectedSubColumns.filter((col: string) =>
                DefaultSubColumns.includes(col)
            );
            if (validSubColumns.length === 0) {
                validSubColumns.push('salesAmount');
            }


            let resData = {
                records: results,
                subColumns: compareType == 'none' ? DefaultSubColumns : validSubColumns,
                columns: columns,
                from: from,
                to: to

            }



            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Sales By Service",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches, compareType: compareType,
                    period: period, periodQty: NoOfperiod
                }
                report.records = results

                //get columns & subColumns
                resData.columns.forEach((col: any) => {
                    let childs: DataColumn[] = []
                    resData.subColumns.forEach((subcol: any) => childs.push({ key: subcol, properties: { columnType: 'currency' } }))
                    report.columns.push({ key: col, childs: childs, properties: { hasTotal: true } })
                })

                report.columns = [...[{ key: 'serviceName' }], ...report.columns]
                report.fileName = 'salesByService'

                return new ResponseData(true, "", report)

            }

            return new ResponseData(true, "", resData)


        } catch (error: any) {


            throw new Error(error.message)
        }
    }

    public static async salesByDepartments(data: any, company: Company, brancheList: []) {

        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : brancheList;



            //######## set time ##########
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;


            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
            }

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to

            //##########################
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };



            let NoOfperiod = filter && filter.periodQty ? filter.periodQty : null;
            let period = filter && filter.period ? filter.period : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : 'none';
            let columns = ["Total"]

            let results: any = []



            // if (compareType == 'none' ){
            //     queryText  =  `WITH "values" AS (
            //         SELECT  $1::uuid AS "companyId",
            //                 $2::uuid[] AS "branches",
            //                 $3::timestamp AS "fromDate",
            //                 $4::timestamp AS "toDate"
            //         )
            //         ,"invoiceData" as(
            //             select  prod."categoryId" as  "categoryId",
            //                     (case when IL."isInclusiveTax" = true then ((COALESCE(IL."subTotal",0)::text::numeric) - (COALESCE(IL."taxTotal",0)::text::numeric)) else COALESCE(IL."subTotal",0)::text::numeric end) as "sales",
            //                     (IL."taxTotal"::text::numeric) as "taxTotal",
            //                     (IL."discountTotal"::text::numeric) as "discountTotal",
            //                     (IL.total::text::numeric) as "total"
            //             from "InvoiceLines" as IL
            //             join "values" on true
            //             inner join "Invoices" as invo on invo.id = IL."invoiceId"
            //             inner join "Products" as prod on prod.id = IL."productId"
            //             inner join "Branches" as branches on branches.id = invo."branchId"
            //             where branches."companyId" = "values"."companyId"  
            //               and invo."status" <> 'Draft' 
            //               and (array_length("values"."branches",1) IS NULL or  branches.id = Any("values"."branches"))
            //               and (IL."createdAt" >= "values"."fromDate" and IL."createdAt" < "values"."toDate"  )
            //             )
            //             ,"creditNoteData" as(
            //             select  prod."categoryId" as  "categoryId",
            //                     (case when CNL."isInclusiveTax" = true then ((COALESCE(CNL."subTotal",0)::text::numeric) - (COALESCE(CNL."taxTotal",0)::text::numeric)) else COALESCE(CNL."subTotal",0)::text::numeric end)*(-1) as "sales",
            //                       (CNL."taxTotal"::text::numeric)*(-1) as "taxTotal",
            //                     (CNL."discountTotal"::text::numeric)*(-1) as "discountTotal",
            //                     (CNL.total::text::numeric)*(-1) as "total"
            //             from "CreditNoteLines" as CNL
            //             join "values" on true
            //             inner join "CreditNotes" as CN on CN.id = CNL."creditNoteId"
            //             inner join "Products" as prod on prod.id = CNL."productId"
            //             inner join "Branches" as branches on branches.id = CN."branchId"
            //             where branches."companyId" = "values"."companyId"  
            //               and (array_length("values"."branches",1) IS NULL or  branches.id = Any("values"."branches"))
            //               and (CNL."createdAt" >=  "values"."fromDate" and CNL."createdAt" < "values"."toDate")

            //             )
            //             ,"Total" as (
            //                 select "Departments".id AS "departmentId",
            //                         COALESCE("Departments".name,'Others')as "departmentName",
            //                         sum(COALESCE("sales",0)::text::numeric) as "sales",
            //                         sum(COALESCE("taxTotal",0)::text::numeric) as "taxTotal",
            //                         sum(COALESCE("discountTotal",0)::text::numeric) as "discountTotal",
            //                         sum(COALESCE("total",0)::text::numeric) as "total"

            //                 from (select * from "invoiceData" union all select * from "creditNoteData")T
            //                 left join "Categories" on "Categories".id = T. "categoryId"
            //                 left join "Departments" on "Departments".id = "Categories"."departmentId"
            //                 group by "Departments".id 
            //                 order by "Departments".id
            //                 )
            //                 select "departmentId", "departmentName",
            //                 JSON_AGG(JSON_BUILD_OBJECT('saleAmount',COALESCE("sales",0),
            //                                                                    'discountTotal',COALESCE("discountTotal",0),
            //                                                                     'taxTotal',COALESCE("taxTotal",0),
            //                                                                     'total',COALESCE("total",0)
            //                                                                  )) as "summary"

            //                 from "Total"
            //                 group by "departmentId", "departmentName"
            //                 order by "departmentId"`

            //            queryValues= [companyId, branches, from, to]
            //            columns = ["departmentId","departmentName","sales", "discountTotal" , "total" ]
            //            subColumns = null

            // }
            // else{
            //     queryText = `WITH "values" AS (
            //         SELECT  $1::uuid AS "companyId",
            //                 $2::uuid[] AS "branches",
            //                 case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
            //                      when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
            //                      else $3::timestamp 	END "fromDate",
            //                 $4::timestamp AS "toDate",
            //                 lower($5)::text As "compType",
            //                 lower($6)::text as "period"
            //         )
            //         ,"invoiceData" as(
            //             select  prod."categoryId" as  "categoryId",
            //                     (case when IL."isInclusiveTax" = true then ((COALESCE(IL."subTotal",0)::text::numeric) - (COALESCE(IL."taxTotal",0)::text::numeric)) else COALESCE(IL."subTotal",0)::text::numeric end) as "sales",

            //                     case when "values"."compType" = 'branch' then COALESCE(branches.name,'other') 
            //                          when "values"."compType" = 'period' and "period" = 'month' then to_char(IL."createdAt"::TIMESTAMP,'Mon/YYYY') 
            //                          when "values"."compType" = 'period' and "period" = 'year'  then  to_char(IL."createdAt"::TIMESTAMP,'YYYY') 
            //                          else 'Total' end as "key"
            //             from "InvoiceLines" as IL
            //             join "values" on true
            //             inner join "Invoices" as invo on invo.id = IL."invoiceId"
            //             inner join "Products" as prod on prod.id = IL."productId"
            //             inner join "Branches" as branches on branches.id = invo."branchId"
            //             where branches."companyId" = "values"."companyId"  
            //               and invo."status" <> 'Draft' 
            //               and (array_length("values"."branches",1) IS NULL or  branches.id = Any("values"."branches"))
            //               and (IL."createdAt" >= "values"."fromDate" and IL."createdAt" < "values"."toDate"  )
            //             )
            //             ,"creditNoteData" as(
            //             select  prod."categoryId" as  "categoryId",
            //                     (case when CNL."isInclusiveTax" = true then ((COALESCE(CNL."subTotal",0)::text::numeric) - (COALESCE(CNL."taxTotal",0)::text::numeric)) else COALESCE(CNL."subTotal",0)::text::numeric end)*(-1) as "sales",

            //                     case when "values"."compType" = 'branch' then COALESCE(branches.name,'other') 
            //                          when "values"."compType" = 'period' and "period" = 'month' then to_char(CNL."createdAt"::TIMESTAMP,'Mon/YYYY') 
            //                          when "values"."compType" = 'period' and "period" = 'year'  then  to_char(CNL."createdAt"::TIMESTAMP,'YYYY') 
            //                          else 'Total' end as "key"
            //             from "CreditNoteLines" as CNL
            //             join "values" on true
            //             inner join "CreditNotes" as CN on CN.id = CNL."creditNoteId"
            //             inner join "Products" as prod on prod.id = CNL."productId"
            //             inner join "Branches" as branches on branches.id = CN."branchId"
            //             where branches."companyId" = "values"."companyId"  
            //               and (array_length("values"."branches",1) IS NULL or  branches.id = Any("values"."branches"))
            //               and (CNL."createdAt" >=  "values"."fromDate" and CNL."createdAt" < "values"."toDate")

            //             )
            //             ,"Total" as (
            //             select "Departments".id AS "departmentId",
            //                     COALESCE("Departments".name,'Others')as "departmentName",
            //                     "key",
            //                     sum(COALESCE("sales",0)::text::numeric) as "sales"

            //             from (select * from "invoiceData" union all select * from "creditNoteData")T
            //             left join "Categories" on "Categories".id = T. "categoryId"
            //             left join "Departments" on "Departments".id = "Categories"."departmentId"
            //             group by "Departments".id ,"key"
            //             order by "Departments".id
            //             )
            //             select "departmentId", "departmentName",
            //             (select array_agg(distinct "key")  from "Total")  as "columns",
            //             JSON_AGG(JSON_BUILD_OBJECT("key",COALESCE("sales",0))) as "summary"

            //             from "Total"
            //             group by "departmentId", "departmentName"
            //             order by "departmentId"`
            //             queryValues= [companyId, branches, from, to, compareType, period, NoOfperiod]




            // }

            let limit = data.limit;
            /**Limit, Order By and Having query are only used for dashboard */
            let orderBy = '';
            let having = '';
            let limitQuery = '';
            if (limit) {
                orderBy = ` ORDER BY "departmentId",  CAST (SUM(sales)::NUMERIC  AS REAL)DESC `
                having = ` Having  CAST (SUM(sales)::NUMERIC AS REAL) > 0  `
                limitQuery = ` limit ${limit}`
            }

            let query = {
                text: `
                    WITH "lines" as (			
                        select      				     
                        (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
                        "InvoiceLines"."taxTotal" as "taxTotal",
                        "InvoiceLines"."discountTotal" as "discountTotal",
                         "InvoiceLines".total as "total",
                        "InvoiceLines"."invoiceId",
                        "InvoiceLines"."createdAt",
                        "InvoiceLines"."branchId",
                        "InvoiceLines"."productId",
                        "InvoiceLines"."companyId"
                    from "InvoiceLines"
                    where "InvoiceLines"."companyId" = $1
                    and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any ($2::uuid[]))
                    and ("InvoiceLines"."createdAt" >=case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
                                                    when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
                                                    else $3::timestamp 	END and "InvoiceLines"."createdAt" < $4)
                    ),
                    "invoiceData" as (
                    select   prod."categoryId" as  "categoryId",
                            "lines"."sales",
                            "lines"."taxTotal",
                            "lines"."discountTotal",
                            "lines"."total",
                            case when  lower($5::TEXT)  = 'branch' then COALESCE("Branches" .name,'other') 
                            when   lower($5::TEXT)  = 'period' and      lower($6::TEXT)  = 'month'  then to_char( "lines"."createdAt"::TIMESTAMP,'Mon/YYYY') 
                            when  lower($5::TEXT) = 'period' and     lower($6::TEXT) = 'year'  then  to_char( "lines"."createdAt"::TIMESTAMP,'YYYY') 
                            else 'Total' end as "key",
                                 'invoice' as "transactionType"
                    from "lines"
                    inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                    inner join "Branches"   on  "Branches".id = "lines"."branchId"
                                 left join "Products" as prod  on prod.id = "lines"."productId" 
                                    ),
                    "creditNoteLines" as (

                                        
                        select      				     
                        (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end) as "sales",
                       "CreditNoteLines"."taxTotal" as "taxTotal",
                     "CreditNoteLines"."discountTotal" as "discountTotal",
                       "CreditNoteLines".total as "total",

                        "CreditNoteLines"."createdAt",
                        "CreditNoteLines"."branchId",
                        "CreditNoteLines"."productId",
                        "CreditNoteLines"."companyId"
                    from "CreditNoteLines"
                    where "CreditNoteLines"."companyId" = $1
                    and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId" =any($2::uuid[]))
                    and ("CreditNoteLines"."createdAt" >=case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
                                                    when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
                                                    else $3::timestamp 	END and "CreditNoteLines"."createdAt" < $4)
                
                    ),
                    "creditNoteData" as (
                    select   prod."categoryId" as  "categoryId",
                            "creditNoteLines"."sales" ,
                            "creditNoteLines"."taxTotal" ,
                            "creditNoteLines"."discountTotal" ,
                            "creditNoteLines"."total" ,
                            case when  lower($5::TEXT)   = 'branch' then COALESCE("Branches" .name,'other') 
                            when   lower($5::TEXT)   = 'period' and   lower($6::TEXT)  = 'month'  then to_char( "creditNoteLines"."createdAt"::TIMESTAMP,'Mon/YYYY') 
                            when lower($5::TEXT)   = 'period' and      lower($6::TEXT)  = 'year'  then  to_char( "creditNoteLines"."createdAt"::TIMESTAMP,'YYYY') 
                            else 'Total' end as "key",
                            'creditNote' as "transactionType"
                    from "creditNoteLines"
                    inner join "Branches"   on   "Branches".id = "creditNoteLines"."branchId"
                                  left join "Products" as prod  on prod.id = "creditNoteLines"."productId" 
                    ),
                    T AS (          
                    select * from "invoiceData" union all select * from "creditNoteData"
                    ),
                    "Total" as (
                        select "Departments".id AS "departmentId",
                        COALESCE("Departments".name,'Others')as "departmentName",
                        "key",
                           sum(case when "transactionType" = 'invoice' then "sales" else "sales" *(-1) end) as "sales",
                            sum(case when "transactionType" = 'invoice' then   "taxTotal" else   "taxTotal" *(-1) end) as "taxTotal",
                            sum(case when "transactionType" = 'invoice' then "discountTotal"   else   "discountTotal" *(-1) end ) as "discountTotal",
                            sum(case when "transactionType" = 'invoice' then "total"  else   "total" *(-1) end ) as "total"
                    from T
                    left join "Categories" on "Categories".id = T. "categoryId"
                    left join "Departments" on "Departments".id = "Categories"."departmentId"
                    group by "Departments".id ,"key"
                    order by "Departments".id
                    )
                    select "departmentId", "departmentName",
                    (select array_agg(distinct "key")  from "Total")  as "columns",
                    JSON_AGG(JSON_BUILD_OBJECT("key",JSON_BUILD_OBJECT('salesAmount',COALESCE("sales",0),
                                                                    'discountTotal',COALESCE("discountTotal",0),
                                                                    'salesAfterDiscount',COALESCE("sales",0) - COALESCE("discountTotal",0),
                                                                        'taxTotal',COALESCE("taxTotal",0),
                                                                        'total',COALESCE("total",0)
                                                                        ))) as "summary"

                    from "Total"
                    group by "departmentId", "departmentName"
                    ${having}
                    ${orderBy}
                    ${limitQuery}
				      
                `,
                values: [companyId, branches, from, to, compareType, period, NoOfperiod]
            }

            console.log(query.values)

            const records = await DB.excu.query(query.text, query.values);

            if (filter && filter.topSales) {
                let records2 = records.rows.map(m => {
                    return {
                        departmentName: m.departmentName,
                        sales: m.summary[0].Total.salesAmount
                    }
                })

                return new ResponseData(true, "", records2)
            }

            if (records.rows && records.rows.length > 0) {
                columns = (<any>records.rows[0]).columns ? (<any>records.rows[0]).columns : columns
                results = records.rows
            }


            try {
                columns.sort((a, b) => {
                    const aa = moment(a, 'MMM/YYYY')
                    const bb = moment(b, 'MMM/YYYY')
                    return aa.diff(bb)
                })
            } catch { columns = columns }

            const DefaultSubColumns = ['salesAmount', 'discountTotal', 'salesAfterDiscount', 'taxTotal', 'total'];
            const selectedSubColumns = filter.subColumns ?? ['salesAmount'];
            const validSubColumns = selectedSubColumns.filter((col: string) =>
                DefaultSubColumns.includes(col)
            );
            if (validSubColumns.length === 0) {
                validSubColumns.push('salesAmount');
            }

            let resData = {
                records: results,
                subColumns: compareType == 'none' ? DefaultSubColumns : validSubColumns,
                columns: columns,
            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Sales By Department",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches, compareType: compareType,
                    period: period, periodQty: NoOfperiod
                }
                report.records = results

                //get columns & subColumns
                resData.columns.forEach((col: any) => {
                    let childs: DataColumn[] = []
                    resData.subColumns.forEach((subcol: any) => childs.push({ key: subcol, properties: { columnType: 'currency' } }))
                    report.columns.push({ key: col, childs: childs, properties: { hasTotal: true } })
                })

                report.columns = [...[{ key: 'departmentName' }], ...report.columns]
                report.fileName = 'salesByDepartment'
                return new ResponseData(true, "", report)

            }

            console.log("res data");
            return new ResponseData(true, "", resData)



        } catch (error: any) {


            throw new Error(error.message)
        }
    }

    public static async SalesByCategoryReport(data: any, company: Company, brancheList: []) {


        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : brancheList;


            //######## set time ##########
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();

            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;


            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
            }
            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to

            //##########################
            if (!Array.isArray(branches) || branches.length == 0) { branches = null }


            let NoOfperiod = filter && filter.periodQty ? filter.periodQty : null;
            let period = filter && filter.period ? filter.period : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : 'none';
            let columns = ["Total"]
            let results: any = []

            let limit = data.limit;
            let orderBy = '';
            let having = '';
            let limitQuery = '';
            if (limit) {
                orderBy = ` ORDER BY  CAST (SUM(sales)::NUMERIC AS REAL) DESC, "categoryId" `
                having = ` Having  CAST (SUM(sales)::NUMERIC AS REAL) > 0  `
                limitQuery = ` limit ${limit} `
            }


            let query = {
                text: `WITH   "lines" as (       
                            select      				     
                           (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
                           "InvoiceLines"."taxTotal" as "taxTotal",
                           "InvoiceLines"."discountTotal" as "discountTotal",
                            "InvoiceLines".total as "total",
                            "InvoiceLines"."invoiceId",
                            "InvoiceLines"."createdAt",
                            "InvoiceLines"."branchId",
                            "InvoiceLines"."productId",
                            "InvoiceLines"."companyId"
                        from "InvoiceLines"
                        where "InvoiceLines"."companyId" = $1
                        and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any($2::uuid[]))
                        and ("InvoiceLines"."createdAt" >=case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
                                                    when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
                                                    else $3::timestamp 	END and "InvoiceLines"."createdAt" < $4)
                     ),
                        "invoiceData" as (
                        select   prod."categoryId" as  "categoryId",
                                "lines"."sales",
                                "lines"."taxTotal",
                                "lines"."discountTotal",
                                "lines"."total",
                                case when   lower($5::TEXT) = 'branch' then COALESCE("Branches" .name,'other') 
                                when    lower($5::TEXT) = 'period' and      lower($6::TEXT)= 'month'  then to_char( "lines"."createdAt"::TIMESTAMP,'Mon/YYYY') 
                                when   lower($5::TEXT)  = 'period' and      lower($6::TEXT)= 'year'  then  to_char( "lines"."createdAt"::TIMESTAMP,'YYYY') 
                                else 'Total' end as "key",
                                'invoice' as "transactionType"
                        from "lines"
                        inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                        inner join "Branches"   on "Branches".id = "lines"."branchId"
                        left join "Products" as prod  on prod.id = "lines"."productId" 
                                        ),
                        "creditNoteLines" as (

                                            
                            select      				     
                            (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end) as "sales",
                           "CreditNoteLines"."taxTotal"  as "taxTotal",
                           "CreditNoteLines"."discountTotal" as "discountTotal",
                           "CreditNoteLines".total as "total",

                            "CreditNoteLines"."createdAt",
                            "CreditNoteLines"."branchId",
                            "CreditNoteLines"."productId",
                            "CreditNoteLines"."companyId"
                        from "CreditNoteLines"
                        where "CreditNoteLines"."companyId" = $1
                        and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  = any($2::uuid[]) )
                        and ("CreditNoteLines"."createdAt" >=  case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
                                                    when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
                                                    else $3::timestamp 	END and "CreditNoteLines"."createdAt" < $4)
              
                        ),
                        "creditNoteData" as (
                        select   prod."categoryId" as  "categoryId",
                                "creditNoteLines"."sales" ,
                                "creditNoteLines"."taxTotal" ,
                                "creditNoteLines"."discountTotal",
                                "creditNoteLines"."total" ,
                                case when   lower($5::TEXT) = 'branch' then COALESCE("Branches" .name,'other') 
                                when    lower($5::TEXT)  = 'period' and      lower($6::TEXT) = 'month'  then to_char( "creditNoteLines"."createdAt"::TIMESTAMP,'Mon/YYYY') 
                                when   lower($5::TEXT)= 'period' and        lower($6::TEXT) = 'year'  then  to_char( "creditNoteLines"."createdAt"::TIMESTAMP,'YYYY') 
                                else 'Total' end as "key",
                                'creditNote' as "transactionType"
                        from "creditNoteLines"
                        inner join "Branches"   on  "Branches".id = "creditNoteLines"."branchId"
                        left join "Products" as prod  on  prod.id = "creditNoteLines"."productId" ),
                        T AS (          
                        select * from "invoiceData" union all select * from "creditNoteData"
                        ),
                        "Total" as (
                            select "Categories".id AS "categoryId",
                            COALESCE("Categories".name,'Uncategorized')as "categoryName",
                            "key",
                            sum(case when "transactionType" = 'invoice' then "sales" else "sales" *(-1) end) as "sales",
                            sum(case when "transactionType" = 'invoice' then   "taxTotal" else   "taxTotal" *(-1) end) as "taxTotal",
                            sum(case when "transactionType" = 'invoice' then "discountTotal"   else   "discountTotal" *(-1) end ) as "discountTotal",
                            sum(case when "transactionType" = 'invoice' then "total"  else   "total" *(-1) end ) as "total"
                        from T
                        left join "Categories" on "Categories".id = T. "categoryId"

                        group by "Categories".id ,"key"
                        order by "Categories".id
                        )
                        select "categoryId", "categoryName",
                        (select array_agg(distinct "key")  from "Total")  as "columns",
                        JSON_AGG(JSON_BUILD_OBJECT("key",JSON_BUILD_OBJECT('salesAmount',COALESCE("sales",0),
                                                                        'discountTotal',COALESCE("discountTotal",0),
                                                                        'salesAfterDiscount',COALESCE("sales",0) - COALESCE("discountTotal",0),
                                                                            'taxTotal',COALESCE("taxTotal",0),
                                                                            'total',COALESCE("total",0)
                                                                            ))) as "summary"

                        from "Total"
                        group by "categoryId", "categoryName"
                        ${having}
                        ${orderBy}
                       ${limitQuery}
                    
                   `,
                values: [companyId, branches, from, to, compareType, period, NoOfperiod]
            }
            console.log("vaaaaaaaaaaaaaaa", query.values)


            const records = await DB.excu.query(query.text, query.values);

            if (filter && filter.topSales) {
                let records2 = records.rows.map(m => {
                    return {
                        categoryName: m.categoryName,
                        sales: m.summary[0].Total.salesAmount
                    }
                })

                return new ResponseData(true, "", records2)
            }

            if (records.rows && records.rows.length > 0) {
                columns = (<any>records.rows[0]).columns ? (<any>records.rows[0]).columns : columns
                results = records.rows
            }

            try {
                columns.sort((a, b) => {
                    const aa = moment(a, 'MMM/YYYY')
                    const bb = moment(b, 'MMM/YYYY')
                    return aa.diff(bb)
                })
            } catch { columns = columns }


            const DefaultSubColumns = ['salesAmount', 'discountTotal', 'salesAfterDiscount', 'taxTotal', 'total'];
            const selectedSubColumns = filter.subColumns ?? ['salesAmount'];
            const validSubColumns = selectedSubColumns.filter((col: string) =>
                DefaultSubColumns.includes(col)
            );
            if (validSubColumns.length === 0) {
                validSubColumns.push('salesAmount');
            }

            let resData = {
                records: results,
                subColumns: compareType == 'none' ? DefaultSubColumns : validSubColumns,
                columns: columns,
            }


            if (filter && filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Sales By Category",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches, compareType: compareType,
                    period: period, periodQty: NoOfperiod
                }
                report.records = results

                //get columns & subColumns
                resData.columns.forEach((col: any) => {
                    let childs: DataColumn[] = []
                    resData.subColumns.forEach((subcol: any) => childs.push({ key: subcol, properties: { columnType: 'currency' } }))
                    report.columns.push({ key: col, childs: childs, properties: { hasTotal: true } })
                })

                report.columns = [...[{ key: 'categoryName' }], ...report.columns]
                report.fileName = 'salesByCategory'

                return new ResponseData(true, "", report)

            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {


            throw new Error(error.message)
        }
    }

    public static async salesByProductReport(data: any, company: Company, brancheList: []) {

        try {
            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal;
            let branches = filter && filter.branches ? filter.branches : brancheList;

            //######## set time ##########
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;


            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
            }

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to



            //######################## sort ########################

            let sortby = filter && filter.sortBy ? filter.sortBy : [];
            let sortList = sortby.filter((item: any) => item.sortValue && item.sortValue.trim() !== "");

            if (sortList.length < 1) { sortList.push({ sortValue: "productName", sortDirection: 'asc' }) }

            let orderByQuery = "order by ";
            for (let i = 0; i < sortList.length; i++) {
                orderByQuery += `"${sortList[i].sortValue.trim()}" ${sortList[i].sortDirection ?? ""}`;
                if (i < sortList.length - 1) {
                    orderByQuery += ", ";
                }
            }
            //######################################################
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };
            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);

            let productIds = filter && filter.productIds && Array.isArray(filter.productIds) ? filter.productIds : null


            let offset = limit * (page - 1);

            let total = {};
            let count = 0;
            let resault: any[] = [];

            let orderBy = '';
            let having = '';
            let limitQuery = '';


            if (filter && filter.topSales) {
                orderBy = ` ORDER BY  "salesAmount" DESC `
                having = ` Having  CAST (SUM(T.sales)::NUMERIC AS REAL) > 0  `
            }
            else {
                orderBy = orderByQuery
            }

            console.log("orderByQuery", orderByQuery);


            // orderByQuery += `${orderBy}`


            const query: { text: string, values: any } = {
                text: ` with "lines" as (
                    select      				     
                    (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
                    "InvoiceLines"."taxTotal" as "taxTotal",
                    "InvoiceLines"."discountTotal" as "discountTotal",
                    "InvoiceLines".total as "total",
                    "InvoiceLines"."invoiceId",
                    "InvoiceLines"."createdAt",
                    "InvoiceLines"."branchId",
                    "InvoiceLines"."productId",
                    COALESCE("InvoiceLines".qty,0)  as qty, 
                    "InvoiceLines"."note",
                    "InvoiceLines"."companyId"
                from "InvoiceLines"
                where "InvoiceLines"."companyId" = $1
                and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  =any($2::uuid[] ))
                and ("InvoiceLines"."createdAt" >=$3 and "InvoiceLines"."createdAt" < $4)
            
                ),
                "invoiceData" as (
                select   prod."categoryId" as  "categoryId",
                        prod.id as "productId",
                        prod."barcode",
                        COALESCE("prod".name,"lines".note ) as "productName",
                        "lines"."sales",
                        "lines"."taxTotal",
                        "lines"."discountTotal",
                        "lines"."total",
                        "lines"."qty",
                        'invoice' AS "transactionType"
                from "lines"
                inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                left join "Products" as prod on prod."companyId" = $1 and  prod.id = "lines"."productId" 
                where ($5::uuid[] IS NULL or  "lines"."productId"  = any($5::uuid[]))
                                ),
                "creditNoteLines" as (

                                    
                    select      				     
                     (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end) as "sales",
                    "CreditNoteLines"."taxTotal" as "taxTotal",
                    "CreditNoteLines"."discountTotal" as "discountTotal",
                    "CreditNoteLines".total as "total",
                    COALESCE("CreditNoteLines".qty,0) as qty, 
                    "CreditNoteLines"."createdAt",
                    "CreditNoteLines"."branchId",
                    "CreditNoteLines"."productId",
                    "CreditNoteLines"."note",
                    "CreditNoteLines"."companyId"
                from "CreditNoteLines"
                where "CreditNoteLines"."companyId" = $1
                and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  =any($2::uuid[]))
                and ("CreditNoteLines"."createdAt" >=$3 and "CreditNoteLines"."createdAt" < $4)
         
                ),
                "creditNoteData" as (
                select   prod."categoryId" as  "categoryId",
                        prod.id as "productId",
                        prod."barcode",
                        COALESCE("prod".name,"creditNoteLines".note ) as "productName",
                        "creditNoteLines"."sales"  ,
                        "creditNoteLines"."taxTotal"  ,
                        "creditNoteLines"."discountTotal" ,
                        "creditNoteLines"."total" ,
                        "creditNoteLines"."qty" ,
                        		'creditNote' AS "transactionType"
                from "creditNoteLines"
                  left join "Products" as prod on prod."companyId" = $1 and   prod.id = "creditNoteLines"."productId" 
  
                where ($5::uuid[] IS NULL or  "creditNoteLines"."productId" = any($5::uuid[]))
                ),
                T AS (          
                select * from "invoiceData" union all select * from "creditNoteData"
                )
                    select 
                                      count(*) over(),
                    "Categories".id AS "categoryId",
                    COALESCE("Categories".name,'Uncategorized')as "categoryName",
                    "productId",
                    "productName",
                    "barcode",
                    SUM(case when "transactionType" = 'invoice' then "qty" else "qty" *(-1) end ) as qty,
                    sum( case when "transactionType" = 'invoice'then "sales"   else "sales" *(-1) end    ::text::numeric) as "salesAmount",
                    sum( case when "transactionType" = 'invoice'then  "taxTotal" else "taxTotal" *(-1) end  ::text::numeric) as "taxTotal",
                    sum(case when "transactionType" = 'invoice'then  "discountTotal" else "discountTotal" *(-1) end::text::numeric) as "discountTotal",
                    sum(case when "transactionType" = 'invoice'then  "total" else "total" *(-1) end::text::numeric) as "total",
                    sum(SUM(case when "transactionType" = 'invoice' then "qty" else "qty" *(-1) end )) over() as "totalQty",
                    sum(SUM( case when "transactionType" = 'invoice'then "sales"   else "sales" *(-1) end::text::numeric))  over() as "amountTotal",
                    sum(SUM(case when "transactionType" = 'invoice'then  "discountTotal" else "discountTotal" *(-1) end::text::numeric))  over() as "discountAmountTotal" ,
                    sum(SUM(case when "transactionType" = 'invoice'then  "taxTotal" else "taxTotal" *(-1) end ::text::numeric))  over() as "taxAmountTotal" ,
                    sum(SUM(case when "transactionType" = 'invoice'then  "total" else "total" *(-1) end::text::numeric))  over() as "totals" 
                 
                from T
                left join "Categories" on "Categories".id = T. "categoryId"

                group by "Categories".id ,"productId","productName",barcode
                ${having}
                ${orderBy}
               `,
                values: [companyId, branches, from, to, productIds]
            }



            limitQuery = filter && filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`


            console.log("orderByQuery", query.text);



            let records = await DB.exec.query(query.text + limitQuery, query.values);

            if (filter && filter.topSales) {
                let records2 = records.rows.map(m => {
                    return {
                        qty: m.qty,
                        sales: m.salesAmount,
                        barcode: m.barcode,
                        productName: m.productName,
                        categoryName: m.categoryName
                    }
                })

                return new ResponseData(true, "", records2)
            }

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { qty: t.totalQty, salesAmount: t.amountTotal, discountTotal: t.discountAmountTotal, taxTotal: t.taxAmountTotal, total: t.totals }
                resault = records.rows.map((e: any) => {
                    return {
                        barcode: e.barcode, productName: e.productName, categoryName: e.categoryName, qty: e.qty,
                        salesAmount: e.salesAmount, discountTotal: e.discountTotal,
                        taxTotal: e.taxTotal, total: e.total,
                    }
                })
            }



            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (records.rows.length < limit || page == pageCount) {
                lastIndex = count
            }
            let resData = {
                records: resault,
                count: count,
                total: total,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }



            if (filter && filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Sales By Product",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'categoryName' },
                { key: 'productName' },
                { key: 'barcode' },
                { key: 'qty', properties: { hasTotal: true } },
                { key: 'salesAmount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'discountTotal', properties: { hasTotal: true, columnType: 'discountTotal' } },
                { key: 'taxTotal', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'total', properties: { hasTotal: true, columnType: 'currency' } }
                ]

                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {


            throw new Error(error.message)
        }
    }

    public static async salesByMenuReport(data: any, company: Company, brancheList: []) {

        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : brancheList;




            //######## set time ##########
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;

            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
            }

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to

            //##########################
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };


            let NoOfperiod = filter && filter.periodQty ? filter.periodQty : null;
            let period = filter && filter.period ? filter.period : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : 'none';
            let columns = ["Total"]
            let results: any = []

            let query = {
                text: `WITH   "lines" as (       
                            select      				     
                           (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
                           "InvoiceLines"."taxTotal" as "taxTotal",
                           "InvoiceLines"."discountTotal" as "discountTotal",
                            "InvoiceLines".total as "total",
                            "InvoiceLines"."invoiceId",
                            "InvoiceLines"."createdAt",
                            "InvoiceLines"."branchId",
                            "InvoiceLines"."productId",
                            "InvoiceLines"."companyId"
                        from "InvoiceLines"
                        where "InvoiceLines"."companyId" = $1
                        and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any($2::uuid[]))
                        and ("InvoiceLines"."createdAt" >=case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
                                                    when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
                                                    else $3::timestamp 	END and "InvoiceLines"."createdAt" <$4)
                     ),
                        "invoiceData" as (
                        select    "lines"."productId" ,
                                "lines"."sales",
                                "lines"."taxTotal",
                                "lines"."discountTotal",
                                "lines"."total",
                                case when   lower($5::TEXT) = 'branch' then COALESCE("Branches" .name,'other') 
                                when    lower($5::TEXT) = 'period' and      lower($6::TEXT)= 'month'  then to_char( "lines"."createdAt"::TIMESTAMP,'Mon/YYYY') 
                                when   lower($5::TEXT)  = 'period' and      lower($6::TEXT)= 'year'  then  to_char( "lines"."createdAt"::TIMESTAMP,'YYYY') 
                                else 'Total' end as "key",
                                'invoice' as "transactionType"
                        from "lines"
                        inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                        inner join "Branches"   on "Branches".id = "lines"."branchId"
                                        ),
                        "creditNoteLines" as (

                                            
                            select      				     
                            (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end) as "sales",
                           "CreditNoteLines"."taxTotal"  as "taxTotal",
                           "CreditNoteLines"."discountTotal" as "discountTotal",
                           "CreditNoteLines".total as "total",

                            "CreditNoteLines"."createdAt",
                            "CreditNoteLines"."branchId",
                            "CreditNoteLines"."productId",
                            "CreditNoteLines"."companyId"
                        from "CreditNoteLines"
                        where "CreditNoteLines"."companyId" = $1
                        and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  = any($2::uuid[]) )
                        and ("CreditNoteLines"."createdAt" >=  case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
                                                    when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
                                                    else $3::timestamp 	END and "CreditNoteLines"."createdAt" <$4)
              
                        ),
                        "creditNoteData" as (
                        select   "creditNoteLines"."productId" ,
                                "creditNoteLines"."sales" ,
                                "creditNoteLines"."taxTotal" ,
                                "creditNoteLines"."discountTotal",
                                "creditNoteLines"."total" ,
                                case when   lower($5::TEXT) = 'branch' then COALESCE("Branches" .name,'other') 
                                when    lower($5::TEXT)  = 'period' and      lower($6::TEXT) = 'month'  then to_char( "creditNoteLines"."createdAt"::TIMESTAMP,'Mon/YYYY') 
                                when   lower($5::TEXT)= 'period' and        lower($6::TEXT) = 'year'  then  to_char( "creditNoteLines"."createdAt"::TIMESTAMP,'YYYY') 
                                else 'Total' end as "key",
                                'creditNote' as "transactionType"
                        from "creditNoteLines"
                        inner join "Branches"   on  "Branches".id = "creditNoteLines"."branchId"
                      ),
                        T AS (          
                        select * from "invoiceData" union all select * from "creditNoteData"
                        ),
                        "Total" as (
                            select "Menu".id as  "menuId",
                            COALESCE("Menu".name,'Others')as "menuName",
                            "key",
                            sum(case when "transactionType" = 'invoice' then "sales" else "sales" *(-1) end) as "sales",
                            sum(case when "transactionType" = 'invoice' then   "taxTotal" else   "taxTotal" *(-1) end) as "taxTotal",
                            sum(case when "transactionType" = 'invoice' then "discountTotal"   else   "discountTotal" *(-1) end ) as "discountTotal",
                            sum(case when "transactionType" = 'invoice' then "total"  else   "total" *(-1) end ) as "total"
                        from T
                       left join "MenuSectionProduct" on "MenuSectionProduct"."productId" =  T."productId"
                        left join "MenuSection" on "MenuSectionProduct"."menuSectionId" =  "MenuSection".id
                        left join "Menu" on "MenuSection"."menuId" =  "Menu".id

                        group by "Menu".id ,"key"
                        order by "Menu".id 
                        )
                        select "menuId", "menuName",
                        (select array_agg(distinct "key")  from "Total")  as "columns",
                        JSON_AGG(JSON_BUILD_OBJECT("key",JSON_BUILD_OBJECT('sales',COALESCE("sales",0),
                                                                          'discountTotal',COALESCE("discountTotal",0),
                                                                           'salesAfterDiscount',COALESCE("sales",0) - COALESCE("discountTotal",0),
                                                                          'taxTotal',COALESCE("taxTotal",0),
                                                                          'total',COALESCE("total",0)
                                                                         ))) as "summary"
                        

                        from "Total"
                        group by "menuId", "menuName"
                        order by "menuId"
                        
                    
                   `,
                values: [companyId, branches, from, to, compareType, period, NoOfperiod]
            }


            const records = await DB.excu.query(query.text, query.values);

            if (records.rows && records.rows.length > 0) {
                columns = (<any>records.rows[0]).columns ? (<any>records.rows[0]).columns : columns
                results = records.rows
            }

            try {
                columns.sort((a, b) => {
                    const aa = moment(a, 'MMM/YYYY')
                    const bb = moment(b, 'MMM/YYYY')
                    return aa.diff(bb)
                })
            } catch { columns = columns }


            const DefaultSubColumns = ['sales', 'discountTotal', 'salesAfterDiscount', 'taxTotal', 'total'];
            const selectedSubColumns = filter.subColumns ?? ['sales'];
            const validSubColumns = selectedSubColumns.filter((col: string) =>
                DefaultSubColumns.includes(col)
            );
            if (validSubColumns.length === 0) {
                validSubColumns.push('sales');
            }



            let resData = {
                records: results,
                subColumns: compareType == 'none' ? DefaultSubColumns : validSubColumns,
                columns: columns,

            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Sales By Menu",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches, compareType: compareType,
                    period: period, periodQty: NoOfperiod
                }
                report.records = results

                //get columns & subColumns
                resData.columns.forEach((col: any) => {
                    let childs: DataColumn[] = []
                    resData.subColumns.forEach((subcol: any) => childs.push({ key: subcol, properties: { columnType: 'currency' } }))
                    report.columns.push({ key: col, childs: childs, properties: { hasTotal: true } })
                })

                report.columns = [...[{ key: 'menuName' }], ...report.columns]
                report.fileName = 'salesByMenu'

                return new ResponseData(true, "", report)

            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {


            throw new Error(error.message)
        } finally {

        }
    }

    public static async salesByMenuSectionsReport(data: any, company: Company, brancheList: []) {

        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : brancheList;


            //######## set time ##########
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;


            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
            }
            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to

            //##########################
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };


            let NoOfperiod = filter && filter.periodQty ? filter.periodQty : null;
            let period = filter && filter.period ? filter.period : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : 'none';
            let columns = ["Total"]
            let results: any = []

            let query = {
                text: `WITH   "lines" as (       
                            select      				     
                           (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
                           "InvoiceLines"."taxTotal" as "taxTotal",
                           "InvoiceLines"."discountTotal" as "discountTotal",
                            "InvoiceLines".total as "total",
                            "InvoiceLines"."invoiceId",
                            "InvoiceLines"."createdAt",
                            "InvoiceLines"."branchId",
                            "InvoiceLines"."productId",
                            "InvoiceLines"."companyId"
                        from "InvoiceLines"
                        where "InvoiceLines"."companyId" = $1
                        and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any($2::uuid[]))
                        and ("InvoiceLines"."createdAt" >=case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
                                                    when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
                                                    else $3::timestamp 	END and "InvoiceLines"."createdAt" <$4)
                     ),
                        "invoiceData" as (
                        select    "lines"."productId" ,
                                "lines"."sales",
                                "lines"."taxTotal",
                                "lines"."discountTotal",
                                "lines"."total",
                                case when   lower($5::TEXT) = 'branch' then COALESCE("Branches" .name,'other') 
                                when    lower($5::TEXT) = 'period' and      lower($6::TEXT)= 'month'  then to_char( "lines"."createdAt"::TIMESTAMP,'Mon/YYYY') 
                                when   lower($5::TEXT)  = 'period' and      lower($6::TEXT)= 'year'  then  to_char( "lines"."createdAt"::TIMESTAMP,'YYYY') 
                                else 'Total' end as "key",
                                'invoice' as "transactionType"
                        from "lines"
                        inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                        inner join "Branches"   on "Branches".id = "lines"."branchId"
                                        ),
                        "creditNoteLines" as (

                                            
                            select      				     
                            (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end) as "sales",
                           "CreditNoteLines"."taxTotal"  as "taxTotal",
                           "CreditNoteLines"."discountTotal" as "discountTotal",
                           "CreditNoteLines".total as "total",

                            "CreditNoteLines"."createdAt",
                            "CreditNoteLines"."branchId",
                            "CreditNoteLines"."productId",
                            "CreditNoteLines"."companyId"
                        from "CreditNoteLines"
                        where "CreditNoteLines"."companyId" = $1
                        and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  = any($2::uuid[]) )
                        and ("CreditNoteLines"."createdAt" >=  case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
                                                    when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
                                                    else $3::timestamp 	END and "CreditNoteLines"."createdAt" <$4)
              
                        ),
                        "creditNoteData" as (
                        select   "creditNoteLines"."productId" ,
                                "creditNoteLines"."sales" ,
                                "creditNoteLines"."taxTotal" ,
                                "creditNoteLines"."discountTotal",
                                "creditNoteLines"."total" ,
                                case when   lower($5::TEXT) = 'branch' then COALESCE("Branches" .name,'other') 
                                when    lower($5::TEXT)  = 'period' and      lower($6::TEXT) = 'month'  then to_char( "creditNoteLines"."createdAt"::TIMESTAMP,'Mon/YYYY') 
                                when   lower($5::TEXT)= 'period' and        lower($6::TEXT) = 'year'  then  to_char( "creditNoteLines"."createdAt"::TIMESTAMP,'YYYY') 
                                else 'Total' end as "key",
                                'creditNote' as "transactionType"
                        from "creditNoteLines"
                        inner join "Branches"   on  "Branches".id = "creditNoteLines"."branchId"
                      ),
                        T AS (          
                        select * from "invoiceData" union all select * from "creditNoteData"
                        ),
                        "Total" as (
                           select "MenuSection".id as  "menuSectionId",
                            COALESCE("MenuSection".name,'Others')as "menuSectionName",
                            "key",
                            sum(case when "transactionType" = 'invoice' then "sales" else "sales" *(-1) end) as "sales",
                            sum(case when "transactionType" = 'invoice' then   "taxTotal" else   "taxTotal" *(-1) end) as "taxTotal",
                            sum(case when "transactionType" = 'invoice' then "discountTotal"   else   "discountTotal" *(-1) end ) as "discountTotal",
                            sum(case when "transactionType" = 'invoice' then "total"  else   "total" *(-1) end ) as "total"
                        from T
                       left join "MenuSectionProduct" on "MenuSectionProduct"."productId" =  T."productId"
                        left join "MenuSection" on "MenuSectionProduct"."menuSectionId" =  "MenuSection".id

                      
                        group by "MenuSection".id ,"key"
                        order by "MenuSection".id
                        )
                        select "menuSectionId", "menuSectionName",
                        (select array_agg(distinct "key")  from "Total")  as "columns",
                       JSON_AGG(JSON_BUILD_OBJECT("key",JSON_BUILD_OBJECT('sales',COALESCE("sales",0),
                                                                          'discountTotal',COALESCE("discountTotal",0),
                                                                          'salesAfterDiscount',COALESCE("sales",0) - COALESCE("discountTotal",0),
                                                                          'taxTotal',COALESCE("taxTotal",0),
                                                                          'total',COALESCE("total",0)
                                                                         ))) as "summary"
                        

                        from "Total"
                        group by "menuSectionId", "menuSectionName"
                        order by "menuSectionId"
                        
                        
                    
                   `,
                values: [companyId, branches, from, to, compareType, period, NoOfperiod]
            }






            const records = await DB.excu.query(query.text, query.values);

            if (records.rows && records.rows.length > 0) {
                columns = (<any>records.rows[0]).columns ? (<any>records.rows[0]).columns : columns
                results = records.rows
            }

            try {
                columns.sort((a, b) => {
                    const aa = moment(a, 'MMM/YYYY')
                    const bb = moment(b, 'MMM/YYYY')
                    return aa.diff(bb)
                })
            } catch { columns = columns }


            const DefaultSubColumns = ['sales', 'discountTotal', 'salesAfterDiscount', 'taxTotal', 'total'];
            const selectedSubColumns = filter.subColumns ?? ['sales'];
            const validSubColumns = selectedSubColumns.filter((col: string) =>
                DefaultSubColumns.includes(col)
            );
            if (validSubColumns.length === 0) {
                validSubColumns.push('sales');
            }


            let resData = {
                records: results,
                subColumns: compareType == 'none' ? DefaultSubColumns : validSubColumns,
                columns: columns,

            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Sales By Menu Sections",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches, compareType: compareType,
                    period: period, periodQty: NoOfperiod
                }
                report.records = results

                //get columns & subColumns
                resData.columns.forEach((col: any) => {
                    let childs: DataColumn[] = []
                    resData.subColumns.forEach((subcol: any) => childs.push({ key: subcol, properties: { columnType: 'currency' } }))
                    report.columns.push({ key: col, childs: childs, properties: { hasTotal: true } })
                })

                report.columns = [...[{ key: 'menuSectionName' }], ...report.columns]
                report.fileName = 'salesByMenuSections'

                return new ResponseData(true, "", report)

            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {


            throw new Error(error.message)
        }
    }

    public static async salesByProductCategory(data: any, company: Company, brancheList: []) {

        try {



            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let productIds = filter && filter.productIds && Array.isArray(filter.productIds) ? filter.productIds : null

            //######## set time ##########
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;


            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
            }

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to

            //##########################

            if (!Array.isArray(branches) || branches.length == 0) { branches = null };

            //category filter (filter.categoryIds)
            let categoryIds = filter && filter.categoryIds && Array.isArray(filter.categoryIds) ? filter.categoryIds : null;

            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let offset = limit * (page - 1);

            let total = {};
            let count = 0;
            let resault: any[] = [];

            let orderBy = '';
            let having = '';

            const query: { text: string, values: any } = {
                text: ` with "lines" as (
                    select      				     
                    (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
                    "InvoiceLines"."taxTotal" as "taxTotal",
                    "InvoiceLines"."discountTotal" as "discountTotal",
                    "InvoiceLines".total as "total",
                    "InvoiceLines"."invoiceId",
                    "InvoiceLines"."createdAt",
                    "InvoiceLines"."branchId",
                    "InvoiceLines"."productId",
                    COALESCE("InvoiceLines".qty,0)  as qty, 
                    "InvoiceLines"."note",
                    "InvoiceLines"."companyId"
                from "InvoiceLines"
                where "InvoiceLines"."companyId" = $1
                and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  =any($2::uuid[] ))
                and ("InvoiceLines"."createdAt" >=$3 and "InvoiceLines"."createdAt" < $4)
            
                ),
                "invoiceData" as (
                select   prod."categoryId" as  "categoryId",
                        prod.id as "productId",
                     
                        COALESCE("prod".name,"lines".note ) as "productName",
				    	COALESCE("lines".qty,0)  as "invoiceProdQty",
                        "sales" as "invoiceSales",
                        0  AS "creditNoteProdQty",
                       0 AS "creditNoteSales"
                from "lines"
                inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                left join "Products" as prod  on "prod"."companyId"  = $1 and  prod.id = "lines"."productId"
                where ($5::uuid[] IS NULL or  "lines"."productId"  = any($5::uuid[]))
                and ($6::uuid[] IS NULL or  prod."categoryId"  = any($6::uuid[]))
                                ),
                "creditNoteLines" as (

                                    
                    select      				     
                     (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end)  as "sales",
                    "CreditNoteLines"."taxTotal" as "taxTotal",
                    "CreditNoteLines"."discountTotal" as "discountTotal",
                    "CreditNoteLines".total as "total",
                    COALESCE("CreditNoteLines".qty,0)  as qty, 
                    "CreditNoteLines"."createdAt",
                    "CreditNoteLines"."branchId",
                    "CreditNoteLines"."productId",
                    "CreditNoteLines"."note",
                    "CreditNoteLines"."companyId"
                from "CreditNoteLines"
                where "CreditNoteLines"."companyId" = $1
                and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  =any($2::uuid[]))
                and ("CreditNoteLines"."createdAt" >=$3 and "CreditNoteLines"."createdAt" < $4)
         
                ),
                "creditNoteData" as (
                select   prod."categoryId" as  "categoryId",
                        prod.id as "productId",
                
                        COALESCE("prod".name,"creditNoteLines".note ) as "productName",
                        0 as "invoiceProdQty",
                        0 as "invoiceSales",
					   COALESCE("creditNoteLines".qty,0)  AS "creditNoteProdQty",
                       "sales" AS "creditNoteSales"

                from "creditNoteLines"
                left join "Products" as prod  on "prod"."companyId"  = $1 and prod.id = "creditNoteLines"."productId"
                where ($5::uuid[] IS NULL or  "creditNoteLines"."productId" = any($5::uuid[]))
                and ($6::uuid[] IS NULL or  prod."categoryId"  = any($6::uuid[]))
                ),
                T AS (          
                select * from "invoiceData" union all select * from "creditNoteData"
                )
                   select count(*) over(),
                               sum(SUM(COALESCE(T."invoiceProdQty",0)::text::numeric)) over() as "invoiceProdQtyTotal",
                               sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric)) over() as "invoiceSalesTotal",
                               sum(SUM(COALESCE(T."creditNoteProdQty",0)::text::numeric)) over() as "creditNoteProdQtyTotal",
                               sum(SUM(COALESCE(T."creditNoteSales",0)::text::numeric)) over() as "creditNoteSalesTotal",
                               sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))) over() as "salesTotal",
                               sum(SUM(COALESCE(T."invoiceProdQty",0)::text::numeric - (COALESCE(T."creditNoteProdQty",0)::text::numeric))) over() as "salesQtyTotal",
                               
                               sum(SUM(COALESCE(T."invoiceProdQty",0)::text::numeric)) over(partition by "Categories".id) as "invoiceProdQtyPerCategory",
                               sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric)) over(partition by "Categories".id) as "invoiceSalesPerCategory",
                               sum(SUM(COALESCE(T."creditNoteProdQty",0)::text::numeric)) over(partition by "Categories".id) as "creditNoteProdQtyPerCategory",
                               sum(SUM(COALESCE(T."creditNoteSales",0)::text::numeric)) over(partition by "Categories".id) as "creditNoteSalesPerCategory",
                               sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))) over(partition by "Categories".id) as "salesTotalPerCategory",
                               sum(SUM(COALESCE(T."invoiceProdQty",0)::text::numeric - (COALESCE(T."creditNoteProdQty",0)::text::numeric))) over(partition by "Categories".id) as "salesQtyTotalPerCategory",
                                
                               "Categories".id as "categoryId",
                               (case when "Categories".id is not null then COALESCE(NULLIF("Categories".name,''),'category') else 'Uncategorized' end) as "categoryName",
                               "productId",
                               "productName",
                               SUM(COALESCE(T."invoiceProdQty",0)::text::numeric) as "invoiceProdQty",
                               SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoiceSales",	   
                               SUM(COALESCE(T."creditNoteProdQty",0)::text::numeric) as "creditNoteProdQty",
                               SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "creditNoteSales",
                               SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric)) as "totalSales",
                               SUM(COALESCE(T."invoiceProdQty",0)::text::numeric - (COALESCE(T."creditNoteProdQty",0)::text::numeric)) as "totalSalesQty"
                        from(select * from "invoiceData" union all select * from "creditNoteData")T
                        left join "Categories"   on "Categories".id = T."categoryId"
                        group by "Categories".id , "productId", "productName"
                        ORDER BY "Categories".id , "productId"
                    
                    `,
                values: [companyId, branches, from, to, productIds, categoryIds]
            }


            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`


            let records = await DB.excu.query(query.text + limitQuery, query.values)
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { invoiceProdQty: t.invoiceProdQtyTotal, invoiceSales: t.invoiceSalesTotal, creditNoteProdQty: t.creditNoteProdQtyTotal, creditNoteSales: t.creditNoteSalesTotal, totalSales: t.salesTotal, totalSalesQty: t.salesQtyTotal }
                resault = records.rows.map((e: any) => {
                    return {
                        categoryId: e.categoryId, categoryName: e.categoryName, productId: e.productId, productName: e.productName,
                        invoiceProdQtyPerCategory: e.invoiceProdQtyPerCategory, invoiceSalesPerCategory: e.invoiceSalesPerCategory,
                        creditNoteProdQtyPerCategory: e.creditNoteProdQtyPerCategory, creditNoteSalesPerCategory: e.creditNoteSalesPerCategory,
                        salesTotalPerCategory: e.salesTotalPerCategory, salesQtyTotalPerCategory: e.salesQtyTotalPerCategory,

                        invoiceProdQty: e.invoiceProdQty, invoiceSales: e.invoiceSales,
                        creditNoteProdQty: e.creditNoteProdQty, creditNoteSales: e.creditNoteSales,
                        totalSales: e.totalSales, totalSalesQty: e.totalSalesQty
                    }
                })
            }

            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (records.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            let resData = {
                records: resault,
                count: count,
                total: total,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Sales By Products Category",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'categoryName' },
                { key: 'productName' },
                { key: 'invoiceProdQty', header: 'Invoice Product Qty', properties: { hasTotal: true, hasSubTotal: true } },
                { key: 'invoiceSales', properties: { hasTotal: true, hasSubTotal: true, columnType: 'currency' } },
                { key: 'creditNoteProdQty', header: 'Credit Note Prod Qty', properties: { hasTotal: true, hasSubTotal: true } },
                { key: 'creditNoteSales', properties: { hasTotal: true, hasSubTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'salesByProductsCategory'

                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async salesByMenuProductVsService(data: any, company: Company, brancheList: []) {

        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList


            //######## set time ##########
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;


            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
            }

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to

            //##########################
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };

            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);



            let offset = limit * (page - 1);

            let total = {};
            let count = 0;
            let resault: any[] = [];

            const query: { text: string, values: any } = {
                text: `WITH "lines" as (			
                        select      				     
                        (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
                           "InvoiceLines"."qty",
                        "InvoiceLines"."invoiceId",
                        "InvoiceLines"."createdAt",
                        "InvoiceLines"."branchId",
                        "InvoiceLines"."productId",
                        "InvoiceLines"."companyId",
                           "InvoiceLines".note
                    from "InvoiceLines"
                    where "InvoiceLines"."companyId" = $1
                    and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any ($2::uuid[]))
                    and ("InvoiceLines"."createdAt" >= $3 	 and "InvoiceLines"."createdAt" < $4)
                    ),
                    "invoiceData" as (
                    select   "Invoices"."serviceId" as  "serviceId",
					       	prod.id as "productId",
                            COALESCE(prod.name,  "lines".note) as "productName",
                         "lines"."qty" as "invoiceProdQty",
						  "lines"."sales" as "invoiceSales",
						   0  AS "creditNoteProdQty",
                           0 AS "creditNoteSales"
                    from "lines"
                    inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                    inner join "Branches"   on  "Branches".id = "lines"."branchId"
                    left join "Products" as prod  on prod.id = "lines"."productId" 
                                    ),
                    "creditNoteLines" as (

                                        
                        select      				     
                        (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end) as "sales",
                         "CreditNoteLines"."qty",
                        "CreditNoteLines"."createdAt",
                        "CreditNoteLines"."branchId",
                        "CreditNoteLines"."productId",
                        "CreditNoteLines"."creditNoteId",
                        "CreditNoteLines"."companyId",
                          "CreditNoteLines".note
                    from "CreditNoteLines"
                    where "CreditNoteLines"."companyId" = $1
                    and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId" =any($2::uuid[]))
                    and ("CreditNoteLines"."createdAt" >= $3 and "CreditNoteLines"."createdAt" < $4)
                
                    ),
                    "creditNoteData" as (
                    select   "Invoices"."serviceId" as  "serviceId",
					       	prod.id as "productId",
                            COALESCE(prod.name,  "creditNoteLines".note) as "productName",
						    0 as "invoiceProdQty",
                            0 as "invoiceSales",
						    "creditNoteLines".qty as   "creditNoteProdQty",
						   "creditNoteLines"."sales" as "creditNoteSales"
                    from "creditNoteLines"
                    inner join "Branches"   on   "Branches".id = "creditNoteLines"."branchId"
					inner join "CreditNotes" on "CreditNotes".id = "creditNoteLines"."creditNoteId" 
					inner join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId" 
                    left join "Products" as prod  on prod.id = "creditNoteLines"."productId" ), T AS (
					 select * from "invoiceData" union all select * from "creditNoteData"
					)
					select count(*) over(),     
                               sum(SUM(COALESCE(T."invoiceProdQty",0)::text::numeric)) over() as "invoiceProdQtyTotal",
                               sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric)) over() as "invoiceSalesTotal",
                               sum(SUM(COALESCE(T."creditNoteProdQty",0)::text::numeric)) over() as "creditNoteProdQtyTotal",
                               sum(SUM(COALESCE(T."creditNoteSales",0)::text::numeric)) over() as "creditNoteSalesTotal",
                               sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))) over() as "salesTotal",
                               sum(SUM(COALESCE(T."invoiceProdQty",0)::text::numeric - (COALESCE(T."creditNoteProdQty",0)::text::numeric))) over() as "salesQtyTotal",
                               
                               sum(SUM(COALESCE(T."invoiceProdQty",0)::text::numeric)) over(partition by "Services".id) as "invoiceProdQtyPerService",
                               sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric)) over(partition by "Services".id) as "invoiceSalesPerService",
                               sum(SUM(COALESCE(T."creditNoteProdQty",0)::text::numeric)) over(partition by "Services".id) as "creditNoteProdQtyPerService",
                               sum(SUM(COALESCE(T."creditNoteSales",0)::text::numeric)) over(partition by "Services".id) as "creditNoteSalesPerService",
                               sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))) over(partition by "Services".id) as "salesTotalPerService",
                               sum(SUM(COALESCE(T."invoiceProdQty",0)::text::numeric - (COALESCE(T."creditNoteProdQty",0)::text::numeric))) over(partition by "Services".id) as "salesQtyTotalPerService",
                                
                               "Services".id as "serviceId",
                               (case when "Services".id is not null then COALESCE(NULLIF("Services".name,''),'Others') else 'Uncategorized' end) as "serviceName",
                               "productId",
                               "productName",
                               SUM(COALESCE(T."invoiceProdQty",0)::text::numeric) as "invoiceProdQty",
                               SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoiceSales",	   
                               SUM(COALESCE(T."creditNoteProdQty",0)::text::numeric) as "creditNoteProdQty",
                               SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "creditNoteSales",
                               SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric)) as "totalSales",
                               SUM(COALESCE(T."invoiceProdQty",0)::text::numeric - (COALESCE(T."creditNoteProdQty",0)::text::numeric)) as "totalSalesQty"
                        from  T
                        left join "Services" on "Services".id = T."serviceId"
                        group by "Services".id , "productId", "productName"
                        order by "Services".id , "productId", "productName"
                    `,
                values: [companyId, branches, from, to]
            }


            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`


            let records = await DB.excu.query(query.text + limitQuery, query.values)

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)

                total = { invoiceProdQty: t.invoiceProdQtyTotal, invoiceSales: t.invoiceSalesTotal, creditNoteProdQty: t.creditNoteProdQtyTotal, creditNoteSales: t.creditNoteSalesTotal, totalSales: t.salesTotal, totalSalesQty: t.salesQtyTotal }
                resault = records.rows.map((e: any) => {
                    return {
                        serviceId: e.serviceId, serviceName: e.serviceName,
                        invoiceProdQtyPerService: e.invoiceProdQtyPerService, invoiceSalesPerService: e.invoiceSalesPerService,
                        creditNoteProdQtyPerService: e.creditNoteProdQtyPerService, creditNoteSalesPerService: e.creditNoteSalesPerService,
                        salesTotalPerService: e.salesTotalPerService, salesQtyTotalPerService: e.salesQtyTotalPerService,
                        productId: e.productId, productName: e.productName,
                        invoiceProdQty: e.invoiceProdQty, invoiceSales: e.invoiceSales,
                        creditNoteProdQty: e.creditNoteProdQty, creditNoteSales: e.creditNoteSales,
                        totalSales: e.totalSales, totalSalesQty: e.totalSalesQty
                    }
                })

            }

            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (records.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            let resData = {
                records: resault,
                count: count,
                total: total,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Sales By Product Vs Service",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches

                }
                report.records = records.rows
                report.columns = [{ key: 'ServiceName' },
                { key: 'productName' },
                { key: 'invoiceProdQty', header: 'Invoice Product Qty', properties: { hasTotal: true, hasSubTotal: true } },
                { key: 'invoiceSales', properties: { hasTotal: true, hasSubTotal: true, columnType: 'currency' } },
                { key: 'creditNoteProdQty', header: 'Credit Note Prod Qty', properties: { hasTotal: true, hasSubTotal: true } },
                { key: 'creditNoteSales', properties: { hasTotal: true, hasSubTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'salesByProductVsService'

                return new ResponseData(true, "", report)
            }


            return new ResponseData(true, "", resData)
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async salesByMenuProductVsOptions(data: any, company: Company, brancheList: []) {

        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            //######## set time ##########
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;


            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
            }

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to

            //##########################
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };


            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let offset = limit * (page - 1);

            let total = {};
            let count = 0;
            let resault: any[] = [];

            const query: { text: string, values: any } = {
                text: ` 
                
                   select      				   
	               count(*) over(),
                   "InvoiceLines"."productId",
                   "InvoiceLines"."invoiceId", 
                  "InvoiceLineOptions"."optionId",
                   "Options".name as "optionName",
				   "Products".name as "productName",
	               sum(case when sum("InvoiceLineOptions".qty) is null then sum("InvoiceLines".qty) else sum("InvoiceLineOptions".qty) end) over() as "totalQty",
				   CAST(sum(sum (COALESCE("InvoiceLineOptions".price,0)::text::numeric)) over() AS float) as "total",
                   sum(case when sum("InvoiceLineOptions".qty) is null then sum("InvoiceLines".qty) else sum("InvoiceLineOptions".qty) end) over(partition by  "InvoiceLines"."productId") as "totalOptionQtyPerProd",
                   CAST(sum(sum (COALESCE("InvoiceLineOptions".price,0)::text::numeric))  over(partition by  "InvoiceLines"."productId") AS float) as "totalOptionSalesPerProd",
                  case when sum("InvoiceLineOptions".qty) is null then sum("InvoiceLines".qty) else sum("InvoiceLineOptions".qty) end as qty,
                  sum(COALESCE("InvoiceLineOptions".price,0)) as "optionPrice"
                from "InvoiceLines"
			    inner  JOIN "InvoiceLineOptions" on  "InvoiceLineOptions"."invoiceLineId" = "InvoiceLines".id
                inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
	            INNER JOIN "Products" on  "InvoiceLines"."productId" = "Products".id  and "Products".type = 'menuItem'
                inner JOIN "Options" on  "Options".id =  "InvoiceLineOptions"."optionId"
                   where "InvoiceLines"."companyId" = $1
                and  ( $2::uuid[] IS NULL or  "InvoiceLines"."branchId"  =any( $2::uuid[]  ))
                and ("InvoiceLines"."createdAt" >=$3 and "InvoiceLines"."createdAt" < $4)
                 group by  "InvoiceLineOptions"."optionId", "InvoiceLines"."productId" ,    "InvoiceLines"."invoiceId", "Options".name ,  "Products".name 
	     
                

             
                    
                    `,
                values: [companyId, branches, from, to]
            }


            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`

            console.log(query.text + limitQuery, query.values)
            let records = await DB.excu.query(query.text + limitQuery, query.values)

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)

                total = { qty: t.totalQty, optionPrice: t.total }
                resault = records.rows.map((e: any) => {
                    return {
                        productName: e.productName,
                        totalOptionQtyPerProd: e.totalOptionQtyPerProd, totalOptionSalesPerProd: e.totalOptionSalesPerProd,
                        qty: e.qty, optionName: e.optionName,
                        optionPrice: e.optionPrice
                    }
                })



            }

            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (records.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            let resData = {
                records: resault,
                count: count,
                total: total,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Sales By Products Vs Options",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'productName' },
                { key: 'optionName' },
                { key: 'qty', header: 'Quantity', properties: { hasTotal: true, hasSubTotal: true } },
                { key: 'optionPrice', properties: { hasTotal: true, hasSubTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'salesByProductsVsOptions'

                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async SalesByBrandReport(data: any, company: Company, brancheList: []) {

        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : brancheList;

            //######## set time ##########
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;


            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
            }

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to

            //##########################
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };


            let NoOfperiod = filter && filter.periodQty ? filter.periodQty : null;
            let period = filter && filter.period ? filter.period : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : 'none';
            let columns = ["Total"]
            let results: any = []

            let limit = data.limit;
            let orderBy = '';
            let having = '';
            let limitQuery = '';
            if (limit) {
                orderBy = ` ORDER BY  CAST (SUM(sales) AS REAL)::NUMERIC DESC, "brandId" `
                having = ` Having  CAST (SUM(sales) AS REAL)::NUMERIC > 0  `
                limitQuery = ` limit ${limit} `
            }

            let query = {
                text: `WITH "lines" as (			
                        select      				     
                        (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
                        "InvoiceLines"."taxTotal" as "taxTotal",
                        "InvoiceLines"."discountTotal" as "discountTotal",
                         "InvoiceLines".total as "total",
                        "InvoiceLines"."invoiceId",
                        "InvoiceLines"."createdAt",
                        "InvoiceLines"."branchId",
                        "InvoiceLines"."productId",
                        "InvoiceLines"."companyId"
                    from "InvoiceLines"
                    where "InvoiceLines"."companyId" = $1
                    and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any ($2::uuid[]))
                    and ("InvoiceLines"."createdAt" >=case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
                                                    when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
                                                    else $3::timestamp 	END and "InvoiceLines"."createdAt" < $4)
                    ),
                    "invoiceData" as (
                    select   "prod"."brandid" as  "brandId",
                            "lines"."sales",
                            "lines"."taxTotal",
                            "lines"."discountTotal",
                            "lines"."total",
                            case when  lower($5::TEXT)  = 'branch' then COALESCE("Branches" .name,'other') 
                            when   lower($5::TEXT)  = 'period' and      lower($6::TEXT)  = 'month'  then to_char( "lines"."createdAt"::TIMESTAMP,'Mon/YYYY') 
                            when  lower($5::TEXT) = 'period' and     lower($6::TEXT) = 'year'  then  to_char( "lines"."createdAt"::TIMESTAMP,'YYYY') 
                            else 'Total' end as "key",
                                 'invoice' as "transactionType"
                    from "lines"
                    inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                    inner join "Branches"   on  "Branches".id = "lines"."branchId"
                    left join "Products" as prod  on prod.id = "lines"."productId" 
                                    ),
                    "creditNoteLines" as (

                                        
                        select      				     
                        (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end) as "sales",
                       "CreditNoteLines"."taxTotal" as "taxTotal",
                       "CreditNoteLines"."discountTotal" as "discountTotal",
                       "CreditNoteLines".total as "total",
                      "CreditNoteLines"."creditNoteId",
                        "CreditNoteLines"."createdAt",
                        "CreditNoteLines"."branchId",
                        "CreditNoteLines"."productId",
                        "CreditNoteLines"."companyId"
                    from "CreditNoteLines"
                    where "CreditNoteLines"."companyId" = $1
                    and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId" =any($2::uuid[]))
                    and ("CreditNoteLines"."createdAt" >=case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
                                                    when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
                                                    else $3::timestamp 	END and "CreditNoteLines"."createdAt" < $4)
                
                    ),
                    "creditNoteData" as (
                    select  "prod"."brandid" as  "brandId",
                            "creditNoteLines"."sales" ,
                            "creditNoteLines"."taxTotal" ,
                            "creditNoteLines"."discountTotal" ,
                            "creditNoteLines"."total" ,
                            case when  lower($5::TEXT)   = 'branch' then COALESCE("Branches" .name,'other') 
                            when   lower($5::TEXT)   = 'period' and   lower($6::TEXT)  = 'month'  then to_char( "creditNoteLines"."createdAt"::TIMESTAMP,'Mon/YYYY') 
                            when lower($5::TEXT)   = 'period' and      lower($6::TEXT)  = 'year'  then  to_char( "creditNoteLines"."createdAt"::TIMESTAMP,'YYYY') 
                            else 'Total' end as "key",
                            'creditNote' as "transactionType"
                    from "creditNoteLines"
                    inner join "Branches"   on   "Branches".id = "creditNoteLines"."branchId"
					inner join "CreditNotes" on "CreditNotes".id = "creditNoteLines"."creditNoteId" 
					inner join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId" 
                    left join "Products" as prod  on prod.id = "creditNoteLines"."productId" ),
                    T AS (          
                    select * from "invoiceData" union all select * from "creditNoteData"
                    ),
                    "Total" as (
                        select "Brands".id AS "brandId",
                             COALESCE("Brands".name,'Uncategorized')as "brandName",
                        "key",
                           sum(case when "transactionType" = 'invoice' then "sales" else "sales" *(-1) end) as "sales",
                            sum(case when "transactionType" = 'invoice' then   "taxTotal" else   "taxTotal" *(-1) end) as "taxTotal",
                            sum(case when "transactionType" = 'invoice' then "discountTotal"   else   "discountTotal" *(-1) end ) as "discountTotal",
                            sum(case when "transactionType" = 'invoice' then "total"  else   "total" *(-1) end ) as "total"
                    from T
                
                            left join "Brands" ON  "Brands".id = T."brandId"  
                    group by "Brands".id ,"key"
                    order by "Brands".id
                    )
                    select "brandId", "brandName",
                    (select array_agg(distinct "key")  from "Total")  as "columns",
                    JSON_AGG(JSON_BUILD_OBJECT("key",JSON_BUILD_OBJECT('salesAmount',COALESCE("sales",0),
                                                                    'discountTotal',COALESCE("discountTotal",0),
                                                                'salesAfterDiscount',COALESCE("sales",0) - COALESCE("discountTotal",0),
                                                                        'taxTotal',COALESCE("taxTotal",0),
                                                                        'total',COALESCE("total",0)
                                                                        ))) as "summary"

                    from "Total"
                    group by "brandId", "brandName"
                    ${having}
                    ${orderBy}
                    ${limitQuery}
                    
                   `,
                values: [companyId, branches, from, to, compareType, period, NoOfperiod]
            }


            const records = await DB.excu.query(query.text, query.values);

            if (filter && filter.topSales) {
                let records2 = records.rows.map(m => {
                    return {
                        brandName: m.brandName,
                        sales: m.summary[0].Total.salesAmount

                    }
                })

                return new ResponseData(true, "", records2)
            }

            if (records.rows && records.rows.length > 0) {
                columns = (<any>records.rows[0]).columns ? (<any>records.rows[0]).columns : columns
                results = records.rows
            }

            try {
                columns.sort((a, b) => {
                    const aa = moment(a, 'MMM/YYYY')
                    const bb = moment(b, 'MMM/YYYY')
                    return aa.diff(bb)
                })
            } catch { columns = columns }

            const DefaultSubColumns = ['salesAmount', 'discountTotal', 'salesAfterDiscount', 'taxTotal', 'total'];
            const selectedSubColumns = (filter && filter.subColumns) ?? ['salesAmount'];
            const validSubColumns = selectedSubColumns.filter((col: string) =>
                DefaultSubColumns.includes(col)
            );
            if (validSubColumns.length === 0) {
                validSubColumns.push('salesAmount');
            }


            let resData = {
                records: results,
                subColumns: compareType == 'none' ? DefaultSubColumns : validSubColumns,
                columns: columns,

            }

            if (filter && filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Sales By Brand",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches, compareType: compareType,
                    period: period, periodQty: NoOfperiod
                }
                report.records = results

                //get columns & subColumns
                resData.columns.forEach((col: any) => {
                    let childs: DataColumn[] = []
                    resData.subColumns.forEach((subcol: any) => childs.push({ key: subcol, properties: { columnType: 'currency' } }))
                    report.columns.push({ key: col, childs: childs, properties: { hasTotal: true } })
                })

                report.columns = [...[{ key: 'brandName' }], ...report.columns]
                report.fileName = 'salesByBrand'

                return new ResponseData(true, "", report)

            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {


            throw new Error(error.message)
        }

    }





    //others
    public static async productPreparedTimeSummaryReport(data: any, company: Company, brancheList: []) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : brancheList;

            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };


            let NoOfperiod = filter && filter.periodQty ? filter.periodQty : null;
            let period = filter && filter.period ? filter.period : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : 'none';
            let columns = ["Total"]
            let results: any = []

            let query = {
                text: `WITH "values" AS (
                    SELECT  $1::uuid AS "companyId",
                            $2::uuid[] AS "branches",
                            case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
                                 when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
                                 else $3::timestamp 	END "fromDate",
                            $4::timestamp AS "toDate",
                            lower($5)::text As "compType",
                            lower($6)::text as "period"
                    )	
                    ,"records" as 
                    (select    
                    "Products".id as "prodId",
                    COALESCE("Products".name,"InvoiceLines".note ) as "prodName",
                    case when "values"."compType" = 'branch' then COALESCE("Branches".name,'other') 
                     when "values"."compType" = 'period' and "period" = 'month' then to_char( "InvoiceLines"."createdAt",'Mon/YYYY') 
                     when "values"."compType" = 'period' and "period" = 'year' then to_char("InvoiceLines"."createdAt"::TIMESTAMP,'YYYY') 
                     else 'Total' end as "key",
                    sum("InvoiceLines".qty) as "qty",
                    SUM(EXTRACT(EPOCH FROM ("InvoiceLines"."readyTime"::timestamp - "InvoiceLines"."createdAt"::timestamp))) as "totalPreparedTime",
                    avg(EXTRACT(EPOCH FROM ("InvoiceLines"."readyTime"::timestamp - "InvoiceLines"."createdAt"::timestamp))) as "avgReadyTime"
                    from "InvoiceLines"
                    join "values" on true
                    LEFT JOIN "Products" on"Products".id = "InvoiceLines"."productId"
                    INNER JOIN "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId"
                    INNER JOIN "Branches" on "Branches".id = "Invoices"."branchId"
                    WHERE "Branches"."companyId"= "values"."companyId"
                     AND ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                     AND "Invoices"."status" <>'Draft'  AND "Invoices"."readyTime" is not null   
                     AND  "InvoiceLines"."createdAt" >="values"."fromDate" AND "InvoiceLines"."createdAt" <"values"."toDate"
                     group by "Products".id,"key", "prodName"
                    )
                    
                    select "prodId", "prodName", 
                    (select array_agg(distinct "key")  from "records")  as "columns",
                    JSON_AGG(JSON_BUILD_OBJECT("key",JSON_BUILD_OBJECT('qty',COALESCE("qty",0),
                                                                         'totalPreparedTime',COALESCE("totalPreparedTime",0),
                                                                        'avgReadyTime',COALESCE("avgReadyTime",0)  
                                                                       ))) as "summary"
                    from "records"
                    group by "prodId" ,"prodName"
                    order by "prodId" ,"prodName"
                   `,
                values: [companyId, branches, from, to, compareType, period, NoOfperiod]
            }




            const records = await DB.excu.query(query.text, query.values);

            if (records.rows && records.rows.length > 0) {
                columns = (<any>records.rows[0]).columns ? (<any>records.rows[0]).columns : columns
                results = records.rows
            }

            try {
                columns.sort((a, b) => {
                    const aa = moment(a, 'MMM/YYYY')
                    const bb = moment(b, 'MMM/YYYY')
                    return aa.diff(bb)
                })
            } catch { columns = columns }

            let resData = {
                records: results,
                columns: columns,
                subColumns: ['qty', 'totalPreparedTime', 'avgReadyTime']

            }

            if (filter.export) {

                let report = new ReportData()
                report.filter = {
                    title: "Product Prepared Time Summary",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches, compareType: compareType,
                    period: period, periodQty: NoOfperiod
                }
                report.records = results

                //get columns & subColumns
                resData.columns.forEach((col: any) => {
                    let childs: DataColumn[] = []
                    resData.subColumns.forEach((subcol: any) => {
                        if (subcol === 'totalPreparedTime' || subcol == 'avgReadyTime') childs.push({ key: subcol, properties: { columnType: 'timeInMinutes' } })
                        else childs.push({ key: subcol })
                    }
                    )
                    report.columns.push({ key: col, childs: childs })
                })

                report.columns = [...[{ key: 'prodName', header: 'Product Name' }], ...report.columns]
                report.fileName = 'ProductPreparedTimeSummary'
                return new ResponseData(true, "", report)

            }
            return new ResponseData(true, "", resData)
        } catch (error: any) {


            throw new Error(error.message)
        }
    }

    public static async preparedTimeSummaryReport(data: any, company: Company, branchList: []) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : branchList;

            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };




            let NoOfperiod = filter && filter.periodQty ? filter.periodQty : null;
            let period = filter && filter.period ? filter.period : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : 'none';
            let columns = ["Total"]
            let results: any = []

            let query = {
                text: `WITH "values" AS (
                    SELECT  $1::uuid AS "companyId",
                            $2::uuid[] AS "branches",
                            case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
                                 when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
                                 else $3::timestamp 	END "fromDate",
                            $4::timestamp AS "toDate",
                            lower($5)::text As "compType",
                            lower($6)::text as "period"
                    )	
                    ,"CountedOrders" as (
                        select  "Services".id as "serviceId",
                                "Services".name as "serviceName",
                                Count("Invoices".id) as "countedInvoices",
                                0 as  "unCountedInvoices",
                                SUM(EXTRACT(EPOCH FROM ("Invoices"."readyTime"::timestamp - "Invoices"."createdAt"::timestamp))) as "totalPreparedTime",
                                case when "values"."compType" = 'branch' then COALESCE("Branches".name,'other') 
                                     when "values"."compType" = 'period' and "period" = 'Month' then to_char( "Invoices"."createdAt",'Mon/YYYY') 
                                     when "values"."compType" = 'period' and "period" = 'Year' then to_char("Invoices"."createdAt"::TIMESTAMP,'YYYY') 
                                     else 'Total' end as "key"
                        from "Invoices"
                        join "values" on true
                        inner join "Services" on "Invoices"."serviceId" = "Services".id
                        inner join "Branches" on  "Invoices"."branchId" = "Branches".id 
                        where "Branches"."companyId"= "values"."companyId"
                                 and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                              and "Invoices"."createdAt" >="values"."fromDate" AND "Invoices"."createdAt" <"values"."toDate"
                              and "Invoices"."status" <>'Draft'  AND "Invoices"."readyTime" is not null   
                        group by  "Services".id , "Services".name, "key"
                        ),
                        "UnCountedOrders" as (
                        select  "Services".id as "serviceId",
                                "Services".name as "serviceName",
                                0 as "countedInvoices",
                                Count("Invoices".id) as "unCountedInvoices",
                                0 as "totalPreparedTime",
                                case when "values"."compType" = 'branch' then COALESCE("Branches".name,'other') 
                                     when "values"."compType" = 'period' and "period" = 'Month' then to_char( "Invoices"."createdAt",'Mon/YYYY') 
                                     when "values"."compType" = 'period' and "period" = 'Year' then to_char("Invoices"."createdAt"::TIMESTAMP,'YYYY') 
                                     else 'Total' end as "key"
                        from "Invoices"
                        join "values" on true
                        inner join "Services" on "Invoices"."serviceId" = "Services".id
                        inner join "Branches" on  "Invoices"."branchId" = "Branches".id 
                        where "Branches"."companyId"= "values"."companyId"
                                 and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                              and "Invoices"."createdAt" >="values"."fromDate" AND "Invoices"."createdAt" <"values"."toDate"
                              and "Invoices"."status" <>'Draft'  AND "Invoices"."readyTime" is  null   
                        group by  "Services".id , "Services".name,"key"
                        ),
                        "records" as (
                        select T."serviceId",
                               T."serviceName",
                               T."key",
                               sum(T."countedInvoices") as "countedInvoices",
                               sum(T."unCountedInvoices") as "unCountedInvoices",
                               sum(T."totalPreparedTime") as "totalReadyTime"
                        from (select * from "CountedOrders"  UNION ALL   select * from "UnCountedOrders")T
                        group by  T."serviceId", T."serviceName","key"
                        )
                        select "serviceId", "serviceName", 
                        (select array_agg(distinct "key")  from "records")  as "columns",
                        JSON_AGG(JSON_BUILD_OBJECT("key",JSON_BUILD_OBJECT('countedInvoices',COALESCE("countedInvoices",0),
                                                                             'unCountedInvoices',COALESCE("unCountedInvoices",0),
                                                                            'totalReadyTime',COALESCE("totalReadyTime",0)  
                                                                           ))) as "summary"
                        from "records"
                        group by "serviceId" ,"serviceName"
                   `,
                values: [companyId, branches, from, to, compareType, period, NoOfperiod]
            }




            const records = await DB.excu.query(query.text, query.values);

            if (records.rows && records.rows.length > 0) {
                columns = (<any>records.rows[0]).columns ? (<any>records.rows[0]).columns : columns
                results = records.rows
            }

            try {
                columns.sort((a, b) => {
                    const aa = moment(a, 'MMM/YYYY')
                    const bb = moment(b, 'MMM/YYYY')
                    return aa.diff(bb)
                })
            } catch { columns = columns }

            let resData = {
                records: results,
                columns: columns,
                subColumns: ['countedInvoices', 'unCountedInvoices', 'totalReadyTime']

            }

            if (filter.export) {

                let report = new ReportData()
                report.filter = {
                    title: "Prepared Time Summary",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches, compareType: compareType,
                    period: period, periodQty: NoOfperiod
                }
                report.records = records.rows

                //get columns & subColumns

                //records.rows.forEach((elem: any) => { elem.summary.forEach((el: any) => Object.keys(el).forEach((e: any) => el[e].totalReadyTime = (Number(el[e].totalReadyTime) ?? 0) / 60)) })

                resData.columns.forEach((col: any) => {
                    let childs: DataColumn[] = []
                    resData.subColumns.forEach((subcol: any) => {
                        if (subcol == 'totalReadyTime') childs.push({ key: subcol, properties: { columnType: 'timeInMinutes' } })
                        else childs.push({ key: subcol })
                    }
                    )
                    report.columns.push({ key: col, childs: childs })
                })

                report.columns = [...[{ key: 'serviceName' }], ...report.columns]
                report.fileName = 'PreparedTimeSummary'
                return new ResponseData(true, "", report)

            }
            return new ResponseData(true, "", resData)
        } catch (error: any) {


            throw new Error(error.message)
        }
    }

    public static async zeroSalesProducts(data: any, company: Company, brancheList: []) {
        try {

            const companyId = company.id;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;

            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };

            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);



            let offset = limit * (page - 1);

            let count = 0;
            let resault: any[] = [];

            const query: { text: string, values: any } = {
                text: `with "values" as (
                    select $1::uuid as "companyId",
                           $2::uuid[] as "branches",
                           $3::timestamp as "fromDate",
                           $4::timestamp as "toDate"
                    )
                    ,"t1" as (
                    select DISTINCT "InvoiceLines"."productId"
                    from "Invoices"
                    join "values" on true
                    inner join "Branches" ON "Branches".id = "Invoices"."branchId" 
                    inner join "InvoiceLines" ON "InvoiceLines"."invoiceId" = "Invoices".id
                    where "Branches"."companyId" = "values"."companyId"  
                        and "Invoices"."status" <> 'Draft' 
                        and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                        and ( "InvoiceLines"."createdAt" >= "values"."fromDate" and  "InvoiceLines"."createdAt" < "values"."toDate"  )
                        
                    )
                   
                    SELECT count(*) over(),
                            "Products".id, 
                            "Products".name as "productName",
                            "Products".barcode,
                            "Categories"."name" as "categoryName", 
                            "Products". "UOM",
                            "Products"."defaultPrice",
                            sum("BranchProducts"."onHand") as "onHand"
                    FROM "Products"
                    join "values" on true
                    left join "t1" on "Products".id = "t1"."productId"
                    inner join "BranchProducts" ON "BranchProducts"."productId" = "Products".id
                    left join "Categories" ON "Categories".id = "Products"."categoryId"
                    where "t1"."productId" is  null
                    and "Products"."isDeleted" = false 
                    and "Products"."companyId" = "values"."companyId"
                    and (array_length("values"."branches",1) IS NULL or  "BranchProducts"."branchId" = Any("values"."branches"))
                    and ( "Products"."createdAt" <= "values"."toDate"  )
                    group by "Products".id ,"Categories"."name"
                    order by "Products".id
                    
                    `,
                values: [companyId, branches, from, to]
            }


            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`


            let records = await DB.excu.query(query.text + limitQuery, query.values)

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                resault = records.rows
            }

            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (records.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            let resData = {
                records: resault,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }



            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Unsold Products Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'productName' },
                { key: 'barcode' },
                { key: 'categoryName' },
                { key: 'UOM' },
                { key: 'defaultPrice', properties: { columnType: 'currency' } },
                { key: 'onHand' }
                ]
                report.fileName = 'UnsoldProductsReport'
                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {


            throw new Error(error)
        }
    }


    public static async salesByMenuProductCategory2(data: any, company: Company) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : [];
            let from = filter && filter.fromDate ? filter.fromDate : null;
            let to = filter && filter.toDate ? filter.toDate : new Date();
            //add one day 
            to = moment(new Date(to)).add(1, 'day')
            //reset hours to 00:00:00
            from = await TimeHelper.resetHours(from)
            to = await TimeHelper.resetHours(to)

            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let offset = limit * (page - 1);

            let total = {};
            let count = 0;
            let resault: any[] = [];

            const query: { text: string, values: any } = {
                text: `with "values" as (
                            select $1::uuid as "companyId",
                                $2::uuid[] as "branches",
                                $3::timestamp as "fromDate",
                                $4::timestamp as "toDate",
                                $5::INT as "afterDecimal"
                            )
                            ,"InvoiceData" as (
                                SELECT	 COALESCE("Categories".name,'Uncategorized') "categoryName",
                                        "Products".name as "productName",
                                        sum(COALESCE("InvoiceLines".qty,0)) as "salesQty",
                                        sum(COALESCE("InvoiceLines"."subTotal",0)   :: text :: NUMERIC)  as "invoiceAmount",
                                        0  AS "creditNoteQty",
                                        0 AS "creditNoteAmount"
                                FROM "InvoiceLines"
                                JOIN "values" ON TRUE
                                inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId"
                                inner join "Branches" on "Branches".id = "Invoices"."branchId"
                                inner join "MenuSectionProduct" on "MenuSectionProduct"."productId" ="InvoiceLines"."productId"
                                inner join "Products" on "MenuSectionProduct"."productId" = "Products".id
                                left join "Categories" on "Categories".id = "Products"."categoryId"
                                WHERE  "Branches"."companyId"= "values"."companyId"
                                    AND( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                                    AND  "Invoices"."status" <>'Draft' 
                                    AND ( "InvoiceLines"."createdAt" > "values"."fromDate" AND  "InvoiceLines"."createdAt" < "values"."toDate")
                                GROUP BY "Products".id, "Categories".id 
                                ),
                                "CreditNoteData" as (
                                SELECT  COALESCE("Categories".name,'Uncategorized') "categoryName",
                                        "Products".name as "productName",
                                        0 AS "salesQty",
                                        0 AS "invoiceAmount",
                                        sum(COALESCE("CreditNoteLines".qty,0)) as "creditNoteQty",
                                        sum(COALESCE("CreditNoteLines"."subTotal",0) :: text :: NUMERIC)  as "creditNoteAmount"
                                FROM "CreditNoteLines"
                                JOIN "values" ON TRUE
                                inner join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId"
                                inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
                                inner join "MenuSectionProduct" on "MenuSectionProduct"."productId" ="CreditNoteLines"."productId"      
                                inner join "Products" on "MenuSectionProduct"."productId" = "Products".id
                                left join "Categories" on "Categories".id = "Products"."categoryId" 
                                WHERE  "Branches"."companyId"= "values"."companyId"
                                        AND( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                                        AND ( "CreditNoteLines"."createdAt" > "values"."fromDate" AND  "CreditNoteLines"."createdAt" < "values"."toDate")
                                GROUP BY  "Products".id, "Categories".id
                                ),
                                "total" as (
                                SELECT count(*) over()::real,  
                                        sum(sum(T."salesQty"))  over() as "totalSalesQty",
                                        sum(ROUND(sum(T."invoiceAmount"),"values"."afterDecimal"))  over() as "totalInvoiceAmount",
                                        sum(sum(T."creditNoteQty"))  over() as "totalCreditNoteQty",
                                        sum(ROUND(sum(T."creditNoteAmount"),"values"."afterDecimal"))  over() as "totalCreditNoteAmount",
                                        sum(sum(T."salesQty"+T."creditNoteQty"*(-1)))  over() as "totalQty",
                                        sum(ROUND(sum(T."invoiceAmount" + T."creditNoteAmount"*(-1)),"values"."afterDecimal"))  over() as "totalSales",
                                
                                        sum(sum(T."salesQty"))  over(partition by "categoryName") as "totalSalesQtyPerCategory",
                                        sum(ROUND(sum(T."invoiceAmount"),"values"."afterDecimal"))  over(partition by "categoryName") as "totalInvoiceAmountPerCategory",
                                        sum(sum(T."creditNoteQty"))  over(partition by "categoryName") as "totalCreditNoteQtyPerCategory",
                                        sum(ROUND(sum(T."creditNoteAmount"),"values"."afterDecimal"))  over(partition by "categoryName") as "totalCreditNoteAmountPerCategory",
                                        sum(sum(T."salesQty"-T."creditNoteQty"))  over(partition by "categoryName") as "totalQtyPerCategory",
                                        sum(ROUND(sum(T."invoiceAmount" - T."creditNoteAmount"),"values"."afterDecimal"))  over(partition by "categoryName") as "totalSalesPerCategory",
                                
                                        T."categoryName",
                                        T."productName",  
                                        sum(T."salesQty")  AS "salesQty",
                                        CAST(sum (T."invoiceAmount") AS float) as "invoiceAmount",
                                        sum(T."creditNoteQty")  AS "creditNoteQty",
                                        CAST(sum (T."creditNoteAmount") AS float) as "creditNoteAmount",
                                        sum(T."salesQty"+T."creditNoteQty"*(-1)) AS "qty",
                                        sum(T."invoiceAmount" + T."creditNoteAmount"*(-1)) as "sales"
                                FROM(select * from "InvoiceData" UNION ALL select * from "CreditNoteData" )T
                                join "values" on true
                                group by T."categoryName", T."productName", "values"."afterDecimal"
                                order by T."categoryName", T."productName"
                                limit ${limit}
                                offset ${offset}
                                ) 
                                select "totalSalesQty", "totalInvoiceAmount", "totalCreditNoteQty","totalCreditNoteAmount", "totalQty", "totalSales", 
                                "categoryName" ,
                                "totalSalesQtyPerCategory"  AS "salesQty",
                                "totalInvoiceAmountPerCategory" as "invoiceAmount",
                                "totalCreditNoteQtyPerCategory"  AS "creditNoteQty",
                                "totalCreditNoteAmountPerCategory" as "creditNoteAmount",
                                "totalQtyPerCategory" AS "qty",
                                "totalSalesPerCategory" AS "sales",
                                json_agg(json_build_object('productName',"productName",'salesQty',"salesQty",'invoiceAmount',"invoiceAmount",
                                                        'creditNoteQty',"creditNoteQty", 'creditNoteAmount',"creditNoteAmount", 
                                                        'qty', "qty", 'sales',"sales"
                                                        )) as "products"
                                from "total"
                                group by "categoryName", "totalSalesQty", "totalInvoiceAmount", "totalCreditNoteQty","totalCreditNoteAmount", "totalQty", "totalSales",
                                "totalInvoiceAmountPerCategory" ,
                                "totalCreditNoteQtyPerCategory"  ,
                                "totalCreditNoteAmountPerCategory" ,
                                "totalQtyPerCategory", "totalSalesQtyPerCategory",
                                "totalSalesPerCategory" 
                            
                        
                        `,
                values: [companyId, branches, from, to, afterDecimal]
            }




            const records = await DB.excu.query(query.text, query.values);

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)

                total = { salesQty: t.totalSalesQty, salesAmount: t.totalSalesAmount, crediteNoteQty: t.totalCreditNoteQty, creditNoteAmount: t.totalCreditNoteAmount, qty: t.totalQty, sales: t.totalSales }
                resault = records.rows.map((e: any) => {
                    return {
                        categoryName: e.categoryName, productName: e.productName,
                        totalSalesQtyPerCategory: e.totalSalesQtyPerCategory, totalSalesAmountPerCategory: e.totalSalesAmountPerCategory,
                        totalCreditNoteQtyPerCategory: e.totalCreditNoteQtyPerCategory, totalCreditNoteAmountPerCategory: e.totalCreditNoteAmountPerCategory,
                        totalQtyPerCategory: e.totalQtyPerCategory, totalSalesPerCategory: e.totalSalesPerCategory,
                        salesQty: e.salesQty, salesAmount: e.salesAmount,
                        creditNoteQty: e.creditNoteQty, creditNoteAmount: e.creditNoteAmount,
                        qty: e.qty, sales: e.sales
                    }
                })


            }

            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (records.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            let resData = {
                records: resault,
                count: count,
                total: total,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {


            throw new Error(error)
        }
    }



}