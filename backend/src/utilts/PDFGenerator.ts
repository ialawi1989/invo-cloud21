import { promises as fs } from 'fs';
import path from "path";
import { SesService } from './SES';
import { ResponseData } from '@src/models/ResponseData';
import { InvoiceRepo } from '@src/repo/app/accounts/invoice.repo';
import { Company } from '@src/models/admin/company';
import { DB } from '@src/dbconnection/dbconnection';
import { FileStorage } from './fileStorage';
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { AWSLambda } from './lambda';
import { EstimateRepo } from '@src/repo/app/accounts/estimate.repo';
import { CreditNoteRepo } from '@src/repo/app/accounts/creditNote.Repo';
import { SupplierCreditRepo } from '@src/repo/app/accounts/supplierCredit.repo';
import { BillingRepo } from '@src/repo/app/accounts/billing.repo';
import { BillingPaymentRepo } from '@src/repo/app/accounts/billingPayment.repo';
import { InvoicePaymentRepo } from '@src/repo/app/accounts/invoicePayment.repo';
import { PurchaseOrderRepo } from '@src/repo/app/accounts/PurchaseOrder.Repo';
import { ExpenseRepo } from '@src/repo/app/accounts/expense.repo';
const probe: any = require('probe-image-size');
import { DocumentTemplate } from '@src/models/account/Builder';
import { CompanyRepo } from "@src/repo/admin/company.repo";
import { BillOfEntryRepo } from '@src/repo/app/accounts/billOfEntry.repo';
import { Helper } from './helper';
import { S3Storage } from './S3Storage';
import { getPdfDucument, IPdfDocument } from './pdf';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

export class PDFGenerator {

    constructor() {
    }

    public static async getCompanyFromInvoice(data: any) {
        try {

            let tableName = "";
            if (data.hasOwnProperty("invoiceId")) {
                tableName = "Invoices"
                data.id = data.invoiceId;
            }

            switch (data.type) {
                case "invoice":
                    tableName = "Invoices";
                    break;
                case "PO":
                    tableName = "PurchaseOrders";
                    break;
                case "bills":
                    tableName = "Billings";
                    break;
                case "billPayment":
                    tableName = "BillingPayments";
                    break;
                case "invoicePayment":
                    tableName = "InvoicePayments";
                    break;
                case "estimate":
                    tableName = "Estimates";
                    break;
                case "creditNote":
                    tableName = "CreditNotes";
                    break;
                case "supplierCreditNote":
                    tableName = "SupplierCredits";
                    break;
                case "expense":
                    tableName = "Expenses";
                    break;
                case "billOfEntry":
                    tableName = "BillOfEntries";
                    break;
            }

            const query: { text: string, values: any } = {
                text: `select 
                    c.id,
                    c.name,
                    c.country,
                    c."vatNumber",
                    m.url->>'defaultUrl || "https://www.invopos.com/wp-content/uploads/2024/06/cropped-logo-invo.png"',
                    c."invoiceOptions" as logo 
                    from "${tableName}" i 
                    inner join "Branches" b ON i."branchId" =b.id
                    inner join "Companies" c on b."companyId" = c.id 
                    LEFT JOIN "Media" m on c."mediaId"=m.id
                    where i.id = $1`,
                values: [data.id]
            }
            let companyData = await DB.excu.query(query.text, query.values);

            let company = new Company();
            company.ParseJson(companyData.rows[0]);
            console.log(company)
            console.log("companySettings")
            const storage = new FileStorage();
            let companySettings = await storage.getCompanySettings(company.country);

            let settings = companySettings?.settings;
            company.afterDecimal = settings.afterDecimal;
            company.currencySymbol = settings.currencySymbol;
            return company;

        } catch (error: any) {
            throw new Error(error)
        }
    }

    static isArabic(text: string) {
        return /[\u0600-\u06FF]/.test(text);
    }

    public static async InvoicePdfGenerator(invoiceId: any) {
        let company = await this.getCompanyFromInvoice({
            invoiceId: invoiceId,
            type: 'invoice'
        });
        return PDFGenerator.generatePDF(company, {
            type: 'invoice', transactionId: invoiceId, tableColumns: [
                { name: 'Order', value: 'order' },
                { name: 'Description', value: 'description' },
                { name: 'Qty', value: 'qty' },
                { name: 'Price', value: 'price' },
                { name: 'Tax Percantage', value: 'taxPercantage' },
                { name: 'Tax', value: 'tax' },
                { name: 'Discount', value: 'discount' },
                { name: 'Amount', value: 'amount' }
            ]
        })
    }


    public static async poPdfGenerator(id: any) {
        let company = await this.getCompanyFromInvoice({
            id: id,
            type: 'PO'
        });

        return PDFGenerator.generatePDF(company, {
            type: 'purchaseOrder', transactionId: id, tableColumns: [
                { name: 'Order', value: 'order' },
                { name: 'Product', value: 'product' },
                { name: 'Qty', value: 'qty' },
                { name: 'Tax Percantage', value: 'taxPercantage' },
                { name: 'Tax', value: 'tax' },
                { name: 'Unit Cost', value: 'unitCost' },
                { name: 'Total', value: 'total' }
            ]
        })
    }

    public static async billPdfGenerator(id: any) {
        let company = await this.getCompanyFromInvoice({
            id: id,
            type: 'bills'
        });

        return PDFGenerator.generatePDF(company, {
            type: 'bill', transactionId: id, tableColumns: [
                { name: 'Order', value: 'order' },
                { name: 'Description', value: 'description' },
                { name: 'UOM', value: 'uom' },
                { name: 'Qty', value: 'qty' },
                { name: 'Unit Cost', value: 'unitCost' },
                { name: 'Tax Percantage', value: 'taxPercantage' },
                { name: 'Tax', value: 'tax' },
                { name: 'Total', value: 'total' }
            ]
        })
    }

    public static async billPaymentPdfGenerator(id: any) {
        let company = await this.getCompanyFromInvoice({
            id: id,
            type: 'billPayment'
        });

        return PDFGenerator.generatePDF(company, {
            type: 'billPayment', transactionId: id, tableColumns: [
                { name: 'Order', value: 'order' },
                { name: 'Billing Number', value: 'billingNumber' },
                { name: 'Issue Date', value: 'issueDate' },
                { name: 'Reference', value: 'reference' },
                { name: 'Amount', value: 'amount' },
            ]
        })
    }

    public static async invoicePaymentPdfGenerator(id: any) {
        let company = await this.getCompanyFromInvoice({
            id: id,
            type: 'invoicePayment'
        });

        return PDFGenerator.generatePDF(company, {
            type: 'invoicePayment', transactionId: id, tableColumns: [
                { name: 'Order', value: 'order' },
                { name: 'Invoice Number', value: 'invoiceNumber' },
                { name: 'Paid On', value: 'paidOn' },
                { name: 'Invoice Amount', value: 'invoiceAmount' },
                { name: 'Payment Amount', value: 'paymentAmount' },
            ]
        })
    }


    public static async estimatePdfGenerator(id: any) {
        let company = await this.getCompanyFromInvoice({
            id: id,
            type: 'estimate'
        });

        return PDFGenerator.generatePDF(company, {
            type: 'estimate', transactionId: id, tableColumns: [
                { name: 'Order', value: 'order' },
                { name: 'Description', value: 'description' },
                { name: 'Qty', value: 'qty' },
                { name: 'Price', value: 'price' },
                { name: 'Tax Percantage', value: 'taxPercantage' },
                { name: 'Tax', value: 'tax' },
                { name: 'Discount', value: 'discount' },
                { name: 'Amount', value: 'amount' }
            ]
        })
    }

    public static async creditNotePdfGenerator(id: any) {
        let company = await this.getCompanyFromInvoice({
            id: id,
            type: 'creditNote'
        });

        return PDFGenerator.generatePDF(company, {
            type: 'creditNote', transactionId: id, tableColumns: [
                { name: 'Order', value: 'order' },
                { name: 'Description', value: 'description' },
                { name: 'Qty', value: 'qty' },
                { name: 'Price', value: 'price' },
                { name: 'Tax Percantage', value: 'taxPercantage' },
                { name: 'Tax', value: 'tax' },
                { name: 'Discount', value: 'discount' },
                { name: 'Amount', value: 'amount' }
            ]
        })
    }


    public static async supplierCreditNotePdfGenerator(id: any) {
        let company = await this.getCompanyFromInvoice({
            id: id,
            type: 'supplierCreditNote'
        });

        return PDFGenerator.generatePDF(company, {
            type: 'supplierCredit', transactionId: id, tableColumns: [
                { name: 'Order', value: 'order' },
                { name: 'Description', value: 'description' },
                { name: 'Qty', value: 'qty' },
                { name: 'Price', value: 'price' },
                { name: 'Tax Percantage', value: 'taxPercantage' },
                { name: 'Tax', value: 'tax' },
                { name: 'Amount', value: 'amount' }
            ]
        })
    }


