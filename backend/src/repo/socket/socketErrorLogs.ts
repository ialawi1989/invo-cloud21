import { DB } from "@src/dbconnection/dbconnection";
import { InvoicePayment } from "@src/models/account/InvoicePayment";
import { PoolClient } from "pg";
import { SoketInvoicePayment } from "./invoicePayment.socket";
import { BranchesRepo } from "../admin/branches.repo";
import {  JournalTriggers } from "../triggers/journalTriggers";
import { ResponseData } from "@src/models/ResponseData";
import { CreditNote } from "@src/models/account/CreditNote";
import { SocketCreditNoteRepo } from "./creditNote.socket";
import { Refund } from "@src/models/account/Refund";
import { SocketRefund } from "./refund.socket";

import ExcelJS from 'exceljs'
export class SocketLogs {
    compnayId = "";
    branchId = "";
    dbTable = "";
    referenceId = "";
    logs: any[] = []
}

export class SocketErrorLogs {

    public static async setLogs(client: PoolClient, socketLogs: SocketLogs) {
        try {
            const query = {
                text: `INSERT INTO "SocketLogs" ("companyId","dbTable","referenceId",logs,"branchId") values($1,$2,$3,$4,$5)`,
                values: [socketLogs.compnayId, socketLogs.dbTable, socketLogs.referenceId, JSON.stringify(socketLogs.logs), socketLogs.branchId]
            }
            await client.query(query.text, query.values)
        } catch (error: any) {
            throw new Error(error)
        }
    }



