import { DB } from "@src/dbconnection/dbconnection";
import { PoolClient } from "pg";
import { InvoiceStatusTriggers } from "./invoiceStatusTrigger";


import { ResponseData } from "@src/models/ResponseData";
import { UnbalancedJournalError } from "@src/utilts/Exception";
import { Helper } from "@src/utilts/helper";
import Decimal from 'decimal.js';
import { InvoiceRepo } from "../app/accounts/invoice.repo";
import { SurchargeRepo } from "../app/accounts/surcharge.repo";
import { TaxDetails } from "@src/models/account/Invoice";
import { Company } from "@src/models/admin/company";
import { TriggerQueue } from "./triggerQueue";
import { CompanyRepo } from "../admin/company.repo";
import { InvoiceStatuesQueue } from "./queue/workers/invoiceStatus.worker";
export class JournalModel {
    accountId = "";
    accountName = "";
    total = 0;
    referenceId = ""
    journalDate = new Date();
    branchId = "";
    companyId = "";
    dbTable = "";
    code = "";
    salesEmployeeId: string | null;
    chargeId: string | null;
    userId: string | null;
    userName: string | null;
    userType: string | null;
    id = ""
    lineId: string | null;
    constructor() {
        this.userId = null;
        this.userName = null;
        this.userType = null;
        this.salesEmployeeId = null;
        this.chargeId = null;
        this.lineId = null;
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}
export class JournalTriggers {
    /**Tables 
      OpeningBalanceAdjusments 
      OpeningBalanceView

    * 
    */

    /** Invoice Journal */
    /**
     * 
     * @param client 
     * @param referenceId 
     * !!!!!!!!! NOTE : - Only the jouurnal of open invoices will be inserted in JournalRecords table 
     * !!!!!!!!! NOTE : - Only the jouurnal of open invoices will be inserted in JournalRecords table 
     *        - Ecommerce Invoices : when invoice is rejected and has no payment dont inserted in invoice jounrnal 
     *        
     */


    public static getCurrencyDecimalPlaces(country: string): number {
        const countryDecimalMap: Record<string, number> = {
            'Bahrain': 3,        // Bahraini Dinar (BHD)
            'Canada': 2,         // Canadian Dollar (CAD)
            'Egypt': 2,          // Egyptian Pound (EGP)
            'Iraq': 0,           // Iraqi Dinar (IQD)
            'Jordan': 3,         // Jordanian Dinar (JOD)
            'Kuwait': 3,         // Kuwaiti Dinar (KWD)
            'Oman': 3,           // Omani Rial (OMR)
            'Portugal': 2,       // Euro (EUR)
            'Qatar': 2,          // Qatari Riyal (QAR)
            'Saudi Arabia': 2,   // Saudi Riyal (SAR)
            'UAE': 2             // UAE Dirham (AED)
        };

        return countryDecimalMap[country] ?? 2; // Default to 2 if country not found
    }
    public static async validateJournalBalance(client: PoolClient, journalList: JournalModel[], companyId: string) {
        try {
            let query = {
                text: `SELECT "country" from "Companies" where id = $1`,
                values: [companyId]
            }

            let company = await client.query(query.text, query.values);
            let country = company.rows && company.rows.length > 0 ? company.rows[0].country : 'Bahrain'
            const allowedPrecision = this.getCurrencyDecimalPlaces(country) ?? 2;

            let total = journalList.reduce((sum: Decimal, entry: any) => {
                return sum.plus(new Decimal(entry.total));
            }, new Decimal(0));
            const EPSILON = new Decimal(1).dividedBy(new Decimal(10).pow(allowedPrecision + 1))
            total = total.toDecimalPlaces(10);
            console.log('EPSILON as string:', EPSILON.toString())
            console.log('total as string:', total.toString())
            if (total.abs().greaterThan(EPSILON)) {
                throw new UnbalancedJournalError(`Journal is unbalanced. Total amount: ${total}`);
            }
        } catch (error: any) {
            throw new Error(error)
        }

    }

    public static async imbalanceJournal() {
        try {
            /**
 * with "journals" as (
select "name","referenceId","dbTable",sum("amount"::text::numeric ) as "total" from "JournalRecords"
where "companyId" = '05031229-a8b0-470c-90e7-7a24d26fa40c'
and (null is null or "createdAt" >= null)
and "createdAt" < current_timestamp
and  ( "name" <>  'Costs Of Goods Sold' or "dbTable" not in ( 'Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment'))
and  ( "name" <>   'Inventory Assets'  or "dbTable" not in ('Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment'))
group by  "name", "referenceId","dbTable"
), "movment" as (
select "transactionId" as "referenceId" ,"referenceTable" as "dbTable",sum("qty"::text::numeric * "cost"::text::numeric ) as "total" from "InventoryMovmentRecords"
where "companyId" = '05031229-a8b0-470c-90e7-7a24d26fa40c'
and (null is null or "createdAt" >= null)
and "createdAt" < current_timestamp 
and  "referenceTable"  not in ('Supplier Credit','Billing')
group by "transactionId", "referenceTable"
),"costOfGoodSolds" as (
select 'Costs Of Goods Sold' as "name", "referenceId", "dbTable" , "total" *  -1  from "movment"
where  "dbTable"  not in ('Opening Balance')	
),"inventoryAssets" as (
select 'Inventory Assets' as "name", "referenceId", "dbTable" , "total"   from "movment"
), "all" as(
select * from "journals"
union all 
select * from "costOfGoodSolds"
union all 
select * from "inventoryAssets"
), "test" as (
select  sum("total"::text::numeric(16,3))as"net" , sum(case when "total" < 0 then abs("total"::text::numeric(16,3)) end) as "credit" , sum(case when "total" > 0 then "total"::text::numeric(16,3) end) as "debit" from "all"

), "k" as (
select "referenceId","dbTable" , sum("total"::text::numeric(16,3))as "total"  from "all"
where "dbTable" <> 'Opening Balance'
group by "referenceId" ,"dbTable"
    having  sum("total"::text::numeric(16,3)) <> 0
)

select * from "test" 

 */

            /**
             * with  "inventoryOprningBalance" as (
            select 'Inventory Assets' as "accountName",sum("qty"::text::numeric * "cost"::text::numeric ) as "total" ,"branchId" from "InventoryMovmentRecords"
            where "companyId" = 'e0f47ac0-1e58-49f5-9923-954d29fd7286'
            and (null is null or "createdAt" >= null)
            and "createdAt" < '2025-07-30 21:00:00'
            and  "referenceTable"   in ('Opening Balance')
            group by "branchId" 
            ), "otherAccounts" as (
            select "name" as "accountName" ,"amount" as "total","branchId" from "JournalRecords" 
            where "companyId" = 'e0f47ac0-1e58-49f5-9923-954d29fd7286'
            and (null is null or "createdAt" >= null)
            and "createdAt" < '2025-07-30 21:00:00'
            and  "dbTable"   in ('Opening Balance')
            and "name" not in ('Inventory Assets')
            ),"all" as(
            select * from "inventoryOprningBalance"
            union all 
            select * from "otherAccounts"
            	
            )
            
            select sum(case when "accountName" = 'Opening Balance Adjusment' then "total" end) , sum(case when "accountName" <> 'Opening Balance Adjusment' then "total" end)   from "all"
            
             */
        } catch (error) {

        }
    }



    public static getJionAndColumns(client: PoolClient, dbTable: string) {
        const joins: Record<string, string> = {
            Invoices: `inner join "Customers" on "Customers"."companyId"=$2 and "Customers".id = "Invoices"."customerId"`,
            CreditNotes: `Inner JOIN "Invoices" on "Invoices"."companyId" = $2 and "Invoices"."id"= "CreditNotes"."invoiceId"
                          inner join "Customers" on "Customers"."companyId"=$2 and "Customers".id = "Invoices"."customerId"
                          `,
            InvoicePayments: `inner join "Customers" on "Customers"."companyId"=$2 and "Customers".id = "InvoicePayments"."customerId"`,
            CreditNoteRefunds: `Inner JOIN "CreditNotes" on "CreditNotes"."companyId" = $2 and "CreditNotes".id = "CreditNoteRefunds"."creditNoteId"
                                Inner JOIN "Invoices" on "Invoices"."companyId" = $2 and "Invoices"."id"= "CreditNotes"."invoiceId"
                                inner join "Customers" on "Customers"."companyId"=$2 and "Customers".id = "Invoices"."customerId"`,
            AppliedCredits: `Inner JOIN "Invoices" on "Invoices"."companyId" = $2 and "Invoices"."id"= "AppliedCredits"."invoiceId"
                            inner join "Customers" on "Customers"."companyId"=$2 and "Customers".id = "Invoices"."customerId"`,



            Billings: `INNER JOIN "Suppliers"on "Suppliers"."companyId" = $2 and "Suppliers".id = "Billings"."supplierId"`,
            BillingPayments: `INNER JOIN "Suppliers"on "Suppliers"."companyId" = $2 and "Suppliers".id = "BillingPayments"."supplierId" `,
            SupplierCredits: `Inner Join "Billings" on "Billings"."companyId" = $2 and  "Billings"."id" =  "SupplierCredits"."billingId"
                             INNER JOIN "Suppliers"on "Suppliers"."companyId" = $2 and "Suppliers".id = "Billings"."supplierId"`,
            BillOfEntries: `Inner Join "Billings" on "Billings"."companyId" = $2 and   "Billings"."id" =  "BillOfEntries"."billingId"
                             INNER JOIN "Suppliers"on "Suppliers"."companyId" = $2 and "Suppliers".id = "Billings"."supplierId"`,
            SupplierRefunds: ` INNER JOIN "SupplierCredits" on "SupplierCredits"."id" = "SupplierRefunds"."supplierCreditId" 
                               Inner Join "Billings" on "Billings"."companyId" = $2 and   "Billings"."id" =  "SupplierCredits"."billingId"
                               INNER JOIN "Suppliers"on "Suppliers"."companyId" = $2 and "Suppliers".id = "Billings"."supplierId"
            `,
            SupplierAppliedCredits: `Inner Join "Billings" on  "Billings"."companyId" = $2 and   "Billings"."id" =  "SupplierAppliedCredits"."billingId"
                                     INNER JOIN "Suppliers"on "Suppliers"."companyId" = $2 and "Suppliers".id = "Billings"."supplierId"`,
        };
        const userColumnMap: Record<string, string> = {
            Invoices: ' "Customers".id , "Customers"."name" ',
            CreditNotes: ' "Customers".id , "Customers"."name" ',
            InvoicePayments: ' "Customers".id , "Customers"."name" ',
            CreditNoteRefunds: ' "Customers".id , "Customers"."name" ',
            AppliedCredits: ' "Customers".id , "Customers"."name" ',

            BillingPayments: ' "Suppliers".id , "Suppliers"."name" ',
            Billings: ' "Suppliers".id , "Suppliers"."name" ',
            SupplierCredits: ' "Suppliers".id , "Suppliers"."name" ',
            BillOfEntries: ' "Suppliers".id , "Suppliers"."name" ',
            SupplierRefunds: ' "Suppliers".id , "Suppliers"."name" ',
            SupplierAppliedCredits: ' "Suppliers".id , "Suppliers"."name" ',

        };


        return { joins: joins[dbTable] || null, column: userColumnMap[dbTable] }
    }
    public static async getUser(client: PoolClient, dbTable: string, userType: string, id: string, companyId: string) {
        try {

            /** THE FOLLOWING FUNCTION WILL RETURN THE USER INFO NAME , ID BASE ON TABLE 
             * WHY SAVING THE USER IN JournalRecords ? -> OTHER WISE WE WILL NEED TO JOIN EVEREY JOURNAL WITH THE USER TABLE [CUSTOMER,SUPPLIER]
             * WHY SAVING THE USER IN JournalRecords ? -> OTHER WISE WE WILL NEED TO JOIN EVEREY JOURNAL WITH THE USER TABLE [CUSTOMER,SUPPLIER]
             * IN ORDER TO GET THE NAME AND ID OF THE USER IN REPORTS AND ACCOUNT JOURNALS 
             * 
             * USER TYPE -> IS SAVED FOR THE FRONT TO DIFFERENTIATE BETWEEN CUSTOMER AND SUPPLIER ON REDIRECTING USER    
             */
            let JoinData = this.getJionAndColumns(client, dbTable)

            let selectQuery = `SELECT ${JoinData.column}
                               from "${dbTable}"
                               ${JoinData.joins}
                               where "${dbTable}"."id" = $1 
                               `

            console.log(selectQuery)
            let user = await client.query(selectQuery, [id, companyId]);
            let usertemp = user.rows && user.rows.length > 0 ? user.rows[0] : null
            const userData = {
                id: "",
                name: "",
                type: userType == 'Customers' ? 'Customer' : 'Supplier'
            }
            userData.id = usertemp ? usertemp.id : "";
            userData.name = usertemp ? usertemp.name : "";


            return usertemp != null ? userData : null
        } catch (error: any) {
   

            throw new Error(error)
        }
    }