    public static async expensePdfGenerator(id: any) {
        let company = await this.getCompanyFromInvoice({
            id: id,
            type: 'expense'
        });

        return PDFGenerator.generatePDF(company, {
            type: 'expense', transactionId: id, tableColumns: [
                { name: 'Order', value: 'order' },
                { name: 'Expense', value: 'expense' },
                { name: 'Amount', value: 'amount' },
                { name: 'Tax Percantage', value: 'taxPercantage' },
                { name: 'Tax', value: 'tax' },
                { name: 'Total', value: 'total' },
            ]
        })
    }


    public async getPdf(data: any) {
        try {
            let pdf;
            switch (data.type) {
                case "invoice":
                    pdf = await PDFGenerator.InvoicePdfGenerator(data.invoiceId);
                    break;
                case "PO":
                    pdf = await PDFGenerator.poPdfGenerator(data.purchaseOrderId);
                    break;
                case "bills":
                    pdf = await PDFGenerator.billPdfGenerator(data.billId);
                    break;
                case "billPayment":
                    pdf = await PDFGenerator.billPaymentPdfGenerator(data.billPaymentId);
                    break;
                case "invoicePayment":
                    pdf = await PDFGenerator.invoicePaymentPdfGenerator(data.invoicePaymentId);
                    break;
                case "estimate":
                    pdf = await PDFGenerator.estimatePdfGenerator(data.estimateId);
                    break;
                case "creditNote":
                    pdf = await PDFGenerator.creditNotePdfGenerator(data.creditNoteId);
                    break;
                case "supplierCreditNote":
                    pdf = await PDFGenerator.supplierCreditNotePdfGenerator(data.supplierCreditId);
                    break;
                case "expense":
                    pdf = await PDFGenerator.expensePdfGenerator(data.expenseId);
                    break;
                case "billOfEntry":
                    pdf = await PDFGenerator.billOfEntryPdfGenerator(data.billOfEntryId);
                    break;
                default:
                    pdf = await PDFGenerator.InvoicePdfGenerator(data.invoiceId);
                    break;
            }

            return await pdf;
        } catch (error: any) {
            console.log(error)
            throw new Error(error);
        }
    }


