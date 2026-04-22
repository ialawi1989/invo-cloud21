
import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { Company } from '@src/models/admin/company';
import { CompanyRepo } from '@src/repo/admin/company.repo';
import { AccountsRepo } from '@src/repo/app/accounts/account.repo';
import { BillingRepo } from '@src/repo/app/accounts/billing.repo';
import { purchaseOrderStatuesQueue } from '@src/repo/triggers/queue/workers/purchaseOrder.worker';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { SupplierBalanceQueue } from '@src/repo/triggers/userBalancesQueue';
import { PDFGenerator } from '@src/utilts/PDFGenerator';
import { ViewQueue } from '@src/utilts/viewQueue';
import { Request, Response, NextFunction } from 'express';
export class BillingController {

    public static async saveBilling(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            const company = res.locals.company;
            const employeeId = res.locals.user;
            const data = req.body;
            let resault;
            await client.query("BEGIN")

            await CompanyRepo.validateTransactionDate(client, data.billingDate, data.branchId, company.id)

            if (data.id != null && data.id != "") {
                resault = await BillingRepo.editBilling(client, data, company, employeeId)
            } else {
                resault = await BillingRepo.addBilling(client, data, company, employeeId)
            }

            await AccountsRepo.addAccountIfNotExist(client, "Purchase Discounts", company.id, null)
            await client.query("COMMIT")


            const queue = ViewQueue.getQueue();
            queue.pushJob()

            if (resault.success) {
                if (data.status != 'Draft') {
                    let queueInstance = TriggerQueue.getInstance();
                    queueInstance.createJob({ type: "Billings", id: resault.data.id, companyId: company.id })
                    queueInstance.createJob({ type: "updateBillStatus", ids: [resault.data.id], companyId: company.id })
                    queueInstance.createJob({ journalType: "Movment", type: "billing", id: resault.data.id, deleteLines: resault.data.deletedLines })
                    queueInstance.createJob({ journalType: "Movment", type: "DeleteCost", ids: resault.data.deletedLines ?? [] })

                    if (data.supplierId) {
                        let userBalancesQueue = SupplierBalanceQueue.getInstance();
                        userBalancesQueue.createJob({ userId: data.supplierId, dbTable: 'Billings' })
                    }

                    if (data.purchaseOrderId) {
                        purchaseOrderStatuesQueue.get().createJob({
                            id: data.purchaseOrderId
                        } as any);
                    }
                }
            }




            return res.send(resault)
        } catch (error: any) {
            await client.query("ROLLBACK")

                 throw error
        } finally {
            client.release()
        }
    }

    public static async deleteBilling(req: Request, res: Response, next: NextFunction) {
        try {

            const billId = req.params.billId;
            const company = res.locals.company;
            const user = res.locals.user;


            let resault = await BillingRepo.deleteBill(billId, company, user)


            const queue = ViewQueue.getQueue();
            queue.pushJob()


            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ type: "DeleteJournal", referenceId: billId })
            queueInstance.createJob({ journalType: "Movment", type: "DeleteCost", ids: resault.data.ids, reference: 'Billing', referenceId: billId })

            if (resault.data.supplierId) {
                let userBalancesQueue = SupplierBalanceQueue.getInstance();
                userBalancesQueue.createJob({ userId: resault.data.supplierId, dbTable: 'Billings' })
            }

            if (resault.data.purchaseOrderId) {
                purchaseOrderStatuesQueue.get().createJob({
                    id: resault.data.purchaseOrderId
                } as any);
            }

            return res.send(new ResponseData(true, "", []))
        } catch (error: any) {

                 throw error
        }
    }


    public static async getBillPdf(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;

            //        const pdfBuffer = await PDFGenerator.billPdfGenerator(req.params.id)
            const pdfBuffer = await PDFGenerator.billPdfGenerator(req.params.id)

            // res.send(pdfBuffer);
            // Send the PDF buffer as the response
            // return res.send(new ResponseData(true, "", pdfBuffer));
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename=invoice_${req.params.id}.pdf`);
            res.send(pdfBuffer); // Not res.json
            // res.send (pdfBuffer)

            //  let chunks: Buffer[] = [];
            //  pdfDoc.on("data", (chunk:any) => {
            //     chunks.push(chunk)
            //  })


            //  pdfDoc.on("end", () => {
            //     const result = Buffer.concat(chunks);

            //     res.setHeader("Content-Type", "application/pdf");
            //     res.setHeader("Content-Disposition", "inline; filename=example.pdf");

            //     res.send(result);
            // });

            // pdfDoc.end();



        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }





    public static async getBillingsList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;

            const list = await BillingRepo.getBillingsList(data, company, branches)
            return res.send(list)
        } catch (error: any) {

                 throw error
        }
    }
    public static async getBillingById(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const billingId = req.params.billId;
            const company = res.locals.company;
            const bill = await BillingRepo.getBillingById(client, billingId, company)
            await client.query("COMMIT")

            return res.send(bill)
        } catch (error: any) {
            await client.query("ROLLBACK")

                 throw error
        } finally {
            client.release()
        }
    }


    public static async getBillForPayment(req: Request, res: Response, next: NextFunction) {
        try {
            const billId = req.params.billId;
            const payment = await BillingRepo.getBillForPayment(billId);
            return res.send(payment)
        } catch (error: any) {

                 throw error
        }
    }
    public static async getBillingNumber(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params.branchId;
            const company = res.locals.company;
            const number = await BillingRepo.getBillingNumber(branchId, company);
            return res.send(number)
        } catch (error: any) {

                 throw error
        }
    }

    public static async getBillingJournals(req: Request, res: Response, next: NextFunction) {
        try {
            const billingId = req.params.billingId;
            const company = res.locals.company;
            const number = await BillingRepo.getBillingJournal(billingId, company);
            return res.send(number)
        } catch (error: any) {

                 throw error
        }
    }

    public static async saveOpenBill(req: Request, res: Response, next: NextFunction) {
        try {
            const billingId = req.params.billingId;
            const company = res.locals.company;
            const employeeId = res.locals.user;
            const resData = await BillingRepo.saveOpenBill(billingId, company, employeeId);

            const queue = ViewQueue.getQueue();
            queue.pushJob()

            if (resData.success) {
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "Billings", id: billingId, companyId: company.id })
                queueInstance.createJob({ journalType: "Movment", type: "billing", id: billingId })

                let userBalancesQueue = SupplierBalanceQueue.getInstance();
                userBalancesQueue.createJob({ transactionId: billingId, dbTable: 'Billings' })
                if (resData.data.purchaseOrderId) {
                    purchaseOrderStatuesQueue.get().createJob({
                        id: resData.data.purchaseOrderId
                    } as any);
                }

            }

            return res.send(resData)
        } catch (error: any) {

                 throw error
        }
    }

    public static async sendBillEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const pdfBuffer = await BillingRepo.sendEmail(data, company)

            // Send the PDF buffer as the response
            res.send(pdfBuffer);

            // res.send (pdfBuffer)
        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }
    public static async viewBillPdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                billId: req.params.billId
            }
            const company = res.locals.company;

            const pdfBuffer = await BillingRepo.getPdf(data, company)

            // Send the PDF buffer as the response
            res.send(new ResponseData(true, "", pdfBuffer));

            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }


    public static async getPayableAccounts(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const accounts = await BillingRepo.getPayableAccounts(company)

            // Send the PDF buffer as the response
            return res.send(accounts);
        } catch (error: any) {
                 throw error
        }
    }



    public static async getProductPurchaseHistory(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body
            const accounts = await BillingRepo.getProductPurchaseHistory(data, company)

            // Send the PDF buffer as the response
            return res.send(accounts);
        } catch (error: any) {
                 throw error
        }
    }

}