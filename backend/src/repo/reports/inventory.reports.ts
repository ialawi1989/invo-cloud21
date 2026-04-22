import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Company } from "@src/models/admin/company";
import { TimeHelper } from "@src/utilts/timeHelper";
import moment from 'moment'

import { ValidationException } from "@src/utilts/Exception";
import { ReportData } from "@src/utilts/xlsxGenerator";
import { BranchesRepo } from "../admin/branches.repo";

export class InvenoryReports {

    // public static async productMovment(data: any, company: Company) {
    //     try {
    //         const companyId = company.id;
    //         const afterDecimal = company.afterDecimal;
    //         let from = data.interval.from;
    //         from = await TimeHelper.resetHours(from)
    //         let to =  moment(data.interval.to).add(1, 'day').format("YYYY-MM-DD 00:00:00");

    //         const branchId = data.branchId;
    //         const productId = data.productId
    //         const filterId = (branchId != null && branchId != "") ? branchId : companyId;
    //         let filter = ` WHERE `
    //         filter += (branchId != null && branchId != "") ? ` "Branches".id=$1` : ` "Branches"."companyId"=$1`
    //         filter += ` AND "Products".id =$2`
    //         filter += `   AND   "movment"."createdAt" >$3 AND "movment"."createdAt" <$4 `

    //         let query =`select 
    //                         "movment"."createdAt",
    //                         "Products"."name",
    //                         "Products"."UOM",
    //                         "movment".qty as "qtyUsage",
    //                         sum("movment".qty::text::numeric) OVER (order by   "movment"."createdAt" asc ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)    as "qtyBalance",
    //                         "movment"."referenceId" as "transactionId",
    //                         "movment"."refrenceTable" as type,
    //                         "Branches".name As "branchName"
    //                     from "InventoryMovmentRecords" as "movment"
    //                     INNER JOIN "Products" on "movment"."productId" = "Products".id
    //                     INNER JOIN "Branches" on "movment"."branchId" = "Branches".id
    //                     left join "InvoiceLines" on "movment"."referenceId" =  "InvoiceLines".id 
    //                     left join "Invoices" on "movment"."referenceId"= "Invoices".id  AND "Invoices"."status" <>'Draft'
    //                     left join "CreditNoteLines" on "CreditNoteLines".id = "movment"."referenceId"
    //                     left join "CreditNotes" on "movment"."referenceId" = "CreditNotes".id
    //                     left join "PhysicalCountLines" on "PhysicalCountLines".id = "movment"."referenceId"
    //                     left join "PhysicalCounts" on "movment"."referenceId"= "PhysicalCounts".id
    //                     left join "InventoryTransferLines" on "InventoryTransferLines".id = "movment"."referenceId"
    //                     left join "InventoryTransfers" on "movment"."referenceId" = "InventoryTransfers".id
    //                     left join "SupplierCreditLines" on "SupplierCreditLines".id = "movment"."referenceId"
    //                     left join "SupplierCredits" on "movment"."referenceId"= "SupplierCredits".id`;
    //         query+=filter + ' GROUP BY  "movment"."createdAt", "Products".id,   "movment".qty,  "movment"."referenceId","movment"."refrenceTable","Branches".id  '

    //         let values = [filterId,productId,from,to];


    //         let reports = await DB.excu.query(query,values)
    //         return new ResponseData(true,"",reports.rows)
    //     } catch (error: any) {
    //       
    //         throw new Error(error)
    //     }
    // }



    public static async productMovment(data: any, company: Company, brancheList: []) {
        try {
            const companyId = company.id;

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
            const productId = data.productId
            const query = {
                text: `WITH "openingBalance" as (
                    select 
                                                "Products"."createdAt",
                                                "Products"."name",
                                                       "Products"."barcode",
                                                sum("movment".qty::text::numeric) as "qtyUsage",
                                                 null::uuid as "transactionId",
                                                'as of ' || $4::date  as type,
                                                case when  $2::uuid[] is null then null else "Branches".name end As "branchName"
                                            from "InventoryMovmentRecords" as "movment"
                                            inner join "Products" on "Products".id = "movment"."productId"
                                            left join "Branches" on "Branches".id = "movment"."branchId"
                                            where "companyId" = $3
                                            and "movment"."productId" = $1
                                            and "movment"."createdAt" < $4
                                            and ($2::uuid[] is null or  "movment"."branchId" = any($2))
                                            group by "Products".id ,"branchName",    "Products"."barcode"
                    ), "productMovment" as (
                    select 
                                                "movment"."createdAt",
                                                "Products"."name",
                                                      "Products"."barcode",
                                                "movment".qty::text::numeric as "qtyUsage",
                                                COALESCE( "InvoiceLines"."invoiceId",  "CreditNoteLines"."creditNoteId", 
                                 "PhysicalCountLines"."physicalCountId",  "InventoryTransferLines"."inventoryTransferId",
                                 "SupplierCreditLines"."supplierCreditId","BillingLines"."billingId" , "movment"."referenceId" ) as "transactionId",
                                                "movment"."referenceTable" as type,
                                                case when  $2::uuid[] is null then null else "Branches".name end As "branchName"
                                            from "InventoryMovmentRecords" as "movment"
                                            INNER JOIN "Products" on "movment"."productId" = "Products".id
                                            INNER JOIN "Branches" on "movment"."branchId" = "Branches".id
                                            left join "InvoiceLines" on "movment"."referenceId" =  "InvoiceLines".id 
                                            left join "BillingLines" on "movment"."referenceId" =  "BillingLines".id
                                            left join "Invoices" on "movment"."referenceId"= "Invoices".id  AND "Invoices"."status" <>'Draft'
                                            left join "CreditNoteLines" on "CreditNoteLines".id = "movment"."referenceId"
                                            left join "CreditNotes" on "movment"."referenceId" = "CreditNotes".id
                                            left join "PhysicalCountLines" on "PhysicalCountLines".id = "movment"."referenceId"
                                            left join "PhysicalCounts" on "movment"."referenceId"= "PhysicalCounts".id
                                            left join "InventoryTransferLines" on "InventoryTransferLines".id = "movment"."referenceId"
                                            left join "InventoryTransfers" on "movment"."referenceId" = "InventoryTransfers".id
                                            left join "SupplierCreditLines" on "SupplierCreditLines".id = "movment"."referenceId"
                                            left join "SupplierCredits" on "movment"."referenceId"= "SupplierCredits".id
                                             WHERE "Branches"."companyId" = $3
                                            and ($2::uuid[] is null or  "movment"."branchId" = any($2::uuid[]))
                                            AND   "movment"."createdAt" >=$4 AND "movment"."createdAt" <$5 
                                            and "movment"."productId" = $1
                                            group by "branchName" , "movment"."createdAt",   "Products"."name" , "movment".qty, "transactionId" , "movment"."referenceTable",    "Products"."barcode"
                    union 
                    select * from "openingBalance"
                    )
                    
                    select  "productMovment"."name",
                           "productMovment"."createdAt",
                           "productMovment"."qtyUsage" as "qtyUsage",
                           sum("productMovment"."qtyUsage"::text::numeric) OVER (order by   "productMovment"."createdAt" asc ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)    as "qtyBalance",
                           "productMovment"."transactionId",
                           "productMovment".type,
                           "productMovment"."branchName",
                                     "productMovment"."barcode"
                    from "productMovment"
                    order by "createdAt" asc`
            }
            let reports = await DB.excu.query(query.text, [productId, branches, companyId, from, to])
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          
            throw new Error(error)
        }
    }


    // public static async generalInventoryReport(data: any, company: Company) {
    //     try {

    //         const companyId = company.id;
    //         const afterDecimal = company.afterDecimal;
    //         let from = data.interval.from;
    //         from = await TimeHelper.resetHours(from)
    //         let to =  moment(data.interval.to).add(1, 'day').format("YYYY-MM-DD 00:00:00");

    //         const branchId = data.branchId;
    //         const filterId = (branchId != null && branchId != "") ? branchId : companyId;
    //         let filter = ` WHERE `
    //         filter += (branchId != null && branchId != "") ? ` "Branches".id=$1` : ` "Branches"."companyId"=$1`
    //         let beginningQtyFilter = filter + ` AND "InventoryMovmentRecords"."createdAt" <=$2 `
    //         filter += ` AND   "InventoryMovmentRecords"."createdAt" >=$2 AND "InventoryMovmentRecords"."createdAt" <$3 `

    //         let BeginningInventory = `with "BeginningInventory" as (
    //                                         select 
    //                                             distinct on ("Products".id)
    //                                         "Products".id AS "productId",
    //                                         "InventoryMovmentRecords".id as "inventoryMovmentId",
    //                                         "Categories".name as "categoryName",
    //                                         "Products".name as "productName",
    //                                         "Products"."UOM",
    //                                         "InventoryMovmentRecords"."qty" AS "beginningQty",
    //                                         "InventoryMovmentRecords"."cost" AS "beginningAmount",
    //                                         "InventoryMovmentRecords"."createdAt"
    //                                         from "InventoryMovmentRecords"
    //                                         INNER JOIN "Products" ON "InventoryMovmentRecords"."productId" = "Products".id
    //                                         INNER JOIN "Branches" ON "InventoryMovmentRecords"."branchId" = "Branches".id
    //                                         LEFT JOIN "Categories" ON "Categories".id = "Products"."categoryId"
    //                                         `
    //         BeginningInventory += beginningQtyFilter + ` order by "Products".id, "InventoryMovmentRecords"."createdAt" asc`
    //         let ReceivingInventory = `), "ReceivingInventory" as (
    //                                         select 
    //                                         "Products".id as "productId",
    //                                         "Categories".name  as "categoryName",
    //                                         "Products".name as "productName",
    //                                         "Products"."UOM",
    //                                         sum ("InventoryMovmentRecords".qty) as "receivingQty",
    //                                         sum ("InventoryMovmentRecords".cost)"receivingCost"
    //                                         from "InventoryMovmentRecords"
    //                                         INNER JOIN "Products" ON "InventoryMovmentRecords"."productId" = "Products".id
    //                                         INNER JOIN "Branches" ON "InventoryMovmentRecords"."branchId" = "Branches".id
    //                                         LEFT JOIN "BeginningInventory" ON "InventoryMovmentRecords".id = "BeginningInventory"."inventoryMovmentId" 
    //                                         LEFT JOIN "Categories" ON "Categories".id = "Products"."categoryId"`
    //         ReceivingInventory += filter + ` AND "InventoryMovmentRecords".cost>0 ` + ` AND "BeginningInventory"."inventoryMovmentId" is null ` + ' group by "Products".id,"Categories".id'

    //         let UsageInventory = `),"UsageInventory" as(
    //                                         select 
    //                                         "Products".id as "productId",
    //                                         "Categories".name  as "categoryName",
    //                                         "Products".name as "productName",
    //                                         "Products"."UOM",
    //                                         sum (ABS("InventoryMovmentRecords".qty)) as "usageQty",
    //                                         sum (ABS("InventoryMovmentRecords".cost)) as "usageCost"
    //                                         from "InventoryMovmentRecords"
    //                                         INNER JOIN "Products" ON "InventoryMovmentRecords"."productId" = "Products".id
    //                                         INNER JOIN "Branches" ON "InventoryMovmentRecords"."branchId" = "Branches".id
    //                                         LEFT JOIN "BeginningInventory" ON "InventoryMovmentRecords".id = "BeginningInventory"."inventoryMovmentId" 
    //                                         LEFT JOIN "Categories" ON "Categories".id = "Products"."categoryId"`
    //         UsageInventory += filter + ` AND "InventoryMovmentRecords".cost<0 `+ ` AND "BeginningInventory"."inventoryMovmentId" is null `  + ` group by "Products".id,"Categories".id`