    public async sendEmail(info: any, company: Company) {
        try {
            let id: any;
            let companyData = (await (CompanyRepo.getCompanyPrefrences(company.id))).data;
            const datac = company.id + '|+|' + info.invoiceId;
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
            let fileData;
            let data: any;
            switch (info.type) {
                case "invoice":
                    id = info.invoiceId;
                    fileData = (await InvoiceRepo.getInvoiceById(id, company)).data
                    data = {
                        companyName: companyData.name,
                        companyAddress: fileData.branchAddress || "",
                        companySlug: companyData.slug,
                        companyCountryCode: companyData.settings.contryCode,
                        companyPhone: fileData.branchPhone || "",
                        attachmentName: 'Invoice ' + fileData.invoiceNumber,
                        customerName: fileData.customerName || "",
                        details: [
                            { label: 'Invoice Number:', value: fileData.invoiceNumber },
                            // { label: 'Date:', value: new Date(fileData.invoiceDate.includes('T') ? fileData.invoiceDate : fileData.invoiceDate + 'T00:00:00').toLocaleDateString('en-GB') },
                            { label: 'Date:', value: new Date(fileData.invoiceDate).toLocaleDateString('en-GB') },
                            { label: 'Amount:', value: `${companyData.settings.currencySymbol}` + ' ' + ` ${fileData.total.toFixed(3)}` },
                            // { label: 'Due Date:', value: new Date(fileData.dueDate.includes('T') ? fileData.dueDate : fileData.dueDate + 'T00:00:00').toLocaleDateString('en-GB') }
                            { label: 'Due Date:', value: new Date(fileData.dueDate).toLocaleDateString('en-GB') }
                        ],
                        withActionBox: true,
                        actionBox: `
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff9e6; border:1px solid #f0c674; border-radius:5px; padding:20px; text-align:center; margin:20px 0;">
    <tr>
        <td style="color:#b8860b; font-size:16px; padding-bottom:15px;">
        Please review the attached invoice and proceed with payment.
        </td>
    </tr>
    <tr>
        <td align="center">
        <a href="${Payurl}" style="padding:12px 24px; border:none; border-radius:5px; font-size:14px; font-weight:bold; text-decoration:none; background-color:#4ecdc4; color:white; display:inline-block;">
            💳 Pay Now
        </a>
        </td>
    </tr>
    </table>
                <div class="invoice-info" style="margin-bottom: 30px; font-size: 16px;">
                    Thank you for your business,<br>
    ${companyData.name}
                </div>
            </div>
            `,
                        pdf: (await PDFGenerator.InvoicePdfGenerator(id))?.toString()
                    }

                    break;
                case "PO":
                    id = info.purchaseOrderId;
                    fileData = (await PurchaseOrderRepo.getPurchaseOrderById(id, company)).data
                    data = {
                        companyName: companyData.name,
                        companyAddress: fileData.branchAddress || "",
                        companySlug: companyData.slug,
                        companyCountryCode: companyData.settings.contryCode,
                        companyPhone: fileData.branchPhone || "",
                        attachmentName: 'Purchase Order ' + fileData.purchaseNumber,
                        customerName: fileData.supplierName || "",
                        details: [
                            { label: 'Purchase Number:', value: fileData.purchaseNumber },
                            { label: 'Date:', value: new Date(fileData.purchaseDate).toLocaleDateString('en-GB') },
                            { label: 'Amount:', value: `${companyData.currencySymbol}` + ' ' + ` ${fileData.total.toFixed(3)}` },
                            { label: 'Due Date::', value: new Date(fileData.dueDate).toLocaleDateString('en-GB') },
                        ],
                        withActionBox: false,
                        actionBox: ``,
                        pdf: (await PDFGenerator.poPdfGenerator(id))
                    }
                    break;
                case "bills":
                    id = info.billId;
                    fileData = (await BillingRepo.getBillById(id, company)).data
                    let pdf = await PDFGenerator.billPdfGenerator(id)
                    // let pdf = pdfBuffer.toString('base64');
                    //     let pdfBuffer2 = pdf.toString();
                    //      const b64Size = (b64: string) => (b64.length - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0)) * 3 / 4;
                    //     const kib = (n: number) => (n / 1024).toFixed(1) + ' KiB';
                    //     const mib = (n: number) => (n / (1024 * 1024)).toFixed(2) + ' MiB';
                    //       console.warn('PDF bytes:', pdfBuffer.length, `(${mib(pdfBuffer.length)})`);
                    //      console.warn('PDF after base64:', pdfBuffer.length, `chars ≈ ${mib(b64Size(pdfBuffer))}`);
                    data = {
                        companyName: companyData.name,
                        companyAddress: fileData.branchAddress || "",
                        companySlug: companyData.slug,
                        companyCountryCode: companyData.settings.contryCode,
                        companyPhone: fileData.branchPhone || "",
                        attachmentName: 'Bill ' + fileData.billingNumber,
                        customerName: fileData.supplierName || "",
                        details: [
                            { label: 'Billing Number:', value: fileData.billingNumber },
                            { label: 'Date:', value: new Date(fileData.billingDate).toLocaleDateString('en-GB') },
                            { label: 'Amount:', value: `${companyData.currencySymbol}` + ' ' + ` ${fileData.total.toFixed(3)}` },
                            { label: 'Due Date::', value: new Date(fileData.dueDate).toLocaleDateString('en-GB') },
                        ],
                        withActionBox: false,
                        actionBox: ``,
                        pdf: pdf
                    }

                    break;
                case "BillOfEntry":
                    id = info.billOfEntryId;
                    fileData = (await BillOfEntryRepo.getBillingEntryById(id, company)).data;
                    data = {
                        companyName: companyData.name,
                        companyAddress: fileData.branchAddress || "",
                        companySlug: companyData.slug,
                        companyCountryCode: companyData.settings.contryCode,
                        companyPhone: fileData.branchPhone || "",
                        attachmentName: 'Bill of Entry ' + fileData.billingOfEnrtyNumber,
                        customerName: fileData.supplierName || "",
                        details: [
                            { label: 'Bill of Entry Number:', value: fileData.billingOfEnrtyNumber },
                            { label: 'Date:', value: new Date(fileData.billingOfEntryDate).toLocaleDateString('en-GB') },
                            { label: 'Amount:', value: `${companyData.settings.currencySymbol}` + ' ' + ` ${fileData.total.toFixed(3)}` },
                        ],
                        withActionBox: false,
                        actionBox: ``,
                        pdf: (await PDFGenerator?.billOfEntryPdfGenerator(id, fileData))//?.toString('base64')
                    }

                    break;
                case "billPayment":
                    id = info.billPaymentId;
                    fileData = (await BillingPaymentRepo.getBillingPaymentById(id, company.id)).data
                    data = {
                        companyName: companyData.name,
                        companyAddress: fileData.branchAddress || "",
                        companySlug: companyData.slug,
                        companyCountryCode: companyData.settings.contryCode,
                        companyPhone: fileData.branchPhone || "",
                        attachmentName: 'Bill Payments ',
                        customerName: fileData.supplierName || "",
                        details: [
                            { label: 'Date:', value: new Date(fileData.paymentDate).toLocaleDateString('en-GB') },
                            { label: 'Amount:', value: `${companyData.currencySymbol}` + ' ' + ` ${fileData.paidAmount.toFixed(3)}` },
                        ],
                        withActionBox: false,
                        actionBox: ``,
                        pdf: (await PDFGenerator?.billPaymentPdfGenerator(id))//?.toString('base64')
                    }

                    break;
                case "invoicePayment":
                    id = info.invoicePaymentId;
                    fileData = (await InvoicePaymentRepo.getInvoicePaymentById(id, company)).data
                    data = {
                        companyName: companyData.name,
                        companyAddress: fileData.branchAddress || "",
                        companySlug: companyData.slug,
                        companyCountryCode: companyData.settings.contryCode,
                        companyPhone: fileData.branchPhone || "",
                        attachmentName: 'Payment Receipt',
                        customerName: fileData.customerName || "",
                        details: [
                            { label: 'Date:', value: new Date(fileData.paymentDate).toLocaleDateString('en-GB') },
                            { label: 'Amount:', value: `${companyData.settings.currencySymbol}` + ' ' + ` ${fileData.paidAmount.toFixed(3)}` },
                        ],
                        withActionBox: false,
                        actionBox: ``,
                        pdf: (await PDFGenerator?.invoicePaymentPdfGenerator(id))//?.toString('base64')
                    }
                    break;
                case "estimate":

                    id = info.estimateId;
                    fileData = (await EstimateRepo.getEstimateById(id, company)).data
                    data = {
                        companyName: companyData.name,
                        companyAddress: fileData.branchAddress || "",
                        companySlug: companyData.slug,
                        companyCountryCode: companyData.settings.contryCode,
                        companyPhone: fileData.branchPhone || "",
                        attachmentName: 'Estimate ' + fileData.estimateNumber,
                        customerName: fileData.customerName || "",
                        details: [
                            { label: 'Estimate Number:', value: fileData.estimateNumber },
                            { label: 'Date:', value: new Date(fileData.estimateDate).toLocaleDateString('en-GB') },
                            { label: 'Amount:', value: `${companyData.settings.currencySymbol}` + ' ' + ` ${fileData.total.toFixed(3)}` },
                            { label: 'Estimate Expiry Date:', value: new Date(fileData.estimateExpDate).toLocaleDateString('en-GB') },
                        ],
                        withActionBox: true,
                        actionBox: `
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff9e6; border:1px solid #f0c674; border-radius:5px; padding:20px; text-align:center; margin:20px 0;">
    <tr>
        <td colspan="2" style="color:#b8860b; font-size:16px; padding-bottom:15px;">
        Please review the attached Estimate and proceed with Approval.
        </td>
    </tr>
    <tr>
        <td align="center">
        <a href="#" style="padding:12px 24px; border:none; border-radius:5px; font-size:14px; font-weight:bold; text-decoration:none; background-color:#4ecdc4; color:white; display:inline-block;">
            Approve
        </a>
        </td>
            <td align="center">
        <a href="#" style="padding:12px 24px; border:none; border-radius:5px; font-size:14px; font-weight:bold; text-decoration:none; background-color:#4ecdc4; color:white; display:inline-block;">
        Decline
        </a>
        </td>
    </tr>
    </table>
                <div class="invoice-info" style="margin-bottom: 30px; font-size: 16px;">
                    Thank you for your business,<br>
    ${companyData.name}
                </div>
            </div>
            `,
                        //   pdf: (await PDFGenerator?.estimatePdfGenerator(id))//?.toString('base64')
                        pdf: (await PDFGenerator?.estimatePdfGenerator(id))?.toString()
                    }
                    break;
                case "creditNote":

                    id = info.creditNoteId;
                    fileData = (await CreditNoteRepo.getCreditNoteById(id, company)).data
                    data = {
                        companyName: companyData.name,
                        companyAddress: fileData.branchAddress || "",
                        companySlug: companyData.slug,
                        companyCountryCode: companyData.settings.contryCode,
                        companyPhone: fileData.branchPhone || "",
                        attachmentName: 'Credit Note ' + fileData.creditNoteNumber,
                        customerName: fileData.customerName || "",
                        details: [
                            { label: 'Credit Note Number:', value: fileData.creditNoteNumber },
                            { label: 'Date:', value: new Date(fileData.creditNoteDate).toLocaleDateString('en-GB') },
                            { label: 'Amount:', value: `${companyData.settings.currencySymbol}` + ' ' + ` ${fileData.total.toFixed(3)}` },
                        ],
                        withActionBox: false,
                        actionBox: ``,
                        pdf: (await PDFGenerator?.creditNotePdfGenerator(id))//?.toString('base64')
                    }
                    break;
                case "supplierCreditNote":

                    id = info.supplierCreditId;
                    fileData = (await SupplierCreditRepo.getSupplierCreditById(id, company)).data
                    data = {
                        companyName: companyData.name,
                        companyAddress: fileData.branchAddress || "",
                        companySlug: companyData.slug,
                        companyCountryCode: companyData.settings.contryCode,
                        companyPhone: fileData.branchPhone || "",
                        attachmentName: 'Supplier Credit ' + fileData.supplierCreditNumber,
                        customerName: fileData.customerName || "",
                        details: [
                            { label: 'Supplier Credit Number:', value: fileData.supplierCreditNumber },
                            { label: 'Date:', value: new Date(fileData.supplierCreditDate).toLocaleDateString('en-GB') },
                            { label: 'Amount:', value: `${companyData.settings.currencySymbol}` + ' ' + ` ${fileData.total.toFixed(3)}` },
                        ],
                        withActionBox: false,
                        actionBox: ``,
                        pdf: (await PDFGenerator?.supplierCreditNotePdfGenerator(id)) ////?.toString('base64')
                    }
                    break;
                case "expense":

                    id = info.expenseId;
                    fileData = (await ExpenseRepo.getExpenseById(id, company.id)).data

                    data = {
                        companyName: companyData.name,
                        companyAddress: fileData.branchAddress || "",
                        companySlug: companyData.slug,
                        companyCountryCode: companyData.settings.contryCode,
                        companyPhone: fileData.branchPhone || "",
                        attachmentName: 'Supplier Credit ' + fileData.expenseNumber,
                        customerName: fileData.supplierName || "",
                        details: [
                            { label: 'Expense Number:', value: fileData.expenseNumber },
                            { label: 'Date:', value: new Date(fileData.expenseDate).toLocaleDateString('en-GB') },
                            { label: 'Amount:', value: `${companyData.settings.currencySymbol}` + ' ' + ` ${fileData.total.toFixed(3)}` },
                        ],
                        withActionBox: false,
                        actionBox: ``,
                        pdf: (await PDFGenerator?.expensePdfGenerator(id))////?.toString('base64')
                    }
                    break;

                default:
                    fileData = (await InvoiceRepo.getInvoiceById(id, company)).data
                    break;
            }




            const boundary = "NextPartBoundary";

            const rawEmail = [
                `From: "${data.companyName}" <${data.companySlug}@invopos.co>`,
                `To: ${info.emails}`,
                `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(data.attachmentName)))}?=`,
                `MIME-Version: 1.0`,
                `Content-Type: multipart/mixed; boundary="${boundary}"`,
                ``,
                `--${boundary}`,
                `Content-Type: text/html; charset=UTF-8`,
                `Content-Transfer-Encoding: 7bit`,
                ``,
                `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div class="email-container" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div class="header" style="background-color: #4ECDC4; color: white; padding: 30px; text-align: center;">
                <div class="logo" style="font-size: 16px;">${data.companyName}</div>
                <div class="invoice-title" style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">${data.attachmentName}</div>
            </div>
            
            <!-- Content -->
            <div class="content" style="padding: 30px; background-color: #f9f9f9;">
                <div class="greeting" style="margin-bottom: 20px; font-size: 16px;">Dear ${data.customerName},</div>
                
                <div class="invoice-info" style="margin-bottom: 30px; font-size: 16px;">
                    We hope this email finds you well. Please find attached your <a href="#" class="invoice-link" style="color: #4ECDC4; text-decoration: none;">${data.attachmentName}</a> from ${data.companyName}.
                </div>
                
                <!-- Invoice Details Box -->
            <div class="details-box" style="background-color: white; border: 1px solid #ddd; border-radius: 5px; padding: 20px; margin: 20px 0;">
        ${data.details.map((item: { label: string; value: any; }, index: number) => `
        <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: ${index === data.details.length - 1 ? '0' : '10px'}; padding: 5px 0;">
            <span class="detail-label" style="font-weight: normal; color: #666;">${item.label}</span>
            <span class="detail-value${item.label === 'Amount:' ? ' amount' : item.label === 'Due Date:' ? ' due-date' : ''}" style="font-weight: bold; color: #333;">${item.value}</span>
        </div>
        `).join('')}
    </div>
                
                
                <!-- Action Section -->

    ${data.withActionBox ? data.actionBox : ''}

            <!-- Footer -->
            <div class="footer" style="padding: 30px; background-color: white; border-top: 1px solid #eee;">
                <div class="footer-content" style="text-align: center; color: #666;">
                    <div class="company-name" style="font-weight: bold; color: #333; margin-bottom: 5px;">${data.companyName}</div>
                    <div class="company-address" style="font-size: 14px; margin-bottom: 10px;">${data.companyAddress}</div>
                    <div class="contact-info" style="font-size: 14px; margin-bottom: 15px;">
                    ${data.companyPhone ? `📞 +${data.companyCountryCode} ${data.companyPhone} • ` : ""}    🌐 <a href="${data.companySlug}.invopos.shop" style="color: #4ECDC4; text-decoration: none;">Website</a>
                    </div>
                    <div class="disclaimer" style="font-size: 12px; color: #999; font-style: italic;">
                        If you have any questions about this, please contact us using the information above.
                    </div>

                    <div class="disclaimer" style="font-size: 12px; color: #999; font-style: italic;">
                    -Powered by INVOPOS-
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
                `,
                ``,
                `--${boundary}`,
                `Content-Type: application/pdf; name="${data.attachmentName}"`,
                `Content-Description: ${data.attachmentName}`,
                `Content-Disposition: attachment; filename="${data.attachmentName}";`,
                `Content-Transfer-Encoding: base64`,
                ``,
                data.pdf,
                ``,
                `--${boundary}--`,
                ``,
            ].join("\r\n");


            const rawEmailData = new Uint8Array(Buffer.from(rawEmail));
            const params = {
                FromEmailAddress: `"${data.companyName}" <${data.companySlug}@invopos.co>`,
                Destination: {
                    ToAddresses: info.emails
                },
                Content: {
                    Raw: {
                        Data: rawEmailData
                    }
                }
            };

            console.log(params )
            const sesClient = new SESv2Client({
                region: process.env.AWS_REGION,
                credentials: {
                    accessKeyId: process.env.AWS_SNS_ACCESS_KEY || "",
                    secretAccessKey: process.env.AWS_SNS_SECRET_ACCESS_KEY || ""
                }
            });

            const command = new SendEmailCommand(params);
            const responce = await sesClient.send(command);

            return new ResponseData(true, "", [])




        } catch (error: any) {
            console.log(error)
            throw new Error(error);
        }



    }


