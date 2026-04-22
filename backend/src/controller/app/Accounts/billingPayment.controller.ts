
import { ResponseData } from '@src/models/ResponseData';
import { BillingPaymentRepo } from '@src/repo/app/accounts/billingPayment.repo';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { SupplierBalanceQueue } from '@src/repo/triggers/userBalancesQueue';
import { PDFGenerator } from '@src/utilts/PDFGenerator';
import { ViewQueue } from '@src/utilts/viewQueue';
import { Request, Response, NextFunction } from 'express';
export class BillingPaymentController {
    public static async saveBillingPayment(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;

            const employeeId = res.locals.user;
            const data = req.body;
            let resault;
            let billingIds = [];
            if (data.lines && data.lines.length > 0) {
                billingIds = data.lines.map((f: any) => { if (f.billingId) return f.billingId })
            }

            if (data.id == null || data.id == "") {
                resault = await BillingPaymentRepo.addBillingPayment(data, company, employeeId)
            } else {
                resault = await BillingPaymentRepo.editBillingPayment(data, company, employeeId)
            }

            const queue = ViewQueue.getQueue();
            queue.pushJob()

            if (resault.success) {
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "BillingPayments", id: resault.data.id, companyId: company.id })
                if (billingIds.length > 0) {
                    queueInstance.createJob({ type: "updateBillStatus", ids: billingIds, companyId: company.id })
                }
                if (data.supplierId) {
                    let userBalancesQueue = SupplierBalanceQueue.getInstance();
                    userBalancesQueue.createJob({ userId: data.supplierId, dbTable: 'BillingPayments' })
                }

            }

            

            return res.send(resault)
        } catch (error: any) {

                 throw error
        }
    }


        public static async getBillpaymentPdf(req: Request, res: Response, next: NextFunction) {
            try {
    
                const company = res.locals.company;
    
                const pdfBuffer = await PDFGenerator.billPaymentPdfGenerator(req.params.id)
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

    public static async deleteBillPayment(req: Request, res: Response, next: NextFunction) {
        try {

            const billPaymentId = req.params.billPaymentId;
            const company = res.locals.company;

            const employeeId = res.locals.user;
            let resault = await BillingPaymentRepo.deleteBillPayment(billPaymentId, company, employeeId)

            const queue = ViewQueue.getQueue();
            queue.pushJob()

            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ type: "DeleteJournal", referenceId: billPaymentId, dbTable: 'billPayment', ids: resault.data.ids })
            if (resault.data.billingIds.length > 0) {
                queueInstance.createJob({ type: "updateBillStatus", ids: resault.data.billingIds, companyId: company.id })
                if (resault.data.supplierId) {
                    let userBalancesQueue = SupplierBalanceQueue.getInstance();
                    userBalancesQueue.createJob({ userId: resault.data.supplierId, dbTable: 'BillingPayments' })
                }
            }
            return res.send(resault)
        } catch (error: any) {

                 throw error
        }
    }
    public static async getBillingPaymentList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const branches = res.locals.branches
            const billingPayments = await BillingPaymentRepo.getBillingPaymentLists(data,company,branches)
            return  res.send(billingPayments)
        }catch (error:any) {
            
              throw error
        }
    }
    public static async getBillingPaymentById(req: Request, res: Response, next: NextFunction) {
        try {
            const billingPaymentId = req.params.billingPaymentId;
            const companyId = res.locals.companyId;
            const billingPayments = await BillingPaymentRepo.getBillingPaymentById(billingPaymentId,companyId)
            return  res.send(billingPayments)
        }catch (error:any) {
            
              throw error
        }
    }

    public static async getBillingPaymentJournal(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const billingPaymentId = req.params.billingPaymentId;
            const journal = await BillingPaymentRepo.getBillingPaymentJournal(billingPaymentId, company);
            return res.send(journal)
        } catch (error: any) {

                 throw error
        }
    }

    public static async sendBillPaymentEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const pdfBuffer = await BillingPaymentRepo.sendEmail(data, company)

            // Send the PDF buffer as the response
            res.send(pdfBuffer);

            // res.send (pdfBuffer)
        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }
    public static async viewBillPaymentPdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                billPaymentId: req.params.billPaymentId
            }
            const company = res.locals.company;

            const pdfBuffer = await BillingPaymentRepo.getPdf(data, company)

            // Send the PDF buffer as the response
            res.send(new ResponseData(true, "", pdfBuffer));

            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }
}