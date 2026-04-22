import { DB } from "@src/dbconnection/dbconnection";
import { AppliedCredit } from "@src/models/account/appliedCredit";
import { ResponseData } from "@src/models/ResponseData";
import { Helper } from "@src/utilts/helper";
import { AppliedCreditsValidation } from "@src/validationSchema/account/appliedCredit.Schema";
import { CreditNoteRepo } from "./creditNote.Repo";
import { InvoiceRepo } from "./invoice.repo";
import { Company } from "@src/models/admin/company";


import { ValidationException } from "@src/utilts/Exception";
import { PoolClient } from "pg";
import { SocketAppliedCredit } from "@src/repo/socket/appliedCredit.socket";
import { EventLog, Log } from "@src/models/log";
import { EventLogsRepo } from "./eventlogs.repo";
import { EventLogsSocket } from "@src/repo/socket/eventLogs.socket";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";

export class AppliedCreditRepo {
    static redisClient: any;
    /**
     * 
     * apply credit => to apply a credit note balance  on invoice 
     * using Customer Credit
     * Uses Only Paid Credit Note    
     * 
     */
    public static async getInvoiceData(client: PoolClient, invoiceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT status ,"branchId","source" from "Invoices" where id =$1`,
                values: [invoiceId]
            }

            let invoice = await client.query(query.text, query.values);
            return (<any>invoice.rows[0])
        } catch (error: any) {
          
            throw new Error(error)
        }
    }
    public static async saveApplyCredit(data: any, company: Company) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const validate = await AppliedCreditsValidation.invoiceApplyCreditValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            const afterDecimal = company.afterDecimal
            /**Insert apply creditQuery */
            const query: any = {
                text: `INSERT INTO "AppliedCredits" ("invoiceId",
                                                     "creditNoteId",
                                                     "amount",
                                                     "createdAt",
                                                     "appliedCreditDate",
                                                     "employeeId",
                                                     "companyId",
                                                     "branchId") values($1,$2,$3,$4,$5,$6,$7,$8) Returning id `,
                values: []

            }

            const applyCredit = new AppliedCredit();
            applyCredit.invoiceId = data.invoiceId;
            applyCredit.amount = data.amount;
            applyCredit.creditNoteId = data.id;
            applyCredit.createdAt = new Date();
            applyCredit.employeeId = data.employeeId;
            applyCredit.amount = Helper.roundDecimal(applyCredit.amount, afterDecimal)
            query.values = [applyCredit.invoiceId, applyCredit.creditNoteId, applyCredit.amount, applyCredit.createdAt, applyCredit.appliedCreditDate, applyCredit.employeeId]


            if (applyCredit.amount > 0) {
                let invoiceData = await this.getInvoiceData(client, applyCredit.invoiceId)
                let invoiceStatus = invoiceData.status;
                if (invoiceStatus == "Draft" || invoiceStatus == "writeOff") {
                    throw new ValidationException("Applied Credit Are Not Allowed on Draft/writeOff Invoices")
                }

                const invoiceBalance = (await InvoiceRepo.getInvoiceBalance(client, applyCredit.invoiceId)).data
                /** Check amount applied is not exceeding the total balance of invoice  */
                if (invoiceBalance.balance < applyCredit.amount) {
                    throw new ValidationException('Amount to Credit On Invoice' + invoiceBalance.invoiceNumber + ' Exceeds Invoice Balance')
                }
                /** Check amount applied is not exceeding the total balance of creditNote  */
                const creditNoteBalance = (await CreditNoteRepo.getRefundDue(client, applyCredit.creditNoteId, null))
                if (creditNoteBalance < applyCredit.amount) {
                    {
                        throw new ValidationException('Amount Credited Exceeds Credit Note Balance')
                    }
                }
                applyCredit.branchId = invoiceBalance.branchId;
                applyCredit.companyId = company.id
                query.values.push(applyCredit.companyId,applyCredit.branchId)
                let res = await client.query(query.text, query.values);
                applyCredit.id = (<any>res.rows[0]).id

                if (invoiceData.source == 'Online' || invoiceData.source == 'POS') {

                    await SocketAppliedCredit.syncAppliedCredit(applyCredit, invoiceData.branchId)
                }
            }



            await client.query("COMMIT")

            return new ResponseData(true, "", { id: applyCredit.id ,applyCredit:applyCredit })
        } catch (error: any) {
            await client.query("ROLLBACK")
          
            throw new Error(error.message)
        } finally {
            client.release();
        }
    }

    public static async getAppliedCreditList(company: Company) {
        try {


            const companyId = company.id
            const query: { text: string, values: any } = {
                text: `SELECT 
                        "AppliedCredits".id,
                        "CreditNotes"."creditNoteNumber",
                        "Invoices"."invoiceNumber",
                        "Branches".name as "branchName",
                        "AppliedCredits".amount 
                
                FROM "AppliedCredits"
                INNER JOIN "CreditNotes" ON "CreditNotes".id = "AppliedCredits"."creditNoteId"
                INNER JOIN "Invoices" ON "Invoices".id = "CreditNotes"."invoiceId"
                INNER JOIN "Branches" ON "Branches".id = "Invoices"."branchId"
                INNER JOIN "Companies" ON "Companies".id = "Branches"."companyId"
                WHERE "Companies".id = $1 `,
                values: [companyId]
            }

            const creditApplies = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", creditApplies.rows)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    /** Will Retreive a list of creditnotes used in invoice view to  apply credit note balance on invoice */
    public static async getCustomerCreditsList(customerId: string,companyId:string) {
        try {

            const query: { text: string, values: any } = {
                text: `--sql
                            WITH "invo_total" AS (
                                -- compute remaining invoice balance after payments
                                SELECT 
                                    "Invoices"."id" AS "invoice_id",
                                "Invoices"."total"::text::numeric   AS "balance"
                                FROM "Invoices"
                                WHERE "Invoices"."companyId" =$1
                                and "Invoices"."customerId" = $2
                            ),"invo" as(
                                -- compute remaining invoice balance after payments
                                SELECT 
                                    "invo_total"."invoice_id" ,
                                "invo_total"."balance"::text::numeric - COALESCE(SUM("InvoicePaymentLines"."amount"::text::numeric), 0)    AS "balance"
                                FROM "invo_total"
                                inner JOIN "InvoicePaymentLines" ON "InvoicePaymentLines"."invoiceId" = "invo_total"."invoice_id"
                                INNER JOIN "InvoicePayments" ON "InvoicePayments".id = "InvoicePaymentLines"."invoicePaymentId"
                                inner join "PaymentMethods" on "PaymentMethods".id = "InvoicePayments"."paymentMethodId"
                                WHERE "InvoicePayments"."status" = 'SUCCESS' 
                                    AND lower("PaymentMethods"."name") != ('points')
                            GROUP BY  "invo_total"."invoice_id", "invo_total"."balance"
                            )
                            ,"invoice_balance" as (
                                select  "invoice_id", case when "invo"."balance"::text::numeric - sum("CreditNotes"."total"::text::numeric) <0 then abs("invo"."balance"::text::numeric - sum("CreditNotes"."total"::text::numeric)) end AS "balance"
                                from "invo" 
                                inner join "CreditNotes" on "CreditNotes"."invoiceId" = "invo"."invoice_id"
                                WHERE "CreditNotes"."companyId" =$1
                                group by "invo"."invoice_id","invo"."balance"
                            )
                            , "credit_notes_ordered" AS (
                                -- order credit notes by createdAt per invoice
                                SELECT 
                                    "CreditNotes"."id" AS "credit_note_id",
                                    "CreditNotes"."invoiceId",
                                    "CreditNotes"."creditNoteNumber" AS "code",
                                    "CreditNotes"."total"::numeric AS "credit_total",
                                    "CreditNotes"."createdAt"
                                FROM "CreditNotes"
                                INNER JOIN "invoice_balance" ON "invoice_balance"."invoice_id" = "CreditNotes"."invoiceId"
                                WHERE "CreditNotes"."companyId" =$1
                                ORDER BY "CreditNotes"."invoiceId", "CreditNotes"."createdAt" ASC
                            ), "applied_credits" AS (
                                SELECT 
                                    "AppliedCredits"."creditNoteId" AS "credit_note_id",
                                    SUM("AppliedCredits"."amount"::numeric) AS "applied_total"
                                FROM "AppliedCredits"
                                INNER JOIN "credit_notes_ordered" ON "credit_notes_ordered". "credit_note_id" = "AppliedCredits"."creditNoteId"
                                GROUP BY "AppliedCredits"."creditNoteId"
                            ), "refunds" AS (
                                SELECT 
                                    "CreditNoteRefunds"."creditNoteId" AS "credit_note_id",
                                    SUM("CreditNoteRefunds"."total"::numeric) AS "refund_total"
                                FROM "CreditNoteRefunds"
                                INNER JOIN "credit_notes_ordered" ON "credit_notes_ordered". "credit_note_id" = "CreditNoteRefunds"."creditNoteId"
                                GROUP BY "CreditNoteRefunds"."creditNoteId"
                            ), "credit_notes_allocated" AS (
                                SELECT
                                    cno."credit_note_id",
                                    cno."invoiceId",
                                    cno."code",
                                    cno."credit_total",
                                    COALESCE(ac."applied_total", 0) AS "applied_total",
                                    COALESCE(rf."refund_total", 0) AS "refund_total",
                                    ib."balance" AS "invoice_balance",
                                    -- running sum of allocated amounts to previous credit notes
                                    SUM(cno."credit_total") OVER (
                                        PARTITION BY cno."invoiceId"
                                        ORDER BY cno."createdAt" ASC
                                        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                                    ) AS "running_allocated"
                                FROM "credit_notes_ordered" cno
                                INNER JOIN "invoice_balance" ib ON ib."invoice_id" = cno."invoiceId"
                                LEFT JOIN "applied_credits" ac ON ac."credit_note_id" = cno."credit_note_id"
                                LEFT JOIN "refunds" rf ON rf."credit_note_id" = cno."credit_note_id"
                            ), "credit_notes_final" AS (
                                SELECT
                                    "credit_note_id",
                                    "invoiceId",
                                    "code",
                                    "credit_total",
                                    "applied_total",
                                    "refund_total",
                                    "invoice_balance",
                                    -- allocate the credit note based on remaining balance
                                    LEAST(
                                        "credit_total",
                                        GREATEST("invoice_balance" - COALESCE("running_allocated", 0), 0)
                                    ) - "applied_total" - "refund_total" AS "net_allocated_credit"
                                FROM "credit_notes_allocated"
                            ), "creditNotes" as (

                            SELECT   "credit_note_id" as id , "code" ,      'creditNote' as "reference",  "net_allocated_credit" as "credit"
                            FROM "credit_notes_final"
                            where "net_allocated_credit" <> 0 
                            ORDER BY "invoiceId", "credit_note_id"
                            ),"payments" as (
                                                        SELECT      "InvoicePayments".id ,
                                                                    'Unearend Revenue' as "code",
                                                    
                                                                    'invoicePayment' as "reference",
                                                                    "InvoicePayments"."tenderAmount" - COALESCE(sum ("InvoicePaymentLines".amount::text::numeric),0) as "credit"
                                                                
                                                        
                                                                from "Customers"
                                                                left join "InvoicePayments" 
                                                                on "InvoicePayments"."customerId" = "Customers".id 
                                                                left join "InvoicePaymentLines"
                                                                on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id
                                                                WHERE "InvoicePayments"."companyId" =$1
                                                                AND"Customers".id = $2
                                                                group by "InvoicePayments".id
                                                                having "InvoicePayments"."tenderAmount" > COALESCE(sum ("InvoicePaymentLines".amount),0)
                                                )


                            select * from "creditNotes"
                            union all 
                            SELECT * FROM "payments"  `,
                values: [companyId,customerId]
            }

            const creditApplies = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", creditApplies.rows)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    /** Will Retreive a list of not fully paid invoices used in creditNote view when to apply credit note balance on invoice */
    public static async getCustomerInvoices(customerId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `select
                        "Invoices".id,
                        "Invoices"."invoiceNumber",
                        "Invoices".total -(  COALESCE(sum("CreditNotes".total),0) + COALESCE(sum("AppliedCredits".amount),0) + COALESCE(sum("InvoicePaymentLines".amount),0)) as "invoiceBalance" ,
                        'creditNote' as reference
                from "Invoices"
                LEFT JOIN "AppliedCredits" ON "AppliedCredits"."invoiceId" = "Invoices".id
                LEFT JOIN "InvoicePaymentLines" ON  "InvoicePaymentLines"."invoiceId" = "Invoices".id
                LEFT JOIN "CreditNotes" ON "CreditNotes"."invoiceId" = "Invoices".id
                where "Invoices"."customerId" =$1
                GROUP BY "Invoices".id
                HAVING "Invoices".total -(COALESCE(sum("CreditNotes".total),0) + COALESCE(sum("AppliedCredits".amount),0) + COALESCE(sum("InvoicePaymentLines".amount),0))>0`,
                values: [customerId]
            }

            const creditApplies = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", creditApplies.rows)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async deleteAppliedCredit(appliedCreditId: string, company: Company, employeeId: string) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const query = {
                text: `SELECT "invoiceId","Invoices"."branchId", "Invoices"."source", "Employees"."name" as "employeeName"
                        from "AppliedCredits"
                        inner join "Invoices" on "Invoices".id = "AppliedCredits"."invoiceId"
                        INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2
                        WHERE "AppliedCredits".id = $1`,
                values: [appliedCreditId, employeeId, company.id]
            }

            let invoice = await client.query(query.text, query.values);
            let invoiceId = invoice && invoice.rows && invoice.rows.length > 0 ? invoice.rows[0].invoiceId : null
            let branchId = invoice && invoice.rows && invoice.rows.length > 0 ? invoice.rows[0].branchId : null
            let source = invoice && invoice.rows && invoice.rows.length > 0 ? invoice.rows[0].source : null
            let employeeName = invoice && invoice.rows && invoice.rows.length > 0 ? invoice.rows[0].employeeName : null


            query.text = `delete from "AppliedCredits" WHERE id =$1`
            await client.query(query.text, query.values);


            let log = new Log();
            log.employeeId = employeeId
            log.action = 'Applied Credit Deleted'
            log.comment = `${employeeName} has deleted applied credit`
            log.metaData = {"deleted": true}

           await LogsManagmentRepo.manageLogs(client, "AppliedCredits",appliedCreditId,[log], branchId, company.id,employeeId, null, source)
            
            EventLogsSocket.deleteApplyCreditSync(branchId, appliedCreditId)

            await client.query("COMMIT")
            return new ResponseData(true, "", { invoiceId: invoiceId })

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
}