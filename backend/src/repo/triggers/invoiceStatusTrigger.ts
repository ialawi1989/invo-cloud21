import { DB } from "@src/dbconnection/dbconnection";
import { PoolClient } from "pg";

import { WebPush } from "@src/Integrations/webPush";
import { InvoiceStatusUpdate } from "@src/controller/admin/InvoiceStatusUpdatedQueue";

export class InvoiceStatusTriggers {
    //TODO:
    /**
     * Tables:
     * Invoice  after add , update , delete  
     * InviocePayments after add ,edit , delete
     * Creditnotes after add ,edit , delete 
     * Applied Credits after add,edit,delete
     *  
     */


    /**
     * Only for transactions on invoice tabel 
     * NOTES: 
     * 1. when saving / editing invoices on socket (pos) check if mergewith id is not null set status to merged and dont call the event 
     * 2. also if edit and rejected dirctly set the status to closed no need to call the event 
     * 3. if draft no need to call event 
     * 4. when writeOff  
     * 
     * 
     * 
   */


    public static async updateInvoiceStatus(invoiceIds: any[]) {
        const client = await DB.excu.client(5 * 60)
        try {
            await client.query("BEGIN")
            const query2 = {
                text: `--sql 
                            
                                SELECT "Invoices".total, "Invoices".id ,"Invoices".status,"Invoices"."mergeWith","Invoices"."onlineData","source"
                                FROM "Invoices"
                                WHERE "Invoices".id = any($1)`,
                values: [invoiceIds]
            }
            const updatedInvoicesOld = await client.query(query2.text, query2.values);
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
                                            WHEN "invoices"."status" ='Draft' or ("invoices"."onlineData"->>'onlineStatus' ='Rejected' and  COALESCE("payments".total::text::numeric, 0) = 0  and COALESCE("invoiceLines".total::text::numeric, 0) <> 0 ) then 'Draft' 
                                            WHEN "invoices"."onlineData"->>'onlineStatus' ='Rejected' then 'Closed'
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
            if(updatedInvoices.rows  && updatedInvoices.rows.length > 0) {
                let queueInstance = InvoiceStatusUpdate.getInstance();
                queueInstance.createJob(updatedInvoices.rows);
            }
            await client.query("COMMIT")
        } catch (error: any) {
            await client.query("ROLLBACK")
      

            throw new Error(error)

        } finally {
            client.release()
        }
    }


    public static async getInvoiceIds(client: PoolClient, dbTable: string, idColumn: string, id: string) {
        try {
            const query = {
                text: `SELECT JSON_AGG("invoiceId") as "invoices" FROM ${dbTable} where ${idColumn} =$1`,
                values: [id]
            }

            let invoices = await client.query(query.text, query.values);

            return invoices.rows && invoices.rows.length > 0 ? invoices.rows : []
        } catch (error: any) {
          

            throw new Error(error)

        }
    }