    //         let InventoryMovments = `), "InventoryMovments" as (
    //                                         SELECT
    //                                         DISTINCT "Products".id AS "productId"
    //                                         from "InventoryMovmentRecords"
    //                                         INNER JOIN "Products" ON "InventoryMovmentRecords"."productId" = "Products".id
    //                                         INNER JOIN "Branches" ON "InventoryMovmentRecords"."branchId" = "Branches".id
    //                                         LEFT JOIN "Categories" ON "Categories".id = "Products"."categoryId"`

    //         InventoryMovments += filter + ')'

    //         let selectQuery = `select
    //         COALESCE("BeginningInventory"."productId", "ReceivingInventory"."productId", "UsageInventory"."productId","Products".id)  as "productId", 
    //         COALESCE("BeginningInventory"."categoryName","ReceivingInventory"."categoryName","UsageInventory"."categoryName") as "categoryName",
    //         COALESCE("BeginningInventory"."productName","ReceivingInventory"."productName","UsageInventory"."productName","Products".name) as "productName",
    //                             CAST(ROUND( COALESCE("BeginningInventory"."beginningQty",0)::NUMERIC,$4::INT) AS REAL ) AS "beginningQty", 
    //                             CAST(ROUND(COALESCE("BeginningInventory"."beginningAmount",0)::NUMERIC,$4::INT) AS REAL ) AS "beginningAmount",
    //                             CAST(ROUND( COALESCE("ReceivingInventory"."receivingQty",0)::NUMERIC,$4::INT) AS REAL ) AS "receivingQty", 
    //                             CAST(ROUND(COALESCE("ReceivingInventory"."receivingCost",0)::NUMERIC,$4::INT) AS REAL ) AS "receivingCost",
    //                             CAST(ROUND(COALESCE("UsageInventory"."usageQty",0)::NUMERIC,$4::INT) AS REAL ) AS "usageQty",
    //                             CAST(ROUND(COALESCE("UsageInventory"."usageCost",0)::NUMERIC,$4::INT) AS REAL ) AS "usageCost",
    //                             CAST(ROUND( COALESCE("BeginningInventory"."beginningQty",0)::NUMERIC,$4::INT) AS REAL )  +  CAST(ROUND( COALESCE("ReceivingInventory"."receivingQty",0)::NUMERIC,3::INT) AS REAL ) + CAST(ROUND(COALESCE("UsageInventory"."usageQty",0)::NUMERIC,3::INT) AS REAL ) AS "endingQty",
    //                             CAST(ROUND(COALESCE("BeginningInventory"."beginningAmount",0)::NUMERIC,$4::INT) AS REAL ) + CAST(ROUND(COALESCE("ReceivingInventory"."receivingCost",0)::NUMERIC,3::INT) AS REAL ) + CAST(ROUND(COALESCE("UsageInventory"."usageCost",0)::NUMERIC,3::INT) AS REAL ) AS "endingAmount"
    //         from "InventoryMovments"    
    //         inner join "Products" on "InventoryMovments"."productId" =     "Products".id
    //         LEFT JOIN "BeginningInventory" ON "BeginningInventory"."productId" = "InventoryMovments"."productId"   
    //         left join "ReceivingInventory" on "ReceivingInventory"."productId" = "InventoryMovments"."productId"   
    //         left join "UsageInventory" on "UsageInventory"."productId" = "InventoryMovments"."productId"

    //                             `

    //         let query = BeginningInventory + ReceivingInventory + UsageInventory  + InventoryMovments + selectQuery;
    //         let values = [filterId, from, to, afterDecimal]

    //         let reports = await DB.excu.query(query, values);
    //         return new ResponseData(true, "", reports.rows)
    //     } catch (error: any) {
    //       

    //         throw new Error(error)
    //     }
    // }




    public static async generalInventoryReport(data: any, company: Company, branchList: []) {
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
            const branchId = data.branchId ? [data.branchId] : branchList
            const query = {
                text: `with "values" as (
                    select $1::uuid as "companyId",
                           $2::uuid[] as "branchId",
                           $3::timestamp as "fromDate",
                           $4::timestamp as "toDate"
                    ), 
                    
                    "start" as (
                    
                    select  distinct on ("Products".id)
                            "Products".id AS "productId",
                            SUM(qty::text::numeric) as "qty" ,
                            SUM( (cost::text::numeric) ) as "cost",
                     "Products"."barcode"
                    from "InventoryMovmentRecords"
                    JOIN "values" on true 
                    INNER JOIN "Products" on "Products".id = "InventoryMovmentRecords"."productId" 
                    LEFT JOIN "Branches" on "Branches".id = "InventoryMovmentRecords"."branchId"
                    WHERE "Products"."companyId" = "values"."companyId" 
                         and "Products"."type" = any(array ['kit','inventory','batch','serialized'])
                    AND ("values"."branchId" is null or "Branches".id = any("values"."branchId"))
                    AND "InventoryMovmentRecords"."createdAt"  < "values"."fromDate" 
                    group by "Products".id
                    ), "inQty" as(
                    
                    select  "Products".id as "productId",
                            sum("InventoryMovmentRecords".qty::text::numeric) as "qty", 
                            sum("InventoryMovmentRecords".cost::text::numeric) as "cost",
                               "Products"."barcode"
                    from "InventoryMovmentRecords"
                    JOIN "values" on true 
                    INNER JOIN "Products" on "Products".id = "InventoryMovmentRecords"."productId" 
                    INNER JOIN "Branches" on "Branches".id = "InventoryMovmentRecords"."branchId"
                    WHERE "Products"."companyId" = "values"."companyId" 
                      and "Products"."type" = any(array ['kit','inventory','batch','serialized'])
                    and ("values"."branchId" is null or "Branches".id = any("values"."branchId"))
                    and ("values"."fromDate" is null and "values"."toDate" is null or "InventoryMovmentRecords"."createdAt" >= "values"."fromDate" and "InventoryMovmentRecords"."createdAt" < "values"."toDate" )
                    and  "InventoryMovmentRecords".qty > 0 
                    group by  "Products".id,"InventoryMovmentRecords"."createdAt"
                    order by "InventoryMovmentRecords"."createdAt" asc
                    
                    ), "outQty" as(
                    
                    select  "Products".id as "productId",
                            sum("InventoryMovmentRecords".qty::text::numeric) as "qty" ,
                            sum("InventoryMovmentRecords".cost::text::numeric) as "cost" ,
                               "Products"."barcode"
                    from "InventoryMovmentRecords"
                    JOIN "values" on true 
                    INNER JOIN "Products" on "Products".id = "InventoryMovmentRecords"."productId" 
                    INNER JOIN "Branches" on "Branches".id = "InventoryMovmentRecords"."branchId"
                    WHERE "Products"."companyId" = "values"."companyId" 
                      and "Products"."type" = any(array ['kit','inventory','batch','serialized'])
                    and ("values"."branchId" is null or "Branches".id = any("values"."branchId"))
                    and ("values"."fromDate" is null and "values"."toDate" is null or "InventoryMovmentRecords"."createdAt" >= "values"."fromDate" and "InventoryMovmentRecords"."createdAt" < "values"."toDate" )
                    and  "InventoryMovmentRecords".qty< 0 
                    group by  "Products".id,"InventoryMovmentRecords"."createdAt"
                    order by "InventoryMovmentRecords"."createdAt" asc
                    
                    ), "inTotal" as (
                    select "inQty"."productId",
                           sum("inQty"."qty") as "totalQty",
                           sum("inQty"."cost") as "totalCost"
                           from "inQty"
                        group by"inQty"."productId"
                    ),"outTotal" as (
                    select "outQty"."productId",
                           sum("outQty"."qty") as "totalQty",
                           sum("outQty"."cost") as "totalCost"
                           from "outQty"
                        group by"outQty"."productId"
                    )
                    
                    select 
                    "Products".id as "productId",
                    "Products".name as "productName",
                    "Categories".name  as "categoryName",
                    "Departments".name as "departmentName",
                       "Products"."barcode",
                      COALESCE("start"."qty",0) as "beginningQty",
                      COALESCE("start"."cost",0) as "beginningAmount",
                      COALESCE("inTotal"."totalQty",0) as "receivingQty",
                      COALESCE("inTotal"."totalCost",0) as "receivingCost",
                      COALESCE("outTotal"."totalQty",0) as "usageQty",
                      COALESCE("outTotal"."totalCost",0) as "usageCost",
                        COALESCE("start"."qty",0)  +   COALESCE("inTotal"."totalQty",0) +  COALESCE("outTotal"."totalQty",0) as "endingQty",
                        COALESCE("start"."cost",0)  +   COALESCE("inTotal"."totalCost",0) +  COALESCE("outTotal"."totalCost",0) as "endingAmount"
                        
                    from "Products"
                    join "values" on "Products"."companyId" = "values"."companyId"
                    left JOIN "start" ON "start"."productId" = "Products".id
                    left join "Categories" on "Categories".id =  "Products"."categoryId"
                    left join "Departments" on "Departments".id = "Categories"."departmentId" 
                    LEFT JOIN "inTotal" ON "inTotal"."productId" = "Products".id
                    LEFT JOIN "outTotal" ON "outTotal"."productId" = "Products".id
                    
                                    where ( "Products"."isDeleted" = false or ("Products"."isDeleted" = true and COALESCE("start"."cost",0)  +   COALESCE("inTotal"."totalCost",0) +  COALESCE("outTotal"."totalCost",0) <>0)  )
                                      and "Products"."type" = any(array ['kit','inventory','batch','serialized'])`,
                values: [companyId, branchId, from, to]
            }

            let reports = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }


