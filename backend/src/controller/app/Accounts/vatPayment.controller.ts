import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { VatPaymentRepo } from '@src/repo/app/accounts/vatPayment.repo';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { Request, Response, NextFunction } from 'express';
export class VatPaymentController {
    public static async getNetVatTotal(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const data = req.body;
            let resault;


            resault = await VatPaymentRepo.getNetVat(data, company)


            return res.send(resault)
        } catch (error: any) {


                 throw error
        }
    }

    public static async saveVatPayment(req: Request, res: Response, next: NextFunction) {

        try {

            const company = res.locals.company;
            const data = req.body;
            const employeeId = res.locals.user;
            let resault;


            resault = await VatPaymentRepo.saveVatpayment(data, company, employeeId)



            let queueInstance = TriggerQueue.getInstance();


            queueInstance.createJob({ type: "intiateVatPayment", data: resault.data })



            return res.send(resault)
        } catch (error: any) {


                 throw error
        }
    }

    public static async getVatPayment(req: Request, res: Response, next: NextFunction) {

        try {

            const company = res.locals.company;
            const id = req.params.id;
            const employeeId = res.locals.user;
            let resault;


            resault = await VatPaymentRepo.getVatPaymentById(id, company)


            return res.send(resault)
        } catch (error: any) {


                 throw error
        }
    }

    public static async getVatPaymentList(req: Request, res: Response, next: NextFunction) {

        try {

            const company = res.locals.company;
            const data = req.body;
            const employeeId = res.locals.user;
            let resault;
            const branches = res.locals.branches;

            resault = await VatPaymentRepo.getVatPaymentList(data, company,branches)


            return res.send(resault)
        } catch (error: any) {


                 throw error
        }
    }


    public static async getNewTransactionDate(req: Request, res: Response, next: NextFunction) {

        try {

            const company = res.locals.company;
            let resault;


            resault = await VatPaymentRepo.getNewTransactionDate(company.id)


            return res.send(resault)
        } catch (error: any) {


                 throw error
        }
    }

    public static async saveVatPaymentLine(req: Request, res: Response, next: NextFunction) {

        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const data = req.body;
            let resault;


            resault = await VatPaymentRepo.saveVatPayment(data,employeeId, company)
            let queueInstance = TriggerQueue.getInstance();

            queueInstance.createJob({ type: "vatPayment", data: resault.data })

            return res.send(resault)
        } catch (error: any) {


                 throw error
        }
    }

    public static async getVatPayments(req: Request, res: Response, next: NextFunction) {

        try {

        
            const vatPaymentId = req.params.vatPaymentId;
            let resault;


            resault = await VatPaymentRepo.getVatPayments(vatPaymentId)
      

            return res.send(resault)
        } catch (error: any) {


                 throw error
        }
    } 

    public static async getJournals(req: Request, res: Response, next: NextFunction) {

        try {

        
            const id = req.params.id;
            let resault;


            resault = await VatPaymentRepo.getJournal(id)
      

            return res.send(resault)
        } catch (error: any) {


                 throw error
        }
    } 

    
    public static async getVatPaymentLineById(req: Request, res: Response, next: NextFunction) {

        try {

        
            const id = req.params.id;
            let resault;


            resault = await VatPaymentRepo.getVatPaymentLineById(id)
      

            return res.send(resault)
        } catch (error: any) {


                 throw error
        }
    }

    public static async deleteVatPaymnets(req: Request, res: Response, next: NextFunction) {

        try {

        
            const id = req.params.id;
            const company = res.locals.company;
            let resault;


            resault = await VatPaymentRepo.deleteVatPaymnets(id,company)
      

            return res.send(resault)
        } catch (error: any) {


                 throw error
        }
    }
}