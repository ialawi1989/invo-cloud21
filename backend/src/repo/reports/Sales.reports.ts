import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { TimeHelper } from "@src/utilts/timeHelper";
import { Company } from "@src/models/admin/company";
import moment from 'moment'

import { DataColumn, ReportData } from "@src/utilts/xlsxGenerator";
import { BranchesRepo } from "../admin/branches.repo";
import { PoolClient } from "pg";
import { ServiceRepo } from "../admin/services.repo";
import { CompanyRepo } from "../admin/company.repo";

export class SalesRepots {




    public static async getSalesByService(data: any, company: Company, branchList: any[]) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let applyOpeningHour = data.applyOpeningHour ?? false

            if (applyOpeningHour == true) {
                let branchId = branchList[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(client, branchId)).data.closingTime ?? "05:00:00"
            }

            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------

            const branches = data.branchId ? [data.branchId] : branchList

            /**Limit, Order By and Having query are only used for dashboard */
            let limit = data.limit;
            let orderBy = '';
            let having = '';
            let limitQuery = ``;
            if (limit) {
                orderBy = ` ORDER BY  CAST (SUM(T.sales) AS REAL)::NUMERIC DESC `
                having = ` Having  CAST (SUM(T.sales) AS REAL)::NUMERIC > 0  `
                limitQuery = `limit ${limit}`
            }

            const query = {
                text: `SELECT 
                            T."serviceName",
                            "translation",
                            SUM(T.sales)::NUMERIC as sales
                            FROM (SELECT
                                    COALESCE("Services".name,'Others')as "serviceName",
                                    "Services"."translation",
                                    sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end))as sales
                                from "InvoiceLines"
                                INNER JOIN "Invoices" ON "InvoiceLines" ."invoiceId" = "Invoices".id

                                INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id
                                LEFT JOIN "Services" ON  "Services".id = "Invoices"."serviceId"
                                WHERE
                                    "Branches"."companyId"=$1 AND
                                                                     ($2::uuid[] is null or "Branches".id = any($2))AND
                                                                    "Invoices"."status" <>'Draft' AND  "InvoiceLines"."createdAt" >=$3 AND"InvoiceLines"."createdAt" <$4
                                    GROUP BY  "Services".id,"InvoiceLines"."createdAt"
                                 UNION ALL SELECT
                                        COALESCE("Services".name,'Others')as "serviceName",
                                             "Services"."translation",
                                    sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)::text::numeric) end))as sales
                                    from "CreditNoteLines"
                                    INNER JOIN "CreditNotes" ON "CreditNoteLines" ."creditNoteId" = "CreditNotes".id
                                    INNER JOIN "Invoices" ON "CreditNotes" ."invoiceId" = "Invoices".id
                                    INNER JOIN "Branches" ON "CreditNotes"."branchId" = "Branches".id
                                    LEFT JOIN "Services" ON  "Services".id = "Invoices"."serviceId"
                                    WHERE
                                    "Branches"."companyId"=$1 AND
                                                                             ($2::uuid[] is null or "Branches".id = any($2))AND
                                                                    "CreditNoteLines"."createdAt" >=$3 AND "CreditNoteLines"."createdAt" <$4      
                             GROUP BY  "Services".id,"CreditNoteLines"."createdAt")T
                          
            GROUP BY T."serviceName","translation"
            ${having}
               ${orderBy}
            ${limitQuery}
            `,
                values: [companyId, branches, from, to]
            }
            /**Only For dashboard */