    public static async addFaildPayments(data: any) {

        const client = await DB.excu.client(60 * 10)
        try {

            let page = data.page ?? 1

            const limit = ((data.limit == null) ? 25 : data.limit);
            let offset = (limit * (page - 1))


            await client.query("BEGIN")
            const query = {
                text: `select id,(jsonb_array_elements(logs)->>'data' ) as "data" from "SocketLogs" 
                       where "dbTable" = 'InvoicePayments'
                       order by id 
                       limit $1
                       offset $2
                       `,
                values: [limit, offset]
            }

            let invoicePaymentsList = await DB.excu.query(query.text, query.values);
            let idsToDelete: any[] = []; /** ids to be Deleted from logs after successfully added */
            let faildIds: any[] = [];
            if (invoicePaymentsList.rows && invoicePaymentsList.rows.length > 0) {
                const invoicePayment = new InvoicePayment();

                for (let index = 0; index < invoicePaymentsList.rows.length; index++) {
                    const element: any = invoicePaymentsList.rows[index];

                    invoicePayment.ParseJson(JSON.parse(element.data))

                    let invoiceIds = invoicePayment.lines.map((line) => line.invoiceId);
                    if (invoicePayment.id == "" || invoicePayment.id == null) {
                        faildIds.push(element.id)
                        continue;
                    }

                    let emptyLineInvoiceIds = invoicePayment.lines.filter((line) => line.invoiceId == "" || line.invoiceId == null);
                    let emptyLineIds = invoicePayment.lines.filter((line) => line.id == "" || line.id == null);

                    if ((emptyLineIds && emptyLineIds.length > 0) || (emptyLineInvoiceIds && emptyLineInvoiceIds.length)) {
                        faildIds.push(element.id)
                        continue;
                    }
                    let checkIfPaymentExists = await SoketInvoicePayment.checkIfPaymentIdExist(client, invoicePayment.id, invoicePayment.branchId);
                    if (checkIfPaymentExists) {
                        faildIds.push(element.id)
                        continue;
                    }

                    let checkIfInvoicesIdsExists = await SoketInvoicePayment.checkIfInvoicesIdsExists(client, invoiceIds)

                    if (!checkIfInvoicesIdsExists) {
                        faildIds.push(element.id)
                        continue;
                    }


                    const companyId = (await BranchesRepo.getBranchCompanyId(client, invoicePayment.branchId)).compayId;
                    let addPayment = await SoketInvoicePayment.addInvoicePayment(client, invoicePayment, companyId);
                    idsToDelete.push(element.id);

                    await this.paymentJournal(client, invoicePayment.id, companyId);
                    await this.updateInvoiceStatus(client, invoiceIds)
                }
            }

            idsToDelete = idsToDelete.filter(item => !faildIds.includes(item));
            client.query('DELETE  FROM "SocketLogs" where id = any($1)', [idsToDelete])
            await client.query("COMMIT")

            return new ResponseData(true, "", [])
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }


    public static async paymentJournal(client: PoolClient, paymentId: string, companyId: string) {
        try {

            let customer = await JournalTriggers.getUser(client, "InvoicePayments", "Customers", paymentId,companyId)
            const query = {
                text: `
                     with "values" as (
                        select  $1::uuid as "paymentId" ,
                                $2::uuid as "companyId" 
                        ), "Journals" as (
                           SELECT 
                            CASE
                            WHEN "InvoicePayments"."tenderAmount"::text::numeric::double precision > 0::double precision THEN "InvoicePayments"."tenderAmount"::text::numeric * "InvoicePayments".rate::text::numeric - COALESCE("InvoicePayments"."bankCharge"::text::numeric,0) - COALESCE("InvoicePayments"."changeAmount"::text::numeric,0) * "InvoicePayments".rate::text::numeric
                            ELSE "InvoicePayments"."paidAmount"::text::numeric - COALESCE("InvoicePayments"."bankCharge"::text::numeric,0)
                            END   as "total",
                            "paymentDate"  as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "InvoicePayments".id as "referenceId",
                            "InvoicePayments"."branchId",
                            null::uuid as  "salesEmployeeId",
                            null::uuid as  "chargeId",
                            NULL as "code"
                            FROM "InvoicePayments"
                            INNER JOIN "values" on true 
                            INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".id = "InvoicePayments"."paymentMethodAccountId"
                            where "InvoicePayments".id = "values" ."paymentId"
                            AND "InvoicePayments".status::text = 'SUCCESS'::text
                          
                        UNION ALL 
                                 SELECT 
                           case when "InvoicePayments"."tenderAmount" >0 then ("InvoicePayments"."tenderAmount"::text::numeric * "InvoicePayments".rate::text::numeric )- COALESCE(sum("InvoicePaymentLines".amount::text::numeric)::real, 0::numeric::real) + (COALESCE("InvoicePayments"."changeAmount"::text::numeric,0) * "InvoicePayments".rate::text::numeric)
						   else "InvoicePayments"."paidAmount"  - (COALESCE(sum("InvoicePaymentLines".amount::text::numeric)::real, 0::numeric::real)::text::numeric::double precision + (COALESCE("InvoicePayments"."changeAmount"::text::numeric,0) * "InvoicePayments".rate::text::numeric)::double precision)
						   end   * '-1'::integer::double precision
						   as "total",
                            "paymentDate"  as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "InvoicePayments".id as "referenceId",
                            "InvoicePayments"."branchId",
                            null::uuid as  "salesEmployeeId",
                            null::uuid as  "chargeId",
                            NULL as "code"
                            FROM "InvoicePayments"
                            INNER JOIN "values" on true 
                            INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Unearend Revenue'::text AND "Accounts"."default" = true
                            LEFT JOIN "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id and "InvoicePayments"."paymentDate" = "InvoicePaymentLines"."createdAt"::date 
                            where "InvoicePayments".id = "values" ."paymentId"
                            AND "InvoicePayments".status::text = 'SUCCESS'::text
                            GROUP BY  "InvoicePayments".id, "Accounts".id
                             having  (((((("InvoicePayments"."tenderAmount"::text::numeric * "InvoicePayments".rate::text::numeric)::text)::numeric)::double precision - "changeAmount"::text::numeric * "rate"::text::numeric  - (COALESCE(sum("InvoicePaymentLines".amount::text::numeric)::real, 0::numeric::real)::text::numeric::double precision + "InvoicePayments"."bankCharge"::text::numeric::double precision + ("InvoicePayments"."changeAmount"::text::numeric * "InvoicePayments".rate::text::numeric)::double precision))::text)::numeric) >0 
							or ("paidAmount"::text::numeric -  COALESCE(sum("InvoicePaymentLines".amount::text::numeric), 0) <> 0.0 and  "paidAmount"::text::numeric <> "tenderAmount"::text::numeric * "rate"::text::numeric - "changeAmount"::text::numeric * "rate"::text::numeric )
                                        union all 
                            SELECT 
                             sum("InvoicePaymentLines".amount::text::numeric)::double precision * '-1'::integer::double precision   as "total",
                            "paymentDate"  as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "InvoicePayments".id as "referenceId",
                            "InvoicePayments"."branchId",
                            null::uuid as  "salesEmployeeId",
                            null::uuid as  "chargeId",
                            NULL as "code"
                            FROM "InvoicePayments"
                            INNER JOIN "values" on true 
                            LEFT JOIN "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id and "InvoicePayments"."paymentDate" = "InvoicePaymentLines"."createdAt"::date 
                            LEFT JOIN "Invoices" ON "Invoices"."id" = "InvoicePaymentLines"."invoiceId" 
                        LEFT join "Accounts" on "Accounts"."companyId" =  "values"."companyId" AND (( "Invoices"."receivableAccountId" is not null and  "Accounts".id = "Invoices"."receivableAccountId") OR  (  "Invoices"."receivableAccountId" is null and "Accounts".name::text = 'Account Receivable'::text AND "Accounts".type::text = 'Account Receivable'::text AND "Accounts"."default" = true))  
							where "InvoicePayments".id = "values" ."paymentId"
                            AND "InvoicePayments".status::text = 'SUCCESS'::text
                            GROUP BY  "InvoicePayments".id, "Accounts".id
                            having  sum("InvoicePaymentLines".amount::text::numeric)::double precision  >0 
                            
                        UNION ALL 
                          SELECT 
                            sum("InvoicePaymentLines".amount::text::numeric)::double precision as "total",
                            "InvoicePaymentLines"."createdAt"  as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "InvoicePaymentLines".id as "referenceId",
                            "InvoicePayments"."branchId",
                            null::uuid as  "salesEmployeeId",
                            null::uuid as  "chargeId",
                            NULL as "code"
                            FROM "InvoicePayments"
                            INNER JOIN "values" on true 
                            INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Unearend Revenue'::text AND "Accounts"."default" = true
                            LEFT JOIN "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id and "InvoicePayments"."paymentDate" <> "InvoicePaymentLines"."createdAt"::date 
                            where "InvoicePayments".id = "values" ."paymentId"
                            AND "InvoicePayments".status::text = 'SUCCESS'::text
                            GROUP BY  "InvoicePayments".id, "Accounts".id,"InvoicePaymentLines"."createdAt",     "InvoicePaymentLines".id
                            having  sum("InvoicePaymentLines".amount::text::numeric)::double precision  >0 
    
                          union all 
                            SELECT 
                             sum("InvoicePaymentLines".amount::text::numeric)::double precision * '-1'::integer::double precision   as "total",
                            "InvoicePaymentLines"."createdAt" as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "InvoicePaymentLines".id as "referenceId",
                            "InvoicePayments"."branchId",
                            null::uuid as  "salesEmployeeId",
                            null::uuid as  "chargeId",
                            NULL as "code"
                            FROM "InvoicePayments"
                            INNER JOIN "values" on true 
                            LEFT JOIN "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id and "InvoicePayments"."paymentDate" <> "InvoicePaymentLines"."createdAt"::date 
                             LEFT JOIN "Invoices" ON "Invoices"."id" = "InvoicePaymentLines"."invoiceId" 
                             LEFT join "Accounts" on "Accounts"."companyId" =  "values"."companyId" AND (( "Invoices"."receivableAccountId" is not null and  "Accounts".id = "Invoices"."receivableAccountId") OR  (  "Invoices"."receivableAccountId" is null and "Accounts".name::text = 'Account Receivable'::text AND "Accounts".type::text = 'Account Receivable'::text AND "Accounts"."default" = true))  
							where "InvoicePayments".id = "values" ."paymentId"
                            AND "InvoicePayments".status::text = 'SUCCESS'::text
                            GROUP BY  "InvoicePayments".id, "Accounts".id ,"InvoicePaymentLines"."createdAt",     "InvoicePaymentLines".id
                            having  sum("InvoicePaymentLines".amount::text::numeric)::double precision  >0 
    
                            union all 
                            SELECT 
                            "InvoicePayments"."bankCharge"::text::numeric  as "total",
                            "paymentDate"  as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "InvoicePayments".id as "referenceId",
                            "InvoicePayments"."branchId",
                            null::uuid as  "salesEmployeeId",
                            null::uuid as  "chargeId",
                            NULL as "code"
                            FROM "InvoicePayments"
                            INNER JOIN "values" on true 
                            INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId"  AND "Accounts".name::text = 'Bank Charge'::text AND "Accounts"."default" = true
                            where "InvoicePayments".id = "values" ."paymentId"
                            AND "InvoicePayments".status::text = 'SUCCESS'::text
                            AND  "InvoicePayments"."bankCharge"::text::numeric > 0 
                        
                        )
                        
                        select * from "Journals"`,

                values: [paymentId, companyId]
            }


            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];

            await JournalTriggers.deleteJournals(client, [paymentId])
            await JournalTriggers.deleteLinesIds(client, [paymentId], 'Invoice', companyId)
            await JournalTriggers.saveJournal(client, journals, 'Invoice Payment', customer, companyId);
        } catch (error) {
            throw new Error();
        }
    }


