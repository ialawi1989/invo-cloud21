import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { Request, Response, NextFunction } from 'express';
import { RecurringExpenseRepo } from '@src/repo/app/accounts/RecurringExpense.repo';


export class RecurringExpenseController {

    public static async saveRecurringExpense(req: Request, res: Response, next: NextFunction) {
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
                resault = await RecurringExpenseRepo.addRecurringExpense(client, data, company, employeeId);
            } else {
                resault = await RecurringExpenseRepo.editRecurringExpense(client, data, company, employeeId);
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

    public static async getRecurringExpenseById(req: Request, res: Response, next: NextFunction) {
        
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const id = req.params.id;
          
            let response = await RecurringExpenseRepo.getRecurringExpenseById(id,company);
            return  res.send(response)

        } catch (error: any){
            console.log(error.message)
                 throw error
        }
    }

    public static async getRecurringExpenseOverview(req: Request, res: Response, next: NextFunction) {
        
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const id = req.params.id;
          
            let response = await RecurringExpenseRepo.getRecurringExpenseOverview(id,company);
            return  res.send(response)

        } catch (error: any){
            console.log(error.message)
                 throw error
        }
    }

    public static async deleteRecurringExpense(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const id = req.params["id"];
            await client.query("BEGIN")
            let response = await RecurringExpenseRepo.deleteRecurringExpense(client, id, company, employeeId);
            await client.query("COMMIT")
            return  res.send(response)
     
        } catch (error: any) {
            await client.query("ROLLBACK")
                 throw error
        } finally {
            client.release()
        }
         
    }

    public static async getRecurringExpenseList(req: Request, res: Response, next: NextFunction) {
        
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const data = req.body;
                     const branches = res.locals.branches
            let response = await RecurringExpenseRepo.getRecurringExpenseList(data, company,branches);
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
            resault = await RecurringExpenseRepo.generateAutoExpenses();
            client.query("COMMIT")
            return   res.send(resault)
        } catch (error: any){
            console.log(error.message)
            client.query("ROLLBACK")
                 throw error
        }finally {
                client.release()
            }
    }

}
