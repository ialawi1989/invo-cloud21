import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { InvoiceRepo } from '@src/repo/app/accounts/invoice.repo';
import { InvoicePaymentRepo } from '@src/repo/app/accounts/invoicePayment.repo';
import { SoketInvoicePayment } from '@src/repo/socket/invoicePayment.socket';
import { InvoiceStatuesQueue } from '@src/repo/triggers/queue/workers/invoiceStatus.worker';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { CustomerBalanceQueue } from '@src/repo/triggers/userBalancesQueue';
import { PDFGenerator } from '@src/utilts/PDFGenerator';
import { ViewQueue } from '@src/utilts/viewQueue';
import { Request, Response, NextFunction } from 'express';
export class InvoicePaymentController {

    public static async addInvoicePayment(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            const company = res.locals.company;
            const employeeId = res.locals.user;
            const data = req.body;
            let resault;
            if (data.id == null || data.id == "") {
                data.employeeId = employeeId

                resault = await InvoicePaymentRepo.addInvoicePayment(client, data, company)
            } else {
                resault = await InvoicePaymentRepo.editInvoicePayment(client, data, company, employeeId)
            }

            await client.query("COMMIT")
            const queue = ViewQueue.getQueue();
            queue.pushJob()

            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ type: "InvoicePayments", invoiceIds: resault.data.invoiceIds, id: [resault.data.id], companyId: company.id })
            if (resault.data.invoiceIds && resault.data.invoiceIds.length > 0) {
                resault.data.invoiceIds.forEach((element: any) => {
                    InvoiceStatuesQueue.get().createJob({
                        id: element
                    } as any);

                });
            }
            let userBalancesQueue = CustomerBalanceQueue.getInstance();
            userBalancesQueue.createJob({ transactionId: resault.data.id, dbTable: 'InvoicePayments' })

            return res.send(resault)
        } catch (error: any) {
            await client.query("ROLLBACK")


                throw error
        } finally {
            client.release()
        }

    }




    public static async getInvoicepaymentPdf(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;

            const pdfBuffer = await PDFGenerator.invoicePaymentPdfGenerator(req.params.id)
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








    public static async deleteInvoicePayment(req: Request, res: Response, next: NextFunction) {

        try {

            const invoicePaymentId = req.params.invoicePaymentId;
            const company = res.locals.company;
            const employeeId = res.locals.user;
            // const invoiceIds = await InvoicePaymentRepo.getPaymentInvoiceIds(invoicePaymentId);
            // const ids = await InvoicePaymentRepo.getPaymentLinesIds(invoicePaymentId);
            // eslint-disable-next-line prefer-const

            let resault = await InvoicePaymentRepo.deleteInvoicePayments(invoicePaymentId, company, employeeId)

            const queue = ViewQueue.getQueue();
            queue.pushJob()
            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ type: "DeleteJournal", referenceId: invoicePaymentId, ids: resault.data.ids })
            if (resault.data.invoiceIds.length > 0) {

                // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: resault.data.invoiceIds })
                if (resault.data.invoiceIds && resault.data.invoiceIds.length > 0) {
                    resault.data.invoiceIds.forEach((element: any) => {
                        InvoiceStatuesQueue.get().createJob({
                            id: element
                        } as any);
                    });
                }

                if (resault.data.customerId) {
                    let userBalancesQueue = CustomerBalanceQueue.getInstance();
                    userBalancesQueue.createJob({ userId: resault.data.customerId, dbTable: 'InvoicePayments' })

                }
            }

            return res.send(resault)
        } catch (error: any) {

                throw error
        }
    }
    public static async getInvoicePaymentsList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const list = await InvoicePaymentRepo.getInvoicePaymentsList(data, company, branches);
            return res.send(list)
        } catch (error: any) {

                throw error
        }
    }
    public static async getInvoicePaymentById(req: Request, res: Response, next: NextFunction) {
        try {
            const invoicePaymentId = req.params['invoicePaymentId'];
            const company = res.locals.company;
            const invoicePayment = await InvoicePaymentRepo.getInvoicePaymentById(invoicePaymentId, company);

            return res.send(invoicePayment)
        } catch (error: any) {

                throw error
        }
    }
    public static async getInvoiceBalance(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const invoiceId = req.params.invoiceId;
            const invoices = await InvoiceRepo.getInvoiceBalance(client, invoiceId)
            await client.query("COMMIT")

            return res.send(invoices)

        } catch (error: any) {
            await client.query("ROLLBACK")
                throw error
        } finally {
            client.release()
        }
    }
    public static async getInvoicePaymentJournals(req: Request, res: Response, next: NextFunction) {
        try {
            const invoicePaymentId = req.params.invoicePaymentId;
            const company = res.locals.company;
            const invoices = await InvoicePaymentRepo.getInvoicePaymentJournal(invoicePaymentId, company)
            return res.send(invoices)
        } catch (error: any) {

                throw error
        }
    }


    public static async getPosInvoicePayment(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.body.branchId;
            const invoiceIds = req.body.invoiceIds;
            const invoices = await SoketInvoicePayment.getInvoicePayment(branchId, invoiceIds)
            return res.send(invoices)
        } catch (error: any) {

                throw error
        }
    }

    public static async sendInvoicePaymentEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const pdfBuffer = await InvoicePaymentRepo.sendEmail(data, company)

            // Send the PDF buffer as the response
            return res.send(pdfBuffer);

            // res.send (pdfBuffer)
        } catch (error: any) {
            console.log(error);
                throw error
        }
    }
    public static async viewInvoicePaymentPdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                invoicePaymentId: req.params.invoicePaymentId
            }
            const company = res.locals.company;

            const pdfBuffer = await InvoicePaymentRepo.getPdf(data, company)

            // Send the PDF buffer as the response
            return res.send(new ResponseData(true, "", pdfBuffer));

            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                throw error
        }
    }


}