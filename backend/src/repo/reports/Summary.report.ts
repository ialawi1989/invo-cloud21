import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { TimeHelper } from "@src/utilts/timeHelper";
import { Company } from "@src/models/admin/company";
import moment from 'moment'

import { ReportData } from "@src/utilts/xlsxGenerator";
import { BranchesRepo } from "../admin/branches.repo";
import _ from "lodash";

export class SummaryReport{


    public static async getSalesByCategory(data: any, company: Company,brancheList:[]) {
  
        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : brancheList;
             //######################## set time ########################
     
             let closingTime = "00:00:00"
             let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
             let toDate = filter && filter.toDate ?  moment(new Date(filter.toDate)) : moment();
             let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;
         
 
             if(applyOpeningHour == true){
                 let branchId = branches[0]
                 closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
             }
             
             
             let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate,toDate,closingTime,applyOpeningHour,timeOffset)
             let from = interval.from
             let to = interval.to
             let asOf = filter && filter.allowAsOf ? filter.allowAsOf : false
            if (asOf == true) {from = null }
            //#########################################################


            if(!Array.isArray(branches) || branches.length == 0){ branches = null  };

             

             /**
                        "creditNoteLines" as (

                                            
                            select      				     
                            (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end) as "sales",
                           "CreditNoteLines"."taxTotal"  as "taxTotal",
							 "CreditNoteLines"."subTotal",
                           "CreditNoteLines"."discountTotal" as "discountTotal",
                           "CreditNoteLines".total as "total",
                             "CreditNoteLines"."qty",
                            "CreditNoteLines"."createdAt",
                            "CreditNoteLines"."branchId",
                            "CreditNoteLines"."productId",
                            "CreditNoteLines"."companyId"
                        from "CreditNoteLines"
                        where "CreditNoteLines"."companyId" = $1
                        and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  = any($2::uuid[]) )
                        and ("CreditNoteLines"."createdAt" >=  $3::timestamp 	and "CreditNoteLines"."createdAt" < $4)
              
                        ),
                        "creditNoteData" as (
                        select   prod."categoryId" as  "categoryId",
                                 Sum("creditNoteLines".qty) *(-1) as qty, 
                    sum("sales" )*(-1) As "totalSales",
                    sum( sum("sales")::text::NUMERIC) over() *(-1) as total,
                                'creditNote' as "transactionType"
                        from "creditNoteLines"
                        inner join "Branches"   on  "Branches".id = "creditNoteLines"."branchId"
                        left join "Products" as prod  on  prod.id = "creditNoteLines"."productId" 
                        group by prod."categoryId"
                        
                        ), */

