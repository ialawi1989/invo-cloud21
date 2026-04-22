import { DB } from "@src/dbconnection/dbconnection";
import { TriggerQueue } from "../triggers/triggerQueue";
import { ResponseData } from "@src/models/ResponseData";
import { InventoryMovmentTrigger } from "../triggers/inventoryMovmentTrigger";
import { InvoiceRepo } from "../app/accounts/invoice.repo";
import { CompanyRepo } from "./company.repo";
import { PoolClient } from "pg";
import { InvoiceStatuesQueue } from "../triggers/queue/workers/invoiceStatus.worker";
import { Company } from "@src/models/admin/company";
import { UnitCostQueue } from "../triggers/UnitCostQueue";

export class ManageAccountRepo {

    public static async addMissingJournals(companyId: string) {
        try {
            let countInvoices = 0;
            let countInvoicePayments = 0;
            let countCreditNotes = 0;
            let countBillingPayments = 0
            let countBillings = 0
            let countSupplierCredits = 0
            let countCreditNoteRefunds = 0
            let countInventoryTransfer = 0
            let countAppliedCredits = 0
            let countManualJournals = 0
            let countSupplierRefunds = 0
            let countSupplierAppliedCredit = 0
            let countExpenses = 0
            let countPhysicalCount = 0
            let countPayOut = 0


            /** Invoice Journals */

            let query = {
                text: `select "Invoices".id ,"Branches"."companyId"  from "Invoices" 
                    inner join "Branches" on "Branches".id = "Invoices"."branchId"
                    left join "JournalRecords" on "JournalRecords"."referenceId" = "Invoices"."id" and "JournalRecords"."companyId" = $1
                    where "Invoices"."status" <> 'Draft'
                    and "Invoices"."status" <> 'Void' 
                    and "Invoices"."status" <> 'merged' 
                    and "JournalRecords"."referenceId" IS NULL
                    and "Branches"."companyId" = $1`,
                values: [companyId]
            }
            let queueInstance = TriggerQueue.getInstance();

            let missingInvoicesJournal = await DB.excu.query(query.text, query.values);
            if (missingInvoicesJournal && missingInvoicesJournal.rows && missingInvoicesJournal.rows.length > 0) {
                countInvoices = missingInvoicesJournal.rows.length;
                missingInvoicesJournal.rows.forEach((element: any) => {
                    // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [element.id] })
                    InvoiceStatuesQueue.get().createJob({
                        id: element.id
                    } as any);
                    queueInstance.createJob({ journalType: "Movment", type: "invoice", id: [element.id] })
                    queueInstance.createJob({ journalType: "Movment", type: "parentChildMovment", ids: [element.id] })
                    queueInstance.createJob({ type: "Invoices", id: [element.id], companyId: companyId })
                });
            }

            /** Invoice Payments */
            query.text = `	select "InvoicePayments".id , "Branches"."companyId", CASE WHEN count("InvoicePaymentLines".id) <> 0 then JSON_AGG("InvoicePaymentLines"."invoiceId") else '[]' end as "invoiceIds" from "InvoicePayments" 
                            inner join "Branches" on "Branches".id = "InvoicePayments"."branchId"
                            left join "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id 
                            left join "JournalRecords" on "JournalRecords"."referenceId" =  "InvoicePayments".id     and "JournalRecords"."companyId" = $1
                            where   "JournalRecords"."referenceId" is null
                            and "Branches"."companyId" = $1
                            and  "InvoicePayments"."status" = 'SUCCESS'
                            group by "InvoicePayments".id , "Branches"."companyId"
                            `
            query.values = [companyId]
            let missingInvoicePaymentsJournal = await DB.excu.query(query.text, query.values);
            if (missingInvoicePaymentsJournal && missingInvoicePaymentsJournal.rows && missingInvoicePaymentsJournal.rows.length > 0) {
                countInvoicePayments = missingInvoicePaymentsJournal.rows.length;
                missingInvoicePaymentsJournal.rows.forEach((element: any) => {
                    queueInstance.createJob({ type: "InvoicePayments", invoiceIds: element.invoiceIds, id: [element.id], companyId: companyId })
                    // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: element.invoiceIds })
                    if (element.invoiceIds && element.invoiceIds.length > 0) {
                        element.invoiceIds.forEach((element: any) => {
                            InvoiceStatuesQueue.get().createJob({
                                id: element
                            } as any);
                        });
                    }

                });
            }

            /** credit notes */
            query.text = `	select "CreditNotes".id , "Branches"."companyId" , "CreditNotes"."invoiceId" from "CreditNotes" 
                            inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
                            left join "JournalRecords" on "JournalRecords"."referenceId" = "CreditNotes".id    and  "JournalRecords"."companyId" =$1
                            where "JournalRecords"."referenceId" is null
                            and  "Branches"."companyId" =$1
             `
            query.values = [companyId]
            let missingCreditNotesJournal = await DB.excu.query(query.text, query.values);
            if (missingCreditNotesJournal && missingCreditNotesJournal.rows && missingCreditNotesJournal.rows.length > 0) {
                countCreditNotes = missingCreditNotesJournal.rows.length;
                missingCreditNotesJournal.rows.forEach((element: any) => {
                    queueInstance.createJob({ type: "CreditNotes", invoiceId: [element.invoiceId], id: [element.id], companyId: companyId })
                    // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [element.invoiceId] })
                    InvoiceStatuesQueue.get().createJob({
                        id: element.invoiceId
                    } as any);
                    queueInstance.createJob({ journalType: "Movment", type: "creditNote", id: [element.id] })
                });
            }

            /**Billing Payments */
            query.text = `	select "BillingPayments".id ,  "Branches"."companyId"   from "BillingPayments" 
                            inner join "Branches" on "Branches".id = "BillingPayments"."branchId"
                            left join "JournalRecords" on "JournalRecords"."referenceId" =  "BillingPayments".id     and "JournalRecords"."companyId" = $1
                            where   "JournalRecords"."referenceId" is null
                            and  "Branches"."companyId" =$1
                `
            query.values = [companyId]
            let missingBillingPaymentsJournal = await DB.excu.query(query.text, query.values);
            if (missingBillingPaymentsJournal && missingBillingPaymentsJournal.rows && missingBillingPaymentsJournal.rows.length > 0) {
                countBillingPayments = missingBillingPaymentsJournal.rows.length;
                missingBillingPaymentsJournal.rows.forEach((element: any) => {
                    queueInstance.createJob({ type: "BillingPayments", id: element.id, companyId: companyId })
                });
            }

            /**Billings */
            query.text = `	select "Billings".id , "Branches"."companyId" from "Billings" 
                inner join "Branches" on "Branches".id = "Billings"."branchId"
                left join "JournalRecords" on "JournalRecords"."referenceId" = "Billings".id and  "JournalRecords"."companyId" =$1
                where "Billings"."status" <> 'Draft'
                     and "JournalRecords"."referenceId" IS NULL
                and  "Branches"."companyId" =$1
                 `
            query.values = [companyId]
            let missingBillingsJournal = await DB.excu.query(query.text, query.values);
            if (missingBillingsJournal && missingBillingsJournal.rows && missingBillingsJournal.rows.length > 0) {
                countBillings = missingBillingsJournal.rows.length;
                console.log(countBillings),
                    missingBillingsJournal.rows.forEach((element: any) => {
                        console.log("eeeee", element)
                        queueInstance.createJob({ type: "Billings", id: element.id, companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "billing", id: element.id })
                    });
            }
            /**Supplier Credits */
            query.text = `	select  "SupplierCredits".id , "Branches"."companyId" from "SupplierCredits" 
                            inner join "Branches" on "Branches".id = "SupplierCredits"."branchId" 
                            left join "JournalRecords" on "JournalRecords"."referenceId" = "SupplierCredits".id  and  "JournalRecords"."companyId" =$1
                            where "JournalRecords"."referenceId" is null
                            and  "Branches"."companyId" =$1`
            query.values = [companyId]
            let missingSupplierCreditsJournal = await DB.excu.query(query.text, query.values);
            if (missingSupplierCreditsJournal && missingSupplierCreditsJournal.rows && missingSupplierCreditsJournal.rows.length > 0) {
                countSupplierCredits = missingSupplierCreditsJournal.rows.length;
                missingSupplierCreditsJournal.rows.forEach((element: any) => {
                    queueInstance.createJob({ type: "SupplierCredits", id: element.id, companyId: companyId })
                    queueInstance.createJob({ journalType: "Movment", type: "supplierCredit", id: element.id })
                });
            }



            /** Credits Refunds */
            query.text = `	select  "CreditNoteRefunds".id , "Branches"."companyId"  from "CreditNoteRefunds" 
                        inner join "CreditNotes" on "CreditNotes".id = "CreditNoteRefunds"."creditNoteId" 
                        inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
                        left join "JournalRecords" on "JournalRecords"."referenceId" =  "CreditNoteRefunds".id and  "JournalRecords"."companyId" =$1
                        where   "JournalRecords"."referenceId" is null
               and  "Branches"."companyId" =$1`
            query.values = [companyId]
            let missingCreditsRefundsJournal = await DB.excu.query(query.text, query.values);
            if (missingCreditsRefundsJournal && missingCreditsRefundsJournal.rows && missingCreditsRefundsJournal.rows.length > 0) {
                countCreditNoteRefunds = missingCreditsRefundsJournal.rows.length;
                missingCreditsRefundsJournal.rows.forEach((element: any) => {
                    queueInstance.createJob({ type: "CreditNoteRefunds", id: [element.id], companyId: companyId })

                });
            }


            /** InventoryTransfer */
            query.text = `select "InventoryTransfers".id , "Branches"."companyId"  from "InventoryTransfers" 
                        left join "JournalRecords" on "JournalRecords"."referenceId" = "InventoryTransfers".id and  "JournalRecords"."companyId" =$1
                        inner join "Branches" on "Branches".id = "InventoryTransfers"."branchId"
                        where "InventoryTransfers"."status" = 'Confirmed'
                        and "JournalRecords"."referenceId" is null
                    and  "Branches"."companyId" =$1`
            query.values = [companyId]
            let missingInventoryTransfersJournal = await DB.excu.query(query.text, query.values);
            if (missingInventoryTransfersJournal && missingInventoryTransfersJournal.rows && missingInventoryTransfersJournal.rows.length > 0) {
                countInventoryTransfer = missingInventoryTransfersJournal.rows.length;
                missingInventoryTransfersJournal.rows.forEach((element: any) => {
                    queueInstance.createJob({ type: "InventoryTransfer", id: element.id, companyId: companyId })
                    queueInstance.createJob({ journalType: "Movment", type: "trensfer", id: element.id })
                    queueInstance.createJob({ journalType: "Movment", type: "parentChildMovmentInventoryTransfer", ids: [element.id] })
                });
            }


            /** Applied Credits */
            query.text = `select "AppliedCredits".id , "Branches"."companyId" from "AppliedCredits"
                inner join "Invoices" on "Invoices".id = "AppliedCredits"."invoiceId" 
                inner join "Branches" on "Branches".id = "Invoices"."branchId"
                left join "JournalRecords" on "JournalRecords"."referenceId" =  "AppliedCredits".id   and  "JournalRecords"."companyId" =$1
                where   "JournalRecords"."referenceId" is null
                 and  "Branches"."companyId" =$1`
            query.values = [companyId]
            let missingAppliedCreditsJournal = await DB.excu.query(query.text, query.values);
            if (missingAppliedCreditsJournal && missingAppliedCreditsJournal.rows && missingAppliedCreditsJournal.rows.length > 0) {
                countAppliedCredits = missingAppliedCreditsJournal.rows.length;
                missingAppliedCreditsJournal.rows.forEach((element: any) => {
                    queueInstance.createJob({ type: "AppliedCredits", id: element.id, companyId: element.id })

                });
            }


            /** ManualJournals*/
            query.text = `Select "Journals".id , "Branches"."companyId" from "Journals"
                  inner join "Branches" on "Branches".id = "Journals"."branchId"
                  left join "JournalRecords" on "JournalRecords"."referenceId" =  "Journals".id   and  "JournalRecords"."companyId" =$1
                  where   "JournalRecords"."referenceId" is null
                      and "Journals"."status" <> 'Draft'
                   and  "Branches"."companyId" =$1`
            query.values = [companyId]
            let missingManualJournalsJournal = await DB.excu.query(query.text, query.values);
            if (missingManualJournalsJournal && missingManualJournalsJournal.rows && missingManualJournalsJournal.rows.length > 0) {
                countManualJournals = missingManualJournalsJournal.rows.length;
                missingManualJournalsJournal.rows.forEach((element: any) => {
                    queueInstance.createJob({ type: "ManualJournal", id: element.id, companyId: companyId })
                });
            }

            /** SupplierRefunds*/
            query.text = `select  "SupplierRefunds".id , "Branches"."companyId" from "SupplierRefunds" 
                        inner join "SupplierCredits" on "SupplierCredits".id = "SupplierRefunds"."supplierCreditId" 
                        inner join "Billings" on "Billings".id = "SupplierCredits"."billingId" 
                        inner join "Branches" on "Branches".id = "Billings"."branchId"
                        left join "JournalRecords" on "JournalRecords"."referenceId" =  "SupplierRefunds".id   and  "SupplierRefunds"."companyId" =$1
                        where   "JournalRecords"."referenceId" is null
                                and  "Branches"."companyId" =$1`
            query.values = [companyId]
            let missingSupplierRefundsJournal = await DB.excu.query(query.text, query.values);
            if (missingSupplierRefundsJournal && missingSupplierRefundsJournal.rows && missingSupplierRefundsJournal.rows.length > 0) {
                countSupplierRefunds = missingSupplierRefundsJournal.rows.length;
                missingSupplierRefundsJournal.rows.forEach((element: any) => {
                    queueInstance.createJob({ type: "SupplierRefunds", id: element.id, companyId: companyId })
                });
            }
            /** SupplierAppliedCredits */
            query.text = `select "SupplierAppliedCredits".id , "Branches"."companyId" from "SupplierAppliedCredits" 
                            inner join "Billings" on "Billings".id = "SupplierAppliedCredits"."billingId" 
                            inner join "Branches" on "Branches".id = "Billings"."branchId"
                            left join "JournalRecords" on "JournalRecords"."referenceId" =  "SupplierAppliedCredits".id and  "JournalRecords"."companyId" =$1
                            where   "JournalRecords"."referenceId" is null
                        
                            and  "Branches"."companyId" =$1`
            query.values = [companyId]
            let missingSupplierAppliedCreditsJournal = await DB.excu.query(query.text, query.values);
            if (missingSupplierAppliedCreditsJournal && missingSupplierAppliedCreditsJournal.rows && missingSupplierAppliedCreditsJournal.rows.length > 0) {
                countSupplierAppliedCredit = missingSupplierAppliedCreditsJournal.rows.length;
                missingSupplierAppliedCreditsJournal.rows.forEach((element: any) => {
                    queueInstance.createJob({ type: "SupplierAppliedCredit", id: element.id, companyId: companyId })
                });
            }
            /** Expenses */
            query.text = `select  "Expenses".id , "Branches"."companyId" from "Expenses" 
                        inner join "Branches" on "Branches".id = "Expenses"."branchId"
                        left join "JournalRecords" on "JournalRecords"."referenceId" =  "Expenses".id  and  "JournalRecords"."companyId" =$1
                        where "JournalRecords"."referenceId" is null
                        and  "Branches"."companyId" =$1`
            query.values = [companyId]
            let missingExpensesJournal = await DB.excu.query(query.text, query.values);
            if (missingExpensesJournal && missingExpensesJournal.rows && missingExpensesJournal.rows.length > 0) {
                countExpenses = missingExpensesJournal.rows.length;
                missingExpensesJournal.rows.forEach((element: any) => {
                    queueInstance.createJob({ type: "Expenses", id: element.id, companyId: companyId })
                });
            }

            /** PhysicalCounts */
            query.text = `select "PhysicalCounts".id , "Branches"."companyId"  from "PhysicalCounts" 
                            inner join "Branches" on "Branches".id = "PhysicalCounts"."branchId"
                            left join "JournalRecords" on "JournalRecords"."referenceId" = "PhysicalCounts".id   and  "JournalRecords"."companyId" =$1
                            where "PhysicalCounts"."status" = 'Closed'
                            and "JournalRecords"."referenceId" is null
                            and  "Branches"."companyId" =$1`
            query.values = [companyId]
            let missingPhysicalCountsJournal = await DB.excu.query(query.text, query.values);
            if (missingPhysicalCountsJournal && missingPhysicalCountsJournal.rows && missingPhysicalCountsJournal.rows.length > 0) {
                countPhysicalCount = missingPhysicalCountsJournal.rows.length;
                missingPhysicalCountsJournal.rows.forEach((element: any) => {
                    queueInstance.createJob({ type: "PhysicalCount", id: element.id, companyId: companyId })
                    queueInstance.createJob({ journalType: "Movment", type: "physicalCount", id: element.id })
                });
            }


            /** PayOut */
            query.text = `							
							select "Payouts".id , "Branches"."companyId" from "Payouts"
                  inner join "Branches" on "Branches".id = "Payouts"."branchId"
                  left join "JournalRecords" on "JournalRecords"."referenceId" =  "Payouts".id   and  "JournalRecords"."companyId" =$1
                  where   "JournalRecords"."referenceId" is null
                   and  "Branches"."companyId" =$1`
            query.values = [companyId]
            let missingPayOutsJournal = await DB.excu.query(query.text, query.values);
            if (missingPayOutsJournal && missingPayOutsJournal.rows && missingPayOutsJournal.rows.length > 0) {
                countPayOut = missingPayOutsJournal.rows.length;
                missingPayOutsJournal.rows.forEach((element: any) => {
                    queueInstance.createJob({ type: "PayOut", id: [element.id], companyId: companyId })
                });
            }
            let counts = {
                countInvoices: countInvoices,
                countInvoicePayments: countInvoicePayments,
                countCreditNotes: countCreditNotes,
                countBillingPayments: countBillingPayments,
                countBillings: countBillings,
                countSupplierCredits: countSupplierCredits,
                countCreditNoteRefunds: countCreditNoteRefunds,
                countInventoryTransfer: countInventoryTransfer,
                countAppliedCredits: countAppliedCredits,
                countManualJournals: countManualJournals,
                countSupplierRefunds: countSupplierRefunds,
                countSupplierAppliedCredit: countSupplierAppliedCredit,
                countExpenses: countExpenses,
                countPhysicalCount: countPhysicalCount,
                countPayOut: countPayOut

            }

            return new ResponseData(true, "", counts)

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async inBalanceJournals(companyId: string) {
        try {
            const query = {
                text: `select "referenceId" as id ,"dbTable",SUM("amount"::text::numeric )  from  "JournalRecords" where "companyId" =$1
					and "dbTable"<>'Opening Balance'
					group by  "referenceId","dbTable"					
					HAVING SUM("amount"::text::numeric ) <> 0 `,
                values: [companyId]
            }

            let Journals = await DB.excu.query(query.text, query.values);
            let queueInstance = TriggerQueue.getInstance();
            for (let index = 0; index < Journals.rows.length; index++) {
                const element: any = Journals.rows[index];
                switch (element.dbTable) {
                    case 'Invoice':
                        // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [element.id] })
                        InvoiceStatuesQueue.get().createJob({
                            id: element.id
                        } as any);
                        queueInstance.createJob({ journalType: "Movment", type: "invoice", id: [element.id] })
                        queueInstance.createJob({ journalType: "Movment", type: "parentChildMovment", ids: [element.id] })
                        queueInstance.createJob({ type: "Invoices", id: [element.id], companyId: companyId })
                        break;
                    case 'Credit Note':
                        queueInstance.createJob({ type: "CreditNotes", invoiceId: [element.invoiceId], id: [element.id], companyId: companyId })
                        // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [element.invoiceId] })
                        InvoiceStatuesQueue.get().createJob({
                            id: element.id
                        } as any);
                        queueInstance.createJob({ journalType: "Movment", type: "creditNote", id: [element.id] })
                        break;
                    case 'Invoice Payment':
                        queueInstance.createJob({ type: "InvoicePayments", invoiceIds: element.invoiceIds, id: [element.id], companyId: companyId })
                        // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: element.invoiceIds })
                        if (element.invoiceIds && element.invoiceIds.length > 0) {
                            element.invoiceIds.forEach((element: any) => {
                                InvoiceStatuesQueue.get().createJob({
                                    id: element
                                } as any);
                            });
                        }
                        break;
                    case 'Billing Payment':
                        queueInstance.createJob({ type: "BillingPayments", id: element.id, companyId: companyId })
                        break;
                    case 'Billing':
                        queueInstance.createJob({ type: "Billings", id: element.id, companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "billing", id: element.id })
                        break;
                    case 'Supplier Credits':
                        queueInstance.createJob({ type: "SupplierCredits", id: element.id, companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "supplierCredit", id: element.id })
                        break;
                    case 'Inventory Transfer':
                        queueInstance.createJob({ type: "InventoryTransfer", id: element.id, companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "trensfer", id: element.id })
                        queueInstance.createJob({ journalType: "Movment", type: "parentChildMovmentInventoryTransfer", ids: [element.id] })
                        break;
                    case 'Credit Note Refunds':
                        queueInstance.createJob({ type: "CreditNoteRefunds", id: [element.id], companyId: companyId })
                        break;
                    case 'Applied Credit':
                        queueInstance.createJob({ type: "AppliedCredits", id: element.id, companyId: companyId })

                        break;
                    case 'Journals':
                        queueInstance.createJob({ type: "ManualJournal", id: element.id, companyId: companyId })
                        break;
                    case 'Supplier Refunds':
                        queueInstance.createJob({ type: "SupplierRefunds", id: element.id, companyId: companyId })
                        break;
                    case 'Supplier Applied Credit':
                        queueInstance.createJob({ type: "SupplierAppliedCredit", id: element.id, companyId: companyId })
                        break;
                    case 'Expenses':
                        queueInstance.createJob({ type: "Expenses", id: element.id, companyId: companyId })

                        break;
                    case 'Physical Count':
                        queueInstance.createJob({ type: "PhysicalCount", id: element.id, companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "physicalCount", id: element.id })
                        break;
                    case 'Payout':
                        queueInstance.createJob({ type: "PayOut", id: [element.id], companyId: companyId })
                        break;
                    default:
                        break;
                }
            }

            return new ResponseData(true, "", Journals.rows)
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async inBalanceSales(companyId: string) {
        try {
            const query = {
                text: `with "account" as(
                
                select id  from "Accounts" where "companyId"=$1 and "name" = 'Sales' and "default"= true
                ),
                   
                "sales" as (
                    select sum(case when "InvoiceLines"."isInclusiveTax" then "InvoiceLines"."subTotal"::text::numeric -  "InvoiceLines"."taxTotal"::text::numeric else "InvoiceLines"."subTotal"::text::numeric  end )as"sales", "Branches"."companyId" ,"Invoices".id  from "Invoices"
                    inner join "InvoiceLines" on "InvoiceLines"."invoiceId" = "Invoices".id 
                    inner join "Branches" on "Branches".id = "Invoices"."branchId"
                        where "Branches"."companyId" = $1
                        group by "Branches"."companyId","Invoices".id 
                        
                    union all 
                    select sum(case when "CreditNoteLines"."isInclusiveTax" then "CreditNoteLines"."subTotal"::text::numeric -  "CreditNoteLines"."taxTotal"::text::numeric else "CreditNoteLines"."subTotal"::text::numeric  end ) as"sales", "Branches"."companyId" , "CreditNotes".id from "CreditNotes"
                    inner join "CreditNoteLines" on "CreditNoteLines"."creditNoteId" = "CreditNoteLines".id 
                    inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
                            where "Branches"."companyId" = $1
                        group by "Branches"."companyId", "CreditNotes".id 
                    )
                    select "sales".id , "JournalRecords"."referenceId" , "sales"."sales", sum("JournalRecords"."amount") from "sales"
                    left join "JournalRecords" on "JournalRecords"."referenceId" = "sales".id and "JournalRecords"."accountId" = (select * from "account")
                    group by "sales".id , "JournalRecords"."referenceId" , "sales"."sales"
                    having  ("JournalRecords"."referenceId" is null 
                    or abs(sum("JournalRecords"."amount"::text::numeric)) <> abs("sales"."sales")
                    )`,
                values: [companyId]
            }

            let sales = await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", sales.rows)
        } catch (error: any) {
            throw new Error(error)
        }
    }



    public static async inBalanceInventoryAssets(companyId: string) {
        try {
            let queueInstance = TriggerQueue.getInstance();

            const query = {
                text: `with "account" AS (
                        select id from "Accounts" where "companyId" = $1 and "default" = true and name = 'Inventory Assets'
                        )

                        ,"movment" as (
                    select 
                        COALESCE("SupplierCreditLines"."supplierCreditId","BillingLines"."billingId" , "CreditNoteLines"."creditNoteId","InvoiceLines"."invoiceId","InventoryTransferLines"."inventoryTransferId","PhysicalCountLines"."physicalCountId" ,"InventoryMovmentLines"."inventoryMovmentId" ,"InventoryMovmentRecords"."referenceId"  ) as "refid",
                        "InventoryMovmentRecords"."referenceTable",
                           "InventoryMovmentRecords"."branchId", 
                        sum("InventoryMovmentRecords" ."cost"::text::numeric)
                    from "InventoryMovmentRecords" 
                    left join "SupplierCreditLines" on "SupplierCreditLines".id =  "InventoryMovmentRecords" ."referenceId"
                    left join "BillingLines" on "BillingLines".id  = "InventoryMovmentRecords" ."referenceId"
                    left join "CreditNoteLines" on "CreditNoteLines".id  =  "InventoryMovmentRecords" ."referenceId"
                    left join "InvoiceLines" on "InvoiceLines".id  = "InventoryMovmentRecords" ."referenceId"
                    left join "InventoryTransferLines" on "InventoryTransferLines".id  = "InventoryMovmentRecords" ."referenceId"
                    left join "PhysicalCountLines" on "PhysicalCountLines".id  = "InventoryMovmentRecords" ."referenceId"
					left join "InventoryMovmentLines" on "InventoryMovmentLines".id =  "InventoryMovmentRecords" ."referenceId"
                    where "InventoryMovmentRecords"."companyId" = $1
                        group by "refid"	,"InventoryMovmentRecords"."referenceTable",   "InventoryMovmentRecords"."branchId"
                        
                    ),"jo" as (
                    select "referenceId", sum("amount"::text::numeric) from "JournalRecords" where "accountId" = (select * from "account")
                    group by  "referenceId"
                    )  
					
					select *   from "movment"
                    left join "jo" on jo."referenceId" = "movment"."refid"
                    where( jo."referenceId" is null  or  "movment"."sum" <> "jo"."sum" )
					and "movment"."sum" <> 0  `,
                values: [companyId]
            }


            let movment = await DB.excu.query(query.text, query.values)

            movment.rows.forEach((element: any) => {
                let id = element.refid ?? element.referenceTable;
                if (element.referenceTable.toLowerCase().includes("inventory movment") ||
                    element.referenceTable == 'Kit Break' ||
                    element.referenceTable == 'Manual Adjusment' ||
                    element.referenceTable == 'Kit Build'
                ) {
                    console.log(element)
                    queueInstance.createJob({ journalType: "Movment", type: "manualAdjusment", ids: [id] })
                    queueInstance.createJob({ type: "InventoryMovment", movmentIds: [id], companyId: companyId, branchIds: [element.branchId] })

                }
                switch (element.referenceTable) {
                    case 'Billing':
                        queueInstance.createJob({ type: "Billings", id: id, companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "billing", id: id })
                        break;
                    case 'Supplier Credit':
                        queueInstance.createJob({ type: "SupplierCredits", id: id, companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "supplierCredit", id: id })
                        break;
                    case 'CreditNote':
                        queueInstance.createJob({ type: "CreditNotes", invoiceId: [element.invoiceId], id: [id], companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "creditNote", id: [id] })
                        break;
                    case 'Invoice':
                        queueInstance.createJob({ journalType: "Movment", type: "invoice", id: [id] })
                        queueInstance.createJob({ journalType: "Movment", type: "parentChildMovment", ids: [id] })
                        queueInstance.createJob({ type: "Invoices", id: [id], companyId: companyId })
                        break;
                    case 'PhysicalCount':
                        queueInstance.createJob({ type: "PhysicalCount", id: id, companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "physicalCount", id: id })
                        break;
                    case 'InventoryTransfers':
                        queueInstance.createJob({ type: "InventoryTransfer", id: id, companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "trensfer", id: id })
                        queueInstance.createJob({ journalType: "Movment", type: "parentChildMovmentInventoryTransfer", ids: [id] })
                        break;
                    default:
                        break;
                }
            });
            return new ResponseData(true, "", movment.rows)
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async inBalanceInventoryAssets2(companyId: string) {
        try {
            let queueInstance = TriggerQueue.getInstance();

            const query = {
                text: `with "account" AS (
                        select id from "Accounts" where "companyId" = $1 and "default" = true and name = 'Inventory Assets'
                        )

                        ,"movment" as (
                    select 
                        COALESCE("SupplierCreditLines"."supplierCreditId","BillingLines"."billingId" , "CreditNoteLines"."creditNoteId","InvoiceLines"."invoiceId","InventoryTransferLines"."inventoryTransferId","PhysicalCountLines"."physicalCountId" ,"InventoryMovmentLines"."inventoryMovmentId" ,"InventoryMovmentRecords"."referenceId"  ) as "refid",
                        "InventoryMovmentRecords"."referenceTable",
                           "InventoryMovmentRecords"."branchId", 
                        sum("InventoryMovmentRecords" ."cost"::text::numeric)
                    from "InventoryMovmentRecords" 
                    left join "SupplierCreditLines" on "SupplierCreditLines".id =  "InventoryMovmentRecords" ."referenceId"
                    left join "BillingLines" on "BillingLines".id  = "InventoryMovmentRecords" ."referenceId"
                    left join "CreditNoteLines" on "CreditNoteLines".id  =  "InventoryMovmentRecords" ."referenceId"
                    left join "InvoiceLines" on "InvoiceLines".id  = "InventoryMovmentRecords" ."referenceId"
                    left join "InventoryTransferLines" on "InventoryTransferLines".id  = "InventoryMovmentRecords" ."referenceId"
                    left join "PhysicalCountLines" on "PhysicalCountLines".id  = "InventoryMovmentRecords" ."referenceId"
					left join "InventoryMovmentLines" on "InventoryMovmentLines".id =  "InventoryMovmentRecords" ."referenceId"
                    where "InventoryMovmentRecords"."companyId" = $1
                        group by "refid"	,"InventoryMovmentRecords"."referenceTable",   "InventoryMovmentRecords"."branchId"
                        
                    ),"jo" as (
                    select "referenceId", sum("amount"::text::numeric),"dbTable" from "JournalRecords" where "accountId" = (select * from "account")
                    group by  "referenceId","dbTable"
                    )  	select *  from "jo"
                    left join "movment" on jo."referenceId" = "movment"."refid"
                    where( jo."referenceId" is null  or  "movment"."sum" <> "jo"."sum" or  "movment"."refid" is null  )
					
					or "movment"."sum" <> jo."sum" `,
                values: [companyId]
            }


            let movment = await DB.excu.query(query.text, query.values)

            movment.rows.forEach((element: any) => {
                let id = element.refid ?? element.referenceId;
                if (element.dbTable.toLowerCase().includes("inventory movment") ||
                    element.dbTable == 'Kit Break' ||
                    element.dbTable == 'Manual Adjusment' ||
                    element.dbTable == 'Kit Build'
                ) {
                    console.log(element)
                    queueInstance.createJob({ journalType: "Movment", type: "manualAdjusment", ids: [id] })
                    queueInstance.createJob({ type: "InventoryMovment", movmentIds: [id], companyId: companyId, branchIds: [element.branchId] })

                }
                switch (element.dbTable) {
                    case 'Billing':
                        queueInstance.createJob({ type: "Billings", id: id, companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "billing", id: id })
                        break;
                    case 'Supplier Credit':
                        queueInstance.createJob({ type: "SupplierCredits", id: id, companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "supplierCredit", id: id })
                        break;
                    case 'CreditNote':
                        queueInstance.createJob({ type: "CreditNotes", invoiceId: [element.invoiceId], id: [id], companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "creditNote", id: [id] })
                        break;
                    case 'Invoice':
                        queueInstance.createJob({ journalType: "Movment", type: "invoice", id: [id] })
                        queueInstance.createJob({ journalType: "Movment", type: "parentChildMovment", ids: [id] })
                        queueInstance.createJob({ type: "Invoices", id: [id], companyId: companyId })
                        break;
                    case 'PhysicalCount':
                        queueInstance.createJob({ type: "PhysicalCount", id: id, companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "physicalCount", id: id })
                        break;
                    case 'InventoryTransfers':
                        queueInstance.createJob({ type: "InventoryTransfer", id: id, companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "trensfer", id: id })
                        queueInstance.createJob({ journalType: "Movment", type: "parentChildMovmentInventoryTransfer", ids: [id] })
                        break;
                    default:
                        break;
                }
            });
            return new ResponseData(true, "", movment.rows)
        } catch (error: any) {
            throw new Error(error)
        }
    }




    public static async inBalanceCOGS(companyId: string) {
        try {
            let queueInstance = TriggerQueue.getInstance();

            const query = {
                text: `with "account" AS (
                        select id from "Accounts" where "companyId" = $1 and "default" = true and name = 'Costs Of Goods Sold'
                        )

                        ,"movment" as (
                    select 
                        COALESCE("SupplierCreditLines"."supplierCreditId","BillingLines"."billingId" , "CreditNoteLines"."creditNoteId","InvoiceLines"."invoiceId","InventoryTransferLines"."inventoryTransferId","PhysicalCountLines"."physicalCountId" ,"InventoryMovmentLines"."inventoryMovmentId" ,"InventoryMovmentRecords"."referenceId"  ) as "refid",
                        "InventoryMovmentRecords"."referenceTable",
                           "InventoryMovmentRecords"."branchId", 
                        sum("InventoryMovmentRecords" ."cost"::text::numeric)
                    from "InventoryMovmentRecords" 
                    left join "SupplierCreditLines" on "SupplierCreditLines".id =  "InventoryMovmentRecords" ."referenceId"
                    left join "BillingLines" on "BillingLines".id  = "InventoryMovmentRecords" ."referenceId"
                    left join "CreditNoteLines" on "CreditNoteLines".id  =  "InventoryMovmentRecords" ."referenceId"
                    left join "InvoiceLines" on "InvoiceLines".id  = "InventoryMovmentRecords" ."referenceId"
                    left join "InventoryTransferLines" on "InventoryTransferLines".id  = "InventoryMovmentRecords" ."referenceId"
                    left join "PhysicalCountLines" on "PhysicalCountLines".id  = "InventoryMovmentRecords" ."referenceId"
					left join "InventoryMovmentLines" on "InventoryMovmentLines".id =  "InventoryMovmentRecords" ."referenceId"
                    where "InventoryMovmentRecords"."companyId" =  $1
                        group by "refid"	,"InventoryMovmentRecords"."referenceTable",   "InventoryMovmentRecords"."branchId"
                        
                    ),"jo" as (
                    select "referenceId", sum("amount"::text::numeric),"dbTable" from "JournalRecords" where "accountId" = (select * from "account")
                    group by  "referenceId","dbTable"
                    )  	select *  from "movment"
                    left join "jo" on jo."referenceId" = "movment"."refid"
					where  jo."referenceId" is null  `,
                values: [companyId]
            }


            let movment = await DB.excu.query(query.text, query.values)

            movment.rows.forEach((element: any) => {
                let id = element.refid ?? element.referenceTable;
                if (element.referenceTable.toLowerCase().includes("inventory movment") ||
                    element.referenceTable == 'Kit Break' ||
                    element.referenceTable == 'Manual Adjusment' ||
                    element.referenceTable == 'Kit Build'
                ) {
                    console.log(element)
                    queueInstance.createJob({ journalType: "Movment", type: "manualAdjusment", ids: [id] })
                    queueInstance.createJob({ type: "InventoryMovment", movmentIds: [id], companyId: companyId, branchIds: [element.branchId] })

                }
                switch (element.referenceTable) {
                    case 'Billing':
                        queueInstance.createJob({ type: "Billings", id: id, companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "billing", id: id })
                        break;
                    case 'Supplier Credit':
                        queueInstance.createJob({ type: "SupplierCredits", id: id, companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "supplierCredit", id: id })
                        break;
                    case 'CreditNote':
                        queueInstance.createJob({ type: "CreditNotes", invoiceId: [element.invoiceId], id: [id], companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "creditNote", id: [id] })
                        break;
                    case 'Invoice':
                        queueInstance.createJob({ journalType: "Movment", type: "invoice", id: [id] })
                        queueInstance.createJob({ journalType: "Movment", type: "parentChildMovment", ids: [id] })
                        queueInstance.createJob({ type: "Invoices", id: [id], companyId: companyId })
                        break;
                    case 'PhysicalCount':
                        queueInstance.createJob({ type: "PhysicalCount", id: id, companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "physicalCount", id: id })
                        break;
                    case 'InventoryTransfers':
                        queueInstance.createJob({ type: "InventoryTransfer", id: id, companyId: companyId })
                        queueInstance.createJob({ journalType: "Movment", type: "trensfer", id: id })
                        queueInstance.createJob({ journalType: "Movment", type: "parentChildMovmentInventoryTransfer", ids: [id] })
                        break;
                    default:
                        break;
                }
            });
            return new ResponseData(true, "", movment.rows)
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async adjustUnitCost(data: any, companyId: string) {
        try {
            // await DB.excu.query(`update "InventoryMovmentRecords"  set "cost" = ("cost"::text::numeric/ ("qty"::text::numeric) ) 
            //                      where "companyId" = $1 and "qty" > 0  `, [companyId])
            await InventoryMovmentTrigger.companyUnitCostAllocate(data, companyId)

            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async adjustUnitCostbuyProduct(productId: string, branchId: string) {
        try {
            await InventoryMovmentTrigger.allocate(branchId, productId)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getBranchCompanyId(companyId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT id, "Companies"."country" from "Companies"
               where "Companies".id =$1
               `,
                values: [companyId]
            }

            const branch = await DB.excu.query(query.text, query.values)
            let afterDecimal = await CompanyRepo.getCountryAfterDecimal((<any>branch.rows[0]).country)
            return { id: (<any>branch.rows[0]).id, afterDecimal: afterDecimal }
        } catch (error: any) {

            throw new Error(error.message)
        }
    }
    public static async positiveRounding(companyId: string) {
        try {
            let queueInstance = TriggerQueue.getInstance();
            const company = await this.getBranchCompanyId(companyId)
            const query = {
                text: `select "Invoices".* from "Invoices" 
                                inner join "InvoicePaymentLines" on "InvoicePaymentLines"."invoiceId" = "Invoices".id
                                inner join "Branches" on "Branches".id = "Invoices"."branchId" 
                                where "companyId" = $1
                                and "status" = 'Partially Paid'
                                group by  "Invoices".id 
                                having "Invoices"."total"::text::numeric <>  sum("InvoicePaymentLines"."amount"::text::numeric)`,
                values: [companyId]
            }

            let invoices = await DB.excu.query(query.text, query.values)
            if (invoices && invoices.rows && invoices.rows.length > 0) {

                let InvoiceList = invoices.rows
                const invoiceIds: any = InvoiceList.map((f: any) => {
                    return f.id
                })

                console.log("invoiceIdsinvoiceIds", invoiceIds)
                if (invoiceIds && invoiceIds.length > 0) {
                    query.text = `SELECT * FROM "InvoiceLines" where "invoiceId" = any($1) `
                    query.values = [invoiceIds]

                    let lines = await DB.excu.query(query.text, query.values);
                    if (lines && lines.rows && lines.rows.length > 0) {

                        const linesList = lines.rows
                        const lineIds: any = linesList.map((li: any) => {
                            return li.id
                        })
                        console.log("linesListlinesListlinesList", lineIds)
                        if (lineIds && lineIds.length > 0) {
                            query.text = `SELECT * FROM "InvoiceLineOptions" where "invoiceLineId"=any($1)`,
                                query.values = [lineIds]
                            const options = await DB.excu.query(query.text, query.values);
                            const optionsList = options.rows

                            InvoiceList = InvoiceList.map((f: any) => {
                                if (f.roundingType == 'positive') {
                                    f.roundingType == 'normal'
                                    f.smallestCurrency == 0
                                }

                                let tempLines = linesList.filter((line: any) => line.invoiceId == f.id)
                                if (tempLines) {
                                    tempLines = tempLines.map((t: any) => {
                                        const op = optionsList.filter((o: any) => o.invoiceLineId == t.id)
                                        if (op) {
                                            t.options = op
                                        }
                                        return t
                                    })
                                }
                                f.lines = tempLines

                                return f
                            })


                            for (let index = 0; index < InvoiceList.length; index++) {
                                let ivv: any = InvoiceList[index];
                                console.log(ivv.roundingType)
                                console.log(ivv.roundingType == 'positive')
                                if (ivv.roundingType == 'positive') {
                                    ivv.roundingType = 'normal'
                                    ivv.smallestCurrency = 0
                                    ivv.roundingTotal = 0
                                }

                                await this.editInvoice(ivv, company)
                                queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [ivv.id] })
                                InvoiceStatuesQueue.get().createJob({
                                    id: ivv.id
                                } as any);
                                queueInstance.createJob({ type: "Invoices", id: [ivv.id], companyId: company.id })
                            }
                        }
                    }
                }


            }
            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }


    private static async editInvoice(invoice: any, company: any) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")

            await InvoiceRepo.editInvoice(client, invoice, company, invoice.employeeId, true)
            await client.query("COMMIT")
        } catch (error: any) {
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async retryJournal(data: any) {
        try {
            const companyId = data.companyId;
            let ids = []
            const id = data.id;

            if (data.ids) { ids = data.ids }
            else { ids.push(id) }
            const type = data.type;

            let queueInstance = TriggerQueue.getInstance();

            queueInstance.createJob({ type: type, id: ids, companyId: companyId })
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async recalculateInvoices(data: any) {
        try {
            const companyData = data.company;
            let company = new Company();
            company.afterDecimal = companyData.afterDecimal;
            company.id = companyData.id


            const invoices = data.invoices

            let queueInstance = TriggerQueue.getInstance();

            for (let index = 0; index < invoices.length; index++) {
                const invoiceId = invoices[index];
                await this.editRecalculateInvoices(invoiceId, company);
                await InvoiceStatuesQueue.get().createJob({
                    id: invoiceId

                } as any);
                queueInstance.createJob({ type: "Invoices", id: [invoiceId], companyId: company.id })

            }
            return new ResponseData(true, "", {})

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async editRecalculateInvoices(invoiceId: string, company: Company) {
        const client = await DB.excu.client()
        try {

            await client.query("BEGIN")
            let invoice = await InvoiceRepo.getFullInvoice(client, invoiceId);
            await InvoiceRepo.editInvoice(client, invoice, company)
            await client.query("COMMIT")
        } catch (error: any) {
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async reallocateAllProducts(data: any) {
        try {
            const branchId = data.branchId ?? null
            const productId = data.productId ?? null
            const companyId = data.companyId ?? null

            const batches: { branchId: string, products: string[], companyId: string, batchNumber: string }[] = [];
            if (companyId) {
                const branches = !branchId ? await DB.excu.query(`Select id from "Branches" where "companyId" = $1 `, [companyId]) : null
                const batchSize = 100;
                const listOfBranches = !branchId && branches ? branches.rows : [{ id: branchId }];
                if (listOfBranches && listOfBranches.length > 0) {

                    const products = !productId ? await DB.excu.query(`Select id from "Products" where "companyId" = $1 and "type" in ('inventory','kit') and "isDeleted" = false`, [companyId]) : null
                    const productList = products ? products.rows : [{ id: productId }];
                    let batchNumber = 1; // reset for each branch

                    if (productList && productList.length > 0) {
                        const ids = productList.map(p => p.id);

                        listOfBranches.forEach(element => {
                            const branchId = element.id;
                            for (let index = 0; index < ids.length; index += batchSize) {
                                const chunk = ids.slice(index, index + batchSize);
                                batches.push({
                                    branchId: branchId,
                                    products: chunk,
                                    companyId: companyId,
                                    batchNumber: `batch:${batchNumber}`
                                });
                                batchNumber++;
                            }

                        });
                    }

                }
            }


            if (batches && batches.length > 0) {
                const unitCostallocate = UnitCostQueue.getInstance();
                batches.forEach(element => {
                    unitCostallocate.createJob({ type: "reallocateTheProducts", data: element })
                });
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }
}