    public static async billOfEntryPdfGenerator(id: any, info: any|null= null) {
        let company = await this.getCompanyFromInvoice({
            id: id,
            type: 'billOfEntry'
        });

        return PDFGenerator.generatePDF(company, {
            type: 'billOfEntry', transactionId: id, tableColumns: [
                { name: 'Description', value: 'description' },
                { name: 'Assessamble Value', value: 'assessambleValue' },
                { name: 'Custom Duty + Additional Charges', value: 'customDutyAdditionalCharges' },
                { name: 'Taxable Amount', value: 'taxableAmount' },
                { name: 'Tax', value: 'tax' },
            ]
        })
    }


    public static async companySetting(companyId: string, type: string) {
        try {
            const types = [type, 'branch']
            const query = {
                text: `with "custom" as ( select  c."name",c."mediaId", c."id", c."country", c."invoiceOptions", "Media".url as "mediaUrl", "CustomizationSettings"."settings" AS "customSetting"
                        from "Companies" c
                        left join "Media" on "Media".id = c."mediaId"
                        left join "CustomizationSettings" on "CustomizationSettings"."companyId" = c."id" and "CustomizationSettings".type = $2
                        where c.id = $1)
						,"branchSettings" as
						(select  "CustomizationSettings"."settings"  from "CustomizationSettings" where "companyId" = $1 and "type" = 'branch')
						select "custom".*, "branchSettings"."settings" as  "branchCustomSetting" from "custom"
						left join "branchSettings" on true `,
                values: [companyId, type]
            }
            const settings = await DB.exec.query(query.text, query.values)
            if (settings && settings.rows && settings.rows.length > 0) {
                return settings.rows[0]
            }
            return null
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async generatePDF(company: Company, data: pdFData) {
        try {
            const printer = getPdfDucument("pdfmake");

            let companySetting = await this.companySetting(company.id, data.type);
            let mediaName = companySetting && companySetting.mediaUrl && companySetting.mediaUrl.defaultUrl ? companySetting.mediaUrl.defaultUrl.split('/').pop() : null;
            const extension = mediaName ? mediaName.split('.')[1] : '';
            const logo = mediaName &&companySetting  ? (await S3Storage.getImageBase64Jpeg(companySetting.mediaId, company.id,extension)) : null //BASE64

            let companyName = companySetting && companySetting.name ? companySetting.name : null;

            let transactionData: any;
            let customFields;
            let branchCustomField: any;
            let builder: any;
            let footer = { note: '', term: '' }
            let taxTotal = 0;
            let isTaxed = false;
            let number: any = { label: null, name: null };
            let date: any = {
                createdDate: { label: null, name: null },
                invDate: { label: null, name: null },
                dueDate: { label: null, name: null }
            };
            let user: {
                name: { label: string | null, value: string | null },
                phone: { label: string | null, value: string | null },
                address: { label: string | null, value: string | null },
                vatnumber: { label: string | null, value: string | null },
                salesPerson: { label: string | null, value: string | null },
                customer: { label: string | null, value: string | null },
                employeeName: { label: string | null, value: string | null }
            } = {
                name: { label: null, value: null },
                phone: { label: null, value: null },
                address: { label: null, value: null },
                vatnumber: { label: null, value: null },
                salesPerson: { label: null, value: null },
                customer: { label: null, value: null },
                employeeName: { label: null, value: null }
            }
            let total: {
                itemTotal: string | null,
                taxTotal: string | null,
                discount: string | null,
                charge: string | null,
                delivery: string | null,
                subTotal: string | null,
                rounding: string | null,
                bankCharge: string | null,
                changeAmount: string | null,
                customDutyTotal: string | null,
                total: string | null,
            } = {
                itemTotal: '',
                taxTotal: '',
                discount: '',
                charge: '',
                delivery: '',
                subTotal: '',
                rounding: '',
                bankCharge: '',
                changeAmount: '',
                customDutyTotal: '',
                total: ''
            }
            let payment: {
                paymentMade: string | null,
                credit: string | null,
                balance: string | null,
                refundDue: string | null,
            } = {
                paymentMade: '',
                credit: '',
                balance: '',
                refundDue: ''
            }
            let billingNumber;
            let invoiceNumber;
            let refrenceNumber: string = '';
            let paymentMethodName;
            let amountReceived;
            let serviceName;
            let tableName;
            let tableGroupName;

            switch (data.type) {
                case "invoice":
                    transactionData = (await InvoiceRepo.getInvoiceById(data.transactionId, company)).data;
                    customFields = companySetting && companySetting.customSetting && companySetting.customSetting.customFields && companySetting.customSetting.customFields.length > 0 ? companySetting.customSetting.customFields : null
                    branchCustomField = companySetting && companySetting.branchCustomSetting && companySetting.branchCustomSetting.customFields && companySetting.branchCustomSetting.customFields.length > 0 ? companySetting.branchCustomSetting.customFields : null
                    const invoiceBuilder = companySetting && companySetting.customSetting && companySetting.customSetting.invoiceBuilder ? companySetting.customSetting.invoiceBuilder : null
                    builder = new DocumentTemplate('invoice')
                    builder.ParseJson(invoiceBuilder)

                    printer.setTemplate(builder);

                    //footer note
                    footer.note = companySetting && companySetting.invoiceOptions && companySetting.invoiceOptions.note && companySetting.invoiceOptions.note != '' ? companySetting.invoiceOptions.note : '';

                    //footer term
                    footer.term = companySetting && companySetting.invoiceOptions && companySetting.invoiceOptions.term && companySetting.invoiceOptions.term != '' ? companySetting.invoiceOptions.term : ''

                    //service name
                    serviceName = transactionData.serviceName 
                    tableName = transactionData.tableName 
                    tableGroupName = transactionData.tableGroupName 

                    //tax
                    taxTotal = transactionData.invoiceTaxTotal;
                    const hasTaxes = transactionData.lines.filter((f: any) => f.taxId)
                    isTaxed = hasTaxes && hasTaxes.length > 0
                    //refrenceNumber
                    refrenceNumber = transactionData.refrenceNumber

                    //customer name
                    user.name.label = builder.transactionalDetailsCustomization.customerName.show ? 'Bill to: ' : null;
                    user.name.value = builder.transactionalDetailsCustomization.customerName.show ? transactionData.customerName ?? 'WalkIn Customer' : null;


                    //customer phone
                    user.phone.label = builder.transactionalDetailsCustomization.customerPhone.show && transactionData.customerPhone ? 'Customer Phone: ' : null;
                    user.phone.value = builder.transactionalDetailsCustomization.customerPhone.show ? transactionData.customerPhone : null;

                    //customer address
                    const keys = ['city', 'block', 'building', 'road', 'flat'];
                    const addr = transactionData.customerAddress || {};

                    const hasAddressObject = JSON.stringify(addr) !== '{}';
                    const hasAnyRequiredKey = keys.some(k => addr[k]);
                    user.address.label = builder.transactionalDetailsCustomization.customerAddress.show && hasAddressObject && hasAnyRequiredKey ? 'Customer Address: ' : null;

                    user.address.value = builder.transactionalDetailsCustomization.customerAddress.show &&
                        hasAddressObject
                        && hasAnyRequiredKey ? keys
                            .filter(k => addr[k])
                            .map(k => `${k}: ${addr[k]}`)
                            .join(', ')
                        : null;

                    //customer vat number
                    user.vatnumber.label = builder.transactionalDetailsCustomization.vatNumber.show ? 'Customer Vat number: ' : null
                    user.vatnumber.value = builder.transactionalDetailsCustomization.vatNumber.show ? transactionData.customerVatNumber : null

                    //sales person
                    user.salesPerson.label = builder.transactionalDetailsCustomization.salesPerson.show && transactionData.salesEmployeeName ? 'Sales Person: ' : null;
                    user.salesPerson.value = builder.transactionalDetailsCustomization.salesPerson.show ? transactionData.salesEmployeeName : null;

                    //invoice number
                    number.label = builder.transactionalDetailsCustomization.invNumber.show ? 'Invoice Number: ' : null
                    number.name = builder.transactionalDetailsCustomization.invNumber.show ? transactionData.invoiceNumber : null

                    //Dates

                    //invoice created date 
                    date.createdDate.name = builder.transactionalDetailsCustomization.createdDate.show ? transactionData.createdAt : null

                    //dueDate 
                    date.dueDate.label = builder.transactionalDetailsCustomization.invoiceDueDate.show ? 'Invoice Due Date: ' : null
                    date.dueDate.name = builder.transactionalDetailsCustomization.invoiceDueDate.show ? transactionData.dueDate : null

                    //invoice date
                    date.invDate.label = builder.transactionalDetailsCustomization.invoiceDate.show ? 'Invoice Date: ' : null
                    date.invDate.name = builder.transactionalDetailsCustomization.invoiceDate.show ? transactionData.invoiceDate : null

                    //total
                    if (builder && builder.totalSectionCustomization && builder.totalSectionCustomization.totalTable && builder.totalSectionCustomization.totalTable.show) {
                        //item subTotal
                        total.itemTotal = builder.totalSectionCustomization.totalTable.itemTotal.show ? company.currencySymbol + ' ' + transactionData.itemSubTotal.toFixed(company.afterDecimal) : null;
                        //tax total
                        total.taxTotal = builder.totalSectionCustomization.totalTable.taxTotal.show ? company.currencySymbol + ' ' + transactionData.taxesDetails[0].total.toFixed(company.afterDecimal) : null;
                        //discount
                        total.discount = builder.totalSectionCustomization.totalTable.discount.show ? company.currencySymbol + ' ' + transactionData.discountTotal.toFixed(company.afterDecimal) : null;
                        //charge
                        total.charge = builder.totalSectionCustomization.totalTable.charge.show ? company.currencySymbol + ' ' + transactionData.chargeTotal.toFixed(company.afterDecimal) : null;
                        //delivery
                        total.delivery = builder.totalSectionCustomization.totalTable.delevary.show ? company.currencySymbol + ' ' + transactionData.deliveryCharge.toFixed(company.afterDecimal) : null;
                        //subTotal
                        total.subTotal = builder.totalSectionCustomization.totalTable.subTotal.show ? company.currencySymbol + ' ' + transactionData.subTotal.toFixed(company.afterDecimal) : null;
                        //rounding
                        total.rounding = builder.totalSectionCustomization.totalTable.roundingTotal.show ? company.currencySymbol + ' ' + transactionData.roundingTotal.toFixed(company.afterDecimal) : null;
                        //total
                        total.total = builder.totalSectionCustomization.totalTable.Total.show ? company.currencySymbol + ' ' + transactionData.total.toFixed(company.afterDecimal) : null;
                    }

                    //payment
                    if (builder && builder.totalSectionCustomization && builder.totalSectionCustomization.paymentTable && builder.totalSectionCustomization.paymentTable.show) {
                        //payment made
                        payment.paymentMade = builder.totalSectionCustomization.paymentTable.payments.show ? company.currencySymbol + ' ' + transactionData.paymentTotal.toFixed(company.afterDecimal) : null
                        //credit
                        payment.credit = builder.totalSectionCustomization.paymentTable.credit.show ? company.currencySymbol + ' ' + transactionData.appliedCredit.toFixed(company.afterDecimal) : null
                        //balance
                        payment.balance = builder.totalSectionCustomization.paymentTable.balance.show ? company.currencySymbol + ' ' + transactionData.balance.toFixed(company.afterDecimal) : null

                    }

                    break;
                case "bill":
                    transactionData = (await BillingRepo.getBillById(data.transactionId, company)).data;
                    customFields = companySetting && companySetting.customSetting && companySetting.customSetting.customFields && companySetting.customSetting.customFields.length > 0 ? companySetting.customSetting.customFields : null
                    branchCustomField = companySetting && companySetting.branchCustomSetting && companySetting.branchCustomSetting.customFields && companySetting.branchCustomSetting.customFields.length > 0 ? companySetting.branchCustomSetting.customFields : null
                    const billBuilder = companySetting && companySetting.customSetting && companySetting.customSetting.billBuilder ? companySetting.customSetting.billBuilder : null
                    builder = new DocumentTemplate('bill')
                    builder.ParseJson(billBuilder)
                    printer.setTemplate(builder);

                    //tax
                    taxTotal = transactionData.billingTaxTotal;

                    //bill number
                    number.label = builder.transactionalDetailsCustomization.billNumber.show ? 'Bill Number: ' : null
                    number.name = builder.transactionalDetailsCustomization.billNumber.show ? transactionData.billingNumber : null

                    //refrenceNumber
                    refrenceNumber = transactionData.reference

                    //supplier name
                    user.name.label = builder.transactionalDetailsCustomization.supplierName.show ? 'Supplier Name: ' : null;
                    user.name.value = builder.transactionalDetailsCustomization.supplierName.show ? transactionData.supplierName : null;

                    //supplier vat number
                    user.vatnumber.label = builder.transactionalDetailsCustomization.vatNumber.show && transactionData.supplierVatNumber != '' ? 'Vat number: ' : null
                    user.vatnumber.value = builder.transactionalDetailsCustomization.vatNumber.show ? transactionData.supplierVatNumber : null

                    //created date
                    date.createdDate.name = builder.transactionalDetailsCustomization.createdDate.show ? transactionData.createdAt : null

                    //due date
                    date.dueDate.label = builder.transactionalDetailsCustomization.billDueDate.show ? 'Due Date: ' : null
                    date.dueDate.name = builder.transactionalDetailsCustomization.billDueDate.show ? transactionData.dueDate : null

                    //bill date
                    date.invDate.label = builder.transactionalDetailsCustomization.billDate.show ? 'Issue Date: ' : null
                    date.invDate.name = builder.transactionalDetailsCustomization.billDate.show ? transactionData.billingDate : null

                    if (builder && builder.totalSectionCustomization && builder.totalSectionCustomization.totalTable && builder.totalSectionCustomization.totalTable.show) {
                        //item subTotal
                        total.itemTotal = builder.totalSectionCustomization.totalTable.itemTotal.show ? company.currencySymbol + ' ' + transactionData.itemSubTotal.toFixed(company.afterDecimal) : null;
                        //tax total
                        total.taxTotal = builder.totalSectionCustomization.totalTable.taxTotal.show ? company.currencySymbol + ' ' + transactionData.billingTaxTotal.toFixed(company.afterDecimal) : null;
                        //total
                        total.total = builder.totalSectionCustomization.totalTable.Total.show ? company.currencySymbol + ' ' + transactionData.total.toFixed(company.afterDecimal) : null;
                    }

                    //payment
                    if (builder && builder.totalSectionCustomization && builder.totalSectionCustomization.paymentTable && builder.totalSectionCustomization.paymentTable.show) {
                        //payment made
                        payment.paymentMade = builder.totalSectionCustomization.paymentTable.payments.show ? company.currencySymbol + ' ' + transactionData.paidAmount.toFixed(company.afterDecimal) : null
                        //credit
                        payment.credit = builder.totalSectionCustomization.paymentTable.credit.show ? company.currencySymbol + ' ' + transactionData.appliedCredit.toFixed(company.afterDecimal) : null
                        //balance
                        payment.balance = builder.totalSectionCustomization.paymentTable.balance.show ? company.currencySymbol + ' ' + transactionData.balance.toFixed(company.afterDecimal) : null

                    }

                    break;
                case "estimate":
                    transactionData = (await EstimateRepo.getEstimateById(data.transactionId, company)).data;
                    customFields = companySetting && companySetting.customSetting && companySetting.customSetting.customFields && companySetting.customSetting.customFields.length > 0 ? companySetting.customSetting.customFields : null
                    branchCustomField = companySetting && companySetting.branchCustomSetting && companySetting.branchCustomSetting.customFields && companySetting.branchCustomSetting.customFields.length > 0 ? companySetting.branchCustomSetting.customFields : null
                    const estimateBuilder = companySetting && companySetting.customSetting && companySetting.customSetting.estimateBuilder ? companySetting.customSetting.estimateBuilder : null
                    builder = new DocumentTemplate('estimate')
                    builder.ParseJson(estimateBuilder)
                    printer.setTemplate(builder);

                    taxTotal = transactionData.estimateTaxTotal;

                    //estimate number
                    number.label = builder.transactionalDetailsCustomization.billNumber.show ? 'Estimate Number: ' : null
                    number.name = builder.transactionalDetailsCustomization.billNumber.show ? transactionData.estimateNumber : null

                    //refrenceNumber
                    refrenceNumber = transactionData.refrenceNumber

                    //customer name
                    user.name.label = builder.transactionalDetailsCustomization.customerName.show ? 'Bill to: ' : null;
                    user.name.value = builder.transactionalDetailsCustomization.customerName.show ? transactionData.customerName ?? 'WalkIn Customer' : null;

                    //customer vat number
                    user.vatnumber.label = builder.transactionalDetailsCustomization.vatNumber.show && transactionData.customerVatNumber != '' ? 'Vat number: ' : null
                    user.vatnumber.value = builder.transactionalDetailsCustomization.vatNumber.show ? transactionData.customerVatNumber : null

                    //sales person
                    user.salesPerson.label = builder.transactionalDetailsCustomization.salesPerson.show && transactionData.salesEmployeeName ? 'Sales Person: ' : null;
                    user.salesPerson.value = builder.transactionalDetailsCustomization.salesPerson.show ? transactionData.salesEmployeeName : null;

                    //estimate created date //Thu Dec 11 2025 12:19:49 GMT+0300 (Arabian Standard Time)
                    date.createdDate.name = builder.transactionalDetailsCustomization.createdDate.show ? transactionData.createdAt : null

                    //estimate due date //'2026-01-10'
                    date.dueDate.label = builder.transactionalDetailsCustomization.estimateExpDate.show ? 'Estimate Expiry Date: ' : null
                    date.dueDate.name = builder.transactionalDetailsCustomization.estimateExpDate.show ? transactionData.estimateExpDate : null

                    //    
                    date.invDate.label = builder.transactionalDetailsCustomization.estimateDate.show ? 'Estimate Date: ' : null
                    date.invDate.name = builder.transactionalDetailsCustomization.estimateDate.show ? transactionData.estimateDate : null

                    if (builder && builder.totalSectionCustomization && builder.totalSectionCustomization.totalTable && builder.totalSectionCustomization.totalTable.show) {
                        //item subTotal
                        total.itemTotal = builder.totalSectionCustomization.totalTable.itemTotal.show ? company.currencySymbol + ' ' + transactionData.itemSubTotal.toFixed(company.afterDecimal) : null;
                        //tax total
                        total.taxTotal = builder.totalSectionCustomization.totalTable.taxTotal.show ? company.currencySymbol + ' ' + transactionData.estimateTaxTotal.toFixed(company.afterDecimal) : null;
                        //discount
                        total.discount = builder.totalSectionCustomization.totalTable.discount.show && transactionData.discountTotal ? company.currencySymbol + ' ' + transactionData.discountTotal.toFixed(company.afterDecimal) : null;
                        //charge
                        total.charge = builder.totalSectionCustomization.totalTable.charge.show ? company.currencySymbol + ' ' + transactionData.chargeTotal.toFixed(company.afterDecimal) : null;
                        //delivery
                        total.delivery = builder.totalSectionCustomization.totalTable.delevary.show ? company.currencySymbol + ' ' + transactionData.deliveryCharge.toFixed(company.afterDecimal) : null;
                        //subTotal
                        total.subTotal = builder.totalSectionCustomization.totalTable.subTotal.show ? company.currencySymbol + ' ' + transactionData.subTotal.toFixed(company.afterDecimal) : null;
                        //rounding
                        total.rounding = builder.totalSectionCustomization.totalTable.roundingTotal.show ? company.currencySymbol + ' ' + transactionData.roundingTotal.toFixed(company.afterDecimal) : null;
                        //total
                        total.total = builder.totalSectionCustomization.totalTable.Total.show ? company.currencySymbol + ' ' + transactionData.total.toFixed(company.afterDecimal) : null;
                    }

                    break
                case "expense":
                    transactionData = (await ExpenseRepo.getExpenseById(data.transactionId, company.id)).data;
                    customFields = companySetting && companySetting.customSetting && companySetting.customSetting.customFields && companySetting.customSetting.customFields.length > 0 ? companySetting.customSetting.customFields : null
                    branchCustomField = companySetting && companySetting.branchCustomSetting && companySetting.branchCustomSetting.customFields && companySetting.branchCustomSetting.customFields.length > 0 ? companySetting.branchCustomSetting.customFields : null
                    const expenseBuilder = companySetting && companySetting.customSetting && companySetting.customSetting.expenseBuilder ? companySetting.customSetting.expenseBuilder : null
                    builder = new DocumentTemplate('expense')
                    builder.ParseJson(expenseBuilder)
                    printer.setTemplate(builder);

                    //tax
                    //taxTotal = transactionData.billingTaxTotal;

                    //expense number
                    number.label = builder.transactionalDetailsCustomization.expenseNumber.show ? 'Expense Number: ' : null
                    number.name = builder.transactionalDetailsCustomization.expenseNumber.show ? transactionData.expenseNumber : null

                    //paymentMethodName
                    paymentMethodName = builder.transactionalDetailsCustomization.paymentMethodName.show ? transactionData.paymentMethodName : null;

                    //refrenceNumber
                    refrenceNumber = transactionData.referenceNumber

                    //customer name
                    user.customer.label = builder.transactionalDetailsCustomization.customerName.show ? 'Customer: ' : null;
                    user.customer.value = builder.transactionalDetailsCustomization.customerName.show ? transactionData.customerName : null;

                    //supplier name
                    user.name.label = builder.transactionalDetailsCustomization.supplierName.show ? 'Supplier Name: ' : null;
                    user.name.value = builder.transactionalDetailsCustomization.supplierName.show ? transactionData.supplierName : null;


                    //employee name
                    user.employeeName.label = builder.transactionalDetailsCustomization.employeeName.show ? 'Employees: ' : null;
                    user.employeeName.value = builder.transactionalDetailsCustomization.employeeName.show ? transactionData.employeeName : null;


                    date.createdDate.name = builder.transactionalDetailsCustomization.createdDate.show ? transactionData.createdAt : null

                    //expense date
                    date.invDate.label = builder.transactionalDetailsCustomization.expenseDate.show ? 'Expense Date: ' : null
                    date.invDate.name = builder.transactionalDetailsCustomization.expenseDate.show ? transactionData.expenseDate : null

                    if (builder && builder.totalSectionCustomization && builder.totalSectionCustomization.totalTable && builder.totalSectionCustomization.totalTable.show) {
                        //total
                        total.total = builder.totalSectionCustomization.totalTable.Total.show ? company.currencySymbol + ' ' + transactionData.total.toFixed(company.afterDecimal) : null;
                    }


                    break
                case "purchaseOrder":
                    transactionData = (await PurchaseOrderRepo.getPurchaseOrderById(data.transactionId, company)).data;
                    customFields = companySetting && companySetting.customSetting && companySetting.customSetting.customFields && companySetting.customSetting.customFields.length > 0 ? companySetting.customSetting.customFields : null
                    branchCustomField = companySetting && companySetting.branchCustomSetting && companySetting.branchCustomSetting.customFields && companySetting.branchCustomSetting.customFields.length > 0 ? companySetting.branchCustomSetting.customFields : null
                    const purchaseOrderBuilder = companySetting && companySetting.customSetting && companySetting.customSetting.purchaseOrderBuilder ? companySetting.customSetting.purchaseOrderBuilder : null
                    builder = new DocumentTemplate('purchaseOrder')
                    builder.ParseJson(purchaseOrderBuilder)
                    printer.setTemplate(builder);

                    //tax
                    taxTotal = transactionData.purchaseTaxTotal;

                    //purchase number
                    number.label = builder.transactionalDetailsCustomization.purchaseOrderNumber.show ? 'Purchase Number: ' : null
                    number.name = builder.transactionalDetailsCustomization.purchaseOrderNumber.show ? transactionData.purchaseNumber : null

                    //refrenceNumber
                    refrenceNumber = transactionData.reference

                    //supplier name
                    user.name.label = builder.transactionalDetailsCustomization.supplierName.show ? 'Supplier Name: ' : null;
                    user.name.value = builder.transactionalDetailsCustomization.supplierName.show ? transactionData.supplierName : null;

                    //po created date '
                    date.createdDate.name = builder.transactionalDetailsCustomization.createdDate.show ? transactionData.createdAt : null

                    //dueDate 
                    date.dueDate.label = builder.transactionalDetailsCustomization.purchaseOrderExpiryDate.show ? 'Expiry Date: ' : null
                    date.dueDate.name = builder.transactionalDetailsCustomization.purchaseOrderExpiryDate.show ? transactionData.dueDate : null

                    //po date 
                    date.invDate.label = builder.transactionalDetailsCustomization.purchaseOrderDate.show ? 'Issue Date: ' : null
                    date.invDate.name = builder.transactionalDetailsCustomization.purchaseOrderDate.show ? transactionData.purchaseDate : null

                    if (builder && builder.totalSectionCustomization && builder.totalSectionCustomization.totalTable && builder.totalSectionCustomization.totalTable.show) {
                        //total
                        total.total = builder.totalSectionCustomization.totalTable.Total.show ? company.currencySymbol + ' ' + transactionData.total.toFixed(company.afterDecimal) : null;
                    }

                    break;
                case "supplierCredit":
                    transactionData = (await SupplierCreditRepo.getSupplierCreditById(data.transactionId, company)).data;
                    //customFields = companySetting && companySetting.customSetting && companySetting.customSetting.customFields && companySetting.customSetting.customFields.length > 0 ? companySetting.customSetting.customFields : null
                    branchCustomField = companySetting && companySetting.branchCustomSetting && companySetting.branchCustomSetting.customFields && companySetting.branchCustomSetting.customFields.length > 0 ? companySetting.branchCustomSetting.customFields : null
                    //const purchaseOrderBuilder = companySetting && companySetting.customSetting && companySetting.customSetting.purchaseOrderBuilder ? companySetting.customSetting.purchaseOrderBuilder : null
                    builder = new DocumentTemplate('supplier-credit')
                    //builder.ParseJson(purchaseOrderBuilder)
                    printer.setTemplate(builder);

                    //Credit number
                    number.label = builder.transactionalDetailsCustomization.supplierCreditNumber.show ? 'Credit Number: ' : null
                    number.name = builder.transactionalDetailsCustomization.supplierCreditNumber.show ? transactionData.supplierCreditNumber : null

                    billingNumber = builder.transactionalDetailsCustomization.originalBill.show ? transactionData.billingNumber : null

                    //refrenceNumber
                    refrenceNumber = transactionData.reference

                    //supplier name
                    user.name.label = builder.transactionalDetailsCustomization.supplierName.show ? 'Supplier Name: ' : null;
                    user.name.value = builder.transactionalDetailsCustomization.supplierName.show ? transactionData.supplierName : null;

                    //supplier created date 
                    date.createdDate.name = builder.transactionalDetailsCustomization.createdDate.show ? transactionData.createdAt : null

                    //supplier date 
                    date.invDate.label = builder.transactionalDetailsCustomization.supplierCreditDate.show ? 'Supplier Credit Date: ' : null
                    date.invDate.name = builder.transactionalDetailsCustomization.supplierCreditDate.show ? transactionData.supplierCreditDate : null


                    if (builder && builder.totalSectionCustomization && builder.totalSectionCustomization.totalTable && builder.totalSectionCustomization.totalTable.show) {
                        //total
                        total.total = builder.totalSectionCustomization.totalTable.Total.show ? company.currencySymbol + transactionData.total.toFixed(company.afterDecimal) : null;
                    }

                    payment.refundDue = builder.totalSectionCustomization.paymentTable.refundDue.show ? company.currencySymbol + ' ' + Number(transactionData.refundDue).toFixed(company.afterDecimal) : null

                    break;
                case "creditNote":
                    transactionData = (await CreditNoteRepo.getCreditNoteById(data.transactionId, company)).data;
                    //customFields = companySetting && companySetting.customSetting && companySetting.customSetting.customFields && companySetting.customSetting.customFields.length > 0 ? companySetting.customSetting.customFields : null
                    branchCustomField = companySetting && companySetting.branchCustomSetting && companySetting.branchCustomSetting.customFields && companySetting.branchCustomSetting.customFields.length > 0 ? companySetting.branchCustomSetting.customFields : null
                    //const purchaseOrderBuilder = companySetting && companySetting.customSetting && companySetting.customSetting.purchaseOrderBuilder ? companySetting.customSetting.purchaseOrderBuilder : null
                    builder = new DocumentTemplate('credit-note')
                    //builder.ParseJson(purchaseOrderBuilder)
                    printer.setTemplate(builder);

                    //Credit number
                    number.label = builder.transactionalDetailsCustomization.creditNoteNumber.show ? 'Credit Note Number: ' : null
                    number.name = builder.transactionalDetailsCustomization.creditNoteNumber.show ? transactionData.creditNoteNumber : null


                    invoiceNumber = builder.transactionalDetailsCustomization.originalInvoice.show ? transactionData.invoiceNumber : null

                    //refrenceNumber
                    refrenceNumber = transactionData.refrenceNumber

                    //customer name
                    user.name.label = builder.transactionalDetailsCustomization.customerName.show ? 'Bill to: ' : null;
                    user.name.value = builder.transactionalDetailsCustomization.customerName.show ? transactionData.customerName ?? 'WalkIn Customer' : null;

                    //supplier created date 
                    date.createdDate.name = builder.transactionalDetailsCustomization.createdDate.show ? transactionData.createdAt : null

                    //supplier date 
                    date.invDate.label = builder.transactionalDetailsCustomization.creditNoteDate.show ? 'Credit Note Date: ' : null
                    date.invDate.name = builder.transactionalDetailsCustomization.creditNoteDate.show ? transactionData.creditNoteDate : null


                    //total
                    if (builder && builder.totalSectionCustomization && builder.totalSectionCustomization.totalTable && builder.totalSectionCustomization.totalTable.show) {
                        //item subTotal
                        total.itemTotal = builder.totalSectionCustomization.totalTable.itemTotal.show ? company.currencySymbol + ' ' + transactionData.itemSubTotal.toFixed(company.afterDecimal) : null;
                        //tax total
                        total.taxTotal = builder.totalSectionCustomization.totalTable.taxTotal.show ? company.currencySymbol + ' ' + transactionData.taxesDetails[0].total.toFixed(company.afterDecimal) : null;
                        //discount
                        total.discount = builder.totalSectionCustomization.totalTable.discount.show ? company.currencySymbol + ' ' + transactionData.discountTotal.toFixed(company.afterDecimal) : null;
                        //charge
                        total.charge = builder.totalSectionCustomization.totalTable.charge.show ? company.currencySymbol + ' ' + transactionData.chargeTotal.toFixed(company.afterDecimal) : null;
                        //delivery
                        total.delivery = builder.totalSectionCustomization.totalTable.delevary.show ? company.currencySymbol + ' ' + transactionData.deliveryCharge.toFixed(company.afterDecimal) : null;
                        //subTotal
                        total.subTotal = builder.totalSectionCustomization.totalTable.subTotal.show ? company.currencySymbol + ' ' + transactionData.subTotal.toFixed(company.afterDecimal) : null;
                        //rounding
                        total.rounding = builder.totalSectionCustomization.totalTable.roundingTotal.show ? company.currencySymbol + ' ' + transactionData.roundingTotal.toFixed(company.afterDecimal) : null;
                        //total
                        total.total = builder.totalSectionCustomization.totalTable.Total.show ? company.currencySymbol + ' ' + transactionData.total.toFixed(company.afterDecimal) : null;
                    }



                    break;
                case "invoicePayment":
                    transactionData = (await InvoicePaymentRepo.getInvoicePaymentById(data.transactionId, company, true)).data;
                    //customFields = companySetting && companySetting.customSetting && companySetting.customSetting.customFields && companySetting.customSetting.customFields.length > 0 ? companySetting.customSetting.customFields : null
                    branchCustomField = companySetting && companySetting.branchCustomSetting && companySetting.branchCustomSetting.customFields && companySetting.branchCustomSetting.customFields.length > 0 ? companySetting.branchCustomSetting.customFields : null
                    //const purchaseOrderBuilder = companySetting && companySetting.customSetting && companySetting.customSetting.purchaseOrderBuilder ? companySetting.customSetting.purchaseOrderBuilder : null
                    builder = new DocumentTemplate('invoicePayment')
                    //builder.ParseJson(purchaseOrderBuilder)
                    printer.setTemplate(builder);

                    //refrenceNumber
                    refrenceNumber = transactionData.referenceNumber

                    //payment date 
                    date.invDate.label = builder.transactionalDetailsCustomization.paymentDate.show ? 'Payment Date: ' : null
                    date.invDate.name = builder.transactionalDetailsCustomization.paymentDate.show ? transactionData.paymentDate : null

                    //customer name
                    user.name.label = builder.transactionalDetailsCustomization.customerName.show ? 'Received From: ' : null;
                    user.name.value = builder.transactionalDetailsCustomization.customerName.show ? transactionData.customerName : null;

                    //paymentMethodName
                    paymentMethodName = builder.transactionalDetailsCustomization.paymentMethodName.show ? transactionData.paymentMethodName : null;

                    amountReceived = builder.transactionalDetailsCustomization.amountReceived.show ? Number(transactionData.tenderAmount).toFixed(company.afterDecimal) : null;


                    //total
                    if (builder && builder.totalSectionCustomization && builder.totalSectionCustomization.totalTable && builder.totalSectionCustomization.totalTable.show) {
                        //item subTotal
                        total.bankCharge = builder.totalSectionCustomization.totalTable.bankCharge.show ? company.currencySymbol + ' ' + Number(transactionData.bankCharge).toFixed(company.afterDecimal) : null;
                        //tax total
                        total.changeAmount = builder.totalSectionCustomization.totalTable.changeAmount.show ? company.currencySymbol + ' ' + Number(transactionData.changeAmount).toFixed(company.afterDecimal) : null;
                        //total
                        total.total = builder.totalSectionCustomization.totalTable.Total.show ? company.currencySymbol + ' ' + Number(transactionData.paidAmount).toFixed(company.afterDecimal) : null;
                    }


                    break;
                case "billPayment":
                    transactionData = (await BillingPaymentRepo.getBillingPaymentById(data.transactionId, company.id, true)).data;
                    //customFields = companySetting && companySetting.customSetting && companySetting.customSetting.customFields && companySetting.customSetting.customFields.length > 0 ? companySetting.customSetting.customFields : null
                    branchCustomField = companySetting && companySetting.branchCustomSetting && companySetting.branchCustomSetting.customFields && companySetting.branchCustomSetting.customFields.length > 0 ? companySetting.branchCustomSetting.customFields : null
                    //const purchaseOrderBuilder = companySetting && companySetting.customSetting && companySetting.customSetting.purchaseOrderBuilder ? companySetting.customSetting.purchaseOrderBuilder : null
                    builder = new DocumentTemplate('billPayment')
                    //builder.ParseJson(purchaseOrderBuilder)
                    printer.setTemplate(builder);

                    //refrenceNumber
                    refrenceNumber = transactionData.referenceNumber

                    //payment date 
                    date.invDate.label = builder.transactionalDetailsCustomization.paymentDate.show ? 'Payment Date: ' : null
                    date.invDate.name = builder.transactionalDetailsCustomization.paymentDate.show ? transactionData.paymentDate : null

                    //supplier name
                    user.name.label = builder.transactionalDetailsCustomization.supplierName.show ? 'Paid For: ' : null;
                    user.name.value = builder.transactionalDetailsCustomization.supplierName.show ? transactionData.supplierName : null;

                    //paymentMethodName
                    paymentMethodName = builder.transactionalDetailsCustomization.paymentMethodName.show ? transactionData.paymentName : null;

                    amountReceived = builder.transactionalDetailsCustomization.amountReceived.show ? Number(transactionData.tenderAmount).toFixed(company.afterDecimal) : null;


                    //total
                    if (builder && builder.totalSectionCustomization && builder.totalSectionCustomization.totalTable && builder.totalSectionCustomization.totalTable.show) {
                        //total
                        total.total = builder.totalSectionCustomization.totalTable.Total.show ? company.currencySymbol + ' ' + transactionData.paidAmount.toFixed(company.afterDecimal) : null;
                    }
                    break;

                case "billOfEntry":
                    transactionData = (await BillOfEntryRepo.getBillingEntryById(data.transactionId, company)).data;
                    //customFields = companySetting && companySetting.customSetting && companySetting.customSetting.customFields && companySetting.customSetting.customFields.length > 0 ? companySetting.customSetting.customFields : null
                    branchCustomField = companySetting && companySetting.branchCustomSetting && companySetting.branchCustomSetting.customFields && companySetting.branchCustomSetting.customFields.length > 0 ? companySetting.branchCustomSetting.customFields : null
                    //const purchaseOrderBuilder = companySetting && companySetting.customSetting && companySetting.customSetting.purchaseOrderBuilder ? companySetting.customSetting.purchaseOrderBuilder : null
                    builder = new DocumentTemplate('billOfEntry')
                    //builder.ParseJson(purchaseOrderBuilder)
                    printer.setTemplate(builder);

                    //refrenceNumber
                    refrenceNumber = transactionData.reference

                    //bill of entry number
                    number.label = builder.transactionalDetailsCustomization.billOfEntryNumber.show ? 'Bill Of Entry Number: ' : null
                    number.name = builder.transactionalDetailsCustomization.billOfEntryNumber.show ? transactionData.billingOfEnrtyNumber : null

                    //bill number
                    billingNumber = builder.transactionalDetailsCustomization.originalBill.show ? transactionData.billingNumber : null

                    //supplier name
                    user.name.label = builder.transactionalDetailsCustomization.supplierName.show ? 'Supplier Name: ' : null;
                    user.name.value = builder.transactionalDetailsCustomization.supplierName.show ? transactionData.supplierName : null;

                    //supplier created date 
                    date.createdDate.name = builder.transactionalDetailsCustomization.createdDate.show ? transactionData.createdAt : null

                    //supplier date 
                    date.invDate.label = builder.transactionalDetailsCustomization.billOfEntryDate.show ? 'Issue Date: ' : null
                    date.invDate.name = builder.transactionalDetailsCustomization.billOfEntryDate.show ? transactionData.billingOfEntryDate : null

                    //total
                    if (builder && builder.totalSectionCustomization && builder.totalSectionCustomization.totalTable && builder.totalSectionCustomization.totalTable.show) {
                        //item subTotal
                        // total.itemTotal = builder.totalSectionCustomization.totalTable.itemTotal.show ? company.currencySymbol + ' ' + transactionData.itemSubTotal.toFixed(3) : null;
                        //duty
                        total.customDutyTotal = builder.totalSectionCustomization.totalTable.customDutyTotal.show ? company.currencySymbol + ' ' + transactionData.customDutyTotal.toFixed(company.afterDecimal) : null;
                        //tax total
                        total.taxTotal = builder.totalSectionCustomization.totalTable.taxTotal.show ? company.currencySymbol + ' ' + transactionData.taxTotal.toFixed(company.afterDecimal) : null;
                        //total
                        total.total = builder.totalSectionCustomization.totalTable.Total.show ? company.currencySymbol + ' ' + transactionData.total.toFixed(company.afterDecimal) : null;
                    }

                    break;
                default:
                    break;
            }

            const templateData = {
                data: data,
                logo: logo,
                company: company,
                companyName: companyName,
                transactionData: transactionData,
                customFields: customFields,
                branchCustomField: branchCustomField,
                footer: footer,
                taxTotal: taxTotal,
                isTaxed: isTaxed,
                number: number,
                refrenceNumber: refrenceNumber,
                date: date,
                user: user,
                total: total,
                payment: payment,
                paymentMethodName: paymentMethodName,
                billingNumber: billingNumber,
                invoiceNumber: invoiceNumber,
                amountReceived: amountReceived,
                serviceName:serviceName,
                tableName:tableName,
                tableGroupName:tableGroupName
            }

            printer.setData(templateData);

            const pdfDoc = await printer.generatePdfBase64()
            return pdfDoc

        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }

}
interface pdFData {
    transactionId: string,
    type: string,
    tableColumns: { "value": string, name: string }[]
}