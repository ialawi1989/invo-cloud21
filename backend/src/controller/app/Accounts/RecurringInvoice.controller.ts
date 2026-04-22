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
import { RecurringInvoiceRepo } from '@src/repo/app/accounts/RecurringInvoice.repo';


export class RecurringInvoiceController {

    public static async saveRecurringInvoice(req: Request, res: Response, next: NextFunction) {
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
                resault = await RecurringInvoiceRepo.addRecurringInvoice(client, data, company, employeeId);
            } else {
                resault = await RecurringInvoiceRepo.editRecurringInvoice(client, data, company, employeeId);
            }

            await client.query("COMMIT")
            return  res.send(resault)
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
                 throw error
        } finally {
            client.release()
        }
    }

    public static async getRecurringInvoiceById(req: Request, res: Response, next: NextFunction) {
        
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const id = req.params.id;
          
            let response = await RecurringInvoiceRepo.getRecurringInvoiceById(id,company);
            return  res.send(response)

        } catch (error: any){
            console.log(error.message)
                 throw error
        }
    }

    public static async getRecurringInvoiceOverview(req: Request, res: Response, next: NextFunction) {
        
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const id = req.params.id;
          
            let response = await RecurringInvoiceRepo.getRecurringInvoiceOverview(id,company);
            return  res.send(response)

        } catch (error: any){
            console.log(error.message)
                 throw error
        }
    }

    public static async deleteRecurringInvoice(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const id = req.params["id"];
            await client.query("BEGIN")
            let response = await RecurringInvoiceRepo.deleteRecurringInvoice(client, id);
            await client.query("COMMIT")
            return   res.send(response)
     
        } catch (error: any) {
            await client.query("ROLLBACK")
                 throw error
        } finally {
            client.release()
        }
         
    }

    public static async getRecurringInvoiceList(req: Request, res: Response, next: NextFunction) {
        
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
                     const branches = res.locals.branches;
            const data = req.body;
          
            let response = await RecurringInvoiceRepo.getRecurringInvoiceList(data, company,branches);
            return   res.send(response)

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
            resault = await RecurringInvoiceRepo.generateAutoInvoices();
            client.query("COMMIT")
            return  res.send(resault)

        } catch (error: any){
            console.log(error.message)
            client.query("ROLLBACK")
                 throw error
        }finally {
                client.release()
            }
    }

}