    public static async updateInvoiceStatus(client: PoolClient, invoiceIds: any[]) {

        try {


            const query = {
                text: `WITH "invoices" AS (
                    SELECT "Invoices".total, "Invoices".id ,"Invoices".status,"Invoices"."mergeWith","Invoices"."onlineData"
                    FROM "Invoices"
                    WHERE "Invoices".id = any($1)
                ),
                "payments" AS (
                    SELECT COALESCE(SUM("InvoicePaymentLines".amount::text::numeric), 0) AS total, "invoices".id
                    FROM "InvoicePaymentLines"
                    INNER JOIN "invoices" ON invoices.id = "InvoicePaymentLines"."invoiceId"
                    GROUP BY "invoices".id
                ),
                "appliedCredits" AS (
                    SELECT COALESCE(SUM("AppliedCredits".amount::text::numeric), 0) AS total, "invoices".id
                    FROM "AppliedCredits"
                    INNER JOIN "invoices" ON invoices.id = "AppliedCredits"."invoiceId"
                    GROUP BY "invoices".id
                ),
                "creditNotes" AS (
                    SELECT COALESCE(SUM("CreditNotes".total::text::numeric), 0) AS total, "invoices".id
                    FROM "CreditNotes"
                    INNER JOIN "invoices" ON invoices.id = "CreditNotes"."invoiceId"
                    GROUP BY "invoices".id
                ),
                "invoiceLines" AS (
                    SELECT COALESCE(SUM("InvoiceLines".qty::text::numeric), 0) AS total, "invoices".id
                    FROM "InvoiceLines"
                    INNER JOIN "invoices" ON invoices.id = "InvoiceLines"."invoiceId"
                    GROUP BY "invoices".id
                )
                
                UPDATE "Invoices" set "status" =  t."invoiceStatus"  from (
                 SELECT	
                           "invoices".id,
                       CASE
                        WHEN "invoices"."status" ='Draft' then 'Draft' 
                        WHEN "invoices"."onlineData"->>'onlineStatus' ='Rejected' then 'Closed'
                        WHEN "invoices"."status" ='writeOff' then 'writeOff'
                        WHEN "invoices"."mergeWith" is not null then 'merged' 
                        WHEN COALESCE("invoiceLines".total::text::numeric, 0) = 0 THEN 'Void'
                        WHEN  COALESCE("invoiceLines".total::text::numeric, 0) <>0 AND  COALESCE("invoices".total::text::numeric, 0) = 0 THEN 'Closed'
                        WHEN  COALESCE("creditNotes".total::text::numeric, 0) >0 and  COALESCE("creditNotes".total::text::numeric, 0) = COALESCE("invoices".total::text::numeric, 0) THEN 'Closed'
                        WHEN COALESCE("payments".total::text::numeric, 0) + COALESCE("appliedCredits".total::text::numeric, 0) <> 0 AND COALESCE("invoices".total::text::numeric, 0) > COALESCE("payments".total::text::numeric, 0) + COALESCE("appliedCredits".total::text::numeric, 0) + COALESCE("creditNotes".total::text::numeric, 0) THEN 'Partially Paid'
                        WHEN COALESCE("payments".total::text::numeric, 0) + COALESCE("appliedCredits".total::text::numeric, 0) <>0 and COALESCE("invoices".total::text::numeric, 0)  <> COALESCE("creditNotes".total::text::numeric, 0)  and COALESCE("invoices".total::text::numeric, 0) <= COALESCE("payments".total::text::numeric, 0) + COALESCE("appliedCredits".total::text::numeric, 0) + COALESCE("creditNotes".total::text::numeric, 0) THEN 'Paid'
                        ELSE 'Open'
                    END as "invoiceStatus"
                    FROM "invoices"
                    LEFT JOIN "invoiceLines" ON "invoices".id = "invoiceLines".id
                    LEFT JOIN "payments" ON "invoices".id = "payments".id
                    LEFT JOIN "creditNotes" ON "invoices".id = "creditNotes".id
                    LEFT JOIN "appliedCredits" ON "invoices".id = "appliedCredits".id
                )t 
                where "Invoices".id = t.id `,
                values: [invoiceIds]
            }
            await client.query(query.text, query.values);

        } catch (error: any) {


            throw new Error(error)

        }
    }


