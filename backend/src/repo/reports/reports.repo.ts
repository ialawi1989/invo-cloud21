import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";

import { Helper } from "@src/utilts/helper";
import { TimeHelper } from "@src/utilts/timeHelper";
import { Company } from "@src/models/admin/company";
import { Account } from "@src/models/account/Account";
import { ValidationException } from '@src/utilts/Exception';
import moment, { Moment } from 'moment'
import { PoolClient } from "pg";

import { createObjectCsvWriter } from 'csv-writer';


import { DataColumn, ReportData } from "@src/utilts/xlsxGenerator";
import { AccountsRepo } from "../app/accounts/account.repo";
import _ from "lodash";
import { DiscountRepo } from "../app/accounts/discount.repo";
import { BranchesRepo } from "../admin/branches.repo";
import { CompanyRepo } from "../admin/company.repo";

export class ReportRepo {


    // public static async getBalanceSheet(data: any, company: Company,branches:[]) {
    //     const client = await DB.excu.client()
    //     try {
    //         const companyId = company.id;
    //         const afterDecimal = company.afterDecimal
    //         const accountTypes = ['Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity']
    //         let values;
    //         let query;
    //         let to: any = new Date(data.interval.to)
    //         let from = data.interval.from ? data.interval.from : null
    //         if (from != null) {
    //             from = await TimeHelper.resetHours(from)
    //         }


    //         await client.query("BEGIN");
    //         to = moment(to).add(1, 'day').format("YYYY-MM-DD 00:00:00");

    //         const queryText = `SELECT 
    //                             "Accounts".id as "accountId",
    //                             "Accounts"."name" as "account",
    //                             "Accounts".code,
    //                             "Accounts".type,
    //                             "Accounts"."parentType",
    //                             sum(COALESCE(case when "JournalRecords".amount <0 then "JournalRecords".amount end ,0)::NUMERIC )as "credit",
    //                             sum(COALESCE(case when "JournalRecords".amount >0 then "JournalRecords".amount end,0 )::NUMERIC ) as "debit",
    //                              SUM(COALESCE("JournalRecords".amount,0)::NUMERIC)as "total"
    //                        from "JournalRecords"
    //                         LEFT join "Accounts"
    //                         ON  "Accounts".id = "JournalRecords"."accountId" `


    //         let filterText = `         WHERE "Accounts"."companyId" = $1 AND (("JournalRecords"."branchId" = any($2) ) or("JournalRecords"."branchId" is null and "JournalRecords"."companyId"=$1))
    //         AND "Accounts"."parentType" = any($3) `
    //         const branchId = data.branchId !="" && data.branchId != null ? [data.branchId] : branches;

    //         if (from != null) {
    //             filterText += ` AND "JournalRecords"."createdAt" >= $4 AND  "JournalRecords"."createdAt" <$5 `
    //             values = [companyId,branchId, accountTypes, from, to]
    //         } else {
    //             filterText += ` AND  "JournalRecords"."createdAt" <$4 `
    //             values = [companyId,branchId, accountTypes, to]
    //         }
    //         const groupBy = `GROUP BY  "Accounts".id`

    //         console.log(branches)
    //         if (data.branchId != "" && data.branchId != null) {

    //             filterText = ` 
    //         WHERE "Accounts"."companyId" = $1
    //         AND( ("JournalRecords"."branchId" = any($2) ) or("JournalRecords"."branchId" is null and "JournalRecords"."companyId"=$1) )
    //         AND "Accounts"."parentType" = any($3)`
    //             if (from != null) {
    //                 filterText += ` AND "JournalRecords"."createdAt" >= $4 AND  "JournalRecords"."createdAt" <$5 `
    //                 values = [companyId, branchId, accountTypes, from, to]
    //             } else {
    //                 filterText += ` AND "JournalRecords"."createdAt" <$4 `
    //                 values = [companyId, data.branchId, accountTypes, to]
    //             }
    //         }
    //         query = queryText + filterText + groupBy


    //         const reports: any = (await client.query(query, values)).rows
    //         for (let index = 0; index < reports.length; index++) {
    //             const element: any = reports[index];
    //             let account = new Account()
    //             account.ParseJson(element);
    //             account.setAccountNature();

    //             if (account.accountNature == 'Dr') {
    //                 if (Number(element.debit) < Number(element.credit)) {
    //                     reports[index].total = reports[index].total * (-1)
    //                 }
    //             } else {
    //                 if (Number(element.debit) > Number(element.credit)) {
    //                     reports[index].total = reports[index].total * (-1)
    //                 }
    //             }
    //             // if (account.accountNature == 'Dr') {
    //             //     // if (Number(element.debit) < Number(element.credit) ) {
    //             //     //     reports[index].total = reports[index].total * (-1)
    //             //     // }

    //             //     if(element.total<0)
    //             //     {
    //             //         reports[index].total = reports[index].total * (-1)
    //             //     }
    //             // } else {
    //             //     // if (Number(element.debit) > Number(element.credit) ) {
    //             //     //     reports[index].total = reports[index].total * (-1)
    //             //     // }

    //             //     // if(element.total<0)
    //             //     // {
    //             //     //     reports[index].total = reports[index].total * (-1)
    //             //     // }else{
    //             //     //     reports[index].total = reports[index].total * (-1) 
    //             //     // }

    //             //     reports[index].total = reports[index].total * (-1) 
    //             // }
    //         }
    //         const netProfitTotal = (await this.getNetProfitTotal(client, data.interval.from, data.interval.to, data.branchId, company)).data
    //         await client.query("COMMIT");
    //         let netProfit: any
    //         if (netProfitTotal != null) {
    //             netProfit = {
    //                 total: netProfitTotal,
    //                 parentType: "Equity",
    //                 code: "",
    //                 type: "Equity",
    //                 account: "Net Profit"
    //             }
    //         }
    //         reports.push(netProfit);
    //         return new ResponseData(true, "", reports);
    //     } catch (error: any) {
    //         await client.query("ROLLBACK");

    //       
    //         throw new Error(error)
    //     } finally {
    //         client.release()
    //     }
    // }



