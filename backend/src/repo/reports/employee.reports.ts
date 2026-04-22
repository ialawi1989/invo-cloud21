import { TimeHelper } from "@src/utilts/timeHelper"
import { ResponseData } from "@src/models/ResponseData"
import { DB } from "@src/dbconnection/dbconnection"
import { Company } from "@src/models/admin/company"
import moment from 'moment'

import { ReportData } from "@src/utilts/xlsxGenerator"
import { BranchesRepo } from "../admin/branches.repo"
import { CashierReport, ShortOver, PaymentByTender } from "@src/models/reports/CashierDetails"


/**
 * short over refunds
 */
export class EmployeeReports {
    public static async salesByEmployee(data: any, company: Company,branchList:any[]) {
        const client = await DB.excu.client()
        try {

            await client.query("BEGIN")
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;
         

             //-------------- set time --------------
             let closingTime = "00:00:00"
             let fromDate = data.interval && data.interval.from ? data.interval.from : null;
             fromDate = moment(new Date(fromDate))
             let toDate = data.interval && data.interval.to ?  moment(new Date(data.interval.to)) : moment( new Date());
             
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
            let limitQuery = ``
            const branches = data.branchId ? [data.branchId] : branchList;
  
            
         const query={
            text:`SELECT 
                            T."employeeName",
                            CAST (SUM(T."productQty")::NUMERIC AS REAL) as"productQty",
                            SUM(COALESCE(T."invoiceSales",0)::text::numeric)   as "invoiceTotal",
                            SUM(COALESCE(T."creditNoteSales",0)::text::numeric)  as "creditNoteTotal",
                            SUM(COALESCE(T."invoiceSales",0)::text::numeric) - SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as salesTotal  
                            FROM (SELECT
                                    COALESCE("Employees".name,'Others')as "employeeName",
                                    CAST (sum ("InvoiceLines".qty)as real) as "productQty",

                                        sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end)) as "invoiceSales",
                                    0 as "creditNoteSales"
                                from "InvoiceLines"
                                INNER JOIN "Invoices" ON "InvoiceLines" ."invoiceId" = "Invoices".id

                                INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id
                                LEFT JOIN "Employees" ON  "Employees".id = "InvoiceLines"."employeeId"
                                WHERE "Branches"."companyId"=$1 AND
								     ($2::UUID[] IS NULL OR "Branches".id = any($2))
								   AND  "InvoiceLines"."createdAt" >=$3 AND"InvoiceLines"."createdAt" <$4
                               AND "Invoices"."status" <>'Draft'
                                     GROUP BY  "Employees".id,"InvoiceLines"."createdAt"
                                 UNION ALL SELECT
                                        COALESCE("Employees".name,'Others')as "employeeName",
                                        CAST (sum ("CreditNoteLines".qty)AS REAL) as "productQty",
                                        0 as "invoiceSales",
                                        sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)) end)) as "creditNoteSales"
                                from "CreditNoteLines"
                                INNER JOIN "CreditNotes" ON "CreditNoteLines" ."creditNoteId" = "CreditNotes".id
                                INNER JOIN "Invoices" ON "CreditNotes" ."invoiceId" = "Invoices".id

                                INNER JOIN "Branches" ON "CreditNotes"."branchId" = "Branches".id
                                LEFT JOIN "Employees" ON  "Employees".id = "CreditNoteLines"."employeeId"
                                WHERE
                                    "Branches"."companyId"=$1 AND 
								    ($2::UUID[] IS NULL OR "Branches".id = any($2)) AND 
								  "CreditNoteLines"."createdAt" >=$3 AND "CreditNoteLines"."createdAt" <$4      
                                    GROUP BY  "Employees".id,"CreditNoteLines"."createdAt")T
                                    ${orderBy}
            GROUP BY T."employeeName"
            ${having}
            ${limitQuery}
            `,
            values:[companyId,branches,from, to ]
         }

            

            
            /**Only For dashboard */

            const reports = await client.query(query.text, query.values);

            await client.query("COMMIT")
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
            await client.query("ROLLBACK")
          
            throw new Error(error.message)
        }finally{
            client.release()
        }
    }

