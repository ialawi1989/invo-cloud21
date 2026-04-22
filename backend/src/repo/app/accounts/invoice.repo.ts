/* eslint-disable prefer-const */
import { DB } from "@src/dbconnection/dbconnection";
import { Invoice } from "@src/models/account/Invoice";
import { InvoiceLine } from "@src/models/account/InvoiceLine";
import { InvoiceLineOption } from "@src/models/account/invoiceLineOption";
import { ResponseData } from "@src/models/ResponseData";
import { Helper } from "@src/utilts/helper";
import { PoolClient } from "pg";
import { InvoiceInventoryMovmentRepo } from "./InvoiceInventoryMovment.repo";

import { writeFile } from 'fs';
import { promisify } from 'util';

import { ProductRepo } from "../product/product.repo";
import { SocketInvoiceRepo } from "@src/repo/socket/invoice.socket";
import { Company } from "@src/models/admin/company";
import { TimeHelper } from "@src/utilts/timeHelper";
import { CustomerRepo } from "./customer.repo";

import { BatchProductRepo } from "../product/productTypes/batchProduct.reps";
import { SerialProductRepo } from "../product/productTypes/serilizedProduct.repo";
import { getValuable } from "@src/utilts/getValuable";
import { InvoiceMini } from "@src/models/account/Invoice.mini";
import { EventLog, Log } from "@src/models/log";
import { RecipeRepo } from "../product/recipe.repo";
import { PDFGenerator } from "@src/utilts/PDFGenerator";
import { ValidationException } from "@src/utilts/Exception";
import { InvoicePaymentLine } from "@src/models/account/InvoicePaymentLine";
import { PluginRepo } from "@src/repo/app/accounts/plugin.repo";
import { PurchaseOrderRepo } from "@src/repo/app/accounts/PurchaseOrder.Repo";
import { BillingRepo } from "@src/repo/app/accounts/billing.repo";
import { BillingPaymentRepo } from "@src/repo/app/accounts/billingPayment.repo";
import { InvoicePaymentRepo } from "@src/repo/app/accounts/invoicePayment.repo";
import { EstimateRepo } from "@src/repo/app/accounts/estimate.repo";
import { CreditNoteRepo } from "@src/repo/app/accounts/creditNote.Repo";
import { SupplierCreditRepo } from "@src/repo/app/accounts/supplierCredit.repo";
import { ExpenseRepo } from '@src/repo/app/accounts/expense.repo';
import { FileStorage } from "@src/utilts/fileStorage";
import { EventLogsRepo } from "./eventlogs.repo";
import { EventLogsSocket } from "@src/repo/socket/eventLogs.socket";
import { TriggerQueue } from "@src/repo/triggers/triggerQueue";
import { EinvoiceRepo } from "@src/repo/E-invoice/E-invoice.repo";
import { SesService } from "@src/utilts/SES";
import { S3Storage } from "@src/utilts/S3Storage";
import { BranchesRepo } from '@src/repo/admin/branches.repo';
import { EGS, EGSUnitInfo } from "@src/Integrations/zatcaLib/zatca/egs";
import populate, { ZATCAInvoiceTypes, ZATCAPaymentMethods, ZATCASimplifiedInvoicCancelation, ZATCASimplifiedInvoiceLineItem, ZATCASimplifiedInvoiceProps } from "@src/Integrations/zatcaLib/zatca/templates/simplified_tax_invoice_template";
import { ZATCASimplifiedTaxInvoice } from "@src/Integrations/zatcaLib/zatca/ZATCASimplifiedTaxInvoice";
import { TableConfig, TableDataService, TableRequest } from "@src/utilts/TableDataService";
import { CustomizationRepo } from "../settings/Customization.repo";
import { BillOfEntryRepo } from "./billOfEntry.repo";
import { TransactionManagements } from "@src/utilts/TransactionsManagments";
import { PaymentRepo } from "@src/repo/ecommerce/pament.repo";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";
import { publishEvent } from "@src/utilts/system-events";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";

export class InvoiceRepo {


