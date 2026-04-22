
import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { Company } from '@src/models/admin/company';
import { CompanyRepo } from '@src/repo/admin/company.repo';
import { AccountsRepo } from '@src/repo/app/accounts/account.repo';
import { BillOfEntryRepo } from '@src/repo/app/accounts/billOfEntry.repo';
import { BillingRepo } from '@src/repo/app/accounts/billing.repo';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { ViewQueue } from '@src/utilts/viewQueue';
import { Request, Response, NextFunction } from 'express';

export class BillOfEntryController {
    public static async saveBillOfEnrty(req: Request, res: Response, next: NextFunction) {

        try {
            const company = res.locals.company;
            const employeeId = res.locals.user;
            const data = req.body;





            let resault = await BillOfEntryRepo.saveBillingEntry(data, company, employeeId)

            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ type: "billOfEnrty", id: resault.data.id, companyId: company.id })

            return res.send(resault)
        } catch (error: any) {


                 throw error
        }
    }
    public static async getBillOfEnrtyList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;

            const list = await BillOfEntryRepo.getBillingEntryList(data, company, branches)
            return res.send(list)
        } catch (error: any) {

                 throw error
        }
    }

    public static async getBillingEntryById(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const id = req.params.id;


            const list = await BillOfEntryRepo.getBillingEntryById(id, company)
            return res.send(list)
        } catch (error: any) {

                 throw error
        }
    }

    public static async getBillingOfEntryNumber(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params.branchId;
            const company = res.locals.company;
            const number = await BillOfEntryRepo.getBillingOfEntryNumber(branchId, company);
            return res.send(number)
        } catch (error: any) {

                 throw error
        }
    }

    public static async deleteBillOfEntry(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.params.id;
            const company = res.locals.company;
            const user = res.locals.user;

        
        let resault= await BillOfEntryRepo.deleteBillOfEnrty(id, company, user)
     
                 
        const queue = ViewQueue.getQueue();
        queue.pushJob()


            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ type: "DeleteJournal", referenceId: id })

            return res.send(new ResponseData(true, "", []))
        } catch (error: any) {

                 throw error
        }
    }


    public static async sendBillOfEntryEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const pdfBuffer = await BillOfEntryRepo.sendBillOfEntryEmail(data, company)


            // Send the PDF buffer as the response
            return res.send(pdfBuffer);

            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }

    public static async viewPdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                billOfEntryId: req.params.id,
                type: 'billOfEntry'
            }
            const company = res.locals.company;

            const pdfBuffer = await BillOfEntryRepo.getPdf(data)


            // Send the PDF buffer as the response
            return res.send(new ResponseData(true, "", pdfBuffer));

            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }
}