            const reports = await client.query(query.text, query.values);
            await client.query("COMMIT")
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          
            await client.query("ROLLBACK")
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }
    public static async shortOverReport(data: any, company: Company, brancheList: []) {
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
            "PaymentMethods"."name" as "tender",
            "PaymentMethods".symbol,
            "PaymentMethods"."afterDecimal",
            "Employees".name as "cashierName",
             ( select sum("CashierLines"."endAmount")
                                                      from "CashierLines"
                                                      where"CashierLines"."cashierId" = "Cashiers".id    
                                                      and "CashierLines"."paymentMethodId" = "PaymentMethods".id
                                                        group by "PaymentMethods".id
                                                      ) as "count",
            sum( "InvoicePayments"."paidAmount")  + ( select sum("CashierLines"."startAmount")
                                                      from "CashierLines"
                                                      where"CashierLines"."cashierId" = "Cashiers".id    
                                                      and "CashierLines"."paymentMethodId" = "PaymentMethods".id
                                                       group by "PaymentMethods".id
                                                    ) as "expected",
             ( select sum("CashierLines"."endAmount")
                                                      from "CashierLines"
                                                      where"CashierLines"."cashierId" = "Cashiers".id    
                                                      and "CashierLines"."paymentMethodId" = "PaymentMethods".id
                group by "PaymentMethods".id
             )          -
                                                      (sum( "InvoicePayments"."paidAmount")  + ( select  sum("CashierLines"."startAmount")
                                                      from "CashierLines"
                                                      where"CashierLines"."cashierId" = "Cashiers".id    
                                                      and "CashierLines"."paymentMethodId" = "PaymentMethods".id

                                                              group by "PaymentMethods".id               

                                                                                               ) )       AS "shortOver"

            from "Cashiers"
            inner join "InvoicePayments" on "InvoicePayments"."cashierId" = "Cashiers".id
            inner join "PaymentMethods" on "PaymentMethods".id =  "InvoicePayments"."paymentMethodId"    
            inner join "Employees" on "Employees".id = "Cashiers"."employeeId"
            INNER JOIN "Branches" on "Cashiers"."branchId" = "Branches".id 
             WHERE  "Branches"."companyId"=$1 
			AND ($2::UUID[] IS NULL OR "Branches".id = any ($2))
			AND   "Cashiers"."cashierIn" >=$3 AND "Cashiers"."cashierIn" <$4     group by "PaymentMethods".id , "Employees".id,"Cashiers".id`,

                values: [companyId, branches, from, to]
            }
            let reports = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async SalesByDeliveryArea(data: any, company: Company, branchList: []) {
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
            COALESCE(T."address",'Others'),
                        SUM(COALESCE(T."invoiceSales",0))::text::numeric  as "invoiceSales",
                        SUM(COALESCE(T."creditNoteSales",0))::text::numeric as "creditNoteSales",
                        SUM(COALESCE(T."invoiceSales",0))::text::numeric -    SUM(COALESCE(T."creditNoteSales",0))::text::numeric  AS "totalSales",
                        (case when SUM(COALESCE(T."numberOfInvoices",0)::text::numeric) <> 0
                        then SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))::float/ SUM(COALESCE(T."numberOfInvoices",0)::text::numeric)::float
                     else 0 end)   AS "salesAvg"
                        from (SELECT  REPLACE( ("customerAddress"->TRIM (REPLACE(LOWER(("coveredAddresses"->'type')::TEXT),'"',''))::text )::TEXT ,'"','') as "address",
                                        sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end)) as "invoiceSales" ,
                                        count(distinct "Invoices".id) as "numberOfInvoices",
                                        0 as "creditNoteSales"
                                FROM "Invoices"
                                INNER JOIN "InvoiceLines" on "InvoiceLines"."invoiceId" = "Invoices".id
                                left JOIN "Branches" on "Branches".id =  "Invoices"."branchId"
                            WHERE "Branches"."companyId"=$1 
							  AND ($2::UUID[] IS NULL OR "Branches".id = any($2))
							  AND "Invoices"."status" <>'Draft' AND   "InvoiceLines"."createdAt" >=$3 AND "InvoiceLines"."createdAt" <$4  GROUP BY  REPLACE( ("customerAddress"->TRIM (REPLACE(LOWER(("coveredAddresses"->'type')::TEXT),'"',''))::text )::TEXT ,'"','')  union all SELECT  REPLACE( ("customerAddress"->TRIM (REPLACE(LOWER(("coveredAddresses"->'type')::TEXT),'"',''))::text )::TEXT ,'"','') as "address",
                                            0 as "invoiceSales",
                                            0 as "invoiceAvg",
                                            sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)) end)) as "creditNoteSales"

                                        FROM "CreditNotes"
                                        INNER JOIN "Invoices" on "CreditNotes"."invoiceId" = "Invoices".id
                                        INNER JOIN "CreditNoteLines" on "CreditNoteLines"."creditNoteId" = "CreditNotes".id
                                        left JOIN "Branches" on "Branches".id =  "Invoices"."branchId"

                                            WHERE "Branches"."companyId"=$1
							    AND ($2::UUID[] IS NULL OR "Branches".id = any($2))
							  AND   "CreditNoteLines"."createdAt" >=$3 AND "CreditNoteLines"."createdAt" <$4 GROUP BY  REPLACE( ("customerAddress"->TRIM (REPLACE(LOWER(("coveredAddresses"->'type')::TEXT),'"',''))::text )::TEXT ,'"','') )T group by   T."address"`,
                values: [companyId, branches, from, to]
            }
            let reports = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async getSalesBySource(data: any, company: Company, brancheList: any[]) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let applyOpeningHour = data.applyOpeningHour ?? false

            if (applyOpeningHour == true) {
                let branchId = brancheList[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(client, branchId)).data.closingTime ?? "05:00:00"
            }

            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------



            /**Limit, Order By and Having query are only used for dashboard */
            let limit = data.limit;
            let orderBy = '';
            let having = '';
            if (limit) {
                orderBy = ` ORDER BY  CAST (SUM(T.sales) AS REAL)::NUMERIC DESC `
                having = ` Having  CAST (SUM(T.sales) AS REAL)::NUMERIC > 0  `
            }


            const branchId = data.branchId;
            const filterId = (branchId != null && branchId != "") ? branchId : companyId;
            let filter = `"Branches"."companyId"=$1`
            if (branchId != null && branchId != "") {
                filter = `"Branches".id=$1`
            }


            let query = `SELECT 
                            T."sourceName",
                            SUM(T.sales)::NUMERIC as sales
                            FROM (`
            let invoiceFilter = filter
            invoiceFilter += ` AND "Invoices"."status" <>'Draft' AND  "InvoiceLines"."createdAt" >=$2 AND"InvoiceLines"."createdAt" <$3
                                    GROUP BY  "Invoices".source,"InvoiceLines"."createdAt"
                                 `
            let invoiceSales = `SELECT 
                                    COALESCE("Invoices".source,'Others')as "sourceName",
                                    CAST (COALESCE(sum ( ROUND("InvoiceLines"."subTotal"::numeric,$4::INT)),0) as REAL)::NUMERIC as sales
                                from "InvoiceLines" 
                                INNER JOIN "Invoices" ON "InvoiceLines" ."invoiceId" = "Invoices".id 
                                INNER JOIN "Products" ON "InvoiceLines"."productId" = "Products".id 
                                INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id 
                                WHERE 
                                    `
            invoiceSales += invoiceFilter;
            const unionQuery = "UNION ALL "
            let creditFilter = filter
            creditFilter += ` AND  "CreditNoteLines"."createdAt" >=$2 AND "CreditNoteLines"."createdAt" <$3
                             GROUP BY   "Invoices".source,"CreditNoteLines"."createdAt"`
            let creditNoteSales = `SELECT 
                                        COALESCE("Invoices".source,'Others')as "sourceName",
                                        CAST (COALESCE(sum ( ROUND("CreditNoteLines"."subTotal"::numeric,$4::INT)),0) as REAL)::NUMERIC *(-1) as sales
                                    from "CreditNoteLines" 
                                    INNER JOIN "CreditNotes" ON "CreditNoteLines" ."creditNoteId" = "CreditNotes".id
                                    INNER JOIN "Invoices" ON "CreditNotes" ."invoiceId" = "Invoices".id 
                                    INNER JOIN "Products" ON "CreditNoteLines"."productId" = "Products".id 
                                    INNER JOIN "Branches" ON "CreditNotes"."branchId" = "Branches".id 
                                    WHERE 
                                    `
            creditNoteSales += creditFilter
            const groupByQuery = `)T
            GROUP BY T."sourceName"
            `

            query += invoiceSales + unionQuery + creditNoteSales + groupByQuery;
            let values = [filterId, from, to, afterDecimal]

            /**Only For dashboard */
            if (limit) {
                query += having + orderBy + "limit $5"
                values = [filterId, from, to, afterDecimal, limit];
            }

            const reports = await client.query(query, values);
            await client.query("COMMIT")
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
            await client.query("ROLLBACK")
          

            throw new Error(error.message)
        } finally {
            client.release()
        }
    }

    public static async getTopSalesCustomer(data: any, company: Company, branchList: any[]) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let applyOpeningHour = data.applyOpeningHour ?? false

            if (applyOpeningHour == true) {
                let branchId = branchList[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(client, branchId)).data.closingTime ?? "05:00:00"
            }

            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------



            /**Limit, Order By and Having query are only used for dashboard */
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
                            T."customerId",
                            T."customerName",
                            T.saluation,
                            SUM(T.sales)::NUMERIC as sales
                            FROM (`
            let invoiceFilter = filter
            invoiceFilter += ` AND "Invoices"."status" <>'Draft' AND "InvoiceLines"."createdAt" >= $3 AND "InvoiceLines"."createdAt" < $4 `
            invoiceFilter += `
                                    GROUP BY   "Customers".id,"InvoiceLines"."createdAt"
                                 `
            let invoiceSales = `SELECT 
                                    "Customers".id as "customerId",
                                    "Customers".saluation,
                                    COALESCE("Customers".name,'Others')as "customerName",
                                    CAST (COALESCE(sum ( ROUND("InvoiceLines"."subTotal"::numeric,$2::INT)),0) as REAL)::NUMERIC as sales
                                from "InvoiceLines" 
                                INNER JOIN "Invoices" ON "InvoiceLines" ."invoiceId" = "Invoices".id 
                                INNER JOIN "Products" ON "InvoiceLines"."productId" = "Products".id 
                                INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id 
                                INNER JOIN "Customers" ON "Customers".id = "Invoices"."customerId"
                                WHERE 
                                    `
            invoiceSales += invoiceFilter;
            const unionQuery = "UNION ALL "
            let creditFilter = filter
            creditFilter += ` AND "CreditNoteLines"."createdAt" >= $3 AND "CreditNoteLines"."createdAt" < $4 `

            creditFilter += `
                             GROUP BY   "Customers".id ,"CreditNoteLines"."createdAt"`
            let creditNoteSales = `SELECT 
                                        "Customers".id as "customerId",
                                        "Customers".saluation,
                                        COALESCE("Customers".name,'Others')as "customerName",
                                    
                                        CAST (COALESCE(sum ( ROUND("CreditNoteLines"."subTotal"::numeric,$2::INT)),0) as REAL)::NUMERIC *(-1) as sales
                                    from "CreditNoteLines" 
                                    INNER JOIN "CreditNotes" ON "CreditNoteLines" ."creditNoteId" = "CreditNotes".id
                                    INNER JOIN "Invoices" ON "CreditNotes" ."invoiceId" = "Invoices".id and "Invoices"."customerId" is not null
                                    INNER JOIN "Products" ON "CreditNoteLines"."productId" = "Products".id 
                                    INNER JOIN "Branches" ON "CreditNotes"."branchId" = "Branches".id 
                                    INNER JOIN "Customers" ON "Customers".id = "Invoices"."customerId"
                                    WHERE 
                                    `
            creditNoteSales += creditFilter
            const groupByQuery = `)T
            GROUP BY T."customerId", T."customerName",T.saluation `

            query += invoiceSales + unionQuery + creditNoteSales + groupByQuery;
            let values = [filterId, afterDecimal]

            /**Only For dashboard */
            if (limit) {
                query += having + orderBy + "limit $5"
                values = [filterId, afterDecimal, from, to, limit];
            }

            const reports = await client.query(query, values);
            await client.query("COMMIT")
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          
            await client.query("ROLLBACK")
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }

    /**TODO: SALES - "TAXTOTAL" */
    public static async getSalesByBranch(
        data: any,
        company: Company,
        brancheList: any[]
    ) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");

            const afterDecimal = company.afterDecimal;

            // ---------------- Companies & Branches filters ----------------
            // If multi-company passed -> use it, otherwise fall back to the single company.id
            const companyIds: string[] =
                Array.isArray(data.companyIds) && data.companyIds.length > 0
                    ? data.companyIds
                    : [company.id];

            // Priority:
            // 1) data.branchIds (multi)
            // 2) data.branchId (single)
            // 3) brancheList (old behavior)
            // 4) null -> all branches
            let branches: string[] | null = null;
            if (Array.isArray(data.branchIds) && data.branchIds.length > 0) {
                branches = data.branchIds;
            } else if (data.branchId) {
                branches = [data.branchId];
            } else if (Array.isArray(brancheList) && brancheList.length > 0) {
                branches = brancheList;
            } else {
                branches = null;
            }

            //-------------- set time --------------
            let closingTime = "00:00:00";
            let fromDate =
                data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate));
            let toDate =
                data.interval && data.interval.to
                    ? moment(new Date(data.interval.to))
                    : moment(new Date());

            const timeOffset = company.timeOffset;
            const applyOpeningHour = data.applyOpeningHour ?? false;

            if (applyOpeningHour === true && brancheList && brancheList[0]) {
                const firstBranchId = brancheList[0];
                closingTime =
                    (await BranchesRepo.getBranchClosingTime(client, firstBranchId)).data
                        .closingTime ?? "05:00:00";
            }

            const interval = await TimeHelper.getReportTime(
                fromDate,
                toDate,
                closingTime,
                applyOpeningHour,
                timeOffset
            );
            const from = interval.from;
            const to = interval.to;
            //---------------------------------------

            const query = {
                text: `
                    WITH "baseBranches" AS (
                        SELECT 
                            b.id AS "branchId",
                            b."companyId",
                            COALESCE(b.name, 'Others') AS "branchName",
                            COALESCE(c.name, 'Others') AS "companyName"
                        FROM "Branches" b
                        INNER JOIN "Companies" c ON c.id = b."companyId"
                        WHERE ($1::uuid[] IS NULL OR b."companyId" = ANY($1::uuid[]))
                        AND ($2::uuid[] IS NULL OR b.id = ANY($2::uuid[]))
                    ),

                    "lines" AS (
                    SELECT
                        CASE WHEN "InvoiceLines"."isInclusiveTax" = TRUE
                            THEN (COALESCE("InvoiceLines"."subTotal",0) - COALESCE("InvoiceLines"."taxTotal",0))
                            ELSE COALESCE("InvoiceLines"."subTotal",0)
                        END AS "sales",
                        "InvoiceLines"."taxTotal",
                        "InvoiceLines"."discountTotal",
                        "InvoiceLines"."total",
                        "InvoiceLines"."invoiceId",
                        "InvoiceLines"."branchId",
                        "InvoiceLines"."companyId",
                        "InvoiceLines"."createdAt"
                    FROM "InvoiceLines"
                    WHERE ($1::uuid[] IS NULL OR "InvoiceLines"."companyId" = ANY($1::uuid[]))
                        AND ($2::uuid[] IS NULL OR "InvoiceLines"."branchId" = ANY($2::uuid[]))
                        AND ("InvoiceLines"."createdAt" >= $3 AND "InvoiceLines"."createdAt" < $4)
                    ),

                    "invoiceData" AS (
                        SELECT
                            "Companies".id  AS "companyId",
                            "Branches".id   AS "branchId",
                            SUM("lines"."total")      AS "total",
                            SUM("lines"."taxTotal")   AS "taxTotal",
                            SUM(COALESCE("lines"."discountTotal"::text::numeric, 0))
                            + SUM(COALESCE("Invoices"."discountTotal"::text::numeric, 0)) AS "discountTotal",
                            SUM("lines"."sales")      AS "sales",
                            COUNT(DISTINCT CASE
                            WHEN ("lines"."createdAt"::date <> "Invoices"."createdAt"::date)
                                THEN "Invoices".id
                            END) AS "editedInvoices",
                            COUNT(DISTINCT CASE
                            WHEN ("lines"."createdAt"::date = "Invoices"."createdAt"::date)
                                THEN "Invoices".id
                            END) AS "newInvoices",
                            COUNT(DISTINCT "Invoices".id) AS "numberOfInvoices"
                        FROM "lines"
                        INNER JOIN "Invoices"
                            ON "Invoices".id = "lines"."invoiceId"
                        AND "Invoices"."status" <> 'Draft'
                        INNER JOIN "Branches"
                            ON "Branches".id = "lines"."branchId"
                        INNER JOIN "Companies"
                            ON "Companies".id = "lines"."companyId"
                        GROUP BY
                            "Companies".id,
                            "Branches".id
                    ),
                    "creditNoteLines" AS (
                    SELECT
                        CASE WHEN "CreditNoteLines"."isInclusiveTax" = TRUE
                        THEN (COALESCE("CreditNoteLines"."subTotal",0) - COALESCE("CreditNoteLines"."taxTotal",0))
                        ELSE COALESCE("CreditNoteLines"."subTotal",0)
                        END AS "sales",
                        "CreditNoteLines"."taxTotal",
                        "CreditNoteLines"."discountTotal",
                        "CreditNoteLines"."total",
                        "CreditNoteLines"."branchId",
                        "CreditNoteLines"."companyId",
                        "CreditNoteLines"."createdAt"
                    FROM "CreditNoteLines"
                    WHERE ($1::uuid[] IS NULL OR "CreditNoteLines"."companyId" = ANY($1::uuid[]))
                        AND ($2::uuid[] IS NULL OR "CreditNoteLines"."branchId" = ANY($2::uuid[]))
                        AND ("CreditNoteLines"."createdAt" >= $3 AND "CreditNoteLines"."createdAt" < $4)
                    ),

                    "creditNoteData" AS (
                    SELECT
                        "Companies".id AS "companyId",
                        "Branches".id AS "branchId",
                        SUM("creditNoteLines"."total") AS "totalReturn"
                    FROM "creditNoteLines"
                    INNER JOIN "Branches" ON "Branches".id = "creditNoteLines"."branchId"
                    INNER JOIN "Companies" ON "Companies".id = "creditNoteLines"."companyId"
                    GROUP BY "Companies".id, "Branches".id
                    )

                    SELECT
                    b."companyId",
                    b."companyName",
                    b."branchId",
                    b."branchName",
                    COALESCE(i."sales",0)::float AS "sales",
                    COALESCE(i."discountTotal",0)::float AS "discountTotal",
                    COALESCE(i."taxTotal",0)::float AS "taxTotal",
                    COALESCE(i."total",0)::float AS "total",
                    COALESCE(c."totalReturn",0)::float AS "totalReturn",
                    (COALESCE(i."total",0) - COALESCE(c."totalReturn",0))::float AS "netSales",
                    COALESCE(i."editedInvoices",0)::int AS "editedInvoices",
                    COALESCE(i."newInvoices",0)::int AS "newInvoices",
                    COALESCE(i."numberOfInvoices",0)::int AS "numberOfInvoices"
                    FROM "baseBranches" b
                    LEFT JOIN "invoiceData" i ON i."branchId" = b."branchId" AND i."companyId" = b."companyId"
                    LEFT JOIN "creditNoteData" c ON c."branchId" = b."branchId" AND c."companyId" = b."companyId"
                    ORDER BY b."companyName", b."branchName";`,
                values: [companyIds, branches, from, to],
            };

            const reports = await client.query(query.text, query.values);
            await client.query("COMMIT");
            const records = reports.rows && reports.rows.length > 0 ? reports.rows : [];

            // check if export data
            if (data.export) {
                const report = new ReportData();
                // settings from base company (just for formatting / currency symbol)
                const companyInfo = (await CompanyRepo.getCompanyById(company.id)).data;
                // const afterDecimal = companyInfo.settings.afterDecimal ?? 3;
                // const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD";
                report.showFilter = false;
                report.filter = {
                    title: "Companies Sales Overview",
                    skipCompanyInfo: true,
                    fromDate: fromDate,
                    toDate: toDate,
                    filterList: [],
                };

                report.records = records;
                report.columns = [
                    { key: "companyName", header: "company" },
                    { key: "branchName", header: "branch" },
                    { key: "sales", header: "sales", properties: { columnType: "currency", } },
                    { key: "discountTotal", header: "discountTotal", properties: { columnType: "currency", } },
                    { key: "taxTotal", header: "taxTotal", properties: { columnType: "currency", } },
                    { key: "total", header: "total", properties: { columnType: "currency", } },
                    { key: "totalReturn", header: "totalReturn", properties: { columnType: "currency", } },
                    { key: "netSales", header: "netSales", properties: { columnType: "currency", } },
                ];
                report.fileName = "CompaniesSalesOverview";
                return new ResponseData(true, "", report);
            }
            return new ResponseData(true, "", records);
        } catch (error: any) {
          
            console.log(error);
            await client.query("ROLLBACK");
            throw new Error(error.message);
        } finally {
            client.release();
        }
    }

    public static async companiesPaymentsOverview(
        data: any,
        company: Company,
        brancheList: string[]
    ) {
        try {
            const baseCompanyId = company.id;
            const filter = data.filter || {};

            // ######## companyIds & branchIds like before ########
            const companyIds: string[] =
                Array.isArray(data.companyIds) && data.companyIds.length > 0
                    ? data.companyIds
                    : [baseCompanyId];

            let branches: string[] | null =
                Array.isArray(data.branchIds) && data.branchIds.length > 0
                    ? data.branchIds
                    : (Array.isArray(brancheList) && brancheList.length > 0
                        ? brancheList
                        : null);

            const filterBy = "company";

            // ######## set time ##########
            let closingTime = "00:00:00";
            let fromDate = filter.fromDate
                ? moment(new Date(filter.fromDate))
                : moment();
            let toDate = filter.toDate ? moment(new Date(filter.toDate)) : moment();
            const applyOpeningHour = !!filter.applyOpeningHour;

            if (applyOpeningHour === true && branches && branches[0]) {
                const branchId = branches[0];
                closingTime =
                    (await BranchesRepo.getBranchClosingTime(null, branchId)).data
                        .closingTime ?? "05:00:00";
            }

            const timeOffset = company.timeOffset;
            const interval = await TimeHelper.getReportTime(
                fromDate,
                toDate,
                closingTime,
                applyOpeningHour,
                timeOffset
            );

            const from = interval.from;
            const to = interval.to;

            if (!Array.isArray(branches) || branches.length === 0) {
                branches = null;
            }

            // ##########################   query   ##########################

            const query: { text: string; values: any[] } = {
                text: `
        WITH "values" AS (
          SELECT
            $1::uuid[]    AS "companyIds",
            $2::uuid[]    AS "branches",
            $3::timestamp AS "fromDate",
            $4::timestamp AS "toDate"
        ),
        invoices AS (
          SELECT invo.*
          FROM "Invoices" invo
          JOIN "values" v ON TRUE
          JOIN "Branches" b ON b.id = invo."branchId"
          WHERE b."companyId" = ANY(v."companyIds")
            AND invo."status" <> 'Draft'
            AND (
              array_length(v."branches",1) IS NULL
              OR b.id = ANY(v."branches")
            )
            AND (
              invo."invoiceDate" >= v."fromDate"
              AND invo."invoiceDate" < v."toDate"
            )
        ),
        payment_data AS (
          SELECT
            b."companyId",
            pm.name AS "paymentMethodName",
            SUM(ipl.amount) AS paid_amount
          FROM invoices i
          JOIN "InvoicePaymentLines" ipl ON ipl."invoiceId" = i.id
          JOIN "InvoicePayments" ip ON ip.id = ipl."invoicePaymentId"
          JOIN "PaymentMethods" pm ON pm.id = ip."paymentMethodId"
          JOIN "Branches" b ON b.id = i."branchId"
          WHERE ip.status = 'SUCCESS'
          GROUP BY b."companyId", pm.name
        ),
        "keys" AS (
          SELECT json_agg(DISTINCT "paymentMethodName") AS "keys"
          FROM payment_data
          WHERE "paymentMethodName" IS NOT NULL
        )
        SELECT
          c.id   AS "companyId",
          c.name AS "companyName",
          (SELECT * FROM "keys") AS "keys",
          jsonb_object_agg(
            COALESCE(pd."paymentMethodName", 'other'),
            COALESCE(pd.paid_amount, 0)
          ) AS "payments"
        FROM "Companies" c
        JOIN payment_data pd ON pd."companyId" = c.id
        GROUP BY c.id, c.name
      `,
                values: [companyIds, branches, from, to],
            };

            const result = await DB.excu.query(query.text, query.values);
            const records = result.rows && result.rows.length > 0 ? result.rows : [];

            const keys =
                records.length > 0 && (records[0] as any).keys
                    ? ((records[0] as any).keys as string[])
                    : [];

            const childs: DataColumn[] = [];
            keys.forEach((subcol: any) =>
                childs.push({
                    key: subcol,
                    properties: { hasTotal: true, columnType: "currency" },
                })
            );

            // ########################## export mode ##########################
            if (filter.export) {
                const report = new ReportData();

                // settings from base company (just for formatting / currency symbol)
                const companyInfo = (await CompanyRepo.getCompanyById(baseCompanyId)).data;
                const afterDecimal = companyInfo.settings.afterDecimal ?? 3;
                const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD";

                records.forEach((e: any) => {
                    // keep it simple: just company name as label
                    e.filterName = e.filterName;
                    // لو حاب نضيف إجمالي المدفوعات:
                    // const totalPayments = Object.values(e.payments || {}).reduce((acc: number, v: any) => acc + Number(v || 0), 0);
                    // e.filterName += '\\n    Total Payments: ' + currencySymbol + totalPayments.toFixed(afterDecimal);
                });
                report.showFilter = false;
                report.filter = {
                    title: "Companies Payments Overview",
                    skipCompanyInfo: true,
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: brancheList,

                    filterList: [{ filterby: filterBy }],
                };

                report.records = records;
                report.columns = [
                    { key: "companyName", header: "company" },
                    {
                        key: "payments",
                        childs: childs,
                        properties: { hasTotal: true, columnType: "currency" },
                    },
                ];
                report.fileName = "CompaniesPaymentsOverview";

                return new ResponseData(true, "", report);
            }

            // ########### API mode (for UI) ###########
            const resData = {
                records: records.map(({ keys, ...rest }: any) => rest),
                columns: ["payments"],
                subColumns: keys,
            };

            return new ResponseData(true, "", resData);
        } catch (error: any) {
            console.log(error);
          
            throw new Error(error);
        }
    }




    public static async Last12MonthSales(data: any, company: Company, branchList: []) {
        try {
            let branches = data.branchId ? [data.branchId] : branchList;

            let
                query =
                    `	WITH "lines" as (			
                        select      				     
                        (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
                     "InvoiceLines"."invoiceId",
                        "InvoiceLines"."createdAt"
                      
                    from "InvoiceLines"
                      where "InvoiceLines"."companyId" = $1
                    and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId" =any($2::uuid[]))
                      and ("InvoiceLines"."createdAt" >= NOW() - INTERVAL '12 months'	 and "InvoiceLines"."createdAt" < NOW() )
                    ),
                    "invoiceData" as (
                    select "lines"."sales",
						    DATE_TRUNC('month', "lines"."createdAt") as "month"
                    from "lines"
                    inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                 
                                    ),
                    "creditNoteLines" as (

                                        
                        select      				     
                        (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end) as "sales",
                    
                       "CreditNoteLines"."creditNoteId",
                        "CreditNoteLines"."createdAt"
                      
                    from "CreditNoteLines"
                    where "CreditNoteLines"."companyId" = $1
                    and  ($2::uuid[] IS NULL or  "CreditNoteLines"."branchId" =any($2::uuid[]))
                    and ("CreditNoteLines"."createdAt" >=  NOW() - INTERVAL '12 months' 	 and "CreditNoteLines"."createdAt" < NOW() )
                
                    ),
                    "creditNoteData" as (
                    select   "creditNoteLines"."sales",
						    DATE_TRUNC('month', "creditNoteLines"."createdAt") as "month"
                    from "creditNoteLines"
               
                    ),
                    T AS (          
                    select * from "invoiceData" union all select * from "creditNoteData"
                    )
               
                  	 select sum(t.sales)::numeric as "sales" ,
                                  t."month"
								from t 
								group by  t."month"
                    
                    `


            const values = [company.id, branches];

            let reports = await DB.excu.query(query, values);
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
            throw new Error(error)
        }
    }


    //TODO : Terminal Name --- 
    public static async salesByTerminal(data: any, company: Company, branchList: any[]) {
        const client = await DB.excu.client()
        try {

            await client.query("BEGIN")
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let applyOpeningHour = data.applyOpeningHour ?? false

            if (applyOpeningHour == true) {
                let branchId = branchList[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(client, branchId)).data.closingTime ?? "05:00:00"
            }

            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------

            const branches = data.branchId ? [data.branchId] : branchList;

            const query = {
                text: `SELECT 
                                T."terminalName",
                                SUM(COALESCE(T.sales,0)::text::numeric) as sales
                                FROM (SELECT
            COALESCE("Terminals"."name",CASE WHEN   "Terminals".id IS NULL THEN 'Others' else 'Terminal' end ) as "terminalName",
            "Terminals".id,
                                    sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end)) as sales
                                from "InvoiceLines"
                                INNER JOIN "Invoices" ON "InvoiceLines" ."invoiceId" = "Invoices".id
                                LEFT JOIN "Terminals" on  "Invoices"."terminalId"= "Terminals".id
                                INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id  
							WHERE  "Branches"."companyId"=$1 
							AND ($2::UUID[] IS NULL OR "Branches".id=any($2))
							AND "Invoices"."status" <>'Draft' AND   "InvoiceLines"."createdAt" >=$3 AND "InvoiceLines"."createdAt" <$4   GROUP BY "Terminals".id  UNION ALL SELECT
                                    COALESCE("Terminals"."name",CASE WHEN   "Terminals".id IS NULL THEN 'Others' else 'Terminal' end ) as "terminalName",
                                    "Terminals".id,
                                    sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)) end)) *(-1) as sales
                                from "CreditNoteLines"
                                INNER JOIN "CreditNotes" ON "CreditNoteLines" ."creditNoteId" = "CreditNotes".id
                                INNER JOIN "Invoices" on  "CreditNotes"."invoiceId"= "Invoices".id
                                LEFT JOIN "Terminals" on  "Invoices"."terminalId"= "Terminals".id
                                INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id  WHERE  "Branches"."companyId"=$1 
								AND ($2::UUID[] IS NULL OR "Branches".id=any($2))	  
								AND   "CreditNoteLines"."createdAt" >=$3 AND "CreditNoteLines"."createdAt" <$4  GROUP BY "Terminals".id )T
            group by T.id,    T."terminalName"`,
                values: [companyId, branches, from, to]
            }
            let report = await client.query(query.text, query.values)


            return new ResponseData(true, "", report.rows)
        } catch (error: any) {
            client.query("ROLLBACK")
          

            throw new Error(error.message)
        } finally {
            client.release()
        }
    }
    public static async salesByTables(data: any, company: Company, branchList: []) {
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
            T."tabelName",
            SUM(T."guests") AS "guests",
            SUM(COALESCE(T."invoiceSales",0)::text::numeric)  AS "invoiceSales",
            SUM(COALESCE(T."creditNoteSales",0)::text::numeric)  AS "creditNoteSales",
            SUM(COALESCE(T."invoiceSales",0)::text::numeric) - SUM(COALESCE(T."creditNoteSales",0)::text::numeric) AS "totalSales",
            (case when SUM(COALESCE(T."numberOfInvoices",0)::text::numeric) <> 0
            then SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))::float/ SUM(COALESCE(T."numberOfInvoices",0)::text::numeric)::float
            else 0 end)   as "salesAvg" ,
            (case when SUM(COALESCE(T."numberOfInvoices",0)::text::numeric) <> 0
            then SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))::float/ SUM(COALESCE(T."guests",0)::text::numeric)::float
            else 0 end)  AS "avgGuests"
            from ( SELECT
            COALESCE("Tables"."name",'Others') as "tabelName",
                                "Tables".id,
                                sum(COALESCE(NULLIF("Invoices".guests, 0),1)) as "guests",
                                sum("Invoices".guests)as "avgGuests",
                                sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end)) "invoiceSales",
                                 count(distinct "Invoices".id) "numberOfInvoices",
                                0 AS  "creditNoteSales"
                        from "InvoiceLines"
                        INNER JOIN "Invoices" ON "InvoiceLines" ."invoiceId" = "Invoices".id
                        LEFT JOIN "Tables" on  "Invoices"."tableId"= "Tables".id
                        INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id
                        WHERE  "Branches"."companyId"=$1 
				        AND ($2::uuid[] is null or "Branches".id = any($2))
				        AND "Invoices"."status" <>'Draft' AND   "InvoiceLines"."createdAt" >=$3 AND "InvoiceLines"."createdAt" <$4  GROUP BY   "Tables".id UNION ALL  SELECT
            COALESCE("Tables"."name",'Others') as "tabelName",
                                    "Tables".id,
                                    0::INT as "guests",
                                    0::INT as "avgGuests",
                                    0 AS "invoiceSales",
                                    0 AS "numberOfInvoices",
                                    sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)) end)) AS "creditNoteSales"
                            from "CreditNoteLines"
                            INNER JOIN "CreditNotes" ON "CreditNoteLines" ."creditNoteId" = "CreditNotes".id
                            INNER JOIN "Invoices" on  "CreditNotes"."invoiceId"= "Invoices".id
                            LEFT JOIN "Tables" on  "Invoices"."tableId"= "Tables".id
                            INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id  WHERE  "Branches"."companyId"=$1 
				               AND ($2::uuid[] is null or "Branches".id = any($2))
				            AND   "CreditNoteLines"."createdAt" >=$3 AND "CreditNoteLines"."createdAt" <$4 GROUP BY   "Tables".id)T
                                                        group by T."tabelName",T.id`,
                values: [companyId, branches, from, to]
            }
            let reports = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async salesByTableGroups(data: any, company: Company, branchList: []) {
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
                            T."tableGroupsName",
                            SUM (T."invoiceSales") AS "invoiceSales",
                            SUM (T."creditNoteSales") AS "creditNoteSales",
                            SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))::float  AS "totalSales",
                            (case when SUM(COALESCE(T."numberOfInvoices",0)::text::numeric) <> 0
                            then SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))::float/ SUM(COALESCE(T."numberOfInvoices",0)::text::numeric)::float
                            else 0 end) AS "salesAvg"
                            from ( SELECT
            COALESCE("TableGroups"."name",'Others')as "tableGroupsName",
                                "TableGroups".id,
                                sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end)) "invoiceSales",
                                count(distinct "Invoices".id) "numberOfInvoices",
                                0 AS  "creditNoteSales"

                        from "InvoiceLines"
                        INNER JOIN "Invoices" ON "InvoiceLines" ."invoiceId" = "Invoices".id
                        LEFT JOIN "Tables" ON  "Invoices"."tableId"= "Tables".id
                        LEFT JOIN "TableGroups" ON "TableGroups".id = "Tables"."tableGroupId"
                        INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id
                        WHERE  "Branches"."companyId"=$1  
						AND ($2::UUID[] is null or "Branches".id = any($2))
						AND "Invoices"."status" <>'Draft' AND   "InvoiceLines"."createdAt" >=$3 AND "InvoiceLines"."createdAt" <$4  GROUP BY   "TableGroups".id UNION ALL SELECT
                         COALESCE("TableGroups"."name",'Others') as "tableGroupsName",
                                    "TableGroups".id,
                                    0 AS "invoiceSales",
                                    0 AS "numberOfInvoices",
                                    sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)) end)) AS "creditNoteSales"

                            from "CreditNoteLines"
                            INNER JOIN "CreditNotes" ON "CreditNoteLines" ."creditNoteId" = "CreditNotes".id
                            INNER JOIN "Invoices" on  "CreditNotes"."invoiceId"= "Invoices".id
                            LEFT JOIN "Tables" on  "Invoices"."tableId"= "Tables".id
                            LEFT JOIN "TableGroups" ON "TableGroups".id = "Tables"."tableGroupId"
                            INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id WHERE  "Branches"."companyId"=$1 
							AND ($2::UUID[] is null or  "Branches".id = any($2))
							AND   "CreditNoteLines"."createdAt" >=$3 AND "CreditNoteLines"."createdAt" <$4 GROUP BY   "TableGroups".id)T
                                                        group by T."tableGroupsName",T.id`,
                values: [companyId, branches, from, to]
            }
            let reports = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async preparedTimeSummary(data: any, company: Company, branchList: []) {
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
                text: ` select T.id,
                                T.name,
                                sum(T."countedInvoices") as "countedInvoices",
                                sum(T."unCountedOrders") as "unCountedOrders",
                                sum(T."totalPreparedTime") as "totalReadyTime"
                        from ( select  "Services".id,
                                    "Services".name,
                                    Count("Invoices".id) as "countedInvoices",
                                    0 as  "unCountedOrders",
                                    SUM(EXTRACT(EPOCH FROM ("Invoices"."readyTime"::timestamp - "Invoices"."createdAt"::timestamp))) as "totalPreparedTime"
                            from "Invoices"
                            inner join "Services" on "Invoices"."serviceId" = "Services".id
                            inner join "Branches" on  "Invoices"."branchId" = "Branches".id WHERE  "Branches"."companyId"=$1 
							  AND($2::UUID[] IS NULL OR "Branches".id = any($2))
							  AND "Invoices"."status" <>'Draft' AND   "Invoices"."createdAt" >=$3 AND "Invoices"."createdAt" <$4  And  "Invoices"."readyTime" is not null  group by  "Services".id , "Services".name UNION ALL select  "Services".id,
                                            "Services".name,
                                            0 as "countedInvoices",
                                            Count("Invoices".id) as "unCountedOrders",
                                            0 as "totalPreparedTime"
                                    from "Invoices"
                                    inner join "Services" on "Invoices"."serviceId" = "Services".id      
                                    inner join "Branches" on  "Invoices"."branchId" = "Branches".id WHERE  "Branches"."companyId"=$1 
							    AND($2::UUID[] IS NULL OR "Branches".id = any($2))
							        AND "Invoices"."status" <>'Draft' AND   "Invoices"."createdAt" >=$3 AND "Invoices"."createdAt" <$4  And  "Invoices"."readyTime" is  null  group by  "Services".id , "Services".name )T group by T.id,T.name`,
                values: [company.id, branches, from, to]
            }
            let reports = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }




    //sales by period
    //one of the values["daily","hourly","weekDay","monthly","weekly","quartarly","yearly"]

    public static async getSalesByPeriod(data: any, company: Company, branchList: any[any]) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const companyId = company.id;
            const period = data.period
            branchList = data.branchId ? [data.branchId] : branchList;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset

            let applyOpeningHour = data.applyOpeningHour ?? false

            if (applyOpeningHour == true) {
                let branchId = branchList[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(client, branchId)).data.closingTime ?? "05:00:00"
            }

            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------
            let result;


            switch (period) {
                case "hourly":
                    result = await this.hourlySales(client, from, to, companyId, branchList)
                    break;
                case "daily":
                    result = await this.dailySales(client, from, to, companyId, branchList)
                    break;
                case "weekDay":
                    result = await this.weekDaySales(client, from, to, companyId, branchList)
                    break;
                case "weekly":
                    result = await this.weeklySales(client, from, to, companyId, branchList)
                    break;
                case "monthly":
                    result = await this.monthlySales(client, from, to, companyId, branchList)
                    break;
                case "quartarly":
                    result = await this.quartarlySales(client, from, to, companyId, branchList)
                    break;
                case "yearly":
                    result = await this.yearlySales(client, from, to, companyId, branchList)
                    break;
                default:
                    return new ResponseData(false, "Invalid Or Missing Report Type", [])

            }
            await client.query("COMMIT")
            return result
        } catch (error: any) {
            await client.query("ROLLBACK")
          

            throw new Error(error.message)
        } finally {
            client.release()
        }
    }
    public static async hourlySales(client: PoolClient, from: any, to: any, companyId: string, branches: []) {
        try {

            const query = {
                text: `with "lines" as (
                    select      				     
                    (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
             
                    "InvoiceLines"."invoiceId",
                    "InvoiceLines"."createdAt",
                    "InvoiceLines"."qty"
                  
                from "InvoiceLines"
                where "InvoiceLines"."companyId" = $1
                and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  =any($2::uuid[] ))
                and ("InvoiceLines"."createdAt" >=$3 and "InvoiceLines"."createdAt" < $4)
            
                ),
                "invoiceData" as (
                select              "lines"."createdAt" ,
                                        "lines".qty as "totalInvoices",
                                        0 as "totalCreditNotes",
                                       "sales" as "invoiceSales",
                                        0 as "creditNoteSales"
                from "lines"
                inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
      
				
                                ),
                "creditNoteLines" as (

                                    
                    select      				     
                     (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end)  as "sales",
                   "CreditNoteLines".qty  as qty, 
                    "CreditNoteLines"."createdAt"
					
          
                from "CreditNoteLines"
                where "CreditNoteLines"."companyId" = $1
                and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  =any($2::uuid[]))
                and ("CreditNoteLines"."createdAt" >=$3 and "CreditNoteLines"."createdAt" < $4)
         
                ),
                "creditNoteData" as (
                select   "creditNoteLines"."createdAt",
                                        0 as "totalInvoices",
                                       "creditNoteLines".qty as "totalCreditNotes",
                                        0 as "invoiceSales",
                                       "sales"   as "creditNoteSales"
                            

                from "creditNoteLines"
             
                ),
                T AS (          
                select * from "invoiceData" union all select * from "creditNoteData"
                )SELECT to_char( generate_series * INTERVAL '1 HOUR','HH24:MI:SS') AS "hour",
                                               SUM(COALESCE(T. "totalInvoices",0)) AS "invoiceTotal",
                                               SUM(COALESCE(T. "totalCreditNotes",0)) AS "creditNotesTotal",
                                                SUM(COALESCE(T."invoiceSales",0)::text::numeric)as "invoicesSales",
                                                SUM(COALESCE(T."creditNoteSales",0)::text::numeric)  as "creditNoteSales",
                                                SUM(COALESCE(T."invoiceSales",0)::text::numeric) -  SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "totalSales"
                                            FROM  generate_series(0, 23, 1)
											left join  T  ON  EXTRACT(HOUR FROM T."createdAt" + INTERVAL '3 hours' ) =  generate_series
											 GROUP BY generate_series
                                ORDER BY generate_series`,
                values: [companyId, branches, from, to]
            }
            const report = await client.query(query.text, query.values)
            let resault = (report.rows && report.rows.length > 0) ? report.rows : []



            return new ResponseData(true, "", report.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async dailySales(client: PoolClient, from: any, to: any, companyId: string, branches: []) {
        try {

            const query = {
                text: `with "lines" as (
                    select      				     
                    (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
             
                    "InvoiceLines"."invoiceId",
                    "InvoiceLines"."createdAt",
                    "InvoiceLines"."qty"
                  
                from "InvoiceLines"
                where "InvoiceLines"."companyId" = $1
                and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  =any($2::uuid[] ))
                and ("InvoiceLines"."createdAt" >=$3 and "InvoiceLines"."createdAt" < $4)
            
                ),
                "invoiceData" as (
                select              "lines"."createdAt" ,
                                        "lines".qty as "totalInvoices",
                                        0 as "totalCreditNotes",
                                       "sales" as "invoiceSales",
                                        0 as "creditNoteSales"
                from "lines"
                inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
      
				
                                ),
                "creditNoteLines" as (

                                    
                    select      				     
                     (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end)  as "sales",
                   "CreditNoteLines".qty  as qty, 
                    "CreditNoteLines"."createdAt"
					
          
                from "CreditNoteLines"
                where "CreditNoteLines"."companyId" = $1
                and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  =any($2::uuid[]))
                and ("CreditNoteLines"."createdAt" >=$3 and "CreditNoteLines"."createdAt" < $4)
         
                ),
                "creditNoteData" as (
                select   "creditNoteLines"."createdAt",
                                        0 as "totalInvoices",
                                       "creditNoteLines".qty as "totalCreditNotes",
                                        0 as "invoiceSales",
                                       "sales"   as "creditNoteSales"
                            

                from "creditNoteLines"
         
                ),
                T AS (          
                select * from "invoiceData" union all select * from "creditNoteData"
                )SELECT  generate_series as "date",
                                       SUM(COALESCE(T. "totalInvoices",0))  AS "invoiceTotal",
                                       SUM(COALESCE(T. "totalCreditNotes",0))  AS "creditNotesTotal",
                                       SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoicesSales",
                                       SUM(COALESCE(T."creditNoteSales",0)::text::numeric)  as "creditNoteSales",
                                       SUM(COALESCE(T."invoiceSales",0)::text::numeric) -  SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "totalSales"
                                 FROM  generate_series($3 ::timestamp, ($4::timestamp ),'1 DAY')  
								 left join  t   ON ( T."createdAt" + INTERVAL '3 hours' ) ::date = (generate_series + INTERVAL '3 hours' )::date
								 GROUP BY generate_series
                                ORDER BY generate_series