    public static async salesByEmployeeVsProducts(data: any, company: Company,branchList:[]) {
        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;
           
        //-------------- set time --------------
        let closingTime = "00:00:00"
        let fromDate = data.interval && data.interval.from ? data.interval.from : null;
        fromDate = moment(new Date(fromDate))
        let toDate = data.interval && data.interval.to ?  moment(new Date(data.interval.to)) : moment( new Date());
        
        let timeOffset = company.timeOffset
        let interval = await TimeHelper.getReportTime(fromDate,toDate,closingTime,false, timeOffset)
        let from = interval.from
        let to = interval.to
        //---------------------------------------
        
            const branches = data.branchId ? [data.branchId] :branchList ;

            const query={
                text:`SELECT 
                                T."employeeName",
                                T."productName",
                                SUM(T."productQty")::NUMERIC as  "productQty",
                                SUM(COALESCE(T.sales,0)::text::numeric)as sales
                            FROM (SELECT
                                        COALESCE("Employees".name ,'Others')as "employeeName",
                                        COALESCE("Products".name,"InvoiceLines".note ) as "productName",
                                        sum("InvoiceLines".qty) as "productQty",
                                        sum((case when "InvoiceLines"."isInclusiveTax" = false then COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("InvoiceLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("InvoiceLines"."taxTotal"::text::numeric,0)::text::numeric) end)) as sales
                                from "InvoiceLines"
                                INNER JOIN "Invoices" ON "InvoiceLines" ."invoiceId" = "Invoices".id
                                LEFT JOIN "Products" ON "InvoiceLines"."productId" = "Products".id
                                INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id
                                LEFT  JOIN"Employees" ON  "Employees".id = "InvoiceLines"."employeeId"
                                WHERE
                                    "Branches"."companyId"=$1 AND 
								      ($2::uuid[] is null or "Branches".id = any($2)) AND
								     "InvoiceLines"."createdAt" >=$3 AND"InvoiceLines"."createdAt" <$4
                                     AND "Invoices"."status" <>'Draft'
                                     GROUP BY  "Employees".id,"Products".id,"InvoiceLines"."createdAt", "productName"
                                 UNION ALL SELECT
                                        COALESCE("Employees".name ,'Others') as "employeeName",
                                        COALESCE("Products".name,"CreditNoteLines".note ) as "productName",
                                        sum("CreditNoteLines".qty)*(-1) as "productQty",
                                        sum((case when "CreditNoteLines"."isInclusiveTax" = false then COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("CreditNoteLines"."subTotal"::text::numeric,0)::text::numeric - COALESCE("CreditNoteLines"."taxTotal"::text::numeric,0)) end)) *(-1) as sales
                                    from "CreditNoteLines"
                                    INNER JOIN "CreditNotes" ON "CreditNoteLines" ."creditNoteId" = "CreditNotes".id
                                    LEFT JOIN "Products" ON "CreditNoteLines"."productId" = "Products".id
                                    INNER JOIN "Branches" ON "CreditNotes"."branchId" = "Branches".id
                                    LEFT  JOIN"Employees" ON  "Employees".id = "CreditNoteLines"."employeeId"
                                    WHERE
                                    "Branches"."companyId"=$1 AND
								  	($2::uuid[] is null or "Branches".id = any($2)) AND
								   "CreditNoteLines"."createdAt" >=$3 AND "CreditNoteLines"."createdAt" <$4       
                             GROUP BY  "Employees".id,"Products".id,"CreditNoteLines"."createdAt", "productName")T
            GROUP BY  T."employeeName",T."productName"`,
            values:[companyId,branches,from,to]
            }
            const reports = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async cashierReport(data: any, company: Company,brancheList:[]) {
        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;
               
        //-------------- set time --------------
        let closingTime = "00:00:00"
        let fromDate = data.interval && data.interval.from ? data.interval.from : null;
        fromDate = moment(new Date(fromDate))
        let toDate = data.interval && data.interval.to ?  moment(new Date(data.interval.to)) : moment( new Date());
        
        let timeOffset = company.timeOffset
        let interval = await TimeHelper.getReportTime(fromDate,toDate,closingTime,false, timeOffset)
        let from = interval.from
        let to = interval.to
        //---------------------------------------
        
            const branches = data.branchId?[data.branchId]:brancheList;
            const query={
                text:` with "cashiers" as (select 
                                                "Cashiers".id,
                                                "Cashiers"."cashierIn",
                                                "Cashiers"."cashierOut",
                                                "Cashiers"."startAmount",
                                                "Employees".name as "employeeName",
                                                "Cashiers"."endAmount"
                                                from "Cashiers"
                                                INNER JOIN "Employees" on "Cashiers"."employeeId" =  "Employees".id
                                                INNER JOIN "Branches" on "Branches".id ="Cashiers"."branchId"  WHERE  "Branches"."companyId"=$1 
					                            AND ($2::uuid[] is null or "Branches".id = any($2))
					                            AND   "Cashiers"."cashierIn" >=$3 AND "Cashiers"."cashierIn" <$4 ),
                                "payments" as (
                                select "cashiers".id, sum( "InvoicePaymentLines".amount::numeric) as total , count("InvoicePaymentLines".id) as "transactions"  from "cashiers"
                                inner join "InvoicePayments" on "InvoicePayments"."cashierId" = "cashiers".id
                                inner join "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" ="InvoicePayments".id
                                group by "cashiers".id
                                ),
                                "refunds" as (
                                select "cashiers".id, sum( "CreditNoteRefunds".total::numeric) as total from "cashiers"
                                inner join "CreditNoteRefunds" on "CreditNoteRefunds"."cashierId" = "cashiers".id
                                group by "cashiers".id
                                )

                                select "cashiers".*,
                                "payments".total as "totalPayment",
                                "payments".transactions as "transactions",

                                COALESCE("refunds".total,0) as "totalRefunds"
                                from "cashiers"
                                inner join "payments" on "payments".id = "cashiers".id
                                left join "refunds" on "refunds".id = "cashiers".id`,
                values:[companyId,branches,from,to]
            }
            let reports = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    public static async driverReport(data: any, company: Company,brancheList:[]) {
        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;
              
        //-------------- set time --------------
        let closingTime = "00:00:00"
        let fromDate = data.interval && data.interval.from ? data.interval.from : null;
        fromDate = moment(new Date(fromDate))
        let toDate = data.interval && data.interval.to ?  moment(new Date(data.interval.to)) : moment( new Date());
        
        let timeOffset = company.timeOffset
        let interval = await TimeHelper.getReportTime(fromDate,toDate,closingTime,false, timeOffset)
        let from = interval.from
        let to = interval.to
        //---------------------------------------
        
            const branches = data.branchId ?[data.branchId]: brancheList;
            const query={
                text:`SELECT 
                            "Employees".id,
                            "Employees".name as "employeeName",
                            count("Invoices".id) "invoiceQty",
                            sum( "Invoices".total)"invoiceTotal",
                            avg(EXTRACT(EPOCH FROM ("Invoices"."arrivalTime"::timestamp - "Invoices"."departureTime"::timestamp)))  as "avgDeliveryTime"
                    FROM "Invoices"
                    INNER JOIN "Employees" ON "Invoices"."driverId"  = "Employees".id
                    INNER JOIN "Branches" ON "Invoices"."branchId"  = "Branches".id 
                    WHERE  "Branches"."companyId"=$1  AND "Invoices"."status" <>'Draft'  
					AND ($2::UUID[] IS NULL OR "Branches".id = any($2))
					AND   "Invoices"."arrivalTime" >=$3 AND "Invoices"."arrivalTime" <$4   group by"Employees".id`,
              values :[companyId,branches,from,to]
            }
            let reports = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    public static async driverDetailsReport(data: any, company: Company,brancheList:[]) {
        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;
              
        //-------------- set time --------------
        let closingTime = "00:00:00"
        let fromDate = data.interval && data.interval.from ? data.interval.from : null;
        fromDate = moment(new Date(fromDate))
        let toDate = data.interval && data.interval.to ?  moment(new Date(data.interval.to)) : moment( new Date());
        
        let timeOffset = company.timeOffset
        let interval = await TimeHelper.getReportTime(fromDate,toDate,closingTime,false, timeOffset)
        let from = interval.from
        let to = interval.to
        //---------------------------------------
        
            const branches = data.branchId ? [data.branchId] : brancheList;
            const query={
                text:`SELECT 
                            "Employees".id,
                            "Employees".name as "employeeName",
                            "Invoices".id,
                            "Invoices".total as "invoiceTotal",
                            "Invoices"."departureTime",
                            "Invoices"."arrivalTime",
                            EXTRACT(EPOCH FROM ("Invoices"."arrivalTime"::timestamp - "Invoices"."departureTime"::timestamp)) as "deliveryTime",  
                            "Invoices"."customerAddress"
                        FROM "Invoices"
                        INNER JOIN "Employees" ON "Invoices"."driverId"  = "Employees".id
                        INNER JOIN "Branches" ON "Invoices"."branchId"  = "Branches".id WHERE  "Branches"."companyId"=$1  
						AND ($2::UUID[] IS NULL OR "Branches".id = any($2))
						AND "Invoices"."status" <>'Draft' AND   "Invoices"."arrivalTime" >=$3 AND "Invoices"."arrivalTime" <$4   group by"Employees".id,"Invoices".id`,
                values :[companyId,branches,from,to]
            }
            let reports = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    /**new Reports */
    // public static async selectedColumnsString(columns:[]){
    //     try {
    //         let filterColumns:any[]=[]
    //         let groupByColumns:any[]=[];
    //         let columnsName:any[]=[]

    //         let invoiceColumns:any[]=[]
    //         let creditNoteColumns:any[]=[]
    //         let total:any[]=[]
    //         columns.forEach(element => {
    //             switch (element) {
    //                     case 'prodQtyTotal':
    //                       invoiceColumns.push('IL.qty as qty');
    //                       creditNoteColumns.push('CNL.qty*(-1) as qty')
    //                       total.push('T.qty')
    //                     break;
    //                     case 'invoiceProdQty':
    //                       invoiceColumns.push('IL.qty as "invoiceProdQty');
    //                       creditNoteColumns.push('0 as "invoiceProdQty')
    //                       columnsName.push('"T.invoiceProdQty"')
    //                     break;
    //                     case 'CreditNoteProdQty':
    //                         invoiceColumns.push('IL.qty as "CreditNoteProdQty');
    //                         creditNoteColumns.push('0 as "CreditNoteProdQty')
    //                       columnsName.push('T."CreditNoteProdQty"')
    //                     break;
    //                 default:
    //                     break;
    //             }
    //         });

    //         const selectedString =','+ filterColumns.join(",");
    //         const groupByString = ',' + groupByColumns.join(",");
    //         const columnsNameString = ',' + columnsName.join(",");



    //         return {selectedString:selectedString,
    //             groupByString:groupByString,
    //             columnsNameString:columnsNameString
    //               } ;
    //     } catch (error:any) {
    //         throw new Error(error)
    //     }
    // }

    public static async salesByEmployeeWithAdvanceFilter(data: any, company: Company) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : [];
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? filter.fromDate : null;
            fromDate = moment(new Date(fromDate))
            let toDate = filter && filter.toDate ?  moment(new Date(filter.toDate)) : moment( new Date());
            
            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate,toDate,closingTime,false, timeOffset)
            let from = interval.from
            let to = interval.to
            
            //---------------------------------------

            let invoiceEmployee = filter && filter.isSalesEmployee == true ?  `IL."salesEmployeeId" as "employeeId"` : `IL."employeeId"` 
            let creditNoteEmployee = filter && filter.isSalesEmployee == true ? `CNL."salesEmployeeId" as "employeeId"` : `CNL."employeeId"`



             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);



            let offset = limit * (page - 1);

            let total ={};
            let count = 0 ;
            let resault:any[] = []; 

            const query: { text: string, values: any } = {
                text:`with "values" as (
                    select $1::uuid as "companyId",
                           $2::uuid[] as "branches",
                           $3::timestamp as "fromDate",
                           $4::timestamp as "toDate"
                    )
                    ,"invoiceData" as(
                    select  ${invoiceEmployee},
                            sum(COALESCE(IL.qty,0)  :: text :: NUMERIC) as "invoiceProdQty",
                            sum(case when IL."isInclusiveTax" = true then ((COALESCE(IL."subTotal",0)::text::numeric) - (COALESCE(IL."taxTotal",0)::text::numeric)) else COALESCE(IL."subTotal",0)::text::numeric end) as "invoiceSales",
                            0  AS "creditNoteProdQty",
                            0 AS "creditNoteSales"
                    from "InvoiceLines" as IL
                    join "values" on true
                    inner join "Invoices" as invo on invo.id = IL."invoiceId"
                    inner join "Branches" as branches on branches.id = invo."branchId"
                    where branches."companyId" = "values"."companyId"  
                        and invo."status" <> 'Draft' 
                        and (array_length("values"."branches",1) IS NULL or  branches.id = Any("values"."branches"))
                        and (IL."createdAt" >= "values"."fromDate" and IL."createdAt" < "values"."toDate"  )
                    group by ${invoiceEmployee}
                    )
                    ,"creditNoteData" as(
                    select  ${creditNoteEmployee},
                            0 as "invoiceProdQty",
                            0 as "invoiceSales",
                            sum(COALESCE(CNL.qty,0)  :: text :: NUMERIC)  AS "creditNoteProdQty",
                            sum(case when CNL."isInclusiveTax" = true then ((COALESCE(CNL."subTotal",0)::text::numeric) - (COALESCE(CNL."taxTotal",0)::text::numeric)) else COALESCE(CNL."subTotal",0)::text::numeric end) AS "creditNoteSales"
                    from "CreditNoteLines" as CNL
                    join "values" on true
                    inner join "CreditNotes" as CN on CN.id = CNL."creditNoteId"
                    inner join "Branches" as branches on branches.id = CN."branchId"
                    where branches."companyId" = "values"."companyId"  
                        and (array_length("values"."branches",1) IS NULL or  branches.id = Any("values"."branches"))
                        and (CNL."createdAt" >=  "values"."fromDate" and CNL."createdAt" < "values"."toDate")
                    group by ${creditNoteEmployee}
                    )
                    select count(*) over(),
                            sum(SUM(COALESCE(T."invoiceProdQty",0)::text::numeric)) over() as "invoiceProdQtyTotal",
                            sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric)) over() as "invoiceSalesTotal",
                            sum(SUM(COALESCE(T."creditNoteProdQty",0)::text::numeric)) over() as "creditNoteProdQtyTotal",
                            sum(SUM(COALESCE(T."creditNoteSales",0)::text::numeric)) over() as "creditNoteSalesTotal",
                            sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))) over() as "salesTotal",
                            sum(SUM(COALESCE(T."invoiceProdQty",0)::text::numeric - (COALESCE(T."creditNoteProdQty",0)::text::numeric))) over() as "salesQtyTotal",
                            
                            "Employees".id,
                            (case when "Employees".id is not null then COALESCE(NULLIF("Employees".name,''),'Employee') else 'Unknown' end) as "name",
                            SUM(COALESCE(T."invoiceProdQty",0)::text::numeric) as "invoiceProdQty",
                            SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoiceSales",	   
                            SUM(COALESCE(T."creditNoteProdQty",0)::text::numeric) as "creditNoteProdQty",
                            SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "creditNoteSales",
                            SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric)) as "totalSales",
                            SUM(COALESCE(T."invoiceProdQty",0)::text::numeric - (COALESCE(T."creditNoteProdQty",0)::text::numeric)) as "totalSalesQty"
                    from(select * from "invoiceData" union all select * from "creditNoteData")T
                    left join "Employees" on "Employees".id = T."employeeId"
                    group by "Employees".id 
                    order by "Employees".id
                        
                    limit ${limit}
                    offset ${offset}
                    `,
                values:[companyId,branches,from,to ]
            }
          

            const records = await DB.excu.query(query.text, query.values);
            if (records.rows && records.rows.length > 0 ){
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total =  {invoiceProdQty: t.invoiceProdQtyTotal, invoiceSales: t.invoiceSalesTotal, creditNoteProdQty: t.creditNoteProdQtyTotal, creditNoteSales: t.creditNoteSalesTotal, totalSales : t.salesTotal, totalSalesQty: t.salesQtyTotal} 
                resault = records.rows.map((e: any) => {return {id : e.id, employeeName:e.name ,invoiceProdQty: e.invoiceProdQty, invoiceSales: e.invoiceSales,
                                                                creditNoteProdQty: e. creditNoteProdQty, creditNoteSales: e.creditNoteSales, 
                                                                totalSales: e.totalSales, totalSalesQty : e.totalSalesQty }} )
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
            console.log(error)
          

            throw new Error(error)
        }
    }

    public static async salesByEmployeeReport(data: any, company: Company,brancheList:[]) {
        const client = await DB.excu.client()
        try {

            await client.query("BEGIN")
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches :brancheList;
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
             if(!Array.isArray(branches) || branches.length == 0){ branches = null  };
            let invoiceEmployee = filter && filter.isSalesEmployee == true ?  `"lines"."salesEmployeeId" ` : `"lines"."employeeId"` 
            let creditNoteEmployee = filter && filter.isSalesEmployee == true ? `"creditNoteLines"."salesEmployeeId" ` : `"creditNoteLines"."employeeId"`



             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);



            let offset = limit * (page - 1);

            let total ={};
            let count = 0 ;
            let resault:any[] = []; 
            
             //######################## sort ########################

             let sortby   = filter && filter.sortBy ? filter.sortBy : [];
             let sortList = sortby.filter((item: any) => item.sortValue && item.sortValue.trim() !== "");
         
            // if (sortList.length < 1) { sortList.push({ sortValue: "productName", sortDirection: 'asc' }) }
 
             let orderByQuery = "order by ";
             for (let i = 0; i < sortList.length; i++) {
                 orderByQuery += `"${sortList[i].sortValue.trim()}" ${sortList[i].sortDirection ?? ""}`;
                 orderByQuery += ", ";  
             }
             orderByQuery += ` "Employees".id `
             
              //######################################################

            const query: { text: string, values: any } = {
                text:`with "lines" as (
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
                select   ${invoiceEmployee} as "employeeId",
                     
             
				    	COALESCE("lines".qty,0)  as "invoiceProdQty",
                        "sales" as "invoiceSales",
                        0  AS "creditNoteProdQty",
                       0 AS "creditNoteSales"
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
                    "CreditNoteLines"."creditNoteId",
					    "CreditNoteLines"."employeeId",
                    "CreditNoteLines"."salesEmployeeId"
                from "CreditNoteLines"
                where "CreditNoteLines"."companyId" = $1
                and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  =any($2::uuid[]))
                and ("CreditNoteLines"."createdAt" >=$3 and "CreditNoteLines"."createdAt" < $4)
         
                ),
                "creditNoteData" as (
                select    ${creditNoteEmployee} as "employeeId",
                
                     
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
                )
				select count(*) over(),
                            sum(SUM(COALESCE(T."invoiceProdQty",0)::text::numeric)) over() as "invoiceProdQtyTotal",
                            sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric)) over() as "invoiceSalesTotal",
                            sum(SUM(COALESCE(T."creditNoteProdQty",0)::text::numeric)) over() as "creditNoteProdQtyTotal",
                            sum(SUM(COALESCE(T."creditNoteSales",0)::text::numeric)) over() as "creditNoteSalesTotal",
                            sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))) over() as "salesTotal",
                            sum(SUM(COALESCE(T."invoiceProdQty",0)::text::numeric - (COALESCE(T."creditNoteProdQty",0)::text::numeric))) over() as "salesQtyTotal",
                            
                            "Employees".id,
                            (case when "Employees".id is not null then COALESCE(NULLIF("Employees".name,''),'Employee') else 'Unknown' end) as "employeeName",
                            SUM(COALESCE(T."invoiceProdQty",0)::text::numeric) as "invoiceProdQty",
                            SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoiceSales",	   
                            SUM(COALESCE(T."creditNoteProdQty",0)::text::numeric) as "creditNoteProdQty",
                            SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "creditNoteSales",
                            SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric)) as "totalSales",
                            SUM(COALESCE(T."invoiceProdQty",0)::text::numeric - (COALESCE(T."creditNoteProdQty",0)::text::numeric)) as "totalSalesQty"
                    from T
                    left join "Employees" on "Employees".id = T."employeeId"
                    group by "Employees".id 
                   
                    `,
                values:[companyId,branches,from,to ]
            }

            let limitQuery = filter.export && filter.export === true ? '': `limit ${limit}
                                                                            offset ${offset}`

           const records = await client.query(query.text+limitQuery, query.values)
          
            if (records.rows && records.rows.length > 0 ){
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total =  {invoiceProdQty: t.invoiceProdQtyTotal, invoiceSales: t.invoiceSalesTotal, creditNoteProdQty: t.creditNoteProdQtyTotal, creditNoteSales: t.creditNoteSalesTotal, totalSales : t.salesTotal, totalSalesQty: t.salesQtyTotal} 
                resault = records.rows.map((e: any) => {return {id : e.id, employeeName:e.employeeName ,invoiceProdQty: e.invoiceProdQty, invoiceSales: e.invoiceSales,
                                                                creditNoteProdQty: e. creditNoteProdQty, creditNoteSales: e.creditNoteSales, 
                                                                totalSales: e.totalSales, totalSalesQty : e.totalSalesQty }} )
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

            if(filter.export){
                let report = new ReportData()
                report.filter = { title:"Sales By Employee", 
                                  fromDate: filter && filter.fromDate ? filter.fromDate : null , 
                                  toDate: filter && filter.toDate ? filter.toDate : new Date(),
                                  branches: branches
                                }
                report.records = records.rows
                report.columns = [  {key:'employeeName'},
                                    {key:'invoiceProdQty', header:'Invoice Product Qty', properties:{hasTotal:true} },
                                    {key:'invoiceSales',properties:{hasTotal:true,columnType:'currency'} },
                                    {key:'creditNoteProdQty',header: 'Credit Note Prod Qty', properties:{hasTotal:true} },
                                    {key:'creditNoteSales',properties:{hasTotal:true,  columnType:'currency'} } ,
                                    {key:'totalSalesQty', header:'Total Sales Quantity', properties:{hasTotal:true} },
                                    {key:'totalSales',properties:{hasTotal:true,columnType:'currency'} }
                                ]
                report.fileName = 'salesByEmployee'
                return new ResponseData(true, "", report)
            }


            await client.query("COMMIT")

            return new ResponseData(true, "", resData)
        } catch (error: any) {
            await client.query("ROLLBACK")
          

            throw new Error(error)
        }finally{
            client.release()
        }
    }

    public static async salesByProductVsEmployee(data: any, company: Company,brancheList:[]) {
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
          if(!Array.isArray(branches) || branches.length == 0){ branches = null  };

            let invoiceEmployee = filter && filter.isSalesEmployee == true ?  `"lines"."salesEmployeeId"` : `"lines"."employeeId"` 
            let creditNoteEmployee = filter && filter.isSalesEmployee == true ? `"creditNoteLines"."salesEmployeeId"` : `"creditNoteLines"."employeeId"`



             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);



            let offset = limit * (page - 1);

            let total ={};
            let count = 0 ;
            let resault:any[] = []; 

            const query: { text: string, values: any } = {
                text:`with "lines" as (
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
                select    ${invoiceEmployee} as "employeeId",
                             "productId",
                                "lines"."note", 
				    	COALESCE("lines".qty,0)  as "invoiceProdQty",
                        "sales" as "invoiceSales",
                        0  AS "creditNoteProdQty",
                       0 AS "creditNoteSales"
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
                    "CreditNoteLines"."creditNoteId",
					    "CreditNoteLines"."employeeId",
                    "CreditNoteLines"."salesEmployeeId"
                from "CreditNoteLines"
                where "CreditNoteLines"."companyId" = $1
                and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  =any($2::uuid[]))
                and ("CreditNoteLines"."createdAt" >=$3 and "CreditNoteLines"."createdAt" < $4)
         
                ),
                "creditNoteData" as (
                select    ${creditNoteEmployee} as "employeeId",
                        "productId",
                       "creditNoteLines"."note", 
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
                )
				 select count(*) over(),
                            sum(SUM(COALESCE(T."invoiceProdQty",0)::text::numeric)) over() as "invoiceProdQtyTotal",
                            sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric)) over() as "invoiceSalesTotal",
                            sum(SUM(COALESCE(T."creditNoteProdQty",0)::text::numeric)) over() as "creditNoteProdQtyTotal",
                            sum(SUM(COALESCE(T."creditNoteSales",0)::text::numeric)) over() as "creditNoteSalesTotal",
                            sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))) over() as "salesTotal",
                            sum(SUM(COALESCE(T."invoiceProdQty",0)::text::numeric - (COALESCE(T."creditNoteProdQty",0)::text::numeric))) over() as "salesQtyTotal",
                            
                            sum(SUM(COALESCE(T."invoiceProdQty",0)::text::numeric)) over(partition by "Employees".id) as "invoiceProdQtyPerEmployee",
                            sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric)) over(partition by "Employees".id) as "invoiceSalesPerEmployee",
                            sum(SUM(COALESCE(T."creditNoteProdQty",0)::text::numeric)) over(partition by "Employees".id) as "creditNoteProdQtyPerEmployee",
                            sum(SUM(COALESCE(T."creditNoteSales",0)::text::numeric)) over(partition by "Employees".id) as "creditNoteSalesPerEmployee",
                            sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))) over(partition by "Employees".id) as "salesTotalPerEmployee",
                            sum(SUM(COALESCE(T."invoiceProdQty",0)::text::numeric - (COALESCE(T."creditNoteProdQty",0)::text::numeric))) over(partition by "Employees".id) as "salesQtyTotalPerEmployee",
                            
                            
                            "Employees".id as "employeeId",
                            (case when "Employees".id is not null then COALESCE(NULLIF("Employees".name,''),'Employee') else 'Unknown' end) as "employeeName",
                            "Products".id as "productId",
                            COALESCE("Products".name,T.note ) as "productName",
                            SUM(COALESCE(T."invoiceProdQty",0)::text::numeric) as "invoiceProdQty",
                            SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoiceSales",	   
                            SUM(COALESCE(T."creditNoteProdQty",0)::text::numeric) as "creditNoteProdQty",
                            SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "creditNoteSales",
                            SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric)) as "totalSales",
                            SUM(COALESCE(T."invoiceProdQty",0)::text::numeric - (COALESCE(T."creditNoteProdQty",0)::text::numeric)) as "totalSalesQty"
                    from(select * from "invoiceData" union all select * from "creditNoteData")T
                    LEFT join "Products" on "Products".id = T."productId"
                    left join "Employees" on "Employees".id = T."employeeId"
                    group by "Employees".id , "Products".id, "productName"
                    order by "Employees".id , "Products".id,"productName"
                        
                   
                    `,
                values:[companyId,branches,from,to ]
            }

            let limitQuery = filter.export && filter.export === true ? '': `limit ${limit}
                                                                            offset ${offset}`

            const records = await client.query(query.text+limitQuery, query.values)
          
            if (records.rows && records.rows.length > 0 ){
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total =  {invoiceProdQty: t.invoiceProdQtyTotal, invoiceSales: t.invoiceSalesTotal, creditNoteProdQty: t.creditNoteProdQtyTotal, creditNoteSales: t.creditNoteSalesTotal, totalSales : t.salesTotal, totalSalesQty: t.salesQtyTotal} 
                resault = records.rows.map((e: any) => {return {employeeId : e.employeeId, employeeName:e.employeeName , 
                                                                productId : e.productId, productName: e.productName,
                                                                invoiceProdQtyPerEmployee: e.invoiceProdQtyPerEmployee, invoiceSalesPerEmployee: e.invoiceSalesPerEmployee, 
                                                                creditNoteProdQtyPerEmployee: e.creditNoteProdQtyPerEmployee, creditNoteSalesPerEmployee: e.creditNoteSalesPerEmployee, 
                                                                totalSalesPerEmployee : e.salesTotalPerEmployee, totalSalesQtyPerEmployee: e.salesQtyTotalPerEmployee,

                                                                invoiceProdQty: e.invoiceProdQty, invoiceSales: e.invoiceSales,
                                                                creditNoteProdQty: e. creditNoteProdQty, creditNoteSales: e.creditNoteSales, 
                                                                totalSales: e.totalSales, totalSalesQty : e.totalSalesQty }} )
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

            if(filter.export){
                let report = new ReportData()
                report.filter = { title:"Sales By Employee Vs Products", 
                                  fromDate: filter && filter.fromDate ? filter.fromDate : null , 
                                  toDate: filter && filter.toDate ? filter.toDate : new Date(),
                                  branches: branches
                                }
                report.records = records.rows
                report.columns = [  {key:'employeeName'},
                                    {key:'productName'},
                                    {key:'invoiceProdQty', header:'Invoice Product Qty', properties:{hasSubTotal:true, hasTotal:true} },
                                    {key:'invoiceSales',properties:{hasSubTotal:true, hasTotal:true,columnType:'currency'} },
                                    {key:'creditNoteProdQty',header: 'Credit Note Prod Qty', properties:{hasSubTotal:true, hasTotal:true} },
                                    {key:'creditNoteSales',properties:{hasSubTotal:true, hasTotal:true,  columnType:'currency'} } ,
                                    {key:'totalSalesQty', header:'Total Sales Quantity', properties:{hasSubTotal:true, hasTotal:true} },
                                    {key:'totalSales',properties:{hasSubTotal:true, hasTotal:true,columnType:'currency'} }
                                ]
                report.fileName = 'salesByEmployeeVsProducts'
                return new ResponseData(true, "", report)
            }

            await client.query("COMMIT")

            return new ResponseData(true, "", resData)
        } catch (error: any) {
            await client.query("ROLLBACK")
          

            throw new Error(error)
        }finally{
            client.release()
        }
    }

