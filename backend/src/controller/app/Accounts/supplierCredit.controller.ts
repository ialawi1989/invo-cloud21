import { ResponseData } from '@src/models/ResponseData';
import { BillingRepo } from '@src/repo/app/accounts/billing.repo';
import { SupplierCreditRepo } from '@src/repo/app/accounts/supplierCredit.repo';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { SupplierBalanceQueue } from '@src/repo/triggers/userBalancesQueue';
import { PDFGenerator } from '@src/utilts/PDFGenerator';
import { ViewQueue } from '@src/utilts/viewQueue';
import { Request, Response, NextFunction } from 'express';
export class SupplierCreditController {

    public static async saveSupplierCredit(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const employeeId = res.locals.user;
            const data = req.body;

            let resault;
            if (data.id == "" || data.id == null) {
                data.employeeId = employeeId;
                resault = await SupplierCreditRepo.addSupplierCredit(data, company);
            } else {
                resault = await SupplierCreditRepo.editSupplierCredit(data, company, employeeId);
            }


            const queue = ViewQueue.getQueue();
            queue.pushJob()
            
             if (resault.success) {

            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ type: "SupplierCredits", id: resault.data.id, companyId: company.id })
            queueInstance.createJob({ journalType: "Movment", type: "supplierCredit", id: resault.data.id })
            queueInstance.createJob({ type: "updateBillStatus", ids: resault.data.billingIds, companyId: company.id })
            let userBalancesQueue = SupplierBalanceQueue.getInstance();
            userBalancesQueue.createJob({ userId: data.supplierId, dbTable: 'SupplierCredits' })


             }

            return res.send(resault)



        } catch (error: any) {

                 throw error
        }
    }



    public static async  getSupplierCreditPdf(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;

            const pdfBuffer = await PDFGenerator.supplierCreditNotePdfGenerator(req.params.id)
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




    public static async getSupplierCredit(req: Request, res: Response, next: NextFunction) {
        try {
            const supplierCreditId = req.params.supplierCreditId;
            const company = res.locals.company
            const resault  = await SupplierCreditRepo.getSupplierCreditById(supplierCreditId,company);
            return res.send(resault)
        } catch (error: any) {

                 throw error
        }
    }

    public static async getSupplierCreditList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company
            const data = req.body
            const branches = res.locals.branches
            const resault = await SupplierCreditRepo.getSupplierCredits(data, company, branches);
            return res.send(resault)
        } catch (error: any) {

                 throw error
        }
    }

    public static async getBillingForSupplierCredit(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company
            const data = req.body
            const resault = await SupplierCreditRepo.getBillingForSupplierCredit(data, company);
            return res.send(resault)
        } catch (error: any) {

                 throw error
        }
    }

    public static async getSupplierCreditNumber(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company
            const branchId = req.params.branchId
            const resault = await SupplierCreditRepo.getSupplierCreditNumber(branchId, company);
            return res.send(resault)
        } catch (error: any) {

                 throw error
        }
    }

    public static async getSupplierCreditJournal(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const supplierCreditId = req.params.supplierCreditId
            const resault = await SupplierCreditRepo.getSupplierCreditJournals(supplierCreditId, company);
            return res.send(resault)
        } catch (error: any) {

                 throw error
        }
    }
    public static async sendSupplierCreditEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const pdfBuffer = await SupplierCreditRepo.sendEmail(data, company)


            // Send the PDF buffer as the response
            return res.send(pdfBuffer);

            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }
    public static async viewSupplierCreditPdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                supplierCreditId: req.params.supplierCreditId
            }
            const company = res.locals.company;

            const pdfBuffer = await SupplierCreditRepo.getPdf(data, company)

            // Send the PDF buffer as the response
            return res.send(new ResponseData(true, "", pdfBuffer));

            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }


    public static async deleteSupplierCredit(req: Request, res: Response, next: NextFunction) {
        try {
            const supplierCreditId = req.params.supplierCreditId;
            const company = res.locals.company
            const user = res.locals.user
            const resault = await SupplierCreditRepo.deleteSupplierCredit(supplierCreditId, company, user);

            if(resault.success){
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "DeleteJournal", referenceId: supplierCreditId })
                queueInstance.createJob({ journalType: "Movment", type: "Delete", ids: resault.data.linesIds })
                queueInstance.createJob({ type: "updateBillStatus", ids:resault.data.billingIds, companyId: company.id })  

                
                let userBalancesQueue = SupplierBalanceQueue.getInstance();
                userBalancesQueue.createJob({ transactionId: supplierCreditId, dbTable: 'SupplierCredits' })
                
            }

            
            return res.send(resault)
        } catch (error: any) {

                 throw error
        }
    }

    public static async getProductBillingLines(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company
            const resault = await SupplierCreditRepo.getProductBillingLines(data);
            return res.send(resault)
        } catch (error: any) {

                 throw error
        }
    }


}