    public static async addFaildCreditNotes() {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const query = {
                text: `SELECT id, (JSONB_ARRAY_ELEMENTS("logs")->>'data' )::jsonb as "creditNote", "branchId","companyId" FROM "SocketLogs" where "dbTable"='CreditNotes'`

            }

            const data = await client.query(query.text)
            const deletedLogs: any[] = [];
            if (data && data.rows && data.rows.length > 0) {
                const creditNotes = data.rows
                for (let index = 0; index < creditNotes.length; index++) {
                    const element = creditNotes[index];
                    console.log(element)
                    const branchId = element.branchId;
                    const companyId = element.companyId;
                    const creditNote = new CreditNote();
                    creditNote.ParseJson(element.creditNote)
                    // creditNote.createdAt = TimeHelper.convertToDate(creditNote.createdAt);
                    // creditNote.creditNoteDate = TimeHelper.convertToDate(creditNote.creditNoteDate);

                    const isCreditNoteNumberExist = await SocketCreditNoteRepo.checkIscreditNoteNumberExist(client, null, creditNote.creditNoteNumber, companyId)
                    if (isCreditNoteNumberExist) {
                        creditNote.creditNoteNumber = 'D-' + creditNote.creditNoteNumber
                    }
                    const isCreditNoteIdExist = await SocketCreditNoteRepo.checkIfCreditNoteIdExist(client, creditNote.id, branchId)

                    if (isCreditNoteIdExist) {
                        await SocketCreditNoteRepo.editCreditNote(client, creditNote, companyId)
                    } else {
                        await SocketCreditNoteRepo.addCreditNote(client, creditNote, companyId)
                    }
                    deletedLogs.push(element.id)
                }

            }

            await client.query(`DELETE FROM "SocketLogs" where id = any($1)`, [deletedLogs])
            await client.query("COMMIT")
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    public static async addFaildCreditNoteRefund() {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const query = {
                text: `SELECT id, (JSONB_ARRAY_ELEMENTS("logs")->>'data')::jsonb  as "creditNoteRefund", "branchId","companyId" FROM "SocketLogs" where "dbTable"='Credit Note Refunds'`

            }

            const data = await client.query(query.text)
            const deletedLogs: any[] = [];
            if (data && data.rows && data.rows.length > 0) {
                const creditNoteRefunds = data.rows
                for (let index = 0; index < creditNoteRefunds.length; index++) {
                    const element = creditNoteRefunds[index];
                    const branchId = element.branchId;
                    const companyId = element.companyId;
                    const creditNoteRefund = new Refund();
                    creditNoteRefund.ParseJson(element.creditNoteRefund)
                    // creditNoteRefund.createdAt = TimeHelper.convertToDate(creditNoteRefund.createdAt);
                    // creditNoteRefund.refundDate = TimeHelper.convertToDate(creditNoteRefund.refundDate);
                    let checkCreditNoteIds = await SocketRefund.checkIfCreditNoteIdExist(client, [element.creditNoteId])


                    if (!checkCreditNoteIds) {
                        await SocketRefund.addRefund(client, creditNoteRefund, companyId)
                    }
                    deletedLogs.push(element.id)
                }

            }

            await client.query(`DELETE FROM "SocketLogs" where id = any($1)`, [deletedLogs])
            await client.query("COMMIT")
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    public static async tesssssstttttttt() {

        try {
            // Create a new workbook and add a worksheet
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sheet 1');

            // Define the list of values
            const listValues: any = ['Option 1', 'Option 2', 'Option 3'];
            const listString = listValues.join(',');
            // Add data validation to a cell (e.g., A1)
            const startRow = 2;
            const endRow = 100; // Maximum number of rows in Excel
            
            for (let rowNumber = startRow; rowNumber <= endRow; rowNumber++) {
                const cell = worksheet.getCell(`A${rowNumber}`);
                cell.dataValidation = {
                    type: 'list',
                    allowBlank: false,
                    formulae: [`"${listString}"`],
                };
            }
       

            // Save the workbook to a file
            
            return workbook
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }
}