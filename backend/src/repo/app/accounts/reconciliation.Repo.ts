import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Reconciliation, ReconciliationTransaction } from "@src/models/account/Reconciliation";
import { Company } from "@src/models/admin/company";
import { TimeHelper } from "@src/utilts/timeHelper";
import moment from "moment";
import { PoolClient } from "pg";
import { AccountsRepo } from "./account.repo";
import { query } from "express";
import { ValidationException } from "@src/utilts/Exception";
import { error } from "console";

export class ReconciliationRepo {

    /**
     * Invoices: 
     * payments => Deposits
     * refunds :Withdrawals
     * 
     * Billings:
     * payments:Withdrawals
     * refunds:Deposits
     * 
     * Expenses:Withdrawals 
     */

    public static async getRecords(data: any, company: Company) {
        const client = await DB.excu.client();
        try {


            await client.query("BEGIN")
            let companyId = company.id;
            let reconcile = data.filter.reconcile;
            let sortDirection = data.filter.sortDirection ?? 'DESC';
            let branchId = data.filter.branchId ?? null;
            let accountId = data.filter.accountId ?? null
            let fromDate = data.filter.fromDate ?? null;
            let toDate = data.filter.toDate ?? null;
            let searchValue = data.searchTerm ? data.searchTerm.toLowerCase().trim() : null
            if (fromDate != null && toDate != null) {
                fromDate = await TimeHelper.resetHours(fromDate)
                toDate = new Date(toDate)
                toDate = moment(toDate).add(1, 'day').format("YYYY-MM-DD 00:00:00");

            }


            console.log(toDate)


            // const page = data.page ? true : false ;
            const limit = data.limit ?? 15
            const page = data.page ?? 1

            let offset = limit * (page - 1)
            if (page != 1) {
                offset = (limit * (page - 1))
            }
            // const accountName = await AccountsRepo.getAccountName(client,accountId)
            const query = {
                text: `with "values" as (
                    select
                   $1::uuid as "companyId",
                    $2::uuid as "accountId",	
                    $3::uuid as "branchId",
                    $4::date as "fromDate",
                    $5::date as "toDate",
                    $6::boolean as "reconcile",
                    $7::text as "searchValue"
                    ),"transactions" as (
                    select 
                    "InvoicePayments".id ,
                     "InvoicePayments".id as "referenceId", 
                    'Invoice Payment' as "reference",
                    case when "InvoicePayments"."tenderAmount" = 0 then "InvoicePayments"."paidAmount" -  "InvoicePayments"."bankCharge"  else 	"InvoicePayments"."tenderAmount" * "InvoicePayments"."rate" -  "InvoicePayments"."bankCharge"  end as "Debit",
                    null as "Credit",
                    "paymentDate" as "date",
                   "InvoicePayments"."referenceNumber" as "referenceNumber",
					'Account Receivable'::text as "transactionDetails",
                    case when "InvoicePayments"."reconciliationId" is null then false else true end as "reconcile",
		            JSON_BUILD_OBJECT ('userName',"Customers"."name",'usertType','Customer') as "user"
                    from "InvoicePayments"
                    INNER JOIN "values" ON TRUE
                    JOIN "Branches" ON "Branches".id = "InvoicePayments"."branchId"
					left join "Customers" on "Customers".id = "InvoicePayments"."customerId"	
                    where "status" = 'SUCCESS'
                    and ( "values"."reconcile" is null or ("values"."reconcile" = true and "InvoicePayments"."reconciliationId" is not null) or ("values"."reconcile" = false and "InvoicePayments"."reconciliationId" is  null)) 
                    and "Branches"."companyId" = "values"."companyId"
                    and "InvoicePayments"."paymentMethodAccountId"  = "values"."accountId"
                    and ("values"."branchId" is null or "Branches".id = "values"."branchId")
                    and( "values"."fromDate" is null  or "paymentDate">=  "values"."fromDate") 
                    and( "values"."toDate" is null  or "paymentDate"< "values"."toDate") 
                    and ("InvoicePayments"."tenderAmount" <>0 or   "InvoicePayments"."paidAmount" <>0 )	
                    and($7::text is null or(   lower(trim("Customers"."name")) ~ $7 or 
                                               lower(trim("InvoicePayments"."referenceNumber")) ~ $7 
                                              ))
                    UNION ALL 
                        
                    select 
                    "CreditNoteRefundLines".id ,
                         null as "referenceId", 
                    'CreditNote Refund' as "reference",
                    null as "Debit", 
                    "CreditNoteRefundLines"."amount"::TEXT::NUMERIC as "Credit",
                    "refundDate" as "date",
					"CreditNoteRefunds"."refrenceNumber" as "referenceNumber",
                    'Account Receivable'::text as "transactionDetails",
                    case when "CreditNoteRefundLines"."reconciliationId" is null then false else true end as "reconcile",
					   			JSON_BUILD_OBJECT ('userName',"Customers"."name",'usertType','Customer')  as "user"
                    from "CreditNoteRefunds"
                    INNER JOIN "values" ON TRUE
                    JOIN "CreditNoteRefundLines" ON "CreditNoteRefundLines"."creditNoteRefundId" = "CreditNoteRefunds".id
						JOIN "CreditNotes" ON "CreditNotes".id =   "CreditNoteRefunds"."creditNoteId"
					join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId" 
					left join "Customers" on "Customers".id = "Invoices"."customerId"
						
                    JOIN "Branches" ON "Branches".id = "CreditNoteRefunds"."branchId"
                    and ( "values"."reconcile" is null or ("values"."reconcile" = true and "CreditNoteRefundLines"."reconciliationId" is not null) or ("values"."reconcile" = false and "CreditNoteRefundLines"."reconciliationId" is  null)) 
                    and "Branches"."companyId" = "values"."companyId"
                    and "CreditNoteRefundLines"."accountId"  = "values"."accountId"
                    and ("values"."branchId" is null or "Branches".id = "values"."branchId")
                    and( "values"."fromDate" is null  or "refundDate">=  "values"."fromDate") 
                    and(  "values"."toDate" is null  or "refundDate"< "values"."toDate") 
					and ("CreditNoteRefundLines"."amount" <>0 )	
                           and($7::text is null or(   lower(trim("Customers"."name")) ~ $7 or 
                                               lower(trim("CreditNoteRefunds"."refrenceNumber")) ~ $7 
                                              ))
                    UNION ALL
                        
                    select 
                    "BillingPayments".id ,
                          "BillingPayments".id  as "referenceId", 
                    'Billing Payment' as "reference",
                    null as "Debit", 
                    case when "BillingPayments"."tenderAmount" = 0 then "BillingPayments"."paidAmount"   else 	"BillingPayments"."tenderAmount" * "BillingPayments"."rate"   end as "Credit",
                    "paymentDate" as "date",
					"BillingPayments"."referenceNumber" as "referenceNumber",
                     'Account Payable'::text as "transactionDetails",
                    case when "BillingPayments"."reconciliationId" is null then false else true end as "reconcile",
						JSON_BUILD_OBJECT ('userName',"Suppliers"."name",'usertType','Supplier') as "user"
                    from "BillingPayments"
                    INNER JOIN "values" ON TRUE
                    JOIN "Branches" ON "Branches".id = "BillingPayments"."branchId"
						left join "Suppliers" on "Suppliers".id = "BillingPayments"."supplierId"
                    where ( "values"."reconcile" is null or ("values"."reconcile" = true and "BillingPayments"."reconciliationId" is not null) or ("values"."reconcile" = false and "BillingPayments"."reconciliationId" is  null)) 
                    and "Branches"."companyId" = "values"."companyId"
                    and "BillingPayments"."paymentMethodAccountId"  = "values"."accountId"
                    and ("values"."branchId" is null or "Branches".id = "values"."branchId")
                                        and( "values"."fromDate" is null  or "paymentDate">=  "values"."fromDate") 
                    and( "values"."toDate" is null  or "paymentDate"< "values"."toDate") 
                    and ("BillingPayments"."tenderAmount" <>0 or  "BillingPayments"."paidAmount" <>0  )
                       and($7::text is null or(   lower(trim("Suppliers"."name")) ~ $7 or 
                                               lower(trim("BillingPayments"."referenceNumber")) ~ $7 
                                              ))
                    UNION ALL
                        
                    select 
                    "SupplierRefundLines".id ,
                           null  as "referenceId", 
                    'Supplier Refund' as "reference",
                    "SupplierRefundLines"."amount" as "Debit", 
                    null as "Credit",
                    "refundedDate" as "date",
					"SupplierRefunds"."referenceNumber" as "referenceNumber",
				   'Account Payable'::text as "transactionDetails",
                    case when "SupplierRefundLines"."reconciliationId" is null then false else true end as "reconcile",
						JSON_BUILD_OBJECT ('userName',"Suppliers"."name",'usertType','Supplier') as "user"
                    from "SupplierRefunds"
                    INNER JOIN "values" ON TRUE
                    JOIN "SupplierRefundLines" on "SupplierRefundLines"."supplierRefundId" = "SupplierRefunds".id
                    JOIN "SupplierCredits" ON "SupplierCredits".id = "SupplierRefunds"."supplierCreditId"
						      
					join "Billings" on "Billings".id = "SupplierCredits"."billingId"
					left join "Suppliers" on "Suppliers".id = "Billings"."supplierId"
                    JOIN "Branches" ON "Branches".id = "SupplierCredits"."branchId"
                    where ( "values"."reconcile" is null or ("values"."reconcile" = true and "SupplierRefundLines"."reconciliationId" is not null) or ("values"."reconcile" = false and "SupplierRefundLines"."reconciliationId" is  null)) 
                    and "Branches"."companyId" = "values"."companyId"
                    and ("values"."branchId" is null or "Branches".id = "values"."branchId")
                    and "SupplierRefundLines"."accountId"  = "values"."accountId"
                   and( "values"."fromDate" is null  or "refundedDate">=  "values"."fromDate") 
                    and( "values"."toDate" is null  or "refundedDate"< "values"."toDate" ) 
                     and ("SupplierRefundLines"."amount" <>0   )
                                 and($7::text is null or(   lower(trim("Suppliers"."name")) ~ $7 or 
                                               lower(trim("SupplierRefunds"."referenceNumber")) ~ $7 
                                              ))
                    UNION ALL
                        
                    select 
                    "Expenses".id ,
                            "Expenses".id  as "referenceId", 
                    'Expense' as "reference",
                    null as "Deposits", 
                    "Expenses"."total"  as "Withdrawals",
                    "expenseDate" as "date",
					"Expenses"."referenceNumber" as "referenceNumber",
						'Expenses'  as "transactionDetails",
                    case when "Expenses"."reconciliationId" is null then false else true end as "reconcile",
					  	JSON_BUILD_OBJECT ('userName',		COALESCE("Customers".name,"Suppliers".name) ,'usertType',case when "Customers"."name" is null then 'Supplier' else 'Customers' end) as "user"
                    from "Expenses"
                    INNER JOIN "values" ON TRUE
                    JOIN "Branches" ON "Branches".id = "Expenses"."branchId"
					inner join  "ExpenseLines" on "ExpenseLines"."expenseId" = "Expenses".id 
					inner join "Accounts" on "Accounts".id = "ExpenseLines"."accountId"
							left join "Customers" on "Customers".id = "Expenses"."customerId"
						left join "Suppliers" on "Suppliers".id = "Expenses"."supplierId"
                    where ( "values"."reconcile" is null or ("values"."reconcile" = true and "Expenses"."reconciliationId" is not null) or ("values"."reconcile" = false and "Expenses"."reconciliationId" is  null)) 
                    and "Branches"."companyId" = "values"."companyId"
                    and ("values"."branchId" is null or "Branches".id = "values"."branchId")
                    and "Expenses"."paidThroughAccountId"  = "values"."accountId"
                                    and( "values"."fromDate" is null  or "expenseDate">=  "values"."fromDate") 
                         and(  "values"."toDate" is null  or "expenseDate"< "values"."toDate" ) 
                            and ("Expenses"."total" <>0   )
                                and($7::text is null or(   lower(trim("Suppliers"."name")) ~ $7 or 
                                                        lower(trim("Customers"."name")) ~ $7 or 
                                               lower(trim("Expenses"."referenceNumber")) ~ $7 
                                              ))
						group by "Expenses".id ,"Customers".name,"Suppliers".name
						UNION ALL
						
				select 
                    "JournalLines".id ,
                        "Journals".id  as "referenceId",
                    'Journal' as "reference",
                    case when "JournalLines"."amount" > 0 then "JournalLines"."amount" else null end  as "Debit", 
                    case when "JournalLines"."amount" < 0 then abs("JournalLines"."amount") else null end  as "Credit",
                        "journalDate" as "date",
						"JournalLines"."code" as "referenceNumber",
					    "Accounts".name::text as "transactionDetails",
                    case when "JournalLines"."reconciliationId" is null then false else true end as "reconcile",
						null as "user"
                    from "Journals"
                    INNER JOIN "values" ON TRUE
					JOIN "JournalLines" ON "JournalLines"."journalId" =  "Journals".id
					JOIN "Accounts" ON "Accounts".id = "JournalLines"."accountId"
                    JOIN "Branches" ON "Branches".id = "Journals"."branchId"
                    where ( "values"."reconcile" is null or ("values"."reconcile" = true and "JournalLines"."reconciliationId" is not null) or ("values"."reconcile" = false and "JournalLines"."reconciliationId" is  null)) 
                    and "Branches"."companyId" = "values"."companyId"
                    and ("values"."branchId" is null or "Branches".id = "values"."branchId")
                    and "JournalLines"."accountId"  = "values"."accountId"
                                and( "values"."fromDate" is null  or "journalDate">=  "values"."fromDate") 
                    and( "values"."toDate" is null  or "journalDate"< "values"."toDate") 
                    and ("JournalLines"."amount" <>0   )
                        and($7::text is null or(   lower(trim("JournalLines"."code")) ~ $7  
                                                      
                                              ))
                  union all 
                  
							select 
                    "Payouts".id ,
                      null as "referenceId",
                    'PayOut' as "reference",
                    0 as "Debit", 
                    "Payouts"."amount"  as "Credit",
                        "Payouts"."createdAt" as "date",
						"Payouts"."referenceNumber" as "referenceNumber",
					    "Accounts".name::text as "transactionDetails",
                    case when "Payouts"."reconciliationId" is null then false else true end as "reconcile",
								null as "user"
                    from "Payouts"
                    INNER JOIN "values" ON TRUE
					JOIN "Accounts" ON "Accounts".id = "Payouts"."accountId"
                    JOIN "Branches" ON "Branches".id = "Payouts"."branchId"
                    where ( "values"."reconcile" is null or ("values"."reconcile" = true and "Payouts"."reconciliationId" is not null) or ("values"."reconcile" = false and "Payouts"."reconciliationId" is  null)) 
                    and "Branches"."companyId" = "values"."companyId"
                    and ("values"."branchId" is null or "Branches".id = "values"."branchId")
                    and "Payouts"."accountId"  = "values"."accountId"
                            and( "values"."fromDate" is null  or "Payouts"."createdAt">=  "values"."fromDate") 
                    and( "values"."toDate" is null  or "Payouts"."createdAt"< "values"."toDate") 
                    and ("Payouts"."amount" <>0   )
                          and($7::text is null or(   lower(trim("Payouts"."referenceNumber")) ~ $7  
                                                      
                                              ))
                       union all 
                  
							select 
                    "VatPayments".id ,
                      "VatPayments".id as "referenceId",
                    'Vat Payments' as "reference",
                    0 as "Debit", 
                    "VatPayments"."amount"  as "Credit",
                        "VatPayments"."from" as "date",
						"VatPayments"."referenceNumber" as "referenceNumber",
					    "Accounts".name::text as "transactionDetails",
                    case when "VatPayments"."reconciliationId" is null then false else true end as "reconcile",
								null as "user"
                    from "VatPayments"
                    INNER JOIN "values" ON TRUE
					JOIN "Accounts" ON "Accounts".id = "VatPayments"."paymentMethodAccountId"
                    where ( "values"."reconcile" is null or ("values"."reconcile" = true and "VatPayments"."reconciliationId" is not null) or ("values"."reconcile" = false and "VatPayments"."reconciliationId" is  null)) 
                    and "VatPayments"."companyId" = "values"."companyId"
                    and "VatPayments"."paymentMethodAccountId"  = "values"."accountId"
                       and( "values"."fromDate" is null  or "VatPayments"."from" >=  "values"."fromDate") 
                    and( "values"."toDate" is null  or "VatPayments"."to"< "values"."toDate") 
                    and ("VatPayments"."amount" <>0    )
                    and "VatPayments"."status" = 'Paid'
                          and($7::text is null or(   lower(trim("VatPayments"."referenceNumber")) ~ $7  
                                                      
                                              ))
                  union all 


							select 
                    "BillOfEntries".id ,
                      "BillOfEntries".id as "referenceId",
                    'Bill of Entry' as "reference",
                    0 as "Debit", 
                    "BillOfEntries"."total"  as "Credit",
                        "BillOfEntries"."billingOfEntryDate" as "date",
						"BillOfEntries"."reference" as "referenceNumber",
					    "Accounts".name::text as "transactionDetails",
                    case when "BillOfEntries"."reconciliationId" is null then false else true end as "reconcile",
								null as "user"
                    from "BillOfEntries"
                    INNER JOIN "values" ON TRUE
                    INNER JOIN "Branches" ON "Branches".id = "BillOfEntries"."branchId"
					JOIN "Accounts" ON "Accounts".id = "BillOfEntries"."paymentMethodAccountId"
                    where ( "values"."reconcile" is null or ("values"."reconcile" = true and "BillOfEntries"."reconciliationId" is not null) or ("values"."reconcile" = false and "BillOfEntries"."reconciliationId" is  null)) 
                    and "Branches"."companyId" = "values"."companyId"
                    and "BillOfEntries"."paymentMethodAccountId"  = "values"."accountId"
                       and( "values"."fromDate" is null  or "BillOfEntries"."billingOfEntryDate" >=  "values"."fromDate") 
                    and( "values"."toDate" is null  or "BillOfEntries"."billingOfEntryDate"< "values"."toDate") 
                    and ("BillOfEntries"."total" <>0    )
                    and "BillOfEntries"."status" = 'Open'
                          and($7::text is null or(   lower(trim("BillOfEntries"."reference")) ~ $7  
                                                      
                                              ))

                    UNION ALL


                  	select 
                    null as "id" ,
                    null as "referenceId",
                    'Opening Balance' as "reference",
                    case when sum("OpeningBalance"."openingBalance"::text::numeric) > 0 then sum("OpeningBalance"."openingBalance"::text::numeric) end  as "Debit", 
                    case when sum("OpeningBalance"."openingBalance"::text::numeric) < 0 then sum("OpeningBalance"."openingBalance"::text::numeric) end   as "Credit", 
                    case when  "values"."branchId" is not null and "Branches"."openingBalanceDate" is not null then "Branches"."openingBalanceDate"
					else "Companies"."createdAt"  - interval '1 day' end 
					as "date",
						null as "referenceNumber",
					    "Accounts".name::text as "transactionDetails",
                   null  as "reconcile",
								null as "user"
                    from "OpeningBalance"
                    INNER JOIN "values" ON TRUE
					JOIN "Accounts" ON "Accounts".id = "values"."accountId"
                    JOIN "Branches" ON "Branches".id = "OpeningBalance"."branchId"
					JOIN "Companies" on "Companies".id = "Branches"."companyId"
                    where "Branches"."companyId" = "values"."companyId"
                    and ("values"."branchId" is null or "Branches".id = "values"."branchId")
                    and "OpeningBalance"."accountId"  = "values"."accountId"
                    group by    "Accounts".id ,"values"."branchId" ,"date"
                    )
                    
                    select 
                    count(id) over(),
                    "transactions".*
                    from "transactions"

                    order by "date" ${sortDirection}
                  
                
                `,
                values: [companyId, accountId, branchId, fromDate, toDate, reconcile, searchValue]
            }

            if (data.page) {
                query.text += `  limit $8
                                 offset $9`

                query.values.push(limit)
                query.values.push(offset)
            }

            const selectList = await client.query(query.text, query.values)



            let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const resData = {
                // accountName:accountName,
                list: selectList.rows,
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

    public static async getById(id: string, company: Company) {
        try {

            const query = {
                text: `select 
                "Reconciliations".id,
                "Reconciliations"."from",
                "Reconciliations"."to",
                "Reconciliations"."closingBalance",
                "Reconciliations"."status",
                "Reconciliations"."reconciledAt",
                   "Accounts".id as "accountId", 
                "Accounts".name as "accountName",
                "Branches".name as "branchName",
                "Employees".name as "employeeName",
                  (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',"Media"."url"->>'defaultUrl','mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("Reconciliations"."attachment") as attachments(attachments)
                                    inner join "Media" on "Media".id = (attachments->>'id')::uuid
                                    ) as "attachment"
                from "Reconciliations"
                INNER JOIN "Accounts" ON "Accounts".id =  "Reconciliations"."accountId"
                LEFT JOIN "Branches" On "Branches".id = "Reconciliations"."branchId"
                LEFT JOIN "Employees" On "Employees".id = "Reconciliations"."employeeId"
                where "Reconciliations".id =$1
                and "Reconciliations"."companyId" = $2
                `,
                values: [id, company.id]
            }


            const record = await DB.excu.query(query.text, query.values)
            const reconcile = new Reconciliation();
            reconcile.ParseJson(record.rows[0]);

            // let data = {filter:{reconciliationId: reconcile.id}}
            // let records = (await this.getReconcilationRecordsById(data,company)).data
            // reconcile.transactions = records

            return new ResponseData(true, "", reconcile);


        } catch (error: any) {
            console.log(error)

            throw new Error(error)
        }
    }

    /**
     * 
     * @param data with "values" as (
                    select
                    '7aec090f-059d-488c-a7e2-0cc79a640c90'::uuid as "reconciliationId",
                   '97d49fa3-d473-48f3-ac56-17d7baad4c34'::uuid as "companyId"
                    ),"transactions" as (
                    select 
                    "InvoicePayments".id ,
                    'Invoice Payment' as "reference",
                    case when "InvoicePayments"."tenderAmount" = 0 then "InvoicePayments"."paidAmount" -  "InvoicePayments"."bankCharge"  else 	"InvoicePayments"."tenderAmount" * "InvoicePayments"."rate" -  "InvoicePayments"."bankCharge"  end as "Debit",
                    0 as "Credit",
                    "paymentDate" as "createdAt",
                    case when "InvoicePayments"."reconciliationId" is null then false else true end "reconciled",
                    "InvoicePayments"."referenceNumber",
                    'Account Receivable'::text as "transactionDetails"
                    from "InvoicePayments"
                    INNER JOIN "values" ON TRUE
                    INNER JOIN "Reconciliations" ON (("Reconciliations".id = "InvoicePayments"."reconciliationId" and "Reconciliations".id = "values"."reconciliationId") or ("InvoicePayments"."reconciliationId" is null         and "InvoicePayments"."paymentMethodAccountId"  = "Reconciliations"."accountId" AND ( "InvoicePayments"."paymentDate" <= "Reconciliations"."to" )) )         
                    left JOIN "Branches" ON "Branches".id = "InvoicePayments"."branchId"
                    where "InvoicePayments"."status" = 'SUCCESS'
                    and "Branches"."companyId" = "values"."companyId"
                    and("Reconciliations"."branchId" is null or( "InvoicePayments"."branchId" = "Reconciliations"."branchId" ))
              
                  
                    	
                    UNION ALL 
                    	
                    	
                    select 
                    "CreditNoteRefundLines".id ,
                    'CreditNote Refund' as "reference",
                    0 as "Debit", 
                    "CreditNoteRefundLines"."amount"::TEXT::NUMERIC as "Credit",
                    "refundDate" as "createdAt",
                    case when "CreditNoteRefundLines"."reconciliationId" is null then false else true end "reconciled",
                    "CreditNoteRefunds"."refrenceNumber" as "referenceNumber",
                    'Account Receivable'::text as "transactionDetails"

                    from "CreditNoteRefunds"
                    INNER JOIN "values" ON TRUE
                    JOIN "CreditNotes" ON "CreditNotes".id =   "CreditNoteRefunds"."creditNoteId"
                    JOIN "CreditNoteRefundLines" ON "CreditNoteRefundLines"."creditNoteRefundId" = "CreditNoteRefunds".id
                    inner JOIN "Reconciliations" ON (("Reconciliations".id = "CreditNoteRefundLines"."reconciliationId" and "Reconciliations".id = "values"."reconciliationId") or ("CreditNoteRefundLines"."reconciliationId" is null and "CreditNoteRefundLines"."accountId"  = "Reconciliations"."accountId" AND ( "CreditNoteRefunds"."refundDate" <= "Reconciliations"."to" )) )  
                    Left JOIN "Branches" ON "Branches".id = "CreditNotes"."branchId"
                    where "Branches"."companyId" = "values"."companyId"
                          and("Reconciliations"."branchId" is null or( "CreditNotes"."branchId" = "Reconciliations"."branchId" ))
          
                    
                    UNION ALL 
                    	
                     select 
                    "BillingPayments".id ,
                    'Billing Payment' as "reference",
                    0 as "Debit", 
                    case when "BillingPayments"."tenderAmount" = 0 then "BillingPayments"."paidAmount"   else 	"BillingPayments"."tenderAmount" * "BillingPayments"."rate"   end as "Credit",
                    "paymentDate" as "createdAt",
                    case when "BillingPayments"."reconciliationId" is null then false else true end "reconciled",
                   "BillingPayments"."referenceNumber",
                     'Account Payable'::text as "transactionDetails"
                    from "BillingPayments"
                    INNER JOIN "values" ON TRUE
                    inner JOIN "Reconciliations" ON (("Reconciliations".id = "BillingPayments"."reconciliationId" and "Reconciliations".id = "values"."reconciliationId") or ("BillingPayments"."reconciliationId" is null  and "BillingPayments"."paymentMethodAccountId"  = "Reconciliations"."accountId" AND ( "BillingPayments"."paymentDate" <= "Reconciliations"."to" )) )                     
                    JOIN "Branches" ON "Branches".id = "BillingPayments"."branchId"
                    where "Branches"."companyId" = "values"."companyId"
                    and("Reconciliations"."branchId" is null or( "BillingPayments"."branchId" = "Reconciliations"."branchId" ))
                    
                	
                    UNION ALL 
                	
                    select 
                    "SupplierRefundLines".id ,
                    'Supplier Refund' as "reference",
                    "SupplierRefundLines"."amount" as "Debit", 
                    0 as "Credit",
                    "refundedDate" as "createdAt",
                    case when "SupplierRefundLines"."reconciliationId" is null then false else true end "reconciled",
                    "SupplierRefunds"."referenceNumber",
                           'Account Payable'::text as "transactionDetails"
                    from "SupplierRefunds"
                    INNER JOIN "values" ON TRUE
                    JOIN "SupplierRefundLines" on "SupplierRefundLines"."supplierRefundId" = "SupplierRefunds".id
                    JOIN "SupplierCredits" ON "SupplierCredits".id = "SupplierRefunds"."supplierCreditId"
                    JOIN "Branches" ON "Branches".id = "SupplierCredits"."branchId"
                    INNER JOIN "Reconciliations" ON (("Reconciliations".id = "SupplierRefundLines"."reconciliationId" and "Reconciliations".id = "values"."reconciliationId") or ("SupplierRefundLines"."reconciliationId" is null and "SupplierRefundLines"."accountId"  = "Reconciliations"."accountId" AND  ( "SupplierRefunds"."refundedDate" <= "Reconciliations"."to" )) )
                     where "Branches"."companyId" = "values"."companyId"
                    
                          and("Reconciliations"."branchId" is null or( "SupplierCredits"."branchId" = "Reconciliations"."branchId" ))
                  
                    	
                    
                    UNION ALL
                    	
                      select 
                    "Expenses".id ,
                    'Expense' as "reference",
                    0 as "Debit", 
                    "Expenses"."total"  as "Credit",
                    "expenseDate" as "createdAt",
                    case when "Expenses"."reconciliationId" is null then false else true end "reconciled",
                    "Expenses"."referenceNumber",
                    STRING_AGG("Accounts".name::text,',') as "transactionDetails"
                    from "Expenses"
                    INNER JOIN "values" ON TRUE
                        LEFT join  "ExpenseLines" on "Expenses".id = "ExpenseLines"."expenseId"
                        LEFT  join "Accounts" on "Accounts".id = "ExpenseLines"."accountId"

                        INNER JOIN "Reconciliations" ON (("Reconciliations".id = "Expenses"."reconciliationId" and "Reconciliations".id = "values"."reconciliationId") or ("Expenses"."reconciliationId" is null and "Expenses"."paidThroughAccountId"  = "Reconciliations"."accountId" AND ( "Expenses"."expenseDate" <= "Reconciliations"."to" )) )
                    JOIN "Branches" ON "Branches".id = "Expenses"."branchId"
                    where "Branches"."companyId" ="values"."companyId"
                    and("Reconciliations"."branchId" is null or( "Expenses"."branchId" = "Reconciliations"."branchId" ))
                    
             
                     group by     "Expenses".id
                    UNION ALL
                    	
                      select 
                    "JournalLines".id ,
                    'Journal' as "reference",
                    case when "JournalLines"."amount" >0 then "JournalLines"."amount" else 0 end as "Debit", 
                    case when "JournalLines"."amount" < 0 then "JournalLines"."amount" else 0 end as "Credit", 

                    "Journals"."journalDate" as "createdAt",
                    case when "JournalLines"."reconciliationId" is null then false else true end "reconciled",
                    "JournalLines"."code" as "referenceNumber",
                         "Accounts".name as "transactionDetails"
                    from "JournalLines"
                    INNER JOIN "values" ON TRUE
                    LEFT join "Accounts" on "Accounts".id = "JournalLines"."accountId"
                    JOIN "Journals" on "Journals".id = "JournalLines"."journalId"
                    INNER JOIN "Reconciliations" ON (("Reconciliations".id = "JournalLines"."reconciliationId" and "Reconciliations".id = "values"."reconciliationId") or( "JournalLines"."reconciliationId" is null  and "JournalLines"."accountId"  = "Reconciliations"."accountId" AND "Journals"."journalDate" <= "Reconciliations"."to"  ) )     
                    JOIN "Branches" ON "Branches".id = "Journals"."branchId"
                    where "Branches"."companyId" ="values"."companyId"
                    and("Reconciliations"."branchId" is null or( "Journals"."branchId" = "Reconciliations"."branchId" ))
               
                        	
                    
                    )
                    
                    select 
                    count(id) over(),
                    "transactions".*
                    from "transactions"
                    order by "createdAt" desc
     * @param company 
     * @returns 
     */
    //TODO :FILTER BY RECONCILE 
    public static async getReconcilationRecordsById(data: any, company: Company) {
        try {
            const reconciliationId = data.filter.reconcilationId
            const reconcile = data.filter.reconcile
            const limit = data.limit ?? 15
            const page = data.page ?? 1

            let offset = limit * (page - 1)

            let limitQuery = ""
            if (data.page != null && data.page != '') {
                limitQuery += ` limit ${limit}
                               offset ${offset}   
                             `
            }
            const query = {
                text: `with "values" as (
                    select
                    $1::uuid as "reconciliationId",
                    $2::uuid as "companyId",
                    $3::boolean as "reconcile"
                    ),"transactions" as (
                    select 
                    "InvoicePayments".id ,
                    "InvoicePayments".id  as "referenceId",
                    'Invoice Payment' as "reference",
                    case when "InvoicePayments"."tenderAmount" = 0 then "InvoicePayments"."paidAmount" -  "InvoicePayments"."bankCharge"  else 	"InvoicePayments"."tenderAmount" * "InvoicePayments"."rate" -  "InvoicePayments"."bankCharge"  end as "Debit",
                    0 as "Credit",
                    "paymentDate" as "date",
					case when "InvoicePayments"."reconciliationId" is null then false else true end "reconcile",
					"InvoicePayments"."referenceNumber",
					'Account Receivable'::text as "transactionDetails",
						JSON_BUILD_OBJECT ('userName',"Customers"."name",'usertType','Customer') as "user"
                    from "InvoicePayments"
                    INNER JOIN "values" ON TRUE
					INNER JOIN "Reconciliations" ON  "Reconciliations".id = "values"."reconciliationId" and "InvoicePayments"."paymentMethodAccountId"  = "Reconciliations"."accountId"
					left join "Customers" on "Customers".id = "InvoicePayments"."customerId"
                    left JOIN "Branches" ON "Branches".id = "InvoicePayments"."branchId"
                    where "InvoicePayments"."status" = 'SUCCESS'
				    and "Branches"."companyId" = "values"."companyId"
					and ("InvoicePayments"."paymentMethodAccountId"  = "Reconciliations"."accountId")
					and("Reconciliations"."branchId" is null or( "InvoicePayments"."branchId" = "Reconciliations"."branchId" ))
                    and(( "InvoicePayments"."reconciliationId" = "values"."reconciliationId")  or ( "InvoicePayments"."paymentDate" <= "Reconciliations"."to" and  "InvoicePayments"."reconciliationId" is null  ))
					and ("values"."reconcile" is null or ("values"."reconcile" = true and "InvoicePayments"."reconciliationId" is not null) )
                    and ("InvoicePayments"."tenderAmount" <> 0 or   "InvoicePayments"."paidAmount" <>0)
                    
                    UNION ALL 
						
						
				    select 
                    "CreditNoteRefundLines".id ,
                      null as "referenceId",
                    'CreditNote Refund' as "reference",
                    0 as "Debit", 
                    "CreditNoteRefundLines"."amount"::TEXT::NUMERIC as "Credit",
                    "refundDate" as "date",
					case when "CreditNoteRefundLines"."reconciliationId" is null then false else true end "reconcile",
					"CreditNoteRefunds"."refrenceNumber" as "referenceNumber",
                    'Account Receivable'::text as "transactionDetails",
                			JSON_BUILD_OBJECT ('userName',"Customers"."name",'usertType','Customer')  as "user"
                    from "CreditNoteRefunds"
                    INNER JOIN "values" ON TRUE
					JOIN "CreditNotes" ON "CreditNotes".id =   "CreditNoteRefunds"."creditNoteId"
					join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId" 
						left join "Customers" on "Customers".id = "Invoices"."customerId"
                    JOIN "CreditNoteRefundLines" ON "CreditNoteRefundLines"."creditNoteRefundId" = "CreditNoteRefunds".id
                	Left JOIN "Reconciliations" ON ( "Reconciliations".id = "values"."reconciliationId")
					Left JOIN "Branches" ON "Branches".id = "CreditNotes"."branchId"
				    where "Branches"."companyId" = "values"."companyId"
                    and "CreditNoteRefundLines"."accountId"  = "Reconciliations"."accountId"
                   	and("Reconciliations"."branchId" is null or( "CreditNotes"."branchId" = "Reconciliations"."branchId" ))
                    and(( "CreditNoteRefundLines"."reconciliationId" = "values"."reconciliationId")  or ( "CreditNoteRefunds"."refundDate" <= "Reconciliations"."to"  and  "CreditNoteRefundLines"."reconciliationId" is null ))
                    and ("values"."reconcile" is null or ("values"."reconcile" = true and "CreditNoteRefundLines"."reconciliationId" is not null) )
                    and (  "CreditNoteRefundLines"."amount" <> 0 )
					UNION ALL 
						
                     select 
                    "BillingPayments".id ,
                        "BillingPayments".id as "referenceId",
                    'Billing Payment' as "reference",
                    0 as "Debit", 
                    case when "BillingPayments"."tenderAmount" = 0 then "BillingPayments"."paidAmount"   else 	"BillingPayments"."tenderAmount" * "BillingPayments"."rate"   end as "Credit",
                    "paymentDate" as "date",
					case when "BillingPayments"."reconciliationId" is null then false else true end "reconcile",
	               "BillingPayments"."referenceNumber",
                     'Account Payable'::text as "transactionDetails",
							JSON_BUILD_OBJECT ('userName',"Suppliers"."name",'usertType','Supplier')  as "user"
                    from "BillingPayments"
                    INNER JOIN "values" ON TRUE
					Left JOIN "Reconciliations" ON (("Reconciliations".id = "values"."reconciliationId"))
							left join "Suppliers" on "Suppliers".id = "BillingPayments"."supplierId"
                    JOIN "Branches" ON "Branches".id = "BillingPayments"."branchId"
                    where "Branches"."companyId" = "values"."companyId"
					and("Reconciliations"."branchId" is null or( "BillingPayments"."branchId" = "Reconciliations"."branchId" ))
                    and "BillingPayments"."paymentMethodAccountId"  = "Reconciliations"."accountId"
                    and(( "BillingPayments"."reconciliationId" = "values"."reconciliationId")  or ( "BillingPayments"."paymentDate" <= "Reconciliations"."to"  and  "BillingPayments"."reconciliationId" is null ))
					 and ("values"."reconcile" is null or ("values"."reconcile" = true and "BillingPayments"."reconciliationId" is not null) )
                       and ("BillingPayments"."tenderAmount" <> 0 or   "BillingPayments"."paidAmount" <>0)
					UNION ALL 
					
					select 
                    "SupplierRefundLines".id ,
                     null "referenceId",
                    'Supplier Refund' as "reference",
                    "SupplierRefundLines"."amount" as "Debit", 
                    0 as "Credit",
                    "refundedDate" as "date",
					case when "SupplierRefundLines"."reconciliationId" is null then false else true end "reconcile",
                    "SupplierRefunds"."referenceNumber",
                    	   'Account Payable'::text as "transactionDetails",
							JSON_BUILD_OBJECT ('userName',"Suppliers"."name",'usertType','Supplier') as "user"
                    from "SupplierRefunds"
                    INNER JOIN "values" ON TRUE
                    JOIN "SupplierRefundLines" on "SupplierRefundLines"."supplierRefundId" = "SupplierRefunds".id
                    JOIN "SupplierCredits" ON "SupplierCredits".id = "SupplierRefunds"."supplierCreditId"
					join "Billings" on "Billings".id = "SupplierCredits"."billingId"
					left join "Suppliers" on "Suppliers".id = "Billings"."supplierId"
                    JOIN "Branches" ON "Branches".id = "SupplierCredits"."branchId"
					Left JOIN "Reconciliations" ON (( "Reconciliations".id = "values"."reconciliationId"))
		             where "Branches"."companyId" = "values"."companyId"
                    and "SupplierRefundLines"."accountId"  = "Reconciliations"."accountId"
                   	and("Reconciliations"."branchId" is null or( "SupplierCredits"."branchId" = "Reconciliations"."branchId" ))
                    and(( "SupplierRefundLines"."reconciliationId" = "values"."reconciliationId")  or ( "SupplierRefunds"."refundedDate" <= "Reconciliations"."to"  and  "SupplierRefundLines"."accountId" =  "Reconciliations"."accountId" and    "SupplierRefundLines"."reconciliationId" is null))
                    and ("values"."reconcile" is null or ("values"."reconcile" = true and "SupplierRefundLines"."reconciliationId" is not null) )
                    and ("SupplierRefundLines"."amount"<>0)
					UNION ALL
						
					  select 
                    "Expenses".id ,
                         "Expenses".id as "referenceId",
                    'Expense' as "reference",
                    0 as "Debit", 
                    "Expenses"."total"  as "Credit",
                    "expenseDate" as "date",
					case when "Expenses"."reconciliationId" is null then false else true end "reconcile",
                    "Expenses"."referenceNumber",
                    'Expenses' as "transactionDetails",
					
                        	JSON_BUILD_OBJECT ('userName',		COALESCE("Customers".name,"Suppliers".name) ,'usertType',case when "Customers"."name" is null then 'Supplier' else 'Customers' end) as "user"
                    from "Expenses"
                    INNER JOIN "values" ON TRUE
                        LEFT join  "ExpenseLines" on "Expenses".id = "ExpenseLines"."expenseId"
						LEFT  join "Accounts" on "Accounts".id = "ExpenseLines"."accountId"

						Left JOIN "Reconciliations" ON (( "Reconciliations".id = "values"."reconciliationId") )
						left join "Customers" on "Customers".id = "Expenses"."customerId"
						left join "Suppliers" on "Suppliers".id = "Expenses"."supplierId"
                    JOIN "Branches" ON "Branches".id = "Expenses"."branchId"
                    where "Branches"."companyId" ="values"."companyId"
					and("Reconciliations"."branchId" is null or( "Expenses"."branchId" = "Reconciliations"."branchId" ))
                    and "Expenses"."paidThroughAccountId"  = "Reconciliations"."accountId"
                    and(( "Expenses"."reconciliationId" = "values"."reconciliationId")  or ( "Expenses"."expenseDate" <= "Reconciliations"."to" and  "Expenses"."paidThroughAccountId" =  "Reconciliations"."accountId" and     "Expenses"."reconciliationId" is null ))
                    and ("values"."reconcile" is null or ("values"."reconcile" = true and "Expenses"."reconciliationId" is not null) )
                    and ("Expenses"."total" <>0 )
					 group by     "Expenses".id ,"Suppliers".name,"Customers".name
					UNION ALL
						
					  select 
                    "JournalLines".id ,
                           "Journals".id as "referenceId",
                    'Journal' as "reference",
                    case when "JournalLines"."amount" >0 then "JournalLines"."amount" else 0 end as "Debit", 
                    case when "JournalLines"."amount" < 0 then abs("JournalLines"."amount") else 0 end as "Credit", 

                    "Journals"."journalDate" as "date",
					case when "JournalLines"."reconciliationId" is null then false else true end "reconcile",
                    "JournalLines"."code" as "referenceNumber",
						 "Accounts".name as "transactionDetails",
						null as "user" 
                    from "JournalLines"
                    INNER JOIN "values" ON TRUE
					LEFT join "Accounts" on "Accounts".id = "JournalLines"."accountId"
					JOIN "Journals" on "Journals".id = "JournalLines"."journalId"
					Left JOIN "Reconciliations" ON (( "Reconciliations".id = "values"."reconciliationId") )
                    JOIN "Branches" ON "Branches".id = "Journals"."branchId"
                    where "Branches"."companyId" ="values"."companyId"
					and("Reconciliations"."branchId" is null or( "Journals"."branchId" = "Reconciliations"."branchId" ))
                    and "JournalLines"."accountId"  = "Reconciliations"."accountId"
                    and(( "JournalLines"."reconciliationId" = "values"."reconciliationId")  or ( "Journals"."journalDate" <= "Reconciliations"."to"  and  "JournalLines"."accountId" =  "Reconciliations"."accountId" and     "JournalLines"."reconciliationId" is null ))
					and ("values"."reconcile" is null or ("values"."reconcile" = true and "JournalLines"."reconciliationId" is not null) )		
                     and ("JournalLines"."amount" <>0 )
                    UNION ALL 
                     	select 
                    "Payouts".id ,
                    null as "referenceId",
                    'PayOut' as "reference",
                     0 as "Debit", 
                    "Payouts"."amount"  as "Credit", 

                    "Payouts"."createdAt" as "date",
					case when "Payouts"."reconciliationId" is null then false else true end "reconcile",
                    "Payouts"."referenceNumber" as "referenceNumber",
						 "Accounts".name as "transactionDetails",
							null as "user" 
                    from "Payouts"
                    INNER JOIN "values" ON TRUE
					LEFT join "Accounts" on "Accounts".id = "Payouts"."accountId"
					Left JOIN "Reconciliations" ON (( "Reconciliations".id = "values"."reconciliationId") )
                    JOIN "Branches" ON "Branches".id = "Payouts"."branchId"
                    where "Branches"."companyId" ="values"."companyId"
					and("Reconciliations"."branchId" is null or( "Payouts"."branchId" = "Reconciliations"."branchId" ))
                    and "Payouts"."accountId"  = "Reconciliations"."accountId"
                    and(( "Payouts"."reconciliationId" = "values"."reconciliationId")  or ( "Payouts"."createdAt" <= "Reconciliations"."to"  and  "Payouts"."accountId" =  "Reconciliations"."accountId" and     "Payouts"."reconciliationId" is null ))
					and ("values"."reconcile" is null or ("values"."reconcile" = true and "Payouts"."reconciliationId" is not null) )
                              and ("Payouts"."amount" <>0 )	

                    union all 
                    	select 
                    "VatPayments".id ,
                      "VatPayments".id as "referenceId",
                    'Vat Payments' as "reference",
                    0 as "Debit", 
                    "VatPayments"."amount"  as "Credit",
                        "VatPayments"."from" as "date",    
                        case when "VatPayments"."reconciliationId" is null then false else true end as "reconcile",
						"VatPayments"."referenceNumber" as "referenceNumber",
					    "Accounts".name::text as "transactionDetails",
                
								null as "user"
                    from "VatPayments"
                    INNER JOIN "values" ON TRUE
				     LEFT join "Accounts" on "Accounts".id = "VatPayments"."paymentMethodAccountId"
					Left JOIN "Reconciliations" ON (( "Reconciliations".id = "values"."reconciliationId") )
    
                    where "VatPayments"."companyId" ="values"."companyId"
                    and "VatPayments"."paymentMethodAccountId"  = "Reconciliations"."accountId"
                    and(( "VatPayments"."reconciliationId" = "values"."reconciliationId")  or ( "VatPayments"."to" <= "Reconciliations"."to"  and  "VatPayments"."paymentMethodAccountId" =  "Reconciliations"."accountId" and     "VatPayments"."reconciliationId" is null ))
					and ("values"."reconcile" is null or ("values"."reconcile" = true and "VatPayments"."reconciliationId" is not null) )
                              and ("VatPayments"."amount" <>0 )	
                    and "VatPayments"."status" = 'Paid'

                    union all 
                       	select 
                    "BillOfEntries".id ,
                      "BillOfEntries".id as "referenceId",
                    'Bill of Entry' as "reference",
                    0 as "Debit", 
                    "BillOfEntries"."total"  as "Credit",
                        "BillOfEntries"."billingOfEntryDate" as "date",    
                        case when "BillOfEntries"."reconciliationId" is null then false else true end as "reconcile",
						"BillOfEntries"."reference" as "referenceNumber",
					    "Accounts".name::text as "transactionDetails",
                
								null as "user"
                    from "BillOfEntries"
                    INNER JOIN "values" ON TRUE
                    INNER JOIN "Branches" on "Branches".id = "BillOfEntries"."branchId"
				     LEFT join "Accounts" on "Accounts".id = "BillOfEntries"."paymentMethodAccountId"
					Left JOIN "Reconciliations" ON (( "Reconciliations".id = "values"."reconciliationId") )
    
                    where "Branches"."companyId" ="values"."companyId"
                    and "BillOfEntries"."paymentMethodAccountId"  = "Reconciliations"."accountId"
                    and(( "BillOfEntries"."reconciliationId" = "values"."reconciliationId")  or ( "BillOfEntries"."billingOfEntryDate" <= "Reconciliations"."to"  and  "BillOfEntries"."paymentMethodAccountId" =  "Reconciliations"."accountId" and     "BillOfEntries"."reconciliationId" is null ))
					and ("values"."reconcile" is null or ("values"."reconcile" = true and "BillOfEntries"."reconciliationId" is not null) )
                              and ("BillOfEntries"."total" <>0 )	
                    and "BillOfEntries"."status" = 'Open'
                    )
                    
                    select 
                    count(id) over(),
                    "transactions".*
                    from "transactions"
                    order by "date" asc
                    ${limitQuery}
                    `,
                values: [reconciliationId, company.id, reconcile]
            }


            const selectList = await DB.excu.query(query.text, query.values)



            let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
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
            console.log(error)
            throw new Error(error)
        }
    }


    public static async checkReconcileDate(client: PoolClient, id: string | null, accountId: string, fromDate: Date) {
        try {
            const query = {
                text: `Select count(*) from "Reconciliations" 
                             where "Reconciliations"."from"::date  <= $1::date
                             and "to"::date  >=  $1::date
                             and "accountId"=$2
            
                             and ($3::uuid is null or id <> $3) `,
                values: [new Date(fromDate), accountId, id]

            }

            let date = await client.query(query.text, query.values);

            if (date && date.rows && date.rows.length > 0 && date.rows[0].count > 0) {
                return true
            }

            return false
        } catch (error: any) {
            throw new Error(error)
        }

    }

    public static async lastReconciliationStatus(client:PoolClient,accountId:string)
    {
        try {
            const  query={
                text :`SELECT "status" from "Reconciliations" where "accountId" =$1 
                      order by "to" desc
                      limit 1 
                 `,
                values:[accountId]
            }

            const reconcile = await client.query(query.text,query.values);

            if(reconcile && reconcile.rows && reconcile.rows.length >0)
            {
                if (reconcile.rows[0].status == 'in-progress' ) {
                    throw new ValidationException("Not Allowed To Create New Reconciliation While Other Reconciliation is 'In Progress' ")
                }
            }
        } catch (error:any) {
            throw new Error(error)
        }
    }
    public static async saveReconciliation(client: PoolClient, data: any, company: Company) {

        try {


            let reconciliation = new Reconciliation()
            reconciliation.ParseJson(data);
            reconciliation.companyId = company.id

            console.log(reconciliation.transactions.filter(f=>f.reconcile))
            if (reconciliation.status == 'reconciled') {
                reconciliation.reconciledAt = new Date()
            }

            await this.lastReconciliationStatus(client,reconciliation.accountId)
            let isDateAlreadyUsed = await this.checkReconcileDate(client, null, reconciliation.accountId, new Date(reconciliation.from))
            if (isDateAlreadyUsed) {
                throw new ValidationException("Reconciliation Date Already Used")
            }

            if (reconciliation.transactions && reconciliation.transactions.length == 0) {
                throw new ValidationException("Please Select Transactions To reconcile")
            }
            reconciliation.openingBalance = (await this.getOpeningBalance(client, { accountId: reconciliation.accountId, date: reconciliation.from }, company)).data.Debit
            reconciliation.calculateTotal(company.afterDecimal)
            const query: { text: any, values: any } = {
                text: `Insert INTO "Reconciliations" ("from",
                                                          "to",
                                                          "closingBalance",
                                                          "companyId",
                                                          "branchId",
                                                          "accountId",
                                                          "employeeId",
                                                          "status",
                                                          "createdAt",
                                                          "attachment",
                                                          "reconciledAt",
                                                          "total" 
                                                          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
                values: [new Date(reconciliation.from),
                new Date(reconciliation.to),
                reconciliation.closingBalance,
                reconciliation.companyId,
                reconciliation.branchId,
                reconciliation.accountId,
                reconciliation.employeeId,
                reconciliation.status,
                reconciliation.createdAt,
                JSON.stringify(reconciliation.attachment),
                reconciliation.reconciledAt,
                reconciliation.total
                ]
            }
            let reconciliationData = await client.query(query.text, query.values);
            reconciliation.id = reconciliationData.rows && reconciliationData.rows.length > 0 ? (<any>reconciliationData.rows[0]).id : null;
            if (reconciliation.id == null) {
                throw new Error("Error in saving Reconciliation")
            }

            for (let index = 0; index < reconciliation.transactions.length; index++) {
                const element = reconciliation.transactions[index];
                element.reconciliationId = reconciliation.id;
                if (element.reconcile) {
                    await this.setReconciliationId(client, element)
                }
            }


            return new ResponseData(true, "", [])
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }


    public static async editReconciliation(client: PoolClient, data: any, company: Company) {

        try {

            let reconciliation = new Reconciliation()
            reconciliation.ParseJson(data);
            let isDateAlreadyUsed = await this.checkReconcileDate(client, reconciliation.id, reconciliation.accountId, reconciliation.from)
            if (isDateAlreadyUsed) {
                throw new ValidationException("Reconciliation Date Alreade Used")
            }
            let oldStatus = await this.getPreviouisStatus(reconciliation.id);


            if (oldStatus != 'reconciled' && reconciliation.status == 'reconciled') {
                reconciliation.reconciledAt = new Date()
            }

            if (reconciliation.transactions && reconciliation.transactions.length == 0) {
                throw new ValidationException("Please Select Transactions To reconcile")
            }

            reconciliation.openingBalance = (await this.getOpeningBalance(client, { accountId: reconciliation.accountId, date: reconciliation.from }, company)).data.Debit
            reconciliation.calculateTotal(company.afterDecimal)
            const query: { text: any, values: any } = {
                text: `UPDATE "Reconciliations"  SET "closingBalance" =$1, "status" =$2 ,"attachment"=$3,"reconciledAt"=$4,"total"=$5 WHERE id =$6`,
                values: [reconciliation.closingBalance, reconciliation.status, JSON.stringify(reconciliation.attachment), reconciliation.reconciledAt, reconciliation.total,
                reconciliation.id]
            }
            let reconciliationData = await client.query(query.text, query.values);
            if (reconciliation.id == null) {
                throw new Error("Error in saving Reconciliation")
            }

            for (let index = 0; index < reconciliation.transactions.length; index++) {
                const element = reconciliation.transactions[index];
                element.reconciliationId = reconciliation.id;
                if (element.id == "" || element.id == null) {
                    continue;
                }
                if (element.reconcile == false) {
                    await this.unReconciliation(client, element)
                } else if (element.reconcile == true) {
                    await this.setReconciliationId(client, element)
                }
            }
            return new ResponseData(true, "", [])
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    public static async setReconciliationId(client: PoolClient, transaction: ReconciliationTransaction) {
        try {


            let dbTable = ''


            switch (transaction.reference) {
                case 'Invoice Payment':
                    dbTable = "InvoicePayments"
                    break;
                case 'CreditNote Refund':
                    dbTable = "CreditNoteRefundLines"
                    break;
                case 'Billing Payment':
                    dbTable = "BillingPayments"
                    break;
                case 'Supplier Refund':
                    dbTable = "SupplierRefundLines"
                    break;
                case 'Expense':
                    dbTable = "Expenses"
                    break;
                case 'Journal':
                    dbTable = "JournalLines"
                    break;
                case 'PayOut':
                    dbTable = "Payouts"
                    break;
                    case 'Vat Payments':
                        dbTable = "VatPayments"
                        break;
                             case 'Bill of Entry':
                        dbTable = "BillOfEntries"
                        break;
                default:
                    throw new Error("Invalid Transaction Type " + transaction.reference)
                    break;
            }
            const query = {
                text: `UPDATE "${dbTable}" SET "reconciliationId" =$1 WHERE id =$2`,
                values: [transaction.reconciliationId, transaction.id]
            }
            await client.query(query.text, query.values)
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }
    public static async unReconciliation(client: PoolClient, transaction: ReconciliationTransaction) {
        try {


            let dbTable = ''
            switch (transaction.reference) {
                case 'Invoice Payment':
                    dbTable = "InvoicePayments"
                    break;
                case 'CreditNote Refund':
                    dbTable = "CreditNoteRefundLines"
                    break;
                case 'Billing Payment':
                    dbTable = "BillingPayments"
                    break;
                case 'Supplier Refund':
                    dbTable = "SupplierRefundLines"
                    break;
                case 'Expense':
                    dbTable = "Expenses"
                    break;
                case 'Journal':
                    dbTable = "JournalLines"
                    break;
                    case 'PayOut':
                        dbTable = "Payouts"
                        break;
                        case 'Vat Payments':
                            dbTable = "VatPayments"
                            break;
                                   case 'Bill of Entry':
                        dbTable = "BillOfEntries"
                        break;
                default:
                    throw new Error("Invalid Reconcile Transaction Type ")
                    break;
            }
            const query: { text: any, values: any } = {
                text: `UPDATE "${dbTable}" SET "reconciliationId" =$1 WHERE id =$2`,
                values: [null, transaction.id]
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getListReconciliation(data: any, company: Company) {
        try {

            const limit = data.limit ?? 15
            const page = data.page ?? 1
            let offset = limit * (page - 1)
            let companyId = company.id;
            let branches = data.branches && data.branches.length > 0 ? data.branches : null
            let accountId = data.filter.accountId ?? data.filter.accountId
            let status = data.filter.status ? data.filter.status : null
            let searchTerm = data.searchTerm && data.searchTerm.trim() != "" ? data.searchTerm.trim() : null
            const from = data.filter.from
            const to = data.filter.tos
            const query = {
                text: `select 
            count( "Reconciliations".id) over(),
            "Reconciliations".id,
            "Reconciliations"."from",
            "Reconciliations"."to",
            "Reconciliations"."closingBalance",
            "Reconciliations"."status",
               "Reconciliations"."total",
               "Reconciliations"."reconciledAt",
            "Accounts".name as "accountName",
            "Branches".name as "branchName",
            "Employees".name as "employeeName"
            from "Reconciliations"
            INNER JOIN "Accounts" ON "Accounts".id =  "Reconciliations"."accountId"
            LEFT JOIN "Branches" On "Branches".id = "Reconciliations"."branchId"
            LEFT JOIN "Employees" On "Employees".id = "Employees"."branchId"
            WHERE "Reconciliations"."companyId" = $1
            AND ($2::text IS NULL OR(
                trim(LOWER("Accounts".name)) = trim(LOWER($2)) OR
                trim(LOWER("Employees".name)) = trim(LOWER($2)) OR
                trim(LOWER("Branches".name)) = trim(LOWER($2)) OR 
                trim(LOWER("Reconciliations".status)) = trim(LOWER($2)) 
            ) )
            AND ($3::uuid[] IS NULL OR  "Branches".id = any($3::uuid[]))
            AND ($4::uuid IS NULL OR "Accounts".id = $4)
            AND ($5::text IS NULL OR "Reconciliations"."status" = $5::text)
                 order by   "Reconciliations"."to" desc 
            LIMIT $6
            OFFSET $7`,
                values: [companyId, searchTerm, branches, accountId, status, limit, offset]
            }

            const selectList = await DB.excu.query(query.text, query.values)



            let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
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

            return new ResponseData(true, "", resData)
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getReconciliationDate(data: any, company: Company) {
        const client = await DB.excu.client()
        try {

            await client.query("BEGIN")
            const accountId = data.accountId;
            const query = {
                text: `select max("to")::date + interval '1 day' as "fromDate"  from "Reconciliations"
                         where "companyId"=$1
                         and "accountId" = $2`,
                values: [company.id, accountId]
            }


            const record = await client.query(query.text, query.values)


            let date = record.rows && record.rows.length > 0 && record.rows[0] ? (<any>record.rows[0]).fromDate : null

            if (date == null) {
                date = await this.getReconciliationMinDate(client, accountId, company.id)
            }
            await client.query("COMMIT")

            return new ResponseData(true, "", { data: date });


        } catch (error: any) {
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async deleteReconciliation(id: string, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            let isLatestReconciliation = await this.isLatestReconciliation(client, id)

            if (!isLatestReconciliation) {
                throw new ValidationException("Only Latest Reconciliation Can Be Edited")
            }
            const tables = ['"InvoicePayments"', '"CreditNoteRefundLines"', '"BillingPayments"', '"SupplierRefundLines"', '"Expenses"', '"JournalLines"', '"Payouts"']

            for (let index = 0; index < tables.length; index++) {
                const element = tables[index];
                await client.query(`UPDATE ${element} SET "reconciliationId"  = null where  "reconciliationId" =$1`, [id])
            }

            await client.query(`DELETE from "Reconciliations" WHERE id =$1`, [id])
            await client.query("Commit");

            return new ResponseData(true, "", [])
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK");

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async undoReconcilation(id: string) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")

            let isLatestReconciliation = await this.isLatestReconciliation(client, id)
            if (!isLatestReconciliation) {
                throw new ValidationException("Only Latest Reconciliation Can Be Edited")
            }
            let status = 'in-progress'

            const query = {
                text: `UPDATE "Reconciliations"  set "status" =$1 where id = $2 `,
                values: [status, id]
            }
            await client.query(query.text, query.values)
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


    //TODO:
    /** reconciled date
     * 
     * WHEN UNDO REMOVE 
      */
    public static async getOpeningBalance(client: PoolClient, data: any, company: Company) {
        try {

            const accountId = data.accountId;
            let date = data.date
            date = moment(data.date).format("YYYY-MM-DD");
            console.log(date)
            const query = {
                text: `
                      
                        select   "Reconciliations" ."closingBalance"  as "Debit",
                        0 as "Credit",
                        'Opening Balance' as "transactionDetails",
                         $2::timestamp as "date"
                        from "Reconciliations"  where "accountId" =$1
                        and "Reconciliations"."from"::date < $2
 						order by "to" desc 
						limit 1 `,
                values: [accountId, date]
            }

            let opening = await client.query(query.text, query.values);
            if (opening.rows && opening.rows.length > 0) {
                opening.rows[0].date = date
            }
            let balance = opening.rows && opening.rows.length > 0 ? opening.rows[0] : null

            if(balance == null)
            {
                query.text = `
                select   sum("JournalRecords" ."amount")  as "Debit",
                        0 as "Credit",
                        'Opening Balance' as "transactionDetails",
                         $2::timestamp as "date"
                        from "JournalRecords"  where "accountId" =$1
                        and "JournalRecords"."createdAt"::date < $2
                `
                let journal = await client.query(query.text, query.values);
                balance = journal.rows && journal.rows.length > 0 ? journal.rows[0] : null
            }
            return new ResponseData(true, "", balance)



        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getPreviouisStatus(id: string) {
        try {
            const query = {
                text: `SELECT "status" from "Reconciliations" where id = $1`,
                values: [id]
            }

            let status = await DB.excu.query(query.text, query.values);

            return status.rows && status.rows.length > 0 ? (<any>status.rows[0]).status : null
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getReconciliationMinDate(client: PoolClient, accountId: string, companyId: string) {
        try {
            const query = {
                text: `with "values" as (
                    select
                  $1::uuid as "companyId",
                   $2::uuid as "accountId"
                    ),"transactions" as (
                     select 
                
                    "paymentDate" as "createdAt"
                    from "InvoicePayments"
                    INNER JOIN "values" ON TRUE
                    JOIN "Branches" ON "Branches".id = "InvoicePayments"."branchId"
                    where "status" = 'SUCCESS'
                    and "InvoicePayments"."reconciliationId" is  null
                    and "Branches"."companyId" = "values"."companyId"
                    and "InvoicePayments"."paymentMethodAccountId"  = "values"."accountId"
                    
                    UNION ALL 
                        
                    select 
                   
                    "refundDate" as "createdAt"
                    from "CreditNoteRefunds"
                    INNER JOIN "values" ON TRUE
                    JOIN "CreditNoteRefundLines" ON "CreditNoteRefundLines"."creditNoteRefundId" = "CreditNoteRefunds".id
                    JOIN "Branches" ON "Branches".id = "CreditNoteRefunds"."branchId"
                    AND "CreditNoteRefundLines"."reconciliationId" is  null
					and "Branches"."companyId" = "values"."companyId"
                    and "CreditNoteRefundLines"."accountId"  = "values"."accountId"
               
					
                    UNION ALL
                        
                    select 
                   "paymentDate" as "createdAt"
                    from "BillingPayments"
                    INNER JOIN "values" ON TRUE
                    JOIN "Branches" ON "Branches".id = "BillingPayments"."branchId"
                    and "BillingPayments"."reconciliationId" is  null
				    and "Branches"."companyId" = "values"."companyId"
                    and "BillingPayments"."paymentMethodAccountId"  = "values"."accountId"
                           UNION ALL
                        
                    select 
                   "billingOfEntryDate" as "createdAt"
                    from "BillOfEntries"
                    INNER JOIN "values" ON TRUE
                    JOIN "Branches" ON "Branches".id = "BillOfEntries"."branchId"
                    and "BillOfEntries"."reconciliationId" is  null
				    and "Branches"."companyId" = "values"."companyId"
                    and "BillOfEntries"."paymentMethodAccountId"  = "values"."accountId" 
                    UNION ALL
                        
                    select 
                    
                    "refundedDate" as "createdAt"
                    from "SupplierRefunds"
                    INNER JOIN "values" ON TRUE
                    JOIN "SupplierRefundLines" on "SupplierRefundLines"."supplierRefundId" = "SupplierRefunds".id
                    JOIN "SupplierCredits" ON "SupplierCredits".id = "SupplierRefunds"."supplierCreditId"
                    JOIN "Branches" ON "Branches".id = "SupplierCredits"."branchId"
                    and "SupplierRefundLines"."reconciliationId" is  null
					and "Branches"."companyId" = "values"."companyId"
                    and "SupplierRefundLines"."accountId"  = "values"."accountId"
                    UNION ALL
                        
                    select 
                   
                    "expenseDate" as "createdAt"
                    from "Expenses"
                    INNER JOIN "values" ON TRUE
                    JOIN "Branches" ON "Branches".id = "Expenses"."branchId"
					inner join  "ExpenseLines" on "ExpenseLines"."expenseId" = "Expenses".id 
					inner join "Accounts" on "Accounts".id = "ExpenseLines"."accountId"
                    and "Expenses"."reconciliationId" is  null                    
					and "Branches"."companyId" = "values"."companyId"
                    and "Expenses"."paidThroughAccountId"  = "values"."accountId"
						group by "Expenses".id
						UNION ALL
						
				select 
                    
                        "journalDate" as "createdAt"
                    from "Journals"
                    INNER JOIN "values" ON TRUE
					JOIN "JournalLines" ON "JournalLines"."journalId" =  "Journals".id
					JOIN "Accounts" ON "Accounts".id = "JournalLines"."accountId"
                    JOIN "Branches" ON "Branches".id = "Journals"."branchId"
                    and  "JournalLines"."reconciliationId" is  null
					and "Branches"."companyId" = "values"."companyId"
                    and "JournalLines"."accountId"  = "values"."accountId"
                    )
                    
                    select 
                   
                       MIN("createdAt") as "createdAt"
                    from "transactions"`,
                values: [companyId, accountId]
            }

            let minDate = await client.query(query.text, query.values);

            return minDate.rows && minDate.rows.length > 0 && minDate.rows[0].createdAt ? minDate.rows[0].createdAt : null
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async isLatestReconciliation(client: PoolClient, reconcilationId: string) {
        try {
            const query = {
                text: `SELECT count(*) as  "count" from "Reconciliations"
                      inner join "Reconciliations" "accountReconcilition" on "accountReconcilition"."accountId" = "Reconciliations"."accountId"
                      where "Reconciliations"."id" = $1
                      and "accountReconcilition"."to"::date > "Reconciliations"."to"::date
                 `,
                values: [reconcilationId]
            }

            let validation = await client.query(query.text, query.values);

            if (validation.rows && validation.rows.length > 0 && validation.rows[0].count > 0) {
                return false
            }

            return true

        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }
}