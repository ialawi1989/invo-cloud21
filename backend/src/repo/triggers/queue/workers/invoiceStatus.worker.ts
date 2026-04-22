import { Lazy } from "@src/utilts/Lazy";
import { AccountQueueWorker, QueueManagement } from "../queue";

import { InvoiceStatusUpdate } from "@src/controller/admin/InvoiceStatusUpdatedQueue";
import { DB } from "@src/dbconnection/dbconnection";
import { RedisClient } from "@src/redisClient";
import { ResponseData } from "@src/models/ResponseData";

export const InvoiceStatuesQueue = new Lazy<QueueManagement>(() => {
    return new QueueManagement("InvoiceStatus", "events", async (jobData) => {
        if (jobData.id) {
            //add timestamp to key to avoid overwriting in case of multiple jobs for same invoice
            return `InvoiceStatus:${jobData.id}:${Date.now()}`
        }
        return `InvoiceStatus:${Math.random().toString(36).substring(2, 15)}`;
    })
});


export const InvoiceStatuesWorker = async () => AccountQueueWorker("InvoiceStatus", async (job) => {
    try {
        let res = await InvoicePaymentStatus.updateInvoiceStatus([job.id])
        return res
    } catch (error: any) {
        throw new Error(error)
    }
});


export class InvoicePaymentStatus {
    public static async updateInvoiceStatus(invoiceIds: any[]) {
        const client = await DB.excu.client(5 * 60)
        let redis = RedisClient.getRedisClient();
        let key = `Pending-Updates:InvoiceStatus:${invoiceIds[0]}`;
        try {
            await client.query("BEGIN")
            // const query2 = {
            //     text: `--sql 

            //                         SELECT "Invoices".total, "Invoices".id ,"Invoices".status,"Invoices"."mergeWith","Invoices"."onlineData","source"
            //                         FROM "Invoices"
            //                         WHERE "Invoices".id = any($1)`,
            //     values: [invoiceIds]
            // }
            // const updatedInvoicesOld = await client.query(query2.text, query2.values);
            // await new Promise(resolve => setTimeout(resolve, 60000));
            const query = {
                text: `--sql 
                                WITH "invoices" AS (
                                    SELECT "Invoices".total, "Invoices".id ,"Invoices".status,"Invoices"."mergeWith","Invoices"."onlineData","source"
                                    FROM "Invoices"
                                    WHERE "Invoices".id = any($1)
                                ),
                                "payments" AS (
                                    SELECT COALESCE(SUM("InvoicePaymentLines".amount::text::numeric), 0) AS total, "invoices".id
                                    FROM "InvoicePaymentLines"
                                    INNER JOIN "invoices" ON invoices.id = "InvoicePaymentLines"."invoiceId"
                                    INNER JOIN "InvoicePayments" ON "InvoicePayments"."id" = "InvoicePaymentLines"."invoicePaymentId" and "InvoicePayments"."status" = 'SUCCESS'
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
                                ),"refunds" as (
                                    SELECT COALESCE(SUM("CreditNoteRefunds".total::text::numeric), 0) AS total, "invoices".id
                                    FROM "invoices"
                                    INNER JOIN "CreditNotes" ON invoices.id = "CreditNotes"."invoiceId"
                                    INNER JOIN "CreditNoteRefunds" ON "CreditNoteRefunds"."creditNoteId" = "CreditNotes"."id" 
                                    GROUP BY "invoices".id
                                )
                                    UPDATE "Invoices" set "status" =  t."invoiceStatus"  from (
                                        SELECT
                                            "invoices".id,"invoices"."status" AS "oldStatus",
                                               CASE
                                                WHEN "invoices"."status" ='Draft' or ("invoices"."onlineData"->>'onlineStatus' ='Rejected' and  COALESCE("payments".total::text::numeric, 0) = 0 and COALESCE("invoiceLines".total::text::numeric, 0) <> 0   ) then 'Draft' 
                                                WHEN  "invoices"."onlineData"->>'onlineStatus' ='Rejected' then 'Closed'
                                                WHEN "invoices"."status" ='writeOff' then 'writeOff'
                                                WHEN "invoices"."mergeWith" is not null then 'merged' 
                                                WHEN COALESCE("invoiceLines".total::text::numeric, 0) = 0 THEN 'Void'
                                                WHEN  COALESCE("invoiceLines".total::text::numeric, 0) <>0 AND  COALESCE("invoices".total::text::numeric, 0) = 0 THEN 'Closed'
                                                WHEN  COALESCE("creditNotes".total::text::numeric, 0) >0 and  COALESCE("creditNotes".total::text::numeric, 0) = COALESCE("invoices".total::text::numeric, 0) THEN 'Closed'
                                                WHEN COALESCE("payments".total::text::numeric, 0) + COALESCE("appliedCredits".total::text::numeric, 0) <> 0 AND( COALESCE("invoices".total::text::numeric, 0) - (COALESCE("payments".total::text::numeric, 0) + COALESCE("appliedCredits".total::text::numeric, 0) + COALESCE("creditNotes".total::text::numeric, 0) )) +  COALESCE("refunds".total::text::numeric, 0) >0 THEN 'Partially Paid'
                                                WHEN COALESCE("payments".total::text::numeric, 0) + COALESCE("appliedCredits".total::text::numeric, 0) <>0 AND( COALESCE("invoices".total::text::numeric, 0) - (COALESCE("payments".total::text::numeric, 0) + COALESCE("appliedCredits".total::text::numeric, 0) + COALESCE("creditNotes".total::text::numeric, 0) )) +  COALESCE("refunds".total::text::numeric, 0) <=0  THEN 'Paid'
                                                ELSE 'Open'
                                            END as "invoiceStatus"
                                        FROM "invoices"
                                        LEFT JOIN "invoiceLines" ON "invoices".id = "invoiceLines".id
                                        LEFT JOIN "payments" ON "invoices".id = "payments".id
                                        LEFT JOIN "creditNotes" ON "invoices".id = "creditNotes".id
                                        LEFT JOIN "appliedCredits" ON "invoices".id = "appliedCredits".id
                                        LEFT JOIN "refunds" ON "invoices".id = "refunds".id
                                    ) t 
                                    where "Invoices".id = t.id
                                    AND "Invoices"."status" IS DISTINCT FROM t."invoiceStatus"
                                    returning 
                                        "Invoices".id as "invoiceId",
                                        "Invoices"."companyId" AS "companyId",
                                        t."oldStatus"            AS "oldStatus",
                                        t."invoiceStatus"        AS "newStatus" `,
                values: [invoiceIds]
            }
            const updatedInvoices = await client.query(query.text, query.values);
            if (updatedInvoices.rows && updatedInvoices.rows.length > 0) {
                let queueInstance = InvoiceStatusUpdate.getInstance();
                queueInstance.createJob(updatedInvoices.rows);
            }
            // Check Redis for any pending updates for this invoice.
            // If a pending update exists, parse it and push a new job to the invoice status queue


            await client.query("COMMIT")
            let object: any = await redis.get(key);
            if (object) {
                object = JSON.parse(object)
                await redis.deletKey(key)
                return new ResponseData(true, "", { pendingUpdates: { type: 'updateInvoiceStatus', data: { id: invoiceIds } } })
            }
        } catch (error: any) {
            await client.query("ROLLBACK")
            /** delete the Pending-Updates:InvoicePayments because the  */
            await redis.deletKey(key)
       

            throw new Error(error)

        } finally {
            client.release()
        }
    }

}

