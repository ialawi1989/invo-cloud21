import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Company } from "@src/models/admin/company";
import { Helper } from "@src/utilts/helper";
import { TimeHelper } from "@src/utilts/timeHelper";
import { ReportData, DataColumn, XLSXGenerator } from "@src/utilts/xlsxGenerator";
import { integer } from "aws-sdk/clients/cloudfront";
import moment from 'moment'
export interface periods {
    month: integer,
    year: integer
}
export class ComparisonReportsRepo {


    public static async getMonthsAndYears(dates: Date[]) {
        try {
            let periods: periods[] = [];
            let period;

            dates.forEach(element => {
                let date = new Date(element);

                period = {
                    month: date.getMonth() + 1,
                    year: date.getFullYear()
                }
                periods.push(period)
            });

            return periods
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async generateMonthDates(startDate: Date, endDate: Date) {
        const dates = [];
        const currentDate = moment(startDate).startOf('month');
        const lastDate = moment(endDate).startOf('month');

        while (currentDate.isBefore(lastDate) || currentDate.isSame(lastDate)) {
            dates.push(currentDate.clone().toDate());
            currentDate.add(1, 'month');
        }

        return dates;
    }


    public static async profitAndLossMonthWiseComparison(data: any, company: Company, brancheTemp: []) {
        try {



            let companyId = company.id;
            let from = data.interval.from;
            let to = data.interval.to;
            let filterDates = await this.generateMonthDates(from, to)
            let dates: any = await this.getMonthsAndYears(filterDates);
            let branchList: any[] = data.branchId ? [data.branchId] : brancheTemp
            let types = "ARRAY[''Operating Expense'', ''Operating Income'', ''Costs Of Goods Sold'']";
            let branches = 'Array[';
            for (let index = 0; index < branchList.length; index++) {
                const element = branchList[index];
                if (index == branchList.length - 1) {
                    branches += `''${element}''`
                } else {
                    branches += `''${element}'' ,`
                }


            }

            branches += ']::uuid[]'

            let query = ` with "report" as ( SELECT *
                               FROM crosstab('select
                               jsonb_build_object(''accountId'', "Accounts"."id",''accountName'', "Accounts"."name", ''type'', "Accounts"."type",''parentType'',"Accounts"."parentType")    AS "ACCOUNT",    
                               to_char( "JournalRecords"."createdAt", ''Month'') || ''/'' || EXTRACT (YEAR FROM "JournalRecords"."createdAt" ) as "date",
                                                case when abs(sum(case when "JournalRecords".amount <0 then amount else 0 end )) > sum(case when "JournalRecords".amount >0 then amount else 0 end)  then sum("JournalRecords".amount::numeric) *(-1) else
                                                case when   abs(sum(case when "JournalRecords".amount <0 then amount else 0 end )) < sum(case when "JournalRecords".amount >0 then amount else 0 end) then sum("JournalRecords".amount::numeric)*(-1) end   end as "total"  
                                                from "JournalRecords" 
                                                INNER JOIN "Accounts" ON "Accounts".id = "JournalRecords"."accountId"
                                             WHERE "JournalRecords"."companyId" =''${companyId}''
                                             AND "JournalRecords"."branchId" = any(${branches})
                                             AND (`

            for (let index = 0; index < dates.length; index++) {
                const element = dates[index];
                if (index + 1 != dates.length) {
                    query += `(EXTRACT (YEAR FROM "JournalRecords"."createdAt" ) = ''${element.year}'' AND EXTRACT (Month FROM "JournalRecords"."createdAt" ) = ''${element.month}'' ) OR`
                } else {
                    query += `(EXTRACT (YEAR FROM "JournalRecords"."createdAt" ) = ''${element.year}'' AND EXTRACT (Month FROM "JournalRecords"."createdAt" ) = ''${element.month}'' ))`
                }
            }
            query +=
                `
                                                  AND  "Accounts"."parentType" = ANY(${types})
                                              group by "Accounts".id, to_char( "JournalRecords"."createdAt", ''Month'') ,EXTRACT (YEAR FROM "JournalRecords"."createdAt" )')
                                              `

            // const firstMonth = fromDate.toLocaleString('default', { month: 'long' });
            // const secondMonth = toDate.toLocaleString('default', { month: 'long' });
            // months.push(firstMonth);
            // months.push(secondMonth);

            // let firstDateString = '"'+firstMonth+'/'+fromYear.toString()+'"'
            // let secondDateString = '"'+secondMonth+'/'+toYear.toString()+'"'


            // let firstDateString = '"' + firstMonth + '"' + " numeric"
            // let secondDateString = '"' + secondMonth + '"' + " numeric"

            let coulmnQueryString = "";
            let columnSelectQuery = "";

            let months: any = [];
            for (let index = filterDates.length - 1; index >= 0; index--) {
                const element = filterDates[index];
                let date = new Date(element)
                const month = date.toLocaleString('default', { month: 'long' });
                const year = date.getFullYear();
                let string = '"' + month + '/' + year + '"'


                if (index == 0) {
                    coulmnQueryString += string + " numeric "
                    columnSelectQuery += `   CAST (COALESCE(${string},0)AS REAL) as ${string} `
                } else {


                    coulmnQueryString += string + " numeric,"
                    columnSelectQuery += `   CAST (COALESCE(${string},0)AS REAL) as ${string} ,`
                }
            }

            filterDates.forEach(element => {

                let date = new Date(element)
                const month = date.toLocaleString('default', { month: 'long' });
                const year = date.getFullYear();
                let string = '"' + month + '/' + year + '"'
                let string2 = month + '/' + year
                months.push(string2)
            });


            let columnQuery = `  AS ct("ACCOUNT" jsonb, ${coulmnQueryString}))`
            let selectQuery = `												
            select
            "report"."ACCOUNT"->>'accountId' as "accountId",
            "report"."ACCOUNT"->>'accountName' as "account",
            "report"."ACCOUNT"->>'type' as "type",
            "report"."ACCOUNT"->>'parentType' as "parentType",

            ${columnSelectQuery}
            from "report"`
            columnQuery += selectQuery;

            query += columnQuery


            let report = await DB.excu.query(query, [])

            let summary = await this.profitAndLossSummary(filterDates, companyId, types, dates)
            let list = report.rows;
            summary.data.forEach((element: any) => {
                list.push(element)
            });

            return new ResponseData(true, "", { list: list, months: months })

        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    public static async profitAndLossSummary(filterDates: Date[], companyId: string, types: string, dates: periods[]) {
        try {
            let query = `with "report" as (SELECT *
                FROM crosstab('with "journals" as (select
                                     sum(amount::numeric) as "amount",
                                     "Accounts"."parentType",
                                      to_char( "JournalRecords"."createdAt", ''Month'') || EXTRACT (YEAR FROM "JournalRecords"."createdAt" ) as "year",
                                     "Accounts"."type"
                                     from "JournalRecords"
                                     left join "Accounts" ON "JournalRecords"."accountId" = "Accounts".id
                                     WHERE "JournalRecords"."companyId" =''${companyId}'' AND (`
            for (let index = 0; index < dates.length; index++) {
                const element = dates[index];

                if (index + 1 != dates.length) {
                    query += `(EXTRACT (YEAR FROM "JournalRecords"."createdAt" ) = ''${element.year}'' AND EXTRACT (Month FROM "JournalRecords"."createdAt" ) = ''${element.month}'' ) OR`
                } else {
                    query += `(EXTRACT (YEAR FROM "JournalRecords"."createdAt" ) = ''${element.year}'' AND EXTRACT (Month FROM "JournalRecords"."createdAt" ) = ''${element.month}'' ))`
                }
            }


            query += ` AND  "Accounts"."parentType" = ANY(${types})
                                      group by "Accounts".id, to_char( "JournalRecords"."createdAt", ''Month'') ,EXTRACT (YEAR FROM "JournalRecords"."createdAt" )
                              ), "totals" as (
                   select
                   "journals"."parentType"::text,
                    "journals"."year",
                   case when abs(sum(case when "journals".amount <0 then amount else 0 end )) > sum(case when "journals".amount >0 then amount else 0 end)  then sum("journals".amount::numeric) *(-1) else
                   case when   abs(sum(case when "journals".amount <0 then amount else 0 end )) < sum(case when "journals".amount >0 then amount else 0 end) then sum("journals".amount::numeric)*(-1) end   end as "total"
                   from "journals"
                 group by  "journals"."parentType","journals"."type" , "journals"."year")        

                 select
                  "totals"."parentType",
                    "totals"."year",
                  sum("totals"."total") total
                 from "totals"
                 group by  "totals"."year" ,"parentType"
                 order by 1,2')
                            `
            // let firstDateString = '"' + firstMonth + '"' + " numeric"
            // let secondDateString = '"' + secondMonth + '"' + " numeric"

            let coulmnQueryString = "";
            let columnSelectQuery = "";
            /**ORDER IS IMPORTENT HERE THATS WHY ARRAY GOES IN REVERESE */
            for (let index = filterDates.length - 1; index >= 0; index--) {
                const element = filterDates[index];
                let date = new Date(element)
                const month = date.toLocaleString('default', { month: 'long' });
                const year = date.getFullYear();
                let string = '"' + month + '/' + year + '"'
                if (index == 0) {
                    coulmnQueryString += string + " numeric "
                    columnSelectQuery += `   CAST (COALESCE(${string},0)AS REAL) as ${string} `

                } else {
                    coulmnQueryString += string + " numeric,"
                    columnSelectQuery += `   CAST (COALESCE(${string},0)AS REAL) as ${string} ,`
                }
            }

            let columnQuery = `  AS ct("parentType" text, ${coulmnQueryString}) ) `

            let selectQuery = `												
   		
            select
            "report"."parentType",
           ${columnSelectQuery}
            from "report"
                        `

            columnQuery += selectQuery;

            query += columnQuery



            let report = await DB.excu.query(query, [])

            let data = report.rows

            let list: any[] = [];



            let netProfitObj: any = {
                "account": "Net Profit / Loss",
                "type": "Net Profit",
                "parentType": ""
            }


            let grossProfitObj: any = {
                "accountName": "Gross Profit",
                "type": "Gross Profit",
                "parentType": ""
            }



            let operatingProfitObj: any = {
                "accountName": "Operating Profit",
                "type": "Operating Profit",
                "parentType": ""
            }
            filterDates.forEach((element) => {
                let totalIncome = 0;
                let totalExpense = 0
                let totalCostOfGoodSolds = 0;
                let date = new Date(element)
                const month = date.toLocaleString('default', { month: 'long' });
                const year = date.getFullYear();

                data.forEach((jornal: any) => {
                    {

                        if (jornal.parentType == 'Costs Of Goods Sold') {
                            totalCostOfGoodSolds += Number(jornal[month + '/' + year] ?? 0)
                        } else if (jornal.parentType == 'Operating Expense') {
                            totalExpense += Number(jornal[month + '/' + year] ?? 0)
                        } else {
                            totalIncome += Number(jornal[month + '/' + year] ?? 0)
                        }

                    }


                });
                let grossProfit = Helper.add(Number(totalIncome), Number(totalCostOfGoodSolds), 3);
                let netProfit = Helper.add(Number(grossProfit), Number(totalExpense), 3);
                let operatingProfit = 0;
                netProfitObj[month + '/' + year] = netProfit
                operatingProfitObj[month + '/' + year] = operatingProfit
                grossProfitObj[month + '/' + year] = grossProfit
            });

            list.push(netProfitObj)
            list.push(operatingProfitObj)
            list.push(grossProfitObj)
            return new ResponseData(true, "", list)
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }


    /**New Reports */
    public static async balanceSheetReportOld(data: any, company: Company, branchList: []) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let branches = filter && filter.branches ? filter.branches : branchList;

            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : null;
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to

            //---------------------------------------



            let NoOfperiod = (filter && filter.periodQty) && (!filter.branches || (filter.branches && filter.branches.length <= 1)) ? filter.periodQty : null;
            let period = (filter && filter.period) && (!filter.branches || (filter.branches && filter.branches.length <= 1)) ? filter.period : null;


            let comparison = (period && NoOfperiod) || (branches.length > 1 && filter.branches && filter.branches.length > 1) ? true : null
            let columns = ["Total"]
            let asOf = filter.allowAsOf

            if (asOf == null || asOf == false) {
                asOf = (period != null && period != "") ? true : false
            }

            const query = {
                //     text: `with "values" as (
                //         select  $1::uuid as "companyId",
                //         $2::uuid[] as "branches",
                //         array['Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity']::text[] as "types",
                //         $3::TEXT AS "period",
                //         $4::int AS "periodQty",
                //         $5::BOOLEAN AS "comparison",
                //         $6::timestamp as "fromDate",
                //         $7::timestamp as "toDate",
                //         $8::BOOLEAN as "asOf"
                //         ), "mainQuery" as(
                //             select 
                //             "Accounts".id as "accountId",
                //             "Accounts"."name" as "account",
                //             "Accounts".code,
                //             "Accounts".type,
                //             "Accounts"."parentType",
                //             case when "comparison" = true and array_length("values"."branches",1) > 1 and "period" is null then "Branches".name end as "journalBranchName",
                // 			case when "comparison" = true and "period" = 'Month' then DATE_TRUNC('Month',"JournalRecords"."createdAt")
                //                  when "comparison" = true and "period" = 'Year' then DATE_TRUNC('Year',"JournalRecords"."createdAt") 
                // 			     else  "JournalRecords"."createdAt" end as "key",
                //            CASE WHEN "asOf" THEN  
                //            SUM(SUM(COALESCE("JournalRecords".amount,0)::text::NUMERIC)) over( PARTITION BY "Accounts".id, case when array_length("values"."branches",1) > 1 then "Branches".id end    ORDER BY  "JournalRecords"."createdAt" asc)   else 


                //             SUM(COALESCE("JournalRecords".amount,0)::text::NUMERIC) 
                // 			END as "total" ,
                // 			   ROW_NUMBER() OVER (PARTITION BY "Accounts".id ,case when array_length("values"."branches",1) > 1 then "Branches".name end  ORDER BY "JournalRecords"."createdAt" DESC )as "rowNum"
                // 			from "Accounts"
                //             JOIN "values" ON TRUE
                //             inner join "JournalRecords" ON  "Accounts".id = "JournalRecords"."accountId" and "Accounts"."companyId" = "values"."companyId" and( array_length("values"."branches",1) IS NULL or "JournalRecords"."branchId" = any("values"."branches"))

                // 			left join "Branches" on "Branches".id ="JournalRecords"."branchId"
                //             inner join "Companies" on "Companies".id = "JournalRecords"."companyId"
                //             WHERE "JournalRecords"."companyId" = "values"."companyId"
                //             AND "Accounts"."parentType" = any("values"."types")
                //             AND ( "JournalRecords"."createdAt" < "values"."toDate" )
                //             group by "Accounts".id,"values"."branches","key", "journalBranchName","asOf","JournalRecords"."createdAt" ,"Branches".id
                //             ), "accounts" as (
                // 			select 
                // 			"accountId",
                // 			"account",
                // 			"code",
                // 			"type",
                // 			"parentType",
                // 				case when "comparison" = true and "period" = 'Month' then to_char("key"::TIMESTAMP,'Mon/YYYY')
                //                  when "comparison" = true and "period" = 'Year' then to_char("key"::TIMESTAMP,'YYYY') 
                // 			     when "comparison" = true and array_length("values"."branches",1) > 1 then "journalBranchName"
                // 				 else ''
                // 				 end as "columns",

                // 		    case when getaccountnature("parentType") = 'Dr' AND SUM(CASE WHEN "total" < 0 then "total" else 0 end ) > SUM(CASE WHEN "total" > 0 then "total" else 0 end ) then   SUM(COALESCE("total",0)::NUMERIC) *(-1) 
                //                  when getaccountnature("parentType") = 'Cr' AND SUM(CASE WHEN "total" < 0 then "total" else 0 end ) < SUM(CASE WHEN "total" > 0 then "total" else 0 end ) then   SUM(COALESCE("total",0)::NUMERIC) *(-1) 
                //                  ELSE 
                //                  SUM(COALESCE("total",0)::NUMERIC)
                //                  END AS 
                //             "total"
                // 			from "mainQuery"
                //             JOIN "values" ON TRUE
                // 			where (("asOf" = true and "comparison" is null and "rowNum" = 1) or 
                // 				   ("asOf" = true and "comparison"=true and array_length("values"."branches",1)>1 and "rowNum" = 1)  or 
                // 				   ("asOf" = true and "comparison"=true and "period" = 'Month' and "key"::timestamp >="fromDate" - interval '1 Months'* "periodQty") or
                // 				   ("asOf" = true and "comparison"=true and "period" = 'Year' and "key"::timestamp >="fromDate" - interval '1 Year'* "periodQty") or
                // 				   ("asOf" = false and "key"::timestamp >="fromDate" )
                // 				  )
                // 		    group by "accountId",
                // 			"account",
                // 			"code",
                // 			"type",
                // 			"parentType",
                // 			"columns",
                // 			"asOf",
                // 			"comparison",
                // 			"period",
                // 			"values"."branches",
                // 		    "journalBranchName"
                // 			),"filters" as (
                //         SELECT
                //           CASE
                //             WHEN "comparison" = true AND "values"."period" LIKE 'Year' THEN JSONB_AGG("columnName" ORDER BY "columnName")
                //             WHEN "comparison" = true AND "values"."period" LIKE 'Month' THEN JSONB_AGG("columnName" ORDER BY TO_DATE("columnName", 'Mon/YYYY'))  FILTER (WHERE "columnName" ~ '^[A-Z][a-z]{2}/[0-9]{4}$') 
                //             when "comparison" = true and array_length("values"."branches",1) > 1  then JSONB_AGG("columnName" ORDER BY "columnName") 
                //           END AS "columns"
                //             FROM (
                //               SELECT DISTINCT "columns" "columnName"

                //               FROM "accounts"
                //                 join "values" on true 
                //             )t
                // 				 join "values" on true
                // 				group by 
                // 				"values"."period",
                // 				"comparison" ,
                // 				"values"."branches"
                // )
                // 			select
                // 		    "accountId",
                // 			"account",
                // 			"code",
                // 			"type",
                // 			"parentType",
                // 			case when "comparison" = true and "period" = 'Month' then  JSON_AGG(JSON_BUILD_OBJECT("accounts"."columns","total"))
                //                  when "comparison" = true and "period" = 'Year' then JSON_AGG(JSON_BUILD_OBJECT("accounts"."columns","total"))
                // 			     when "comparison" = true and array_length("values"."branches",1) > 1 then JSON_AGG(JSON_BUILD_OBJECT("accounts"."columns","total"))
                // 				 else  JSON_AGG(JSON_BUILD_OBJECT('Total',"total"))
                // 				 end as "summary",
                // 				 "filters"."columns"
                // 			from "accounts"
                // 			JOIN "values" ON TRUE
                // 			JOIN "filters" ON TRUE 
                // 			group by "accountId",
                // 			 "accountId",
                // 			"account",
                // 			"code",
                // 			"type",
                // 			"parentType",
                // 			"asOf",
                // 			"comparison",
                // 			"period",
                // 			"values"."branches",
                // 				 "filters"."columns"
                //                   `,
                text: `with "values" as (
                    select  $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            array['Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity','Other Current Liabilities']::text[] as "types",
                            $3::TEXT AS "period",
                            $4::int AS "periodQty",
                    $5::BOOLEAN AS "comparison",
                    case when $5::BOOLEAN=true and $3::TEXT = 'Month' then $6::timestamp - interval '1 Months'* $4
                    when $5::BOOLEAN=true and $3::TEXT = 'Year' then $6::timestamp - interval '1 Year'* $4
                    else
                    $6::timestamp end as "fromDate",
                    $7::timestamp as "toDate",
                  $8::BOOLEAN as "asOf"
                    )
					
					, "mainQuery" as(
                        select 
                        "Accounts".id as "accountId",
                        "Accounts"."name" as "account",
                        "Accounts".code,
                        "Accounts".type,
                        "Accounts"."parentType",
                        case when "comparison" = true and array_length("values"."branches",1) >= 1 and "period" is null then "Branches".name::text 
						     else  "JournalRecords"."createdAt"::text end as "key",
                        SUM(COALESCE("JournalRecords".amount,0)::text::NUMERIC) as total
						from "Accounts"
                        JOIN "values" ON TRUE
                        inner join "JournalRecords" ON  "Accounts".id = "JournalRecords"."accountId" and "Accounts"."companyId" = "values"."companyId" and( array_length("values"."branches",1) IS NULL or "JournalRecords"."branchId" = any("values"."branches"))
        
						left join "Branches" on "Branches".id ="JournalRecords"."branchId"
                        inner join "Companies" on "Companies".id = "JournalRecords"."companyId"
                        WHERE "JournalRecords"."companyId" = "values"."companyId"
                        AND "Accounts"."parentType" = any("values"."types")
						
                        AND (( "asOf" = true and "period" is null and "JournalRecords"."createdAt" < "values"."toDate" )or 
							(( "asOf" = false or "period" is not null) and "JournalRecords"."createdAt" >= "values"."fromDate" and  "JournalRecords"."createdAt" < "values"."toDate" )
							)
                        group by "Accounts".id,"key"
                        )
						
						, "accounts" as (
						select 
						"accountId",
						"account",
						"code",
						"type",
						"parentType",
							case when "comparison" = true and "period" = 'Month' then to_char(DATE_TRUNC('Month',"key"::TIMESTAMP),'Mon/YYYY')
                             when "comparison" = true and "period" = 'Year' then to_char(DATE_TRUNC('year',"key"::TIMESTAMP),'YYYY') 
						     when "comparison" = true and array_length("values"."branches",1) > 1 then "key"
							 else 'Total'
							 end as "columns",
                        
					    case when getaccountnature("parentType") = 'Dr' AND SUM(CASE WHEN "total" < 0 then "total" else 0 end ) > SUM(CASE WHEN "total" > 0 then "total" else 0 end ) then   SUM(COALESCE("total",0)::text::NUMERIC) *(-1) 
                             when getaccountnature("parentType") = 'Cr' AND SUM(CASE WHEN "total" < 0 then "total" else 0 end ) < SUM(CASE WHEN "total" > 0 then "total" else 0 end ) then   SUM(COALESCE("total",0)::text::NUMERIC) *(-1) 
                             ELSE 
                             SUM(COALESCE("total",0)::text::NUMERIC)
                             END AS 
                        "total"
						from "mainQuery"
                        JOIN "values" ON TRUE
					    group by "accountId",
						"account",
						"code",
						"type",
						"parentType","columns"
						)
						
						
					
						,"filters" as (
                    SELECT
                      CASE
                        WHEN "comparison" = true AND "values"."period" LIKE 'Year' THEN JSONB_AGG("columnName" ORDER BY "columnName")
                        WHEN "comparison" = true AND "values"."period" LIKE 'Month' THEN JSONB_AGG("columnName" ORDER BY TO_DATE("columnName", 'Mon/YYYY'))  FILTER (WHERE "columnName" ~ '^[A-Z][a-z]{2}/[0-9]{4}$') 
                        when "comparison" = true and array_length("values"."branches",1) >= 1  then JSONB_AGG("columnName" ORDER BY "columnName") 
                      END AS "columns"
                        FROM (
                          SELECT DISTINCT "columns" "columnName"
                    
                          FROM "accounts"
                            join "values" on true 
                        )t
							 join "values" on true
							group by 
							"values"."period",
							"comparison" ,
							"values"."branches"
			)
						select
					    "accountId",
						"account",
						"code",
						"type",
						"parentType",
						case when "comparison" = true and "period" = 'Month' then  JSON_AGG(JSON_BUILD_OBJECT("accounts"."columns","total"))
                             when "comparison" = true and "period" = 'Year' then JSON_AGG(JSON_BUILD_OBJECT("accounts"."columns","total"))
						     when "comparison" = true and array_length("values"."branches",1) >= 1 then JSON_AGG(JSON_BUILD_OBJECT("accounts"."columns","total"))
							 else  JSON_AGG(JSON_BUILD_OBJECT('Total',"total"))
							 end as "summary",
							 "filters"."columns"
						from "accounts"
						JOIN "values" ON TRUE
						JOIN "filters" ON TRUE 
						group by "accountId",
						 "accountId",
						"account",
						"code",
						"type",
						"parentType",
						"asOf",
						"comparison",
						"period",
						"values"."branches",
							 "filters"."columns"
							 order by "parentType","type"
                             ` ,
                values: [companyId, branches, period, NoOfperiod, comparison, from, to, asOf]
            }




            const records = await DB.excu.query(query.text, query.values);
            const netProfit = await this.netProfitTotal(data, company, asOf, branchList)

            if (records.rows && records.rows.length > 0 && (<any>records.rows[0]).columns) {
                columns = (<any>records.rows[0]).columns
            }

            if (netProfit) {
                netProfit.forEach((element: any) => {
                    if (element.account == 'Net Profit')
                        records.rows.push(element)

                });
            }

            let resData = {
                records: records.rows,
                columns: columns,
                from: from,
                to: to
            }

            if (filter.export) {
                records.rows = await XLSXGenerator.accontIndex(records.rows)
                records.rows.sort((a: any, b: any) => {

                    if (a.grandType == 'Liabilities' || a.grandType == 'Equity') { a.grandType = 'Liabilities and Equity' }
                    return (a.grandTypeIndex - b.grandTypeIndex || a.parentTypeIndex - b.parentTypeIndex || 0 - (a.type > b.type ? 1 : -1))
                })

                let report = new ReportData()
                report.filter = {
                    title: "Balance Sheet",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    //branches:branches, compareType: compareType,
                    period: period, periodQty: NoOfperiod
                }
                report.records = records.rows

                //get columns & subColumns
                resData.columns.forEach((col: any) => {
                    report.columns.push({ key: col, properties: { hasSubTotal: true, columnType: 'currency' } })
                })

                report.columns = [...[
                    { key: 'parentType', properties: { groupBy: "horizantal" } },
                    { key: 'type' },
                    { key: 'account' }, { key: 'code', header: 'Account Code' }], ...report.columns]
                report.fileName = 'BalanceSheet'
                return new ResponseData(true, "", report)

            } else {
                return new ResponseData(true, "", resData)
            }

        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    public static async netProfitTotal(data: any, company: Company, asOf: boolean | null = null, branchList: []) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let branches = filter && filter.branches ? filter.branches : branchList;

            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : null;
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to

            //---------------------------------------


            let NoOfperiod = (filter && filter.periodQty) && (!filter.branches || (filter.branches && filter.branches.length <= 1)) ? filter.periodQty : null;
            let period = (filter && filter.period) && (!filter.branches || (filter.branches && filter.branches.length <= 1)) ? filter.period : null;

            let comparison = period || (filter.branches && filter.branches && filter.branches.length >= 1) ? true : null



            const query = {
                //                 text: `with "values" as (
                //                     select  $1::uuid as "companyId",
                //                     $2::uuid[] as "branches",
                //                     array['Operating Expense', 'Operating Income', 'Costs Of Goods Sold','Expense']::text[] as "types",                    
                //                     $3::TEXT AS "period",
                //                     $4::int AS "periodQty",
                //                     $5::BOOLEAN AS "comparison",
                //                     $6::timestamp as "fromDate",
                //                     $7::timestamp as "toDate",
                //                     $8::BOOLEAN  as  "asOf"
                //            ), "mainQuery" as(
                //            select 
                //             "Accounts"."parentType",
                //   case when "values"."comparison" = true  and  array_length("values"."branches",1)  > 1  and "period" is null  then "Branches".name end as "journalBranchName",
                //             case when array_length("values"."branches",1) > 1 and "period" is null then null
                //               else  "JournalRecords"."createdAt"::text end as "key",
                //              sum("JournalRecords".amount::numeric*(-1))    as "total"
                //            from "Accounts"
                //            JOIN "values" ON TRUE
                //            inner join "JournalRecords" ON  "Accounts".id = "JournalRecords"."accountId" and "Accounts"."companyId" = "values"."companyId"
                //            left join "Branches" on "Branches".id = any("values"."branches")
                //            inner join "Companies" on "Companies".id = "JournalRecords"."companyId"
                //            WHERE "JournalRecords"."companyId" = "values"."companyId"
                //            AND "Accounts"."parentType" = any("values"."types")
                //            AND ( array_length("values"."branches",1) IS NULL or "JournalRecords"."branchId" = "Branches".id)
                //            AND ( ("asOf" = true and  "JournalRecords"."createdAt" < "values"."toDate" )or 
                //                  (("asOf" is null or "asOf" = false )and 
                // 				  (("values"."comparison" = true  and "period"='Month' and "JournalRecords"."createdAt"::timestamp >= "fromDate"::timestamp - interval '1 month' *  "periodQty"  and "JournalRecords"."createdAt" < "values"."toDate")  or
                //                   ("values"."comparison" = true  and "period"='Year' and "JournalRecords"."createdAt"::timestamp >= "fromDate"::timestamp - interval '1 year' *  "periodQty"  and "JournalRecords"."createdAt" < "values"."toDate" ) or
                //             (("values"."comparison" is null or "values"."comparison" = false) and"JournalRecords"."createdAt" >= "values"."fromDate"  and "JournalRecords"."createdAt" < "values"."toDate" )) )
                //                )
                //            group by "Accounts"."parentType","values"."branches","key","journalBranchName"

                //            ),"summary" as (
                //            select 

                //                 case when "values"."comparison" = true  and "period"='Month' then trim(to_char( "key"::timestamp,'Mon/yyyy'))::text
                //                      when  "values"."comparison" = true  and "period"='Year' then extract (year from "key"::timestamp)::text
                //                      when  "values"."comparison" = true  and  array_length("values"."branches",1) > 1 then "journalBranchName"
                //                      else 'Total'
                //                 end as "columnName",

                //                  sum(case when "parentType"='Operating Income' then "total" else 0 end) +	sum(case when "parentType"='Costs Of Goods Sold'then "total" else 0 end) as "grossProfit",

                //                (sum(case when "parentType"='Operating Income' then "total" else 0 end) +	sum(case when "parentType"='Costs Of Goods Sold'then "total" else 0 end)) + 	sum(case when "parentType"='Operating Expense'then "total" else 0 end) as "netProfit"
                //            from "mainQuery"
                //            JOIN "values" ON TRUE 
                //            where (("values"."comparison" = true  and "period"='Month' and "key"::timestamp >= "fromDate"::timestamp - interval '1 month' *  "periodQty")  or
                //                   ("values"."comparison" = true  and "period"='Year' and "key"::timestamp >= "fromDate"::timestamp - interval '1 year' *  "periodQty") or
                //                   (("values"."comparison" = true or "values"."comparison" is null) and "asOf" = true  and  array_length("values"."branches",1) > 1  )or   
                //                   ("values"."comparison" is null and ("fromDate" is null or "key"::timestamp >="fromDate"))or
                //                   ("values"."comparison" = true and "asOf" is null )
                //                  )
                //            group by "columnName"
                //            )



                //            select 
                //            'Net Profit' as "account",
                //            'Equity'     as "parentType",
                //            'Equity'     as "type",
                //            JSON_AGG(JSON_BUILD_OBJECT("columnName","netProfit")) FILTER (WHERE "columnName" is not null)   as "summary"

                //            from "summary"
                //            join "values" on true 
                //            group by "comparison"
                //            union  all
                //            select 
                //            'Operating Profit' as "account",
                //            'Operating Profit'     as "parentType",
                //            'Operating Profit'     as "type",
                //            JSON_AGG(JSON_BUILD_OBJECT("columnName","netProfit")) FILTER (WHERE "columnName" is not null)   as "summary"

                //            from "summary"
                //            join "values" on true 
                //            group by "comparison"
                //            union  all    
                //            select 
                //            'Gross Profit' as "account",
                //            'Gross Profit'     as "parentType",
                //            'Gross Profit'     as "type",
                //           JSON_AGG(JSON_BUILD_OBJECT("columnName","grossProfit")) FILTER (WHERE "columnName" is not null)  as "summary"

                //            from "summary"
                //            join "values" on true 
                //            group by "comparison"



                //                     `,
                text: `with "values" as (
                        select  $1::uuid as "companyId",
                        $2::uuid[] as "branches",
                        array['Operating Expense', 'Operating Income', 'Costs Of Goods Sold','Expense']::text[] as "types",                    
                        $3::TEXT AS "period",
                        $4::int AS "periodQty",
                        $5::BOOLEAN AS "comparison",
                        $6::timestamp as "fromDate",
                        $7::timestamp as "toDate",
                        $8::BOOLEAN  as  "asOf"
               ), "inventoryAssets" as (
						select 
						case when "ProductCosts".id is null then "InventoryMovmentRecords"."cost" else "InventoryMovmentRecords".qty * "ProductCosts"."cost" end as "cost",
						case when "ProductCosts".id is null  then 0 else  ROW_NUMBER() OVER (partition by "ProductCosts"."productId","ProductCosts"."branchId" order by "ProductCosts"."createdAt" asc) end as "rowNumber",
						"InventoryMovmentRecords"."createdAt",
						"InventoryMovmentRecords"."branchId"
					from "InventoryMovmentRecords" 
                        join "values" on true 
			    		left join "ProductCosts" on "ProductCosts"."branchId" = "InventoryMovmentRecords"."branchId" and "ProductCosts"."productId" = "InventoryMovmentRecords"."productId" and "ProductCosts"."createdAt" <="InventoryMovmentRecords"."createdAt" 
					    WHERE "InventoryMovmentRecords"."companyId" = "values"."companyId"
                    
					),"movmentSum" as(
						select 
						
					       "Accounts"."parentType",
 			case when "values"."comparison" = true  and  array_length("values"."branches",1)  >= 1  and "period" is null  then "Branches".name end as "journalBranchName",
            case when "values"."comparison" = true  and   array_length("values"."branches",1) >= 1 and "period" is null then null
              else  "inventoryAssets"."createdAt"::text end as "key",
						sum("inventoryAssets"."cost")
						from "inventoryAssets" 
						join "values" on true
						join "Accounts" on "Accounts"."companyId" = "values"."companyId" and "Accounts".name = 'Costs Of Goods Sold'    and "default" = true
					    inner join "Branches" on "Branches".id = "inventoryAssets"."branchId"
						where "inventoryAssets"."rowNumber" = 1 or  "inventoryAssets"."rowNumber" = 0 
						AND "Accounts"."parentType" = any("values"."types")
           AND ( array_length("values"."branches",1) IS NULL or "inventoryAssets"."branchId" = "Branches".id)
           AND ( ("asOf" = true and  "inventoryAssets"."createdAt" < "values"."toDate" )or 
                 (("asOf" is null or "asOf" = false )and 
				  (("values"."comparison" = true  and "period"='Month' and "inventoryAssets"."createdAt"::timestamp >= "fromDate"::timestamp - interval '1 month' *  "periodQty"  and "inventoryAssets"."createdAt" < "values"."toDate")  or
                  ("values"."comparison" = true  and "period"='Year' and "inventoryAssets"."createdAt"::timestamp >= "fromDate"::timestamp - interval '1 year' *  "periodQty"  and "inventoryAssets"."createdAt" < "values"."toDate" ) or
				   (("values"."comparison" = true and array_length("values"."branches",1) > 0  and "period"  is null ) and "inventoryAssets"."createdAt" >= "values"."fromDate"  and "inventoryAssets"."createdAt" < "values"."toDate" ) or
            (("values"."comparison" is null or "values"."comparison" = false) and"inventoryAssets"."createdAt" >= "values"."fromDate"  and "inventoryAssets"."createdAt" < "values"."toDate" )) )
               )
						    group by "Accounts"."parentType","values"."branches","key","journalBranchName"
					)
           , "mainQuery" as(
           select 
            "Accounts"."parentType",
 			case when "values"."comparison" = true  and  array_length("values"."branches",1)  >= 1  and "period" is null  then "Branches".name end as "journalBranchName",
            case when "values"."comparison" = true  and   array_length("values"."branches",1) >= 1 and "period" is null then null
              else  "JournalRecords"."createdAt"::text end as "key",
             sum("JournalRecords".amount::text::numeric*(-1))    as "total"
           from "Accounts"
           JOIN "values" ON TRUE
           inner join "JournalRecords" ON  "Accounts".id = "JournalRecords"."accountId" and "Accounts"."companyId" = "values"."companyId"
           left join "Branches" on "Branches".id = any("values"."branches")
           inner join "Companies" on "Companies".id = "JournalRecords"."companyId"
           WHERE "JournalRecords"."companyId" = "values"."companyId"
           AND "Accounts"."parentType" = any("values"."types")
           AND ( array_length("values"."branches",1) IS NULL or "JournalRecords"."branchId" = "Branches".id)
		   and not ("Accounts".name = 'Costs Of Goods Sold' and "dbTable" in ('Invoice', 'Credit Note','Inventory Transfer','Physical Count','Billing','Supplier Credits','Opening Balance','Manual Adjusment'))
           AND ( ("asOf" = true and  "JournalRecords"."createdAt" < "values"."toDate" )or 
                 (("asOf" is null or "asOf" = false )and 
				  (("values"."comparison" = true  and "period"='Month' and "JournalRecords"."createdAt"::timestamp >= "fromDate"::timestamp - interval '1 month' *  "periodQty"  and "JournalRecords"."createdAt" < "values"."toDate")  or
                  ("values"."comparison" = true  and "period"='Year' and "JournalRecords"."createdAt"::timestamp >= "fromDate"::timestamp - interval '1 year' *  "periodQty"  and "JournalRecords"."createdAt" < "values"."toDate" ) or
				   (("values"."comparison" = true and array_length("values"."branches",1) > 0  and "period"  is null ) and "JournalRecords"."createdAt" >= "values"."fromDate"  and "JournalRecords"."createdAt" < "values"."toDate" ) or
            (("values"."comparison" is null or "values"."comparison" = false) and"JournalRecords"."createdAt" >= "values"."fromDate"  and "JournalRecords"."createdAt" < "values"."toDate" )) )
               )
           group by "Accounts"."parentType","values"."branches","key","journalBranchName"
          union all 
			   select * from "movmentSum"
           )
		   
		  
		  , "summary" as (
           select 
           
                case when "values"."comparison" = true  and "period"='Month' then trim(to_char( "key"::timestamp,'Mon/yyyy'))::text
                     when  "values"."comparison" = true  and "period"='Year' then extract (year from "key"::timestamp)::text
                     when  "values"."comparison" = true  and  array_length("values"."branches",1) > 1 then "journalBranchName"
                     else 'Total'
                end as "columnName",
       
                 sum(case when "parentType"='Operating Income' then "total" else 0 end) +	sum(case when "parentType"='Costs Of Goods Sold'then "total" else 0 end) as "grossProfit",

               (sum(case when "parentType"='Operating Income' then "total" else 0 end) +	sum(case when "parentType"='Costs Of Goods Sold'then "total" else 0 end)) + 	sum(case when "parentType"='Operating Expense'then "total" else 0 end) as "netProfit"
           from "mainQuery"
           JOIN "values" ON TRUE 

           group by "columnName"
           )
         
       
           
           select 
           'Net Profit' as "account",
           'Equity'     as "parentType",
           'Equity'     as "type",
           JSON_AGG(JSON_BUILD_OBJECT("columnName","netProfit")) FILTER (WHERE "columnName" is not null)   as "summary"
    
           from "summary"
           join "values" on true 
           group by "comparison"
           union  all
           select 
           'Operating Profit' as "account",
           'Operating Profit'     as "parentType",
           'Operating Profit'     as "type",
           JSON_AGG(JSON_BUILD_OBJECT("columnName","netProfit")) FILTER (WHERE "columnName" is not null)   as "summary"
    
           from "summary"
           join "values" on true 
           group by "comparison"
           union  all    
           select 
           'Gross Profit' as "account",
           'Gross Profit'     as "parentType",
           'Gross Profit'     as "type",
          JSON_AGG(JSON_BUILD_OBJECT("columnName","grossProfit")) FILTER (WHERE "columnName" is not null)  as "summary"
 
           from "summary"
           join "values" on true 
           group by "comparison"
           
            
               
                        `,

                values: [companyId, branches, period, NoOfperiod, comparison, from, to, asOf]
            }




            const reports = await DB.excu.query(query.text, query.values);

            let accounts = reports.rows && reports.rows.length > 0 ? reports.rows : null



            return accounts

        } catch (error: any) {
            console.log(error)
            throw new Error(error);
        }
    }

    public static async getProfitAndLossReportOld(data: any, company: Company, branchList: []) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let branches = filter && filter.branches ? filter.branches : branchList;

            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : null;
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to

            //---------------------------------------

            let NoOfperiod = (filter && filter.periodQty) && (!filter.branches || (filter.branches && filter.branches.length <= 1)) ? filter.periodQty : null;
            let period = (filter && filter.period) && (!filter.branches || (filter.branches && filter.branches.length <= 1)) ? filter.period : null;

            let comparison = (period && NoOfperiod) || (branches.length > 1 && filter && filter.branches && filter.branches.length > 1) ? true : null

            //let comparison = period || (branches.length && filter && filter.branches && filter.branches.length>1 )> 1 ? true : null
            let columns = ["Total"]



            const query = {
                // text: `with "values" as (
                //     select  $1::uuid as "companyId",
                //         $2::uuid[] as "branches",
                //         array['Operating Expense', 'Operating Income', 'Costs Of Goods Sold','Expense']::text[] as "types",                    
                //         $3::TEXT AS "period",
                //         $4::int AS "periodQty",
                //         $5::BOOLEAN AS "comparison",
                //         $6::timestamp as "fromDate",
                //         $7::timestamp as "toDate"

                // ), "mainQuery" as(
                //     select 
                //         "Accounts".id as "accountId",
                //          "Accounts"."name" as "account",
                //      "Accounts"."type",
                //      "Accounts"."parentType",
                //      case when "values"."comparison" = true  and array_length("values"."branches",1) > 1 then "Branches".name end as "journalBranchName",
                //      case when "values"."comparison" = true  and array_length("values"."branches",1) > 1 then null
                //             else  "JournalRecords"."createdAt"::text end as "key",
                //       sum("JournalRecords".amount::numeric*(-1))    as "total"
                //     from "Accounts"
                //     JOIN "values" ON TRUE
                //     inner join "JournalRecords" ON  "Accounts".id = "JournalRecords"."accountId" and "Accounts"."companyId" = "values"."companyId"
                //     left join "Branches" on "Branches".id = any("values"."branches")
                //     inner join "Companies" on "Companies".id = "JournalRecords"."companyId"
                //     WHERE "JournalRecords"."companyId" = "values"."companyId"
                //     AND "Accounts"."parentType" = any("values"."types")
                //     AND ( array_length("values"."branches",1) IS NULL or "JournalRecords"."branchId" = "Branches".id)
                //     AND ( ("comparison" is null and "JournalRecords"."createdAt" >= "values"."fromDate"  and "JournalRecords"."createdAt" < "values"."toDate"  ) or 
                //           ("comparison"  =true and "period" ='Month' and  "JournalRecords"."createdAt" >= "fromDate"::timestamp - interval '1 month' *  "periodQty" and "JournalRecords"."createdAt" < "values"."toDate") or
                //           ("comparison"  =true and "period" ='Year' and  "JournalRecords"."createdAt" >= "fromDate"::timestamp - interval '1 year' *  "periodQty" and "JournalRecords"."createdAt" < "values"."toDate") or
                //           ("comparison"  =true and  array_length("values"."branches",1) >1  and  "JournalRecords"."createdAt" >= "fromDate"::timestamp and "JournalRecords"."createdAt" < "values"."toDate") 
                //         )
                //     group by "Accounts".id ,"values"."branches","key","journalBranchName"

                //     ),"summary" as (
                //     select 
                //      "mainQuery"."accountId",
                //          "mainQuery"."account",
                //          "mainQuery"."type",
                //      "mainQuery"."parentType",
                //         "journalBranchName",
                //          case when "values"."comparison" = true  and "period"='Month' then trim(to_char( "key"::timestamp,'Mon/yyyy'))::text
                //               when  "values"."comparison" = true  and "period"='Year' then extract (year from "key"::timestamp)::text
                //               when "values"."comparison" = true  and  array_length("values"."branches",1) > 1 then "journalBranchName"
                //          else 'Total'
                //          end as "columnName",
                //         sum("total")as "total"
                //                         from "mainQuery"
                //     JOIN "values" ON TRUE 

                //     group by "columnName" ,     "mainQuery"."accountId",
                //          "mainQuery"."account",
                //          "mainQuery"."type",
                //      "mainQuery"."parentType",
                //         "journalBranchName"
                //     ),"filters" as (
                //     SELECT
                //       CASE
                //         WHEN "comparison" = true AND "values"."period" LIKE 'Year' THEN JSONB_AGG("columnName" ORDER BY "columnName")
                //         WHEN "comparison" = true AND "values"."period" LIKE 'Month' THEN JSONB_AGG("columnName" ORDER BY TO_DATE("columnName", 'Mon/YYYY'))  FILTER (WHERE "columnName" ~ '^[A-Z][a-z]{2}/[0-9]{4}$') 
                //         when "values"."comparison" = true  and array_length("values"."branches",1) > 1  then JSONB_AGG("columnName" ORDER BY "columnName") 
                //       END AS "columns"
                //         FROM (
                //           SELECT DISTINCT COALESCE("columnName","journalBranchName")"columnName"

                //           FROM "summary"
                //                       join "values" on true 
                //         ) AS subquery
                //         join "values" on true 
                //             group by "comparison" , "period","values"."branches"
                //         )

                //         select
                //         "summary"."accountId",
                //         "summary"."account",
                //         "summary"."type",
                //         "summary"."parentType",
                //         "filters"."columns",
                //          JSON_AGG(JSON_BUILD_OBJECT("columnName","total")) FILTER (WHERE "columnName" is not null) as "summary"

                //         from "summary"
                //         join "values" on true
                //         join "filters" on true
                //         group by "summary"."accountId",
                //         "summary"."account",
                //         "summary"."type",
                //         "summary"."parentType",
                //         "comparison",
                //         "filters"."columns"`,
                text: `with "values" as (
                    select  $1::uuid as "companyId",
                        $2::uuid[] as "branches",
                        array['Operating Expense', 'Operating Income', 'Costs Of Goods Sold','Expense']::text[] as "types",                    
                        $3::TEXT AS "period",
                        $4::int AS "periodQty",
                        $5::BOOLEAN AS "comparison",
                        $6::timestamp as "fromDate",
                        $7::timestamp as "toDate"
                    
                ), "mainQuery" as(
                select 
                    "Accounts".id as "accountId",
                     "Accounts"."name" as "account",
                 "Accounts"."type",
                 "Accounts"."parentType",
                 case when "values"."comparison" = true  and array_length("values"."branches",1) > 1 then "Branches".name end as "journalBranchName",
				  case when "values"."comparison" = true  and   array_length("values"."branches",1) > 1 and "period" is null then null
              else  "JournalRecords"."createdAt"::text end as "key",
				

                  sum("JournalRecords".amount::text::numeric*(-1))    as "total"
                from "Accounts"
                JOIN "values" ON TRUE
                inner join "JournalRecords" ON  "Accounts".id = "JournalRecords"."accountId" and "Accounts"."companyId" = "values"."companyId"
                left join "Branches" on "Branches".id = any("values"."branches")
                inner join "Companies" on "Companies".id = "JournalRecords"."companyId"
                WHERE "JournalRecords"."companyId" = "values"."companyId"
                AND "Accounts"."parentType" = any("values"."types")
                AND ( array_length("values"."branches",1) IS NULL or "JournalRecords"."branchId" = "Branches".id)
                AND ( ("comparison" is null and "JournalRecords"."createdAt" >= "values"."fromDate"  and "JournalRecords"."createdAt" < "values"."toDate"  ) or 
                      ("comparison"  =true and "period" ='Month' and  "JournalRecords"."createdAt" >= "fromDate"::timestamp - interval '1 month' *  "periodQty" and "JournalRecords"."createdAt" < "values"."toDate") or
                      ("comparison"  =true and "period" ='Year' and  "JournalRecords"."createdAt" >= "fromDate"::timestamp - interval '1 year' *  "periodQty" and "JournalRecords"."createdAt" < "values"."toDate") or
                      ("comparison"  =true and  array_length("values"."branches",1) >1  and  "JournalRecords"."createdAt" >= "fromDate"::timestamp and "JournalRecords"."createdAt" < "values"."toDate") 
                    )
                group by "Accounts".id ,"values"."branches","key","journalBranchName"
               
                )
			
				
				,"summary" as (
                select 
                 "mainQuery"."accountId",
                     "mainQuery"."account",
                     "mainQuery"."type",
                 "mainQuery"."parentType",
                   
                     case when "values"."comparison" = true  and "period"='Month' then trim(to_char( "key"::timestamp,'Mon/yyyy'))::text
                          when  "values"."comparison" = true  and "period"='Year' then extract (year from "key"::timestamp)::text
                          when "values"."comparison" = true  and  array_length("values"."branches",1) > 1 then "journalBranchName"
                     else 'Total'
                     end as "columnName",
                    sum("total")as "total"
                                    from "mainQuery"
                JOIN "values" ON TRUE 
           
                group by "columnName" ,     "mainQuery"."accountId",
                     "mainQuery"."account",
                     "mainQuery"."type",
                 "mainQuery"."parentType"
                )
				
				,"filters" as (
                SELECT
                  CASE
                    WHEN "comparison" = true AND "values"."period" LIKE 'Year' THEN JSONB_AGG("columnName" ORDER BY "columnName")
                    WHEN "comparison" = true AND "values"."period" LIKE 'Month' THEN JSONB_AGG("columnName" ORDER BY TO_DATE("columnName", 'Mon/YYYY'))  FILTER (WHERE "columnName" ~ '^[A-Z][a-z]{2}/[0-9]{4}$') 
                    when "values"."comparison" = true  and array_length("values"."branches",1) > 1  then JSONB_AGG("columnName" ORDER BY "columnName") 
                  END AS "columns"
                    FROM (
                      SELECT DISTINCT "columnName"
                
                      FROM "summary"
                                  join "values" on true 
                    ) AS subquery
                    join "values" on true 
                        group by "comparison" , "period","values"."branches"
                    )
    
                    select
                    "summary"."accountId",
                    "summary"."account",
                    "summary"."type",
                    "summary"."parentType",
                    "filters"."columns",
                     JSON_AGG(JSON_BUILD_OBJECT("columnName","total")) FILTER (WHERE "columnName" is not null) as "summary"
                
                    from "summary"
                    join "values" on true
                    join "filters" on true
                    group by "summary"."accountId",
                    "summary"."account",
                    "summary"."type",
                    "summary"."parentType",
                    "comparison",
                    "filters"."columns"`,
                values: [companyId, branches, period, NoOfperiod, comparison, from, to]
            }



            const records = await DB.excu.query(query.text, query.values);
            const netProfit = await this.netProfitTotal(data, company, null, branchList)

            if (records.rows && records.rows.length > 0 && (<any>records.rows[0]).columns) {
                columns = (<any>records.rows[0]).columns
            }
            if (netProfit) {
                netProfit.forEach(element => {
                    records.rows.push(element)

                });
            }


            let resData = {
                records: records.rows,
                columns: columns
            }

            if (filter.export) {
                records.rows = await XLSXGenerator.accontIndex(records.rows)
                records.rows.sort((a: any, b: any) => (a.grandTypeIndex - b.grandTypeIndex || a.parentTypeIndex - b.parentTypeIndex || 0 - (a.type > b.type ? 1 : -1)))
                let report = new ReportData()
                report.filter = {
                    title: "Profit and Loss",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches,

                    //   compareType: compareType,
                    period: period, periodQty: NoOfperiod
                }
                report.records = records.rows

                //get columns & subColumns
                resData.columns.forEach((col: any) => {
                    report.columns.push({ key: col, properties: { hasSubTotal: true, columnType: 'currency' } })
                })

                report.columns = [...[{ key: 'parentType', properties: { groupBy: "horizantal" } },
                { key: 'type' },
                { key: 'account' }, { key: 'code', header: 'Account Code' }], ...report.columns]
                report.fileName = 'ProfitAndLoss'

                return new ResponseData(true, "", report)

            } else {
                return new ResponseData(true, "", resData)
            }


        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    public static async trialBalanceReport(data: any, company: Company, branchList: []) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let branches = filter && filter.branches ? filter.branches : branchList;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : null;
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to

            //---------------------------------------

            let period = filter && filter.period ? filter.period : null;

            let NoOfperiod = filter && filter.periodQty && period ? filter.periodQty : null;
            let comparison = period || (branches && branches.length > 1 && filter.branches && filter.branches.length > 1) ? true : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : 'none';
            let columns = ['Net Debit', 'Net Credit'];

            let asOf = filter.allowAsOf ?? false

            // if (asOf == null || asOf == false) {
            //     asOf = (branches && branches.length > 1 && filter && filter.branches  && filter.branches.length>1)  ? true : false
            // }
            const previousYearDate = moment(to).clone();

            const hour = previousYearDate.hour();
            const minute = previousYearDate.minute();
            const second = previousYearDate.second();

            const firstDateOfYear = moment(filter.toDate, 'YYYY-MM-DD')
                .startOf('year')
                .format('YYYY-MM-DD');

            let currentYearInterval = await TimeHelper.getReportTime(moment(firstDateOfYear), toDate, closingTime, false, timeOffset)
            let currentYearFrom = currentYearInterval.from;
            let currentYearTo = to;
            let types = ['Operating Expense', 'Operating Income', 'Costs Of Goods Sold', 'Expense']
            const allowCompartion = comparison ? true :false 
            const query = {
                text: `with "values" as (
                       select  $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::TEXT AS "period",
                            $4::int AS "periodQty",
                            $5::BOOLEAN AS "comparison",
                            case when $5::BOOLEAN=true and $3::TEXT = 'Month' then $6::timestamp - interval '1 Months'* $4
                            when $5::BOOLEAN=true and $3::TEXT = 'Year' then $6::timestamp - interval '1 Year'* $4
                            else
                            $6::timestamp end as "fromDate",
                            $7::timestamp as "toDate",
                            $8::BOOLEAN as "asOf",
                            $9::timeStamp as "currentYearFrom",
                            $10::timeStamp as "currentYearTo",
                            $11::text[] as "types"
                     ),"records" as (
						 select 
						"InventoryMovmentRecords"."referenceTable",
                         ( "InventoryMovmentRecords".qty::text::NUMERIC(30,5) *  COALESCE(nullif("InventoryMovmentRecords"."cost"::text::NUMERIC(30,5),'NaN'),0 ))*-1  as  "costOFGoodSolds",
						 ( "InventoryMovmentRecords".qty::text::NUMERIC(30,5) *  COALESCE(nullif("InventoryMovmentRecords"."cost"::text::NUMERIC(30,5),'NaN'),0 )) as  "inventoryAssets",
			            "InventoryMovmentRecords"."branchId",
			            "InventoryMovmentRecords"."createdAt",
			            "InventoryMovmentRecords"."productId"
						from "InventoryMovmentRecords"
						JOIN "values" on true
						WHERE "InventoryMovmentRecords"."companyId" = "values"."companyId"
						AND ( "values"."branches" is null or  "InventoryMovmentRecords"."branchId"  = any("values"."branches") or ( "InventoryMovmentRecords"."branchId" is null  and "InventoryMovmentRecords"."companyId" =  "values"."companyId") )
                        AND ( "values"."branches" is null or  "InventoryMovmentRecords"."branchId"  = any("values"."branches") or ( "InventoryMovmentRecords"."branchId" is null  and "InventoryMovmentRecords"."companyId" =  "values"."companyId") )
                        AND ( "values"."fromDate"::timestamp is null or "InventoryMovmentRecords"."createdAt" >= "values"."fromDate")
                        AND  "InventoryMovmentRecords"."createdAt" < "values"."toDate"  
                        AND   "InventoryMovmentRecords"."referenceTable"  not in ('Supplier Credit','Billing')
						),"costOfGodSolds" as(
					   select  
						"Accounts".id as "accountId",
                        "Accounts"."name" as "account",
                        "Accounts".code,
                        "Accounts".type,
                        "Accounts"."parentType",
						case when "comparison" = true and array_length("values"."branches",1) >= 1 and "period" is null then "Branches".name::text 
						     when  "comparison" = true  and "period" is not null then  "records"."createdAt"::text 
						end as "key",
					     "costOFGoodSolds"  as "cost"
						from "records"
					   JOIN "values" on true
					   INNER JOIN "Accounts" on "Accounts"."companyId" = "values"."companyId" and "Accounts"."name" = 'Costs Of Goods Sold' and "Accounts"."default" = true
					   INNER join "Branches" on "Branches".id ="records"."branchId"
                       where  "referenceTable"  not in ('Opening Balance')
                       and ("values"."asOf" is false or ("records"."createdAt" >= "values"."currentYearFrom" and "records"."createdAt" < "values"."currentYearTo"))
						),"inventoryAssets" as(
					   select 
						"Accounts".id as "accountId",
                        "Accounts"."name" as "account",
                        "Accounts".code,
                        "Accounts".type,
                        "Accounts"."parentType", 
							case when "comparison" = true and array_length("values"."branches",1) >= 1 and "period" is null then "Branches".name::text 
						     when  "comparison" = true  and "period" is not null then  "records"."createdAt"::text 
						     end
						 as "key",
						"inventoryAssets" as "cost"
						from "records"
					   JOIN "values" on true
					   INNER JOIN "Accounts" on "Accounts"."companyId" = "values"."companyId" and  "Accounts".name = 'Inventory Assets'    and "default" = true
					   INNER join "Branches" on "Branches".id ="records"."branchId"
					), "journals" as(
                        select 
                        "Accounts".id as "accountId",
                        "Accounts"."name" as "account",
                        "Accounts".code,
                        "Accounts".type,
                        "Accounts"."parentType",
                      	case when "comparison" = true and array_length("values"."branches",1) >= 1 and "period" is null then "Branches".name::text 
						     when  "comparison" = true  and "period" is not null then  "JournalRecords"."createdAt"::text 
						    
						end as "key",
                        "JournalRecords".amount::text::NUMERIC(30,5) as "cost"
						from "JournalRecords"
                        JOIN "values" ON TRUE
                        inner join "Accounts" ON  "Accounts".id = "JournalRecords"."accountId" and "Accounts"."companyId" = "values"."companyId"
						left join "Branches" on "Branches".id ="JournalRecords"."branchId"
                        inner join "Companies" on "Companies".id = "JournalRecords"."companyId"
                        WHERE "JournalRecords"."companyId" = "values"."companyId"
					    AND ( "values"."branches" is null or  "JournalRecords"."branchId"  = any("values"."branches") or ( "JournalRecords"."branchId" is null  and "JournalRecords"."companyId" =  "values"."companyId") )
                       AND ( "values"."fromDate"::timestamp is null or "JournalRecords"."createdAt" >= "values"."fromDate")
                        AND  "JournalRecords"."createdAt" < "values"."toDate" 
                        AND ("values"."asOf" = false or ("values"."asOf"= true and  "Accounts"."parentType" <> ALL("values"."types")) or  ( "values"."asOf"= true and "JournalRecords"."createdAt" >= "values"."currentYearFrom" and "JournalRecords"."createdAt" < "values"."currentYearTo" and "Accounts"."parentType" = any("values"."types")))
                       and  ("Accounts".name <>  'Costs Of Goods Sold' or "dbTable" not in ( 'Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment'))
                       and  ("Accounts".name <>   'Inventory Assets'  or "dbTable" not in ('Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment'))
					), "unions" as(
                        select * from "costOfGodSolds"
                        union all 
                          select * from "inventoryAssets"
                           union all 
                          select * from "journals"
                        ), "mainQuery" as(
                         select 
                        "unions"."accountId",
                        "unions"."account",
                        "unions".code,
                        "unions".type,
                        "unions"."parentType",
                       "unions"."key",
                      case when sum("unions"."cost"::text::NUMERIC(30,5)) < 0 then   abs(sum("unions"."cost"::text::NUMERIC(30,5))) end  as "credit",
                        case when sum("unions"."cost"::text::NUMERIC(30,5)) > 0 then   abs(sum("unions"."cost"::text::NUMERIC(30,5))) end  as "debit"
                    from "unions"
                    group by 
                        "unions"."accountId",
                        "unions"."account",
                        "unions".code,
                        "unions".type,
                        "unions"."parentType",
                        "unions"."key"
                        )
						
						, "accounts" as (
						select 
						"accountId",
						"account",
						"code",
						"type",
						"parentType",
							case when "comparison" = true and "period" = 'Month' then to_char(DATE_TRUNC('Month',"key"::TIMESTAMP),'Mon/YYYY')
                             when "comparison" = true and "period" = 'Year' then to_char(DATE_TRUNC('year',"key"::TIMESTAMP),'YYYY') 
						     when "comparison" = true and array_length("values"."branches",1) > 1 then  case when "key" is null then ' ' else "key" end 
							 else ''
							 end as "columns",
                                sum("mainQuery"."debit"::text::NUMERIC(30,5)) as "debit",
                             sum ("mainQuery"."credit"::text::NUMERIC(30,5)) as "credit"
							
          
						from "mainQuery"
                        JOIN "values" ON TRUE
					    group by "accountId",
						"account",
						"code",
						"type",
						"parentType","columns"
						)
						
						
					
						,"filters" as (
                    SELECT
                      CASE
                        WHEN "comparison" = true AND "values"."period" LIKE 'Year' THEN JSONB_AGG("columnName" ORDER BY "columnName")
                        WHEN "comparison" = true AND "values"."period" LIKE 'Month' THEN JSONB_AGG("columnName" ORDER BY TO_DATE("columnName", 'Mon/YYYY'))  FILTER (WHERE "columnName" ~ '^[A-Z][a-z]{2}/[0-9]{4}$') 
                        when "comparison" = true and array_length("values"."branches",1) >= 1  then JSONB_AGG("columnName" ORDER BY "columnName") 
                      END AS "columns"
                        FROM (
                          SELECT DISTINCT "columns" "columnName"
                    
                          FROM "accounts"
                            join "values" on true 
                        )t
							 join "values" on true
							group by 
							"values"."period",
							"comparison" ,
							"values"."branches"
			)
			
		select
					    "accountId",
						"account",
						"code",
						"type",
						"parentType",
					   case when "comparison" = true and "period" = 'Month' then  JSON_AGG(JSON_BUILD_OBJECT("accounts"."columns",JSON_BUILD_OBJECT('Net Debit',"debit",'Net Credit',"credit")))
                                 when "comparison" = true and "period" = 'Year' then JSON_AGG(JSON_BUILD_OBJECT("accounts"."columns",JSON_BUILD_OBJECT('Net Debit',"debit",'Net Credit',"credit")))
                                 when "comparison" = true and array_length("values"."branches",1) > 1 then JSON_AGG(JSON_BUILD_OBJECT("accounts"."columns",JSON_BUILD_OBJECT('Net Debit',"debit",'Net Credit',"credit")))
                                 else  JSON_AGG(JSON_BUILD_OBJECT('Net Debit',"debit",'Net Credit',"credit"))
                                 end as "summary",
                                 "filters"."columns"
						from "accounts"
						JOIN "values" ON TRUE
						JOIN "filters" ON TRUE 
						group by "accountId",
						 "accountId",
						"account",
						"code",
						"type",
						"parentType",
						"asOf",
						"comparison",
						"period",
						"values"."branches",
						"filters"."columns"
						order by "parentType","type" 
                              `,
                values: [companyId, branches, period, NoOfperiod, comparison, from, to, asOf, currentYearFrom, currentYearTo, types]
            }

            let records = await DB.excu.query(query.text, query.values);

            if (records.rows && records.rows.length > 0 && (<any>records.rows[0]).columns) {
                columns = (<any>records.rows[0]).columns
            }
            let subColumns = records.rows && records.rows.length && comparison ? ['Net Debit', 'Net Credit'] : []
            if (asOf) {
                // data.filter.toDate = currentYearFrom
                data.filter.asOf = asOf
                const netProfit = await this.netProfitTotal2(data, company, asOf, branchList)
                const netTemp: any = netProfit ? netProfit.find(f => f.account == 'Net Profit') : null
                if (netTemp)
                    netTemp.account = 'Retained Earning'
                let retainedErningAccounts = records.rows.find(f => f.account == 'Retained Earning') ? records.rows.find(f => f.account == 'Retained Earning').summary : null
                const newAccount = this.buildSummary(retainedErningAccounts, netTemp.summary, columns, subColumns,allowCompartion)
                records.rows = records.rows.filter(f => f.account !== 'Retained Earning')
                netTemp.summary = newAccount
                records.rows.push(netTemp)
            }

            let resData = {
                records: records.rows,
                columns: columns,
                subColumns: subColumns
            }




            if (filter.export) {
                records.rows = await XLSXGenerator.accontIndex(records.rows)
                records.rows.sort((a: any, b: any) => (a.grandTypeIndex - b.grandTypeIndex || a.parentTypeIndex - b.parentTypeIndex))
                let report = new ReportData()
                report.filter = {
                    title: "Trial Balance Basis: Accrual",
                    fromDate: ((filter && filter.fromDate) || asOf != true) ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches, compareType: compareType,
                    period: period, periodQty: NoOfperiod
                }
                report.records = records.rows

                //get columns & subColumns

                resData.columns.forEach((col: any) => {
                    let childs: DataColumn[] = []
                    resData.subColumns.forEach((subcol: any) => childs.push({ key: subcol, properties: { columnType: 'currency' } }))
                    if (childs.length > 0) { report.columns.push({ key: col, childs: childs, properties: { hasTotal: true } }) }
                    else { report.columns.push({ key: col, properties: { hasTotal: true, columnType: 'currency' } }) }

                })

                report.columns = [...[{ key: 'grandType', properties: { groupBy: "horizantal" } }, { key: 'account' }, { key: 'code', header: 'Account Code' }], ...report.columns]
                report.fileName = 'TrialBalanceBasis'
                return new ResponseData(true, "", report)

            } else {
                return new ResponseData(true, "", resData)
            }
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    public static buildSummary(
        existingSummary: any[] | null,
        extraSummary: any[],
        columns: any[],
        subColumns: any[],
        comparison: boolean = false
    ): any[] {

        let summary: any;

        // Build base structure
        if (!existingSummary || !existingSummary.length) {
            if (!subColumns.length) {
                summary = { "Net Debit": 0, "Net Credit": 0 };
            } else {
                summary = {};
                for (const col of columns) {
                    summary[col] = { "Net Debit": 0, "Net Credit": 0 };
                }
            }
        } else {
            summary = structuredClone(existingSummary[0]);
        }

        // Apply adjustments
        for (const item of extraSummary) {
            const key = Object.keys(item)[0];
            const value = item[key] ?? 0;
            const delta = Number(value) * -1;

            if (!subColumns.length) {
                const net = summary;
                const current = net["Net Debit"] - (net["Net Credit"]);
                const result = current + delta;

                net["Net Debit"] = result > 0 ? result : 0;
                net["Net Credit"] = result < 0 ? Math.abs(result) : 0;
            } else {
                if (!summary[key]) summary[key] = { "Net Debit": 0, "Net Credit": 0 };

                const net = summary[key];
                const current = net["Net Debit"] - net["Net Credit"];
                const result = current + delta;

                net["Net Debit"] = result > 0 ? result : 0;
                net["Net Credit"] = result < 0 ? Math.abs(result) : 0;
            }
        }
        if (comparison) {
            summary = Object.keys(summary).map((key, index) => ({
                [key]: summary[key]
            }));
        } else {
            summary = [summary]
        }

        return summary;
    }


    public static async generalLedgerReport(data: any, company: Company, branchList: []) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let branches = filter && filter.branches ? filter.branches : branchList;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : null;
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to

            //---------------------------------------
            let period = filter && filter.period ? filter.period : null;

            let NoOfperiod = filter && filter.periodQty && period ? filter.periodQty : null;
            let comparison = period || (branches && branches.length > 1 && filter.branches && filter.branches.length > 1) ? true : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : 'none';
            let columns = ['Net Debit', 'Net Credit', 'Balance'];

            let asOf = filter.allowAsOf ?? false

            // if (asOf == null || asOf == false) {
            //     asOf = ( filter && filter.branches  && filter.branches.length>1) ? true : false
            // }

            const query = {
                text: `with "values" as (
                    select  $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::TEXT AS "period",
                            $4::int AS "periodQty",
                    $5::BOOLEAN AS "comparison",
                    case when $5::BOOLEAN=true and $3::TEXT = 'Month' then $6::timestamp - interval '1 Months'* $4
                    when $5::BOOLEAN=true and $3::TEXT = 'Year' then $6::timestamp - interval '1 Year'* $4
                    else
                    $6::timestamp end as "fromDate",
                    $7::timestamp as "toDate",
                  $8::BOOLEAN as "asOf"
                    ), "movments" as (
			   select 
						"InventoryMovmentRecords"."referenceTable",
				        "InventoryMovmentRecords"."code",
				        "InventoryMovmentRecords"."transactionId",
				        "InventoryMovmentRecords"."qty",
						  ( "InventoryMovmentRecords".qty::text::NUMERIC(30,5) *  COALESCE(nullif("InventoryMovmentRecords"."cost"::text::NUMERIC(30,5),'NaN'),0 ))*-1  as  "costOFGoodSolds",
						 ( "InventoryMovmentRecords".qty::text::NUMERIC(30,5) *  COALESCE(nullif("InventoryMovmentRecords"."cost"::text::NUMERIC(30,5),'NaN'),0 )) as  "inventoryAssets",
			            "InventoryMovmentRecords"."branchId",
			            "InventoryMovmentRecords"."createdAt",
			            "InventoryMovmentRecords"."productId",
				        "InventoryMovmentRecords"."companyId"
						from "InventoryMovmentRecords"
						JOIN "values" on true
                        WHERE "InventoryMovmentRecords"."companyId" = "values"."companyId"
                        AND ( "values"."branches" is null or  "InventoryMovmentRecords"."branchId"  = any("values"."branches") or ( "InventoryMovmentRecords"."branchId" is null  and "InventoryMovmentRecords"."companyId" =  "values"."companyId") )
                        AND ( "values"."fromDate"::timestamp is null or "InventoryMovmentRecords"."createdAt" >= "values"."fromDate")
                        AND  "InventoryMovmentRecords"."createdAt" < "values"."toDate"
                       AND "InventoryMovmentRecords"."referenceTable" NOT IN ( 'Billing','Supplier Credit' )
                    
			          )
					
					, "mainQuery" as(
						
						select   
						 "Accounts".id as "accountId",
                         "Accounts"."name" as "account",
                         "Accounts".code,
                         "Accounts".type,
                         "Accounts"."parentType",
						 case when "comparison" = true and array_length("values"."branches",1) >= 1 and "period" is null then "Branches".name::text 
						 else  "movments"."createdAt"::text end as "key",
						   sum(case when "costOFGoodSolds" < 0 then abs("costOFGoodSolds"::text::NUMERIC(30,5)) else 0 end) as "credit",
						   sum(case when "costOFGoodSolds" > 0 then abs("costOFGoodSolds"::text::NUMERIC(30,5)) else 0 end) as "debit", 
						   sum("costOFGoodSolds"::NUMERIC(30,5 )) as "balance"
						
					   from "movments"
					   JOIN "values" on true
					   INNER JOIN "Accounts" on "Accounts"."companyId" = "values"."companyId" and "Accounts"."name" = 'Costs Of Goods Sold' and "Accounts"."default" = true
					   INNER join "Branches" on "Branches".id ="movments"."branchId" 
					   AND "movments"."referenceTable" not in ('Supplier Credits','Billing','Opening Balance')  
				
                       group by "movments"."code",  "movments"."transactionId",	"comparison","key" ,"values"."branches",	  "movments"."referenceTable",  	 "Accounts".id ,  "movments"."createdAt" 
					 
						union all 
						select   
						 "Accounts".id as "accountId",
                         "Accounts"."name" as "account",
                         "Accounts".code,
                         "Accounts".type,
                         "Accounts"."parentType",
						 case when "comparison" = true and array_length("values"."branches",1) >= 1 and "period" is null then "Branches".name::text 
						 else  "movments"."createdAt"::text end as "key",
						   sum(case when "inventoryAssets" < 0 then abs("inventoryAssets"::text::NUMERIC(30,5)) else 0 end) as "credit",
						   sum(case when "inventoryAssets" > 0 then abs("inventoryAssets"::text::NUMERIC(30,5)) else 0 end) as "debit", 
						   sum("inventoryAssets"::NUMERIC(30,5)) as "balance"

					   from "movments"
					   JOIN "values" on true
					   INNER JOIN "Accounts" on "Accounts"."companyId" = "values"."companyId" and  "Accounts".name = 'Inventory Assets'    and "default" = true
					   INNER join "Branches" on "Branches".id ="movments"."branchId" 
                          where "movments"."referenceTable" not in ('Supplier Credits','Billing')  
                       group by "movments"."code",  "movments"."transactionId",	"comparison","key" ,"values"."branches",	  "movments"."referenceTable",  	 "Accounts".id ,  "movments"."createdAt" 
						union all 
                        select 
                        "Accounts".id as "accountId",
                        "Accounts"."name" as "account",
                        "Accounts".code,
                        "Accounts".type,
                        "Accounts"."parentType",
                        case when "comparison" = true and array_length("values"."branches",1) >= 1 and "period" is null then "Branches".name::text 
						     else  "JournalRecords"."createdAt"::text end as "key",
                       CASE WHEN  sum( "JournalRecords".amount::text::NUMERIC(30,5)) < 0 then ABS(sum( "JournalRecords".amount::text::NUMERIC(30,5)))
                    end as "credit",
                    CASE when sum( "JournalRecords".amount::text::NUMERIC(30,5)) > 0 then  sum( "JournalRecords".amount::text::NUMERIC(30,5))
                    end as "debit",
						 sum( "JournalRecords".amount::text::NUMERIC(30,5)) as "balance"
						from "Accounts"
                        JOIN "values" ON TRUE
                        inner join "JournalRecords" ON  "Accounts".id = "JournalRecords"."accountId" and "Accounts"."companyId" = "values"."companyId" and( array_length("values"."branches",1) IS NULL or "JournalRecords"."branchId" = any("values"."branches"))
        
						left join "Branches" on "Branches".id ="JournalRecords"."branchId"
                        inner join "Companies" on "Companies".id = "JournalRecords"."companyId"
                        WHERE "JournalRecords"."companyId" = "values"."companyId"
                    
						                         and     ("Accounts"."name" <>  'Inventory Assets'  or   ( "dbTable" not in ('Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment')))
						                         and     ("Accounts"."name" <> 'Costs Of Goods Sold' or   ( "dbTable" not in ('Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment')))

                        AND (( "asOf" = true and "period" is null and "JournalRecords"."createdAt" < "values"."toDate" )or 
							(( "asOf" = false or "period" is not null) and "JournalRecords"."createdAt" >= "values"."fromDate" and  "JournalRecords"."createdAt" < "values"."toDate" )
							)
                        group by "Accounts".id,"key"
                        )
						
						, "accounts" as (
						select 
						"accountId",
						"account",
						"code",
						"type",
						"parentType",
							case when "comparison" = true and "period" = 'Month' then to_char(DATE_TRUNC('Month',"key"::TIMESTAMP),'Mon/YYYY')
                             when "comparison" = true and "period" = 'Year' then to_char(DATE_TRUNC('year',"key"::TIMESTAMP),'YYYY') 
						     when "comparison" = true and array_length("values"."branches",1) > 1 then "key"
							 else ''
							 end as "columns",
                                sum("mainQuery"."debit") as "debit",
                             sum ("mainQuery"."credit") as "credit",
							   sum("mainQuery"."balance") as "balance"
							
          
						from "mainQuery"
                        JOIN "values" ON TRUE
					    group by "accountId",
						"account",
						"code",
						"type",
						"parentType","columns"
						)
						
						
					
						,"filters" as (
                    SELECT
                      CASE
                        WHEN "comparison" = true AND "values"."period" LIKE 'Year' THEN JSONB_AGG("columnName" ORDER BY "columnName")
                        WHEN "comparison" = true AND "values"."period" LIKE 'Month' THEN JSONB_AGG("columnName" ORDER BY TO_DATE("columnName", 'Mon/YYYY'))  FILTER (WHERE "columnName" ~ '^[A-Z][a-z]{2}/[0-9]{4}$') 
                        when "comparison" = true and array_length("values"."branches",1) >= 1  then JSONB_AGG("columnName" ORDER BY "columnName") 
                      END AS "columns"
                        FROM (
                          SELECT DISTINCT "columns" "columnName"
                    
                          FROM "accounts"
                            join "values" on true 
                        )t
							 join "values" on true
							group by 
							"values"."period",
							"comparison" ,
							"values"."branches"
			)
						select
					    "accountId",
						"account",
						"code",
						"type",
						"parentType",
					     case when "comparison" = true and "period" = 'Month' then  JSON_AGG(JSON_BUILD_OBJECT("accounts"."columns",JSON_BUILD_OBJECT('Net Debit',"debit",'Net Credit',"credit",'Balance',"balance")))
                                 when "comparison" = true and "period" = 'Year' then JSON_AGG(JSON_BUILD_OBJECT("accounts"."columns",JSON_BUILD_OBJECT('Net Debit',"debit",'Net Credit',"credit",'Balance',"balance")))
                                 when "comparison" = true and array_length("values"."branches",1) > 1 then JSON_AGG(JSON_BUILD_OBJECT("accounts"."columns",JSON_BUILD_OBJECT('Net Debit',"debit",'Net Credit',"credit",'Balance',"balance")))
                                 else  JSON_AGG(JSON_BUILD_OBJECT('Net Debit',"debit",'Net Credit',"credit",'Balance',"balance"))
                                 end as "summary",
                                 "filters"."columns"
						from "accounts"
						JOIN "values" ON TRUE
						JOIN "filters" ON TRUE 
						group by "accountId",
						 "accountId",
						"account",
						"code",
						"type",
						"parentType",
						"asOf",
						"comparison",
						"period",
						"values"."branches",
							 "filters"."columns"
							 order by    "account" asc  
                              `,
                values: [companyId, branches, period, NoOfperiod, comparison, from, to, asOf]
            }

            let records = await DB.excu.query(query.text, query.values);

            if (records.rows && records.rows.length > 0 && (<any>records.rows[0]).columns) {
                columns = (<any>records.rows[0]).columns
            }
            let subColumns = records.rows && records.rows.length && comparison ? ['Net Debit', 'Net Credit', 'Balance'] : []
            let resData = {
                records: records.rows,
                columns: columns,
                subColumns: subColumns
            }




            if (filter.export) {
                // records.rows = await XLSXGenerator.accontIndex(records.rows)
                // records.rows.sort((a: any, b: any) => (a.grandTypeIndex - b.grandTypeIndex|| a.parentTypeIndex - b.parentTypeIndex ) )
                let report = new ReportData()
                report.filter = {
                    title: "General Ledger Report",
                    fromDate: ((filter && filter.fromDate) || asOf != true) ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches, compareType: compareType,
                    period: period, periodQty: NoOfperiod
                }
                report.records = records.rows

                //get columns & subColumns

                resData.columns.forEach((col: any) => {
                    let childs: DataColumn[] = []
                    resData.subColumns.forEach((subcol: any) => childs.push({ key: subcol, properties: { columnType: 'currency' } }))
                    if (childs.length > 0) { report.columns.push({ key: col, childs: childs, properties: { hasTotal: true } }) }
                    else { report.columns.push({ key: col, properties: { hasTotal: true, columnType: 'currency' } }) }

                })

                report.columns = [...[{ key: 'account' }, { key: 'code', header: 'Account Code' }], ...report.columns]
                report.fileName = 'generalLedgerReport'
                return new ResponseData(true, "", report)

            } else {
                return new ResponseData(true, "", resData)
            }
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    public static async orphanedParentInfo(Ids: string[]) {
        try {
            const query = {

                text: `	select 
					distinct "Accounts".id as "accountId",
					"Accounts". name as "account",
					"Accounts"."code",
					"Accounts"."parentId" ,
					"Accounts"."type",
					"Accounts"."parentType",
					null as summary
                   from "Accounts"
				   where id  = any($1::uuid[])`,
                values: [Ids]
            }

            const records = await DB.excu.query(query.text, query.values);
            let res: any[] = []

            if (records.rows && records.rows.length > 0) {
                res = records.rows
            }

            return res

        } catch (error: any) {
            throw new Error(error)
        }
    }




    public static async balanceSheetReport(data: any, company: Company, branchList: []) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let branches = filter && filter.branches ? filter.branches : branchList;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : null;
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to

            //---------------------------------------




            let NoOfperiod = (filter && filter.periodQty) && (!filter.branches || (filter.branches && filter.branches.length <= 1)) ? filter.periodQty : null;
            let period = (filter && filter.period) && (!filter.branches || (filter.branches && filter.branches.length <= 1)) ? filter.period : null;


            let comparison = (period && NoOfperiod) || (branches.length > 1 && filter.branches && filter.branches.length > 1) ? true : null
            let columns = ["Total"]
            let asOf = filter.allowAsOf ?? false

            if (comparison == true && period) {
                asOf = false
            }

            let keyQuery = comparison == true ? (branches.length > 0 && period == null) ? ` "Branches"."name" as key ` :
                (period == 'Month') ? ` to_char("JournalRecords"."createdAt"::TIMESTAMP,'Mon/YYYY') as key` :
                    (period == 'Year') ? ` to_char("JournalRecords"."createdAt"::TIMESTAMP,'YYYY')  as key ` :
                        `'Total' as key,` : `'Total' as key`
            let movmentKeyQuery = comparison == true ? (branches.length > 0 && period == null) ? ` "Branches"."name" as key ` :
                (period == 'Month') ? ` to_char("movments"."createdAt"::TIMESTAMP,'Mon/YYYY') as key` :
                    (period == 'Year') ? ` to_char("movments"."createdAt"::TIMESTAMP,'YYYY')  as key ` :
                        `'Total' as key,` : `'Total' as key`
            let joinQuery = comparison == true && branches.length > 0 && period == null ? ` left join "Branches" on "Branches".id ="JournalRecords"."branchId" ` : ``
            let joinMovmentQuery = comparison == true && branches.length > 0 && period == null ? ` left join "Branches" on "Branches".id ="movments"."branchId" ` : ``


            let filterCTE = comparison == true && (branches.length > 0 || period == 'Month' || period == 'Year') ? period == 'Month' ? ` select array_agg("columns"  ORDER BY TO_DATE("columns", 'Mon/YYYY' ) ) as "columns"  from (select distinct "columns" from "Total" )T `
                : ` select  array_agg(distinct "columns") as "columns"  from "Total" `
                : `select null as "columns"  `

            if (!Array.isArray(branches) || branches.length == 0) { branches = null };


            // if (comparison == true && branches.length > 0 && period == null ){
            //      compareType = 'branch'
            //      keyQuery = ` "Branches"."name" as key, `
            // }
            // else if (comparison == true && period == 'Month' ){
            //      compareType = 'period'
            //      keyQuery = ` "Branches"."name" as key, `
            // }
            // else if (comparison == true && period == 'Year'){
            //      compareType = 'period'
            // }

            const query = {

                text: `with "values" as (
                    select  $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            array['Current Assets','Non Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity','Other Current Liabilities']::text[] as "types",
                            case when $5::boolean= true then null 
						  	when  $3::TEXT = 'Month' then $6::timestamp - interval '1 Months'* $4
                    		when  $3::TEXT = 'Year' then $6::timestamp - interval '1 Year'* $4
						    else $6::timestamp end as "fromDate",
                            $7::timestamp as "toDate"
                    ) 
                    ,"accountNutureList" as (
                    select * 
                    from ( values  ( 'Non Current Assets','Dr' ),
                        ( 'Current Assets','Dr' ), ( 'Other Current Assets','Dr' ),
                        ( 'Fixed Assets','Dr' ),( 'Operating Expense','Dr' ), ( 'Costs Of Goods Sold','Dr' ),
                        ( 'Income','Cr' ), ( 'Operating Income','Cr' ),( 'Long Term Liabilities','Cr' ),
                        ( 'Liabilities','Cr' ), ( 'Current Liabilities','Cr' ),( 'Equity','Cr' ) ,( 'Other Current Liabilities','Cr' ) 
                        ) as X( "parentType", "accountNature")		

                       ) ,"movments" as (

                                        select

                                                    "Accounts".id as "accountId",     
                                                    "Accounts".name as "account",     
                                                    "Accounts".code as "code", 
                                                    "Accounts"."parentId" ,    
                                                    "Accounts"."type" as "type",     
                                                    "Accounts"."parentType",     
                                                    "InventoryMovmentRecords"."branchId",
                                                    "InventoryMovmentRecords"."createdAt",
                                                    "InventoryMovmentRecords"."referenceTable" as "dbTable",
                                                     "InventoryMovmentRecords".qty::text::NUMERIC(30,5) * COALESCE(nullif("InventoryMovmentRecords"."cost"::text::NUMERIC(30,5),'NaN'),0 )  as "cost"

                                        from "InventoryMovmentRecords"
                                        inner join "values" on true
                                    INNER JOIN "Accounts" on "Accounts"."companyId" = "values"."companyId" and "name" = 'Inventory Assets' and "default" = true
                                    WHERE "InventoryMovmentRecords"."companyId" = "values"."companyId"
                               
                                    AND ( "values"."branches" is null or  "InventoryMovmentRecords"."branchId"  = any("values"."branches") or ( "InventoryMovmentRecords"."branchId" is null  and "InventoryMovmentRecords"."companyId" =  "values"."companyId") )
                                    AND ( "values"."fromDate"::timestamp is null or "InventoryMovmentRecords"."createdAt" >= "values"."fromDate")
                                    AND  "InventoryMovmentRecords"."createdAt" < "values"."toDate"  
                                       AND   "InventoryMovmentRecords"."referenceTable"  not in ('Supplier Credit','Billing')
                                        )

                    , "journals" as (
                        SELECT
                        "JournalRecords".amount::text::NUMERIC(30,5),
						"Accounts"."name" as "account",
						"Accounts"."code" as "code",
                        "Accounts"."parentId" ,
						"Accounts"."type" as "type",
                        "JournalRecords"."accountId",
                        "JournalRecords"."branchId",
                        "JournalRecords"."createdAt",
                         "JournalRecords"."dbTable",
                         "Accounts"."parentType",
						         ${keyQuery}
                        from "JournalRecords"
                        join "values" on true
						left join "Accounts" ON  "Accounts"."companyId"= "values"."companyId"  and  "Accounts".id = "JournalRecords"."accountId"   
                               ${joinQuery}
						WHERE "JournalRecords"."companyId" = "values"."companyId"   
                        AND "Accounts"."parentType" =  any(array['Non Current Assets','Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity','Other Current Liabilities'])

	  				    AND ( "values"."branches" is null or  "JournalRecords"."branchId"  = any("values"."branches") or ( "JournalRecords"."branchId" is null  and "JournalRecords"."companyId" =  "values"."companyId") )
                        AND ( "values"."fromDate"::timestamp is null or "JournalRecords"."createdAt" >= "values"."fromDate")
                        AND  "JournalRecords"."createdAt" < "values"."toDate"

                        and  ("Accounts".name <> 'Inventory Assets' or  "JournalRecords"."dbTable" not in ('Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment'))
                    
                
                        UNION ALL
                        select
                            "movments"."cost"::text::NUMERIC(30,5) as "amount",
                            "movments"."account",
                            "movments"."code",
                            "movments"."parentId" ,
                            "movments"."type",
                            "movments"."accountId",
                            "movments"."branchId",
                            "movments"."createdAt",
                            "movments"."dbTable",
                            "movments"."parentType",
						         ${movmentKeyQuery}
                        from "movments"
						       ${joinMovmentQuery}
                    

                    ),"accounts" as (
                    select "journals"."accountId",
                        "journals"."account",
                        "journals".code,
                        "journals"."parentId",
                        "journals".type,
                        "journals"."parentType",
                        "accountNutureList"."accountNature",
                        "key",
                        sum("amount"::text::NUMERIC(30,5)) as "total"
                    from "journals"
					left join "accountNutureList" ON "accountNutureList"."parentType" = "journals"."parentType"
                    group by "journals"."accountId",
                        "journals"."account",
                        "journals".code,
                        "journals"."parentId",
                        "journals".type,
                        "journals"."parentType",
                        "accountNutureList"."accountNature",
                        "key"
                    )

                    ,"Total" as (        select
                    "accountId",   "account",  "code", "parentId",   "type",   "parentType",   key as "columns",
                    case when "accountNature" = 'Dr' AND SUM(CASE WHEN "total" < 0 then "total" else 0 end ) > SUM(CASE WHEN "total" > 0 then "total" else 0 end ) then   SUM(COALESCE("total",0)) *(-1)
                        when "accountNature" = 'Cr' AND SUM(CASE WHEN "total" < 0 then "total" else 0 end ) < SUM(CASE WHEN "total" > 0 then "total" else 0 end ) then   SUM(COALESCE("total",0)) *(-1)
                        ELSE
                        SUM(COALESCE("total",0)::text::NUMERIC(30,5))
                        END AS "total"
                    from "accounts"
                    group by "accountId","account", "code", "parentId", "type","accountNature" ,"parentType","columns"
                    )
                    , "filters" as (  ${filterCTE} )  

                    select "accountId",   "account",  "code", "parentId",   "type",   "parentType",
                    "filters"."columns"  ,
                    JSON_AGG(JSON_BUILD_OBJECT("Total"."columns","total")) as "summary"
                    from "Total"
                    inner join "filters" on true
                    group by "accountId","account", "code", "parentId", "type", "parentType", "filters"."columns"
                    order by "parentType","type"
                      ` ,
                values: [companyId, branches, period, NoOfperiod, asOf, from, to]
            }

            let accounts: any[] = []

            const records = await DB.excu.query(query.text, query.values);
            const netProfit = await this.netProfitTotal2(data, company, asOf, branchList)


            if (records.rows && records.rows.length > 0) {
                columns = (<any>records.rows[0]).columns ?? ["Total"]

                accounts = records.rows
                const accountIds = accounts.map(acc => acc.accountId)
                const orphanedParentIds: string[] = Array.from(
                    new Set(
                        accounts
                            .filter(acc => acc.parentId && !accountIds.includes(acc.parentId))
                            .map(acc => acc.parentId)
                    )
                );

                if (orphanedParentIds.length > 0) {
                    const orphanedParentInfo = await this.orphanedParentInfo(orphanedParentIds) ?? []
                    accounts = [...accounts, ...orphanedParentInfo]
                }

                accounts.forEach(obj => { obj.level = obj.parentId ? 2 : 1; obj.parentId = obj.parentId ?? obj.accountId })

            }


            if (netProfit) {
                let retainedErning = accounts.find(f => f.account == 'Retained Earning')

                netProfit.forEach((element: any) => {
                    if (element.account == 'Net Profit' || (element.account == 'Current Year Net Profit' && asOf == true)) {
                        element.account = element.account == 'Net Profit' ? 'Retained Earning' : element.account
                        if (element.account == 'Retained Earning' && retainedErning) {
                            accounts.push(element)
                            const accountSum = this.buildCombinedRow(accounts, columns)
                            retainedErning.summary = accountSum.summary

                            const cleanedAccounts = accounts.filter(
                                acc => acc.account !== "Retained Earning"
                            );
                            cleanedAccounts.push(retainedErning)
                            accounts = cleanedAccounts
                        } else {
                            accounts.push(element)
                        }

                    }

                });
            }
            let resData = {
                records: accounts,
                columns: columns
            }

            if (filter.export) {
                accounts = await XLSXGenerator.accontIndex(accounts)
                accounts.sort((a: any, b: any) => {
                    if (a.grandType == 'Liabilities' || a.grandType == 'Equity') {
                        a.grandType = 'Liabilities and Equity';
                    }

                    const parentA = a.parentId ?? '';
                    const parentB = b.parentId ?? '';

                    return (
                        a.grandTypeIndex - b.grandTypeIndex ||
                        a.parentTypeIndex - b.parentTypeIndex ||
                        b.type.localeCompare(a.type) ||
                        parentA.localeCompare(parentB) ||
                        a.level - b.level
                    );
                });

                console.log(accounts)
                const profitName = 'Current Year Net Profit';
                const retainedName = 'Retained Earning';
                const normal: any[] = [];
                let currentYear: any | null = null;
                let retained: any | null = null;

                for (const acc of accounts) {
                    if (acc.account === profitName) {
                        currentYear = acc;
                    } else if (acc.account === retainedName) {
                        retained = acc;
                    } else {
                        normal.push(acc);
                    }
                }
                if (currentYear) normal.push(currentYear);
                if (retained) normal.push(retained);

                accounts = normal;
                let report = new ReportData()
                report.filter = {
                    title: "Balance Sheet",
                    fromDate: ((filter && filter.fromDate) || asOf != true) ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    //branches:branches, compareType: compareType,
                    period: period, periodQty: NoOfperiod
                }
                report.records = accounts

                resData.columns = resData.columns ?? ['Total']

                //get columns & subColumns
                resData.columns.forEach((col: any) => {
                    report.columns.push({ key: col, properties: { hasSubTotal: true, columnType: 'currency' } })
                })

                report.columns = [...[{ key: 'account' }, { key: 'code', header: 'Account Code' }], ...report.columns]


                // report.columns = [...[
                //     { key: 'parentType', properties: { groupBy: "horizantal" } },
                //     { key: 'type', properties: { groupBy: "horizantal" }  },
                //     { key: 'account' }, { key: 'code', header: 'Account Code' }], ...report.columns]


                report.fileName = 'BalanceSheet'
                return new ResponseData(true, "", report)

            } else {
                return new ResponseData(true, "", resData)
            }

        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    public static async netProfitTotal2(data: any, company: Company, asOf: boolean | null = null, branchList: []) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let branches = filter && filter.branches ? filter.branches : branchList;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : null;
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            const previousYearDate = moment(to).clone();

            const hour = previousYearDate.hour();
            const minute = previousYearDate.minute();
            const second = previousYearDate.second();

            const firstDateOfYear = moment(filter.toDate, 'YYYY-MM-DD')
                .startOf('year')
                .format('YYYY-MM-DD');

            let currentYearInterval = await TimeHelper.getReportTime(moment(firstDateOfYear), toDate, closingTime, false, timeOffset)
            let currentYearFrom = currentYearInterval.from;
            let currentYearTo = to;
            //---------------------------------------




            let NoOfperiod = (filter && filter.periodQty) && (!filter.branches || (filter.branches && filter.branches.length <= 1)) ? filter.periodQty : null;
            let period = (filter && filter.period) && (!filter.branches || (filter.branches && filter.branches.length <= 1)) ? filter.period : null;


            let comparison = (period && NoOfperiod) || (branches.length > 1 && filter.branches && filter.branches.length > 1) ? true : null
            let columns = ["Total"]
            let asOf = filter.allowAsOf ?? false

            if (comparison == true && period) {
                asOf = false
            }

            let keyQuery = comparison == true ? (branches.length > 0 && period == null) ? ` "Branches"."name" as key, ` :
                (period == 'Month') ? ` to_char("journals"."createdAt"::TIMESTAMP,'Mon/YYYY') as key,` :
                    (period == 'Year') ? ` to_char("journals"."createdAt"::TIMESTAMP,'YYYY')  as key, ` :
                        `'Total' as key,` : `'Total' as key,`

            let joinQuery = comparison == true && branches.length > 0 && period == null ? ` left join "Branches" on "Branches".id ="journals"."branchId" ` : ``
            let filterCTE = comparison == true && (branches.length > 0 || period == 'Month' || period == 'Year') ? period == 'Month' ? `select array_agg("columns"  ORDER BY TO_DATE("columns", 'Mon/YYYY' ) ) as "columns"  from (select distinct "columns" from "Total" )T `
                : ` select  array_agg(distinct "columns") as "columns"  from "Total" `
                : `select null as "columns"  `

            if (!Array.isArray(branches) || branches.length == 0) { branches = null };


            // if (comparison == true && branches.length > 0 && period == null ){
            //      compareType = 'branch'
            //      keyQuery = ` "Branches"."name" as key, `
            // }
            // else if (comparison == true && period == 'Month' ){
            //      compareType = 'period'
            //      keyQuery = ` "Branches"."name" as key, `
            // }
            // else if (comparison == true && period == 'Year'){
            //      compareType = 'period'
            // }

            const query = {

                text: `with "values" as (
                    select  $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            array['Operating Expense', 'Operating Income', 'Costs Of Goods Sold','Expense']::text[] as "types",
                    case when $5::boolean= true then null 
						  		 when  $3::TEXT = 'Month' then $6::timestamp - interval '1 Months'* $4
                    			 when  $3::TEXT = 'Year' then $6::timestamp - interval '1 Year'* $4
						        else $6::timestamp end as "fromDate",
                    $7::timestamp as "toDate"
                     ),"movments" as (

                                        select

                                                    "Accounts".id as "accountId",
                                                    "InventoryMovmentRecords"."branchId",
                                                    "InventoryMovmentRecords"."createdAt",
                                                    "InventoryMovmentRecords"."referenceTable" as "dbTable",
                                                    "InventoryMovmentRecords".qty::text::NUMERIC(30,5) * "InventoryMovmentRecords"."cost"::text::NUMERIC(30,5)  as "cost" ,
                                 "Accounts"."parentType"
                                        from "InventoryMovmentRecords"
                                        inner join "values" on true
                                    INNER JOIN "Accounts" on "Accounts"."companyId" = "values"."companyId" and "name" = 'Costs Of Goods Sold' and "default" = true  
                                    WHERE "InventoryMovmentRecords"."companyId" = "values"."companyId"
                                        AND ( "values"."branches" is null or  "InventoryMovmentRecords"."branchId"  = any("values"."branches") or ( "InventoryMovmentRecords"."branchId" is null  and "InventoryMovmentRecords"."companyId" =  "values"."companyId") )
                    AND ( "values"."fromDate"::timestamp is null or "InventoryMovmentRecords"."createdAt" >= "values"."fromDate")
                    AND  (  "InventoryMovmentRecords"."createdAt" < "values"."toDate" )
                                                                    AND "InventoryMovmentRecords"."referenceTable" NOT IN ( 'Opening Balance' , 'Billing','Supplier Credit' )


                                        )
                    , "journals" as (
                    SELECT
                        "JournalRecords".amount::text::NUMERIC(30,5) *(-1)  as   amount,
                        "JournalRecords"."accountId",
                        "JournalRecords"."branchId",
                        "JournalRecords"."createdAt",
                                                "JournalRecords"."dbTable",
                        "Accounts"."parentType"
                    from "JournalRecords"
                    join "values" on true
                        INNER JOIN "Accounts" on "Accounts"."companyId" = "values"."companyId"  and  "JournalRecords"."accountId" = "Accounts".id
                    WHERE "JournalRecords"."companyId" = "values"."companyId"
                    AND ( "values"."branches" is null or  "JournalRecords"."branchId"  = any("values"."branches") or ( "JournalRecords"."branchId" is null  and "JournalRecords"."companyId" =  "values"."companyId") )
                    AND ( "values"."fromDate"::timestamp is null or "JournalRecords"."createdAt" >= "values"."fromDate")
                    AND  ("JournalRecords"."createdAt" <  "values"."toDate")
                                        and  ("Accounts".name <> 'Costs Of Goods Sold' OR "dbTable" NOT in ('Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment'))
                                        and "Accounts"."parentType" =  any(array['Operating Expense', 'Operating Income', 'Costs Of Goods Sold','Expense']::text[] )

                    union all
                                        select "movments"."cost" as "amount",
                                                 "movments"."accountId",
                        "movments"."branchId",
                        "movments"."createdAt",
                                                "movments"."dbTable",
                        "parentType"
                                                from "movments"


                   
                  )
                    , "accounts" as (
                    select "parentType",

                         ${keyQuery}
                              case when   $5::boolean = true  then  SUM(COALESCE("journals".amount::text::NUMERIC(30,5),0)::NUMERIC) filter(where( $5::boolean = true and "journals"."createdAt" <  $8::timestamp )or ($5::boolean = false)) else SUM(COALESCE("journals".amount::text::NUMERIC(30,5),0)::NUMERIC) end as "total",
					         case when $5::boolean = true then  SUM(COALESCE("journals".amount::text::NUMERIC(30,5),0)::NUMERIC) filter(where $5::boolean = true and "journals"."createdAt" >=  $8::timestamp  and "journals"."createdAt" < $9 )  else  null end as "currentYearTotal"
                    from "journals"
                     ${joinQuery}
					GROUP BY   "parentType", key        
                    )

                    ,"Total" as (
                    select  key as "columns",
                            sum(case when "parentType"='Operating Income' then "total"::text::NUMERIC(30,5) else 0 end) +       sum(case when "parentType"='Costs Of Goods Sold'then "total"::text::NUMERIC(30,5) else 0 end) as "grossProfit",
                            (sum(case when "parentType"='Operating Income' then "total"::text::NUMERIC(30,5) else 0 end) +      sum(case when "parentType"='Costs Of Goods Sold'then "total"::text::NUMERIC(30,5) else 0 end)) +        sum(case when "parentType"='Operating Expense'then "total"::text::NUMERIC(30,5) else 0 end) as "netProfit",
						  (sum(case when "parentType"='Operating Income' then "currentYearTotal"::text::NUMERIC(30,5) else 0 end) +      sum(case when "parentType"='Costs Of Goods Sold'then "currentYearTotal"::text::NUMERIC(30,5) else 0 end)) +        sum(case when "parentType"='Operating Expense'then "currentYearTotal"::text::NUMERIC(30,5) else 0 end) as "currentYearnetProfit"

                    from "accounts"
                    group by "columns"
                    )
                      , "filters" as  (  ${filterCTE} )  




                   select   'Operating Profit' as "account",
                            'Operating Profit'     as "parentType",
                            'Operating Profit'     as "type",
                            JSON_AGG(JSON_BUILD_OBJECT("Total"."columns","netProfit")) FILTER (WHERE "Total"."columns" is not null)   as "summary"
                from "Total"

                union all
                select          'Gross Profit' as "account",
                            'Gross Profit'     as "parentType",
                            'Gross Profit'     as "type",
                            JSON_AGG(JSON_BUILD_OBJECT("Total"."columns","grossProfit")) FILTER (WHERE "Total"."columns" is not null)   as "summary"
                from "Total"
                               union all
                   select          'Current Year Net Profit' as "account",
                            'Equity'     as "parentType",
                            'Equity'     as "type",
                            JSON_AGG(JSON_BUILD_OBJECT("Total"."columns","currentYearnetProfit")) FILTER (WHERE "Total"."columns" is not null)   as "summary"
                from "Total"
                union all
                   select          'Net Profit' as "account",
                            'Equity'     as "parentType",
                            'Equity'     as "type",
                            JSON_AGG(JSON_BUILD_OBJECT("Total"."columns","netProfit")) FILTER (WHERE "Total"."columns" is not null)   as "summary"
                from "Total"
				 
				
				
				
				
                      ` ,
                values: [companyId, branches, period, NoOfperiod, asOf, from, to, currentYearFrom, currentYearTo]
            }
            console.log(query.text, query.values)
            const reports = await DB.excu.query(query.text, query.values);

            let accounts = reports.rows && reports.rows.length > 0 ? reports.rows : null

            return accounts

        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    public static async getProfitAndLossReport(data: any, company: Company, branchList: []) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let branches = filter && filter.branches ? filter.branches : branchList;

            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : null;
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to

            //---------------------------------------




            let NoOfperiod = (filter && filter.periodQty) && (!filter.branches || (filter.branches && filter.branches.length <= 1)) ? filter.periodQty : null;
            let period = (filter && filter.period) && (!filter.branches || (filter.branches && filter.branches.length <= 1)) ? filter.period : null;


            let comparison = (period && NoOfperiod) || (branches.length > 1 && filter.branches && filter.branches.length > 1) ? true : null
            let columns = ["Total"]
            let asOf = filter.allowAsOf ?? false

            if (comparison == true && period) {
                asOf = false
            }

            let keyQuery = comparison == true ? (branches.length > 0 && period == null) ? ` "Branches"."name" as key, ` :
                (period == 'Month') ? ` to_char("JournalRecords"."createdAt"::TIMESTAMP,'Mon/YYYY') as key,` :
                    (period == 'Year') ? ` to_char("JournalRecords"."createdAt"::TIMESTAMP,'YYYY')  as key, ` :
                        `'Total' as key,` : `'Total' as key,`
            let movmentKeyQuery = comparison == true ? (branches.length > 0 && period == null) ? ` "Branches"."name" as key, ` :
                (period == 'Month') ? ` to_char("movments"."createdAt"::TIMESTAMP,'Mon/YYYY') as key,` :
                    (period == 'Year') ? ` to_char("movments"."createdAt"::TIMESTAMP,'YYYY')  as key, ` :
                        `'Total' as key,` : `'Total' as key,`
            let joinQuery = comparison == true && branches.length > 0 && period == null ? ` left join "Branches" on "Branches".id ="JournalRecords"."branchId" ` : ``
            let movmentJoinQuery = comparison == true && branches.length > 0 && period == null ? ` left join "Branches" on "Branches".id ="movments"."branchId" ` : ``


            let filterCTE = comparison == true && (branches.length > 0 || period == 'Month' || period == 'Year') ? period == 'Month' ? `select array_agg("columns"  ORDER BY TO_DATE("columns", 'Mon/YYYY' ) ) as "columns"  from (select distinct "columns" from "Total" )T  `
                : ` select  array_agg(distinct "columns") as "columns"  from "Total" `
                : `select null as "columns"  `

            if (!Array.isArray(branches) || branches.length == 0) { branches = null };

            // from = asOf ? null : from
            // if (comparison == true && branches.length > 0 && period == null ){
            //      compareType = 'branch'
            //      keyQuery = ` "Branches"."name" as key, `
            // }
            // else if (comparison == true && period == 'Month' ){
            //      compareType = 'period'
            //      keyQuery = ` "Branches"."name" as key, `
            // }
            // else if (comparison == true && period == 'Year'){
            //      compareType = 'period'
            // }



            const query = {

                text: `with "values" as (
                    select  $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            array['Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity']::text[] as "types",
                    case when $5::boolean= true then null 
						  		 when  $3::TEXT = 'Month' then $6::timestamp - interval '1 Months'* $4
                    			 when  $3::TEXT = 'Year' then $6::timestamp - interval '1 Year'* $4
						        else $6::timestamp end as "fromDate",
                    $7::timestamp as "toDate"
                      )  ,"movments" as (
					
				  	select  
						    "Accounts".id as "accountId",     
                            "Accounts".name as "account",     
                            "Accounts".code as "code",   
                            "Accounts"."parentId" ,      
                            "Accounts"."type" as "type",      
                            "Accounts"."parentType",
                            "InventoryMovmentRecords"."branchId",
                            "InventoryMovmentRecords"."createdAt",
						    "InventoryMovmentRecords"."referenceTable" as "dbTable",
						    ( "InventoryMovmentRecords".qty::text::NUMERIC(30,5) *  COALESCE(nullif("InventoryMovmentRecords"."cost"::text::NUMERIC(30,5),'NaN'),0 ))*-1 as  "cost"   
                                            
					from "InventoryMovmentRecords" 
					inner join "values" on true
				    INNER JOIN "Accounts" on "Accounts"."companyId" = "values"."companyId" and "name" = 'Costs Of Goods Sold' and "default" = true
				    WHERE "InventoryMovmentRecords"."companyId" = "values"."companyId"
				    AND ( "values"."branches" is null or  "InventoryMovmentRecords"."branchId"  = any("values"."branches") or ( "InventoryMovmentRecords"."branchId" is null  and "InventoryMovmentRecords"."companyId" =  "values"."companyId") )
                    AND ( "values"."fromDate"::timestamp is null or "InventoryMovmentRecords"."createdAt" >= "values"."fromDate")
                    AND  "InventoryMovmentRecords"."createdAt" < "values"."toDate"
                    AND "InventoryMovmentRecords"."referenceTable" NOT IN ( 'Opening Balance' , 'Billing','Supplier Credit' )
		
           
					)                               
                     , "journals" as (
                        SELECT 
                        "JournalRecords".amount::text::NUMERIC(30,5)  as amount,
                        "Accounts"."name" as "account",       
                        "Accounts"."code" as "code",
                        "Accounts"."parentId" , 
                        "Accounts"."type" as "type",
                        "JournalRecords"."accountId",
                        "JournalRecords"."branchId",
                        "JournalRecords"."createdAt",
                         "JournalRecords"."dbTable",
						        ${keyQuery}
                         "Accounts"."parentType"
                  
                        from "JournalRecords"
                        join "values" on true
						INNER JOIN "Accounts" on "Accounts"."companyId" = "values"."companyId"  and  "JournalRecords"."accountId" = "Accounts".id
                        ${joinQuery}
						 WHERE "JournalRecords"."companyId" = "values"."companyId"
                         AND ( "values"."branches" is null or  "JournalRecords"."branchId"  = any("values"."branches") or ( "JournalRecords"."branchId" is null  and "JournalRecords"."companyId" =  "values"."companyId") )
                        AND ( "values"."fromDate"::timestamp is null or "JournalRecords"."createdAt" >= "values"."fromDate")
                         AND  "JournalRecords"."createdAt" < "values"."toDate"
                         						AND "Accounts"."parentType" =  any(array['Operating Expense', 'Operating Income', 'Costs Of Goods Sold','Expense'])

                        and  ("Accounts".name <> 'Costs Of Goods Sold' or "dbTable" not in ('Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment'))
                    
                          UNION ALL 
                        select 
                            "movments"."cost" as "amount",
                            "movments"."account",
                            "movments"."code",
                            "movments"."parentId" , 
                            "movments"."type",
                            "movments"."accountId",
                            "movments"."branchId",
                            "movments"."createdAt",
                            "movments"."dbTable",
						       ${movmentKeyQuery}
                            "movments"."parentType"
                                
                        from "movments"
						       ${movmentJoinQuery}
                       
                        
                    )
                    ,"accounts" as (
                    select  "journals"."accountId",
                        "journals"."account",
                        "journals".code,
                        "journals"."parentId" , 
                        "journals".type,
                        "journals"."parentType", 
                        "key",
                        sum("amount"::text::NUMERIC(30,5) * (-1)) as "total"
                    from "journals"
                    group by  "journals"."accountId",
                        "journals"."account",
                        "journals".code,
                        "journals"."parentId" , 
                        "journals".type,
                        "journals"."parentType", 
                        "key"
                    )
                                                
                    ,"Total" as (	 select 
                    "accountId",   "account",  "code", "parentId",  "type",   "parentType",   key as "columns",
                    sum(total) as "total"
                    from "accounts"
                    group by "accountId","account",	"code", "parentId", "type","parentType","columns"
                    ) 
                    , "filters" as (  ${filterCTE}  )  

                    select "accountId",   "account",  "code", "parentId",   "type",   "parentType", 
                    "filters"."columns"  ,
                    JSON_AGG(JSON_BUILD_OBJECT("Total"."columns","total")) as "summary"
                    from "Total"
                    inner join "filters" on true
                    group by "accountId","account", "code", "parentId", "type", "parentType", "filters"."columns"
                    order by "parentType","type"
                      ` ,
                values: [companyId, branches, period, NoOfperiod, asOf, from, to]
            }





            let accounts: any[] = []

            const records = await DB.excu.query(query.text, query.values);
            const netProfit = await this.netProfitTotal2(data, company, null, branchList)

            if (records.rows && records.rows.length > 0) {
                columns = (<any>records.rows[0]).columns ?? columns

                accounts = records.rows

                const accountIds = accounts.map(acc => acc.accountId)
                const orphanedParentIds: string[] = Array.from(
                    new Set(
                        accounts
                            .filter(acc => acc.parentId && !accountIds.includes(acc.parentId))
                            .map(acc => acc.parentId)
                    )
                );

                if (orphanedParentIds.length > 0) {
                    const orphanedParentInfo = await this.orphanedParentInfo(orphanedParentIds) ?? []
                    accounts = [...accounts, ...orphanedParentInfo]
                }

                accounts.forEach(obj => { obj.level = obj.parentId ? 2 : 1; obj.parentId = obj.parentId ?? obj.accountId })
            }
            if (netProfit) {
                netProfit.forEach(element => {
                    if (element.account != 'Current Year Net Profit')
                        accounts.push(element)

                });
            }


            let resData = {
                records: accounts,
                columns: columns
            }

            if (filter.export) {
                accounts = await XLSXGenerator.accontIndex(accounts)
                accounts.sort((a: any, b: any) => (a.grandTypeIndex - b.grandTypeIndex || a.parentTypeIndex - b.parentTypeIndex || b.type.localeCompare(a.type) || a.parentId.localeCompare(b.parentId) || a.level - b.level)
                )
                let report = new ReportData()
                report.filter = {
                    title: "Profit and Loss",
                    fromDate: ((filter && filter.fromDate) || asOf != true) ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches,

                    //   compareType: compareType,
                    period: period, periodQty: NoOfperiod
                }
                report.records = accounts

                //get columns & subColumns
                resData.columns.forEach((col: any) => {
                    report.columns.push({ key: col, properties: { hasSubTotal: true, columnType: 'currency' } })
                })

                report.columns = [...[{ key: 'account' }, { key: 'code', header: 'Account Code' }], ...report.columns]
                report.fileName = 'ProfitAndLoss'

                return new ResponseData(true, "", report)

            } else {
                return new ResponseData(true, "", resData)
            }
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }



    public static buildCombinedRow(rows: any[], columns: any[]) {
        const targetAccounts = new Set(["Retained Earning"]);

        const result: any = {};
        columns.forEach(k => result[k] = 0);

        for (const row of rows) {
            if (!targetAccounts.has(row.account)) continue;

            for (const item of row.summary) {
                for (const key of columns) {
                    result[key] += Number(item[key] || 0);
                }
            }
        }
        let summary: any[] = Object.keys(result).map((key, index) => ({
            [key]: result[key]
        }));
        return {
            account: "netProfit+re",
            summary: summary
        };
    }
}