    public static async getDriverReport(data: any, company: Company,brancheList:[]) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
           //-------------- set time --------------
           let closingTime = "00:00:00"
           let fromDate = filter && filter.fromDate ? filter.fromDate : null;
           fromDate = moment(new Date(fromDate))
           let toDate = filter && filter.toDate ?  moment(new Date(filter.toDate)) : moment( new Date());
           
           let timeOffset = company.timeOffset
           let interval = await TimeHelper.getReportTime(fromDate,toDate,closingTime,false, timeOffset)
           let from = interval.from
           let to = interval.to
           
           //---------------------------------------
           if(!Array.isArray(branches) || branches.length == 0){ branches = null  };

             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let offset = limit * (page - 1);

            let total ={};
            let count = 0 ;
            let resault:any[] = []; 

             //######################## sort ########################

             let sortby   = filter && filter.sortBy ? filter.sortBy : [];
             let sortList = sortby.filter((item: any) => item.sortValue && item.sortValue.trim() !== "");
         
            // if (sortList.length < 1) { sortList.push({ sortValue: "productName", sortDirection: 'asc' }) }
 
             let orderByQuery = "order by ";
             for (let i = 0; i < sortList.length; i++) {
                 orderByQuery += `"${sortList[i].sortValue.trim()}" ${sortList[i].sortDirection ?? ""}`;
                 orderByQuery += ", ";  
             }
             orderByQuery += ` "Employees".id `
             
