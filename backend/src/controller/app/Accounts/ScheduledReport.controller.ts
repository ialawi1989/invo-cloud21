import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { Request, Response, NextFunction } from 'express';
import { RecurringExpenseRepo } from '@src/repo/app/accounts/RecurringExpense.repo';
import { scheduledReportRepo } from '@src/repo/app/accounts/scheduledReport.repo';


export class ScheduledReportController {

    public static async saveScheduledReport(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            const company = res.locals.company;
            const employeeId = res.locals.user;
            const data = req.body;
            await client.query("BEGIN")
            let resault;
            // const validate = await ExpenseValidation.expenseValidation(data);
            // if (!validate.valid) {
            //     throw new Error(validate.error);
            // }
            if (data.id == null || data.id == "") {
                resault = await scheduledReportRepo.scheduleReport(client, data, company, employeeId);
            } else {
                resault = await scheduledReportRepo.rescheduledReport(client, data, company, employeeId);
            }

            await client.query("COMMIT")
            return res.send(resault)
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
            throw error
        } finally {
            client.release()
        }
    }

    public static async getScheduledReportById(req: Request, res: Response, next: NextFunction) {
        
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const id = req.params.id;
          
            let response = await scheduledReportRepo.getScheduledReportById(id,company);
            return res.send(response)

        } catch (error: any){
            console.log(error.message)
            throw error
        }
    }

    public static async deleteScheduledReport(req: Request, res: Response, next: NextFunction) {
      
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const id = req.params["id"];
            let response = await scheduledReportRepo.deleteScheduledReport( id);
            return res.send(response)
     
        } catch (error: any) {
            throw error
        }  
    }

    public static async getScheduledReportTypes(req: Request, res: Response, next: NextFunction) {
        
        try {

            const company = res.locals.company; 
            let response = await scheduledReportRepo.getScheduledReportTypes(company);
            return res.send(response)

        } catch (error: any){
            console.log(error.message)
            throw error
        }
    }
    public static async getScheduledReportBytype(req: Request, res: Response, next: NextFunction) {
        
        try {

            const company = res.locals.company;
            const type = req.params.type;
          
            let response = await scheduledReportRepo.getScheduledReportBytype(type,company);
            return res.send(response)

        } catch (error: any){
            console.log(error.message)
            throw error
        }
    }

    public static async test(req: Request, res: Response, next: NextFunction) {
       
        try {

            const id = req.params.id
            let response = await scheduledReportRepo.getDueReportsTest( id);
            res.send(response)

     
        } catch (error: any) {
              throw error
        }  
    }

}
