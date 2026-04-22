import { Lazy } from "@src/utilts/Lazy";
import { AccountQueueWorker, QueueManagement } from "../queue";

import { InvoiceStatusUpdate } from "@src/controller/admin/InvoiceStatusUpdatedQueue";
import { DB } from "@src/dbconnection/dbconnection";
import { RedisClient } from "@src/redisClient";
import { ResponseData } from "@src/models/ResponseData";

export const purchaseOrderStatuesQueue = new Lazy<QueueManagement>(() => {
    return new QueueManagement("purchaseOrderStatus", "events", async (jobData) => {
        if (jobData.id) {
            //add timestamp to key to avoid overwriting in case of multiple jobs for same invoice
            return `purchaseOrderStatus:${jobData.id}:${Date.now()}`
        }
        return `purchaseOrderStatus:${Math.random().toString(36).substring(2, 15)}`;
    })
});


export const purchaseOrderStatuesWorker = async () => AccountQueueWorker("purchaseOrderStatus", async (job) => {
    try {
        let res = await PurchaseOrderJobs.updatePurchaseStatus([job.id])
        return res
    } catch (error: any) {
        throw new Error(error)
    }
});


export class PurchaseOrderJobs {

    public static async updatePurchaseStatus(ids: any[]) {
        try {

            await DB.excu.query(`
                            with "purchaseTotal" as(

                            select  "PurchaseOrderLines"."productId", "PurchaseOrderLines"."note", COALESCE(sum("PurchaseOrderLines"."qty"::text::numeric), 0) as "total"
                            from "PurchaseOrders"
                            inner join "PurchaseOrderLines" on "PurchaseOrderLines"."purchaseOrderId" = "PurchaseOrders".id 
                            where "PurchaseOrders".id = any($1)
							group by "PurchaseOrderLines"."productId", "PurchaseOrderLines"."note"
                            ),"bills" as(
                            select "BillingLines"."productId", "BillingLines"."note", COALESCE( sum("BillingLines"."qty"::text::numeric), 0)as "total"
                            from "Billings"
                            inner join "BillingLines" on "BillingLines"."billingId" = "Billings".id 
                            where "Billings"."purchaseOrderId" = any($1)
							group by "BillingLines"."productId", "BillingLines"."note"
                            ) , "status" as (
                            select case when COALESCE( sum("bills"."total"::text::numeric), 0) = 0 then 'Not Converted'
                                                                                when COALESCE( sum("purchaseTotal"."total"::text::numeric), 0)  - COALESCE( sum("bills"."total"::text::numeric), 0) > 0 then 'Partially Converted'
                                                                                else 'Fully Converted' end as "status" 
																				from "purchaseTotal"
																				left join "bills" on "bills"."productId" ="purchaseTotal"."productId" or ("bills"."note" is not null and "bills"."note"  <> '' and "bills"."note" = "purchaseTotal"."note"  )
 
                            )
                                        update "PurchaseOrders" set "status" = t."status" from (select * from "status")t 
                                                                    where "PurchaseOrders".id =  any($1)
                                        `,
                [ids]
            )

        } catch (error) {
            throw error
        }
    }
}