    public static async salesVsInventoryUsage(data: any, company: Company, brancheList: []) {
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
                        t.date,
                        SUM(COALESCE(t.sales,0)::text::numeric)::float AS sales,
                        abs(SUM(COALESCE(t.usages,0)::text::numeric))::float as usages,
                        (SUM(COALESCE(t.sales,0)::text::numeric) - abs(SUM(COALESCE(t.usages,0)::text::numeric)) )::float as "profitAmount",      
                        case when SUM(COALESCE(t.sales,0)::text::numeric) = 0
                        then 0
                        else (((SUM(COALESCE(t.sales,0)::text::numeric) - abs(SUM(COALESCE(t.usages,0)::text::numeric))) /SUM(COALESCE(t.sales,0)::text::numeric)) *100)::real END as "profitPercentage"

                        from( select
                                    "InvoiceLines"."createdAt"::date as "date",
                                    (COALESCE("InvoiceLines"."total",0)::text::numeric) - (COALESCE("InvoiceLines"."taxTotal",0)::text::numeric) as sales,
                                    Sum((COALESCE("InventoryMovmentRecords".cost ,0)::text::numeric))  as usages
                                from "InvoiceLines"
                                inner join "Invoices" ON "Invoices".id = "InvoiceLines"."invoiceId" and "Invoices"."status" <> 'Draft'
                                LEFT join "InventoryMovmentRecords" ON "InventoryMovmentRecords"."referenceId" = "InvoiceLines".id
                                inner join "Branches" ON "Invoices"."branchId" = "Branches".id
                                WHERE  "Branches"."companyId"=$1 
							    AND ($2::uuid[] is null or "Branches".id = any($2))
							    AND   "InvoiceLines"."createdAt" >$3 AND "InvoiceLines"."createdAt" <$4 group by ("InvoiceLines"."createdAt"::date), "InvoiceLines"."total","InvoiceLines"."taxTotal"    union all select
                                "CreditNoteLines"."createdAt"::date as "date",
                                (COALESCE("CreditNoteLines"."total",0)::text::numeric) - (COALESCE("CreditNoteLines"."taxTotal",0)::text::numeric) *(-1) as sales,
                                Sum((COALESCE("InventoryMovmentRecords".cost ,0)::text::numeric))  as usages
                            from "CreditNoteLines"
                            inner join "CreditNotes" ON "CreditNotes".id = "CreditNoteLines"."creditNoteId"

                            LEFT join "InventoryMovmentRecords" ON "InventoryMovmentRecords"."referenceId" = "CreditNoteLines".id
                            LEFT join "Branches" ON "CreditNotes"."branchId" = "Branches".id
                              WHERE  "Branches"."companyId"=$1 
							   AND ($2::uuid[] is null or "Branches".id = any($2))
							 AND   "CreditNoteLines"."createdAt" >$3 AND "CreditNoteLines"."createdAt" <$4 group by ("CreditNoteLines"."createdAt"::date), "CreditNoteLines"."total","CreditNoteLines"."taxTotal"   )t GROUP BY T.DATE`,
                values: [companyId, branches, from, to]
            }
            let reports = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async productSalesVsInventoryUsage(data: any, company: Company, brancheList: []) {
        try {
            /**
             * Note Total Sales = (total invoice sales in the giving period) - (total credit note sales in the giving period)
             * Note that usages in inventory movment view  invoices (product Cost * -1) creditNote (product Cost * 1)
             * 
             */
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
                        t."productId",
                        t."productName",

                        SUM(COALESCE(t.qty,0)::text::numeric)::float as qty,
                        SUM(COALESCE(t.sales,0)::text::numeric)::float as sales,
                        abs(SUM(COALESCE(t.usages,0)::text::numeric))::float as usages,
                        (SUM(COALESCE(t.sales,0)::text::numeric) - abs(SUM(COALESCE(t.usages,0)::text::numeric)) )::float as "profit",
                        case when sum(t.sales) = 0 then 0 else (((SUM(COALESCE(t.sales,0)::text::numeric) - abs(SUM(COALESCE(t.usages,0)::text::numeric))) /SUM(COALESCE(t.sales,0)::text::numeric)) *100)::real end as "profitPercentage"
                        from (SELECT
                                    "Products".id as "productId",
                                    "Products".name as "productName",
                                    COALESCE("InvoiceLines".qty,0)::text::numeric as qty,
                                    (COALESCE("InvoiceLines"."total",0)::text::numeric) - (COALESCE("InvoiceLines"."taxTotal",0)::text::numeric) as sales,
                                    sum(COALESCE("InventoryMovmentRecords"."cost",0)::text::numeric)  AS usages
                                FROM "InvoiceLines"
                                INNER join "Invoices" ON "Invoices".id = "InvoiceLines"."invoiceId" and "Invoices"."status" <> 'Draft'
                                LEFT JOIN "Products" ON  "InvoiceLines"."productId" =  "Products".id
                                LEFT JOIN "InventoryMovmentRecords" ON  "InventoryMovmentRecords"."referenceId" =  "InvoiceLines".id
                                INNER JOIN "Branches" ON "Branches".id = "Invoices"."branchId"

                               WHERE  "Branches"."companyId"=$1 
							   AND ($2::UUID[] IS NULL OR "Branches".id = any ($2))
							  AND   "InvoiceLines"."createdAt" >$3 AND "InvoiceLines"."createdAt" <$4   group by "Products".id , "InvoiceLines".id  union all SELECT
                                        "Products".id as "productId",
                                        "Products".name as "productName",
                                        (COALESCE("CreditNoteLines".qty,0)::text::numeric) *(-1) as qty,
                                        ((COALESCE("CreditNoteLines"."total",0)::text::numeric) - (COALESCE("CreditNoteLines"."taxTotal",0)::text::numeric)) *(-1) as sales,
                                        sum(COALESCE("InventoryMovmentRecords"."cost",0)::text::numeric) AS usages
                                    FROM "CreditNoteLines"
                                    INNER join "CreditNotes" ON "CreditNotes".id = "CreditNoteLines"."creditNoteId"
                                    LEFT JOIN "Products" ON  "CreditNoteLines"."productId" =  "Products".id
                                    LEFT JOIN "InventoryMovmentRecords" ON  "InventoryMovmentRecords"."referenceId" =  "CreditNoteLines".id
                                    INNER JOIN "Branches" ON "Branches".id = "CreditNotes"."branchId"
                                   WHERE  "Branches"."companyId"=$1 
							  AND ($2::UUID[] IS NULL OR "Branches".id = any ($2))
							  AND   "CreditNoteLines"."createdAt" >$3 AND "CreditNoteLines"."createdAt" <$4 group by "Products".id , "CreditNoteLines".id  )t
                                                                 group by t."productId", t."productName"
                                                                 order by t."productName"`,
                values: [companyId, branches, from, to]
            }
            let reports = await DB.excu.query(query.text, query.values)


            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async productInventoryUsage(data: any, company: Company, brancheList: []) {
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
                        t. "productId",
                        t. "productName",
                       COALESCE(sum (t.sales),0) AS sales,
                       COALESCE(sum(abs(t.usages)),0) as usages
                        from(select
                                "Products".id as "productId",
                                "Products".name as "productName",
                                CAST(sum("InvoiceLines"."subTotal" ::text::NUMERIC  )AS REAL) as sales,
                                CAST(sum("InventoryMovmentRecords".cost::text::NUMERIC ) AS REAL)  as usages
                            from "InvoiceLines"
                            inner join "Invoices" ON "Invoices".id = "InvoiceLines"."invoiceId" and "Invoices"."status" <> 'Draft'
                            LEFT join "InventoryMovmentRecords" ON "InventoryMovmentRecords"."referenceId" = "InvoiceLines".id
                            LEFT join "Products" ON "InvoiceLines"."productId" ="Products".id

                            inner join "Branches" ON "Invoices"."branchId" = "Branches".id WHERE  "Branches"."companyId"=$1 
							 AND ($2::UUID[] IS NULL OR "Branches".id = any($2))
							 AND   "InvoiceLines"."createdAt" >=$3 AND "InvoiceLines"."createdAt" <$4  group by "Products".id union all select
                                    "Products".id as "productId",
                                    "Products".name as "productName",
                                    CAST(sum("CreditNoteLines"."subTotal"::text::NUMERIC )AS REAL) *(-1) as sales,
                                    CAST(sum("InventoryMovmentRecords".cost::text::NUMERIC) AS REAL)  as usages
                                from "CreditNoteLines"
                                inner join "InventoryMovmentRecords" ON "InventoryMovmentRecords"."referenceId" = "CreditNoteLines".id
                                inner join "Products" ON "CreditNoteLines"."productId" ="Products".id 
							 
                                inner join "Branches" ON "InventoryMovmentRecords"."branchId" = "Branches".id WHERE  "Branches"."companyId"=$1 
							 							 AND ($2::UUID[] IS NULL OR "Branches".id = any($2))
							 AND   "CreditNoteLines"."createdAt" >=$3 AND "CreditNoteLines"."createdAt" <$4 group by "Products".id)t
                                                           GROUP BY t. "productId",t. "productName"  `,
                values: [companyId, branches, from, to]
            }
            let reports = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async wastageReportSummary(data: any, company: Company, brancheList: []) {
        try {

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
                text: `with  "products" as (
                select * from "Products"
                where "companyId" = $1),
                "invoicesWaste" as (
                select"InvoiceLines"."invoiceId",
                       "InvoiceLines".qty ,
                       "parentLine"."recipe",
                       "products"."name" as "productName",
                       "products".id as "productId"
                from "InvoiceLines"
                inner join "InvoiceLines" "parentLine" on "parentLine".id = "InvoiceLines"."voidFrom"    
                inner join "Invoices" on "Invoices".id =  "InvoiceLines"."invoiceId"
                inner join "products" on "products".id =  "InvoiceLines"."productId"
                inner join "Branches" on "Branches".id = "Invoices"."branchId"
                where "InvoiceLines"."waste" is true
                 AND "Invoices"."status" <>'Draft'  AND   "Branches"."companyId" = $1
				 AND($2::UUID[] IS NULL OR "Branches".id = any($2) )	
				AND "InvoiceLines"."createdAt" >=$3 AND  "InvoiceLines"."createdAt"<$4 ), "transferOutWaste" as (
            SELECT "products".id as "productId",
                   "products".name as "productName",
                "InventoryTransferLines".qty as "wastageQty",
                  ( "InventoryTransferLines".qty::text::numeric * "InventoryTransferLines"."unitCost"::text::numeric)::numeric as "wastageValue"
                FROM "InventoryTransfers"
            inner join "InventoryTransferLines" on "InventoryTransferLines"."inventoryTransferId" =  "InventoryTransfers".id
            inner join "products" on "products".id =  "InventoryTransferLines"."productId"
            inner join "Branches" on "Branches".id = "InventoryTransfers"."branchId"
            where "InventoryTransfers"."reason" = 'Wastage' and "status" = 'Confirmed' and "InventoryTransfers"."type" = 'Transfer Out'
             AND   "Branches"."companyId" = $1
			 AND($2::UUID[] IS NULL OR "Branches".id = any($2) )			
			AND "InventoryTransfers"."confirmDatetime" >=$3 AND  "InventoryTransfers"."confirmDatetime"<$4 ),"totalInvoiceWaste" as(
               SELECT  "Products".id as "productId",
                                 "Products".name "productName",
                                 COALESCE( sum(abs(((el->>'qty')::numeric/abs("invoicesWaste".qty)) * abs("invoicesWaste".qty))),0)::real as "wastageQty",
                                 COALESCE( sum(case when el->>'unitCost' is null then (((el->>'cost')::numeric/(el->>'qty')::numeric) * abs("invoicesWaste".qty))::text::numeric  else ((el->>'unitCost')::numeric * abs("invoicesWaste".qty))::text::numeric  end),0) as "wastageValue"
                        FROM "invoicesWaste"
						cross JOIN LATERAL   JSONB_ARRAY_ELEMENTS("recipe") AS el 
						inner join "Products" on "Products".id = (el->>'productId')::uuid
                        GROUP BY   "Products".id 
						 union all 
							  SELECT   "productId",
                                 "productName",
                                 COALESCE( sum(abs("invoicesWaste".qty)),0)::real as "wastageQty",
                                  0 as "wastageValue"
                        FROM "invoicesWaste"
							where "recipe" = '[]' or "recipe" is null 
                        GROUP BY   "productId" , "productName")


                select "products".id as "productId",
                    "products".name as "productName",
                    COALESCE(sum("totalInvoiceWaste"."wastageQty"::text::numeric),0)+ COALESCE(sum("transferOutWaste"."wastageQty"::text::numeric) ,0)as "wastageQty",
                    COALESCE(sum("totalInvoiceWaste"."wastageValue"::text::numeric),0)+COALESCE( sum("transferOutWaste"."wastageValue"::text::numeric) ,0)as "wastageValue"
                    from "products"
                left join "totalInvoiceWaste" on "totalInvoiceWaste"."productId" = "products".id
                left join "transferOutWaste" on "transferOutWaste"."productId" = "products".id
                group by"products".id ,"products".name
                having  COALESCE(sum("totalInvoiceWaste"."wastageQty"),0)+ COALESCE(sum("transferOutWaste"."wastageQty") ,0) >0`,
                values: [company.id, branches, from, to]
            }


            const reports = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
            throw new Error(error);
        }
    }



    public static async wastageReport(data: any, company: Company, brancheList: []) {
        try {


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
            const branches = data.branchId ? [data.branchId] : brancheList

            const query = {
                text: `with  "products" as (
                select * from "Products"
                where "companyId" = $1),
                "invoicesWaste" as (
                select"InvoiceLines"."invoiceId",
                       "InvoiceLines".qty ,
                       "parentLine"."recipe",
                       "products"."name" as "productName",
                       "products".id as "productId",
                       "InvoiceLines"."employeeId",
                       "Employees".name as "employeeName",
                       "InvoiceLines"."voidReason" as reason
                from "InvoiceLines"
                inner join "InvoiceLines" "parentLine" on "parentLine".id = "InvoiceLines"."voidFrom"    
                inner join "Invoices" on "Invoices".id =  "InvoiceLines"."invoiceId"
                inner join "products" on "products".id =  "InvoiceLines"."productId"
                inner join "Branches" on "Branches".id = "Invoices"."branchId"
                inner join "Employees" on "Employees".id = "InvoiceLines"."employeeId"
                where "InvoiceLines"."waste" is true
                 AND "Invoices"."status" <>'Draft' AND   "Branches"."companyId" = $1 
				 AND ($2::UUID[] IS NULL OR "Branches".id = any($2))	
				AND "InvoiceLines"."createdAt" >=$3 AND  "InvoiceLines"."createdAt"<$4 ), "transferOutWaste" as (
            SELECT "products".id as "productId",
                   "products".name as "productName",
                "InventoryTransferLines".qty as "wastageQty",
                  ( "InventoryTransferLines".qty::text::numeric * "InventoryTransferLines"."unitCost"::text::numeric)::numeric as "wastageValue",
                  "InventoryTransfers"."employeeId",
                  "Employees".name as "employeeName",
                  "InventoryTransfers".reason
                FROM "InventoryTransfers"
            inner join "InventoryTransferLines" on "InventoryTransferLines"."inventoryTransferId" =  "InventoryTransfers".id
            inner join "products" on "products".id =  "InventoryTransferLines"."productId"
            inner join "Branches" on "Branches".id = "InventoryTransfers"."branchId"
            inner join "Employees" on "Employees".id = "InventoryTransfers"."employeeId"
            where "InventoryTransfers"."reason" = 'Wastage' and "status" = 'Confirmed' and "InventoryTransfers"."type" = 'Transfer Out'
             AND   "Branches"."companyId" = $1 
					 AND ($2::UUID[] IS NULL OR "Branches".id = any($2))		
				AND "InventoryTransfers"."confirmDatetime" >=$3 AND  "InventoryTransfers"."confirmDatetime"<$4 ),"totalInvoiceWaste" as(
    SELECT "Products".id as "productId",
                                "Products".name as  "productName",
                                "invoicesWaste"."employeeId",
                                "invoicesWaste"."employeeName",
                                "invoicesWaste"."reason",
                                  COALESCE( sum(abs(((el->>'qty')::numeric/abs("invoicesWaste".qty)) * abs("invoicesWaste".qty))),0)::real as "wastageQty",
                                 COALESCE( sum(case when el->>'unitCost' is null then (((el->>'cost')::numeric/(el->>'qty')::numeric) * abs("invoicesWaste".qty))::text::numeric  else ((el->>'unitCost')::numeric * abs("invoicesWaste".qty))::text::numeric  end),0) as "wastageValue"
                        FROM "invoicesWaste"   
									cross JOIN LATERAL   JSONB_ARRAY_ELEMENTS("recipe") AS el 
								inner join "Products" on "Products".id = (el->>'productId')::uuid
                        GROUP BY  "Products".id, "invoicesWaste"."employeeId",
							
                                        "invoicesWaste"."employeeName",
                                        "invoicesWaste"."reason"
						union all 
							  SELECT "invoicesWaste"."productId",
                                "invoicesWaste"."productName",
                                "invoicesWaste"."employeeId",
                                "invoicesWaste"."employeeName",
                                "invoicesWaste"."reason",
                                 COALESCE( sum(abs("invoicesWaste".qty)),0)::real as "wastageQty",
                                0 as "wastageValue"
                        FROM "invoicesWaste"
										where "recipe" = '[]' or "recipe" is null 
                        GROUP BY "invoicesWaste"."productId" , "invoicesWaste"."productName", "invoicesWaste"."employeeId",
                                        "invoicesWaste"."employeeName",
                                        "invoicesWaste"."reason"
                )


                select "products".id as "productId",
                    "products".name as "productName",
                    COALESCE(sum("totalInvoiceWaste"."wastageQty"::text::numeric),0)+ COALESCE(sum("transferOutWaste"."wastageQty"::text::numeric) ,0)as "wastageQty",
                    COALESCE(sum("totalInvoiceWaste"."wastageValue"::text::numeric),0)+COALESCE( sum("transferOutWaste"."wastageValue"::text::numeric) ,0)as "wastageValue",
                    case when "totalInvoiceWaste"."reason" is null then "transferOutWaste".reason else    "totalInvoiceWaste"."reason" end as "reason",
                    case when "totalInvoiceWaste"."employeeId" is null then "transferOutWaste"."employeeId" else "totalInvoiceWaste"."employeeId"   end  as "employeeId",
                    case when "totalInvoiceWaste"."employeeName" is null then "transferOutWaste"."employeeName" else "totalInvoiceWaste"."employeeName" end as "employeeName"
                    from "products"
                left join "totalInvoiceWaste" on "totalInvoiceWaste"."productId" = "products".id
                left join "transferOutWaste" on "transferOutWaste"."productId" = "products".id
                group by "products".id ,"products".name,"totalInvoiceWaste"."reason","totalInvoiceWaste"."employeeId",
                          "totalInvoiceWaste"."employeeName","transferOutWaste".reason,"transferOutWaste"."employeeId" ,"transferOutWaste"."employeeName"
                having  COALESCE(sum("totalInvoiceWaste"."wastageQty"),0)+ COALESCE(sum("transferOutWaste"."wastageQty") ,0) >0
`,
                values: [company.id, branches, from, to]
            }
            const reports = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
            throw new Error(error);
        }
    }


    //new report
    public static async getGeneralInventoryReport(data: any, company: Company, brancheList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let categoryIds = filter && filter.categoryIds && Array.isArray(filter.categoryIds) ? filter.categoryIds : null
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
            let total = {};
            let count = 0;
            let resault: any[] = [];


            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);

            const locations = filter && filter.locations ? filter.locations : null;
            let offset = limit * (page - 1);
            const branchProductJoin = locations && locations.length > 0 ? `Inner join "BranchProducts" on "BranchProducts"."productId" = "Products".id and "BranchProducts"."locationId" = any("values"."locations") ` : ``;

            const hideIsDeleted = filter.hideDeleted ?? false


            const query: { text: string, values: any } = {
                text: `with "values" as (           
                                select  $1::uuid as "companyId",
                                        $2::uuid[] as "branches",
                                        $3::timestamp  as "fromDate",
                                        $4::timestamp as "toDate",
                                        $5::uuid[] as "categories",
                                        $6::uuid[] as "locations",
                                        $7::boolean as "hideIsDeleted"
                                ) 
                                ,  "start" as (
                                select  distinct on ("Products".id)
                                    "Products".id AS "productId",
                                    sum(qty::text::numeric) as "qty" ,
                                    sum( qty::text::numeric * COALESCE(nullif("InventoryMovmentRecords"."cost"::text::numeric,'NaN'),0 )) ::text::numeric as "cost",
                                    "Products"."barcode"
                                from "InventoryMovmentRecords"
                                join "values" on true 
                                inner join "Products" on "Products"."companyId" = "values"."companyId" and "Products".id = "InventoryMovmentRecords"."productId"    and ($7::boolean is false or ($7::boolean is true and "Products"."isDeleted" = false) )
                                inner join "Branches" on "Branches".id = "InventoryMovmentRecords"."branchId"
                                ${branchProductJoin}
                                where  "InventoryMovmentRecords"."companyId" = "values"."companyId"
                                and ( array_length("values"."branches",1) IS NULL or  "InventoryMovmentRecords"."branchId" = Any("values"."branches"))
                                    and "InventoryMovmentRecords"."createdAt"  < "values"."fromDate" 
                                    and "Products"."type" = any(array ['kit','inventory','batch','serialized'])
                                    and ( array_length("values"."categories",1) IS NULL or  "Products"."categoryId" = Any("values"."categories"))
                                 
                                group by "Products".id
                                )
                                , "inQty" as(
                                select  "Products".id as "productId",
                                    sum("InventoryMovmentRecords".qty::text::numeric) as "qty", 
                                    sum(abs(nullif("InventoryMovmentRecords"."cost",'NaN')* "InventoryMovmentRecords".qty) ) ::text::numeric as "cost",
                                    "Products"."barcode" 
                                from "InventoryMovmentRecords"
                                join "values" on true 
                                join "Products" on "Products"."companyId" = "values"."companyId"  and "Products".id = "InventoryMovmentRecords"."productId"  and   ($7::boolean is false or ($7::boolean is true and "Products"."isDeleted" = false) )
                                join "Branches" on "Branches".id = "InventoryMovmentRecords"."branchId"
                                         ${branchProductJoin}
                                where  "InventoryMovmentRecords"."companyId" = "values"."companyId" 
                                                                    and ( array_length("values"."branches",1) IS NULL or  "InventoryMovmentRecords"."branchId" = Any("values"."branches"))
                                    and ("values"."fromDate" is null and "values"."toDate" is null or "InventoryMovmentRecords"."createdAt" >= "values"."fromDate" and "InventoryMovmentRecords"."createdAt" < "values"."toDate" )

                                    and "Products"."type" = any(array ['kit','inventory','batch','serialized'])
                                    and ( array_length("values"."categories",1) IS NULL or  "Products"."categoryId" = Any("values"."categories"))
                                    and  "InventoryMovmentRecords".qty > 0 
                                group by  "Products".id,"InventoryMovmentRecords"."createdAt"
                                order by "InventoryMovmentRecords"."createdAt" asc

                                ), "outQty" as(
                                select  "Products".id as "productId",
                                    sum("InventoryMovmentRecords".qty::text::numeric) as "qty" ,
                                    sum( abs(COALESCE(nullif("InventoryMovmentRecords"."cost",'NaN'),0 ) * "InventoryMovmentRecords".qty) )::text::numeric as "cost" ,
                                    "Products"."barcode"
                                from "InventoryMovmentRecords"
                                join "values" on true 
                                join "Products" on "Products"."companyId" = "values"."companyId" and "Products".id = "InventoryMovmentRecords"."productId"  and  ($7::boolean is false or ($7::boolean is true and "Products"."isDeleted" = false) )
                                join "Branches" on "Branches".id = "InventoryMovmentRecords"."branchId"
                                         ${branchProductJoin}
                                where "InventoryMovmentRecords"."companyId" = "values"."companyId" 
                                and ( array_length("values"."branches",1) IS NULL or  "InventoryMovmentRecords"."branchId" = Any("values"."branches"))
                                and ("values"."fromDate" is null and "values"."toDate" is null or "InventoryMovmentRecords"."createdAt" >= "values"."fromDate" and "InventoryMovmentRecords"."createdAt" < "values"."toDate" )
                                    and "Products"."type" = any(array ['kit','inventory','batch','serialized'])
                                    and ( array_length("values"."categories",1) IS NULL or  "Products"."categoryId" = Any("values"."categories"))
                                    and  "InventoryMovmentRecords".qty< 0 
                                group by  "Products".id,"InventoryMovmentRecords"."createdAt"
                                order by "InventoryMovmentRecords"."createdAt" asc

                                ), "inTotal" as (
                                select "inQty"."productId",
                                sum("inQty"."qty"::text::numeric) as "totalQty",
                                sum("inQty"."cost"::text::numeric) as "totalCost"
                                from "inQty"
                                group by"inQty"."productId"
                                ),"outTotal" as (
                                select "outQty"."productId",
                                sum("outQty"."qty"::text::numeric) as "totalQty",
                                sum("outQty"."cost"::text::numeric) as "totalCost"
                                from "outQty"
                                group by"outQty"."productId"
                                )
                                select count(*) over(),
                                    sum("start"."qty") over() as "beginningQtyTotal",
                                    sum("start"."cost") over() as "beginningAmountTotal",
                                    sum("inTotal"."totalQty") over() as "receivingQtyTotal",
                                    sum("inTotal"."totalCost") over() as "receivingCostTotal",
                                    sum("outTotal"."totalQty") over() as "usageQtyTotal",
                                    sum("outTotal"."totalCost") over() as "usageCostTotal",
                                    sum(COALESCE("start"."qty",0)  +   COALESCE("inTotal"."totalQty",0) +  COALESCE("outTotal"."totalQty",0)) over() as "endingQtyTotal",
                                    sum( COALESCE("start"."cost",0)  +   COALESCE("inTotal"."totalCost",0) -  COALESCE("outTotal"."totalCost",0)) over() as "endingAmountTotal",

                                    "Products".id as "productId",
                                    "Products".name as "productName",
                                    "Categories".name  as "categoryName",
                                    "Departments".name as "departmentName",
                                    "Products"."barcode",
                                    COALESCE("start"."qty",0) as "beginningQty",
                                    COALESCE("start"."cost",0) as "beginningAmount",
                                    COALESCE("inTotal"."totalQty",0) as "receivingQty",
                                    COALESCE("inTotal"."totalCost",0) as "receivingCost",
                                    COALESCE("outTotal"."totalQty",0) as "usageQty",
                                    COALESCE("outTotal"."totalCost",0) as "usageCost",
                                    COALESCE("start"."qty",0)  +   COALESCE("inTotal"."totalQty",0) +  COALESCE("outTotal"."totalQty",0) as "endingQty",
                                    COALESCE("start"."cost",0)  +   COALESCE("inTotal"."totalCost",0) -  COALESCE("outTotal"."totalCost",0) as "endingAmount"

                                from "Products"
                                join "values" on "Products"."companyId" = "values"."companyId"
                                         ${branchProductJoin}
                                left JOIN "start" on "start"."productId" = "Products".id
                                left join "Categories" on "Categories".id =  "Products"."categoryId"
                                left join "Departments" on "Departments".id = "Categories"."departmentId" 
                                left join "inTotal" on "inTotal"."productId" = "Products".id
                                left join "outTotal" on "outTotal"."productId" = "Products".id
                                where ( "Products"."isDeleted" = false or ("Products"."isDeleted" = true and (COALESCE("start"."cost",0)  +   COALESCE("inTotal"."totalCost",0) -  COALESCE("outTotal"."totalCost",0)) <>0)  )
                                and ( array_length("values"."categories",1) IS NULL or  "Products"."categoryId" = Any("values"."categories"))
                                and "Products"."type" = any(array ['kit','inventory','batch','serialized'])    
                                and ($7::boolean is false or ($7::boolean is true and "Products"."isDeleted" = false) )
                    `,
                values: [companyId, branches, from, to, categoryIds, locations, hideIsDeleted]
            }

            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`
            console.log(query.text + limitQuery, query.values)
            let records = await DB.excu.query(query.text + limitQuery, query.values)

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = {
                    beginningQty: t.beginningQtyTotal, beginningAmount: t.beginningAmountTotal,
                    receivingQty: t.receivingQtyTotal, receivingCost: t.receivingCostTotal,
                    usageQty: t.usageQtyTotal, usageCost: t.usageCostTotal,
                    endingQty: t.endingQtyTotal, endingAmount: t.endingAmountTotal
                }
                resault = records.rows.map((e: any) => {
                    return {
                        productId: e.productId, productName: e.productName,
                        categoryName: e.categoryName, barcode: e.barcode,
                        beginningQty: e.beginningQty, beginningAmount: e.beginningAmount,
                        receivingQty: e.receivingQty, receivingCost: e.receivingCost,
                        usageQty: e.usageQty, usageCost: e.usageCost,
                        endingQty: e.endingQty, endingAmount: e.endingAmount
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
                total: total,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "General Inventory Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'categoryName' },
                { key: 'productName', }, { key: 'barcode', properties: { columnType: 'barcode' } },
                { key: 'beginningQty', properties: { hasTotal: true } },
                { key: 'beginningAmount', properties: { columnType: 'currency', hasTotal: true } },
                { key: 'receivingQty', properties: { hasTotal: true } },
                { key: 'receivingCost', properties: { columnType: 'currency', hasTotal: true } },
                { key: 'usageQty', properties: { hasTotal: true } },
                { key: 'usageCost', properties: { columnType: 'currency', hasTotal: true } },
                { key: 'endingQty', properties: { hasTotal: true } },
                { key: 'endingAmount', properties: { columnType: 'currency', hasTotal: true } },

                ]
                report.fileName = 'generalInventoryReport'
                return new ResponseData(true, "", report)
            }



            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    /**Billing
    Manual Adjustment (UnitCost Adjustment)
    InventoryTransfers
    productSalesVsInventoryUsageReport */
    public static async salesVsInventoryUsageReport(data: any, company: Company, brancheList: []) {
        try {

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
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
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
                text: `
                 WITH "invoiceLines" AS ( 
                        SELECT 
	                        il.id,
                            il."createdAt"::date AS date,
                            (COALESCE(il."total", 0) - COALESCE(il."taxTotal", 0)) AS sales
                        
                        FROM "InvoiceLines" il
                       
                        INNER JOIN "Invoices" inv 
                            ON inv.id = il."invoiceId" AND inv.status <> 'Draft'
                        WHERE il."companyId" = $1
	                       AND ($2::uuid[] IS NULL OR il."branchId" = ANY ($2::uuid[]))
                        AND il."createdAt" >=  $3
                        AND il."createdAt" <   $4
                        GROUP BY il.id
                    ),invoice_data as(
						select 
						il.date, 
						il.sales,
					     SUM(COALESCE(imr.cost, 0) * COALESCE(imr.qty, 0)) AS usages
						from "invoiceLines" il
						 LEFT JOIN "InventoryMovmentRecords" imr 
                            ON  imr."referenceId" = il.id 
						group by il.id, il.date , il.sales
					)
					
					, "creditNoteLines" as (
					  SELECT cnl.id,
                            cnl."createdAt"::date AS date,
                            -(COALESCE(cnl."total", 0) - COALESCE(cnl."taxTotal", 0)) AS sales
                            
                        FROM "CreditNoteLines" cnl
                   
                        WHERE cnl."companyId" = $1
						        AND ($2::uuid[] IS NULL OR cnl."branchId" = ANY ($2::uuid[]))
                        AND cnl."createdAt" >= $3
                        AND cnl."createdAt" < $4
                        GROUP BY cnl.id
					
					),
                    credit_note_data AS (
                        SELECT cnl.date,
						       cnl.sales,
                            -SUM(COALESCE(imr.cost, 0) * COALESCE(imr.qty, 0)) AS usages
						from "creditNoteLines" cnl
						  LEFT JOIN "InventoryMovmentRecords" imr 
                            ON imr."referenceId" = cnl.id 
                         group by cnl.id,cnl.date,
						       cnl.sales
                    ) ,
                    combined AS (
                        SELECT * FROM invoice_data
                        UNION ALL
                        SELECT * FROM credit_note_data
                    ),
                    final_agg AS (
                        SELECT 
                            date,
                            SUM(sales) AS sales,
                            SUM(usages) AS usages
                        FROM combined
                        GROUP BY date
                    )
                    SELECT 
                        COUNT(*) OVER ()::real,
                        SUM(sales) OVER ()::float AS "salesTotal",
                        SUM(ABS(usages)) OVER ()::float AS "usagesTotal",
                        SUM(sales - ABS(usages)) OVER ()::float AS "profitAmountTotal",
                        CASE WHEN SUM(sales) OVER () = 0 THEN 0
                            ELSE ROUND((SUM(sales - ABS(usages)) OVER () / SUM(sales) OVER () * 100)::numeric, 2)::float 
                        END AS "profitPercentageTotal",
                        date,
                        sales::float AS "salesWithDiscount",
                        ABS(usages)::float AS usages,
                        (sales - ABS(usages))::float AS "profitAmount",
                        CASE WHEN sales = 0 THEN 0
                            ELSE ROUND(((sales - ABS(usages)) / sales * 100)::numeric, 2)::float 
                        END AS "profitPercentage"
                    FROM final_agg
                    ORDER BY date
              `,
                values: [companyId, branches, from, to]
            }



            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`
            let records = await DB.excu.query(query.text + limitQuery, query.values)
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { salesWithDiscount: t.salesTotal, usages: t.usagesTotal, profitAmount: t.profitAmountTotal, profitPercentage: t.profitPercentageTotal }
                resault = records.rows.map((e: any) => { return { date: e.date, salesWithDiscount: e.salesWithDiscount, usages: e.usages, profitAmount: e.profitAmount, profitPercentage: e.profitPercentage } })
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
                    title: "Sales Vs Inventory Usage",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'date', properties: { columnType: 'date' } },
                { key: 'salesWithDiscount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'usages', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'profitAmount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'profitPercentage', properties: { columnType: 'percentage' } }
                ]
                report.fileName = 'salesVsInventoryUsage'
                console.log(Number("2024-06-30T21:00:00.000Z"))

                return new ResponseData(true, "", report)


            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async productInventoryUsageReport(data: any, company: Company, brancheList: []) {
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
                    
                    select 
                    count(*) over(),
                    sum(sum(COALESCE(t.sales,0)::text ::NUMERIC)) over() ::float AS "salesTotal",
                    sum(sum(COALESCE(abs(t.usages),0)::text ::NUMERIC)) over() ::float  as "usagesTotal",
                    t. "productId",
                    t. "productName", 
                    sum(COALESCE(t.sales,0)::text ::NUMERIC) ::float AS sales,
                    sum(COALESCE(abs(t.usages),0)::text ::NUMERIC) ::float  as usages
                    from(
                        select
                            "Products".id as "productId",
                            "Products".name as "productName",
                            Sum((COALESCE("InvoiceLines"."total",0)::text::numeric) - (COALESCE("InvoiceLines"."taxTotal",0)::text::numeric))  as sales,
                            sum("InventoryMovmentRecords".cost * "InventoryMovmentRecords".qty ) as usages
                        from "InvoiceLines"
                        join "values" ON TRUE
                        inner join "Invoices" ON "Invoices".id = "InvoiceLines"."invoiceId" and "Invoices"."status" <> 'Draft'
                        left join "InventoryMovmentRecords" ON "InventoryMovmentRecords"."transactionId" = "InvoiceLines".id
                        left join "Products" ON "InvoiceLines"."productId" ="Products".id
                        inner join "Branches" ON "InventoryMovmentRecords"."branchId" = "Branches".id 
                        WHERE  "Branches"."companyId"= "values"."companyId"
                            AND( "values"."branches" IS NULL OR "Branches".id = any( "values"."branches"))
                            AND ( "InvoiceLines"."createdAt" >= "values"."fromDate" AND  "InvoiceLines"."createdAt" < "values"."toDate") 
                        group by "Products".id 
                        union all 
                        select
                                "Products".id as "productId",
                                "Products".name as "productName",
                                Sum((COALESCE("CreditNoteLines"."total",0)::text::numeric) - (COALESCE("CreditNoteLines"."taxTotal",0)::text::numeric))   *(-1) as sales,
                                sum("InventoryMovmentRecords".cost * "InventoryMovmentRecords".qty ):: text :: NUMERIC  as usages
                            from "CreditNoteLines"
                            join "values" ON TRUE
                            inner join "InventoryMovmentRecords" ON "InventoryMovmentRecords"."transactionId" = "CreditNoteLines".id      
                            inner join "Products" ON "CreditNoteLines"."productId" ="Products".id
                            inner join "Branches" ON "InventoryMovmentRecords"."branchId" = "Branches".id 
                        WHERE  "Branches"."companyId"= "values"."companyId"
                                AND( "values"."branches" IS NULL OR "Branches".id = any( "values"."branches"))
                                AND ( "CreditNoteLines"."createdAt" >= "values"."fromDate" AND  "CreditNoteLines"."createdAt" < "values"."toDate") 
                        group by "Products".id
                    )t
                    GROUP BY t. "productId",t. "productName" 
                    order BY t. "productName"
                    limit ${limit}
                    offset ${offset}
                    
                    `,
                values: [companyId, branches, from, to]
            }


            const records = await DB.excu.query(query.text, query.values);
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { sales: t.salesTotal, usages: t.usagesTotal }
                resault = records.rows.map((e: any) => { return { productId: e.productId, productName: e.productName, sales: e.sales, usages: e.usages } })
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

    public static async productSalesVsInventoryUsageReport(data: any, company: Company, brancheList: []) {
        try {

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
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
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
                text: ` WITH "lines" as (	  select      				     
                            "InvoiceLines"."createdAt"::date as date,
                            COALESCE("InvoiceLines"."total",0)::text::numeric - COALESCE("InvoiceLines"."taxTotal",0)::text::numeric  as sales,
                            "InvoiceLines"."invoiceId", 
                            "InvoiceLines"."id",
                            "InvoiceLines"."branchId",
                            "InvoiceLines"."companyId",
                            "InvoiceLines"."productId",
                            "InvoiceLines".qty
                        from "InvoiceLines"
                        where "InvoiceLines"."companyId" = $1
                            and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any ($2::uuid[]))
                            and ("InvoiceLines"."createdAt" >= $3::timestamp  and "InvoiceLines"."createdAt" < $4)

                        )
                        , "invoiceData" as (
                        select  
                            "Products".id as "productId" , 
                            "Products".name as "productName",
                            "Products".barcode,
                            "sales",
                            "lines"."qty",
                            sum( "InventoryMovmentRecords".cost::text::numeric  * "InventoryMovmentRecords".qty::text::numeric *-1)    as usages 
                        from "lines"
                        inner join "Invoices" on "Invoices".id = "lines"."invoiceId" and "Invoices"."status" <> 'Draft'
                        inner join "Products" ON "lines"."productId" ="Products".id
                        left join "InventoryMovmentRecords" ON   "InventoryMovmentRecords"."referenceId" = "lines".id
                        group by "Products".id,"lines"."id", sales,  "lines"."qty"
                        )
                        ,"creditNoteLines" as (
                        select      				     
                            "CreditNoteLines"."createdAt"::date as date,
                            COALESCE("CreditNoteLines"."total",0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal",0)::text::numeric  as sales,
                            "CreditNoteLines"."productId",
                            "CreditNoteLines"."companyId",
                            "CreditNoteLines"."branchId",
                            "CreditNoteLines".qty,
                            "CreditNoteLines".id
                        from "CreditNoteLines"
                        where "CreditNoteLines"."companyId" = $1
                            and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId" =any($2::uuid[]))
                            and ("CreditNoteLines"."createdAt" >= $3::timestamp 	 and "CreditNoteLines"."createdAt" < $4)
                        )
                        ,"creditNoteData" as (
                        select     
                        "Products".id as "productId" , 
                        "Products".name as "productName",
                        "Products".barcode,
                        "sales" *(-1),
                        "creditNoteLines"."qty" *(-1),
                        sum("InventoryMovmentRecords".cost::text::numeric  * "InventoryMovmentRecords".qty::text::numeric *-1)  as usages 
                        from "creditNoteLines"
                        left join "InventoryMovmentRecords" ON  "InventoryMovmentRecords"."referenceId" = "creditNoteLines".id
                        inner join "Products" ON "creditNoteLines"."productId" ="Products".id
                        group by "Products".id,"creditNoteLines"."id", sales,  "creditNoteLines"."qty"
                        ),
                        T AS (          
                        select * from "invoiceData" union all select * from "creditNoteData"
                        )
                        select 
                        count(*) over()::real,
                        sum( COALESCE(sum(t.qty),0) ) over()::real AS "totalQty",
                        CAST ( sum( COALESCE(sum(t.sales),0 )) over() AS float) AS "salesTotal",
                        CAST ( sum((COALESCE(sum(t.usages),0))) over() AS float) AS "usagesTotal",
                        CAST ( sum((COALESCE(sum(t.sales),0)- (COALESCE(sum(t.usages),0)) )) over() as float) as "profitAmountTotal",
                        case when sum((COALESCE(sum(t.usages),0)) ) over() = 0  then 0
                        else CAST ( ( sum((COALESCE(sum(t.sales),0) - (COALESCE(sum(t.usages),0)) )) over())/ (sum((COALESCE(sum(t.usages),0))) over()) AS REAL )*100  END as "profitPercentageTotal",

                        t."productId", t."productName", t.barcode ,

                        COALESCE(sum(t.qty),0)::float  AS qty,
                        CAST ( COALESCE(sum(t.sales),0) as float) AS sales,
                        CAST ( (COALESCE(sum(t.usages),0)) as float) AS usages,
                        CAST ((COALESCE(sum(t.sales),0) - (COALESCE(sum(t.usages),0)) ) as float) as "profitAmount",
                        case when (COALESCE(sum(t.usages),0)) = 0  then 0
                        else CAST ( (COALESCE(sum(t.sales),0) - (sum(COALESCE(t.usages,0) )))/ (COALESCE(sum(t.usages),0)) AS real )*100  END as "profitPercentage"

                        FROM t 
                        GROUP BY t."productId", t."productName", t.barcode
                        ORDER BY t."productName"`,
                values: [companyId, branches, from, to]
            }


            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`

            let records = await DB.excu.query(query.text + limitQuery, query.values)

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { qty: t.totalQty, sales: t.salesTotal, usages: t.usagesTotal, profitAmount: t.profitAmountTotal, profitPercentage: t.profitPercentageTotal }
                resault = records.rows.map((e: any) => { return { productId: e.productId, productName: e.productName, barcode: e.barcode, qty: e.qty, sales: e.sales, usages: e.usages, profitAmount: e.profitAmount, profitPercentage: e.profitPercentage } })
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
                    title: "Product Sales Vs Inventory Usage",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'productName' }, { key: 'barcode', properties: { columnType: 'barcode' } },
                { key: 'qty', properties: { hasTotal: true } },
                { key: 'sales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'usages', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'profitAmount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'profitPercentage', properties: { hasTotal: true, columnType: 'percentage' } }
                ]
                report.fileName = 'productSalesVsInventoryUsage'
                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async productMovmentReport(data: any, company: Company, brancheList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let productId = filter && filter.productId ? filter.productId : null;
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
            if (!productId) { throw new ValidationException("producutId is required ") }


            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let offset = limit * (page - 1);


            let count = 0;
            let resault: any[] = [];

            const query: { text: string, values: any } = {
                text: `wITH "values" AS (
                    SELECT $1::uuid AS "companyId",
                          $2::uuid[] AS "branches",
                          $3::timestamp AS "fromDate",
                           $4::timestamp AS "toDate",
                         $5::uuid AS "productId"
                    ),"openingBalance" as (
                    select 
                        "values"."fromDate" as  "createdAt",
                        "Products"."name",
                        "Products"."UOM",
                             "Products"."barcode",
                        sum("movment".qty::text::numeric) as "qtyUsage",
                        sum("movment"."cost"::text::numeric  *  "movment".qty::text::numeric ) as "cost",
                        sum("movment"."cost") as "unitCost",
                         null::uuid as "referenceId",
                        'as of ' || "values"."fromDate"::date  as type,
                        null::uuid as "transactionId",
                    case when  array_length("values"."branches",1) is null  then null else "Branches".name end As "branchName",
                    -1   as "incrementalId"
                    from "InventoryMovmentRecords" as "movment"
                    join "values" on true
                    inner join "Products" on "Products".id = "movment"."productId"
                    left join "Branches" on "Branches".id = "movment"."branchId"
                    where "Branches"."companyId"  = "values"."companyId"
                    and "movment"."productId" = "values"."productId"
                    and "movment"."createdAt" < "values"."fromDate"
                    and (array_length("values"."branches",1) is null  or  "Branches".id = Any("values"."branches"))
                    group by "Products".id ,"branchName" ,"values"."fromDate",   "Products"."barcode"
                    )
                    ,"productMovment" as (
                    select 
                        "movment"."createdAt",
                        "Products"."name",
                        "Products"."UOM",
                            "Products"."barcode",
                        "movment".qty::text::numeric as "qtyUsage",
                        ("movment"."cost"::text::numeric  *  "movment".qty::text::numeric) as "cost",
                       "movment"."cost"::text::numeric as "unitCost",
                        "movment"."referenceId" ,
                        "movment"."referenceTable" as type,
                          "movment"."transactionId", 
                        "Branches".name As "branchName",
                        "movment"."incrementalId"
                    from "InventoryMovmentRecords" as "movment"
                    JOIN "values" on true
                    INNER JOIN "Products" on "movment"."productId" = "Products".id
                    INNER JOIN "Branches" on "movment"."branchId" = "Branches".id
        
                     WHERE "Branches"."companyId" =  "values"."companyId"
                    AND (array_length("values"."branches",1)  is null or  "Branches".id = Any("values"."branches"))
                    AND  ("movment"."createdAt" >= "values"."fromDate" AND "movment"."createdAt" < "values"."toDate")
                    and "movment"."productId" = "values"."productId"
                    union 
                    select * from "openingBalance"
                    )
                 
                    select
                    count(*) over()::real,
                    sum("productMovment"."qtyUsage") over() ::real as "qtyUsageTotal",
                    sum("productMovment"."cost") over() ::real as "costTotal",
                    "productMovment"."name",
                        "productMovment"."barcode",
                    "productMovment"."createdAt",
                    "productMovment"."qtyUsage" ::real as "qtyUsage",
                    "productMovment"."cost" ::real as "cost",
                    "productMovment"."unitCost",
                    sum("productMovment"."qtyUsage"::text::numeric) OVER (order by   "productMovment"."createdAt" asc , "incrementalId" asc  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::real    as "qtyBalance",
                   case when       sum("productMovment"."qtyUsage"::text::numeric) OVER (order by   "productMovment"."createdAt" asc , "incrementalId" asc ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::real <>0 then  sum("productMovment"."cost"::text::numeric) OVER (order by   "productMovment"."createdAt" asc ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::real  else 0 end  as "costBalance",
                    "productMovment"."transactionId",
                    "productMovment"."referenceId",
                    "productMovment".type,
                    "productMovment"."branchName"
                    from "productMovment"
                    order by "createdAt" 
                    `,
                values: [companyId, branches, from, to, productId]
            }


            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`

            let records = await DB.excu.query(query.text + limitQuery, query.values)

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                resault = records.rows.map((e: any) => { return { unitCost: e.unitCost, name: e.name, createdAt: e.createdAt, qtyUsage: e.qtyUsage, cost: e.cost, qtyBalance: e.qtyBalance, costBalance: e.costBalance, transactionId: e.transactionId, type: e.type, branchName: e.branchName } })
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
                    title: "Product Movment",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches,
                    filterList: { productName: (<any>records.rows[0])?.name },
                    productName: (<any>records.rows[0])?.name
                }
                report.records = records.rows
                report.columns = [{ key: 'type' },
                { key: 'createdAt', properties: { columnType: 'date' } },
                { key: 'qtyUsage' },
                { key: 'qtyBalance' },
                { key: 'cost', properties: { columnType: 'currency' } },
                { key: 'costBalance', properties: { columnType: 'currency' } }
                ]
                report.fileName = 'productMovment'
                return new ResponseData(true, "", report)
            }



            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }


    public static async wastageSummaryReport(data: any, company: Company, branchList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : branchList;
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
                text: ` WITH "lines" as (			
                        select      				     
                    
           
                        "InvoiceLines"."invoiceId",
                        "InvoiceLines"."createdAt",
                        "InvoiceLines"."branchId",
                        "InvoiceLines"."productId",
                        "InvoiceLines"."companyId",
                        "InvoiceLines"."qty",
                        "InvoiceLines"."voidFrom"
                    from "InvoiceLines"
                   where "InvoiceLines"."companyId" = $1
                    and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any ($2::uuid[]))
                    and ("InvoiceLines"."createdAt" >= $3::timestamp 	 and "InvoiceLines"."createdAt" < $4)
                        and "InvoiceLines"."waste" IS true
                   ),
                    "invoicesWaste" as (
                    select     "lines"."invoiceId",
                               "lines".qty ,
                               "parentLine"."recipe",
                               "Products"."name" as "productName",
                               "Products".barcode,
                               "Products".id as "productId"
						
						from "lines" 
                             
                    inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
						   INNER JOIN "InvoiceLines" "parentLine" ON "parentLine".id = "lines"."voidFrom"
                          INNER JOIN "Products" ON "Products".id =  "lines"."productId"
                                 left join "Products" as prod  on prod.id = "lines"."productId" 
                                    )   ,"transferOutWaste" AS (
                        SELECT  "Products".id as "productId",
                                   "Products".name as "productName",
                                   "Products".barcode,
                                "InventoryTransferLines".qty::real as "wastageQty",
                                  ("InventoryTransferLines".qty::numeric * "InventoryTransferLines"."unitCost"::numeric)::numeric as "wastageValue"  
                        FROM "InventoryTransfers"
                        INNER JOIN "InventoryTransferLines" on "InventoryTransferLines"."inventoryTransferId" =  "InventoryTransfers".id
                        INNER JOIN "Products" on "Products".id =  "InventoryTransferLines"."productId"
                        INNER JOIN "Branches" on "Branches".id = "InventoryTransfers"."branchId"
                        WHERE "InventoryTransfers"."reason" = 'Wastage' and "status" = 'Confirmed' and "InventoryTransfers"."type" = 'Transfer Out'
                               AND "Branches"."companyId" = $1
                               AND ($2::uuid[] IS NULL or  "Branches".id = Any($2::uuid[]))
                               AND "InventoryTransfers"."confirmDatetime" >= $3 AND  "InventoryTransfers"."confirmDatetime"<  $4 
                        )
                        ,"totalInvoiceWaste" AS(
                        SELECT  "Products".id as "productId",
                                 "Products".name "productName",
                                 "Products".barcode,
                                 COALESCE( sum(abs(((el->>'qty')::numeric/abs("invoicesWaste".qty)) * abs("invoicesWaste".qty))),0)::real as "wastageQty",
                                 COALESCE( sum(case when el->>'unitCost' is null then (((el->>'cost')::numeric/(el->>'qty')::numeric) * abs("invoicesWaste".qty))::text::numeric  else ((el->>'unitCost')::numeric * abs("invoicesWaste".qty))::text::numeric  end),0) as "wastageValue"
                        FROM "invoicesWaste"
						cross JOIN LATERAL   JSONB_ARRAY_ELEMENTS("recipe") AS el 
						inner join "Products" on "Products".id = (el->>'productId')::uuid
                        GROUP BY   "Products".id 
						 union all 
							  SELECT   "productId",
                                 "productName",
                                 barcode,
                                 COALESCE( sum(abs("invoicesWaste".qty)),0)::real as "wastageQty",
                                  0 as "wastageValue"
                        FROM "invoicesWaste"
							where "recipe" = '[]' or "recipe" is null 
                        GROUP BY   "productId" , "productName", barcode
			
                        )
                        
                        SELECT 
                            count(*) over()::real,
                            sum(COALESCE(sum("totalInvoiceWaste"."wastageQty"::text::numeric),0)+ COALESCE(sum("transferOutWaste"."wastageQty"::text::numeric) ,0) ) over() as "totalWastageQty",
                            sum(COALESCE(sum("totalInvoiceWaste"."wastageValue"),0)+ COALESCE(sum("transferOutWaste"."wastageValue") ,0) ) over() as "totalWastageValue",
                            "Products".id as "productId",
                            "Products".name as "productName", "Products".barcode,
                            COALESCE(sum("totalInvoiceWaste"."wastageQty"::text::numeric),0)+ COALESCE(sum("transferOutWaste"."wastageQty"::text::numeric) ,0)as "wastageQty",
                            COALESCE(sum("totalInvoiceWaste"."wastageValue"),0)+COALESCE( sum("transferOutWaste"."wastageValue") ,0)as "wastageValue"
                            from "Products"
                        left join "totalInvoiceWaste" on "totalInvoiceWaste"."productId" = "Products".id
                        left join "transferOutWaste" on "transferOutWaste"."productId" = "Products".id
                        where "Products"."companyId" = $1
                        group by"Products".id ,"Products".name,"Products".barcode
                        having  COALESCE(sum("totalInvoiceWaste"."wastageQty"),0)+ COALESCE(sum("transferOutWaste"."wastageQty") ,0) >0  
                        order by "productName", "productId"
                   
                    `,
                values: [companyId, branches, from, to]
            }

            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`

            let records = await DB.excu.query(query.text + limitQuery, query.values)
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { wastageQty: t.totalWastageQty, wastageValue: t.totalWastageValue }
                resault = records.rows.map((e: any) => { return { productId: e.productId, productName: e.productName, barcode: e.barcode, wastageQty: e.wastageQty, wastageValue: e.wastageValue } })
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
                    title: "Wastage Summary Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'productName' }, { key: 'barcode', properties: { columnType: 'barcode' } },
                { key: 'wastageQty', properties: { hasTotal: true } },
                { key: 'wastageValue', properties: { hasTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'wastageSummaryReport'
                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async productWastageReport(data: any, company: Company, branchList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : branchList;
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
                text: `--sql
                    WITH "lines" as (			
                        select      				     
                    
           
                        "InvoiceLines"."invoiceId",
                        "InvoiceLines"."createdAt",
                        "InvoiceLines"."branchId",
                        "InvoiceLines"."productId",
                        "InvoiceLines"."companyId",
                        "InvoiceLines"."qty",
                        "InvoiceLines"."voidFrom",
	                   "InvoiceLines"."voidReason" as reason,
	                   "InvoiceLines"."employeeId"
                    from "InvoiceLines"
                   where "InvoiceLines"."companyId" = $1
                    and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any ($2::uuid[]))
                    and ("InvoiceLines"."createdAt" >= $3::timestamp 	 and "InvoiceLines"."createdAt" < $4)
                        and "InvoiceLines"."waste" IS true
                   ),
                    "invoicesWaste" as (
                    select     "lines"."invoiceId",
                               "lines".qty ,
                               "parentLine"."recipe",
                               "Products"."name" as "productName",
                               "Products".barcode,
                               "Products".id as "productId",
						      "Employees".name as "employeeName",
							"Employees"."id" as 	 "employeeId",
						"lines"."voidFrom",
						      "lines".reason
						from "lines" 
                             
                    inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
						   INNER JOIN "InvoiceLines" "parentLine" ON "parentLine".id = "lines"."voidFrom"
                          INNER JOIN "Products" ON "Products".id =  "lines"."productId"
						     INNER JOIN "Employees" on "Employees".id = "lines"."employeeId"

                                    )   ,"transferOutWaste" AS (
                        SELECT  "Products".id as "productId",
                                   "Products".name as "productName",
                                   "Products".barcode,
                                   "InventoryTransferLines".qty::real as "wastageQty",
								   	"InventoryTransfers".reason ||':' ||  "InventoryTransfers"."note" as "reason" ,
									"Employees"."name" as 	 "employeeName",
									"Employees"."id" as 	 "employeeId",
                                  ("InventoryTransferLines".qty::numeric * "InventoryMovmentRecords"."cost"::numeric)::numeric as "wastageValue"  
                        FROM "InventoryTransfers"
                        INNER JOIN "InventoryTransferLines" on "InventoryTransferLines"."inventoryTransferId" =  "InventoryTransfers".id
                        INNER JOIN "Products" on "Products".id =  "InventoryTransferLines"."productId"
                        INNER JOIN "Branches" on "Branches".id = "InventoryTransfers"."branchId"
																inner join "InventoryMovmentRecords" on "InventoryMovmentRecords"."referenceId" = "InventoryTransferLines"."id"

					   INNER JOIN "Employees" on "Employees".id = "InventoryTransfers"."employeeId"
                        WHERE "InventoryTransfers"."reason" = 'Wastage' and "status" = 'Confirmed' and "InventoryTransfers"."type" = 'Transfer Out'
                               AND "Branches"."companyId" = $1
                               AND ($2::uuid[] IS NULL or  "Branches".id = Any($2::uuid[]))
                               AND "InventoryTransfers"."confirmDatetime" >= $3 AND  "InventoryTransfers"."confirmDatetime"<  $4 
                        )
                        ,"totalInvoiceWaste" AS(
                        SELECT  "Products".id as "productId",
                                 "Products".name "productName",
                                 "Products".barcode,
                                 COALESCE( sum(abs(((el->>'qty')::numeric/abs("invoicesWaste".qty)) * abs("invoicesWaste".qty))),0)::real as "wastageQty",
                                    "invoicesWaste".reason,
							   "invoicesWaste". "employeeName",
							   "invoicesWaste". "employeeId",
							   COALESCE( sum(case when"InventoryMovmentRecords"."cost" is null or "InventoryMovmentRecords"."cost" = 0  then 0  else ("InventoryMovmentRecords"."cost"  * abs("invoicesWaste".qty))::text::numeric  end),0) as "wastageValue"
                        FROM "invoicesWaste"
						cross JOIN LATERAL   JSONB_ARRAY_ELEMENTS("recipe") AS el 
						inner join "Products" on "Products".id = (el->>'productId')::uuid
						inner join "InventoryMovmentRecords" on "InventoryMovmentRecords"."referenceId" = "invoicesWaste"."voidFrom"
                     GROUP BY   "Products".id ,    "invoicesWaste".reason,  "invoicesWaste". "employeeName",
							   "invoicesWaste". "employeeId"
						 union all 
							  SELECT  "invoicesWaste"."productId",
                                "invoicesWaste"."productName",
                                "invoicesWaste".barcode,
							     COALESCE( sum(abs("invoicesWaste".qty)),0)::real as "wastageQty",
							     "invoicesWaste"."reason",
							      "invoicesWaste"."employeeName",
                                "invoicesWaste"."employeeId",
                                0 as "wastageValue"
                        FROM "invoicesWaste"
							where "recipe" = '[]' or "recipe" is null 
                        GROUP BY   "productId" , "productName", barcode,  "invoicesWaste"."reason",
							      "invoicesWaste"."employeeName",
                                "invoicesWaste"."employeeId"
			
                        )
                        
                           SELECT 
                            count(*) over()::real,
                            sum(COALESCE(sum("totalInvoiceWaste"."wastageQty"::text::numeric),0)+ COALESCE(sum("transferOutWaste"."wastageQty"::text::numeric) ,0) ) over() as "totalWastageQty",
                            sum(COALESCE(sum("totalInvoiceWaste"."wastageValue"),0)+ COALESCE(sum("transferOutWaste"."wastageValue") ,0) ) over() as "totalWastageValue",
                            "Products".id as "productId",
                            "Products".name as "productName",
                              "Products".barcode,
                            case when "totalInvoiceWaste"."reason" is null then "transferOutWaste".reason else    "totalInvoiceWaste"."reason" end as "reason",
                            case when "totalInvoiceWaste"."employeeId" is null then "transferOutWaste"."employeeId" else "totalInvoiceWaste"."employeeId"   end  as "employeeId",
                            case when "totalInvoiceWaste"."employeeName" is null then "transferOutWaste"."employeeName" else "totalInvoiceWaste"."employeeName" end as "employeeName",
                            COALESCE(sum("totalInvoiceWaste"."wastageQty"::text::numeric),0)+ COALESCE(sum("transferOutWaste"."wastageQty"::text::numeric) ,0)as "wastageQty",
                            COALESCE(sum("totalInvoiceWaste"."wastageValue"),0)+COALESCE( sum("transferOutWaste"."wastageValue") ,0)as "wastageValue"
                        from "Products"
                        left join "totalInvoiceWaste" on "totalInvoiceWaste"."productId" = "Products".id
                        left join "transferOutWaste" on "transferOutWaste"."productId" = "Products".id
						where "Products"."companyId" = $1 
                        group by "Products".id ,"Products".name,"Products".barcode,"totalInvoiceWaste"."reason","totalInvoiceWaste"."employeeId",
                                                  "totalInvoiceWaste"."employeeName","transferOutWaste".reason,"transferOutWaste"."employeeId" ,"transferOutWaste"."employeeName"
                                        having  COALESCE(sum("totalInvoiceWaste"."wastageQty"),0)+ COALESCE(sum("transferOutWaste"."wastageQty") ,0) >0 
                        order by "Products".id ,"Products".name
                    `,
                values: [companyId, branches, from, to]
            }



            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`

            let records = await DB.excu.query(query.text + limitQuery, query.values)
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { wastageQty: t.totalWastageQty, wastageValue: t.totalWastageValue }
                resault = records.rows.map((e: any) => { return { productId: e.productId, productName: e.productName, barcode: e.barcode, wastageQty: e.wastageQty, wastageValue: e.wastageValue, reason: e.reason, employeeId: e.employeeId, employeeName: e.employeeName } })
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
                    title: "Wastage Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'productName' }, { key: 'barcode', properties: { columnType: 'barcode' } },
                { key: 'employeeName' },
                { key: 'wastageQty', properties: { hasTotal: true } },
                { key: 'wastageValue', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'reason' },
                ]
                report.fileName = 'wastageReport'
                return new ResponseData(true, "", report)
            }



            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async getManualAdjusmentInventoryMovment(company: Company, movmentLineId: string) {
        try {

            const companyId = company.id

            const query: { text: string, values: any } = {
                text: `wITH "values" AS (
                        select $1::uuid as "companyId",
                               $2::uuid AS "movmentLineId"
                        )
                        ,"records" as(
                        select 
                        "Employees".name as "employeeName",
                        "Products".name as "productName",
                        "InventoryMovmentLines"."productId",
                        "InventoryMovmentLines"."qty",
                        "InventoryMovmentLines"."cost",
                        "InventoryMovments"."branchId",
                        "InventoryMovments"."createdAt"
                        from "InventoryMovmentLines" 
                        inner join "InventoryMovments" ON "InventoryMovments".id = "InventoryMovmentLines"."inventoryMovmentId"
                        inner join "Products" ON "Products".id = "InventoryMovmentLines"."productId"
                        inner join "Branches" on "Branches".id = "InventoryMovments"."branchId"
                        inner join "values" on true
                        left join "Employees" on "Employees".id = "InventoryMovments"."employeeId"
                        where "Branches"."companyId"  = "values"."companyId"
                        and "InventoryMovmentLines"."id" = "values"."movmentLineId"
                        )
                        ,"currentOnHand" as (
                        select "records"."productId" , sum("InventoryMovmentRecords".qty) as "currentOnHand"
                        from "InventoryMovmentRecords" 
                        inner join "records" on  "InventoryMovmentRecords"."productId" = "records"."productId" 
                        where "InventoryMovmentRecords"."branchId" = "records"."branchId" 
                        and "InventoryMovmentRecords"."createdAt" < "records"."createdAt"
                        group by "records"."productId"
                        ) 
                        select "records".*, COALESCE("currentOnHand",0) as "currentOnHand", 0 as "currentUnitCost"
                        from "records"
                        left join "currentOnHand" on "currentOnHand". "productId"= "records"."productId"

                        `,
                values: [companyId, movmentLineId]
            }


            const movment = await DB.excu.query(query.text, query.values);
            if (movment.rows && movment.rows.length > 0) {
                return new ResponseData(true, "", movment)
            }
            return new ResponseData(true, "", [])


        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async inventoryTransferReport(data: any, company: Company, branchList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : branchList;
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

            let resault: any[] = [];

            const query: { text: string, values: any } = {
                text: `WITH inventory_transfers AS (
                        SELECT 
                            it.reason,
                            it.id, 
                            it."transferNumber",
                            it."branchId",
                            it."confirmDatetime",
                            it."destinationBranch",
                            it.type,
                            it.note,
                            "createdDate"
                        FROM "InventoryTransfers" it
                        JOIN (
                            SELECT id 
                            FROM "Branches"
                            WHERE "companyId" = $1
                                AND (($2::uuid[]) IS NULL OR id = ANY($2::uuid[]))
                        ) b ON it."branchId" = b.id  or it."destinationBranch" = b.id 
                        WHERE it."confirmDatetime" >= $3
                            AND it."confirmDatetime" < $4
                            AND it.status = 'Confirmed'
                   
                        ),
                        amount_data AS (
                        SELECT 
                            t.reason, 
                            t.id, 
                            t."transferNumber", 
                            SUM("InventoryTransferLines".qty * "InventoryMovmentRecords"."cost") AS amount ,
                            sum("InventoryTransferLines".qty) as "transferedQty",
                            "Branches"."name" as "branchName",
                            "disBranch"."name" as "destinationBranchName",
                            "type",
                            "note",
                            "createdDate",
                            "confirmDatetime"

                        FROM inventory_transfers AS t
                        JOIN "InventoryTransferLines" ON "inventoryTransferId" = t.id
                        left join "InventoryMovmentRecords" on "InventoryMovmentRecords"."companyId"= $1   AND (($2::uuid[]) IS NULL OR "InventoryMovmentRecords"."branchId" = ANY($2::uuid[]))
                        and "InventoryMovmentRecords"."referenceId" = "InventoryTransferLines"."id" and( t.reason <> 'To Another Branch' or "InventoryMovmentRecords"."qty" < 0 )
                        inner join "Branches" on "Branches"."companyId"  = $1  and "Branches"."id" = t."branchId" 
                        left join "Branches" "disBranch" on "disBranch"."companyId"  = $1  and  "disBranch"."id" =   t."destinationBranch"
                        GROUP BY t.id, t.reason, t."transferNumber",    "Branches"."name", "disBranch"."name", "type",   "note", "createdDate",  "confirmDatetime"
                        )
                        
                        `,
                values: [companyId, branches, from, to]
            }

            let lastSelect = `SELECT 
                                    reason,
                                    COUNT(id) AS "numberOfTransfers",
                                    SUM(amount::text::numeric) AS amount,
                                    JSON_AGG(
                                    JSONB_BUILD_OBJECT(
                                        'inventoryTransferId', id, 
                                        'transferNumber', "transferNumber", 
                                        'amount', amount,
                                        'type',"type",
                                        'note',"note",
                                        'confirmDatetime',"confirmDatetime",
                                        'createdDate',"createdDate",
                                        'destinationBranchName',"destinationBranchName",
                                        'branchName',  "branchName" ,
                                         'branchesNames', case when "destinationBranchName" is not null  then "branchName" || ' --> ' || "destinationBranchName" else "branchName" end ,
                                        'transferedQty',"transferedQty"
                                    )
                                    ) AS transctions
                                FROM amount_data
                                GROUP BY reason`

            if (filter.export && filter.export === true) {
                lastSelect = `SELECT 
                                reason, id, "transferNumber", amount, "type",
                                  case when "destinationBranchName" is not null  then "branchName" || ' --> ' || "destinationBranchName" else "branchName" end as "branchesNames",
                             "transferedQty",
                            "note",
                            "createdDate",
                            "confirmDatetime",
                            "branchName",
                            "destinationBranchName"
                           
                            FROM amount_data
                            order by reason`
            }


            let records = await DB.excu.query(query.text + lastSelect, query.values)
            if (records.rows && records.rows.length > 0) {
                resault = records.rows
            }


            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "InventoryTransferReport",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = resault
                report.columns = [{ key: 'reason', properties: { groupBy: true } },
                { key: 'transferNumber' },
                { key: 'type' },
                { key: 'branchesNames', header: 'Branch Name ' },
                { key: 'transferedQty' },
                { key: 'amount', properties: { columnType: 'currency', hasSubTotal: true, hasTotal: true }, },

                { key: 'note' },
                { key: 'createdDate', properties: { columnType: 'date-time' }, },
                { key: 'confirmDatetime', properties: { columnType: 'date-time' }, },

                ]
                report.fileName = 'inventoryTransferReport'
                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resault)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async expiredProductsReport(data: any, company: Company, branchList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : branchList;

            //---------------------------------------
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };

            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let offset = limit * (page - 1);

            let count = 0;
            let resault: any[] = [];
            let date = new Date()


            const query: { text: string, values: any } = {

                text: `  select count(*) over(), 
                        "Products".barcode, 
                        "Products".name as "productName", 
                        (batch),
                        "ProductBatches"."onHand" as quantity,
                        "ProductBatches"."expireDate" as "expirationDate",
                        "Branches".id as "branchId", 
                        "Branches".name as "branchName"
                      FROM "ProductBatches" 
                      INNER JOIN "BranchProducts" ON "BranchProducts".id = "ProductBatches"."branchProductId"
                      INNER JOIN "Products" on  "Products".id = "BranchProducts"."productId" AND "ProductBatches"."companyId" = "Products"."companyId"
                      INNER JOIN "Branches" ON "Branches".id = "BranchProducts"."branchId"
                      where "ProductBatches"."companyId" = $1
                        AND "expireDate" <= $2::timestamp 
                        AND  "ProductBatches"."onHand"> 0
                        AND ($3::uuid[] is null or "BranchProducts"."branchId" = any($3::uuid[]))
                     order by "Branches".id, "ProductBatches"."expireDate", "ProductBatches".id
                  
                      `,
                values: [companyId, date, branches],
            };

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
                    title: "Expired Products Report",
                    date: date,
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'productName' }, { key: 'barcode', properties: { columnType: 'barcode' } },
                { key: 'batch' },
                { key: 'quantity' },
                { key: 'expirationDate', properties: { columnType: 'date' } },
                { key: 'branchName' },
                ]
                report.fileName = 'ExpiredProductsReport'
                return new ResponseData(true, "", report)
            }



            return new ResponseData(true, "", resData)


        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    public static async reorderReport(data: any, company: Company, branchList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : branchList;

            //---------------------------------------
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };

            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);

            let offset = limit * (page - 1);

            let count = 0;
            let resault: any[] = [];


            const query: { text: string, values: any } = {

                text: `  select count(*) over(), 
                        	bp."productId",
                            "Products".name as "productName",
                            "Products".barcode,
                            "Products"."UOM",
                            bp."onHand", 
                            bp."reorderLevel",
                            bp."reorderPoint",
                            CASE 
                                WHEN bp."onHand" <= COALESCE(bp."reorderLevel", 0) THEN (COALESCE(bp."reorderPoint", 0) - bp."onHand")
                                ELSE 0
                            END AS "suggestedOrderQty",
                            bp."branchId",
                            b.name as "branchName"
                        FROM "BranchProducts" bp
                        join "Products" ON "Products".id = bp."productId"
                        join "Branches" b on "branchId" = b.id 
                        WHERE "Products"."companyId" = $1
                            and (($2::uuid[] IS NULL) OR bp."branchId" = any($2::uuid[]))
                            and "Products".type  = any(Array['inventory','batch','serialized']) 
                            and "Products"."isDeleted" = False 
                            and  ("onHand" <= COALESCE(bp."reorderLevel", 0) )
                        ORDER BY bp."branchId", bp."productId"`,
                values: [companyId, branches],
            };

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
                    title: "Reorder Report",
                    date: new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'productName' }, { key: 'barcode', properties: { columnType: 'barcode' } },
                { key: 'UOM' },
                { key: 'onHand', properties: { columnType: 'qty' } },
                { key: 'reorderLevel', properties: { columnType: 'qty' } },
                { key: 'reorderPoint', properties: { columnType: 'qty' } },
                { key: 'suggestedOrderQty', properties: { columnType: 'qty' } },
                { key: 'branchName' },
                ]
                report.fileName = 'reorderReport '
                return new ResponseData(true, "", report)
            }



            return new ResponseData(true, "", resData)


        } catch (error: any) {
          
            throw new Error(error)
        }
    }









}