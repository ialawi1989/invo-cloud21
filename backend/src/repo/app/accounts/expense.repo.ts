import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Expense } from "@src/models/account/Expense"
import { ExpenseLine } from "@src/models/account/expenseLine";
import { Helper } from "@src/utilts/helper";
import { ExpenseValidation } from "@src/validationSchema/account/expense.Schema";
import { PoolClient } from "pg";
import { PaymnetMethodRepo } from "./paymentMethod.repo";
import { Company } from "@src/models/admin/company";

import { ValidationException } from "@src/utilts/Exception";
import { EventLog, Log } from "@src/models/log";
import { PDFGenerator } from "@src/utilts/PDFGenerator";
import { EventLogsRepo } from "./eventlogs.repo";
import { CompanyRepo } from "@src/repo/admin/company.repo";
import { TimeHelper } from "@src/utilts/timeHelper";
import { TransactionManagements } from "@src/utilts/TransactionsManagments";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";

export class ExpenseRepo {

    public static async checkIsExpenseNumberExist(client: PoolClient, id: string | null, expenseNumber: string, companyId: string) {
        try {
            const prefixReg = "^(EXP-)";
            const prefix = "EXP-"
            const num = expenseNumber.replace(prefix, '');
            const numTerm = expenseNumber.toLocaleLowerCase().trim()
            const query: { text: string, values: any } = {
                text: `SELECT "expenseNumber" 
                FROM "Expenses"
                INNER JOIN "Branches"
                ON "Branches".id = "Expenses"."branchId"
                WHERE "Branches"."companyId"=$1
                  AND ( LOWER("expenseNumber") = $2 )
          
                `,
                values: [companyId, numTerm]
            }

            if (id != null) {
                query.text = `SELECT "expenseNumber" 
                FROM "Expenses"
                INNER JOIN "Branches"
                ON "Branches".id = "Expenses"."branchId"
                WHERE "Branches"."companyId"=$1
                    AND ( LOWER("expenseNumber") = $2 )
                AND "Expenses".id <> $3 `
                query.values = [companyId, numTerm, id]
            }
            const expenseNumberData = await client.query(query.text, query.values);
            if (expenseNumberData.rowCount != null && expenseNumberData.rowCount > 0) {
                return true;
            } else {
                return false;
            }
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getExpenseLogs(client: PoolClient, expenseId: string) {
        try {
            const query = {
                text: `SELECT logs from "Expenses" where id =$1`,
                values: [expenseId]
            }

            let expense = await client.query(query.text, query.values);
            return expense.rows[0].logs ?? []
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async addExpense(client: PoolClient, data: any, company: Company) {

        try {

            const companyId = company.id;
            const validate = await ExpenseValidation.expenseValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            const isExpenseNumberExist = await this.checkIsExpenseNumberExist(client, null, data.expenseNumber, companyId);
            if (isExpenseNumberExist) {
                throw new ValidationException("Expense Number Already Used")
            }
            const afterDecimal = company.afterDecimal;

            const expense = new Expense();
            expense.ParseJson(data);
            expense.calculateTotal(afterDecimal)
            expense.createdAt = new Date()

            if (expense.total <= 0) {
                throw new ValidationException("Total must be Greater than Zero")
            }
            expense.paidThroughAccountId = (await PaymnetMethodRepo.getPaymnetMethodaccountId(client, expense.paymentMethodId, expense.branchId)).id
            const query: { text: string, values: any } = {
                text: `INSERT INTO "Expenses" ("expenseDate",
                                                "employeeId",
                                                "paidThroughAccountId",
                                                "supplierId",
                                                "customerId",
                                                "branchId",
                                                total,
                                                "referenceNumber",
                                                "expenseNumber",
                                                "paymentMethodId",
                                                "isInclusiveTax",
                                                attachment,
                                                "recurringExpenseId",
                                                "roundingType",
                                                "roundingTotal",
                                                "smallestCurrency",
                                                "companyId",
                                                "note"
                                                ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, $13,$14,$15,$16,$17,$18) RETURNING id `,
                values: [expense.expenseDate,
                expense.employeeId,
                expense.paidThroughAccountId,
                expense.supplierId,
                expense.customerId,
                expense.branchId,
                expense.total,
                expense.referenceNumber,
                expense.expenseNumber,
                expense.paymentMethodId,
                expense.isInclusiveTax,
                JSON.stringify(expense.attachment),
                expense.recurringExpenseId,
                expense.roundingType,
                expense.roundingTotal,
                expense.smallestCurrency,
                company.id,
                expense.note
                ]
            }

            const insert = await client.query(query.text, query.values)

            expense.id = insert.rows[0].id
            for (let index = 0; index < expense.lines.length; index++) {
                const element = expense.lines[index];
                element.createdAt = TimeHelper.getCreatedAt(expense.expenseDate, company.timeOffset);
                element.expenseId = expense.id;
                element.companyId = company.id;
                element.branchId = expense.branchId
                await this.addExpenseLine(client, element)
            }



            return new ResponseData(true, "", { id: expense.id })
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async editExpense(client: PoolClient, data: any, company: Company, employeeId: string) {

        try {

            const companyId = company.id;
            const validate = await ExpenseValidation.expenseValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            const isExpenseNumberExist = await this.checkIsExpenseNumberExist(client, data.id, data.expenseNumber, companyId);
            if (isExpenseNumberExist) {
                throw new ValidationException("Expense Number Already Used")
            }

            const afterDecimal = company.afterDecimal

            const expense = new Expense();
            expense.ParseJson(data);
            expense.calculateTotal(afterDecimal)
            expense.paidThroughAccountId = (await PaymnetMethodRepo.getPaymnetMethodaccountId(client, expense.paymentMethodId, expense.branchId)).id
            //expense.logs = await this.getExpenseLogs(client, expense.id);

            expense.logs = []



            const query: { text: string, values: any } = {
                text: ` UPDATE "Expenses"  SET "expenseDate"=$1,
                                                "employeeId"=$2,
                                                "paidThroughAccountId"=$3,
                                                "supplierId"=$4,
                                                total=$5,
                                                "referenceNumber"=$6,
                                                "expenseNumber"=$7,
                                                "paymentMethodId"=$8,
                                                "isInclusiveTax"=$9,
                                                attachment=$10,
                                                "customerId"=$11,
                                                "roundingType"=$12,
                                                "roundingTotal"=$13,
                                                "smallestCurrency"=$14,
                                                "note" = $15
                                                 WHERE  id=$16 `,
                values: [expense.expenseDate,
                expense.employeeId,
                expense.paidThroughAccountId,
                expense.supplierId,
                expense.total,
                expense.referenceNumber,
                expense.expenseNumber,
                expense.paymentMethodId,
                expense.isInclusiveTax,
                JSON.stringify(expense.attachment),
                expense.customerId,
                expense.roundingType,
                expense.roundingTotal,
                expense.smallestCurrency,
                expense.note,
                expense.id]
            }

            await client.query(query.text, query.values)

            for (let index = 0; index < expense.lines.length; index++) {
                const element = expense.lines[index];
                element.createdAt = TimeHelper.getCreatedAt(expense.expenseDate, company.timeOffset);
                element.companyId = company.id;
                element.branchId = expense.branchId
                if (element.id != null && element.id != "") {
                    let oldLine = await this.getExpenseOldTotal(client, element.id);
                    if (oldLine != element.total) {
                        Log.addLog(expense, "Edit Line", "edit", employeeId)
                    }
                    await this.editExpenseLine(client, element)
                } else {
                    element.expenseId = expense.id;

                    Log.addLog(expense, "Add New Line", "edit", employeeId)
                    await this.addExpenseLine(client, element)
                }

            }

            if (employeeId && expense.logs.length == 0) {
                Log.addLog(expense, "Edit", "edit", employeeId)
            }


            await this.setExpenseLogs(client, expense.id, expense.logs, expense.branchId, company.id,employeeId, expense.expenseNumber, "Cloud");

            return new ResponseData(true, "", { id: expense.id })
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }

    public static async addExpenseLine(client: PoolClient, expenseLine: ExpenseLine) {
        try {
            const query: { text: string, values: any } = {
                text: `INSERT INTO "ExpenseLines" ( "expenseId",
                                                    amount,
                                                    "accountId",
                                                    "taxPercentage",
                                                    "taxId",
                                                    "taxTotal",
                                                    taxes,
                                                    "taxType",
                                                    "isInclusiveTax",
                                                    total,
                                                    note,
                                                    "createdAt",
                                                    "branchId",
                                                    "companyId") 
                                           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
                values: [expenseLine.expenseId,
                expenseLine.amount,
                expenseLine.accountId,
                expenseLine.taxPercentage,
                expenseLine.taxId,
                expenseLine.taxTotal,
                JSON.stringify(expenseLine.taxes),
                expenseLine.taxType,
                expenseLine.isInclusiveTax,
                expenseLine.total,
                expenseLine.note,
                expenseLine.createdAt,
                expenseLine.branchId,
                expenseLine.companyId
                ]
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async editExpenseLine(client: PoolClient, expenseLine: ExpenseLine) {
        try {
            const query: { text: string, values: any } = {
                text: `UPDATE "ExpenseLines" SET
                                                    amount=$1,
                                                    "accountId"=$2,
                                                    "taxPercentage"=$3,
                                                    "taxId"=$4,
                                                    "taxTotal"=$5,
                                                    taxes=$6,
                                                    "taxType"=$7,
                                                    "isInclusiveTax"=$8,
                                                    total=$9,
                                                    note = $10,
                                                    "createdAt" = case when "createdAt"::date = $11::date then "createdAt" else $11 end
                                            WHERE id = $12`,
                values: [
                    expenseLine.amount,
                    expenseLine.accountId,
                    expenseLine.taxPercentage,
                    expenseLine.taxId,
                    expenseLine.taxTotal,
                    JSON.stringify(expenseLine.taxes),
                    expenseLine.taxType,
                    expenseLine.isInclusiveTax,
                    expenseLine.total,
                    expenseLine.note,
                    expenseLine.createdAt,
                    expenseLine.id]
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }


    public static async getExpensesList(data: any, company: Company, branchList: []) {
        try {
            const companyId = company.id;
            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;

            let searchValue = data.searchTerm ? data.searchTerm.toLowerCase().trim() : null;

            let sort = data.sortBy;
            let sortValue = !sort ? '"Expenses"."createdAt"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? " DESC " : sort.sortDirection;

            if (sort && sort.sortValue == "expenseNumber") {
                sortValue = ` regexp_replace("expenseNumber", '[A-Za-z0-9]*[_.+=-]', '')::int`
            }

            let sortTerm = sortValue + " " + sortDirection;
            let orderByQuery = " ORDER BY " + sortTerm


            if (data.searchTerm != "" && data.searchTerm != null) {
                searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`
            }
            let offset = 0;

            //calculate the offset and limit for pagenation 
            // in DataBase Offset start from 0  
            let page = data.page ?? 1
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }
            const filter = data.filter
            const fromDate = filter && filter.fromDate ? filter.fromDate : null
            const toDate = filter && filter.toDate ? filter.toDate : null
            const query = {
                text: `SELECT 
                    COUNT(*) OVER(),
                    "Expenses".id,
                    "Expenses".total,
                    "Expenses"."expenseDate",
                    "Expenses"."expenseNumber",
                           "Expenses"."referenceNumber",
                    "Branches".name as "branchName",
                    "Employees".name as "employeeName",
                    CASE WHEN "Reconciliations"."id" is not null and "Reconciliations"."status" = 'reconciled' then true else false end as "reconciled",
                    "Suppliers".name as "supplierName",
                    "Customers".name as "customerName"
            FROM "Expenses"
            INNER JOIN "Branches"  on "Branches".id = "Expenses"."branchId"
            INNER JOIN "Employees" on "Employees".id = "Expenses"."employeeId"
            LEFT JOIN "Suppliers" ON "Suppliers".id = "Expenses"."supplierId"
            LEFT JOIN "Customers" ON "Customers".id = "Expenses"."customerId"
            LEFT JOIN "Reconciliations" ON "Reconciliations".id = "Expenses"."reconciliationId"
            Where "Branches"."companyId"=$1
            AND ($2::text is null or(Lower("Branches".name) ~ $2 OR 
                Lower( "Employees".name) ~ $2 OR
                LOWER("Expenses"."expenseNumber") ~ $2 OR 
                nullif(regexp_replace("expenseNumber", '[A-Z]*-', ''),'') ~ $2
                       OR   LOWER("Expenses"."referenceNumber") ~ $2         )             )
            AND ($3::Date IS NULL OR "Expenses"."expenseDate"::date >= $3::date)
            AND ($4::Date IS NULL OR "Expenses"."expenseDate"::date <= $4::date)
            AND (array_length($5::uuid[], 1) IS NULL OR ("Branches".id=any($5::uuid[])))

            ${orderByQuery}
            LIMIT $6 OFFSET $7`,
                values: [company.id, searchValue, fromDate, toDate, branches, limit, offset]
            }

            const selectList = await DB.excu.query(query.text, query.values)

            let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
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
    public static async getExpenseById(expenseId: string, companyId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT "Expenses".id,
                             CAST( "Expenses". "expenseDate" AS TEXT) AS "expenseDate"  ,
                             "Expenses". "createdAt",
                             "Expenses". "employeeId",
                             "Expenses". "paidThroughAccountId",
                             "Expenses". "supplierId",
                             "Expenses". "customerId",
                             "Expenses". "branchId",
                             "Expenses". "total",
                             "Expenses". "referenceNumber",
                             "Expenses". "expenseNumber",
                             "Expenses". "note",
                             "Expenses". "notes",
                             "Expenses". "paymentMethodId",
                             "Expenses". "isInclusiveTax",
                             "Expenses". "smallestCurrency",
                             "Expenses".  "roundingTotal",
                             "Expenses". "roundingType",
                             CASE WHEN "Reconciliations"."id" is not null and "Reconciliations"."status" = 'reconciled' then true else false end as "reconciled",
                             "Customers". "name" as "customerName",
                (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',COALESCE("Media"."url"->>'downloadUrl',"Media"."url"->>'defaultUrl'),'mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("Expenses"."attachment") as attachments(attachments)
                inner join "Media" on "Media".id = (attachments->>'id')::uuid
                ) as "attachment",
                "Employees".name as "employeeName",
                "Branches".name as "branchName",
                "Branches"."customFields" as "branchCustomFields",
                "Suppliers".name as "supplierName",
                "Customers".name as "customerName",
                "PaymentMethods".name as "paymentMethodName"
                             FROM "Expenses" 
                             LEFT JOIN "Employees" on "Employees".id  = "Expenses"."employeeId" 
                             LEFT JOIN "Branches" on "Branches".id = "Expenses"."branchId"
                             LEFT JOIN "Suppliers" ON "Suppliers".id = "Expenses"."supplierId"
                                         LEFT JOIN "Reconciliations" ON "Reconciliations".id = "Expenses"."reconciliationId"
                              LEFT JOIN "Customers" ON "Customers".id = "Expenses"."customerId"
                             INNER JOIN "PaymentMethods" ON "PaymentMethods".id = "Expenses"."paymentMethodId"
                             where "Expenses".id=$1
                             AND "Branches"."companyId" = $2`,
                values: [expenseId, companyId]
            }

            const expenseTemp = await DB.excu.query(query.text, query.values);
            const expense = new Expense()
            expense.ParseJson(expenseTemp.rows[0])
            if (expense.id != "" && expense.id != null) {
                query.text = `SELECT "ExpenseLines".*,
                                    "Accounts".name as"accountName"
                              from "ExpenseLines"
                         inner join "Accounts" on "Accounts".id =  "ExpenseLines"."accountId" 
                          where "expenseId"=$1`
                query.values = [expenseId]

                const lineTemp: any = await DB.excu.query(query.text, [expenseId]);
                expense.lines = lineTemp.rows
            }
            return new ResponseData(true, "", expense)

        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getExpenseNumber(branchId: string, company: Company) {
        try {
            const companyId = company.id;
            let prefixSettings = await TransactionManagements.getPrefix('Expense', company.id)
            let prefix = prefixSettings.prefix
            let width = prefixSettings.width

            const query: { text: string, values: any[] } = {
                text: `  SELECT "expenseNumber"
                    FROM "Expenses"
                                INNER JOIN "Branches"
                                 ON "Branches".id = "Expenses"."branchId"
                                 Where "Branches"."companyId" = $1
                              AND "expenseNumber" LIKE $2
                              AND SUBSTRING("expenseNumber" FROM LENGTH($3)+1) ~ '^[0-9]+$'  -- only numeric suffixes
                            ORDER BY 
                              CAST(SUBSTRING("expenseNumber" FROM LENGTH($3)+1) AS INT) DESC
                            LIMIT 1`,
                values: [companyId, `${prefix}%`, prefix]
            };

            const data = await DB.excu.query(query.text, query.values);
            const lastNumber = data.rows && data.rows.length > 0 ? data.rows[0].expenseNumber : null;
            let newNumber = TransactionManagements.getNumber(prefix, lastNumber, width)

            return new ResponseData(true, "", { expenseNumber: newNumber })
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }


    public static async getExpenseAccounts(branchId: string, company: Company) {
        try {
            const companyId = company.id
            const types = ["Costs Of Goods Sold", "Expense", "Fixed Assets", "Current Liabilities", "Non Current Assets", "Other Assets", "Operating Expense", "Long Term Liabilities"]
            const query: { text: string, values: any } = {
                text: `SELECT id,name,"parentType","type","code" FROM "Accounts" where 
                 "companyId"=$1
                 AND "parentType" = any($2)
                  `,
                values: [companyId, types]
            }

            const accounts = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", accounts.rows)

        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async getPaidThroughAccounts(branchId: string, company: Company) {
        try {
            const companyId = company.id;
            const types = ["Equity", "Current Assets", "Fixed Assets", "Other Assets"]
            const query: { text: string, values: any } = {
                text: `SELECT id,name FROM "Accounts" where 
                 "companyId"=$1
                 AND "parentType" = any($2)
                  `,
                values: [companyId, types]
            }

            const accounts = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", accounts.rows)

        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async deleteExpense(expenseId: string, company: Company, employeeId: string) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")

            let journal = await client.query(
                    `Select 
                        "Expenses"."branchId",
                        "Expenses"."expenseDate", 
                        "Expenses"."expenseNumber",
                        "Employees"."name" as "employeeName"
                    from "Expenses" 
                    INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2
                    where "Expenses".id =$1
                    group by "Expenses".id, "Employees".id`, 
                    [expenseId, employeeId, company.id]
                );
            let branchId = journal.rows && journal.rows.length > 0 && journal.rows[0].branchId ? journal.rows[0].branchId : null
            let expenseDate = journal.rows && journal.rows.length > 0 && journal.rows[0].branchId ? journal.rows[0].expenseDate : null
            let expenseNumber = journal.rows && journal.rows.length > 0 && journal.rows[0].expenseNumber ? `${journal.rows[0].expenseNumber}` : ''
            let employeeName = journal.rows && journal.rows.length > 0 && journal.rows[0].employeeName ? `${journal.rows[0].employeeName}` : ''

            await CompanyRepo.validateTransactionDate(client, expenseDate, branchId, company.id)
            const query = {
                text: `DELETE FROM  "ExpenseLines" where "expenseId"=$1`,
                values: [expenseId]
            }

            await client.query(query.text, query.values);

            query.text = `DELETE FROM "Expenses" where id =$1`

            await client.query(query.text, query.values)
            //addLog
            let log = new Log();
            log.employeeId = employeeId
            log.action = 'Expense Deleted'
            log.comment = `${employeeName} has deleted Expense number ${expenseNumber}`
            log.metaData = {"deleted": true}
            await LogsManagmentRepo.manageLogs(client, "Expenses", expenseId, [log], branchId, company.id,employeeId ,expenseNumber,"Cloud")


            await client.query("COMMIT")

            return new ResponseData(true, "", [])
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async getExpenseOldTotal(client: PoolClient, expenseLineId: string) {
        try {
            const query = {
                text: `SELECT total FROM "ExpenseLines" where id = $1`,
                values: [expenseLineId]
            }

            let expense = await client.query(query.text, query.values);
            return expense.rows[0].total
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async setExpenseLogs(client: PoolClient, expenseId: string, logs: Log[], branchId: string, companyId: string,employeeId:string, expenseNumber:string | null, source:string) {
        try {
            await LogsManagmentRepo.manageLogs(client, "Expenses", expenseId, logs, branchId, companyId, employeeId, expenseNumber, source)

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async sendEmail(data: any, company: Company) {
        try {

            let pdfGenerator = new PDFGenerator()
            data.type = "expense";
            let pdfBuffer = await pdfGenerator.sendEmail(data, company);

            return pdfBuffer
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }


    }
    public static async getPdf(data: any, company: Company) {
        try {

            let pdfGenerator = new PDFGenerator()
            data.type = "expense";
            let pdfBuffer = await pdfGenerator.getPdf(data);
            return pdfBuffer
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }

}