    /**Invoice Jounral */
    public static async invoiceJournal(invoiceIds: any[], companyId: string) {
        const client = await DB.excu.client(500);
        try {
            await client.query("BEGIN")
            for (let index = 0; index < invoiceIds.length; index++) {
                const invoiceId = invoiceIds[index];
                let customer = await this.getUser(client, "Invoices", "Customers", invoiceId, companyId)
                /**
                 * ACCOUNTS:
                 * - SALES : SAVED IN INVOICELINE -> "CREDIT" (SUBTOTAL) OR WHEN ISINCLUSIVETAX -> (SUBTOTAL-TAXTOTAL) , INCLUSIVE TAX : MEANS THE PRICE OF PRODUCT INCLUDE THE TAX
                 * - COGS : "DEBIT" (LINES RECIPE)
                 * - INVENTORY ASSETS : "CREDIT" (LINES RECIPE)
                 * - RECEIVABLE -> "DEBIT" (NOTE THAT RECEIVABLE HAS TWO QUERIES WHERE LINES ARE IN THE SAME DATE AS INVOICE DATE AND OTHER FOR LINES WITH DIFFERENT DATE.
                 *                        IN THE QUERY USED FOR THE LINES THAT ARE PLACED ON THE SAME DATE OF INVOICE THE DISCOUNT AND CHARGES  APPLIED  ON INVOICE TOTAL IS ADDED TO THE TOTAL RECEIVABLE (IN JOURNAL)
                 *                        WERE FOR THE LINES PLACED IN A DIFFERENT DATE ONLY THE LINE TOTAL WILL BE RETURN ) (WHY NOT USING THE INVOICE TOTAL ? -> CAUSE WE NEED THE SALE TO BE AFFECTED ACCORDINGLY TO THE LINE DATE)
                 * - OUTPUT VAT: "CREDIT" -> IS GROUPED BY DATE (NOTICE THAT IN THE QUERY IF THE DATE OF INVOICELINE IS SIMILAR TO THE DATE OF INVOICE THE INVOICEDATE IS SELECTED ELSE THE LINE DATE IS SELECTED) 
                 *              BECAUSE THE JOURNAL OF THE WHOLE LINE WILL BE HOLD IN A DIFFERENT DATE 
                 * - CHARGES INCOME : "CREDIT" -> IS GROUPED BY DATE (NOTICE THAT IN THE QUERY IF THE DATE OF INVOICELINE IS SIMILAR TO THE DATE OF INVOICE THE INVOICEDATE IS SELECTED ELSE THE LINE DATE IS SELECTED) 
                 *                   BECAUSE THE JOURNAL OF THE WHOLE LINE WILL BE HOLD IN A DIFFERENT DATE 
                 * - DELIVERY CHARGE : "CREDIT" -> IS GROUPED BY DATE (NOTICE THAT IN THE QUERY IF THE DATE OF INVOICELINE IS SIMILAR TO THE DATE OF INVOICE THE INVOICEDATE IS SELECTED ELSE THE LINE DATE IS SELECTED) 
                 *                   BECAUSE THE JOURNAL OF THE WHOLE LINE WILL BE HOLD IN A DIFFERENT DATE 
                 * - DISCOUNT : "DEBIT" ->  TWO QUERIES (IN PREVIOUS VERSION A DISCOUNT IS ALLOWED TO BE APPLIED IN THE TOTAL INVOICE IS HAVE TO BE ADDED TO THE WHOLE INVOICE DISCOUNT INCLUDING THE DISCOUNT LINE) 
                 *               IN THIS CASE THE SUM OF DISCOUNT FOR THE LINES HAVING SAME DATE AS INVOICE + DISCOUNTTOTAL OF INVOICE.
                 * - COMMISSION EXPENSE : "DEBIT"
                 * - COMMISSION LIABILITIES : "CREDIT"
                 */
                const query = {
                    text: `
               
                   with "values" as (
                        select  $1::uuid as "invoiceId" ,
                                 $2::uuid as "companyId" 
                           ), "Journals" as (
                        select 
                             null::text as "id",
                             sum("InvoiceLines"."total"::text::numeric)    as "total",
                            case when "InvoiceLines"."createdAt"::date = "Invoices"."invoiceDate" then ("Invoices"."invoiceDate" + "Invoices"."createdAt"::time) else "InvoiceLines"."createdAt" end     as "journalDate",
                             "Accounts".name  as "accountName",
                             "Accounts".id  as "accountId",
                             "Invoices".id as "referenceId" ,
                             "Invoices"."invoiceNumber",
                             "Invoices"."branchId",
                            
                              null::uuid as  "chargeId",
                              "Invoices"."invoiceNumber" as "code"
                             from "InvoiceLines" 
                             JOIN "values" on true
                        inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" 
                        inner join "Accounts" on "Accounts"."companyId" =  "values"."companyId" AND (( "Invoices"."receivableAccountId" is not null and  "Accounts".id = "Invoices"."receivableAccountId") OR  (  "Invoices"."receivableAccountId" is null and "Accounts".name::text = 'Account Receivable'::text AND "Accounts".type::text = 'Account Receivable'::text AND "Accounts"."default" = true))  
                        where "InvoiceLines"."invoiceId" = "values"."invoiceId"
                        AND "Invoices"."status" <> 'Draft' AND "Invoices"."status" <> 'merged'
                        group by "journalDate" , "Accounts".id,"Invoices"."id" ,"InvoiceLines"."createdAt"::date 
                        UNION ALL
                        
                        

                        select 
                            null::text as "id",
                      COALESCE("Invoices"."deliveryCharge"::text::numeric,0) +  COALESCE("Invoices"."roundingTotal"::text::numeric,0) +  COALESCE("Invoices"."chargeTotal"::text::numeric,0) - COALESCE("Invoices"."discountTotal"::text::numeric,0)  + case when "Invoices"."isInclusiveTax" then 0 else  + COALESCE(("Invoices"."chargesTaxDetails"->>'taxAmount')::numeric,0)  end as "total",
                        ("Invoices"."invoiceDate" + "Invoices"."createdAt"::time)   as "journalDate",
                         "Accounts".name  as "accountName",
                         "Accounts".id  as "accountId",
                         "Invoices".id as "referenceId" ,
                         "Invoices"."invoiceNumber",
                         "Invoices"."branchId",
                          null::uuid as  "chargeId",
                          "Invoices"."invoiceNumber" as "code"
                         from "Invoices" 
                         JOIN "values" on true
                        inner join "Accounts" on "Accounts"."companyId" =  "values"."companyId" AND (( "Invoices"."receivableAccountId" is not null and  "Accounts".id = "Invoices"."receivableAccountId") OR  (  "Invoices"."receivableAccountId" is null and "Accounts".name::text = 'Account Receivable'::text AND "Accounts".type::text = 'Account Receivable'::text AND "Accounts"."default" = true))  
                      AND "Invoices"."status" <> 'Draft' AND "Invoices"."status" <> 'merged'
					  and "Invoices".id = "values"."invoiceId"		
                    group by "journalDate" , "Accounts".id,"Invoices"."id"
    
                        union all
                        select 
                            null::text as "id",
                            case when "Invoices"."isInclusiveTax" then  sum( "InvoiceLines"."subTotal"::text::numeric - "InvoiceLines"."taxTotal"::text::numeric)  else sum("InvoiceLines"."subTotal"::text::numeric  )  end  *(-1) as "total",
                            case when   "InvoiceLines"."createdAt"::date = "Invoices"."invoiceDate" then ("Invoices"."invoiceDate" + "Invoices"."createdAt"::time) else    "InvoiceLines"."createdAt" end   as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "Invoices".id as "referenceId",
                            "Invoices"."invoiceNumber",
                            "Invoices"."branchId",
                            null::uuid as  "chargeId",
                            "Invoices"."invoiceNumber" as "code"
                            from "InvoiceLines" 
                        JOIN "values" on true
                        inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" 
                        inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND "Accounts".id = "InvoiceLines"."accountId" 
                        where "InvoiceLines" ."invoiceId" = "values"."invoiceId"
                               AND "Invoices"."status" <> 'Draft' AND "Invoices"."status" <> 'merged'
                        group by "journalDate" , "Accounts".id,"Invoices"."id"
                        
                        union all 
                        select 
                            null::text as "id",
                           ( sum("InvoiceLines"."taxTotal"::text::numeric) )*(-1) as "total",
                            case when   "InvoiceLines"."createdAt"::date = "Invoices"."invoiceDate" then ("Invoices"."invoiceDate" + "Invoices"."createdAt"::time) else    "InvoiceLines"."createdAt" end   as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "Invoices".id as "referenceId",
                            "Invoices"."invoiceNumber",
                            "Invoices"."branchId",
                            null::uuid as  "chargeId",
                            "Invoices"."invoiceNumber" as "code"
                            from "InvoiceLines" 
                        JOIN "values" on true
                        inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" 
                        inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND  "Accounts".name::text = 'Output Vat'::text AND "Accounts"."default" = true
                        where "InvoiceLines" ."invoiceId" = "values"."invoiceId"
                                AND "Invoices"."status" <> 'Draft' AND "Invoices"."status" <> 'merged'
                        group by "journalDate" , "Accounts".id,"Invoices"."id"
                        union all 
                        select 
                            null::text as "id",
                           (  COALESCE(("Invoices"."chargesTaxDetails"->>'taxAmount')::text::numeric,0) )*(-1) as "total",
                           ("Invoices"."invoiceDate" + "Invoices"."createdAt"::time)   as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "Invoices".id as "referenceId",
                            "Invoices"."invoiceNumber",
                            "Invoices"."branchId",
                            null::uuid as  "chargeId",
                            "Invoices"."invoiceNumber" as "code"
                            from "Invoices" 
                        JOIN "values" on true
                        inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND  "Accounts".name::text = 'Output Vat'::text AND "Accounts"."default" = true
                         where "Invoices" ."id" = "values"."invoiceId"
                                AND "Invoices"."status" <> 'Draft' AND "Invoices"."status" <> 'merged'
                        group by "journalDate" , "Accounts".id,"Invoices"."id"
                        union all 
                        select 
                            null::text as "id",
                           case when  "Invoices"."isInclusiveTax" then  (sum("Invoices"."chargeTotal"::text::numeric)  -   COALESCE(("Invoices"."chargesTaxDetails"->>'taxAmount')::numeric,0)) else sum("Invoices"."chargeTotal"::text::numeric)  end *(-1) as "total",
                            ("Invoices"."invoiceDate" + "Invoices"."createdAt"::time)  as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "Invoices".id as "referenceId",
                            "Invoices"."invoiceNumber",
                            "Invoices"."branchId",
                            "Invoices"."chargeId"::uuid as  "chargeId",
                            "Invoices"."invoiceNumber" as "code"
                        from "Invoices"
                        JOIN "values" on true
                        inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND   "Accounts".type::text = 'Charges Income'::text AND "Accounts"."default" = true
                        where "Invoices".id = "values"."invoiceId"
                        and "Invoices"."chargeTotal" <>0
                             AND "Invoices"."status" <> 'Draft' AND "Invoices"."status" <> 'merged'
                        group by "journalDate" , "Accounts".id,"Invoices"."id"
                        
                        union all 
                        select 
                            null::text as "id",
                            sum("Invoices"."deliveryCharge"::text::numeric) *(-1) as "total",
                          ("Invoices"."invoiceDate" + "Invoices"."createdAt"::time)   as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "Invoices".id as "referenceId",
                            "Invoices"."invoiceNumber",
                            "Invoices"."branchId",
                            null::uuid as  "chargeId",
                            "Invoices"."invoiceNumber" as "code"
                        from "Invoices"
                        JOIN "values" on true
                        inner join "Accounts" on "Accounts"."companyId" ="values"."companyId"  AND "Accounts".type::text = 'Delivery Charge'::text AND "Accounts"."default" = true
                        where  "Invoices".id = "values"."invoiceId"
                        and "Invoices"."deliveryCharge" <>0
                               AND "Invoices"."status" <> 'Draft' AND "Invoices"."status" <> 'merged'
                        group by "journalDate" , "Accounts".id,"Invoices"."id"
                        
                        union all 
                        select 
                            null::text as "id",
                            sum("InvoiceLines"."discountTotal"::text::numeric)  as "total",
                          case when "InvoiceLines"."createdAt"::date = "Invoices"."invoiceDate" then ("Invoices"."invoiceDate" + "Invoices"."createdAt"::time) else "InvoiceLines"."createdAt" end  as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "Invoices".id as "referenceId",
                            "Invoices"."invoiceNumber",
                            "Invoices"."branchId",
                            null::uuid as  "chargeId",
                            "Invoices"."invoiceNumber" as "code"
                        from "Invoices" 
                        JOIN "values" on true
                        inner join "InvoiceLines" on "Invoices".id = "InvoiceLines"."invoiceId" 
                        inner join "Accounts" on "Accounts"."companyId" ="values"."companyId" AND "Accounts".type::text = 'Discount'::text AND "Accounts"."default" = true
                        where  "Invoices".id ="values"."invoiceId"
                        and "InvoiceLines"."discountTotal" <>0
                              AND "Invoices"."status" <> 'Draft' AND "Invoices"."status" <> 'merged'
                        group by "journalDate" , "Accounts".id,"Invoices"."id"
                        
                      
                     
                        union all 
                        select 
                            null::text as "id",
                            sum("Invoices"."roundingTotal"::text::numeric) *(-1) as "total",
                             ("Invoices"."invoiceDate" + "Invoices"."createdAt"::time)   as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "Invoices".id as "referenceId",
                            "Invoices"."invoiceNumber",
                            "Invoices"."branchId",
                            null::uuid as  "chargeId",
                            "Invoices"."invoiceNumber" as "code"
                        from "Invoices"
                        JOIN "values" on true
                        inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Rounding'::text AND "Accounts"."default" = true
                        where  "Invoices".id = "values"."invoiceId"
                        and "Invoices"."roundingTotal" <>0
                             AND "Invoices"."status" <> 'Draft' AND "Invoices"."status" <> 'merged'
                        group by "journalDate" , "Accounts".id,"Invoices"."id"
                                        
                        union all 
                        select 
                            null::text as "id",
                            sum("InvoiceLines"."commissionTotal"::text::numeric)  as "total",
                            case when   "InvoiceLines"."createdAt"::date = "Invoices"."invoiceDate" then ("Invoices"."invoiceDate" + "Invoices"."createdAt"::time)  else    "InvoiceLines"."createdAt" end   as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "Invoices".id as "referenceId",
                            "Invoices"."invoiceNumber",
                            "Invoices"."branchId",
                         
                            null::uuid as  "chargeId",
                            "Invoices"."invoiceNumber" as "code"
                        from "InvoiceLines"
                        JOIN "values" on true
                        inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" 
                        inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Commission Expense'::text AND "Accounts"."default" = true
                        where "InvoiceLines"."invoiceId" = "values"."invoiceId"
                        and "commissionTotal" <> 0 
                               AND "Invoices"."status" <> 'Draft' AND "Invoices"."status" <> 'merged'
                        group by "journalDate" , "Accounts".id,"Invoices"."id"
                        
                        union all 
                        select 
                            null::text as "id",
                            sum("InvoiceLines"."commissionTotal"::text::numeric) *(-1)  as "total",
                            case when   "InvoiceLines"."createdAt"::date = "Invoices"."invoiceDate" then ("Invoices"."invoiceDate" + "Invoices"."createdAt"::time)  else    "InvoiceLines"."createdAt" end   as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "Invoices".id as "referenceId",
                            "Invoices"."invoiceNumber",
                            "Invoices"."branchId",
                          
                             null::uuid as  "chargeId",
                             "Invoices"."invoiceNumber" as "code"
                        from "InvoiceLines" 
                        JOIN "values" on true
                        inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" 
                        inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Commission Liabilities'::text AND "Accounts"."default" = true
                        where "InvoiceLines"."invoiceId" = "values"."invoiceId"
                        and "commissionTotal" <> 0 
                             AND "Invoices"."status" <> 'Draft' AND "Invoices"."status" <> 'merged'
                        group by "journalDate" , "Accounts".id,"Invoices"."id"
                                        
        
                         )
                          select *  from "Journals"
                          	where "total" <> 0  `,
                    values: [invoiceId, companyId]
                }

                let journal = await client.query(query.text, query.values);
                const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
                await this.validateJournalBalance(client, journals, companyId);
                await this.deleteJournals(client, [invoiceId])
                await this.saveJournal(client, journals, 'Invoice', customer, companyId);
            }

            await client.query("COMMIT")
        } catch (error: any) {
            console.log(error)
        
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async writeOffinvoiceJournal(invoiceId: string, companyId: string) {
        const client = await DB.excu.client(500);
        try {
            /**
             * WHAT IS WRITEOFF ? IS WHEN INVOICE IS NOT SATTELED (NOT FULLY PAID FOR A LONG TIME BECOMES UNCOLLECTABLE) => THEN ACCOUNTANT CAN WRITE OFF THE INVOICE 
             * ACCOUNTS:
             * RECEIVABLE : "CREDIT"
             * BAD DEBTS: "DEBIT"
             *  
             */
            await client.query("BEGIN")
            let customer = await this.getUser(client, "Invoices", "Customers", invoiceId, companyId)

            const query = {
                text: `with "values" as (
                    select  $1::uuid as "invoiceId" ,
                            $2::uuid as "companyId" 
                    ), "Journals" as (
                        select 
                        ("Invoices".total::text::numeric::double precision - sum(COALESCE("InvoicePaymentLines".amount::text::numeric::real, 0::numeric::real))) as "total",
                          "Invoices"."writeOffDate"   as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "Invoices".id as "referenceId" ,
                        "Invoices"."invoiceNumber",
                        "Invoices"."branchId",
                         null::uuid as  "salesEmployeeId",
                         null::uuid as  "chargeId",
                         "Invoices"."invoiceNumber" as "code"
                        from "Invoices" 
                        JOIN "values" on true
                   left join "InvoicePaymentLines" ON "InvoicePaymentLines"."invoiceId" = "Invoices".id 
                   inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND "Accounts".name::text = 'Bad Debts'::text AND "Accounts"."default" = true
                   where "Invoices"."id" = "values"."invoiceId"
						 and "writeOffDate" is not null 
                   group by "journalDate" , "Accounts".id,"Invoices"."id"
                   
                UNION ALL 
                select 
                        ("Invoices".total::text::numeric::double precision - sum(COALESCE("InvoicePaymentLines".amount::text::numeric::real, 0::numeric::real))) *-1 as "total",
                         "Invoices"."writeOffDate"   as "journalDate",
 						"Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "Invoices".id as "referenceId" ,
                        "Invoices"."invoiceNumber",
                        "Invoices"."branchId",
                         null::uuid as  "salesEmployeeId",
                         null::uuid as  "chargeId",
                         "Invoices"."invoiceNumber" as "code"
                        from "Invoices" 
                        JOIN "values" on true
                   left join "InvoicePaymentLines" ON "InvoicePaymentLines"."invoiceId" = "Invoices".id 
                        inner join "Accounts" on "Accounts"."companyId" =  "values"."companyId" AND (( "Invoices"."receivableAccountId" is not null and  "Accounts".id = "Invoices"."receivableAccountId") OR  (  "Invoices"."receivableAccountId" is null and "Accounts".name::text = 'Account Receivable'::text AND "Accounts".type::text = 'Account Receivable'::text AND "Accounts"."default" = true))  
                   where "Invoices"."id" = "values"."invoiceId"
				   and "writeOffDate" is not null 
                   group by "journalDate" , "Accounts".id,"Invoices"."id"
                    )
                                    
                    select * from "Journals"`,
                values: [invoiceId, companyId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            await this.validateJournalBalance(client, journals, companyId);
            // await this.deleteJournals(client,[invoiceId])

            await this.saveJournal(client, journals, 'Invoice Write Off', customer, companyId);
            await client.query("COMMIT")

        } catch (error: any) {
        
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()

        }
    }


    /**CreditNote Journals */
    public static async creditNoteJournal(crediteNoteIds: [], companyId: string) {
        const client = await DB.excu.client(500);
        try {
            /** OPPSITE TO THE INVOICE JOURNAL 
             * 
             * ACCOUNTS:
             * - SALES: "DEBIT"
             * - COGS: "CREDIT"
             * - INVENTORY ASSETS : "CREDIT"
             * - RECEIVABLE : "CREDIT"
             * - OUTPUT VAT :"DEBIT"
             * - CHARGES INCOME :"DEBIT"
             * - DELIVERY CHARGE : "DEBIT"
             * - DISCOUNT : "DEBIT" 
             * - COMMISSION EXPENSE : "CREDIT"
             * - COMMISSION LIABILITIES : "DEBIT"
             */
            await client.query("BEGIN");
            for (let index = 0; index < crediteNoteIds.length; index++) {
                const crediteNoteId = crediteNoteIds[index];
                let customer = await this.getUser(client, "CreditNotes", "Customers", crediteNoteId, companyId)

                const query = {
                    text: `                  
                    with "values" as (
                        select $1::uuid as "creditNoteId" ,
                               $2::uuid as "companyId" 
                        ), "Journals" as (
                        select 
                          ( ( sum("CreditNoteLines"."total"::text::numeric) + COALESCE("CreditNotes"."roundingTotal"::text::numeric,0) +  COALESCE("CreditNotes"."chargeTotal"::text::numeric,0) + COALESCE("CreditNotes"."deliveryCharge"::text::numeric,0) - COALESCE("CreditNotes"."discountTotal"::text::numeric,0)) + case when "CreditNotes"."isInclusiveTax" then 0 else  + COALESCE(("CreditNotes"."chargesTaxDetails"->>'taxAmount')::numeric,0)  end) *(-1) as "total",
                             case when   "CreditNoteLines"."createdAt"::date = "CreditNotes"."creditNoteDate" then ("CreditNotes"."creditNoteDate" + "CreditNotes"."createdAt"::time ) else    "CreditNoteLines"."createdAt" end   as "journalDate",
                             "Accounts".name  as "accountName",
                             "Accounts".id  as "accountId",
                             "CreditNotes".id as "referenceId" ,
                             "CreditNotes"."creditNoteNumber",
                             "CreditNotes"."branchId",
                     
                              null::uuid as  "chargeId",
                              "CreditNotes"."creditNoteNumber" as "code"
                             from "CreditNoteLines" 
                             JOIN "values" on true
                        inner join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId"  AND "CreditNoteLines"."createdAt"::date = "CreditNotes"."creditNoteDate"::date
                         INNER JOIN "Invoices" on "Invoices".id = "CreditNotes"."invoiceId" 
                        inner join "Accounts" on "Accounts"."companyId" =  "values"."companyId" AND (( "Invoices"."receivableAccountId" is not null and  "Accounts".id = "Invoices"."receivableAccountId") OR  (  "Invoices"."receivableAccountId" is null and "Accounts".name::text = 'Account Receivable'::text AND "Accounts".type::text = 'Account Receivable'::text AND "Accounts"."default" = true))  
                        where "CreditNoteLines"."creditNoteId" = "values"."creditNoteId"
                        group by "journalDate" , "Accounts".id,"CreditNotes"."id"
                        UNION ALL 
                        select 
                        sum("CreditNoteLines"."total"::text::numeric)*(-1) as "total",
                         case when   "CreditNoteLines"."createdAt"::date = "CreditNotes"."creditNoteDate" then  ("CreditNotes"."creditNoteDate" + "CreditNotes"."createdAt"::time ) else    "CreditNoteLines"."createdAt" end   as "journalDate",
                         "Accounts".name  as "accountName",
                         "Accounts".id  as "accountId",
                         "CreditNotes".id as "referenceId" ,
                         "CreditNotes"."creditNoteNumber",
                         "CreditNotes"."branchId",
                          null::uuid as  "chargeId",
                          "CreditNotes"."creditNoteNumber" as "code"
                         from "CreditNoteLines" 
                         JOIN "values" on true
                    inner join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId"  AND "CreditNoteLines"."createdAt"::date <> "CreditNotes"."creditNoteDate"::date
				    INNER JOIN "Invoices" on "Invoices".id = "CreditNotes"."invoiceId" 
                        inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND (( "Invoices"."receivableAccountId" is not null and  "Accounts".id = "Invoices"."receivableAccountId") OR  ("Accounts".name::text = 'Account Receivable'::text AND "Accounts".type::text = 'Account Receivable'::text AND "Accounts"."default" = true))  
                    where "CreditNoteLines"."creditNoteId" = "values"."creditNoteId"
                    group by "journalDate" , "Accounts".id,"CreditNotes"."id"
    
                        union all
                        select 
                            case when "CreditNotes"."isInclusiveTax" then  sum( "CreditNoteLines"."subTotal"::text::numeric - "CreditNoteLines"."taxTotal"::text::numeric) -   COALESCE(("CreditNotes"."chargesTaxDetails"->>'taxAmount')::numeric,0)  else sum("CreditNoteLines"."subTotal"::text::numeric  )  end as "total",
                            case when   "CreditNoteLines"."createdAt"::date = "CreditNotes"."creditNoteDate" then ("CreditNotes"."creditNoteDate" + "CreditNotes"."createdAt"::time ) else    "CreditNoteLines"."createdAt" end   as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "CreditNotes".id as "referenceId",
                            "CreditNotes"."creditNoteNumber",
                            "CreditNotes"."branchId",
                            null::uuid as  "chargeId",
                            "CreditNotes"."creditNoteNumber" as "code"
                            from "CreditNoteLines" 
                        JOIN "values" on true
                        inner join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId" 
                        inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND "Accounts".id = "CreditNoteLines"."accountId" 
                        where "CreditNoteLines" ."creditNoteId" = "values"."creditNoteId"
                        group by "journalDate" , "Accounts".id,"CreditNotes"."id"
                        
                        union all 
                        select 
                            sum("CreditNoteLines"."taxTotal"::text::numeric) +  COALESCE(("CreditNotes"."chargesTaxDetails"->>'taxAmount')::numeric,0)  as "total",
                            case when   "CreditNoteLines"."createdAt"::date = "CreditNotes"."creditNoteDate" then ("CreditNotes"."creditNoteDate" + "CreditNotes"."createdAt"::time ) else    "CreditNoteLines"."createdAt" end   as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "CreditNotes".id as "referenceId",
                            "CreditNotes"."creditNoteNumber",
                            "CreditNotes"."branchId",
                            null::uuid as  "chargeId",
                            "CreditNotes"."creditNoteNumber" as "code"
                            from "CreditNoteLines" 
                        JOIN "values" on true
                        inner join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId" 
                        inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND  "Accounts".name::text = 'Output Vat'::text AND "Accounts"."default" = true
                        where "CreditNoteLines" ."creditNoteId" = "values"."creditNoteId"
                        group by "journalDate" , "Accounts".id,"CreditNotes"."id"
                        
                        union all 
                        select 
                            sum("CreditNotes"."chargeTotal"::text::numeric) as "total",
                             ("CreditNotes"."creditNoteDate" + "CreditNotes"."createdAt"::time ) as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "CreditNotes".id as "referenceId",
                            "CreditNotes"."creditNoteNumber",
                            "CreditNotes"."branchId",
                            "CreditNotes"."chargeId"::uuid as  "chargeId",
                            "CreditNotes"."creditNoteNumber" as "code"
                        from "CreditNotes"
                        JOIN "values" on true
                        inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND   "Accounts".type::text = 'Charges Income'::text AND "Accounts"."default" = true
                        where "CreditNotes".id = "values"."creditNoteId"
                        and "CreditNotes"."chargeTotal" <>0
                        group by "journalDate" , "Accounts".id,"CreditNotes"."id"
                        
                        union all 
                        select 
                            sum("CreditNotes"."deliveryCharge"::text::numeric)  as "total",
                             ("CreditNotes"."creditNoteDate" + "CreditNotes"."createdAt"::time )as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "CreditNotes".id as "referenceId",
                            "CreditNotes"."creditNoteNumber",
                            "CreditNotes"."branchId",
                            null::uuid as  "chargeId",
                            "CreditNotes"."creditNoteNumber" as "code"
                        from "CreditNotes"
                        JOIN "values" on true
                        inner join "Accounts" on "Accounts"."companyId" ="values"."companyId"  AND "Accounts".type::text = 'Delivery Charge'::text AND "Accounts"."default" = true
                        where  "CreditNotes".id = "values"."creditNoteId"
                        and "CreditNotes"."deliveryCharge" <>0
                        group by "journalDate" , "Accounts".id,"CreditNotes"."id"
                        
                        union all 
                        select 
                            sum("CreditNotes"."discountTotal"::text::numeric) *(-1) as "total",
                            case when   "CreditNoteLines"."createdAt"::date = "CreditNotes"."creditNoteDate" then  ("CreditNotes"."creditNoteDate" + "CreditNotes"."createdAt"::time ) else    "CreditNoteLines"."createdAt" end   as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "CreditNotes".id as "referenceId",
                            "CreditNotes"."creditNoteNumber",
                            "CreditNotes"."branchId",
                            null::uuid as  "chargeId",
                            "CreditNotes"."creditNoteNumber" as "code"
                        from "CreditNotes" 
                        JOIN "values" on true
                        inner join "CreditNoteLines" on "CreditNotes".id = "CreditNoteLines"."creditNoteId" and "CreditNoteLines"."createdAt"::date <> "CreditNotes"."creditNoteDate"
                        inner join "Accounts" on "Accounts"."companyId" ="values"."companyId" AND "Accounts".type::text = 'Discount'::text AND "Accounts"."default" = true
                        where  "CreditNotes".id ="values"."creditNoteId"
                        and "CreditNotes"."discountTotal" <>0
                        group by "journalDate" , "Accounts".id,"CreditNotes"."id"
                        
                        union all 
                        select 
                            COALESCE(sum("CreditNoteLines"."discountTotal"::text::numeric),0) *(-1)   as "total",
                             ("CreditNotes"."creditNoteDate" + "CreditNotes"."createdAt"::time )  as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "CreditNotes".id as "referenceId",
                            "CreditNotes"."creditNoteNumber",
                            "CreditNotes"."branchId",
                            null::uuid as  "chargeId",
                            "CreditNotes"."creditNoteNumber" as "code"
                        from "CreditNotes" 
                        JOIN "values" on true
                        inner join "CreditNoteLines" on "CreditNotes".id = "CreditNoteLines"."creditNoteId" 
                        inner join "Accounts" on "Accounts"."companyId" ="values"."companyId" AND "Accounts".type::text = 'Discount'::text AND "Accounts"."default" = true
                        where  "CreditNotes".id = "values"."creditNoteId"
                        group by "journalDate" , "Accounts".id,"CreditNotes"."id"
                        having    "CreditNotes"."discountTotal"::text::numeric + COALESCE(sum("CreditNoteLines"."discountTotal"::text::numeric),0) <>0 
                     
                        union all 
                        select 
                            sum("CreditNotes"."roundingTotal"::text::numeric) as "total",
                            ("CreditNotes"."creditNoteDate" + "CreditNotes"."createdAt"::time ) as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "CreditNotes".id as "referenceId",
                            "CreditNotes"."creditNoteNumber",
                            "CreditNotes"."branchId",
                            null::uuid as  "chargeId",
                            "CreditNotes"."creditNoteNumber" as "code"
                        from "CreditNotes"
                        JOIN "values" on true
                        inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Rounding'::text AND "Accounts"."default" = true
                        where  "CreditNotes".id = "values"."creditNoteId"
                        and "CreditNotes"."roundingTotal" <>0
                        group by "journalDate" , "Accounts".id,"CreditNotes"."id"
                                        
                        union all 
                        select 
                            sum("CreditNoteLines"."commissionTotal"::text::numeric) *(-1) as "total",
                            case when   "CreditNoteLines"."createdAt"::date = "CreditNotes"."creditNoteDate" then ("CreditNotes"."creditNoteDate" + "CreditNotes"."createdAt"::time ) else    "CreditNoteLines"."createdAt" end   as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "CreditNotes".id as "referenceId",
                            "CreditNotes"."creditNoteNumber",
                            "CreditNotes"."branchId",
                      
                            null::uuid as  "chargeId",
                            "CreditNotes"."creditNoteNumber" as "code"
                        from "CreditNoteLines"
                        JOIN "values" on true
                        inner join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId" 
                        inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Commission Expense'::text AND "Accounts"."default" = true
                        where "CreditNoteLines"."creditNoteId" = "values"."creditNoteId"
                        and "commissionTotal" <> 0 
                        group by "journalDate" , "Accounts".id,"CreditNotes"."id"
                        
                        union all 
                        select 
                            sum("CreditNoteLines"."commissionTotal"::text::numeric)   as "total",
                            case when   "CreditNoteLines"."createdAt"::date = "CreditNotes"."creditNoteDate" then  ("CreditNotes"."creditNoteDate" + "CreditNotes"."createdAt"::time ) else    "CreditNoteLines"."createdAt" end   as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "CreditNotes".id as "referenceId",
                            "CreditNotes"."creditNoteNumber",
                            "CreditNotes"."branchId",
                        
                             null::uuid as  "chargeId",
                             "CreditNotes"."creditNoteNumber" as "code"
                        from "CreditNoteLines" 
                        JOIN "values" on true
                        inner join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId" 
                        inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Commission Liabilities'::text AND "Accounts"."default" = true
                        where "CreditNoteLines"."creditNoteId" = "values"."creditNoteId"
                        and "commissionTotal" <> 0 
                        group by "journalDate" , "Accounts".id,"CreditNotes"."id"
                                        
                     
                       )
                               
                                        
                        select * from "Journals"`,
                    values: [crediteNoteId, companyId]
                }

                let journal = await client.query(query.text, query.values);
                const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
                await this.validateJournalBalance(client, journals, companyId);
                await this.deleteJournals(client, [crediteNoteId])
                await this.saveJournal(client, journals, 'Credit Note', customer, companyId);

            }

            await client.query("COMMIT");
        } catch (error: any) {
       
            await client.query("ROLLBACK");
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    /**Invoice Payments */
    public static async invoicePaymentsJournal(paymentIds: [], companyId: string) {
        const client = await DB.excu.client(500);
        try {
            /**
             * HAVE TWO TYPES OF PAYMENTS: 
             * DIRECT PAYMENT : IS WHEN USING THE FULL AMOUNT PAID (NO EXTRA FEE NO CHANGE)
             * - RECEIVABLE : "CREDIT"
             * - PAYMENT METHOD ACCOUNT : "DEBIT"
             * 
             * UNEARNED REVENUE : IS WHEN THE CUSTOMER PAY IN ADVANCE (USED AMOUNT IS LESS THAN THE TOTAL PAID AMOUNT)
             * (ON THE DATE OF THE PAYMENT)
             * - RECEIVABLE : "CREDIT" (ONLY IN CASE THE USER PAID SOME INVOICES IN THE SAME DATE AS TEH PAYMENT)
             * - PAYMENT METHOD ACCOUNT : "DEBIT" (THE TOTAL PAID AMOUNT)
             * - UNEAREND REVENUE : "CREDIT" (  TOTAL PAID AMOUNT - "USED ACCOUNT" ) (REMAINING)
             * 
             * (ON DIFFERENT DATE)
             * - UNEAREND REVENUE :"DEBIT"
             * - RECEIVABLE : "CREDIT"
             */
            await client.query("BEGIN")

            for (let index = 0; index < paymentIds.length; index++) {
                const paymentId = paymentIds[index];
                let customer = await this.getUser(client, "InvoicePayments", "Customers", paymentId, companyId)

                const query = {
                    text:
                        `with "values" as (
                        select  $1::uuid as "paymentId" ,
                                $2::uuid as "companyId" 
                          ), "Journals" as (
							
							
							
							
                           SELECT 
                            CASE
                            WHEN "InvoicePayments"."tenderAmount"::text::numeric::double precision > 0::double precision THEN
							"InvoicePayments"."tenderAmount"::text::numeric * "InvoicePayments".rate::text::numeric - COALESCE("InvoicePayments"."bankCharge"::text::numeric,0) - COALESCE("InvoicePayments"."changeAmount"::text::numeric,0) * "InvoicePayments".rate::text::numeric
                            ELSE "InvoicePayments"."paidAmount"::text::numeric - COALESCE("InvoicePayments"."bankCharge"::text::numeric,0)
                            END   as "total",
                           ("InvoicePayments"."paymentDate" + "InvoicePayments"."createdAt"::time)::TIMESTAMP   as "journalDate",
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
                            and( "InvoicePayments"."tenderAmount" > 0 or "InvoicePayments"."paidAmount">0 ) 
							
                          
                        UNION ALL 
                                 SELECT 
                           case when "InvoicePayments"."tenderAmount" >0 then ("InvoicePayments"."tenderAmount"::text::numeric * "InvoicePayments".rate::text::numeric ) -  (COALESCE("InvoicePayments"."changeAmount"::text::numeric,0) * "InvoicePayments".rate::text::numeric) - COALESCE(sum("InvoicePaymentLines".amount::text::numeric)::real, 0::numeric::real)
                           else "InvoicePayments"."paidAmount"  - (COALESCE(sum("InvoicePaymentLines".amount::text::numeric)::real, 0::numeric::real)::text::numeric::double precision - (COALESCE("InvoicePayments"."changeAmount"::text::numeric,0) * "InvoicePayments".rate::text::numeric)::double precision)
                           end   * '-1'::integer
                           as "total",
                                 ("InvoicePayments"."paymentDate" + "InvoicePayments"."createdAt"::time)::TIMESTAMP  as "journalDate",
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
                          having  (("InvoicePayments"."tenderAmount"::text::numeric * "InvoicePayments".rate::text::numeric)  -  (COALESCE("changeAmount",0) * "rate")::text::numeric )  -   COALESCE(sum("InvoicePaymentLines".amount::text::numeric), 0) >0 
                            or "InvoicePayments"."tenderAmount" =0 and ("paidAmount"::text::numeric -  COALESCE(sum("InvoicePaymentLines".amount::text::numeric), 0) <> 0.0 and  "paidAmount"::text::numeric <> "tenderAmount"::text::numeric * "rate"::text::numeric - COALESCE("changeAmount"::text::numeric,0) * "rate"::text::numeric ) 
                                       union all 
                            SELECT 
                             sum("InvoicePaymentLines".amount::text::numeric)::text::numeric * '-1'::text::numeric   as "total",
                             MAKE_TIMESTAMP(
                                EXTRACT(YEAR FROM "InvoicePayments"."paymentDate")::int,
                                EXTRACT(MONTH FROM "InvoicePayments"."paymentDate")::int,
                                EXTRACT(DAY FROM   "InvoicePayments"."paymentDate")::int,
                                EXTRACT(HOUR FROM  "InvoicePayments"."createdAt")::int,
                                EXTRACT(MINUTE FROM "InvoicePayments"."createdAt")::int,
                                EXTRACT(SECOND FROM "InvoicePayments"."createdAt")::int
                            ) as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "InvoicePayments".id as "referenceId",
                            COALESCE("InvoicePaymentLines"."branchId", "InvoicePayments"."branchId") as "branchId",
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
                            GROUP BY  "InvoicePayments".id, "Accounts".id,  COALESCE("InvoicePaymentLines"."branchId", "InvoicePayments"."branchId") 
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
                             COALESCE("InvoicePaymentLines"."branchId", "InvoicePayments"."branchId") as "branchId",
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
                              ("InvoicePayments"."paymentDate" + "InvoicePayments"."createdAt"::time)::TIMESTAMP   as "journalDate",
                              
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
                    //     `

                    //  with "values" as (
                    //         select  $1::uuid as "paymentId" ,
                    //                 $2::uuid as "companyId" 
                    //         ), "Journals" as (
                    //            SELECT 
                    //             CASE
                    //             WHEN "InvoicePayments"."tenderAmount"::text::numeric::double precision > 0::double precision THEN "InvoicePayments"."tenderAmount"::text::numeric * "InvoicePayments".rate::text::numeric - COALESCE("InvoicePayments"."bankCharge"::text::numeric,0) - COALESCE("InvoicePayments"."changeAmount"::text::numeric,0) * "InvoicePayments".rate::text::numeric
                    //             ELSE "InvoicePayments"."paidAmount"::text::numeric - COALESCE("InvoicePayments"."bankCharge"::text::numeric,0)
                    //             END   as "total",
                    //            ("InvoicePayments"."paymentDate" + "InvoicePayments"."createdAt"::time)::TIMESTAMP   as "journalDate",
                    //             "Accounts".name  as "accountName",
                    //             "Accounts".id  as "accountId",
                    //             "InvoicePayments".id as "referenceId",
                    //             "InvoicePayments"."branchId",
                    //             null::uuid as  "salesEmployeeId",
                    //             null::uuid as  "chargeId",
                    //             NULL as "code"
                    //             FROM "InvoicePayments"
                    //             INNER JOIN "values" on true 
                    //             INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".id = "InvoicePayments"."paymentMethodAccountId"
                    //             where "InvoicePayments".id = "values" ."paymentId"
                    //             AND "InvoicePayments".status::text = 'SUCCESS'::text

                    //         UNION ALL 
                    //                  SELECT 
                    //            case when "InvoicePayments"."tenderAmount" >0 then ("InvoicePayments"."tenderAmount"::text::numeric * "InvoicePayments".rate::text::numeric )- COALESCE(sum("InvoicePaymentLines".amount::text::numeric)::real, 0::numeric::real) + (COALESCE("InvoicePayments"."changeAmount"::text::numeric,0) * "InvoicePayments".rate::text::numeric)
                    //            else "InvoicePayments"."paidAmount"  - (COALESCE(sum("InvoicePaymentLines".amount::text::numeric)::real, 0::numeric::real)::text::numeric::double precision + (COALESCE("InvoicePayments"."changeAmount"::text::numeric,0) * "InvoicePayments".rate::text::numeric)::double precision)
                    //            end   * '-1'::integer::double precision
                    //            as "total",
                    //                  ("InvoicePayments"."paymentDate" + "InvoicePayments"."createdAt"::time)::TIMESTAMP  as "journalDate",
                    //             "Accounts".name  as "accountName",
                    //             "Accounts".id  as "accountId",
                    //             "InvoicePayments".id as "referenceId",
                    //             "InvoicePayments"."branchId",
                    //             null::uuid as  "salesEmployeeId",
                    //             null::uuid as  "chargeId",
                    //             NULL as "code"
                    //             FROM "InvoicePayments"
                    //             INNER JOIN "values" on true 
                    //             INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Unearend Revenue'::text AND "Accounts"."default" = true
                    //             LEFT JOIN "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id and "InvoicePayments"."paymentDate" = "InvoicePaymentLines"."createdAt"::date 
                    //             where "InvoicePayments".id = "values" ."paymentId"
                    //             AND "InvoicePayments".status::text = 'SUCCESS'::text
                    //             GROUP BY  "InvoicePayments".id, "Accounts".id
                    //           having  (((((("InvoicePayments"."tenderAmount"::text::numeric * "InvoicePayments".rate::text::numeric)::text)::numeric)::double precision - COALESCE("changeAmount"::text::numeric,0) * "rate"::text::numeric  - (COALESCE(sum("InvoicePaymentLines".amount::text::numeric)::real, 0::numeric::real)::text::numeric::double precision + COALESCE("InvoicePayments"."bankCharge"::text::numeric,0)::double precision + (COALESCE("InvoicePayments"."changeAmount"::text::numeric,0)* "InvoicePayments".rate::text::numeric)::double precision))::text)::numeric) >0 
                    //             or ("paidAmount"::text::numeric -  COALESCE(sum("InvoicePaymentLines".amount::text::numeric), 0) <> 0.0 and  "paidAmount"::text::numeric <> "tenderAmount"::text::numeric * "rate"::text::numeric - COALESCE("changeAmount"::text::numeric,0) * "rate"::text::numeric ) 
                    //                        union all 
                    //             SELECT 
                    //              sum("InvoicePaymentLines".amount::text::numeric)::double precision * '-1'::integer::double precision   as "total",
                    //              MAKE_TIMESTAMP(
                    //                 EXTRACT(YEAR FROM "InvoicePayments"."paymentDate")::int,
                    //                 EXTRACT(MONTH FROM "InvoicePayments"."paymentDate")::int,
                    //                 EXTRACT(DAY FROM   "InvoicePayments"."paymentDate")::int,
                    //                 EXTRACT(HOUR FROM  "InvoicePayments"."createdAt")::int,
                    //                 EXTRACT(MINUTE FROM "InvoicePayments"."createdAt")::int,
                    //                 EXTRACT(SECOND FROM "InvoicePayments"."createdAt")::int
                    //             ) as "journalDate",
                    //             "Accounts".name  as "accountName",
                    //             "Accounts".id  as "accountId",
                    //             "InvoicePayments".id as "referenceId",
                    //             "InvoicePayments"."branchId",
                    //             null::uuid as  "salesEmployeeId",
                    //             null::uuid as  "chargeId",
                    //             NULL as "code"
                    //             FROM "InvoicePayments"
                    //             INNER JOIN "values" on true 
                    //             LEFT JOIN "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id and "InvoicePayments"."paymentDate" = "InvoicePaymentLines"."createdAt"::date 
                    //             LEFT JOIN "Invoices" ON "Invoices"."id" = "InvoicePaymentLines"."invoiceId" 
                    //         LEFT join "Accounts" on "Accounts"."companyId" =  "values"."companyId" AND (( "Invoices"."receivableAccountId" is not null and  "Accounts".id = "Invoices"."receivableAccountId") OR  (  "Invoices"."receivableAccountId" is null and "Accounts".name::text = 'Account Receivable'::text AND "Accounts".type::text = 'Account Receivable'::text AND "Accounts"."default" = true))  
                    //             where "InvoicePayments".id = "values" ."paymentId"
                    //             AND "InvoicePayments".status::text = 'SUCCESS'::text
                    //             GROUP BY  "InvoicePayments".id, "Accounts".id
                    //             having  sum("InvoicePaymentLines".amount::text::numeric)::double precision  >0 

                    //         UNION ALL 
                    //           SELECT 
                    //             sum("InvoicePaymentLines".amount::text::numeric)::double precision as "total",
                    //             "InvoicePaymentLines"."createdAt"  as "journalDate",
                    //             "Accounts".name  as "accountName",
                    //             "Accounts".id  as "accountId",
                    //             "InvoicePaymentLines".id as "referenceId",
                    //             "InvoicePayments"."branchId",
                    //             null::uuid as  "salesEmployeeId",
                    //             null::uuid as  "chargeId",
                    //             NULL as "code"
                    //             FROM "InvoicePayments"
                    //             INNER JOIN "values" on true 
                    //             INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Unearend Revenue'::text AND "Accounts"."default" = true
                    //             LEFT JOIN "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id and "InvoicePayments"."paymentDate" <> "InvoicePaymentLines"."createdAt"::date 
                    //             where "InvoicePayments".id = "values" ."paymentId"
                    //             AND "InvoicePayments".status::text = 'SUCCESS'::text
                    //             GROUP BY  "InvoicePayments".id, "Accounts".id,"InvoicePaymentLines"."createdAt",     "InvoicePaymentLines".id
                    //             having  sum("InvoicePaymentLines".amount::text::numeric)::double precision  >0 

                    //           union all 
                    //             SELECT 
                    //              sum("InvoicePaymentLines".amount::text::numeric)::double precision * '-1'::integer::double precision   as "total",
                    //             "InvoicePaymentLines"."createdAt" as "journalDate",
                    //             "Accounts".name  as "accountName",
                    //             "Accounts".id  as "accountId",
                    //             "InvoicePaymentLines".id as "referenceId",
                    //             "InvoicePayments"."branchId",
                    //             null::uuid as  "salesEmployeeId",
                    //             null::uuid as  "chargeId",
                    //             NULL as "code"
                    //             FROM "InvoicePayments"
                    //             INNER JOIN "values" on true 
                    //             LEFT JOIN "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id and "InvoicePayments"."paymentDate" <> "InvoicePaymentLines"."createdAt"::date 
                    //              LEFT JOIN "Invoices" ON "Invoices"."id" = "InvoicePaymentLines"."invoiceId" 
                    //              LEFT join "Accounts" on "Accounts"."companyId" =  "values"."companyId" AND (( "Invoices"."receivableAccountId" is not null and  "Accounts".id = "Invoices"."receivableAccountId") OR  (  "Invoices"."receivableAccountId" is null and "Accounts".name::text = 'Account Receivable'::text AND "Accounts".type::text = 'Account Receivable'::text AND "Accounts"."default" = true))  
                    //             where "InvoicePayments".id = "values" ."paymentId"
                    //             AND "InvoicePayments".status::text = 'SUCCESS'::text
                    //             GROUP BY  "InvoicePayments".id, "Accounts".id ,"InvoicePaymentLines"."createdAt",     "InvoicePaymentLines".id
                    //             having  sum("InvoicePaymentLines".amount::text::numeric)::double precision  >0 

                    //             union all 
                    //             SELECT 
                    //             "InvoicePayments"."bankCharge"::text::numeric  as "total",
                    //               ("InvoicePayments"."paymentDate" + "InvoicePayments"."createdAt"::time)::TIMESTAMP   as "journalDate",
                    //               ("InvoicePayments"."paymentDate" + "InvoicePayments"."createdAt"::time)::TIMESTAMP   as "journalDate",
                    //             "Accounts".name  as "accountName",
                    //             "Accounts".id  as "accountId",
                    //             "InvoicePayments".id as "referenceId",
                    //             "InvoicePayments"."branchId",
                    //             null::uuid as  "salesEmployeeId",
                    //             null::uuid as  "chargeId",
                    //             NULL as "code"
                    //             FROM "InvoicePayments"
                    //             INNER JOIN "values" on true 
                    //             INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId"  AND "Accounts".name::text = 'Bank Charge'::text AND "Accounts"."default" = true
                    //             where "InvoicePayments".id = "values" ."paymentId"
                    //             AND "InvoicePayments".status::text = 'SUCCESS'::text
                    //             AND  "InvoicePayments"."bankCharge"::text::numeric > 0 

                    //         )

                    //         select * from "Journals"

                    //     `,
                    values: [paymentId, companyId]
                }



                let journal = await client.query(query.text, query.values);
                const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];

                await client.query('Delete from "JournalRecords" where name =$1 and "referenceId"=$2', ['Unearend Revenue', paymentId])
                await this.validateJournalBalance(client, journals, companyId);
                await this.deleteJournals(client, [paymentId])
                await this.deleteLinesIds(client, [paymentId], 'Invoice', companyId)
                await this.saveJournal(client, journals, 'Invoice Payment', customer, companyId);


            }

            await client.query("COMMIT")

        } catch (error: any) {
     
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }
    /**Billing Payments */
    public static async billingPaymentsJournal(paymentId: string, companyId: string) {
        const client = await DB.excu.client(500);
        try {
            /**
                      * HAVE TWO TYPES OF PAYMENTS: 
                      * DIRECT PAYMENT : IS WHEN USING THE FULL AMOUNT PAID (NO EXTRA FEE NO CHANGE)
                      * - PAYABLE :"DEBIT"
                      * - PAYMENT METHOD ACCOUNT :  "CREDIT"
                      * 
                      * PREPAID EXPENSES : IS WHEN THE CUSTOMER PAY IN ADVANCE (USED AMOUNT IS LESS THAN THE TOTAL PAID AMOUNT)
                      * (ON THE DATE OF THE PAYMENT)
                      * - PAYABLE : "DEBIT" (ONLY IN CASE THE USER PAID SOME INVOICES IN THE SAME DATE AS TEH PAYMENT)
                      * - PAYMENT METHOD ACCOUNT :  "CREDIT" (THE TOTAL PAID AMOUNT)
                      * - PREPAID EXPENSES  :  "DEBIT"(  TOTAL PAID AMOUNT - "USED ACCOUNT" ) (REMAINING)
                      * 
                      * (ON DIFFERENT DATE)
                      * - PREPAID EXPENSES  : "CREDIT"
                      * - PAYABLE : "DEBIT"
                      */
            await client.query("BEGIN");
            let supplier = await this.getUser(client, "BillingPayments", "Suppliers", paymentId, companyId)

            const query = {
                text: `with "values" as (
                    select  $1::uuid as "paymentId" ,
                            $2::uuid as "companyId" 
                    ), "Journals" as (
                       SELECT 
                        CASE
                        WHEN "BillingPayments"."tenderAmount"::text::numeric::double precision > 0::double precision THEN "BillingPayments"."tenderAmount"::text::numeric * "BillingPayments".rate::text::numeric   * -1 
                        ELSE "BillingPayments"."paidAmount"::text::numeric * -1  
                        END   as "total",
                         ("BillingPayments"."paymentDate" + "BillingPayments"."createdAt"::time)::TIMESTAMP  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "BillingPayments".id as "referenceId",
                        "BillingPayments"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
                        FROM "BillingPayments"
                        INNER JOIN "values" on true 
                        INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".id = "BillingPayments"."paymentMethodAccountId"
                        where "BillingPayments".id = "values" ."paymentId"
                           and( "BillingPayments"."tenderAmount" > 0 or "BillingPayments"."paidAmount">0 ) 
                      
                    UNION ALL 
                    SELECT 
                        case when "BillingPayments"."tenderAmount" >0 then (((((("BillingPayments"."tenderAmount"::text::numeric * "BillingPayments".rate::text::numeric)::text)::numeric)::double precision - (COALESCE(sum("BillingPaymentLines".amount::text::numeric)::real, 0::numeric::real)::text::numeric::double precision ))::text)::numeric)::double precision
                        else 
                        "BillingPayments"."paidAmount" -  COALESCE(sum("BillingPaymentLines".amount::text::numeric)::real,0)
                        end 
                        as "total",
                        ("BillingPayments"."paymentDate" + "BillingPayments"."createdAt"::time)::TIMESTAMP   as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "BillingPayments".id as "referenceId",
                        "BillingPayments"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
                        FROM "BillingPayments"
                        INNER JOIN "values" on true 
                        INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Prepaid Expenses'::text AND "Accounts"."default" = true
                        LEFT JOIN "BillingPaymentLines" on "BillingPaymentLines"."billingPaymentId" = "BillingPayments".id and "BillingPayments"."paymentDate" = "BillingPaymentLines"."createdAt"::date 
                        where "BillingPayments".id = "values" ."paymentId"
                        GROUP BY  "BillingPayments".id, "Accounts".id
                        having (((((("BillingPayments"."tenderAmount"::text::numeric * "BillingPayments".rate::text::numeric)::text)::numeric)::double precision - (COALESCE(sum("BillingPaymentLines".amount::text::numeric)::real, 0::numeric::real)::text::numeric::double precision ))::text)::numeric) > 0 
                         or     "BillingPayments"."paidAmount" -  COALESCE(sum("BillingPaymentLines".amount::text::numeric)::real,0) > 0


                      union all 
                        SELECT
                         sum("BillingPaymentLines".amount::text::numeric)::double precision    as "total",
                       ("BillingPayments"."paymentDate" + "BillingPayments"."createdAt"::time)::TIMESTAMP  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "BillingPayments".id as "referenceId",
                        COALESCE( "BillingPaymentLines"."branchId",  "BillingPayments"."branchId") as "branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
                        FROM "BillingPayments"
                        INNER JOIN "values" on true 
                        LEFT JOIN "BillingPaymentLines" on "BillingPaymentLines"."billingPaymentId" = "BillingPayments".id and "BillingPayments"."paymentDate" = "BillingPaymentLines"."createdAt"::date 
                        LEFT JOIN "Billings" ON "Billings".id = "BillingPaymentLines"."billingId"
                        INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND (("Accounts".id = "Billings"."payableAccountId") or ("Billings"."payableAccountId" is null  AND "Accounts".type::text = 'Account Payable'::text AND "Accounts".name::text = 'Account Payable'::text AND "Accounts"."default" = true ))
                        where "BillingPayments".id = "values" ."paymentId"
                        
                        GROUP BY  "BillingPayments".id, "Accounts".id,   COALESCE( "BillingPaymentLines"."branchId",  "BillingPayments"."branchId") 
                        having  sum("BillingPaymentLines".amount::text::numeric)::double precision  >0 
                        
                    UNION ALL 
                      SELECT 
                        sum("BillingPaymentLines".amount::text::numeric)::double precision * -1  as "total",
                        "BillingPaymentLines"."createdAt"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "BillingPaymentLines".id as "referenceId",
                         COALESCE( "BillingPaymentLines"."branchId",  "BillingPayments"."branchId") as "branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
                        FROM "BillingPayments"
                        INNER JOIN "values" on true 
                        INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Prepaid Expenses'::text AND "Accounts"."default" = true
                        LEFT JOIN "BillingPaymentLines" on "BillingPaymentLines"."billingPaymentId" = "BillingPayments".id and "BillingPayments"."paymentDate" <> "BillingPaymentLines"."createdAt"::date 
                        where "BillingPayments".id = "values" ."paymentId"
                        
                        GROUP BY  "BillingPayments".id, "Accounts".id,"BillingPaymentLines"."createdAt","BillingPaymentLines",  "BillingPaymentLines".id 
                        having  sum("BillingPaymentLines".amount::text::numeric)::double precision  >0 

                      union all 
                        SELECT 
                         sum("BillingPaymentLines".amount::text::numeric)::double precision    as "total",
                        "BillingPaymentLines"."createdAt" as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "BillingPaymentLines".id as "referenceId",
                         COALESCE( "BillingPaymentLines"."branchId",  "BillingPayments"."branchId") as "branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
                        FROM "BillingPayments"
                        INNER JOIN "values" on true 
                        LEFT JOIN "BillingPaymentLines" on "BillingPaymentLines"."billingPaymentId" = "BillingPayments".id and "BillingPayments"."paymentDate" <> "BillingPaymentLines"."createdAt"::date 
                        LEFT JOIN "Billings" ON "Billings".id = "BillingPaymentLines"."billingId"
                        INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND (("Accounts".id = "Billings"."payableAccountId"  ) or ("Billings"."payableAccountId" is null  AND "Accounts".type::text = 'Account Payable'::text AND "Accounts".name::text = 'Account Payable'::text AND "Accounts"."default" = true ))
                        where "BillingPayments".id = "values" ."paymentId"
                      
                        GROUP BY  "BillingPayments".id, "Accounts".id ,"BillingPaymentLines"."createdAt","BillingPaymentLines",  "BillingPaymentLines".id 
                        having  sum("BillingPaymentLines".amount::text::numeric)::double precision  >0 
                    
                    
                    
                    )
                    
                    select * from "Journals"`,
                values: [paymentId, companyId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            await this.validateJournalBalance(client, journals, companyId);
            await this.deleteJournals(client, [paymentId])
            await this.deleteLinesIds(client, [paymentId], 'Billing Payment', companyId)
            await this.saveJournal(client, journals, 'Billing Payment', supplier, companyId);
            await client.query("COMMIT");


        } catch (error: any) {
          
            await client.query("ROLLBACK");
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    /**Billings */
    public static async billingJournal(billing: string, companyId: string) {
        const client = await DB.excu.client(500)
        try {
            /**
             * ACCOUNTS :
             * - PAYABLE : "CREDIT"-> IS SELECTED BY THE USER (NOTE THAT IN THE QUERY IF THE PAYABLE ACCOUNT IS NULL ITS SET TO THE DEFAULT PAYABLE ACCOUNT)
             * - LINE ACCOUNTS : "DEBIT" 
             * - INPUT VAT : "DEBIT"
             */
            await client.query("BEGIN")
            let supplier = await this.getUser(client, "Billings", "Suppliers", billing, companyId)

            const query = {
                text: `with "values" as (
                    select   $1::uuid as "billingId" ,
                           $2::uuid as "companyId" 
                ), "Journals" as (
					   SELECT 
						"Billings"."total"::text::numeric * -1   as "total",
                        "billingDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "Billings".id as "referenceId",
                        "Billings"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                       "Billings"."billingNumber" as "code"
					    FROM "Billings"
					    INNER JOIN "values" on true 
					    INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND (("Accounts".id = "Billings"."payableAccountId")  or ("Billings"."payableAccountId" is null  AND "Accounts".type::text = 'Account Payable'::text AND "Accounts".name::text = 'Account Payable'::text AND "Accounts"."default" = true ))
					    where "Billings".id = "values" ."billingId"
						AND "Billings".status::text <> 'Draft'::text
						
					   UNION ALL 
					     SELECT 
					   case when  lower("Accounts"."name") = lower('Inventory Assets') and  "Accounts"."default" = true then  sum("BillingLines"."baseAmount" - "BillingLines"."discountTotal") 
					   else sum(case when "BillingLines"."isInclusiveTax" then "BillingLines"."subTotal" - COALESCE("BillingLines"."taxTotal") else  "BillingLines"."subTotal" end )  end 
					   as "total",
                        "billingDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "Billings".id as "referenceId",
                        "Billings"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                       "Billings"."billingNumber" as "code"
					    FROM "Billings"
					    INNER JOIN "values" on true 
					    JOIN "BillingLines" ON "Billings".id = "BillingLines"."billingId" 
						INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".id = "BillingLines"."accountId"
					    where "Billings".id = "values" ."billingId"
					    AND "Billings".status::text <> 'Draft'::text
						 AND "BillingLines"."parentId" is null 
					    GROUP BY "Billings".id, "Accounts".id
						
						UNION ALL 

                         SELECT 
					 case when  lower("lineAccount"."name") = lower('Inventory Assets') and  "lineAccount"."default" = true then  "Billings"."discountTotal"::text::numeric else 
					   sum("BillingLines"."discountTotal" + "BillingLines"."billDiscount" ) 
					   end * -1   as "total",
                        "billingDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "Billings".id as "referenceId",
                        "Billings"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                       "Billings"."billingNumber" as "code"
					    FROM "Billings"
					    INNER JOIN "values" on true 
					   	JOIN "BillingLines" ON "Billings".id = "BillingLines"."billingId" 
					    INNER JOIN "Accounts" "lineAccount"  ON "lineAccount"."companyId" = "values"."companyId" AND "lineAccount".id = "BillingLines"."accountId"
					    INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".name::text = 'Purchase Discounts'::text AND "Accounts"."default" = true 
					    where "Billings".id = "values" ."billingId"
         
						AND "Billings".status::text <> 'Draft'::"text"
					   group by "Billings".id ,   "Accounts".id ,"lineAccount".id

    

                        UNION ALL
						  
					     SELECT 
						 
						sum("BillingLines"."taxTotal"::text::numeric)   as "total",
                        "billingDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "Billings".id as "referenceId",
                        "Billings"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                       "Billings"."billingNumber" as "code"
					    FROM "Billings"
					    INNER JOIN "values" on true 
					    JOIN "BillingLines" ON "Billings".id = "BillingLines"."billingId" 
						INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND  "Accounts".name::text = 'Input Vat'::text AND "Accounts"."default" = true
					    where "Billings".id = "values" ."billingId"
					    AND "Billings".status::text <> 'Draft'::text
						 AND "BillingLines"."parentId" is null 
						AND "taxTotal"<>0
					    GROUP BY "Billings".id, "Accounts".id

                        union all
                            select 
                
                           sum("Billings"."roundingTotal"::text::numeric)   as "total",
                        "billingDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "Billings".id as "referenceId",
                        "Billings"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                       "Billings"."billingNumber" as "code"
                        from "Billings"
                        JOIN "values" on true
                        inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Rounding'::text AND "Accounts"."default" = true
                        where  "Billings".id = "values"."billingId"
                        and "Billings"."roundingTotal" <>0
                             AND "Billings"."status" <> 'Draft' 
                        group by "journalDate" , "Accounts".id,"Billings"."id"
                                    

					)
					
					select* from "Journals"
					where "total" <> 0  
					
					`,
                values: [billing, companyId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            /** because journal is saved after bill is updated and is 
             * some cases the user might change the account payable cannot determined the change in billings 
             * so delete the prvious journal and add again 
             * */
            await this.validateJournalBalance(client, journals, companyId);
            await this.deleteJournals(client, [billing])

            await this.saveJournal(client, journals, 'Billing', supplier, companyId);
            await client.query("COMMIT")
        } catch (error: any) {
         
            await client.query("ROLLBACk")
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    /**Supplier Credits */
    public static async supplierCreditJournal(supplierCreditId: string, companyId: string) {

        const client = await DB.excu.client(500);
        try {
            /**
            * OPPSITE TO THE BILLING JOURNAL 
            * ACCOUNTS :
            * - PAYABLE : "DEBIT"-> IS SELECTED BY THE USER (NOTE THAT IN THE QUERY IF THE PAYABLE ACCOUNT IS NULL ITS SET TO THE DEFAULT PAYABLE ACCOUNT)
            * - LINE ACCOUNTS : "CREDIT" 
            * - INPUT VAT : "CREDIT"
            * - Rounding 
            */
            await client.query("BEGIN")
            let supplier = await this.getUser(client, "SupplierCredits", "Suppliers", supplierCreditId, companyId)

            const query = {
                text: `with "values" as (
                    select   $1::uuid as "supplierCreditId" ,
                             $2::uuid as "companyId" 
                              ), "Journals" as  (
					   SELECT 
						"SupplierCredits"."total"  as "total",
                        "supplierCreditDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "SupplierCredits".id as "referenceId",
                        "SupplierCredits"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                       "SupplierCredits"."supplierCreditNumber" as "code"
					    FROM "SupplierCreditLines"
					    INNER JOIN "values" on true 
						inner join "SupplierCredits" on "SupplierCredits".id = "SupplierCreditLines"."supplierCreditId"
                        INNER JOIN "BillingLines" ON "BillingLines".id = "SupplierCreditLines"."billingLineId"
                        INNER JOIN "Billings" ON "Billings".id = "BillingLines"."billingId"
					    INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId"  AND (("Accounts".id = "Billings"."payableAccountId")  or ("Billings"."payableAccountId" is null  AND "Accounts".type::text = 'Account Payable'::text AND "Accounts".name::text = 'Account Payable'::text AND "Accounts"."default" = true ))
					    where "SupplierCredits".id = "values" ."supplierCreditId"
						group by      "SupplierCredits".id,  "Accounts".id
						
					   UNION ALL 
					     SELECT 
                       case when  lower("Accounts"."name") = lower('Inventory Assets') and  "Accounts"."default" = true then  sum("SupplierCreditLines"."baseAmount" - "SupplierCreditLines"."discountTotal")
						else sum(case when "SupplierCreditLines"."isInclusiveTax" then "SupplierCreditLines"."subTotal" - COALESCE("SupplierCreditLines"."taxTotal") else  "SupplierCreditLines"."subTotal" end )  end  * -1 as "total",
                        "supplierCreditDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "SupplierCredits".id as "referenceId",
                        "SupplierCredits"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                       "SupplierCredits"."supplierCreditNumber" as "code"
					    FROM "SupplierCredits"
					    INNER JOIN "values" on true 
					    JOIN "SupplierCreditLines" ON "SupplierCredits".id = "SupplierCreditLines"."supplierCreditId" 
						INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".id = "SupplierCreditLines"."accountId"
					    where "SupplierCredits".id = "values" ."supplierCreditId"
					 
					    GROUP BY "SupplierCredits".id, "Accounts".id
						
						UNION ALL 
						  
					     SELECT 
						 
						sum("SupplierCreditLines"."taxTotal"::text::numeric)  * -1  as "total",
                        "supplierCreditDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "SupplierCredits".id as "referenceId",
                        "SupplierCredits"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                       "SupplierCredits"."supplierCreditNumber" as "code"
					    FROM "SupplierCredits"
					    INNER JOIN "values" on true 
					    JOIN "SupplierCreditLines" ON "SupplierCredits".id = "SupplierCreditLines"."supplierCreditId" 
						INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND  "Accounts".name::text = 'Input Vat'::text AND "Accounts"."default" = true
					    where "SupplierCredits".id = "values" ."supplierCreditId"
					
						AND "taxTotal"<>0
					    GROUP BY "SupplierCredits".id, "Accounts".id

                        union all
                         SELECT 
						  case when  lower("lineAccount"."name") = lower('Inventory Assets') and  "lineAccount"."default" = true then sum( COALESCE("SupplierCreditLines"."supplierCreditDiscount",0)  )
								   
						else    sum("SupplierCreditLines"."discountTotal" + "SupplierCreditLines"."supplierCreditDiscount" )  end as "total",
                        "supplierCreditDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "SupplierCredits".id as "referenceId",
                        "SupplierCredits"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                       "SupplierCredits"."supplierCreditNumber" as "code"
					    FROM "SupplierCredits"
                        INNER JOIN "SupplierCreditLines" ON "SupplierCreditLines"."supplierCreditId" = "SupplierCredits".id 
					    INNER JOIN "values" on true 
						INNER JOIN "Accounts" "lineAccount"  ON "lineAccount"."companyId" = "values"."companyId" AND "lineAccount".id = "SupplierCreditLines"."accountId"
					    INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".name::text = 'Purchase Discounts'::text 
					    where "SupplierCredits".id = "values" ."supplierCreditId"
           
                        group by   "supplierCreditDate"  , "Accounts".id  , "SupplierCredits".id ,"lineAccount".id


                        union all
                        select  
                        sum("SupplierCredits"."roundingTotal"::text::numeric)  *-1 as "total",
                        "supplierCreditDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "SupplierCredits".id as "referenceId",
                        "SupplierCredits"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                       "SupplierCredits"."supplierCreditNumber" as "code"
                        from "SupplierCredits"
                        JOIN "values" on true
                        inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Rounding'::text AND "Accounts"."default" = true
                        where  "SupplierCredits".id = "values"."supplierCreditId"
                        and "SupplierCredits"."roundingTotal" <>0
                        group by "journalDate" , "Accounts".id,"SupplierCredits"."id"
					)
					
					select * from "Journals"
                    where "total" <> 0 
					
					`,
                values: [supplierCreditId, companyId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            await this.validateJournalBalance(client, journals, companyId);
            await this.deleteJournals(client, [supplierCreditId])
            await this.saveJournal(client, journals, 'Supplier Credits', supplier, companyId);
            await client.query("COMMIT")
        } catch (error: any) {
      
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    /** Inventory Transfers */
    public static async inventoryTransferJournal(inventoryTransferId: string, destinationBranch: string, companyId: string) {
        const client = await DB.excu.client(500)
        try {
            /**
             * TWO TYPES OF TRANSFER 
             * IN :
             *  - INVENTORY ASSETS : "DEBIT"
             *  - COGS :"CREDIT"
             * 
             * OUT : 
             * FROM BRANCH :
             *  - INVENTORY ASSETS : "CREDIT"
             *  - COGS :"DEBIT"
             * TO BRANCH :  ONLY WHEN REASON TO ANOTHER BRANCH (DESTINATION BRANCH IS NOT NULL )
             *  - INVENTORY ASSETS : "DEBIT"
             *  - COGS :"CREDIT"
             */
            client.query("BEGIN")

            const query = {
                text: `with "values" as (
                    select  $1::uuid as "inventoryTransferId" ,
                            $2::uuid as "companyId" 
                    ), "Journals" as (
					   select 
						sum("InventoryTransferLines".qty::text::numeric * "InventoryTransferLines"."unitCost"::text::numeric)   as "total",
                        "confirmDatetime"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "InventoryTransfers".id as "referenceId",
                        "InventoryTransfers"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
					   from "InventoryTransfers"
					   JOIN "values" ON TRUE 
					   LEFT JOIN "InventoryTransferLines" ON "InventoryTransferLines"."inventoryTransferId" = "InventoryTransfers".id
					   LEFT JOIN "Products" ON "InventoryTransferLines"."productId" = "Products".id
					   INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Inventory Assets'::text AND "Accounts"."default" = true
					   WHERE "InventoryTransfers".id = "values"."inventoryTransferId"
					   AND "InventoryTransfers".status = 'Confirmed'::text AND "InventoryTransfers".type = 'Transfer In'::text AND ("Products".type::text = 'inventory'::text OR "Products".type::text = 'kit'::text OR "Products".type::text = 'batch'::text AND "InventoryTransferLines"."parentId" IS NOT NULL OR "Products".type::text = 'serialized'::text AND "InventoryTransferLines"."parentId" IS NOT NULL)
					   and "InventoryTransfers"."destinationBranch" is null 
                       GROUP BY "InventoryTransfers".id, "Accounts".id
						
					   UNION ALL
					    
						select 
					    sum("InventoryTransferLines".qty::text::numeric * "InventoryTransferLines"."unitCost"::text::numeric) * '-1'  as "total",
                        "confirmDatetime"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "InventoryTransfers".id as "referenceId",
                        "InventoryTransfers"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
					   from "InventoryTransfers"
					   JOIN "values" ON TRUE 
					   LEFT JOIN "InventoryTransferLines" ON "InventoryTransferLines"."inventoryTransferId" = "InventoryTransfers".id
					   LEFT JOIN "Products" ON "InventoryTransferLines"."productId" = "Products".id
					   INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Costs Of Goods Sold'::text AND "Accounts"."default" = true
					   WHERE "InventoryTransfers".id = "values"."inventoryTransferId"
					   AND "InventoryTransfers".status = 'Confirmed'::text AND "InventoryTransfers".type = 'Transfer In'::text AND ("Products".type::text = 'inventory'::text OR "Products".type::text = 'kit'::text OR "Products".type::text = 'batch'::text AND "InventoryTransferLines"."parentId" IS NOT NULL OR "Products".type::text = 'serialized'::text AND "InventoryTransferLines"."parentId" IS NOT NULL)
                       	   and "InventoryTransfers"."destinationBranch" is null 
                       GROUP BY "InventoryTransfers".id, "Accounts".id
						
				
						
						UNION ALL 						
						select 
					    sum("InventoryTransferLines".qty::text::numeric * "InventoryTransferLines"."unitCost"::text::numeric) *(-1)    as "total",
                        "confirmDatetime"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "InventoryTransfers".id as "referenceId",
                        "InventoryTransfers"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
					   from "InventoryTransfers"
					   JOIN "values" ON TRUE 
					   LEFT JOIN "InventoryTransferLines" ON "InventoryTransferLines"."inventoryTransferId" = "InventoryTransfers".id
					   LEFT JOIN "Products" ON "InventoryTransferLines"."productId" = "Products".id
					   INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Inventory Assets'::text AND "Accounts"."default" = true
					   WHERE "InventoryTransfers".id = "values"."inventoryTransferId"
                       AND "InventoryTransfers".status = 'Confirmed'::text AND "InventoryTransfers".type = 'Transfer Out'::text AND ("Products".type::text = 'inventory'::text OR "Products".type::text = 'kit'::text OR "Products".type::text = 'batch'::text AND "InventoryTransferLines"."parentId" IS NOT NULL OR "Products".type::text = 'serialized'::text AND "InventoryTransferLines"."parentId" IS NOT NULL)
                       	   and "InventoryTransfers"."destinationBranch" is null 
                       GROUP BY "InventoryTransfers".id, "Accounts".id
						
					   	UNION ALL 						
						select 
					    sum("InventoryTransferLines".qty::text::numeric * "InventoryTransferLines"."unitCost"::text::numeric)   as "total",
                        "confirmDatetime"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "InventoryTransfers".id as "referenceId",
                        "InventoryTransfers"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
					   from "InventoryTransfers"
					   JOIN "values" ON TRUE 
					   LEFT JOIN "InventoryTransferLines" ON "InventoryTransferLines"."inventoryTransferId" = "InventoryTransfers".id
					   LEFT JOIN "Products" ON "InventoryTransferLines"."productId" = "Products".id
					   INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Costs Of Goods Sold'::text AND "Accounts"."default" = true
					   WHERE "InventoryTransfers".id = "values"."inventoryTransferId"
                       AND "InventoryTransfers".status = 'Confirmed'::text AND "InventoryTransfers".type = 'Transfer Out'::text AND ("Products".type::text = 'inventory'::text OR "Products".type::text = 'kit'::text OR "Products".type::text = 'batch'::text AND "InventoryTransferLines"."parentId" IS NOT NULL OR "Products".type::text = 'serialized'::text AND "InventoryTransferLines"."parentId" IS NOT NULL)
                       	   and "InventoryTransfers"."destinationBranch" is null 
                       GROUP BY "InventoryTransfers".id, "Accounts".id
						
					)
					
					select * from "Journals"
					
					
				`,
                values: [inventoryTransferId, companyId]
            }


            if (destinationBranch) {
                query.text = `with "values" as (
                    select  $1::uuid as "inventoryTransferId" ,
                            $2::uuid as "companyId" 
                     ), "Journals" as (
			
				
						
				 						
						select 
					    sum("InventoryTransferLines".qty::text::numeric * "InventoryTransferLines"."unitCost"::text::numeric) *(-1)    as "total",
                        "confirmDatetime"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "InventoryTransfers".id as "referenceId",
                        "InventoryTransfers"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
					   from "InventoryTransfers"
					   JOIN "values" ON TRUE 
					   LEFT JOIN "InventoryTransferLines" ON "InventoryTransferLines"."inventoryTransferId" = "InventoryTransfers".id
					   LEFT JOIN "Products" ON "InventoryTransferLines"."productId" = "Products".id
					   INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Inventory Assets'::text AND "Accounts"."default" = true
					   WHERE "InventoryTransfers".id = "values"."inventoryTransferId"
                       AND "InventoryTransfers".status = 'Confirmed'::text AND "InventoryTransfers".type = 'Transfer Out'::text AND ("Products".type::text = 'inventory'::text OR "Products".type::text = 'kit'::text OR "Products".type::text = 'batch'::text AND "InventoryTransferLines"."parentId" IS NOT NULL OR "Products".type::text = 'serialized'::text AND "InventoryTransferLines"."parentId" IS NOT NULL)
                       	   and "InventoryTransfers"."destinationBranch" is not null 
                       GROUP BY "InventoryTransfers".id, "Accounts".id
						
						
						UNION ALL 		
				 						
						select 
					    sum("InventoryTransferLines".qty::text::numeric * "InventoryTransferLines"."unitCost"::text::numeric)    as "total",
                        "confirmDatetime"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "InventoryTransfers".id as "referenceId",
                        "InventoryTransfers"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
					   from "InventoryTransfers"
					   JOIN "values" ON TRUE 
					   LEFT JOIN "InventoryTransferLines" ON "InventoryTransferLines"."inventoryTransferId" = "InventoryTransfers".id
					   LEFT JOIN "Products" ON "InventoryTransferLines"."productId" = "Products".id
					   INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".name::text = 'Inventory in Transit'::text AND "Accounts"."default" = true
					   WHERE "InventoryTransfers".id = "values"."inventoryTransferId"
                       AND "InventoryTransfers".status = 'Confirmed'::text AND "InventoryTransfers".type = 'Transfer Out'::text AND ("Products".type::text = 'inventory'::text OR "Products".type::text = 'kit'::text OR "Products".type::text = 'batch'::text AND "InventoryTransferLines"."parentId" IS NOT NULL OR "Products".type::text = 'serialized'::text AND "InventoryTransferLines"."parentId" IS NOT NULL)
                       	   and "InventoryTransfers"."destinationBranch" is  not null 
                       GROUP BY "InventoryTransfers".id, "Accounts".id
						
						UNION ALL 
						
							select 
					    sum("InventoryTransferLines".qty::text::numeric * "InventoryTransferLines"."unitCost"::text::numeric)     as "total",
                        "confirmDatetime"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "InventoryTransfers".id as "referenceId",
                        "InventoryTransfers"."destinationBranch" AS "branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
					   from "InventoryTransfers"
					   JOIN "values" ON TRUE 
					   LEFT JOIN "InventoryTransferLines" ON "InventoryTransferLines"."inventoryTransferId" = "InventoryTransfers".id
					   LEFT JOIN "Products" ON "InventoryTransferLines"."productId" = "Products".id
					   INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Inventory Assets'::text AND "Accounts"."default" = true
					   WHERE "InventoryTransfers".id = "values"."inventoryTransferId"
                       AND "InventoryTransfers".status = 'Confirmed'::text AND "InventoryTransfers".type = 'Transfer Out'::text AND ("Products".type::text = 'inventory'::text OR "Products".type::text = 'kit'::text OR "Products".type::text = 'batch'::text AND "InventoryTransferLines"."parentId" IS NOT NULL OR "Products".type::text = 'serialized'::text AND "InventoryTransferLines"."parentId" IS NOT NULL)
                       	   and "InventoryTransfers"."destinationBranch"  is not null
                       GROUP BY "InventoryTransfers".id, "Accounts".id
						
					UNION ALL 		
				 						
						select 
					    sum("InventoryTransferLines".qty::text::numeric * "InventoryTransferLines"."unitCost"::text::numeric) * (-1)   as "total",
                        "confirmDatetime"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "InventoryTransfers".id as "referenceId",
                         "InventoryTransfers"."destinationBranch" as "branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
					   from "InventoryTransfers"
					   JOIN "values" ON TRUE 
					   LEFT JOIN "InventoryTransferLines" ON "InventoryTransferLines"."inventoryTransferId" = "InventoryTransfers".id
					   LEFT JOIN "Products" ON "InventoryTransferLines"."productId" = "Products".id
					   INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".name::text = 'Inventory in Transit'::text AND "Accounts"."default" = true
					   WHERE "InventoryTransfers".id = "values"."inventoryTransferId"
                       AND "InventoryTransfers".status = 'Confirmed'::text AND "InventoryTransfers".type = 'Transfer Out'::text AND ("Products".type::text = 'inventory'::text OR "Products".type::text = 'kit'::text OR "Products".type::text = 'batch'::text AND "InventoryTransferLines"."parentId" IS NOT NULL OR "Products".type::text = 'serialized'::text AND "InventoryTransferLines"."parentId" IS NOT NULL)
                       	   and "InventoryTransfers"."destinationBranch"  is not null
                       GROUP BY "InventoryTransfers".id, "Accounts".id
						
						
			
						
					)
					
					select * from "Journals"`
            }
            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            await this.deleteJournals(client, [inventoryTransferId])
            await this.saveJournal(client, journals, 'Inventory Transfer', null, companyId);
            client.query("COMMIT")

        } catch (error: any) {
      
            client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()

        }
    }

    /**  CreditNote Refunds*/
    public static async creditNoteRefundJournal(refundIds: string, companyId: string) {
        const client = await DB.excu.client(500);
        try {
            /**
             * ACCOUNTS :
             * RECEIVABLE :"DEBIT"
             * PAYMENT METHOD ACCOUNT :"CREDIT"
             */
            await client.query("BEGIN")

            for (let index = 0; index < refundIds.length; index++) {
                const refundId = refundIds[index];
                let customer = await this.getUser(client, "CreditNoteRefunds", "Customers", refundId, companyId)

                const query = {
                    text: `with "values" as (
                        select  $1::uuid as "refundId" ,
                                $2::uuid as "companyId" 
                        ), "Journals" as (
                           select 
                            sum("CreditNoteRefundLines".amount::text::numeric)   * '-1' as "total",
                            "refundDate"  as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "CreditNoteRefunds".id as "referenceId",
                            "CreditNoteRefunds"."branchId",
                            null::uuid as  "salesEmployeeId",
                            null::uuid as  "chargeId",
                            NULL as "code"
                           from "CreditNoteRefunds"
                           JOIN "values" ON TRUE 
                           LEFT JOIN "CreditNoteRefundLines" ON "CreditNoteRefundLines"."creditNoteRefundId" = "CreditNoteRefunds".id
                           INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND  "Accounts".id = "CreditNoteRefundLines"."accountId"
                           WHERE "CreditNoteRefunds".id = "values"."refundId"
                           GROUP BY "CreditNoteRefunds".id, "Accounts".id
                           
                          union all 
                            
                             select 
                             "CreditNoteRefunds".total::text::numeric as "total",
                            "refundDate"  as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "CreditNoteRefunds".id as "referenceId",
                            "CreditNoteRefunds"."branchId",
                            null::uuid as  "salesEmployeeId",
                            null::uuid as  "chargeId",
                            NULL as "code"
                           from "CreditNoteRefunds"
                           JOIN "values" ON TRUE 
                           INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Account Receivable'::text AND "Accounts".name::text = 'Account Receivable'::text AND "Accounts"."default" = true
                           WHERE "CreditNoteRefunds".id = "values"."refundId"
                           GROUP BY "CreditNoteRefunds".id, "Accounts".id	
                        )
                        
                        select * from "Journals"
    
                        
                        
                    `,
                    values: [refundId, companyId]
                }

                let journal = await client.query(query.text, query.values);
                const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
                await this.validateJournalBalance(client, journals, companyId);
                await this.deleteJournals(client, [refundId])
                await this.saveJournal(client, journals, 'Credit Note Refunds', customer, companyId);
            }

            await client.query("COMMIT")

        } catch (error: any) {
     
            await client.query("ROLLBACK")

            throw new Error(error)

        } finally {
            client.release()
        }
    }

    /**  Applied Credit */
    public static async appliedCreditJournal(appliedCreditId: string, companyId: string) {
        const client = await DB.excu.client(500)
        try {

            await client.query("BEGIN")
            let customer = await this.getUser(client, "AppliedCredits", "Customers", appliedCreditId, companyId)
            /**
            * ACCOUNTS :
            * RECEIVABLE :"CREDIT"
            * CUSTOMER CREDIT :"DEBIT"
            */
            const query = {
                text: `with "values" as (
                    select  $1::uuid as "appliedCreditId" ,
                            $2::uuid as "companyId" 
                    ), "Journals" as (
					   select 
						"AppliedCredits".amount::text::numeric   * '-1' as "total",
                        "appliedCreditDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "AppliedCredits".id as "referenceId",
                        "Branches".id as "branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
					   from "AppliedCredits"
					   JOIN "values" ON TRUE 
					   JOIN "Invoices" ON "Invoices".id = "AppliedCredits"."invoiceId"
                       JOIN "Branches" ON "Branches".id = "Invoices"."branchId"
					   INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Account Receivable'::text AND "Accounts".name::text = 'Account Receivable'::text AND "Accounts"."default" = true
					   WHERE "AppliedCredits".id = "values"."appliedCreditId"
					   GROUP BY "AppliedCredits".id, "Accounts".id,    "Branches".id
					   
						union all 
						
						 select 
						"AppliedCredits".amount::text::numeric   as "total",
                        "appliedCreditDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "AppliedCredits".id as "referenceId",
                        "Branches".id as "branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
					   from "AppliedCredits"
					   JOIN "values" ON TRUE 
					   JOIN "Invoices" ON "Invoices".id = "AppliedCredits"."invoiceId"
                       JOIN "Branches" ON "Branches".id = "Invoices"."branchId"
					   INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Customer Credit'::text AND "Accounts"."default" = true
					   WHERE "AppliedCredits".id = "values"."appliedCreditId"
					   GROUP BY "AppliedCredits".id, "Accounts".id,    "Branches".id
			
					)
					
					select * from "Journals"
					
				`,
                values: [appliedCreditId, companyId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            await this.validateJournalBalance(client, journals, companyId);
            await this.deleteJournals(client, [appliedCreditId])
            await this.saveJournal(client, journals, 'Applied Credit', customer, companyId);
            await client.query("COMMIT")
        } catch (error: any) {
      
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    /**  Manual Journal */
    public static async manualJournal(journalId: string, companyId: string) {
        const client = await DB.excu.client(500);
        try {

            /** DEPENDS ON LINE SELECTED ACCOUNT AND SIGN OF AMOUNT - CREDIT + DEBIT */
            await client.query("BEGIN")
            const query = {
                text: `with "values" as (
                    select  $1::uuid as "journalId" ,
                            $2::uuid as "companyId" 
                    ), "Journals" as (
					    select 
						"JournalLines".amount::text::numeric    as "total",
                        "journalDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "Journals".id as "referenceId",
                        "Journals"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        "JournalLines".id as "lineId",
                        NULL as "code"
					    FROM "JournalLines"
						JOIN "values"  ON TRUE
						JOIN "Accounts" ON "Accounts".id = "JournalLines"."accountId"
						JOIN "Journals" ON "Journals".id = "JournalLines"."journalId"
					    WHERE "Journals".id = "values"."journalId"
			
					)
					
					select * from "Journals"
					
				`,
                values: [journalId, companyId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            await this.validateJournalBalance(client, journals, companyId);
            await this.deleteJournals(client, [journalId])
            await this.saveJournal(client, journals, 'Journals', null, companyId);
            await client.query("COMMIT")

        } catch (error: any) {
        
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    /**  Supplier  Refunds Journal */
    public static async supplierRefundsJournal(refundId: string, companyId: string) {
        const client = await DB.excu.client(500)
        try {

            await client.query("BEGIN")
            let supplier = await this.getUser(client, "SupplierRefunds", "Suppliers", refundId, companyId)

            /**
             * ACCOUNTS: 
             * PAYMENT METHOD ACCOUNT : "DEBIT"
             * AVAILABLE CREDIT : "CREDIT"
             */
            const query = {
                text: `with "values" as (
                    select  $1::uuid as "refundId" ,
                            $2::uuid as "companyId" 
                    ), "Journals" as (
					   select 
						"SupplierRefunds".total::text::numeric   * '-1' as "total",
                        "refundedDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "SupplierRefunds".id as "referenceId",
                        "Branches".id as "branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
					    FROM "SupplierRefunds"
						JOIN "values"  ON TRUE
						JOIN "SupplierCredits" ON "SupplierCredits".id = "SupplierRefunds"."supplierCreditId"
                        JOIN "Branches" ON "SupplierCredits"."branchId" = "Branches".id
						JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Available Credit'::text AND "Accounts"."default" = true
					    WHERE "SupplierRefunds".id = "values"."refundId"
					 
						UNION ALL
						
						 select 
						sum("SupplierRefundLines".amount::text::numeric)  as "total",
                        "refundedDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "SupplierRefunds".id as "referenceId",
                        "Branches".id as "branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
					    FROM "SupplierRefunds"
						JOIN "values"  ON TRUE
						JOIN "SupplierRefundLines" ON "SupplierRefunds".id = "SupplierRefundLines"."supplierRefundId"
						JOIN "SupplierCredits" ON "SupplierCredits".id = "SupplierRefunds"."supplierCreditId"
                        JOIN "Branches" ON "SupplierCredits"."branchId" = "Branches".id
						JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".id = "SupplierRefundLines"."accountId"
					    WHERE "SupplierRefunds".id = "values"."refundId"
						GROUP BY "Accounts".id,"Branches".id,  "SupplierRefunds".id
						
					)
					
					select * from "Journals"
					
				`,
                values: [refundId, companyId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            await this.validateJournalBalance(client, journals, companyId);
            await this.deleteJournals(client, [refundId])
            await this.saveJournal(client, journals, 'Supplier Refunds', supplier, companyId);
            await client.query("COMMIT")
        } catch (error: any) {
      
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    /**  Supplier  Applied Credit Journal */
    public static async supplierAppliedCreditJournal(appliedCreditId: string, companyId: string) {
        const client = await DB.excu.client(500)
        try {
            await client.query("BEGIN")
            let supplier = await this.getUser(client, "SupplierAppliedCredits", "Suppliers", appliedCreditId, companyId)

            /**
             * ACCOUNTS: 
             * PAYABLE : "DEBIT"
             * AVAILABLE CREDIT : "CREDIT"
             */
            const query = {
                text: `with "values" as (
                        select  $1::uuid as "appliedCreditId" ,
                                $2::uuid as "companyId" 
                        ), "Journals" as (
                           select 
                            "SupplierAppliedCredits".amount::text::numeric   * '-1' as "total",
                            "appliedCreditDate"  as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "SupplierAppliedCredits".id as "referenceId",
                            "Branches".id as "branchId",
                            null::uuid as  "salesEmployeeId",
                            null::uuid as  "chargeId",
                            NULL as "code"
                            FROM "SupplierAppliedCredits"
                            JOIN "values"  ON TRUE
                            JOIN "SupplierCredits" ON "SupplierCredits".id = "SupplierAppliedCredits"."supplierCreditId"
                            JOIN "Branches" ON "SupplierCredits"."branchId" = "Branches".id
                            JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Available Credit'::text AND "Accounts"."default" = true
                            WHERE "SupplierAppliedCredits".id = "values"."appliedCreditId"
                           
                            
                            UNION ALL 
                       select 
                            "SupplierAppliedCredits".amount::text::numeric    as "total",
                            "appliedCreditDate"  as "journalDate",
                            "Accounts".name  as "accountName",
                            "Accounts".id  as "accountId",
                            "SupplierAppliedCredits".id as "referenceId",
                            "Branches".id as "branchId",
                            null::uuid as  "salesEmployeeId",
                            null::uuid as  "chargeId",
                            NULL as "code"
                            FROM "SupplierAppliedCredits"
                            JOIN "values"  ON TRUE
                            JOIN "SupplierCredits" ON "SupplierCredits".id = "SupplierAppliedCredits"."supplierCreditId"
                            JOIN "Branches" ON "SupplierCredits"."branchId" = "Branches".id
                            JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Account Payable'::text AND "Accounts".name::text = 'Account Payable'::text AND "Accounts"."default" = true
                            WHERE "SupplierAppliedCredits".id = "values"."appliedCreditId"
                           
                            
                        )
                        
                        select * from "Journals"
                        
                    `,
                values: [appliedCreditId, companyId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            await this.validateJournalBalance(client, journals, companyId);
            await this.deleteJournals(client, [appliedCreditId])
            await this.saveJournal(client, journals, 'Supplier Applied Credit', supplier, companyId);
            await client.query("COMMIT")
        } catch (error: any) {
         
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    /**  Supplier  Applied Credit Journal */
    public static async expenseJournal(expenseId: string, companyId: string) {
        const client = await DB.excu.client(500);
        try {
            client.query("BEGIN")

            /**
             * ACCOUNTS: 
             *  - PAYMENT METHOD ACCOUNT :"CREDIT" -> "TOTAL OF EXPENSE"
             *  - INPUT VAT : "DEBIT"
             *  - LINE ACCOUNT : "DEBIT"
             */
            const query = {
                text: `with "values" as (
                    select  $1::uuid as "expenseId" ,
                            $2::uuid as "companyId" 
                    ), "Journals" as (
					   select 
						"Expenses".total::text::numeric   * '-1' as "total",
                        "expenseDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "Expenses".id as "referenceId",
                        "Expenses"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
					    FROM "Expenses"
						JOIN "values"  ON TRUE
						JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".id = "Expenses"."paidThroughAccountId"
					    WHERE "Expenses".id = "values"."expenseId"
					   
						union all 
			
					    select 
						CASE
						WHEN "Expenses"."isInclusiveTax" = true THEN sum("ExpenseLines".amount::text::numeric) - sum("ExpenseLines"."taxTotal"::text::numeric)
						ELSE sum("ExpenseLines".amount::text::numeric)
					    END as "total",
                        "expenseDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "Expenses".id as "referenceId",
                        "Expenses"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
					    FROM "Expenses"
						JOIN "values"  ON TRUE
						JOIN "ExpenseLines" ON "Expenses".id = "ExpenseLines"."expenseId"
						JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".id = "ExpenseLines"."accountId"
					    WHERE "Expenses".id = "values"."expenseId"
						GROUP BY "Expenses".id, "Accounts".id
						
						UNION ALL 
						
						  select 
						
						 sum("ExpenseLines"."taxTotal"::text::numeric) as "total",
                        "expenseDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "Expenses".id as "referenceId",
                        "Expenses"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
					    FROM "Expenses"
						JOIN "values"  ON TRUE
						JOIN "ExpenseLines" ON "Expenses".id = "ExpenseLines"."expenseId"	AND "ExpenseLines"."taxTotal" <> 0 
						JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId"  AND "Accounts".name::text = 'Input Vat'::text AND "Accounts"."default" = true
					    WHERE "Expenses".id = "values"."expenseId"
					
						GROUP BY "Expenses".id, "Accounts".id

                        union all 
                           select  
                        sum("Expenses"."roundingTotal"::text::numeric)  as "total",
                        "expenseDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "Expenses".id as "referenceId",
                        "Expenses"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                       "Expenses"."expenseNumber" as "code"
                        from "Expenses"
                        JOIN "values" on true
                        inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Rounding'::text AND "Accounts"."default" = true
                        where  "Expenses".id = "values"."expenseId"
                        and "Expenses"."roundingTotal" <>0
                        group by "journalDate" , "Accounts".id,"Expenses"."id"
					)
					
					select * from "Journals"
                        
                    `,
                values: [expenseId, companyId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            await this.validateJournalBalance(client, journals, companyId);
            await this.deleteJournals(client, [expenseId])
            await this.saveJournal(client, journals, 'Expenses', null, companyId);
            client.query("COMMIT")

        } catch (error: any) {
        
            client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    /**  Inventory Movment  Journal */
    public static async inventoryMovmentJournal(movmentIds: any[], branchIds: any[]) {
        const client = await DB.excu.client(500);
        try {
            /**
             * MANUAL ADJUSMENT, KIT BUILD , PARENT - CHAILD MOVMENT 
             * ACCOUNTS : 
             *  INVENTORY ASSETS , COGS 
             *  DEPENDS ON INCREASE OR DECREASE ON PRODUCT STOCK 
             * 
             * - WHEN  INCREASE ON HAND: + 
             *   INVENTORY ASSETS -> "DEBIT"
             *   COGS -> "CREDIT"
             *
             * - WHEN  DECREASE ON HAND: -
             *   INVENTORY ASSETS -> "CREDIT"
             *   COGS -> "DEBIT"
             * 
             * 
             */
            await client.query("BEGIN")
            const query = {
                text: `with "values" as (
                    select  $1::uuid[] as "movmentIds" ,
                             $2::uuid[] as "branchIds" 
                    
                    ), "Journals" as (
					   select 
								"InventoryMovments".cost::text::numeric * -1  as "total",
                        "InventoryMovments"."createdAt"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "InventoryMovments".id as "referenceId",
                        "InventoryMovments"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code",
                        "Branches"."companyId"
					    FROM "InventoryMovments"
						JOIN "values"  ON TRUE
                        JOIN "Branches" ON "InventoryMovments"."branchId" = "Branches".id
						JOIN "Accounts" ON "Accounts"."companyId" = "Branches"."companyId" AND "Accounts".type::text = 'Inventory Assets'::text AND "Accounts"."default" = true
					    WHERE "InventoryMovments".id = any("values"."movmentIds")
                        AND "InventoryMovments"."branchId" =  any("values"."branchIds")
				        AND "InventoryMovments"."billingLineId" IS NULL AND "InventoryMovments"."invoiceLineId" IS NULL AND "InventoryMovments"."physicalCountLineId" IS NULL AND "InventoryMovments"."inventoryTransferLineId" IS NULL AND "InventoryMovments"."creditNoteLineId" IS NULL AND "InventoryMovments"."supplierCreditLineId" IS NULL
                        GROUP BY   "Branches".id , "Accounts".id , "InventoryMovments".id
                        union all 
					select 
						"InventoryMovments".cost  as "total",
                        "InventoryMovments"."createdAt"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "InventoryMovments".id as "referenceId",
                        "InventoryMovments"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code",
                        "Branches"."companyId"
					    FROM "InventoryMovments"
						JOIN "values"  ON TRUE
                        JOIN "Branches" ON "InventoryMovments"."branchId" = "Branches".id
                        JOIN "Accounts" ON "Accounts"."companyId" = "Branches"."companyId" AND "Accounts".type::text = 'Costs Of Goods Sold'::text AND "Accounts"."default" = true
					    WHERE "InventoryMovments".id = any("values"."movmentIds")
                        AND "InventoryMovments"."branchId" = any( "values"."branchIds")
				        AND "InventoryMovments"."billingLineId" IS NULL AND "InventoryMovments"."invoiceLineId" IS NULL AND "InventoryMovments"."physicalCountLineId" IS NULL AND "InventoryMovments"."inventoryTransferLineId" IS NULL AND "InventoryMovments"."creditNoteLineId" IS NULL AND "InventoryMovments"."supplierCreditLineId" IS NULL
                  
					)
					
					select * from "Journals"
					

                    
                `,
                values: [movmentIds, branchIds]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            const companyId = journals.length > 0 ? journals[0].companyId : null
            await this.validateJournalBalance(client, journals, companyId);
            await this.deleteJournals(client, [movmentIds])
            await this.saveJournal(client, journals, 'Manual Adjusment', null, companyId);
            await this.calcualteOpeningBalanceAdjusment(client, companyId);
            await client.query("COMMIT")
        } catch (error: any) {
     
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }

    }
    /**  Inventory Movment  Journal */
    public static async physicalCountJournal(physicalCountId: string, companyId: string) {
        const client = await DB.excu.client(500);
        try {

            /**
             * DEPENDS  ON INCREASE/ DECREASE ON PRODUCT ONHAND:
             * ACCOUNTS:
             * 
             * INCREASE ON HAND :
             *  - INVENTORY ASSETS : "DEBIT"
             *  - COGS : "CREDIT"
             * DECREASE ON HAND :
             *  - INVENTORY ASSETS : "CREDIT"
             *  - COGS : "DEBIT"
             */
            await client.query("BEGIN")
            const query = {
                text: `with "values" as (
                    select  $1::uuid as "physicalCountId" ,
                            $2::uuid as "companyId" 
                    ), "Journals" as (
					   select 
						    sum(("PhysicalCountLines"."enteredQty"::text::numeric - "PhysicalCountLines"."expectedQty"::text::numeric) * "PhysicalCountLines"."unitCost"::text::numeric) as "total",
                         "PhysicalCounts"."closedDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "PhysicalCounts".id as "referenceId",
                        "PhysicalCounts"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
					    FROM "PhysicalCounts"
						JOIN "values"  ON TRUE
						JOIN "PhysicalCountLines" ON "PhysicalCountLines"."physicalCountId" = "PhysicalCounts".id
						JOIN "Products" ON "PhysicalCountLines"."productId" = "Products".id
						JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Inventory Assets'::text AND "Accounts"."default" = true
					    WHERE "PhysicalCounts".id = "values"."physicalCountId"
                        AND "PhysicalCounts".status = 'Closed'::text AND ("Products".type::text = 'inventory'::text OR "Products".type::text = 'kit'::text OR "Products".type::text = 'batch'::text AND "PhysicalCountLines"."parentId" IS NOT NULL OR "Products".type::text = 'serialized'::text AND "PhysicalCountLines"."parentId" IS NOT NULL)
                        GROUP BY "PhysicalCounts".id, "Accounts".id
						
						union all 
						
						select 
						   sum(("PhysicalCountLines"."enteredQty"::text::numeric - "PhysicalCountLines"."expectedQty"::text::numeric) * "PhysicalCountLines"."unitCost"::text::numeric) * -1 AS  "total",
                        "PhysicalCounts"."closedDate"  as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "PhysicalCounts".id as "referenceId",
                        "PhysicalCounts"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        NULL as "code"
					    FROM "PhysicalCounts"
						JOIN "values"  ON TRUE
						JOIN "PhysicalCountLines" ON "PhysicalCountLines"."physicalCountId" = "PhysicalCounts".id
						JOIN "Products" ON "PhysicalCountLines"."productId" = "Products".id
						JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Costs Of Goods Sold'::text AND "Accounts"."default" = true
					    WHERE "PhysicalCounts".id = "values"."physicalCountId"
                        AND "PhysicalCounts".status = 'Closed'::text AND ("Products".type::text = 'inventory'::text OR "Products".type::text = 'kit'::text OR "Products".type::text = 'batch'::text AND "PhysicalCountLines"."parentId" IS NOT NULL OR "Products".type::text = 'serialized'::text AND "PhysicalCountLines"."parentId" IS NOT NULL)
                        GROUP BY "PhysicalCounts".id, "Accounts".id
				
					)
					
					select * from "Journals"

                `,
                values: [physicalCountId, companyId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            await this.deleteJournals(client, [physicalCountId])
            await this.saveJournal(client, journals, 'Physical Count', null, companyId);
            await client.query("COMMIT")

        } catch (error: any) {
       
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally { client.release() }
    }

    /**Opening Balance*/
    /** Inventory Opening Balance */
    /**
     * OPENING BALANCE JOUNRAL: 
     *  !!!! NOTE : OPENING BALANCE IS APPLIED ON BRANCH 
     *              THEREFORE OPENING BALANCE DATE IS SAVED IN BRANCH TABLE IF ITS NOT SET USE THE COMPANY CREATEDAT - 1 
     * 
     *  
     * ALL ACCOUNTS HAVE AN OPENING BALANCE AMOUNT (NOT REQUIRED)
     * SOME OF THE ACCOUNTS OPENING BALANCE ARE CALCULATED ['INVENTORY ASSETS', 'PAYABLE','RECEIVABLE']
     *  - INVENTORY ASSETS -> FROM PRODUCTS OPENING BALANCE IN BRANCH PRODUCT TABLE (OPENING BALANCE * OPENING BALANCE COST) ALWAYS ("DEBIT")
     *  - PAYABLE -> FROM SUPPLIER OPENING BALANCE TABLE  ALWAYS ("CREDIT")
     *  - RECEIVABLE -> FROM CUSTOMER OPENING BALANCE  ALWAYS ("DEBIT")
     *  - OTHER ACCOUNTS : FROM OPENING BALANCE TABLE  (DEPENDS ON USER CHOICE) 
     *  
     *  TO BALANCE THE JOURNAL AN ACCOUNT WHERE ADDED TO BALANCE THE CREDIT AND DEBIT AMOUNT (DEBIT TOTAL = CREDIT TOTAL)
     *  - OPENING BALANCE ADJUSMENT 
     *  WHEN DEBIT IS GREATER THAN CREDIT -> "CREDIT" THE DIFFERENCE BETWEEN CREDIT AND DEBIT 
     *  WHEN CREDIT IS GREATER THAN DEBIT -> "DEBIT" THE DIFFERENCE BETWEEN CREDIT AND DEBIT 
     */
    public static async inventoryOpeningBalance(productId: any[string], companyId: string, branchIds: any[]) {
        const client = await DB.excu.client(500);
        try {


            productId = productId.filter((f: any) => f != "" && f != null)
            await client.query("BEGIN")
            const query: { text: any, values: any } = {
                text: `  with "values" as (
                    select  $1::uuid[] as "productId" ,
                            $2::uuid[] as "branchIds" 
                    ), "Journals" as ( select 
					    "BranchProducts"."openingBalance"::text::numeric * "BranchProducts"."openingBalanceCost"::text::numeric as "total",
                        case when "Branches"."openingBalanceDate" is null then "Companies"."createdAt" - interval '1 day'else "Branches"."openingBalanceDate" end   as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "BranchProducts"."productId" as "referenceId",
                        "BranchProducts"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId"
						
						
						from "Products"
						JOIN "values" ON TRUE 			  
						INNER JOIN "BranchProducts" ON  "BranchProducts"."productId" = "Products".id
						INNER JOIN "Branches" ON "Branches".id = "BranchProducts"."branchId"
						INNER JOIN "Companies" ON "Companies".id = "Branches"."companyId"
						INNER JOIN "Accounts" on "Accounts"."companyId" = "Companies".id and "Accounts".name::text = 'Inventory Assets'::text AND "Accounts".type::text = 'Inventory Assets'::text AND "Accounts"."default" = true
						where "Products".id =  any("values"."productId")	
                        and "BranchProducts"."branchId" = any("values"."branchIds")
						)
						select * from "Journals"    
                `,
                values: [productId, branchIds]
            }

            let journal = await client.query(query.text, query.values);
            const journals: any[] = journal.rows && journal.rows.length > 0 ? journal.rows : [];

            await this.deleteOpeningBalanceJournal(client, [productId], null)
            await this.saveJournal(client, journals, 'Opening Balance', null, companyId, true);
            await this.calcualteOpeningBalanceAdjusment(client, companyId)

            await client.query("COMMIT")

        } catch (error: any) {
            await client.query("ROLLBACK")
       
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    /** Supplier Opening balance */
    public static async supplierOpeningBalance(supplierId: string, companyId: string) {
        const client = await DB.excu.client(500);
        try {

            await client.query("BEGIN")
            const query = {
                text: `  with "values" as (
                    select  $1::uuid as "supplierId" ,
                            $2::uuid as "companyId" 
                    ), "Journals" as ( select 
					    "SupplierOpeningBalance"."openingBalance" *-1 as "total",
                        case when "Branches"."openingBalanceDate" is null then "Companies"."createdAt" - interval '1 day'else "Branches"."openingBalanceDate" end   as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "SupplierOpeningBalance"."supplierId" as "referenceId",
                        "SupplierOpeningBalance"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        'Supplier' as "userType",
                        "Suppliers".id as "userId",
                        "Suppliers".name as "userName"

						from "Suppliers"
						JOIN "values" ON TRUE 		
                        INNER JOIN "SupplierOpeningBalance"	   ON "SupplierOpeningBalance"."supplierId" = "Suppliers".id
						INNER JOIN "Branches" ON "Branches".id = "SupplierOpeningBalance"."branchId"
						INNER JOIN "Companies" ON "Companies".id = "Branches"."companyId"
						INNER JOIN "Accounts" on "Accounts"."companyId" = "values"."companyId" AND "Accounts".name::text = 'Account Payable'::text AND "Accounts".type::text = 'Account Payable'::text AND "Accounts"."default" = true
						where "Suppliers"."id" =  "values"."supplierId"		 
						)
						select * from "Journals"
                `,
                values: [supplierId, companyId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];

            await this.deleteOpeningBalanceJournal(client, [supplierId], null)
            await this.saveJournal(client, journals, 'Opening Balance', null, companyId);
            await this.calcualteOpeningBalanceAdjusment(client, companyId)
            await client.query("COMMIT")
        } catch (error: any) {

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    /** Customer Opening Balance */
    public static async customerOpeningBalance(customerId: string, companyId: string) {
        const client = await DB.excu.client(500)
        try {
            await client.query("BEGIN")
            const query = {
                text: ` with "values" as (
                    select  $1::uuid as "customerId" ,
                            $2::uuid as "companyId" 
                    ), "Journals" as ( select 
					   "CustomerOpeningBalance"."openingBalance" as "total",
                        case when "Branches"."openingBalanceDate" is null then "Companies"."createdAt" - interval '1 day'else "Branches"."openingBalanceDate" end   as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "CustomerOpeningBalance"."customerId" as "referenceId",
                        "CustomerOpeningBalance"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId",
                        'Customer' as "userType",
                        "Customers".id as "userId",
                        "Customers".name as "userName"

						from "Customers"
						JOIN "values" ON TRUE 		
                        INNER JOIN "CustomerOpeningBalance"	   ON "CustomerOpeningBalance"."customerId" = "Customers".id
						INNER JOIN "Branches" ON "Branches".id = "CustomerOpeningBalance"."branchId"
						INNER JOIN "Companies" ON "Companies".id = "Branches"."companyId"
						INNER JOIN "Accounts" on "Accounts"."companyId" = "values"."companyId" AND  "Accounts".name::text = 'Account Receivable'::text AND "Accounts".type::text = 'Account Receivable'::text AND "Accounts"."default" = true
						where "Customers"."id" =  "values"."customerId"			 
						)
						select * from "Journals"
                `,
                values: [customerId, companyId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];

            await this.deleteOpeningBalanceJournal(client, [customerId], null)
            await this.saveJournal(client, journals, 'Opening Balance', null, companyId);
            await this.calcualteOpeningBalanceAdjusment(client, companyId)

            await client.query("COMMIT")
        } catch (error: any) {


            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    /**Accounts Opening  Balance */
    public static async accountsOpeningBalance(companyId: string, branchId: string) {
        const client = await DB.excu.client(500)
        try {

            await client.query("BEGIN")
            /** THE FOLLOWING ACCOUNTS OPENING BALANCE ARE CALCUALTED WHENERVER A PRODUCT, CUSTOMER OR SUPPLIER OPENING BALANCE IS ENETERD 
             * AT FIRST THE USER MIGHT HAVE AN OPENING BALANCE WITHOUT SETTING OPENING BALANCE DATE IN THIS CASE THE DATE OF THE OPENING BALANCE
             * WILL BE ASSIGNED TO THE COMPANY CREATEDAT - 1 DAY 
             * WHEN THE USER CHANGES THE DATE TEH RECORDS DATE WILL BE CHANGED THEREFORE DELETEING AND INSERTING THE RECORDS TO AVOID DUPLICATION 
             * 
             * ID OF RECORDS ARE THE ACCOUNID+REFERENCEID+CREATEDAT : FOLLOWING ONE PATTERN FOR ALL RECORDS 
             * 
             */

            await client.query(`	delete from "JournalRecords" where "dbTable" = 'Opening Balance'      
            and "companyId" =$1
            and "branchId" = $2
            `, [companyId, branchId])

            const query: { text: any, values: any } = {
                text: ` with "values" as (
                    select 
                           $1::uuid as "companyId", 
                           $2::uuid as "branchId"
	                   
                      
                    ), "customerOpeningBalance" as (
					
						select sum("CustomerOpeningBalance"."openingBalance"::text::numeric) as "total",
						       case when "Branches"."openingBalanceDate" is null then "Companies"."createdAt" - interval '1 day'else "Branches"."openingBalanceDate" end   as "journalDate",
                              "Accounts".name  as "accountName",
                              "Accounts".id  as "accountId",
                              "Accounts"."id" as "referenceId",
                              "CustomerOpeningBalance"."branchId",
						   null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId"

						
						from "CustomerOpeningBalance" 
						join "values"  on true 
						INNER JOIN "Accounts" ON "Accounts"."companyId" =  "values"."companyId" and "Accounts"."name" = 'Account Receivable' and "Accounts"."default" = true
						inner join "Branches" on "Branches".id = "CustomerOpeningBalance"."branchId"
						inner join "Companies" on "Companies".id = "Branches"."companyId"
						where "CustomerOpeningBalance"."companyId" = "values"."companyId"
						and "CustomerOpeningBalance"."branchId" = "values"."branchId"
						group by  "CustomerOpeningBalance"."branchId",   "Accounts".id,"journalDate"
						
					), "supplierOpeningBalance" as (
					
						select sum("SupplierOpeningBalance"."openingBalance"::text::numeric) * (-1) as "total",
						       case when "Branches"."openingBalanceDate" is null then "Companies"."createdAt" - interval '1 day'else "Branches"."openingBalanceDate" end   as "journalDate",
                              "Accounts".name  as "accountName",
                              "Accounts".id  as "accountId",
                              "Accounts"."id" as "referenceId",
                              "SupplierOpeningBalance"."branchId",
						   null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId"

						
						from "SupplierOpeningBalance" 
						join "values"  on true 
						INNER JOIN "Accounts" ON "Accounts"."companyId" =  "values"."companyId" and "Accounts"."name" = 'Account Payable' and "Accounts"."default" = true
						inner join "Branches" on "Branches".id = "SupplierOpeningBalance"."branchId"
						inner join "Companies" on "Companies".id = "Branches"."companyId"
						where "SupplierOpeningBalance"."companyId" = "values"."companyId"
						and "SupplierOpeningBalance"."branchId" = "values"."branchId"
						group by  "SupplierOpeningBalance"."branchId",   "Accounts".id,"journalDate"
						
					)
					
					, "Journals" as ( select 
					   "OpeningBalance"."openingBalance"::text::numeric as "total",
                        case when "Branches"."openingBalanceDate" is null then "Companies"."createdAt" - interval '1 day'else "Branches"."openingBalanceDate" end   as "journalDate",
                        "Accounts".name  as "accountName",
                        "Accounts".id  as "accountId",
                        "Accounts"."id" as "referenceId",
                        "OpeningBalance"."branchId",
                        null::uuid as  "salesEmployeeId",
                        null::uuid as  "chargeId"

						from "OpeningBalance"
						JOIN "values" ON TRUE 		
                        INNER JOIN "Accounts" ON "OpeningBalance"."accountId" = "Accounts".id
						INNER JOIN "Branches" ON "Branches".id = "OpeningBalance"."branchId"
						INNER JOIN "Companies" ON "Companies".id = "Branches"."companyId"
						where "OpeningBalance"."companyId" =  "values"."companyId"	
                        and "OpeningBalance"."branchId" = "values"."branchId"	
                        and "Accounts"."name" <> 'Inventory Assets'
						and  "Accounts"."name" <> 'Account Payable'
						and  "Accounts"."name" <> 'Account Receivable'	
						union all 
						select * from "supplierOpeningBalance"
						union all 
						select * from "customerOpeningBalance"
		
						)
						select * from "Journals"
						order by "accountName" asc 
                `,
                values: [companyId, branchId]
            }
            /**
             * THE SELECT STATMENT EXCLUDE THE ACCOUNTS ['Inventory Assets','Account Payable','Account Receivable'] BECAUSE THEY ARE ALREADY SAVED 
             * IN JOUNRAL RECORDS
             */

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            const accountIdArray = journals.map((obj: any) => obj.accountId) ?? [];
            await this.deleteOpeningBalanceJournal(client, accountIdArray, branchId)
            await this.saveJournal(client, journals, 'Opening Balance', null, companyId);
            /**
             * RECALCULATE THE OPENING ADJUSMENT ACCOUNT
             * RELATE ONLY ON "JournalRecords" TABLE WHERE "dbTable" = 'Opening Balance'
             */
            await this.calcualteOpeningBalanceAdjusment(client, companyId)

            await client.query("COMMIT")
        } catch (error: any) {
       

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async calcualteOpeningBalanceAdjusment(client: PoolClient, companyId: string) {

        try {
            /**
             * THE FOLLOWING QUERY EXCLUDE THE  'Opening Balance Adjusment' ACCOUNT BECAUSE THE QUERY CALCUALTE IT'S VALUES 
             * ABS(CREDIT) - DEBIT -> IT HAS TO BE CREDIT - DEBIT IN ORDER TO GET THE RIGHT SIGN OF THE ACCOUN VALUE  
             */

            const query: { text: any, values: any } = {
                text: `with "values" as (
                    select 
                          $1::uuid as "companyId" 
                    ), "inventoryOpeningBalance" as (
					  select sum("qty"::text::numeric * "cost"::text::numeric) as "amount" , "branchId" from "InventoryMovmentRecords" where "companyId" =  $1
                        and "referenceTable" = 'Opening Balance'
					  group by "branchId"
					),"supplierOpeiningBalane" as (
					
						  select sum("openingBalance"::text::numeric) *(-1) as "amount", "branchId" from "SupplierOpeningBalance" where "companyId" =   $1
					  group by "branchId"
					),"customerOpeningBalance" as (
						  select sum("openingBalance"::text::numeric)  as "amount", "branchId" from "CustomerOpeningBalance" where "companyId" =   $1
					  group by "branchId"
					
					),"records" as (
					 select "amount" , "branchId" from "JournalRecords" 
					 where "companyId" = $1
					    and "dbTable" = 'Opening Balance'
                            and  "JournalRecords"."name" <> 'Opening Balance Adjusment'
                            and  "JournalRecords"."name" <> 'Inventory Assets'
                            and  "JournalRecords"."name" <> 'Account Payable'
                            and  "JournalRecords"."name" <> 'Account Receivable'
					
						union all 
						select * from "inventoryOpeningBalance"
						union all 
						select * from "supplierOpeiningBalane"
						union all 
						select * from "customerOpeningBalance"
					)
					,"Journals" as (
                      select 
                            ABS(coalesce( sum(case when "amount" < 0 then "amount"::text::numeric end ) ,0))  -   coalesce(sum(case when "amount" > 0 then "amount"::text::numeric end ),0)as "total",
                                                    case when "Branches"."openingBalanceDate" is null then "Companies"."createdAt" - interval '1 day'else "Branches"."openingBalanceDate" end   as "journalDate",
                                                    "Accounts".name  as "accountName",
                                                    "Accounts".id  as "accountId",
                                                    "Accounts"."id" as "referenceId",
                                                    "Branches".id as "branchId",
                                                    null::uuid as  "salesEmployeeId",
                                                    null::uuid as  "chargeId"
                            

                            fROM "records" 
                            join "values" on true
                            JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId"  and  "Accounts".name::text = 'Opening Balance Adjusment'::text AND "Accounts".type::text = 'Equity'::text AND "Accounts"."default" = true 
                            JOIN "Branches" on "Branches".id = "records"."branchId"
                            JOIN "Companies" on "Companies".id = "Branches"."companyId"
                        
                            group by "Accounts".id ,"Branches".id,"journalDate"
                            )

                            select * from "Journals"`,
                values: [companyId]
            }

            let journal = await client.query(query.text, query.values);
            await client.query(`DELETE FROM "JournalRecords" where "name" = 'Opening Balance Adjusment' and "dbTable" = 'Opening Balance' and "companyId"=$1`, [companyId])
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            await this.saveJournal(client, journals, 'Opening Balance', null, companyId);

        } catch (error: any) {

       

            throw new Error(error)
        }
    }

    public static async payOutJournal(payOutIds: any[], companyId: string) {
        const client = await DB.excu.client(500)
        try {

            await client.query("BEGIN")
            /**
             * WHAT IS PAYOUT ? : IS WHEN CASHIER WITHDRAWAL SOME AMOUNT FROM AVAILABLE BALANCE IN A PAYMENT METHOD  
             * ACCOUNTS : 
             *  - PAYOUT: "DEBIT"
             *  - PAYMENT METHOD ACCOUNT : "CREDIT" 
             */
            const query: { text: any, values: any } = {
                text: `with "values" as (
                    select $1::uuid[] "payOutIds",
                           $2::uuid "companyId"
                    
                    ),"Journals" as(
                    SELECT   "Payouts".amount::text::numeric AS "total",
                             "Payouts"."createdAt" AS "journalDate",
                            'Payout'::character varying AS "accountName",
                            "Accounts".id AS "accountId",
                            "Payouts".id AS "referenceId",
                            "Branches".id AS "branchId",
                            "Branches"."companyId"
                       FROM "Payouts"
                       JOIN "values" on true
                       INNER JOIN "Branches" on "Branches".id =  "Payouts"."branchId"
                         JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND "Accounts".name::text = 'Payout'::text AND "Accounts"."default" = true
                        where "Payouts".id = any("values"."payOutIds")
                    UNION ALL 
                     SELECT "Payouts".amount::text::numeric *(-1) AS "total",
                             "Payouts"."createdAt" AS "journalDate",
                             "Accounts".name AS "accountName",
                            "Accounts".id AS "accountId",
                            "Payouts".id AS "referenceId",
                            "Branches".id AS "branchId",
                            "Branches"."companyId"
                       FROM "Payouts"
                           JOIN "values" on true
                       INNER JOIN "Branches" on "Branches".id =  "Payouts"."branchId"
                       JOIN "Accounts" ON "Accounts".id = "Payouts"."accountId"
                    where "Payouts".id = any("values"."payOutIds")
                    )
                            select * from "Journals"
                `,
                values: [payOutIds, companyId]
            }

            let journal = await client.query(query.text, query.values);
            const journals: any[] = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            await this.validateJournalBalance(client, journals, companyId);

            await this.deleteJournals(client, [payOutIds])
            await this.saveJournal(client, journals, 'Payout', null, companyId);

            await client.query("COMMIT")
        } catch (error: any) {
            await client.query("ROLLBACK")
      
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    /** DELETE ALL JOURNALS */

    public static async deleteJournals(client: PoolClient, invoiceIds: any[]) {
        try {
            await client.query('DELETE from "JournalRecords" where "referenceId" = any($1)', [invoiceIds])
        } catch (error: any) {
       

            throw new Error(error)
        }
    }





    /** for all transactions is the same */
    public static async deleteJournal(data: any) {

        try {

            let referenceId = data.referenceId;
            let ids = data.ids; /** sometime journal uses the lines */

            let totalIds = [referenceId];
            if (ids && ids.length > 0) {
                ids.forEach((element: any) => {
                    totalIds.push(element)
                });
            }
            const query = {
                text: `DELETE FROM "JournalRecords" where "referenceId" =any($1)`,
                values: [totalIds]
            }
            await DB.excu.query(query.text, query.values);

        } catch (error: any) {
            throw new Error(error)
        }
    }
    /**Check If Journal Id Exist */
    private static async isJournalIdExist(client: PoolClient, journalId: string, branchId: string) {
        try {
            const query = {
                text: `SELECT COUNT(id) from "JournalRecords" where id=$1 and "branchId"=$2`,
                values: [journalId, branchId]
            }

            let journal = await client.query(query.text, query.values);
            if (journal.rows && journal.rows.length > 0 && journal.rows[0].count > 0) {
                return true
            }
            return false
        } catch (error: any) {
            throw new Error(error)
        }
    }

    private static async isProductOpeningBalanceExist(client: PoolClient, productId: string, branchId: string) {
        try {
            const query = {
                text: `SELECT COUNT(id) from "JournalRecords" where "referenceId"=$1 and "branchId"=$2`,
                values: [productId, branchId]
            }

            let journal = await client.query(query.text, query.values);
            if (journal.rows && journal.rows.length > 0 && journal.rows[0].count > 0) {
                return true
            }
            return false
        } catch (error: any) {
            throw new Error(error)
        }
    }
    /**
  *  Insert Jounral 
  * @param client 
  * @param journalList  list of accounts journals 
  * [{
  *  "accountId":"", 
  *  "name":"",
  *  "amount",
  *  . 
  *  . 
  * }]
  */
    public static async saveJournal(client: PoolClient, journalList: any[], dbTable: string, user: any, companyId: string | null, isProduct: boolean = false) {
        try {



            for (let index = 0; index < journalList.length; index++) {
                const element: any = journalList[index];
                const journal = new JournalModel();
                journal.ParseJson(element);

                let jounrnalId = dbTable + '_' + journal.accountName + '_' + journal.referenceId + '_' + journal.journalDate
                if (dbTable == "Journals") /** this needed because in journal it can have the same account duplicated line id  will be used to create unique id */ {
                    jounrnalId = dbTable + '_' + journal.accountName + '_' + journal.referenceId + '_' + journal.journalDate + '_' + journal.lineId
                }

                if (dbTable == 'Opening Balance') {
                    jounrnalId = dbTable + '_' + journal.accountName + '_' + journal.referenceId + '_' + journal.journalDate + '_' + journal.branchId
                }
                // let isExist = false;
                // if (isProduct) {
                //     isExist = await this.isProductOpeningBalanceExist(client, journal.referenceId, journal.branchId);
                // } else {
                //     isExist = await this.isJournalIdExist(client, jounrnalId, journal.branchId);
                // }

                journal.id = jounrnalId;
                journal.dbTable = dbTable
                journal.companyId = companyId ?? journal.companyId
                if (user) {
                    journal.userId = user.id ?? null;
                    journal.userName = user.name ?? null;
                    journal.userType = user.type ?? null;
                }



                if (Number(journal.total) != 0) {
                    await this.insertJournal(client, journal);
                }


                // if (isExist) {
                //     if (isProduct) {
                //         await this.updateProductOpeningBalanceJournal(client, journal);
                //     } else {
                //         await this.updateJournal(client, journal);
                //     }

                // } else {


                // }
            }

        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }
    private static async insertJournal(client: PoolClient, journal: JournalModel) {
        try {


            const query: { text: any, values: any } = {
                text: `INSERT INTO "JournalRecords" ("accountId",
                                                     "name",
                                                     "amount",
                                                     "referenceId",
                                                     "createdAt",
                                                     "branchId",
                                                     "companyId",
                                                     "dbTable",
                                                     "code",
                                                     "salerId",
                                                     "chargeId",
                                                     "userId",
                                                     "userName",
                                                     "userType",
                                                    "id") values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) `,
                values: [journal.accountId,
                journal.accountName,
                journal.total,
                journal.referenceId,
                journal.journalDate,
                journal.branchId,
                journal.companyId,
                journal.dbTable,
                journal.code,
                journal.salesEmployeeId,
                journal.chargeId,
                journal.userId,
                journal.userName,
                journal.userType,
                journal.id
                ]
            }
            await client.query(query.text, query.values);
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }
    private static async updateJournal(client: PoolClient, journal: JournalModel) {
        try {
            const query: { text: any, values: any } = {
                text: `UPDATE "JournalRecords" SET "createdAt"=$1,"amount"=$2,"accountId"=$3,"userId"=$4,"userName"=$5,"code"=$6  WHERE ID =$7 `,
                values: [journal.journalDate, journal.total, journal.accountId, journal.userId, journal.userName, journal.code, journal.id]
            }

            await client.query(query.text, query.values);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    private static async updateProductOpeningBalanceJournal(client: PoolClient, journal: JournalModel) {
        try {
            const query: { text: any, values: any } = {
                text: `UPDATE "JournalRecords" SET "createdAt"=$1,"amount"=$2,"accountId"=$3,"userId"=$4,"userName"=$5,"code"=$6  WHERE "referenceId" =$7 `,
                values: [journal.journalDate, journal.total, journal.accountId, journal.userId, journal.userName, journal.code, journal.referenceId]
            }

            await client.query(query.text, query.values);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async intiateVatPayment(data: any) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            const companyId = data.companyId;
            const branchId = data.branchId;
            const payableAccountId = data.payableAccountId;
            const from = data.from;
            const to = data.to;

            console.log(from, to)
            const id = data.id;

            await this.deleteJournals(client, [id])
            const Branches = await this.getVatPaymentBranches(client, companyId, from, to)

            let total = 0
            const journals: any[] = []
            if (Branches.length > 0) {

                const accounts = await this.getOutPutVatAccount(client, companyId, payableAccountId)
                if (accounts && accounts.length > 0) {

                    let outputVat = accounts.find(f => f.name == 'Output Vat')
                    let inputVat = accounts.find(f => f.name == 'Input Vat')
                    let payable = accounts.find(f => f.id == payableAccountId)
                    for (let index = 0; index < Branches.length; index++) {
                        const element = Branches[index];
                        console.log(element)
                        if (element.netVat != 0 || element.netVat != null) {
                            total += +element.netVat;
                            const journalOutPut = new JournalModel()
                            journalOutPut.branchId = element.branchId
                            journalOutPut.total = +element.outPutVat
                            journalOutPut.accountId = outputVat.id
                            journalOutPut.journalDate = to
                            journalOutPut.accountName = outputVat.name
                            journalOutPut.companyId = companyId
                            journalOutPut.referenceId = id
                            const journalInput = new JournalModel()
                            journalInput.branchId = element.branchId
                            journalInput.total = +element.inputVat * -1
                            journalInput.accountId = inputVat.id
                            journalInput.journalDate = to
                            journalInput.accountName = inputVat.name
                            journalInput.companyId = companyId
                            journalInput.referenceId = id
                            journals.push(journalOutPut)
                            journals.push(journalInput)
                        }

                    }
                    console.log(total)
                    if (total > 0) {
                        let mainBranchJounral = new JournalModel();
                        mainBranchJounral.companyId = companyId;
                        mainBranchJounral.branchId = branchId;
                        mainBranchJounral.total = total * -1;
                        mainBranchJounral.journalDate = to
                        mainBranchJounral.accountId = payableAccountId;
                        mainBranchJounral.accountName = payable.name;
                        mainBranchJounral.referenceId = id
                        journals.push(mainBranchJounral)
                    } else {
                        return
                    }
                }

            }
            console.log("jjjjjjjjjjjjjjjjjjjjj", journals)
            await this.validateJournalBalance(client, journals, companyId);

            await this.saveJournal(client, journals, 'Vat Payments', null, companyId);

            await client.query("COMMIT")
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    private static async getVatPaymentBranches(client: PoolClient, companyId: string, from: string, to: string) {
        try {
            const query = {
                text: `with "values" as (
                            select  $1::uuid as "companyId",
                                    $2::timestamp   as "from",
                                    $3::timestamp as "to"
                            ),"taxes" as (

                            select sum(("chargesTaxDetails"->>'taxTotal')::text::numeric) as "sales",
                                0 as "purchase",
								"Branches".id as "branchId"
                            from "Invoices" 
                                join "values" on true 
                            inner join "Branches" on "Branches".id = "Invoices"."branchId" 
                            where "Branches"."companyId" = "values"."companyId"
                            and "Invoices"."invoiceDate" > "values"."from" and "Invoices"."invoiceDate" <= "values"."to"
								group by 		"Branches".id
                            union all 
                            select sum("InvoiceLines"."taxTotal"::text::numeric )as "sales",
                                    0 as "purchase",
								"Branches".id as "branchId"
                            from "Invoices" 
                                    join "values" on true 
                            inner join "InvoiceLines" on "InvoiceLines"."invoiceId" = "Invoices".id
                            inner join "Branches" on "Branches".id = "Invoices"."branchId" 
                            where "Branches"."companyId" = "values"."companyId"
                            and "InvoiceLines"."createdAt" > "values"."from" and "InvoiceLines"."createdAt" <="values"."to"
									group by 		"Branches".id
                            union all 
                            select sum(("chargesTaxDetails"->>'taxTotal')::text::numeric) *-1 as "sales",
                                0 as "purchase",
								"Branches".id as "branchId"

                            from "CreditNotes" 
                                    join "values" on true 
                            inner join "Branches" on "Branches".id = "CreditNotes"."branchId" 
                            where "Branches"."companyId" = "values"."companyId"
                            and "CreditNotes"."creditNoteDate" > "values"."from" and "CreditNotes"."creditNoteDate" <= "values"."to"
                            	group by 		"Branches".id
								union all 
                            select sum("CreditNoteLines"."taxTotal"::text::numeric ) *-1 as "sales",
                                0 as "purchase",
								"Branches".id as "branchId"
                            from "CreditNotes" 
                                    join "values" on true 
                            inner join "CreditNoteLines" on "CreditNoteLines"."creditNoteId" = "CreditNotes".id
                            inner join "Branches" on "Branches".id = "CreditNotes"."branchId" 
                            where "Branches"."companyId" ="values"."companyId"
                            and "CreditNoteLines"."createdAt" > "values"."from" and "CreditNoteLines"."createdAt" <= "values"."to"
									group by 		"Branches".id
                            union all 
                            select 0 as "sales",
                                sum("BillingLines"."taxTotal"::text::numeric ) as "purchase",
								"Branches".id as "branchId"
                            from "Billings" 
                                    join "values" on true 
                            inner join "BillingLines" on "BillingLines"."billingId" = "Billings".id
                            inner join "Branches" on "Branches".id = "Billings"."branchId" 
                            where "Branches"."companyId" ="values"."companyId"
                            and "BillingLines"."createdAt" > "values"."from" and "BillingLines"."createdAt" <= "values"."to"
	group by 		"Branches".id
                            union all 
                            select 0 as "sales",
                                sum("SupplierCreditLines"."taxTotal"::text::numeric ) *-1 as "purchase",
								"Branches".id as "branchId"
                            from "SupplierCredits"
                                    join "values" on true 
                            inner join "SupplierCreditLines" on "SupplierCreditLines"."supplierCreditId" = "SupplierCredits".id
                            inner join "Branches" on "Branches".id = "SupplierCredits"."branchId" 
                            where "Branches"."companyId" = "values"."companyId"
                            and "SupplierCreditLines"."createdAt" > "values"."from" and "SupplierCreditLines"."createdAt" <= "values"."to"
                           	group by 		"Branches".id
								union all 
                            select 0 as "sales",
                                sum("ExpenseLines"."taxTotal"::text::numeric )  as "purchase",
								"Branches".id as "branchId"
                            from "Expenses" 
                                    join "values" on true 
                            inner join "ExpenseLines" on "ExpenseLines"."expenseId" = "Expenses".id
                            inner join "Branches" on "Branches".id = "Expenses"."branchId" 
                            where "Branches"."companyId" = "values"."companyId"
                            and "ExpenseLines"."createdAt" > "values"."from" and "ExpenseLines"."createdAt" <= "values"."to"
                            	group by 		"Branches".id
							)

                            select "branchId", sum("sales"::text::numeric) - sum("purchase"::text::numeric) "netVat"  , sum("sales"::text::numeric) as "outPutVat",  sum("purchase"::text::numeric) as "inputVat"  from "taxes"
							group by "branchId"`,
                values: [companyId, from, to]
            }

            const branches = await client.query(query.text, query.values);
            return branches.rows
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getOutPutVatAccount(client: PoolClient, companyId: string, payableAccountId: string) {
        try {
            const query = {
                text: `SELECT id,"name" FROM "Accounts" where "companyId" = $1 and "default" = true and ("name" = 'Output Vat' or name = 'Input Vat' or id = $2 )`,
                values: [companyId, payableAccountId]
            }

            let accounts = await client.query(query.text, query.values);
            return accounts.rows
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getAccountsName(client: PoolClient, accounts: any[]) {
        try {
            const query = {
                text: `SELECT id , name  FROM "Accounts" where id =any($1) `,
                values: [accounts]
            }

            let accountList = await client.query(query.text, query.values)

            return accountList.rows
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async vatPayment(data: any) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            const companyId = data.companyId;
            const vatPaymentId = data.vatPaymentId;
            const branchId = data.companyId;
            const payableAccountId = data.payableAccountId;
            const paymentDate = data.paymentDate;
            const amount = data.amount;
            const id = data.id;
            const paymentMethodAccountId = data.paymentMethodAccountId;
            const accounts = [paymentMethodAccountId, payableAccountId]
            const accountList = await this.getAccountsName(client, accounts);
            const journals: any[] = []
            await this.deleteJournals(client, [id])
            if (accountList && accountList.length > 0) {
                const paymentMethodAccount = accountList.find(f => f.id == paymentMethodAccountId)
                const payableAccount = accountList.find(f => f.id == payableAccountId)
                console.log(payableAccountId)
                console.log(paymentMethodAccountId)
                const payableJournal = new JournalModel()
                payableJournal.branchId = branchId
                payableJournal.total = amount
                payableJournal.accountId = payableAccount.id
                payableJournal.journalDate = paymentDate
                payableJournal.accountName = payableAccount.name
                payableJournal.companyId = companyId
                payableJournal.referenceId = id

                const paymentMethodJournal = new JournalModel()
                paymentMethodJournal.branchId = branchId
                paymentMethodJournal.total = amount * -1
                paymentMethodJournal.accountId = paymentMethodAccount.id
                paymentMethodJournal.journalDate = paymentDate
                paymentMethodJournal.accountName = paymentMethodAccount.name
                paymentMethodJournal.companyId = companyId
                paymentMethodJournal.referenceId = id
                journals.push(paymentMethodJournal)
                journals.push(payableJournal)
                console.log(journals)
                await this.validateJournalBalance(client, journals, companyId);
                await this.saveJournal(client, journals, 'Vat Payment', null, companyId);
            }

            await this.setVatPaymentStatus(client, vatPaymentId)

            await client.query("COMMIT")
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async setVatPaymentStatus(client: PoolClient, id: string) {
        try {
            const query = {
                text: `with "vatPatments" as(
                        select "VatPayments".id,
                            case when sum("VatPaymentLines"."amount") = 0 then 'Initiated'
                                when  sum("VatPaymentLines"."amount") < "netVat" then 'Partially Paid'
                                else 'Paid' end "updatedStatus"
                        from "VatPayments"
                        inner join "VatPaymentLines" ON "VatPaymentLines"."vatPaymentId" = "VatPayments".id	
                        where "VatPayments".id = $1
                            group by "VatPayments".id
                        )

                        update "VatPayments" set  "status" = "updatedStatus" from (select * from "vatPatments")t
                        where "VatPayments".id = t.id `,
                values: [id]
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async billOfEnrty(id: string, companyId: string) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            let supplier = await this.getUser(client, "BillOfEntries", "Suppliers", id, companyId)
            const query = {
                text: `with "values" as (
                            select $1::uuid as "billOfEntryId", 
                                    $2::uuid as "companyId"
                               ),"journals" as(

                            select sum("BillOfEntryLines"."taxTotal"::text::numeric) as "total",
                                "BillOfEntries"."billingOfEntryDate" as "journalDate",
                                "Accounts".name as "accountName",
                                "Accounts".id  as "accountId",
                                "BillOfEntries".id as "referenceId",
                                "BillOfEntries"."branchId",
                                "BillOfEntries"."billingOfEnrtyNumber" as "code"
                                from "BillOfEntries"
                                join "values" on true
                                inner join "BillOfEntryLines" on "BillOfEntryLines"."billOfEntryId" = "BillOfEntries".id
                                inner join "Branches" on "Branches".id = "BillOfEntries"."branchId"
                                INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND  "Accounts".name::text = 'Input Vat'::text AND "Accounts"."default" = true
                                where "BillOfEntries".id =  "values"."billOfEntryId"
                                group by "BillOfEntries".id ,    "Accounts".id
                                union all 
                                
                                
                                select sum("BillOfEntryLines"."customDuty"::text::numeric) as "total",
                                "BillOfEntries"."billingOfEntryDate" as "journalDate",
                                "Accounts".name as "accountName",
                                "Accounts".id  as "accountId",
                                "BillOfEntries".id as "referenceId",
                                "BillOfEntries"."branchId",
                                "BillOfEntries"."billingOfEnrtyNumber" as "code"
                                from "BillOfEntries"
                                join "values" on true
                                inner join "BillOfEntryLines" on "BillOfEntryLines"."billOfEntryId" = "BillOfEntries".id
                                inner join "Branches" on "Branches".id = "BillOfEntries"."branchId"
                                INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND  "Accounts".name::text = 'Custom Duty'::text AND "Accounts"."default" = true
                                where "BillOfEntries".id =  "values"."billOfEntryId"
                                  group by "BillOfEntries".id ,    "Accounts".id
                                union all 
                                    select "BillOfEntries"."total"   * -1 as "total",
                                "BillOfEntries"."billingOfEntryDate" as "journalDate",
                                "Accounts".name as "accountName",
                                "Accounts".id  as "accountId",
                                "BillOfEntries".id as "referenceId",
                                "BillOfEntries"."branchId",
                                "BillOfEntries"."billingOfEnrtyNumber" as "code"
                                from "BillOfEntries"
                                join "values" on true
                                inner join "Branches" on "Branches".id = "BillOfEntries"."branchId"
                                INNER JOIN "Accounts" ON "Accounts"."companyId" = "values"."companyId" AND  "Accounts".id = "BillOfEntries"."paymentMethodAccountId" 
                                where "BillOfEntries".id =  "values"."billOfEntryId"
                                  group by "BillOfEntries".id ,    "Accounts".id
                                union all 
                                
                                        select "BillOfEntries"."roundingTotal" as "total",
                                "BillOfEntries"."billingOfEntryDate" as "journalDate",
                                "Accounts".name as "accountName",
                                "Accounts".id  as "accountId",
                                "BillOfEntries".id as "referenceId",
                                "BillOfEntries"."branchId",
                                "BillOfEntries"."billingOfEnrtyNumber" as "code"
                                from "BillOfEntries"
                                join "values" on true
                                inner join "Branches" on "Branches".id = "BillOfEntries"."branchId"
                                    inner join "Accounts" on "Accounts"."companyId" = "values"."companyId" AND "Accounts".type::text = 'Rounding'::text AND "Accounts"."default" = true
                                where "BillOfEntries".id =  "values"."billOfEntryId"
                            )
					select * from "journals"`,
                values: [id, companyId]
            }

            let journal = await client.query(query.text, query.values);
            const journals = journal.rows && journal.rows.length > 0 ? journal.rows : [];
            /** because journal is saved after bill is updated and is 
             * some cases the user might change the account payable cannot determined the change in billings 
             * so delete the prvious journal and add again 
             * */
            await this.validateJournalBalance(client, journals, companyId);

            await this.deleteJournals(client, [id])

            await this.saveJournal(client, journals, 'Bill of Entry', supplier, companyId);
            await client.query("COMMIT")
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async journalQueue(job: any, data: any) {
        try {
            switch (data.type) {
                case 'Invoices':
                    await this.invoiceJournal(data.id, data.companyId) /** receive array of invoices ids in data.id  */
                    break;
                case 'WriteOffInvoice':
                    await this.writeOffinvoiceJournal(data.id, data.companyId)
                    break;
                case 'CreditNotes':
                    await this.creditNoteJournal(data.id, data.companyId) /** receive array of creditNotes ids in data.id  */
                    break;
                case 'InvoicePayments':
                    await this.invoicePaymentsJournal(data.id, data.companyId)  /** receive array of payments ids in data.id  */
                    break;
                case 'BillingPayments':
                    await this.billingPaymentsJournal(data.id, data.companyId)
                    break;
                case 'Billings':
                    await this.billingJournal(data.id, data.companyId)
                    break;
                case 'SupplierCredits':
                    await this.supplierCreditJournal(data.id, data.companyId)
                    break;
                case 'CreditNoteRefunds':
                    await this.creditNoteRefundJournal(data.id, data.companyId) /** receive array of refunds ids in data.id  */
                    break;
                case 'InventoryTransfer':
                // await this.inventoryTransferJournal(data.id, data.destinationBranch, data.companyId)
                // break;
                case 'AppliedCredits':
                    await this.appliedCreditJournal(data.id, data.companyId)
                    break;
                case 'ManualJournal':
                    await this.manualJournal(data.id, data.companyId)
                    break;
                case 'SupplierRefunds':
                    await this.supplierRefundsJournal(data.id, data.companyId)
                    break;
                case 'SupplierAppliedCredit':
                    await this.supplierAppliedCreditJournal(data.id, data.companyId)
                    break;
                case 'Expenses':
                    await this.expenseJournal(data.id, data.companyId)
                    break;
                // case 'OpeneingBalance':
                //     await this.inventoryOpeningBalance(data.id, data.companyId, data.branchIds)
                //     break;
                // case 'InventoryMovment':
                //     await this.inventoryMovmentJournal(data.movmentIds, data.branchIds)
                //     break;
                case 'CustomerOpeningBalance':
                    await this.customerOpeningBalance(data.id, data.companyId)
                    break;
                case 'SupplierOpeningBalance':
                    await this.supplierOpeningBalance(data.id, data.companyId)
                    break;
                case 'AccounOpeningBalance':
                    await this.accountsOpeningBalance(data.companyId, data.branchId)

                    break;
                case 'PhysicalCount':
                // await this.physicalCountJournal(data.id, data.companyId)
                // break;
                case 'updateInvoiceStatus':
                    await InvoiceStatusTriggers.updateInvoiceStatus(data.invoiceIds)

                    break;
                case 'DeleteJournal':
                    await this.deleteJournal(data)
                    break;
                case 'PayOut':
                    await this.payOutJournal(data.id, data.companyId) /** receive array of payout ids in data.id  */

                    break;
                case 'intiateVatPayment':
                    await this.intiateVatPayment(data.data) /** receive array of payout ids in data.id  */

                    break; case 'vatPayment':
                    await this.vatPayment(data.data) /** receive array of payout ids in data.id  */

                    break;


                case 'billOfEnrty':
                    await this.billOfEnrty(data.id, data.companyId) /** receive array of payout ids in data.id  */

                    break;
                default:
                    break;
            }

            return true
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    public static async deleteExtraJournals(client: PoolClient, dbTable: string, id: string) {
        try {

            let unionQuery = ``
            switch (dbTable) {
                case 'Expenses':
                    unionQuery = `   select "Expenses"."paidThroughAccountId" AS id from "Expenses" where id =$1
                                        union all 
                                        select "ExpenseLines"."accountId" as id from "ExpenseLines"
                                        where "expenseId" = $1`
                    break;
                case 'Journals':
                    unionQuery = ` 
                                            select "JournalLines"."accountId" as id from "JournalLines"
                                            where "journalId" = $1`
                    break;
                default:
                    break;
            }

            const query = {
                text: `
                    with "journal" as (
                      ${unionQuery}
                    ), ids as (

                    select "JournalRecords"."id" from "JournalRecords" where "referenceId" =$1 and "accountId" not in (select * from "journal")
                    )

                    delete from "JournalRecords" where "id"  in (select * from ids)`,
                values: [id]
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
      

            throw new Error(error)
        }
    }

    public static async deleteLinesIds(client: PoolClient, ids: any[], dbTable: string, companyId: string) {
        try {

            const query = {
                text: `   WITH lines AS (
                                SELECT ARRAY_AGG("BillingPaymentLines".id) AS "IDS"
                                FROM "BillingPaymentLines"
                                WHERE "billingPaymentId" = ANY($1::uuid[])
                            )
                            DELETE FROM "JournalRecords"
                            WHERE "referenceId" IN (SELECT unnest("IDS") FROM "lines") and "companyId" = $2;
                      `,
                values: [ids, companyId]
            }



            if (dbTable == 'Invoice') {
                query.text = `WITH lines AS (
                            SELECT ARRAY_AGG("InvoicePaymentLines".id) AS "IDS"
                            FROM "InvoicePaymentLines"
                            WHERE "invoicePaymentId" = ANY($1::uuid[])
                        )
                        DELETE FROM "JournalRecords"
                        WHERE "referenceId" IN (SELECT unnest("IDS") FROM "lines")and "companyId" = $2;
                `
                query.values = [ids, companyId]
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
       

            throw new Error(error)
        }
    }

    public static async deleteOpeningBalanceJournal(client: PoolClient, ids: any[], branchId: string | null) {
        try {
            const query = {
                text: `DELETE FROM "JournalRecords" where  "dbTable" = 'Opening Balance' and "referenceId" =any($1) and ($2::uuid is null or "branchId"= $2)`,
                values: [ids, branchId]
            }

            await client.query(query.text, query.values);
        } catch (error: any) {
     

            throw new Error(error)
        }
    }


    public static async editSupplierCreditJournal() {
        try {
            const query = {
                text: `select "SupplierCredits".id , "Branches"."companyId" from "SupplierCredits"
                    inner join "Branches" on "Branches".id = "SupplierCredits"."branchId" 
                    where "billingId" is null `,
            }

            let supplierCredits = await DB.excu.query(query.text, []);
            if (supplierCredits && supplierCredits.rows && supplierCredits.rows.length > 0) {
                for (let index = 0; index < supplierCredits.rows.length; index++) {
                    const element: any = supplierCredits.rows[index];
                    await this.supplierCreditJournal(element.id, element.companyId)
                }
            }

            return new ResponseData(true, "", [])
        } catch (error: any) {

            throw new Error(error)
        }
    }

    public static async getSurchargeTaxs(client: PoolClient, surchargeIds: any[]) {
        try {
            const query = {
                text: `SELECT "Taxes".id,
                "Taxes"."taxType",
                "Taxes"."taxes",
                "Taxes"."taxPercentage"
                FROM "Taxes" 
                inner JOIN "Surcharges" on "Taxes".id = "Surcharges"."taxId"
                WHERE "Surcharges".id = any($1)
                `,
                values: [surchargeIds]
            }

            let tax = await client.query(query.text, query.values);
            if (tax.rows && tax.rows.length > 0) {
                return new ResponseData(true, "", tax.rows)

            } else {
                return new ResponseData(true, "", null)

            }
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async invoiceChargeTax(companyId: string, invoiceId: string) {
        const client = await DB.excu.client()
        try {



            await client.query("BEGIN")
            let afterDecimal = await CompanyRepo.getCompanyAfterDecimal(client, companyId)
            let company = new Company()
            company.id = companyId;
            company.afterDecimal = afterDecimal


            const query = {
                text: `select"Invoices".id , "chargeId" from "Invoices"
                        INNER JOIN "InvoicePaymentLines" on "InvoicePaymentLines"."invoiceId" = "Invoices".id
                        where "companyId" =$1
                        group by "Invoices".id 
                        having sum("InvoicePaymentLines"."amount") > "Invoices"."total"`,
                values: [companyId]
            }

            let invoiceData = await client.query(query.text, query.values);
            let invoices = invoiceData.rows ?? [];
            let invoicesIds = invoices.map(f => { return f.id }) ?? [];
            let charges: any[] = invoices.map(f => { return f.chargeId }) ?? [];


            let chargesTax = (await this.getSurchargeTaxs(client, charges)).data;


            for (let index = 0; index < invoices.length; index++) {
                const element = invoices[index];
                let invoice = await InvoiceRepo.getFullInvoice(client, element.id);

                if (invoice.chargeId != null && invoice.chargeId != "") {
                    let chargeTax = chargesTax.find((f: any) => f.id == invoice.chargeId)
                    if (chargeTax) {
                        invoice.chargesTaxDetails = new TaxDetails()
                        invoice.chargesTaxDetails.taxId = chargeTax.id;
                        invoice.chargesTaxDetails.type = chargeTax.taxType;
                        invoice.chargesTaxDetails.taxPercentage = chargeTax.taxPercentage;
                        invoice.chargesTaxDetails.taxes = chargeTax.taxes
                    }

                }
            }

            await client.query("COMMIT")

            console.log("geeeeeeeeeeeee", "push")
            let queueInstance = TriggerQueue.getInstance();
            // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: invoicesIds })
            if (invoicesIds && invoicesIds.length > 0) {
                invoicesIds.forEach(element => {
                    InvoiceStatuesQueue.get().createJob({
                        id: element
                    } as any);
                });
            }
            queueInstance.createJob({ journalType: "Movment", type: "invoice", id: invoicesIds })
            queueInstance.createJob({ journalType: "Movment", type: "parentChildMovment", ids: invoicesIds })
            queueInstance.createJob({ type: "Invoices", id: invoicesIds, companyId: company.id })

        } catch (error: any) {

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }

    }

    public static async fixInvoiceChargeTotal(companyId: string, ids: string[] | null) {
        const client = await DB.excu.client()
        try {

            await client.query("BEGIN")
            let afterDecimal = await CompanyRepo.getCompanyAfterDecimal(client, companyId)
            let company = new Company()
            company.id = companyId;
            company.afterDecimal = afterDecimal
            if (ids && ids.length < 1) {
                ids = null
            }


            const query = {
                text: `select "Invoices".id  from "Invoices"
                        where "companyId" =$1 
                        and (id = any($2::uuid[]) or $2::uuid[] is null)
                        and "chargeAmount" > 0 and "chargeTotal" = 0 and total <> 0`,
                values: [companyId, ids]
            }

            let invoiceData = await client.query(query.text, query.values);
            let invoices = invoiceData.rows ?? [];
            let invoicesIds = invoices.map(f => { return f.id }) ?? [];


            for (let index = 0; index < invoices.length; index++) {
                const element = invoices[index];
                let invoice = await InvoiceRepo.getFullInvoice(client, element.id);
                await InvoiceRepo.editInvoice(client, invoice, company)


            }

            await client.query("COMMIT")

            console.log("geeeeeeeeeeeee", "push")
            let queueInstance = TriggerQueue.getInstance();
            // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: invoicesIds })
            if (invoicesIds && invoicesIds.length > 0) {
                invoicesIds.forEach(element => {
                    InvoiceStatuesQueue.get().createJob({
                        id: element
                    } as any);
                });
            }
            queueInstance.createJob({ journalType: "Movment", type: "invoice", id: invoicesIds })
            queueInstance.createJob({ journalType: "Movment", type: "parentChildMovment", ids: invoicesIds })
            queueInstance.createJob({ type: "Invoices", id: invoicesIds, companyId: company.id })

        } catch (error: any) {

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }

    }
}