    public static async checkIfInvoiceLineIdExist(client: PoolClient, invoiceLineId: string, invoiceId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT count(*),"invoiceId" from "InvoiceLines" where id=$1 group by "invoiceId"`,
                values: [invoiceLineId]
            }
            const count = await client.query(query.text, query.values)

            if (count.rowCount != null && count.rowCount > 0) {
                return true
            } else {
                return false
            }
        } catch (error: any) {



            throw new Error(error.message)
        }
    }







    public static async zatcaSamplifedInvoice(client: PoolClient, invoiceId: string, company: Company) {
        try {
            const invoiceData: Invoice = (await InvoiceRepo.getInvoiceById(invoiceId, company)).data;
            let branch = await BranchesRepo.getBranchById(invoiceData.branchId, company);
            let xmlInvoiceLines: ZATCASimplifiedInvoiceLineItem[] = []
            let LineId = 0;
            //TODO: 
            invoiceData.lines.filter(f => f.qty > 0).forEach((line: InvoiceLine) => {
                LineId++;
                const voided = invoiceData.lines.filter(voided => voided.voidFrom == line.id).length > 0 ? invoiceData.lines.filter(voided => voided.voidFrom == line.id) : line.voidedItems;
                const { totalQty, totalSubtotal, discountTotal } = voided.reduce(
                    (acc, item) => {
                        acc.totalQty += Math.abs(item.qty) || 0;
                        acc.totalSubtotal += Math.abs(item.subTotal) || 0;
                        acc.discountTotal += Math.abs(item.discountTotal) || 0;
                        return acc;
                    },
                    { totalQty: 0, totalSubtotal: 0, discountTotal: 0 }
                );

                let qtyDifference = line.qty - totalQty
                let subTotalDifference = line.subTotal - totalSubtotal
                let discountDifference = line.discountTotal - discountTotal
                if (qtyDifference > 0) {
                    const line_item: ZATCASimplifiedInvoiceLineItem = {
                        id: LineId.toString(),
                        name: line.productName,
                        quantity: qtyDifference,
                        tax_exclusive_price: subTotalDifference,
                        VAT_percent: line.taxPercentage / 100,
                        other_taxes: [
                        ],
                        discounts: [
                            { amount: discountDifference, reason: "A discount" },
                        ]
                    };
                    xmlInvoiceLines.push(line_item);
                }

            });
            if (xmlInvoiceLines.length == 0) return
            const egsunit: EGSUnitInfo = branch.data.zatca.zatca
            // Sample Invoice
            const invoice = new ZATCASimplifiedTaxInvoice({
                props: {
                    egs_info: egsunit,
                    invoice_counter_number: 1,
                    invoice_serial_number: invoiceData.invoiceNumber as any,
                    issue_date: new Date(invoiceData.createdAt).toISOString().split('T')[0],
                    issue_time: new Date(invoiceData.createdAt).toTimeString().split(' ')[0].substring(0, 8),
                    previous_invoice_hash: "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==",
                    line_items: xmlInvoiceLines
                }
            });
            const egs = new EGS(egsunit);


            if (process.env.NODE_ENV == 'production') {
                const { signed_invoice_string, invoice_hash, qr } = await egs.signInvoice(invoice, true);
                let reported = await egs.reportInvoice(signed_invoice_string, invoice_hash);
                console.log(reported);
                return reported;
            } else {
                const { signed_invoice_string, invoice_hash, qr } = await egs.signInvoice(invoice);
                let complince = await egs.checkInvoiceCompliance(signed_invoice_string, invoice_hash);
                return complince;
            }
        } catch (error: any) {

            throw error;
        }
    }





    public static async zatcaComplinceInvoice(egs: EGS) {
        try {
            let egsunit: EGSUnitInfo = egs.get();
            let Complince = [];
            const line_item: ZATCASimplifiedInvoiceLineItem = {
                id: "1",
                name: "TEST NAME",
                quantity: 5,
                tax_exclusive_price: 10,
                VAT_percent: 0.15,
                other_taxes: [
                ],
                discounts: [
                    { amount: 2, reason: "A discount" },
                    { amount: 2, reason: "A second discount" }
                ]
            };

            const invoice = new ZATCASimplifiedTaxInvoice({
                props: {
                    egs_info: egsunit,
                    invoice_counter_number: 1,
                    invoice_serial_number: "EGS1-886431145-1",
                    issue_date: "2022-03-13",
                    issue_time: "14:40:40",
                    previous_invoice_hash: "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==",
                    line_items: [
                        line_item,
                        line_item,
                        line_item
                    ]
                }
            });

            const { signed_invoice_string, invoice_hash, qr } = egs.signInvoice(invoice, false);
            let InvoiceComplince = await egs.checkInvoiceCompliance(signed_invoice_string, invoice_hash);
            console.log(InvoiceComplince);
            Complince.push(InvoiceComplince);



            const creditNoteCansilationBody: ZATCASimplifiedInvoicCancelation = {
                canceled_invoice_number: 0,
                payment_method: ZATCAPaymentMethods.CASH,
                cancelation_type: ZATCAInvoiceTypes.CREDIT_NOTE,
                reason: ""
            }

            const creditNote = new ZATCASimplifiedTaxInvoice({
                props: {
                    egs_info: egsunit,
                    invoice_counter_number: 1,
                    invoice_serial_number: "EGS1-886431145-1",
                    issue_date: "2022-03-13",
                    issue_time: "14:40:40",
                    previous_invoice_hash: "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==",
                    line_items: [
                        line_item,
                        line_item,
                        line_item
                    ]
                    , cancelation: creditNoteCansilationBody
                }
            });

            const CreditNote = egs.signInvoice(creditNote);
            let creditNotecomplince = await egs.checkInvoiceCompliance(CreditNote.signed_invoice_string, CreditNote.invoice_hash);
            console.log(creditNotecomplince);
            Complince.push(creditNotecomplince);


            const DebitNoteCansilationBody: ZATCASimplifiedInvoicCancelation = {
                canceled_invoice_number: 0,
                payment_method: ZATCAPaymentMethods.CASH,
                cancelation_type: ZATCAInvoiceTypes.DEBIT_NOTE,
                reason: ""
            }

            const debitNote = new ZATCASimplifiedTaxInvoice({
                props: {
                    egs_info: egsunit,
                    invoice_counter_number: 1,
                    invoice_serial_number: "EGS1-886431145-1",
                    issue_date: "2022-03-13",
                    issue_time: "14:40:40",
                    previous_invoice_hash: "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==",
                    line_items: [
                        line_item,
                        line_item,
                        line_item
                    ]
                    , cancelation: DebitNoteCansilationBody
                }
            });


            const DebitNote = egs.signInvoice(debitNote);
            let DebitNotecomplince = await egs.checkInvoiceCompliance(DebitNote.signed_invoice_string, DebitNote.invoice_hash);
            console.log(DebitNotecomplince);
            Complince.push(DebitNotecomplince);


            return Complince;

        } catch (error: any) {
            console.log(error);

            throw new Error(error.message)
        }
    }






    public static async validateInvoiceAmount(client: PoolClient, invoiceId: string, invoiceTotal: number, edites: boolean = false) {
        try {
            const query: { text: string, values: any } = {
                text: `with "invoice" as (
                    select "Invoices".id from "Invoices" where id = $1
                ), "creditNotes" as (
                select "CreditNotes"."invoiceId",sum( "CreditNotes".total::text::numeric) as total from "invoice"
                    inner join "CreditNotes" on "invoice".id = "CreditNotes"."invoiceId"
                    group by "CreditNotes"."invoiceId"
                ), "appliedCredits" as (
                select  "AppliedCredits"."invoiceId", sum( "AppliedCredits".amount::text::numeric) as total from "invoice"
                    inner join "AppliedCredits" on "invoice".id = "AppliedCredits"."invoiceId"
                        group by "AppliedCredits"."invoiceId"
                ), "invoicePaymnets" as (
                select "InvoicePaymentLines"."invoiceId",sum( "InvoicePaymentLines".amount::text::numeric) as total from "invoice"
                    inner join "InvoicePaymentLines" on "invoice".id = "InvoicePaymentLines"."invoiceId" 
                    inner join "InvoicePayments" ON "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id and "InvoicePayments".status ='SUCCESS'
                    
                    group by "InvoicePaymentLines"."invoiceId"
                )
                
                select COALESCE("creditNotes".total::text::numeric,0)+COALESCE("appliedCredits".total::text::numeric,0)+COALESCE("invoicePaymnets".total::text::numeric,0) as total
                from "invoice"
                left join "creditNotes" on "creditNotes"."invoiceId" = "invoice".id 
                left join "appliedCredits" on "appliedCredits"."invoiceId" = "invoice".id 
                left join "invoicePaymnets" on "invoicePaymnets"."invoiceId" = "invoice".id 
                `,
                values: [invoiceId]
            }

            let paid = (await client.query(query.text, query.values)).rows[0].total

            if (paid > invoiceTotal && !edites) {
                throw new ValidationException("Invoice Paid amount is greater than invoice balance ")
            }
            if (edites) {
                return paid
            }

            return true
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async checkIfInvoiceLineOptionIdExist(client: PoolClient, invoiceLineOptionId: string, invoiceLineId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT count(*) from "InvoiceLineOptions" where id=$1 and "invoiceLineId"=$2`,
                values: [invoiceLineOptionId, invoiceLineId]
            }
            const count = await client.query(query.text, query.values)
            if (count.rowCount != null && count.rowCount > 0) {
                return true
            } else {
                return false
            }
        } catch (error: any) {


            throw new Error(error.message)
        }
    }

    /**Check Invoice Number If Exist */
    // public static async checkIsInvoiceNumberExist(client: PoolClient, id: string | null, invoiceNumber: string, companyId: string) {
    //     try {

    //         const branchesQuery: { text: string, values: any } = {
    //             text: `select id from "Branches" where "companyId" = $1 `,
    //             values: [companyId]
    //         }

    //         const branches = await client.query(branchesQuery.text, branchesQuery.values);

    //         /*

    //                 select id from "Branches" where "companyId" = 'f2b01021-5033-4ef3-887d-c9d831bd5d08'


    //             select "invoiceNumber" 
    //                 FROM "Invoices"
    //                 where "branchId" in ('e6d6b3ff-b7d3-4e4a-8333-74e83df010b5','6722291b-b9e9-4522-acde-3f1c3e019816', '8047fced-2e74-4edf-ae99-76d5442cff20', 'b1f4fca0-edfb-46e8-b80c-cbea6e0a0afe', 'ce4ce928-794d-4094-a1a6-28672c9890bf', '46b6ca62-fbab-4b56-873c-5e55c2914459')
    //                 and nullif(regexp_replace("invoiceNumber", '^(INV-)', ''),'')  = '27'   



    //         */

    //               console.log("branches.rows")
    //               console.log("branches.rows")
    //               console.log(branches.rows)
    //               console.log("branches.rows")
    //               console.log("branches.rows")






    //         const prefixReg = "^(INV-)";
    //         const prefix = "INV-"
    //         const num = invoiceNumber.replace(prefix, '');
    //         const numTerm = '%' + invoiceNumber.toLocaleLowerCase() + '%'
    //         const query: { text: string, values: any } = {
    //             text: `select "invoiceNumber" 
    //                 FROM "Invoices"
    //                 where "branchId" in ($1)
    //                 and nullif(regexp_replace("invoiceNumber", '$2', ''),'')  = $3  
    //             `,
    //             values: [branches.rows, prefixReg, num]
    //         }

    //         console.log("ddddddddd")

    //         if (id != null) {
    //             query.text = `select "invoiceNumber" 
    //                 FROM "Invoices"
    //                 where "branchId" in ($1)
    //                 AND (nullif(regexp_replace("invoiceNumber", '$2', ''),'')  = $3 OR ( LOWER("invoiceNumber") LIKE $4 )) 
    // 				AND "Invoices".id = $5`
    //             query.values = [branches.rows, prefixReg, num, numTerm, id]
    //         }
    //         const invoiceNumberData = await client.query(query.text, query.values);
    //         if (invoiceNumberData.rowCount != null && invoiceNumberData.rowCount > 0) {
    //             return true;
    //         } else {
    //             return false;
    //         }
    //     } catch (error: any) {
    //       
    //         throw new Error(error.message)
    //     }
    // }








    public static async checkIsInvoiceNumberExist(
        client: PoolClient,
        id: string | null,
        invoiceNumber: string,
        companyId: string
    ) {
        try {
            // Fetch branch IDs for the company
            const branchesQuery: { text: string; values: any[] } = {
                text: `SELECT id FROM "Branches" WHERE "companyId" = $1`,
                values: [companyId],
            };

            const branchesResult = await client.query(branchesQuery.text, branchesQuery.values);
            const branchIds = branchesResult.rows.map((row) => row.id);

            if (branchIds.length === 0) {
                return false; // No branches for the given company
            }

            // Prepare the invoice check
            const prefix = "INV-";
            const num = invoiceNumber.replace(prefix, '');
            const numTerm = `${invoiceNumber.toLowerCase().trim()}`;

            // Construct the query for checking invoice number
            let queryText = `--sql
                SELECT "invoiceNumber"
                FROM "Invoices"
                WHERE "companyId" = $1
                and "branchId" = ANY($2)
                AND trim(( LOWER("invoiceNumber"))) = $3 
            `;
            const queryParams = [companyId, branchIds, numTerm];

            if (id != null) {
                queryText = `--sql
                    SELECT "invoiceNumber"
                    FROM "Invoices"
                    WHERE "companyId" = $1
                    and "branchId" = ANY($2)
                   AND ( trim(LOWER("invoiceNumber"))) = $3 
                    AND "Invoices".id != $4
                `;
                queryParams.push(id);
            }
            console.log("queryParams");
            console.log(queryParams);
            console.log("queryParams");
            const invoiceCheckResult = await client.query(queryText, queryParams);

            return (invoiceCheckResult.rowCount ?? 0) > 0;
        } catch (error: any) {
            console.log(error)

            throw new Error(error.message);
        }
    }



    public static addInvoiceLog(invoice: Invoice, action: string, comment: string, employeeId: string) {
        try {
            let log = new Log();
            log.employeeId = employeeId ?? "";
            log.action = action
            log.createdAt = new Date();
            log.comment = comment;
            if (invoice.logs == null) {
                invoice.logs = [];
            }
            invoice.logs.push(log);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    /**Payment Balance (exclude amount for edit payment line)*/
    public static async checkInvoiceAmount(client: PoolClient, invoiecId: string, amount: number, excludeAmount?: number) {
        try {

            const balanceData = await InvoiceRepo.getInvoiceBalance(client, invoiecId);
            let balance = balanceData.data.balance
            const invoiceNumber = balanceData.data.invoiceNumber
            if (typeof excludeAmount !== 'undefined') {
                balance += excludeAmount;
            }

            if (balance && balance < amount) {

                throw new ValidationException("Invalid  Payment Amount for " + invoiceNumber)
            }
            return balance - amount;
        } catch (error: any) {

            throw new Error(error.message)
        }
    }

    public static async getInvoiceBalance(client: PoolClient, invoiecId: string, paymentId: string | null = null) {
        try {

            const query: { text: string, values: any } = {
                text: `with "invoiceTotal" as (
                    select "Invoices".id,
                           "Invoices".total,
                           "Invoices"."branchId",
                           "Invoices"."invoiceNumber"
                        from "Invoices" 
                    where "Invoices".id = $1
                    ),"appliedCredits" as (
                    select sum ("AppliedCredits"."amount"::text::numeric) as total ,"invoiceTotal".id from "AppliedCredits"
                    inner join "invoiceTotal" on  "invoiceTotal".id = "AppliedCredits"."invoiceId" 
                    group by "invoiceTotal".id
                    ),"creditNotestotal" as (
                    select sum ("CreditNotes"."total"::text::numeric) as total,"invoiceTotal".id from "CreditNotes"
                    inner join "invoiceTotal" on "invoiceTotal".id = "CreditNotes"."invoiceId" 
                    group by "invoiceTotal".id
                    ),"invoicePayments" as (
                    select sum ("InvoicePaymentLines"."amount"::text::numeric) as total,"invoiceTotal".id from "InvoicePaymentLines"
                    inner join "invoiceTotal" on "invoiceTotal".id = "InvoicePaymentLines"."invoiceId" 
                    left join "InvoicePayments" on "InvoicePayments".id =  "InvoicePaymentLines" ."invoicePaymentId"  
                    WHERE  ("InvoicePayments"."status" ='SUCCESS')
                    group by "invoiceTotal".id
                    ),"refunds" as (
					  select sum ("CreditNoteRefunds"."total"::text::numeric) as total,"invoiceTotal".id from "invoiceTotal"
                    inner join "CreditNotes" on "invoiceTotal".id = "CreditNotes"."invoiceId" 
					inner join "CreditNoteRefunds" ON "CreditNoteRefunds"."creditNoteId" = "CreditNotes"."id"
                    group by "invoiceTotal".id
					)
                    
                    select 
                     ("invoiceTotal".total::text::numeric - (COALESCE("appliedCredits".total::text::numeric,0) + COALESCE("creditNotestotal".total::text::numeric,0) + COALESCE("invoicePayments".total::text::numeric,0))) + COALESCE("refunds".total::text::numeric,0)  as balance ,
                     "invoiceTotal"."invoiceNumber",
                     "invoiceTotal"."branchId"
                    from "invoiceTotal" 
                    left join "appliedCredits" on  "invoiceTotal".id = "appliedCredits".id 
                    left join "creditNotestotal" on  "invoiceTotal".id = "creditNotestotal".id 
                    left join "invoicePayments" on  "invoiceTotal".id = "invoicePayments".id
                    left join "refunds" on  "invoiceTotal".id = "refunds".id 			
                    `,
                values: [invoiecId]
            }

            if (paymentId != "" && paymentId != null) {
                query.text = `
                with "invoiceTotal" as (
                    select "Invoices".id,
                           "Invoices".total,
                           "Invoices"."branchId",
                           "Invoices"."invoiceNumber"
                        from "Invoices" 
                    where "Invoices".id = $1
                    ),"appliedCredits" as (
                    select sum ("AppliedCredits"."amount"::text::numeric) as total ,"invoiceTotal".id from "AppliedCredits"
                    inner join "invoiceTotal" on  "invoiceTotal".id = "AppliedCredits"."invoiceId" 
                    group by "invoiceTotal".id
                    ),"creditNotestotal" as (
                    select sum ("CreditNotes"."total"::text::numeric) as total,"invoiceTotal".id from "CreditNotes"
                    inner join "invoiceTotal" on "invoiceTotal".id = "CreditNotes"."invoiceId" 
                    group by "invoiceTotal".id
                    ),"invoicePayments" as (
                    select sum ("InvoicePaymentLines"."amount"::text::numeric) as total,"invoiceTotal".id from "InvoicePaymentLines"
                    inner join "invoiceTotal" on "invoiceTotal".id = "InvoicePaymentLines"."invoiceId" 
                    left join "InvoicePayments" on "InvoicePayments".id =  "InvoicePaymentLines" ."invoicePaymentId"  
                    WHERE  "InvoicePayments"."status" ='SUCCESS'
                        AND  "InvoicePaymentLines"."invoicePaymentId" <> $2
                    group by "invoiceTotal".id
                    ),"refunds" as (
					  select sum ("CreditNoteRefunds"."total"::text::numeric) as total,"invoiceTotal".id from "invoiceTotal"
                    inner join "CreditNotes" on "invoiceTotal".id = "CreditNotes"."invoiceId" 
					inner join "CreditNoteRefunds" ON "CreditNoteRefunds"."creditNoteId" = "CreditNotes"."id"
                    group by "invoiceTotal".id
					)
                    
                    select 
                     ("invoiceTotal".total::text::numeric - (COALESCE("appliedCredits".total::text::numeric,0) + COALESCE("creditNotestotal".total::text::numeric,0) + COALESCE("invoicePayments".total::text::numeric,0))) + COALESCE("refunds".total::text::numeric,0)  as balance ,
                     "invoiceTotal"."invoiceNumber",
                     "invoiceTotal"."branchId"
                    from "invoiceTotal" 
                    left join "appliedCredits" on  "invoiceTotal".id = "appliedCredits".id 
                    left join "creditNotestotal" on  "invoiceTotal".id = "creditNotestotal".id 
                    left join "invoicePayments" on  "invoiceTotal".id = "invoicePayments".id
                    left join "refunds" on  "invoiceTotal".id = "refunds".id 			
                   `
                query.values = [invoiecId, paymentId]
            }

            const balanceData = await client.query(query.text, query.values);

            if (balanceData.rows && balanceData.rows.length > 0) {
                const balance = (<any>balanceData.rows[0]).balance
                const invoiceNumber = (<any>balanceData.rows[0]).invoiceNumber
                return new ResponseData(true, "", { balance: balance, invoiceNumber: invoiceNumber, branchId: (<any>balanceData.rows[0]).branchId })
            } else {
                return new ResponseData(true, "", { balance: null, invoiceNumber: '' })
            }

        } catch (error: any) {
            console.log(error)

            throw new Error(error.message)
        }

    }

    /**To Check if line is totally voided */
    public static async getLineTotalQty(client: PoolClient, lineId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT ( "InvoiceLines".qty + sum(COALESCE("voidedLines".qty,0))) as "qty" FROM "InvoiceLines"
                LEFT JOIN "InvoiceLines" "voidedLines"  ON "voidedLines"."voidFrom" ="InvoiceLines".id 
                where   "InvoiceLines".id =$1
                group by  "InvoiceLines".id
                      `,
                values: [lineId]
            }

            let qty = await client.query(query.text, query.values);
            return qty.rows[0].qty
        } catch (error: any) {


            throw new Error(error)
        }
    }

    /**To Compare Old cost of line with current line cost */
    public static async getOldInvoiceLineQtyToTAL(client: PoolClient, invoiceLineId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT qty ,price, qty*price as "oldCost" from "InvoiceLines"
                      WHERE "InvoiceLines".id = $1`,
                values: [invoiceLineId]
            }

            const qty = await client.query(query.text, query.values);
            return qty.rows[0]
        } catch (error: any) {

            throw new Error(error.message)
        }
    }

    public static async getInvoiceSource(client: PoolClient, invoiceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT source,"onlineData","readyTime", "departureTime","arrivalTime","tableId" from "Invoices" where id =$1`,
                values: [invoiceId]
            }
            const invoice = await client.query(query.text, query.values)
            return {
                source: (<any>invoice.rows[0]).source,
                onlineStatus: (<any>invoice.rows[0]).onlineData != null ? (<any>invoice.rows[0]).onlineData.onlineStatus : '',
                readyTime: (<any>invoice.rows[0]).readyTime,
                departureTime: (<any>invoice.rows[0]).departureTime,
                arrivalTime: (<any>invoice.rows[0]).arrivalTime,
                tableId: (<any>invoice.rows[0]).tableId

            }
        } catch (error: any) {


            throw new Error(error.message)
        }
    }


    public static async setInvoiceLog(client: PoolClient, invoiceId: string, logs: Log[], branchId: string, companyId: string, employeeId: string | null, invoiceNumber: string | null, source: string) {
        try {
            await LogsManagmentRepo.manageLogs(client, "Invoices", invoiceId, logs, branchId, companyId, employeeId, invoiceNumber, source)
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async setBezatNotifcation(client: PoolClient, invoiceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `UPDATE "Invoices" SET "bezat_notification_sent"= True where id =$1 `,
                values: [invoiceId]
            }
            await client.query(query.text, query.values);
        } catch (error: any) {
            throw new Error(error)
        }
    }







    public static async getInvoiceLogs(client: PoolClient, invoiceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `Select logs from  "Invoices" where id =$1 `,
                values: [invoiceId]
            }
            let invoice = await client.query(query.text, query.values);
            return invoice.rows[0].logs ?? []
        } catch (error: any) {
            throw new Error(error);
        }
    }

    public static async checkIfGruptechIdExist(client: PoolClient, orderId: string) {
        const query: { text: string, values: any } = {
            text: `SELECT true as "true" 
                    FROM "Invoices" i 
                    WHERE "grubTechData" ->> 'id' =$1  AND i."grubTechData" IS NOT NULL
                    AND i."grubTechData" <> '{}'  limit 1`,
            values: [
                orderId,
            ],
        };

        const resault = await client.query(query.text, query.values);
        if ((<any>resault.rows).length > 0 && (<any>resault.rows[0]).true) {
            return true;
        }

        return false;
    }


    public static async addInvoice(client: PoolClient, data: any, company: Company) {


        try {
            const companyId = company.id
            const afterDecimal = company.afterDecimal


            const invoice = new Invoice();
            invoice.ParseJson(data);
            invoice.companyId = companyId;

            if (invoice.invoiceNumber) {
                const isInvoiceNumberExist = await this.checkIsInvoiceNumberExist(client, null, invoice.invoiceNumber, companyId);
                if (isInvoiceNumberExist) {

                    throw new ValidationException("Invoice Number Already Used")
                }
            }

            invoice.createdAt = new Date()
            invoice.updatedDate = new Date()
            invoice.chargeType = 'chargeBeforeTax'
            // if (invoice.chargeId != null && invoice.chargeId != "") {
            //     let chargeTax = (await SurchargeRepo.getSurchargeTax(client, invoice.chargeId)).data;
            //     if (chargeTax) {
            //         invoice.chargesTaxDetails = new TaxDetails()
            //         invoice.chargesTaxDetails.taxId = chargeTax.id;
            //         invoice.chargesTaxDetails.type = chargeTax.taxType;
            //         invoice.chargesTaxDetails.taxPercentage = chargeTax.taxPercentage;
            //         invoice.chargesTaxDetails.taxes = chargeTax.taxes
            //     }

            // }
            invoice.calculateTotal(afterDecimal);
            const query: { text: string, values: any } = {
                text: `INSERT INTO "Invoices" ( 
                                                      "invoiceNumber",
                                                       "refrenceNumber",
                                                        total,
                                                        note,
                                                        guests,
                                                        "employeeId",
                                                        "tableId",
                                                        "branchId",
                                                         source,
                                                         "serviceId",
                                                         "customerId" ,
                                                         "customerAddress",
                                                         "customerContact",
                                                         "customerLatLang",
                                                         "estimateId",
                                                         status,
                                                         "discountTotal",
                                                         "chargeTotal",
                                                         "chargeAmount",
                                                         "chargePercentage",
                                                         "chargeId",
                                                         "discountAmount",
                                                         "discountPercentage",
                                                         "discountId",
                                                         "deliveryCharge",
                                                         "subTotal",
                                                         "scheduleTime",
                                                         "mergeWith",
                                                         "invoiceDate",
                                                         "roundingType",
                                                         "roundingTotal",
                                                         "smallestCurrency",
                                                         "isInclusiveTax",
                                                         "updatedDate",
                                                         "onlineData",
                                                         "mediaId",
                                                         "attachment",
                                                        
                                                         "dueDate",
                                                         "createdAt",
                                                         "salesEmployeeId",
                                                         "aggregator",
                                                         "aggregatorId",
                                                         "grubTechData",
                                                         "receivableAccountId",
                                                         "paymentTerm",
                                                         "recurringInvoiceId",
                                                         "chargeType",
                                                         "chargesTaxDetails",
                                                         "customFields",
                                                         "subscriptionId",
                                                         "shopperId",
                                                          "companyId",
                                                          "pointsDiscount",
                                                          "couponId",
                                                          "promoCoupon"
                                                         ) 
                                               VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45, $46,$47,$48,$49,$50,$51,$52,$53,$54,$55) RETURNING id `,
                values: [
                    invoice.invoiceNumber,
                    invoice.refrenceNumber,
                    invoice.total,
                    invoice.note,
                    invoice.guests,
                    invoice.employeeId,
                    invoice.tableId,
                    invoice.branchId,
                    invoice.source,
                    invoice.serviceId,
                    invoice.customerId,
                    JSON.stringify(invoice.customerAddress),
                    invoice.customerContact,
                    invoice.customerLatLang,
                    invoice.estimateId,
                    invoice.status,
                    invoice.discountTotal,
                    invoice.chargeTotal,
                    invoice.chargeAmount,
                    invoice.chargePercentage,
                    invoice.chargeId,
                    invoice.discountAmount,
                    invoice.discountPercentage,
                    invoice.discountId,
                    invoice.deliveryCharge,
                    invoice.subTotal,
                    invoice.scheduleTime,
                    invoice.mergeWith,
                    invoice.invoiceDate,
                    invoice.roundingType,
                    invoice.roundingTotal,
                    invoice.smallestCurrency,
                    invoice.isInclusiveTax,
                    invoice.updatedDate,
                    invoice.onlineData,
                    invoice.mediaId,
                    JSON.stringify(invoice.attachment),
                    invoice.dueDate,
                    invoice.createdAt,
                    invoice.salesEmployeeId,
                    invoice.aggregator,
                    invoice.aggregatorId,
                    invoice.grubTechData,
                    invoice.receivableAccountId,
                    invoice.paymentTerm,
                    invoice.recurringInvoiceId,
                    invoice.chargeType,
                    invoice.chargesTaxDetails,
                    JSON.stringify(invoice.customFields),
                    invoice.subscriptionId,
                    invoice.shopperId,
                    invoice.companyId,
                    invoice.pointsDiscount,
                    invoice.couponId,
                    invoice.promoCoupon
                ]
            }


            const invoiceInsert = await client.query(query.text, query.values);
            const invoiceId = (<any>invoiceInsert.rows[0]).id;
            invoice.id = invoiceId;

            //Insert Lines
            for (let index = 0; index < invoice.lines.length; index++) {

                const invoiceLine = invoice.lines[index];
                invoiceLine.companyId = invoice.companyId
                invoiceLine.index = index
                if (invoiceLine.qty == 0) {
                    if (invoiceLine.qty == 0) {
                        throw new ValidationException("Invoice Qty Must Be Greater Than Zero")
                    }
                }
                if ((invoiceLine.productId == null || invoiceLine.productId == "") && (invoiceLine.note == null || invoiceLine.note == "")) {
                    continue;
                }
                invoiceLine.invoiceId = invoice.id
                invoiceLine.branchId = invoice.branchId;
                invoiceLine.createdAt = invoice.invoiceDate;
                invoiceLine.employeeId = invoiceLine.employeeId ? invoiceLine.employeeId : invoice.employeeId;
                invoiceLine.isInclusiveTax = invoice.isInclusiveTax;
                invoiceLine.salesEmployeeId = invoice.salesEmployeeId
                //insert invoiceline 
                if (invoice.source == 'Online' || invoice.source == 'Cloud') {
                    invoiceLine.createdAt = TimeHelper.getCreatedAt(invoice.invoiceDate, company.timeOffset);
                }
                const insertInvoiveLine: any = await this.addLine(client, invoiceLine, invoice, afterDecimal)

                invoiceLine.id = insertInvoiveLine.data.id;
                if (invoiceLine.subItems && invoiceLine.subItems.length > 0) {
                    for (let index = 0; index < invoiceLine.subItems.length; index++) {
                        const subItems = invoiceLine.subItems[index];
                        const subItem = new InvoiceLine();
                        subItem.ParseJson(subItems)
                        subItem.invoiceId = invoice.id
                        subItem.parentId = invoiceLine.id
                        subItem.branchId = invoice.branchId;
                        subItem.companyId = invoice.companyId;
                        subItem.employeeId = invoiceLine.employeeId ? invoiceLine.employeeId : invoice.employeeId;
                        subItem.createdAt = invoiceLine.createdAt;
                        subItem.parentUsages = invoiceLine.qty;
                        subItem.accountId = invoiceLine.accountId
                        await this.addLine(client, subItem, invoice, afterDecimal)
                    }
                }


            }


            if (invoice.estimateSource == "POS") {
                await SocketInvoiceRepo.sendInvoice(client, invoice.branchId, invoiceId)
            }



            //await this.setInvoiceLog(client, invoice.id, invoice.logs, invoice.branchId, company.id, invoice.source);



            return new ResponseData(true, "Added Successfully", { id: invoiceId, invoice: invoice });
        } catch (error: any) {
            console.log(error)


            throw new Error(error.message)
        }
    }


    public static async editInvoice(client: PoolClient, data: any, company: Company, employeeId: string | null = null, edits: boolean = false) {
        try {


            //TODO: INVOICE VALIDATION 
            //TODO: CHECK NUMBER EXIST 
            const companyId = company.id;
            const afterDecimal = company.afterDecimal
            const currency = company.currencySymbol
            const invoice = new Invoice();
            invoice.ParseJson(data);

            // if (invoice.chargeType == 'taxCharge' &&invoice.chargeId != null && invoice.chargeId != "") {
            //     let chargeTax = (await SurchargeRepo.getSurchargeTax(client, invoice.chargeId)).data;
            //     if (chargeTax) {
            //         invoice.chargesTaxDetails = new TaxDetails()
            //         invoice.chargesTaxDetails.taxId = chargeTax.id;
            //         invoice.chargesTaxDetails.type = chargeTax.taxType;
            //         invoice.chargesTaxDetails.taxPercentage = chargeTax.taxPercentage;
            //         invoice.chargesTaxDetails.taxes = chargeTax.taxes
            //     }

            // }

            let getEmployeeName = {
                text: `SELECT "Employees"."name" as "employeeName"
                       FROM "Invoices"
                        INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2
                       where "Invoices".id = $1
                        `,
                values: [invoice.id, employeeId, company.id]
            }

            let employeeNameResult = await client.query(getEmployeeName.text, getEmployeeName.values);
            let employeeName = employeeNameResult.rows && employeeNameResult.rows.length > 0 && employeeNameResult.rows[0].employeeName ? employeeNameResult.rows[0].employeeName : ''


            if (!edits) {
                if (invoice.invoiceNumber) {
                    const isInvoiceNumberExist = await this.checkIsInvoiceNumberExist(client, invoice.id, invoice.invoiceNumber, companyId);
                    if (isInvoiceNumberExist) {
                        throw new ValidationException("Invoice Number Already Used")
                    }
                }

            }




            invoice.calculateTotal(afterDecimal);
            console.log("InvoiceTotalllllllllllllllllllll", invoice.total, invoice.id)

            if (edits) {
                invoice.total = Helper.roundDecimal(invoice.total, afterDecimal)
            }
            let paid = await this.validateInvoiceAmount(client, invoice.id, invoice.total, edits)

            // if (edits) {
            //     if (paid > invoice.total) {
            //         invoice.total = +paid
            //     }

            // }

            invoice.currentInvoiceStatus = await this.getInvoiceStatus(client, invoice.id)

            if (invoice.id == "" || invoice.id == null) {
                throw new ValidationException("Invoice Id is Required")
            }
            invoice.updatedDate = new Date()
            //invoice.logs = await this.getInvoiceLogs(client, invoice.id)
            invoice.logs = []

            if (invoice.source == 'Online') {
                invoice.onlineData.onlineStatus = invoice.status == 'Open' && ((!invoice.onlineData) || (!invoice.onlineData.onlineStatus)) ? 'Accepted' : invoice.onlineData.onlineStatus;
                invoice.employeeId = invoice.status == 'Open' ? employeeId : invoice.employeeId
            }
            let linesLength = invoice.lines.length
            let voidedLines = invoice.lines.filter((f: any) => f.isVoided).length;
            if (linesLength == voidedLines && invoice.currentInvoiceStatus == 'Draft') {
                throw new Error("Cannot Convert Voided invoice to Open")
            }
            // if (employeeId)
            //     this.addInvoiceLog(invoice, "edit", "Edit", employeeId)

            const query: { text: string, values: any } = {
                text: `UPDATE  "Invoices" SET  "invoiceNumber"=$1,
                                                       "refrenceNumber"=$2,
                                                       total=$3,
                                                       note=$4,
                                                       guests=$5,
                                                       "tableId"=$6,
                                                       status=$7,
                                                       "discountTotal"=$8,
                                                       "chargeTotal"=$9,
                                                       "chargeAmount"=$10,
                                                       "chargePercentage"=$11,
                                                       "chargeId"=$12,
                                                       "discountAmount"=$13,
                                                       "discountPercentage"=$14,
                                                       "discountId"=$15,
                                                       "deliveryCharge"=$16,
                                                       "subTotal"=$17,
                                                       "scheduleTime"=$18,
                                                       "mergeWith"=$19,
                                                       "invoiceDate"=case when "source" = 'POS' THEN "invoiceDate" ELSE $20 END ,
                                                       "updatedDate" =$21,
                                                       "isInclusiveTax"=$22,
                                                       "onlineData"=$23,
                                                       "mediaId"=$24,
                                                       "customerId"=$25,
                                                       "attachment"=$26,
                                                       "dueDate"=$27,
                                                       "salesEmployeeId"=$28,
                                                       "employeeId"=$29,
                                                       "customerAddress"=$30,
                                                       "receivableAccountId"=$31,
                                                       "paymentTerm"=$32,
                                                       "chargesTaxDetails"=$33,
                                            
                                                       "roundingTotal"=$34,
                                               
                                                       "branchId"= $35,
                                                               "customFields" = $36,
                                                               "roundingType" = case when $37 = true then $38::text else   "roundingType"::text end ,
                                                               "smallestCurrency" = case when $37 = true then $39 else   "smallestCurrency" end 
                                           WHERE  "id"=$40
                                   
                                           
                                           `,
                values: [invoice.invoiceNumber,
                invoice.refrenceNumber,
                invoice.total,
                invoice.note,
                invoice.guests,
                invoice.tableId,
                invoice.status,
                invoice.discountTotal,
                invoice.chargeTotal,
                invoice.chargeAmount,
                invoice.chargePercentage,
                invoice.chargeId,
                invoice.discountAmount,
                invoice.discountPercentage,
                invoice.discountId,
                invoice.deliveryCharge,
                invoice.subTotal,
                invoice.scheduleTime,
                invoice.mergeWith,
                invoice.invoiceDate,
                invoice.updatedDate,
                invoice.isInclusiveTax,
                invoice.onlineData,
                invoice.mediaId,
                invoice.customerId,
                JSON.stringify(invoice.attachment),
                invoice.dueDate,
                invoice.salesEmployeeId,
                invoice.employeeId,
                invoice.customerAddress,
                invoice.receivableAccountId,
                invoice.paymentTerm,
                invoice.chargesTaxDetails,

                invoice.roundingTotal,

                invoice.branchId,
                JSON.stringify(invoice.customFields),
                    edits,
                invoice.roundingType,
                invoice.smallestCurrency,
                invoice.id

                ]
            }


            if (invoice.currentInvoiceStatus == "Draft" && invoice.status == "Open") {
                if (employeeId) {
                    Log.addLog(invoice, "Save Draft to Open Invoice", "edit", employeeId)
                    //this.addInvoiceLog(invoice, "edit", "Save Draft to Open Invoice", employeeId)
                }
            }
            const invoiceInsert = await client.query(query.text, query.values);
            for (let index = 0; index < invoice.lines.length; index++) {
                const invoiceLine = invoice.lines[index];
                if (invoice.source == 'Online' || invoice.source == 'Cloud') {
                    invoiceLine.createdAt = TimeHelper.getCreatedAt(invoice.invoiceDate, company.timeOffset);
                }
                if ((invoiceLine.productId == null || invoiceLine.productId == "") && (invoiceLine.note == null || invoiceLine.note == "")) {
                    continue;
                }
                if (invoiceLine.qty == 0) {
                    throw new ValidationException("Invoice Qty Must Be Greater Than Zero")
                }
                invoiceLine.invoiceId = invoice.id;
                invoiceLine.branchId = invoice.branchId
                invoiceLine.isInclusiveTax = invoice.isInclusiveTax;
                invoiceLine.companyId = company.id
                invoiceLine.index = index
                if ((invoice.source == 'POS' && (!invoiceLine.salesEmployeeId)) || (invoice.source != 'POS')) {
                    invoiceLine.salesEmployeeId = invoice.salesEmployeeId
                }
                if (invoiceLine.id != null && invoiceLine.id != "") {

                    invoiceLine.isEditedLine = true;

                    const isLineExist = await this.checkIfInvoiceLineIdExist(client, invoiceLine.id, invoice.id)
                    if (isLineExist) {


                        let waste = invoiceLine.waste
                        let voidReason = invoiceLine.voidReason;
                        invoiceLine.voidReason = null
                        invoiceLine.waste = false;
                        // if (invoice.source == 'Online' || invoice.source == 'Cloud') {

                        //     invoiceLine.createdAt = TimeHelper.setLinesDate(invoiceLine.createdAt,invoice.invoiceDate); /**Online Online Invoice Dates */
                        // }
                        await this.updateLine(client, invoice, invoiceLine, afterDecimal, employeeId, currency, employeeName)
                        /**Voided */
                        if (invoiceLine.isVoided && invoice.status != 'Draft' && (invoice.currentInvoiceStatus != 'Draft')) {

                            /**To Check if line is totally voided */
                            let checkLineQty = await this.getLineTotalQty(client, invoiceLine.id)
                            if (checkLineQty > 0) {
                                let tempLine = new InvoiceLine();
                                tempLine.ParseJson(invoiceLine);
                                tempLine.id = "";
                                tempLine.employeeId = employeeId;
                                tempLine.qty = invoiceLine.qty * (-1)
                                tempLine.voidFrom = invoiceLine.id
                                tempLine.isInclusiveTax = invoiceLine.isInclusiveTax;
                                tempLine.batch = invoiceLine.batch;
                                tempLine.serial = invoiceLine.serial;
                                tempLine.branchId = invoice.branchId;
                                tempLine.companyId = company.id;
                                tempLine.waste = waste;
                                tempLine.voidReason = voidReason
                                tempLine.options = invoiceLine.options;
                                if (!tempLine.discountPercentage) {
                                    tempLine.discountAmount = tempLine.discountAmount * -1;
                                }
                                tempLine.calculateTotal(afterDecimal)
                                if (employeeId) {
                                    //this.addInvoiceLog(invoice, "edit", "Void Line", employeeId)
                                    Log.addLog(invoice, "Void Line", "edit", employeeId)

                                }
                                let voidedLine = await this.addLine(client, tempLine, invoice, afterDecimal)

                                for (let index = 0; index < invoiceLine.subItems.length; index++) {
                                    const element = invoiceLine.subItems[index];
                                    let voidedSubItems = new InvoiceLine();
                                    voidedSubItems.ParseJson(element);
                                    voidedSubItems.parentId = voidedLine.data.id;
                                    voidedSubItems.invoiceId = invoice.id
                                    voidedSubItems.employeeId = employeeId
                                    voidedSubItems.voidFrom = element.id
                                    voidedSubItems.branchId = invoice.branchId
                                    voidedSubItems.productId = element.productId
                                    voidedSubItems.companyId = company.id
                                    voidedSubItems.qty = tempLine.qty * voidedSubItems.qty

                                    await this.addLine(client, voidedSubItems, invoice, afterDecimal)
                                }
                            }
                        } else if (invoiceLine.isVoided && (invoice.status == 'Draft' || (invoice.status == "Open" && invoice.currentInvoiceStatus == "Draft"))) {
                            await this.deleteInvoiceLine(client, invoiceLine.id)
                        }

                        //TODO:
                        /**Selected Item */



                    } else { /** Ecommerce when dine in edit on order (continue ordering) */
                        if (employeeId) {
                            //this.addInvoiceLog(invoice, "edit", "Add New Line", employeeId)
                            Log.addLog(invoice, "Add New Line", "edit", employeeId)

                        }
                        let line = await this.addLine(client, invoiceLine, invoice, afterDecimal)
                        invoiceLine.id = line.data.id;
                    }


                } else {
                    if (employeeId) {
                        Log.addLog(invoice, "Add New Line", "edit", employeeId)

                    }
                    invoiceLine.employeeId = employeeId;
                    invoiceLine.branchId = invoice.branchId;
                    invoiceLine.companyId = company.id
                    await this.addLine(client, invoiceLine, invoice, afterDecimal)
                }


            }

            if (invoice.source == "POS" || invoice.source == "Online" && invoice.onlineData.onlineStatus != 'Pending Payments') {

                await SocketInvoiceRepo.sendUpdateInvoice(client, invoice.branchId, invoice.id)
            }

            if (employeeId && invoice.logs.length == 0) {
                //this.addInvoiceLog(invoice, "edit", "Edit", employeeId)
                Log.addLog(invoice, "Edit", "edit", employeeId)

            }


            await this.setInvoiceLog(client, invoice.id, invoice.logs, invoice.branchId, company.id, employeeId, invoice.invoiceNumber, "Cloud");



            //TODO: update journal
            // if (invoice.status != 'Draft') {
            //      JournalTriggers.invoiceJournal(client, invoice.id, companyId)
            // }
            //TODO: update status
            //  InvoiceStatusTriggers.updateInvoiceStatus(client, [ invoice.id])


            return new ResponseData(true, "Updated Successfully", { invoice: invoice })

        } catch (error: any) {
            console.log(error)
            console.trace(error.message);
            // const event = {
            //     message: error.message,
            //     extra: { key: 'Invoices' },

            //     data: {data}
            //   };


            throw new Error(error.message)
        }
    }

    private static async addLine(client: PoolClient, invoiceLine: InvoiceLine, invoice: Invoice, afterDecimal: number) {
        try {


            if (invoiceLine.qty < 0) {
                console.log("consssssssssssssssoleeeeeeeeeeeee", "wasteeeeeeeeeee")
                console.log(invoiceLine.waste)
                console.log(invoiceLine.voidReason)
            }
            if (invoiceLine.productId != null && invoiceLine.productId != "" && invoiceLine.salesEmployeeId != null && invoiceLine.salesEmployeeId != "") {

                const productCommission = await ProductRepo.getProductCommission(client, invoiceLine.productId);
                if (productCommission) {
                    invoiceLine.commissionPercentage = productCommission.commissionPercentage;
                    invoiceLine.commissionAmount = productCommission.commissionAmount;
                }

            }
            invoiceLine.calculateTotal(afterDecimal);

            const query: { text: string, values: any } = {
                text: `INSERT INTO "InvoiceLines"(  
                                                               "invoiceId",
                                                                 total,
                                                                 price,
                                                                 qty,
                                                                 "productId",
                                                                 "employeeId",
                                                                 serial,
                                                                 batch,
                                                                 "parentId",
                                                                 "seatNumber",
                                                                 "salesEmployeeId",
                                                                 "serviceDate",
                                                                 "serviceDuration",
                                                                  note,
                                                                 "accountId",
                                                                 "discountAmount" ,
                                                                 "discountPercentage",
                                                                "subTotal",
                                                                "discountTotal",
                                                                "commissionPercentage",
                                                                "commissionAmount",
                                                                "taxId",
                                                                "createdAt",
                                                                "commissionTotal",
                                                                "voidFrom",
                                                                "taxTotal",
                                                                "waste",
                                                                "taxes",
                                                                "taxPercentage",
                                                                "taxType",
                                                                "isInclusiveTax",
                                                                "holdTime",
                                                                "printTime",
                                                                "readyTime",
                                                                "voidReason",
                                                                "defaultPrice",
                                                                "recipe",
                                                                "measurements",
                                                                "branchId",
                                                                "companyId",
                                                                "discountPerQty",
                                                                "index"
                                                     
                                                            
                                                                ) 
                    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42) RETURNING id`,
                values: [invoiceLine.invoiceId,
                invoiceLine.total,
                invoiceLine.price,
                invoiceLine.qty,
                invoiceLine.productId,
                invoiceLine.employeeId,
                invoiceLine.serial,
                invoiceLine.batch,
                invoiceLine.parentId,
                invoiceLine.seatNumber,
                invoiceLine.salesEmployeeId,
                invoiceLine.serviceDate,
                invoiceLine.serviceDuration,
                invoiceLine.note,
                invoiceLine.accountId,
                invoiceLine.discountAmount,
                invoiceLine.discountPercentage,
                invoiceLine.subTotal,
                invoiceLine.discountTotal,
                invoiceLine.commissionPercentage,
                invoiceLine.commissionAmount,
                invoiceLine.taxId,
                invoiceLine.createdAt,
                invoiceLine.commissionTotal,
                invoiceLine.voidFrom,
                invoiceLine.taxTotal,
                invoiceLine.waste,
                JSON.stringify(invoiceLine.taxes),
                invoiceLine.taxPercentage,
                invoiceLine.taxType,
                invoiceLine.isInclusiveTax,
                invoiceLine.holdTime,
                invoiceLine.printTime,
                invoiceLine.readyTime,
                invoiceLine.voidReason,
                invoiceLine.defaultPrice,
                JSON.stringify(invoiceLine.recipe),
                invoiceLine.measurements,
                invoiceLine.branchId,
                invoiceLine.companyId,
                invoiceLine.discountPerQty,
                invoiceLine.index,

                ]
            }


            const insertInvoiceLine = await client.query(query.text, query.values);
            invoiceLine.id = (<any>insertInvoiceLine.rows[0]).id


            /**Update Line Product On Hand */
            console.log("wasssteeeee", invoiceLine.waste, invoice.status)
            if (((invoiceLine.productId != null && invoiceLine.productId != "" && invoice.status != "Draft")) && !invoiceLine.waste) {
                await InvoiceInventoryMovmentRepo.addInventoryMovment(client, invoiceLine, invoice, invoiceLine.qty, afterDecimal);
            }
            await this.setLineProductMovment(client, invoiceLine)
            if (invoiceLine.options && invoiceLine.options.length > 0) {
                for (let index = 0; index < invoiceLine.options.length; index++) {
                    const element = invoiceLine.options[index];
                    element.invoiceLineId = invoiceLine.id;
                    await this.insertLineOption(client, element, invoice, invoiceLine, afterDecimal)
                }
            }


            return new ResponseData(true, "", { id: invoiceLine.id })
        } catch (error: any) {
            console.log(error)

            throw new Error(error.message)
        }
    }

    private static async updateLine(client: PoolClient, invoice: Invoice, invoiceLine: InvoiceLine, afterDecimal: number, employeeId: string | null, currency: string, employeeName: string) {
        try {

            const oldInvoiceLine = await this.getOldInvoiceLineQtyToTAL(client, invoiceLine.id)
            const oldQty = oldInvoiceLine.qty;
            const oldCost = oldInvoiceLine.oldCost;
            const oldPrice = oldInvoiceLine.price;
            /** Update OnHand Of Line Product 
             * Only when status is changing from "Draft" -> "Open"
             * or when Cost of the line is changed (there is an edit on qty or cost of line)
             *  */


            if (oldPrice != invoiceLine.price) {
                if (employeeId) {
                    //Log.addLog(invoice, `Change ${invoiceLine.productName ?? invoiceLine.note} Price from ${oldPrice} to ${invoiceLine.price}`, "Change Price", employeeId, { "oldPrice" : oldPrice, "newPrice": invoiceLine.price, "currency":currency })
                    Log.addLog(invoice, `${employeeName} has edited invoice number ${invoice.invoiceNumber} Total price changed from (${oldPrice}) to (${invoiceLine.price})`, "Invoice Total Edited", employeeId, { "oldPrice": oldPrice, "newPrice": invoiceLine.price, "currency": currency })

                }
            }

            if (oldQty != invoiceLine.qty) {
                if (employeeId) {
                    //Log.addLog(invoice, `Change ${invoiceLine.productName ?? invoiceLine.note}  Qty from ${oldQty} to  ${invoiceLine.qty} `, "Change Qty", employeeId, { "oldQty" : oldQty, "newQty": invoiceLine.qty })
                    Log.addLog(invoice, `${employeeName} has edited invoice number ${invoice.invoiceNumber} Total qty changed from (${oldQty}) to (${invoiceLine.qty})`, "Invoice Qty Edited", employeeId, { "oldQty": oldQty, "newQty": invoiceLine.qty, "currency": currency })
                }
            }

            if (oldCost != invoiceLine.total && invoice.currentInvoiceStatus != "Draft") {

                if (oldQty != invoiceLine.qty && (invoiceLine.productId != null && invoiceLine.productId != "") && invoice.status != "Draft" && !invoiceLine.waste) {
                    const acctualQty = invoiceLine.qty - oldQty;
                    await InvoiceInventoryMovmentRepo.addInventoryMovment(client, invoiceLine, invoice, acctualQty, afterDecimal)
                }
            } else {
                if (invoice.currentInvoiceStatus == "Draft" && invoice.status == "Open") {

                    if (invoiceLine.productId != null && invoiceLine.productId != "" && invoice.status == "Open" && !invoiceLine.waste) {

                        await InvoiceInventoryMovmentRepo.addInventoryMovment(client, invoiceLine, invoice, invoiceLine.qty, afterDecimal);
                    }
                }
            }



            const query: { text: string, values: any } = {
                text: `UPDATE "InvoiceLines" 
                                              SET  total=$1,
                                                   price=$2,
                                                   qty=$3,
                                                   "serviceDate"=$4,
                                                   "serviceDuration"=$5,
                                                    note=$6,
                                                    "commissionAmount" =$7,
                                                    "commissionPercentage"=$8,
                                                    "taxId"= $9,
                                                    "discountId"=$10,
                                                    "discountAmount"=$11,
                                                    "discountPercentage"=$12,
                                                    "discountTotal"=$13,
                                                    "subTotal"=$14,
                                                    "taxTotal"=$15,
                                                    "waste"=$16,
                                                    "taxes"=$17,
                                                    "taxPercentage"=$18,
                                                    "taxType"=$19,
                                                    "isInclusiveTax"=$20,
                                                    "holdTime"=$21,
                                                    "printTime"=$22,
                                                    "readyTime"=$23,
                                                    "voidReason"=$24,
                                                    "defaultPrice"=$25,
                                                    "createdAt"= case when $29 = 'Cloud' then  case when "createdAt"::date = $26::date then"createdAt" else $26 end  else  "createdAt" end ,
                                                    "batch" = $27,
                                                    "serial"=$28,
                                                    "measurements"= $30,
                                                    "discountPerQty" = $31,
                                                    "accountId" = $32,
                                                     "index" = $33,
                                                     "salesEmployeeId" = $34
                                               where id=$35`,
                values: [invoiceLine.total,
                invoiceLine.price,
                invoiceLine.qty,
                invoiceLine.serviceDate,
                invoiceLine.serviceDuration,
                invoiceLine.note,
                invoiceLine.commissionAmount,
                invoiceLine.commissionPercentage,
                invoiceLine.taxId,
                invoiceLine.discountId,
                invoiceLine.discountAmount,
                invoiceLine.discountPercentage,
                invoiceLine.discountTotal,
                invoiceLine.subTotal,
                invoiceLine.taxTotal,
                invoiceLine.waste,
                JSON.stringify(invoiceLine.taxes),
                invoiceLine.taxPercentage,
                invoiceLine.taxType,
                invoiceLine.isInclusiveTax,
                invoiceLine.holdTime,
                invoiceLine.printTime,
                invoiceLine.readyTime,
                invoiceLine.voidReason,
                invoiceLine.defaultPrice,
                invoiceLine.createdAt,
                invoiceLine.batch,
                invoiceLine.serial,
                invoice.source,
                invoiceLine.measurements,
                invoiceLine.discountPerQty,
                invoiceLine.accountId,
                invoiceLine.index,
                invoiceLine.salesEmployeeId,
                invoiceLine.id
                ]
            }

            await client.query(query.text, query.values);


            if (invoiceLine.recipe.length > 0) {
                await this.setLineProductMovment(client, invoiceLine)
            }


            if (invoiceLine.options && invoiceLine.options.length > 0) {
                for (let index = 0; index < invoiceLine.options.length; index++) {
                    const option = invoiceLine.options[index];
                    option.invoiceLineId = invoiceLine.id;
                    if (option.id != null && option.id != "") {
                        const isOptionIdExist = await this.checkIfInvoiceLineOptionIdExist(client, option.id, invoiceLine.id)
                        if (isOptionIdExist) {
                            await this.updateLineOption(client, option, invoice, invoiceLine, afterDecimal, oldQty)

                        } else {
                            await this.insertLineOption(client, option, invoice, invoiceLine, afterDecimal)
                        }

                    } else {
                        await this.insertLineOption(client, option, invoice, invoiceLine, afterDecimal)

                    }
                }
            }

            return new ResponseData(true, "Updated Successfully", [])
        } catch (error: any) {
            console.log(error)

            throw new Error(error.message)
        }
    }


    public static async setLineProductMovment(client: PoolClient, invoiceLine: InvoiceLine) {
        try {
            const query: { text: string, values: any } = {
                text: `UPDATE "InvoiceLines" SET "recipe"=$1 where id = $2`,
                values: [JSON.stringify(invoiceLine.recipe), invoiceLine.id]
            }
            await client.query(query.text, query.values)
        } catch (error: any) {


            throw new Error(error)
        }
    }


    private static async insertLineOption(client: PoolClient, invoiceLineOptions: InvoiceLineOption, invoice: Invoice, invoiceLine: InvoiceLine, afterDecimal: number) {
        try {
            if ((invoice.currentInvoiceStatus == "Draft" && invoice.status == "Open") || (invoiceLine.qty < 0)) {

                if (invoiceLineOptions.optionId != null && invoiceLineOptions.optionId != "" && invoice.status == "Open" && !invoiceLine.waste) {

                    await InvoiceInventoryMovmentRepo.calculateOptionMovment(client, invoiceLineOptions, invoiceLine, invoice, afterDecimal);
                }
            }
            if (invoiceLineOptions.optionGroupId == "") {
                invoiceLineOptions.optionGroupId = null
            }
            const query: { text: string, values: any } = {
                text: `INSERT INTO "InvoiceLineOptions" ( "invoiceLineId",
                                                                      price,
                                                                      qty,
                                                                      note,
                                                                      "optionId",
                                                                      "optionGroupId",
                                                                      "recipe") 
                                                   VALUES($1,$2,$3,$4,$5,$6, $7) RETURNING id `,
                values: [invoiceLineOptions.invoiceLineId,
                invoiceLineOptions.price,
                invoiceLineOptions.qty,
                invoiceLineOptions.note,
                invoiceLineOptions.optionId,
                invoiceLineOptions.optionGroupId,
                JSON.stringify(invoiceLineOptions.recipe)]
            }

            const insert = await client.query(query.text, query.values)
            invoiceLineOptions.id = (<any>insert.rows[0]).id
            return new ResponseData(true, "Added Successfully", { id: invoiceLineOptions.id })
        } catch (error: any) {
            console.log(error)

            throw new Error(error.message)
        }
    }
    private static async updateLineOption(client: PoolClient, invoiceLineOptions: InvoiceLineOption, invoice: Invoice, invoiceLine: InvoiceLine, afterDecimal: number, oldLineQty: number) {
        try {
            const query: { text: string, values: any } = {
                text: `UPDATE  "InvoiceLineOptions" SET price = $1 ,qty=$2,note=$3 WHERE id = $4 `,
                values: [invoiceLineOptions.price, invoiceLineOptions.qty, invoiceLineOptions.note, invoiceLineOptions.id]
            }

            const update = await client.query(query.text, query.values)
            if ((invoice.currentInvoiceStatus == "Draft" && invoice.status == "Open") || (oldLineQty != invoiceLine.qty)) {
                invoiceLineOptions.isEditedOption = true;
                if (invoiceLineOptions.optionId != null && invoiceLineOptions.optionId != "" && invoice.status == "Open" && !invoiceLine.waste) {
                    await InvoiceInventoryMovmentRepo.calculateOptionMovment(client, invoiceLineOptions, invoiceLine, invoice, afterDecimal);
                }
            }


            if (invoiceLineOptions.recipe && invoiceLineOptions.recipe.length > 0) {
                query.text = `UPDATE "InvoiceLineOptions" SET "recipe" =$1 where id =$2`,
                    query.values = [JSON.stringify(invoiceLineOptions.recipe), invoiceLineOptions.id]
            }
            await client.query(query.text, query.values);
            return new ResponseData(true, "Updated Successfully", [])
        } catch (error: any) {
            console.log(error)

            throw new Error(error.message)
        }
    }





    public static async getInvoicesListOld(data: any, company: Company) {

        try {



            const filterId = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : company.id;
            let selectQuery;
            let selectValues;

            let countQuery;
            let countValues;


            let searchValue = '[A-Za-z0-9]*';
            let offset = 0;
            let sort: any;
            let sortValue;
            let sortDirection;
            let sortTerm;
            let count = 0;
            let pageCount = 0;

            let havingQuery = '';
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }


            let sources = ['POS', 'Online', 'Cloud', '']
            let status = ['Open', 'Draft', 'writeOff']

            // "customerLatLang",
            // "customerAddress",
            //  "Invoices".guests,
            // "Invoices".note,
            // "Invoices"."serviceId",
            // "Invoices"."tableId",
            // "Invoices"."discountAmount",
            // "Invoices"."discountPercentage",
            // "Invoices"."customerAddress",
            // "Invoices"."customerContact", 
            // case when (select sum("InvoiceLines".qty) from "InvoiceLines" where "InvoiceLines"."invoiceId" = "Invoices".id) = 0 then true else false end as "isVoided",
            //case when (SELECT sum("InvoiceLines".qty +COALESCE("voidedItems"."qty",0))  FROM "InvoiceLines" LEFT JOIN "InvoiceLines" "voidedItems" on "voidedItems"."voidFrom" = "InvoiceLines".id where "InvoiceLines"."invoiceId" = "Invoices".id and "InvoiceLines"."voidFrom" is null) = 0 then true else false end as "isVoided",  

            const selectText = `SELECT 
            distinct( "Invoices".id),
            "customerContact",
            "Invoices"."invoiceDate",
            "invoiceNumber",
            "Invoices"."refrenceNumber",
            "Invoices".source,
            "Invoices"."branchId",
             "Invoices"."total",
            "Invoices".status,
            "Invoices"."onlineData",
            "Invoices"."estimateId",
            "Invoices"."mergeWith",
            "Customers".name as "customerName",
            "Employees".name as "employeeName",
            "Branches".name as "branchName",
            "Invoices"."createdAt":: timestamp:: time,
            case when sum( "CreditNotes"."total")::numeric is null then false else case  when sum("CreditNotes"."total")::numeric  = "Invoices"."total" then true else false end end as "isFullyRefunded",
            (SELECT COALESCE(sum ( "AppliedCredits".amount),0) FROM "AppliedCredits" where "AppliedCredits"."invoiceId" ="Invoices".id) + COALESCE(sum ("CreditNotes".total)::numeric,0)  as "appliedCredit",
            (SELECT COALESCE(sum (  "InvoicePaymentLines".amount),0) FROM "InvoicePaymentLines" where "InvoicePaymentLines"."invoiceId" ="Invoices".id ) as "paidAmount",
           CAST( COALESCE(sum ("CreditNotes".total)::numeric,0) AS REAL)  as "refunded"
            FROM "Invoices"
            LEFT JOIN "Customers" on  "Customers".id = "Invoices"."customerId"
            LEFT JOIN "Employees"  on "Employees".id = "Invoices"."employeeId"
            inner join "Branches"  on "Branches".id = "Invoices"."branchId"
            left join "CreditNotes" ON "CreditNotes"."invoiceId" = "Invoices".id
            left join "CreditNoteRefunds"  on "CreditNoteRefunds"."creditNoteId" = "CreditNotes".id
            `;


            const countText = ` SELECT COUNT(distinct "Invoices".id)  as count FROM "Invoices"  
                                LEFT JOIN "Customers" on  "Customers".id = "Invoices"."customerId"
                                LEFT JOIN "Employees"  on "Employees".id = "Invoices"."employeeId"
                                inner join "Branches"  on "Branches".id = "Invoices"."branchId"
                                left join "CreditNotes" ON "CreditNotes"."invoiceId" = "Invoices".id
                                left join "CreditNoteRefunds"  on "CreditNoteRefunds"."creditNoteId" = "CreditNotes".id

                               `


            let filterQuery = data.filter && data.filter.branches && data.filter.branches.length > 0 ? ` where "Branches".id=any($1)` : ` where "Branches"."companyId"=$1`


            filterQuery += ` and (LOWER("Customers".name) ~ $2 
            OR LOWER("Employees".name) ~ $2 
            OR LOWER("Branches".name) ~ $2 
            OR LOWER("Invoices"."invoiceNumber") ~ $2 
            OR nullif(regexp_replace("invoiceNumber", '[A-Z]*-', ''),'') ~ $2
            )`
            filterQuery += 'AND source = any($3)'
            filterQuery += 'AND "Invoices".status = any($4)'
            const groupByQuery = ` Group by "Invoices".id , "Customers".id, "Branches".id , "Employees".id`
            const limitQuery = ` limit $5 offset $6`

            let orderByQuery


            selectQuery = selectText + filterQuery + groupByQuery;
            selectValues = [filterId, searchValue, sources, status];
            let selectCount;
            if (data != null && data != '' && JSON.stringify(data) != '{}') {
                let filter = data.filter;


                sort = data.sortBy;
                sortValue = !sort ? ' "invoiceDate" desc,  "Invoices"."createdAt":: timestamp:: time  ' : '"' + sort.sortValue + '"';
                count = 0;
                if (sort && sort.sortValue == "invoiceNumber") {
                    sortValue = ` regexp_replace("invoiceNumber", '[A-Za-z0-9]*[_.+=-]', '')::int`
                }

                if (data.invoiceId != null && data.invoiceId != "") {
                    sortValue = `  ("Invoices".id = ` + "'" + data.invoiceId + "'" + ` )`
                }

                sortDirection = !sort ? "DESC" : sort.sortDirection;
                sortTerm = sortValue + " " + sortDirection
                orderByQuery = ` Order by` + sortTerm

                if (data.searchTerm != null && data.searchTerm != "") {
                    searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`
                }

                if (filter && filter.sources && filter.sources.length > 0) {
                    sources = filter.sources;
                }

                if (filter && filter.status && filter.status.length > 0) {
                    status = filter.status;
                    if (status && status.length > 0) {

                        // let havings: any[] = [];
                        // if (status.find((f: any) => f == 'writeOff')) {
                        //     havings.push(` "Invoices"."status" = 'writeOff'`)
                        // }

                        // if (status.find((f: any) => f == 'Draft')) {
                        //     havings.push(` "Invoices"."status" = 'Draft'`)
                        // }

                        // if (status.find((f: any) => f == 'Open')) {
                        //     havings.push(`( COALESCE(sum (  "CreditNotes".total)::numeric,0)::numeric = 0 or (COALESCE(sum (  "CreditNotes".total)::numeric,0)::numeric>0 and COALESCE(sum (  "CreditNotes".total)::numeric,0)::numeric < "Invoices"."total") ) AND  
                        //                       (SELECT COALESCE(sum ( "InvoicePaymentLines".amount)::numeric,0)::numeric  from "InvoicePaymentLines" where  "InvoicePaymentLines"."invoiceId" = "Invoices".id ) = 0 AND
                        //                       (SELECT COALESCE(sum (  "AppliedCredits".amount)::numeric,0)::numeric  from "AppliedCredits" where  "AppliedCredits"."invoiceId" = "Invoices".id  ) =0 AND
                        //                       (select sum("InvoiceLines".qty) from "InvoiceLines" where "InvoiceLines"."invoiceId" = "Invoices".id) <> 0
                        //                       and "Invoices"."onlineData" ->> 'onlineStatus' <> 'Rejected'
                        //                      `)
                        // }

                        // if (status.find((f: any) => f == 'Closed')) {
                        //     status.push("Open")
                        //     havings.push(` (  CAST( COALESCE(sum ("CreditNotes".total)::numeric,0) AS REAL) = "Invoices"."total"  AND  "Invoices"."total" <> 0)
                        //                      or "Invoices"."onlineData" ->> 'onlineStatus' = 'Rejected'
                        //                      `)
                        // }

                        // if (status.find((f: any) => f == 'Paid')) {
                        //     status.push("Open")
                        //     havings.push(`(((SELECT COALESCE(sum (   "InvoicePaymentLines".amount)::numeric,0)::numeric  from "InvoicePaymentLines" where  "InvoicePaymentLines"."invoiceId" = "Invoices".id ) +
                        //     (SELECT COALESCE(sum ( "AppliedCredits".amount)::numeric,0)::numeric  from "AppliedCredits" where  "AppliedCredits"."invoiceId" = "Invoices".id  )) -  COALESCE(sum ( distinct "CreditNotes".total)::numeric,0)::numeric)=
                        //     ( "Invoices"."total") ::numeric - COALESCE(sum (  "CreditNotes".total)::numeric,0)::numeric	AND
                        //     (COALESCE(sum (  "CreditNotes".total)::numeric,0)::numeric < ( "Invoices"."total")::numeric )  `)
                        // }

                        // if (status.find((f: any) => f == 'Partially Paid')) {
                        //     status.push("Open")
                        //     havings.push(` ((SELECT COALESCE(sum ( "InvoicePaymentLines".amount)::numeric,0)::numeric  from "InvoicePaymentLines" where  "InvoicePaymentLines"."invoiceId" = "Invoices".id ) +
                        //     (SELECT COALESCE(sum ( "AppliedCredits".amount)::numeric,0)::numeric  from "AppliedCredits" where  "AppliedCredits"."invoiceId" = "Invoices".id  )) >0 AND
                        //     (((SELECT COALESCE(sum ( "InvoicePaymentLines".amount)::numeric,0)::numeric  from "InvoicePaymentLines" where  "InvoicePaymentLines"."invoiceId" = "Invoices".id ) +
                        //     (SELECT COALESCE(sum ( "AppliedCredits".amount)::numeric,0)::numeric  from "AppliedCredits" where  "AppliedCredits"."invoiceId" = "Invoices".id  )) -  COALESCE(sum ( distinct "CreditNotes".total)::numeric,0)::numeric)<
                        //     "Invoices"."total"::numeric - COALESCE(sum ( "CreditNotes".total)::numeric,0)::numeric	AND
                        //     (COALESCE(sum ( "CreditNotes".total)::numeric,0)::numeric < "Invoices"."total"::numeric )

                        //     `)
                        // }
                        // if (status.find((f: any) => f == 'Void')) {
                        //     status.push("Open")
                        //     havings.push(`     (select sum("InvoiceLines".qty) from "InvoiceLines" where "InvoiceLines"."invoiceId" = "Invoices".id)  = 0`)
                        // }

                        // if (havings.length > 0) {
                        //     let havingString = havings.length > 0 ? havings.join(" or") : havings
                        //     havingQuery = ' HAVING ' + havingString
                        // }

                    }
                }



                selectQuery = selectText + filterQuery + groupByQuery + havingQuery + orderByQuery + limitQuery
                selectValues = [filterId, searchValue, sources, status, limit, offset]
                countQuery = 'select sum(t.count) as count from (' + countText + filterQuery + groupByQuery + havingQuery + ")t"

                countValues = [filterId, searchValue, sources, status]



                selectCount = await DB.excu.query(countQuery, countValues)
                count = selectCount.rows && selectCount.rows.length > 0 ? Number((<any>selectCount.rows[0]).count) : 0

                pageCount = Math.ceil(count / data.limit)
            }
            const selectList = await DB.excu.query(selectQuery, selectValues)
            const list: InvoiceMini[] = []
            for (let index = 0; index < selectList.rows.length; index++) {
                const element = selectList.rows[index];
                const invoice = new InvoiceMini()
                invoice.ParseJson(element)
                invoice.invoiceStatus()
                list.push(getValuable(invoice))
            }



            offset += 1
            let lastIndex = ((data.page) * data.limit)
            if (selectList.rows.length < data.limit || data.page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: list,
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


    public static async getInvoicesList1(data: any, company: Company, branchList: []) {

        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;



            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';

            let sort = data.sortBy;
            let sortValue = !sort ? ' "invoiceDate" desc,   "Invoices"."createdAt":: timestamp:: time ' : '"' + sort.sortValue + '"';
            if (sort && sort.sortValue == "invoiceNumber") {
                sortValue = ` COALESCE(nullif(regexp_substr(regexp_substr("invoiceNumber", '[_.+=-]\\d*$'), '\\d*$'),''), '0')::int `
            }
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by` + sortTerm
            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            let page = data.page ?? 1
            if (page != 1) {
                offset = (limit * (page - 1))
            }



            let sources = data.filter && data.filter.sources && data.filter.sources.length > 0 ? data.filter.sources : ['POS', 'Online', 'Cloud', 'CallCenter']
            let status = data.filter && data.filter.status && data.filter.status.length > 0 ? data.filter.status : ['Open', 'Draft', 'writeOff', 'merged', 'Void', 'Closed', 'Paid', 'Partially Paid']

            const filter = data.filter
            const fromDate = filter && filter.fromDate ? filter.fromDate : null
            const toDate = filter && filter.toDate ? filter.toDate : null

            const query: { text: string, values: any } = {

                text: `select
                                        count (*) over(),
                                        "Invoices".id ,
                                        "customerContact",
                                        "Invoices"."invoiceDate",
                                        "invoiceNumber",
                                        "Invoices"."refrenceNumber",
                                        "Invoices".source,
                                        "Invoices"."branchId",
                                        "Invoices"."total",
                                        "Invoices".status,
                                        "Invoices"."onlineData",
                                        "Invoices"."estimateId",
                                        "Invoices"."mergeWith",
                                        "Customers".name as "customerName",
                                        "Employees".name as "employeeName",
                                        "Branches".name as "branchName",
                                        "Invoices"."createdAt":: timestamp:: time as "time",
                                        "Invoices"."createdAt"::timestamp ,
                                        "Invoices"."dueDate",
                                        "Invoices"."paymentTerm",
                                        "Invoices"."onlineActionTime"
                                        FROM "Invoices"
                                        LEFT JOIN "Customers" on  "Customers".id = "Invoices"."customerId"
                                        LEFT JOIN "Employees"  on "Employees".id = "Invoices"."employeeId"
                                        inner join "Branches"  on "Branches".id = "Invoices"."branchId"
                                Where "Branches"."companyId" = $1
                                AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
                                AND "Invoices".source = any($3)
                                and (LOWER("Customers".name) ~ $4
                                        OR LOWER("Employees".name) ~ $4
                                        OR LOWER("Branches".name) ~ $4
                                        OR LOWER("Invoices"."invoiceNumber") ~ $4 
                                        OR LOWER("Invoices"."refrenceNumber") ~ $4 
                                        OR nullif(regexp_replace("invoiceNumber", '[A-Z]*-', ''),'') ~ $4
                                    )
                                AND "Invoices".status = any($5)
                                AND "Invoices".status <>'Pending Payments'
                                AND ($6::Date IS NULL OR "Invoices"."invoiceDate"::date >= $6::date)
                                AND ($7::Date IS NULL OR "Invoices"."invoiceDate"::date <= $7::date)
                                ${orderByQuery}
                                limit $8 offset $9 `,
                values: [company.id, branches, sources, searchValue, status, fromDate, toDate, limit, offset]
            }
            const selectList = await client.query(query.text, query.values)

            const list: InvoiceMini[] = []
            for (let index = 0; index < selectList.rows.length; index++) {
                const element = selectList.rows[index];
                const invoice = new InvoiceMini()
                invoice.ParseJson(element)
                //invoice.invoiceStatus()
                list.push(getValuable(invoice))
            }


            let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: list,
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

    public static escapeSQLString(str: String) {
        return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
            switch (char) {
                case "\0":
                    return "\\0";
                case "\x08":
                    return "\\b";
                case "\x09":
                    return "\\t";
                case "\x1a":
                    return "\\z";
                case "\n":
                    return "\\n";
                case "\r":
                    return "\\r";
                case "\"":
                case "'":
                case "\\":
                case "%":
                    return "\\" + char; // prepends a backslash to backslash, percent,
                // and double/single quotes
                default:
                    return char;
            }
        });
    }

    public static async getInvoicesList(data: any, company: Company, branchList: []): Promise<ResponseData> {
        try {
            const companyId = company.id;

            // --- Normalize paging/sorting/search ---
            const page = Number.isFinite(+data?.page) && +data.page > 0 ? +data.page : 1;
            const limit = Number.isFinite(+data?.limit) && +data.limit > 0 ? +data.limit : 15;

            const searchTerm: string | undefined =
                typeof data?.searchTerm === 'string' && data.searchTerm.trim() !== ''
                    ? data.searchTerm.trim()
                    : undefined;

            // --- Filters (defaults preserved) ---
            const branches: string[] =
                (data?.filter?.branches?.length ? data.filter.branches : branchList) as string[];

            const sources: string[] =
                (data?.filter?.sources?.length ? data.filter.sources : ['POS', 'Online', 'Cloud', 'CallCenter']);

            const status: string[] =
                (data?.filter?.status?.length ? data.filter.status :
                    ['Open', 'Draft', 'writeOff', 'merged', 'Void', 'Closed', 'Paid', 'Partially Paid']);

            const productId = data?.filter?.productId ? data?.filter?.productId : null
            const salesEmployeeId = data?.filter?.salesEmployeeId ? data?.filter?.salesEmployeeId : null

            const fromDate: string | undefined = data?.filter?.fromDate;
            const toDate: string | undefined = data?.filter?.toDate;

            // --- Sorting ---
            const incomingSortBy = data?.sortBy?.sortValue as string | undefined;
            const incomingSortDir = String(data?.sortBy?.sortDirection || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

            // If the UI asks for invoiceNumber sort, we’ll sort by a numeric tail extracted with regexp (as in your SQL)
            const sortByKey = incomingSortBy === 'invoiceNumber' ? 'invoiceNumberSort' :
                incomingSortBy ? incomingSortBy : 'invoiceDateThenTime';
            const sortDir = incomingSortDir;

            // --- TableDataService config for Invoices ---
            const aliasMap = {
                i: 'Invoices',
                b: 'Branches',
                c: 'Customers',
                e: 'Employees',

            } as const;

            const joinDefs = {
                joinBranch: { joinTable: 'b', onLocal: 'i.branchId', onForeign: 'b.id' },
                joinCustomer: { joinTable: 'c', onLocal: 'i.customerId', onForeign: 'c.id' },
                joinEmployee: { joinTable: 'e', onLocal: 'i.employeeId', onForeign: 'e.id' },

            };

            // Column map (plain + computed)
            const columnMap: TableConfig['columnMap'] = {
                // Base invoice fields
                id: { table: 'i', dbCol: 'id' },
                invoiceDate: { table: 'i', dbCol: 'invoiceDate', cast: 'timestamp' },
                invoiceNumber: { table: 'i', dbCol: 'invoiceNumber' },
                refrenceNumber: { table: 'i', dbCol: 'refrenceNumber' },
                source: { table: 'i', dbCol: 'source' },
                branchId: { table: 'i', dbCol: 'branchId' },
                total: { table: 'i', dbCol: 'total', cast: 'numeric' },
                status: { table: 'i', dbCol: 'status' },
                onlineData: { table: 'i', dbCol: 'onlineData', cast: 'text' },
                estimateId: { table: 'i', dbCol: 'estimateId' },
                mergeWith: { table: 'i', dbCol: 'mergeWith' },
                customerId: { table: 'i', dbCol: 'customerId' },
                employeeId: { table: 'i', dbCol: 'employeeId' },
                createdAt: { table: 'i', dbCol: 'createdAt', cast: 'timestamp' },
                paymentTerm: { table: 'i', dbCol: 'paymentTerm' },
                dueDate: { table: 'i', dbCol: 'dueDate', cast: 'timestamp' },
                onlineActionTime: { table: 'i', dbCol: 'onlineActionTime', cast: 'timestamp' },
                companyId: { table: 'i', dbCol: 'companyId' },

                // Computed: time part of createdAt (to mimic your select createdAt::time)
                time: { rawExpr: `i."createdAt"::timestamp::time`, table: 'i', dbCol: 'createdAt' },

                // Computed: tuple order (invoiceDate DESC, createdAt::time) like your default ORDER BY
                invoiceDateThenTime: {
                    rawExpr: `(i."invoiceDate"::date, i."createdAt"::timestamp::time)`,
                    table: 'i', dbCol: 'invoiceDate'
                },

                // Computed: numeric tail sort for invoiceNumber (same logic you used)
                invoiceNumberSort: {
                    rawExpr: `COALESCE(NULLIF(regexp_substr(regexp_substr(i."invoiceNumber", '[_.+=-]\\d*$'), '\\d*$'), ''), '0')::int`,
                    table: 'i', dbCol: 'invoiceNumber', cast: 'int'
                },

                // Joined display names
                branchName: { table: 'b', dbCol: 'name', joinRequired: 'joinBranch' },
                customerName: { table: 'c', dbCol: 'name', joinRequired: 'joinCustomer' },
                employeeName: { table: 'e', dbCol: 'name', joinRequired: 'joinEmployee' },


                productId: { table: 'il', dbCol: 'productId' },
                salesEmployeeId: { table: 'il', dbCol: 'salesEmployeeId' },

            };

            const invoiceCF = await CustomizationRepo.getCustomizationByKey('invoice', 'customFields', company);
            for (const field of (invoiceCF?.data?.customFields || [])) {
                const key = String(field.id).replace(/"/g, '');
                const outKey = String(field.abbr || key).replace(/\s+/g, '_');
                columnMap[outKey] = { table: 'i', dbCol: 'customFields', jsonKV: { key: field.id, cast: 'text' } };
            }

            // Searchable columns (will trigger joins automatically if needed)
            const searchableColumns = [
                'customerName', 'employeeName', 'branchName',
                'invoiceNumber', 'refrenceNumber'
            ];

            // Selectable whitelist
            const DEFAULT_COLUMNS = [
                'id', 'invoiceDate', 'invoiceNumber', 'refrenceNumber', 'source',
                'branchId', 'total', 'status', 'time', 'createdAt',
                'paymentTerm', 'dueDate', 'onlineActionTime',
                'customerId', 'employeeId', 'onlineData',
                'branchName', 'customerName', 'employeeName'
            ];

            const selectableColumns = [
                ...DEFAULT_COLUMNS,
                'onlineData', 'estimateId', 'mergeWith',
                'invoiceDateThenTime', 'invoiceNumberSort', // internal helpers (can keep hidden)
                'companyId',
                ...Object.keys(columnMap).filter(k => !DEFAULT_COLUMNS.includes(k))
            ];

            const InvoiceConfig: TableConfig = {
                aliasMap: aliasMap as any,
                columnMap,
                joinDefs,
                searchableColumns,
                selectableColumns
            };

            const service = new TableDataService(InvoiceConfig);

            // --- Build filters for TableDataService ---
            const filters: TableRequest['filters'] = [
                { column: 'companyId', operator: 'eq', value: companyId },
                // status != 'Pending Payments'
                { column: 'status', operator: 'ne', value: 'Pending Payments' },
            ];

            if (branches?.length) filters.push({ column: 'branchId', operator: 'in', value: branches });
            if (sources?.length) filters.push({ column: 'source', operator: 'in', value: sources });
            if (status?.length) filters.push({ column: 'status', operator: 'in', value: status });
            if (productId) filters.push({
                column: 'productId', operator: 'eq', value: [productId], query: `  EXISTS (
                                                                                    SELECT 1 
                                                                                    FROM "InvoiceLines" il
                                                                                    WHERE il."invoiceId" = i.id
                                                                                    AND il."productId" = ?
                                                                                )`});
            if (salesEmployeeId) filters.push({
                column: 'salesEmployeeId', operator: 'eq', value: [salesEmployeeId, salesEmployeeId], query: `     (
                                                                            i."salesEmployeeId" = ?
                                                                            OR EXISTS (
                                                                                SELECT 1
                                                                                FROM "InvoiceLines" il
                                                                                WHERE il."invoiceId" = i.id
                                                                                AND il."salesEmployeeId" = ?
                                                                            )
                                                                        )`});
            if (fromDate) filters.push({ column: 'invoiceDate', operator: 'ge' as any, value: fromDate }); // 'ge' not in your map yet? Use 'gt' with date-1 or add 'ge'
            if (toDate) filters.push({ column: 'invoiceDate', operator: 'le' as any, value: toDate }); // same note as above

            // If your FILTER_OPERATOR_MAP doesn’t have ge/le,
            // replace the two lines above with:
            //   { column: 'invoiceDate', operator: 'gt', value: fromDate + ' 00:00:00' }
            //   { column: 'invoiceDate', operator: 'lt', value: toDate   + ' 23:59:59' }
            // or add 'ge'/'le' support to your map.

            // --- Columns selection from client or defaults ---
            const userCols = Array.isArray(data?.columns) ? (data.columns as string[]).map(String) : DEFAULT_COLUMNS;
            let selectColumns = userCols.filter(c => selectableColumns.includes(c));
            if (!selectColumns.length) selectColumns = DEFAULT_COLUMNS;
            if (!selectColumns.includes('id')) selectColumns.push('id');
            // --- Build TableRequest ---
            const req: TableRequest = {
                table_name: 'Invoices',
                select_columns: selectColumns as any,
                filters,
                search_term: searchTerm,
                sort_by: selectableColumns.includes(sortByKey) ? (sortByKey as any) : ('invoiceDateThenTime' as any),
                sort_order: sortDir,
                page_number: page,
                page_size: limit
            };

            // --- Execute via TableDataService ---
            const result = await service.getTableData<any>(req);

            // --- Map to your InvoiceMini list (same as old code) ---
            const list: InvoiceMini[] = [];
            for (const row of result.data) {
                const invoice = new InvoiceMini();
                invoice.ParseJson(row);
                list.push(getValuable(invoice));
            }

            // --- Response pagination meta ---
            const total_count = result.total_count;
            const pageCount = Math.ceil(total_count / limit) || 1;
            const startIndex = (page - 1) * limit + 1;
            const lastIndex = Math.min(page * limit, total_count);

            const resData = {
                list: result.data,
                count: total_count,
                pageCount,
                startIndex,
                lastIndex
            };

            return new ResponseData(true, "", resData);
        } catch (error: any) {

            throw new Error(error?.message ?? String(error));
        }
    }


    public static async _getInvoicesList(data: any, company: Company, branchList: []) {


        try {


            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;
            let sources = data.filter && data.filter.sources && data.filter.sources.length > 0 ? data.filter.sources : ['POS', 'Online', 'Cloud', 'CallCenter']
            let status = data.filter && data.filter.status && data.filter.status.length > 0 ? data.filter.status : ['Open', 'Draft', 'writeOff', 'merged', 'Void', 'Closed', 'Paid', 'Partially Paid']


            let searchValue = data.searchTerm ? `'^.*` + InvoiceRepo.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `.*$'` : null;

            const filter = data.filter
            const fromDate = filter && filter.fromDate ? `and "Invoices"."invoiceDate"::date >= '${filter.fromDate}'::date ` : ''
            const toDate = filter && filter.toDate ? `and "Invoices"."invoiceDate"::date <= '${filter.toDate}'::date ` : ''

            let joinQuery = ` inner join "Branches"   on "Branches"."companyId" =$1 and "Branches".id = "list"."branchId"
                              LEFT JOIN "Customers"  on "Customers"."companyId" =$1 and "Customers".id = "list"."customerId"
                              LEFT JOIN "Employees"   on "Employees"."companyId" =$1 and "Employees".id = "list"."employeeId"`

            let filterQuery = `Where "Invoices"."companyId" = $1
                                AND (array_length($2::uuid[], 1) IS NULL OR ("Invoices"."branchId"=any($2::uuid[])))
                                AND "Invoices".status = any($4)
                                AND "Invoices".status <>'Pending Payments'
                                AND "Invoices".source = any($3)
                
                             
                                ${fromDate}
                                ${toDate}
                                `

            if (searchValue) {
                joinQuery = ` inner join "Branches"   on "Branches"."companyId" =$1 and "Branches".id = "Invoices"."branchId"
                              LEFT JOIN "Customers"  on "Customers"."companyId" =$1 and "Customers".id = "Invoices"."customerId"
                              LEFT JOIN "Employees"   on "Employees"."companyId" =$1 and "Employees".id = "Invoices"."employeeId"`
                filterQuery += `and (LOWER("Customers".name) ~ ${searchValue}
                                        OR LOWER("Employees".name) ~ ${searchValue}
                                        OR LOWER("Branches".name) ~ ${searchValue}
                                        OR LOWER("Invoices"."invoiceNumber") ~ ${searchValue} 
                                        OR LOWER("Invoices"."refrenceNumber") ~ ${searchValue} 
                                        OR nullif(regexp_replace("invoiceNumber", '[A-Z]*-', ''),'') ~ ${searchValue}
                                 )`
            }



            let sort = data.sortBy;
            let sortValue = !sort ? ' "invoiceDate" desc,   "Invoices"."createdAt":: timestamp:: time ' : '"' + sort.sortValue + '"';
            if (sort && sort.sortValue == "invoiceNumber") {
                sortValue = ` COALESCE(nullif(regexp_substr(regexp_substr("invoiceNumber", '[_.+=-]\\d*$'), '\\d*$'),''), '0')::int `
            }
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by` + sortTerm
            let orderByQuery2 = ``
            if (!searchValue) {


                let sortValue = !sort ? ' "invoiceDate" desc,   "list"."createdAt":: timestamp:: time ' : '"' + sort.sortValue + '"';
                if (sort && sort.sortValue == "invoiceNumber") {
                    sortValue = ` COALESCE(nullif(regexp_substr(regexp_substr("invoiceNumber", '[_.+=-]\\d*$'), '\\d*$'),''), '0')::int `
                }
                let sortDirection = !sort ? "DESC" : sort.sortDirection;
                let sortTerm = sortValue + " " + sortDirection
                orderByQuery2 = ` Order by` + sortTerm

            }
            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            let page = data.page ?? 1
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const counterQuery: { text: string, values: any } = {

                text: `select count(*)
                                        FROM "Invoices"
                                       ${searchValue ? joinQuery : ''}
                                       ${filterQuery}
                                 `,
                values: [company.id, branches, sources, status]
            }
            const counter = await DB.excu.query(counterQuery.text, counterQuery.values)


            let query: { text: string, values: any } = {

                text: `with "list" as (select
                                        "Invoices".id ,
                                        "customerContact",
                                        "Invoices"."invoiceDate",
                                        "invoiceNumber",
                                        "Invoices"."refrenceNumber",
                                        "Invoices".source,
                                        "Invoices"."branchId",
                                        "Invoices"."total",
                                        "Invoices".status,
                                        "Invoices"."onlineData",
                                        "Invoices"."estimateId",
                                        "Invoices"."mergeWith",
                                        "Invoices"."customerId",
                                        "Invoices"."employeeId" ,
                                        "Invoices"."createdAt":: timestamp:: time as "time",
                                        "Invoices"."createdAt"::timestamp ,
                                        "Invoices"."paymentTerm",
                                        "Invoices"."dueDate",
                                        "Invoices"."onlineActionTime"
                                        FROM "Invoices"
                                        ${filterQuery}
                                         ${orderByQuery}
                                limit $5 offset $6
            )
                                select "list".*,
                                  "Branches"."name" as "branchName",
                                  "Customers"."name" as "customerName",
                                  "Employees"."name" as "employeeName"
                                  from "list"
                                ${joinQuery}
                                ${orderByQuery2}
                          

                                `,
                values: [company.id, branches, sources, status, limit, offset]
            }

            if (searchValue) {
                query.text = `select
                                        "Invoices".id ,
                                        "customerContact",
                                        "Invoices"."invoiceDate",
                                        "invoiceNumber",
                                        "Invoices"."refrenceNumber",
                                        "Invoices".source,
                                        "Invoices"."branchId",
                                        "Invoices"."total",
                                        "Invoices".status,
                                        "Invoices"."onlineData",
                                        "Invoices"."estimateId",
                                        "Invoices"."mergeWith",
                                        "Customers".name as "customerName",
                                        "Employees".name as "employeeName",
                                        "Branches".name as "branchName",
                                        "Invoices"."createdAt":: timestamp:: time as "time",
                                        "Invoices"."createdAt"::timestamp ,
                                        "Invoices"."paymentTerm",
                                        "Invoices"."dueDate",
                                        "Invoices"."onlineActionTime"
                                        FROM "Invoices"
                                ${joinQuery}
                                ${filterQuery}
                                ${orderByQuery}
                                limit $5 offset $6`
                query.values = [company.id, branches, sources, status, limit, offset]
            }
            const selectList = await DB.excu.query(query.text, query.values)




            const list: InvoiceMini[] = []
            for (let index = 0; index < selectList.rows.length; index++) {
                const element = selectList.rows[index];
                const invoice = new InvoiceMini()
                invoice.ParseJson(element)
                //invoice.invoiceStatus()
                list.push(getValuable(invoice))
            }


            let count = counter.rows && counter.rows.length > 0 ? Number((<any>counter.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: list,
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
    public static async getInvoicesList2(data: any, company: Company, branchList: string[]) {
        try {
            const filter = data.filter || {};

            const branches = filter.branches && filter.branches.length > 0 ? filter.branches : branchList;
            const sources = filter.sources && filter.sources.length > 0 ? filter.sources : ['POS', 'Online', 'Cloud', 'CallCenter'];
            const status = filter.status && filter.status.length > 0 ? filter.status : ['Open', 'Draft', 'writeOff', 'merged', 'Void', 'Closed', 'Paid', 'Partially Paid'];

            const searchTerm = data.searchTerm ? data.searchTerm.toLowerCase().trim() : null;

            // Step 1: Find matching IDs in related tables if search term exists
            let customerIds: string[] = [];
            let employeeIds: string[] = [];
            let branchIds: string[] = [];
            const searchValue = searchTerm ? `%${searchTerm}%` : null;

            if (searchTerm) {

                const [customers, employees, branchesResult] = await Promise.all([
                    DB.excu.query(`SELECT id FROM "Customers" WHERE "companyId" = $1 AND ($2::text is null or LOWER(name) ilike $2)`, [company.id, searchValue]),
                    DB.excu.query(`SELECT id FROM "Employees" WHERE "companyId" = $1 AND ($2::text is null or LOWER(name) ilike $2)`, [company.id, searchValue]),
                    DB.excu.query(`SELECT id FROM "Branches" WHERE "companyId" = $1 AND ($2::text is null or LOWER(name) ilike $2)`, [company.id, searchValue])
                ]);

                customerIds = customers.rows.map((r: any) => r.id);
                employeeIds = employees.rows.map((r: any) => r.id);
                branchIds = branchesResult.rows.map((r: any) => r.id);
            }

            // Step 2: Date filters
            const fromDate = filter.fromDate ? `AND "invoiceDate"::date >= '${filter.fromDate}'::date` : '';
            const toDate = filter.toDate ? `AND "invoiceDate"::date <= '${filter.toDate}'::date` : '';

            // Step 3: Pagination
            const limit = data.limit ?? 15;
            const page = data.page ?? 1;
            const offset = (page - 1) * limit;

            // Step 4: Sort

            let sort = data.sortBy;
            let sortValue = !sort ? ' "invoiceDate" desc,   "Invoices"."createdAt":: timestamp:: time ' : '"' + sort.sortValue + '"';
            if (sort && sort.sortValue == "invoiceNumber") {
                sortValue = ` COALESCE(nullif(regexp_substr(regexp_substr("invoiceNumber", '[_.+=-]\\d*$'), '\\d*$'),''), '0')::int `
            }
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection

            const orderByQuery = `ORDER BY ${sortTerm}`;

            // Step 5: Filter invoices first (only IDs)
            const invoiceIdsQuery = {
                text: `
                SELECT id
                FROM "Invoices"
                WHERE "companyId" = $1
                  AND (array_length($2::uuid[],1) IS NULL OR "branchId" = ANY($2::uuid[]))
                  AND (array_length($3::uuid[],1) IS NULL OR "customerId" = ANY($3::uuid[]))
                  AND (array_length($4::uuid[],1) IS NULL OR "employeeId" = ANY($4::uuid[]))
                  AND status = ANY($5)
                  AND status <> 'Pending Payments'
                  AND source = ANY($6)
                  AND ($7::text is null or lower("invoiceNumber") ilike $7) 
                  ${fromDate}
                  ${toDate}
                ${orderByQuery}
                LIMIT $8 OFFSET $9
            `,
                values: [
                    company.id,
                    branchIds.length > 0 ? branchIds : branches,
                    customerIds.length > 0 ? customerIds : null,
                    employeeIds.length > 0 ? employeeIds : null,
                    status,
                    sources,
                    searchValue,
                    limit,
                    offset
                ]
            };

            const invoiceIdsResult = await DB.excu.query(invoiceIdsQuery.text, invoiceIdsQuery.values);
            const invoiceIds = invoiceIdsResult.rows.map((r: any) => r.id);

            if (invoiceIds.length === 0) {
                return new ResponseData(true, "", { list: [], count: 0, pageCount: 0, startIndex: 0, lastIndex: 0 });
            }

            // Step 6: Fetch full invoice data with joins ONLY for filtered IDs
            const invoicesQuery = {
                text: `
                SELECT i.*, 
                       c.name AS "customerName",
                       e.name AS "employeeName",
                       b.name AS "branchName"
                FROM "Invoices" i
                LEFT JOIN "Customers" c ON c.id = i."customerId"
                LEFT JOIN "Employees" e ON e.id = i."employeeId"
                LEFT JOIN "Branches" b ON b.id = i."branchId"
                WHERE i.id = ANY($1::uuid[])
            `,
                values: [invoiceIds]
            };

            const selectList = await DB.excu.query(invoicesQuery.text, invoicesQuery.values);

            const list: InvoiceMini[] = selectList.rows.map((row: any) => {
                const invoice = new InvoiceMini();
                invoice.ParseJson(row);
                return getValuable(invoice);
            });

            // Step 7: Count total invoices for pagination
            const counterQuery = {
                text: `
                SELECT COUNT(*)
                FROM "Invoices"
                WHERE "companyId" = $1
                  AND (array_length($2::uuid[],1) IS NULL OR "branchId" = ANY($2::uuid[]))
                  AND (array_length($3::uuid[],1) IS NULL OR "customerId" = ANY($3::uuid[]))
                  AND (array_length($4::uuid[],1) IS NULL OR "employeeId" = ANY($4::uuid[]))
                  AND status = ANY($5)
                  AND status <> 'Pending Payments'
                  AND source = ANY($6)
                    AND ($7::text is null or lower("invoiceNumber") ilike $7) 
                  ${fromDate}
                  ${toDate}
            `,
                values: [
                    company.id,
                    branchIds.length > 0 ? branchIds : branches,
                    customerIds.length > 0 ? customerIds : null,
                    employeeIds.length > 0 ? employeeIds : null,
                    status,
                    sources,
                    searchValue
                ]
            };
            const counter = await DB.excu.query(counterQuery.text, counterQuery.values);
            const count = Number(counter.rows[0].count);
            const pageCount = Math.ceil(count / limit);
            const startIndex = offset + 1;
            const lastIndex = Math.min(offset + list.length, count);

            return new ResponseData(true, "", { list, count, pageCount, startIndex, lastIndex });

        } catch (error: any) {
            throw new Error(error);
        }
    }


    public static async getZatcaInvoicesList(data: any, company: Company, branchList: []) {


        try {


            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;
            let sources = data.filter && data.filter.sources && data.filter.sources.length > 0 ? data.filter.sources : ['POS', 'Online', 'Cloud', 'CallCenter']
            let status = data.filter && data.filter.status && data.filter.status.length > 0 ? data.filter.status : ['Open', 'Draft', 'writeOff', 'merged', 'Void', 'Closed', 'Paid', 'Partially Paid']
            let zatca_status = data.filter && data.filter.zatca_status && data.filter.zatca_status.length > 0 ? data.filter.zatca_status : ['QUEUED', 'REPORTED', 'FAILED']

            let searchValue = data.searchTerm ? `'^.*` + InvoiceRepo.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `.*$'` : null;

            const filter = data.filter
            const fromDate = filter && filter.fromDate ? `and "Invoices"."invoiceDate"::date >= '${filter.fromDate}'::date ` : ''
            const toDate = filter && filter.toDate ? `and "Invoices"."invoiceDate"::date <= '${filter.toDate}'::date ` : ''

            let filterQuery = `Where "Invoices"."companyId" = $1
                                AND (array_length($2::uuid[], 1) IS NULL OR ("Invoices"."branchId"=any($2::uuid[])))
                                   AND "Invoices".status = any($4)
                                   AND "Invoices".zatca_status = any($5)
                                AND "Invoices".source = any($3)
                
                                AND "Invoices".status <>'Pending Payments'
                                ${fromDate}
                                ${toDate}
                                `

            if (searchValue) {
                filterQuery += `and (LOWER("Customers".name) ~ ${searchValue}
                                        OR LOWER("Employees".name) ~ ${searchValue}
                                        OR LOWER("Branches".name) ~ ${searchValue}
                                        OR LOWER("Invoices"."invoiceNumber") ~ ${searchValue} 
                                        OR LOWER("Invoices"."refrenceNumber") ~ ${searchValue} 
                                        OR nullif(regexp_replace("invoiceNumber", '[A-Z]*-', ''),'') ~ ${searchValue}
                                 )`
            }



            let sort = data.sortBy;
            let sortValue = !sort ? ' "invoiceDate" desc,   "Invoices"."createdAt":: timestamp:: time ' : '"' + sort.sortValue + '"';
            if (sort && sort.sortValue == "invoiceNumber") {
                sortValue = ` COALESCE(nullif(regexp_substr(regexp_substr("invoiceNumber", '[_.+=-]\\d*$'), '\\d*$'),''), '0')::int `
            }
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by` + sortTerm

            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            let page = data.page ?? 1
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const counterQuery: { text: string, values: any } = {

                text: `select count(*)
                                        FROM "Invoices"
                                        LEFT JOIN "Customers" on  "Customers".id = "Invoices"."customerId"
                                        LEFT JOIN "Employees"  on "Employees".id = "Invoices"."employeeId"
                                        inner join "Branches"  on "Branches".id = "Invoices"."branchId"
                                ${filterQuery}
                                 `,
                values: [company.id, branches, sources, status, zatca_status]
            }
            const counter = await DB.excu.query(counterQuery.text, counterQuery.values)


            const query: { text: string, values: any } = {

                text: `select
                                        "Invoices".id ,
                                        "customerContact",
                                        "Invoices"."invoiceDate",
                                        "invoiceNumber",
                                        "Invoices"."refrenceNumber",
                                        "Invoices".source,
                                        "Invoices"."branchId",
                                        "Invoices"."total",
                                        "Invoices".status,
                                        "Invoices"."onlineData",
                                        "Invoices"."estimateId",
                                        "Invoices"."mergeWith",
                                        "Customers".name as "customerName",
                                        "Employees".name as "employeeName",
                                        "Branches".name as "branchName",
                                        "Invoices"."createdAt":: timestamp:: time as "time",
                                        "Invoices"."createdAt"::timestamp ,
                                        "Invoices"."paymentTerm",
                                        "Invoices"."dueDate",
                                        "Invoices"."zatca_status",
                                        "Invoices"."zatca_info",
                                        "Invoices"."onlineActionTime"
                                        FROM "Invoices"
                                        LEFT JOIN "Customers" on  "Customers".id = "Invoices"."customerId"
                                        LEFT JOIN "Employees"  on "Employees".id = "Invoices"."employeeId"
                                        left join "Branches"  on "Branches".id = "Invoices"."branchId"
                                ${filterQuery}
                                ${orderByQuery}
                                limit $6 offset $7 `,
                values: [company.id, branches, sources, status, zatca_status, limit, offset,]
            }
            const selectList = await DB.excu.query(query.text, query.values)




            const list: InvoiceMini[] = []
            for (let index = 0; index < selectList.rows.length; index++) {
                const element = selectList.rows[index];
                const invoice = new InvoiceMini()
                invoice.ParseJson(element)
                //invoice.invoiceStatus()
                list.push(getValuable(invoice))
            }


            let count = counter.rows && counter.rows.length > 0 ? Number((<any>counter.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: list,
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

    public static async getJofotaraInvoicesList(data: any, company: Company, branchList: []) {


        try {


            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;
            let sources = data.filter && data.filter.sources && data.filter.sources.length > 0 ? data.filter.sources : ['POS', 'Online', 'Cloud', 'CallCenter']
            let status = data.filter && data.filter.status && data.filter.status.length > 0 ? data.filter.status : ['Open', 'Draft', 'writeOff', 'merged', 'Void', 'Closed', 'Paid', 'Partially Paid']
            let jofotara_status = data.filter && data.filter.jofotara_status && data.filter.jofotara_status.length > 0 ? data.filter.jofotara_status : ['QUEUED', 'REPORTED', 'FAILED']

            let searchValue = data.searchTerm ? `'^.*` + InvoiceRepo.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `.*$'` : null;

            const filter = data.filter
            const fromDate = filter && filter.fromDate ? `and "Invoices"."invoiceDate"::date >= '${filter.fromDate}'::date ` : ''
            const toDate = filter && filter.toDate ? `and "Invoices"."invoiceDate"::date <= '${filter.toDate}'::date ` : ''

            let filterQuery = `Where "Invoices"."companyId" = $1
                                AND (array_length($2::uuid[], 1) IS NULL OR ("Invoices"."branchId"=any($2::uuid[])))
                                   AND "Invoices".status = any($4)
                                   AND "Invoices".jofotara_status = any($5)
                                AND "Invoices".source = any($3)
                
                                AND "Invoices".status <>'Pending Payments'
                                ${fromDate}
                                ${toDate}
                                `

            if (searchValue) {
                filterQuery += `and (LOWER("Customers".name) ~ ${searchValue}
                                        OR LOWER("Employees".name) ~ ${searchValue}
                                        OR LOWER("Branches".name) ~ ${searchValue}
                                        OR LOWER("Invoices"."invoiceNumber") ~ ${searchValue} 
                                        OR LOWER("Invoices"."refrenceNumber") ~ ${searchValue} 
                                        OR nullif(regexp_replace("invoiceNumber", '[A-Z]*-', ''),'') ~ ${searchValue}
                                 )`
            }



            let sort = data.sortBy;
            let sortValue = !sort ? ' "invoiceDate" desc,   "Invoices"."createdAt":: timestamp:: time ' : '"' + sort.sortValue + '"';
            if (sort && sort.sortValue == "invoiceNumber") {
                sortValue = ` COALESCE(nullif(regexp_substr(regexp_substr("invoiceNumber", '[_.+=-]\\d*$'), '\\d*$'),''), '0')::int `
            }
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by` + sortTerm

            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            let page = data.page ?? 1
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const counterQuery: { text: string, values: any } = {

                text: `select count("Invoices".id)
                                        FROM "Invoices"
                                        LEFT JOIN "Customers" on  "Customers".id = "Invoices"."customerId"
                                        LEFT JOIN "Employees"  on "Employees".id = "Invoices"."employeeId"
                                        inner join "Branches"  on "Branches".id = "Invoices"."branchId"
                                ${filterQuery}
                                 `,
                values: [company.id, branches, sources, status, jofotara_status]
            }
            const counter = await DB.excu.query(counterQuery.text, counterQuery.values)


            const query: { text: string, values: any } = {

                text: `select
                                        "Invoices".id ,
                                        "customerContact",
                                        "Invoices"."invoiceDate",
                                        "invoiceNumber",
                                        "Invoices"."refrenceNumber",
                                        "Invoices".source,
                                        "Invoices"."branchId",
                                        "Invoices"."total",
                                        "Invoices".status,
                                        "Invoices"."onlineData",
                                        "Invoices"."estimateId",
                                        "Invoices"."mergeWith",
                                        "Customers".name as "customerName",
                                        "Employees".name as "employeeName",
                                        "Branches".name as "branchName",
                                        "Invoices"."createdAt":: timestamp:: time as "time",
                                        "Invoices"."createdAt"::timestamp ,
                                        "Invoices"."paymentTerm",
                                        "Invoices"."dueDate",
                                        "Invoices"."jofotara_status",
                                        "Invoices"."jofotara_info",
                                        "Invoices"."onlineActionTime"
                                        FROM "Invoices"
                                        LEFT JOIN "Customers" on  "Customers".id = "Invoices"."customerId"
                                        LEFT JOIN "Employees"  on "Employees".id = "Invoices"."employeeId"
                                        left join "Branches"  on "Branches".id = "Invoices"."branchId"
                                ${filterQuery}
                                ${orderByQuery}
                                limit $6 offset $7 `,
                values: [company.id, branches, sources, status, jofotara_status, limit, offset,]
            }
            const selectList = await DB.excu.query(query.text, query.values)




            const list: InvoiceMini[] = []
            for (let index = 0; index < selectList.rows.length; index++) {
                const element = selectList.rows[index];
                const invoice = new InvoiceMini()
                invoice.ParseJson(element)
                //invoice.invoiceStatus()
                list.push(getValuable(invoice))
            }


            let count = counter.rows && counter.rows.length > 0 ? Number((<any>counter.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: list,
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









    public static async getInvoicesListWithCustomeColumns(data: any, company: Company, branchList: []) {

        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;
            let sources = data.filter && data.filter.sources && data.filter.sources.length > 0 ? data.filter.sources : ['POS', 'Online', 'Cloud', 'CallCenter']
            let status = data.filter && data.filter.status && data.filter.status.length > 0 ? data.filter.status : ['Open', 'Draft', 'writeOff', 'merged', 'Void', 'Closed', 'Paid', 'Partially Paid']


            let searchValue = data.searchTerm ? `'^.*` + InvoiceRepo.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `.*$'` : null;

            const filter = data.filter
            const fromDate = filter && filter.fromDate ? `and "Invoices"."invoiceDate"::date >= '${filter.fromDate}'::date ` : ''
            const toDate = filter && filter.toDate ? `and "Invoices"."invoiceDate"::date <= '${filter.toDate}'::date ` : ''

            let filterQuery = `Where "Branches"."companyId" = $1
                                AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
                                AND "Invoices".source = any($3)
                                AND "Invoices".status = any($4)
                                AND "Invoices".status <>'Pending Payments'
                                ${fromDate}
                                ${toDate}
                                `

            if (searchValue) {
                filterQuery += `and (LOWER("Customers".name) ~ ${searchValue}
                                        OR LOWER("Employees".name) ~ ${searchValue}
                                        OR LOWER("Branches".name) ~ ${searchValue}
                                        OR LOWER("Invoices"."invoiceNumber") ~ ${searchValue} 
                                        OR LOWER("Invoices"."refrenceNumber") ~ ${searchValue} 
                                        OR nullif(regexp_replace("invoiceNumber", '[A-Z]*-', ''),'') ~ ${searchValue}
                                 )`
            }



            let sort = data.sortBy;
            let sortValue = !sort ? ' "invoiceDate" desc,   "Invoices"."createdAt":: timestamp:: time ' : '"' + sort.sortValue + '"';
            if (sort && sort.sortValue == "invoiceNumber") {
                sortValue = ` COALESCE(nullif(regexp_substr(regexp_substr("invoiceNumber", '[_.+=-]\\d*$'), '\\d*$'),''), '0')::int `
            }
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by` + sortTerm

            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            let page = data.page ?? 1
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const counterQuery: { text: string, values: any } = {

                text: `select count(*)
                                        FROM "Invoices"
                                        LEFT JOIN "Customers" on  "Customers".id = "Invoices"."customerId"
                                        LEFT JOIN "Employees"  on "Employees".id = "Invoices"."employeeId"
                                        inner join "Branches"  on "Branches".id = "Invoices"."branchId"
                                ${filterQuery}
                                 `,
                values: [company.id, branches, sources, status]
            }
            const counter = await client.query(counterQuery.text, counterQuery.values)


            const query: { text: string, values: any } = {

                text: `select
                                        "Invoices".id ,
                                        "customerContact",
                                        "Invoices"."invoiceDate",
                                        "invoiceNumber",
                                        "Invoices"."refrenceNumber",
                                        "Invoices".source,
                                        "Invoices"."branchId",
                                        "Invoices"."total",
                                        "Invoices".status,
                                        "Invoices"."onlineData",
                                        "Invoices"."estimateId",
                                        "Invoices"."mergeWith",
                                        "Customers".name as "customerName",
                                        "Employees".name as "employeeName",
                                        "Branches".name as "branchName",
                                        "Invoices"."createdAt":: timestamp:: time as "time",
                                        "Invoices"."createdAt"::timestamp ,
                                        "Invoices"."paymentTerm",
                                        "Invoices"."dueDate",
                                        "Invoices"."onlineActionTime"
                                        FROM "Invoices"
                                        LEFT JOIN "Customers" on  "Customers".id = "Invoices"."customerId"
                                        LEFT JOIN "Employees"  on "Employees".id = "Invoices"."employeeId"
                                        inner join "Branches"  on "Branches".id = "Invoices"."branchId"
                                ${filterQuery}
                                ${orderByQuery}
                                limit $5 offset $6 `,
                values: [company.id, branches, sources, status, limit, offset]
            }
            const selectList = await client.query(query.text, query.values)




            const list: InvoiceMini[] = []
            for (let index = 0; index < selectList.rows.length; index++) {
                const element = selectList.rows[index];
                const invoice = new InvoiceMini()
                invoice.ParseJson(element)
                //invoice.invoiceStatus()
                list.push(getValuable(invoice))
            }


            let count = counter.rows && counter.rows.length > 0 ? Number((<any>counter.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: list,
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

    public static async getInvoiceById(invoiceId: string, company: Company) {
        const client = await DB.excu.client();
        try {
            const companyId = company.id;


            const afterDecimal = company.afterDecimal
            await client.query("BEGIN")
            await client.query('SET TRANSACTION READ ONLY')
            const query: { text: string, values: any } = {
                text: `
                with "invo" as ( SELECT 
                "Invoices".id,
                "Invoices"."customerLatLang",
                "Invoices"."customerAddress",
                "Invoices"."customerContact",
                "Invoices"."customerId",
                "Invoices"."employeeId",
                "Invoices"."branchId",
                "Invoices". guests,
                "Invoices".charges,
                "Invoices"."invoiceNumber",
                "Invoices". note,
                "Invoices". "refrenceNumber", 
                "Invoices"."serviceId",
                "Invoices".source,
                "Customers".name as "customerName",
				"Employees".name as "employeeName",
                "Branches".name as "branchName",
                "Branches"."phoneNumber" as "branchPhone",
                "Branches"."customFields" as "branchCustomFields",
                "Invoices". "tableId",
                "Invoices".total,
                "Invoices".status,
                          "Invoices"."chargeType",
                "Invoices"."discountTotal",
                "Invoices"."chargeTotal",
                "Invoices"."chargeAmount",
                "Invoices"."chargePercentage",
                "Invoices"."chargeId",
                "Invoices"."discountAmount",
                "Invoices"."discountPercentage",
                "Invoices"."discountId",
                "Invoices"."deliveryCharge",
                "Invoices"."subTotal",
                "Invoices"."onlineData",
                   "Invoices"."receivableAccountId",
                   "Branches"."address" as "branchAddress",
               CAST( "Invoices"."invoiceDate"::DATE AS TEXT) AS "invoiceDate",
                "Invoices"."estimateId",
                ("Invoices"."createdAt" ::text),
                "Invoices"."roundingType",
                "Invoices"."roundingTotal",
                "Invoices"."smallestCurrency",
                "Invoices"."mediaId",
                "Invoices"."paymentTerm",
                "Invoices"."dueDate",
                "Invoices"."mergeWith",
                "Invoices"."salesEmployeeId",
                "Invoices"."customFields",
                "Invoices"."discountType",
                "Invoices"."customerSignature",
                    "Invoices"."discountType",
                   "Invoices"."chargeType",
                   "TableGroups"."name" as "tableGroupName",
             case when NULLIF(("Invoices"."chargesTaxDetails"->>'taxId'),'')::uuid is not null then JSON_BUILD_OBJECT('taxId',"Invoices"."chargesTaxDetails"->>'taxId',
							   'taxName',"Taxes".name,
							   'taxPercentage',CAST("Invoices"."chargesTaxDetails"->>'taxPercentage' AS FLOAT),
							   'taxAmount',CAST("Invoices"."chargesTaxDetails"->>'taxAmount' AS FLOAT),
							   'taxes',("Invoices"."chargesTaxDetails"->>'taxes')::jsonb,
                               'type', ("Invoices"."chargesTaxDetails"->>'type')
							  ) end "chargesTaxDetails",
                "salesEmployee".name as "salesEmployeeName",
                "mergeWithInvoice"."invoiceNumber" as "mergeWithInvoiceNumber",
                    case when  "Invoices"."attachment" = 'null' then  null else  (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',COALESCE("Media"."url"->>'downloadUrl',"Media"."url"->>'defaultUrl'),'mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("Invoices"."attachment") as attachments(attachments)
                inner join "Media" on "Media".id = (attachments->>'id')::uuid
                ) end as  "attachment",
                "Invoices"."isInclusiveTax",
                "Services".name as "serviceName",
                "Tables".name as "tableName",
                "Companies"."vatNumber" as "companyVatNumber",
                "Customers"."vatNumber" as "customerVatNumber",
                "Customers"."phone" as "customerPhone",
                "Customers"."email" as "customerEmail"
				FROM "Invoices"
                inner join "Branches"on "Branches".id = "Invoices"."branchId"
                LEFT JOIN "Customers" on  "Customers".id = "Invoices"."customerId"
                LEFT JOIN "Media" on "Invoices"."mediaId" = "Media".id 
                LEFT JOIN "Employees"on "Employees".id = "Invoices"."employeeId"
				inner join "Companies"on  "Companies".id = "Branches"."companyId"
                left join "Services" on "Services".id = "Invoices"."serviceId"
			    left join "Invoices" "mergeWithInvoice" on  "mergeWithInvoice".id =   "Invoices"."mergeWith" 
                left join "Taxes" on "Taxes".id =      NULLIF(("Invoices"."chargesTaxDetails"->>'taxId'),'')::uuid 
                left join "Employees" "salesEmployee" on  "salesEmployee".id =   "Invoices"."salesEmployeeId" 
                LEFT JOIN "Tables" on "Tables".id = "Invoices"."tableId"
                LEFT JOIN "TableGroups" on "TableGroups".id = "Tables"."tableGroupId"
				where "Invoices".id = $1
			   and "Branches"."companyId"  = $2
			   )
			    ,"creditNotes" as (
				select  "invo".id ,Json_agg("CreditNotes".id) as "creditNote", sum("CreditNotes"."total"::text::numeric) as "total" from "invo" 
				inner join "CreditNotes" on "CreditNotes"."invoiceId" = "invo".id
				group by  "invo".id 
				), "appliedCredit" as (
				select  "invo".id, sum("AppliedCredits"."amount"::text::numeric)  as "total" from "invo" 
				inner join "AppliedCredits" on "AppliedCredits"."invoiceId" = "invo".id
				group by  "invo".id 
				),"paymnets" as (
						select  "invo".id, sum("InvoicePaymentLines"."amount"::text::numeric) as "total" from "invo" 
				inner join "InvoicePaymentLines" on "InvoicePaymentLines"."invoiceId" = "invo".id
                inner join "InvoicePayments" on "InvoicePayments".id = "InvoicePaymentLines"."invoicePaymentId"
                where "InvoicePayments".status = 'SUCCESS'
				group by  "invo".id 
				), "refunds" as (
					select  "invo".id , sum("CreditNoteRefunds"."total"::text::numeric) as "total" from "invo" 
				inner join "CreditNotes" on "CreditNotes"."invoiceId" = "invo".id
				inner join "CreditNoteRefunds" on "CreditNoteRefunds"."creditNoteId" =  "CreditNotes".id
				group by  "invo".id 
				)
				
				SELECT "invo".*,
				      COALESCE( "creditNotes"."total",0)::float as "creditNoteTotal" ,      
				        COALESCE("appliedCredit"."total",0)::float as "appliedCreditTotal",      
				        COALESCE("paymnets"."total",0)::float as "paymentTotal",      
				       COALESCE( "refunds"."total",0)::float as "refundTotal"     
				FROM "invo"
				left join "creditNotes"  on "creditNotes".id = "invo"."id"
				left join "appliedCredit"  on "appliedCredit".id = "invo"."id"
				left join "paymnets"  on "paymnets".id = "invo"."id"
				left join "refunds"  on "refunds".id = "invo"."id"
				
                 `,
                values: [invoiceId, companyId]
            }



            const invoiceData = await client.query(query.text, query.values);
            const invoice = new Invoice();
            invoice.ParseJson(invoiceData.rows[0]);
            if (invoice.id != "" && invoice.id != null) {
                query.text = `with "lines" as (

                    SELECT 
                                                "Products".name as "productName",
                                                "Products".type AS "productType",
                                                "InvoiceLines".id,
                                                "InvoiceLines".total,
                                                "InvoiceLines".price,
                                                "InvoiceLines".qty ,
                                                sum("CreditNoteLines".qty) as "returnedQty",
                                                "InvoiceLines"."accountId",
                                                "InvoiceLines"."productId" ,
                                                "InvoiceLines"."salesEmployeeId" ,
                                                "InvoiceLines"."discountAmount",
                                                "InvoiceLines"."taxId",
                                                "InvoiceLines".batch,
                                                "InvoiceLines"."discountId",
                                                "InvoiceLines".serial,
                                                "InvoiceLines".note,
                                                "InvoiceLines".index,
                                                "InvoiceLines"."discountId",
                                                "InvoiceLines"."discountPerQty",
                                                "InvoiceLines"."discountPercentage",
                                                "InvoiceLines"."discountTotal",
                                                    CAST( "InvoiceLines"."createdAt" as text ) as "createdAt",
                                                "InvoiceLines"."parentId",
                                                "InvoiceLines"."voidFrom",
                                             (  select
											   JSON_AGG(JSON_BUILD_OBJECT('taxId',"taxId",
                                                            'taxName',"taxName",
                                                            'taxPercentage',"taxPercentage",
                                                            'taxAmount',"taxAmount",
                                                            'taxes',"taxes",
                                                     
                                                            'index', "index"
                                                            ))
	                                           from (select 
                                                   
                                                    el->>'taxId' as "taxId",
												    "Taxes".name as "taxName",
												    CAST(el->>'taxPercentage' AS FLOAT) as "taxPercentage",
												    CAST(el->>'taxAmount' AS FLOAT) as "taxAmount",
												    el->>'taxes' as "taxes",
												  ( ROW_NUMBER() over() -1)  as "index"
                                                    from JSONB_ARRAY_ELEMENTS( "InvoiceLines"."taxes") el 
                                                    inner join "Taxes" on "Taxes".id = NULLIF(NULLIF(el->>'taxId', ''), 'null')::uuid and  "InvoiceLines"."taxes" <> 'null' 
                                                    )t)	as "taxes",
                                                    "InvoiceLines".waste,
                                                "InvoiceLines"."taxType",
                                                "InvoiceLines"."taxPercentage",
                                                "Products"."UOM",
                                                "Products"."barcode",
                                                 "Accounts".name as "accountName",
                                               
                                                 "Taxes".name as "taxName",
                                                CASE WHEN COUNT("CreditNoteLines"."invoiceLineId") > 0 THEN true ELSE false END as "isReturned"
                                                FROM "InvoiceLines" 
                                                LEFT JOIN "Products"  ON  "Products".id =  "InvoiceLines"."productId"
                                                LEFT JOIN "Taxes"  ON  "Taxes".id =  "InvoiceLines"."taxId"
                                                LEFT JOIN  "CreditNoteLines" ON "CreditNoteLines"."invoiceLineId"= "InvoiceLines".id
                                                INNER JOIN "Accounts" ON "Accounts".id = "InvoiceLines"."accountId"
                                                WHERE "InvoiceLines"."invoiceId"=$1
                                                group by  "Products".id , "InvoiceLines".id , "Accounts".name,  "Taxes".name 
                    ),"options" as (
                    SELECT 
                    "InvoiceLineOptions"."invoiceLineId",
                    JSON_AGG(json_build_object('id',"InvoiceLineOptions".id,'optionId',"InvoiceLineOptions"."optionId",'qty',"InvoiceLineOptions".qty,'price',"InvoiceLineOptions".price,'note',"InvoiceLineOptions".note,'optionName',"Options".name, 'optionGroupId',"InvoiceLineOptions"."optionGroupId",'optionGroupName',"OptionGroups".title)) as "options"
                    FROM "InvoiceLineOptions"
                    LEFT JOIN "Options" on "Options".id =   "InvoiceLineOptions"."optionId"
                    LEFT JOIN "OptionGroups" on "OptionGroups"."id" =   "InvoiceLineOptions"."optionGroupId"
                    inner join "lines" ON lines.id = "InvoiceLineOptions"."invoiceLineId"  
                        group by "InvoiceLineOptions"."invoiceLineId"
                    )
                    
                    select  "lines".*,"options"."options" from "lines" 
                    left join "options" on "options"."invoiceLineId" =  "lines".id
                    order by  "lines".index ASC , "lines"."createdAt" desc
                    
                    
                              `


                query.values = [invoiceId];

                const lineData = await client.query(query.text, [invoiceId])
                const lines = lineData.rows;
                for (let index = 0; index < lines.length; index++) {
                    const lineData = lines[index];
                    const line = new InvoiceLine();
                    line.isInclusiveTax = invoice.isInclusiveTax;
                    line.ParseJson(lineData);
                    line.selectedItem.id = lineData.productId; /** for front use */
                    line.selectedItem.name = lineData.productName;
                    line.selectedItem.type = lineData.productType;
                    line.selectedItem.barcode = lineData.barcode;
                    // query.text = `SELECT "InvoiceLineOptions".id,"InvoiceLineOptions"."optionId","InvoiceLineOptions".qty,"InvoiceLineOptions".price,"InvoiceLineOptions".note,"Options".name as"optionName" FROM "InvoiceLineOptions"
                    //          LEFT JOIN "Options" on "Options".id =   "InvoiceLineOptions"."optionId"
                    //         WHERE "invoiceLineId"=$1`
                    // query.values = [line.id]
                    // const optionData = await client.query(query.text, query.values);
                    // const option: any = optionData.rows[0]
                    // if (option) {
                    //     line.options = optionData.rows
                    // }

                    invoice.lines.push(line);
                }


                let parentLine: InvoiceLine | undefined;
                invoice.lines.filter(f => f.parentId != null).forEach(element => {

                    parentLine = invoice.lines.find(f => f.id == element.parentId);

                    if (parentLine != null) {
                        parentLine!.subItems.push(element);
                        invoice.lines.splice(invoice.lines.indexOf(element), 1);
                    }
                });

                invoice.lines.filter(f => f.voidFrom != null).forEach(element => {
                    parentLine = invoice.lines.find(f => f.id == element.voidFrom);
                    if (parentLine != null) {
                        parentLine!.voidedItems.push(element);
                        invoice.lines.splice(invoice.lines.indexOf(element), 1);
                    }
                });

                invoice.calculateTotal(afterDecimal);
                invoice.calaculateBalance();
                invoice.setTaxesDetails()
                query.text = `SELECT "InvoicePayments".id,
                "InvoicePayments"."referenceNumber",
                                 "InvoicePayments".rate,
                                "InvoicePaymentLines".amount,
                                CASE WHEN "InvoicePayments"."status" = 'FAILD' THEN 'FAILED' ELSE "InvoicePayments"."status" END  AS "status" ,
                                "PaymentMethods".name as "paymentMethodName",
                               CAST( "InvoicePaymentLines"."createdAt" AS TEXT),
                               (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',"Media"."url"->>'defaultUrl','mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("InvoicePayments"."attachment") as attachments(attachments)
                               inner join "Media" on "Media".id = (attachments->>'id')::uuid
                               ) as "attachment"
                          from "InvoicePayments"
                          inner join "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId"= "InvoicePayments".id 
                          inner join "PaymentMethods" on "PaymentMethods".id = "InvoicePayments"."paymentMethodId" 
                          LEFT JOIN "Media" ON "Media".id = "InvoicePayments"."mediaId" 
                          where "InvoicePaymentLines"."invoiceId" = $1
                           AND( "InvoicePayments"."status" = 'SUCCESS' OR "InvoicePayments"."status" = 'FAILD')
                           
                     `

                query.values = [invoiceId];

                let payments = await client.query(query.text, query.values)
                invoice.invoicePayments = payments.rows;
            }
            await client.query("COMMIT")
            return new ResponseData(true, "", invoice);
        } catch (error: any) {


            await client.query("ROLLBACK")
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }

    /**GET INVOICES BY CUSTOMERID */
    public static async getCustomerInvoices(customerId: string, branchId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `with "invoices" as (
                    select "Invoices".id ,"Invoices"."branchId", "total" , "Invoices"."invoiceDate","invoiceNumber" 
                    from "Invoices"
                    where "Invoices"."customerId" = $1
             and ($2::uuid is null or "Invoices"."branchId" = $2)
                    and "Invoices"."status" <>  'Draft' and "Invoices"."status" <>  'writeOff'
                    ),"payments" as(
                    select "invoices".id, sum( "InvoicePaymentLines"."amount"::text::numeric) as "amount" from "InvoicePaymentLines" inner join "invoices" on  "invoices"."id" = "InvoicePaymentLines"."invoiceId"
                    group by"invoices".id 
                    ),"credits" as(
                    select "invoices".id, sum( "CreditNotes"."total"::text::numeric) as "amount" from "CreditNotes" inner join "invoices" on  "invoices"."id" = "CreditNotes"."invoiceId"
                    group by"invoices".id 
                    ),"applyCredit" as(
                    select "invoices".id, sum( "AppliedCredits"."amount"::text::numeric) as "amount" from "AppliedCredits" inner join "invoices" on  "invoices"."id" = "AppliedCredits"."invoiceId"
                    group by"invoices".id 
                    ),"refunds" as(
					
					select "invoices".id, sum( "CreditNoteRefunds"."total"::text::numeric) as "amount" from "CreditNotes" 
						inner join "invoices" on  "invoices"."id" = "CreditNotes"."invoiceId"
						inner join "CreditNoteRefunds" ON "CreditNoteRefunds"."creditNoteId" = "CreditNotes"."id" 
						
                    group by"invoices".id 
					)
					
		
                    select 
                     "invoices".id  as "invoiceId", 
					   "invoices"."branchId",
                     "total"  ,
                     "invoices"."invoiceDate",
                     "invoiceNumber",
                     CAST( COALESCE("credits"."amount",0) +  COALESCE("payments"."amount",0) +  COALESCE("applyCredit"."amount",0)  AS REAL) as "paidAmount",
					 COALESCE("refunds"."amount",0) as "refunded"
                    from "invoices"
                    left join "payments" on "invoices"."id" = "payments".id
                    left join "credits" on "invoices"."id" = "credits".id
                    left join "applyCredit" on "invoices"."id" = "applyCredit".id
                    left join "refunds" on "invoices"."id" = "refunds".id
                    group by 
                     "invoices".id,
                       "total" ,
                     "invoices"."invoiceDate",
                     "invoiceNumber",
                     "payments"."amount",
                     "applyCredit"."amount",
                     "credits"."amount",
                     "refunds"."amount",
					   "invoices"."branchId"
                    having ( "total"::text::numeric  - (COALESCE("payments"."amount",0)+COALESCE("applyCredit"."amount",0)+COALESCE("credits"."amount",0)) )+  COALESCE("refunds"."amount",0)  >0
                    
                    `,
                values: [customerId, branchId]
            }
            const invoices = await DB.excu.query(query.text, query.values)

            //Get Customer opening balance 

            let customerBalance: any = await CustomerRepo.getCustomerOpeningBalance(customerId, branchId);
            if (customerBalance) {



                let customerOpeningBalance: any = new InvoicePaymentLine();


                customerOpeningBalance.invoiceNumber = "Opening Balance"
                customerOpeningBalance.note = "Opening Balance"
                customerOpeningBalance.openingBalanceId = customerBalance.id;
                customerOpeningBalance.invoiceDate = customerBalance.createdAt
                customerOpeningBalance.total = customerBalance.amount;
                customerOpeningBalance.paidAmount = customerBalance.paid;
                customerOpeningBalance.branchName = customerBalance.branchName;
                invoices.rows.push(customerOpeningBalance)



            }

            return new ResponseData(true, "", invoices.rows)
        } catch (error: any) {


            throw new Error(error.message)
        }
    }


    public static async getCompanyByInvoiceId(client: PoolClient, invoiceId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT * FROM "Companies" WHERE id=(select "companyId"  from "Branches" b where id = (select "branchId"  from "Invoices" i where id =$1))`,
                values: [invoiceId],
            }

            const company = (await client.query(query.text, query.values)).rows;
            const companyObj = new Company();
            companyObj.ParseJson(company[0])
            const storage = new FileStorage();
            const companySettings = await storage.getCompanySettings(companyObj.country)
            if (companySettings) {
                companyObj.settings = companySettings.settings;
            }
            return new ResponseData(true, "", companyObj)

        } catch (error: any) {

            throw new Error(error.message)
        }
    }






    /**FOR SINGLE PAYMENTS*/
    public static async getInvoiceBranchId(client: PoolClient, invoiceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "branchId" FROM "Invoices" WHERE id=$1`,
                values: [invoiceId]
            }
            const branchId = await client.query(query.text, query.values);
            return { id: (<any>branchId.rows[0]).branchId }
        } catch (error: any) {

            throw new Error(error.message)
        }
    }






    public static async getInvoiceAgrigatorId(client: PoolClient, invoiceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "grubTechData"->>'id' as "aggregatorId"  FROM "Invoices" WHERE id=$1`,
                values: [invoiceId]
            }
            const aggregatorId = await client.query(query.text, query.values);
            return { id: (<any>aggregatorId.rows[0]).aggregatorId }
        } catch (error: any) {

            throw new Error(error.message)
        }
    }


    public static async getInvoiceIdbyGruptechId(client: PoolClient, GruptechId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `select id from "Invoices" i where "grubTechData"->>'id'=$1`,
                values: [GruptechId]
            }
            const InvoiceId = await client.query(query.text, query.values);
            return { id: <any>InvoiceId.rows[0] }
        } catch (error: any) {

            throw new Error(error.message)
        }
    }












    public static async getInvoiceCustomerId(client: PoolClient, invoiceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "customerId" FROM "Invoices" WHERE id=$1`,
                values: [invoiceId]
            }
            const branchId = await client.query(query.text, query.values);
            if (branchId.rowCount != null && branchId.rowCount > 0) {
                return { id: (<any>branchId.rows[0]).customerId }
            } else {
                return { id: null }
            }

        } catch (error: any) {

            throw new Error(error.message)
        }
    }
    public static async getInvoicePaidAmount(client: PoolClient, invoiceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT
                "Invoices".total-COALESCE(sum("CreditNotes".total),0)-
                (select  COALESCE(sum("InvoicePaymentLines".amount),0)   
                 from "InvoicePaymentLines" 
                 where  "Invoices".id = "InvoicePaymentLines"."invoiceId")as balance
                        FROM "Invoices" 
                        left JOIN "CreditNotes"
                        on "CreditNotes"."invoiceId"= "Invoices".id
                       WHERE "Invoices".id=$1
					   group by  "Invoices".id`,
                values: [invoiceId]
            }

            const paidAmount = await client.query(query.text, query.values);
            return paidAmount.rows[0].balance
        } catch (error: any) {

            throw new Error(error.message)
        }
    }



    /**GET PRODUCTS BY BRANCHID*/
    public static async getBranchProductList(data: any, company: Company) {
        try {
            const companyId = company.id;
            const branchId = data.branchId;
            let selectQuery;
            let selectValues;
            let countQuery;
            let countValues;
            let searchValue = data.searchTerm ?? null;
            let offset = 0;
            let sort: any;
            let sortValue;
            let sortDirection;
            let sortTerm;
            let count = 0;
            let pageCount = 0;
            let page = data.page ?? 1
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const selectText = `SELECT 
            name, 
            type, 
            barcode,
            case when COALESCE("BranchProducts".price,0) = 0 then  "Products"."defaultPrice" else "BranchProducts".price end  as "defaultPrice",
            "taxId",
            "Products".id, 
            "commissionPercentage",
            "commissionAmount",
            "description",
            "unitCost" 
            FROM "Products"
            INNER JOIN "BranchProducts" ON "Products".id = "BranchProducts"."productId"
       `
            const countText = `SELECT
                              count(*)
                          FROM "Products"
                          INNER JOIN "BranchProducts" ON "Products".id = "BranchProducts"."productId"
                          `

            let filterQuery = `WHERE "branchId" =$1
            AND "Products"."isDeleted" = false `
            filterQuery += ` AND ( $2::text is null or (LOWER ("Products".name) ~ $2 Or LOWER ("Products".barcode) ~$2))
                             `

            const limitQuery = ` Limit $3 offset $4`

            let selectCount;
            let orderByQuery;
            selectQuery = selectText + filterQuery + limitQuery
            selectValues = [branchId, searchValue, limit, offset]


            if (data != null && data != '' && JSON.stringify(data) != '{}') {

                sort = data.sortBy;
                sortValue = !sort ? '"Products"."createdAt"' : '"' + sort.sortValue + '"';
                sortDirection = !sort ? "DESC" : sort.sortDirection;
                sortTerm = sortValue + " " + sortDirection
                orderByQuery = ` Order by ` + sortTerm;

                if (data.searchTerm != "" && data.searchTerm != null) {
                    searchValue = data.searchTerm ? data.searchTerm.toLowerCase().trim() : null
                }

                selectQuery = selectText + filterQuery + orderByQuery + limitQuery
                selectValues = [branchId, searchValue, limit, offset]
                countQuery = countText + filterQuery
                countValues = [branchId, searchValue]

                selectCount = await DB.excu.query(countQuery, countValues)
                count = Number((<any>selectCount.rows[0]).count)
                pageCount = Math.ceil(count / data.limit)
            }


            const selectList: any = await DB.excu.query(selectQuery, selectValues)

            /**TODO REMOVE THIS FROM HERE MAKE AS INDIVADUAL ROUTE */
            // for (let index = 0; index < selectList.rows.length; index++) {
            //   const element = selectList.rows[index];
            //   if (element.type == "batch" || element.type == "serialized" || element.type == "inventory" || element.type == "kit") {
            //     const branchSummary = await this.getProductAvailability(element.id, companyId);
            //     if (branchSummary?.data) {
            //       selectList.rows[index].branchSummary = branchSummary.data
            //     }
            //   }
            // }

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
            return new ResponseData(true, "", resData)

        } catch (error: any) {


            throw new Error(error.message)
        }
    }


    public static async getBranchProductList3(data: any, company: Company) {
        try {
            const companyId = company.id;
            const branchId = data.branchId;
            let searchValue = data.searchTerm ?? null;
            let offset = 0;
            let sort: any;
            let sortValue;
            let sortDirection;
            let sortTerm;
            let count = 0;
            let pageCount = 0;
            let page = data.page ?? 1;
            const customerId = data.customerId ?? null;
            const limit = (data.limit == null) ? 15 : data.limit;

            if (page != 1) {
                offset = (limit * (page - 1));
            }

            const types: [string] = data.types;
            let filterType: any = types;

            sort = data.sortBy;
            sortValue = !sort ? '"Products"."createdAt"' : '"' + sort.sortValue + '"';
            sortDirection = !sort ? "DESC" : sort.sortDirection;
            sortTerm = sortValue + " " + sortDirection;
            let orderByQuery = ` ORDER BY ${sortTerm}`;

            if (data.searchTerm != "" && data.searchTerm != null) {
                searchValue = data.searchTerm ? data.searchTerm.toLowerCase().trim() : null;
            }

            const exclude: [string] = data.exclude;
            const encoleded: [string] = data.include && data.include.length > 0 ? data.include : null;
            const includedTypes = encoleded
                ? encoleded
                : ['service', 'inventory', 'kit', 'package', 'menuItem', 'menuSelection', 'batch', 'serialized', 'tailoring'];

            if (exclude && exclude.length > 0) {
                filterType = includedTypes.filter(a => !exclude.includes(a));
            } else if (!types && !exclude) {
                filterType = includedTypes;
            }

            // NEW: tag filter (text[] column: {tag1,tag2})
            const tags: string[] | null = (data.filter && data.filter.tags && data.filter.tags.length > 0) ? data.filter.tags : null;

            const query = {
                text: `
        WITH "prod" AS (
          SELECT 
            "Products".name, 
            "Products".type, 
            "Products".barcode,
            CASE 
              WHEN "BranchProducts".price IS NULL
                THEN "Products"."defaultPrice"
              ELSE "BranchProducts".price
            END AS "defaultPrice",
            "Products"."taxId",
            "Products".id, 
            "Products"."commissionPercentage",
            "Products"."commissionAmount",
            "Products"."description",
            "Products"."unitCost",
            "Products"."companyId",
            "Products"."saleAccountId"
          FROM "Products"
          INNER JOIN "BranchProducts" 
            ON "Products".id = "BranchProducts"."productId"
          WHERE "BranchProducts"."branchId" = $1
            AND "Products"."type" = ANY($2)
            AND "Products"."isDeleted" = false
            AND (
              $3::text IS NULL 
              OR (LOWER("Products".name) ~ $3 OR LOWER("Products".barcode) ~ $3)
            )
            AND ("Products"."isSaleItem" = true OR "Products"."isSaleItem" IS NULL)
            -- TAG FILTER (text[] overlap)
            AND (
              $8::varchar[] IS NULL
              OR "Products"."tags" && $8::varchar[]
            )
          ${orderByQuery}
          LIMIT $4 OFFSET $5
        ), "customerPriceLabels" AS (
          SELECT  
            (jsonb_array_elements("PriceLabels"."productsPrices") ->> 'productId')::uuid AS "productId",
            (jsonb_array_elements("PriceLabels"."productsPrices") ->> 'price')::numeric AS "customerPrice"
          FROM "Customers" 
          INNER JOIN "PriceLabels" 
            ON "PriceLabels"."id" = "Customers"."priceLabelId" 
          WHERE "Customers"."companyId"  = $6
            AND "Customers".id = $7
        )
        SELECT 
          "prod".name,
          "prod".type,
          "prod".barcode,
          CASE 
            WHEN "customerPriceLabels"."customerPrice" IS NULL 
              THEN "prod"."defaultPrice" 
            ELSE "customerPriceLabels"."customerPrice" 
          END AS "defaultPrice",
          "prod"."taxId",
          "prod"."id",
          "prod"."commissionPercentage",
          "prod"."commissionAmount",
          "prod"."description",
          "prod"."unitCost",
          "prod"."saleAccountId"
        FROM "prod"
        LEFT JOIN "customerPriceLabels" 
          ON "customerPriceLabels"."productId" = "prod".id
      `,
                // $8 = tags
                values: [branchId, filterType, searchValue, limit, offset, companyId, customerId, tags]
            };

            const selectList: any = await DB.excu.query(query.text, query.values);

            offset += 1;
            let lastIndex = (page * limit);
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count;
            }

            const resData = {
                list: selectList.rows,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            };
            return new ResponseData(true, "", resData);

        } catch (error: any) {

            throw new Error(error.message);
        }
    }



    public static async getBranchProductByBarcode(data: any, company: Company) {
        try {
            const companyId = company.id;
            const branchId = data.branchId;

            let selectValues;

            let searchValue = data.searchTerm.trim().toLowerCase()

            const selectText = `SELECT 
           "Products".name, 
            type, 
            "Categories"."name" as "categoryName",
            "onHand" ,
            barcode,
            case when COALESCE("BranchProducts".price,0) = 0 then  "Products"."defaultPrice" else "BranchProducts".price end  as "defaultPrice",
            "taxId",
            "Products".id, 
            "commissionPercentage",
            "commissionAmount",
            "description",
            "unitCost" 
            FROM "Products"
            INNER JOIN "BranchProducts" ON "Products".id = "BranchProducts"."productId"
            left JOIN "Categories" ON "Products"."categoryId" = "Categories"."id"
            WHERE "branchId" =$1
            AND "Products"."isDeleted" = false
            AND (  LOWER ("Products".barcode) = $2) `



            selectValues = [branchId, searchValue]




            const selectList: any = await DB.excu.query(selectText, selectValues)

            /**TODO REMOVE THIS FROM HERE MAKE AS INDIVADUAL ROUTE */
            // for (let index = 0; index < selectList.rows.length; index++) {
            //   const element = selectList.rows[index];
            //   if (element.type == "batch" || element.type == "serialized" || element.type == "inventory" || element.type == "kit") {
            //     const branchSummary = await this.getProductAvailability(element.id, companyId);
            //     if (branchSummary?.data) {
            //       selectList.rows[index].branchSummary = branchSummary.data
            //     }
            //   }
            // }

            let product = selectList.rows && selectList.rows.length > 0 ? selectList.rows[0] : null;


            return new ResponseData(true, "", product)

        } catch (error: any) {


            throw new Error(error.message)
        }
    }

    // //Invoice Journal + Applied Credit Journal 
    // public static async getInvoiceJournal(invoiceId: string, company: Company) {
    //     try {
    //         const afterDecimal = company.afterDecimal

    //         const query: { text: string, values: any } = {
    //             text: `SELECT 
    //                      case when sum(amount) > 0 then ROUND( sum(amount::NUMERIC ),$2)end  as debit,
    //                      case when sum(amount) < 0 then ROUND(ABS(sum(amount::NUMERIC)),$2)end   as credit,
    //                      name as "accountType",
    //                      "branchId"
    //                FROM "JournalRecords"
    //                where "referenceId" =$1 
    //                and "dbTable" <> 'Invoice Write Off'
    //                group by "accountId" , name ,"referenceId" ,"branchId"
    //                HAVING sum(amount) != 0
    //                `,
    //             values: [invoiceId, afterDecimal]
    //         }


    //         const defaultJournals = (await DB.excu.query(query.text, query.values)).rows

    //         const journals: any[] = [];
    //         // return  applied credit journal on invoice 

    //         query.text = `
    //                     SELECT 
    //                     case when sum("JournalRecords".amount) > 0 then ROUND( sum("JournalRecords".amount::NUMERIC ),$2)end  as debit,
    //                     case when sum("JournalRecords".amount) < 0 then ROUND(ABS(sum("JournalRecords".amount::NUMERIC)),$2)end   as credit,
    //                     name as "accountType",
    //                     "CreditNotes"."creditNoteNumber",
    //                     "JournalRecords"."createdAt",
    //                     'Applied Credits' as "reference",
    //                     "JournalRecords"."referenceId"
    //             FROM "JournalRecords"
    //             INNER JOIN  "AppliedCredits" on "AppliedCredits".id = "JournalRecords"."referenceId"
    //             INNER JOIN "CreditNotes" on "CreditNotes".id = "AppliedCredits"."creditNoteId"	
    //             INNER JOIN "Invoices" on "Invoices".id = "CreditNotes"."invoiceId"
    //             where "AppliedCredits"."invoiceId"  =$1
    //             group by  "JournalRecords"."accountId" ,  "JournalRecords".name ,"referenceId","JournalRecords"."createdAt","CreditNotes".id
    //             UNION 
    //             SELECT 
    //                     case when sum("JournalRecords".amount) > 0 then ROUND( sum("JournalRecords".amount::NUMERIC ),$2)end  as debit,
    //                     case when sum("JournalRecords".amount) < 0 then ROUND(ABS(sum("JournalRecords".amount::NUMERIC)),$2)end   as credit,
    //                     name as "accountType",
    //                     NULL AS "creditNoteNumber",
    //                     "JournalRecords"."createdAt",
    //                     'writeOff' as "reference",
    //                     "JournalRecords"."referenceId"
    //                FROM "JournalRecords"
    //                where "referenceId" =$1 
    //                and "dbTable" = 'Invoice Write Off'
    //                group by "accountId" , name ,"referenceId" ,"branchId" ,"JournalRecords"."createdAt"

    //             `
    //         query.values = [invoiceId, afterDecimal]



    //         const journal = await DB.excu.query(query.text, query.values);

    //         query.text

    //         //Group by credit Applied journal by date 
    //         for (let index = 0; index < journal.rows.length; index++) {
    //             const element: any = journal.rows[index];
    //             const createdAt = new Date(element.createdAt).getTime();
    //             const journalData = journals.find((f: any) => f.id == element.id && f.createdAt == createdAt && f.reference == element.reference)
    //             const journalInfo = {
    //                 credit: element.credit,
    //                 debit: element.debit,
    //                 accountType: element.accountType
    //             }
    //             if (journalData) {
    //                 const journalIndex = journals.indexOf(journalData);
    //                 journals[journalIndex].journals.push(journalInfo);
    //             } else {
    //                 const data: any = {
    //                     createdAt: createdAt,
    //                     id: element.id,
    //                     creditNoteNumber: element.creditNoteNumber, // the number of credit note  used to applied credit From 
    //                     reference: element.reference,
    //                     journals: []
    //                 }

    //                 data.journals.push(journalInfo)
    //                 journals.push(data);
    //             }

    //         }
    //         const resaData = {
    //             defaultJournals: defaultJournals, // normal InvoiceJournal 
    //             extraJournals: journals// applied Credit Jounal 
    //         }
    //         return new ResponseData(true, "", resaData)
    //     } catch (error: any) {
    //       

    //         throw new Error(error.message)
    //     }
    // }


    public static async getInvoiceJournal(invoiceId: string, company: Company) {
        try {
            const query = {
                text: `with "invoice" as (
                            SELECT 
                                                    case when sum(amount) > 0 then  sum(amount::text::NUMERIC )end  as debit,
                                                    case when sum(amount) < 0 then ABS(sum(amount::text::NUMERIC))end   as credit,
                                                    name as "accountType",
                                                    "branchId",
                                                    "dbTable",
                                                    "referenceId"
                                            FROM "JournalRecords"
                                            where "companyId" =$2
                                            and "referenceId" =$1
                                            and name not in ('Inventory Assets', 'Costs Of Goods Sold')
                                            group by "accountId" , name ,"referenceId" ,"branchId","dbTable"

                            ),"defaultJournals" as (
                            select * from "invoice"
                            where "dbTable" <> 'Invoice Write Off'
                            ),"extraJournals" as (
                            SELECT 
                                                    case when sum("JournalRecords".amount) > 0 then sum("JournalRecords".amount::text::NUMERIC )end  as debit,
                                                    case when sum("JournalRecords".amount) < 0 then ABS(sum("JournalRecords".amount::text::NUMERIC))end   as credit,
                                                    name as "accountType",
                                                    "CreditNotes"."creditNoteNumber",
                                                    "JournalRecords"."createdAt",
                                                    'Applied Credits' as "reference",
                                                    "CreditNotes".id as  "referenceId",
                                                    "AppliedCredits".id as "appliedCreditId"
                                            FROM "AppliedCredits"
                                            INNER JOIN  "JournalRecords" on "AppliedCredits".id = "JournalRecords"."referenceId" and "AppliedCredits"."invoiceId"  =$1
                                            INNER JOIN "CreditNotes" on "CreditNotes".id = "AppliedCredits"."creditNoteId"	
                                            INNER JOIN "Invoices" on "Invoices".id = "CreditNotes"."invoiceId"
                                            where "AppliedCredits"."invoiceId"  =$1
                                            group by   "CreditNotes".id , "JournalRecords"."accountId" ,  "JournalRecords".name ,"referenceId","JournalRecords"."createdAt","CreditNotes".id,    "AppliedCredits".id 
                                            UNION 
                                            SELECT 
                                                    case when sum("JournalRecords".amount) > 0 then  sum("JournalRecords".amount::text::NUMERIC )end  as debit,
                                                    case when sum("JournalRecords".amount) < 0 then  ABS(sum("JournalRecords".amount::text::NUMERIC))end   as credit,
                                                    name as "accountType",
                                                    NULL AS "creditNoteNumber",
                                                    "JournalRecords"."createdAt",
                                                    'writeOff' as "reference",
                                                    null::uuid as "referenceId",
                                                    null::uuid  as "appliedCreditId"
                                            FROM "JournalRecords"
                                                where "companyId" =$2
                                            and "referenceId" =$1
                                            and  "dbTable" = 'Invoice Write Off'
                                            group by "accountId" , name ,"referenceId" ,"branchId" ,"JournalRecords"."createdAt"

                            ), "extraSummary" as
                            (
                                select  "reference" ,"referenceId","extraJournals"."createdAt"::date, "creditNoteNumber",JSON_AGG(JSON_BUILD_OBJECT('credit',"credit",'debit',"debit",'accountType',"accountType")) as "journals"  , "appliedCreditId"  from "extraJournals"
                                GROUP BY "reference" ,"extraJournals"."createdAt"::date, "creditNoteNumber","referenceId","appliedCreditId"
                            )
                            ,"journal" as (
                            select 
                            JSON_AGG("defaultJournals".*) as "defaultJournals",
                            null as "extraJournals"	
                            from "defaultJournals"
                            union all
                                select 
                            null as "defaultJournals",
                            JSON_AGG("extraSummary".*) as "extraJournals"
                            from "extraSummary"
                            )

                            SELECT * FROM "journal"
                            `,
                values: [invoiceId, company.id]
            }

            const journal = await DB.excu.query(query.text, query.values);
            let defaultJournals = journal && journal.rowCount && journal.rowCount > 0 && (<any>journal.rows[0]).defaultJournals != null ? (<any>journal.rows[0]).defaultJournals : []
            console.log("defaultJournalsdefaultJournalsdefaultJournals", defaultJournals, journal.rows, (<any>journal.rows[0]).defaultJournals)

            let extraJournals = journal && journal.rowCount && journal.rowCount > 0 ? (<any>journal.rows[1]).extraJournals : []

            let getInventoryJournals = {
                text: `    select abs(sum("InventoryMovmentRecords"."cost"::text::numeric * "InventoryMovmentRecords"."qty"::text::numeric ) ) as  "cost"  from "InventoryMovmentRecords"
                        where "companyId" = $2 
                        AND "transactionId" = $1`,
                values: [invoiceId, company.id]
            }
            let inventoryJournal = await DB.excu.query(getInventoryJournals.text, getInventoryJournals.values);
            if (inventoryJournal && inventoryJournal.rows.length > 0) {




                const cost = +(<any>inventoryJournal.rows[0]).cost;
                if (cost && cost > 0) {
                    const costData = {
                        accountType: "Costs Of Goods Sold",
                        debit: cost,
                        credit: 0,
                        dbTable: "Invoice",
                        referenceId: invoiceId
                    }
                    const costinvData = {
                        accountType: "Inventory Assets",
                        credit: cost,
                        debit: 0,
                        dbTable: "Invoice",
                        referenceId: invoiceId
                    }
                    defaultJournals.push(costinvData)
                    defaultJournals.push(costData)
                }


            }
            let resData = {
                extraJournals: extraJournals,
                defaultJournals: defaultJournals
            }
            return new ResponseData(true, "", resData)
        } catch (error: any) {


            throw new Error(error.message)
        }
    }

    /**To convert Invoice from Draft To Open */
    public static async getFullInvoice(client: PoolClient, invoiceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "Invoices".id,
                              "Invoices"."invoiceNumber",
                              "Invoices"."refrenceNumber",
                              "Invoices"."total",
                              "Invoices"."note",
                              "Invoices"."guests",
                              "Invoices"."branchId",
                              "Invoices"."employeeId",
                              "Invoices"."tableId",
                              "Invoices"."createdAt" ,
                              "Invoices"."source",
                              "Invoices"."serviceId",
                              "Invoices"."customerId",
                              "Invoices"."customerAddress",
                              "Invoices"."customerContact",
                              "Invoices"."customerLatLang",
                              "Invoices"."discountId",
                              "Invoices"."discountAmount",
                              "Invoices"."discountPercentage",
                              "Invoices"."estimateId",
                              "Invoices"."status",
                              "Invoices"."draft",
                              "Invoices"."charges",
                              "Invoices"."chargeType",
                              "Invoices"."discountTotal",
                              "Invoices"."discountType",
                              "Invoices"."chargeId",
                              "Invoices"."chargeAmount",
                              "Invoices"."chargePercentage",
                              "Invoices"."chargeTotal",
                              "Invoices"."subTotal",
                              "Invoices"."deliveryCharge",
                              "Invoices"."printTime",
                              "Invoices"."readyTime",
                              "Invoices"."departureTime",
                              "Invoices"."arrivalTime",
                              "Invoices"."scheduleTime",
                              "Invoices"."mergeWith",
                              "Invoices"."invoiceDate",
                              "Invoices"."customFields",
                              "Invoices"."updatedDate",
                              "Invoices"."terminalId",
                              "Invoices"."roundingType",
                              "Invoices"."roundingTotal",
                              "Invoices"."smallestCurrency",
                              "Invoices"."isInclusiveTax",
                              "Invoices"."driverId",
                              "Invoices"."onlineData",
                              "Invoices"."pointsDiscount",
                              "Invoices"."couponId",
                              "Invoices"."promoCoupon"
                              
                               FROM "Invoices"
                                
                               where id = $1`,
                values: [invoiceId]
            }

            let invoiceData = (await client.query(query.text, query.values)).rows[0];
            let invoice = new Invoice();
            invoice.ParseJson(invoiceData);


            query.text = `SELECT "InvoiceLines".*, "Products"."name" as "productName" FROM "InvoiceLines" inner join "Products" on "Products".id = "InvoiceLines"."productId" where "invoiceId" =$1 `
            let invoicelines = (await client.query(query.text, query.values)).rows;
            for (let index = 0; index < invoicelines.length; index++) {
                const line = invoicelines[index];
                const temp = new InvoiceLine();
                temp.ParseJson(line);
                query.text = `select "InvoiceLineOptions".id,
                                        "InvoiceLineOptions"."optionId" ,
                                        "InvoiceLineOptions".qty,
                                        "InvoiceLineOptions".price,
                                        "InvoiceLineOptions"."invoiceLineId",
                                        "InvoiceLineOptions"."optionGroupId",
                                        "OptionGroups".title as  "optionGroupName",
                                        case when "Options".id is null then  "InvoiceLineOptions"."note" else "Options"."name" end as "note"
                           FROM "InvoiceLineOptions" 
                            left join "Options" on "Options".id = "InvoiceLineOptions"."optionId"
                            left join "OptionGroups" on "OptionGroups".id =   "InvoiceLineOptions"."optionGroupId"
                            WHERE "invoiceLineId"=$1`;
                query.values = [line.id];
                let options = await client.query(query.text, query.values);
                temp.options = options.rows;
                invoice.lines.push(temp);
            }

            query.text = `SELECT * FROM "Customers" where id =$1`,
                query.values = [invoice.customerId];
            let customer = await client.query(query.text, query.values);
            invoice.customer = customer.rows[0]

            return invoice;
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async saveOpenInvoice(client: PoolClient, invoiceId: string, company: Company, employeeId: string) {
        try {
            const invoice = await this.getFullInvoice(client, invoiceId);
            invoice.status = "Open"

            if (!invoice.invoiceNumber) {
                invoice.invoiceNumber = (await InvoiceRepo.getInvoiceNumber(client, invoice.branchId, company)).data.invoiceNumber
                if (invoice.source == 'Online') {
                    invoice.onlineData.onlineStatus = 'Accepted'
                }
            }

            this.editInvoice(client, invoice, company, employeeId)
            return new ResponseData(true, "", { invoice: invoice })
        } catch (error: any) {
            console.log(error)


            throw new Error(error)
        }
    }


    /**SET INVOICE ONLINE STATUS*/
    public static async setInvoiceStatus(data: any, status: string) {
        try {
            data = data
            const query: any = {
                text: `UPDATE "Invoices" set  "onlineData" = jsonb_set("onlineData"  ,'{onlineStatus}',
                    to_jsonb($1::text))where id =$2`,
                values: []
            }
            if (data.id.length > 0) {
                for (let index = 0; index < data.id.length; index++) {
                    const element: any = data.id[index];
                    query.values = [status, element]
                    await DB.excu.query(query.text, query.values);

                }
            }

            let queueInstance = TriggerQueue.getInstance();
            //    if(data.length>0)
            //     {
            //         queueInstance.createJob({ type: "pushNotifictios", invoiceIds: data.id })
            //     }

        } catch (error: any) {



            throw new Error(error)
        }
    }

    public static async setCallCenterInvoiceStatus(data: any, status: string) {
        try {
            data = data
            const query: any = {
                text: `UPDATE "Invoices" set  "onlineData" = jsonb_set("onlineData"  ,'{callCenterStatus}',
                    to_jsonb($1::text))where id =$2`,
                values: []
            }
            if (data.id.length > 0) {
                for (let index = 0; index < data.id.length; index++) {
                    const element: any = data.id[index];
                    query.values = [status, element]
                    await DB.excu.query(query.text, query.values);

                }
            }



        } catch (error: any) {



            throw new Error(error)
        }
    }
    /**RETRIVE CURRENT INVOICE STATUS */
    public static async getInvoiceStatus(client: PoolClient, invoiceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT status from "Invoices" where id =$1`,
                values: [invoiceId]
            }

            let invoice = await client.query(query.text, query.values);
            return (<any>invoice.rows[0]).status
        } catch (error: any) {

            throw new Error(error)
        }
    }


    /** Only Open Invoices Can be Deleted  the following function checking if invoice has any 
     * Payments 
     * creditNotes
     * appliedCredit
    */
    public static async canInvoicBeDeleted(client: PoolClient, invoiceId: string) {
        try {
            //SELECT OPEN AND DRAFT INVOICES  ONLY WITH NO PAYMENST NO APPLIED Credit and No Credit Notes
            const query: { text: string, values: any } = {
                text: `with "Invoice" as (
                    select id from "Invoices" where id =$1
                    AND "Invoices"."source" <> 'POS' AND   "Invoices"."source" <> 'Online' 
                    ),
                    "appliedCedit" as (
                    select sum( "AppliedCredits".amount) as total,"Invoice".id  from "AppliedCredits" inner join "Invoice" on "AppliedCredits"."invoiceId" = "Invoice".id group by "Invoice".id
                    ),
                    "InvoicePaymentLine" as (
                    select sum( "InvoicePaymentLines".amount) as total,"Invoice".id  from "InvoicePaymentLines" inner join "Invoice" on "InvoicePaymentLines"."invoiceId" = "Invoice".id group by "Invoice".id
                    ),
                    "CreditNote" as (
                    select sum( "CreditNotes".total) as total,"Invoice".id  from "CreditNotes" inner join "Invoice" on "CreditNotes"."invoiceId" = "Invoice".id  group by "Invoice".id
                    )
                    select "Invoice".id from "Invoice"
                    left join "appliedCedit" on "appliedCedit".id = "Invoice".id 
                    left join "InvoicePaymentLine" on "InvoicePaymentLine".id = "Invoice".id 
                    left join "CreditNote" on "CreditNote".id = "Invoice".id 
                    group by "Invoice".id
                    having sum(COALESCE("CreditNote"."total",0))=0 and sum(COALESCE("InvoicePaymentLine".total,0))=0 and sum(COALESCE("appliedCedit".total,0))=0
                    
                `,
                values: [invoiceId]
            }

            let status = await client.query(query.text, query.values);
            if (status.rowCount != null && status.rowCount > 0) {
                return true;

            }
            throw new ValidationException("Invoice Is Not Allowed to be Deleted")
        } catch (error: any) {


            throw new Error(error)
        }
    }
    public static async deleteInvoice(invoiceId: string, company: Company, employeeId: string) {

        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            // to check if invoice has payment or creditNotes or applied credit
            await this.canInvoicBeDeleted(client, invoiceId);

            let invoiceLinesQuery = {
                text: `SELECT JSON_AGG("InvoiceLines".id) as "ids" ,
                              "Invoices"."branchId",
                              "Invoices".source,
                                   "Invoices"."customerId",
                                   "Invoices"."invoiceNumber",
                                   "Employees"."name" as "employeeName"

                       FROM "InvoiceLines"
                       INNER JOIN "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId"
                        INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2
                       where "invoiceId" = $1
                        group by  "Invoices".id, "Employees".id
                        `,
                values: [invoiceId, employeeId, company.id]
            }

            let invoiceLineIds = await client.query(invoiceLinesQuery.text, invoiceLinesQuery.values);
            let lineIds = invoiceLineIds.rows && invoiceLineIds.rows.length > 0 && invoiceLineIds.rows[0].ids ? invoiceLineIds.rows[0].ids : []
            let branchId = invoiceLineIds.rows && invoiceLineIds.rows.length > 0 && invoiceLineIds.rows[0].branchId ? invoiceLineIds.rows[0].branchId : null
            let source = invoiceLineIds.rows && invoiceLineIds.rows.length > 0 && invoiceLineIds.rows[0].source ? invoiceLineIds.rows[0].source : null
            let customerId = invoiceLineIds.rows && invoiceLineIds.rows.length > 0 && invoiceLineIds.rows[0].customerId ? invoiceLineIds.rows[0].customerId : null
            let invoiceNumber = invoiceLineIds.rows && invoiceLineIds.rows.length > 0 && invoiceLineIds.rows[0].invoiceNumber ? invoiceLineIds.rows[0].invoiceNumber : ''
            let employeeName = invoiceLineIds.rows && invoiceLineIds.rows.length > 0 && invoiceLineIds.rows[0].employeeName ? invoiceLineIds.rows[0].employeeName : ''

            let invoiceLinesOptionsQuery = {
                text: `SELECT JSON_AGG("InvoiceLineOptions".id) as "ids" FROM "InvoiceLines"
                         inner join "InvoiceLineOptions" on  "InvoiceLineOptions"."invoiceLineId" = "InvoiceLines".id
                  where "invoiceId" = $1`,
                values: [invoiceId]
            }

            let invoiceLineOptionIds = await client.query(invoiceLinesOptionsQuery.text, invoiceLinesOptionsQuery.values);
            let lineOptionIds = invoiceLineOptionIds.rows && invoiceLineOptionIds.rows.length > 0 && invoiceLineOptionIds.rows[0].ids ? invoiceLineOptionIds.rows[0].ids : []
            lineOptionIds.forEach((element: any) => {
                lineIds.push(element)
            });
            // Delete movments associated with the invoice 
            await this.deleteInvoiceMovment(client, invoiceId)
            //Delete Invoice 

            let invoice = await this.getFullInvoice(client, invoiceId)
            if (invoice.status == 'Open' || (invoice.status == 'Closed' && invoice.total == 0)) {
                await this.returnInvoiceInventory(client, invoice)
            }
            const query: { text: string, values: any } = {
                text: ` DELETE FROM "InvoiceLineOptions" using "InvoiceLines","Invoices"
                WHERE "InvoiceLineOptions"."invoiceLineId" = "InvoiceLines".id 
                AND "InvoiceLines"."invoiceId"  ="Invoices".id 
                AND  "Invoices".id =$1;
                `,

                values: [invoiceId]
            }
            await client.query(query.text, query.values)

            query.text = `DELETE FROM "InvoiceLines" using "Invoices"
            WHERE "InvoiceLines"."invoiceId" = "Invoices".id 
            AND  "Invoices".id =$1;`

            await client.query(query.text, query.values)

            query.text = ` DELETE FROM "Invoices" 
            WHERE  "Invoices".id =$1;`

            await client.query(query.text, query.values)

            let log = new Log();
            log.employeeId = employeeId
            log.action = 'Invoice Deleted'
            log.comment = `${employeeName} has deleted invoice number ${invoiceNumber}`
            log.metaData = { "deleted": true }
            await LogsManagmentRepo.manageLogs(client, "Invoices", invoiceId, [log], branchId, company.id, employeeId, invoiceNumber, source)

            EventLogsSocket.deleteInvoiceSync(branchId, invoiceId)
            await client.query("COMMIT")

            invoice.companyId = company.id;
            const branchName = (await BranchesRepo.getBranchName(branchId))

            if (company.features?.map(f => f.toLowerCase()).includes('notifications')) {
                await publishEvent("invoiceDeleted", { ...invoice, branchName: branchName });
            }


            return new ResponseData(true, "", { ids: lineIds, customerId: customerId })
        } catch (error: any) {


            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async returnInvoiceInventory(client: PoolClient, invoice: Invoice) {
        try {

            for (let index = 0; index < invoice.lines.length; index++) {
                const element = invoice.lines[index];

                if (element.productId != null && element.productId != "") {
                    const productType = await ProductRepo.getProductType(client, element.productId)
                    console.log("tessssssssssssss", productType, element.qty)
                    switch (productType) {
                        case "inventory":
                            let productOnHand = await ProductRepo.getProductOnHand(client, element.productId, invoice.branchId)
                            productOnHand += element.qty
                            // await BranchProductsRepo.setNewOnHand(client, invoice.branchId, element.productId, productOnHand)
                            break;
                        case "kit":
                            let kitproductOnHand = await ProductRepo.getProductOnHand(client, element.productId, invoice.branchId)
                            kitproductOnHand += element.qty
                            // await BranchProductsRepo.setNewOnHand(client, invoice.branchId, element.productId, kitproductOnHand)
                            break;
                        case "batch":

                            let batch = await BatchProductRepo.getBatchOnhandAndUnitCost(client, element.batch, element.productId, invoice.branchId);
                            let onHand = batch.onHand;
                            onHand += element.qty;

                            // await BatchProductRepo.setBatchOnHand(client, element.batch, element.productId, invoice.branchId, onHand)
                            break;
                        case "serialized":
                            await SerialProductRepo.setSerialStatus(client, invoice.branchId, element.productId, "Available", element.serial)
                            break;

                        case "menuItem":
                            await this.returnMenuItemInventory(client, element.productId, element.qty, invoice.branchId);
                            break;
                        default:
                            break;
                    }
                }
            }
        } catch (error: any) {


            throw new Error(error)
        }
    }
    public static async returnMenuItemInventory(client: PoolClient, productId: string, qty: number, branchId: string) {
        try {
            // loop on product recipes

            let product = await InvoiceInventoryMovmentRepo.getProduct(client, productId);
            if (product.recipes.length > 0) {

                for (let index = 0; index < product.recipes.length; index++) {
                    const recipeItem: any = product.recipes[index];

                    if (recipeItem.recipeId) { // when menu Item recipe is a recipeId
                        //get Recipe items 
                        const recipeData = await RecipeRepo.getRecipeProducts(client, recipeItem.recipeId, recipeItem.usages)

                        for (let index = 0; index < recipeData.length; index++) {
                            const recipeInventoryItem: any = recipeData[index];


                            let productOnHand = await ProductRepo.getProductOnHand(client, recipeInventoryItem.id, branchId)
                            productOnHand += (qty * recipeInventoryItem.totalUsage)
                            // await BranchProductsRepo.setNewOnHand(client, branchId, recipeInventoryItem.id, productOnHand)
                            // if (lineId)
                            //     await this.createCreditNoteMovment(client, creditNoteLine.employeeId, totalCost, currentOnHand, currentCost, productId, branchId, lineId, qty, afterDecimal)

                        }
                    } else { // when Menu Item is Inventory 

                        let productOnHand = await ProductRepo.getProductOnHand(client, recipeItem.inventoryId, branchId)
                        productOnHand += (qty * recipeItem.usages)
                        // await BranchProductsRepo.setNewOnHand(client, branchId, recipeItem.inventoryId, productOnHand)
                        // if (lineId)
                        //     await this.createCreditNoteMovment(client, creditNoteLine.employeeId, totalCost, currentOnHand, currentCost, productId, branchId, lineId, qty, afterDecimal)
                    }


                }


            }
        } catch (error: any) {
            console.log(error)


            throw new Error(error.message)
        }
    }
    public static async deleteInvoiceMovment(client: PoolClient, invoiceId: string) {
        try {

            const query: { text: string, values: any } = {
                text: ` DELETE FROM "InventoryMovmentLines" using "InventoryMovments","InvoiceLines","Invoices"
                WHERE "InventoryMovmentLines"."inventoryMovmentId" = "InventoryMovments".id 
                AND "InventoryMovments"."invoiceLineId"  ="InvoiceLines".id 
                AND "InvoiceLines"."invoiceId" = "Invoices".id 
                AND  "Invoices".id =$1;
                `,
                values: [invoiceId]
            };
            await client.query(query.text, query.values);

            query.text = `DELETE FROM "InventoryMovments" using "InvoiceLines","Invoices"
            WHERE "InventoryMovments"."invoiceLineId"  ="InvoiceLines".id 
            AND "InvoiceLines"."invoiceId" = "Invoices".id 
            AND  "Invoices".id =$1`
            await client.query(query.text, query.values);


            await client.query(query.text, query.values)
        } catch (error: any) {


            throw new Error(error)
        }
    }
    public static async writeOffInvoice(invoiceId: string, companyId: string) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const date = new Date();
            const query: { text: string, values: any } = {
                text: `UPDATE "Invoices" SET status= 'writeOff',"writeOffDate"=$2  where id=$1`,
                values: [invoiceId, date]
            }

            await client.query(query.text, query.values)

            //TODO:JOURNAL 

            //retrieve data for event
            let data = await client.query(`Select "Invoices".id,"Invoices"."invoiceNumber","Invoices".total, "Invoices"."branchId" 
                                            from "Invoices" 
                                            inner join "Companies" on "Companies".id = "Invoices"."companyId" 
                                            where "Invoices".id = $1
                                            AND EXISTS (
                                                SELECT 1
                                                FROM jsonb_array_elements_text("features") f
                                                WHERE lower(f) = 'notifications'
                                            ) `,
                [invoiceId]);
            let retrievedData = null;
            if (data.rows.length > 0) {
                retrievedData = data.rows[0];
            }
            //let invoice = await this.getFullInvoice(client, invoiceId)
            // await JournalTriggers.writeOffinvoiceJournal(client,invoiceId,companyId)
            let branchName
            if (retrievedData) {
                if (retrievedData.branchId) {
                    branchName = (await BranchesRepo.getBranchName(retrievedData.branchId))
                }
                if (retrievedData != null) {
                    publishEvent("invoiceWriteOff", { ...retrievedData, branchName: branchName, companyId: companyId });
                }
            }


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

    /** cloud accepted and rejected */
    public static async getOnlineInvoicesList(data: any, company: Company, branchList: []) {


        try {

            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;

            let searchValue = data.searchTerm ? `'^.*` + InvoiceRepo.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `.*$'` : null;


            let status = data.status
            const filter = data.filter
            const fromDate = filter && filter.fromDate ? `and "Invoices"."invoiceDate"::date >= '${filter.fromDate}'::date ` : ''
            const toDate = filter && filter.toDate ? `and "Invoices"."invoiceDate"::date <= '${filter.toDate}'::date ` : ''

            let filterQuery = `
            
            Where "Invoices"."companyId" = $1
                                AND (array_length($2::uuid[], 1) IS NULL OR ("Invoices"."branchId"=any($2::uuid[])))
                                AND "Invoices".source = 'Online'
                                AND "Invoices"."onlineData"->> 'onlineStatus' = $3
                           
                                ${fromDate}
                                ${toDate}
                                `

            if (searchValue) {
                filterQuery += `and (LOWER("Customers".name) ~ ${searchValue}
                                        OR LOWER("Employees".name) ~ ${searchValue}
                                        OR LOWER("Branches".name) ~ ${searchValue}
                                        OR LOWER("Invoices"."invoiceNumber") ~ ${searchValue} 
                                        OR LOWER("Invoices"."refrenceNumber") ~ ${searchValue} 
                                        OR nullif(regexp_replace("invoiceNumber", '[A-Z]*-', ''),'') ~ ${searchValue}
                                 )`
            }



            let sort = data.sortBy;
            let sortValue = !sort ? ' "invoiceDate" desc,   "Invoices"."createdAt":: timestamp:: time ' : '"' + sort.sortValue + '"';
            if (sort && sort.sortValue == "invoiceNumber") {
                sortValue = ` COALESCE(nullif(regexp_substr(regexp_substr("invoiceNumber", '[_.+=-]\\d*$'), '\\d*$'),''), '0')::int `
            }
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by` + sortTerm

            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            let page = data.page ?? 1
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const counterQuery: { text: string, values: any } = {

                text: `select count(*)
                                        FROM "Invoices"
                                        LEFT JOIN "Customers" on  "Customers".id = "Invoices"."customerId"
                                        LEFT JOIN "Employees"  on "Employees".id = "Invoices"."employeeId"
                                        inner join "Branches"  on "Branches".id = "Invoices"."branchId"
                                ${filterQuery}
                                 `,
                values: [company.id, branches, status]
            }
            const counter = await DB.excu.query(counterQuery.text, counterQuery.values)


            const query: { text: string, values: any } = {

                text: `select
                                        "Invoices".id ,
                                        "customerContact",
                                        "Invoices"."invoiceDate",
                                        "invoiceNumber",
                                        "Invoices"."refrenceNumber",
                                        "Invoices".source,
                                        "Invoices"."branchId",
                                        "Invoices"."total",
                                        "Invoices".status,
                                        "Invoices"."onlineData",
                                        "Invoices"."estimateId",
                                        "Invoices"."mergeWith",
                                        "Customers".name as "customerName",
                                        "Employees".name as "employeeName",
                                        "Branches".name as "branchName",
                                        "Invoices"."createdAt":: timestamp:: time as "time",
                                        "Invoices"."createdAt"::timestamp ,
                                        "Invoices"."paymentTerm",
                                        "Invoices"."dueDate",
                                        "Invoices"."onlineActionTime"
                                        FROM "Invoices"
                                        LEFT JOIN "Customers" on  "Customers".id = "Invoices"."customerId"
                                        LEFT JOIN "Employees"  on "Employees".id = "Invoices"."employeeId"
                                        inner join "Branches"  on "Branches".id = "Invoices"."branchId"
                                ${filterQuery}
                                ${orderByQuery}
                                limit $4 offset $5 `,
                values: [company.id, branches, status, limit, offset]
            }
            const selectList = await DB.excu.query(query.text, query.values)



            let list: InvoiceMini[] = []
            let ids: any[] = [];
            for (let index = 0; index < selectList.rows.length; index++) {
                const element = selectList.rows[index];
                const invoice = new InvoiceMini()
                invoice.ParseJson(element)
                //invoice.invoiceStatus()
                ids.push(invoice.id);
                list.push(getValuable(invoice))
            }

            let invoiceSerialBatches = await this.isInvoiceHasSerialBatchProducts(null, ids)

            if (invoiceSerialBatches.invoices && invoiceSerialBatches.invoices.length > 0) {
                list = list.map((f: any) => {

                    let invoice = invoiceSerialBatches.invoices.filter(item => item.id == f.id);

                    if (invoice) {

                        f.lines = invoice
                    }

                    return f
                }).filter(item => item !== null);
            }



            let count = (counter.rows && counter.rows.length > 0) ? Number((<any>counter.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: list,
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


    public static async isInvoiceHasSerialBatchProducts(client: PoolClient | null, invoiceIds: any[]) {
        try {
            const query = {
                text: `select 
                    "InvoiceLines".id as "lineId",
                    "Invoices".id,
                    "Products"."name",
                    "Products".id as "productId",
                          "Products"."type" as "productType",
                    case when count("ProductSerials".id)> 0 then JSON_AGG("ProductSerials"."serial") end as "serials",
                    case when count("ProductBatches".id)> 0 then     JSON_AGG("ProductBatches"."batch")end  as "batches"
                    from "InvoiceLines"
                    inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId"
                    inner join "Products" on "Products".id = "InvoiceLines"."productId"
                    inner join "BranchProducts" on "BranchProducts"."productId" = "Products".id  and "BranchProducts"."branchId" = "Invoices"."branchId"
                    left join "ProductSerials" on "ProductSerials"."branchProductId" = "BranchProducts"."id" and "ProductSerials"."status" = 'Available'
                    left join "ProductBatches" on "ProductBatches"."branchProductId" = "BranchProducts"."id" and "ProductBatches"."onHand" >0
                    where "InvoiceLines"."invoiceId" = any($1::uuid[])
                    group by "Invoices".id,"InvoiceLines".id ,"Products".id
                    having count("ProductSerials".id)> 0 or  count("ProductBatches".id)> 0 `,
                values: [invoiceIds]
            }

            const invoices = client ? await client.query(query.text, query.values) : await DB.excu.query(query.text, query.values);
            return { invoices: invoices.rows }
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async checkIfInvoiceIdExist(client: PoolClient, invoiceId: string, branchId: string) {
        try {

            const query = {
                text: `SELECT count(*) from "Invoices" WHERE id =$1 and "branchId"=$2 `,
                values: [invoiceId, branchId]
            }
            const count = await client.query(query.text, query.values);

            if ((<any>count.rows[0]).count > 0) {
                return true;
            } else {
                return false
            }
        } catch (error: any) {



            throw new Error(error)
        }
    }
    /**SET INVOICE ONLINE STATUS*/
    public static async setInvoiceStatusByCloud(client: PoolClient, data: any) {
        try {

            const query: any = {
                text: `UPDATE "Invoices" set status = $3,  
                                       "onlineData" =  "onlineData" || jsonb_build_object('rejectReason', to_jsonb($5::text),
                                                                                          'onlineStatus', to_jsonb($4::text))
                where id =$1 and "branchId"=$2`,
                values: [data.invoiceId, data.branchId, data.status, data.onlineStatus, data.rejectReason]
            }

            await client.query(query.text, query.values);

        } catch (error: any) {

            throw new Error(error)
        }
    }

    public static async updateInvoiceStatus(data: any, company: Company, employeeId: string) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const companyId = company.id;
            const invoiceId = data.invoiceId
            const branchId = data.branchId
            const onlineStatus = data.status
            const rejectReason = data.rejectReason ? data.rejectReason : ""
            let addJournal = false

            const lines = data.lines;

            const branchInfo = (await BranchesRepo.getBranchById(branchId, company)).data

            if (!invoiceId) { throw new Error("Invoice ID is required") }
            if (!branchId) { throw new Error("Branch ID is required") }
            const invoice = await InvoiceRepo.getFullInvoice(client, invoiceId);
            invoice.companyId = companyId

            if (lines && lines.length > 0) {
                const linesTemp: any = invoice.lines.map((f) => {
                    const lineTemp: any = lines.find((item: any) => item.lineId == f.id)
                    if (lineTemp) {
                        if (lineTemp.serial) {
                            f.serial = lineTemp.serial
                        }

                        else if (lineTemp.batch) {
                            f.batch = lineTemp.batch
                        }

                    }
                    return f
                })

                invoice.lines = linesTemp
            }
            let invoiceNumber = (await InvoiceRepo.getInvoiceNumber(client, invoice.branchId, company)).data.invoiceNumber

            invoice.invoiceNumber = invoiceNumber;
            // const isInvoiceIdExist = await this.checkIfInvoiceIdExist(client,  invoiceId, branchId )
            if (invoice.id != null || invoice.id != "") { /**Invoice id exist edit invoice */


                // const currentInvoiceStatus = await SocketInvoiceRepo.getInvoiceOnlineStatus(client, invoiceId) /**TO COMPAIR BETWEEN OLD STATUS AND CURRENT STATUS */
                //if invoice has a payment or more
                const payments = await SocketInvoiceRepo.isInvoicePaid(client, invoiceId)
                const hasPoints = invoice.pointsDiscount;
                const hasCoupon = invoice.couponId;
                const hasOtherPayments = payments && payments.length > 0;
                /**
                 * Accepted && not paid -> 'Open'
                 * Rejected && not paid -> 'Closed'
                 * pending && not Paid -> 'Draft' -> not affect on journal 
                 */
                // let status = currentInvoiceStatus
                // status = (onlineStatus == "Rejected" && !isPaid) ? "Closed" : "Open"

                // let updatedStatus = {"invoiceId":invoiceId, "branchId": branchId,"status": status,"onlineStatus": onlineStatus, "rejectReason":data.rejectReason}
                // await this.setInvoiceStatusByCloud(client, updatedStatus )
                /**only when invoice old online status is pending and  online current status is rejected and invoice is paid then create Creditnote */
                // let invoice = await this.getFullInvoice(client, invoiceId)
                invoice.employeeId = employeeId

                let currentInvoiceStatus = invoice.onlineData.onlineStatus;
                if ((currentInvoiceStatus == "Pending" || currentInvoiceStatus == "Placed")) {

                    if (onlineStatus == "Rejected" && hasOtherPayments) {

                        invoice.onlineData.onlineStatus = 'Rejected';
                        invoice.onlineData.rejectReason = rejectReason;
                        invoice.status = 'Open'
                        addJournal = true
                    } else if (onlineStatus == "Rejected" && !hasOtherPayments) {

                        invoice.onlineData.onlineStatus = 'Rejected'
                        invoice.status = 'Draft'
                        invoice.onlineData.rejectReason = rejectReason;

                    } else if (onlineStatus == 'Accepted') {

                        invoice.status = 'Open'
                        invoice.onlineData.onlineStatus = 'Accepted'
                        addJournal = true
                        if (company.features?.map(f => f.toLowerCase()).includes('notifications')) {
                            invoice.onlineStatus = 'Accepted'
                            await publishEvent("invoiceAccepted", { ...invoice, branchInfo });
                        }
                    }

                    await InvoiceRepo.editInvoice(client, invoice, company, employeeId);
                }


                if ((currentInvoiceStatus == "Pending" || currentInvoiceStatus == "Placed") && onlineStatus == "Rejected") {
                    if (company.features?.map(f => f.toLowerCase()).includes('notifications')) {
                        invoice.onlineStatus = 'Rejected'
                        await publishEvent("invoiceRejected", { ...invoice, branchInfo })
                    }

                    if (hasOtherPayments) {
                        await SocketInvoiceRepo.creatCreditNote(client, invoice, company)
                    }

                    if (hasPoints) await PaymentRepo.refundPoints(client, invoice.id, company);
                    if (hasCoupon) await PaymentRepo.reActiveCoupon(client, invoice.id, company);

                }


                await client.query("COMMIT")
                return new ResponseData(true, "The status has been updated", { invoice: invoice, addJournal: addJournal })
            }

            await client.query("COMMIT")
            return new ResponseData(false, "No invoice with id = " + invoiceId, [])





            /**REFERESH INVENTORY + JOURNAL VIEW */
            // const queue = ViewQueue.getQueue();
            //queue.pushJob()
        } catch (error: any) {

            await client.query("ROLLBACK")


            throw new Error(error)
        } finally {
            client.release()
        }
    }






    /**GENERATE NEW INVOICE NUMBER */
    public static async getInvoiceNumber(client: PoolClient, branchId: string, company: Company) {
        try {
            const companyId = company.id;
            let prefixSettings = await TransactionManagements.getPrefix('Invoice', company.id)
            let prefix = prefixSettings.prefix
            let width = prefixSettings.width


            const query: { text: string, values: any[] } = {
                text: `
                SELECT "invoiceNumber"
                FROM "Invoices"
                WHERE "Invoices"."companyId" = $1
                  AND "invoiceNumber" LIKE $2
                  AND SUBSTRING("invoiceNumber" FROM LENGTH($3)+1) ~ '^[0-9]+$'  -- only numeric suffixes
                ORDER BY 
                  CAST(SUBSTRING("invoiceNumber" FROM LENGTH($3)+1) AS INT) DESC
                LIMIT 1
            `,
                values: [companyId, `${prefix}%`, prefix]
            };

            const data = await client.query(query.text, query.values);
            const lastNumber = data.rows && data.rows.length > 0 ? data.rows[0].invoiceNumber : null;
            let newNumber = TransactionManagements.getNumber(prefix, lastNumber, width)


            return new ResponseData(true, "", { invoiceNumber: newNumber });
        } catch (error: any) {

            throw new Error(error.message)
        }
    }
    public static async getInvoicePayment(client: PoolClient, invoiceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "InvoicePayments".* FROM "InvoicePayments" 
                                INNER JOIN "InvoicePaymentLines" on "invoicePaymentId" = "InvoicePayments".id where "invoiceId" = $1`,
                values: [invoiceId]
            }

            let payments = await client.query(query.text, query.values);
            let paymentList: any[] = []
            for (let index = 0; index < payments.rows.length; index++) {
                const payment: any = payments.rows[index];
                console.log(payment.id)
                query.text = `SELECT * FROM "InvoicePaymentLines" where "invoicePaymentId" =$1`;
                query.values = [payment.id]
                let lines = await client.query(query.text, query.values);

                payment.lines = lines.rows;
                console.log(payment.lines)
                paymentList.push(payment)
            }

            return paymentList;
        } catch (error: any) {


            throw new Error(error)
        }
    }


    public static async getInviceLineOptions(client: PoolClient, invoiceLineId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT * FROM "InvoiceLineOptions" where "invoiceLineId"=$1 `,
                values: [invoiceLineId]
            }
            let options = await client.query(query.text, query.values);
            return options.rows;
        } catch (error: any) {
            throw new Error(error);
        }
    }

    //TODO: REMOVE
    public static async sendEmail(data: any, company: Company) {
        try {

            let pdfGenerator = new PDFGenerator()
            data.type = "invoice"
            let pdfBuffer = await pdfGenerator.sendEmail(data, company);

            return pdfBuffer
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }
    // public static async sendWhatsapp(data: any, company: Company) {
    //     try {
    //         const client = await DB.excu.client();
    //         let token = ''
    //         let phoneID = '';
    //         let plugins = await PluginRepo.getPluginList({ "page": 1, "limit": 99, "searchTerm": "", "sortBy": {}, "type": "Aggregator" }, company)
    //         let whatsappPlugin = plugins.data.list.find((plugin: { pluginName: any; }) => plugin.pluginName == 'whatsApp')
    //         if (whatsappPlugin){


    //         }else{

    //             return "Whatsapp configuration not found"; 
    //         }


    //     } catch (error: any) {
    //         console.log(error);
    //         throw new Error(error)
    //     }
    // }









    public static async sendWhatsapp(data: any, company: Company) {
        try {


            let FileName = "";
            let link = "";
            let Data: any;
            switch (data.type) {
                case "invoice":
                    link = process.env.APP_BASE_URL + "/InvoicePdf/" + data.id;
                    Data = await InvoiceRepo.getInvoiceById(data.id, company);
                    FileName = Data.data.invoiceNumber;
                    break;
                case "PO":
                    link = process.env.APP_BASE_URL + "/POPdf/" + data.id;
                    Data = await PurchaseOrderRepo.getPurchaseOrderById(data.id, company);
                    FileName = Data.data.purchaseNumber;
                    break;
                case "bills":
                    link = process.env.APP_BASE_URL + "/billsPdf/" + data.id;
                    Data = await BillingRepo.getBillById(data.id, company);
                    FileName = Data.data.billingNumber;
                    break;
                case "billPayment":
                    link = process.env.APP_BASE_URL + "/billPaymentPdf/" + data.id;
                    Data = await BillingPaymentRepo.getBillingPaymentById(data.id, company.id);
                    FileName = "Bill Payment";
                    break;
                case "invoicePayment":
                    link = process.env.APP_BASE_URL + "/invoicePaymentPdf/" + data.id;
                    Data = await InvoicePaymentRepo.getInvoicePaymentById(data.id, company);
                    FileName = "Invoice Payment";
                    break;
                case "estimate":
                    link = process.env.APP_BASE_URL + "/estimatePdf/" + data.id;
                    Data = await EstimateRepo.getEstimateById(data.id, company);
                    FileName = Data.data.estimateNumber;
                    break;
                case "creditNote":
                    link = process.env.APP_BASE_URL + "/creditNotePdf/" + data.id;
                    Data = await CreditNoteRepo.getCreditNoteById(data.id, company);
                    FileName = Data.data.creditNoteNumber;
                    break;
                case "supplierCreditNote":
                    link = process.env.APP_BASE_URL + "/supplierCreditNotePdf/" + data.id;
                    Data = await SupplierCreditRepo.getSupplierCreditById(data.id, company);
                    FileName = Data.data.supplierCreditNumber;
                    break;
                case "expense":
                    link = process.env.APP_BASE_URL + "/expensePdf/" + data.id;
                    Data = await ExpenseRepo.getExpenseById(data.id, company.id);
                    FileName = "Expense";
                    break;
                case "BillOfEntry":
                    link = process.env.APP_BASE_URL + "/BillOfEntryPdf/" + data.id;
                    Data = await BillOfEntryRepo.getBillingEntryById(data.id, company);
                    FileName = "BillOfEntry";
                    break;
            }

            let token = ''
            const datac = company.id + '|+|' + data.id;
            const urlToken = btoa(datac);
            let phoneID = '';
            let plugins = await PluginRepo.getPluginList({ "page": 1, "limit": 99, "searchTerm": "", "sortBy": {}, "type": "Aggregator" }, company)
            let whatsappPlugin = plugins.data.list.find((plugin: { pluginName: any; }) => plugin.pluginName == 'Whatsapp Notifications');
            if (whatsappPlugin) {
                // If WhatsApp plugin is found, extract necessary information
                phoneID = whatsappPlugin.settings.PhoneId;
                token = whatsappPlugin.settings.Token;


                if ((whatsappPlugin.settings.PhoneId == "" || whatsappPlugin.settings.PhoneId == null) ||
                    (whatsappPlugin.settings.Token == "" || whatsappPlugin.settings.Token == null) ||
                    (!whatsappPlugin.settings.enable)
                ) {
                    throw new ValidationException("WhatsApp notification is not enabled")
                }
                // Prepare the message body
                let messageBody;
                if (data.type == "invoice") {
                    messageBody = {
                        "messaging_product": "whatsapp",
                        "to": data.phone,
                        "type": "template",
                        "template": {
                            "name": "invoice",
                            "language": {
                                "code": "en"
                            },
                            "components": [
                                {
                                    "type": "header",
                                    "parameters": [
                                        {
                                            "type": "document",
                                            "document": {
                                                "link": `${link}`,
                                                "filename": `${FileName}`
                                            }
                                        }
                                    ]
                                }, {
                                    "type": "BUTTON",
                                    "sub_type": "url",
                                    "index": "0",
                                    "parameters": [
                                        {
                                            "type": "text",
                                            "text": `${urlToken}`
                                        }
                                    ]
                                }
                            ]
                        }
                    };

                } else {
                    messageBody = {
                        "messaging_product": "whatsapp",
                        "to": data.phone,
                        "type": "template",
                        "template": {
                            "name": "non_invoice",
                            "language": {
                                "code": "en"
                            },
                            "components": [
                                {
                                    "type": "header",
                                    "parameters": [
                                        {
                                            "type": "document",
                                            "document": {
                                                "link": `${link}`,
                                                "filename": `${FileName}`
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    };
                }

                // Send the message using the obtained token
                const response = await fetch(`https://graph.facebook.com/v19.0/${phoneID}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(messageBody)
                });

                // Check if the message was sent successfully
                if (response.ok) {
                    return new ResponseData(true, "", "")
                } else {
                    throw new Error(`Failed to send WhatsApp message: ${response.statusText}`);
                }
            } else {
                return "WhatsApp configuration not found";
            }
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }















    public static async getPdf(data: any) {
        try {
            let pdfGenerator = new PDFGenerator()
            let pdfBuffer = await pdfGenerator.getPdf(data);
            return pdfBuffer
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }

    public static async deleteInvoiceLine(client: PoolClient, invoiceLineId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `DELETE FROM "InvoiceLines" where id =$1`,
                values: [invoiceLineId]
            }
            await client.query(query.text, query.values);

        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getReceivableAccounts(company: Company) {
        try {
            let types: string[] = ['Account Receivable'];
            let parentType: string[] = ['Current Assets']
            const query = {
                text: `SELECT id,name,code FROM "Accounts" where type = any($1) and "parentType"=any($2) and "companyId" =$3`,
                values: [types, parentType, company.id]
            }
            let accounts = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", { list: accounts.rows })
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getCustomerInvoicesForAllBranches(customerId: string, companyId: string) {
        try {


            const query: { text: string, values: any } = {
                text: `with "invoices" as (
                    select "Invoices".id , "total" , "Invoices"."invoiceDate","invoiceNumber" , "Invoices"."branchId", "Branches".name as "branchName"
                    from "Invoices"
                    inner join "Branches" on "Branches".id = "Invoices"."branchId"
                    where "Invoices"."customerId" = $1
                    and "Branches"."companyId" = $2
                    and "Invoices"."status" <>  'Draft' and "Invoices"."status" <>  'writeOff'
                    ),"payments" as(
                    select "invoices".id, sum( "InvoicePaymentLines"."amount"::text::numeric) as "amount" from "InvoicePaymentLines" inner join "invoices" on  "invoices"."id" = "InvoicePaymentLines"."invoiceId"
                    group by"invoices".id 
                    ),"credits" as(
                    select "invoices".id, sum( "CreditNotes"."total"::text::numeric) as "amount" from "CreditNotes" inner join "invoices" on  "invoices"."id" = "CreditNotes"."invoiceId"
                    group by"invoices".id 
                    ),"applyCredit" as(
                    select "invoices".id, sum( "AppliedCredits"."amount"::text::numeric) as "amount" from "AppliedCredits" inner join "invoices" on  "invoices"."id" = "AppliedCredits"."invoiceId"
                    group by"invoices".id 
                    ),"refunds" as(
					
					select "invoices".id, sum( "CreditNoteRefunds"."total"::text::numeric) as "amount" from "CreditNotes" 
						inner join "invoices" on  "invoices"."id" = "CreditNotes"."invoiceId"
						inner join "CreditNoteRefunds" ON "CreditNoteRefunds"."creditNoteId" = "CreditNotes"."id" 
						
                    group by"invoices".id 
					)
					
                    select 
                     "invoices".id  as "invoiceId",  "invoiceNumber",
                     "invoices"."invoiceDate",
                     "invoices"."branchId",
                     "invoices"."branchName", 
                     "total" ,
                     CAST( COALESCE("credits"."amount",0) +  COALESCE("payments"."amount",0) +  COALESCE("applyCredit"."amount",0)  AS REAL) as "paidAmount",
					 	 COALESCE("refunds"."amount",0)::float as "refunded"
                    from "invoices"
                    left join "payments" on "invoices"."id" = "payments".id
                    left join "credits" on "invoices"."id" = "credits".id
                    left join "applyCredit" on "invoices"."id" = "applyCredit".id
                    left join "refunds" on "invoices"."id" = "refunds".id
                    group by 
                     "invoices".id,
                       "invoices"."branchId", "invoices"."branchName", 
                       "total" ,
                     "invoices"."invoiceDate",
                     "invoiceNumber",
                     "payments"."amount",
                     "applyCredit"."amount",
                     "credits"."amount",
					     "refunds"."amount"
                    having ( "total"::text::numeric  - (COALESCE("payments"."amount",0)+COALESCE("applyCredit"."amount",0)+COALESCE("credits"."amount",0)) )+  COALESCE("refunds"."amount",0)  >0

                    `,
                values: [customerId, companyId]
            }
            const invoices = await DB.excu.query(query.text, query.values)


            //Get Customer opening balance 

            let customerBalance: any = await CustomerRepo.getCustomerOpeningBalance(customerId);
            if (customerBalance) {
                for (let index = 0; index < customerBalance.length; index++) {
                    const element = customerBalance[index];
                    let customerOpeningBalance: any = new InvoicePaymentLine();


                    customerOpeningBalance.invoiceNumber = "Opening Balance"
                    customerOpeningBalance.note = "Opening Balance"
                    customerOpeningBalance.openingBalanceId = element.id;
                    customerOpeningBalance.invoiceDate = element.createdAt
                    customerOpeningBalance.branchId = element.branchId
                    customerOpeningBalance.total = element.amount;
                    customerOpeningBalance.amount = 0
                    customerOpeningBalance.paidAmount = element.paidAmount;
                    customerOpeningBalance.branchName = element.branchName;
                    invoices.rows.push(customerOpeningBalance)
                }

            }

            return new ResponseData(true, "", invoices.rows)
        } catch (error: any) {


            throw new Error(error.message)
        }
    }

    public static async sendInvoiceForSignature(data: any, company: Company) {
        try {


            //########### Invoice Info ###########
            if (!data.invoiceId) { throw new ValidationException("The InvoiceId is required") }

            let query: { text: string, values: any } = {
                text: `SELECT "Invoices".id, "invoiceNumber" 
                        From "Invoices" 
                        join "Branches" on "Branches".id = "Invoices"."branchId"
                        where "Invoices".id = $1 and "Branches"."companyId" = $2`,
                values: [data.invoiceId, company.id]
            }

            const records = await DB.excu.query(query.text, query.values);
            if (!records.rows || records.rows.length < 0) {
                throw new ValidationException("Invoice does not exits")
            }
            let invoiceNumber = (<any>records.rows[0]).invoiceNumber ?? "";

            //########### invoice signature url ###########
            const accessToken = (await EinvoiceRepo.generateAccessToken({
                invoiceId: data.invoiceId,
                company: {
                    id: company.id
                }

            })).accessToken;

            let redirectUrl = process.env.CLOUD_BASE_URL + '/' + 'invoiceSign/' + accessToken



            if (data.email == null || data.email == "" || data.email == undefined) {
                return new ResponseData(true, "Signature request initiated successfully for the invoice " + invoiceNumber, { url: redirectUrl })
            }

            //########### company Info ###########
            query.text = `SELECT id, slug, name   FROM "Companies"  where "Companies".id =$1`,
                query.values = [company.id]

            let companyData = await DB.excu.query(query.text, query.values);
            let companyInfo = new Company();
            companyInfo.ParseJson(companyData.rows[0]);


            //########### Email Data ###########
            const subject = "invoice signature";
            //let token= btoa(company.id+'|+|'+data.invoiceId)


            const htmlContent =
                ` <p>Dear customer,</p>
                <p>${companyInfo.name} has sent an Invoice ${invoiceNumber} that requires your signature.</p>
                <p>Please click the link below to review the invoice and apply your signature.</p>
                <p>
                    <a href="${redirectUrl}", style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
                    Invoice
                    </a>
                </p>
            `
            let email = new SesService();
            email.subject = subject;
            email.sender = companyInfo.name + '<' + companyInfo.slug + '@invopos.co>'
            email.receivers.push(data.email);
            email.htmlContent = htmlContent
            let res = await email.sendHTMLEmail();


            if (res?.$metadata.httpStatusCode == 200) {
                return new ResponseData(true, "Signature request initiated successfully for the invoice " + invoiceNumber, { url: redirectUrl })
            }

            return new ResponseData(false, "Failed to initiatie Invoice e-signature request", {})


        } catch (error: any) {
            console.log(error);

            throw new Error(error)
        }
    }

    public static async saveInvoiceSignature(data: any, invoiceId: string, companyId: string) {
        try {

            // const query: { text: string, values: any } = {
            //     text: `select true as "isSigned" from "Invoices" where id= $1 "customerSignature" is not null `,
            //     values: [invoiceId]
            //   }

            //   const records = await DB.excu.query(query.text, query.values)
            //   if(records.rows && records.rows.length > 0){
            //      if ((<any>records.rows[0]).isSigned === true){ throw new ValidationException("This invoice already signed")}
            //   }


            if (data.base64Image && data.base64Image != "") {
                const types = data.base64Image.split(';')[0].split(',')[1].split(':')[0]
                const imageUrl = await S3Storage.uploadSignatureImage(invoiceId, data.base64Image, companyId, 'Customers')
                if (imageUrl) {
                    const signature = await this.setInvoiceSignatureURL(invoiceId, companyId, imageUrl)
                    if (signature) { return new ResponseData(true, "Invoice Signature had been added succcessfuly", signature) }
                }


                return new ResponseData(true, "Faild to add invoive signature", null)
            }
            return new ResponseData(true, "Faild to add invoive signature", null)


        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }

    public static async setInvoiceSignatureURL(invoiceId: string, companyId: string, imageUrl: string) {
        try {
            const query: { text: string, values: any } = {
                text: `UPDATE "Invoices" SET "customerSignature"=$1 where id=$2 returning "customerSignature" `,
                values: [imageUrl, invoiceId]
            }

            let records = await DB.excu.query(query.text, query.values)
            if (records.rows && records.rows.length > 0) {
                return (<any>records.rows[0]).customerSignature ?? null
            }

            return null
        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    public static async createInvoiceLink(invoiceId: String, companyId: string) {
        try {
            const datac = companyId + '|+|' + invoiceId;
            const urlToken = btoa(datac);
            let Payurl;

            switch (process.env.NODE_ENV) {
                case 'local':
                    Payurl = `http://localhost:4200/einvoice/${urlToken}`;
                    break;

                case 'development':
                    Payurl = `https://dev.invopos.co/einvoice/${urlToken}`;
                    break;

                case 'testing':
                    Payurl = `https://test.invopos.co/einvoice/${urlToken}`;
                    break;

                case 'production':
                    Payurl = `https://invopos.co/einvoice/${urlToken}`;
                    break;
            };
            return new ResponseData(true, "Invoice link created successfully", { url: Payurl })
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }

    public static async getInvoicesList222(data: any, company: Company, branchList: string[]) {
        try {
            const limit = data?.limit ?? 15;
            const page = data?.page ?? 1;
            const offset = (page - 1) * limit;

            const filter = data?.filter ?? {};

            // fallbacks
            const branches: string[] = (filter.branches?.length ? filter.branches : branchList) ?? [];
            const sources: string[] = filter.sources?.length
                ? filter.sources
                : ['POS', 'Online', 'Cloud', 'CallCenter'];
            const statuses: string[] = filter.status?.length
                ? filter.status
                : ['Open', 'Draft', 'writeOff', 'merged', 'Void', 'Closed', 'Paid', 'Partially Paid'];

            const searchTermRaw: string | null = (data.searchTerm ?? '').toString().trim() || null;

            // --- dynamic WHERE ---
            const where: string[] = ['i."companyId" = $1'];
            const params: any[] = [company.id];
            let p = 2;

            if (branches.length) {
                where.push(`i."branchId" = ANY($${p}::uuid[])`);
                params.push(branches);
                p++;
            }

            if (sources.length) {
                where.push(`i."source" = ANY($${p}::text[])`);
                params.push(sources);
                p++;
            }

            if (statuses.length) {
                where.push(`i.status = ANY($${p}::text[])`);
                params.push(statuses);
                p++;
            }

            // optional date range (use parameters, not string interpolation)
            if (filter.fromDate) {
                where.push(`i."invoiceDate"::date >= $${p}::date`);
                params.push(filter.fromDate);
                p++;
            }
            if (filter.toDate) {
                where.push(`i."invoiceDate"::date <= $${p}::date`);
                params.push(filter.toDate);
                p++;
            }

            // optional name/number search (ILIKE; safer than regex)
            // we’ll join names only if searching to keep the base fast.
            let joinForSearch = '';
            if (searchTermRaw) {
                const search = `%${searchTermRaw.toLowerCase()}%`;
                // add joins (LEFT to keep rows even if no related)
                joinForSearch = `
        LEFT JOIN "Customers" c ON c.id = i."customerId"
        LEFT JOIN "Employees" e ON e.id = i."employeeId"
        LEFT JOIN "Branches"  b ON b.id = i."branchId"
      `;
                where.push(`(
         LOWER(c.name) ILIKE $${p}
      OR LOWER(e.name) ILIKE $${p}
      OR LOWER(b.name) ILIKE $${p}
      OR LOWER(i."invoiceNumber")    ILIKE $${p}
      OR LOWER(i."refrenceNumber")   ILIKE $${p}
      OR LOWER(regexp_replace(i."invoiceNumber", '^[[:alpha:]]+-', '')) ILIKE $${p}
      )`);
                params.push(search);
                p++;
            }

            // ---------- ORDER BY (whitelist) ----------
            const sort = data?.sortBy;
            const defaultOrder = `i."invoiceDate" DESC, i."createdAt" DESC`; // index-friendly
            const allowedSortCols = new Set<string>([
                'invoiceDate', 'createdAt', 'invoiceNumber', 'refrenceNumber', 'total', 'status', 'source'
            ]);

            let orderClause = defaultOrder;

            if (sort?.sortValue && allowedSortCols.has(sort.sortValue)) {
                const dir = (sort.sortDirection?.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
                if (sort.sortValue === 'invoiceNumber') {
                    // numeric tail like ABC-12345 -> order by digits
                    orderClause =
                        ` COALESCE(NULLIF(regexp_substr(regexp_substr(i."invoiceNumber", '[_.+=-]\\d*$'), '\\d*$'),''), '0')::int ${dir}, i."createdAt" DESC `;
                } else {
                    orderClause = ` i."${sort.sortValue}" ${dir}, i."createdAt" DESC `;
                }
            }

            // ---------- Queries ----------
            // Top-N first (Invoices only + minimal joins), then fetch display columns
            const topSql = `
      WITH top_invoices AS (
        SELECT i.id, i."customerId", i."employeeId", i."branchId",
               i."invoiceDate", i."createdAt"
        FROM "Invoices" i
        ${joinForSearch}  -- only present when searching
        WHERE ${where.join(' AND ')}
          AND i.status <> 'Pending Payments'
        ORDER BY ${orderClause}
        LIMIT $${p} OFFSET $${p + 1}
      )
      SELECT i.id,
             i."customerContact",
             i."invoiceDate",
             i."invoiceNumber",
             i."refrenceNumber",
             i."source",
             i."branchId",
             i."total",
             i.status,
             i."onlineData",
             i."estimateId",
             i."mergeWith",
             c.name AS "customerName",
             e.name AS "employeeName",
             b.name AS "branchName",
             (i."createdAt"::timestamp::time) AS "time",
             i."createdAt"::timestamp,
             i."paymentTerm",
             i."dueDate",
             i."onlineActionTime"
      FROM top_invoices t
      JOIN "Invoices" i ON i.id = t.id
      LEFT JOIN "Customers" c ON c.id = i."customerId"
      LEFT JOIN "Employees" e ON e.id = i."employeeId"
      LEFT JOIN "Branches"  b ON b.id = i."branchId"
      ORDER BY ${orderClause};
    `;

            const topParams = [...params, limit, offset];

            // Counter: don’t join names unless searching requires it
            const countSql = `
      SELECT COUNT(*)::bigint AS cnt
      FROM "Invoices" i
      ${searchTermRaw ? `
        LEFT JOIN "Customers" c ON c.id = i."customerId"
        LEFT JOIN "Employees" e ON e.id = i."employeeId"
        LEFT JOIN "Branches"  b ON b.id = i."branchId"
      ` : ``}
      WHERE ${where.join(' AND ')}
        AND i.status <> 'Pending Payments'
    `;

            const [selectList, counter] = await Promise.all([
                DB.excu.query(topSql, topParams),
                DB.excu.query(countSql, params),
            ]);

            const list: InvoiceMini[] = selectList.rows.map((row: any) => {
                const inv = new InvoiceMini();
                inv.ParseJson(row);
                return getValuable(inv);
            });

            const count = Number(counter.rows?.[0]?.cnt ?? 0);
            const pageCnt = Math.ceil(count / limit) || 1;
            const startIndex = offset + 1;
            const lastIndex = Math.min(offset + selectList.rows.length, count);

            const resData = { list, count, pageCount: pageCnt, startIndex, lastIndex };
            return new ResponseData(true, "", resData);

        } catch (error: any) {
            throw new Error(error);
        }
    }

    public static async getInvoiceProductMovementDetails(invoiceId: string, companyId: string) {
        try {
            const query = {
                text: `with "invoice" as (
                            select $1::uuid as "invoiceId"
                            ),"productMovments" as (
                            select  "InvoiceLines"."invoiceId",
                                    "InvoiceLines".id,
                                    "InvoiceLines"."qty" as "lineQty",
                                "lineProduct"."name" as "lineProductName",
                                "Products".name as "productName",
                                "lineProduct".id as "lineProductId",
                                "InventoryMovmentRecords"."productId" as "movProductId",
                                "InventoryMovmentRecords"."referenceId",
                                "InventoryMovmentRecords"."qty",
                                "InventoryMovmentRecords"."cost",   
                                "InventoryMovmentRecords"."qty"*"InventoryMovmentRecords"."cost" as "totalCost" 
                                from "InvoiceLines"
                            inner join "Products" "lineProduct" on "lineProduct"."companyId" = $2 and "lineProduct".id = "InvoiceLines"."productId"
                            inner join "InventoryMovmentRecords" on "InventoryMovmentRecords"."companyId" = $2 and "InventoryMovmentRecords"."branchId" = "InvoiceLines"."branchId" and "InventoryMovmentRecords"."referenceId" = "InvoiceLines"."id"
                            inner join "Products" on "Products"."companyId" = $2 and "Products".id = "InventoryMovmentRecords"."productId"
                            where "InvoiceLines"."invoiceId" = ( select  "invoiceId"  from "invoice")
                            ), "summary" as 
                            (
                                select "productMovments".id,
                                    "productMovments"."invoiceId",
                                        "lineProductName","lineQty",
                                        sum("totalCost") as "totalCost",
                                        "lineProductId",
	                                     JSON_AGG(JSON_BUILD_OBJECT('productName', "productName",'qty',"qty",'cost',"cost",'totalCost',"totalCost",'productId',"movProductId"))  as "summary"
                                from "productMovments" 
                                group by    "lineProductId","productMovments".id,"productMovments"."invoiceId",      "lineProductName","lineQty"
                            ), "wastage" as(
                            select "invoiceId"	,
								    "waste",
								   "voidReason",
								     "productId",
								     sum("qty") as "qty",
							     	"Products"."name" as "productName",
								    "InvoiceLines"."createdAt"
								    from "InvoiceLines" 
                            inner join "Products" on "Products"."companyId" = $2 and "Products".id = "InvoiceLines"."productId"
                            where "invoiceId" = ( select  "invoiceId"  from "invoice")
                            and     "InvoiceLines"."qty" < 0 
                                group by "invoiceId","waste", "voidReason",  "productId","Products"."name",  "InvoiceLines"."createdAt"
                           ), "wastageSummary" as(
							select "invoiceId" ,
								     JSON_AGG(JSON_BUILD_OBJECT('waste',"waste", 'voidReason',"voidReason",
                                                    'productId',"productId",
                                                    'qty',"qty",
                                                    'productName',"productName",
                                                    'createdAt',"createdAt"))  as wastage 
								from "wastage"
								group by "invoiceId"
							)
                            select JSON_AGG(JSON_BUILD_OBJECT('lineId',"id", 'productId',"lineProductId",
                                                    'productName',"lineProductName",
                                                    'totalCost',"totalCost",
                                                    'lineQty',"lineQty",
                                                    'summary',"summary")) as "productMovements",
                                                      "wastageSummary"."wastage"::text::jsonb  as wastage 
                                                    from "invoice"
                            left join "summary" on "summary"."invoiceId" = "invoice"."invoiceId"
                            left join "wastageSummary" on "wastageSummary"."invoiceId" = "invoice"."invoiceId"
							group by "wastageSummary"."wastage"::text::jsonb
                            `,
                values: [invoiceId, companyId]
            }

            let report = await DB.excu.query(query.text, query.values);
            const retrunData: { productMovement: any, wastage: any[] | null } = {
                productMovement: null,
                wastage: null
            }
            if (report && report.rows && report.rows.length > 0) {
                const data = report.rows[0];
                const wastage = data.wastage;
                const movement = data.productMovements;
                retrunData.productMovement = movement
                retrunData.wastage = wastage
            }

            return new ResponseData(true, "", retrunData)
        } catch (error: any) {
            throw new Error(error)
        }
    }
}