    public static async getBalanceSheet(data: any, company: Company, brancheList: []) {

        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal
            const branches = data.branchId ? [data.branchId] : brancheList
            const accountTypes = ['Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity', 'Other Current Liabilities']
            let values;

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



            const query = {
                text: `with "journals" as (
                                    SELECT 
                                    "JournalRecords".amount::text::NUMERIC,
                                    "JournalRecords"."accountId"
                                    from "JournalRecords"
                                    WHERE "JournalRecords"."companyId" = $1
                                    AND ( $2::uuid[] is null or  "JournalRecords"."branchId"  = any($2) or ( "JournalRecords"."branchId" is null  and "JournalRecords"."companyId" = $1) )
                                    AND ($3::timestamp is null or "JournalRecords"."createdAt" >= $3)
                                    AND  "JournalRecords"."createdAt" <$4 

                                    )


                                    SELECT 
                                "Accounts".id as "accountId",
                                "Accounts"."name" as "account",
                                "Accounts".code,
                                "Accounts".type,
                                "Accounts"."parentType",
                                sum(COALESCE(case when "journals".amount <0 then "journals".amount::text::NUMERIC end ,0) )as "credit",
                                sum(COALESCE(case when "journals".amount >0 then "journals".amount::text::NUMERIC end,0 ) ) as "debit",
                                 SUM(COALESCE("journals".amount::text::NUMERIC,0)::NUMERIC)as "total"
                           from "journals"
                            LEFT join "Accounts"
                            ON  "Accounts".id = "journals"."accountId" 
                               where "Accounts"."parentType" = any($5)
							GROUP BY  "Accounts".id`,
                values: [companyId, branches, from, to, accountTypes]
            }


            const reports: any = (await DB.excu.query(query.text, values)).rows
            for (let index = 0; index < reports.length; index++) {
                const element: any = reports[index];
                let account = new Account()
                account.ParseJson(element);
                account.setAccountNature();

                if (account.accountNature == 'Dr') {
                    if (Number(element.debit) < Number(element.credit)) {
                        reports[index].total = reports[index].total * (-1)
                    }
                } else {
                    if (Number(element.debit) > Number(element.credit)) {
                        reports[index].total = reports[index].total * (-1)
                    }
                }
                // if (account.accountNature == 'Dr') {
                //     // if (Number(element.debit) < Number(element.credit) ) {
                //     //     reports[index].total = reports[index].total * (-1)
                //     // }

                //     if(element.total<0)
                //     {
                //         reports[index].total = reports[index].total * (-1)
                //     }
                // } else {
                //     // if (Number(element.debit) > Number(element.credit) ) {
                //     //     reports[index].total = reports[index].total * (-1)
                //     // }

                //     // if(element.total<0)
                //     // {
                //     //     reports[index].total = reports[index].total * (-1)
                //     // }else{
                //     //     reports[index].total = reports[index].total * (-1) 
                //     // }

                //     reports[index].total = reports[index].total * (-1) 
                // }
            }
            const netProfitTotal = (await this.getNetProfitTotal(data.interval.from, data.interval.to, branches, company)).data

            let netProfit: any
            if (netProfitTotal != null) {
                netProfit = {
                    total: netProfitTotal,
                    parentType: "Equity",
                    code: "",
                    type: "Equity",
                    account: "Net Profit"
                }
            }
            reports.push(netProfit);
            return new ResponseData(true, "", reports);
        } catch (error: any) {


          
            throw new Error(error)
        }
    }

    public static async calculateProfits(branchId: string, to: any, companyId: string, afterDecimal: number, from: String | Moment | Date | null = null) {

        try {
            //netProfit when [from - to] interval = opening Balnace + closing Balance
            //netProfit when AS OF = 0 + closing Balance
            let data: any = [];

            if (to != null && from != null) {
                data = await this.calculateNetprofitInAgivingInterval(branchId, companyId, to, from, afterDecimal)
            }

            if (from == null) {
                data = await this.calculateProfitonGivingDate(branchId, companyId, to, afterDecimal)
            }
            let incomeTotal = 0;
            let expenceTotal = 0;
            let costOfGoodSoldTotal = 0;
            let netProfit = 0;
            let grossProfit = 0;
            for (let index = 0; index < data.length; index++) {
                const account: any = data[index];
                await Helper.roundNumbers(afterDecimal, data[index])
                if (account.parentType == "Operating Expense") {
                    account.total = account.total > 0 ? account.total * (-1) : account.total

                    expenceTotal += account.total;
                } else if (account.parentType == "Operating Income" && account.type != "Discount" && account.type != "Rounding") {
                    account.total = account.total < 0 ? Math.abs(account.total) : account.total

                    incomeTotal += account.total;
                } else if (account.parentType == "Operating Income" && account.type == "Discount") {
                    account.total = account.total > 0 ? account.total * (-1) : account.total

                    incomeTotal += account.total;
                } else if (account.parentType == "Operating Income" && account.type == "Rounding") {
                    account.total = account.total < 0 ? Math.abs(account.total) : account.total

                    incomeTotal += account.total
                } else {

                    account.total = account.total > 0 ? account.total * (-1) : account.total
                    costOfGoodSoldTotal += account.total;
                }

            }

            grossProfit = Helper.add(incomeTotal, costOfGoodSoldTotal, afterDecimal);
            netProfit = Helper.add(grossProfit, (expenceTotal), afterDecimal);
            const operatingProfit = 0;
            return {
                data: data,
                netProfit: netProfit,
                grossProfit: grossProfit,
                operatingProfit: operatingProfit
            }




        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async calculateNetprofitInAgivingInterval(branchId: string, companyId: string, to: any, from: any, afterDecimal: number) {

        try {

            const accountTypes: any[string] = ['Operating Expense', 'Operating Income', 'Costs Of Goods Sold']
            const query: { text: string, values: any } = {
                text: `SELECT 
                "Accounts".name as "account",
                "Accounts".id as "accountId",
                "Accounts".type,
                "Accounts"."parentType",
                SUM(COALESCE("JournalRecords".amount,0)) as "total"
                from "JournalRecords"
                LEFT join "Accounts" 
                ON  "Accounts".id = "JournalRecords"."accountId"
                AND("JournalRecords"."companyId"=$1)
                And ("JournalRecords"."createdAt">=$2 AND "JournalRecords"."createdAt"<$3)
                WHERE "Accounts"."companyId" = $1
                AND "Accounts"."parentType" = any($4)
                GROUP BY  "Accounts".id`,

                values: [companyId, from, to, accountTypes]
            }

            if (branchId != null && branchId != "") {
                query.text = `SELECT 
                "Accounts".name as "account",
                "Accounts".id as "accountId",
                "Accounts".type,
                "Accounts"."parentType",
                SUM(COALESCE("JournalRecords".amount,0)) as "total"
                from "JournalRecords"
                LEFT join "Accounts" 
                ON  "Accounts".id = "JournalRecords"."accountId"
                AND ( ("JournalRecords"."branchId" =$1) or("JournalRecords"."branchId" =$4))
                And ("JournalRecords"."createdAt">=$2 AND "JournalRecords"."createdAt"<$3)
                WHERE "Accounts"."companyId" = $4
                AND "Accounts"."parentType" = any($5)
                GROUP BY  "Accounts".id`

                query.values = [branchId, from, to, companyId, accountTypes]
            }

            const data = await DB.excu.query(query.text, query.values);
            await Helper.roundNumbers(afterDecimal, data.rows)
            return data.rows;

        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async calculateProfitonGivingDate(branchId: string, companyId: string, to: Date, afterDecimal: number) {
        try {


            const accountTypes: any[string] = ["Operating Expense", "Operating Income", "Costs Of Goods Sold"]

            const query: { text: string, values: any } = {
                text: `SELECT 
                "Accounts".type,
                "Accounts"."parentType",
                SUM(COALESCE("JournalRecords".amount,0)) as "total"
                    from "JournalRecords"
                    LEFT join "Accounts" 
                    ON  "Accounts".id = "JournalRecords"."accountId"
                    AND "JournalRecords"."companyId"=$1
                    And "JournalRecords"."createdAt"<$2 
                    WHERE "Accounts"."companyId" = $1
                    AND "Accounts"."parentType" = any($3)
                    GROUP BY  "Accounts".id`,
                values: [companyId, to, accountTypes]
            }

            if (branchId != null && branchId != "") {
                query.text = `SELECT 
                        "Accounts".type,
                        "Accounts"."parentType",
                        SUM(COALESCE("JournalRecords".amount,0)) "total"
                from "JournalRecords"
                LEFT join "Accounts" 
                ON  "Accounts".id = "JournalRecords"."accountId"
                AND ( ("JournalRecords"."branchId" =$1) or("JournalRecords"."branchId" =$3))
                And "JournalRecords"."createdAt"<$2 
                WHERE "Accounts"."companyId" = $3
                AND "Accounts"."parentType" = any($4)
                GROUP BY  "Accounts".id`
                query.values = [branchId, to, companyId, accountTypes]
            }
            const data = await DB.excu.query(query.text, query.values);
            await Helper.roundNumbers(afterDecimal, data.rows)
            return data.rows;

        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }



    /** NOTE : in profit and loss report all accounts returned with oppsit sign if dr -> (-) if cr -> (+)
     * therefore the equation of  grossprofit = income + cogs
     *                            netProfit = grossprofit + expenses 
     * 
     */
    public static async profitAndLoss(data: any, company: Company, branchList: []) {
        const client = await DB.excu.client();

        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal
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


            await client.query("BEGIN")

            let branches = data.branchId != "" && data.branchId != null ? [data.branchId] : branchList
            let records = (await this.getProfitAndLossReportRecords(from, to, branches, company)).data;
            let netProfitSummary = await this.getNetProfitSummary(from, to, branches, company);
            let incomeTotal = netProfitSummary.data.incomeTotal;
            let costOfGoodSoldTotal = netProfitSummary.data.costOfGoodSoldTotal;
            let expenceTotal = netProfitSummary.data.expenceTotal;


            let grossProfit = Helper.add(Number(incomeTotal), Number(costOfGoodSoldTotal), afterDecimal);
            let netProfit = Helper.add(Number(grossProfit), Number(expenceTotal), afterDecimal);
            let operatingProfit = netProfit;

            let netProfitRecord = {
                total: netProfit == null ? 0 : netProfit,
                parentType: "",
                code: "",
                type: "Net Profit",
                account: "Net Profit / Loss"
            }

            let grossProfitRecord = {
                total: grossProfit == null ? 0 : grossProfit,
                parentType: "",
                code: "",
                type: "Gross Profit",
                account: "Gross Profit"
            }

            let operatingProfitRecord = {
                total: operatingProfit == null ? 0 : operatingProfit,
                parentType: "",
                code: "",
                type: "Operating Profit",
                account: "Operating Profit"
            }


            records.push(netProfitRecord);
            records.push(grossProfitRecord);
            records.push(operatingProfitRecord);
            await client.query("COMMIT")

            return new ResponseData(true, "", records)
        } catch (error: any) {
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }
    // public static async getNetProfitSummary(client: PoolClient, from: Date | null, to: Date, branchId: string | null, company: Company) {
    //     try {


    //         let accountTypes = ['Operating Expense', 'Operating Income', 'Costs Of Goods Sold']
    //         let filterId = branchId != null && branchId != "" ? branchId : company.id;
    //         let filterQuery = branchId != null && branchId != "" ? ` Where  "JournalRecords"."branchId" =$1` : ` Where  "JournalRecords"."companyId" =$1`;
    //         filterQuery += from == null ? ` AND "JournalRecords"."createdAt" < $2` : ` AND    "JournalRecords"."createdAt">= $2 and "JournalRecords"."createdAt"< $3`
    //         filterQuery += from == null ? ` AND  "Accounts"."parentType" = ANY($3) ` : ` AND  "Accounts"."parentType" = ANY($4) `
    //         let groupBy = '    group by "Accounts".id '

    //         let selectQuery = `   with "journals" as (select
    //                                                 sum(amount::numeric) as "amount",
    //                                                 "Accounts"."parentType",
    //                                                 "Accounts"."type"
    //                                                 from "JournalRecords" 
    //                                                 left join "Accounts" ON "JournalRecords"."accountId" = "Accounts".id
    //                                  `
    //         selectQuery += filterQuery + groupBy

    //         let sumOfTotalsQuery = `), "totals" as (
    //                               select 
    //                         case when  "journals"."parentType" = 'Operating Expense' then 
    //                         case when sum("journals".amount::numeric)> 0 then sum("journals".amount::numeric) * -1 else sum("journals".amount::numeric) end end  as "expenceTotal",
    //                          case when "journals"."parentType" = 'Operating Income' and "journals"."type" <>'Discount' and  "journals"."type" <>'Rounding'   then
    //                             case when sum("journals".amount::numeric) < 0 then abs(sum("journals".amount::numeric)) else sum("journals".amount::numeric) end
    //                         else
    //                         case when "journals"."parentType" = 'Operating Income' and "journals"."type"='Discount' then 
    //                         case when sum("journals".amount::numeric) >0 then sum("journals".amount::numeric) *(-1) else sum("journals".amount::numeric) end 
    //                         else
    //                         case when "journals"."parentType" = 'Operating Income' and "journals"."type"='Rounding' then 
    //                         case when sum("journals".amount::numeric) >0 then sum("journals".amount::numeric) *(-1) else sum("journals".amount::numeric) end 
    //                         end
    //                         end
    //                         end  as "incomeTotal",
    //                         case when "journals"."parentType" ='Costs Of Goods Sold' then
    //                          case when sum("journals".amount::numeric) > 0 then sum("journals".amount::numeric) *(-1) else sum("journals".amount::numeric) end
    //                          end  as "costOfGoodSoldTotal"
    //                             from "journals"
    //                             group by  "journals"."parentType","journals"."type" )

    //                             select sum ("costOfGoodSoldTotal"::numeric) as "costOfGoodSoldTotal",
    //                             sum ("incomeTotal"::numeric) as "incomeTotal",
    //                             sum ("expenceTotal"::numeric) as "expenceTotal"
    //                      from totals `

    //         selectQuery += sumOfTotalsQuery;
    //         let values = [filterId, from, to, accountTypes];
    //         if (from == null) {
    //             values = [filterId, to, accountTypes]
    //         }

    //         let netProfitValues = await client.query(selectQuery, values);
    //         let incomeTotal = 0
    //         let costOfGoodSoldTotal = 0
    //         let expenceTotal = 0


    //         if (netProfitValues.rows && netProfitValues.rows.length > 0) {
    //             incomeTotal = (<any>netProfitValues.rows[0]).incomeTotal;
    //             costOfGoodSoldTotal = (<any>netProfitValues.rows[0]).costOfGoodSoldTotal;
    //             expenceTotal = (<any>netProfitValues.rows[0]).expenceTotal;
    //         }

    //         let resData = {
    //             incomeTotal: incomeTotal,
    //             costOfGoodSoldTotal: costOfGoodSoldTotal,
    //             expenceTotal: expenceTotal
    //         }
    //         return new ResponseData(true, "", resData)
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }

    public static async getNetProfitSummary(from: String | Moment | Date | null, to: String | Moment | Date, branchId: any[] | null, company: Company) {
        try {


            let accountTypes = ['Operating Expense', 'Operating Income', 'Costs Of Goods Sold', 'Expense']
            let filterId = branchId != null && branchId.length > 0 ? branchId : company.id;

            const query = {
                text: `		
			   with "journals" as (select
                                                    sum(amount::TEXT::numeric) as "amount",
                                                   "accountId"  
                                                  
								    from "JournalRecords"
                                   WHERE "JournalRecords"."companyId" = $1
                                   AND ($2::uuid[] is null or  "JournalRecords"."branchId"  = any($2::uuid[]) or ( "JournalRecords"."branchId" is null  and "JournalRecords"."companyId" = $1) )
                                   AND( $3::timestamp is null or  "JournalRecords"."createdAt">=$3)
								   AND  "JournalRecords"."createdAt" < $4
								   
								   group by    "accountId" ),
									  
									  
									  "totals" as (
                                  select
                                  "Accounts"."parentType",
                                   sum(amount::text::numeric)  *-1 as "total"
                                  from "journals"
                                  inner join "Accounts" on "Accounts".id = "journals"."accountId"
							      where "parentType"::text = any($5::text[])
							      group by  "Accounts"."parentType"
									  ),"parentTypeTotals" as (
                                    select
                                    case when "parentType" = 'Costs Of Goods Sold' then sum (COALESCE("total"::TEXT::numeric,0)) end as "costOfGoodSoldTotal",
                                    case when "parentType" = 'Operating Income' then sum (COALESCE("total"::TEXT::numeric,0)) end as "incomeTotal",
                                    case when "parentType" = 'Operating Expense' then  sum (COALESCE("total"::TEXT::numeric,0)) end as "expenceTotal"
                             from totals
                             group by totals."parentType"
                                )

                                select COALESCE(sum("parentTypeTotals"."costOfGoodSoldTotal"::TEXT::NUMERIC),0) as "costOfGoodSoldTotal",
                                  COALESCE(sum("parentTypeTotals"."incomeTotal"::TEXT::NUMERIC),0) as "incomeTotal",
                                  COALESCE(sum("parentTypeTotals"."expenceTotal"::TEXT::NUMERIC),0) as "expenceTotal"

                                from "parentTypeTotals"`,
                values: [company.id, branchId, from, to, accountTypes]
            }



            let netProfitValues = await DB.excu.query(query.text, query.values);
            let incomeTotal = 0
            let costOfGoodSoldTotal = 0
            let expenceTotal = 0

            if (netProfitValues.rows && netProfitValues.rows.length > 0) {
                incomeTotal = (<any>netProfitValues.rows[0]).incomeTotal;
                costOfGoodSoldTotal = (<any>netProfitValues.rows[0]).costOfGoodSoldTotal;
                expenceTotal = (<any>netProfitValues.rows[0]).expenceTotal;
            }

            let resData = {
                incomeTotal: incomeTotal,
                costOfGoodSoldTotal: costOfGoodSoldTotal,
                expenceTotal: expenceTotal
            }
            return new ResponseData(true, "", resData)
        } catch (error: any) {
            throw new Error(error)
        }
    }


    // public static async getProfitAndLossReportRecords(client: PoolClient, from: Date | null, to: Date, branchId: string | null, company: Company) {
    //     try {
    //         let accountTypes = ['Operating Expense', 'Operating Income', 'Costs Of Goods Sold']
    //         let filterId = branchId != null && branchId != "" ? branchId : company.id;
    //         let filterQuery = branchId != null && branchId != "" ? ` Where  "JournalRecords"."branchId" =$1` : ` Where  "JournalRecords"."companyId" =$1`;
    //         filterQuery += from == null ? ` AND "JournalRecords"."createdAt" < $2` : ` AND    "JournalRecords"."createdAt">= $2 and "JournalRecords"."createdAt"< $3`
    //         filterQuery += from == null ? ` AND  "Accounts"."parentType" = ANY($3) ` : ` AND  "Accounts"."parentType" = ANY($4) `
    //         let groupBy = '    group by "Accounts".id '

    //         let selectQuery = ` select
    //                                 "Accounts".name as "account",
    //                                 "Accounts".id as "accountId",
    //                                 "Accounts".type,
    //                                 "Accounts"."parentType",
    //                                 case when "Accounts"."parentType" = 'Operating Expense' then 
    //                                 case when sum("JournalRecords".amount::numeric) > 0 then  sum("JournalRecords".amount::numeric) * -1 else  sum("JournalRecords".amount::numeric) end
    //                                 else
    //                                 case when  "Accounts"."parentType" = 'Operating Income' and "Accounts"."type" <>'Discount' and  "Accounts"."type" <>'Rounding'  then 
    //                                 case when sum("JournalRecords".amount::numeric) < 0 then  abs(sum("JournalRecords".amount::numeric))  else  sum("JournalRecords".amount::numeric) end
    //                                 else
    //                                 case when   "Accounts"."parentType" = 'Operating Income' and "Accounts"."type"='Discount' then 
    //                                 case when sum("JournalRecords".amount::numeric) > 0 then  sum("JournalRecords".amount::numeric) * -1 else  sum("JournalRecords".amount::numeric) end
    //                                 else
    //                                 case when "Accounts"."parentType" = 'Operating Income' and "Accounts"."type"='Rounding' then 
    //                                 case when sum("JournalRecords".amount::numeric) > 0 then  sum("JournalRecords".amount::numeric) * -1 else  sum("JournalRecords".amount::numeric) end
    //                                 else 
    //                                 case when sum("JournalRecords".amount::numeric) < 0 then  sum("JournalRecords".amount::numeric) * -1 else  sum("JournalRecords".amount::numeric) end

    //                                 end 
    //                                 end 
    //                                 end 
    //                                 end as "total"
    //                                 from "JournalRecords" 
    //                                 INNER JOIN "Accounts" ON "Accounts".id = "JournalRecords"."accountId"`
    //         selectQuery += filterQuery + groupBy

    //         let values = [filterId, from, to, accountTypes];
    //         if (from == null) {
    //             values = [filterId, to, accountTypes]
    //         }

    //         let netProfitValues = await client.query(selectQuery, values);

    //         return new ResponseData(true, "", netProfitValues.rows)
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }


    public static async getProfitAndLossReportRecords(from: String | Moment | Date | null, to: String | Moment | Date, branchId: any[] | null, company: Company) {
        try {
            let accountTypes = ['Operating Expense', 'Operating Income', 'Costs Of Goods Sold', 'Expense']
            let filterId = branchId != null && branchId.length > 0 ? branchId : company.id;
            let filterQuery = branchId != null && branchId.length > 0 ? ` Where  "JournalRecords"."branchId" =any($1)` : ` Where  "JournalRecords"."companyId" =$1`;
            filterQuery += from == null ? ` AND "JournalRecords"."createdAt" < $2` : ` AND    "JournalRecords"."createdAt">= $2 and "JournalRecords"."createdAt"< $3`
            filterQuery += from == null ? ` AND  "Accounts"."parentType" = ANY($3) ` : ` AND  "Accounts"."parentType" = ANY($4) `
            let groupBy = '    group by "Accounts".id '

            let selectQuery = ` select
                                    "Accounts".name as "account",
                                    "Accounts".id as "accountId",
                                    "Accounts".type,
                                    "Accounts"."parentType",
                                    "Accounts"."translation",
                                    sum(COALESCE("JournalRecords".amount::text::numeric,0)) *-1 as total
                                    FROM "JournalRecords"
                                INNER JOIN "Accounts" ON "Accounts".id = "JournalRecords"."accountId"`
            selectQuery += filterQuery + groupBy

            let values: any = [filterId, from, to, accountTypes];
            if (from == null) {
                values = [filterId, to, accountTypes]
            }

            let netProfitValues = await DB.excu.query(selectQuery, values);

            return new ResponseData(true, "", netProfitValues.rows)
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getNetProfitTotal(from: String | Moment | Date | null, to: any, branchId: any[], company: Company) {
        try {
            const afterDecimal = company.afterDecimal


            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate: any = from ? from : null;
            fromDate = moment(new Date(fromDate))
            let toDate: any = to ? moment(new Date(to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            from = interval.from
            to = interval.to
            //---------------------------------------


            let netProfitSummary = await this.getNetProfitSummary(from, to, branchId, company);

            let incomeTotal = netProfitSummary.data.incomeTotal;
            let costOfGoodSoldTotal = netProfitSummary.data.costOfGoodSoldTotal;
            let expenceTotal = netProfitSummary.data.expenceTotal;



            let grossProfit = Helper.add(Number(incomeTotal), Number((costOfGoodSoldTotal)), afterDecimal);
            let netProfit = Helper.add(Number(grossProfit), Number(expenceTotal), afterDecimal);

            return new ResponseData(true, "", netProfit)
        } catch (error: any) {
            throw new Error(error)
        }
    }




    public static async getProfitAndLoss(data: any, company: Company) {
        try {




            const companyId = company.id;
            const afterDecimal = company.afterDecimal
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


            const branchId = data.branchId;
            const profitData = await this.calculateProfits(branchId, to, companyId, afterDecimal, from)
            const reports = profitData.data;
            let netProfit: any
            let grossProfit: any
            let operatingProfit: any
            if (profitData != null) {
                netProfit = {
                    total: profitData.netProfit == null ? 0 : profitData.netProfit,
                    parentType: "",
                    code: "",
                    type: "Net Profit",
                    account: "Net Profit / Loss"
                }

                grossProfit = {
                    total: profitData.grossProfit == null ? 0 : profitData.grossProfit,
                    parentType: "",
                    code: "",
                    type: "Gross Profit",
                    account: "Gross Profit"
                }

                operatingProfit = {
                    total: profitData.operatingProfit == null ? 0 : profitData.operatingProfit,
                    parentType: "",
                    code: "",
                    type: "Operating Profit",
                    account: "Operating Profit"
                }
            }

            reports.push(netProfit);
            reports.push(grossProfit);
            reports.push(operatingProfit);
            return new ResponseData(true, "", reports)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async getBalanceBasisAccrual(data: any, company: Company, branchList: []) {
        try {
            const afterDecimal = company.afterDecimal
            const companyId = company.id;
            //-------------- set time --------------
            let closingTime = "00:00:00"

            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(null, toDate, closingTime, false, timeOffset)

            let to = interval.to
            //---------------------------------------



            const branches = data.branchId ? [data.branchId] : branchList

            const query: { text: string, values: any } = {
                text: `SELECT 
                            "Accounts".id as "accountId",
                            "Accounts"."name" as "account",
                            "Accounts".code,
                            "Accounts".type,
                            "Accounts"."parentType",
                            case when sum("JournalRecords".amount) > 0 then sum("JournalRecords".amount) end as "debit",
                            case when sum("JournalRecords".amount) < 0 then ABS(sum("JournalRecords".amount)) end as "credit"
                    FROM "JournalRecords"
                    LEFT JOIN "Accounts"
                    ON  "Accounts".id = "JournalRecords"."accountId"
                    AND "JournalRecords"."companyId" =$1
                    And ("JournalRecords"."createdAt"<$2)
                    WHERE "Accounts"."companyId" = $1
                    and ("JournalRecords"."branchId" = any ($3) or "JournalRecords"."branchId" is null  )
                    GROUP BY  "Accounts".id`,
                values: [companyId, to, branches]
            }

            if (data.branchId != null && data.branchId != "") {
                query.text = `SELECT 
                                "Accounts".id as "accountId",
                                "Accounts"."name" as "account",
                                "Accounts".code,
                                "Accounts".type,
                                "Accounts"."parentType",
                                case when sum("JournalRecords".amount) > 0 then sum("JournalRecords".amount) end as "debit",
                                case when sum("JournalRecords".amount) < 0 then ABS(sum("JournalRecords".amount)) end as "credit"
                    FROM "JournalRecords"
                    LEFT JOIN "Accounts"
                    ON  "Accounts".id = "JournalRecords"."accountId"
             
           
                    WHERE "Accounts"."companyId" = $3
                             And ("JournalRecords"."createdAt"<$2)
                           AND ( ("JournalRecords"."branchId" = any($1)) or("JournalRecords"."branchId" is null  ))
                    GROUP BY  "Accounts".id`
                query.values = [branches, to, companyId]
            }


            const report = await DB.excu.query(query.text, query.values)
            for (let index = 0; index < report.rows.length; index++) {
                const element = report.rows[index];
                await Helper.roundNumbers(afterDecimal, report.rows)
            }
            return new ResponseData(true, "", report.rows)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async getJournalEntries(data: any, company: Company, branchList: []) {
        try {
            const companyId = company.id;
            let query;
            let values;
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


            const branches = data.branchId != "" && data.branchId != null ? [data.branchId] : branchList;
            const selectText = `SELECT 
                                 "JournalRecords".code as "refrenceNumber",
                                 "JournalRecords"."referenceId",
                                 "JournalRecords"."dbTable" as "refrence",
                                  case when ("JournalRecords".amount>0) then "JournalRecords".amount::text::numeric else 0 end as debit,
                                  case when ("JournalRecords".amount<0) then abs("JournalRecords".amount::text::numeric) else 0 end as credit,
                                  "JournalRecords".name as "accountName"
                                 FROM "JournalRecords"`
            let filter = ` WHERE "companyId" =$1 and ("JournalRecords"."branchId" = any($2) or "JournalRecords"."branchId" is null  ) and "createdAt">=$3 and "createdAt"< $4`
            const orderByQuery = ` order by   "JournalRecords"."referenceId"  DESC , "createdAt" DESC `
            query = selectText + filter + orderByQuery;
            values = [companyId, branchList, from, to]


            /**
             * in billPayment we dont use branchId but companyId therefore in the journal 
             * for the billPyment the branchId is null
             * thats why ("branchId"=$1 or ("branchId".id is null and "companyId"=$2)) is used when filttering on branchId
             */
            if (data.branchId != null && data.branchId != "") {
                filter = ` WHERE ("branchId"=any($1) or ("branchId" is null and "companyId"=$2))
                           AND "createdAt">=$3 and "createdAt"< $4
                   `
                query = selectText + filter + orderByQuery
                values = [branches, companyId, from, to]
            }

            const journal = await DB.excu.query(query, values)

            return new ResponseData(true, "", journal.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    /**Customers */
    /** Account Receivable summary within a giving period */
    public static async customerAgingReportGraph(data: any, company: Company) {
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



            let period = data.period /** Monthly , yearly, quartarly */
            let companyId = company.id;
            let branchId = data.branchId;


            let selectQuery = `SELECT SUM("JournalRecords".amount::numeric) as "total",`

            let selectFeild = ` "JournalRecords"."createdAt" `;
            let groupBy = ` GROUP BY "JournalRecords"."createdAt" `
            let orderBy = ` ORDER BY  "JournalRecords"."createdAt" ASC `
            switch (period) {
                case "weekly":
                    selectFeild = ` concat( DATE_PART('week',"JournalRecords"."createdAt"),'/', DATE_PART('year',"JournalRecords"."createdAt")) as date `
                    groupBy = ` GROUP BY DATE_PART('week',"JournalRecords"."createdAt"),DATE_PART('year',"JournalRecords"."createdAt")  `
                    orderBy = ` ORDER BY  DATE_PART('week',"JournalRecords"."createdAt") ASC ,DATE_PART('year',"JournalRecords"."createdAt") ASC `
                    break;
                case "monthly":
                    selectFeild = ` concat( TO_CHAR(  "JournalRecords"."createdAt", 'Month'),'/', DATE_PART('year', "JournalRecords"."createdAt"::date)) as date                    `
                    groupBy = `    GROUP BY TO_CHAR(  "JournalRecords"."createdAt", 'Month'),DATE_PART('year', "JournalRecords"."createdAt"::date)                    `
                    orderBy = `    ORDER BY TO_CHAR(  "JournalRecords"."createdAt", 'Month')ASC,DATE_PART('year', "JournalRecords"."createdAt"::date)ASC                    `
                    break;
                case "quartarly":
                    selectFeild = ` concat( date_part('quarter',"JournalRecords"."createdAt") ,'/', DATE_PART('year', "JournalRecords"."createdAt"::date)) as date `
                    groupBy = `  GROUP BY date_part('quarter',"JournalRecords"."createdAt") ,DATE_PART('year', "JournalRecords"."createdAt"::date) `
                    orderBy = `  ORDER BY date_part('quarter',"JournalRecords"."createdAt") ASC,DATE_PART('year', "JournalRecords"."createdAt"::date)ASC `
                    break;
                case "yearly":
                    selectFeild = `   DATE_PART('year',"JournalRecords"."createdAt"::date) as date `
                    groupBy = ` GROUP BY  DATE_PART('year',"JournalRecords"."createdAt"::date)  `
                    orderBy = ` ORDER BY    DATE_PART('year',"JournalRecords"."createdAt"::date)  ASC `
                    break;
                default:
                    break;
            }
            selectQuery += selectFeild
            selectQuery += `from "JournalRecords" 
                            inner join "Accounts" ON  "Accounts".id = "JournalRecords"."accountId"  and "type" = 'Account Receivable' and "parentType" = 'Current Assets'`
            let filterQuery = data.branchId != null && data.branchId != "" ? ` WHERE "JournalRecords"."branchId"=$3 or("JournalRecords"."branchId" is null and "JournalRecords"."companyId" = $4)` : ` WHERE "JournalRecords"."companyId" = $3 `
            filterQuery += ` AND "JournalRecords"."createdAt" >=$1 AND   "JournalRecords"."createdAt" <$2 `


            selectQuery += filterQuery + groupBy + orderBy;
            let values = data.branchId != null && data.branchId != "" ? [from, to, branchId, companyId] : [from, to, companyId]

            let receivableSummary = await DB.excu.query(selectQuery, values);
            return new ResponseData(true, "", receivableSummary.rows);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    /**Customers */
    /** Aginig report records by (invoice) */
    public static async customerAgingReportRecordes(data: any, company: Company, brancheList: []) {
        try {

            let companyId = company.id;
            let branches = data.branchId ? [data.branchId] : brancheList;

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


            let values;
            const query: { text: string, values: any } = {
                text: ` WITH "invoiceList" AS(
                select "Invoices".id,
                    "Invoices"."invoiceNumber",
                    "Invoices".total,
                    "Customers".id as "customerId",
                    COALESCE("Customers"."name",'Walkin Customer') as "customerName",
                    "Invoices"."invoiceDate",
                    case when "Invoices"."dueDate" is null then "Invoices"."invoiceDate" else "Invoices"."dueDate" END as "dueDate"
                    from "JournalRecords"
                INNER JOIN "Accounts" on "Accounts".id = "JournalRecords"."accountId" and "type" = 'Account Receivable' and "parentType" = 'Current Assets'
                INNER JOIN "Invoices" on  "Invoices".id = "JournalRecords"."referenceId"
                LEFT JOIN "Customers" on "Customers".id =  "Invoices"."customerId" 
	 WHERE "JournalRecords"."companyId" = $1
	 AND "Invoices"."status" <>'Draft'  
	 AND ("JournalRecords"."branchId" = any($2) or "JournalRecords"."branchId" is null)
	 AND ($3::timestamp   is null or "JournalRecords"."createdAt" >=$3 )
	 AND "JournalRecords"."createdAt" <$4  ),
            "creditNotes" as (
            select COALESCE(sum("CreditNotes"."total"::numeric),0) as total, "invoiceList".id from "CreditNotes" left join "invoiceList" on "invoiceList".id = "CreditNotes"."invoiceId"
            group by "invoiceList".id
            ),
            "appliedCredit" as (
            select COALESCE(sum("AppliedCredits"."amount"::numeric),0)as total,"invoiceList".id from "AppliedCredits" left join "invoiceList" on "invoiceList".id = "AppliedCredits"."invoiceId"
            group by "invoiceList".id
            ),
            "payments" as (
            select COALESCE(sum("InvoicePaymentLines"."amount"::numeric),0)as total,"invoiceList".id from "InvoicePaymentLines" left join "invoiceList" on "invoiceList".id = "InvoicePaymentLines"."invoiceId"
                group by "invoiceList".id
            )

            select
             "invoiceList".id,
             "invoiceList"."invoiceNumber",
              "invoiceList"."customerId",
              "invoiceList"."invoiceDate",
             "invoiceList"."customerName",
             "invoiceList"."dueDate",
             'Overdue' as "status",
             DATE_PART('day', age( current_date::date, "invoiceList"."dueDate"::date)) + 1 as age ,
             "invoiceList".total as amount,
          cast (  (("invoiceList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric as real) as "balanceDue"
            from "invoiceList"
            left join "creditNotes" on "creditNotes".id = "invoiceList".id
            left join "appliedCredit" on "appliedCredit".id = "invoiceList".id
            left join "payments" on "payments".id = "invoiceList".id
            group by "invoiceList".id,
                     "invoiceList"."invoiceNumber",
                     "invoiceList"."customerName",
                     "invoiceList"."invoiceDate",
                     "invoiceList"."customerId",
                     "invoiceList"."dueDate",

                      "invoiceList".total,
                      "creditNotes".total,
                      "appliedCredit".total,
                      "payments".total

            having (("invoiceList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric >0
            and   DATE_PART('day', age( current_date::date, "invoiceList"."dueDate"::date))>=0
            order by  "invoiceList"."dueDate" asc`,
                values: [companyId, branches, from, to]
            }
            let reports = await DB.excu.query(query.text, values);
            return new ResponseData(true, "", reports.rows);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    /**Aging Report by Customer */
    public static async aginingReportByCustomer(data: any, company: Company) {
        try {

            let subCustomerQuery = ''
            let customerIdSelect = ' "Customers".id '

            if (data.includeSubCustomers && data.includeSubCustomers == true) {
                subCustomerQuery = data.branchId != "" && data.branchId != null ? 'or "Customers"."parentId" = $3' : 'or "Customers"."parentId" = $2'
                customerIdSelect = 'COALESCE("Customers"."parentId", "Customers".id) '
            }


            let filterId = data.branchId != "" && data.branchId != null ? data.branchId : company.id;
            const selectQuery = ` WITH "invoiceList" AS(
                select "Invoices".id,
                    "Invoices"."invoiceNumber",
                    "Invoices".total,
                    "Customers".id as "customerId",
                    COALESCE("Customers"."name",'Walkin Customer') as "customerName",
                    "Invoices"."invoiceDate",
                    "Invoices"."createdAt",
                    case when "Invoices"."dueDate" is null then "Invoices"."invoiceDate" else "Invoices"."dueDate" END as "dueDate"
                    from "JournalRecords" 
                INNER JOIN "Accounts" on   "Accounts"."companyId" = $1 and "Accounts".id = "JournalRecords"."accountId" and "type" = 'Account Receivable' and "parentType" = 'Current Assets'
                INNER JOIN "Invoices" on "Invoices"."companyId" = $1 and "Invoices".id = "JournalRecords"."referenceId" 
                LEFT JOIN "Customers" on  "Customers"."companyId" = $1 and "Customers".id =  "Invoices"."customerId" `
            let filterQuery = data.branchId != "" && data.branchId != null ? ` WHERE "Invoices"."companyId" = $1 and "Invoices"."branchId" = $2 AND "Invoices"."status" <>'Draft' ` : ` WHERE "JournalRecords"."companyId" = $1  AND "Invoices"."status" <>'Draft'`
            filterQuery += data.branchId != "" && data.branchId != null ? ` AND "Customers".id = $3 ${subCustomerQuery}` : ` AND "Customers".id = $2 ${subCustomerQuery}`

            let otherQueries = `),
            "creditNotes" as (
            select COALESCE(sum("CreditNotes"."total"::numeric),0) as total, "invoiceList".id from "CreditNotes" left join "invoiceList" on "invoiceList".id = "CreditNotes"."invoiceId"
            where "CreditNotes"."companyId" =$1
            group by "invoiceList".id
            ),
            "appliedCredit" as (
            select COALESCE(sum("AppliedCredits"."amount"::numeric),0)as total,"invoiceList".id from "AppliedCredits" left join "invoiceList" on "invoiceList".id = "AppliedCredits"."invoiceId"
            group by "invoiceList".id
            ),
            "payments" as (
             select COALESCE(sum("InvoicePaymentLines"."amount"::numeric),0)as total,"invoiceList".id 
                from "invoiceList" left join "InvoicePaymentLines" on "invoiceList".id = "InvoicePaymentLines"."invoiceId"
                inner join "InvoicePayments" on "InvoicePayments"."companyId" = $1 and "InvoicePayments".id = "InvoicePaymentLines"."invoicePaymentId"
                group by "invoiceList".id
            )
            
            select 
             "invoiceList".id,
             "invoiceList"."invoiceNumber",
              "invoiceList"."customerId",
              "invoiceList"."invoiceDate",
             "invoiceList"."customerName",
             "invoiceList"."dueDate",
             'Overdue' as "status",
             DATE_PART('day', age( current_date::date, "invoiceList"."dueDate"::date))::int + 1 as age ,
             "invoiceList".total as amount,
          cast (  (("invoiceList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric as real) as "balanceDue"
            from "invoiceList"
            left join "creditNotes" on "creditNotes".id = "invoiceList".id 
            left join "appliedCredit" on "appliedCredit".id = "invoiceList".id 
            left join "payments" on "payments".id = "invoiceList".id 
            group by "invoiceList".id,
                     "invoiceList"."invoiceNumber",
                     "invoiceList"."customerName",
                     "invoiceList"."invoiceDate",
                     "invoiceList"."customerId",
                     "invoiceList"."dueDate",
                   "invoiceList"."createdAt":: timestamp:: time ,
                      "invoiceList".total,
                      "creditNotes".total,
                      "appliedCredit".total,
                      "payments".total

            having (("invoiceList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric >0
             and DATE_PART('day', age( current_date::date, "invoiceList"."dueDate"::date)) >= 0
             
             order by       "invoiceList"."invoiceDate" asc ,  "invoiceList"."createdAt":: timestamp:: time 
             `

            let query = selectQuery + filterQuery + otherQueries;

            let values = data.branchId != "" && data.branchId != null ? [company.id, filterId, data.customerId] : [company.id, data.customerId]
            console.log(query)
            let agingReports = await DB.excu.query(query, values);
            return new ResponseData(true, "", agingReports.rows)
        } catch (error: any) {
            throw new Error(error)
        }
    }
    /**Customers */
    /** Aginig report  summary records by(customer) */
    public static async customerSummaryAgingReport(data: any, company: Company, brancheList: []) {
        try {
            const companyId = company.id;

            let branches = data.branchId ? [data.branchId] : brancheList;
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



            let period = data.period ?? 15;
            let values;

            const query = {
                text: `WITH "invoiceList" AS(
                select "Invoices".id,
                    "Invoices"."invoiceNumber",
                    "Invoices".total,
                    "Customers".id as "customerId",
                    COALESCE("Customers"."name",'Walkin Customer') as "customerName",
                    "Invoices"."invoiceDate",
                    case when "Invoices"."dueDate" is null then "Invoices"."invoiceDate" else "Invoices"."dueDate" END as "dueDate"
                    from "JournalRecords"
                INNER JOIN "Accounts" on "Accounts".id = "JournalRecords"."accountId" and "type" = 'Account Receivable' and "parentType" = 'Current Assets'
                INNER JOIN "Invoices" on  "Invoices".id = "JournalRecords"."referenceId"
                LEFT JOIN "Customers" on "Customers".id =  "Invoices"."customerId"  
	         WHERE "JournalRecords"."companyId" = $1 
	       AND "Invoices"."status" <>'Draft'  
	       AND ( "JournalRecords"."branchId" = any($2) or "JournalRecords"."branchId" is null )
	      AND ($3::timestamp is null or "JournalRecords"."createdAt" >=$3 )
	      AND "JournalRecords"."createdAt" <$4  ),
            "creditNotes" as (
            select COALESCE(sum("CreditNotes"."total"::numeric),0) as total, "invoiceList".id from "CreditNotes" left join "invoiceList" on "invoiceList".id = "CreditNotes"."invoiceId"
            group by "invoiceList".id
            ),
            "appliedCredit" as (
            select COALESCE(sum("AppliedCredits"."amount"::numeric),0)as total,"invoiceList".id from "AppliedCredits" left join "invoiceList" on "invoiceList".id = "AppliedCredits"."invoiceId"
            group by "invoiceList".id
            ),
            "payments" as (
               select COALESCE(sum("InvoicePaymentLines"."amount"::numeric),0)as total,"invoiceList".id 
                from "invoiceList" left join "InvoicePaymentLines" on "invoiceList".id = "InvoicePaymentLines"."invoiceId"
                inner join "InvoicePayments" on "InvoicePayments"."companyId" =$1 and "InvoicePayments".id = "InvoicePaymentLines"."invoicePaymentId"
                group by "invoiceList".id
            ), "aging" as(
            select
             "invoiceList".id,
             "invoiceList"."invoiceNumber",
              "invoiceList"."customerId",
             "invoiceList"."customerName",
             "invoiceList"."dueDate",
             DATE_PART('day', age( current_date::date, "invoiceList"."dueDate"::date))::int + 1 as age ,
             "invoiceList".total as amount,
            (("invoiceList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric as "balanceDue"
            from "invoiceList"
            left join "creditNotes" on "creditNotes".id = "invoiceList".id
            left join "appliedCredit" on "appliedCredit".id = "invoiceList".id
            left join "payments" on "payments".id = "invoiceList".id
            group by "invoiceList".id,
                     "invoiceList"."invoiceNumber",
                     "invoiceList"."customerName",
                     "invoiceList"."customerId",

                     "invoiceList"."dueDate",
                      "invoiceList".total,
                      "creditNotes".total,
                      "appliedCredit".total,
                      "payments".total
            having (("invoiceList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric >0
            and   DATE_PART('day', age( current_date::date, "invoiceList"."dueDate"::date))>=0
            )
            select "aging"."customerId",
                   "aging"."customerName",
                   "aging"."age"as age ,
                cast( sum("balanceDue"::numeric) as real) as "total"
            from "aging"
            group by "aging"."customerId","aging"."customerName",        "aging"."age"`,

                values: [company.id, branches, from, to]
            }

            let reports = await DB.excu.query(query.text, values);
            return new ResponseData(true, "", reports.rows);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    /**Suppliers */
    /** Account Payable summary within a giving period */
    public static async supplierAgingReportGraph(data: any, company: Company) {
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



            let period = data.period /** Monthly , yearly, quartarly */
            let companyId = company.id;
            let branchId = data.branchId;

            let selectQuery = `SELECT SUM("JournalRecords".amount::numeric) as "total",`
            let values;
            let selectFeild = ` "JournalRecords"."createdAt" `;
            let groupBy = ` GROUP BY "JournalRecords"."createdAt" `
            let orderBy = ` ORDER BY  "JournalRecords"."createdAt" ASC `
            switch (period) {
                case "weekly":
                    selectFeild = ` concat( DATE_PART('week',"JournalRecords"."createdAt"),'/', DATE_PART('year',"JournalRecords"."createdAt")) as date `
                    groupBy = ` GROUP BY DATE_PART('week',"JournalRecords"."createdAt"),DATE_PART('year',"JournalRecords"."createdAt")  `
                    orderBy = ` ORDER BY  DATE_PART('week',"JournalRecords"."createdAt") ASC ,DATE_PART('year',"JournalRecords"."createdAt") ASC `
                    break;
                case "monthly":
                    selectFeild = ` concat( TO_CHAR(  "JournalRecords"."createdAt", 'Month'),'/', DATE_PART('year', "JournalRecords"."createdAt"::date)) as date                    `
                    groupBy = `    GROUP BY TO_CHAR(  "JournalRecords"."createdAt", 'Month'),DATE_PART('year', "JournalRecords"."createdAt"::date)                    `
                    orderBy = `    ORDER BY TO_CHAR(  "JournalRecords"."createdAt", 'Month')ASC,DATE_PART('year', "JournalRecords"."createdAt"::date)ASC                    `
                    break;
                case "quartarly":
                    selectFeild = ` concat( date_part('quarter',"JournalRecords"."createdAt") ,'/', DATE_PART('year', "JournalRecords"."createdAt"::date)) as date `
                    groupBy = `  GROUP BY date_part('quarter',"JournalRecords"."createdAt") ,DATE_PART('year', "JournalRecords"."createdAt"::date) `
                    orderBy = `  ORDER BY date_part('quarter',"JournalRecords"."createdAt") ASC,DATE_PART('year', "JournalRecords"."createdAt"::date)ASC `
                    break;
                case "yearly":
                    selectFeild = `   DATE_PART('year',"JournalRecords"."createdAt"::date) as date `
                    groupBy = ` GROUP BY  DATE_PART('year',"JournalRecords"."createdAt"::date)  `
                    orderBy = ` ORDER BY    DATE_PART('year',"JournalRecords"."createdAt"::date)  ASC `
                    break;
                default:
                    break;
            }
            selectQuery += selectFeild
            selectQuery += `from "JournalRecords" 
                            inner join "Accounts" ON  "Accounts".id = "JournalRecords"."accountId"  and "type" = 'Account Payable' and "parentType" = 'Current Liabilities'`
            let filterQuery = data.branchId != null && data.branchId != "" ? ` WHERE "JournalRecords"."branchId"=$1 or("JournalRecords"."branchId" is null and "JournalRecords"."companyId" = $2)` : ` WHERE "JournalRecords"."companyId" = $1 `


            if (data.interval.from == null) {
                if (data.branchId != null && data.branchId != "") {
                    filterQuery += ` AND "JournalRecords"."createdAt" <$3`
                    values = [branchId, companyId, to]
                } else {
                    filterQuery += ` AND "JournalRecords"."createdAt" <$2`
                    values = [companyId, to]
                }

            } else {

                if (data.branchId != null && data.branchId != "") {
                    filterQuery += ` AND "JournalRecords"."createdAt" >=$3 AND "JournalRecords"."createdAt" <$4 `
                    values = [branchId, companyId, from, to]
                } else {
                    filterQuery += ` AND "JournalRecords"."createdAt" >=$2 AND "JournalRecords"."createdAt" <$3 `
                    values = [companyId, from, to]
                }


            }
            selectQuery += filterQuery + groupBy + orderBy;

            let receivableSummary = await DB.excu.query(selectQuery, values);
            return new ResponseData(true, "", receivableSummary.rows);
        } catch (error: any) {
            throw new Error(error)
        }
    }
    /**Suppliers */
    /** Aginig report records by (bill) */
    public static async supplierAgingReportRecordes(data: any, company: Company, brancheList: []) {
        try {

            let filterId = data.branchId ?? company.id;
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


            let values;

            const companyId = company.id;
            const branches = data.branchId ? [data.branchId] : brancheList;

            const query = {
                text: ` WITH "billingList" AS(
                select "Billings".id,
                    "Billings"."billingNumber",
                    "Billings".total,
                    "Suppliers".id as "supplierId",
                    "Suppliers"."name" as "supplierName",
                    "Billings"."billingDate",
                    'Overdue' as "status",
                    "Billings"."dueDate"
                    from "JournalRecords"
                INNER JOIN "Accounts" on "Accounts".id = "JournalRecords"."accountId" and "type" = 'Account Payable' and "parentType" = 'Current Liabilities'
                INNER JOIN "Billings" on  "Billings".id = "JournalRecords"."referenceId" and "dueDate" is not null
                INNER JOIN "Suppliers" on "Suppliers".id =  "Billings"."supplierId"  
	            WHERE "JournalRecords"."companyId" = $1
	            AND ("JournalRecords"."branchId" = any($2) or "JournalRecords"."branchId" is null  )
	            AND ($3::timestamp is  null or  "JournalRecords"."createdAt" >=$3 )AND "JournalRecords"."createdAt" <$4  ),
            "creditNotes" as (
            select COALESCE(sum("SupplierCredits"."total"::numeric),0) as total, "billingList".id from "SupplierCredits" left join "billingList" on "billingList".id = "SupplierCredits"."billingId"
            group by "billingList".id
            ),
            "appliedCredit" as (
            select COALESCE(sum("SupplierAppliedCredits"."amount"::numeric),0)as total,"billingList".id from "SupplierAppliedCredits" left join "billingList" on "billingList".id = "SupplierAppliedCredits"."billingId"
            group by "billingList".id
            ),
            "payments" as (
            select COALESCE(sum("BillingPaymentLines"."amount"::numeric),0)as total,"billingList".id from "BillingPaymentLines" left join "billingList" on "billingList".id = "BillingPaymentLines"."billingId"
                group by "billingList".id
            )

            select
             "billingList".id,
             "billingList"."billingNumber",
              "billingList"."supplierId",
             "billingList"."supplierName",
             "billingList"."billingDate",
             "billingList"."dueDate",
             'Overdue' as "status",
             DATE_PART('day', age( current_date::date, "billingList"."dueDate"::date))::int + 1 as age ,
             "billingList".total as amount,
           cast ( (("billingList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric as real)  as "balanceDue"
            from "billingList"
            left join "creditNotes" on "creditNotes".id = "billingList".id
            left join "appliedCredit" on "appliedCredit".id = "billingList".id
            left join "payments" on "payments".id = "billingList".id
            group by "billingList".id,
                     "billingList"."billingNumber",
                     "billingList"."supplierName",
                     "billingList"."billingDate",
                     "billingList"."supplierId",
                     "billingList"."dueDate",

                      "creditNotes".total,
                      "appliedCredit".total,
                      "payments".total,
                      "billingList".total
            having (("billingList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric >0
            and DATE_PART('day', age( current_date::date, "billingList"."dueDate"::date)) >= 0`,
                values: [companyId, branches, from, to]
            }

            let reports = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", reports.rows);
        } catch (error: any) {

            throw new Error(error)
        }
    }

    /**Suppliers */
    /** Aginig report  summary records by(supplier) */
    public static async suppliersSummaryAgingReport(data: any, company: Company, branchList: []) {
        try {

            let companyId = company.id;
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



            let period = data.period ?? 15;
            let values;
            const branches = data.branchId ? [data.branchId] : branchList


            const query = {
                text: `WITH "billingList" AS(
                select "Billings".id,
                    "Billings"."billingNumber",
                    "Billings".total,
                    "Suppliers".id as "supplierId",
                    "Suppliers"."name" as "supplierName",
                    "Billings"."billingDate",
                    "Billings"."dueDate"
                    from "JournalRecords"
                INNER JOIN "Accounts" on "Accounts".id = "JournalRecords"."accountId" and "type" = 'Account Payable' and "parentType" = 'Current Liabilities'
                INNER JOIN "Billings" on  "Billings".id = "JournalRecords"."referenceId" and "dueDate" is not null
                INNER JOIN "Suppliers" on "Suppliers".id =  "Billings"."supplierId"  
	            WHERE "JournalRecords"."companyId" = $1 
	            AND ("JournalRecords"."branchId" = any($2) or "JournalRecords"."branchId" is null  )
	            AND ($3::timestamp is null  or  "JournalRecords"."createdAt" >=$3)
	              AND "JournalRecords"."createdAt" <$4  ),
            "creditNotes" as (
            select COALESCE(sum("SupplierCredits"."total"::numeric),0) as total, "billingList".id from "SupplierCredits" left join "billingList" on "billingList".id = "SupplierCredits"."billingId"
            group by "billingList".id
            ),
            "appliedCredit" as (
            select COALESCE(sum("SupplierAppliedCredits"."amount"::numeric),0)as total,"billingList".id from "SupplierAppliedCredits" left join "billingList" on "billingList".id = "SupplierAppliedCredits"."billingId"
            group by "billingList".id
            ),
            "payments" as (
            select COALESCE(sum("BillingPaymentLines"."amount"::numeric),0)as total,"billingList".id from "BillingPaymentLines" left join "billingList" on "billingList".id = "BillingPaymentLines"."billingId"
                group by "billingList".id
            ), "aging" as(
            select
             "billingList".id,
             "billingList"."billingNumber",
              "billingList"."supplierId",
             "billingList"."supplierName",
             "billingList"."dueDate",
             DATE_PART('day', age( current_date::date, "billingList"."dueDate"::date))::int + 1 as age ,
             "billingList".total as amount,
            (("billingList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric as "balanceDue"
            from "billingList"
            left join "creditNotes" on "creditNotes".id = "billingList".id
            left join "appliedCredit" on "appliedCredit".id = "billingList".id
            left join "payments" on "payments".id = "billingList".id
            group by "billingList".id,
                     "billingList"."billingNumber",
                     "billingList"."supplierName",
                     "billingList"."supplierId",

                     "billingList"."dueDate",
                      "billingList".total,
                      "creditNotes".total,
                      "appliedCredit".total,
                      "payments".total
            having (("billingList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric >0
           and   DATE_PART('day', age( current_date::date, "billingList"."dueDate"::date)) >=0
            )
            select "aging"."supplierId",
                   "aging"."supplierName",
                   "aging"."age"as age ,
                cast( sum("balanceDue"::numeric) as real) as "total"
            from "aging"
            group by "aging"."supplierId","aging"."supplierName",   "aging"."age"`,

                values: [company.id, branches, from, to]
            }

            let reports = await DB.excu.query(query.text, values);
            return new ResponseData(true, "", reports.rows);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    /**Aging Report by Supplier */
    public static async aginingReportBySupplier(data: any, company: Company) {
        try {

            let filterId = data.branchId != "" && data.branchId != null ? data.branchId : company.id
            const selectQuery = ` WITH "billingList" AS(
                select "Billings".id,
                    "Billings"."billingNumber",
                    "Billings".total,
                    "Suppliers".id as "supplierId",
                    "Suppliers"."name" as "supplierName",
                    "Billings"."billingDate",
                    'Overdue' as "status",

                    "Billings"."dueDate"
                    from "JournalRecords" 
                INNER JOIN "Accounts" on "Accounts".id = "JournalRecords"."accountId" and "type" = 'Account Payable' and "parentType" = 'Current Liabilities'
                INNER JOIN "Billings" on  "Billings".id = "JournalRecords"."referenceId" and "dueDate" is not null
                INNER JOIN "Suppliers" on "Suppliers".id =  "Billings"."supplierId" `
            let filterQuery = data.branchId != "" && data.branchId != null ? ` WHERE "Billings"."branchId" = $1 ` : ` WHERE "JournalRecords"."companyId" = $1 `
            filterQuery += ` AND "Suppliers".id  = $2`
            let otherQueries = ` ),
            "creditNotes" as (
            select COALESCE(sum("SupplierCredits"."total"::numeric),0) as total, "billingList".id from "SupplierCredits" left join "billingList" on "billingList".id = "SupplierCredits"."billingId"
            group by "billingList".id
            ),
            "appliedCredit" as (
            select COALESCE(sum("SupplierAppliedCredits"."amount"::numeric),0)as total,"billingList".id from "SupplierAppliedCredits" left join "billingList" on "billingList".id = "SupplierAppliedCredits"."billingId"
            group by "billingList".id
            ),
            "payments" as (
            select COALESCE(sum("BillingPaymentLines"."amount"::numeric),0)as total,"billingList".id from "BillingPaymentLines" left join "billingList" on "billingList".id = "BillingPaymentLines"."billingId"
                group by "billingList".id
            )
            
            select 
             "billingList".id,
             "billingList"."billingNumber",
              "billingList"."supplierId",
             "billingList"."supplierName",
             "billingList"."billingDate",
             "billingList"."dueDate",
             'Overdue' as "status",
             DATE_PART('day', age( current_date::date, "billingList"."dueDate"::date))::int + 1 as age ,
             "billingList".total as amount,
           cast ( (("billingList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric as real)  as "balanceDue"
            from "billingList"
            left join "creditNotes" on "creditNotes".id = "billingList".id 
            left join "appliedCredit" on "appliedCredit".id = "billingList".id 
            left join "payments" on "payments".id = "billingList".id 
            group by "billingList".id,
                     "billingList"."billingNumber",
                     "billingList"."supplierName",
                     "billingList"."billingDate",
                     "billingList"."supplierId",
                     "billingList"."dueDate",
                   
                      "creditNotes".total,
                      "appliedCredit".total,
                      "payments".total,
                      "billingList".total
            having (("billingList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric >0
            and DATE_PART('day', age( current_date::date, "billingList"."dueDate"::date)) >= 0
            `
            let query = selectQuery + filterQuery + otherQueries;
            let values = [filterId, data.supplierId];

            let aginigReports = await DB.excu.query(query, values);

            return new ResponseData(true, "", aginigReports.rows)

        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getSalesDiscountReport(data: any, company: Company, brancheList: []) {
        try {


            let companyId = company.id;
            let afterDecimal = company.afterDecimal;
            let branches = data.branchId ? [data.branchId] : brancheList;
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




            const query: { text: string, values: any } = {

                text: `with "InvoiceData" As (
                select 
                    IL."discountId", 
                    COALESCE("Discounts".name,'Other') AS "DiscountName",
                    sum(IL.qty) AS "salesCount", 
                    sum(IL."discountTotal"::text::numeric) AS "discountTotal" ,
                    sum( case When IL."isInclusiveTax"= true then (IL."subTotal" - IL."taxTotal")::text::numeric else IL."subTotal"::text::numeric end ) as "salesAmount",
                    sum((IL.total - IL."taxTotal")::text::numeric ) as "netSales",
                    COALESCE(sum((select sum((elem->>'cost')::text::numeric) 
                    from jsonb_array_elements(IL.recipe) AS elem)),0) AS "costs"
                FROM "InvoiceLines" as IL
                INNER JOIN "Invoices" AS invo on  invo.id = IL."invoiceId"
                LEFT JOIN "Discounts" ON IL."discountId" = "Discounts".id 
                INNER JOIN "Branches" ON invo."branchId" = "Branches".id
                where "Branches"."companyId"= $1
                    AND (($2::uuid[] IS NULL) OR( "Branches".id= any($2)) )
                    AND (invo."status" <>'Draft'  or (invo."status" = 'Closed'  and invo."onlineData"->>'onlineStatus'='Rejected'))
                    AND (IL."createdAt" >= $3 AND IL."createdAt" < $4)
                group by IL."discountId", "DiscountName"	
                )
                select "discountId", "DiscountName", "salesCount"::real,
                ((case when "salesAmount" != 0 then ("discountTotal"::text::numeric / "salesAmount"::text::numeric) else 0 end )::text::numeric)::real AS "netDiscountPercentage",
                "discountTotal"::text::numeric::real AS "discountTotal" ,
                "salesAmount"::text::numeric::real AS "salesAmount", 
                "netSales"::text::real AS "netSales", 
                 costs::text::numeric::real AS "costs",
                ((case when "netSales" != 0 then (1::real - costs::real/ "netSales"::real) else 0 end)::text::numeric )::real  AS "GrossMarginPercentage",
               ("netSales" - costs)::text::numeric::real AS "grossProfit"
                from "InvoiceData"
                    `,


                values: [companyId, branches, from, to],
            };

            const resData = await DB.excu.query(query.text, query.values);


            if (resData.rowCount && resData.rowCount > 0) {

                return new ResponseData(true, "", resData.rows)

            } else {
                return new ResponseData(true, "", [])
            }

        } catch (error: any) {
          
            throw new Error(error)
        }


    }

    public static async salesByAggregator(data: any, company: Company) {
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



            const branchId = data.branchId ? data.branchId : null;

            const query: { text: string, values: any } = {
                text: `
                with "values" as ( 
                    select 
                    $1::uuid as "companyId",
                    $2::uuid as "branchId",
                    $3::timestamp as from ,
                    $4::timestamp as to , 
                    $5::int as "afterDecimal"
                ),
                
                "Sales" as (
                SELECT
                    COALESCE("Plugins"."pluginName",'others')as "pluginName",
                    CAST (ROUND(  sum("InvoiceLines"."subTotal")::numeric ,"values"."afterDecimal"::int)as real) as "sales"
                from "InvoiceLines"
                    JOIN "values" on true
                    INNER JOIN "Invoices" ON "InvoiceLines" ."invoiceId" = "Invoices".id
                    INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id
                    LEFT JOIN "Plugins" ON   "Plugins"."pluginName" = "Invoices"."aggregator" 
                WHERE "Branches"."companyId" = "values"."companyId" 
                    AND (("values"."branchId" IS NULL) OR ("values"."branchId" = "Invoices"."branchId"))
                    AND "Invoices"."status" <>'Draft' 
                    AND  "InvoiceLines"."createdAt" >="values".from AND "InvoiceLines"."createdAt" <"values".to
                group by "pluginName", "values"."afterDecimal"
                
                UNION
                
                SELECT
                COALESCE("Plugins"."pluginName",'others')as "pluginName",
                CAST (ROUND(  sum("CreditNoteLines"."subTotal")::numeric ,"values"."afterDecimal"::int)as real) *(-1) as "sales"
                from "CreditNoteLines"
                    JOIN "values" on true
                    INNER JOIN "CreditNotes" ON "CreditNoteLines" ."creditNoteId" = "CreditNotes".id
                    INNER JOIN "Branches" ON "CreditNotes"."branchId" = "Branches".id
                    LEFT JOIN "Invoices" ON "CreditNotes"."invoiceId"  = "Invoices".id
                    LEFT JOIN "Plugins" ON   "Plugins"."pluginName" = "Invoices"."aggregator" 
                WHERE "Branches"."companyId"= "values"."companyId" 
                    AND (("values"."branchId" IS NULL) OR ("values"."branchId" = "CreditNotes"."branchId" ))
                    AND  "CreditNoteLines"."createdAt" >="values".from 
                    AND "CreditNoteLines"."createdAt" <"values".to
                group by "pluginName",  "values"."afterDecimal"
                
                )
                select "pluginName",
                 CAST(ROUND(sum ("sales")::NUMERIC,"values"."afterDecimal"::INT) AS REAL) as "sales"
                FROM "Sales" 
                JOIN "values" ON true
                group by "pluginName",  "values"."afterDecimal"
                
                `,
                values: [companyId, branchId, from, to, afterDecimal]
            }

            let report = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", report.rows)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async monthlyBLDBreakdown(data: any, company: Company) {
        try {

            let companyId = company.id
            let afterDecimal = company.afterDecimal
            // let filter = data.filter;
            // let branches = filter && filter.branches ? filter.branches : null;
            // let date = filter && filter.date ? new Date(filter.date) : null;
            // let year;
            // let month;
            // if(date){
            //     year = date.getFullYear();
            //     month = date.getMonth() ;
            // }else{  
            //     throw new ValidationException("date is required")
            // }
            // //let from = filter && filter.fromDate ? filter.fromDate : null;
            // //let to = filter && filter.toDate ? filter.toDate : null;

            // let breakfastTimeStartAt = filter &&  filter.breakfastTimeStartAt;
            // let lunchTimeStartAt = filter &&  filter.lunchTimeStartAt;
            // let dinnerTimeStartAt = filter &&  filter.dinnerTimeStartAt;

            let branchId = data.branchId ? data.branchId : null;
            let date = data.date ? new Date(data.date) : new Date();
            let breakfastTimeStartAt = data.breakfastTimeStartAt ? data.breakfastTimeStartAt : null;
            let lunchTimeStartAt = data.lunchTimeStartAt ? data.lunchTimeStartAt : null;
            let dinnerTimeStartAt = data.dinnerTimeStartAt ? data.dinnerTimeStartAt : null;

            if (!breakfastTimeStartAt) { throw new ValidationException("breakfastTimeStartAt is required") };
            if (!lunchTimeStartAt) { throw new ValidationException("lunchTimeStartAt is required") };
            if (!dinnerTimeStartAt) { throw new ValidationException("dinnerTimeStartAt is required") };

            if (!date) {
                throw new ValidationException("date is required")
            }


            const query = {
                text: `WITH "lines" AS (
                    SELECT Date("InvoiceLines"."createdAt")  AS "Date",
                    Trim(to_char("InvoiceLines"."createdAt",'Day')) AS "Day",
                    SUM(CASE WHEN "InvoiceLines"."isInclusiveTax" = false THEN (COALESCE("InvoiceLines"."subTotal",0)) else (COALESCE("InvoiceLines"."subTotal",0)- (COALESCE("InvoiceLines"."taxTotal",0))) end ) AS "grossSales",
                    SUM(COALESCE("InvoiceLines"."discountTotal",0)) AS "Discount",
                    SUM(CASE when ("InvoiceLines"."createdAt"::time >= $4::time AND "InvoiceLines"."createdAt"::time < $5::time) then (COALESCE("InvoiceLines"."total",0) - COALESCE("InvoiceLines"."taxTotal",0)) end ) AS "breakfastSales",
                    SUM(CASE when ("InvoiceLines"."createdAt"::time >= $5::time AND "InvoiceLines"."createdAt"::time < $6::time) then (COALESCE("InvoiceLines"."total",0) - COALESCE("InvoiceLines"."taxTotal",0))end ) AS "lunchSales",
                    SUM(CASE when ("InvoiceLines"."createdAt"::time >= $6::time OR "InvoiceLines"."createdAt"::time < $4::time) then (COALESCE("InvoiceLines"."total",0) - COALESCE("InvoiceLines"."taxTotal",0)) end ) AS "dinnerSales",
                    SUM( COALESCE("InvoiceLines"."total",0) - COALESCE("InvoiceLines"."taxTotal",0) ) AS "salesExclVat",
                    SUM(COALESCE("InvoiceLines"."taxTotal",0)) AS "taxTotal",
                    SUM(COALESCE("InvoiceLines"."total",0) )AS "salesInclVat",
                    array_agg(distinct "InvoiceLines"."invoiceId") as ar
                    FROM "InvoiceLines"
                    INNER JOIN "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" AND "InvoiceLines"."createdAt"::date = "Invoices"."invoiceDate"
                    INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id
                    WHERE "Branches"."companyId"= $1 
                    AND (($2::text IS NULL) OR "Branches".id::text = $2::text )
                    AND ("Invoices"."status" <>'Draft'  or ("Invoices"."status" = 'Closed'  and "Invoices"."onlineData"->>'onlineStatus'='Rejected'))
                    AND extract(year from "InvoiceLines"."createdAt") =  extract(year from $3::date) 
                    AND extract(month from "InvoiceLines"."createdAt")= extract(month from $3::date)
                    GROUP BY  "Date","Day"
                    ),
                    
                    "invoices_data" AS (
                    SELECT lines.*,
                    SUM(COALESCE("Invoices"."discountTotal",0)) AS "invoiceDiscount",
                    SUM(COALESCE(NULLIF("Invoices".guests,0),1)) AS guests
                    FROM "lines" 
                    LEFT JOIN "Invoices"  ON  id = any("lines".ar)
                    GROUP BY "Date","Day" ,"grossSales", "Discount", "breakfastSales", "lunchSales", "dinnerSales", "salesExclVat", "taxTotal", "salesInclVat", ar 
                    ORDER BY  "Date"
                    )
                    SELECT Date("Date") , Trim("Day") As "day", 
                    Round("grossSales"::numeric, $7::INT) ::text::real AS "grossSales", 
                    Round("Discount"::numeric,$7::INT)  ::text::real AS "discount",
                    COALESCE( Round("breakfastSales" ::numeric ,$7::INT),0) ::text::real AS "breakfastSales",
                    COALESCE( Round("lunchSales"     ::numeric ,$7::INT),0)  ::text::real AS "lunchSales", 
                    COALESCE( Round("dinnerSales"    ::numeric, $7::INT),0) ::text::real AS "dinnerSales",
                    Round("salesExclVat"  ::numeric,$7::INT)  ::text::real AS "salesExclVat",
                    Round("taxTotal"      ::numeric, $7::INT)  ::text::real AS "taxTotal",
                    Round("salesInclVat" ::numeric,$7::INT)  ::text::real AS "salesInclVat",
                    guests  ::text::real ,
                    Round(("salesExclVat"/ guests)::numeric, $7::INT)  ::text::real AS "avg"
                    FROM "invoices_data" `,
                values: [companyId, branchId, date, breakfastTimeStartAt, lunchTimeStartAt, dinnerTimeStartAt, afterDecimal]
            }

            const records = await DB.excu.query(query.text, query.values);


            return new ResponseData(true, "", records.rows)


        } catch (error: any) {
            console.log(error)
          

            throw new Error(error.message)
        }
    }



    /**new Reports */
    //customers
    public static async journalEntriesReports(data: any, company: Company, branchList: []) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let branches = filter && filter.branches ? filter.branches : branchList;
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };
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

            let columns = ['AccountType', 'reference', 'referenceNumber', 'Debit', 'Credit'];
            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let offset = limit * (page - 1);



            const query = {
                text: `with "values" as (
                select  $1::uuid as "companyId",
                        $2::uuid[] as "branches",
                       $3::timestamp as "fromDate",
                       $4::timestamp as "toDate"
               ), "movments" as (
               select 
                        "InventoryMovmentRecords"."referenceTable",
                        "InventoryMovmentRecords"."code",
                        "InventoryMovmentRecords"."transactionId",
                        "InventoryMovmentRecords"."qty",
                        "InventoryMovmentRecords"."qty" * "InventoryMovmentRecords"."cost" as  "cost",
                        "InventoryMovmentRecords"."branchId",
                        "InventoryMovmentRecords"."createdAt",
                        "InventoryMovmentRecords"."productId",
                        "InventoryMovmentRecords"."companyId"
                        from "InventoryMovmentRecords"
                        JOIN "values" on true
                        WHERE "InventoryMovmentRecords"."companyId" ="values"."companyId" 
                        AND "InventoryMovmentRecords"."referenceTable" <> 'Billing' 
                        AND "InventoryMovmentRecords"."referenceTable" <> 'Supplier Credit' 
                        AND ("values"."branches" is null or "InventoryMovmentRecords"."branchId" is null or "InventoryMovmentRecords"."branchId"=any("values"."branches"))
                        AND "createdAt">="values"."fromDate"  and "createdAt"< "values"."toDate"    
                   
                    
                      ),"allRecords" as (
                        select COALESCE( "movments"."code",  "movments"."referenceTable")  as "referenceNumber",
                          "movments"."transactionId" as "referenceId",
                          "movments"."referenceTable"  as "reference",
                           sum(case when "qty" < 0 then abs("cost") else 0 end) as "Debit",
                           sum(case when "qty" >= 0 then abs("cost") else 0 end) as "Credit",
                          "Accounts".name as "AccountType",
                            "movments"."createdAt" 
                       from "movments"
                       JOIN "values" on true
                       INNER JOIN "Accounts" on "Accounts"."companyId" = "values"."companyId" and "Accounts"."name" = 'Costs Of Goods Sold' and "Accounts"."default" = true
                       INNER join "Branches" on "Branches".id ="movments"."branchId" 
                       AND "movments"."referenceTable" <>   'Opening Balance'
                       group by "movments"."code",  "movments"."transactionId",       "movments"."referenceTable",  "Accounts".name ,  "movments"."createdAt" 
                        union all 
                         select COALESCE( "movments"."code",  "movments"."referenceTable")  as "referenceNumber",
                          "movments"."transactionId" as "referenceId",
                          "movments"."referenceTable"  as "reference",
                           sum(case when "qty" > 0 then abs("cost") else 0 end) as "Debit",
                           sum(case when "qty" < 0 then abs("cost") else 0 end) as "Credit",
                          "Accounts".name as "AccountType",
                              "movments"."createdAt"
                       from "movments"
                            JOIN "values" on true
                       INNER JOIN "Accounts" on "Accounts"."companyId" = "values"."companyId" and  "Accounts".name = 'Inventory Assets'    and "default" = true
                       INNER join "Branches" on "Branches".id ="movments"."branchId" 
                              group by "movments"."code",  "movments"."transactionId",        "movments"."referenceTable",  "Accounts".name  ,  "movments"."createdAt" 
                        union all 
                                  SELECT
           
                 "JournalRecords".code as "referenceNumber",
                 "JournalRecords"."referenceId",
                 "JournalRecords"."dbTable" as "reference",
                 case when ("JournalRecords".amount>0) then "JournalRecords".amount::numeric else 0 end as "Debit",
                 case when ("JournalRecords".amount<0) then abs("JournalRecords".amount::numeric) else 0 end as "Credit",
                 "JournalRecords".name as "AccountType",
                       "JournalRecords"."createdAt" 
               FROM "JournalRecords"
               JOIN "values" on True
               inner join "Accounts" on "Accounts".id = "JournalRecords"."accountId"
               WHERE "JournalRecords"."companyId" ="values"."companyId" 
               AND ("values"."branches" is null or "JournalRecords"."branchId" is null or "JournalRecords"."branchId"=any("values"."branches"))
               AND "JournalRecords"."createdAt">="values"."fromDate"  and "JournalRecords"."createdAt"< "values"."toDate"   
               AND "JournalRecords".amount <>0
                     and  (("Accounts".name <> 'Costs Of Goods Sold' )  or  "dbTable" not  in ('Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment'))
                               and  (("Accounts".name <> 'Inventory Assets')  or  "dbTable" not  in ('Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment'))

               GROUP BY    "JournalRecords".name ,   "JournalRecords"."referenceId","JournalRecords".code, "JournalRecords"."dbTable" ,"JournalRecords".amount ,"JournalRecords"."createdAt" 
                 ),"records" as (
                        select 
                               count(*) over() as "count",
                               "referenceNumber",
                                "referenceId",
                                "reference",
                                "Debit",
                                "Credit",
                                sum("Debit") over() as "totalDebit",
                                sum("Credit") over() as "totalCredit",
                                "AccountType"
                           from "allRecords"                        
                        order by "referenceId" DESC , "createdAt" DESC
               `,
                values: [companyId, branches, from, to]
            }

            let limitQuery = filter.export && filter.export === true ? ')  select * from "records"'
                : `limit ${limit}
                                                                        offset ${offset}
                                                                        )  
                                                                         select * from "records" `




            console.log(query.text + limitQuery, query.values)
            const records = await DB.excu.query(query.text + limitQuery, query.values);
            let count = records.rows && records.rows.length > 0 ? (<any>records.rows[0]).count : 0
            let totalCredit = records.rows && records.rows.length > 0 ? (<any>records.rows[0]).totalCredit : 0
            let totalDebit = records.rows && records.rows.length > 0 ? (<any>records.rows[0]).totalDebit : 0
            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (records.rows.length < limit || page == pageCount) {
                lastIndex = count
            }
            let resData = {
                records: records.rows,
                columns: columns,
                count: count,
                total: { "totalCredit": totalCredit, "totalDebit": totalDebit },
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Journal Entries",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'AccountType' },
                { key: 'reference' },
                { key: 'referenceNumber' },
                { key: 'Debit', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'Credit', header: "Sales Average", properties: { hasTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'journalEntries'
                return new ResponseData(true, "", report)
            }



            return new ResponseData(true, "", resData)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async categorizeInvoices(maxAge: number, bills: any[]) {
        try {

            for (let bill of bills) {
                const ageRange = `${Math.floor(bill.Age / 15) * 15 + 1} - ${Math.floor(bill.Age / 15) * 15 + 15} Days`;
                bill.category = ageRange
            }


            return new ResponseData(true, "", "")
        } catch (error: any) {

            throw new Error(error)
        }
    }

    public static async customerAgingReport(data: any, company: Company, brancheList: []) {
        try {


            let companyId = company.id;

            //--------------  filter  --------------
            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;

            let customerId = filter && filter.customerId ? filter.customerId : null;
            let customerIds = filter && filter.customerIds && Array.isArray(filter.customerIds) ? filter.customerIds : null;
            let searchTerm = filter.searchTerm ? `^.*` + filter.searchTerm.toLowerCase() + `.*$` : null

            const type = filter && filter.type ? filter.type : null
            let typefilter = ' LEFT JOIN "Customers" on "Customers".id =  "Invoices"."customerId" '
            if (type == 'Individual') { typefilter = ` JOIN "Customers" on "Customers".id =  "Invoices"."customerId"  and "Customers".type = 'Individual' ` }
            else if (type == 'Business') { typefilter = ` JOIN "Customers" on "Customers".id =  "Invoices"."customerId"  and "Customers".type = 'Business'   ` }


            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? filter.fromDate : null;
            fromDate = moment(new Date(fromDate))
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            let asOf = filter && filter.allowAsOf ? filter.allowAsOf : false
            if (asOf == true) { from = null }


            const range = filter.range ?? 3;
            const rangeOf = filter.rangeOf ?? 15;
            const rangeUnit = filter.rangeUnit ?? "days"
            const ranges = this.generateRanges(rangeOf, range, rangeUnit);



            ///intervalUnit: 'days' | 'weeks' | 'months';


            //---------------------------------------
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };
            let columns = ['Date', 'InvoiceNumber', 'Status', 'CustomerName', 'Age', 'Amount', 'BalanceDue'];
            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);

            let offset = limit * (page - 1);

            // let offset =0;
            // if (page != 1) {
            //     offset = (limit * (page - 1))
            // }


            const query = {
                text: `with "values" as (
                    select  $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::uuid as "customerId",
                            $4::timestamp as "fromDate",
                            $5::timestamp as "toDate",
                            $6 as "searchValues",
                            $7::uuid[] as "customerIds"
                   ),"invoiceList" AS(
                                   select 
                                       "Invoices".id,
                                       "Invoices"."invoiceNumber" As "InvoiceNumber" ,
                                       "Invoices".total,
                                       "Customers".id as "customerId",
                                       COALESCE("Customers"."name",'Walkin Customer') as "CustomerName",
                                       "Invoices"."invoiceDate" as "Date",
                                       case when "Invoices"."dueDate" is null then "Invoices"."invoiceDate" else "Invoices"."dueDate" END as "dueDate"
                                       from "Invoices" 
                                   JOIN "values" ON TRUE
                                    ${typefilter}
                                   WHERE "Invoices"."companyId" = "values"."companyId" 
                                   AND( "values"."branches" IS NULL OR "Invoices"."branchId" = any( "values"."branches"))
                                          AND "Invoices"."status" <>'Draft'
                                          AND "Invoices"."status" <>'Paid'
                                          AND "Invoices"."status" <>'Closed'
                                   and (array_length("values"."customerIds",1) IS null or "Invoices"."customerId" = any("values"."customerIds")  )
                                   AND ("values"."customerId" IS NULL OR "Invoices"."customerId" = "values"."customerId")
                                   AND  ("values"."fromDate" IS NULL OR "Invoices"."invoiceDate" >="values"."fromDate") 
                                   AND  ("values"."toDate" IS NULL OR "Invoices"."invoiceDate"<"values"."toDate")
                                   AND ( ("values"."searchValues" is null) or (LOWER("Customers".name) ~ "values"."searchValues")or (LOWER("Customers".phone) ~ "values"."searchValues") or (LOWER("Customers".mobile) ~ "values"."searchValues") 
                                   or (LOWER("Invoices"."invoiceNumber") ~ "values"."searchValues"))
                                   
                   ),
                               "creditNotes" as (
                               select COALESCE(sum("CreditNotes"."total"::numeric),0) as total, "invoiceList".id from "CreditNotes" left join "invoiceList" on "invoiceList".id = "CreditNotes"."invoiceId"
                               group by "invoiceList".id
                               ),
                               "appliedCredit" as (
                               select COALESCE(sum("AppliedCredits"."amount"::numeric),0)as total,"invoiceList".id from "AppliedCredits" left join "invoiceList" on "invoiceList".id = "AppliedCredits"."invoiceId"
                               group by "invoiceList".id
                               ),
                               "payments" as (
                               select COALESCE(sum("InvoicePaymentLines"."amount"::numeric),0)as total,"invoiceList".id from "InvoicePaymentLines" left join "invoiceList" on "invoiceList".id = "InvoicePaymentLines"."invoiceId"
                                   group by "invoiceList".id
                               )
                               , "aging_raw" as (
                               select 
                                count(*) over() AS "count",
                                "invoiceList".id,
                                "invoiceList"."InvoiceNumber",
                                 "invoiceList"."customerId",
                                 "invoiceList"."Date",
                                "invoiceList"."CustomerName",
                                "invoiceList"."dueDate",
                                'Overdue' as "Status",
                             CASE
                            WHEN $9::text = 'weeks' THEN
                                ((current_date - "invoiceList"."dueDate"::date) + 1)::numeric / 7

                            WHEN $9::text = 'months' THEN
                                (
                                    EXTRACT(YEAR FROM AGE(current_date, "invoiceList"."dueDate"::date))::int * 12
                                    +
                                    EXTRACT(MONTH FROM AGE(current_date,"invoiceList"."dueDate"::date))::int
                                )::numeric

                            ELSE
                                ((current_date - "invoiceList"."dueDate"::date) + 1)::numeric
                        END AS "Age" ,
                                "invoiceList".total as "Amount",
                             cast (  (("invoiceList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric as real) as "BalanceDue"
                               from "invoiceList"
                               left join "creditNotes" on "creditNotes".id = "invoiceList".id 
                               left join "appliedCredit" on "appliedCredit".id = "invoiceList".id 
                               left join "payments" on "payments".id = "invoiceList".id 
                               group by "invoiceList".id,
                                        "invoiceList"."InvoiceNumber",
                                        "invoiceList"."CustomerName",
                                        "invoiceList"."Date",
                                        "invoiceList"."customerId",
                                        "invoiceList"."dueDate",
                                      
                                         "invoiceList".total,
                                         "creditNotes".total,
                                         "appliedCredit".total,
                                         "payments".total
                                                    
                               having (("invoiceList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric >0
                   
                               order by  "invoiceList"."dueDate" asc)
                            , "aging" as (
                                select *
                                from "aging_raw"
                         
                                where "Age" >= 0
                                `,
                values: [companyId, branches, customerId, from, to, searchTerm, customerIds, JSON.stringify(ranges), rangeUnit]
            }

            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`



            let queryText = ` ${query.text + limitQuery}) ` + `, "ranges" as(
                   
                   select el->>'min' as "min",
                          el->>'max' as "max",
                          el->>'label' as "label"
                   from JSON_ARRAY_ELEMENTS($8::JSON) el 
                   ),"groups" as(
                  select "aging".*,
                           "ranges".label,
                            "ranges"."min"
                   from "ranges"
                   left join "aging" on "aging"."Age" >= "ranges"."min"::int
                    AND (
                        "ranges"."max" IS NULL
                        OR "aging"."Age" <= "ranges"."max"::int
                    )
                   ) 
                   select 
                         "label",
                         "count",
                         JSON_AGG(JSON_BUILD_OBJECT('id',"id",
                                                     'InvoiceNumber',"InvoiceNumber",
                                                     'CustomerName',"CustomerName",
                                                     'Date',"Date",
                                                     'customerId',"customerId",
                                                     'dueDate',"dueDate",
                                                     'Status',"Status",
                                                     'Age',"Age",
                                                     'Amount',"Amount",
                                                     'BalanceDue',"BalanceDue")) "agingGroups"
                   from "groups"
                   group by "label","count","groups"."min"
                   order by   "groups"."min" asc
                  
                              
                  `



            let records = await DB.excu.query(queryText, query.values)

            let countData = records.rows.find(f => f.count);
            let count = countData && countData.count ? countData.count : 0
            let pageCount = Math.ceil(count / limit)
            // this.categorizeInvoices(Math.max(...records.rows.map((f: any) => f.Age)), records.rows)

            offset += 1
            let lastIndex = ((page) * limit)
            records.rows = records.rows.map(m => {
                m.agingGroups = m.agingGroups.filter((f: any) => f.CustomerName);
                return m
            })
            const totalLength = records.rows.reduce((sum: number, item: any) => sum + item.agingGroups.length, 0);


            if (totalLength < limit || page == pageCount) {
                lastIndex = count
            }
            let resData = {
                records: records.rows,
                columns: columns,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }


            if (filter.export) {
                records.rows.sort(this.dynamicSortMultiple("Age", "Date"));
                this.agingReportCategorization(Math.max(...records.rows.map((f: any) => f.Age)), records.rows)
                let report = new ReportData()
                report.filter = {
                    title: "Customer Aging Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'Date', properties: { groupBy: 'horizantal' } },
                { key: 'InvoiceNumber' }, { key: 'Status' }, { key: 'CustomerName' },
                { key: 'Age' },
                { key: 'Amount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'BalanceDue', properties: { hasTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'customerAgingReport'
                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {

            throw new Error(error)
        }
    }
    public static generateRanges(days: number, count: number, rangeUnit: string) {
        const ranges = [];

        for (let i = 0; i < count; i++) {
            if (i === count - 1) {
                ranges.push({
                    label: `> ${i * days} ${rangeUnit}`,
                    min: i * days + 1,
                    max: null,

                });
            } else {
                ranges.push({
                    label: `${i * days + 1} - ${(i + 1) * days} ${rangeUnit}`,
                    min: i * days + 1,
                    max: (i + 1) * days
                });
            }
        }

        return ranges;
    }

    public static async customerAgingReportSummary(data: any, company: Company, brancheList: []) {
        try {


            let companyId = company.id;


            //-------------- filter --------------
            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let customerIds = filter && filter.customerIds && Array.isArray(filter.customerIds) ? filter.customerIds : null

            customerIds = filter && filter.customerId ? [filter.customerId] : null;
            let searchTerm = filter.searchTerm ? `^.*` + filter.searchTerm.toLowerCase() + `.*$` : null

            const type = filter && filter.type ? filter.type : null
            let typefilter = ' LEFT JOIN "Customers" on "Customers".id =  "Invoices"."customerId" '
            if (type == 'Individual') { typefilter = ` JOIN "Customers" on "Customers".id =  "Invoices"."customerId"  and "Customers".type = 'Individual' ` }
            else if (type == 'Business') { typefilter = ` JOIN "Customers" on "Customers".id =  "Invoices"."customerId"  and "Customers".type = 'Business'   ` }


            const range = filter.range ?? 3;
            const rangeOf = filter.rangeOf ?? 15;
            const rangeUnit = filter.rangeUnit ?? "days"
            const ranges = this.generateRanges(rangeOf, range, rangeUnit);





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
            let columns: any[] = [];


            // const page = filter && filter.page ? filter.page : 1;
            // const limit = filter && filter.limit ? filter.limit : 50;

            // let offset = limit * (page - 1);

            const query = {
                text: `with "values" as (
                    select  $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::timestamp as "fromDate",
                            $4::timestamp as "toDate",
                            
                            $5 as "searchValues",
                            $6::uuid[] as "customerIds"
                   ),"invoiceList" AS(
                                   select count(*) over(),
                                       "Invoices".id,
                                       "Invoices"."invoiceNumber",
                                       "Invoices".total,
                                       "Customers".id as "customerId",
                                       COALESCE("Customers"."name",'Walkin Customer') as "customerName",
                                       "Invoices"."invoiceDate",
                                       case when "Invoices"."dueDate" is null then "Invoices"."invoiceDate" else "Invoices"."dueDate" END as "dueDate"
                                       from "Invoices" 
                                   JOIN "values" ON TRUE
                              
                                   ${typefilter}
                                   WHERE "Invoices"."companyId" = "values"."companyId" 
                                  
                                   AND( "values"."branches" IS NULL OR "Invoices"."branchId" = any( "values"."branches"))
                                   AND "Invoices"."status" <>'Draft'
                                   AND "Invoices"."status" <>'Closed'
                                   AND "Invoices"."status" <>'Paid'
                                   AND (array_length("values"."customerIds",1) IS null or "Invoices"."customerId" = any("values"."customerIds")  )
                                  
                                   AND  ("values"."fromDate" IS NULL OR "Invoices"."createdAt" >="values"."fromDate") 
                                   AND  ("values"."toDate" IS NULL OR "Invoices"."createdAt"<"values"."toDate") 
                                   AND ( ("values"."searchValues" is null) or (LOWER("Customers".name) ~ "values"."searchValues")or (LOWER("Customers".phone) ~ "values"."searchValues") or (LOWER("Customers".mobile) ~ "values"."searchValues") )
                                   
                   
                   ),
                   "creditNotes" as (
                   select COALESCE(sum("CreditNotes"."total"::numeric),0) as total, "invoiceList".id from "CreditNotes" left join "invoiceList" on "invoiceList".id = "CreditNotes"."invoiceId"
                   group by "invoiceList".id
                   ),
                   "appliedCredit" as (
                   select COALESCE(sum("AppliedCredits"."amount"::numeric),0)as total,"invoiceList".id from "AppliedCredits" left join "invoiceList" on "invoiceList".id = "AppliedCredits"."invoiceId"
                   group by "invoiceList".id
                   ),
                   "payments" as (
                   select COALESCE(sum("InvoicePaymentLines"."amount"::numeric),0)as total,"invoiceList".id from "InvoicePaymentLines" left join "invoiceList" on "invoiceList".id = "InvoicePaymentLines"."invoiceId"
                       group by "invoiceList".id
                   ), "aging" as(
                   select 
                    "invoiceList".id,
                    "invoiceList"."invoiceNumber",
                     "invoiceList"."customerId",
                    "invoiceList"."customerName",
                    "invoiceList"."dueDate",
                      CASE
                            WHEN $8::text = 'weeks' THEN
                                ((current_date - "invoiceList"."dueDate"::date) + 1)::numeric / 7

                            WHEN $8::text = 'months' THEN
                                (
                                    EXTRACT(YEAR FROM AGE(current_date, "invoiceList"."dueDate"::date))::int * 12
                                    +
                                    EXTRACT(MONTH FROM AGE(current_date,"invoiceList"."dueDate"::date))::int
                                )::numeric

                            ELSE
                                ((current_date - "invoiceList"."dueDate"::date) + 1)::numeric
                        END AS  age ,
                    "invoiceList".total as amount,
                   (("invoiceList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric as "balanceDue"
                   from "invoiceList"
                   left join "creditNotes" on "creditNotes".id = "invoiceList".id 
                   left join "appliedCredit" on "appliedCredit".id = "invoiceList".id 
                   left join "payments" on "payments".id = "invoiceList".id 
                   group by "invoiceList".id,
                            "invoiceList"."invoiceNumber",
                            "invoiceList"."customerName",
                            "invoiceList"."customerId",
               
                            "invoiceList"."dueDate",
                             "invoiceList".total,
                             "creditNotes".total,
                             "appliedCredit".total,
                             "payments".total
                   having (("invoiceList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric >0
                 
                   ), "ranges" as(
                   
                   select el->>'min' as "min",
                          el->>'max' as "max",
                          el->>'label' as "label"
                   from JSON_ARRAY_ELEMENTS($7::JSON) el 
                   ),"groups" as(
                  select "aging"."customerId",
                          "aging"."customerName",
                           cast( sum("balanceDue"::numeric) as real) as "total",
                           "ranges".label 
                   from "aging"
                   left join "ranges" on  "aging"."age" >=0 and "aging"."age" >= "ranges"."min"::int
                        AND (
                            "ranges"."max" IS NULL
                            OR "aging"."age" <= "ranges"."max"::int
                        )
               
                   group by "aging"."customerId",
                          "aging"."customerName",   "ranges".label 
                   ) 
                   select 
                        "customerId",
                        "customerName",
                         JSON_AGG(JSON_BUILD_OBJECT('label',"label",'total',"total")) "agingGroups"
                   from "groups"
                   group by "customerId",
                            "customerName"
                  
                   `,
                values: [companyId, branches, from, to, searchTerm, customerIds, JSON.stringify(ranges), rangeUnit]
            }

            // let selectQuery = filter.export && filter.export === true ?
            //     `select "aging"."customerId",
            //               "aging"."customerName",
            // 				sum(case when age BETWEEN 1 and 15 then "balanceDue"::numeric else 0 end) as "1-15 Days" ,
            // 				sum(case when age BETWEEN 16 and 30 then "balanceDue"::numeric else 0 end) as "16-30 Days" ,
            // 				sum(case when age BETWEEN 31 and 45 then "balanceDue"::numeric else 0 end) as "31-45 Days" ,
            // 				sum(case when age > 45 then "balanceDue"::numeric else 0 end) as ">45 Days" ,
            //            		cast( sum("balanceDue"::numeric) as real) as "total"
            //         from "aging" 
            //         group by "aging"."customerId","aging"."customerName"` :

            //     `select count(*) over(),
            //               "aging"."customerId",
            //               "aging"."customerName",
            //               "aging"."age"as age ,
            //            cast( sum("balanceDue"::numeric) as real) as "total"
            //        from "aging" 
            //        group by "aging"."customerId","aging"."customerName", "aging"."age"`

            const records = await DB.excu.query(query.text, query.values);
            let resRecords = records.rows && records.rows.length > 0 ? records.rows : []

            // resRecords = resRecords.map(m => {
            //     m.agingGroups = m.agingGroups.filter((f: any) => f.customerName) ?? []
            //     return m
            // })
                        const tempRanges = ranges.map(m => m.label)

            if (filter.export) {

                let report = new ReportData()
                report.filter = {
                    title: "Customer Aging Summary Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = resRecords
                report.columns = [
                    { key: 'Date', properties: { columnType: 'date', groupBy: true } },
                    { key: 'InvoiceNumber' },
                    { key: 'Status' },
                    { key: 'CustomerName' },
                    { key: 'Age' },
                    { key: 'Amount', properties: { hasTotal: true, columnType: 'currency' } },
                    { key: 'BalanceDue', properties: { hasTotal: true, columnType: 'currency' } },
                ]
                report.fileName = 'CustomerAgingSummaryReport'
                return new ResponseData(true, "", {
                    records: resRecords,
                    ranges: tempRanges,
                    filter: report.filter,
                    options: {
                        idKey: "customerId",      // 'supplierId' | 'customerId'
                        nameKey: "customerName",   // 'supplierName' | 'customerName'
                        headerLabel: "Customer", // 'Supplier' | 'Customer'
                        fileName: "CustomerAgingSummaryReport"
                    },
                    showFilter: true
                })
            }

            // let count = records.rows && records.rows.length > 0 ? Number((<any>records.rows[0]).count) : 0
            //let pageCount = Math.ceil(count / limit)

            // offset += 1
            // let lastIndex = ((page) * limit)
            // if (records.rows.length < limit || page == pageCount) {
            //     lastIndex = count
            // }

            let resData = {
                records: resRecords,
                columns: columns,
                ranges: tempRanges
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    //suppliers

    public static dynamicSort(property: string) {
        var sortOrder = 1;
        if (property[0] === "-") {
            sortOrder = -1;
            property = property.substr(1);
        }
        return function (a: { [x: string]: number; }, b: { [x: string]: number; }) {
            /* next line works with strings and numbers, 
             * and you may want to customize it to your needs
             */
            var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
            return result * sortOrder;
        }
    }

    //suppliers
    public static dynamicSortMultiple(p0: string, p1: string) {
        /*
         * save the arguments object as it will be overwritten
         * note that arguments object is an array-like object
         * consisting of the names of the properties to sort by
         */
        var props = arguments;
        return function (obj1: any, obj2: any) {
            var i = 0, result = 0, numberOfProperties = props.length;
            /* try getting a different result from 0 (equal)
             * as long as we have extra properties to compare
             */
            while (result === 0 && i < numberOfProperties) {
                result = ReportRepo.dynamicSort(props[i])(obj1, obj2);
                i++;
            }
            return result;
        }
    }

    public static async supplierAgingReport(data: any, company: Company, brancheList: []) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let supplierIds = filter && filter.supplierIds && Array.isArray(filter.supplierIds) ? filter.supplierIds : null

            let supplierId = filter && filter.supplierId ? filter.supplierId : null;
            let searchTerm = filter.searchTerm ? `^.*` + filter.searchTerm.toLowerCase() + `.*$` : null

            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : null;

            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            let asOf = filter && filter.allowAsOf ? filter.allowAsOf : false
            if (asOf == true) { from = null }

            const range = filter.range ?? 3;
            const rangeOf = filter.rangeOf ?? 15;
            const rangeUnit = filter.rangeUnit ?? "days"
            const ranges = this.generateRanges(rangeOf, range, rangeUnit);
            //---------------------------------------
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };
            let columns = ['Date', 'billingNumber', 'Status', 'SupplierName', 'Age', 'Amount', 'BalanceDue'];
            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let offset = limit * (page - 1);

            const query = {
                text: `with "values" as (
                    select  $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::uuid as "supplierId",
                            $4::timestamp as "fromDate",
                            $5::timestamp as "toDate",
                            $6 as "searchValues",
                            $7::uuid[] as "supplierIds"
                   ),"billingList" AS(
                                   select
                                       
                                       "Billings".id,
                                       "Billings"."billingNumber" ,
                                       "Billings".total,
                                       "Suppliers".id as "supplierId",
                                       "Suppliers"."name" as "SupplierName",
                                       "Billings"."billingDate" as "Date",
                                       'Overdue' as "status",
                                       "Billings"."dueDate"
                                       from "JournalRecords" 
                                   JOIN "values" on true
                                   INNER JOIN "Accounts" on "Accounts".id = "JournalRecords"."accountId" and "type" = 'Account Payable' and "parentType" = 'Current Liabilities'
                                   INNER JOIN "Billings" on  "Billings".id = "JournalRecords"."referenceId" and "dueDate" is not null
                                   INNER JOIN "Suppliers" on "Suppliers".id =  "Billings"."supplierId"
                                   WHERE "JournalRecords"."companyId" = "values"."companyId" 
                                   AND "Billings"."status" <>'Draft'
                                   AND( "values"."branches" IS NULL OR "Billings"."branchId" = any( "values"."branches"))
                                   and (array_length("values"."supplierIds",1) IS null or "Suppliers".id = any("values"."supplierIds")  )
                                   AND( "values"."supplierId" IS NULL OR "Billings"."supplierId" = "values"."supplierId")
                                   AND  ("values"."fromDate" IS NULL OR "JournalRecords"."createdAt" >="values"."fromDate") 
                                   AND  ("values"."toDate" IS NULL OR "JournalRecords"."createdAt"<"values"."toDate") 
                                   AND ( ("values"."searchValues" is null) or (LOWER("Suppliers".name) ~ "values"."searchValues")or (LOWER("Suppliers".phone) ~ "values"."searchValues")  )                
                   ),
                             "creditNotes" as (
                               select COALESCE(sum("SupplierCredits"."total"::numeric),0) as total, "billingList".id from "SupplierCredits" left join "billingList" on "billingList".id = "SupplierCredits"."billingId"
                               group by "billingList".id
                               ),
                               "appliedCredit" as (
                               select COALESCE(sum("SupplierAppliedCredits"."amount"::numeric),0)as total,"billingList".id from "SupplierAppliedCredits" left join "billingList" on "billingList".id = "SupplierAppliedCredits"."billingId"
                               group by "billingList".id
                               ),
                               "payments" as (
                               select COALESCE(sum("BillingPaymentLines"."amount"::numeric),0)as total,"billingList".id from "BillingPaymentLines" left join "billingList" on "billingList".id = "BillingPaymentLines"."billingId"
                                   group by "billingList".id
                               )
                                   , "aging_raw" as (
                               select 
                                count (*) over(), 
                                "billingList".id,
                                "billingList"."billingNumber",
                                 "billingList"."supplierId",
                                "billingList"."SupplierName",
                                "billingList"."Date",
                                "billingList"."dueDate",
                                'Overdue' as "Status",
                                  CASE
                            WHEN $9::text = 'weeks' THEN
                                ((current_date - "billingList"."dueDate"::date) + 1)::numeric / 7

                            WHEN $9::text = 'months' THEN
                                (
                                    EXTRACT(YEAR FROM AGE(current_date, "billingList"."dueDate"::date))::int * 12
                                    +
                                    EXTRACT(MONTH FROM AGE(current_date,"billingList"."dueDate"::date))::int
                                )::numeric

                            ELSE
                                ((current_date - "billingList"."dueDate"::date) + 1)::numeric
                        END AS  "Age" ,
                                "billingList".total as "Amount",
                              cast ( (("billingList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric as real)  as "BalanceDue"
                               from "billingList"
                               left join "creditNotes" on "creditNotes".id = "billingList".id 
                               left join "appliedCredit" on "appliedCredit".id = "billingList".id 
                               left join "payments" on "payments".id = "billingList".id 
                               group by "billingList".id,
                                        "billingList"."billingNumber",
                                        "billingList"."SupplierName",
                                        "billingList"."Date",
                                        "billingList"."supplierId",
                                        "billingList"."dueDate",
                                      
                                         "creditNotes".total,
                                         "appliedCredit".total,
                                         "payments".total,
                                         "billingList".total
                               having (("billingList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric >0
            ), "aging" as (
                                select *
                                from "aging_raw"
                         
                                where "Age" >= 0
                               `,
                values: [companyId, branches, supplierId, from, to, searchTerm, supplierIds, JSON.stringify(ranges), rangeUnit]


            }

            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`

            let queryText = ` ${query.text + limitQuery}) ` + `, "ranges" as(
                   
                   select el->>'min' as "min",
                          el->>'max' as "max",
                          el->>'label' as "label"
                   from JSON_ARRAY_ELEMENTS($8::JSON) el 
                   ),"groups" as(
                  select "aging".*,
                           "ranges".label ,
                            "min"
                   from "ranges"
                   left join "aging" on "aging"."Age" >= "ranges"."min"::int
                    AND (
                        "ranges"."max" IS NULL
                        OR "aging"."Age" <= "ranges"."max"::int
                    )
                   ) 
                   select 
                         "label",
                         "count",
                         "min",
                         JSON_AGG(JSON_BUILD_OBJECT('id',"id",
                                                     'billingNumber',"billingNumber",
                                                     'SupplierName',"SupplierName",
                                                     'Date',"Date",
                                                     'supplierId',"supplierId",
                                                     'dueDate',"dueDate",
                                                     'Status',"Status",
                                                     'Amount',"Amount",
                                                     'Age',"Age",
                                                     'BalanceDue',"BalanceDue")) "agingGroups"
                   from "groups"
                   group by "label","count","min"
                   order by "min" asc 
                  
                              
                  `
            let records = await DB.excu.query(queryText, query.values)

            let countData = records.rows.find(f => f.count);
            let count = countData && countData.count ? countData.count : 0
            let pageCount = Math.ceil(count / limit)
            // this.categorizeInvoices(Math.max(...records.rows.map((f: any) => f.Age)), records.rows)

            offset += 1
            let lastIndex = ((page) * limit)
            records.rows = records.rows.map(m => {
                m.agingGroups = m.agingGroups.filter((f: any) => f.SupplierName);
                return m
            })
            const totalLength = records.rows.reduce((sum: number, item: any) => sum + item.agingGroups.length, 0);


            if (totalLength < limit || page == pageCount) {
                lastIndex = count
            }

            if (filter.export) {
                records.rows.sort(this.dynamicSortMultiple("Age", "Date"));
                this.agingReportCategorization(Math.max(...records.rows.map((f: any) => f.Age)), records.rows)
                let report = new ReportData()
                report.filter = {
                    title: "Supplier Aging Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'Date', properties: { groupBy: 'horizantal' } },
                { key: 'billingNumber' }, { key: 'Status' }, { key: 'SupplierName' },
                { key: 'Age' },
                { key: 'Amount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'BalanceDue', properties: { hasTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'SupplierAgingReport'
                return new ResponseData(true, "", report)
            }

            let resData = {
                records: records.rows,
                columns: columns,
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

    public static async supplierAgingReportSummary(data: any, company: Company, brancheList: []) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let supplierIds = filter && filter.supplierIds && Array.isArray(filter.supplierIds) ? filter.supplierIds : null

            let supplierId = filter && filter.supplierId ? filter.supplierId : null;
            let searchTerm = filter.searchTerm ? `^.*` + filter.searchTerm.toLowerCase() + `.*$` : null
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : null;

            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to

            const range = filter.range ?? 3;
            const rangeOf = filter.rangeOf ?? 15;
            const rangeUnit = filter.rangeUnit ?? "days"
            const ranges = this.generateRanges(rangeOf, range, rangeUnit);
            //---------------------------------------
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };
            let columns: any = [];

            const query = {
                text: `with "values" as (
                    select  $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::timestamp as "fromDate",
                            $4::timestamp as "toDate",
                            $5 as "searchValues",
                            $6::uuid[] as "supplierIds"


                   ),"billingList" AS(
                                   select "Billings".id,
                                       "Billings"."billingNumber",
                                       "Billings".total,
                                       "Suppliers".id as "supplierId",
                                       "Suppliers"."name" as "supplierName",
                                       "Billings"."billingDate",
                                       'Overdue' as "status",
                                       "Billings"."dueDate"
                                       from "JournalRecords" 
                                   JOIN "values" on true
                                   INNER JOIN "Accounts" on "Accounts".id = "JournalRecords"."accountId" and "type" = 'Account Payable' and "parentType" = 'Current Liabilities'
                                   INNER JOIN "Billings" on  "Billings".id = "JournalRecords"."referenceId" and "dueDate" is not null
                                   INNER JOIN "Suppliers" on "Suppliers".id =  "Billings"."supplierId"
                                   WHERE "JournalRecords"."companyId" = "values"."companyId" 
                                   AND "Billings"."status" <>'Draft'
                                   AND( "values"."branches" IS NULL OR "Billings"."branchId" = any( "values"."branches"))
                                   and (array_length("values"."supplierIds",1) IS null or "Suppliers".id = any("values"."supplierIds")  )
                                   AND  ("values"."fromDate" IS NULL OR "JournalRecords"."createdAt" >="values"."fromDate") 
                                   AND  ("values"."toDate" IS NULL OR "JournalRecords"."createdAt"<"values"."toDate") 
                                   AND ( ("values"."searchValues" is null) or (LOWER("Suppliers".name) ~ "values"."searchValues")or (LOWER("Suppliers".phone) ~ "values"."searchValues")  )

                   ), "creditNotes" as (
                    select COALESCE(sum("SupplierCredits"."total"::numeric),0) as total, "billingList".id from "SupplierCredits" left join "billingList" on "billingList".id = "SupplierCredits"."billingId"
                    group by "billingList".id
                    ),
                    "appliedCredit" as (
                    select COALESCE(sum("SupplierAppliedCredits"."amount"::numeric),0)as total,"billingList".id from "SupplierAppliedCredits" left join "billingList" on "billingList".id = "SupplierAppliedCredits"."billingId"
                    group by "billingList".id
                    ),
                    "payments" as (
                    select COALESCE(sum("BillingPaymentLines"."amount"::numeric),0)as total,"billingList".id from "BillingPaymentLines" left join "billingList" on "billingList".id = "BillingPaymentLines"."billingId"
                        group by "billingList".id
                    ), "aging" as(
                    select 
                     "billingList".id,
                     "billingList"."billingNumber",
                      "billingList"."supplierId",
                     "billingList"."supplierName",
                     "billingList"."dueDate",
                   CASE
                            WHEN $8::text = 'weeks' THEN
                                ((current_date - "billingList"."dueDate"::date) + 1)::numeric / 7

                            WHEN $8::text = 'months' THEN
                                (
                                    EXTRACT(YEAR FROM AGE(current_date, "billingList"."dueDate"::date))::int * 12
                                    +
                                    EXTRACT(MONTH FROM AGE(current_date,"billingList"."dueDate"::date))::int
                                )::numeric

                            ELSE
                                ((current_date - "billingList"."dueDate"::date) + 1)::numeric
                        END  as age ,
                     "billingList".total as amount,
                    (("billingList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric as "balanceDue"
                    from "billingList"
                    left join "creditNotes" on "creditNotes".id = "billingList".id 
                    left join "appliedCredit" on "appliedCredit".id = "billingList".id 
                    left join "payments" on "payments".id = "billingList".id 
                    group by "billingList".id,
                             "billingList"."billingNumber",
                             "billingList"."supplierName",
                             "billingList"."supplierId",
                
                             "billingList"."dueDate",
                              "billingList".total,
                              "creditNotes".total,
                              "appliedCredit".total,
                              "payments".total
                    having (("billingList".total::numeric ) - (COALESCE("creditNotes".total::numeric,0) +COALESCE("appliedCredit".total::numeric,0)+COALESCE("payments".total::numeric,0)  ))::numeric >0
                   
                    )   , "ranges" as(
                   
                   select el->>'min' as "min",
                          el->>'max' as "max",
                          el->>'label' as "label"
                   from JSON_ARRAY_ELEMENTS($7::JSON) el 
                   ),"groups" as(
                  select "aging"."supplierId",
                          "aging"."supplierName",
                           cast( sum("balanceDue"::numeric) as real) as "total",
                           "ranges".label 
                   from "aging"
                   left join "ranges" on   "aging"."age" >=0 and "aging"."age" >= "ranges"."min"::int
                        AND (
                            "ranges"."max" IS NULL
                            OR "aging"."age" <= "ranges"."max"::int
                        )
               
                   group by "aging"."supplierId",
                            "aging"."supplierName", 
                            "ranges".label 
                   ) 
                   select 
                         "supplierId",
                         "supplierName",
                         JSON_AGG(JSON_BUILD_OBJECT('label',"label",'total',"total")) "agingGroups"
                   from "groups"
                   group by  "supplierId",
                         "supplierName"
                   `,
                values: [companyId, branches, from, to, searchTerm, supplierIds, JSON.stringify(ranges), rangeUnit]
            }




            const records = await DB.excu.query(query.text, query.values);
            let resRecords = records.rows && records.rows.length > 0 ? records.rows : []
            const rangesTemp = ranges.map(m => m.label)
            if (filter.export) {

                let report = new ReportData()
                report.filter = {
                    title: "Supplier Aging Summary Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = resRecords
                report.columns = [{ key: 'Date', properties: { groupBy: 'horizantal' } },
                { key: 'InvoiceNumber' }, { key: 'Status' }, { key: 'CustomerName' },
                { key: 'Age' },
                { key: 'Amount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'BalanceDue', properties: { hasTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'SupplierAgingSummaryReport'
                return new ResponseData(true, "", {
                    records: resRecords,
                    ranges: rangesTemp,
                    filter: report.filter,
                    options: {
                        idKey: "supplierId",      // 'supplierId' | 'customerId'
                        nameKey: "supplierName",   // 'supplierName' | 'customerName'
                        headerLabel: "Supplier", // 'Supplier' | 'Customer'
                        fileName: "SupplierAgingSummaryReport"
                    },
                    showFilter: true
                })
            }


            let resData = {
                records: resRecords,
                columns: columns,
                ranges: rangesTemp
            }
            return new ResponseData(true, "", resData)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async supplierBalances(data: any, company: Company, brancheList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let supplierIds = filter && filter.supplierIds && Array.isArray(filter.supplierIds) ? filter.supplierIds : null

            //-------------- set time --------------
            let closingTime = "00:00:00"

            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(null, toDate, closingTime, false, timeOffset)

            let to = interval.to

            //---------------------------------------
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };


            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);



            let offset = limit * (page - 1);

            let total = {};
            let count = 0;
            let resault: any[] = [];
            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
            offset ${offset}`
            //######################################################
            const countQuery = {
                text: `with "values" as(
                    select $1::uuid as "companyId",
                           $2::uuid[] as "branches",
                           $3::timestamp as "toDate",
                           $4::uuid[] as "supplierIds"
                     ),"supplierLists"  as (
                       
                       select  count(*) over(),  "Suppliers".id, "Suppliers".name , "Suppliers"."createdAt"  as "supplierCreatedAt", "Suppliers"."companyId" from "Suppliers"    
                       join  "values" on true
                       where "Suppliers"."companyId" = "values"."companyId"
                       and (array_length("values"."supplierIds",1) IS null or "Suppliers".id = any("values"."supplierIds"))
                       order by "Suppliers"."createdAt" DESC
                            ${limitQuery}
                       )
                  
                    ,"supplierListsOpeningBalance" as (
                        select "supplierLists".id, "supplierLists".name, "supplierCreatedAt" ,
                              COALESCE( sum("SupplierOpeningBalance"."openingBalance"),0) as "openingBalance"
                        from "supplierLists"
                        join "values" on true
                        left join "SupplierOpeningBalance" on "supplierLists".id = "SupplierOpeningBalance"."supplierId"
                         and (array_length("values"."branches",1) IS NULL or  "SupplierOpeningBalance"."branchId" = Any("values"."branches"))
                         inner join "Branches" on "Branches".id ="SupplierOpeningBalance"."branchId"
                         inner join "Companies" on "Companies".id ="Branches"."companyId"        
                         where "supplierLists"."companyId" = "values"."companyId"
                         and (("Branches"."openingBalanceDate"  <= "values"."toDate") or( "Companies"."createdAt" - interval '1 day'  <= "values"."toDate" ))
                         and (array_length("values"."supplierIds",1) IS null or "supplierLists".id = any("values"."supplierIds")  )
                        group by "supplierLists".id, "supplierLists".name, "supplierCreatedAt"

                        )`,
                values: [companyId, branches, to, supplierIds]
            }
            let lastIndex = ((page) * limit);
            let pageCount = 0
            // if (limit != 0) {
            //     const countTemp = `${countQuery.text},"supplier" as (
            //             select 	 
            //             count( "supplierListsOpeningBalance"."id") 	as "count"    
            //             from "supplierListsOpeningBalance"
            //             ) select * from "supplier" `

            //     let countData = await DB.excu.query(countTemp, countQuery.values)
            //     count = +Number((<any>countData.rows[0]).count)
            //     pageCount = Math.ceil(count / limit);
            //     offset += 1

            //     if (countData.rows.length < limit || page == pageCount) {
            //         lastIndex = count
            //     }

            // }

            const query: { text: string, values: any } = {
                text: `${countQuery.text},"supplier" as (
                        select
                            "supplierListsOpeningBalance".id, name,
                            "supplierListsOpeningBalance"."openingBalance" ::text::numeric - COALESCE(sum("BillingPaymentLines"."amount"::text::numeric),0) as "openingBalance"
                        from "supplierListsOpeningBalance"
                        join "values" on true
                        left join "BillingPayments" on "BillingPayments"."supplierId" = "supplierListsOpeningBalance".id
                        and (array_length("values"."branches",1) IS NULL or  "BillingPayments"."branchId" = Any("values"."branches"))
                        left join "BillingPaymentLines" on "BillingPaymentLines"."billingPaymentId"  = "BillingPayments".id
                        and "openingBalanceId" is not null and  "BillingPaymentLines"."createdAt" <= "values"."toDate"
                        group by "supplierListsOpeningBalance".id, name, "supplierListsOpeningBalance"."openingBalance" , "supplierCreatedAt"
                         order by  "supplierCreatedAt"  desc)
                        , "billingLines" as (
                        select "billingId", "Billings"."supplierId",
                               sum((case when "BillingLines"."isInclusiveTax" = true then COALESCE("BillingLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("BillingLines"."subTotal"::text::numeric,0)::text::numeric + COALESCE("BillingLines"."taxTotal"::text::numeric,0)::text::numeric) end)) as total
                        from "supplierLists"
                        join "values" on true
                        inner join "Billings" on "Billings"."supplierId" = "supplierLists"."id"
                        inner join "BillingLines" on "BillingLines"."billingId" = "Billings".id and "BillingLines"."parentId" is null
                        inner join "Branches" on "Billings"."branchId" = "Branches".id
                        where "Branches"."companyId" = "values"."companyId"
                        and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                        and ("Billings"."status" <> 'Draft') and ("BillingLines"."createdAt" <= "values"."toDate")
                        group by "billingId", "Billings"."supplierId"
                        ) 

                        ,"billingCharges" as (
                        select "Billings".id as "billingId", "Billings"."supplierId",
                               (COALESCE("Billings"."shipping"::numeric,0)::text::numeric) as total
                        from "supplierLists"
                        join "values" on true
                        inner join "Billings" on "supplierLists".id = "Billings"."supplierId"
                        inner join "Branches" on "Billings"."branchId" = "Branches".id
                        where "Branches"."companyId" = "values"."companyId"
                               and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                               and ("Billings"."status" <> 'Draft') and ("Billings"."supplierId" is not null) and ("Billings"."createdAt" <= "values"."toDate")
                        ) 

                        ,"billingTotal" as (
                        select "billingCharges"."supplierId", "billingCharges"."billingId",
                                "billingCharges".total + COALESCE("billingLines"."total",0) as total
                        from "billingCharges"
                        left join "billingLines" on "billingCharges"."billingId" = "billingLines"."billingId"

                        )

                        , "creditLines" as (
                        select "billingId", "Billings"."supplierId",
                               sum((case when "SupplierCreditLines"."isInclusiveTax" = true then COALESCE("SupplierCreditLines"."subTotal"::text::numeric,0)::text::numeric  else (COALESCE("SupplierCreditLines"."subTotal"::text::numeric,0)::text::numeric + COALESCE("SupplierCreditLines"."taxTotal"::text::numeric,0)::text::numeric) end)) as total      
                        from "SupplierCreditLines"
                        join "values" on true
                        inner join "SupplierCredits" on "SupplierCredits".id = "SupplierCreditLines"."supplierCreditId" and "SupplierCreditLines"."parentId" is null
                        inner join "Billings" on "Billings".id = "billingId"
                        inner join "supplierLists" on "supplierLists".id = "Billings"."supplierId"
                        inner join "Branches" on "SupplierCredits"."branchId" = "Branches".id
                        where "Branches"."companyId" = "values"."companyId"
                               and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                               and ("SupplierCreditLines"."createdAt" <= "values"."toDate")
                        group by "billingId","Billings"."supplierId"
                        )

                        ,"creditCharges" as (
                        select "billingId", "Billings"."supplierId",
                               sum(COALESCE("SupplierCredits"."shipping",0)::text::numeric)  as total
                        from "SupplierCredits"
                        join "values" on true
                        inner join "Billings" on "Billings".id = "billingId"
                                                        inner join "supplier" on "supplier".id = "Billings"."supplierId"
                        inner join "Branches" on "SupplierCredits"."branchId" = "Branches".id
                        where "Branches"."companyId" = "values"."companyId"
                               and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                               and ("SupplierCredits"."createdAt" <= "values"."toDate")
                        group by "billingId", "Billings"."supplierId"
                        )
                        ,"creditTotal" as (
                        select "creditCharges"."supplierId","creditCharges"."billingId",
                                "creditCharges".total + COALESCE("creditLines"."total",0) as total
                        from "creditCharges"
                        left join "creditLines" on "creditCharges"."billingId" = "creditLines"."billingId"
                        )

                        ,"paymentTotal" as (
                        select "billingId" , "Billings"."supplierId", sum("BillingPaymentLines".amount::text::numeric) as total
                        from "BillingPaymentLines"
                        join "values" on true
                        inner join "BillingPayments" on "BillingPayments".id = "billingPaymentId"
                        inner join "Billings" on "Billings".id = "BillingPaymentLines"."billingId"
                        inner join "supplierLists" on "supplierLists".id = "Billings"."supplierId"
                        inner join "Branches" on "BillingPayments"."branchId" = "Branches".id
                        where "Branches"."companyId" = "values"."companyId"
                               and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                               and ("BillingPaymentLines"."createdAt" <= "values"."toDate")
                        group by "Billings"."supplierId", "billingId"
                        )
                        ,"appliedCredit" as (
                        select "billingId" , "Billings"."supplierId", sum("SupplierAppliedCredits".amount::text::numeric) as total
                        from "SupplierAppliedCredits"
                        join "values" on true
                        inner join "Billings" on "SupplierAppliedCredits"."billingId" = "Billings"."id"
                       inner join "supplierLists" on "supplierLists".id = "Billings"."supplierId"
                        inner join "Branches" on "Billings"."branchId" = "Branches".id
                        where "Branches"."companyId" = "values"."companyId"
                               and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                               and ("SupplierAppliedCredits"."appliedCreditDate" <= "values"."toDate")
                        group by "Billings"."supplierId", "billingId"
                        )

                        ,"Total" as (
                        select "billingTotal"."supplierId", "billingTotal"."billingId","billingTotal".total as bill, "paymentTotal".total as payment ,"creditTotal".total as cn, "appliedCredit".total as appliedCN,
                            (COALESCE("billingTotal".total,0) - COALESCE("paymentTotal".total,0) -  COALESCE("creditTotal".total,0) -  COALESCE("appliedCredit".total,0)) as total
                        from "billingTotal"
                        left join "paymentTotal" on "billingTotal"."supplierId" = "paymentTotal"."supplierId" and  "billingTotal"."billingId" = "paymentTotal"."billingId"      
                        left join "creditTotal"  on "billingTotal"."supplierId" = "creditTotal"."supplierId" and  "billingTotal"."billingId" = "creditTotal"."billingId"        
                        left join "appliedCredit"  on "billingTotal"."supplierId" = "appliedCredit"."supplierId" and  "billingTotal"."billingId" = "appliedCredit"."billingId"  
                        )

                        ,"refunds" as (
                        select "Billings"."supplierId",
                                sum(COALESCE("SupplierRefunds".total,0)::text::numeric) as total
                        from "SupplierRefunds"
                        inner join "SupplierCredits" on "SupplierRefunds"."supplierCreditId" = "SupplierCredits".id
                        inner join "Billings" on "Billings".id = "SupplierCredits"."billingId"
                                                        inner join "supplier" on "supplier".id = "Billings"."supplierId"
                        group by  "Billings"."supplierId"
                        )
                        ,"unearendRevenue" as (
                        select
                            "BillingPaymentLines"."billingPaymentId", "BillingPayments"."supplierId",
                            ("BillingPayments"."tenderAmount"::text::numeric) - sum(COALESCE("BillingPaymentLines".amount,0)::text::numeric)as total
                        from "BillingPayments"
                        inner join "supplierLists" on "supplierLists".id = "BillingPayments"."supplierId"
                        left join "BillingPaymentLines" on "BillingPaymentLines"."billingPaymentId" = "BillingPayments".id
                        group by "BillingPayments".id , "BillingPaymentLines"."billingPaymentId"
                        having "BillingPayments"."tenderAmount" - sum(COALESCE("BillingPaymentLines".amount,0))>0
                        )
                        ,"totalRevenue" as (
                            select
                            "unearendRevenue"."supplierId",
                            sum(COALESCE(total,0))as total
                            from "unearendRevenue"
                            group by "unearendRevenue"."supplierId"
                        )

                        ,"billingBalanceAndCredits" as (
                        select  "supplierLists"."count","supplierLists".id, "supplierLists".name,
                                COALESCE(sum(case when "Total"."total" >= 0 then "Total"."total" else 0 end),0) + COALESCE("openingBalance" ,0) as "billingBalance",
                                COALESCE(abs(sum(case when "Total"."total" < 0 then "Total"."total" else 0 end)),0) - COALESCE("refunds"."total" ,0) + COALESCE("totalRevenue"."total" ,0)  as "availableCredits"
                        from "supplierLists"
						LEFT JOIN "supplier"  on "supplierLists".id =  "supplier".id
                        left join "Total" on "supplierLists".id = "Total"."supplierId"
                        left join "refunds" on "supplierLists".id = "refunds"."supplierId"
                        left join "totalRevenue" on "supplierLists".id ="totalRevenue"."supplierId"
                        group by  "supplierLists"."count" , "supplierLists".id, "supplierLists".name, "openingBalance", "refunds"."total", "totalRevenue"."total"
                        )

                        select  * , COALESCE("billingBalance" ,0) - COALESCE("availableCredits" ,0) as "balance"
                        from "billingBalanceAndCredits"
                        order by name


                    
                    
                    `,
                values: [companyId, branches, to, supplierIds]
            }


            console.log(query.text, query.values)

            const records = await DB.excu.query(query.text + limitQuery, query.values)
            count = +Number((<any>records.rows[0]).count)
            pageCount = Math.ceil(count / limit);
            offset += 1

            if (records.rows.length < limit || page == pageCount) {
                lastIndex = count
            }
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                resault = records.rows
                // total =  {numberOfInvoices: t.totaNumberOfInvoices, invoiceSales: t.invoiceSalesTotal, numberOfCreditNotes: t.totalNumberOfCreditNotes, creditNoteSales: t.creditNoteSalesTotal, totalSales : t.salesTotal} 
                // resault = records.rows.map((e: any) => {return {customerId : e.customerId, customerName:e.customerName ,
                //                                                 numberOfInvoices: t.numberOfInvoices,  invoiceSales: e.invoiceSales,
                //                                                 numberOfCreditNotes: e. numberOfCreditNotes, creditNoteSales: e.creditNoteSales, 
                //                                                 totalSales: e.totalSales }} )
            }


            let resData = {
                records: resault,
                count: count,
                //total: total,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Supplier Balance Summary",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'name', header: 'Supplier Name' },
                { key: 'billingBalance', properties: { columnType: 'currency' } },
                { key: 'availableCredits', properties: { columnType: 'currency' } },
                { key: 'balance', properties: { columnType: 'currency' } }
                ]
                report.fileName = 'supplierBalanceSummary'
                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
            console.log(error)
          

            throw new Error(error)
        }
    }



    //others
    public static async monthlyBLDBreakdownReport(data: any, company: Company, brancheList: []) {
        try {

            let companyId = company.id
            let afterDecimal = company.afterDecimal
            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let date = filter && filter.date ? new Date(filter.date) : null;
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };

            let breakfastTimeStartAt = filter && filter.breakfastTimeStartAt ? filter.breakfastTimeStartAt : '05:00';
            let lunchTimeStartAt = filter && filter.lunchTimeStartAt ? filter.lunchTimeStartAt : '10:00';
            let dinnerTimeStartAt = filter && filter.dinnerTimeStartAt ? filter.dinnerTimeStartAt : '17:00';

            if (!breakfastTimeStartAt) { throw new ValidationException("breakfastTimeStartAt is required") };
            if (!lunchTimeStartAt) { throw new ValidationException("lunchTimeStartAt is required") };
            if (!dinnerTimeStartAt) { throw new ValidationException("dinnerTimeStartAt is required") };
            if (!date) { throw new ValidationException("date is required") }


            const query = {
                text: `WITH "lines" AS (
                    SELECT Date("InvoiceLines"."createdAt")  AS "Date",
                    Trim(to_char("InvoiceLines"."createdAt",'Day')) AS "Day",
                    SUM(CASE WHEN "InvoiceLines"."isInclusiveTax" = false THEN (COALESCE("InvoiceLines"."subTotal",0)) else (COALESCE("InvoiceLines"."subTotal",0)- (COALESCE("InvoiceLines"."taxTotal",0))) end ) AS "grossSales",
                    SUM(COALESCE("InvoiceLines"."discountTotal",0)) AS "Discount",
                    SUM(CASE when ("InvoiceLines"."createdAt"::time >= $4::time AND "InvoiceLines"."createdAt"::time < $5::time) then (COALESCE("InvoiceLines"."total",0) - COALESCE("InvoiceLines"."taxTotal",0)) end ) AS "breakfastSales",
                    SUM(CASE when ("InvoiceLines"."createdAt"::time >= $5::time AND "InvoiceLines"."createdAt"::time < $6::time) then (COALESCE("InvoiceLines"."total",0) - COALESCE("InvoiceLines"."taxTotal",0))end ) AS "lunchSales",
                    SUM(CASE when ("InvoiceLines"."createdAt"::time >= $6::time OR "InvoiceLines"."createdAt"::time < $4::time) then (COALESCE("InvoiceLines"."total",0) - COALESCE("InvoiceLines"."taxTotal",0)) end ) AS "dinnerSales",
                    SUM( COALESCE("InvoiceLines"."total",0) - COALESCE("InvoiceLines"."taxTotal",0) ) AS "salesExclVat",
                    SUM(COALESCE("InvoiceLines"."taxTotal",0)) AS "taxTotal",
                    SUM(COALESCE("InvoiceLines"."total",0) )AS "salesInclVat",
                    array_agg(distinct "InvoiceLines"."invoiceId") as ar
                    FROM "InvoiceLines"
                    INNER JOIN "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" AND "InvoiceLines"."createdAt"::date = "Invoices"."invoiceDate"
                    INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id
                    WHERE "InvoiceLines"."companyId"= $1 
                    AND( array_length($2::uuid[],1) IS NULL OR "InvoiceLines"."branchId" = any( $2::uuid[]))
	                AND extract(year from "InvoiceLines"."createdAt") =  extract(year from $3::date) 
                    AND extract(month from "InvoiceLines"."createdAt")= extract(month from $3::date)
                    AND ("Invoices"."status" <>'Draft'  or ("Invoices"."status" = 'Closed'  and "Invoices"."onlineData"->>'onlineStatus'='Rejected'))
                
                    GROUP BY  "Date","Day"
                    ),
                    
                    "invoices_data" AS (
                    SELECT lines.*,
                    SUM(COALESCE("Invoices"."discountTotal",0)) AS "invoiceDiscount",
                    SUM(COALESCE(NULLIF("Invoices".guests,0),1)) AS guests
                    FROM "lines" 
                    LEFT JOIN "Invoices"  ON  id = any("lines".ar)
                    GROUP BY "Date","Day" ,"grossSales", "Discount", "breakfastSales", "lunchSales", "dinnerSales", "salesExclVat", "taxTotal", "salesInclVat", ar 
                    ORDER BY  "Date"
                    )
                    SELECT Date("Date") , Trim("Day") As "day", 
                    Round("grossSales"::numeric, $7::INT) ::text::real AS "grossSales", 
                    Round("Discount"::numeric,$7::INT)  ::text::real AS "discount",
                    COALESCE( Round("breakfastSales" ::numeric ,$7::INT),0) ::text::real AS "breakfastSales",
                    COALESCE( Round("lunchSales"     ::numeric ,$7::INT),0)  ::text::real AS "lunchSales", 
                    COALESCE( Round("dinnerSales"    ::numeric, $7::INT),0) ::text::real AS "dinnerSales",
                    Round("salesExclVat"  ::numeric,$7::INT)  ::text::real AS "salesExclVat",
                    Round("taxTotal"      ::numeric, $7::INT)  ::text::real AS "taxTotal",
                    Round("salesInclVat" ::numeric,$7::INT)  ::text::real AS "salesInclVat",
                    guests  ::text::real ,
                    Round(("salesExclVat"/ guests)::numeric, $7::INT)  ::text::real AS "avg"
                    FROM "invoices_data" `,
                values: [companyId, branches, date, breakfastTimeStartAt, lunchTimeStartAt, dinnerTimeStartAt, afterDecimal]
            }

            console.log(">>>>>>>>>")


            const records = await DB.excu.query(query.text, query.values);

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Monthly BLD Breakdown Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'date', properties: { columnType: 'date_day' } },
                { key: 'grossSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'discount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'breakfastSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'lunchSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'dinnerSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'salesInclVat', header: 'Net Sales (Incl. VAT)', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'taxTotal', header: "Vat", properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'salesExclVat', header: 'Net Sales (Excl. VAT)', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'guests', header: 'Guest Count', properties: { hasTotal: true } },
                { key: 'avg', header: 'Avg Guest Checks', properties: { hasTotal: true, columnType: 'currency' } },
                ]
                report.fileName = 'monthlyBLDBreakdownReport'

                return new ResponseData(true, "", report)
            }



            if (records.rowCount != null && records.rowCount > 0) {

                return new ResponseData(true, "", records.rows)
            } else {
                return new ResponseData(true, "", [])
            }
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async salesDiscountReport(data: any, company: Company, brancheList: []) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal;
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

            const query: { text: string, values: any } = {

                text: `with values As (
                    SELECT  $1::uuid AS "companyId",
                    $2::uuid[] AS "branches",
                    $3::timestamp AS "fromDate",
                    $4::timestamp AS "toDate"
                    ) 
                     ,"InvoiceData" As (
                        select 
                            IL."discountId", 
                            COALESCE("Discounts".name,'Other') AS "DiscountName",
                            sum(IL.qty) AS "salesCount", 
                            sum(IL."discountTotal") AS "discountTotal" ,
                            sum(IL."subTotal") as "subTotal", 
                            sum(case when IL."isInclusiveTax" = true then ((COALESCE(IL."subTotal",0)) - (COALESCE(IL."taxTotal",0))) else COALESCE(IL."subTotal",0)::text::numeric end) as "salesAmount",
                            sum(COALESCE(IL.total,0) - (COALESCE(IL."taxTotal",0)) ) as "netSales",
                            COALESCE(sum((select sum((elem->>'cost')::text::numeric) 
                            from jsonb_array_elements(IL.recipe) AS elem)),0) AS "costs"
                        FROM "InvoiceLines" as IL
                        JOIN "values" ON true
                        INNER JOIN "Invoices" AS invo on  invo.id = IL."invoiceId"
                        LEFT JOIN "Discounts" ON IL."discountId" = "Discounts".id 
                        INNER JOIN "Branches" ON invo."branchId" = "Branches".id
                        where "Branches"."companyId"= "values"."companyId"
                            AND( "values"."branches" IS NULL OR "Branches".id = any( "values"."branches"))
                            AND (invo."status" <>'Draft')
                            AND (IL."createdAt" >= "values"."fromDate" AND IL."createdAt" < "values"."toDate")
                        group by IL."discountId", "DiscountName"    
                    )
                    ,"CreditNoteData" As (
                        select 
                            IL."discountId", 
                            COALESCE("Discounts".name,'Other') AS "DiscountName",
                            sum(IL.qty)*(-1) AS "salesCount", 
                            sum(IL."discountTotal")*(-1) AS "discountTotal" ,
                            sum(IL."subTotal") as "subTotal", 
                            sum(case when IL."isInclusiveTax" = true then (COALESCE(IL."subTotal",0) - COALESCE(IL."taxTotal",0)) else COALESCE(IL."subTotal",0) end)*(-1) as "salesAmount",
                            sum(COALESCE(IL.total,0) - COALESCE(IL."taxTotal",0) )*(-1) as "netSales",
                            COALESCE(sum((select sum((elem->>'cost')::text::numeric) 
                            from jsonb_array_elements(IL.recipe) AS elem)),0)*(-1) AS "costs"
                        FROM "CreditNoteLines" as IL
                        JOIN "values" ON true
                        INNER JOIN "CreditNotes" AS invo on  invo.id = IL."creditNoteId"
                        LEFT JOIN "Discounts" ON IL."discountId" = "Discounts".id 
                        INNER JOIN "Branches" ON invo."branchId" = "Branches".id
                        where "Branches"."companyId"= "values"."companyId"
                            AND( "values"."branches" IS NULL OR "Branches".id = any( "values"."branches"))
                            AND (IL."createdAt" >= "values"."fromDate" AND IL."createdAt" < "values"."toDate")
                        group by IL."discountId", "DiscountName"    
                    )
                        select "discountId", "DiscountName", 
                        sum("salesCount"::text::numeric)  as "salesCount",
                        sum(case when "subTotal" <> 0 then (COALESCE("discountTotal",0)/ "subTotal") else 0 end ) AS "netDiscountPercentage",
                        sum("discountTotal"::text::numeric) AS "discountTotal" ,
                        sum("salesAmount"::text::numeric) AS "salesAmount", 
                        sum("netSales"::text::numeric) AS "netSales", 
                        sum(costs::text::numeric) AS "costs",
                        (case when sum("netSales") <> 0 then (1::numeric - (COALESCE(Sum(costs),0))/ (COALESCE(Sum("netSales"),0)) ) else 0 end)::text::numeric  AS "GrossMarginPercentage",
                        sum( COALESCE("netSales",0)  - COALESCE(costs,0) ) AS "grossProfit"
                        from (select * from "InvoiceData" union all select * from "CreditNoteData")T
                        group by "discountId", "DiscountName"
                    `,
                values: [companyId, branches, from, to],
            };

            const records = await DB.excu.query(query.text, query.values);

            let resRecords = records.rows && records.rows.length > 0 ? records.rows : []


            let resData = {
                records: resRecords,

            }

            if (filter.export) {
                records.rows.forEach((elem: any) => { elem.netDiscountPercentage = elem.netDiscountPercentage * 100, elem.GrossMarginPercentage = elem.GrossMarginPercentage * 100 })
                let report = new ReportData()
                report.filter = {
                    title: "Discount Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'DiscountName' },
                { key: 'salesCount', properties: { hasTotal: true } },
                { key: 'salesAmount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'netDiscountPercentage', header: 'Discount Percentage', properties: { columnType: 'percentage' } },
                { key: 'discountTotal', header: "Net Discounts", properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'netSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'costs', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'GrossMarginPercentage', header: 'Gross Margin', properties: { columnType: 'percentage' } },
                { key: 'grossProfit', properties: { hasTotal: true, columnType: 'currency' } },
                ]
                report.fileName = 'DiscountReport'
                return new ResponseData(true, "", report)
            }


            return new ResponseData(true, "", resData)


        } catch (error: any) {
          
            throw new Error(error)
        }


    }

    public static async salesByDiscountId(data: any, company: Company, brancheList: []) {

        try {
            let filter = data.filter;
            let companyId = company.id;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let discountId = filter && filter.discountId;
            let discountName = await DiscountRepo.getDiscountName(discountId) ?? 'other'



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
            //#########################################################

            if (!Array.isArray(branches) || branches.length == 0) { branches = null };
            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let count = 0
            let salesAmount = 0
            let discountTotal = 0
            let taxTotal = 0
            let total = 0
            let results: any = []
            let offset = limit * (page - 1);
            const query = {
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
                        "InvoiceLines"."companyId",
                        "InvoiceLines"."discountId"
                    from "InvoiceLines"
                    where "InvoiceLines"."companyId" = $1
                    and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any ($2::uuid[]))
                    and ("InvoiceLines"."createdAt" >= $3::timestamp 	 and "InvoiceLines"."createdAt" < $4)
                    ),
                    "invoiceData" as (
                    select  "Invoices".id,
                            "lines"."sales",
                            "lines"."taxTotal",
                            "lines"."discountTotal",
                            "lines"."total",
                              "Invoices"."invoiceNumber"  as "code",
                                 'invoice' as "transactionType",
						     'Invoice' as "type"
                    from "lines"
                    inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
	
             					                                WHERE (( "lines". "discountId" = $5::uuid) or("lines". "discountId" is null and  $5::uuid is null) )

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
                        "CreditNoteLines"."companyId",
                        "CreditNoteLines"."creditNoteId",
						  "CreditNoteLines"."discountId"
                    from "CreditNoteLines"
                    where "CreditNoteLines"."companyId" = $1
                    and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId" =any($2::uuid[]))
                    and ("CreditNoteLines"."createdAt" >= $3::timestamp 	 and "CreditNoteLines"."createdAt" < $4)
                
                    ),
                    "creditNoteData" as (
                    select  "CreditNotes".id,
                            "creditNoteLines"."sales" *(-1),
                            "creditNoteLines"."taxTotal" *(-1),
                            "creditNoteLines"."discountTotal" *(-1) ,
                            "creditNoteLines"."total" *(-1),
                             "CreditNotes"."creditNoteNumber" as "code",
                            'creditNote' as "transactionType",
						   'Credit Note' as "type"
                    from "creditNoteLines"
            inner join "CreditNotes" on "creditNoteLines"."creditNoteId" = "CreditNotes".id
						WHERE (( "creditNoteLines". "discountId" = $5::uuid) or("creditNoteLines". "discountId" is null and $5::uuid is null) )

                    ),
                    T AS (          
                    select * from "invoiceData" union all select * from "creditNoteData"
                    )  select  
                            COUNT(*) OVER() AS "count",
                            "code",
                            "type",
                            id,
                            
                            "sales",
                            "discountTotal", 
                            "taxTotal", 
                            "total", 
                            sum("sales") over() as "salesAmountTotal",
                            sum("discountTotal") over() as "discountTotals",
                            sum("taxTotal") over() as "taxTotals",
                            sum("total") over() as "totals"
                            from T
                        
                        `,
                values: [companyId, branches, from, to, discountId]
            }



            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                                offset ${offset}`

            const records = await DB.excu.query(query.text + limitQuery, query.values);



            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                salesAmount = Number(t.salesAmountTotal)
                discountTotal = Number(t.discountTotals)
                taxTotal = Number(t.taxTotals)
                total = Number(t.totals)

                results = records.rows.map(({ count, salesAmountTotal, discountTotals, taxTotals, totals, ...rest }: any) => rest)
            }



            if (filter.export) {
                let report = new ReportData()


                report.filter = {
                    title: "Sales By Discount",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches,
                    filterList: { discountName: discountName },
                    serviceName: discountName
                }
                report.records = records.rows

                //get columns & subColumns

                report.columns = [{ key: 'code' },
                { key: 'type' },
                { key: 'salesAmount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'discountTotal', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'taxTotal', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'total', properties: { hasTotal: true, columnType: 'currency' } },
                ]

                report.fileName = 'SalesByDiscount'

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

                total: { salesAmount: salesAmount, discountTotal: discountTotal, taxTotal: taxTotal, total: total },
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }


    public static async voidTransactionsReport(data: any, company: Company, brancheList: any[]) {

        try {


            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.filter && data.filter.fromDate ? data.filter.fromDate : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.filter && data.filter.toDate ? moment(new Date(data.filter.toDate)) : moment(new Date());

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
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };
            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);



            let offset = limit * (page - 1);

            let total = {};
            let count = 0;
            let resault: any[] = [];

            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`
            const query: { text: string, values: any } = {
                text: `with "params" as (
                        select $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::timestamp as "fromDate",
                            $4::timestamp as "toDate"
                       ),
                        base AS MATERIALIZED (
                        SELECT
                            IL."total"::numeric AS amount,
                            IL."invoiceId",
                            IL."productId",
                            IL."employeeId",
                            IL."voidReason",
                            IL.note,
                            IL."createdAt"
                        FROM "InvoiceLines" IL
                        JOIN params p ON TRUE
                        INNER JOIN "Invoices"  invo ON invo.id = IL."invoiceId"
                        WHERE IL."companyId" = p."companyId"
                            AND (array_length(p."branches",1) IS NULL OR IL."branchId" = ANY (p."branches"))
                            AND invo.status <> 'Draft'
                            and (invo."onlineData"->>'onlineStatus' ='Accepted' or invo."onlineData" is null or invo."onlineData"->>'onlineStatus' ='')
                            AND IL."createdAt" >= p."fromDate" AND IL."createdAt" < p."toDate"
                            AND IL."qty" < 0
                        ),
                        agg AS (
                        SELECT
                            COUNT(*) AS "totalCount",
                            COALESCE(SUM(amount),0)::float AS "totalAmount"
                        FROM base
                        ),
                        page AS (
                        SELECT
                            b.amount,
                            b."invoiceId",
                            b."productId",
                            b."employeeId",
                            b."voidReason",
                            b.note,
                            b."createdAt",
                            COALESCE(prod.name, b.note)              AS "productName",
                            COALESCE(invo."invoiceNumber",'Invoice') AS "invoiceNumber",
                            emp.name                                  AS "employeeName"
                        FROM base b
                        INNER JOIN "Invoices"  invo ON invo.id = b."invoiceId"
                        LEFT  JOIN "Products"  prod ON prod.id = b."productId"
                        LEFT  JOIN "Employees" emp  ON emp.id = b."employeeId"
                        ORDER BY b."createdAt" DESC
                       ${limitQuery}
                        )
                        SELECT
                        a."totalCount",
                        a."totalAmount",
                        p."invoiceId",
                        p."invoiceNumber",
                        p."productName",
                        p."createdAt",
                        p."employeeName",
                        p.amount      AS "amount",
                        p."voidReason"
                        FROM page p
                        CROSS JOIN agg a
                        ORDER BY p."createdAt" DESC;

                    
                    `,
                values: [companyId, branches, from, to]
            }




            const records = await DB.excu.query(query.text, query.values)

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.totalCount)

                total = { amount: t.totalAmount }
                resault = records.rows.map((e: any) => {
                    return {
                        invoiceId: e.invoiceId, invoiceNumber: e.invoiceNumber, productName: e.productName, createdAt: e.createdAt, employeeName: e.employeeName, amount: e.amount,
                        voidReason: e.voidReason
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
                    title: "Void Transactions",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'createdAt', header: 'Date', properties: { columnType: 'date' } },
                { key: 'invoiceNumber' }, { key: 'productName' }, { key: 'employeeName' },
                { key: 'amount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'voidReason' }
                ]
                report.fileName = 'VoidTransactions'
                return new ResponseData(true, "", report)
            }


            return new ResponseData(true, "", resData)
        } catch (error: any) {


          

            throw new Error(error)
        }
    }

    //subReport

    public static async accountJournal(data: any, company: Company, brancheList: []) {

        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? filter.fromDate : null;
            if (fromDate)
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

            let accountId = filter && filter.accountId ? filter.accountId : null;

            console.log(from, to)



            /**Interval Selection Query */
            const query: { text: string, values: any } = {
                text: `SELECT count (*) over() ,
                            sum(sum(case when "JournalRecords".amount >0 then "JournalRecords".amount::text::NUMERIC(30,5) else null end)) over() as "debitTotal",
                            sum(sum(case when "JournalRecords".amount <0 then ABS("JournalRecords".amount::text::NUMERIC(30,5)) else null end)) over() as "creditTotal",

                            sum(case when "JournalRecords".amount >0 then "JournalRecords".amount::text::NUMERIC(30,5) else null end) as debit,
                            sum(case when "JournalRecords".amount <0 then ABS("JournalRecords".amount::text::NUMERIC(30,5) ) else null end) as credit,
                            "dbTable" as type,
                            "JournalRecords".code,
                            COALESCE("invoicePaymentId","referenceId") as "referenceId" ,
                            "JournalRecords"."createdAt",
                             "userId",
                             "userName",
                             "userType"
                        FROM "JournalRecords"
                        left JOIN "Branches" ON "JournalRecords"."branchId" = "Branches".id 
                        left JOIN "InvoicePaymentLines" ON "referenceId" =  "InvoicePaymentLines".id and "JournalRecords".name = 'Unearend Revenue'
                        WHERE "accountId" = $1::uuid
                        AND "JournalRecords"."companyId"= $4
                        AND( (array_length($5::uuid[],1) IS NULL OR "Branches".id = any($5::uuid[])) or ("JournalRecords"."branchId" is null) )
                        AND ($2::timestamp is null or "JournalRecords"."createdAt"::timeStamp>=$2::timeStamp)
                        AND "JournalRecords"."createdAt"::timeStamp<$3::timeStamp
                        group by "dbTable", "JournalRecords".code, "referenceId","invoicePaymentId","JournalRecords"."createdAt","userId","userName", "userType"
                        ORDER BY "JournalRecords"."createdAt" desc 

               
                        
                        `,
                values: [accountId, from, to, companyId, branches]
            }

            let opeiningBalance = 0;


            query.text += filter && filter.export ? "" : ` limit ${limit} 
              offset ${offset}`

            const journals = await DB.excu.query(query.text, query.values);
            /**Account Opening Balance Query =  sum of debit and credit of journal entries where createdAt < from  */
            if (filter && filter.fromDate && page == 1) {
                query.text = `SELECT 
                                 Cast(sum (case when amount > 0 then amount::text::NUMERIC(30,5) else 0 end) -  sum (case when amount < 0 then ABS(amount::text::NUMERIC(30,5)) else 0 end) as real ) as "opeiningBalance"
                                FROM "JournalRecords"
                                left JOIN "Branches" ON "JournalRecords"."branchId" = "Branches".id 
                                WHERE "accountId" = $1::uuid
                                AND "JournalRecords"."companyId"= $3
                                AND( (array_length($4::uuid[],1) IS NULL OR "Branches".id = any($4::uuid[])) or ("JournalRecords"."branchId" is null))
                                AND "JournalRecords"."createdAt"::timeStamp<$2::timeStamp
                            `
                query.values = [accountId, from, companyId, branches]

                const opeiningBalanceData = await DB.excu.query(query.text, query.values)
                const resault = opeiningBalanceData.rows[0];
                opeiningBalance = resault.opeiningBalance == null ? 0 : resault.opeiningBalance;
            }

            let count = journals.rows && journals.rows.length > 0 ? Number(<any>journals.rows[0].count) : 0

            for (let index = 0; index < journals.rows.length; index++) {
                const element = journals.rows[index];
                Helper.roundNumbers(afterDecimal, journals.rows[index])
            }

            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (journals.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            let resData = {
                journals: journals.rows,
                openingBalance: opeiningBalance,
                count: count,
                total: journals.rows && journals.rows.length > 0 ? { debit: Number(<any>journals.rows[0].debitTotal), credit: Number(<any>journals.rows[0].creditTotal) } : {},
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            if (filter && filter.export) {
                let account = await AccountsRepo.getAccountDetails(null, accountId, company.id)

                if (account) {
                    account.openingBalance = opeiningBalance;
                    journals.rows = journals.rows
                    // journals.rows.sort((a: any, b: any) => (a.grandTypeIndex - b.grandTypeIndex|| a.parentTypeIndex - b.parentTypeIndex|| 0-(a.type>b.type?1:-1)) )
                    let report = new ReportData()
                    report.filter = {
                        title: `${account.name} Journal`,
                        fromDate: filter && filter.fromDate ? filter.fromDate : null,
                        toDate: filter && filter.toDate ? filter.toDate : new Date(),
                        branches: branches,
                        // compareType: compareType,
                        accountDetils: account,
                    }
                    report.records = journals.rows

                    //get columns & subColumns

                    report.columns = [...[{ key: 'createdAt', header: 'Date', properties: { columnType: 'date' } },
                    { key: 'code' },
                    { key: 'type' },
                    { key: 'referenceCode', header: 'Reference Number' },
                    { key: 'debit', properties: { hasTotal: true, columnType: 'currency' } },
                    { key: 'credit', properties: { hasTotal: true, columnType: 'currency' } }
                    ], ...report.columns]
                    report.fileName = `${account.name} Journal`
                    return new ResponseData(true, "", report)
                }

            } else {
                return new ResponseData(true, "", resData)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {

          
            throw new Error(error.message)
        }
    }



    public static async getInventoryAssetsJournals(data: any, company: Company, brancheList: []) {
        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? filter.fromDate : null;
            if (fromDate)
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

            let accountId = filter && filter.accountId ? filter.accountId : null;



            const query: { text: string, values: any } = {
                text: `with "journals" as (
                          select sum(case when "qty" > 0 then ("qty"::text::NUMERIC(30,5)* COALESCE(nullif("InventoryMovmentRecords"."cost"::text::NUMERIC(30,5),'NaN'),0) ) else 0 end )  as "debit",
                                 sum(case when "qty" < 0 then "qty"::text::NUMERIC(30,5)* COALESCE(nullif("InventoryMovmentRecords"."cost"::text::NUMERIC(30,5),'NaN'),0 )  else 0 end  )  as "credit",
                           "InventoryMovmentRecords"."referenceTable" as "type",
                            COALESCE("InventoryMovmentRecords"."code","InventoryMovmentRecords"."referenceTable") as "code",
                            "InventoryMovmentRecords"."transactionId" as "referenceId",
                            "InventoryMovmentRecords"."createdAt" ,
                            null as "userId",
                            null as "userName",
                            null as "userType",
                            null as "referenceCode"
                         from "InventoryMovmentRecords" 
	                     where "InventoryMovmentRecords"."companyId" = $1
					    AND ( $2::uuid[] is null or  "InventoryMovmentRecords"."branchId"  = any($2::uuid[] ) or ( "InventoryMovmentRecords"."branchId" is null  and "InventoryMovmentRecords"."companyId" =  $1) )
                        AND( $3::timestamp is null or  "InventoryMovmentRecords"."createdAt">=$3)
                        AND "InventoryMovmentRecords"."createdAt"<$4
                        AND "InventoryMovmentRecords"."referenceTable" NOT IN ( 'Billing','Supplier Credit' )
                        and ("InventoryMovmentRecords"."qty" * "InventoryMovmentRecords"."cost" <> 0 )
                        group by "InventoryMovmentRecords"."transactionId","InventoryMovmentRecords"."referenceTable","InventoryMovmentRecords"."code","InventoryMovmentRecords"."referenceTable",    "InventoryMovmentRecords"."createdAt"
                      union all 
	                  SELECT 
                       CAST( sum(case when "JournalRecords".amount >0 then "JournalRecords".amount  else null end) AS REAL ) as debit,
                         CAST( sum(case when "JournalRecords".amount <0 then "JournalRecords".amount else null end) AS REAL )  as credit,
                        "JournalRecords"."dbTable" as type,
                        "JournalRecords".code,
                        "JournalRecords"."referenceId",
                        "JournalRecords"."createdAt"::date as "createdAt",
                        "JournalRecords"."userId",
                        "JournalRecords"."userName",
                        "JournalRecords"."userType",
    
                       "JournalLines"."code"   as "referenceCode"
                    FROM "JournalRecords"
                       INNER JOIN "Accounts" ON "Accounts".id = "JournalRecords"."accountId"
                    left join "JournalLines" on "JournalLines"."journalId" = "JournalRecords"."referenceId" and  "JournalRecords"."dbTable"  ='Journals'  and "JournalLines"."accountId" = $5
                    WHERE "Accounts"."id" = $5
	                AND "JournalRecords"."companyId" =$1
	                 AND ($2::uuid[] is null or  "JournalRecords"."branchId"  = any($2::uuid[]) or ( "JournalRecords"."branchId" is null  and "JournalRecords"."companyId" =  $1) )
	                AND( $3::timestamp is null or  "JournalRecords"."createdAt">=$3)
                    AND "JournalRecords"."createdAt"<$4
                    and  ("Accounts".name <> 'Inventory Assets' or "JournalRecords"."dbTable" not in ('Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment'))                   
                 
                    group by   "JournalRecords"."dbTable", "JournalRecords".code,   "JournalRecords"."referenceId", "JournalRecords"."createdAt"::date,"userId","userName", "userType","referenceCode"
                    ) 
	                 select  count (*) over() as "count" ,abs("debit"::text::NUMERIC(30,5)) as "debit",abs("credit"::text::NUMERIC(30,5)) as "credit",type,code,"referenceId","createdAt","userId","userName","userType", "referenceCode",  count (*) over() as "count" , sum("debit"::text::NUMERIC(30,5)) over() as "debitTotal" , abs(sum("credit"::text::NUMERIC(30,5)) over()) as "creditTotal" from "journals"
	                ORDER BY "journals"."createdAt" desc  
                    `,
                values: [companyId, branches, from, to, accountId]
            }

            let opeiningBalance = 0;


            query.text += filter && filter.export ? "" : ` limit ${limit} 
                  offset ${offset}`

            const journals = await DB.excu.query(query.text, query.values);
            /**Account Opening Balance Query =  sum of debit and credit of journal entries where createdAt < from  */
            if (filter && filter.fromDate && page == 1) {
                query.text = `with "journals" as (
                    select sum("qty"::text::NUMERIC(30,5) * "cost"::text::NUMERIC(30,5) ) as "opeiningBalance"
                    from "InventoryMovmentRecords" 
                    WHERE "InventoryMovmentRecords"."companyId"= $3
                    AND( array_length($4::uuid[],1) IS NULL OR "InventoryMovmentRecords"."branchId" = any($4::uuid[]))
                    AND "InventoryMovmentRecords"."createdAt"::timeStamp<$2::timeStamp	
                    AND "InventoryMovmentRecords"."referenceTable" NOT IN (  'Billing','Supplier Credit' )
                  	group by "InventoryMovmentRecords"."referenceTable","InventoryMovmentRecords"."code","InventoryMovmentRecords"."referenceTable",    "InventoryMovmentRecords"."createdAt"
                    union all 
                    SELECT 
                        Cast(sum (case when amount > 0 then amount::text::NUMERIC(30,5) else 0 end) -  sum (case when amount < 0 then ABS(amount::text::NUMERIC(30,5)) else 0 end) as real ) as "opeiningBalance"
                    FROM "JournalRecords"
                    INNER JOIN "Accounts" ON "Accounts".id = "JournalRecords"."accountId"
                    INNER JOIN "Branches" ON "JournalRecords"."branchId" = "Branches".id 
                    WHERE "accountId" = $1::uuid
                    AND "JournalRecords"."companyId"= $3
                    AND ($4::uuid[] is null or  "JournalRecords"."branchId"  = any($4::uuid[]) or ( "JournalRecords"."branchId" is null  and "JournalRecords"."companyId" =  $3) )
                    AND ("JournalRecords"."createdAt"::timeStamp<$2::timeStamp) 
                    and  ("Accounts".name <> 'Inventory Assets' or "JournalRecords"."dbTable" not in ('Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment')))
           
                    select sum("opeiningBalance"::NUMERIC(30,5) ) as "opeiningBalance" from "journals"
                                `
                query.values = [accountId, from, companyId, branches]

                const opeiningBalanceData = await DB.excu.query(query.text, query.values)
                const resault: any = opeiningBalanceData.rows[0];
                console.log("opeiningBalanceData", opeiningBalanceData.rows[0])
                opeiningBalance = resault.opeiningBalance == null ? 0 : resault.opeiningBalance;
            }

            let count = journals.rows && journals.rows.length > 0 ? Number((<any>journals.rows[0]).count) : 0

            for (let index = 0; index < journals.rows.length; index++) {
                const element = journals.rows[index];
                Helper.roundNumbers(afterDecimal, journals.rows[index])
            }

            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (journals.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            let resData = {
                journals: journals.rows,
                openingBalance: opeiningBalance,
                count: count,
                total: journals.rows && journals.rows.length > 0 ? { debit: Number((<any>journals.rows[0]).debitTotal), credit: Number((<any>journals.rows[0]).creditTotal) } : {},
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }
            console.log("filter.exportfilter.exportfilter.export", filter.export)
            if (filter && filter.export) {
                let account = data.account

                if (account) {
                    account.openingBalance = opeiningBalance ?? 0;
                    journals.rows = journals.rows
                    // journals.rows.sort((a: any, b: any) => (a.grandTypeIndex - b.grandTypeIndex|| a.parentTypeIndex - b.parentTypeIndex|| 0-(a.type>b.type?1:-1)) )
                    let report = new ReportData()
                    report.filter = {
                        title: `${account.name} Journal`,
                        fromDate: filter && filter.fromDate ? filter.fromDate : null,
                        toDate: filter && filter.toDate ? filter.toDate : new Date(),
                        branches: branches,
                        // compareType: compareType,
                        accountDetils: account,
                    }
                    report.records = journals.rows

                    //get columns & subColumns

                    report.columns = [...[{ key: 'createdAt', header: 'Date', properties: { columnType: 'date' } },
                    { key: 'code' },
                    { key: 'type' },
                    { key: 'referenceCode', header: 'Reference Number' },
                    { key: 'debit', properties: { hasTotal: true, columnType: 'currency' } },
                    { key: 'credit', properties: { hasTotal: true, columnType: 'currency' } }
                    ], ...report.columns]
                    report.fileName = `${account.name} Journal`
                    return new ResponseData(true, "", report)
                }

            } else {
                return new ResponseData(true, "", resData)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getCostOfGoodSolds(data: any, company: Company, brancheList: []) {
        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? filter.fromDate : null;
            if (fromDate)
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

            let accountId = filter && filter.accountId ? filter.accountId : null;

            console.log("accountaccountaccountaccount", data.account)

            const query: { text: string, values: any } = {
                text: `with "journals" as (
                          select sum(case when "qty" < 0 then ("qty"::text::NUMERIC(30,5)* COALESCE(nullif("InventoryMovmentRecords"."cost"::text::NUMERIC(30,5),'NaN'),0) ) else 0 end *-1)  as "debit",
                                 sum(case when "qty" > 0 then "qty"::text::NUMERIC(30,5)* COALESCE(nullif("InventoryMovmentRecords"."cost"::text::NUMERIC(30,5),'NaN'),0 )  else 0 end * -1 )  as "credit",
                           "InventoryMovmentRecords"."referenceTable" as "type",
                            COALESCE("InventoryMovmentRecords"."code","InventoryMovmentRecords"."referenceTable") as "code",
                            "InventoryMovmentRecords"."transactionId" as "referenceId",
                            "InventoryMovmentRecords"."createdAt" ,
                            null as "userId",
                            null as "userName",
                            null as "userType",
                            null as "referenceCode"
                         from "InventoryMovmentRecords" 
	                     where "InventoryMovmentRecords"."companyId" = $1
					    AND ( $2::uuid[] is null or  "InventoryMovmentRecords"."branchId"  = any($2::uuid[] ) or ( "InventoryMovmentRecords"."branchId" is null  and "InventoryMovmentRecords"."companyId" =  $1) )
                        AND( $3::timestamp is null or  "InventoryMovmentRecords"."createdAt">=$3)
                        AND "InventoryMovmentRecords"."createdAt"<$4
                        AND "InventoryMovmentRecords"."referenceTable" NOT IN (  'Opening Balance','Billing','Supplier Credit' )
                        and ("InventoryMovmentRecords"."qty" * "InventoryMovmentRecords"."cost" <> 0 )
                        group by "InventoryMovmentRecords"."transactionId","InventoryMovmentRecords"."referenceTable","InventoryMovmentRecords"."code","InventoryMovmentRecords"."referenceTable",    "InventoryMovmentRecords"."createdAt"
                      union all 
	                  SELECT 
                       CAST( sum(case when "JournalRecords".amount <0 then "JournalRecords".amount  else null end) AS REAL ) as debit,
                         CAST( sum(case when "JournalRecords".amount >0 then "JournalRecords".amount else null end) AS REAL )  as credit,
                        "JournalRecords"."dbTable" as type,
                        "JournalRecords".code,
                        "JournalRecords"."referenceId",
                        "JournalRecords"."createdAt"::date as "createdAt",
                        "JournalRecords"."userId",
                        "JournalRecords"."userName",
                        "JournalRecords"."userType",
    
                       "JournalLines"."code"   as "referenceCode"
                    FROM "JournalRecords"
                       INNER JOIN "Accounts" ON "Accounts".id = "JournalRecords"."accountId"
                    left join "JournalLines" on "JournalLines"."journalId" = "JournalRecords"."referenceId" and  "JournalRecords"."dbTable"  ='Journals'  and "JournalLines"."accountId" = $5
                    WHERE "Accounts"."id" = $5
	                AND "JournalRecords"."companyId" =$1
	                 AND ($2::uuid[] is null or  "JournalRecords"."branchId"  = any($2::uuid[]) or ( "JournalRecords"."branchId" is null  and "JournalRecords"."companyId" =  $1) )
	                AND( $3::timestamp is null or  "JournalRecords"."createdAt">=$3)
                    AND "JournalRecords"."createdAt"<$4
                    and  ("Accounts".name <> 'Costs Of Goods Sold' or "JournalRecords"."dbTable" not in ('Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment'))                   
                 
                    group by   "JournalRecords"."dbTable", "JournalRecords".code,   "JournalRecords"."referenceId", "JournalRecords"."createdAt"::date,"userId","userName", "userType","referenceCode"
                    ) 
	                         select  count (*) over() as "count" ,abs("debit"::text::NUMERIC(30,5)) as "debit",abs("credit"::text::NUMERIC(30,5)) as "credit",type,code,"referenceId","createdAt","userId","userName","userType", "referenceCode",  count (*) over() as "count" , sum("debit"::text::NUMERIC(30,5)) over() as "debitTotal" , sum("credit"::text::NUMERIC(30,5)) over() as "creditTotal" from "journals"
	                ORDER BY "journals"."createdAt" desc  
                    `,
                values: [companyId, branches, from, to, accountId]
            }


            let opeiningBalance = 0;


            query.text += filter && filter.export ? "" : ` limit ${limit} 
                  offset ${offset}`

            const journals = await DB.excu.query(query.text, query.values);
            /**Account Opening Balance Query =  sum of debit and credit of journal entries where createdAt < from  */
            if (filter && filter.fromDate && page == 1) {
                query.text = `with "journals" as (
                    select sum("qty"::text::NUMERIC(30,5) *(-1) * "cost"::text::NUMERIC(30,5) ) as "opeiningBalance"
                    from "InventoryMovmentRecords" 
                    WHERE "InventoryMovmentRecords"."companyId"= $3
                    AND( array_length($4::uuid[],1) IS NULL OR "InventoryMovmentRecords"."branchId" = any($4::uuid[]))
                    AND "InventoryMovmentRecords"."createdAt"::timeStamp<$2::timeStamp	
                    AND "InventoryMovmentRecords"."referenceTable" NOT IN ( 'Opening Balance' , 'Billing','Supplier Credit' )
                  	group by "InventoryMovmentRecords"."referenceTable","InventoryMovmentRecords"."code","InventoryMovmentRecords"."referenceTable",    "InventoryMovmentRecords"."createdAt"
                    union all 
                    SELECT 
                        Cast(sum (case when amount > 0 then amount::text::NUMERIC(30,5) else 0 end) -  sum (case when amount < 0 then ABS(amount::text::NUMERIC(30,5)) else 0 end) as real ) as "opeiningBalance"
                    FROM "JournalRecords"
                    INNER JOIN "Accounts" ON "Accounts".id = "JournalRecords"."accountId"
                    INNER JOIN "Branches" ON "JournalRecords"."branchId" = "Branches".id 
                    WHERE "accountId" = $1::uuid
                    AND "JournalRecords"."companyId"= $3
                    AND ($4::uuid[] is null or  "JournalRecords"."branchId"  = any($4::uuid[]) or ( "JournalRecords"."branchId" is null  and "JournalRecords"."companyId" =  $3) )
                    AND ("JournalRecords"."createdAt"::timeStamp<$2::timeStamp) 
                    and  ("Accounts".name <> 'Costs Of Goods Sold' or "JournalRecords"."dbTable" not in ('Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment')))
           
                    select sum("opeiningBalance"::NUMERIC(30,5) ) as "opeiningBalance" from "journals"
                                `
                query.values = [accountId, from, companyId, branches]

                const opeiningBalanceData = await DB.excu.query(query.text, query.values)
                const resault: any = opeiningBalanceData.rows[0];
                opeiningBalance = resault.opeiningBalance == null ? 0 : resault.opeiningBalance;
            }

            let count = journals.rows && journals.rows.length > 0 ? Number((<any>journals.rows[0]).count) : 0

            for (let index = 0; index < journals.rows.length; index++) {
                const element = journals.rows[index];
                Helper.roundNumbers(afterDecimal, journals.rows[index])
            }

            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (journals.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            let resData = {
                journals: journals.rows,
                openingBalance: opeiningBalance,
                count: count,
                total: journals.rows && journals.rows.length > 0 ? { debit: Math.abs(Number((<any>journals.rows[0]).debitTotal)), credit: Math.abs(Number((<any>journals.rows[0]).creditTotal)) } : {},
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }
            console.log(" filter.export filter.export filter.export", filter.export)
            if (filter && filter.export) {

                const account: any = data.account
                if (account) {
                    account.openingBalance = opeiningBalance ?? 0;
                    journals.rows = journals.rows
                    // journals.rows.sort((a: any, b: any) => (a.grandTypeIndex - b.grandTypeIndex|| a.parentTypeIndex - b.parentTypeIndex|| 0-(a.type>b.type?1:-1)) )
                    let report = new ReportData()
                    report.filter = {
                        title: `${account.name} Journal`,
                        fromDate: filter && filter.fromDate ? filter.fromDate : null,
                        toDate: filter && filter.toDate ? filter.toDate : new Date(),
                        branches: branches,
                        // compareType: compareType,
                        accountDetils: account,
                    }
                    report.records = journals.rows

                    //get columns & subColumns

                    report.columns = [...[{ key: 'createdAt', header: 'Date', properties: { columnType: 'date' } },
                    { key: 'code' },
                    { key: 'type' },
                    { key: 'referenceCode', header: 'Reference Number' },
                    { key: 'debit', properties: { hasTotal: true, columnType: 'currency' } },
                    { key: 'credit', properties: { hasTotal: true, columnType: 'currency' } }
                    ], ...report.columns]
                    report.fileName = `${account.name} Journal`
                    return new ResponseData(true, "", report)
                }

            } else {
                return new ResponseData(true, "", resData)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
            throw new Error(error)
        }

    }


    public static async accountJournalWithComparison(data: any, company: Company) {
        const client = await DB.excu.client();
        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : [];
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

            let NoOfperiod = filter && filter.periodQty ? filter.periodQty : null;
            let period = filter && filter.period ? filter.period : null;
            let compareType = filter && filter.compareType ? filter.compareType.toLowerCase() : null;
            let comparison = filter && ((compareType == "period" && period) || (compareType == "branch")) ? true : false
            let columns = ["Total"]
            let results: any = []

            let accountId = filter && filter.accountId ? filter.accountId : null;


            await client.query("BEGIN")

            /**Interval Selection Query */
            const query: { text: string, values: any } = {
                text: `WITH "values" AS (
                        SELECT  $1::uuid AS "companyId",
                                $2::uuid[] AS "branches",
                                $3::timestamp AS "fromDate",
                                $4::timestamp AS "toDate",
                                $5::TEXT AS "period",
                                $6::int AS "periodQty",
                                $7::BOOLEAN AS "comparison",
                                $8::INT as "afterDecimal",
                                $9::uuid as "accountId"
                        )	
                        ,"records" as (
                        SELECT 
                            sum(case when amount >0 then amount else null end) as debit,
                            sum(case when amount <0 then ABS(amount) else null end) as credit,
                            "dbTable" as type, "JournalRecords".code, "referenceId","JournalRecords"."createdAt",
                            "userId", "userName","userType",
                            case when "period" IS NULL and "comparison" = true then "Branches".name end as "journalBranchName",
                            case when "period" IS NULL and "comparison" = true  then null else  "JournalRecords"."createdAt"::text end as "key"
                        FROM "JournalRecords"
                        JOIN "values" ON true
                        INNER JOIN "Branches" ON "JournalRecords"."branchId" = "Branches".id 
                        WHERE "JournalRecords"."accountId" = "values"."accountId"
                        AND "Branches"."companyId"= "values"."companyId"
                        AND (array_length("values"."branches",1) IS NULL OR "Branches".id = any("values"."branches"))
                        AND ( ("comparison" = false and "JournalRecords"."createdAt" >= "values"."fromDate"  AND "JournalRecords"."createdAt" < "values"."toDate")  or 
                            ("comparison" = true and "period" ='Month'and  "JournalRecords"."createdAt" >= "fromDate"::timestamp - interval '1 month' *  "periodQty" and "JournalRecords"."createdAt" < "values"."toDate") or
                            ("comparison"  =true and "period" ='Year' and  "JournalRecords"."createdAt" >= "fromDate"::timestamp - interval '1 year' *  "periodQty" and "JournalRecords"."createdAt" < "values"."toDate") or
                            ("comparison"  =true  and  "JournalRecords"."createdAt" >= "fromDate"::timestamp and "JournalRecords"."createdAt" < "values"."toDate") 
                            )
                        group by "dbTable", "JournalRecords".code, "referenceId","JournalRecords"."createdAt","userId","userName", "userType", "values"."branches", "journalBranchName", "key" 
                        ORDER BY "JournalRecords"."createdAt" ASC
                        )
                        ,"summary" as (
                            SELECT  type, code, "referenceId","createdAt", "userId", "userName","userType",
                                    "journalBranchName", 
                                    case when "values"."comparison" = true  and "period"='Month' then trim(to_char( "key"::timestamp,'Mon/yyyy'))::text
                                        when  "values"."comparison" = true  and "period"='Year' then extract (year from "key"::timestamp)::text
                                        when "comparison" = true and "values"."period" IS null then "journalBranchName"
                                        else 'Total'
                                    end AS "columnName",
                                    SUM(debit) AS "debit",
                                    SUM(credit) As"credit"
                            FROM "records"
                            JOIN "values" ON TRUE 
                            GROUP BY "columnName", type, code, "referenceId","createdAt", "userId", "userName","userType" ,"journalBranchName"
                        )
                        ,"filters" as (
                            SELECT  CASE WHEN "comparison" = true AND "values"."period" LIKE 'Year' THEN JSONB_AGG("columnName" ORDER BY "columnName")
                                        WHEN "comparison" = true AND "values"."period" LIKE 'Month' THEN JSONB_AGG("columnName" ORDER BY TO_DATE("columnName", 'Mon/YYYY'))  FILTER (WHERE "columnName" ~ '^[A-Z][a-z]{2}/[0-9]{4}$') 
                                        WHEN "comparison" = true AND "values"."period" IS null   then JSONB_AGG("columnName" ORDER BY "columnName") 
                                    END AS "columns"
                            FROM ( select DISTINCT COALESCE("columnName","journalBranchName")"columnName"
                                from "summary"
                                join "values" on true 
                                ) AS subquery
                            JOIN "values" on true 
                            GROUP BY "comparison" , "period","values"."branches"
                        )
                        SELECT  type, code, "referenceId","createdAt", "userId", "userName","userType",
                                "filters"."columns",
                                JSON_AGG(JSON_BUILD_OBJECT("columnName",JSON_BUILD_OBJECT('debit',COALESCE("debit",0),'credit',COALESCE("credit",0) ))) FILTER (WHERE "columnName" is not null) as "summary"
                        FROM "summary"
                        JOIN "values" on true
                        JOIN "filters" on true
                        GROUP BY type, code, "referenceId","createdAt", "userId", "userName","userType", "comparison", "filters"."columns" `,
                values: [companyId, branches, from, to, period, NoOfperiod, comparison, afterDecimal, accountId]
            }

            let opeiningBalance = 0;


            const journals = await client.query(query.text, query.values);
            /**Account Opening Balance Query =  sum of debit and credit of journal entries where createdAt < from  */
            if (filter && filter.fromDate) {
                query.text = `WITH "values" AS (
                                SELECT  $1::uuid AS "companyId",
                                $2::uuid[] AS "branches",
                                $3::timestamp AS "fromDate",
                                $4::timestamp AS "toDate",
                                $5::TEXT AS "period",
                                $6::int AS "periodQty",
                                $7::BOOLEAN AS "comparison",
                                $8::INT as "afterDecimal",
                                $9::uuid as "accountId"
                            )	
                            ,"records" as (
                            SELECT 
                                sum (case when amount > 0 then amount else 0 end) -  sum (case when amount < 0 then ABS(amount) else 0 end) as "opeiningBalance" ,                       
                                case when "period" IS NULL and "comparison" = true then "Branches".name end as "journalBranchName",
                                case when "period" IS NULL and "comparison" = true  then null else  "JournalRecords"."createdAt"::text end as "key"
                            FROM "JournalRecords"
                            JOIN "values" ON true
                            INNER JOIN "Branches" ON "JournalRecords"."branchId" = "Branches".id 
                            WHERE "JournalRecords"."accountId" = "values"."accountId"
                            AND "Branches"."companyId"= "values"."companyId"
                            AND (array_length("values"."branches",1) IS NULL OR "Branches".id = any("values"."branches"))
                            AND ( ("comparison" = false and "JournalRecords"."createdAt" >= "values"."fromDate"  AND "JournalRecords"."createdAt" < "values"."toDate")  or 
                                ("comparison" = true and "period" ='Month'and  "JournalRecords"."createdAt" >= "fromDate"::timestamp - interval '1 month' *  "periodQty" and "JournalRecords"."createdAt" < "values"."toDate") or
                                ("comparison"  =true and "period" ='Year' and  "JournalRecords"."createdAt" >= "fromDate"::timestamp - interval '1 year' *  "periodQty" and "JournalRecords"."createdAt" < "values"."toDate") or
                                ("comparison"  =true  and  "JournalRecords"."createdAt" >= "fromDate"::timestamp and "JournalRecords"."createdAt" < "values"."toDate") 
                                )
                            group by  "values"."branches", "journalBranchName", "key" 
                            )
                            ,"summary" as (
                                SELECT  
                                        "journalBranchName", 
                                        case when "values"."comparison" = true  and "period"='Month' then trim(to_char( "key"::timestamp,'Mon/yyyy'))::text
                                            when  "values"."comparison" = true  and "period"='Year' then extract (year from "key"::timestamp)::text
                                            when "comparison" = true and "values"."period" IS null then "journalBranchName"
                                            else 'Total'
                                        end AS "columnName",
                                        SUM("opeiningBalance") AS "opeiningBalance"
                                FROM "records"
                                JOIN "values" ON TRUE 
                                GROUP BY "columnName", "journalBranchName"
                            )
                            ,"filters" as (
                                SELECT  CASE WHEN "comparison" = true AND "values"."period" LIKE 'Year' THEN JSONB_AGG("columnName" ORDER BY "columnName")
                                            WHEN "comparison" = true AND "values"."period" LIKE 'Month' THEN JSONB_AGG("columnName" ORDER BY TO_DATE("columnName", 'Mon/YYYY'))  FILTER (WHERE "columnName" ~ '^[A-Z][a-z]{2}/[0-9]{4}$') 
                                            WHEN "comparison" = true AND "values"."period" IS null   then JSONB_AGG("columnName" ORDER BY "columnName") 
                                        END AS "columns"
                                FROM ( select DISTINCT COALESCE("columnName","journalBranchName")"columnName"
                                    from "summary"
                                    join "values" on true 
                                    ) AS subquery
                                JOIN "values" on true 
                                GROUP BY "comparison" , "period","values"."branches"
                            )
                            SELECT   
                                    "filters"."columns",
                                    JSON_AGG(JSON_BUILD_OBJECT("columnName","opeiningBalance")) FILTER (WHERE "columnName" is not null) as "summary"
                            FROM "summary"
                            JOIN "values" on true
                            JOIN "filters" on true
                            GROUP BY  "comparison", "filters"."columns" `
                query.values = [companyId, branches, from, to, period, NoOfperiod, comparison, afterDecimal, accountId]

                const opeiningBalanceData = await client.query(query.text, query.values)
                const resault = opeiningBalanceData.rows[0];
                opeiningBalance = resault.opeiningBalance == null ? 0 : resault.opeiningBalance;
            }

            for (let index = 0; index < journals.rows.length; index++) {
                const element = journals.rows[index];
                Helper.roundNumbers(afterDecimal, journals.rows[index])

            }

            const journal = {
                openingBalance: opeiningBalance,
                journals: journals.rows
            }

            await client.query("COMMIT")
            return new ResponseData(true, "", journal)
        } catch (error: any) {
            await client.query("ROLLBACK")
          
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }

    public static async exprotReport(data: any, fileName: string, company: Company, branches: []): Promise<ResponseData> {
        try {
            const companyId = company.id;



            let records: any[] = (await ReportRepo.voidTransactionsReport(data, company, branches)).data.records;
            if (records && records.length > 0) {
                let total = { amount: `=SUM(E2:E${records.length + 1})`, }
                records.push(total)
            }


            let header = [
                { id: 'createdAt', title: 'Date' },
                { id: 'invoiceNumber', title: 'Invoice Number' },
                { id: 'productName', title: 'Product Name' },
                { id: 'employeeName', title: 'Employee Name' },
                { id: 'amount', title: 'Amount' },
                { id: 'voidReason', title: 'void Reason' },
            ]






            // Define the CSV writer
            const csvWriter = createObjectCsvWriter({
                path: companyId + fileName + '.csv',
                header: header,
            });



            // Write the data to the CSV file
            await csvWriter.writeRecords(records);




            return new ResponseData(true, "", fileName + " exported successfully.");

        } catch (error: any) {
          
            throw new Error("Error exporting" + fileName + ": " + error.message); // Include the actual error message
        }
    }

    public static async exprotXlsxReport(data: any, fileName: string, company: Company, branches: []): Promise<ResponseData> {
        try {
            const companyId = company.id;
            let fileName = 'voidTransactionsReport'



            let records: any[] = (await ReportRepo.voidTransactionsReport(data, company, branches)).data.records;
            if (records && records.length > 0) {
                let total = { amount: `=SUM(E2:E${records.length + 1})`, }
                records.push(total)
            }


            let header = [
                { id: 'createdAt', title: 'Date' },
                { id: 'invoiceNumber', title: 'Invoice Number' },
                { id: 'productName', title: 'Product Name' },
                { id: 'employeeName', title: 'Employee Name' },
                { id: 'amount', title: 'Amount' },
                { id: 'voidReason', title: 'void Reason' },
            ]






            // Define the CSV writer
            const csvWriter = createObjectCsvWriter({
                path: companyId + fileName + '.csv',
                header: header,
            });



            // Write the data to the CSV file
            await csvWriter.writeRecords(records);




            return new ResponseData(true, "", fileName + " exported successfully.");

        } catch (error: any) {
          
            throw new Error("Error exporting" + fileName + ": " + error.message); // Include the actual error message
        }
    }











    public static async agingReportCategorization(maxAge: number, list: any[]) {
        try {

            for (let elem of list) {
                const age = elem.Age ?? elem.age
                const ageRange = (age % 15 == 0) ? `${Math.floor(age / 15) * 15 - 14} - ${Math.floor(age / 15) * 15} Days` :
                    `${Math.floor(age / 15) * 15 + 1} - ${Math.floor(age / 15) * 15 + 15} Days`;
                elem.category = ageRange
            }

            console.log(list)
            return new ResponseData(true, "", "")
        } catch (error: any) {

            throw new Error(error)
        }
    }

    public static async departmentSalesAndPaymentsOverview(data: any, company: Company, brancheList: []) {
        try {



            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;

            //######## filter by  ##########
            let filterBy = filter && filter.filterBy && ['brand', 'category', 'department'].includes(filter.filterBy) ? filter.filterBy : "category"
            let filterId = 'p."categoryId"'
            let JoinQuery = ` left join "Categories" on "Categories".id = sales_data."filterId" `
            let nameQuery = ` COALESCE("Categories".name,'unCategorized') `
            let depJoinQuery = ``


            if (filterBy == "brand") {
                filterId = 'p."brandid"'
                JoinQuery = ` left join "Brands" on "Brands".id = sales_data."filterId" `
                nameQuery = ` COALESCE("Brands".name,'Others') `
            } else if (filterBy == "department") {
                filterId = ' "Categories"."departmentId" '
                JoinQuery = ` left join "Departments" on "Departments".id = sales_data."filterId" `
                nameQuery = ` COALESCE("Departments".name,'Others') `
                depJoinQuery = `left join "Categories" on p."categoryId" = "Categories".id `
            }

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

            if (!Array.isArray(branches) || branches.length == 0) { branches = null };




            //##########################   query   ##########################

            let query: { text: string, values: any } = {
                text: `with "values" as (
                    select $1::uuid as "companyId",
                           $2::uuid[] as "branches",
                           $3::timestamp as "fromDate",
                           $4::timestamp as "toDate"
                    )
                 
                    `,
                values: [companyId, branches, from, to]
            }


            //######### categories #########

            let text = ` ,invoices as (
                        select invo.* 
                        from "Invoices" invo
                        join "values" on true
                        join "Branches" as branches on branches.id = invo."branchId"
                        where branches."companyId" = "values"."companyId"  
                            and invo."status" <> 'Draft' 
                            and (array_length("values"."branches",1) IS NULL or  branches.id = Any("values"."branches"))
                            and (invo."invoiceDate" >= "values"."fromDate" and invo."invoiceDate" < "values"."toDate"  )                       
                        )
                        ,invoice_lines as (
                        SELECT
                            ${filterId} as "filterId",
                            i.id as "invoiceId",
                            sum(il.total - COALESCE(il."taxTotal") + COALESCE(il."discountTotal") ) as sales_total,
                            sum(il."discountTotal") as discount,
                            sum(il."taxTotal") as tax,
                            sum(il.total) as total
                        FROM "InvoiceLines" il
                        join invoices i on il."invoiceId"= i.id 
                        join "Products" p on p.id = il."productId"
                        ${depJoinQuery}
                        group by   "filterId", i.id
                        )
                        ,creditNote_lines as(
                        SELECT
                           ${filterId} as "filterId",
                            i.id as "invoiceId",
                            sum(cl.total - COALESCE(cl."taxTotal",0) + COALESCE(cl."discountTotal",0) ) as sales_total,
                            sum(cl."discountTotal") as discount,
                            sum(cl."taxTotal") as tax,
                            sum(cl.total) as total
                        FROM "CreditNoteLines" cl
                        join "CreditNotes" c on cl."creditNoteId"= c.id 
                        join invoices i on c."invoiceId"= i.id 
                        join "Products" p on p.id = cl."productId"
                         ${depJoinQuery}
                        group by "filterId", i.id
                        )
                        , totals as (
                        SELECT
                            i.id as "invoiceId",
                            i.total- COALESCE(sum(c.total),0) as total
                        FROM invoices i
                        left join "CreditNotes" c on c."invoiceId"= i.id 
                        group by i.id, i.total
                        )
                        ,records as (
                        select 	invoice_lines."invoiceId", 
                                invoice_lines."filterId",
                                sum(invoice_lines.sales_total) as  sales_amount,
                                sum(invoice_lines.discount) as discount,
                                sum(invoice_lines.tax) as tax,
                                sum(invoice_lines.total) as invoice_total,
                                sum(creditNote_lines.total) as credit_total, 
                                sum(invoice_lines.total - COALESCE(creditNote_lines.total,0)) as total
                        from invoice_lines
                        left join creditNote_lines on creditNote_lines."filterId" = invoice_lines."filterId" 
                                                and creditNote_lines."invoiceId" = invoice_lines."invoiceId"
                        group by invoice_lines."invoiceId", invoice_lines."filterId"
                        )
                        ,payment_data as (
                        select 
                            ip."paymentMethodId", "PaymentMethods".name as "paymentMethodName",
                            r."filterId",
                        sum ( case when totals.total<> 0 then (r.total) /(COALESCE(totals.total,0))  * COALESCE(ipl.amount,0) else 0 end ) as paid_amount ,
                        sum ( case when totals.total<> 0 then (r.total) /(COALESCE(totals.total,0))  * COALESCE(ipl.amount/ip."paidAmount" * ip."bankCharge",0) else 0 end ) as bank_charge 
                        from records r
                        left join 	totals on totals."invoiceId" = r."invoiceId"
                        left join	"InvoicePaymentLines" ipl on ipl."invoiceId" = r."invoiceId"
                        left join	"InvoicePayments" ip on ip.id  = ipl."invoicePaymentId" 
                        left join "PaymentMethods" on "PaymentMethods".id = ip."paymentMethodId"
                        where  ip.status ='SUCCESS'
                        group by ip."paymentMethodId", 
                            r."filterId", "PaymentMethods".name 
                        )
                        ,sales_data as (
                        select 
                                "filterId",
                                sum(sales_amount) as  sales_amount,
                                sum(discount) as discount,
                                sum(tax) as tax,
                                sum(invoice_total) as invoice_total,
                                sum(credit_total) as credit_total, 
                                sum(total) as total
                        from records
                        group by "filterId"
                        )
                        ,"keys" as (select json_agg(distinct  "paymentMethodName") as "keys" from payment_data where "paymentMethodName" is not null )

                        select sales_data."filterId",
                            ${nameQuery} as "filterName",
                            sales_data.sales_amount,
                            sales_data.discount,
                            sales_data.tax,
                            sales_data.invoice_total,
                            sales_data.credit_total,
                            sales_data.credit_total,
                            sales_data.total,
                            (select * from "keys") as "keys",
                            jsonb_object_agg( COALESCE("paymentMethodName",'other'),  COALESCE( payment_data.paid_amount,0)) FILTER(where "paymentMethodName" is not null ) as "payments", 
                            sum(payment_data.bank_charge) as bank_charge
                        from sales_data
                        left join payment_data on (payment_data."filterId" = sales_data."filterId") or (payment_data."filterId" is null and sales_data."filterId" is null)
                        ${JoinQuery}
                        group by sales_data."filterId", "filterName", sales_data.sales_amount,
                            sales_data.discount,
                            sales_data.tax,
                            sales_data.invoice_total,
                            sales_data.credit_total,
                            sales_data.credit_total,
                            sales_data.total
                    `

            let record1 = await DB.excu.query(query.text + text, query.values)

            //######### charges #########

            text = `,invoices as (
                    select invo.* 
                    from "Invoices" invo
                    join "values" on true
                    join "Branches" as branches on branches.id = invo."branchId"
                    where branches."companyId" = "values"."companyId"  
                        and invo."status" <> 'Draft' 
                        and (array_length("values"."branches",1) IS NULL or  branches.id = Any("values"."branches"))
                        and (invo."invoiceDate" >= "values"."fromDate" and invo."invoiceDate" < "values"."toDate"  )                       
                    )
                    ,records as (

                    SELECT
                        'cahrges' as "filterName",
                        i.id as "invoiceId",
                        i."chargeTotal"  - case when i."isInclusiveTax" = true then COALESCE((i."chargesTaxDetails"->>'taxTotal')::numeric,0) else 0 end as sales_total,
                        0 as discount,
                        (i."chargesTaxDetails"->>'taxTotal')::numeric as  tax,
                        i."chargeTotal"  + case when i."isInclusiveTax" <> true then COALESCE((i."chargesTaxDetails"->>'taxTotal')::numeric,0) else 0 end as invoice_Total,
                        sum(c."chargeTotal"  + case when c."isInclusiveTax" <> true then COALESCE((c."chargesTaxDetails"->>'taxTotal')::numeric,0) else 0 end) as credit_total
                    FROM invoices as i
                    left join "CreditNotes" c on c."invoiceId"= i.id
                    where i."chargeTotal" <> 0
                    group by i.id, i."chargeTotal" , i."isInclusiveTax" , i."chargesTaxDetails" 
                    UNION all 
                    SELECT
                        'delivery Charge' as "filterName",
                        i.id as "invoiceId",
                        i."deliveryCharge"  - case when i."isInclusiveTax" = true then COALESCE((i."deliveryChargeTaxDetails"->>'taxTotal')::numeric,0) else 0 end as sales_total,
                        0 as discount,
                        (i."deliveryChargeTaxDetails"->>'taxTotal')::numeric as  tax,
                        i."deliveryCharge"  + case when i."isInclusiveTax" <> true then COALESCE((i."deliveryChargeTaxDetails"->>'taxTotal')::numeric,0) else 0 end as invoice_Total,
                        sum(c."deliveryCharge"  + case when c."isInclusiveTax" <> true then COALESCE((c."deliveryChargeTaxDetails"->>'taxTotal')::numeric,0) else 0 end) as credit_total
                    FROM invoices as i
                    left join "CreditNotes" c on c."invoiceId"= i.id
                    where i."deliveryCharge" <> 0
                    group by i.id, i."deliveryCharge" , i."isInclusiveTax" , i."deliveryChargeTaxDetails" 
                    )

                    , totals as (
                    SELECT
                        i.id as "invoiceId",
                        i.total- COALESCE(sum(c.total),0) as total
                    FROM invoices i
                    left join "CreditNotes" c on c."invoiceId"= i.id 
                    group by i.id, i.total
                    )

                    ,payment_data as (
                    select 
                        ip."paymentMethodId", "PaymentMethods".name as "paymentMethodName",
                        r."filterName",
                        sum ( case when totals.total<> 0 then (r.invoice_total - COALESCE(r.credit_total,0) ) /(COALESCE(totals.total,0))  * COALESCE(ipl.amount,0) else 0 end ) as paid_amount ,
                        sum ( case when totals.total<> 0 then (r.invoice_total - COALESCE(r.credit_total,0) ) /(COALESCE(totals.total,0))  * COALESCE(ipl.amount/ip."paidAmount" * ip."bankCharge",0) else 0 end ) as bank_charge 
                    from records r
                    left join 	totals on totals."invoiceId" = r."invoiceId"
                    left join	"InvoicePaymentLines" ipl on ipl."invoiceId" = r."invoiceId"
                    left join	"InvoicePayments" ip on ip.id  = ipl."invoicePaymentId"
                    left join "PaymentMethods" on "PaymentMethods".id = ip."paymentMethodId"
                    where  ip.status ='SUCCESS'

                    group by ip."paymentMethodId", 
                        "PaymentMethods".name ,"filterName"
                    )
                    ,sales_data as (
                    select 
                            "filterName",
                            sum(sales_total) as  sales_amount,
                            sum(discount) as discount,
                            sum(tax) as tax,
                            sum(invoice_total) as invoice_total,
                            sum(credit_total) as credit_total, 
                            sum(invoice_total -  COALESCE(credit_total,0)) as total
                    from records
                    group by "filterName"
                    )
                    ,"keys" as (select json_agg(distinct  "paymentMethodName") as "keys" from payment_data where "paymentMethodName" is not null )

                    select sales_data."filterName",
                        sales_data.sales_amount,
                        sales_data.discount,
                        sales_data.tax,
                        sales_data.invoice_total,
                        sales_data.credit_total,
                        sales_data.credit_total,
                        sales_data.total,
                        (select * from "keys") as "keys",
                        jsonb_object_agg( COALESCE("paymentMethodName",'other'),  COALESCE( payment_data.paid_amount,0)) FILTER(where "paymentMethodName" is not null ) as "payments", 
                        sum(payment_data.bank_charge) as bank_charge
                    from sales_data
                    left join payment_data on payment_data."filterName" = sales_data."filterName" 
                    group by   sales_data."filterName", sales_data.sales_amount,
                        sales_data.discount,
                        sales_data.tax,
                        sales_data.invoice_total,
                        sales_data.credit_total,
                        sales_data.credit_total,
                        sales_data.total
                    `
            let record2 = await DB.excu.query(query.text + text, query.values)

            let r1 = (record1.rows && record1.rows.length > 0) ? record1.rows : []
            let r2 = (record2.rows && record2.rows.length > 0) ? record2.rows : []
            let records = [...r1, ...r2]


            let r1keys = r2.length > 0 && (<any>r2[0]).keys ? (<any>r2[0]).keys : []
            let recordskeys = records.length > 0 && (<any>records[0]).keys ? (<any>records[0]).keys : []
            let array = [...r1keys, ...recordskeys]


            let keys = [...new Set(array)]
            let childs: DataColumn[] = []
            let subColumns = keys ? keys.forEach((subcol: any) => childs.push({ key: subcol, properties: { hasTotal: true, columnType: 'currency' } })) : []

            //##########################
            if (filter.export) {
                let report = new ReportData()


                //get companyInfo
                let companyInfo = (await CompanyRepo.getCompanyById(company.id)).data
                const afterDecimal = companyInfo.settings.afterDecimal ?? 3
                const currencySymbol = companyInfo.settings.currencySymbol ?? "BHD"

                records.forEach((e: any) => {
                    e.filterName = e.filterName
                        + '\n    Sales Amount: ' + currencySymbol + Number(e.sales_amount).toFixed(afterDecimal)
                        + '\n    Discount: ' + currencySymbol + Number(e.discount).toFixed(afterDecimal)
                        + '\n    Tax: ' + currencySymbol + Number(e.tax).toFixed(afterDecimal)
                })


                report.filter = {
                    title: "Department Sales And Payments Overview",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: brancheList,
                    filterList: [{ "filterby": filterBy }]
                }
                report.records = records
                report.columns = [{ key: 'filterName', header: filterBy },
                { key: 'invoice_total', properties: { columnType: 'currency' } },
                { key: 'credit_total', properties: { columnType: 'currency' } },
                { key: 'total', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'payments', childs: childs, properties: { hasTotal: true, columnType: 'currency' } },

                ]
                report.fileName = 'departmentSalesAndPaymentsOverview'
                return new ResponseData(true, "", report)

            }

            let resData = {
                records: records.map(({ keys, ...rest }: any) => rest),
                columns: ['payments'],
                subColumns: keys
            }



            return new ResponseData(true, "", resData)


        } catch (error: any) {
            console.log(error)
          
            throw new Error(error)
        }
    }
    public static async reorderAlertReport(data: any, company: Company, brancheList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;

            //-------------- filter  --------------
            let filterQuery = ``
            let locations = filter && filter.locations ? filter.locations : []
            let types = filter && filter.types ? filter.types : []
            let stockStatus = filter && filter.stockStatus ? filter.stockStatus : ''
            filterQuery += (branches && branches.length > 0) ? ` and bp."branchId"   = any("values" ."branches"::uuid[]) ` : ``
            filterQuery += (locations && locations.length > 0) ? ` and bp."locationId" = any("values" ."locations") ` : ``
            filterQuery += (types && types.length > 0) ? ` and type            = any("values" ."types") ` : ``
            filterQuery += (stockStatus) ? ` and (CASE
                                                        WHEN bp."onHand" > bp."reorderPoint" THEN 'Normal'
                                                        WHEN bp."onHand" <= bp."reorderPoint" AND bp."onHand" > bp."reorderLevel" THEN 'Low Stock'
                                                        ELSE 'Critical'
                                                    END) = "values" ."stockStatus" ` : ``


            //---------------------------------------
            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 20);
            let offset = limit * (page - 1);
            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`




            let total = {};
            let count = 0;
            let resault: any[] = [];

            /**-- Reorder Alert Report	

                    -- Filter on Branch , Location, type, stockStatus
                    --- stockStatus(Orange:Low Stock, Critical : Red)
                    -- expected stockOut date (Red: if less than 7 days, orange: if 8 days to 14 days , other: black)
                    -- fix dublicate products in warehouse
                    -- add stockStatus,expected stockOut date  on base query
                    -- Parent Product
                    -- barcodes

 CASE 
                        WHEN COALESCE(sales."weeklySold",0) = 0 THEN NULL
                        ELSE CURRENT_DATE + (base."onHand" / sales."weeklySold") * INTERVAL '7 days'
                    END


 */
            //##########################   query   ##########################

            let query: { text: string, values: any } = {
                text: `with "values" as (
                    select $1::uuid as "companyId",
                           $2::uuid[] as "branches",
                           $3::uuid[] as "locations",
                           $4::text[] as "types",
                           $5::text as "stockStatus"
                    )
                 
                    `,
                values: [companyId, branches, locations, types, stockStatus]
            }

            const countQuery = `
                        select count(*) 
                        FROM "Products" 
                        Inner Join "BranchProducts" bp on "Products".id = bp."productId" and "onHand" > 0
                        join "values" on true
                              where "Products"."companyId" = $1
                              and "Products"."type"  = 'inventory'
                        and   "Products"."isDeleted" = False 
                  
                        ${filterQuery}`


            // const selectQuery= `
            //         , base AS (
            //         SELECT 
            //             bp.id,
            //             "Products".name,
            //             "Products".barcode,
            //             "Products"."parentId",
            //             "Products"."UOM", 
            //             bp."productId",
            //             bp."branchId",
            //             bp."locationId",
            //             bp."onHand",
            //             bp."reorderLevel",
            //             bp."reorderPoint",
            //             CASE 
            //                 WHEN bp."onHand" <= COALESCE(bp."reorderLevel",0) THEN (COALESCE(bp."reorderPoint",0) - bp."onHand")
            //                 ELSE 0
            //             END AS "suggestedOrderQty",
            //             CASE
            //                 WHEN COALESCE(bp."onHand",0) > COALESCE(bp."reorderPoint", 0) THEN 'Normal'
            //                 WHEN COALESCE(bp."onHand",0) <= COALESCE(bp."reorderPoint",0) AND bp."onHand" > COALESCE(bp."reorderLevel",0) THEN 'Low Stock'
            //                 ELSE 'Critical'
            //             END AS "stockStatus"

            //         FROM "BranchProducts" bp
            //         join "values" on true
            //         Inner Join "Products" on "Products".id = bp."productId"
            //         WHERE   "Products"."isDeleted" = False and "onHand" > 0
            //             and "Products"."companyId" = $1
            //             ${filterQuery}
            //         ORDER BY bp."branchId", bp."productId"
            //         ${limitQuery}
            //         )

            //         SELECT 
            //         b.name AS "branchName",
            //         loc.name AS "locationName",
            //         base."productId" AS "productId",
            //         base.name AS "productName",
            //         base."UOM",
            //         base.barcode,
            //         parent."parentName" ,
            //         parent."parentBarcode" ,
            //         base."onHand" AS "currentStock",
            //         base."reorderLevel",
            //         base."reorderPoint",
            //         "suggestedOrderQty",
            //         "stockStatus",
            //             COALESCE(usages."weeklyUsage", 0) AS "weeklyUsage",
            //         COALESCE(sales."weeklySold", 0) AS "weeklySales",
            //         CASE 
            //                 WHEN COALESCE(usages."weeklyUsage",0) = 0 THEN NULL
            //                 ELSE CURRENT_DATE + (base."onHand" / usages."weeklyUsage") * INTERVAL '7 days'
            //         END AS "expectedStockoutDate",
            //         suppliers."lastSupplierName",
            //         suppliers."lastPurchaseDate",
            //         suppliers."lastQty"
            //         FROM base
            //         JOIN "Branches" b ON b.id = base."branchId"
            //         LEFT JOIN inventorylocations loc ON loc.id = base."locationId"

            //         LEFT JOIN (
            //         SELECT 
            //             i."branchId", "productId", 
            //             SUM("qty") / 4 AS "weeklySold"
            //         FROM "InvoiceLines" il
            //         JOIN "Invoices" i ON i.id = il."invoiceId"
            //         WHERE il."createdAt" >= CURRENT_DATE - INTERVAL '30 days'
            //         GROUP BY i."branchId", "productId"
            //         ) sales ON sales."productId" = base."productId" AND sales."branchId" = base."branchId"


            //             LEFT JOIN (
            //             SELECT 
            //                 m."branchId",
            //                 m."productId", 
            //                 sum(m.qty::text::numeric)/ 4  as "weeklyUsage"
            //             FROM "InventoryMovmentRecords" as m
            //             WHERE  m."createdAt" >= CURRENT_DATE - INTERVAL '30 days'  
            //             GROUP BY m."branchId", m."productId"

            //             ) usages ON usages."productId" = base."productId" AND usages."branchId" = base."branchId"


            //         LEFT JOIN (
            //             SELECT DISTINCT ON (bl."productId", b."branchId")
            //                 bl."productId",
            //                 b."branchId",
            //                 s.name AS "lastSupplierName",
            //                 b."billingDate" AS "lastPurchaseDate",
            //                 bl.qty AS "lastQty"
            //             FROM "BillingLines" bl
            //             JOIN "Billings" b ON b.id = bl."billingId"
            //             JOIN "Suppliers" s ON s.id = b."supplierId"
            //             ORDER BY bl."productId", b."branchId", b."billingDate" DESC, bl.qty DESC
            //         ) suppliers ON suppliers."productId" = base."productId" AND suppliers."branchId" = base."branchId"

            //         LEFT JOIN (
            //             SELECT  id as "productId" , 
            //                     name as "parentName",
            //                     barcode as "parentBarcode"
            //             FROM "Products"
            //         ) parent on  parent."productId" = base."parentId"
            //         `




            const selectQuery = `, base AS (
                                        SELECT 
                                            bp.id,
                                            "Products".name,
                                            "Products".barcode,
                                            "Products"."parentId",
                                            "Products"."UOM", 
                                            bp."productId",
                                            bp."branchId",
                                            bp."locationId",
                                            bp."onHand",
                                            bp."reorderLevel",
                                            bp."reorderPoint",
                                            CASE 
                                                WHEN bp."onHand" <= COALESCE(bp."reorderLevel", 0) THEN (COALESCE(bp."reorderPoint", 0) - bp."onHand")
                                                ELSE 0
                                            END AS "suggestedOrderQty",
                                            CASE
                                                WHEN COALESCE(bp."onHand", 0) > COALESCE(bp."reorderPoint", 0) THEN 'Normal'
                                                WHEN COALESCE(bp."onHand", 0) <= COALESCE(bp."reorderPoint", 0) AND bp."onHand" > COALESCE(bp."reorderLevel", 0) THEN 'Low Stock'
                                                ELSE 'Critical'
                                            END AS "stockStatus"
                                        FROM "BranchProducts" bp
                                        join "values" on true
                                        INNER JOIN "Products" ON "Products".id = bp."productId"
                                        WHERE "Products"."companyId" = $1 
                                        and "Products"."type"  = 'inventory'
                                        and "Products"."isDeleted" = False 
                                                            ${filterQuery}
                                        ORDER BY bp."branchId", bp."productId"
                                            ${limitQuery}
                                    ),

                                    -- Fetch sales data for the products from the base query
                                    sales AS (
                                        SELECT 
                                            i."branchId", 
                                            il."productId", 
                                              SUM(il.qty::numeric) / 
                                                CASE 
                                                    WHEN EXTRACT(DAY FROM CURRENT_DATE - MIN(il."createdAt")) = 0 THEN 1
                                                    WHEN EXTRACT(DAY FROM CURRENT_DATE - MIN(il."createdAt")) < 7 THEN EXTRACT(DAY FROM CURRENT_DATE - MIN(il."createdAt")) * 1.0 / 7 * 7  -- Less than a week, scale up
                                                    WHEN EXTRACT(DAY FROM CURRENT_DATE - MIN(il."createdAt")) <= 14 THEN SUM(il.qty::numeric) / 2  -- 2 weeks of data, divide by 2
                                                    WHEN EXTRACT(DAY FROM CURRENT_DATE - MIN(il."createdAt")) <= 21 THEN SUM(il.qty::numeric) / 3  -- 3 weeks of data, divide by 3
                                                    ELSE SUM(il.qty::numeric) / 4  -- If data is longer, divide by 4 (for monthly approximation)
                                                END  AS "weeklySold" 
                                        FROM "InvoiceLines" il
                                        join "values" on true
                                        JOIN "Invoices" i ON i.id = il."invoiceId"
                                        JOIN base ON base."productId" = il."productId"
                                         WHERE il."companyId" = "values"."companyId"
                                        and ("values"."branches" is null or  il."branchId" = any("values"."branches"))
										and il."createdAt" >= CURRENT_DATE - INTERVAL '30 days'
                                        GROUP BY i."branchId", il."productId"
                                    ),

                                    -- Fetch usage data for the products from the base query
                                    usages AS (
                                        SELECT 
                                            m."branchId",
                                            m."productId", 
                                             SUM(m.qty::numeric) / 
                                                CASE 
                                                    WHEN EXTRACT(DAY FROM CURRENT_DATE - MIN(m."createdAt")) = 0 THEN 1
                                                    WHEN EXTRACT(DAY FROM CURRENT_DATE - MIN(m."createdAt")) < 7 THEN EXTRACT(DAY FROM CURRENT_DATE - MIN(m."createdAt")) * 1.0 / 7 * 7  -- Less than a week, scale up
                                                    WHEN EXTRACT(DAY FROM CURRENT_DATE - MIN(m."createdAt")) <= 14 THEN SUM(m.qty::numeric) / 2  -- 2 weeks of data, divide by 2
                                                    WHEN EXTRACT(DAY FROM CURRENT_DATE - MIN(m."createdAt")) <= 21 THEN SUM(m.qty::numeric) / 3  -- 3 weeks of data, divide by 3
                                                    ELSE SUM(m.qty::numeric) / 4  -- If data is longer, divide by 4 (for monthly approximation)
                                                END AS "weeklyUsage" 
                                        FROM "InventoryMovmentRecords" m
                                        	join "values" on true
                                        JOIN base ON base."productId" = m."productId"
                                         WHERE m."companyId" = "values"."companyId"
                                         and ("values"."branches" is null or  m."branchId" = any("values"."branches"))
										and m."createdAt" >= CURRENT_DATE - INTERVAL '30 days'
                                        GROUP BY m."branchId", m."productId"
                                        having  SUM(m.qty::numeric) != 0
                                    ),

                                    -- Fetch supplier data for the products from the base query
                                  suppliers AS (
                                        SELECT 
                                           distinct on ( bl."productId",b."branchId" )  bl."productId",
                                            b."branchId",
                                            s.name AS "lastSupplierName",
                                            b."billingDate" AS "lastPurchaseDate",
                                            bl.qty AS "lastQty"
                                        FROM "BillingLines" bl
                                        JOIN "Billings" b ON b.id = bl."billingId"
                                        JOIN "Suppliers" s ON s.id = b."supplierId"
                                        JOIN base ON base."productId" = bl."productId"
										ORDER BY bl."productId",b."branchId",b."billingDate" DESC, b."createdAt" desc 
								
                                        
                                    )

                                    -- Now join the product data (from base) with sales, usage, and supplier data
                                    SELECT 
                                        b.name AS "branchName",
                                        loc.name AS "locationName",
                                        base."productId" AS "productId",
                                        base.name AS "productName",
                                        base."UOM",
                                        base.barcode,
                                        parent."parentName",
                                        parent."parentBarcode",
                                        base."onHand" AS "currentStock",
                                        base."reorderLevel",
                                        base."reorderPoint",
                                        base."suggestedOrderQty",
                                        base."stockStatus",
                                        -- Join with the sales data
                                        COALESCE(sales."weeklySold", 0) AS "weeklySales",
                                        -- Join with the usage data
                                        COALESCE(usages."weeklyUsage", 0) AS "weeklyUsage",
                                        -- Join with the supplier data
                                          CASE 
                           WHEN COALESCE(usages."weeklyUsage",0) = 0 THEN NULL
                           ELSE CURRENT_DATE + (base."onHand" / usages."weeklyUsage") * INTERVAL '7 days'
                    END AS "expectedStockoutDate",
                                        suppliers."lastSupplierName",
                                        suppliers."lastPurchaseDate",
                                        suppliers."lastQty"

                                    FROM base
                                    JOIN "Branches" b ON b.id = base."branchId"
                                    LEFT JOIN inventorylocations loc ON loc.id = base."locationId"

                                    -- Join with the sales data
                                    LEFT JOIN sales ON sales."productId" = base."productId" AND sales."branchId" = base."branchId"

                                    -- Join with the usage data
                                    LEFT JOIN usages ON usages."productId" = base."productId" AND usages."branchId" = base."branchId"

                                    -- Join with the supplier data
                                    left JOIN suppliers ON suppliers."productId" = base."productId" AND suppliers."branchId" = base."branchId"

                                    -- Parent product information
                                    LEFT JOIN (
                                        SELECT id AS "productId", 
                                            name AS "parentName",
                                            barcode AS "parentBarcode"
                                        FROM "Products"
                                    ) parent ON parent."productId" = base."parentId";`




            const records = await DB.excu.query(query.text + selectQuery, query.values)

            console.log(query.text + selectQuery, query.values)

            if (records.rows && records.rows.length > 0) {
                resault = records.rows
            }



            const selectCount = await DB.excu.query(query.text + countQuery, query.values)
            count = Number((<any>selectCount.rows[0]).count) ?? count
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

                // resault.forEach((e: any) => {
                //     e.productName = e.productName + '\n' + (e.barcode ? `[${e.barcode}]` : null);
                //     if (e.parentName) {
                //         e.parentName = e.parentName + '\n'
                //         if (e.parentBarcode) e.parentName += `[${e.parentBarcode}]`
                //     }
                // })



                let stockStatusRules = [
                    {
                        type: 'cellIs',
                        operator: 'equal',
                        formulae: ['"Critical"'],
                        style: {
                            fill: {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFF0000' }, // Red
                            },
                        },
                    },
                    {
                        type: 'cellIs',
                        operator: 'equal',
                        formulae: ['"Low Stock"'],
                        style: {
                            fill: {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFFA500' }, // Orange
                            },
                        },
                    },
                ]

                let todayPlus7 = (moment().add(7, 'days'))
                let todayPlus14 = (moment().add(14, 'days'))

                let dateRules = [
                    {
                        type: 'cellIs',
                        operator: 'lessThan',
                        formulae: [`DATE(${todayPlus7.year()},${todayPlus7.month() + 1} ,${todayPlus7.date()} )`],
                        // formulae: [`today()+7`],
                        style: {
                            fill: {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFF0000' }, // Red
                            },
                        },
                    },
                    {
                        type: 'cellIs',
                        operator: 'between',
                        formulae: [`DATE(${todayPlus7.year()},${todayPlus7.month() + 1} ,${todayPlus7.date()} )`, `DATE(${todayPlus14.year()},${todayPlus14.month() + 1} ,${todayPlus14.date()} )`],
                        style: {
                            fill: {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFFFA500' }, // Orange
                            },
                        },
                    },
                ]


                report.filter = {
                    title: "Reorder Alert Report",
                    Date: new Date(),
                    branches: branches
                }


                report.records = resault
                report.columns = [
                    { key: 'branchName' },
                    { key: 'locationName' },
                    { key: 'productName' },
                    { key: 'barcode', properties: { columnType: 'barcode' } },
                    { key: 'UOM' },
                    { key: 'parentName' },
                    { key: 'parentBarcode', properties: { columnType: 'barcode' } },
                    { key: 'currentStock' },
                    { key: 'reorderLevel' },
                    { key: 'reorderPoint' },
                    { key: 'suggestedOrderQty' },
                    { key: 'stockStatus', properties: { conditionalformatRule: stockStatusRules } },
                    { key: 'weeklyUsage' },
                    { key: 'weeklySales' },
                    { key: 'expectedStockoutDate', properties: { columnType: 'date', conditionalformatRule: dateRules } },
                    { key: 'lastSupplierName' },
                    { key: 'lastPurchaseDate', properties: { columnType: 'date' } },
                    { key: 'lastQty' }




                    // { key: 'amount', properties: { hasTotal: true, columnType: 'currency' } },

                ]
                report.fileName = 'ReorderAlertReport'
                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }




}