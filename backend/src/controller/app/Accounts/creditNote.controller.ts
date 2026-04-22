import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { CompanyRepo } from '@src/repo/admin/company.repo';
import { AppliedCreditRepo } from '@src/repo/app/accounts/appliedCredit.repo';
import { CreditNoteRepo } from '@src/repo/app/accounts/creditNote.Repo';
import { CustomerRepo } from '@src/repo/app/accounts/customer.repo';
import { InvoicePaymentRepo } from '@src/repo/app/accounts/invoicePayment.repo';
import { InvoiceStatuesQueue } from '@src/repo/triggers/queue/workers/invoiceStatus.worker';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { CustomerBalanceQueue } from '@src/repo/triggers/userBalancesQueue';
import { PDFGenerator } from '@src/utilts/PDFGenerator';
import { ViewQueue } from '@src/utilts/viewQueue';
import { Request, Response, NextFunction } from 'express';
import { result } from 'lodash';
import { PoolClient } from 'pg';
interface ExtendedPoolClient extends PoolClient {
    lastQuery?: string;
    _released: Boolean,
}
export class CreditNoteController {
    public static async addCreditNote(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            const employeeId = res.locals.user;
            const company = res.locals.company;
            const data = req.body;
            data.employeeId = employeeId;
            let resault: any;
            await CompanyRepo.validateTransactionDate(client, data.creditNoteDate, data.branchId, company.id)

            if (data.id == null || data.id == "") {
                resault = await CreditNoteRepo.addNewCreditNote(client, data, company);
            } else {
                return res.send();
                // resault = await CreditNoteRepo.editCreditNote(data, company, employeeId);
            }
            await client.query("COMMIT")

            const queue = ViewQueue.getQueue();
            queue.pushJob()
            if (resault.success) {
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "CreditNotes", invoiceId: [resault.data.invoiceId], id: [resault.data.id], companyId: company.id })
                // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [resault.data.invoiceId] })
                InvoiceStatuesQueue.get().createJob({
                    id: resault.data.invoiceId
                } as any);

                queueInstance.createJob({ journalType: "Movment", type: "creditNote", id: [resault.data.id] })


