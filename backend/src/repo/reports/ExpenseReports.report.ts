import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Company } from "@src/models/admin/company"
import { TimeHelper } from "@src/utilts/timeHelper";


import moment from 'moment'

export class expenseReport {

    public static async expenseByCategory(data: any, company: Company,brancheList:[]) {
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

            let NoOfperiod = filter && filter.periodQty ? filter.periodQty : null;
            let period = filter && filter.period ? filter.period : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : 'none';
            const types = ["Costs Of Goods Sold","Expense","Fixed Assets","Current Liabilities","Other Assets","Operating Expense","Long Term Liabilities"]
            let columns = ["Total"]
            let results: any = []

            let query = {
                text: ` WITH "values" AS (
                            select  $1::uuid AS "companyId",
                                    $2::uuid[] AS "branches",
                                    case when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='month') then $3::timestamp  - interval '1 month' *   $7::int 
                                        when (lower($5::TEXT) ='period' and  lower($6::TEXT)  ='year')  then $3::timestamp  - interval '1 year'  *    $7::int
                                        else $3::timestamp 	END "fromDate",
                                    $4::timestamp AS "toDate",
                                    lower($5)::text As "compType",
                                    lower($6)::text as "period"
                        )
                        ,"expenceData" as(
                            select  "accountId",
                                sum( "ExpenseLines".total::text::numeric - "ExpenseLines"."taxTotal"::text::numeric ) as amount,
                                sum( "ExpenseLines".total::text::numeric) as "amountWithTax",
                                    case when "values"."compType" = 'branch' then COALESCE("Branches".name,'other') 
                                        when "values"."compType" = 'period' and "period" = 'month' then to_char("ExpenseLines"."createdAt"::TIMESTAMP,'Mon/YYYY') 
                                        when "values"."compType" = 'period' and "period" = 'year'  then  to_char("ExpenseLines"."createdAt"::TIMESTAMP,'YYYY') 
                                        else 'Total' end as "key"
                            from "ExpenseLines" 
                            join "values" on true
                            inner join "Expenses" ON "Expenses"."id" = "ExpenseLines"."expenseId"
                            inner join "Branches" ON "Branches".id = "Expenses"."branchId"
                            where "Branches"."companyId" = "values"."companyId"  
                                and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                                and ("ExpenseLines"."createdAt" >= "values"."fromDate" and "ExpenseLines"."createdAt" < "values"."toDate"  ) 
                            group by "accountId","key"
                            )
                            ,"keys" as (select distinct "key" as "key"  from "expenceData")
                            select "Accounts".id as "accountId", "name",
                                    array_agg(distinct "keys"."key")   as "columns",
                            JSON_AGG(JSON_BUILD_OBJECT("keys"."key",JSON_BUILD_OBJECT('amount',COALESCE("amount",0),
                                                                                'amountWithTax',COALESCE("amountWithTax",0)
                                                                            ))) as "summary"

                            from "Accounts"
                            join "keys" on true
                            left join "expenceData" ON "Accounts".id = "expenceData"."accountId" and "keys"."key"  = "expenceData"."key"
                            where "companyId"= $1
                            and "Accounts"."parentType" = any($8)
                            group by "Accounts".id
                            order by "Accounts".id                
                `,
                values: [companyId, branches, from, to, compareType, period, NoOfperiod, types]
            }


            const records = await DB.excu.query(query.text, query.values);

            if (records.rows && records.rows.length > 0) {
                columns = (<any>records.rows[0]).columns ? (<any>records.rows[0]).columns : columns
                results = records.rows
            }

            
            try{
                columns.sort((a,b)=> {
                    const aa = moment(a,'MMM/YYYY')
                    const bb = moment(b,'MMM/YYYY' )
                    return aa.diff(bb)
                })
            }catch{ columns = columns }

            let resData = {
                records: results,
                subColumns: ['total','totalWithTax'] ,
                columns: columns,

            }
            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }


}