              //######################################################
            

            const query: { text: string, values: any } = {
                text:`with "values" as (
                        select $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::timestamp as "fromDate",
                            $4::timestamp as "toDate",
                            $5::INT as "afterDecimal"
                        )
                        SELECT  count(*) over()::real,
                                CAST( sum(count("Invoices".id)) over() AS float) as "totalInvoiceQty",
                                CAST( sum(Round(sum("Invoices".total::text::numeric),"afterDecimal")) over()  AS float) as "invoiceTotals",
                                "Employees".id AS "employeeId",
                                "Employees".name as "employeeName",
                                count("Invoices".id) "invoiceQty",
                                sum("Invoices".total::text::numeric)::float "invoiceTotal",
                                avg(extract(epoch from  "Invoices"."arrivalTime"::timestamp - "Invoices"."departureTime"::timestamp)) as "avgDeliveryTime"
                        from "Invoices"
                        join "values" on true
                        inner join "Employees" on "Invoices"."driverId"  = "Employees".id
                        inner join "Branches" on  "Invoices"."branchId"  = "Branches".id 
                        where  "Invoices"."companyId"= "values"."companyId"
                            and ( array_length("values"."branches",1) IS NULL OR "Invoices"."branchId"= any( "values"."branches"))
                            and ( "Invoices"."arrivalTime" > "values"."fromDate" AND  "Invoices"."arrivalTime" < "values"."toDate")
                            and "Invoices"."status" <>'Draft'  
                        group by "Employees".id, "afterDecimal"
                        ${orderByQuery}

                    
                    `,
                values:[companyId,branches,from,to, afterDecimal]
            }

