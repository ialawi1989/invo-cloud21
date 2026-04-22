import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Helper } from "@src/utilts/helper";
import { PoolClient } from "pg";



import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { RecurringExpense } from "@src/models/account/RecurringExpense";
import { ExpenseValidation } from "@src/validationSchema/account/expense.Schema";
import { ExpenseRepo } from "./expense.repo";
import { Expense } from "@src/models/account/Expense";
import { CompanyRepo } from "@src/repo/admin/company.repo";
import moment from "moment";
import { TriggerQueue } from "@src/repo/triggers/triggerQueue";
import { Log } from "@src/models/log";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";
import { recurringDueWhere, nextOccurrence, runWithConcurrency, RECURRING_AUTO_CONCURRENCY } from "./recurringSchedule.sql";

export class RecurringExpenseRepo {

    public static async checkIsRecurringExpenseNameExist(client: PoolClient, id: string | null, name: string, companyId: string) {
        try {
           
            const searchTerm = '%' + Helper.escapeSQLString(name.toLowerCase().trim())+ '%'
            const query : { text: string, values: any } = {
                text: `SELECT 
                        "RecurringExpenses". "name" 
                    FROM "RecurringExpenses"
                    INNER JOIN "Branches" ON "Branches".id = "RecurringExpenses"."branchId"
                    WHERE "Branches"."companyId"=$1
                            AND lower("RecurringExpenses".name) ILIKE $2
                `,
                values: [companyId, searchTerm]
            }

            if (id != null) {
                query.text = `SELECT 
                         "RecurringExpenses"."name" 
                    FROM "RecurringExpenses"
                    INNER JOIN "Branches" ON "Branches".id = "RecurringExpenses"."branchId"
                    WHERE "Branches"."companyId"=$1
                          AND lower("RecurringExpenses".name) ILIKE $2
                          AND "RecurringExpenses".id <> $3 `
                query.values = [companyId,searchTerm, id]
            }


        

            
            const records = await client.query(query.text, query.values);
            if (records.rowCount != null && records.rowCount > 0) {
                return true;
            } else {
                return false;
            }
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async checkIsRecurringExpenseHasChildExpenses(client: PoolClient, recurringExpenseId: string) {
        try {
           
          
            const query : { text: string, values: any } = {
                text: `SELECT id from "Expenses" where "Expenses"."recurringExpenseId" = $1 `,
                values: [recurringExpenseId ]
            } 
            const records = await client.query(query.text, query.values);
            if (records.rowCount != null && records.rowCount > 0) {
                return true;
            } else {
                return false;
            }
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getExpenseNumber(client: PoolClient, companyId :string) {
        try {
            
            let expenseNumber = "(^EE)[_\-]"

            const regexp = '^EE[_-]*';
            const numberPattern = '^[0-9\.]+$'

            const query: { text: string, values: any } = {
                text: `SELECT "expenseNumber" 
                        FROM "Expenses"
                        inner join "Branches" on "Branches".id = "Expenses"."branchId"
                        Where "Branches"."companyId" = $1
                        and "expenseNumber" ~ $2
                        and nullif(regexp_replace("expenseNumber", $3, '', 'g'), '') ~ $4
                        ORDER BY( nullif(regexp_replace("expenseNumber", $3 , ''),'')::int )DESC
                        LIMIT 1`,
                values: [companyId, expenseNumber, regexp, numberPattern]
            }

            const data = await client.query(query.text, query.values);
            if (data.rowCount != null && data.rowCount <= 0) {
                expenseNumber = "EE-1";
            } else {
                expenseNumber = await Helper.generateNumber((<any>data.rows[0]).expenseNumber)
            }
            

            return expenseNumber
        } catch (error: any) {
            console.log(error.message)
          
            throw new Error(error.message)
        }
    }

    public static  trim_Date(data : any) {
        let y;
        for (const x in data) {
            y = data[x];
            if ( ["dueDate","createdAt", "expenseDate","prodDate", "expireDate" ].includes(x) ){
                delete data[x];
                
            }
            if (y instanceof Object) y = this.trim_Date(y);
        }
        return data;
    }

    public static async addRecurringExpense(client:PoolClient,data: any, company: Company, employeeId : string) {
  
        try {
            const companyId = company.id;
    
            const recurringExpense = new RecurringExpense();
            recurringExpense.ParseJson(data);
            if(recurringExpense.name){
                 const isRecurringExpenseNameExist = await this.checkIsRecurringExpenseNameExist(client,null, recurringExpense.name, companyId)
                if (isRecurringExpenseNameExist) {
                    throw new ValidationException("Recurring Expense Name Already Used")
                }
            }

        

            // ############## Expense Validation  ##############     
            if( !recurringExpense.transactionDetails ){ throw new ValidationException("transaction Details is required")}
            recurringExpense.transactionDetails.paymentMethodId = recurringExpense.paymentMethodId
            const validate = await ExpenseValidation.expenseValidation(recurringExpense.transactionDetails);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            recurringExpense.transactionDetails.employeeId = employeeId
            recurringExpense.transactionDetails = this.trim_Date(recurringExpense.transactionDetails)
            // ###############################################

            recurringExpense.createdAt = new Date()
            recurringExpense.updatedDate = new Date()
            

            const query : { text: string, values: any } = {
                text: `INSERT INTO "RecurringExpenses" 
                                   ( name, type, "createdAt", "updatedDate", "supplierId", "customerId", "paymentMethodId", "branchId", "transactionDetails", "startDate", "endDate", "endTerm", "repeatData", "expenseCreatedBefore") 
                            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, $12, $13,$14) RETURNING id `,
                values: [
                    recurringExpense.name,   
                    recurringExpense.type , 
                    recurringExpense.createdAt,
                    recurringExpense.updatedDate,
                    recurringExpense.supplierId ,
                    recurringExpense.customerId,
                    recurringExpense.paymentMethodId,
                    recurringExpense.branchId,
                    JSON.stringify(recurringExpense.transactionDetails),
                    recurringExpense.startDate ,
                    recurringExpense.endDate ,
                    recurringExpense.endTerm,
                    JSON.stringify(recurringExpense.repeatData),
                    recurringExpense. expenseCreatedBefore
                ]
            }

       
            

            const recurringExpenseInsert = await client.query(query.text, query.values);

            if (recurringExpenseInsert.rows && recurringExpenseInsert.rows.length >0 ){
                const recurringExpenseId = (<any>recurringExpenseInsert.rows[0]).id;
                recurringExpense.id = recurringExpenseId
                return new ResponseData(true, "Added Successfully",{ id: recurringExpenseId, recurringExpense: recurringExpense })
            }

            return new ResponseData(false, "",{})
            
        } catch (error: any) {
            
          

            throw new Error(error.message)

        } 
    }

    public static async editRecurringExpense(client:PoolClient,data: any, company: Company,employeeId:string|null, source: string | null = null) {

        try {

            if (data.id == "" || data.id == null) { throw new ValidationException("Recurring Expense Id is Required") }

            const companyId = company.id;
            const recurringExpense = new RecurringExpense();
            recurringExpense.ParseJson(data);
            recurringExpense.updatedDate = new Date()

            if (recurringExpense.name) {
                const isEstimateNumberExist = await this.checkIsRecurringExpenseNameExist(client, recurringExpense.id, recurringExpense.name, companyId)
                if (isEstimateNumberExist) {  throw new ValidationException("Recurring Expense Name Already Used") }
            }
         

            // ############## Expense Validation  ##############     
            if( !recurringExpense.transactionDetails ){ throw new ValidationException("transaction Details is required")}
            const validate = await ExpenseValidation.expenseValidation(recurringExpense.transactionDetails);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            recurringExpense.transactionDetails.employeeId = employeeId
            recurringExpense.transactionDetails = this.trim_Date(recurringExpense.transactionDetails)

            
            recurringExpense.hasExpense = await this.checkIsRecurringExpenseHasChildExpenses(client,recurringExpense.id)

            
            
            if ( recurringExpense.hasExpense ) {
                recurringExpense.customerId = null
                recurringExpense.supplierId = null
                recurringExpense.branchId = null
            }
            // ###############################################



           
            const query : { text: string, values: any } = {
                text: `UPDATE "RecurringExpenses"
	                    SET name=$1, 
                            type=$2, 
                            "updatedDate"=$3, 
                            "paymentMethodId" = $4,
                            "startDate"=$5, 
                            "endDate"=$6, 
                            "endTerm"=$7, 
                            "repeatData"=$8, 
                            "transactionDetails" = $9,
                            "expenseCreatedBefore"=$10, 
                            "customerId" = COALESCE($11,"customerId")  ,
                            "supplierId" = COALESCE($12,"supplierId")  ,
                            "branchId"= COALESCE($13,"branchId")
                            
                        WHERE  id=$14  RETURNING *`,

                values: [   recurringExpense.name,           
                            recurringExpense.type , 
                            recurringExpense.updatedDate,    
                         
                            recurringExpense.paymentMethodId,
                            recurringExpense.startDate ,     
                            recurringExpense.endDate ,
                            recurringExpense.endTerm,
                            JSON.stringify(recurringExpense.repeatData),
                            JSON.stringify(recurringExpense.transactionDetails),
                            recurringExpense. expenseCreatedBefore, 
                            recurringExpense.customerId,
                            recurringExpense.supplierId,
                            recurringExpense.branchId,
                            recurringExpense.id
                           
                        ]
            }

           

            const recurringExpenseEdit = await client.query(query.text, query.values);

            if (recurringExpenseEdit.rows && recurringExpenseEdit.rows.length >0 ){
                const recurringExpenseId = (<any>recurringExpenseEdit.rows[0]).id;
                recurringExpense.id = recurringExpenseId
                return new ResponseData(true, "Updated Successfully",{ id: recurringExpenseId, recurringExpense: recurringExpense })
            }

            return new ResponseData(false, "",{})

        } catch (error: any) {
            console.log(error)
          
            throw new Error(error)
        }
    }

    public static async getRecurringExpenseById(recurringExpenseId: string, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            const companyId = company.id;
            const query : { text: string, values: any } = {
                text: `SELECT  "RecurringExpenses".* 
                        from "RecurringExpenses"
                        Inner join "Branches" ON "Branches".id = "RecurringExpenses"."branchId"
                        WHERE "RecurringExpenses".id =$1 AND "Branches"."companyId"=$2
                      `,
                values: [recurringExpenseId,company.id]
            }
            
            const recurringExpenseData = await client.query(query.text, query.values);
            const recurringExpense = new RecurringExpense();
            recurringExpense.ParseJson(recurringExpenseData.rows[0]);

            recurringExpense.hasExpense = await this.checkIsRecurringExpenseHasChildExpenses(client, recurringExpenseId)

            // ############## Expense Validation  ##############     
            if( !recurringExpense.transactionDetails ){ throw new ValidationException("transaction Details is required")}
            // const validate = await ExpenseValidation.expenseValidation(recurringExpense.transactionDetails);
            // if (!validate.valid) {
            //     throw new ValidationException(validate.error);
            // }
           
            recurringExpense.transactionDetails = this.trim_Date(recurringExpense.transactionDetails)
            // ###############################################
       
            await client.query("COMMIT");
           
            return new ResponseData(true, "", recurringExpense);
        } catch (error: any) {
            await client.query("ROLLBACK");
          
            throw new Error(error.message)
        } finally {
            client.release();
        }
    }

    public static async getRecurringExpenseOverview(recurringExpenseId: string, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            const companyId = company.id;
            const query : { text: string, values: any } = {
                text: `with "t1" as (
                            SELECT   "RecurringExpenses".id,
                                    "RecurringExpenses".name, 
                                    "Branches".name as "branchName",
                                    "RecurringExpenses"."createdAt",
                                    "RecurringExpenses"."updatedDate", 
                                    "RecurringExpenses"."supplierId", 
                                    "RecurringExpenses"."customerId",  
                                    "RecurringExpenses"."paymentMethodId",
                                    "RecurringExpenses"."branchId", 
                                    "RecurringExpenses"."startDate", 
                                    "RecurringExpenses"."endDate", 
                                    "RecurringExpenses"."endTerm", 
                                    "RecurringExpenses"."repeatData", 
                                    "Suppliers".name as "supplierName",
                                    "Customers".name as "customerName",
                                    "PaymentMethods".name as "paymentMethodName"
                                
                            FROM "RecurringExpenses"
                            Inner JOIN "Branches"  on "Branches".id = "RecurringExpenses"."branchId"
                            left join "Suppliers" on "Suppliers".id = "RecurringExpenses"."supplierId"
                            left join "Customers" on "Customers".id = "RecurringExpenses"."customerId"
                            left join "PaymentMethods" on "PaymentMethods".id = "RecurringExpenses"."paymentMethodId"
                            WHERE "RecurringExpenses".id = $1
                                AND "Branches"."companyId"= $2
                            )
                            ,"t2" as (
                            SELECT  count(*) over(),
                                    "Expenses".id,
                                    "Expenses"."expenseNumber",
                                    "Expenses"."createdAt",
                                    "Expenses"."paidThroughAccountId",
                                    "Accounts".name as "accountName",
                                    "Expenses".total,
                                    "Expenses"."expenseDate",
                                    "Expenses"."recurringExpenseId"
                            FROM "Expenses"
                            left JOIN "Branches"  ON "Branches".id =  "Expenses"."branchId"
                            left join "Accounts" ON "Accounts".id =  "Expenses"."paidThroughAccountId"
                            where "Branches"."companyId"= $2
                            and "Expenses"."recurringExpenseId" = $1
                            
                            )
                            select "t1".*, 
                                    case WHEN "t2"."recurringExpenseId" is not null then json_agg("t2".*) end as "childExpenses"
                            from "t1"
                            left join "t2" on "t1".id = "t2"."recurringExpenseId"
                            group by "t1".id, "t1".name, "t1"."branchName","t1"."createdAt", "t1"."updatedDate", 
                                     "t1"."supplierId", "t1"."branchId",  "t1"."customerId",  "t1"."paymentMethodId",
                                     "t1"."startDate",  "t1"."endDate", "t1"."endTerm", "t1"."repeatData", "t1"."supplierName", "t1"."customerName","t1"."paymentMethodName", "t2"."recurringExpenseId"
                      `,
                values: [recurringExpenseId,company.id]
            }
            
            const records = await client.query(query.text, query.values);

            let recurringExpense

             // ############## NEXT BILL DATE  ############## 
            if (records.rows && records.rows.length > 0){
                recurringExpense = records.rows[0]
                let startDate =  moment(new Date(recurringExpense.startDate))
             

                let nextExpenseDate = await this.getNextExpenseDate(startDate,recurringExpense.repeatData )


                // let firstExpenseDate = startDate.clone().set('date', recurringExpense.repeatData.on ); 
                // if (startDate.date() > Number(recurringExpense.repeatData.on)  ){
                //     (firstExpenseDate.add(1, 'month'))
                // }

                // let diff = moment().diff(firstExpenseDate, 'months') +1
                // let nextExpenseDate = firstExpenseDate.clone().add((diff% Number(recurringExpense.repeatData.periodQty))*  Number(recurringExpense.repeatData.periodQty), 'month')

                recurringExpense.nextExpenseDate = nextExpenseDate


            } 
            // ###############################################
       
            await client.query("COMMIT");
           
            return new ResponseData(true, "", recurringExpense??{});
        } catch (error: any) {
            await client.query("ROLLBACK");
          
            throw new Error(error.message)
        } finally {
            client.release();
        }
    }

    public static async getNextExpenseDate(startDate: moment.Moment, repeatData: {on:any, periodQty:any, periodicity:any}) {
        try {
            return nextOccurrence(startDate, repeatData);
        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    public static async getRecurringExpenseList(data: any, company: Company,branchList:any[]) {

        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
        
            const companyId = company.id;
            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;

            //############## filter ##############
            let filterQuery = `Where "Branches"."companyId" = $1              AND (array_length($2::uuid[], 1) IS NULL OR ("RecurringExpenses"."branchId"=any($2::uuid[])))`
            let searchValue = data.searchTerm ? `'^.*` + Helper.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `.*$'` : null;
            if (searchValue) {
                filterQuery += `and (LOWER("RecurringExpenses".name) ilike ${searchValue}
                                        OR LOWER("Branches".name) ilike ${searchValue}    
                                )`
            }

            //############## Sort ##############
            let sort = data.sortBy;
            let sortValue = !sort ? ' "RecurringExpenses"."createdAt":: timestamp:: time ' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by` + sortTerm

            //############## limit ##############
            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            let page = data.page ?? 1
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            //############## Counter ##############

            const counterQuery: { text: string, values: any } = {
                text: `select count(*)
                        FROM "RecurringExpenses"
                        Inner JOIN "Branches"  on "Branches".id = "RecurringExpenses"."branchId"
                        ${filterQuery}
                        `,
                values: [companyId,branches]
            }
            const counter = await client.query(counterQuery.text, counterQuery.values)

            //############## Select ##############


            const query: { text: string, values: any } = {
                text: ` with "list" as (SELECT   "RecurringExpenses".id,
                                "RecurringExpenses".name, 
                                "RecurringExpenses"."createdAt",
                                "RecurringExpenses"."updatedDate", 
                                "RecurringExpenses"."branchId", 
                                "RecurringExpenses"."startDate", 
                                "RecurringExpenses"."endDate", 
                                "RecurringExpenses"."endTerm", 
                                "RecurringExpenses"."repeatData", 
                            
                                "Branches".name as "branchName"
                        FROM "RecurringExpenses"
                        Inner JOIN "Branches"  on "Branches"."companyId" =$1 and  "Branches".id = "RecurringExpenses"."branchId"
                        
                        ${filterQuery}
                        group by "RecurringExpenses".id, "Branches".name
                        ${orderByQuery}
                        limit $3 offset $4)
                        select "list".*,    count("Expenses"."recurringExpenseId")::int as "childExpensesQty"  from "list" 
                        left join "Expenses" on "list".id = "Expenses"."recurringExpenseId"
                        group by 
                        "list".id,
                                "list".name, 
                                "list"."createdAt",
                                "list"."updatedDate", 
                                "list"."branchId", 
                                "list"."startDate", 
                                "list"."endDate", 
                                "list"."endTerm", 
                                "list"."repeatData", 
                            
                                "list"."branchName"
                        
                        `,
                values: [companyId,branches, limit, offset]
            }
            const selectList = await client.query(query.text, query.values)


            let count = counter.rows && counter.rows.length > 0 ? Number((<any>counter.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const list: any[] = selectList.rows?? [];


            const resData = {
                list: list,
                count: count,
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

    public static async deleteRecurringExpense(client:PoolClient,id: string, company: Company, employeeId:string) {
        try {

            const isRecurringExpenseNameExist = await this.checkIsRecurringExpenseHasChildExpenses(client, id)
            if (isRecurringExpenseNameExist) {
                throw new ValidationException("cannot delete Recurring Expense with child Expenses")
            }

            let recurringExpQuery = {
                text: `SELECT "RecurringExpenses"."branchId", "Employees"."name" as "employeeName"
                        FROM "RecurringExpenses"
                        INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2
                        WHERE "RecurringExpenses".id = $1`,
                values: [id, employeeId, company.id]
            }

            let recExpResult = await client.query(recurringExpQuery.text, recurringExpQuery.values);
            let branchId = recExpResult.rows && recExpResult.rows.length > 0 && recExpResult.rows[0].branchId ? recExpResult.rows[0].branchId : null
            let employeeName = recExpResult.rows && recExpResult.rows.length > 0 && recExpResult.rows[0].employeeName ? recExpResult.rows[0].employeeName : ''


            const query : { text: string, values: any } = {
                text: `Delete FROM "RecurringExpenses" where id = ($1)  `,
                values: [id]
            }

            let log = new Log();
            log.employeeId = employeeId
            log.action = 'Recurring Expense Deleted'
            log.comment = `${employeeName} has deleted Recurring Expense`
            log.metaData = {"deleted": true}
            await LogsManagmentRepo.manageLogs(client, "RecurringExpenses",id,[log], branchId, company.id, employeeId,"", "Cloud")
            

            const data = await client.query(query.text, query.values);
            return new ResponseData(true, "", data.rows[0]);
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async generateAutoExpenses() {
        // See generateAutoBills in RecurringBill.repo.ts for the rationale:
        // SELECT through the pool, then a fresh client per iteration so the
        // 60s auto-release timer in DB.excu.client() cannot kill the cron
        // mid-batch and we never sit "idle in transaction".
        let recurringExpenses: any
        try {
            const queryText = `select "RecurringExpenses".*
                        from "RecurringExpenses"
                        where ${recurringDueWhere({
                recurringTable: '"RecurringExpenses"',
                childTable: '"Expenses"',
                childFkColumn: '"recurringExpenseId"',
            })}`
            recurringExpenses = await DB.excu.query(queryText, [new Date()])
        } catch (error: any) {
            console.log("generateAutoExpenses: failed to load due recurring expenses", error)
            throw new Error(error)
        }

        await runWithConcurrency(recurringExpenses.rows, RECURRING_AUTO_CONCURRENCY, async (recurringRow: any) => {
            const client = await DB.excu.client()
            try {
                await client.query("BEGIN")

                const element = new RecurringExpense()
                element.ParseJson(recurringRow)
                let expenseData = new Expense()
                expenseData.ParseJson(element.transactionDetails)

                // Lightweight, in-transaction loader (see generateAutoBills
                // in RecurringBill.repo.ts for the full rationale).
                const company = await CompanyRepo.getCompanyMinimalForBranch(client, expenseData.branchId)
                if (!company) {
                    await client.query("ROLLBACK")
                    console.log(`generateAutoExpenses: branch not found for recurring expense id=${recurringRow?.id} branchId=${expenseData.branchId}`)
                    return
                }
                
                let expenseNumber = await RecurringExpenseRepo.getExpenseNumber(client, company.id)
                expenseData.expenseNumber = expenseNumber??"" 
                expenseData.recurringExpenseId = element.id
                let response = await ExpenseRepo.addExpense(client, expenseData, company)

                await client.query("COMMIT")

                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "Expenses", id: response.data.id, companyId: company.id })
            } catch (innerError: any) {
                try { await client.query("ROLLBACK") } catch (_) { /* ignore */ }
                console.log(`generateAutoExpenses: failed for recurring expense id=${recurringRow?.id}`, innerError)
                // continue with the next recurring expense instead of aborting the whole batch
            } finally {
                client.release()
            }
        })
    }


}