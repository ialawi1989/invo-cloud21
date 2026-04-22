import { DB } from "@src/dbconnection/dbconnection";
import { Budget,HalfBudgetLine, MonthlyBudgetLine, QuarterlyBudgetLine, YearlyBudgetLine } from "@src/models/account/Budget";

import { BudgetLine } from "@src/models/account/BudgetLine";
import { ResponseData } from "@src/models/ResponseData";

import { PoolClient } from "pg";


import { Company } from "@src/models/admin/company";

import { ValidationException } from "@src/utilts/Exception";

export class BudgetRepo {

    public static async checkBudgetNameExist(client:PoolClient,id:string|null,name:string,companyId:string)
    {
        const query : { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "Budgets" where LOWER(name) = LOWER($1) and id <> $2 and "companyId" = $3`,
            values: [
                name,
                id,
                companyId,
            ],
        };
        if (id == null) {
            query.text = `SELECT count(*) as qty FROM "Budgets" where LOWER(name) = LOWER($1) and "companyId" = $2`;
            query.values = [name, companyId];
        }

        const resault = await client.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }

        return false;

    }
    public static async checkIfBudgetLineIdExist(client: PoolClient, budgetLineId: string, budgetId: string) {
        try {

            const query : { text: string, values: any } = {
                text: `SELECT count(*),"budgetId" from "BudgetLines" where id=$1 group by "budgetId"`,
                values: [budgetLineId]
            }
            const count = await client.query(query.text, query.values)

            if (count.rows.length > 0 &&  count.rows && count.rows[0].count > 0) {
                return true
            } else {
                return false
            }
        } catch (error: any) {
          


            throw new Error(error.message)
        }
    }

    public static async checkIfBudgetIdExist(client: PoolClient, budgetId: string) {
        try {

            const query : { text: string, values: any } = {
                text: `SELECT count(*) from "Budgets" where id=$1 `,
                values: [budgetId]
            }
            const count = await client.query(query.text, query.values)
    

            if (count.rows.length > 0 &&  count.rows && count.rows[0].count > 0) {
                return true
            } else {
                return false
            }
        } catch (error: any) {
          


            throw new Error(error.message)
        }
    }


    public static async addBudget(client: PoolClient, data: any, company: Company) {
        try {

       

            const afterDecimal = company.afterDecimal
            const budget = new Budget();
            budget.ParseJson(data)

            if (budget.id) {
                const isBudgetExist = await this.checkIfBudgetIdExist(client, budget.id);
                if (isBudgetExist) {

                    throw new ValidationException("Budget Already Exits")
                }
            }


            const isBudgetNameExist = await this.checkBudgetNameExist(client,null,budget.name,company.id)
            if(isBudgetNameExist)
            {
                throw new ValidationException("Budget Name Already Used")
            }
            const query : { text: string, values: any } = {
                text: `INSERT INTO 
                  "Budgets" (
                 "name","companyId","branchId",periodicity,year, "createdAt", "updatedDate") VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id `,
                values: [budget.name, company.id, budget.branchId, budget.periodicity, budget.year, budget.createdAt, budget.updatedDate]
            }

            const budgetInsert = await client.query(query.text, query.values);
            const budgetId = (<any>budgetInsert.rows[0]).id;
            budget.id = budgetId


            for (let index = 0; index < budget.lines.length; index++) {
                const budgetLine = budget.lines[index];
                budgetLine.budgetId = budget.id;

                const insertBudgetLine: any = await this.addBudgetLine(client, budgetLine)
                budgetLine.id = insertBudgetLine.data.id
            }

            //return budgetId;
            return new ResponseData(true, "Added Successfully", { id: budgetId, budget: budget });
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async editBudget(client: PoolClient, data: any, company: Company) {
    try {


        //TODO: INVOICE VALIDATION 
        //TODO: CHECK NUMBER EXIST 

        const afterDecimal = company.afterDecimal
        const budget = new Budget();
        budget.ParseJson(data);
        
        if (budget.id == "" || budget.id == null) {
            throw new ValidationException("Budget Id is Required")
        }

        if(budget.id){
            const isBudgetExist = await this.checkIfBudgetIdExist(client, budget.id)
            if(!isBudgetExist){
                throw new ValidationException("Budget Id not Exist")
            }
        }
        const isBudgetNameExist = await this.checkBudgetNameExist(client,budget.id,budget.name,company.id)
        if(isBudgetNameExist)
        {
            throw new ValidationException("Budget Name Already Used")
        }
        budget.updatedDate = new Date()
      
        const query : { text: string, values: any } = {
            text: `UPDATE  "Budgets" SET  name = $1 ,  "updatedDate" = $2
                                       WHERE  id=$3 AND "companyId"=$4`,
            values: [budget.name, budget.updatedDate, budget.id, company.id]
        }

        const budgetUpdate = await client.query(query.text, query.values);
        
        for (let index = 0; index < budget.lines.length; index++) {
            const budgetLine = budget.lines[index];
            budgetLine.budgetId = budget.id;
            if (budgetLine.id != null && budgetLine.id != "") {

                const isLineExist = await this.checkIfBudgetLineIdExist(client, budgetLine.id, budget.id)
                if (isLineExist) {

                    await this.editBudgetLine(client, budgetLine)

                } else { /** Ecommerce when dine in edit on order (continue ordering) */
                    let line = await this.addBudgetLine(client, budgetLine)
                    budgetLine.id = line.data.id;
                }
            } else {
            
                let line = await this.addBudgetLine(client, budgetLine)
                budgetLine.id = line.data.id;
            }


        }

      

        return new ResponseData(true, "Updated Successfully", { Budget: budget })

    } catch (error: any) {
        console.trace(error.message);
        // const event = {
        //     message: error.message,
        //     extra: { key: 'Invoices' },

        //     data: {data}
        //   };
      

        throw new Error(error.message)
    }
    }
    public static async deleteBudget(budgetId: string) {
        const client = await DB.excu.client();
        try {
           await client.query("BEGIN")
           const query : { text: string, values: any } = {
              text: `DELETE FROM "BudgetLines" where "budgetId" =$1 `,
              values: [budgetId]
           }
  
           await client.query(query.text, query.values);
  
           query.text = `DELETE FROM "Budgets" where id=$1`
           await client.query(query.text, query.values);
  
           await client.query("COMMIT")
  
           return new ResponseData(true, "Deleted Successfully", [])
        } catch (error: any) {
           await client.query("ROLLBACK")
         
  
           throw new Error(error)
        } finally {
           client.release()
        }
    }

    public static async addBudgetLine(client: PoolClient, budgetLine: YearlyBudgetLine|MonthlyBudgetLine|QuarterlyBudgetLine|HalfBudgetLine|BudgetLine) {
        try {

            const query : { text: string, values: any } = {
                text: `INSERT INTO "BudgetLines" ("accountId","budgetId",prediction, period, "periodFilter", "createdAt") VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
                values: [budgetLine.accountId, budgetLine.budgetId, budgetLine.prediction, budgetLine.period, budgetLine.periodFilter, budgetLine.createdAt]
            }

            const insert = await client.query(query.text, query.values);

            const budgetLineId = (<any>insert.rows[0]).id;

            return new ResponseData(true, "Added Successfully", {id:budgetLineId})
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async editBudgetLine(client: PoolClient, budgetLine: BudgetLine) {
        try {
        const query : { text: string, values: any } = {
            text: `UPDATE "BudgetLines" SET "accountId"=$1, prediction=$2, period= $3, "periodFilter" = $4 WHERE id=$5 AND "budgetId"=$6`,
            values: [budgetLine.accountId,
                     budgetLine.prediction,
                     budgetLine.period,
                     budgetLine.periodFilter,
                     budgetLine.id,
                     budgetLine.budgetId
                    ]
        }

        await client.query(query.text, query.values);
        return new ResponseData(true, "Updated Successfully", [])

        } catch (error: any) {
      
        throw new Error(error.message)
        }
    }
    public static async deleteBudgetLine(client: PoolClient,  budgetLine: BudgetLine) {
        try {
            const query : { text: string, values: any } = {
                text: `Delete From "BudgetLines" where id = $1`,
                values: [budgetLine.id]
            }

            await client.query(query.text, query.values);

        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getBudgetById(id: string, company: Company) {
        const client = await DB.excu.client();
     
        try {
           await client.query("BEGIN")
           let query : { text: string, values: any } = {
              text: `select *
                            from "Budgets"
                            where "Budgets"."companyId" = $1 and "Budgets".id = $2          
                 `,
              values: [company.id, id]
           }
  
           const budgetData = await client.query(query.text, query.values);
           if (!(budgetData.rows.length > 0)){
            throw new Error("NO Budget")
           }

           let budget = new Budget()
           budget.ParseJson(budgetData.rows[0])

           query = {
              text: `select *
                            from "BudgetLines"
                            where "budgetId" = $1          
                 `,
              values: [ id]
           }
  
           const BudgetLines = await client.query(query.text, query.values);
           
           for(const budgetLineData of BudgetLines.rows){
             let budgetLine = new BudgetLine()
             budgetLine.ParseJson(budgetLineData)
             budget.lines.push(budgetLine)
           }


  
           // journal.rows.forEach(element => {
           //    console.log(element)
           //    journal.rows.splice(journal.rows.indexOf(journal.rows.find(f=> f.debit ==0 && f.credit == 0)), 1)
           // });
           await client.query("COMMIT")
  
           return new ResponseData(true, "", budget)
        } catch (error: any) {
           await client.query("ROLLBACK")
         
           throw new Error(error.message)
        } finally {
           client.release()
        }
     }

    public static async getBudgetById2(id: string, company: Company) {
        const client = await DB.excu.client();
     
        try {
           await client.query("BEGIN")
           let query : { text: string, values: any } = {
              text: `select *
                            from "Budgets"
                            where "Budgets"."companyId" = $1 and "Budgets".id = $2          
                 `,
              values: [company.id, id]
           }
  
           const budgetData = await client.query(query.text, query.values);
           if (!(budgetData.rows.length > 0)){
            throw new Error("NO Budget")
           }

           let budget = new Budget()
           budget.ParseJson(budgetData.rows[0])

           query  = {
              text: `select *
                            from "BudgetLines"
                            where "budgetId" = $1          
                 `,
              values: [ id]
           }
  
           const BudgetLines = await client.query(query.text, query.values);
           
           for(const budgetLineData of BudgetLines.rows){
             let budgetLine = new BudgetLine()
             budgetLine.ParseJson(budgetLineData)
             budget.lines.push(budgetLine)
           }

            //#################################
           query  = {
            text: `with t1 as (select "Accounts".id as "accountId",
            "Accounts".name as "account",
            "Accounts".type ,
            "Accounts"."parentType",
            "Budgets".id as "budgetId",
            "Budgets".periodicity,
            "Budgets"."companyId",
            "Budgets"."branchId",
            "Budgets".year
            from "Accounts"
            join "Budgets" on "Budgets".id = $1
            where "Accounts"."companyId" = $2
            and "parentType" ilike any(Array['Expense','Operating Expense', 'Operating Income', 'Costs Of Goods Sold','Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity'])
            ),
            t2 as(
            select t1.*,
            CASE 
                        WHEN t1.periodicity = 'monthly' THEN
                            replace(to_char("JournalRecords"."createdAt", 'MonthYYYY'),' ', '') 
                        WHEN t1.periodicity = 'quarterly' THEN
                            'q'||to_char("JournalRecords"."createdAt",'q YYYY') 
                        WHEN t1.periodicity = 'half' THEN
                            (case when extract(month from "JournalRecords"."createdAt")> 6 then '2H ' else '1H ' end )||extract( year from "JournalRecords"."createdAt") 
                        WHEN t1.periodicity = 'yearly' THEN
                        EXTRACT(YEAR FROM "JournalRecords"."createdAt")::text      
            END as "periodFilter",
            sum(COALESCE("JournalRecords".amount,0)::NUMERIC) as "actualAmount"
            from t1
            left join "JournalRecords" on t1."accountId" = "JournalRecords"."accountId" and  t1."companyId" =  "JournalRecords"."companyId"
                and (((t1."branchId"::uuid) IS NULL) or (t1."branchId"= "JournalRecords"."branchId")) 
                and  year = extract( year from "JournalRecords"."createdAt") 
            group by t1."accountId", t1.account, t1.type ,
                    t1."budgetId",	 t1."parentType",
                    t1."branchId",  t1.periodicity,
                    t1."companyId", t1.year, 
                    "periodFilter"
            )
            select t2."accountId", t2."budgetId", t2."actualAmount", trim(t2."periodFilter", t2.year::text) as "periodFilter"  
            from t2   where t2."actualAmount" != 0 
               `,
            values: [ id, company.id]
         }

         const Actual_amounts = await client.query(query.text, query.values);
         
         
         for(const ActualAmountData of Actual_amounts.rows){
           let budgetLine = new BudgetLine()
           budgetLine.ParseJson(ActualAmountData)
           let a = budget.lines.find((elem) => elem.accountId == budgetLine.accountId && elem.periodFilter == budgetLine.periodFilter)
        
           if (a){ a.actualAmount = budgetLine.actualAmount}
           else {budget.lines.push(budgetLine)}
           
         }
         console.log( budget.lines.length)


  
           // journal.rows.forEach(element => {
           //    console.log(element)
           //    journal.rows.splice(journal.rows.indexOf(journal.rows.find(f=> f.debit ==0 && f.credit == 0)), 1)
           // });
           await client.query("COMMIT")
  
           return new ResponseData(true, "", budget)
        } catch (error: any) {
           await client.query("ROLLBACK")
         
           throw new Error(error.message)
        } finally {
           client.release()
        }
     }

     public static async getAccountList( company: Company) {
        const client = await DB.excu.client();
     
        try {
           await client.query("BEGIN")
           
           let query : { text: string, values: any } = {
              text: `select case when "parentType" ilike any(Array['Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity'])  then 'Balance Sheet'
                                when "parentType" ilike any(Array['Expense','Operating Expense', 'Operating Income', 'Costs Of Goods Sold']) then 'Profit and Loss Sheet'
                            end as "sheetType",
                            "parentType",
                            type,
                            "Accounts".name,
                            "Accounts".id as "accountId"
                            from "Accounts"
                            where "Accounts"."companyId" = $1 
                            AND name not in ('Opening Balance','Customer Opening Balance', 'Supplier Opening Balance','Opening Balance Adjusment')
                            AND "Accounts"."parentType" ilike any(Array['Expense','Operating Expense', 'Operating Income', 'Costs Of Goods Sold','Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity'])
                    
                 `,
              values: [company.id ]
           }

          
           const accounts = await client.query(query.text, query.values);
    
           if (!(accounts.rows.length > 0)){
            throw new Error("NO Account")
           }
  
           // journal.rows.forEach(element => {
           //    console.log(element)
           //    journal.rows.splice(journal.rows.indexOf(journal.rows.find(f=> f.debit ==0 && f.credit == 0)), 1)
           // });
           await client.query("COMMIT")
  
           return new ResponseData(true, "", accounts.rows)
        } catch (error: any) {
           await client.query("ROLLBACK")
         
           throw new Error(error.message)
        } finally {
           client.release()
        }
     }

     public static async getBudgetList(data: any, company: Company) {
        try {
  
           const companyId = company.id
  
           let  searchValue     = data.searchTerm ? (data.searchTerm).trim()  ? `^.*` + (data.searchTerm).trim() + `.*$`     : null :null;
           let  branchId  = data.branchId   ? (data.branchId).trim()   ? (data.branchId).trim()   : null : null;
           let selectQuery;
           let selectValues;
  
           let countQuery;
           let countValues;
           let selectCount;
           let pageCount = 0;
  
          
           let offset = 0;
           let sort: any;
           let sortValue;
           let sortDirection;
           let sortTerm;
           let count = 0;
           const limit = ((data.limit == null) ? 15 : data.limit);
           if (data.page != 1) {
              offset = (limit * (data.page - 1))
           }
           const selectText = `select "Budgets".*, "Branches"."name" as "branchName"
                              FROM "Budgets"
                              LEFT JOIN "Branches" ON "Branches".id = "Budgets"."branchId"
                              where "Budgets"."companyId" = $1
                              and ((($2::text) IS NULL) or ("Budgets"."branchId"::text = $2::text)) 
                              and ((($3::text) IS NULL) or ("Budgets"."name" ~* $3) or ("Budgets"."periodicity" ~* $3) or ("Branches"."name" ~* $3) or ("Budgets".year::text ~* $3) )
                               `
  
           const countText = `SELECT
                              count(*)
                              FROM "Budgets"
                              LEFT JOIN "Branches" ON "Branches".id = "Budgets"."branchId"
                              where "Budgets"."companyId" = $1
                              and ((($2::text) IS NULL) or ("Budgets"."branchId"::text = $2::text)) 
                              and ((($3::text) IS NULL) or ("Budgets"."name" ~* $3) or ("Budgets"."periodicity" ~* $3) or ("Branches"."name" ~* $3))
                              `
  
          
           let orderByQuery = `Order by` + sortTerm
  
  
           const limitQuery = ` limit $4 offset $5`
           selectQuery = selectText 
           selectValues = [companyId,branchId, searchValue]
  
           if (data != null && data != '' && JSON.stringify(data) != '{}') {
  
  
              sort = data.sortBy;
              sortValue = !sort ? '"Budgets"."createdAt"' : '"' + sort.sortValue + '"';
              sortDirection = !sort ? " DESC " : sort.sortDirection;
  
              sortTerm = sortValue + " " + sortDirection;
              orderByQuery = " ORDER BY " + sortTerm
            
              selectQuery = selectText +  orderByQuery + limitQuery
              selectValues = [companyId, branchId, searchValue, limit, offset]
              countQuery = countText 
              countValues = [companyId, branchId, searchValue]
              selectCount = await DB.excu.query(countQuery, countValues)
              count = Number((<any>selectCount.rows[0]).count)
              pageCount = Math.ceil(count / data.limit)
           }
  
           const selectList = await DB.excu.query(selectQuery, selectValues)
  
  
  
           offset += 1;
           let lastIndex = ((data.page) * data.limit)
           if (selectList.rows.length < data.limit || data.page == pageCount) {
              lastIndex = count
           }
  
  
           const resData = {
              list: selectList.rows,
              count: count,
              pageCount: pageCount,
              startIndex: offset,
              lastIndex: lastIndex
           }
  
           return new ResponseData(true, "", resData);
  
  
        } catch (error: any) {
         
           throw new Error(error.message)
        }
     }

     public static async ActualvsPrediction(budgetId: string , company: Company) {
        const client = await DB.excu.client();
    
        try {
            const companyId  = company.id;
           //const  branchId  = data.branchId   ? (data.branchId).trim()   ? (data.branchId).trim()   : null : null;
           // const  budgetId  = data.budgetId   ? (data.budgetId).trim()   ? (data.budgetId).trim()   : null : null;
           //const parentType = ['Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity']


            await client.query("BEGIN")
            // const query = {
                // text: `with "journal" as (
                //     select "Accounts".id as "accountId",
                //     "Accounts".name as "account",
                //     "Accounts".type ,
                //     "Accounts"."parentType",
                //     "Budgets".id as "budgetId",
                //     "Budgets".periodicity,
                //     "Budgets"."companyId",
                //     "Budgets"."branchId",
                //     "Budgets".year
                //     from "Accounts"
                //     join "Budgets" on "Budgets".id = $1
                //     where "Accounts"."companyId" = $2
                //     and "parentType" ilike any(Array['Expense','Operating Expense', 'Operating Income', 'Costs Of Goods Sold','Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity'])
                
                // ),
                // "actualData" as(
                // select "journal".*,
                // CASE 
                //             WHEN "journal".periodicity = 'monthly' THEN
                //                 replace(to_char("JournalRecords"."createdAt", 'MonthYYYY'),' ', '') 
                //             WHEN "journal".periodicity = 'quarterly' THEN
                //                 'q'||to_char("JournalRecords"."createdAt",'q YYYY') 
                //             WHEN "journal".periodicity = 'half' THEN
                //                 (case when extract(month from "JournalRecords"."createdAt")> 6 then '2H ' else '1H ' end )||extract( year from "JournalRecords"."createdAt") 
                //             WHEN "journal".periodicity = 'yearly' THEN
                //             EXTRACT(YEAR FROM "JournalRecords"."createdAt")::text      
                // END as "periodFilter",

                // case when "journal"."parentType" = ANY(ARRAY['Operating Expense', 'Operating Income', 'Costs Of Goods Sold']) THEN 
                // sum(COALESCE("JournalRecords".amount,0)::TEXT::NUMERIC) *(-1) ELSE 
                //     CASE WHEN getaccountnature("journal"."parentType") ilike 'Dr' THEN abs(sum( "JournalRecords".amount::TEXT::NUMERIC ))
                //     WHEN getaccountnature("journal"."parentType") ilike 'Cr'  THEN sum( "JournalRecords".amount::TEXT::NUMERIC )*(-1)  end 
                //     END as "actualAmount"

                // from "journal"
                // inner join "JournalRecords" on "journal"."accountId" = "JournalRecords"."accountId" and  "journal"."companyId" =  "JournalRecords"."companyId"
                //     and ((("journal"."branchId"::uuid) IS NULL) or ("journal"."branchId"= "JournalRecords"."branchId")) 
                //     and  year = extract( year from "JournalRecords"."createdAt") 
                // group by "journal"."accountId", "journal".account, "journal".type ,
                //         "journal"."budgetId",	 "journal"."parentType",
                //         "journal"."branchId",  "journal".periodicity,
                //         "journal"."companyId", "journal".year, 
                //         "periodFilter"
                
                
                // )
                // ,
                // "predData" as (
                //     select "journal".*,
                // "BudgetLines"."periodFilter",
                //     "BudgetLines".prediction
                // from "journal"
                // inner join "BudgetLines" on "journal"."accountId" = "BudgetLines"."accountId" and "journal"."budgetId" = "BudgetLines"."budgetId"	
                // ),
                
                // "join" as(   select COALESCE("actualData"."accountId", "predData"."accountId") as "accountId",
                // COALESCE("actualData".account, "predData".account) as "account" ,
                // COALESCE("actualData".type, "predData".type) as "type" ,
                // COALESCE("actualData"."parentType", "predData"."parentType") as "parentType" ,
                // COALESCE("actualData".periodicity, "predData".periodicity) as "periodicity" ,
                // COALESCE("actualData"."budgetId", "predData"."budgetId") as "budgetId" ,
                // COALESCE("actualData"."branchId", "predData"."branchId") as "branchId" ,
                // COALESCE("actualData"."companyId", "predData"."companyId") as "companyId" ,
                // COALESCE("actualData".year, "predData".year) as "year" ,
                // COALESCE(case when "actualData".periodicity != 'yearly' then trim("actualData"."periodFilter","actualData".year::text) else "actualData"."periodFilter" end , "predData"."periodFilter") as "periodFilter" ,
                //         "predData".prediction as "predictionAmount",
                //         "actualData"."actualAmount"
                // from "actualData" 
                // full outer join "predData" ON "predData"."budgetId" = "actualData"."budgetId" and "actualData"."accountId" = "predData"."accountId" and case when "actualData".periodicity != 'yearly' then trim("actualData"."periodFilter","actualData".year::text) else "actualData"."periodFilter" end = "predData"."periodFilter"
                // order by  "accountId"
                //         ),
                //     "calculation" as(
                //         select 
                            
                //             "join"."branchId",
                //             "join"."companyId",
                //             year,
                //         "periodFilter",
                //         "periodicity",
                //         "budgetId",
                //         0 AS "actualOperatingProfit",
                //         0 AS "predOperatingProfit",
                //             SUM(CASE WHEN "join"."parentType" ='Operating Income' THEN  COALESCE("join"."actualAmount",0) ELSE 0 END ) +  SUM(CASE WHEN "join"."parentType" ='Costs Of Goods Sold' THEN COALESCE("join"."actualAmount",0) ELSE 0 END) AS "actualGrossProfit",
                //                 (SUM(CASE WHEN "join"."parentType" ='Operating Income' THEN COALESCE("join"."actualAmount",0) ELSE 0 END ) +  SUM(CASE WHEN "join"."parentType" ='Costs Of Goods Sold' THEN COALESCE("join"."actualAmount",0) ELSE 0 END)) + SUM(CASE WHEN "join"."parentType" ='Operating Expense' THEN COALESCE("join"."actualAmount",0) ELSE 0 END) AS "actualNetProfit",
                //                 SUM(CASE WHEN "join"."parentType" ='Operating Income' THEN COALESCE("join"."predictionAmount") ELSE 0 END ) +  SUM(CASE WHEN "join"."parentType" ='Costs Of Goods Sold' THEN  COALESCE("join"."predictionAmount") ELSE 0 END) AS "predGrossProfit",
                //                 (SUM(CASE WHEN "join"."parentType" ='Operating Income' THEN  COALESCE("join"."predictionAmount") ELSE 0 END ) +  SUM(CASE WHEN "join"."parentType" ='Costs Of Goods Sold' THEN  COALESCE("join"."predictionAmount") ELSE 0 END)) + SUM(CASE WHEN "join"."parentType" ='Operating Expense' THEN  COALESCE("join"."predictionAmount") ELSE 0 END) AS "predNetProfit"
                        
                //         from  "join"
                //             GROUP BY
                //             "join"."branchId",
                //             "join"."companyId",
                //             year,
                //         "periodFilter",
                //         "periodicity",
                //         "budgetId"
                // ) select 
                // *  from "join"
                // union 
                // select null::uuid as "accountId",
                //         'net Profit' as "account",
                //         'net Profit' as "type",
                //         'net Profit' as "parentType",
                //         "periodicity",
                //         "budgetId",
                //         "branchId",
                //         "companyId",
                //         "year",
                //         "periodFilter",
                //         "predNetProfit" as "predictionAmount",
                //         "actualNetProfit" as "actualAmount"
                // from "calculation"
                //     union 
                // select null::uuid as "accountId",
                //         'Gross Profit' as "account",
                //         'Gross Profit' as "type",
                //         'Gross Profit' as "parentType",
                //         "periodicity",
                //         "budgetId",
                //         "branchId",
                //         "companyId",
                //         "year",
                //         "periodFilter",
                //         "predGrossProfit" as "predictionAmount",
                //         "actualGrossProfit" as "actualAmount"
                // from "calculation"
                // union 
                // select null::uuid as "accountId",
                //         'Operating Profit' as "account",
                //         'Operating Profit' as "type",
                //         'Operating Profit' as "parentType",
                //         "periodicity",
                //         "budgetId",
                //         "branchId",
                //         "companyId",
                //         "year",
                //         "periodFilter",
                //         "predOperatingProfit" as "predictionAmount",
                //         "actualOperatingProfit" as "actualAmount"
                // from "calculation"
                // order by "accountId" 
            //         `,
            //     values: [budgetId, companyId]
            // }

            const query = {
                // text: `with "journal" as (
                //     select "Accounts".id as "accountId",
                //     "Accounts".name as "account",
                //     "Accounts".type ,
                //     "Accounts"."parentType",
                //     "Budgets".id as "budgetId",
                //     "Budgets".periodicity,
                //     "Budgets"."companyId",
                //     "Budgets"."branchId",
                //     "Budgets".year
                //     from "Accounts"
                //     join "Budgets" on "Budgets".id = $1
                //     where "Accounts"."companyId" = $2
                //     and "parentType" ilike any(Array['Expense','Operating Expense', 'Operating Income', 'Costs Of Goods Sold','Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity'])
                
                // ),
                // "actualData" as(
                // select "journal".*,
                // CASE 
                //             WHEN "journal".periodicity = 'monthly' THEN
                //                 replace(to_char("JournalRecords"."createdAt", 'MonthYYYY'),' ', '') 
                //             WHEN "journal".periodicity = 'quarterly' THEN
                //                 'q'||to_char("JournalRecords"."createdAt",'q YYYY') 
                //             WHEN "journal".periodicity = 'half' THEN
                //                 (case when extract(month from "JournalRecords"."createdAt")> 6 then '2H' else '1H' end )||extract( year from "JournalRecords"."createdAt") 
                //             WHEN "journal".periodicity = 'yearly' THEN
                //             EXTRACT(YEAR FROM "JournalRecords"."createdAt")::text      
                // END as "periodFilter",

                // case when "journal"."parentType" = ANY(ARRAY['Operating Expense', 'Operating Income', 'Costs Of Goods Sold']) THEN 
                // case when "journal"."parentType" ='Operating Expense'  or "journal"."parentType" ='Costs Of Goods Sold'  then abs(sum("JournalRecords".amount::numeric)) 
                // else
                // sum(COALESCE("JournalRecords".amount,0)::TEXT::NUMERIC) *(-1) end ELSE 
                //     CASE WHEN getaccountnature("journal"."parentType") ilike 'Dr' THEN abs(sum( "JournalRecords".amount::TEXT::NUMERIC ))
                //     WHEN getaccountnature("journal"."parentType") ilike 'Cr'  THEN sum( "JournalRecords".amount::TEXT::NUMERIC )*(-1)  end 
                //     END as "actualAmount"

                // from "journal"
                // inner join "JournalRecords" on "journal"."accountId" = "JournalRecords"."accountId" and  "journal"."companyId" =  "JournalRecords"."companyId"
                //     and ((("journal"."branchId"::uuid) IS NULL) or ("journal"."branchId"= "JournalRecords"."branchId" or ("JournalRecords"."branchId" is null and "JournalRecords"."companyId" = "journal"."companyId"))) 
                //     and  year = extract( year from "JournalRecords"."createdAt") 
                // group by "journal"."accountId", "journal".account, "journal".type ,
                //         "journal"."budgetId",	 "journal"."parentType",
                //         "journal"."branchId",  "journal".periodicity,
                //         "journal"."companyId", "journal".year, 
                //         "periodFilter"
                
                
                // )
                // ,
                // "predData" as (
                //     select "journal".*,
                // "BudgetLines"."periodFilter",
                //     "BudgetLines".prediction
                // from "journal"
                // inner join "BudgetLines" on "journal"."accountId" = "BudgetLines"."accountId" and "journal"."budgetId" = "BudgetLines"."budgetId"	
                // )
                
                // select COALESCE("actualData"."accountId", "predData"."accountId") as "accountId",
                // COALESCE("actualData".account, "predData".account) as "account" ,
                // COALESCE("actualData".type, "predData".type) as "type" ,
                // COALESCE("actualData"."parentType", "predData"."parentType") as "parentType" ,
                // COALESCE("actualData".periodicity, "predData".periodicity) as "periodicity" ,
                // COALESCE("actualData"."budgetId", "predData"."budgetId") as "budgetId" ,
                // COALESCE("actualData"."branchId", "predData"."branchId") as "branchId" ,
                // COALESCE("actualData"."companyId", "predData"."companyId") as "companyId" ,
                // COALESCE("actualData".year, "predData".year) as "year" ,
                // trim(COALESCE(case when "actualData".periodicity != 'yearly' then trim("actualData"."periodFilter","actualData".year::text) else "actualData"."periodFilter" end , "predData"."periodFilter"),' ') as "periodFilter" , 
                //         "predData".prediction as "predictionAmount",
                //         "actualData"."actualAmount"
                // from "actualData" 
                // full outer join "predData" ON "predData"."budgetId" = "actualData"."budgetId" and "actualData"."accountId" = "predData"."accountId" and case when "actualData".periodicity != 'yearly' then replace(trim("actualData"."periodFilter","actualData".year::text),' ','') else "actualData"."periodFilter" end = "predData"."periodFilter"
                // order by  "accountId"
                //     `,
                text : ` with "journal" as (
                    select "Accounts".id as "accountId",
                    "Accounts".name as "account",
                    "Accounts".type ,
                    "Accounts"."parentType",
                    "Budgets".id as "budgetId",
                    "Budgets".periodicity,
                    "Budgets"."companyId",
                    "Budgets"."branchId",
                    "Budgets".year
                    from "Accounts"
                    join "Budgets" on "Budgets".id = $1
                    where "Accounts"."companyId" = $2
                    and "parentType" ilike any(Array['Expense','Operating Expense', 'Operating Income', 'Costs Of Goods Sold','Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity'])
                
                ),
                "actualData" as(
                    select "journal".*,
                    CASE WHEN "journal".periodicity = 'monthly' THEN
                            replace(to_char("JournalRecords"."createdAt", 'Month'),' ', '') 
                         WHEN "journal".periodicity = 'quarterly' THEN 
                           trim('q'||to_char("JournalRecords"."createdAt",'q '))
                         WHEN "journal".periodicity = 'half' THEN
                            (case when extract(month from "JournalRecords"."createdAt")> 6 then '2H' else '1H' end ) 
                         WHEN "journal".periodicity = 'yearly' THEN
                            EXTRACT(YEAR FROM "JournalRecords"."createdAt")::text      
                    END as "periodFilter",
                
                    case when "journal"."parentType" = ANY(ARRAY['Operating Expense', 'Operating Income', 'Costs Of Goods Sold']) 
                         THEN 
                          case when "journal"."parentType" ='Operating Expense'  or "journal"."parentType" ='Costs Of Goods Sold'  then abs(sum(COALESCE("JournalRecords".amount,0)::text::numeric)) 
                              else sum(COALESCE("JournalRecords".amount,0)::TEXT::NUMERIC) *(-1) 
                          end 
                        ELSE 
                          case when getaccountnature("parentType") = 'Cr' or "parentType" ='Equity' then abs(sum(COALESCE("JournalRecords".amount,0)::TEXT::NUMERIC )) else sum(COALESCE("JournalRecords".amount,0)::TEXT::NUMERIC )  
                          end 
                        END as "actualAmount",
                        0 AS prediction
                
                    from "journal"
                    inner join "JournalRecords" on "journal"."accountId" = "JournalRecords"."accountId" 
                        where "journal"."companyId" =  "JournalRecords"."companyId"
                          and (("journal"."branchId"::uuid IS NULL or ("journal"."branchId" = "JournalRecords"."branchId")) 
                               or ("JournalRecords"."branchId" is null and "JournalRecords"."companyId" = "journal"."companyId") ) 
                          and  "journal".year = extract( year from "JournalRecords"."createdAt") 
                    group by "journal"."accountId", "journal".account, "journal".type ,
                            "journal"."budgetId",	 "journal"."parentType",
                            "journal"."branchId",  "journal".periodicity,
                            "journal"."companyId", "journal".year, 
                            "periodFilter"
                )
                ,"predData" as (
                    select "journal".*,
                            "BudgetLines"."periodFilter",
                            0 As "actualAmount",
                            "BudgetLines".prediction ::text::numeric
                    from "journal"
                    inner join "BudgetLines" on "journal"."accountId" = "BudgetLines"."accountId" and "journal"."budgetId" = "BudgetLines"."budgetId"	
                )
                                
                select "accountId", "account","type", "parentType", "periodicity", "budgetId", "companyId", "year" , "periodFilter", 
                        sum("actualAmount") as "actualAmount", sum("prediction") as "prediction"
                from ( select * from "actualData"	union all	select * from "predData") T
                group BY "accountId", "account","type", "parentType", "periodicity", "budgetId", "companyId", "year", "periodFilter"
                
                `,
                values: [budgetId, companyId]
            }
    
            const Budget = await client.query(query.text, query.values);
    
           // journal.rows.forEach(element => {
           //    console.log(element)
           //    journal.rows.splice(journal.rows.indexOf(journal.rows.find(f=> f.debit ==0 && f.credit == 0)), 1)
           // });
           await client.query("COMMIT")
           console.log(Budget.rows.length)
  
           return new ResponseData(true, "", Budget.rows)
        } catch (error: any) {
           await client.query("ROLLBACK")
         
           throw new Error(error.message)
        } finally {
           client.release()
        }
     }


    public static async getBudgetById22(id: string, company: Company) {
        const client = await DB.excu.client();
     
        try {
           await client.query("BEGIN")
           const query : { text: string, values: any } = {
              text: `select "BudgetLines"."accountId" as "accountId",
                            "Accounts".name as "account",
                            "Accounts".type ,
                            "Accounts"."parentType",
                            "BudgetLines".period,
                            "BudgetLines".prediction as "predictionAmount"
                            
                            from "Budgets"
                            inner join "BudgetLines" ON "Budgets".id = "BudgetLines"."budgetId"
                            Left join "Accounts" ON "BudgetLines"."accountId" = "Accounts".id
                            where "Budgets"."companyId" = $1 and "Budgets".id = $2          
                 `,
              values: [company.id, id]
           }
  
           const Budget = await client.query(query.text, query.values);
  
           // journal.rows.forEach(element => {
           //    console.log(element)
           //    journal.rows.splice(journal.rows.indexOf(journal.rows.find(f=> f.debit ==0 && f.credit == 0)), 1)
           // });
           await client.query("COMMIT")
  
           return new ResponseData(true, "", Budget.rows)
        } catch (error: any) {
           await client.query("ROLLBACK")
         
           throw new Error(error.message)
        } finally {
           client.release()
        }
     }

    //  public static async ActualvsPrediction(data: any , company: Company) {
    //     const client = await DB.excu.client();
    
    //     try {
    //         const companyId  = company.id;
    //         const  branchId  = data.branchId   ? (data.branchId).trim()   ? (data.branchId).trim()   : null : null;
    //         const  budgetId  = data.budgetId   ? (data.budgetId).trim()   ? (data.budgetId).trim()   : null : null;
    //         const parentType = ['Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity']


    //         await client.query("BEGIN")
    //         const query : { text: string, values: any } = {
                // text: `with t1 as (
                //     select "BudgetLines"."budgetId",
                //             "Accounts".id as "accountId",
                //             "Accounts".name as "account",
                //             "Accounts".type ,
                //             "Budgets"."companyId",
                //             "Budgets"."branchId",
                //             "Accounts"."parentType",
                //             "Budgets".periodicity,
                //             "BudgetLines".period,
                //             COALESCE("BudgetLines".prediction,0) as "predictionAmount"
                //             from "Accounts"
                //             left  join "BudgetLines" ON "Accounts".id = "BudgetLines"."accountId"
                //             Left  join "Budgets" ON "BudgetLines"."budgetId" = "Budgets".id
                //             where "Accounts"."companyId" = $4
                //                     and ((($3::text) IS NULL) or ("Budgets"."branchId"::text = $3::text )) 
                //                     and "Budgets".id::text = $1::text
                //                     and "Accounts"."parentType" = any($2)
                //             group by  "Budgets"."companyId", "Budgets"."branchId", 
                //             "BudgetLines"."budgetId", "Accounts".id,
                //             periodicity, "BudgetLines".period, 
                //             COALESCE("BudgetLines".prediction,0)
                //             order by "Accounts".id
                //     ) , 
                //     t2 as (
                //         select  t1."accountId", t1."parentType", t1.type, t1.account,  t1.periodicity, t1.period, t1."branchId",
                //         case  lower("periodicity") 
                //             when 'yearly'    then date_trunc( 'year', "JournalRecords"."createdAt")
                //             when 'half'      then case when extract( month from  "JournalRecords"."createdAt") > 6 
                //                                     then (extract( year from "JournalRecords"."createdAt")::text || '-07' ||'-01')::timestamp  
                //                                     else (extract( year from "JournalRecords"."createdAt")::text || '-01' ||'-01')::timestamp  end
                //             when 'quarterly' then date_trunc( 'quarter'  ,"JournalRecords"."createdAt")
                //             when 'monthly'   then date_trunc( 'month'  ,"JournalRecords"."createdAt")
                            
                //         end s,
                //         t1."predictionAmount",
                //         SUM(COALESCE("JournalRecords".amount,0)::NUMERIC)as "actualAmount"
                //         from t1  
                //         left  join "JournalRecords" ON "t1"."accountId" = "JournalRecords"."accountId" and t1."companyId" = "JournalRecords"."companyId"
                //         where (((t1."branchId"::uuid) IS NULL) or (t1."branchId"= "JournalRecords"."branchId")) 
                //         and ( ("JournalRecords"."createdAt"::date IS NULL)or(("JournalRecords"."createdAt"::date) >= (t1.period->>'from')::date 
                //         AND  ("JournalRecords"."createdAt"::date) <= (t1.period->>'to')::date)) 
                //         group by t1."branchId", t1."accountId" , t1.account, 
                //                 t1."parentType", t1.type ,
                //                 t1.periodicity, t1.period,
                //                 t1."predictionAmount" ,s
                //         order by t1."parentType", t1.type, t1."accountId"
                //     )
                //     select t1."accountId", t1."parentType", t1.type, t1.account,  t1.periodicity, t1.period, t1."branchId", t1."predictionAmount", null as s, 0 as "actualAmount"
                //     from t1
                //     where  not exists(select 1 from t2 where t2."accountId" = t1."accountId" )
                //     union 
                //     select  t2."accountId", t2."parentType", t2.type, t2.account,  t2.periodicity, t2.period, t2."branchId", t2."predictionAmount", t2.s, t2."actualAmount" from t2        
    //                 `,
    //             values: [budgetId, parentType, branchId, companyId]
    //         }
    
    //         const Budget = await client.query(query.text, query.values);
    
    //        // journal.rows.forEach(element => {
    //        //    console.log(element)
    //        //    journal.rows.splice(journal.rows.indexOf(journal.rows.find(f=> f.debit ==0 && f.credit == 0)), 1)
    //        // });
    //        await client.query("COMMIT")
  
    //        return new ResponseData(true, "", Budget.rows)
    //     } catch (error: any) {
    //        await client.query("ROLLBACK")
    //      
    //        throw new Error(error.message)
    //     } finally {
    //        client.release()
    //     }
    //  }

     /* 

     with actualAmountPerMonth as(
	select  "JournalRecords"."companyId", "Budgets"."branchId" , "JournalRecords"."accountId", 
	        trim(to_char("JournalRecords"."createdAt", 'Month')) as key,
			date_trunc('month', "JournalRecords"."createdAt")as period,
			SUM(COALESCE(amount,0)::NUMERIC)as "actualAmount"
	from "Budgets"
	inner join "JournalRecords" on "Budgets"."companyId" = "JournalRecords"."companyId" 
									and ((("Budgets"."branchId"::uuid) IS NULL) or ("Budgets"."branchId" =  "JournalRecords"."branchId" ))  
	where  "Budgets"."companyId" = '97d49fa3-d473-48f3-ac56-17d7baad4c34' 
	and "Budgets".id = '0abba995-49fd-401f-8310-2d953cd4beb8'
	and "Budgets".year = extract( year from "JournalRecords"."createdAt" )
	group by  "JournalRecords"."companyId", "Budgets"."branchId","accountId", to_char("JournalRecords"."createdAt", 'Month'), extract(month from "JournalRecords"."createdAt" ), date_trunc('month', "JournalRecords"."createdAt")
	order by "companyId", "Budgets"."branchId" 
)
select "BudgetLines".id, "BudgetLines"."accountId",
actualAmountPerMonth."companyId",
actualAmountPerMonth."branchId",
(CASE
WHEN jsonb_array_length("test") > 0 THEN (jsonb_agg(
		json_build_object(
		  'predictionKey', (elem->>'predictionKey'),
		  'PredictionAmounts', elem->>'PredictionAmounts',
		  'ActualAmount', actualAmountPerMonth."actualAmount" 
	
		  ))
		
	  )
 
END)  AS "optionGroups"
from "BudgetLines"
left join actualAmountPerMonth ON actualAmountPerMonth."accountId" = "BudgetLines"."accountId"
left join jsonb_array_elements("BudgetLines"."test") AS elem on actualAmountPerMonth.key = (elem->>'predictionKey')
where "BudgetLines"."budgetId" = '0abba995-49fd-401f-8310-2d953cd4beb8'
group by "BudgetLines"."accountId", actualAmountPerMonth."companyId",actualAmountPerMonth."branchId", "BudgetLines".id


*/



    public static async getBudgetListByBranch(branchId: string) {
        try {
            const budgetList: any[] = [];
            const query : { text: string, values: any } = {
                text: `SELECT * FROM "Budgets" where "branchId" = $1`,
                values: [branchId]
            }

            const list = await DB.excu.query(query.text, query.values)
            for (let index = 0; index < list.rows.length; index++) {
                const budget = list.rows[index];
                const temp = new Budget();
                temp.ParseJson(budget);
                query.text = `SELECT * FROM "BudgetLines" WHERE "budgetId" = $1`
                query.values = [temp.id]

                const budgetLine: any = await DB.excu.query(query.text, query.values);
                temp.lines.push(budgetLine.rows[0]);

                budgetList.push(temp);
            }

            const data = {
                list: budgetList
            }
            return new ResponseData(true, "", data)
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    

// ##################################################################################################################
    public static async getManualJournalById(journalId: string,companyId:string) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            const query : { text: string, values: any } = {
                text: `SELECT 
                "Journals".id,
                "Journals".notes,
                "Journals".reference,
                "Journals".status,
                (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',"Media"."url"->>'defaultUrl','mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("Journals"."attachment") as attachments(attachments)
                inner join "Media" on "Media".id = (attachments->>'id')::uuid
                ) as "attachment",
            CAST ("Journals"."journalDate" AS TEXT) AS "journalDate",
                
                (
                SELECT json_agg(json_build_object('employeeId',"comments"."employeeId",
                                    'employeeName',"Employees".name,
                                    'comment',"comments"."comment",
                                    'date',"comments"."date"))
                FROM  jsonb_to_recordset("Journals"."comments") as "comments"("employeeId" uuid, "comment" text, "date" timestamp  )
                INNER JOIN "Employees" on  "Employees" .id = "comments"."employeeId"        
                            
                ) as "comments",
                "Journals"."branchId",
                "Branches".name as "branchName"
            FROM "Journals"   
            INNER JOIN "Branches"
            ON "Branches".id= "Journals"."branchId"
            WHERE  "Journals".id=$1 
            and "Branches"."companyId"=$2`,
                values: [journalId,companyId]
            }

            const data = await client.query(query.text, query.values)
            const journaldata = data.rows[0]
            const journal = new Budget();
            journal.ParseJson(journaldata)



            if(journal.id !="" && journal.id!=null){
            query.text = `SELECT 
                            "JournalLines".id,
                            "JournalLines".code,
                            "JournalLines".description,
                            case when amount >0 then amount else 0 end as debit,
                            case when amount <0 then ABS(amount)  else 0 end as credit,
                            "JournalLines"."createdAt" ,
                            "Accounts".name as "accountName",
                            "JournalLines"."accountId" 
                        FROM "JournalLines" 
                        INNER JOIN "Accounts"
                        ON "Accounts".id = "JournalLines"."accountId"
                        WHERE "journalId" = $1`
            query.values = [journalId]
            const journalLine: any = await client.query(query.text,[journalId]);
            for (let index = 0; index < journalLine.rows.length; index++) {
                const element = journalLine.rows[index];
                journal.lines.push(element);
            }
        }

            await client.query("COMMIT")

            return new ResponseData(true, "", journal)
        } catch (error: any) {
          
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release();
        }
    }

   //TODO: remove 
   public static async getBranchJournals(branchId: string) {
      try {
         const query : { text: string, values: any } = {
            text: `SELECT
            Journals.id,
            Journals.notes,
            Journals.reference,
            Journals."journalDate",
            (SELECT json_agg(
               json_build_object('dbTable', "dbTable",'dbTableId',"dbTableId",'code',code,'description',description,'debit',debit,'credit',credit,'accountId',"accountId")
               )FROM "JournalLines"  
               WHERE "JournalLines"."journalId" = Journals.id
               )as JournalLines
            FROM "Journals" AS Journals
                WHERE Journals."branchId" = $1
               
            `,
            values: [branchId]
         }

         const journal = await DB.excu.query(query.text, query.values);
         return new ResponseData(true, "", journal.rows)
      } catch (error: any) {
       
         return new ResponseData(false, "", [])
      }
   }
  


   


}