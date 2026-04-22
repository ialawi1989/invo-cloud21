import { TimeHelper } from "@src/utilts/timeHelper"
import { DB } from "@src/dbconnection/dbconnection"
import { ResponseData } from "@src/models/ResponseData"
import { Company } from "@src/models/admin/company"
import moment from 'moment'

import { DataColumn, ReportData } from "@src/utilts/xlsxGenerator"
import { PaymnetMethodRepo } from "../app/accounts/paymentMethod.repo"
import { BranchesRepo } from "../admin/branches.repo"
import { ValidationException } from "@src/utilts/Exception"


export class PaymentMethodReports {
    public static async paymentMethodReport(data: any, company: Company,branchList:any[]) {
   
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal

            //-------------- set time --------------
        let closingTime = "00:00:00"
        let fromDate = data.interval && data.interval.from ? data.interval.from : null;
        fromDate = moment(new Date(fromDate))
        let toDate = data.interval && data.interval.to ?  moment(new Date(data.interval.to)) : moment( new Date());
        
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

            const branches = data.branchId?[data.branchId]: branchList;

            const query={
                text:`WITH "values" AS (
                SELECT  $1::uuid AS "companyId",
                        $2::uuid[] AS "branches",
                        $3::timestamp AS "fromDate",
                        $4::timestamp AS "toDate"
                 
                
                )	
                    ,"invoicePayments" as (
                        select
                        "PaymentMethods".id as "paymentId",
                        "PaymentMethods".name as "paymentMethodName",
                        "Accounts".name as "accountName",
                        cast( count ("InvoicePayments".id) as int)as "transactionCount",
                        sum(case when "InvoicePayments"."tenderAmount" = 0 then "InvoicePayments"."paidAmount" ::text::NUMERIC else (COALESCE("InvoicePayments"."tenderAmount",0) -COALESCE("InvoicePayments"."changeAmount",0) )::text::NUMERIC end ) as "paymentTotal",
                        sum(case when "InvoicePayments"."tenderAmount" = 0 then "InvoicePayments"."paidAmount"::text::NUMERIC else  (COALESCE("InvoicePayments"."tenderAmount",0) -COALESCE("InvoicePayments"."changeAmount",0) )::text::NUMERIC * "InvoicePayments".rate::text::NUMERIC end )  as "paymentEquivalent"
                        
                        from "InvoicePayments"
                        join "values" on true
                        inner join "PaymentMethods" on "PaymentMethods".id = "InvoicePayments" ."paymentMethodId"
                      	inner join "Accounts" on "Accounts".id = "InvoicePayments"."paymentMethodAccountId"
                        inner join "Branches" on "InvoicePayments"."branchId" = "Branches".id
                        WHERE "Branches"."companyId"= "values"."companyId"
                            AND  "InvoicePayments"."paymentDate" >= "values"."fromDate" and  "InvoicePayments"."paymentDate" < "values"."toDate" 
                            AND ( array_length("values"."branches",1) IS NULL OR "InvoicePayments"."branchId"  = any( "values"."branches"))
                        group by "PaymentMethods".id, "Accounts".name
                        )
                        , "billingPayments" as (
                        select
                        "PaymentMethods".id as "paymentId",
                        "PaymentMethods".name as "paymentMethodName",
                        "Accounts".name as "accountName",
                        cast( count ("BillingPayments".id) as int) as "transactionCount",
                        sum(case when "BillingPayments"."tenderAmount" = 0 then "BillingPayments"."paidAmount"::text::NUMERIC else ("BillingPayments"."tenderAmount"::text::NUMERIC  ) end ) *(-1) as "paymentTotal",
                        sum(case when "BillingPayments"."tenderAmount" = 0 then  "BillingPayments"."paidAmount"::text::NUMERIC else("BillingPayments"."tenderAmount"::text::NUMERIC  ) * "BillingPayments".rate::text::NUMERIC end )*(-1)  as "paymentEquivalent"
                        from "BillingPayments"
                        join "values" on true
                        inner join "PaymentMethods" on "PaymentMethods".id = "BillingPayments" ."paymentMethodId"
                       	inner join "Accounts" on "Accounts".id = "BillingPayments"."paymentMethodAccountId"
                        left join "Branches" on "Branches".id = "BillingPayments"."branchId"
                         WHERE "BillingPayments"."companyId"= "values"."companyId" 
                          AND  "BillingPayments"."paymentDate" >="values"."fromDate" and  "BillingPayments"."paymentDate" < "values"."toDate" 
                          AND ( array_length("values"."branches",1) IS NULL OR "BillingPayments"."branchId" = any( "values"."branches") )
                        group by "PaymentMethods".id , "Accounts".name)
						,"refunds" as (
						select 
						"PaymentMethods".id as "paymentId",
                        "PaymentMethods".name as "paymentMethodName",
                        "Accounts".name as "accountName",
                        cast( count ("CreditNoteRefunds".id) as int) as "transactionCount",
                        sum("CreditNoteRefundLines"."amount"::text::numeric ) *(-1) as "paymentTotal",
                        sum( "CreditNoteRefundLines"."amount"::text::numeric )*(-1)  as "paymentEquivalent"
							
							from "CreditNoteRefunds"
							    join "values" on true
							INNER JOIN "CreditNoteRefundLines" on "CreditNoteRefundLines"."creditNoteRefundId" = "CreditNoteRefunds".id 
							INNER join "PaymentMethods"  on "CreditNoteRefundLines"."paymentMethodId" = "PaymentMethods".id
							inner join "Accounts" on "Accounts".id = "CreditNoteRefundLines"."accountId"
							left join "Branches" on "Branches".id = "CreditNoteRefunds"."branchId"
							        WHERE "Branches"."companyId"= "values"."companyId"
                            AND  "CreditNoteRefunds"."refundDate" >= "values"."fromDate" and  "CreditNoteRefunds"."refundDate" < "values"."toDate" 
                            AND ( array_length("values"."branches",1) IS NULL OR "CreditNoteRefunds"."branchId"  = any( "values"."branches"))
                        group by "PaymentMethods".id, "Accounts".name
						),"supplierRefunds" as (
						select 
						"PaymentMethods".id as "paymentId",
                        "PaymentMethods".name as "paymentMethodName",
                        "Accounts".name as "accountName",
                        cast( count ("SupplierRefunds".id) as int) as "transactionCount",
                        sum("SupplierRefundLines"."amount"::text::numeric )  as "paymentTotal",
                        sum( "SupplierRefundLines"."amount"::text::numeric )  as "paymentEquivalent"
							
							from "SupplierRefunds"
							    join "values" on true
							INNER JOIN "SupplierRefundLines" on "SupplierRefundLines"."supplierRefundId" = "SupplierRefunds".id 
							INNER JOIN "SupplierCredits" on "SupplierRefunds"."supplierCreditId" = "SupplierCredits".id 
							INNER join "PaymentMethods"  on "SupplierRefundLines"."paymentMethodId" = "PaymentMethods".id
							inner join "Accounts" on "Accounts".id = "SupplierRefundLines"."accountId"
							left join "Branches" on "Branches".id = "SupplierCredits"."branchId"
							        WHERE "Branches"."companyId"= "values"."companyId"
                            AND  "SupplierRefunds"."refundedDate" >= "values"."fromDate" and  "SupplierRefunds"."refundedDate" < "values"."toDate" 
                            AND ( array_length("values"."branches",1) IS NULL OR "SupplierCredits"."branchId"  = any( "values"."branches"))
                        group by "PaymentMethods".id, "Accounts".name
						),"expense" as(
							select 
						"PaymentMethods".id as "paymentId",
                        "PaymentMethods".name as "paymentMethodName",
                        "Accounts".name as "accountName",

                        cast( count ("Expenses".id) as int) as "transactionCount",
                        sum("Expenses"."total"::text::numeric ) *(-1) as "paymentTotal",
                        sum("Expenses"."total"::text::numeric )*(-1)  as "paymentEquivalent"
							
							from "Expenses"
							    join "values" on true
							INNER join "PaymentMethods"  on "Expenses"."paymentMethodId" = "PaymentMethods".id
							inner join "Accounts" on "Accounts".id = "Expenses"."paidThroughAccountId"
							left join "Branches" on "Branches".id = "Expenses"."branchId"
							        WHERE "Branches"."companyId"= "values"."companyId"
                            AND  "Expenses"."expenseDate" >= "values"."fromDate" and  "Expenses"."expenseDate" < "values"."toDate" 
                            AND ( array_length("values"."branches",1) IS NULL OR "Expenses"."branchId"  = any( "values"."branches"))
                        group by "PaymentMethods".id, "Accounts".name
						
						)
                        
                        ,"records" as(
                        select 
                        T."paymentId",
                        T."paymentMethodName",
                        T."accountName",	
                   
                        sum(COALESCE(T."transactionCount",0)) as "transactionCount" ,
                        sum(COALESCE(T."paymentTotal",0)) as "total",
                        sum(COALESCE(T."paymentEquivalent",0)) as "equivalent" 	
                        from (
                        select * from "invoicePayments" union all 
							select * from "billingPayments"	union all 
							select * from "refunds"	
                        )t
						group by    T."paymentId",
                        T."paymentMethodName",
                        T."accountName"
						)
                        select
                       *
                        
                        from "records"`,

                values:[companyId,branches,from,to]
            }


            const reports = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          
    
            throw new Error(error.message)
        }
    }

    public static async payoutsReport(data: any, company: Company) {
        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal
            const branchId = data.branchId ? data.branchId : null;
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

            const query: { text: string, values: any } = {
                text: `
                SELECT "Payouts".id ,
                        "Accounts".name as "accountName",
                        "Payouts"."cashierId",
                        "Employees".name as "cashierName",
                        "Payouts"."paymentMethodId",
                        "PaymentMethods"."name" as  "PaymentName",
                        "Payouts".amount,
                        "Payouts"."createdAt",
                        "Payouts"."branchId"
                FROM "Payouts"
                INNER JOIN   "Branches" ON "Branches".id = "Payouts"."branchId"
                INNER JOIN "Companies" ON "Companies".id = "Branches"."companyId"
                INNER JOIN  "Accounts" ON "Accounts".id = "Payouts"."accountId"
                LEFT JOIN "Cashiers" ON "Cashiers".id = "Payouts"."cashierId"
                LEFT JOIN "Employees" ON "Cashiers"."employeeId" = "Employees".id 
                LEFT JOIN "PaymentMethods" ON "PaymentMethods".id = "Payouts"."paymentMethodId"
                WHERE "Companies".id = $1
                AND (($2::text IS NULL) or "Branches".id::text = $2::text )
                AND (($3::Date is NULL or "Payouts"."createdAt" >= $3::Date ) AND ( $4::Date is NULL or "Payouts"."createdAt" < $4::Date ))
                order by "createdAt"
                `,
                values: [companyId, branchId, from, to]
            }

            const reports = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }


    //new reports
    public static async getPaymentMethodReport(data: any, company: Company) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : null;
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
                    ,"invoicePayments" as (
                        select
                        "PaymentMethods".id as "paymentId",
                        "PaymentMethods".name as "paymentMethodName",
                        "Accounts".name as "accountName",
                        case when "values"."compType" = 'branch' then COALESCE("Branches".name,'other') 
                                     when "values"."compType" = 'period' and "period" = 'Month' then to_char( "InvoicePayments"."createdAt",'Mon/YYYY') 
                                     when "values"."compType" = 'period' and "period" = 'Year' then to_char("InvoicePayments"."createdAt"::TIMESTAMP,'YYYY') 
                                     else 'Total' end as "key",
                        cast( count ("InvoicePayments".id) as int)as "invoiceTransactionCount",
                        sum(case when "InvoicePayments"."tenderAmount" = 0 then "InvoicePayments"."paidAmount" ::text::NUMERIC else (COALESCE("InvoicePayments"."tenderAmount",0) -COALESCE("InvoicePayments"."changeAmount",0) )::text::NUMERIC end ) as "invoicePaymentsTotal",
                        sum(case when "InvoicePayments"."tenderAmount" = 0 then "InvoicePayments"."paidAmount"::text::NUMERIC else  (COALESCE("InvoicePayments"."tenderAmount",0) -COALESCE("InvoicePayments"."changeAmount",0) )::text::NUMERIC * "InvoicePayments".rate::text::NUMERIC end )  as "invoicePaymentsEquivalent",
                        0 as "billingTransactionCount", 
                        0 as "billingPaymentsTotal", 
                        0 as "billingPaymentsEquivalent"
                        from "InvoicePayments"
                        join "values" on true
                        inner join "Accounts" on "Accounts".id = "InvoicePayments" ."paymentMethodAccountId"
                        left join "PaymentMethods"  on "InvoicePayments"."paymentMethodId" = "PaymentMethods".id
                        inner join "Branches" on "InvoicePayments"."branchId" = "Branches".id
                        WHERE "Branches"."companyId"= "values"."companyId"
                            AND  "InvoicePayments"."paymentDate" >= "values"."fromDate" and  "InvoicePayments"."paymentDate" < "values"."toDate" 
                            AND ( array_length("values"."branches",1) IS NULL OR "InvoicePayments"."branchId"  = any( "values"."branches"))
                        group by "PaymentMethods".id, "Accounts".name,"key"
                        )
                        , "billingPayments" as (
                        select
                        "PaymentMethods".id as "paymentId",
                        "PaymentMethods".name as "paymentMethodName",
                        "Accounts".name as "accountName",
                        case when "values"."compType" = 'branch' then COALESCE("Branches".name,'other') 
                                     when "values"."compType" = 'period' and "period" = 'Month' then to_char( "BillingPayments"."createdAt",'Mon/YYYY') 
                                     when "values"."compType" = 'period' and "period" = 'Year' then to_char("BillingPayments"."createdAt"::TIMESTAMP,'YYYY') 
                                     else 'Total' end as "key",
                        0 as "invoiceTransactionCount",
                        0 as "invoicePaymentsTotal",
                        0 as "invoicePaymentsEquivalent",
                        cast( count ("BillingPayments".id) as int)as "billingTransactionCount",
                        sum(case when "BillingPayments"."tenderAmount" = 0 then "BillingPayments"."paidAmount"::text::NUMERIC else ("BillingPayments"."tenderAmount"::text::NUMERIC  ) end ) as "billingPaymentsTotal",
                        sum(case when "BillingPayments"."tenderAmount" = 0 then  "BillingPayments"."paidAmount"::text::NUMERIC else("BillingPayments"."tenderAmount"::text::NUMERIC  ) * "BillingPayments".rate::text::NUMERIC end )  as "billingPaymentsEquivalent"
                        from "BillingPayments"
                        join "values" on true
                        inner join "Accounts" on "Accounts".id = "BillingPayments" ."paymentMethodAccountId"
                        left join "PaymentMethods"  on "BillingPayments"."paymentMethodId" = "PaymentMethods".id
                        left join "Branches" on "Branches".id = "BillingPayments"."branchId"
                         WHERE "BillingPayments"."companyId"= "values"."companyId" 
                          AND  "BillingPayments"."paymentDate" >="values"."fromDate" and  "BillingPayments"."paymentDate" < "values"."toDate" 
                          AND ( array_length("values"."branches",1) IS NULL OR "BillingPayments"."branchId" = any( "values"."branches") )
                        group by "PaymentMethods".id , "Accounts".name, "key")
                        
                        ,"records" as(
                        select 
                        T."paymentId",
                        T."paymentMethodName",
                        T."accountName",	
                        T."key",
                        sum(T."invoiceTransactionCount") as "invoiceTransactionCount" ,
                        sum(T."invoicePaymentsTotal") as "invoicePaymentsTotal",
                        sum(T."invoicePaymentsEquivalent") as "invoicePaymentsEquivalent" ,
                        sum(T."billingTransactionCount") as "billingTransactionCount" ,
                        sum(T."billingPaymentsTotal") as "billingPaymentsTotal",
                        sum(T."billingPaymentsEquivalent") as "billingPaymentsEquivalent",
                        sum(T."invoiceTransactionCount"+T."billingTransactionCount") as "totalTransaction",
                        sum(T."invoicePaymentsTotal"+ T."billingPaymentsTotal" ) as "totalPayments",
                        sum(T."invoicePaymentsEquivalent"+ T."billingPaymentsEquivalent" ) as "equivalentPayments"	
                        from (
                        select * from "invoicePayments" union all select * from "billingPayments"	
                        )T
                        group by T."paymentId",
                        T."paymentMethodName",
                        T."accountName", 
                        T."key")
                        select
                        "paymentId",
                        "paymentMethodName",
                        "accountName",
                        (select array_agg(distinct "key")  from "records")  as "columns",
                        JSON_AGG(JSON_BUILD_OBJECT("key",JSON_BUILD_OBJECT('invoiceTransactionCount',COALESCE("invoiceTransactionCount",0),
                                                                              'invoicePaymentsTotal',COALESCE("invoicePaymentsTotal",0),
                                                                              'invoicePaymentsEquivalent',COALESCE("invoicePaymentsEquivalent",0),
                                                                              'billingTransactionCount',COALESCE("billingTransactionCount",0),
                                                                              'billingPaymentsTotal',COALESCE("billingPaymentsTotal",0),
                                                                              'billingPaymentsEquivalent',COALESCE("billingPaymentsEquivalent",0),
                                                                              'totalTransaction', "totalTransaction",
                                                                              'totalPayments',"totalPayments",
                                                                              'equivalentPayments',"equivalentPayments"
                                                                             ))) as "summary"
                        
                        from "records"
                        group by "paymentId",
                        "paymentMethodName",
                        "accountName"
                   `,
                values: [companyId, branches, from, to, compareType, period, NoOfperiod]
            }




            const records = await DB.excu.query(query.text, query.values);

            if (records.rows && records.rows.length > 0) {
                columns = (<any>records.rows[0]).columns ? (<any>records.rows[0]).columns : columns
                results = records.rows
            }

            let resData = {
                records: results,
                columns: columns,
                subColumns: ['invoiceTransactionCount', 'invoicePaymentsTotal', 'invoicePaymentsEquivalent',
                    'billingTransactionCount', 'billingPaymentsTotal', 'billingPaymentsEquivalent',
                    'totalTransaction', 'totalPayments', 'equivalentPayments'
                ]

            }
            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async getPaymentMethodReport2(data: any, company: Company,brancheList:[]) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
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


            let NoOfperiod = filter && filter.periodQty ? filter.periodQty : null;
            let period = filter && filter.period ? filter.period : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : 'none';
            let columns = ["Total"]
            let results: any = []
        
            let query = {
                text: `	
                     WITH "values" AS (
                SELECT  $1::uuid AS "companyId",
                        $2::uuid[] AS "branches",
                        case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
                             when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
                             else $3::timestamp 	END "fromDate",
                        $4::timestamp AS "toDate",
                        lower($5)::text As "compType",
                        lower($6)::text as "period"
                )	
                  ,"invoicePayments" as (
                select
                    "PaymentMethods".id as "paymentId",
                    "PaymentMethods".name as "paymentMethodName",
                    "Accounts".name as "accountName",
                    case when "values"."compType" = 'branch' then COALESCE("Branches".name,'other') 
                    when "values"."compType" = 'period' and "period" = 'month' then to_char( "InvoicePayments"."createdAt",'Mon/YYYY') 
                    when "values"."compType" = 'period' and "period" = 'year' then to_char("InvoicePayments"."createdAt"::TIMESTAMP,'YYYY') 
                    else 'Total' end as "key",
                    cast( count ("InvoicePayments".id) as int)as "transactionCount",
                    sum(case when "InvoicePayments"."tenderAmount" = 0 then "InvoicePayments"."paidAmount"  else (COALESCE("InvoicePayments"."tenderAmount",0) -COALESCE("InvoicePayments"."changeAmount",0) ) end )::NUMERIC  as "paymentTotal",
                    sum(case when "InvoicePayments"."tenderAmount" = 0 then "InvoicePayments"."paidAmount" else  (COALESCE("InvoicePayments"."tenderAmount",0) -COALESCE("InvoicePayments"."changeAmount",0) ) * "InvoicePayments".rate end )::NUMERIC   as "paymentEquivalent"
                from "InvoicePayments"
                join "values" on true
                inner join "PaymentMethods" on "PaymentMethods".id = "InvoicePayments" ."paymentMethodId"
                inner join "Accounts" on "Accounts".id = "InvoicePayments" ."paymentMethodAccountId"
                inner join "Branches" on "InvoicePayments"."branchId" = "Branches".id
                WHERE "Branches"."companyId"= "values"."companyId" and  "InvoicePayments".status = 'SUCCESS'
                    AND case when "paymentDate" = Date("InvoicePayments"."createdAt") then ("InvoicePayments"."paymentDate" + "InvoicePayments"."createdAt"::time)::TIMESTAMP else "paymentDate"::TIMESTAMP end >=  "values"."fromDate"
                    AND case when "paymentDate" = Date("InvoicePayments"."createdAt") then ("InvoicePayments"."paymentDate" + "InvoicePayments"."createdAt"::time)::TIMESTAMP else "paymentDate"::TIMESTAMP end <  "values"."toDate" 
                    AND ( array_length("values"."branches",1) IS NULL OR "InvoicePayments"."branchId"  = any( "values"."branches"))
                group by "PaymentMethods".id, "Accounts".name,"key"
                )



                , "billingPayments" as (
                select
                    "PaymentMethods".id as "paymentId",
                    "PaymentMethods".name as "paymentMethodName",
                    "Accounts".name as "accountName",
                    case when "values"."compType" = 'branch' then COALESCE("Branches".name,'other') 
                    when "values"."compType" = 'period' and "period" = 'month' then to_char( "BillingPayments"."createdAt",'Mon/YYYY') 
                    when "values"."compType" = 'period' and "period" = 'year' then to_char("BillingPayments"."createdAt"::TIMESTAMP,'YYYY') 
                    else 'Total' end as "key",
                    cast( count ("BillingPayments".id) as int) as "transactionCount",
                    sum(case when "BillingPayments"."tenderAmount" = 0 then "BillingPayments"."paidAmount"::text::NUMERIC else ("BillingPayments"."tenderAmount"::text::NUMERIC  ) end ) *(-1) as "paymentTotal",
                    sum(case when "BillingPayments"."tenderAmount" = 0 then  "BillingPayments"."paidAmount"::text::NUMERIC else("BillingPayments"."tenderAmount"::text::NUMERIC  ) * "BillingPayments".rate::text::NUMERIC end )*(-1)  as "paymentEquivalent"
                from "BillingPayments"
                join "values" on true
                inner join "PaymentMethods" on "PaymentMethods".id = "BillingPayments" ."paymentMethodId"
                inner join "Accounts" on "Accounts".id = "BillingPayments"."paymentMethodAccountId"
                left join "Branches" on "Branches".id = "BillingPayments"."branchId"
                WHERE "BillingPayments"."companyId"= "values"."companyId" 
                    AND case when "paymentDate" = Date("BillingPayments"."createdAt") then ("BillingPayments"."paymentDate" + "BillingPayments"."createdAt"::time)::TIMESTAMP else "paymentDate"::TIMESTAMP end >=  "values"."fromDate"
                    AND case when "paymentDate" = Date("BillingPayments"."createdAt") then ("BillingPayments"."paymentDate" + "BillingPayments"."createdAt"::time)::TIMESTAMP else "paymentDate"::TIMESTAMP end <  "values"."toDate" 
                    AND ( array_length("values"."branches",1) IS NULL OR "BillingPayments"."branchId" = any( "values"."branches") )
                group by "PaymentMethods".id , "Accounts".name, "key")
                ,"refunds" as (
                select 
                    "PaymentMethods".id as "paymentId",
                    "PaymentMethods".name as "paymentMethodName",
                    "Accounts".name as "accountName",
                    case when "values"."compType" = 'branch' then COALESCE("Branches".name,'other') 
                    when "values"."compType" = 'period' and "period" = 'month' then to_char( "CreditNoteRefunds"."refundDate",'Mon/YYYY') 
                    when "values"."compType" = 'period' and "period" = 'year' then to_char("CreditNoteRefunds"."refundDate"::TIMESTAMP,'YYYY') 
                    else 'Total' end as "key",
                    cast( count ("CreditNoteRefunds".id) as int) as "transactionCount",
                    sum("CreditNoteRefundLines"."amount"::text::numeric ) *(-1) as "paymentTotal",
                    sum( "CreditNoteRefundLines"."amount"::text::numeric )*(-1)  as "paymentEquivalent"
                from "CreditNoteRefunds"
                join "values" on true
                INNER JOIN "CreditNoteRefundLines" on "CreditNoteRefundLines"."creditNoteRefundId" = "CreditNoteRefunds".id 
                INNER join "PaymentMethods"  on "CreditNoteRefundLines"."paymentMethodId" = "PaymentMethods".id
                inner join "Accounts" on "Accounts".id = "CreditNoteRefundLines" ."accountId"
                left join "Branches" on "Branches".id = "CreditNoteRefunds"."branchId"
                WHERE "Branches"."companyId"= "values"."companyId"
                    AND case when "refundDate" = Date("CreditNoteRefunds"."createdAt") then ("CreditNoteRefunds"."refundDate" + "CreditNoteRefunds"."createdAt"::time)::TIMESTAMP else "refundDate"::TIMESTAMP end >=  "values"."fromDate"
                    AND case when "refundDate" = Date("CreditNoteRefunds"."createdAt") then ("CreditNoteRefunds"."refundDate" + "CreditNoteRefunds"."createdAt"::time)::TIMESTAMP else "refundDate"::TIMESTAMP end <  "values"."toDate" 
                    AND ( array_length("values"."branches",1) IS NULL OR "CreditNoteRefunds"."branchId"  = any( "values"."branches"))
                group by "PaymentMethods".id, "Accounts".name,"key"
                ),"supplierRefunds" as (
                select 
                    "PaymentMethods".id as "paymentId",
                    "PaymentMethods".name as "paymentMethodName",
                    "Accounts".name as "accountName",
                    case when "values"."compType" = 'branch' then COALESCE("Branches".name,'other') 
                    when "values"."compType" = 'period' and "period" = 'month' then to_char( "SupplierRefunds"."refundedDate",'Mon/YYYY') 
                    when "values"."compType" = 'period' and "period" = 'year' then to_char("SupplierRefunds"."refundedDate"::TIMESTAMP,'YYYY') 
                    else 'Total' end as "key",
                    cast( count ("SupplierRefunds".id) as int) as "transactionCount",
                    sum("SupplierRefundLines"."amount"::text::numeric )  as "paymentTotal",
                    sum( "SupplierRefundLines"."amount"::text::numeric )  as "paymentEquivalent"
                from "SupplierRefunds"
                join "values" on true
                INNER JOIN "SupplierRefundLines" on "SupplierRefundLines"."supplierRefundId" = "SupplierRefunds".id 
                INNER JOIN "SupplierCredits" on "SupplierRefunds"."supplierCreditId" = "SupplierCredits".id 
                INNER join "PaymentMethods"  on "SupplierRefundLines"."paymentMethodId" = "PaymentMethods".id
                inner join "Accounts" on "Accounts".id = "SupplierRefundLines" ."accountId"
                left join "Branches" on "Branches".id = "SupplierCredits"."branchId"
                WHERE "Branches"."companyId"= "values"."companyId"
                    AND case when "refundedDate" = Date("SupplierRefunds"."createdAt") then ("SupplierRefunds"."refundedDate" + "SupplierRefunds"."createdAt"::time)::TIMESTAMP else "refundedDate"::TIMESTAMP end >=  "values"."fromDate"
                    AND case when "refundedDate" = Date("SupplierRefunds"."createdAt") then ("SupplierRefunds"."refundedDate" + "SupplierRefunds"."createdAt"::time)::TIMESTAMP else "refundedDate"::TIMESTAMP end <  "values"."toDate" 
                    AND ( array_length("values"."branches",1) IS NULL OR "SupplierCredits"."branchId"  = any( "values"."branches"))
                group by "PaymentMethods".id, "Accounts".name,"key"
                ),"expense" as(
                select 
                    "PaymentMethods".id as "paymentId",
                    "PaymentMethods".name as "paymentMethodName",
                    "Accounts".name as "accountName",
                    case when "values"."compType" = 'branch' then COALESCE("Branches".name,'other') 
                    when "values"."compType" = 'period' and "period" = 'month' then to_char( "Expenses"."createdAt",'Mon/YYYY') 
                    when "values"."compType" = 'period' and "period" = 'year' then to_char("Expenses"."createdAt"::TIMESTAMP,'YYYY') 
                    else 'Total' end as "key",
                    cast( count ("Expenses".id) as int) as "transactionCount",
                    sum("Expenses"."total"::text::numeric ) *(-1) as "paymentTotal",
                    sum("Expenses"."total"::text::numeric )*(-1)  as "paymentEquivalent"

                from "Expenses"
                join "values" on true
                INNER join "PaymentMethods"  on "Expenses"."paymentMethodId" = "PaymentMethods".id
                inner join "Accounts" on "Accounts".id = "Expenses" ."paidThroughAccountId"
                left join "Branches" on "Branches".id = "Expenses"."branchId"
                WHERE "Branches"."companyId"= "values"."companyId"
                    AND case when "expenseDate" = Date("Expenses"."createdAt") then ("Expenses"."expenseDate" + "Expenses"."createdAt"::time)::TIMESTAMP else "expenseDate"::TIMESTAMP end >=  "values"."fromDate"
                    AND case when "expenseDate" = Date("Expenses"."createdAt") then ("Expenses"."expenseDate" + "Expenses"."createdAt"::time)::TIMESTAMP else "expenseDate"::TIMESTAMP end <  "values"."toDate" 
                    AND ( array_length("values"."branches",1) IS NULL OR "Expenses"."branchId"  = any( "values"."branches"))
                group by "PaymentMethods".id, "Accounts".name,"key"

                )
                ,"payOut" as(
                select 
                    "PaymentMethods".id as "paymentId",
                    "PaymentMethods".name as "paymentMethodName",
                    "Accounts".name as "accountName",
                    case when "values"."compType" = 'branch' then COALESCE("Branches".name,'other') 
                    when "values"."compType" = 'period' and "period" = 'month' then to_char( "Payouts"."createdAt",'Mon/YYYY') 
                    when "values"."compType" = 'period' and "period" = 'year' then to_char("Payouts"."createdAt"::TIMESTAMP,'YYYY') 
                    else 'Total' end as "key",
                    cast( count ("Payouts".id) as int) as "transactionCount",
                    sum("Payouts"."amount"::text::numeric ) *(-1) as "paymentTotal",
                    sum("Payouts"."amount"::text::numeric )*(-1)  as "paymentEquivalent"
                from "Payouts"
                join "values" on true
                INNER join "PaymentMethods"  on "Payouts"."paymentMethodId" = "PaymentMethods".id
                inner join "Accounts" on "Accounts".id = "Payouts" ."accountId"
                left join "Branches" on "Branches".id = "Payouts"."branchId"
                WHERE "Branches"."companyId"= "values"."companyId"
                    AND ("Payouts"."createdAt" >=  "values"."fromDate" AND "Payouts"."createdAt" <  "values"."toDate" )
                    AND ( array_length("values"."branches",1) IS NULL OR "Payouts"."branchId"  = any( "values"."branches"))
                    group by "PaymentMethods".id, "Accounts".name,"key"

                )

                ,"records" as(
                select 
                T."paymentId",
                T."paymentMethodName",
                T."accountName",	
                T."key",
                sum(COALESCE(T."transactionCount",0)) as "transactionCount" ,
                sum(COALESCE(T."paymentTotal",0)) as "paymentTotal",
                sum(COALESCE(T."paymentEquivalent",0)) as "paymentEquivalent" 	
                from (
                select * from "invoicePayments" union all 
                select * from "billingPayments"	union all 
                select * from "refunds"		union all 
                select * from "supplierRefunds"	union all 
                select * from "expense"	union all 
                select * from "payOut"	

                )T
                group by T."paymentId",
                T."paymentMethodName",
                T."accountName", 
                T."key")
                select
                "paymentId",
                "paymentMethodName",
                "accountName",
                (select array_agg(distinct "key")  from "records")  as "columns",
                JSON_AGG(JSON_BUILD_OBJECT("key",JSON_BUILD_OBJECT('transactionCount',COALESCE("transactionCount",0),
                                                        'paymentEquivalent',COALESCE("paymentEquivalent",0),
                                                        'paymentTotal',COALESCE("paymentTotal",0)

                                                        ))) as "summary"

                from "records"
                group by "paymentId",
                "paymentMethodName",
                "accountName"
                   `,
                values: [companyId, branches, from, to, compareType, period, NoOfperiod]
            }




            const records = await DB.excu.query(query.text, query.values);

            if (records.rows && records.rows.length > 0) {
                columns = (<any>records.rows[0]).columns ? (<any>records.rows[0]).columns : columns
                results = records.rows
            }

            let resData = {
                records: results,
                columns: columns,
                subColumns: ['transactionCount', 'paymentTotal', 'paymentEquivalent']

            }

            if(filter.export){
                let report = new ReportData()
                report.filter = { title:"Payment Method Report", 
                                  fromDate: filter && filter.fromDate ? filter.fromDate : null , 
                                  toDate: filter && filter.toDate ? filter.toDate : new Date(),
                                  branches:branches, compareType: compareType,
                                  period:period, periodQty: NoOfperiod
                                }
                report.records = results
            
                //get columns & subColumns
                resData.columns.forEach((col:any)=>{
                    let childs: DataColumn[] = []
                    resData.subColumns.forEach((subcol:any) => {
                        if (subcol === 'transactionCount') childs.push({key:subcol}) 
                        else childs.push({key:subcol, properties:{columnType:'currency'}}) 
                    }
                )
                    report.columns.push({key:col, childs:childs, properties:{hasTotal:true}})
                })
                
                report.columns = [...[{key:'paymentMethodName'}],...report.columns]
                report.fileName = 'PaymentMethodReport'
                return new ResponseData(true, "", report)

            }


            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async paymentTransactions(data: any, company: Company,brancheList:[]) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let paymentMethods = filter && filter.paymentMethods ? filter.paymentMethods :[];
            let paymentMethodName = null
            if(paymentMethods.length == 1 ){
                paymentMethodName = await PaymnetMethodRepo.getPaymentMethodName(paymentMethods[0])?? null
            }
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

      
            let query = {
                text: `WITH "values" AS (
                    SELECT  $1::uuid AS "companyId",
                            $2::uuid[] AS "branches",
                            $3::timestamp As "fromDate",
                            $4::timestamp AS "toDate",
							$5::uuid[] AS "paymentMethodIds"
	
                    )	
                     ,"invoicePayments" as (
                        select
                       
                        "Accounts".name as "accountName",
						'Invoice Payments' as "type",
						"InvoicePayments".id as "referenceId", 
						"InvoicePayments"."paymentDate" as "paymentDate", 
                        case when "InvoicePayments"."tenderAmount" = 0 then "InvoicePayments"."paidAmount"::text::NUMERIC else (COALESCE("InvoicePayments"."tenderAmount",0)::text::NUMERIC -COALESCE("InvoicePayments"."changeAmount",0)::text::NUMERIC ) end  as "paymentTotal",
                        case when "InvoicePayments"."tenderAmount" = 0 then "InvoicePayments"."paidAmount"::text::NUMERIC else  (COALESCE("InvoicePayments"."tenderAmount",0)::text::NUMERIC -COALESCE("InvoicePayments"."changeAmount",0)::text::NUMERIC ) * "InvoicePayments".rate::text::NUMERIC end   as "paymentEquivalent",
                        "InvoicePayments"."referenceNumber"
                        from "InvoicePayments"
                        join "values" on true
                        inner join "Accounts" on "Accounts".id = "InvoicePayments" ."paymentMethodAccountId"
                        inner join "Branches" on "InvoicePayments"."branchId" = "Branches".id
                        WHERE "Branches"."companyId"= "values"."companyId"
                          AND case when "paymentDate" = Date("InvoicePayments"."createdAt") then ("InvoicePayments"."paymentDate" + "InvoicePayments"."createdAt"::time)::TIMESTAMP else "paymentDate"::TIMESTAMP end >=  "values"."fromDate"
	                      AND case when "paymentDate" = Date("InvoicePayments"."createdAt") then ("InvoicePayments"."paymentDate" + "InvoicePayments"."createdAt"::time)::TIMESTAMP else "paymentDate"::TIMESTAMP end <  "values"."toDate" 
	                        AND  "InvoicePayments".status = 'SUCCESS'
							AND  ( array_length("values"."branches",1) IS NULL OR "InvoicePayments"."branchId"  = any( "values"."branches"))
                            AND ( array_length("values"."paymentMethodIds",1) IS NULL OR "InvoicePayments"."paymentMethodId"  = any( "values"."paymentMethodIds"))
                        group by "InvoicePayments".id, "Accounts".name
                        )
                        , "billingPayments" as (
                        select
              
                        "Accounts".name as "accountName",
						'Billing Payments' as "type",
						"BillingPayments".id as "referenceId",
						"BillingPayments"."paymentDate" as "paymentDate", 
                        case when "BillingPayments"."tenderAmount" = 0 then "BillingPayments"."paidAmount"::text::NUMERIC else ("BillingPayments"."tenderAmount"::text::NUMERIC  ) end  *(-1) as "paymentTotal",
                        case when "BillingPayments"."tenderAmount" = 0 then  "BillingPayments"."paidAmount"::text::NUMERIC else("BillingPayments"."tenderAmount"::text::NUMERIC  ) * "BillingPayments".rate::text::NUMERIC end*(-1)  as "paymentEquivalent",
                       "BillingPayments"."referenceNumber"
                        from "BillingPayments"
                        join "values" on true
                        inner join "Accounts" on "Accounts".id = "BillingPayments" ."paymentMethodAccountId"
                        left join "Branches" on "Branches".id = "BillingPayments"."branchId"
                         WHERE  "BillingPayments"."companyId"= "values"."companyId" 
                         AND case when "paymentDate" = Date("BillingPayments"."createdAt") then ("BillingPayments"."paymentDate" + "BillingPayments"."createdAt"::time)::TIMESTAMP else "paymentDate"::TIMESTAMP end >=  "values"."fromDate"
	                      AND case when "paymentDate" = Date("BillingPayments"."createdAt") then ("BillingPayments"."paymentDate" + "BillingPayments"."createdAt"::time)::TIMESTAMP else "paymentDate"::TIMESTAMP end <  "values"."toDate" 
                          AND ( array_length("values"."branches",1) IS NULL OR "BillingPayments"."branchId" = any( "values"."branches") )
						  AND ( array_length("values"."paymentMethodIds",1) IS NULL OR "BillingPayments"."paymentMethodId"  = any( "values"."paymentMethodIds"))
                        group by "BillingPayments".id , "Accounts".name)
                        ,"refunds" as (
						select 
						
                        "Accounts".name as "accountName",
					    'Credit Note Refunds' as "type",
						"CreditNoteRefunds".id as "referenceId",
                        "CreditNoteRefunds"."refundDate" as "paymentDate",
                    
                       "CreditNoteRefunds"."total"::text::numeric  *(-1) as "paymentTotal",
                      "CreditNoteRefunds"."total"::text::numeric *(-1)  as "paymentEquivalent",
						 "CreditNoteRefunds"."refrenceNumber" as "referenceNumber"
							from "CreditNoteRefunds"
							    join "values" on true
							INNER JOIN "CreditNoteRefundLines" on "CreditNoteRefundLines"."creditNoteRefundId" = "CreditNoteRefunds".id 
							INNER join "PaymentMethods"  on "CreditNoteRefundLines"."paymentMethodId" = "PaymentMethods".id
							inner join "Accounts" on "Accounts".id = "CreditNoteRefundLines" ."accountId"
							left join "Branches" on "Branches".id = "CreditNoteRefunds"."branchId"
							        WHERE "Branches"."companyId"= "values"."companyId"
                            AND case when "refundDate" = Date("CreditNoteRefunds"."createdAt") then ("CreditNoteRefunds"."refundDate" + "CreditNoteRefunds"."createdAt"::time)::TIMESTAMP else "refundDate"::TIMESTAMP end >=  "values"."fromDate"
	                        AND case when "refundDate" = Date("CreditNoteRefunds"."createdAt") then ("CreditNoteRefunds"."refundDate" + "CreditNoteRefunds"."createdAt"::time)::TIMESTAMP else "refundDate"::TIMESTAMP end <  "values"."toDate"
                            AND ( array_length("values"."branches",1) IS NULL OR "CreditNoteRefunds"."branchId"  = any( "values"."branches"))
							  AND ( array_length("values"."paymentMethodIds",1) IS NULL OR "CreditNoteRefundLines"."paymentMethodId"  = any( "values"."paymentMethodIds"))
                        group by "CreditNoteRefunds".id, "Accounts".name
						),"supplierRefunds" as (
						select 
	
                        "Accounts".name as "accountName",
					   'Supplier Refunds' as "type",
						"SupplierRefunds".id as "referenceId",
                        "SupplierRefunds"."refundedDate" as "paymentDate",
                 
                       "SupplierRefunds"."total"::text::numeric as "paymentTotal",
                         "SupplierRefunds"."total"::text::numeric   as "paymentEquivalent",
									 "SupplierRefunds"."referenceNumber"
							from "SupplierRefunds"
							    join "values" on true
							INNER JOIN "SupplierRefundLines" on "SupplierRefundLines"."supplierRefundId" = "SupplierRefunds".id 
							INNER JOIN "SupplierCredits" on "SupplierRefunds"."supplierCreditId" = "SupplierCredits".id 
							INNER join "PaymentMethods"  on "SupplierRefundLines"."paymentMethodId" = "PaymentMethods".id
							inner join "Accounts" on "Accounts".id = "SupplierRefundLines" ."accountId"
							left join "Branches" on "Branches".id = "SupplierCredits"."branchId"
							        WHERE "Branches"."companyId"= "values"."companyId"
                           AND case when "refundedDate" = Date("SupplierRefunds"."createdAt") then ("SupplierRefunds"."refundedDate" + "SupplierRefunds"."createdAt"::time)::TIMESTAMP else "refundedDate"::TIMESTAMP end >=  "values"."fromDate"
	                    AND case when "refundedDate" = Date("SupplierRefunds"."createdAt") then ("SupplierRefunds"."refundedDate" + "SupplierRefunds"."createdAt"::time)::TIMESTAMP else "refundedDate"::TIMESTAMP end <  "values"."toDate" 
	
                            AND ( array_length("values"."branches",1) IS NULL OR "SupplierCredits"."branchId"  = any( "values"."branches"))
							AND ( array_length("values"."paymentMethodIds",1) IS NULL OR "SupplierRefundLines"."paymentMethodId"  = any( "values"."paymentMethodIds"))

                        group by "SupplierRefunds".id, "Accounts".name
						),"expense" as(
						select 
                            "Accounts".name as "accountName",
                            'Expenses' as "type",
                            "Expenses".id as "referenceId",
                            "Expenses"."expenseDate" as "paymentDate",
                            "Expenses"."total"::text::numeric  *(-1) as "paymentTotal",
                            "Expenses"."total"::text::numeric *(-1)  as "paymentEquivalent",
                            "Expenses"."referenceNumber"
						from "Expenses"
						join "values" on true
						INNER join "PaymentMethods"  on "Expenses"."paymentMethodId" = "PaymentMethods".id
						inner join "Accounts" on "Accounts".id = "Expenses"."paidThroughAccountId"
						left join "Branches" on "Branches".id = "Expenses"."branchId"
						WHERE "Branches"."companyId"= "values"."companyId"
                            AND case when "expenseDate" = Date("Expenses"."createdAt") then ("Expenses"."expenseDate" + "Expenses"."createdAt"::time)::TIMESTAMP else "expenseDate"::TIMESTAMP end >=  "values"."fromDate"
	                        AND case when "expenseDate" = Date("Expenses"."createdAt") then ("Expenses"."expenseDate" + "Expenses"."createdAt"::time)::TIMESTAMP else "expenseDate"::TIMESTAMP end <  "values"."toDate" 
                            AND ( array_length("values"."branches",1) IS NULL OR "Expenses"."branchId"  = any( "values"."branches"))
							AND ( array_length("values"."paymentMethodIds",1) IS NULL OR "Expenses"."paymentMethodId"  = any( "values"."paymentMethodIds"))
                        group by "Expenses".id, "Accounts".name
						
						)
                        ,"payOut" as (
                        select "Accounts".name as "accountName",
                                'Payouts' as "type",
                                "Payouts".id as "referenceId",
                                "Payouts"."createdAt"::Date as "paymentDate",

                                "Payouts"."amount"::text::numeric  *(-1) as "paymentTotal",
                                "Payouts"."amount"::text::numeric *(-1)  as "paymentEquivalent",
                                "Payouts"."referenceNumber"
                            from "Payouts"
                            join "values" on true
							INNER join "PaymentMethods"  on "Payouts"."paymentMethodId" = "PaymentMethods".id
							inner join "Accounts" on "Accounts".id = "Payouts" ."accountId"
							left join "Branches" on "Branches".id = "Payouts"."branchId"
							WHERE "Branches"."companyId"= "values"."companyId"
                                AND ("Payouts"."createdAt" >=  "values"."fromDate" AND "Payouts"."createdAt" <  "values"."toDate" )
                                AND ( array_length("values"."branches",1) IS NULL OR "Payouts"."branchId"  = any( "values"."branches"))
                                AND ( array_length("values"."paymentMethodIds",1) IS NULL OR "Payouts"."paymentMethodId"  = any( "values"."paymentMethodIds"))
                            group by "Payouts".id, "Accounts".name
                        )
                    
                        
						select count(*) over(), sum("paymentTotal"::text::numeric) over()::float as "paymentTotals",
						sum("paymentEquivalent"::text::numeric) over()::float as "paymentEquivalentTotal",
						T.*
						from(
                        select * from "invoicePayments" union all
							select * from "billingPayments"	 union all
							select * from "refunds"	 union all
							select * from "supplierRefunds"	 union all
							select * from "expense"	 union all
                            select * from "payOut"
                      )T
                       order by  "paymentDate"


                   `,
                values: [companyId, branches, from, to, paymentMethods]
            }

            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`


            const records = await DB.excu.query(query.text+ limitQuery, query.values);
            if (records.rows && records.rows.length > 0 ){
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total =  {paymentTotal: t.paymentTotals, paymentEquivalent: t.paymentEquivalentTotal} 
                resault = records.rows.map((e: any) => {return {accountName : e.accountName, type:e.type, 
                                                                referenceId:e.referenceId,referenceNumber:e.referenceNumber, paymentDate:e.paymentDate,  amount: e.amount, 
                                                                paymentTotal:e.paymentTotal, paymentEquivalent: e.paymentEquivalent
                                                                }} )
            }

            if(filter.export){
                let report = new ReportData()
                resault.forEach(elem =>{elem.paymentDate =  moment.utc(elem.paymentDate).utcOffset( +timeOffset ).format('YYYY-MM-DD')})
                report.filter = { title:"Payment Method Report", 
                                  fromDate: filter && filter.fromDate ? filter.fromDate : null , 
                                  toDate: filter && filter.toDate ? filter.toDate : new Date(),
                                  branches:branches, 
                                  filterList: {paymentMethodName : paymentMethodName},
                                  paymentMethodName : paymentMethodName
                                }
                report.records = resault
                report.columns = [  {key:'paymentDate', properties: { columnType: 'date' } },
                                     {key:'type'}, {key:'accountName'},
                                    {key:'paymentTotal',properties:{hasTotal:true, columnType:'currency'} }, 
                                    {key:'paymentEquivalent',properties:{hasTotal:true, columnType:'currency'} }, 
                                ]
                report.fileName = 'PaymentMethodReport'
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
          

            throw new Error(error.message)
        }
    }
    public static async dailyPaymentReport(data: any, company: Company,brancheList:[]) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let timeOffset = company.timeOffset
            let branchId = filter && filter.branchId ? filter.branchId : null;
            let paymentMethods = filter && filter.paymentMethods ? filter.paymentMethods :[];

            if(!branchId){throw new ValidationException("branchId id required")}

            //######## set time ##########
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;
            

            if (applyOpeningHour == true) {
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
            }

            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
            let from = interval.from
            let to = interval.to

            //##########################
           
            let resault:any[] = []; 

      
            let query = {
                text: `with "values" as (
                        select	$1::uuid as "companyId",
                                $2::uuid as "branchId",
                                $3::timestamp  as "fromDate",
                                $4::timestamp as "toDate"
                        )
                        ,"time" as (
                        select generate_series as "date", 
                               generate_series+(interval '1 day') as "date2" 
                        from  generate_series( $3::timestamp, $4::timestamp ,'1 DAY') 
                        order by generate_series
                        )
                        ,"paidAmount" as(			 
                        select  "paymentMethodId",
                                "time"."date", 
                                sum(case when "InvoicePayments"."tenderAmount" = 0 then "InvoicePayments"."paidAmount" ::text::NUMERIC else (COALESCE("InvoicePayments"."tenderAmount",0) -COALESCE("InvoicePayments"."changeAmount",0) )::text::NUMERIC end) as "amount"
                        from  "InvoicePayments" 
                        join "values" on TRUE 
                        join "time" on ("InvoicePayments"."createdAt" BETWEEN "date" and "date2") 
                        where "InvoicePayments"."branchId" = "values"."branchId"
							and "InvoicePayments".status = 'SUCCESS'
							and case when "paymentDate" = Date("InvoicePayments"."createdAt") then ("InvoicePayments"."paymentDate" + "InvoicePayments"."createdAt"::time)::TIMESTAMP else "paymentDate"::TIMESTAMP end >=  "values"."fromDate"
							and case when "paymentDate" = Date("InvoicePayments"."createdAt") then ("InvoicePayments"."paymentDate" + "InvoicePayments"."createdAt"::time)::TIMESTAMP else "paymentDate"::TIMESTAMP end <  "values"."toDate" 

                        group by "paymentMethodId","date" 
                        )
                        , "refundAmount" as (
                        SELECT  "time"."date",
                                sum("CreditNoteRefunds".total) as "totalRefund" 
                        from "CreditNoteRefunds" 
                        join "values" on TRUE 
                        join "time" on   ("CreditNoteRefunds"."createdAt" BETWEEN  "time"."date" and "date2")
                        where "CreditNoteRefunds"."branchId" = "values"."branchId"
							    AND case when "refundDate" = Date("CreditNoteRefunds"."createdAt") then ("CreditNoteRefunds"."refundDate" + "CreditNoteRefunds"."createdAt"::time)::TIMESTAMP else "refundDate"::TIMESTAMP end >=  "values"."fromDate"
                  				AND case when "refundDate" = Date("CreditNoteRefunds"."createdAt") then ("CreditNoteRefunds"."refundDate" + "CreditNoteRefunds"."createdAt"::time)::TIMESTAMP else "refundDate"::TIMESTAMP end <  "values"."toDate" 
                        group by "date" 
                        )	
                        ,"paymnetsData" as (
                        select "time".date,  COALESCE(sum(amount),0) as "paidTotal",
                                jsonb_object_agg( COALESCE("PaymentMethods".name,'other'),  COALESCE( amount,0))as "payments"
                        from "PaymentMethods" 
                        join "time" on true
                        inner join "paidAmount" on "time"."date" ="paidAmount"."date" and "paidAmount"."paymentMethodId"  = "PaymentMethods".id
                        where "PaymentMethods"."companyId" = $1
                        GROUP BY "time"."date"
                        ) 
						,"keys" as (select json_agg(distinct  bb) as "keys" from "paymnetsData", jsonb_object_keys(payments)bb )
					
                        select "time".date  as "date" , 
                                TO_CHAR("time".date +  (COALESCE($5,0)  || ' h')::interval, 'Dy') as "dayOfWeek",  
                                "payments", "totalRefund"  , COALESCE("paidTotal", 0) - COALESCE("totalRefund",0) as total ,  "keys" 
                        from "time"
						join "keys" on true
						left join "paymnetsData" on  "paymnetsData".date = "time".date
                        left join "refundAmount" on  "refundAmount".date = "time".date
                        order by "time".date
                   `,
                values: [companyId, branchId, from, to, timeOffset]
            }

            const records = await DB.excu.query(query.text, query.values);
          
            
            resault = (records.rows && records.rows.length > 0 ) ? records.rows :[]
            let childs : DataColumn[] = []
            let subColumns =  (<any>records.rows[0]).keys ? (<any>records.rows[0]).keys.forEach((subcol: any) => childs.push({ key: subcol, properties: { hasTotal:true,columnType: 'currency' } })) :[]

          
            if(filter.export){
                let report = new ReportData()
                resault.forEach(elem =>{elem.date =  moment.utc(elem.date).utcOffset( +timeOffset ).format('YYYY-MM-DD')})
                report.filter = { title:"Daily Payment Report", 
                                  fromDate: filter && filter.fromDate ? filter.fromDate : null , 
                                  toDate: filter && filter.toDate ? filter.toDate : new Date(),
                                  branches:[branchId]
                                }
                report.records = resault
                report.columns = [  {key:'date', properties: { columnType: 'date' } },
                                    {key:'dayOfWeek', properties: { columnType: 'dayOfWeek' } },
                                    {key:'payments',childs:childs ,properties:{hasTotal:true, columnType:'currency'} }, 
                                    {key:'totalRefund',properties:{hasTotal:true, columnType:'currency'} }, 
                                    {key:'total',properties:{hasTotal:true, columnType:'currency'} }, 
                                ]
                report.fileName = 'DailyPaymentReport'
                return new ResponseData(true, "", report)

            }

            let resData = {
                records: resault.map(({keys, ...rest}:any)=>rest),
                columns : [ 'payments'],
                subColumns:  (<any>records.rows[0]).keys
            }

        

            return new ResponseData(true, "",  resData)
            
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }


}