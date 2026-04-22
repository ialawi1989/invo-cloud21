import { DB } from "@src/dbconnection/dbconnection";
import { Company } from "@src/models/admin/company";
import { ResponseData } from "@src/models/ResponseData";
import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { loadSql } from "@src/repo/sql-loader";
import { ValidationException } from "@src/utilts/Exception";
import { TimeHelper } from "@src/utilts/timeHelper";
import moment from "moment";

export class ProductDashboardRepo {

    public static async productHistory(data: any, company: Company) {
        try {
            let prodcutId = data.prodcutId;
            let query = {
                text: `select "PurchaseOrders".id,
                              "PurchaseOrders"."purchaseNumber",
                              ("PurchaseOrders"."purchaseDate" + "PurchaseOrders"."createdAt"::time)  as "createdAt",
                              SUM("PurchaseOrderLines"."qty") AS "qty"
                              from "PurchaseOrderLines"
                        inner join "PurchaseOrders" on "PurchaseOrders".id = "PurchaseOrderLines"."purchaseOrderId"
                        inner join "Suppliers" on "Suppliers".id = "PurchaseOrders"."supplierId"
                        where "PurchaseOrderLines"."productId" = $1
                                group by "PurchaseOrders".id
                        order by ("PurchaseOrders"."purchaseDate" + "PurchaseOrders"."createdAt"::time) desc
                
                        limit 1 `,
                values: [prodcutId]
            }


            let LastPurchase = await DB.excu.query(query.text, query.values);


            query.text = `select "Billings".id,
                                 "Billings"."billingNumber",
                                 ("Billings"."billingDate" + "Billings"."createdAt"::time) as "createdAt",
                                 sum( "BillingLines"."qty") as "qty"
                                 from "BillingLines"
                            inner join "Billings" on "Billings".id = "BillingLines"."billingId"
                            where "BillingLines"."productId" = $1
                               group by "Billings".id
                            order by ("Billings"."billingDate" + "Billings"."createdAt"::time) desc
                         
                            limit 1  `,
                query.values = [prodcutId]



            let LastBill = await DB.excu.query(query.text, query.values);
            query.text = `      select "Invoices".id,
                                    "Invoices"."invoiceNumber",
                                       ("Invoices"."invoiceDate" + "Invoices"."createdAt"::time) as "createdAt",
                                     sum( "InvoiceLines"."qty") as "qty"
                                   
                                    from "InvoiceLines"
                            inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId"
                            where "InvoiceLines"."productId" = $1
                                    group by "Invoices".id
                            order by ("Invoices"."invoiceDate" + "Invoices"."createdAt"::time) desc
                    
                            limit 1 `,
                query.values = [prodcutId]



            let LastInvoice = await DB.excu.query(query.text, query.values);


            query.text = `SELECT "Products".name,
                               "Products"."barcode",
                               "Products"."createdAt",
                               "Brands".name as "brandName", 
                               "Categories"."name" as "categoryName" ,
                               "Departments".name as "departmentName" 
                               FROM "Products"
             left join "Brands" on "Brands".id = "Products"."brandid"
             left join "Categories" on "Categories".id = "Products"."categoryId"
             left join "Departments" on "Departments".id = "Categories"."departmentId"
             where "Products".id =$1
            `
            let productDetails = await DB.excu.query(query.text, query.values);


            let responseData = {
                productDetails: productDetails.rows && productDetails.rows.length > 0 ? productDetails.rows[0] : null,
                lastInvoice: LastInvoice.rows && LastInvoice.rows.length > 0 ? LastInvoice.rows[0] : null,
                lastBill: LastBill.rows && LastBill.rows.length > 0 ? LastBill.rows[0] : null,
                lastPurchase: LastPurchase.rows && LastPurchase.rows.length > 0 ? LastPurchase.rows[0] : null
            }
            return new ResponseData(true, "", responseData)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async salesByService(data: any, company: Company, branchList: any[]) {
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





            const prodcutId = data.prodcutId;
            if (prodcutId == null || prodcutId == "") {
                throw new ValidationException("Product Id Is Required")
            }
            const branches = data.branchId ? [data.branchId] : branchList;
            const query = {
                text: `with sales as (
                                select 
                                COALESCE("Services".name,'Others') as "serviceName", 
                                sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end)) as "sales" 

                                from "InvoiceLines"
                                inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId"
                                inner join "Products" on "Products".id = "InvoiceLines"."productId"
                                inner join "Branches" on "Branches".id = "Invoices"."branchId"
                                left join "Services" on "Services".id = "Invoices"."serviceId"
                                where "Branches"."companyId" = $1
                                AND ($2::UUID[] IS NULL OR "Branches".id = any($2))  
                                AND "Products".id = $3
                                AND "Invoices"."status" <>'Draft' 
                                AND  "InvoiceLines"."createdAt" >=$4 AND"InvoiceLines"."createdAt" <$5
                                          GROUP BY  "Services".id
                                union all 

                                select 
                                COALESCE("Services".name,'Others') as "serviceName", 
                                sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)::text::numeric) end)) * -1  as "sales" 

                                from "CreditNoteLines"
                                inner join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId"
                                inner join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId"
                                inner join "Products" on "Products".id = "CreditNoteLines"."productId"
                                inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
                                left join "Services" on "Services".id = "Invoices"."serviceId"
                                where "Branches"."companyId" = $1
                                AND ($2::UUID[] IS NULL OR "Branches".id = any($2))  
                                and "Products".id = $3

                                AND  "CreditNoteLines"."createdAt" >=$4 AND"CreditNoteLines"."createdAt" <$5
                                GROUP BY  "Services".id
                                )

                                select 
                                "serviceName", 
                                sum("sales"::text::numeric) as "totalSales"
                                from "sales" 
                                group by "serviceName"`,
                values: [companyId, branches, prodcutId, from, to]

            }

            const sales = await client.query(query.text, query.values)



            await client.query("COMMIT")

            return new ResponseData(true, "", sales.rows)
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async salesByTime(data: any, company: Company, branchList: any[]) {
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





            const prodcutId = data.prodcutId;
            if (prodcutId == null || prodcutId == "") {
                throw new ValidationException("Product Id Is Required")
            }
            const branches = data.branchId ? [data.branchId] : branchList;
            const query = {
                text: `SELECT to_char( generate_series * INTERVAL '1 HOUR','HH24:MI:SS') AS "hour",
                                           
                                                SUM(T.sales) as "totalSales"
                                            FROM  generate_series(0, 23, 1) left join (SELECT
                                        "InvoiceLines"."createdAt" ,
                           
                                        sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end))  as "sales"
                                    
                                    From "InvoiceLines"
                                    INNER JOIN "Invoices" on "Invoices".id =  "InvoiceLines"."invoiceId"
								    INNER JOIN "Products" ON "Products".id = "InvoiceLines"."productId"
                                    INNER JOIN "Branches" on "Branches".id =  "Invoices"."branchId"
                                    WHERE "Branches"."companyId"=$1 
									AND ($2::uuid[] is null or "Branches".id = any($2))												   
									AND "Invoices"."status" <>'Draft' and "InvoiceLines"."createdAt" >= $3 and "InvoiceLines"."createdAt" < $4
									AND "Products".id = $5 
                                          group by  "InvoiceLines"."createdAt"
							  UNION ALL SELECT
                                        "CreditNoteLines"."createdAt",
                             
                                        sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)) end))   as "sales"
                                From "CreditNoteLines"
                                INNER JOIN "CreditNotes" on "CreditNotes".id =  "CreditNoteLines"."creditNoteId"
                                INNER JOIN "Branches" on "Branches".id =  "CreditNotes"."branchId"
								INNER JOIN "Products" ON "Products".id = "CreditNoteLines"."productId"
                                WHERE "Branches"."companyId"=$1
								AND ($2::uuid[] is null or "Branches".id = any($2))		
								and "CreditNoteLines"."createdAt" >= $3 and "CreditNoteLines"."createdAt" < $4 
								and "Products".id= $5
                                 group by  "CreditNoteLines"."createdAt")T
                                ON  EXTRACT(HOUR FROM T."createdAt" + INTERVAL '3 hours' ) =  generate_series
                                GROUP BY generate_series
                                ORDER BY generate_series`,
                values: [companyId, branches, from, to, prodcutId]

            }

            const sales = await client.query(query.text, query.values)



            await client.query("COMMIT")

            return new ResponseData(true, "", sales.rows)
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async Last12MonthsSales(data: any, company: Company, branchList: any[]) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;


            // //-------------- set time --------------
            // let closingTime = "00:00:00"
            // let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            // fromDate = moment(new Date(fromDate))
            // let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            // let timeOffset = company.timeOffset
            // let applyOpeningHour = data.applyOpeningHour ?? false

            // if (applyOpeningHour == true) {
            //     let branchId = branchList[0]
            //     closingTime = (await BranchesRepo.getBranchClosingTime(client, branchId)).data.closingTime ?? "05:00:00"
            // }

            // let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            // let from = interval.from
            // let to = interval.to


            //---------------------------------------

            const prodcutId = data.prodcutId;
            if (prodcutId == null || prodcutId == "") {
                throw new ValidationException("Product Id Is Required")
            }
            const branches = data.branchId ? [data.branchId] : branchList;

            const query = {
                text: `with sales as (
                                select 
                                  DATE_TRUNC('month', "InvoiceLines"."createdAt") as "month", 
                                sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end)) as "sales" 

                                from "InvoiceLines"
                                inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId"
                                inner join "Products" on "Products".id = "InvoiceLines"."productId"
                                inner join "Branches" on "Branches".id = "Invoices"."branchId"
                                left join "Services" on "Services".id = "Invoices"."serviceId"
                                where "Branches"."companyId" = $1
                                AND ($2::UUID[] IS NULL OR "Branches".id = any($2))  
                                AND "Products".id = $3
                                AND "Invoices"."status" <>'Draft' 
                                AND  "InvoiceLines"."createdAt" >= NOW() - INTERVAL '12 months' and "InvoiceLines"."createdAt" <= NOW() 
	
	                            GROUP BY  "month"
                                    
                                union all 

                                select 
                                 DATE_TRUNC('month', "CreditNoteLines"."createdAt") as "month", 
                                sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)::text::numeric) end)) * -1  as "sales" 

                                from "CreditNoteLines"
                                inner join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId"
                                inner join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId"
                                inner join "Products" on "Products".id = "CreditNoteLines"."productId"
                                inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
                                left join "Services" on "Services".id = "Invoices"."serviceId"
                                where "Branches"."companyId" = $1
                                AND ($2::UUID[] IS NULL OR "Branches".id = any($2))  
                                and "Products".id = $3

                                AND  "CreditNoteLines"."createdAt" >= NOW() - INTERVAL '12 months' and "CreditNoteLines"."createdAt" <= NOW() 
                                GROUP BY  "month"
                                )

                                select 
                                "month", 
                                sum("sales"::text::numeric) as "totalSales"
                                from "sales" 
                                group by "month"`,
                values: [companyId, branches, prodcutId]
            }





            const sales = await client.query(query.text, query.values)



            await client.query("COMMIT")

            return new ResponseData(true, "", sales.rows)
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async wasteReport(data: any, company: Company, branchList: any[]) {
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





            const prodcutId = data.prodcutId;
            if (prodcutId == null || prodcutId == "") {
                throw new ValidationException("Product Id Is Required")
            }
            const branches = data.branchId ? [data.branchId] : branchList;
            const query = {
                text: `with "invoiceSale" as(

                                        select
                                            "Invoices".id as "invoiceId",
                                            "Invoices"."invoiceNumber",
                                            "InvoiceLines"."voidReason",
                                            "InvoiceLines"."createdAt",
                                            sum((el->>'qty')::numeric) "totalWasteQty",
                                            sum((el->>'cost')::numeric)"totalWasteCost"
                                            from "InvoiceLines" 
                                        inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" 
                                        inner join "Branches" on "Branches".id = "Invoices"."branchId"
                                        inner join JSONB_ARRAY_ELEMENTS("recipe") el on true 
                                        inner join "Products" on "Products".id = (el->>'productId')::uuid 
                                        where "Products".id = $1
                                        and "Branches"."companyId" = $2
                                        AND ($3::UUID[] IS NULL OR "Branches".id = any($3)) AND 	
                                        AND  "InvoiceLines"."createdAt" >=$4 AND"InvoiceLines"."createdAt" <$5
                                        and "InvoiceLines"."waste" = true
                                        group by "InvoiceLines".id	, "Invoices".id 
                                        UNION ALL 

                                        select
                                            "Invoices".id as "invoiceId",
                                            "Invoices"."invoiceNumber",
                                            "InvoiceLines"."voidReason",
                                            "InvoiceLines"."createdAt",
                                            sum((el->>'qty')::numeric) "totalWasteQty",
                                            sum((el->>'cost')::numeric)"totalWasteCost"
                                            from "InvoiceLines" 
                                        inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" 
                                        inner join "InvoiceLineOptions" on "InvoiceLineOptions"."invoiceLineId" = "InvoiceLines".id
                                        inner join "Branches" on "Branches".id = "Invoices"."branchId"
                                        inner join JSONB_ARRAY_ELEMENTS("InvoiceLineOptions"."recipe") el on true 
                                        inner join "Products" on "Products".id = (el->>'productId')::uuid 
                                        where "Products".id = $1
                                        and "Branches"."companyId" = $2
                                        AND ($3::UUID[] IS NULL OR "Branches".id = any($3)) AND 	
                                        AND  "InvoiceLines"."createdAt" >=$4 AND"InvoiceLines"."createdAt" <$5
                                        and "InvoiceLines"."waste" = true
                                        group by "InvoiceLines".id	, "Invoices".id 
                                        )

                                        select * from "invoiceSale"`,
                values: [prodcutId, companyId, branches, from, to]

            }

            const sales = await client.query(query.text, query.values)



            await client.query("COMMIT")

            return new ResponseData(true, "", sales.rows)
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async returns(data: any, company: Company, branchList: any[]) {
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





            const prodcutId = data.prodcutId;
            if (prodcutId == null || prodcutId == "") {
                throw new ValidationException("Product Id Is Required")
            }
            const branches = data.branchId ? [data.branchId] : branchList;
            const query = {
                text: `with "invoiceSale" as(

                                        select
                                            "Invoices".id as "invoiceId",
                                            "Invoices"."invoiceNumber",
                                            "InvoiceLines"."voidReason",
                                            "InvoiceLines"."createdAt",
                                            sum((el->>'qty')::numeric) "totalWasteQty",
                                            sum((el->>'cost')::numeric)"totalWasteCost"
                                            from "InvoiceLines" 
                                        inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" 
                                        inner join "Branches" on "Branches".id = "Invoices"."branchId"
                                        inner join JSONB_ARRAY_ELEMENTS("recipe") el on true 
                                        inner join "Products" on "Products".id = (el->>'productId')::uuid 
                                        where "Products".id = $1
                                        and "Branches"."companyId" = $2
                                        AND ($3::UUID[] IS NULL OR "Branches".id = any($3)) AND 	
                                        AND  "InvoiceLines"."createdAt" >=$4 AND"InvoiceLines"."createdAt" <$5
                                        and "InvoiceLines"."waste" = true
                                        group by "InvoiceLines".id	, "Invoices".id 
                                        UNION ALL 

                                        select
                                            "Invoices".id as "invoiceId",
                                            "Invoices"."invoiceNumber",
                                            "InvoiceLines"."voidReason",
                                            "InvoiceLines"."createdAt",
                                            sum((el->>'qty')::numeric) "totalWasteQty",
                                            sum((el->>'cost')::numeric)"totalWasteCost"
                                            from "InvoiceLines" 
                                        inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" 
                                        inner join "InvoiceLineOptions" on "InvoiceLineOptions"."invoiceLineId" = "InvoiceLines".id
                                        inner join "Branches" on "Branches".id = "Invoices"."branchId"
                                        inner join JSONB_ARRAY_ELEMENTS("InvoiceLineOptions"."recipe") el on true 
                                        inner join "Products" on "Products".id = (el->>'productId')::uuid 
                                        where "Products".id = $1
                                        and "Branches"."companyId" = $2
                                        AND ($3::UUID[] IS NULL OR "Branches".id = any($3)) AND 	
                                        AND  "InvoiceLines"."createdAt" >=$4 AND"InvoiceLines"."createdAt" <$5
                                        and "InvoiceLines"."waste" = true
                                        group by "InvoiceLines".id	, "Invoices".id 
                                        )

                                        select * from "invoiceSale"`,
                values: [prodcutId, companyId, branches, from, to]

            }

            const sales = await client.query(query.text, query.values)



            await client.query("COMMIT")

            return new ResponseData(true, "", sales.rows)
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async salesBySource(data: any, company: Company, branchList: any[]) {
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





            const prodcutId = data.prodcutId;
            if (prodcutId == null || prodcutId == "") {
                throw new ValidationException("Product Id Is Required")
            }
            const branches = data.branchId ? [data.branchId] : branchList;
            const query = {
                text: `with sales as (
                                select 
                                "Invoices"."source", 
                                sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end)) as "sales" 

                                from "InvoiceLines"
                                inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId"
                                inner join "Products" on "Products".id = "InvoiceLines"."productId"
                                inner join "Branches" on "Branches".id = "Invoices"."branchId"
                                where "Branches"."companyId" = $1
                                AND ($2::UUID[] IS NULL OR "Branches".id = any($2)) AND 
                                AND "Products".id = $3
                                AND "Invoices"."status" <>'Draft' 
                                AND  "InvoiceLines"."createdAt" >=$4 AND"InvoiceLines"."createdAt" <$5
                                    group by   "Invoices".id 
                                union all 

                                select 
                                
                                        "Invoices"."source", 
                                sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)::text::numeric) end)) * -1  as "sales" 

                                from "CreditNoteLines"
                                inner join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId"
                                inner join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId"
                                inner join "Products" on "Products".id = "CreditNoteLines"."productId"
                                inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
                                where "Branches"."companyId" = $1
                                AND ($2::UUID[] IS NULL OR "Branches".id = any($2)) AND 
                                and "Products".id = $3

                                AND  "CreditNoteLines"."createdAt" >=$4 AND"CreditNoteLines"."createdAt" <$5
                                      group by   "Invoices".id
                                )

                                select 
                                "source", 
                                sum("sales"::text::numeric) as "totalSales"
                                from "sales" 
                                group by "source"`,
                values: [companyId, branches, prodcutId, from, to]

            }

            const sales = await client.query(query.text, query.values)



            await client.query("COMMIT")

            return new ResponseData(true, "", sales.rows)
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async getProductDetails(productId: string, company: Company) {
        try {
            const text = await loadSql("product/product_details.sql");
            const values = [productId, company.id];
            const result = await DB.excu.query(text, values);
            if (result.rowCount === 0) {
                return new ResponseData(false, "Product not found", null);
            }
            return new ResponseData(true, "Product details retrieved successfully", result.rows[0]);
        }
        catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getProductStats(productId: string, company: Company) {
        try {
            const text = await loadSql("product/product_stats.sql");
            const values = [productId, company.id];
            const result = await DB.excu.query(text, values);
            if (result.rowCount === 0) {
                return new ResponseData(false, "No product stats found", []);
            }
            return new ResponseData(true, "Product stats retrieved successfully", result.rows);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getProductActivity(productId: string, company: Company) {
        try {
            const text = await loadSql("product/product_activity.sql");
            const values = [productId, company.id];
            const result = await DB.excu.query(text, values);
            if (result.rowCount === 0) {
                return new ResponseData(false, "No product activity found", []);
            }
            return new ResponseData(true, "Product activity retrieved successfully", result.rows);
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getProductSalesByService(productId: string, company: Company) {
        try {
            const text = await loadSql("product/product_sales_by_service.sql");
            const values = [productId, company.id];

            const result = await DB.excu.query(text, values);
            if (result.rowCount === 0) {
                return new ResponseData(false, "No sales found for this product", []);
            }
            return new ResponseData(true, "Product sales by service retrieved successfully", result.rows);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getProductSalesByDay(productId: string, company: Company) {
        try {
            const text = await loadSql("product/product_sales_by_day.sql");
            const values = [productId, company.id];

            const result = await DB.excu.query(text, values);
            if (result.rowCount === 0) {
                return new ResponseData(false, "No sales found for this product", []);
            }
            return new ResponseData(true, "Product sales by day retrieved successfully", result.rows);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getProductSales(productId: string, company: Company, branch: string | null, page: number = 1, limit: number = 10) {
        try {
            const text = await loadSql("product/product_transactions.sql");
            const offset = (limit * (page - 1));
            const values = [productId, company.id, limit, offset];
            const result = await DB.excu.query(text, values);
            if (result.rowCount === 0) {
                return new ResponseData(false, "No sales found for this product", []);
            }
            //remove has_next from the result
            const hasNext = result.rows[0].has_next;
            result.rows = result.rows.map(row => { 
                const { has_next, ...rest } = row;
                return rest;
            });
            //add has_next to the response
            return new ResponseData(true, "Product sales retrieved successfully", { list: result.rows , has_next: hasNext});
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getProductLast12MonthSales(productId: string, company: Company) {
        try {
            const text = await loadSql("product/product_sales_last_12_month.sql");
            const values = [productId, company.id];
            const result = await DB.excu.query(text, values);
            if (result.rowCount === 0) {
                return new ResponseData(false, "No sales found for this product", []);
            }
            return new ResponseData(true, "Product sales retrieved successfully", result.rows);
        } catch (error: any) {
            throw new Error(error)
        }
    }
}