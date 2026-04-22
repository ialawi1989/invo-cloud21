import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { InvoiceRepo } from '@src/repo/app/accounts/invoice.repo';
import { SocketInvoiceRepo } from '@src/repo/socket/invoice.socket';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { ViewQueue } from '@src/utilts/viewQueue';
import { InvoiceValidation } from '@src/validationSchema/account/invoice.Schema';
import builder from 'xmlbuilder';
import { Request, Response, NextFunction } from 'express';
import { BranchesRepo } from '@src/repo/admin/branches.repo';
import { zatca } from '@src/Integrations/zatca/zatca';
import { CompanyRepo } from '@src/repo/admin/company.repo';
import { RecurringBillRepo } from '@src/repo/app/accounts/RecurringBill.repo';


export class RecurringBillController {

    public static async saveRecurringBill(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            const company = res.locals.company;
            const employeeId = res.locals.user;
            const data = req.body;
            await client.query("BEGIN")
            let resault;
            // const validate = await InvoiceValidation.invoiceValidation(data);
            // if (!validate.valid) {
            //     throw new Error(validate.error);
            // }
            if (data.id == null || data.id == "") {
                resault = await RecurringBillRepo.addRecurringBill(client, data, company, employeeId);
            } else {
                resault = await RecurringBillRepo.editRecurringBill(client, data, company, employeeId);
            }

            await client.query("COMMIT")
            return  res.send(resault)
        } catch (error: any) {
            await client.query("ROLLBACK")
                 throw error
        } finally {
            client.release()
        }
    }

    public static async getRecurringBillById(req: Request, res: Response, next: NextFunction) {
        
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const id = req.params.id;
          
            let response = await RecurringBillRepo.getRecurringBillById(id,company);
            return res.send(response)

        } catch (error: any){
            console.log(error.message)
            throw error
        }
    }

    public static async getRecurringBillOverview(req: Request, res: Response, next: NextFunction) {
        
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const id = req.params.id;
          
            let response = await RecurringBillRepo.getRecurringBillOverview(id,company);
            return  res.send(response)

        } catch (error: any){
            console.log(error.message)
                 throw error
        }
    }

    public static async deleteRecurringBill(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const id = req.params["id"];
            await client.query("BEGIN")
            let response = await RecurringBillRepo.deleteRecurringBill(client, id, company, employeeId);
            await client.query("COMMIT")
            return   res.send(response)
     
        } catch (error: any) {
            await client.query("ROLLBACK")
                 throw error
        } finally {
            client.release()
        }
         
    }

    public static async getRecurringBillList(req: Request, res: Response, next: NextFunction) {
        
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const data = req.body;
                               const branches = res.locals.branches
          
            let response = await RecurringBillRepo.getRecurringBillList(data, company,branches);
            return  res.send(response)

        } catch (error: any){
            console.log(error.message)
            throw error
        }
    }

    public static async test12(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            const company = res.locals.company;
            const employeeId = res.locals.user;
            const data = req.body;
          
            let resault;
            
           client.query("BEGIN")
           resault = await RecurringBillRepo.generateAutoBills();
           client.query("COMMIT")
           return res.send(resault)

        } catch (error: any){
            console.log(error.message)
            client.query("ROLLBACK")
                 throw error
        }finally {
                client.release()
        }
    }

}