            let limitQuery = filter.export && filter.export === true ? '': `limit ${limit}
                                                                            offset ${offset}`


            const records = await DB.excu.query(query.text+limitQuery, query.values);

            if (records.rows && records.rows.length > 0 ){
                let t = (<any>records.rows[0])
                count = Number(t.count)

                total =  {invoiceQty:t.totalInvoiceQty, invoiceTotal: t.invoiceTotals} 
                resault = records.rows.map((e: any) => {return {employeeName: e.employeeName,  employeeId: e.employeeId,
                                                                 invoiceQty: e.invoiceQty, invoiceTotal: e.invoiceTotal,
                                                                 avgDeliveryTime: e.avgDeliveryTime }} )

                //let a = _.chain(resault).groupBy(['categoryName','CategoryQtyTotal'] ).map((value,[categoryName,CategoryQtyTotal])=>({categoryName:categoryName ,CategoryQtyTotal:CategoryQtyTotal , products: value})).value()
               // console.log(a)

                
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

            if(filter.export){
                let report = new ReportData()
                
                report.filter = { title:"Driver Summary Report", 
                                  fromDate: filter && filter.fromDate ? filter.fromDate : null , 
                                  toDate: filter && filter.toDate ? filter.toDate : new Date(),
                                  branches: branches
                                }
                report.records = records.rows
                report.columns = [  {key:'employeeName'},
                                    {key:'invoiceQty',header:'Invoice Quantity',  properties:{hasTotal:true} },
                                    {key:'invoiceTotal',properties:{hasTotal:true,columnType:'currency'} },
                                    {key:'avgDeliveryTime', header:'Average Delivery Time',  properties:{columnType:'timeInMinutes'} }
                                ]
                report.fileName = 'driverSummaryReport'
                return new ResponseData(true, "", report)
            }



            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async getDriverDetailsReport(data: any, company: Company,brancheList:[]) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
             //-------------- set time --------------
             let closingTime = "00:00:00"
             let fromDate = filter && filter.fromDate ? filter.fromDate : null;
             fromDate = moment(new Date(fromDate))
             let toDate = filter && filter.toDate ?  moment(new Date(filter.toDate)) : moment( new Date());
             
             let timeOffset = company.timeOffset
             let interval = await TimeHelper.getReportTime(fromDate,toDate,closingTime,false, timeOffset)
             let from = interval.from
             let to = interval.to
             
             //---------------------------------------
             if(!Array.isArray(branches) || branches.length == 0){ branches = null  };

             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let offset = limit * (page - 1);

            let count = 0 ;
            let resault:any[] = []; 

            const query: { text: string, values: any } = {
                text:`with "values" as (
                        select $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::timestamp as "fromDate",
                            $4::timestamp as "toDate",
                            $5::INT as "afterDecimal"
                        )
                        SELECT  count(*) over()::real,	
                                "Employees".id as "employeeId",
                                "Employees".name as "employeeName",
                                "Invoices".id as "invoiceId",
                                "Invoices"."invoiceNumber",
                                "Invoices".total as "invoiceTotal",
                                "Invoices"."departureTime",
                                "Invoices"."arrivalTime",
                                EXTRACT(EPOCH FROM ("Invoices"."arrivalTime"::timestamp - "Invoices"."departureTime"::timestamp)) as "deliveryTime"
                        from "Invoices"
                        join "values" on true
                        inner join "Employees" on "Invoices"."driverId"  = "Employees".id
                        inner join "Branches" on  "Invoices"."branchId"  = "Branches".id 
                        where  "Invoices"."companyId"= "values"."companyId"
                            and ( array_length("values"."branches",1) IS NULL OR "Invoices"."branchId" = any( "values"."branches"))
                            and ( "Invoices"."arrivalTime" > "values"."fromDate" AND  "Invoices"."arrivalTime" < "values"."toDate")
                            and "Invoices"."status" <>'Draft'  
                        group by "Employees".id, "Invoices".id
                        order by "Invoices"."departureTime"

                    `,
                values:[companyId,branches,from,to, afterDecimal]
            }

            let limitQuery = filter.export && filter.export === true ? '': `limit ${limit}
                                                                            offset ${offset}`


            const records = await DB.excu.query(query.text+limitQuery, query.values);

            if (records.rows && records.rows.length > 0 ){
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

            if(filter.export){
                let report = new ReportData()
                records.rows.forEach((elem:any) => {//elem.deliveryTime = elem.deliveryTime/60;
                   elem.departureTime =  moment.utc(elem.departureTime).utcOffset( +timeOffset ).format('YYYY-MM-DD hh:mm');
                   elem.arrivalTime =  moment.utc(elem.arrivalTime).utcOffset( +timeOffset ).format('YYYY-MM-DD hh:mm');


                })
                report.filter = { title:"Driver Report", 
                                  fromDate: filter && filter.fromDate ? filter.fromDate : null , 
                                  toDate: filter && filter.toDate ? filter.toDate : new Date(),
                                  branches: branches
                                }
                report.records = records.rows
                report.columns = [  {key:'employeeName'}, 
                                    {key:'invoiceNumber'},
                                    {key:'invoiceTotal',   properties:{columnType:'currency'} },
                                    {key:'departureTime',  properties:{columnType:'date_time'} },
                                    {key:'arrivalTime',    properties:{columnType:'date_time'} },
                                    {key:'deliveryTime',   properties:{columnType:'timeInMinutes'} }
                                ]
                report.fileName = 'driverReport'
                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    
    public static async getCashierReport(data: any, company: Company,brancheList:[]) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? filter.fromDate : null;
            fromDate = moment(new Date(fromDate))
            let toDate = filter && filter.toDate ?  moment(new Date(filter.toDate)) : moment( new Date());
            
            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate,toDate,closingTime,false, timeOffset)
            let from = interval.from
            let to = interval.to
            
            //---------------------------------------
            if(!Array.isArray(branches) || branches.length == 0){ branches = null  };
             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


          
            let offset = limit * (page - 1);

            let total ={};
            let count = 0 ;
            let resault:any[] = []; 

             //######################## sort ########################

             let sortby   = filter && filter.sortBy ? filter.sortBy : [];
             let sortList = sortby.filter((item: any) => item.sortValue && item.sortValue.trim() !== "");
         
            // if (sortList.length < 1) { sortList.push({ sortValue: "productName", sortDirection: 'asc' }) }
 
             let orderByQuery = "order by ";
             for (let i = 0; i < sortList.length; i++) {
                 orderByQuery += `"${sortList[i].sortValue.trim()}" ${sortList[i].sortDirection ?? ""}`;
                 orderByQuery += ", ";  
             }
             orderByQuery += ` "cashiers"."cashierIn" `
             
              //######################################################

            const query: { text: string, values: any } = {
                text:`with "values" as (
                        select $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::timestamp as "fromDate",
                            $4::timestamp as "toDate",
                            $5::INT as "afterDecimal"
                        )
                        
                        ,"cashiers" as (
                            select 
                            "Cashiers".id,
                            "Employees".name as "cashierName",
                            "Cashiers"."cashierIn",
                            "Cashiers"."cashierOut",
                            "Cashiers"."startAmount",
                            "Cashiers"."endAmount"
                            
                            from "Cashiers"
                            JOIN "values" ON true
                            INNER JOIN "Employees" on "Cashiers"."employeeId" =  "Employees".id
                            INNER JOIN "Branches" on "Branches".id ="Cashiers"."branchId" 
                            WHERE   "Branches"."companyId"= "values"."companyId"
                                    AND( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                                    AND ( "Cashiers"."cashierIn" > "values"."fromDate" AND  "Cashiers"."cashierIn" < "values"."toDate")
                            )
                            ,"payments" as (
                            select "cashiers".id, sum( "InvoicePaymentLines".amount::numeric) as total , count("InvoicePaymentLines".id) as "transactions"  
                            from "cashiers"
                            inner join "InvoicePayments"  on   "InvoicePayments"."companyId" = $1 and "InvoicePayments"."cashierId" = "cashiers".id
                            inner join "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" ="InvoicePayments".id
                            group by "cashiers".id
                            )
                            ,"refunds" as (
                            select "cashiers".id, sum( "CreditNoteRefunds".total::numeric) as total from "cashiers"
                            inner join "CreditNoteRefunds" on "CreditNoteRefunds"."cashierId" = "cashiers".id
                            group by "cashiers".id
                            )
                            
                            select 
                            count(*) over(),
                            sum("startAmount"::text::numeric) over() as "startAmountTotal",
                            sum("endAmount"::text::numeric) over() as "endAmountTotal",
                            sum("payments".transactions) over() as "transactionsTotal",
                            sum("payments"."total"::text::numeric) over() as "paymentsTotal",
                            sum(COALESCE("refunds"."total",0)::text::numeric) over() as "refundsTotal",
                            sum(Round((COALESCE("cashiers"."startAmount",0) + COALESCE("payments".total,0) - COALESCE("refunds".total,0))::text::numeric,3::INT)) over() as "expectedTotal",
                            sum(Round((COALESCE("cashiers"."endAmount",0 ) - (COALESCE("cashiers"."startAmount",0) + COALESCE("payments".total,0) - COALESCE("refunds".total,0) ))::text::numeric,3::INT)) over() as "varianceTotal",
                            
                            "cashiers".*,
                            "payments".transactions as "transactions",
                            "payments".total::float as "totalPayment",
                            COALESCE("refunds".total,0)::float as "totalRefunds",
                            (COALESCE("cashiers"."startAmount",0) + COALESCE("payments".total,0) - COALESCE("refunds".total,0) ) as expected,
                            (COALESCE("cashiers"."endAmount",0 ) - (COALESCE("cashiers"."startAmount",0) + COALESCE("payments".total,0) - COALESCE("refunds".total,0) )) as variance
                            
                            from "cashiers"
                            inner join "payments" on "payments".id = "cashiers".id
                            left join "refunds" on "refunds".id = "cashiers".id
                           ${orderByQuery}

                        
                    
                    `,
                values:[companyId,branches,from,to, afterDecimal]
            }
          

            let limitQuery = filter.export && filter.export === true ? '': `limit ${limit}
                                                                            offset ${offset}`

            let records = await DB.excu.query(query.text+limitQuery, query.values)

            if (records.rows && records.rows.length > 0 ){
                let t = (<any>records.rows[0])
                count = Number(t.count)

                total =  {transactionsTotal: t.transactionsTotal, startAmount:t.startAmountTotal,  totalPayment:t.paymentsTotal, totalRefunds: t.refundsTotal , expected: t.expectedTotal, endAmount: t.endAmountTotal, variance:t.varianceTotal} 
                resault = records.rows.map((e: any) => {return {cashierId: e.id, cashierName:e.cashierName,  cashierIn:e.cashierIn,  cashierOut: e.cashierOut, startAmount: e.startAmount,  
                    transactions: e. transactions, totalPayment: e. totalPayment, totalRefunds:e.totalRefunds,  expected: e.expected, endAmount: e.endAmount, variance: e.variance}} )
                
            }

            if(filter.export){
                let report = new ReportData()
                report.filter = { title:"Cashier Report", 
                                  fromDate: filter && filter.fromDate ? filter.fromDate : null , 
                                  toDate: filter && filter.toDate ? filter.toDate : new Date(),
                                  branches: branches
                                }
                resault.forEach(elem =>{elem.cashierIn = elem.cashierIn ? moment.utc(elem.cashierIn).utcOffset( +timeOffset ).format('YYYY-MM-DD hh:mm'):null;
                                        elem.cashierOut = elem.cashierOut? moment.utc(elem.cashierOut).utcOffset( +timeOffset ).format('YYYY-MM-DD hh:mm'):null;
                })
                report.records = resault
                report.columns = [  {key:'cashierName', header: 'Employee Name'},
                                    {key:'cashierIn',properties:{columnType:'date_time'} },
                                    {key:'cashierOut',properties:{columnType:'date_time'} },
                                    {key:'transactions', properties:{hasTotal:true} },
                                    {key:'startAmount',properties:{hasTotal:true,columnType:'currency'} },
                                    {key:'totalPayment',properties:{hasTotal:true,columnType:'currency'} },
                                    {key:'totalRefunds', properties:{hasTotal:true,columnType:'currency'} },
                                    {key:'expected',properties:{hasTotal:true,columnType:'currency'} },
                                    {key:'endAmount',properties:{hasTotal:true,columnType:'currency'} },
                                    {key:'variance', properties:{hasTotal:true,columnType:'currency'} },
                                ]
                report.fileName = 'cashierReport'
                return new ResponseData(true, "", report)
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

    public static async shortOver(data: any, company: Company,brancheList:[]) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
             //-------------- set time --------------
             let closingTime = "00:00:00"
             let fromDate = filter && filter.fromDate ? filter.fromDate : null;
             fromDate = moment(new Date(fromDate))
             let toDate = filter && filter.toDate ?  moment(new Date(filter.toDate)) : moment( new Date());
             
             let timeOffset = company.timeOffset
             let interval = await TimeHelper.getReportTime(fromDate,toDate,closingTime,false, timeOffset)
             let from = interval.from
             let to = interval.to
             
             //---------------------------------------
             if(!Array.isArray(branches) || branches.length == 0){ branches = null  };
             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


          
            let offset = limit * (page - 1);

            let total ={};
            let count = 0 ;
            let resault:any[] = []; 

            const query: { text: string, values: any } = {
                text:`with "values" as (
                        select $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::timestamp as "fromDate",
                            $4::timestamp as "toDate",
                            $5::INT as "afterDecimal"
                        )
                        ,"records1" as( 
                        select  "Cashiers"."id" ,
                                "Cashiers"."employeeId", 
                                "Cashiers"."cashierIn",
                                "CashierLines"."startAmount" ,
                                "CashierLines"."endAmount" ,
                                "CashierLines"."paymentMethodId" ,
                                "Employees".name as "cashierName",
                                sum("CreditNoteRefundLines".amount) as refund,
                                sum("InvoicePayments"."paidAmount")  as "paidAmount"
                            
                        from "Cashiers"
                        join "values" on true
                        inner join  "Branches" on "Cashiers"."branchId" = "Branches".id 
                        inner join  "Employees" on "Employees".id = "Cashiers"."employeeId"
                        inner join  "CashierLines" on "CashierLines"."cashierId" = "Cashiers".id 
                        left join "InvoicePayments" on "InvoicePayments"."cashierId" = "Cashiers".id  and "InvoicePayments"."paymentMethodId" = "CashierLines"."paymentMethodId"
                        left join "CreditNoteRefunds" ON "CreditNoteRefunds"."cashierId" =  "Cashiers".id 
                        left join "CreditNoteRefundLines"  on "CreditNoteRefunds".id  = "CreditNoteRefundLines"."creditNoteRefundId" and  "CashierLines"."paymentMethodId" = "CreditNoteRefundLines"."paymentMethodId" 

                        WHERE  "Branches"."companyId"= "values"."companyId"
                            AND( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                            AND ( "Cashiers"."cashierIn" >= "values"."fromDate" AND  "Cashiers"."cashierIn" < "values"."toDate")
                        group by  "Cashiers"."id","CashierLines".id, "Employees".name
                        )
                        ,"records" as(
                        select  count(*) over()::real,
                                sum(sum(COALESCE("endAmount",0)::text::numeric)) over()  as "countTotal", 
                                sum(COALESCE(sum("startAmount"::text::numeric),0) + COALESCE(sum("paidAmount"::text::numeric),0) - COALESCE(sum("refund"::text::numeric),0) ) over() as "expectedTotal",
                                sum(COALESCE(sum("endAmount"::text::numeric),0) - ( COALESCE(sum("startAmount"::text::numeric),0) + COALESCE(sum("paidAmount"::text::numeric),0) - COALESCE(sum("refund"::text::numeric),0))) over() as "shortOverTotal",
                                
                                "PaymentMethods".name as tender, "PaymentMethods"."symbol", "PaymentMethods"."afterDecimal", "cashierName", "records1".id, "cashierIn"::date as "date",
                                sum("endAmount"::text::numeric)  as "countAmount",
                                COALESCE(sum("startAmount"::text::numeric),0) + COALESCE(sum("paidAmount"::text::numeric),0) - COALESCE(sum("refund"::text::numeric),0)  as expected,
                                COALESCE(sum("endAmount"::text::numeric),0) - ( COALESCE(sum("startAmount"::text::numeric),0) + COALESCE(sum("paidAmount"::text::numeric),0) - COALESCE(sum("refund"::text::numeric),0)) as "shortOver"
                        from  "records1"
                        inner join "PaymentMethods"  ON "PaymentMethods".id = "records1"."paymentMethodId"
                        group by tender, "PaymentMethods"."symbol", "PaymentMethods"."afterDecimal", "cashierName", "cashierIn"::date, "records1".id
                        order by "date", "cashierName", "tender"
                       
                    `,
                values:[companyId,branches,from,to, afterDecimal]
            }

            let limitQuery = filter.export && filter.export === true ? ` ) select * from "records" `
                                                                     : ` limit ${limit}
                                                                         offset ${offset}
                                                                        )
                                                                        select count, "countTotal", "expectedTotal", "shortOverTotal","date","cashierName",
                                                                        json_agg(json_build_object('tender',"tender", 
                                                                                                'countAmount',"countAmount", 'expected',"expected", 
                                                                                                'shortOver', "shortOver"
                                                                                                )) as "details"
                                                                        from "records"
                                                                        group by count, "countTotal", "expectedTotal", "shortOverTotal","date", "cashierName" `
          

            const records = await DB.excu.query(query.text+limitQuery, query.values)

            if (records.rows && records.rows.length > 0 ){
                let t = (<any>records.rows[0])
                count = Number(t.count)

                total =  {countAmount:t.countTotal, expected: t.expectedTotal, shortOver: t.shortOverTotal} 
                resault = records.rows.map((e: any) => {return {date: e.date, cashierName: e.cashierName ,details: e.details }} )

                //let a = _.chain(resault).groupBy(['categoryName','CategoryQtyTotal'] ).map((value,[categoryName,CategoryQtyTotal])=>({categoryName:categoryName ,CategoryQtyTotal:CategoryQtyTotal , products: value})).value()
               // console.log(a)

                
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

            if(filter.export){
                records.rows.forEach((elem:any) => {elem.date = moment(elem.date).format("YYYY-MM-DD"); }) 
                let report = new ReportData()
                report.filter = { title:"Short Over", 
                                  fromDate: filter && filter.fromDate ? filter.fromDate : null , 
                                  toDate: filter && filter.toDate ? filter.toDate : null,
                                  branches: branches
                                }
                report.records = records.rows
                report.columns = [  {key:'date',properties:{columnType:'date', groupBy:true} },
                                    {key:'cashierName', properties:{ groupBy:true}},
                                    {key:'tender' },
                                    {key:'countAmount',properties:{hasTotal:true,columnType:'currency'} },
                                    {key:'expected', properties:{hasTotal:true,columnType:'currency'} },
                                    {key:'shortOver', properties:{ hasTotal:true, columnType:'currency'} }  
                                ]
                report.fileName = 'shortOver'
                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async cashierList(data: any, company: Company,brancheList:[]) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? filter.fromDate : null;
            fromDate = moment(new Date(fromDate))
            let toDate = filter && filter.toDate ?  moment(new Date(filter.toDate)) : moment( new Date());
            
            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate,toDate,closingTime,false, timeOffset)
            let from = interval.from
            let to = interval.to
            
            //---------------------------------------
            if(!Array.isArray(branches) || branches.length == 0){ branches = null  };
             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


          
            let offset = limit * (page - 1);
            let count = 0 ;
            let resault:any[] = []; 

             //######################## sort ########################

             let sortby   = filter && filter.sortBy ? filter.sortBy : [];
             let sortList = sortby.filter((item: any) => item.sortValue && item.sortValue.trim() !== "");
         
            // if (sortList.length < 1) { sortList.push({ sortValue: "productName", sortDirection: 'asc' }) }
 
             let orderByQuery = "order by ";
             for (let i = 0; i < sortList.length; i++) {
                 orderByQuery += `"${sortList[i].sortValue.trim()}" ${sortList[i].sortDirection ?? ""}`;
                 orderByQuery += ", ";  
             }
             orderByQuery += ` "Cashiers"."cashierOut" desc `
             
              //######################################################

            const query: { text: string, values: any } = {
                text:`with "values" as (
                        select $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::timestamp as "fromDate",
                            $4::timestamp as "toDate"
                        )
                        select 
                            count(*) over(),
                            "Cashiers".id,
                            "Employees".name as "employeeName",
                            "Branches".name  as "branchName",
                            "Cashiers"."cashierIn",
                            "Cashiers"."cashierOut",
                            "Cashiers"."startAmount",
                            "Cashiers"."endAmount"
                        from "Cashiers"
                        join "values" on true 
                        INNER JOIN "Employees" on "Cashiers"."employeeId" =  "Employees".id
                        INNER JOIN "Branches" on "Branches".id ="Cashiers"."branchId"  
                        WHERE "Branches"."companyId" = "values"."companyId" 
                        and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                        and "Cashiers"."cashierOut" >= "values"."fromDate" and "Cashiers"."cashierOut" < "values"."toDate" 
                           ${orderByQuery}
                    `,
                values:[companyId,branches,from,to]
            }

            
          
            let limitQuery = (filter.export&& filter.export===true)? '': `limit ${limit}
                                                                            offset ${offset}`

            let records = await DB.excu.query(query.text+limitQuery, query.values)

            if (records.rows && records.rows.length > 0 ){
                let t = (<any>records.rows[0])
                count = Number(t.count)
                resault = records.rows
            }

            if(filter.export){
                let report = new ReportData()
                report.filter = { title:"Cashier Report Overview", 
                                  fromDate: filter && filter.fromDate ? filter.fromDate : null , 
                                  toDate: filter && filter.toDate ? filter.toDate : new Date(),
                                  branches: branches
                                }
                resault.forEach(elem =>{elem.cashierIn =  moment.utc(elem.cashierIn).utcOffset( +timeOffset ).format('YYYY-MM-DD hh:mm');
                                        elem.cashierOut =  moment.utc(elem.cashierOut).utcOffset( +timeOffset ).format('YYYY-MM-DD hh:mm');
                })
                report.records = resault
                report.columns = [  {key:'employeeName', header: 'Employee Name'},
                                    {key:'branchName'},
                                    {key:'cashierIn',properties:{columnType:'date_time'} },
                                    {key:'cashierOut',properties:{columnType:'date_time'} },
                                    {key:'startAmount',properties:{columnType:'currency'} },
                                    {key:'endAmount',properties:{columnType:'currency'} }
                                ]
                report.fileName = 'CashierReportOverview'
                return new ResponseData(true, "", report)
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

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }


    public static async cashierReportByCashierId(data: any, company: Company, brancheList: []) {
 
        try {
    
          const companyId = company.id;
          const filter  = data.filter
          let  cashierId=  (filter&& filter.cashierId )?filter.cashierId:''
          const timeOffset = company.timeOffset
    
    
          let cashierReport = new CashierReport();
        

    
          let query: { text: string, values: any } = {
            text: ``,
            values: [cashierId]
          }

           //############################# Cashiers info #############################
           let text = `select 
                            "Cashiers".id,
                            "Employees".name as "employeeName",
                            "Branches".name as "branchName",
                            "Cashiers"."branchId"  ,
                            "Cashiers"."cashierIn",
                            "Cashiers"."cashierOut",
                            "Cashiers"."startAmount",
                            "Cashiers"."endAmount"
                        from "Cashiers"
                        inner join "Employees" on "Employees".id = "Cashiers"."employeeId"
                        inner join "Branches" on "Branches".id = "Cashiers"."branchId"
                        where "Cashiers".id =$1
                        
                        
        `
            let records = await DB.excu.query(query.text + text, query.values)
           

            let temp: Array<{ [key: string]: any }> = records.rows && records.rows.length > 0 ? records.rows : []
            if (temp.length > 0) {
            let t = (<any>temp[0])
            cashierReport.employeeName = t.employeeName?? null
            cashierReport.branchName = t.branchName?? null
            cashierReport.branchId = t.branchId?? null
            cashierReport.cashierIn = moment.utc(t.cashierIn).utcOffset( +timeOffset ).format('YYYY-MM-DD hh:mm')?? null
            cashierReport.cashierOut = moment.utc(t.cashierOut).utcOffset( +timeOffset ).format('YYYY-MM-DD hh:mm')?? null
            cashierReport.openingBalance = Number.isNaN(t.startAmount) ? 0 : Number(t.startAmount)

            if (temp[0]['employeeName'] != null) {
            cashierReport.totalOrders = temp[0]['totalOrders'];
            }

            if (temp[0]['totalPayments'] != null) {
            cashierReport.totalOrders = temp[0]['totalOrders'];
            }

            }
    
          
    
          //############################# Cashiers Total #############################
           text = `select  count(id) as "totalOrders",
                        sum(case when "InvoicePayments"."tenderAmount" = 0 then "InvoicePayments"."paidAmount"  else (COALESCE("InvoicePayments"."tenderAmount",0) -COALESCE("InvoicePayments"."changeAmount",0)) end ) as "totalPayments"
                        from "InvoicePayments"  where "cashierId" =$1 and "InvoicePayments".status = 'SUCCESS'
                     `
           records = await DB.excu.query(query.text + text, query.values)
       
          temp = records.rows && records.rows.length > 0 ? records.rows : []
          if (temp.length > 0) {
            cashierReport.totalOrders = temp[0]['totalOrders']??0;
            cashierReport.totalPayments = temp[0]['totalPayments']??0;
          }

          text = `select COALESCE(sum(amount),0) as "totalPayout" from "Payouts" WHERE "cashierId"= $1 `
          records = await DB.excu.query(query.text + text, query.values)
          temp = records.rows && records.rows.length > 0 ? records.rows : []
          if (temp.length > 0) {  cashierReport.totalPayout = temp[0]['totalPayout']??0 ;}


          text = `select  COALESCE(sum(total),0) as "totalRefunds" from "CreditNoteRefunds" WHERE "cashierId"= $1 `
          records = await DB.excu.query(query.text + text, query.values)
       
          temp = records.rows && records.rows.length > 0 ? records.rows : []
          if (temp.length > 0) {cashierReport.totalRefunds = temp[0]['totalRefunds']??0; }
          cashierReport.closingBalance = cashierReport.openingBalance + cashierReport.totalPayments - cashierReport.totalRefunds - cashierReport.totalPayout

    
        
          //############################# Payment BY Tender #############################
          text = `select
                        "PaymentMethods".id as "paymentMethodId",
                        "PaymentMethods".name as "paymentMethodName",
                        count ("InvoicePayments".id) as "transactionCount",
                        sum(case when "InvoicePayments"."tenderAmount" = 0 then "InvoicePayments"."paidAmount"  else (COALESCE("InvoicePayments"."tenderAmount",0) -COALESCE("InvoicePayments"."changeAmount",0) ) end )::NUMERIC  as "total",
                        sum(case when "InvoicePayments"."tenderAmount" = 0 then "InvoicePayments"."paidAmount" else  (COALESCE("InvoicePayments"."tenderAmount",0) -COALESCE("InvoicePayments"."changeAmount",0) ) * "InvoicePayments".rate end )::NUMERIC   as "equivalant"
                    from "InvoicePayments"
                    inner join "PaymentMethods" on "PaymentMethods".id = "InvoicePayments"."paymentMethodId" and "InvoicePayments".status = 'SUCCESS'
                    where "cashierId" =$1 
                    group by "PaymentMethods".id	
                    `
          records = await DB.excu.query(query.text + text, query.values)
          temp = records.rows && records.rows.length > 0 ? records.rows : []
          if (temp.length > 0) { cashierReport.paymentByTender = temp.map((e) => PaymentByTender.fromMap(e));
          }

          //############################# Short Over #############################
          text = `with "InvoicePaymentTotal" AS (
                    select "paymentMethodId" , 
                            sum("paidAmount") as "amount"
                    from "InvoicePayments" 
                    where  "InvoicePayments"."cashierId" = $1  and status = 'SUCCESS'
                    group by "InvoicePayments"."paymentMethodId"
                    )
                    ,"RefundTotal" AS (
                    select "paymentMethodId" , 
                            sum(amount)*(-1) as "amount"
                    from "CreditNoteRefundLines" 
                    inner join "CreditNoteRefunds" on "CreditNoteRefundLines"."creditNoteRefundId" = "CreditNoteRefunds".id 
                    where  "cashierId" = $1 
                    group by "paymentMethodId"
                    ),
                    "PayoutTotal" AS (
                    select "paymentMethodId", 
                            sum(amount)*(-1) as amount 
                    from "Payouts" 
                    where "cashierId" = $1 
                    group by "paymentMethodId"
                    )
                    ,"Totals" as (
                    SELECT "paymentMethodId",
                            sum(COALESCE(amount,0)) as total
                    FROM(
                        select * from "InvoicePaymentTotal"
                        union all 
                        select * from "PayoutTotal"
                        union all 
                        select * from "PayoutTotal"
                    ) t
                    GROUP BY "paymentMethodId"
                    )
                    select  "Totals"."paymentMethodId", "PaymentMethods".name as "paymentMethodName",
                            COALESCE("endAmount",0)  as "countAmount",
                            COALESCE("total",0) +  COALESCE("startAmount",0) as expected,
                            COALESCE("endAmount",0) - (COALESCE("total",0) +  COALESCE("startAmount",0)) as "shortOver"           
                    from "Totals"
                    left join  "PaymentMethods" on "Totals"."paymentMethodId" = "PaymentMethods".id 
                    left join "CashierLines"    on "Totals"."paymentMethodId" = "CashierLines"."paymentMethodId" and "cashierId" = $1 
	
                    `
          records = await DB.excu.query(query.text + text, query.values)
          temp = records.rows && records.rows.length > 0 ? records.rows : []
          if (temp.length > 0) { cashierReport.shortOver = temp.map((e) => ShortOver.fromMap(e));
          }
    
        
    
          if(filter.export){
        
            let t2  = [{'key': "Total Order" ,'value':cashierReport.totalOrders},
                {'key': "Opening Balance" ,'value':cashierReport.openingBalance},
              {'key': "Total Payments" ,'value':cashierReport.totalPayments},
              {'key': "Total Refunds" ,'value':cashierReport.totalRefunds},
              {'key': "Total Payout" ,'value':cashierReport.totalPayout},
              {'key': "Closing Balance" ,'value':cashierReport.closingBalance}
              ];
    
            let tables = {
                    
                        
                      ""  : {'records': t2
                          , 'columns' :{ 'key' :{},'':{},'value' : {columnType:'currency'} }
                          },
                      "Payment By Tenders"  : {'records': cashierReport.paymentByTender.map((e: PaymentByTender) => { return { Tender: e.paymentMethodName, total:Number( e.total) ,equivalant:Number( e.equivalant)  } })
                      , 'columns' :{ 'Tender' :{},'total' : { columnType:'currency'} ,'equivalant' : { hasTotal:true, columnType:'currency'}}
                      },

                      "Short Over"  : {'records': cashierReport.shortOver.map((e: ShortOver) => { return { Tender: e.paymentMethodName, expected:Number(e.expected) ,count:Number( e.countAmount), shortOver:Number( e.shortOver)  } })
                      , 'columns' :{ 'Tender' :{},'expected':{ columnType:'currency'},'count' : { columnType:'currency'} ,'shortOver' : {columnType:'currency'}}
                      },
                    
                      
                      }
    
                     
                      let resData  = {'filter' : {
                          title: "cashier Report",
                          fromDate:  null,
                          toDate: null,
                          branches:cashierReport.branchId ? [cashierReport.branchId] : [],
                          filterList:{employeeName : cashierReport.employeeName, cashierIn: cashierReport.cashierIn, cashierOut: cashierReport.cashierOut, },
                          employeeName : cashierReport.employeeName
                      },
                      fileName : 'cashierReport',
                      records :tables
                    }
            
            
    
            return new ResponseData(true, "", resData)
        }
    

          return new ResponseData(true, "", cashierReport)
    
        } catch (error: any) {
          console.log(error)
        
          throw new Error(error)
        }
      }

    
    



}