                let userBalancesQueue = CustomerBalanceQueue.getInstance();
                userBalancesQueue.createJob({ userId: data.customerId, dbTable: 'CreditNotes' })

            }

            return res.send(resault);
        } catch (error: any) {

            await client.query("ROLLBACK")

                 throw error
        } finally {
            // let isReleased = client.release; // Check the `released` property
            // console.log(`Client released: ${isReleased}`);
            client.release()

        }
    }




    public static async getcreditNotePdf(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;

            const pdfBuffer = await PDFGenerator.creditNotePdfGenerator(req.params.id)
            // res.send(pdfBuffer);
            // Send the PDF buffer as the response
            // return res.send(new ResponseData(true, "", pdfBuffer));
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename=invoice_${req.params.id}.pdf`);
            res.send(pdfBuffer); // Not res.json
            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }


    public static async getCreditNoteById(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params['branchId'];
            const creditNoteId = req.params['creditNoteId']
            const company = res.locals.company;
            const creditNote = await CreditNoteRepo.getCreditNoteById(creditNoteId, company);
            return res.send(creditNote);
        } catch (error: any) {

                 throw error
        }
    }


    public static async getCreditNotes(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body
            const branches = res.locals.branches;
            const list = await CreditNoteRepo.getCreditNoteList(data, company, branches);
            return res.send(list);
        } catch (error: any) {

                 throw error
        }
    }

    public static async getInvoicesForCreditNote(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const branchId = req.params.branchId;
            const customerId = req.params.customerId;
            const list = await CreditNoteRepo.getCustomerInvoicesForCreditNote(branchId, customerId);
            return res.send(list);
        } catch (error: any) {

                 throw error
        }
    }

    public static async getCreditNoteNumber(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const branchId = req.params.branchId;

            const number = await CreditNoteRepo.getCreditNoteNumber(branchId, company);
            return res.send(number);
        } catch (error: any) {

                 throw error
        }
    }

    public static async getCreditNoteInvoice(req: Request, res: Response, next: NextFunction) {
        try {

            const data = req.body
            const companyId = res.locals.companyId;
            const invoice = await CreditNoteRepo.getCreditNoteInvoice(data, companyId);
            return res.send(invoice);
        } catch (error: any) {

                 throw error
        }
    }


    //appliedCredit

    public static async saveAppliedCredit(req: Request, res: Response, next: NextFunction) {
        try {

            const data = req.body
            const company = res.locals.company;
            const employeeId = res.locals.user;
            let total = 0;
            data.forEach((element: any) => {
                total += element.amount
            });

            /**
             * Data is array of applied credits 
             * using cutsomer prepaid expenses credit Or credit note balance 
             * 
             * when using prepaid expense -> insert as payment 
             * when creditNote Balance -> insert as apply credit 
             * 
             * element.reference = 'creditNote' -> apply credit 
             * element.reference = 'invoicePayment' -> invoice Payment
             * 
             * element.id -> depending on reference us either invoicePaymentId or creditNoteId
             */
            let queueInstance = TriggerQueue.getInstance();
            let userBalancesQueue = CustomerBalanceQueue.getInstance();

            let invoiceId;
            for (let index = 0; index < data.length; index++) {
                const element = data[index];
                element.employeeId = employeeId;
                let resault;
                invoiceId = element.invoiceId
                if (element.amount > 0) {
                    if (element.reference == "creditNote") {
                        resault = await AppliedCreditRepo.saveApplyCredit(element, company);
                        queueInstance.createJob({ type: "AppliedCredits", id: resault.data.id, companyId: company.id })
                        userBalancesQueue.createJob({ transactionId: resault.data.id, dbTable: 'AppliedCredits' })

                    } else if (element.reference == "invoicePayment") {
                        resault = await InvoicePaymentRepo.applyInvoicePaymentUnearnedRevenue(element, company)
                        queueInstance.createJob({ type: "InvoicePayments", id: [element.id], companyId: company.id })
                        userBalancesQueue.createJob({ transactionId: resault.data.id, dbTable: 'InvoicePayments' })

                    }
                }
            }
            const queue = ViewQueue.getQueue();
            queue.pushJob()

            // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [invoiceId] })
            InvoiceStatuesQueue.get().createJob({
                id: invoiceId
            } as any);

            return res.send(new ResponseData(true, "", []));
        } catch (error: any) {

                 throw error
        }
    }

    public static async getApplyCreditList(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const resault = await AppliedCreditRepo.getAppliedCreditList(company);
            return res.send(resault);
        } catch (error: any) {

                 throw error
        }
    }

    public static async getCreditNoteJournal(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const creditNoteId = req.params.creditNoteId;
            const resault = await CreditNoteRepo.getCreditNoteJournal(creditNoteId, company);

            return res.send(resault);
        } catch (error: any) {

                 throw error
        }
    }

    public static async getCustomerCreditsList(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const customerId = req.params.customerId;
            const resault = await AppliedCreditRepo.getCustomerCreditsList(customerId,company.id);
            return res.send(resault);
        } catch (error: any) {

                 throw error
        }
    }
    public static async getCustomerApplyCreditInvoices(req: Request, res: Response, next: NextFunction) {
        try {


            const company = res.locals.company;
            const customerId = req.params.customerId;
            const resault = await AppliedCreditRepo.getCustomerInvoices(customerId);
            return res.send(resault);
        } catch (error: any) {

                 throw error
        }
    }

    public static async deleteCreditNote(req: Request, res: Response, next: NextFunction) {
        try {
            const creditNoteId = req.params.creditNoteId;
            const company = res.locals.company;
            const employeeId = res.locals.user
            const resData = await CreditNoteRepo.deleteCreditNote(creditNoteId, company, employeeId)


            if (resData.success) {
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "DeleteJournal", referenceId: creditNoteId })

                if (resData.data.invoiceId) {
                    // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [resData.data.invoiceId] })
                    InvoiceStatuesQueue.get().createJob({
                        id: resData.data.invoiceId
                    } as any);
                }

                queueInstance.createJob({ journalType: "Movment", type: "Delete", ids: resData.data.ids })
                if (resData.data.customerId) {
                    let userBalancesQueue = CustomerBalanceQueue.getInstance();
                    userBalancesQueue.createJob({ userId: resData.data.customerId, dbTable: 'CreditNotes' })
                }

            }

            return res.send(new ResponseData(true, "", []))

        } catch (error: any) {

                 throw error
        }
    }

    public static async sendCreditNoteEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const pdfBuffer = await CreditNoteRepo.sendEmail(data, company)


            // Send the PDF buffer as the response
            return res.send(pdfBuffer);

            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }
    public static async viewCrediteNotePdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                creditNoteId: req.params.creditNoteId
            }
            const company = res.locals.company;

            const pdfBuffer = await CreditNoteRepo.getPdf(data, company)

            // Send the PDF buffer as the response
            return res.send(new ResponseData(true, "", pdfBuffer));

            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }
    public static async deleteAppliedCredit(req: Request, res: Response, next: NextFunction) {
        try {
            const appliedCreditId = req.params.appliedCreditId;
            const company = res.locals.company
            const employeeId = res.locals.user
            const resData = await AppliedCreditRepo.deleteAppliedCredit(appliedCreditId, company, employeeId)


            if (resData.success) {
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "DeleteJournal", referenceId: appliedCreditId })

                if (resData.data.invoiceId) {
                    // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [resData.data.invoiceId] })
                    InvoiceStatuesQueue.get().createJob({
                        id: resData.data.invoiceId
                    } as any);
                }

                let userBalancesQueue = CustomerBalanceQueue.getInstance();
                userBalancesQueue.createJob({ transactionId: appliedCreditId, dbTable: 'AppliedCredits' })
            }

            return res.send(new ResponseData(true, "", []))

        } catch (error: any) {

                 throw error
        }
    }

}