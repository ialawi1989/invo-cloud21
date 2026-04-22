import { DB } from "@src/dbconnection/dbconnection"

export class BillingStatusTrigger{
    public static async updateBillStatus(billId: any[]) {
        try {
            console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> billId: ", billId)
            const query={
                text :`WITH "billings" AS (
                    SELECT                    
	                  "Billings"."total"  AS total,
	                 "Billings".id ,"Billings".status
                    FROM "Billings"
	                inner join "BillingLines" on "BillingLines"."billingId" = "Billings".id
                    WHERE "Billings".id = any($1)
	                 group by   "Billings".id 
              ),
                "payments" AS (
                    SELECT COALESCE(SUM("BillingPaymentLines".amount::text::numeric), 0) AS total, "billings".id
                    FROM "billings"
                    INNER JOIN "BillingPaymentLines" ON "billings".id = "BillingPaymentLines"."billingId"
                    GROUP BY "billings".id
                ),
                "appliedCredits" AS (
                    SELECT COALESCE(SUM("SupplierAppliedCredits".amount::text::numeric), 0) AS total, "billings".id
                    FROM "billings"
                    INNER JOIN "SupplierAppliedCredits" ON billings.id = "SupplierAppliedCredits"."billingId"
                    GROUP BY "billings".id
                ),
                "creditNotes" AS (
                    SELECT COALESCE(SUM("SupplierCreditLines"."baseAmount"::text::numeric +  COALESCE("SupplierCreditLines"."taxTotal"::text::numeric,0)  -COALESCE("SupplierCreditLines"."discountTotal"::text::numeric,0) - COALESCE("SupplierCreditLines"."supplierCreditDiscount"::text::numeric,0)), 0)  AS total, "billings".id
                    FROM "billings"
					inner join "BillingLines" on "BillingLines"."billingId" = "billings".id
                         INNER JOIN "SupplierCreditLines" ON "BillingLines"."id" = "SupplierCreditLines"."billingLineId"
                    GROUP BY "billings".id
                ),"refunds" as (
				      SELECT COALESCE(SUM("SupplierRefunds".total::text::numeric), 0) AS total, "billings".id
                    FROM "billings"
                    INNER JOIN "SupplierCredits" ON billings.id = "SupplierCredits"."billingId"
                    INNER JOIN "SupplierRefunds" ON "SupplierRefunds"."supplierCreditId" = "SupplierCredits"."id" 
                    GROUP BY "billings".id
				),"supplierCreditRounding" as (
				  select "billings".id, COALESCE(sum("SupplierCredits"."roundingTotal"),0) as "total" from "billings"
				  inner join "SupplierCredits" on "SupplierCredits"."billingId" = "billings".id 
				  group by "billings".id
				)
                
               UPDATE "Billings" set "status" =  t."billingStatus"  from (
                 SELECT	
                           "billings".id,
                       CASE
                        WHEN "billings"."status" ='Draft' then 'Draft' 
                   
                        WHEN  COALESCE("creditNotes".total::text::numeric, 0) >0 and  COALESCE("creditNotes".total::text::numeric, 0) = COALESCE("billings".total::text::numeric, 0) THEN 'Closed'
                        WHEN COALESCE("payments".total::text::numeric, 0) + COALESCE("appliedCredits".total::text::numeric, 0) <> 0 AND( COALESCE("billings".total::text::numeric, 0) - (COALESCE("payments".total::text::numeric, 0) + COALESCE("appliedCredits".total::text::numeric, 0) + ( COALESCE("creditNotes".total::text::numeric, 0) + COALESCE("supplierCreditRounding".total::text::numeric, 0)) )) +  COALESCE("refunds".total::text::numeric, 0) >0 THEN 'Partially Paid'
                        WHEN COALESCE("payments".total::text::numeric, 0) + COALESCE("appliedCredits".total::text::numeric, 0) <>0 AND( COALESCE("billings".total::text::numeric, 0) - (COALESCE("payments".total::text::numeric, 0) + COALESCE("appliedCredits".total::text::numeric, 0) +( COALESCE("creditNotes".total::text::numeric, 0) + COALESCE("supplierCreditRounding".total::text::numeric, 0)))) +  COALESCE("refunds".total::text::numeric, 0) <=0  THEN 'Paid'
                        ELSE 'Open'
                    END as "billingStatus"
                    FROM "billings"
                    LEFT JOIN "payments" ON "billings".id = "payments".id
                    LEFT JOIN "creditNotes" ON "billings".id = "creditNotes".id
                    LEFT JOIN "appliedCredits" ON "billings".id = "appliedCredits".id
                    LEFT JOIN "refunds" ON "billings".id = "refunds".id
					LEFT JOIN "supplierCreditRounding" ON "billings".id = "supplierCreditRounding".id
                )t 
                where "Billings".id = t.id`,
                values :[billId]
            }

            await DB.excu.query(query.text,query.values)
            return 
        } catch (error:any) {
            throw new Error(error)
        }
    }

}