    public static async afterDeleteInvoiceStatus(dbTable: string, id: string, dbColumn: string) {
        const client = await DB.excu.client()
        try {

            let invoices = await this.getInvoiceIds(client, dbTable, dbColumn, id)
            await client.query("BEGIN")
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
                values: [invoices]
            }
            await client.query(query.text, query.values);
            await client.query("COMMIT")
        } catch (error: any) {
            await client.query("ROLLBACK")
          
            throw new Error(error)

        } finally {
            client.release()
        }
    }

    public static async pushNotigications(invoiceIds: any[]) {
        try {

            let ids = invoiceIds.map(f => { return f.id })
            const query = {
                text: `
                    with "invoices" as 	(				   
                    select"Invoices".id, "branchId","Invoices"."subscriptionId","shopperId","Invoices"."onlineData"->>'onlineStatus' as "status" ,"Invoices"."onlineData"->>'rejectReason' as "reason" , "Invoices"."invoiceNumber" from "Invoices" 
                    where "Invoices".id = any($1))
                    
                    
                    select "invoices".*,
                    COALESCE("ShopperNotifications"."subscription","CompanyGuests"."subscription") as "subscription",
                          "Companies"."name" as "companyName",
                    "Media"."url"->>'defaultUrl' as "mediaUrl" 
                    from "invoices" 
                    inner join "Branches" on "Branches".id = "invoices"."branchId"
                    inner join "Companies" on "Companies".id = "Branches"."companyId"
                        left join "ShopperNotifications" ON "ShopperNotifications"."userId" = "invoices"."subscriptionId" and "ShopperNotifications"."companyId" = "Companies".id and "invoices"."shopperId" is not null 
                        left join "CompanyGuests" ON "CompanyGuests"."userId" = "invoices"."subscriptionId" and "CompanyGuests"."companyId" = "Companies".id and  "invoices"."shopperId" is  null
                        inner join "Media" on "Media".id = "Companies"."mediaId" 
                           where COALESCE("ShopperNotifications"."subscription","CompanyGuests"."subscription") is not null 
                      `,
                values: [ids]
            }

            let invoics = await DB.excu.query(query.text, query.values);
            let notification = new WebPush();
            for (let index = 0; index < invoics.rows.length; index++) {
                const element: any = invoics.rows[index];
                let invoiceStatus = invoiceIds.find(f => f.id = element.id)
                if (invoiceStatus) {

                    if (element.subscription) {
                        let rejectMesaage = element.reason ? `, Reject Reason  : ${element.reason} ` : ''
                        console.log(rejectMesaage)
                        let message = `Your Order Number# ${element.invoiceNumber} From ${element.companyName} has been ${element.status} ${rejectMesaage}`
                        switch (invoiceStatus.status) {
                            case 'Ready':
                                message = `Your Order Number# ${element.invoiceNumber} From ${element.companyName} is Ready`
                                break;
                            case 'Departure':
                                message = `Your Order Number# ${element.invoiceNumber} From ${element.companyName} is Out For Delivery`
                                break;
                            case 'Delivered':
                                message = `Your Order Number# ${element.invoiceNumber} From ${element.companyName} is Delivered`
                                break;
                            default:
                                message = `Your Order Number# ${element.invoiceNumber} From ${element.companyName} has been ${element.status} ${rejectMesaage}`
                                break;
                        }

                        notification.subscription = element.subscription;
                        notification.payload.body = message
                        notification.payload.icon = element.mediaUrl + '?width=256&height=256'
                        notification.payload.title = element.companyName

                        await notification.sendNotification()
                    }
                }


            }
        } catch (error: any) {
            console.log(error)
     

            throw new Error(error)

        }
    }


    public static async pushInvoicePaidNotifications(invoiceIds: any[]) {
        try {


            const query = {
                text: `with "invoices" as 	(				   
                    select"Invoices".id, "branchId","Invoices"."subscriptionId","shopperId","Invoices"."onlineData"->>'onlineStatus' as "status" ,"Invoices"."onlineData"->>'rejectReason' as "reason" , "Invoices"."invoiceNumber" from "Invoices" 
                    where "Invoices".id = any($1))
                    
                    
                    select "invoices".*,
                    COALESCE("ShopperNotifications"."subscription","CompanyGuests"."subscription") as "subscription",
                    "Companies"."name" as "companyName",
                    "Media"."url"->>'defaultUrl' as "mediaUrl" 
                    from "invoices" 
                    inner join "Branches" on "Branches".id = "invoices"."branchId"
                    inner join "Companies" on "Companies".id = "Branches"."companyId"
                        left join "ShopperNotifications" ON "ShopperNotifications"."userId" = "invoices"."subscriptionId" and "ShopperNotifications"."companyId" = "Companies".id and "invoices"."shopperId" is not null 
                        left join "CompanyGuests" ON "CompanyGuests"."userId" = "invoices"."subscriptionId" and "CompanyGuests"."companyId" = "Companies".id and  "invoices"."shopperId" is  null
                        inner join "Media" on "Media".id = "Companies"."mediaId" 
                        where COALESCE("ShopperNotifications"."subscription","CompanyGuests"."subscription") is not null 
                      `,
                values: [invoiceIds]
            }

            let invoics = await DB.excu.query(query.text, query.values);
            let notification = new WebPush();
            for (let index = 0; index < invoics.rows.length; index++) {
                const element: any = invoics.rows[index];


                console.log(element)
                notification.subscription = element.subscription
                let message = `Your Order From ${element.companyName} has been Paid Successfully`



                notification.payload.body = message
                notification.payload.icon = element.mediaUrl + '?width=256&height=256'
                notification.payload.title = element.companyName
                await notification.sendNotification()


            }

        } catch (error: any) {
            console.log(error)
  

            throw new Error(error)

        }
    }
}