`,
                values: [companyId, branches, from, to]
            }

            const report = await client.query(query.text, query.values)

            return new ResponseData(true, "", report.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async weekDaySales(client: PoolClient, from: any, to: any, companyId: string, branches: []) {
        try {

            const query = {
                text: `with "lines" as (
                    select      				     
                    (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
             
                    "InvoiceLines"."invoiceId",
                    "InvoiceLines"."createdAt",
                    "InvoiceLines"."qty"
                  
                from "InvoiceLines"
                where "InvoiceLines"."companyId" = $1
                and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  =any($2::uuid[] ))
                and ("InvoiceLines"."createdAt" >=$3 and "InvoiceLines"."createdAt" < $4)
            
                ),
                "invoiceData" as (
                select              "lines"."createdAt" ,
                                        "lines".qty as "totalInvoices",
                                        0 as "totalCreditNotes",
                                       "sales" as "invoiceSales",
                                        0 as "creditNoteSales"
                from "lines"
                inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
      
				
                                ),
                "creditNoteLines" as (

                                    
                    select      				     
                     (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end)  as "sales",
                   "CreditNoteLines".qty  as qty, 
                    "CreditNoteLines"."createdAt"
					
          
                from "CreditNoteLines"
                where "CreditNoteLines"."companyId" = $1
                and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  =any($2::uuid[]))
                and ("CreditNoteLines"."createdAt" >=$3 and "CreditNoteLines"."createdAt" < $4)
         
                ),
                "creditNoteData" as (
                select   "creditNoteLines"."createdAt",
                                        0 as "totalInvoices",
                                       "creditNoteLines".qty as "totalCreditNotes",
                                        0 as "invoiceSales",
                                       "sales"   as "creditNoteSales"
                            

                from "creditNoteLines"
          
                ),
                T AS (          
                select * from "invoiceData" union all select * from "creditNoteData"
                )SELECT  to_char(generate_series::date, 'Day') as "day",
                                       SUM(COALESCE(T. "totalInvoices",0))  AS "invoiceTotal",
                                       SUM(COALESCE(T. "totalCreditNotes",0))  AS "creditNotesTotal",
                                       SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoicesSales",
                                       SUM(COALESCE(T."creditNoteSales",0)::text::numeric)  as "creditNoteSales",
                                       SUM(COALESCE(T."invoiceSales",0)::text::numeric) -  SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "totalSales"
                                  FROM  generate_series($3::timestamp, $4::timestamp,'1 DAY')  
								 left join  t   ON ( T."createdAt" + INTERVAL '3 hours' ) ::date = (generate_series + INTERVAL '3 hours' )::date
								     GROUP BY to_char(generate_series::date, 'Day')
                                ORDER BY to_char(generate_series::date, 'Day')`,

                values: [companyId, branches, from, to]
            }
            const report = await client.query(query.text, query.values)
            return new ResponseData(true, "", report.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async weeklySales(client: PoolClient, from: any, to: any, companyId: string, branches: []) {
        try {


            const query = {
                text: `with "lines" as (
                    select      				     
                    (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
             
                    "InvoiceLines"."invoiceId",
                    "InvoiceLines"."createdAt",
                    "InvoiceLines"."qty"
                  
                from "InvoiceLines"
                where "InvoiceLines"."companyId" = $1
                and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  =any($2::uuid[] ))
                and ("InvoiceLines"."createdAt" >=$3 and "InvoiceLines"."createdAt" < $4)
            
                ),
                "invoiceData" as (
                select              "lines"."createdAt" ,
                                        "lines".qty as "totalInvoices",
                                        0 as "totalCreditNotes",
                                       "sales" as "invoiceSales",
                                        0 as "creditNoteSales"
                from "lines"
                inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
      
				
                                ),
                "creditNoteLines" as (

                                    
                    select      				     
                     (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end)  as "sales",
                   "CreditNoteLines".qty  as qty, 
                    "CreditNoteLines"."createdAt"
					
          
                from "CreditNoteLines"
                where "CreditNoteLines"."companyId" = $1
                and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  =any($2::uuid[]))
                and ("CreditNoteLines"."createdAt" >=$3 and "CreditNoteLines"."createdAt" < $4)
         
                ),
                "creditNoteData" as (
                select   "creditNoteLines"."createdAt",
                                        0 as "totalInvoices",
                                       "creditNoteLines".qty as "totalCreditNotes",
                                        0 as "invoiceSales",
                                       "sales"   as "creditNoteSales"
                            

                from "creditNoteLines"
          
                ),
                T AS (          
                select * from "invoiceData" union all select * from "creditNoteData"
                )SELECT concat( DATE_PART('week',generate_series::date),'/', DATE_PART('year',generate_series::date)) as "week",
                                       SUM(COALESCE(T. "totalInvoices",0))  AS "invoiceTotal",
                                       SUM(COALESCE(T. "totalCreditNotes",0))  AS "creditNotesTotal",
                                       SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoicesSales",
                                       SUM(COALESCE(T."creditNoteSales",0)::text::numeric)  as "creditNoteSales",
                                       SUM(COALESCE(T."invoiceSales",0)::text::numeric) -  SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "totalSales"
                                  FROM   generate_series($3::timestamp, $4::timestamp,'1 DAY') 
								 left join  t   ON  T."createdAt"::date =  generate_series::date
						GROUP BY DATE_PART('week',generate_series::date),DATE_PART('year',generate_series::date)
                                ORDER BY DATE_PART('week',generate_series::date) ASC,DATE_PART('year',generate_series::date) ASC`,
                values: [companyId, branches, from, to]
            }


            const report = await client.query(query.text, query.values)
            return new ResponseData(true, "", report.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async monthlySales(client: PoolClient, from: any, to: any, companyId: string, branches: []) {
        try {

            const query = {
                text: `with "lines" as (
                    select      				     
                    (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
             
                    "InvoiceLines"."invoiceId",
                    "InvoiceLines"."createdAt",
                    "InvoiceLines"."qty"
                  
                from "InvoiceLines"
                where "InvoiceLines"."companyId" = $1
                and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  =any($2::uuid[] ))
                and ("InvoiceLines"."createdAt" >=$3 and "InvoiceLines"."createdAt" < $4)
            
                ),
                "invoiceData" as (
                select              "lines"."createdAt" ,
                                        "lines".qty as "totalInvoices",
                                        0 as "totalCreditNotes",
                                       "sales" as "invoiceSales",
                                        0 as "creditNoteSales"
                from "lines"
                inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
      
				
                                ),
                "creditNoteLines" as (

                                    
                    select      				     
                     (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end)  as "sales",
                   "CreditNoteLines".qty  as qty, 
                    "CreditNoteLines"."createdAt"
					
          
                from "CreditNoteLines"
                where "CreditNoteLines"."companyId" = $1
                and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  =any($2::uuid[]))
                and ("CreditNoteLines"."createdAt" >=$3 and "CreditNoteLines"."createdAt" < $4)
         
                ),
                "creditNoteData" as (
                select   "creditNoteLines"."createdAt",
                                        0 as "totalInvoices",
                                       "creditNoteLines".qty as "totalCreditNotes",
                                        0 as "invoiceSales",
                                       "sales"   as "creditNoteSales"
                            

                from "creditNoteLines"
          
                ),
                T AS (          
                select * from "invoiceData" union all select * from "creditNoteData"
                )SELECT concat( TO_CHAR( generate_series, 'Month'),'/', DATE_PART('year',generate_series::date)) as "month" ,
                                       SUM(COALESCE(T. "totalInvoices",0))  AS "invoiceTotal",
                                       SUM(COALESCE(T. "totalCreditNotes",0))  AS "creditNotesTotal",
                                       SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoicesSales",
                                       SUM(COALESCE(T."creditNoteSales",0)::text::numeric)  as "creditNoteSales",
                                       SUM(COALESCE(T."invoiceSales",0)::text::numeric) -  SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "totalSales"
                                  FROM    generate_series($3::timestamp, $4::timestamp,'1 DAY') 
								 left join  t   ON   T."createdAt" ::date =  generate_series::date
						 GROUP BY  DATE_PART(  'Month' ,generate_series::date ),DATE_PART('year',generate_series::date) ,"month"
                                ORDER BY  DATE_PART('year',generate_series::date)ASC ,DATE_PART(  'Month' ,generate_series::date ) ASC `,
                values: [companyId, branches, from, to]
            }
            const report = await client.query(query.text, query.values)
            return new ResponseData(true, "", report.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async quartarlySales(client: PoolClient, from: any, to: any, companyId: string, branches: []) {
        try {

            const query = {
                text: `with "lines" as (
                    select      				     
                    (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
             
                    "InvoiceLines"."invoiceId",
                    "InvoiceLines"."createdAt",
                    "InvoiceLines"."qty"
                  
                from "InvoiceLines"
                where "InvoiceLines"."companyId" = $1
                and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  =any($2::uuid[] ))
                and ("InvoiceLines"."createdAt" >=$3 and "InvoiceLines"."createdAt" < $4)
            
                ),
                "invoiceData" as (
                select              "lines"."createdAt" ,
                                        "lines".qty as "totalInvoices",
                                        0 as "totalCreditNotes",
                                       "sales" as "invoiceSales",
                                        0 as "creditNoteSales"
                from "lines"
                inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
      
				
                                ),
                "creditNoteLines" as (

                                    
                    select      				     
                     (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end)  as "sales",
                   "CreditNoteLines".qty  as qty, 
                    "CreditNoteLines"."createdAt"
					
          
                from "CreditNoteLines"
                where "CreditNoteLines"."companyId" = $1
                and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  =any($2::uuid[]))
                and ("CreditNoteLines"."createdAt" >=$3 and "CreditNoteLines"."createdAt" < $4)
         
                ),
                "creditNoteData" as (
                select   "creditNoteLines"."createdAt",
                                        0 as "totalInvoices",
                                       "creditNoteLines".qty as "totalCreditNotes",
                                        0 as "invoiceSales",
                                       "sales"   as "creditNoteSales"
                            

                from "creditNoteLines"
          
                ),
                T AS (          
                select * from "invoiceData" union all select * from "creditNoteData"
                )SELECT   date_part('quarter',generate_series) as "quarter",
                                       SUM(COALESCE(T. "totalInvoices",0))  AS "invoiceTotal",
                                       SUM(COALESCE(T. "totalCreditNotes",0))  AS "creditNotesTotal",
                                       SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoicesSales",
                                       SUM(COALESCE(T."creditNoteSales",0)::text::numeric)  as "creditNoteSales",
                                       SUM(COALESCE(T."invoiceSales",0)::text::numeric) -  SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "totalSales"
                                  FROM     generate_series($3::timestamp, $4::timestamp,'1 DAY') 
								 left join  t   ON  T."createdAt"::date =  generate_series::date
						GROUP BY  DATE_PART('quarter',generate_series)  ,DATE_PART('year',generate_series::date)
                                ORDER BY  DATE_PART('quarter',generate_series) ASC ,DATE_PART('year',generate_series::date)ASC`,
                values: [companyId, branches, from, to]
            }

            const report = await client.query(query.text, query.values)
            return new ResponseData(true, "", report.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async yearlySales(client: PoolClient, from: any, to: any, companyId: string, branches: []) {
        try {
            const query = {
                text: `with "lines" as (
                    select      				     
                    (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
             
                    "InvoiceLines"."invoiceId",
                    "InvoiceLines"."createdAt",
                    "InvoiceLines"."qty"
                  
                from "InvoiceLines"
                where "InvoiceLines"."companyId" = $1
                and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  =any($2::uuid[] ))
                and ("InvoiceLines"."createdAt" >=$3 and "InvoiceLines"."createdAt" < $4)
            
                ),
                "invoiceData" as (
                select              "lines"."createdAt" ,
                                        "lines".qty as "totalInvoices",
                                        0 as "totalCreditNotes",
                                       "sales" as "invoiceSales",
                                        0 as "creditNoteSales"
                from "lines"
                inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
      
				
                                ),
                "creditNoteLines" as (

                                    
                    select      				     
                     (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end)  as "sales",
                   "CreditNoteLines".qty  as qty, 
                    "CreditNoteLines"."createdAt"
					
          
                from "CreditNoteLines"
                where "CreditNoteLines"."companyId" = $1
                and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  =any($2::uuid[]))
                and ("CreditNoteLines"."createdAt" >=$3 and "CreditNoteLines"."createdAt" < $4)
         
                ),
                "creditNoteData" as (
                select   "creditNoteLines"."createdAt",
                                        0 as "totalInvoices",
                                       "creditNoteLines".qty as "totalCreditNotes",
                                        0 as "invoiceSales",
                                       "sales"   as "creditNoteSales"
                            

                from "creditNoteLines"
          
                ),
                T AS (          
                select * from "invoiceData" union all select * from "creditNoteData"
                )SELECT           DATE_PART('year',generate_series::date) as "year" ,
                                       SUM(COALESCE(T. "totalInvoices",0))  AS "invoiceTotal",
                                       SUM(COALESCE(T. "totalCreditNotes",0))  AS "creditNotesTotal",
                                       SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoicesSales",
                                       SUM(COALESCE(T."creditNoteSales",0)::text::numeric)  as "creditNoteSales",
                                       SUM(COALESCE(T."invoiceSales",0)::text::numeric) -  SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "totalSales"
                                  FROM     generate_series($3::timestamp, $4::timestamp,'1 DAY') 
								 left join  t   ON  T."createdAt"::date =  generate_series::date
					   GROUP BY DATE_PART('year',generate_series::date)
                                ORDER BY DATE_PART('year',generate_series::date)ASC`,
                values: [companyId, branches, from, to]
            }
            const report = await client.query(query.text, query.values)



            return new ResponseData(true, "", report.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    //new report 

    //sales
    public static async salesByTerminals(data: any, company: Company, brancheList: []) {

        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;

            let resault: any[] = [];

            //######################## set time ########################

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

            // if (sortList.length < 1) { sortList.push({ sortValue: "productName", sortDirection: 'asc' }) }

            let orderByQuery = "order by ";
            for (let i = 0; i < sortList.length; i++) {
                orderByQuery += `"${sortList[i].sortValue.trim()}" ${sortList[i].sortDirection ?? ""}`;
                orderByQuery += ", ";
            }
            orderByQuery += ` "Terminals".id `

            //######################################################
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };




            const query: { text: string, values: any } = {
                text: `with "lines" as (
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
                select   "Invoices"."terminalId",
                     
             
				    	COALESCE("lines".qty,0)  as "invoiceProdQty",
                        "sales" as "invoiceSales",
                        0  AS "creditNoteProdQty",
                       0 AS "creditNoteSales"
                from "lines"
                inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
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
                    "CreditNoteLines"."companyId",
                    "CreditNoteLines"."creditNoteId"
                from "CreditNoteLines"
                where "CreditNoteLines"."companyId" = $1
                and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  =any($2::uuid[]))
                and ("CreditNoteLines"."createdAt" >=$3 and "CreditNoteLines"."createdAt" < $4)
         
                ),
                "creditNoteData" as (
                select    "Invoices"."terminalId",
                
                     
                        0 as "invoiceProdQty",
                        0 as "invoiceSales",
					   COALESCE("creditNoteLines".qty,0)  AS "creditNoteProdQty",
                       "sales" AS "creditNoteSales"

                from "creditNoteLines"
                inner join "Branches"   on  "Branches"."companyId"  = $1 and "Branches".id = "creditNoteLines"."branchId"
                inner join "CreditNotes" on "CreditNotes".id = "creditNoteLines"."creditNoteId"
                inner join "Invoices"  on "CreditNotes"."invoiceId" = "Invoices".id
                ),
                T AS (          
                select * from "invoiceData" union all select * from "creditNoteData"
                )select (case when "Terminals".id is not null then COALESCE("Terminals".name,'Terminal') else 'Others'end) as "terminalName",
                                   "Terminals".id as "terminalId",
                                   SUM(COALESCE(T."invoiceProdQty",0)::text::numeric) as "invoiceProdQty",
                                   SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoiceSales",
                                   SUM(COALESCE(T."creditNoteProdQty",0)::text::numeric) as "creditNoteProdQty",
                                   SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "creditNoteSales",
                                   SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric)) as "totalSales"
                            from T
                            left join "Terminals" on T."terminalId" = "Terminals".id
                            group by "Terminals".id
                            ${orderByQuery}                           
                    `,
                values: [companyId, branches, from, to]
            }


            const records = await DB.excu.query(query.text, query.values);

            if (records.rows && records.rows.length > 0) {

                resault = records.rows
            }


            let resData = { records: resault }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Sales By Terminal",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'terminalName' },
                { key: 'invoiceProdQty', header: 'Invoice Product Qty', properties: { hasTotal: true } },
                { key: 'invoiceSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'creditNoteProdQty', header: 'Credit Note Prod Qty', properties: { hasTotal: true } },
                { key: 'creditNoteSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'totalSales', header: 'Total', properties: { hasTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'SalesByTerminal'

                return new ResponseData(true, "", report)
            }



            return new ResponseData(true, "", resData)
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    public static async getSalesByDeliveryArea(data: any, company: Company, brancheList: []) {
        const client = await DB.excu.client()
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;

             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let offset = limit * (page - 1);

            let total = {};
            let count = 0;
            let resault: any[] = [];

            //######################## set time ########################

            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;
            await client.query("BEGIN")

            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(client, branchId)).data.closingTime ?? "05:00:00"
            }

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to


            //######################## sort ########################

            let sortby = filter && filter.sortBy ? filter.sortBy : [];
            let sortList = sortby.filter((item: any) => item.sortValue && item.sortValue.trim() !== "");

            // if (sortList.length < 1) { sortList.push({ sortValue: "productName", sortDirection: 'asc' }) }

            let orderByQuery = "order by ";
            for (let i = 0; i < sortList.length; i++) {
                orderByQuery += `"${sortList[i].sortValue.trim()}" ${sortList[i].sortDirection ?? ""}`;
                orderByQuery += ", ";
            }
            orderByQuery += ` address `

            //######################################################
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };


            const query: { text: string, values: any } = {
                text: `with "lines" as (
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
                and  ( $2::uuid[] IS NULL or  "InvoiceLines"."branchId"  =any( $2::uuid[] ))
                and ("InvoiceLines"."createdAt" >=$3 and "InvoiceLines"."createdAt" <     $4)
            
                ),
                "invoiceData" as (
                select   REPLACE( ("customerAddress"->TRIM (REPLACE(LOWER(("coveredAddresses"->'type')::TEXT),'"',''))::text )::TEXT ,'"','') as "address",
					     count(distinct "Invoices".id) as "numberOfInvoices",
                        sum("sales"::text::numeric) as "invoiceSales",
                        0 AS "creditNoteSales"
                from "lines"
                inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                inner join "Branches"   on    "Branches".id = "lines"."branchId"
                group by   REPLACE( ("customerAddress"->TRIM (REPLACE(LOWER(("coveredAddresses"->'type')::TEXT),'"',''))::text )::TEXT ,'"','') 
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
                    "CreditNoteLines"."companyId",
                    "CreditNoteLines"."creditNoteId"
                from "CreditNoteLines"
                where "CreditNoteLines"."companyId" = $1
                and  (  $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  =any( $2::uuid[]))
                and ("CreditNoteLines"."createdAt" >=$3 and "CreditNoteLines"."createdAt" <     $4)
         
                ),
                "creditNoteData" as (
                select   REPLACE( ("customerAddress"->TRIM (REPLACE(LOWER(("coveredAddresses"->'type')::TEXT),'"',''))::text )::TEXT ,'"','') as "address",
                         0 as "numberOfInvoices",
                         0 as "invoiceSales",
                      sum( "sales"::text::numeric ) AS "creditNoteSales"

                from "creditNoteLines"
                inner join "Branches"   on  "Branches"."companyId"  = $1 and "Branches".id = "creditNoteLines"."branchId"
                inner join "CreditNotes" on "CreditNotes".id = "creditNoteLines"."creditNoteId"
                inner join "Invoices"  on "CreditNotes"."invoiceId" = "Invoices".id
					group by  REPLACE( ("customerAddress"->TRIM (REPLACE(LOWER(("coveredAddresses"->'type')::TEXT),'"',''))::text )::TEXT ,'"','')
                ),
                T AS (          
                select * from "invoiceData" union all select * from "creditNoteData"
                )
				

 				 select count(*) over(),
                               sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric)) over() as "invoiceSalesTotal",
                               sum(SUM(COALESCE(T."creditNoteSales",0)::text::numeric)) over() as "creditNoteSalesTotal",
                               sum(SUM(COALESCE(T."numberOfInvoices",0)::text::numeric)) over() as "totalnumberOfInvoices",
                               sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))) over() as "salesTotal",
                                
                               address,
                               SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoiceSales",
                               SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "creditNoteSales",
                               SUM(COALESCE(T."numberOfInvoices",0)::text::numeric) as "numberOfInvoices",
                               SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric)) as "totalSales",
                               (case when SUM(COALESCE(T."numberOfInvoices",0)::text::numeric) <> 0 
                                       then SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))::float/ SUM(COALESCE(T."numberOfInvoices",0)::text::numeric)::float
                                    else 0 end) as "salesAvg"
                        from T
                        group by address
                        ${orderByQuery}
                    
                    `,
                values: [companyId, branches, from, to]
            }


            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`

            let records = await client.query(query.text + limitQuery, query.values)

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { numberOfInvoices: t.totalnumberOfInvoices, invoiceSales: t.invoiceSalesTotal, creditNoteSales: t.creditNoteSalesTotal, totalSales: t.salesTotal, salesAvg: Number(t.numberOfInvoices) != 0 ? (Number(t.salesTotal) / Number(t.totalnumberOfInvoices)) : 0 }
                resault = records.rows.map((e: any) => { return { address: e.address, numberOfInvoices: e.numberOfInvoices, invoiceSales: e.invoiceSales, creditNoteSales: e.creditNoteSales, totalSales: e.totalSales, salesAvg: e.salesAvg } })
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
                    title: "Sales By Delivery Area",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'address' },
                { key: 'invoiceSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'creditNoteSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'totalSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'salesAvg', header: "Sales Average", properties: { columnType: 'currency' } }
                ]
                report.fileName = 'salesByDeliveryArea'
                await client.query("COMMIT")
                return new ResponseData(true, "", report)
            }
            await client.query("COMMIT")
            return new ResponseData(true, "", resData)
        } catch (error: any) {
          
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async salesByAggregatorReport(data: any, company: Company, brancheList: []) {
        const client = await DB.excu.client()
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;

            let resault: any[] = [];
            //######################## set time ########################

            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;
            await client.query("BEGIN")

            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(client, branchId)).data.closingTime ?? "05:00:00"
            }

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to


            //######################## sort ########################
            let NoOfperiod = filter && filter.periodQty ? filter.periodQty : null;
            let period = filter && filter.period ? filter.period : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : 'none';
            let columns = ["Total"]
            let results: any = []


            let sortby = filter && filter.sortBy ? filter.sortBy : [];
            let sortList = sortby.filter((item: any) => item.sortValue && item.sortValue.trim() !== "");

            // if (sortList.length < 1) { sortList.push({ sortValue: "productName", sortDirection: 'asc' }) }

            let orderByQuery = "order by ";
            for (let i = 0; i < sortList.length; i++) {
                orderByQuery += `"${sortList[i].sortValue.trim()}" ${sortList[i].sortDirection ?? ""}`;
                orderByQuery += ", ";
            }
            orderByQuery += ` "Plugins".id `

            //######################################################
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };

            const query: { text: string, values: any } = {
                text: `with "lines" as (
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
                and ("InvoiceLines"."createdAt" >=case when (lower($3::TEXT) ='period' and  lower($4::TEXT)  ='month') then $6::timestamp  - interval '1 month' *   $5::int 
                                                    when (lower($3::TEXT) ='period' and  lower($4::TEXT)  ='year')  then $6::timestamp  - interval '1 year'  *    $5::int
                                                    else $6::timestamp end and "InvoiceLines"."createdAt" < $7)
            
                ),
                "invoiceData" as (
                select   "Invoices"."aggregator",
                     
             
				    	COALESCE("lines".qty,0)  as "invoiceProdQty",
                        "sales" as "invoiceSales",
                        0  AS "creditNoteProdQty",
                       0 AS "creditNoteSales",
						case when  lower($3)= 'branch' then COALESCE("Branches".name,'other') ::TEXT
                                     when  lower($3)= 'period' and lower($4)= 'month' then to_char("lines"."createdAt"::TIMESTAMP,'Mon/YYYY')::TEXT
                                     when  lower($3) = 'period' and lower($4) = 'year'  then  to_char("lines"."createdAt"::TIMESTAMP,'YYYY') ::TEXT
                                  else 'Total'::TEXT end as "key"
                from "lines"
                inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                inner join "Branches"   on  "Branches"."companyId"  = $1 and  "Branches".id = "lines"."branchId"
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
                    "CreditNoteLines"."companyId",
                    "CreditNoteLines"."creditNoteId"
                from "CreditNoteLines"
                where "CreditNoteLines"."companyId" = $1
                and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  =any($2::uuid[]))
                and ("CreditNoteLines"."createdAt" >=case when (lower($3::TEXT) ='period' and  lower($4::TEXT)  ='month') then $6::timestamp  - interval '1 month' *   $5::int 
                                                    when (lower($3::TEXT) ='period' and  lower($4::TEXT)  ='year')  then $6::timestamp  - interval '1 year'  *    $5::int
                                                    else $6::timestamp end  and "CreditNoteLines"."createdAt" < $7)
         
                ),
                "creditNoteData" as (
                select    "Invoices"."aggregator",
                
                     
                        0 as "invoiceProdQty",
                        0 as "invoiceSales",
					   COALESCE("creditNoteLines".qty,0)  AS "creditNoteProdQty",
                       "sales" AS "creditNoteSales",
	case when  lower($3)= 'branch' then COALESCE("Branches".name,'other') ::TEXT
                                     when  lower($3) = 'period' and lower($4) = 'month' then to_char("creditNoteLines"."createdAt"::TIMESTAMP,'Mon/YYYY')::TEXT
                                     when  lower($3)= 'period' and lower($4) = 'year'  then  to_char("creditNoteLines"."createdAt"::TIMESTAMP,'YYYY') ::TEXT
                                  else 'Total'::TEXT end as "key"
                from "creditNoteLines"
                inner join "Branches"   on  "Branches"."companyId"  = $1 and "Branches".id = "creditNoteLines"."branchId"
                inner join "CreditNotes" on "CreditNotes".id = "creditNoteLines"."creditNoteId"
                inner join "Invoices"  on "CreditNotes"."invoiceId" = "Invoices".id
                ),
                T AS (          
                select * from "invoiceData" union all select * from "creditNoteData"
                ), "summary" as (
						
						select ( COALESCE(NULLIF(T."aggregator",''),'Others')) as "pluginName",
                           
                                SUM(COALESCE(T."invoiceProdQty",0)::text::numeric) as "invoiceProdQty",
                                SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoiceSales",
                                SUM(COALESCE(T."creditNoteProdQty",0)::text::numeric) as "creditNoteProdQty",
                                SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "creditNoteSales",
                                SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric)) as "totalSales",
							"key"
                        from(select * from "invoiceData" union all select * from "creditNoteData")T
                        group by 	"pluginName",	"key"
						),"keys" as (select     JSON_AGG(distinct "key") "key"   from "summary")
						
						select 
			
								"summary"."pluginName",
								 "keys"."key"::TEXT::JSONB  as "columns",
								JSON_AGG(JSON_BUILD_OBJECT("summary"."key",JSON_BUILD_OBJECT('invoiceProdQty',"invoiceProdQty",
																				   'invoiceSales',"invoiceSales",
																				   'creditNoteProdQty',"creditNoteProdQty",
																				    'creditNoteSales',"creditNoteSales",
																				   'totalSales',"totalSales"
																				  ))) as "summary"
						
						from "summary"
						   join "keys" on true
						group by
								"summary"."pluginName",
								 "keys"."key"::TEXT
	                          
                    `,
                values: [companyId, branches, compareType, period, NoOfperiod, from, to]
            }


            const records = await client.query(query.text, query.values);


            const DefaultSubColumns = ['invoiceProdQty', 'invoiceSales', 'creditNoteProdQty', 'creditNoteSales', 'totalSales'];
            const selectedSubColumns = filter.subColumns ?? ['totalSales'];
            const validSubColumns = selectedSubColumns.filter((col: string) =>
                DefaultSubColumns.includes(col)
            );
            if (validSubColumns.length === 0) {
                validSubColumns.push('totalSales');
            }


            let resData = {
                records: records.rows,
                subColumns: compareType == 'none' ? DefaultSubColumns : validSubColumns,
                columns: compareType == 'none' ? columns : (<any>records.rows[0]).columns,

            }





            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Sales By Aggregator",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches, compareType: compareType,
                    period: period, periodQty: NoOfperiod
                }
                report.records = records.rows

                //get columns & subColumns
                resData.columns.forEach((col: any) => {
                    let childs: DataColumn[] = []
                    resData.subColumns.forEach((subcol: any) => childs.push({ key: subcol, properties: { columnType: 'currency' } }))
                    report.columns.push({ key: col, childs: childs, properties: { hasTotal: true } })
                })

                report.columns = [...[{ key: 'pluginName' }], ...report.columns]
                report.fileName = 'SalesByAggregator'
                await client.query("COMMIT")
                return new ResponseData(true, "", report)

            }
            await client.query("COMMIT")
            return new ResponseData(true, "", resData)
        } catch (error: any) {
          
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async salesByAggregatorSubReport(data: any, company: Company, brancheList: []) {
        const client = await DB.excu.client()
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;
            let aggregatorName = data.filter.aggregatorName;
            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let resault: any[] = [];

            //######################## set time ########################

            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;
            await client.query("BEGIN")

            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(client, branchId)).data.closingTime ?? "05:00:00"
            }

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to

            //######################## sort ########################
            let NoOfperiod = filter && filter.periodQty ? filter.periodQty : null;
            let period = filter && filter.period ? filter.period : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : 'none';
            let columns = ["Total"]
            let results: any = []


            let sortby = filter && filter.sortBy ? filter.sortBy : [];
            let sortList = sortby.filter((item: any) => item.sortValue && item.sortValue.trim() !== "");

            // if (sortList.length < 1) { sortList.push({ sortValue: "productName", sortDirection: 'asc' }) }

            let orderByQuery = "order by ";
            for (let i = 0; i < sortList.length; i++) {
                orderByQuery += `"${sortList[i].sortValue.trim()}" ${sortList[i].sortDirection ?? ""}`;
                orderByQuery += ", ";
            }
            orderByQuery += ` "Plugins".id `

            //######################################################

            const query: { text: string, values: any } = {
                text: `with "values" as (
                       SELECT  $1::uuid AS "companyId",
                                $2::uuid[] AS "branches",
	                              case when (lower($3::TEXT) ='period' and  lower($4::TEXT)  ='month') then '2024-01-01'::timestamp  - interval '1 month' *  $5::int 
                                      when (lower($3::TEXT) ='period' and  lower($4::TEXT)  ='year')  then '2024-01-01'::timestamp  - interval '1 year'  *   $5::int
                                      else $6::timestamp 	END AS "fromDate",
                                       $7::timestamp AS "toDate",
                                 lower($3)::text As "compType",
	                             lower($4)::text as "period"
                        )
                        ,"invoiceData" as(
                        select  invo."aggregator", branches."companyId",
                                sum(COALESCE(IL.qty,0)  :: text :: NUMERIC) as "invoiceProdQty",
                                sum(case when IL."isInclusiveTax" = true then ((COALESCE(IL."subTotal",0)::text::numeric) - (COALESCE(IL."taxTotal",0)::text::numeric)) else COALESCE(IL."subTotal",0)::text::numeric end) as "invoiceSales",
                                0  AS "creditNoteProdQty",
                                0 AS "creditNoteSales",
								case when "values"."compType" = 'branch' then COALESCE(branches.name,'other') ::TEXT
                                     when "values"."compType" = 'period' and "period" = 'month' then to_char(IL."createdAt"::TIMESTAMP,'Mon/YYYY')::TEXT
                                     when "values"."compType" = 'period' and "period" = 'year'  then  to_char(IL."createdAt"::TIMESTAMP,'YYYY') ::TEXT
                                  else 'Total'::TEXT end as "key"
                        from "InvoiceLines" as IL
                        join "values" on true
                        inner join "Invoices" as invo on invo.id = IL."invoiceId"
                        inner join "Branches" as branches on branches.id = invo."branchId"
                        where branches."companyId" = "values"."companyId"  
                            and invo."status" <> 'Draft' 
                            and (array_length("values"."branches",1) IS NULL or  branches.id = Any("values"."branches"))
                            and (IL."createdAt" >= "values"."fromDate" and IL."createdAt" < "values"."toDate"  )
                        group by  invo."aggregator", branches ."companyId","key"
                        )
                        ,"creditNoteData" as(
                        select  invo."aggregator", branches."companyId",
                                0 as "invoiceProdQty",
                                0 as "invoiceSales",
                                sum(COALESCE(CNL.qty,0)  :: text :: NUMERIC)  AS "creditNoteProdQty",
                                sum(case when CNL."isInclusiveTax" = true then ((COALESCE(CNL."subTotal",0)::text::numeric) - (COALESCE(CNL."taxTotal",0)::text::numeric)) else COALESCE(CNL."subTotal",0)::text::numeric end) AS "creditNoteSales",
								case when "values"."compType" = 'branch' then COALESCE(branches.name,'other') ::TEXT
                                     when "values"."compType" = 'period' and "period" = 'month' then to_char(CNL."createdAt"::TIMESTAMP,'Mon/YYYY')::TEXT
                                     when "values"."compType" = 'period' and "period" = 'year'  then  to_char(CNL."createdAt"::TIMESTAMP,'YYYY') ::TEXT
                                  else 'Total'::TEXT end as "key"
                        from "CreditNoteLines" as CNL
                        join "values" on true
                        inner join "CreditNotes" as CN on CN.id = CNL."creditNoteId"
                        inner join "Invoices"  as invo on CN."invoiceId" = invo.id
                        inner join "Branches" as branches on branches.id = CN."branchId"
                        where branches."companyId" = "values"."companyId"  
                            and (array_length("values"."branches",1) IS NULL or  branches.id = Any("values"."branches"))
                            and (CNL."createdAt" >=  "values"."fromDate" and CNL."createdAt" < "values"."toDate")
                        group by  invo."aggregator", branches."companyId","key"
                        ), "summary" as (
						
						select (case when "Plugins".id is not null then COALESCE(NULLIF("Plugins"."pluginName",''),'Plugin') else 'Others'end) as "pluginName",
                                "Plugins".id as "pluginId",
                                SUM(COALESCE(T."invoiceProdQty",0)::text::numeric) as "invoiceProdQty",
                                SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoiceSales",
                                SUM(COALESCE(T."creditNoteProdQty",0)::text::numeric) as "creditNoteProdQty",
                                SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "creditNoteSales",
                                SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric)) as "totalSales",
							"key"
                        from(select * from "invoiceData" union all select * from "creditNoteData")T
                        left join "Plugins" ON "Plugins"."pluginName" = T."aggregator"  AND  "Plugins"."companyId" = T."companyId" 
                        group by "Plugins".id,	"key"
						),"keys" as (select     JSON_AGG(distinct "key") "key"   from "summary")
						
						select 
						"summary"."pluginId",
								"summary"."pluginName",
								 "keys"."key"::TEXT::JSONB  as "columns",
								JSON_AGG(JSON_BUILD_OBJECT("summary"."key",JSON_BUILD_OBJECT('invoiceProdQty',"invoiceProdQty",
																				   'invoiceSales',"invoiceSales",
																				   'creditNoteProdQty',"creditNoteProdQty",
																				    'creditNoteSales',"creditNoteSales",
																				   'totalSales',"totalSales"
																				  ))) as "summary"
						
						from "summary"
						   join "keys" on true
						group by "summary"."pluginId",
								"summary"."pluginName",
								 "keys"."key"::TEXT
	                          
                    `,
                values: [companyId, branches, compareType, period, NoOfperiod, from, to]
            }


            const records = await client.query(query.text, query.values);

            if (records.rows && records.rows.length > 0) {

                resault = records.rows
            }
            // try {
            //     columns.sort((a, b) => {
            //         const aa = moment(a, 'MMM/YYYY')
            //         const bb = moment(b, 'MMM/YYYY')
            //         return aa.diff(bb)
            //     })
            // } catch { columns = columns }

            let resData = {
                records: results,
                subColumns: compareType == 'none' ? ['invoiceProdQty', 'invoiceSales', 'creditNoteProdQty', 'creditNoteSales', 'totalSales'] : ['totalSales'],
                columns: columns,

            }



            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Sales By Aggregator",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'pluginName' },
                { key: 'invoiceProdQty', header: 'Invoice Product Qty', properties: { hasTotal: true } },
                { key: 'invoiceSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'creditNoteProdQty', header: 'Credit Note Prod Qty', properties: { hasTotal: true } },
                { key: 'creditNoteSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'totalSales', properties: { hasTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'SalesByTerminal'
                await client.query("COMMIT")
                return new ResponseData(true, "", report)
            }
            await client.query("COMMIT")
            return new ResponseData(true, "", resData)

        } catch (error: any) {
          
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async getSalesByTableGroups(data: any, company: Company, brancheList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;

            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? filter.fromDate : null;
            fromDate = moment(new Date(fromDate))
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };
             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let offset = limit * (page - 1);

            let total = {};
            let count = 0;
            let resault: any[] = [];

            const query: { text: string, values: any } = {
                text: `with "lines" as (
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
                    "InvoiceLines"."employeeId",
                    "InvoiceLines"."salesEmployeeId",
                    "InvoiceLines"."companyId"
                from "InvoiceLines"
                where "InvoiceLines"."companyId" = $1
                and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  =any($2::uuid[] ))
                and ("InvoiceLines"."createdAt" >=$3 and "InvoiceLines"."createdAt" < $4)
            
                ),
                "invoiceData" as (
                select    "Invoices"."tableId" as "tableId",
                           sum(COALESCE(NULLIF("Invoices" .guests, 0),1)) as "numberOfguests",
					   count(distinct "Invoices".id) as "numberOfInvoices",
            
                        sum("sales"::text::numeric) as "invoiceSales",
                             0 AS "creditNoteSales"
                from "lines"
                inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                inner join "Branches"   on  "Branches"."companyId"  = $1 and  "Branches".id = "lines"."branchId"
					group by "Invoices"."tableId" 
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
                    "CreditNoteLines"."companyId",
                    "CreditNoteLines"."creditNoteId",
					    "CreditNoteLines"."employeeId",
                    "CreditNoteLines"."salesEmployeeId"
                from "CreditNoteLines"
                where "CreditNoteLines"."companyId" = $1
                and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  =any($2::uuid[]))
                and ("CreditNoteLines"."createdAt" >=$3 and "CreditNoteLines"."createdAt" < $4)
         
                ),
                "creditNoteData" as (
                select   "Invoices"."tableId", 
                         0 as "numberOfguests",
                            0 as "numberOfInvoices",
                            0 as "invoiceSales",
					              sum("sales"::text::numeric) AS "creditNoteSales"

                from "creditNoteLines"
                inner join "Branches"   on  "Branches"."companyId"  = $1 and "Branches".id = "creditNoteLines"."branchId"
                inner join "CreditNotes" on "CreditNotes".id = "creditNoteLines"."creditNoteId"
                inner join "Invoices"  on "CreditNotes"."invoiceId" = "Invoices".id
						group by "Invoices"."tableId" 
                ),
                T AS (          
                select * from "invoiceData" union all select * from "creditNoteData"
                )
select count(*) over(),
                            sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric)) over() as "invoiceSalesTotal",
                            sum(SUM(COALESCE(T."creditNoteSales",0)::text::numeric)) over() as "creditNoteSalesTotal",
                            sum(SUM(COALESCE(T."numberOfInvoices",0)::text::numeric)) over() as "totalnumberOfInvoices",
                            sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))) over() as "salesTotal",
                    
                            (case when "TableGroups".id is not null then COALESCE(NULLIF("TableGroups".name,''),'Table Group') else 'Others'end) as "tableGroupName",
                            "TableGroups".id as "tableGroupsId",
                            SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoiceSales",
                            SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "creditNoteSales",
                            SUM(COALESCE(T."numberOfInvoices",0)::text::numeric) as "numberOfInvoices",
                            SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric)) as "totalSales",
                            (case when SUM(COALESCE(T."numberOfInvoices",0)::text::numeric) <> 0 
                                    then SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))::float/ SUM(COALESCE(T."numberOfInvoices",0)::text::numeric)::float
                                else 0 end) as "salesAvg"
                    from(select * from "invoiceData" union all select * from "creditNoteData")T
                    left join "Tables" on "Tables".id = T."tableId" 
                    left join "TableGroups" on "TableGroups".id = "Tables"."tableGroupId"						
                    group by "TableGroups".id
                    order by "TableGroups".id  
                    `,
                values: [companyId, branches, from, to]
            }


            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`

            const records = await DB.excu.query(query.text + limitQuery, query.values)
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { numberOfInvoices: t.totalnumberOfInvoices, invoiceSales: t.invoiceSalesTotal, creditNoteSales: t.creditNoteSalesTotal, totalSales: t.salesTotal, salesAvg: Number(t.numberOfInvoices) != 0 ? (Number(t.salesTotal) / Number(t.totalnumberOfInvoices)) : 0 }
                resault = records.rows.map((e: any) => { return { tableGroupName: e.tableGroupName, tableGroupsId: e.tableGroupsId, numberOfInvoices: e.numberOfInvoices, invoiceSales: e.invoiceSales, creditNoteSales: e.creditNoteSales, totalSales: e.totalSales, salesAvg: e.salesAvg } })
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
                    title: "Sales By Table Group",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'tableGroupName' },
                { key: 'invoiceSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'creditNoteSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'totalSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'numberOfInvoices', properties: { hasTotal: true } },
                { key: 'salesAvg', header: "Sales Average", properties: { columnType: 'currency' } }
                ]
                report.fileName = 'salesByTableGroup'
                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async getSalesByTables(data: any, company: Company, brancheList: []) {
        const client = await DB.excu.client()
        try {

            await client.query("BEGIN")
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;


            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(client, branchId)).data.closingTime ?? "05:00:00"
            }

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to

            //---------------------------------------

            if (!Array.isArray(branches) || branches.length == 0) { branches = null };
             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let offset = limit * (page - 1);

            let total = {};
            let count = 0;
            let resault: any[] = [];

            const query: { text: string, values: any } = {
                text: `with "lines" as (
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
                    "InvoiceLines"."employeeId",
                    "InvoiceLines"."salesEmployeeId",
                    "InvoiceLines"."companyId"
                from "InvoiceLines"
                where "InvoiceLines"."companyId" = $1
                and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  =any($2::uuid[] ))
                and ("InvoiceLines"."createdAt" >=$3 and "InvoiceLines"."createdAt" < $4)
            
                ),
                "invoiceData" as (
                select    "Invoices"."tableId" ,
                           sum(COALESCE(NULLIF("Invoices" .guests, 0),1)) as "numberOfguests",
					   count(distinct "Invoices" .id) as "numberOfInvoices",
            
                        sum("sales"::text::numeric) as "invoiceSales",
                             0 AS "creditNoteSales"
                from "lines"
                inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                inner join "Branches"   on  "Branches"."companyId"  = $1 and  "Branches".id = "lines"."branchId"
					group by "Invoices"."tableId" 
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
                    "CreditNoteLines"."companyId",
                    "CreditNoteLines"."creditNoteId",
					    "CreditNoteLines"."employeeId",
                    "CreditNoteLines"."salesEmployeeId"
                from "CreditNoteLines"
                where "CreditNoteLines"."companyId" = $1
                and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  =any($2::uuid[]))
                and ("CreditNoteLines"."createdAt" >=$3 and "CreditNoteLines"."createdAt" < $4)
         
                ),
                "creditNoteData" as (
                select   "Invoices"."tableId", 
                         0 as "numberOfguests",
                            0 as "numberOfInvoices",
                            0 as "invoiceSales",
					              sum("sales"::text::numeric) AS "creditNoteSales"

                from "creditNoteLines"
                inner join "Branches"   on  "Branches"."companyId"  = $1 and "Branches".id = "creditNoteLines"."branchId"
                inner join "CreditNotes" on "CreditNotes".id = "creditNoteLines"."creditNoteId"
                inner join "Invoices"  on "CreditNotes"."invoiceId" = "Invoices".id
						group by "Invoices"."tableId" 
                ),
                T AS (          
                select * from "invoiceData" union all select * from "creditNoteData"
                )
			 select count(*) over(),
                               sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric)) over() as "invoiceSalesTotal",
                               sum(SUM(COALESCE(T."creditNoteSales",0)::text::numeric)) over() as "creditNoteSalesTotal",
                               sum(SUM(COALESCE(T."numberOfInvoices",0)::text::numeric)) over() as "totalnumberOfInvoices",
                               sum(SUM(COALESCE(T."numberOfguests",0)::text::numeric)) over() as "totalnumberOfguests",
                               sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))) over() as "salesTotal",
                        
                               (case when "Tables".id is not null then COALESCE(NULLIF("Tables".name,''),'Table') else 'Others'end) as "tableName",
                               "Tables".id as "tableid",
                               SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoiceSales",
                               SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "creditNoteSales",
                               SUM(COALESCE(T."numberOfInvoices",0)::text::numeric) as "numberOfInvoices",
                               SUM(COALESCE(T."numberOfguests",0)::text::numeric) as "numberOfguests",
                               SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric)) as "totalSales",
                               (case when SUM(COALESCE(T."numberOfInvoices",0)::text::numeric) <> 0 
                                       then SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))::float/ SUM(COALESCE(T."numberOfInvoices",0)::text::numeric)::float
                                    else 0 end) as "salesOrderAvg",
                               (case when SUM(COALESCE(T."numberOfguests",0)::text::numeric) <> 0 
                                     then SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))::float/ SUM(COALESCE(T."numberOfguests",0)::text::numeric)::float
                                else 0 end) as "salesGuestAvg"
                        from(select * from "invoiceData" union all select * from "creditNoteData")T
                        left join "Tables" on "Tables".id = T."tableId" 					
                        group by "Tables".id
                        order by "Tables".id 
                    `,
                values: [companyId, branches, from, to]
            }


            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`

            const records = await client.query(query.text + limitQuery, query.values)
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = {
                    invoiceSales: t.invoiceSalesTotal, creditNoteSales: t.creditNoteSalesTotal, totalSales: t.salesTotal,
                    numberOfInvoices: t.totalnumberOfInvoices, salesAvg: Number(t.totalnumberOfInvoices) != 0 ? (Number(t.salesTotal) / Number(t.totalnumberOfInvoices)) : 0,
                    numberOfguests: t.totalnumberOfguests, salesGuestAvg: Number(t.totalnumberOfguests) != 0 ? (Number(t.salesTotal) / Number(t.totalnumberOfguests)) : 0
                }
                resault = records.rows.map((e: any) => { return { tableName: e.tableName, tableId: e.tableId, invoiceSales: e.invoiceSales, creditNoteSales: e.creditNoteSales, totalSales: e.totalSales, numberOfInvoices: e.numberOfInvoices, salesOrderAvg: e.salesOrderAvg, numberOfguests: e.numberOfguests, salesGuestAvg: e.salesGuestAvg } })
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
                    title: "Sales By Table",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'tableName' },
                { key: 'invoiceSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'creditNoteSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'totalSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'numberOfInvoices', properties: { hasTotal: true } },
                { key: 'salesOrderAvg', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'numberOfguests', properties: { hasTotal: true } },
                { key: 'salesGuestAvg', properties: { hasTotal: true, columnType: 'currency' } },
                ]
                report.fileName = 'SalesByTable'
                return new ResponseData(true, "", report)
            }

            await client.query("COMMIT")
            return new ResponseData(true, "", resData)
        } catch (error: any) {
            await client.query("ROLLBACK")
          

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async tableUsage(data: any, company: Company, brancheList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? filter.fromDate : null;
            fromDate = moment(new Date(fromDate))
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------

            if (!Array.isArray(branches) || branches.length == 0) { branches = null };
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
                               $4::timestamp as "toDate"
                        )
                        ,"records"as (
                        select  "Tables"."name", "Tables"."id" as "tableId", 
                                "Invoices"."invoiceNumber", "Invoices"."id" as "invoiceId", 
                                "Invoices"."createdAt" as "creationTime",
                                case when "Invoices".status = 'closed' then "Invoices"."createdAt" else  max("InvoicePaymentLines"."createdAt") end as "settleTime", 
                                "Invoices".total as "invoiceTotal"
                        from "Invoices"
                        join "values" on true
                        inner join "Tables" ON "Tables".id = "Invoices"."tableId"
                        inner join "Branches" ON "Branches".id = "Invoices"."branchId"
                        Left join "InvoicePaymentLines" ON "InvoicePaymentLines"."invoiceId" = "Invoices".id 
                        left join "InvoicePayments" ON "InvoicePayments".id = "InvoicePaymentLines"."invoicePaymentId"
                        where "Branches"."companyId" = "values"."companyId"  
                                and "Invoices"."status" <> 'Draft' 
                                and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                                and ("Invoices"."createdAt" >= "values"."fromDate" and "Invoices"."createdAt" < "values"."toDate"  ) 
                                and ("InvoicePaymentLines".id is null or "InvoicePayments".status = 'SUCCESS')
                        group by "Tables"."id", "Invoices".id
                        order by  "Tables"."id"
                        ), 
                        "paginationRecords" as (
                        select "name" , "tableId", count(*) over(), 
                            sum("invoiceTotal"::text::numeric) over() as total, 
                            sum("invoiceTotal"::text::numeric) over (partition by "tableId") as "tableTotal",
                            age("settleTime","creationTime" ) as usage,
                            "invoiceId", "invoiceNumber", "creationTime", "settleTime",  "invoiceTotal"
                        from "records"
                        order by  "name"
                        
                    `,
                values: [companyId, branches, from, to]
            }

            let limitQuery = filter.export && filter.export === true ? ` ) select * from "paginationRecords" 
                                                                            order by  "name"`
                : ` limit ${limit}
                                                                        offset ${offset}
                                                                        )
                                                                        select "count", "total", "name" , "tableId", "tableTotal",
                                                                                jsonb_agg(jsonb_build_object('invoiceId',"invoiceId",
                                                                                                            'invoiceNumber',"invoiceNumber", 
                                                                                                            'creationTime',"creationTime" ,
                                                                                                            'settleTime',"settleTime",
                                                                                                            'usage',"usage" ,
                                                                                                            'total',"invoiceTotal"
                                                                                                            )) as "invoices"
                                                                        from "paginationRecords"
                                                                        group by "count", "total", "name" , "tableId", "tableTotal"`

            const records = await DB.excu.query(query.text + limitQuery, query.values)



            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { invoiceTotal: Number(t.total) }
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
                total: total,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Table Usage Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                console.log(records.rows)
                report.columns = [{ key: 'name', properties: { groupBy: true } },
                { key: 'invoiceNumber' },
                { key: 'creationTime', properties: { columnType: 'date_time' } },
                { key: 'settleTime', properties: { columnType: 'date_time' } },
                { key: 'usage', properties: { hasTotal: true, hasSubTotal: true, columnType: 'currency' } },
                { key: 'invoiceTotal', header: "Total", properties: { hasTotal: true, hasSubTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'tableUsage'
                return new ResponseData(true, "", report)
            }


            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async tableUsageSummary(data: any, company: Company, brancheList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? filter.fromDate : null;
            fromDate = moment(new Date(fromDate))
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------

            if (!Array.isArray(branches) || branches.length == 0) { branches = null };
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
                               $4::timestamp as "toDate"
                        )
                        ,"records"as (
                        select  "Tables"."name", "Tables"."id" as "tableId",
                                age((case when "Invoices".status = 'closed' then "Invoices"."createdAt" else  max("InvoicePaymentLines"."createdAt")end),"Invoices"."createdAt" ) as "usage"
                        from "Invoices"
                        join "values" on true
                        inner join "Tables" ON "Tables".id = "Invoices"."tableId"
                        inner join "Branches" ON "Branches".id = "Invoices"."branchId"
                        Left join "InvoicePaymentLines" ON "InvoicePaymentLines"."invoiceId" = "Invoices".id 
                        left join "InvoicePayments" ON "InvoicePayments".id = "InvoicePaymentLines"."invoicePaymentId"
                        where "Branches"."companyId" = "values"."companyId"  
                                and "Invoices"."status" <> 'Draft' 
                                and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                                and ("Invoices"."createdAt" >= "values"."fromDate" and "Invoices"."createdAt" < "values"."toDate"  ) 
                                and ("InvoicePaymentLines".id is null or "InvoicePayments".status = 'SUCCESS')
                        group by "Tables"."id", "Invoices".id
                        order by  "Tables"."id"
                        )
                        select count(*) over(), "tableId", name, count(*) as "invoiceCount",
                        count(usage) as "closedInvoiceCount",
                        sum("usage") as "usage" , avg("usage")as "avgUsage"
                        from "records"
                        group by "tableId", name
                       
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
                records.rows.forEach((row: any) => {
                    let usage = moment.duration(row.usage)
                    row.usage = usage.asHours().toFixed(0) + 'h ' + moment.utc(usage.asMilliseconds()).format("mm[m] ss[s]")
                    let avgUsage = moment.duration(row.avgUsage)
                    row.avgUsage = avgUsage.asHours().toFixed(0) + 'h ' + moment.utc(avgUsage.asMilliseconds()).format("mm[m] ss[s]")

                })

                report.filter = {
                    title: "Table Usage Summary",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'name', header: 'Table Name' },
                { key: 'invoiceCount' },
                { key: 'usage' },
                { key: 'avgUsage' }

                ]
                report.fileName = 'TableUsageSummary'
                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async salesByPeriodReport(data: any, company: Company, type: string | null = null, brancheList: []) {
        const client = await DB.excu.client()
        try {

            await client.query("BEGIN")
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList
            // let branchId = branches.length == 1 ? filter.branches[0] : null;
            const period = filter && filter.period ? filter.period : null;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;

            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(client, branchId)).data.closingTime ?? "05:00:00"
            }
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to

            //---------------------------------------

            let result: any = [];
            let dateType = ''

            type = type ? type : 'report'
            switch (period) {
                case "hourly":
                    result = await this.hourlySales(client, from, to, companyId, branches)
                    dateType = 'hour'
                    break;
                case "daily":
                    result = await this.dailySales(client, from, to, companyId, branches)
                    dateType = 'date'
                    break;
                case "weekDay":
                    result = await this.weekDaySales(client, from, to, companyId, branches)
                    dateType = 'day'
                    break;
                case "weekly":
                    result = await this.weeklySales(client, from, to, companyId, branches)
                    dateType = 'week'
                    break;
                case "monthly":
                    result = await this.monthlySales(client, from, to, companyId, branches)
                    dateType = 'month'
                    break;
                case "quartarly":
                    result = await this.quartarlySales(client, from, to, companyId, branches)
                    dateType = 'quarter'
                    break;
                case "yearly":
                    result = await this.yearlySales(client, from, to, companyId, branches)
                    dateType = 'year'
                    break;
                default:
                    return new ResponseData(false, "Invalid Or Missing Report Type", [])

            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: period + " Sales Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = result.data ?? []
                if (dateType == 'date') {
                    report.records.forEach(elem => { elem.date = moment.utc(elem.date).utcOffset(+timeOffset).format('YYYY-MM-DD') })
                }

                report.columns = [{ key: dateType },
                { key: 'invoiceTotal', header: 'Invoice Product Qty', properties: { hasTotal: true } },
                { key: 'invoicesSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'creditNotesTotal', header: 'Credit Note Product Qty', properties: { hasTotal: true } },
                { key: 'creditNoteSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'totalSales', properties: { hasTotal: true, columnType: 'currency' } }
                ]
                report.fileName = period + 'SalesReport'
                return new ResponseData(true, "", report)
            }
            await client.query("COMMIT")
            return result
        } catch (error: any) {
          
            await client.query("ROLLBACK")
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }

    public static async salesByInvoice(data: any, company: Company, brancheList: []) {
        const client = await DB.excu.client()
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;

             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let offset = limit * (page - 1);
            let total = {};
            let count = 0;
            let resault: any[] = [];

            //######################## set time ########################
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;
            await client.query("BEGIN")

            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(client, branchId)).data.closingTime ?? "05:00:00"
            }

            let timeOffset = company.timeOffset ?? 0
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to

            //######################## sort ########################

            let sortby = filter && filter.sortBy ? filter.sortBy : [];
            let sortList = sortby.filter((item: any) => item.sortValue && item.sortValue.trim() !== "");

            // if (sortList.length < 1) { sortList.push({ sortValue: "productName", sortDirection: 'asc' }) }

            let orderByQuery = "order by ";
            for (let i = 0; i < sortList.length; i++) {
                orderByQuery += `"${sortList[i].sortValue.trim()}" ${sortList[i].sortDirection ?? ""}`;
                orderByQuery += ", ";
            }
            orderByQuery += ` "invoiceDate" `

            //######################################################
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };

            const query: { text: string, values: any } = {
                text: `with "values" as (
                    select $1::uuid as "companyId",
                           $2::uuid[] as "branches",
                           $3::timestamp as "fromDate",
                           $4::timestamp as "toDate"
                    )
                    SELECT count(*) over(),
                                SUM(SUM(COALESCE("InvoiceLines"."subTotal"::text::numeric,0) - (case when "InvoiceLines"."isInclusiveTax" = true then COALESCE("InvoiceLines"."taxTotal"::text::numeric,0) else 0 end))) over()::float as "salesTotal",
                                SUM(SUM("InvoiceLines"."discountTotal"::text::numeric)) over():: float as "discountTotal",
                                SUM(SUM("InvoiceLines"."taxTotal"::text::numeric)) over() :: float as "taxTotal",
                                SUM(SUM("InvoiceLines"."total"::text::numeric)) over():: float  as "totals",

                                "Invoices".id as "invoiceId",
                                "Invoices"."invoiceNumber", 
                                "Invoices"."refrenceNumber",
                                "Invoices"."invoiceDate",
                                ("InvoiceLines"."createdAt" + INTERVAL '${timeOffset} hours')::date as "salesDate",
                                SUM(COALESCE( "InvoiceLines"."total"::text::numeric,0)::text::numeric)  as "total",  
                                SUM(COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) as "tax",
                                SUM(COALESCE("InvoiceLines"."discountTotal"::text::numeric,0)::text::numeric)  "discount",
                                sum(COALESCE("InvoiceLines"."subTotal"::text::numeric,0) - (case when "InvoiceLines"."isInclusiveTax" = true then COALESCE("InvoiceLines"."taxTotal"::text::numeric,0) else 0 end) )  as "totalSales"
                                from "InvoiceLines"
								 	join "values" on true
                               		inner join "Invoices" ON "InvoiceLines" ."invoiceId" = "Invoices".id
									
									inner join  "Branches" ON "Invoices"."branchId" = "Branches".id
									where  "InvoiceLines"."companyId" = "values"."companyId" 
								  			and(array_length("values"."branches",1) IS NULL or  "InvoiceLines"."branchId" = Any("values"."branches"))
								  			and "InvoiceLines"."createdAt" >= "values"."fromDate" and "InvoiceLines"."createdAt" < "values"."toDate" 
                                            and  "Invoices"."status" <>'Draft' 
                                 	group by "Invoices".id, "salesDate"
                                 
                                ${orderByQuery}
       
                    `,
                values: [companyId, branches, from, to]
            }


            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`

            const records = await client.query(query.text + limitQuery, query.values)
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = {
                    sales: t.salesTotal, discount: t.discountTotal, tax: t.taxTotal,
                    totalSales: t.totals
                }
                resault = records.rows.map((e: any) => {
                    return {
                        invoiceId: e.invoiceId, invoiceDate: e.invoiceDate, salesDate: e.salesDate, invoiceNumber: e.invoiceNumber, referenceNumber: e.referenceNumber,
                        sales: e.totalSales, discount: e.discount, tax: e.tax, totalSales: e.total
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
                    title: "Sales By Invoice",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'salesDate', properties: { columnType: 'date' } }, { key: 'invoiceDate', properties: { columnType: 'date' } },
                { key: 'invoiceNumber' }, { key: 'referenceNumber' },
                { key: 'totalSales', header: 'Sales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'discount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'tax', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'total', properties: { hasTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'SalesByInvoice'
                await client.query("COMMIT")
                return new ResponseData(true, "", report)
            }

            await client.query("COMMIT")
            return new ResponseData(true, "", resData)
        } catch (error: any) {
          
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async salesByCreditNote(data: any, company: Company, brancheList: []) {
        const client = await DB.excu.client()
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;

             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let offset = limit * (page - 1);
            let total = {};
            let count = 0;
            let resault: any[] = [];

            //######################## set time ########################
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;
            await client.query("BEGIN")

            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(client, branchId)).data.closingTime ?? "05:00:00"
            }

            let timeOffset = company.timeOffset ?? 0
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to

            //######################## sort ########################

            let sortby = filter && filter.sortBy ? filter.sortBy : [];
            let sortList = sortby.filter((item: any) => item.sortValue && item.sortValue.trim() !== "");

            // if (sortList.length < 1) { sortList.push({ sortValue: "productName", sortDirection: 'asc' }) }

            let orderByQuery = "order by ";
            for (let i = 0; i < sortList.length; i++) {
                orderByQuery += `"${sortList[i].sortValue.trim()}" ${sortList[i].sortDirection ?? ""}`;
                orderByQuery += ", ";
            }
            orderByQuery += ` "creditNoteDate" `

            //######################################################

            const query: { text: string, values: any } = {
                text: `with "values" as (
                    select $1::uuid as "companyId",
                           $2::uuid[] as "branches",
                           $3::timestamp as "fromDate",
                           $4::timestamp as "toDate"
                    )
                    SELECT
                             count(*) over(),
                            SUM(SUM(T.sales::text::numeric)) over()::float as "salesTotal",
                            SUM(SUM("CreditNoteLines"."discountTotal"::text::numeric)) over():: float as "discountTotal",
                            SUM(SUM("CreditNoteLines"."taxTotal"::text::numeric)) over() :: float as "taxTotal",
                            SUM(SUM("CreditNoteLines"."total"::text::numeric)) over():: float  as "totals",

										"CreditNotes".id as "creditNoteId",
								  		"CreditNotes"."creditNoteNumber","Invoices"."invoiceNumber", 
										"CreditNotes"."refrenceNumber",
								  		"CreditNotes"."creditNoteDate",
                                        ("CreditNoteLines"."createdAt" + INTERVAL '${timeOffset} hours')::date as "salesDate",
										SUM(COALESCE( "CreditNoteLines"."total"::text::numeric,0)::text::numeric)  as "total",  
										SUM(COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)::text::numeric) as "tax",
										SUM(COALESCE("CreditNoteLines"."discountTotal"::text::numeric,0)::text::numeric)  "discount",
										sum(COALESCE("CreditNoteLines"."subTotal"::text::numeric,0) - (case when "CreditNoteLines"."isInclusiveTax" = true then COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0) else 0 end) )  as "totalSales"
                                	from "CreditNoteLines"
								 	join "values" on true
                               		inner join "CreditNotes" ON "CreditNoteLines" ."creditNoteId" = "CreditNotes".id
                                     inner join "Invoices" ON "CreditNotes" ."invoiceId" = "Invoices".id
									left join "Products" ON "CreditNoteLines"."productId" = "Products".id
									inner join  "Branches" ON "CreditNotes"."branchId" = "Branches".id
									where  "Branches"."companyId" = "values"."companyId" 
								  			and(array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
								  			and  "CreditNotes"."status" <>'Draft' 
								  			and "CreditNoteLines"."createdAt" >= "values"."fromDate" and "CreditNoteLines"."createdAt" < "values"."toDate" 
                                 	group by "CreditNotes".id, "Invoies"."invoiceNumber", "salesDate"
                                
                                ${orderByQuery}
       
                    `,
                values: [companyId, branches, from, to]
            }


            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`

            const records = await client.query(query.text + limitQuery, query.values)
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = {
                    sales: t.salesTotal, discount: t.discountTotal, tax: t.taxTotal,
                    totalSales: t.totals
                }
                resault = records.rows.map((e: any) => {
                    return {
                        creditNoteId: e.creditNoteId, creditNoteDate: e.creditNoteDate, salesDate: e.salesDate, creditNoteNumber: e.creditNoteNumber, referenceNumber: e.referenceNumber,
                        sales: e.sales, discount: e.discount, tax: e.tax, totalSales: e.totalSales
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
                    title: "Sales By CreditNote",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'salesDate', properties: { columnType: 'date' } }, { key: 'creditNoteDate', properties: { columnType: 'date' } },
                { key: 'creditNoteNumber' }, { key: 'referenceNumber' },
                { key: 'sales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'discount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'tax', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'totalSales', properties: { hasTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'SalesByCreditNote'
                await client.query("COMMIT")
                return new ResponseData(true, "", report)
            }

            await client.query("COMMIT")
            return new ResponseData(true, "", resData)
        } catch (error: any) {
          
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async aggregatorOrders(data: any, company: Company, brancheList: []) {

        try {

            let filter = data.filter;
            let companyId = company.id;
            let branches = filter && filter.branches ? filter.branches : brancheList;

            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? filter.fromDate : null;
            fromDate = moment(new Date(fromDate))
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------


             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);



            let offset = limit * (page - 1);

            let total = {};
            let count = 0;
            let resault: any[] = [];


            let query = {
                text: `WITH "values" AS (
                         SELECT  $1::uuid AS "companyId",
                                 $2::uuid[] AS "branches,
                                 $3::timestamp As "fromDate",
                                 $4::timestamp AS "toDate"
                         )	
                 
                        ,"invoiceData" as(
                        select  "Invoices"."aggregator", "Branches"."companyId",
                                count("Invoices".id) as "numberOfInvoices",
                                sum("Invoices".total::text::numeric) as  "totalInvoices",
                                0  AS "numberOfCreditNotes",
                                0 AS "totalCreditNotes"
                        from "Invoices" 
                        join "values" on true
                        inner join "Branches" on "Branches".id = "Invoices"."branchId"
                        where "Branches"."companyId" = "values"."companyId"  
                            and "Invoices"."status" <> 'Draft' 
                            and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                            and ("Invoices"."createdAt" >= "values"."fromDate" and "Invoices"."createdAt" < "values"."toDate"  )
                        group by  "Invoices"."aggregator", "Branches"."companyId"
                        )
						
						 ,"creditNoteData" as(
                        select  "Invoices"."aggregator", "Branches"."companyId",
                                0 as "numberOfInvoices",
                                0 as  "totalInvoices",
                                count("CreditNotes".id)  AS "numberOfCreditNotes",
                                sum("CreditNotes".total::text::numeric) AS "totalCreditNotes"
                        from "CreditNotes" 
                        join "values" on true
                        inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
						inner join "Invoices" on "CreditNotes"."invoiceId" = "Invoices".id
                        where "Branches"."companyId" = "values"."companyId"   
                            and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                            and ("CreditNotes"."createdAt" >= "values"."fromDate" and "CreditNotes"."createdAt" < "values"."toDate"  )
                        group by  "Invoices"."aggregator", "Branches"."companyId"
                        )
	
                        select  count(*) over(), 
                                SUM(SUM(COALESCE(T."numberOfInvoices",0)::text::numeric)) over()::float as "numberOfInvoicesT",
                                SUM(SUM(COALESCE(T."totalInvoices",0)::text::numeric)) over()::float  as "totalInvoicesT",
                                SUM(SUM(COALESCE(T."numberOfCreditNotes",0)::text::numeric)) over()::float  as "numberOfCreditNotesT",
                                SUM(SUM(COALESCE(T."totalCreditNotes",0)::text::numeric)) over()::float  as "totalCreditNotesT",
                               SUM( SUM(COALESCE(T."InvoicesTotal",0)::text::numeric - (COALESCE(T."totalCreditNotes",0)::text::numeric)) as "totals",

                                (case when "Plugins".id is not null then COALESCE(NULLIF("Plugins"."pluginName",''),'Plugin') else 'Others'end) as "aggregatorName",
                                "Plugins".id as "aggregatorId",  
                                SUM(COALESCE(T."numberOfInvoices",0)::text::numeric) as "numberOfInvoices",
                                SUM(COALESCE(T."totalInvoices",0)::text::numeric) as "totalInvoices",
                                SUM(COALESCE(T."numberOfCreditNotes",0)::text::numeric) as "numberOfCreditNotes",
                                SUM(COALESCE(T."totalCreditNotes",0)::text::numeric) as "totalCreditNotes",
                                SUM(COALESCE(T."totalInvoices",0)::text::numeric - (COALESCE(T."totalCreditNotes",0)::text::numeric)) as "total"
                        from(select * from "invoiceData" union all select * from "creditNoteData")T
                        left join "Plugins" ON "Plugins"."pluginName" = T."aggregator"  AND  "Plugins"."companyId" = T."companyId" 
                        group by "Plugins".id
                        order by "Plugins".id
                        limit ${limit}
                        offset ${offset}
                         `,
                values: [companyId, branches, from, to]
            }


            const records = await DB.excu.query(query.text, query.values);
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { numberOfInvoices: t.numberOfInvoicesT, totalInvoices: t.totalInvoicesT, numberOfCreditNotes: t.numberOfCreditNotesT, totalCreditNotes: t.totalCreditNotesT, total: t.totals }
                resault = records.rows.map((e: any) => {
                    return {
                        aggregatorName: e.aggregatorName, aggregatorId: e.aggregatorId, numberOfInvoices: e.numberOfInvoices, totalInvoices: e.totalInvoices,
                        numberOfCreditNotes: e.numberOfCreditNotes, totalCreditNotes: e.totalCreditNotes, total: e.total
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
          
            throw new Error(error.message)
        }
    }

    public static async aggregatorSubReport(data: any, company: Company, brancheList: []) {
        const client = await DB.excu.client()
        try {
            let filter = data.filter;
            let companyId = company.id;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let aggregatorName = filter.aggregatorName;

            //######################## set time ########################

            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;
            await client.query("BEGIN")

            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(client, branchId)).data.closingTime ?? "05:00:00"
            }

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to
            //#########################################################
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };

             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);



            let NoOfperiod = filter && filter.periodQty ? filter.periodQty : null;
            let period = filter && filter.period ? filter.period : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : 'none';
            let columns = ["Total"]
            let results: any = []
            let offset = limit * (page - 1);
            const query = {
                text: `
                     WITH "values" AS (
                         SELECT  $1::uuid AS "companyId",
                                  $2::uuid[] AS "branches",
	                              case when (lower($3::TEXT) ='period' and  lower($4::TEXT)  ='month') then $6::timestamp  - interval '1 month' *  $5::int 
                                       when (lower($3::TEXT) ='period' and  lower($4::TEXT)  ='year')  then $6::timestamp  - interval '1 year'  *  $5::int
                                       else    $6::timestamp 	END AS "fromDate",
           
                                    $7::timestamp AS "toDate",
	                               $8::text as "aggragtorName" 
                         )   ,"invoiceData" as(
                        select "Invoices".id, 
							    "Invoices"."invoiceNumber"  as "code",
                               "Invoices".total as  "totalInvoices",
							    sum(case when "InvoiceLines"."isInclusiveTax" = true then ((COALESCE("InvoiceLines"."subTotal",0)::text::numeric) - (COALESCE("InvoiceLines"."taxTotal",0)::text::numeric)) else COALESCE("InvoiceLines"."subTotal",0)::text::numeric end) as "invoiceSales",

							 null::numeric AS "totalCreditNotes",
							   null::numeric as "creditNoteSales",
                                 
							    'Invoice' as "type",
                                "Invoices"."aggregatorId"
                        from "InvoiceLines" 
                        join "values" on true
						inner join "Invoices" on "InvoiceLines"."invoiceId" = "Invoices".id
                        inner join "Branches" on "Branches".id = "Invoices"."branchId"
                        where "Branches"."companyId" = "values"."companyId"  
							and( ("values"."aggragtorName" ='Others' and  NULLIF("Invoices"."aggregator",'') is null ) or (trim(lower("Invoices"."aggregator")) = trim(lower("values"."aggragtorName"))))
                            and "Invoices"."status" <> 'Draft' 
                            and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                            and ("Invoices"."createdAt" >= "values"."fromDate" and "Invoices"."createdAt" < "values"."toDate"  )
                        group by  "Invoices"."aggregator", "Branches"."companyId" ,"Invoices".id
                        )
						
						 ,"creditNoteData" as(
                        select  "CreditNotes".id, 
							    "CreditNotes"."creditNoteNumber" as "code",
							    null::numeric as  "totalInvoices",
							 	null::numeric as "invoiceSales",
                               "CreditNotes".total * (-1) AS "totalCreditNotes",
							 	sum(case when "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE("CreditNoteLines"."subTotal",0)::text::numeric) - (COALESCE("CreditNoteLines"."taxTotal",0)::text::numeric)) else COALESCE("CreditNoteLines"."subTotal",0)::text::numeric end)*(-1) as "creditNoteSales",
                                'Credit Note' as "type",
                                null as "aggregatorId"
                        from "CreditNoteLines" 
                        join "values" on true
						inner join "CreditNotes" on "CreditNoteLines"."creditNoteId" = "CreditNotes".id
						inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
						inner join "Invoices" on "CreditNotes"."invoiceId" = "Invoices".id
                        where "Branches"."companyId" = "values"."companyId"   
							 and ( ("values"."aggragtorName" ='Others' and  NULLIF("Invoices"."aggregator",'') is null ) or (trim(lower("Invoices"."aggregator")) = trim(lower("values"."aggragtorName"))))
                            and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                            and ("CreditNotes"."createdAt" >= "values"."fromDate" and "CreditNotes"."createdAt" < "values"."toDate"  )
                        group by  "Invoices"."aggregator", "Branches"."companyId" , "CreditNotes".id

           
                        )
						
					 select  
                        COUNT(*) OVER() AS "count",
                        "code",
                        "type",
                        id,
                        "aggregatorId",
                        COALESCE("totalInvoices","totalCreditNotes") as "total",
                        COALESCE("invoiceSales","creditNoteSales") as "totalSales" ,
                        sum(COALESCE("totalInvoices","totalCreditNotes")) over() as "transactionTotal",
                        sum(COALESCE("invoiceSales","creditNoteSales")) over() as "salesTotal"
                        from(select * from "invoiceData" union all select * from "creditNoteData")T
                    
                    `,
                values: [companyId, branches, compareType, period, NoOfperiod, from, to, aggregatorName]
            }

            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`

            const records = await client.query(query.text + limitQuery, query.values);

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Sales By Aggregator",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches, compareType: compareType,
                    period: period, periodQty: NoOfperiod,
                    filterList: { aggregatorName: aggregatorName },
                    aggregatorName: aggregatorName
                }
                report.records = records.rows

                //get columns & subColumns

                report.columns = [{ key: 'code' }, { key: 'aggregatorId' },
                { key: 'type' },
                { key: 'totalSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'total', properties: { hasTotal: true, columnType: 'currency' } },
                ]

                report.fileName = 'SalesByAggregator'
                await client.query("COMMIT")
                return new ResponseData(true, "", report)

            }


            let count = records.rows && records.rows.length > 0 ? (<any>records.rows[0]).count : 0
            let totalSales = records.rows && records.rows.length > 0 ? (<any>records.rows[0]).salesTotal : 0
            let totalTransactions = records.rows && records.rows.length > 0 ? (<any>records.rows[0]).transactionTotal : 0
            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (records.rows.length < limit || page == pageCount) {
                lastIndex = count
            }



            let resData = {
                records: records.rows,
                count: count,
                totalSales: totalSales,
                total: totalTransactions,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }
            await client.query("COMMIT")
            return new ResponseData(true, "", resData)
        } catch (error: any) {
          
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async salesByServiceId(data: any, company: Company, brancheList: []) {
        const client = await DB.excu.client()
        try {
            let filter = data.filter;
            let companyId = company.id;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let serviceId = filter && filter.serviceId;
            let serviceName = await ServiceRepo.getServiceName(serviceId) ?? 'other'



            //######################## set time ########################

            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;
            await client.query("BEGIN")

            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(client, branchId)).data.closingTime ?? "05:00:00"
            }

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to
            //#########################################################
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };


             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);



            let NoOfperiod = filter && filter.periodQty ? filter.periodQty : null;
            let period = filter && filter.period ? filter.period : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : 'none';
            let columns = ["Total"]
            let count = 0
            let results: any = []
            let offset = limit * (page - 1);
            const query = {
                text: `
                     WITH "values" AS (
                         SELECT  $1::uuid AS "companyId",
                                  $2::uuid[] AS "branches",
	                              case when (lower($3::TEXT) ='period' and  lower($4::TEXT)  ='month') then $6::timestamp  - interval '1 month' *  $5::int 
                                       when (lower($3::TEXT) ='period' and  lower($4::TEXT)  ='year')  then $6::timestamp  - interval '1 year'  *  $5::int
                                       else    $6::timestamp 	END AS "fromDate",
           
                                    $7::timestamp AS "toDate",
	                               $8::uuid as "serviceId" 
                         )   ,"invoiceData" as(
                        select "Invoices".id, 
							    "Invoices"."invoiceNumber"  as "code",
                               "Invoices".total as  "totalInvoices",
							    sum(case when "InvoiceLines"."isInclusiveTax" = true then ((COALESCE("InvoiceLines"."subTotal",0)::text::numeric) - (COALESCE("InvoiceLines"."taxTotal",0)::text::numeric)) else COALESCE("InvoiceLines"."subTotal",0)::text::numeric end) as "invoiceSales",

							 null::numeric AS "totalCreditNotes",
							   null::numeric as "creditNoteSales",
                                 
							    'Invoice' as "type",
                                "Invoices"."serviceId"
                        from "InvoiceLines" 
                        join "values" on true
						inner join "Invoices" on "InvoiceLines"."invoiceId" = "Invoices".id
                        inner join "Branches" on "Branches".id = "Invoices"."branchId"
                        where "Branches"."companyId" = "values"."companyId"  
							and(( "Invoices". "serviceId" = "values"."serviceId") or("Invoices". "serviceId" is null and  "values"."serviceId" is null) )
                            and "Invoices"."status" <> 'Draft' 
                            and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                            and ("Invoices"."createdAt" >= "values"."fromDate" and "Invoices"."createdAt" < "values"."toDate"  )
                        group by  "Invoices"."serviceId", "Branches"."companyId" ,"Invoices".id
                        )
						
						 ,"creditNoteData" as(
                        select  "CreditNotes".id, 
							    "CreditNotes"."creditNoteNumber" as "code",
							    null::numeric as  "totalInvoices",
							 	null::numeric as "invoiceSales",
                               "CreditNotes".total * (-1) AS "totalCreditNotes",
							 	sum(case when "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE("CreditNoteLines"."subTotal",0)::text::numeric) - (COALESCE("CreditNoteLines"."taxTotal",0)::text::numeric)) else COALESCE("CreditNoteLines"."subTotal",0)::text::numeric end)*(-1) as "creditNoteSales",
                                'Credit Note' as "type",
                                "Invoices"."serviceId"::uuid as "serviceId"
                        from "CreditNoteLines" 
                        join "values" on true
						inner join "CreditNotes" on "CreditNoteLines"."creditNoteId" = "CreditNotes".id
						inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
						inner join "Invoices" on "CreditNotes"."invoiceId" = "Invoices".id
                        where "Branches"."companyId" = "values"."companyId"   
						and(( "Invoices". "serviceId" = "values"."serviceId") or("Invoices". "serviceId" is null and  "values"."serviceId" is null) )
                            and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                            and ("CreditNotes"."createdAt" >= "values"."fromDate" and "CreditNotes"."createdAt" < "values"."toDate"  )
                        group by  "Invoices"."serviceId", "Branches"."companyId" , "CreditNotes".id

           
                        )
						
					 select  
                        COUNT(*) OVER() AS "count",
                        "code",
                        "type",
                        id,
                        "serviceId",
                        COALESCE("totalInvoices","totalCreditNotes") as "total",
                        COALESCE("invoiceSales","creditNoteSales") as "totalSales" ,
                        sum(COALESCE("totalInvoices","totalCreditNotes")) over() as "transactionTotal",
                        sum(COALESCE("invoiceSales","creditNoteSales")) over() as "salesTotal"
                        from(select * from "invoiceData" union all select * from "creditNoteData")T
                    
                    `,
                values: [companyId, branches, compareType, period, NoOfperiod, from, to, serviceId]
            }



            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`

            const records = await client.query(query.text + limitQuery, query.values);

            let totalSales = 0
            let totalTransactions = 0

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                totalSales = Number(t.salesTotal)
                totalTransactions = Number(t.transactionTotal)
                results = records.rows.map(({ count, transactionTotal, salesTotal, ...rest }: any) => rest)
            }



            if (filter.export) {
                let report = new ReportData()


                report.filter = {
                    title: "Sales By Service",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches, compareType: compareType,
                    period: period, periodQty: NoOfperiod,
                    filterList: { serviceName: serviceName },
                    serviceName: serviceName
                }
                report.records = records.rows

                //get columns & subColumns

                report.columns = [{ key: 'code' },
                { key: 'type' },
                { key: 'totalSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'total', properties: { hasTotal: true, columnType: 'currency' } },
                ]

                report.fileName = 'SalesByService'
                await client.query("COMMIT")
                return new ResponseData(true, "", report)

            }

            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (records.rows.length < limit || page == pageCount) {
                lastIndex = count
            }



            let resData = {
                records: results,
                count: count,
                totalSales: totalSales,
                total: totalTransactions,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }
            await client.query("COMMIT")
            return new ResponseData(true, "", resData)
        } catch (error: any) {
          
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }



}