            const query : { text: string, values: any } = {
                text: `WITH   "lines" as (       
                            select      				     
                           (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
                           "InvoiceLines"."taxTotal" as "taxTotal",
                           "InvoiceLines"."discountTotal" as "discountTotal",
                            "InvoiceLines".total as "total",
                            "InvoiceLines"."invoiceId",
                            "InvoiceLines"."qty",
                            "InvoiceLines"."createdAt",
                            "InvoiceLines"."branchId",
                            "InvoiceLines"."productId",
                            "InvoiceLines"."companyId"
                        from "InvoiceLines"
                        where "InvoiceLines"."companyId" = $1
                        and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any($2::uuid[]))
                        and (($3::timestamp is null or  "InvoiceLines"."createdAt" >= $3::timestamp) and "InvoiceLines"."createdAt" < $4)
                     ),
                        "invoiceData" as (
                        select   prod."categoryId" as  "categoryId",
                               Sum("lines".qty) as qty, 
                    sum("sales"::text::NUMERIC ) As "totalSales",
                    sum( sum("sales")::text::NUMERIC) over() as total,
                  
                                'invoice' as "transactionType"
                        from "lines"
                        inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                        inner join "Branches"   on "Branches".id = "lines"."branchId"
                        left join "Products" as prod  on prod.id = "lines"."productId" 
							group by  prod."categoryId"
                                        ),
                        T AS (          
                        select * from "invoiceData" 
                        )
                       
                            select "Categories".id AS "categoryId",
                            COALESCE("Categories".name,'Uncategorized')as "category",
                         
                             Sum(qty) as qty,
                            sum(sum("totalSales"::text::numeric)) over() as "total",
                            sum ("totalSales"::text::numeric) as "salesTotal",
                           ROUND(100 * (SUM(COALESCE("totalSales",0))::numeric / sum(SUM(COALESCE("totalSales",0))::numeric)  over()),$5::INT) percentage 
                 
                        from T
                        left join "Categories" on "Categories".id = T. "categoryId"

                        group by "Categories".id 
                        order by  "category" `,
                values: [companyId, branches, from, to, afterDecimal]
            }
            console.log(query.text, query.values)
            const reports = await DB.excu.query(query.text, query.values)


            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Sales Summary",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                let  columns ={
                    'category':{},
                    'percentage': {columnType:'percentage'},
                    'salesTotal':{hasTotal:true, columnType:'currency'}
                    //{name: 'Qty', totalsRowFunction: 'none', filterButton: false},
                    // {key: 'percentage', properties:{columnType:'percentage'}},
                    // {key: 'salesTotal', properties:{hasTotal:true, columnType:'currncy'}},
                    
                 }
                 
                report.records = [{records : reports.rows.map((e: any) => { return { category: e.category, percentage:Number( e.percentage) , salesTotal: Number(e.salesTotal) } }), columns : columns}
                ]
                report.fileName = 'SalesSummary'

                

                return new ResponseData(true, "", report)
            }

            
   
            return new ResponseData(true, "", reports.rows)

        } catch (error:any) {
          
 
            throw new Error(error)
        }
    }

    public static async stats(data: any, company: Company,brancheList:[]) {
   
        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : brancheList;
           //######################## set time ########################
       
           let closingTime = "00:00:00"
           let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
           let toDate = filter && filter.toDate ?  moment(new Date(filter.toDate)) : moment();
           let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;


           if(applyOpeningHour == true){
               let branchId = branches[0]
               closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
           }
           
           let timeOffset = company.timeOffset
          let interval = await TimeHelper.getReportTime(fromDate,toDate,closingTime,applyOpeningHour,timeOffset)
           let from = interval.from
           let to = interval.to

           let asOf = filter && filter.allowAsOf ? filter.allowAsOf : false
           if (asOf == true) {from = null }
          //#########################################################
            if(!Array.isArray(branches) || branches.length == 0){ branches = null  };

          

            let query : { text: string, values: any } = {
                text: `WITH "lines" as (			
                        select      				     
					 case when "InvoiceLines"."isInclusiveTax" = true then ((COALESCE("InvoiceLines"."subTotal",0)::text::numeric) - (COALESCE("InvoiceLines"."taxTotal",0)::text::numeric) - (COALESCE("InvoiceLines"."discountTotal",0)::text::numeric)) else (COALESCE("InvoiceLines"."subTotal",0)::text::numeric - (COALESCE("InvoiceLines"."discountTotal",0)::text::numeric)) end as "totalAfterDiscount",
                        "InvoiceLines"."taxTotal" as "taxTotal",
                        "InvoiceLines"."discountTotal" as "discountTotal",
                         "InvoiceLines".total as "total",
                         "InvoiceLines".qty as "qty",
                        "InvoiceLines"."invoiceId",
                        "InvoiceLines"."createdAt",
                        "InvoiceLines"."branchId",
                        "InvoiceLines"."productId",
                        "InvoiceLines"."companyId",
                        "InvoiceLines"."discountId"
                    from "InvoiceLines"
                    where "InvoiceLines"."companyId" = $1
                    and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any ($2::uuid[]))
                    and (($3::timestamp is null or  "InvoiceLines"."createdAt" >= $3::timestamp )	 and "InvoiceLines"."createdAt" < $4)
                    ),
                    "invoiceData" as (
                    select   sum("lines"."total") as "totalSales" ,
                             sum("lines"."qty") as "salesItems" ,
						      0 AS "returnsItems",
                            sum("lines"."discountTotal") as "discountTotal",
                            sum("lines"."totalAfterDiscount") as "totalAfterDiscount",
						    0 as "totalReturn",
                           sum( "lines"."taxTotal")   + COALESCE(("Invoices"."chargesTaxDetails"->>'taxAmount')::numeric,0)   as "totalTax",
                         sum(case when "lines"."qty" < 0 then "lines"."total"::text::numeric else 0 end ) as "totalVoided",  
				         count(distinct "Invoices".id) as "totalOrder"
                            
                    from "lines"
                    inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
	                   group by "Invoices".id

                                    ),
                    "creditNoteLines" as (

                                        
                        select      				     
					case when "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE("CreditNoteLines"."subTotal",0)::text::numeric) - (COALESCE("CreditNoteLines"."taxTotal",0)::text::numeric) - (COALESCE("CreditNoteLines"."discountTotal",0)::text::numeric)) else (COALESCE("CreditNoteLines"."subTotal",0)::text::numeric - (COALESCE("CreditNoteLines"."discountTotal",0)::text::numeric)) end as "totalAfterDiscount",
                       "CreditNoteLines"."taxTotal" as "taxTotal",
                     "CreditNoteLines"."discountTotal" as "discountTotal",
                       "CreditNoteLines".total as "total",

                        "CreditNoteLines"."createdAt",
                        "CreditNoteLines"."branchId",
                        "CreditNoteLines"."productId",
                        "CreditNoteLines"."companyId",
                        "CreditNoteLines"."creditNoteId",
						  "CreditNoteLines"."discountId"
                    from "CreditNoteLines"
                    where "CreditNoteLines"."companyId" = $1
                    and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId" =any($2::uuid[]))
                    and (($3::timestamp is null or "CreditNoteLines"."createdAt" >= $3::timestamp )	 and "CreditNoteLines"."createdAt" < $4)
                
                    ),
                    "creditNoteData" as (
                    select  0 As "totalSales",
							0 AS "salesItems", 
							0 AS "returnsItems", 
							0 AS "discountTotal",
							0 as "totalAfterDiscount",
							sum("creditNoteLines"."total"::text::numeric) as "totalReturn",
							0 AS "totalTax",
							0 as "totalVoided",
							0 as "totalOrder"
                    from "creditNoteLines"

                    ),
                    T AS (          
                    select * from "invoiceData" union all select * from "creditNoteData"
                    )  ,
                    "sales" AS(
                    SELECT 
                    sum (COALESCE("totalSales",0)::text::numeric) as "totalSales",
                    SUM (COALESCE("salesItems",0)::text::numeric) as "salesItems" ,
                    SUM (COALESCE("returnsItems",0)::text::numeric) as "returnsItems" ,
                    SUM (COALESCE("discountTotal",0)::text::numeric) AS "discountTotal",
					sum (COALESCE("totalAfterDiscount",0)::text::numeric) as "totalAfterDiscount",
                    sum (COALESCE("totalReturn",0)::text::numeric) as "totalReturn",
                    SUM (COALESCE("salesItems",0)::text::numeric) - SUM (COALESCE(t."returnsItems",0)::text::numeric) AS "totalItems",
                   
                    SUM (COALESCE("totalTax",0)::text::numeric) AS "totalTax",
                    SUM (COALESCE("totalVoided",0)::text::numeric) AS "totalVoided",
                    SUM (COALESCE("totalOrder",0)::text::numeric) AS "totalOrder"
                    From T
                    ),  "invoiceInfo" as (
					
					  select 
                    SUM(COALESCE(invo."discountTotal", 0)::text::numeric)    AS "discountTotal",
                    sum( case when invo."isInclusiveTax" then  invo."chargeTotal" - COALESCE(("chargesTaxDetails"->>'taxAmount')::real,0) else  invo."chargeTotal" end) as "totalCharge",
                    SUM(COALESCE(invo."deliveryCharge", 0)::text::numeric) AS "totalDeliveryCharge",
                    SUM(COALESCE(invo."roundingTotal", 0)::text::numeric)  AS  "totalRounding",
                    SUM(COALESCE(COALESCE(nullif(guests,0),1), 0)) AS  "guests"
                    From "Invoices" AS invo 
                    INNER JOIN "Branches" ON invo."branchId" = "Branches".id
                    WHERE invo."companyId"= $1
                      AND (array_length($2::uuid[], 1) IS NULL OR (invo."branchId"=any($2::uuid[])))
                      AND (invo."status" <>'Draft' )
                      AND ($3::timeStamp  is null or invo."createdAt" >= $3::timeStamp) AND invo."createdAt" < $4::timeStamp
					),
                    "stats" AS(
					 select sum(COALESCE("discountTotal",0)::text::numeric) As "discountTotal", sum("totalCharge") As "totalCharge", sum("totalDeliveryCharge") As "totalDelivery", 
                           sum("totalRounding") AS "totalRounding",  sum("guests") AS guests
					FROM "invoiceInfo"
					)      select   "totalSales"::float,   COALESCE("sales"."discountTotal",0)::text::numeric ::float as "discountTotal", "totalAfterDiscount"::float ,"totalCharge"::float , "totalDelivery"::float , "totalTax"::float , "totalRounding"::float, "totalVoided"::float, "salesItems"::float, "returnsItems"::float,"totalItems"::float,"totalOrder"::INT,"guests"::INT 
                    ,case when "totalOrder" > 0 then ("totalAfterDiscount"/"totalOrder")::float end As "avgSalesPerOrder"
                    ,case when "guests"     > 0 then ("totalAfterDiscount"/"guests")::float    end As "avgSalesPerGuest",	"totalReturn"::float

                    FROM "stats","sales" `,

                values: [companyId, branches, from, to]
            }

            const reports = await DB.excu.query(query.text, query.values)

            query = {
                text: `WITH 
                    "RefundDetails" AS (
                    SELECT PM.id,
                    COALESCE( PM.name,'Account') AS name,
                    COUNT(distinct CR.id ) As total_transaction, 
                    (SUM(CRL.amount::text::NUMERIC)) AS refund, 
                    0 as payout
                    
                    FROM "CreditNoteRefunds" AS CR 
                    INNER JOIN "CreditNoteRefundLines" AS CRL ON CRL."creditNoteRefundId" = CR.id
                    LEFT JOIN "PaymentMethods" AS PM ON CRL."paymentMethodId" = PM.id
                    INNER JOIN "Branches" ON CR."branchId" = "Branches".id
                    WHERE  "Branches"."companyId"= $1
                     AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
                     AND (CR."refundDate"::timestamp >= $3  AND CR."refundDate"::timestamp < $4)
                    GROUP BY PM.id, PM.name	
                    ORDER BY PM.name
                    ),
                    "PayoutTotal" AS (
                    SELECT PM.id, 
                    COALESCE( PM.name,'Account') AS name,
                    count(distinct PO.id ) As total_transaction, 
                    0 as refund,
                    (sum(PO.amount::text::NUMERIC)) AS payout
                   
                    FROM "Payouts" AS PO 
                    LEFT JOIN "PaymentMethods" AS PM ON PO."paymentMethodId" = PM.id
                    INNER JOIN "Branches" ON PO."branchId" = "Branches".id
                    WHERE  "Branches"."companyId"=  $1
                     AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
                     AND (PO."createdAt" >= $3 AND PO."createdAt" < $4)
                    GROUP BY PM.id, PM.name	
                    ORDER BY PM.name
                    )
                    SELECT  
                       sum(refund) :: float AS "totalRefund",
                       sum(payout) :: float AS "payout"
                    FROM(
                   
                    SELECT * FROM "RefundDetails" 
                    UNION
                    SELECT * FROM "PayoutTotal" 
                    )T
                     `,

                values: [companyId, branches, from, to]
            }
            const refund = await DB.excu.query(query.text, query.values)
             let resData:any = reports.rows[0]  
             resData.totalRefund = (<any>refund.rows[0]).totalRefund ??0
             resData.payout = (<any>refund.rows[0]).payout ??0
 
            

            if(filter.export){
                let arrayOfData :any[] =[]
            
                Object.keys(reports.rows[0]).forEach((elem:any, idx:Number)=>{
                    if(elem != 'totalRefund' && elem !='payout'){
                        arrayOfData.push({'key':_.startCase(elem), '':'', 'value':reports.rows[0][elem]})
                    }
                    
                })
                
                let columns ={
                    'key' :{},
                    '':{},
                    'value' : {columnType:'currency'} 
                }
                     //{name: 'Qty', totalsRowFunction: 'none', filterButton: false},
                
       
                return new ResponseData(true, "", {records :arrayOfData, columns : columns, refund : resData.totalRefund, payout : resData.payout})

            }



    
            return new ResponseData(true, "", resData)
            
        } catch (error:any) {
          
     
            throw new Error(error)
        }
    }

    public static async received(data: any, company: Company,brancheList:[]) {
 
        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : brancheList;
            if(!Array.isArray(branches) || branches.length == 0){ branches = null  };
             //######################## set time ########################
       
             let closingTime = "00:00:00"
             let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
             let toDate = filter && filter.toDate ?  moment(new Date(filter.toDate)) : moment();
             let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;

 
             if(applyOpeningHour == true){
                 let branchId = branches[0]
                 closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
             }
             
             let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate,toDate,closingTime,applyOpeningHour,timeOffset)
             let from = interval.from
             let to = interval.to

             let asOf = filter && filter.allowAsOf ? filter.allowAsOf : false
           if (asOf == true) {from = null }
         
            //#########################################################
             



            let query : { text: string, values: any } = {
                text: `WITH "InvoicePaymentDetails" AS (
                    SELECT PM.id,
                           IP.id as "paymentId",
                    COALESCE( PM.name,'Account') AS name,
                    count(*) As total_transaction, 
                    sum(case when IP."tenderAmount" = 0 then IP."paidAmount" else (COALESCE(IP."tenderAmount"::text::numeric,0.0) - COALESCE(IP."changeAmount"::text::numeric,0.0) )::text::numeric end ) AS amount_paid, 
                    sum(case when IP."tenderAmount" = 0 then IP."paidAmount" else (COALESCE(IP."tenderAmount"::text::numeric,0.0) - COALESCE(IP."changeAmount"::text::numeric,0.0) )::text::numeric * IP.rate end )::NUMERIC  AS actual_amount_paid
                     FROM "InvoicePayments" AS IP 
                    LEFT JOIN "PaymentMethods" AS PM ON IP."paymentMethodId" = PM.id
                    INNER JOIN "Branches" ON IP."branchId" = "Branches".id
                    WHERE "Branches"."companyId"= $1
                    AND IP."status" = 'SUCCESS'
                    AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
                    AND (  $3::timeStamp  is null or (case when "paymentDate" = Date(IP."createdAt") then (IP."paymentDate" + IP."createdAt"::time)::TIMESTAMP else "paymentDate"::TIMESTAMP end >= $3::TIMESTAMP) )
                    AND case when "paymentDate" = Date(IP."createdAt") then (IP."paymentDate" + IP."createdAt"::time)::TIMESTAMP else "paymentDate"::TIMESTAMP end < $4::TIMESTAMP
                  GROUP BY   PM.id, PM.name, "paymentId"	
                    ORDER BY PM.name
                    )
                    SELECT id, name , sum (total_transaction::text::numeric) AS total_transaction , sum(amount_paid::text::numeric) AS amount_paid , sum(actual_amount_paid::text::numeric)  AS actual_amount_paid
                     FROM "InvoicePaymentDetails" 
                   
                    
                    GROUP BY id, name `,

                values: [companyId, branches, from, to]
            }
            const reports = await DB.excu.query(query.text, query.values)

            if(filter.export){
                let  columns ={
                    'Tender':{},
                    'AmountPaid': {hasTotal:true, columnType:'currency'},
                    'ActualAmountPaid':{hasTotal:true, columnType:'currency'}
                    //{name: 'Qty', totalsRowFunction: 'none', filterButton: false},
                    // {key: 'percentage', properties:{columnType:'percentage'}},
                    // {key: 'salesTotal', properties:{hasTotal:true, columnType:'currncy'}},
                    
                 }
                
      
                return new ResponseData(true, "", {records : reports.rows.map((e: any) => { return { Tender: e.name, AmountPaid:Number( e.amount_paid) , ActualAmountPaid: Number(e.actual_amount_paid) } }), columns : columns})
            }

             

            return new ResponseData(true, "", reports.rows)
            
        } catch (error:any) {
          
         
            throw new Error(error)
        }
    }

    public static async discount(data: any, company: Company,brancheList:[]) {

        try {
            

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : brancheList;

              //######################## set time ########################
       
              let closingTime = "00:00:00"
              let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
              let toDate = filter && filter.toDate ?  moment(new Date(filter.toDate)) : moment();
              let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;
      
  
              if(applyOpeningHour == true){
                  let branchId = branches[0]
                  closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
              }
              
              let timeOffset = company.timeOffset
             let interval = await TimeHelper.getReportTime(fromDate,toDate,closingTime,applyOpeningHour,timeOffset)
              let from = interval.from
              let to = interval.to

              let asOf = filter && filter.allowAsOf ? filter.allowAsOf : false
           if (asOf == true) {from = null }
             //#########################################################
             if(!Array.isArray(branches) || branches.length == 0){ branches = null  };





            const query : { text: string, values: any } = {
                text: `WITH "invoiceData" as (			
                        select      				     
                        
	                    "InvoiceLines"."discountId",
	                    sum("InvoiceLines"."discountTotal") as "discountTotal",
                        COUNT( "InvoiceLines".id)
                       
                    from "InvoiceLines"
                    where "InvoiceLines"."companyId" = $1
                    and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any ($2::uuid[]))
                    and ( ($3::timestamp is null or  "InvoiceLines"."createdAt" >= $3::timestamp )	 and "InvoiceLines"."createdAt" < $4)
	                group by       "InvoiceLines"."discountId"
	                union all 
	                select 
                       invo."discountId", 
             
                        sum( COALESCE(invo."discountTotal",0)::text::numeric) AS "discountTotal" ,
                        COUNT(invo.id)
                    FROM "Invoices" as invo
          
                
                    where invo."companyId"= $1
                        AND (array_length($2::uuid[], 1) IS NULL OR (invo."branchId"=any($2::uuid[])))
                        AND (invo."status" <>'Draft'  )
                        AND (  $3::timeStamp  is null or invo."createdAt" >= $3::timestamp) AND invo."createdAt" < $4::timestamp
                    group by    invo."discountId"
                    ),"creditNoteData" as (

                                        
                        select      				     
					  "CreditNoteLines"."discountId",
	                    sum("CreditNoteLines"."discountTotal") as "discountTotal",
                        COUNT( "CreditNoteLines".id)
                    from "CreditNoteLines"
                    where "CreditNoteLines"."companyId" = $1
                    and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId" =any($2::uuid[]))
                    and (( $3::timestamp is null or "CreditNoteLines"."createdAt" >= $3::timestamp )	 and "CreditNoteLines"."createdAt" < $4)
                 group by     "CreditNoteLines"."discountId"
						
						union all 
						 select 
                                CN."discountId", 
                      
                        sum( COALESCE(CN."discountTotal",0)::text::numeric)*(-1) AS "discountTotal" ,
                        COUNT(CN.id)
                    FROM "CreditNotes" AS CN
                 
                    where CN."companyId"= $1
                        AND (array_length($2::uuid[], 1) IS NULL OR (CN."branchId"=any($2::uuid[])))
                        AND (  $3::timeStamp  is null or CN."createdAt" >= $3::timestamp ) AND CN."createdAt" < $4::timestamp
                    group by  CN."discountId"
                    ),
                    T AS (          
                    select * from "invoiceData" union all select * from "creditNoteData"
                    )   
					
					SELECT  t."discountId" , COALESCE("Discounts".name,'Other') AS "name" , SUM(count), SUM("discountTotal")
                    FROM T
                    left join "Discounts" on "Discounts".id = t."discountId" 
					GROUP BY "discountId", name `,

                values: [companyId, branches, from, to]
            }

            const reports = await DB.excu.query(query.text, query.values)

            if(filter.export){
            
                let  columns ={
                    'Name':{},
                    'Total':{hasTotal:true, columnType:'currency'}
                    //{name: 'Qty', totalsRowFunction: 'none', filterButton: false},
                    // {key: 'percentage', properties:{columnType:'percentage'}},
                    // {key: 'salesTotal', properties:{hasTotal:true, columnType:'currncy'}},
                    
                 }
                

                return new ResponseData(true, "", {records : reports.rows.map((e: any) => { return { Name: e.name,Total: Number( e.sum)  } }), columns : columns})
            }

 
            return new ResponseData(true, "", reports.rows)
            
        } catch (error:any) {
          
          
            throw new Error(error)
        }
    }

    public static async getSalesByServices(data: any, company: Company,brancheList:[]) {

        try {
            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : brancheList;
           

              //######################## set time ########################
       
              let closingTime = "00:00:00"
              let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
              let toDate = filter && filter.toDate ?  moment(new Date(filter.toDate)) : moment();
              let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;

  
              if(applyOpeningHour == true){
                  let branchId = branches[0]
                  closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
              }
              
              let timeOffset = company.timeOffset
             let interval = await TimeHelper.getReportTime(fromDate,toDate,closingTime,applyOpeningHour,timeOffset)
              let from = interval.from
              let to = interval.to

              let asOf = filter && filter.allowAsOf ? filter.allowAsOf : false
             if (asOf == true) {from = null }
             //#########################################################
              if(!Array.isArray(branches) || branches.length == 0){ branches = null  };
            /**,
                        "creditNoteLines" as (

                                            
                            select      				     
                            (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end) as "sales",
                           "CreditNoteLines"."taxTotal"  as "taxTotal",
							 "CreditNoteLines"."subTotal",
                           "CreditNoteLines"."discountTotal" as "discountTotal",
                           "CreditNoteLines".total as "total",
                             "CreditNoteLines"."qty",
                             "CreditNoteLines"."creditNoteId",
                            "CreditNoteLines"."createdAt",
                            "CreditNoteLines"."branchId",
                            "CreditNoteLines"."productId",
                            "CreditNoteLines"."companyId"
                        from "CreditNoteLines"
                        where "CreditNoteLines"."companyId" = $1
                        and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId"  = any($2::uuid[]) )
                        and ("CreditNoteLines"."createdAt" >=  $3::timestamp 	and "CreditNoteLines"."createdAt" < $4)
              
                        ),
                        "creditNoteData" as (
                        select   "Invoices"."serviceId" as  "serviceId",
                                 Sum("creditNoteLines".qty) *(-1) as qty, 
                    sum("sales" )*(-1) As "totalSales",
                    sum( sum("sales")::text::NUMERIC) over() *(-1) as total,
                                'creditNote' as "transactionType"
                        from "creditNoteLines"
						inner join "CreditNotes" on "CreditNotes".id = "creditNoteLines"."creditNoteId"
                          inner join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId" 	
                        group by  "Invoices"."serviceId"
                        
                        ), */

            const query : { text: string, values: any } = {
                text: `WITH   "lines" as (       
                            select      				     
                           (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
                           "InvoiceLines"."taxTotal" as "taxTotal",
                           "InvoiceLines"."discountTotal" as "discountTotal",
                            "InvoiceLines".total as "total",
                            "InvoiceLines"."invoiceId",
                            "InvoiceLines"."qty",
                            "InvoiceLines"."createdAt",
                            "InvoiceLines"."branchId",
                            "InvoiceLines"."productId",
                            "InvoiceLines"."companyId"
                        from "InvoiceLines"
                        where "InvoiceLines"."companyId" = $1
                        and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any($2::uuid[]))
                        and (( $3::timestamp is null or  "InvoiceLines"."createdAt" >= $3::timestamp )and "InvoiceLines"."createdAt" < $4)
                     ),
                        "invoiceData" as (
                        select    "Invoices"."serviceId" as  "serviceId",
                               Sum("lines".qty) as qty, 
                    sum("sales"::text::NUMERIC ) As "totalSales",
                    sum( sum("sales")::text::NUMERIC) over() as total,
                  
                                'invoice' as "transactionType"
                        from "lines"
                        inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                        inner join "Branches"   on "Branches".id = "lines"."branchId"
                        left join "Products" as prod  on prod.id = "lines"."productId" 
							group by   "Invoices"."serviceId"
                                        ),
                        T AS (          
                        select * from "invoiceData" 
                        )
                       
                            select "Services".id AS "serviceId",
                            COALESCE("Services".name,'other')as "serviceName",
                         
                             Sum(qty) as qty,
                            sum(sum("totalSales"::text::numeric)) over() as "total",
                            sum ("totalSales"::text::numeric) as "salesTotal",
                           ROUND(100 * (SUM(COALESCE("totalSales",0))::numeric / sum(SUM(COALESCE("totalSales",0))::numeric)  over()),$5::INT) percentage 
                 
                        from T
                        left join "Services" on "Services".id = T. "serviceId"

                        group by "Services".id 
                        order by "serviceName" `,

                values: [companyId, branches, from, to, afterDecimal]
            }

            

            const reports = await DB.excu.query(query.text, query.values)


            if(filter.export){
            
                let  columns ={
                    'service':{},
                    'percentage': {columnType:'percentage'},
                    'salesTotal':{hasTotal:true, columnType:'currency'}
                    //{name: 'Qty', totalsRowFunction: 'none', filterButton: false},
                    // {key: 'percentage', properties:{columnType:'percentage'}},
                    // {key: 'salesTotal', properties:{hasTotal:true, columnType:'currncy'}},
                    
                 }
                
    
                return new ResponseData(true, "", {records : reports.rows.map((e: any) => { return { service: e.serviceName, percentage:Number( e.percentage) , salesTotal: Number(e.salesTotal) } }), columns : columns})
            }


      
            return new ResponseData(true, "", reports.rows)
            
        } catch (error:any) {
          
      
            throw new Error(error)
        }
    }

    public static async taxDetails(data: any, company: Company,brancheList:[]) {
       
        try {
            

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : brancheList;

              //######################## set time ########################
       
              let closingTime = "00:00:00"
              let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
              let toDate = filter && filter.toDate ?  moment(new Date(filter.toDate)) : moment();
              let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;

  
              if(applyOpeningHour == true){
                  let branchId = branches[0]
                  closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
              }
              
              let timeOffset = company.timeOffset
             let interval = await TimeHelper.getReportTime(fromDate,toDate,closingTime,applyOpeningHour,timeOffset)
              let from = interval.from
              let to = interval.to

              let asOf = filter && filter.allowAsOf ? filter.allowAsOf : false
              if (asOf == true) {from = null }

           
            
             //#########################################################
            if(!Array.isArray(branches) || branches.length == 0){ branches = null  };

             

            /**,"creditNoteData" as (

                                        
                        select      				     
					    COALESCE(nullif(nullif(elem->>'taxId', ''),'null')::uuid,"CreditNoteLines"."taxId" ) as"taxId", 
                        sum(COALESCE(nullif(COALESCE(elem->>'taxAmount', elem->>'taxTotal'),'')::double precision,"CreditNoteLines"."taxTotal" )  ) *(-1) as  "taxTotal"
                
                    from "CreditNoteLines"
					LEFT JOIN   jsonb_array_elements(nullif("CreditNoteLines"."taxes",'null') ) elem  on nullif("CreditNoteLines"."taxType",'') is not null
                    where "CreditNoteLines"."companyId" = $1
						
                    and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId" =any($2::uuid[]))
                    and ("CreditNoteLines"."createdAt" >= $3::timestamp 	 and "CreditNoteLines"."createdAt" < $4)
                 group by     "CreditNoteLines"."discountId"
						
						union all 
						 select 
                         COALESCE(nullif(nullif(elem->>'taxId', ''),'null'),nullif(nullif(invo."chargesTaxDetails"->>'taxId', ''),'null') )::uuid as "taxId", 
                        sum(COALESCE(nullif(COALESCE(elem->>'taxAmount', elem->>'taxtotal'),''),invo."chargesTaxDetails"->>'taxAmount' )::double precision  ) as "taxTotal"
               
                
                    FROM "CreditNotes" AS CN
                 
                    where "CreditNotes"."companyId"= $1
                        AND (array_length($2::uuid[], 1) IS NULL OR ("CreditNotes"."branchId"=any($2::uuid[])))
                        AND (  $3::timeStamp  is null or CN."createdAt" >= $3::timestamp ) AND CN."createdAt" < $4::timestamp
                    group by  CN."discountId"
                    ), */


            const query : { text: string, values: any } = {
                text: `WITH "invoiceData" as (			
                        select      				     
                        
	                    COALESCE(nullif(nullif(elem->>'taxId', ''),'null')::uuid,"InvoiceLines"."taxId" ) as "taxId", 
	                    sum(COALESCE(nullif(COALESCE(elem->>'taxAmount', elem->>'taxTotal'),'')::double precision,"InvoiceLines"."taxTotal" )  ) as "taxTotal"
                       
                    from "InvoiceLines"
                            INNER JOIN "Invoices" AS invo on  invo.id = "InvoiceLines"."invoiceId"
	                    LEFT JOIN   jsonb_array_elements(nullif("InvoiceLines"."taxes",'null') ) elem  on nullif("InvoiceLines"."taxType",'') is not null
                    where "InvoiceLines"."companyId" = $1
                    and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any ($2::uuid[]))
                    and ("InvoiceLines"."createdAt" >= $3::timestamp 	 and "InvoiceLines"."createdAt" < $4)
                	    AND (invo."status" <>'Draft'  )   
                    group by   "taxId" ,elem
	                union all 
	                select 
                      COALESCE(nullif(nullif(elem->>'taxId', ''),'null'),nullif(nullif(invo."chargesTaxDetails"->>'taxId', ''),'null') )::uuid as  "taxId", 
                        sum(COALESCE(nullif(COALESCE(elem->>'taxAmount', elem->>'taxtotal'),''),invo."chargesTaxDetails"->>'taxAmount' )::double precision  ) as  "taxTotal"
               


                     from "Invoices" as "invo"
                	LEFT JOIN   jsonb_array_elements(nullif( invo."chargesTaxDetails"->>'taxes','null')::jsonb  ) elem on true
                    where invo."companyId"= $1

                        AND (array_length($2::uuid[], 1) IS NULL OR (invo."branchId"=any($2::uuid[])))
                        AND (invo."status" <>'Draft'  )
                        AND (  $3::timeStamp  is null or invo."createdAt" >= $3::timestamp) AND invo."createdAt" < $4::timestamp
                    group by   "taxId" ,elem
                    ),
                    T AS (          
                    select * from "invoiceData" 
                    )   
               select "Taxes" .name, "Taxes".id as id, sum("taxTotal") as "taxTotal"
                    from  t
                    join "Taxes" on "Taxes".id =  "taxId" and  "taxTotal" <> 0
                    group by "Taxes".id `,

                values: [companyId, branches, from, to]
            }

            const reports = await DB.excu.query(query.text, query.values)
           

            if(filter.export){
            
                let  columns ={
                    'name':{},
                    'taxTotal':{hasTotal:true, columnType:'currency'}
                    //{name: 'Qty', totalsRowFunction: 'none', filterButton: false},
                    // {key: 'percentage', properties:{columnType:'percentage'}},
                    // {key: 'salesTotal', properties:{hasTotal:true, columnType:'currncy'}},
                    
                 }
                

                return new ResponseData(true, "", {records : reports.rows.map((e: any) => { return { name: e.name,taxTotal: Number( e.taxTotal)  } }), columns : columns})
            }


            return new ResponseData(true, "", reports.rows)
            
        } catch (error:any) {
          

            throw new Error(error)
        }
    }


}