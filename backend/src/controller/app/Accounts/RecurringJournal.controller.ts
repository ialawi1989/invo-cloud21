import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { Request, Response, NextFunction } from 'express';
import { RecurringJournalRepo } from '@src/repo/app/accounts/RecurringJournal.repo';


export class RecurringJournalController {

    public static async saveRecurringJournal(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            const company = res.locals.company;
            const employeeId = res.locals.user;
            const data = req.body;
            await client.query("BEGIN")
            let resault;
            // const validate = await JournalValidation.journalValidation(data);
            // if (!validate.valid) {
            //     throw new Error(validate.error);
            // }
            if (data.id == null || data.id == "") {
                resault = await RecurringJournalRepo.addRecurringJournal(client, data, company, employeeId);
            } else {
                resault = await RecurringJournalRepo.editRecurringJournal(client, data, company, employeeId);
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

    public static async getRecurringJournalById(req: Request, res: Response, next: NextFunction) {
        
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const id = req.params.id;
          
            let response = await RecurringJournalRepo.getRecurringJournalById(id,company);
            return  res.send(response)

        } catch (error: any){
            console.log(error.message)
                 throw error
        }
    }

    public static async getRecurringJournalOverview(req: Request, res: Response, next: NextFunction) {
        
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const id = req.params.id;
          
            let response = await RecurringJournalRepo.getRecurringJournalOverview(id,company);
            return  res.send(response)

        } catch (error: any){
            console.log(error.message)
                 throw error
        }
    }

    public static async deleteRecurringJournal(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const id = req.params["id"];
            await client.query("BEGIN")
            let response = await RecurringJournalRepo.deleteRecurringJournal(client, id);
            await client.query("COMMIT")
            return  res.send(response)
     
        } catch (error: any) {
            await client.query("ROLLBACK")
                 throw error
        } finally {
            client.release()
        }
         
    }

    public static async getRecurringJournalList(req: Request, res: Response, next: NextFunction) {
        
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user;
            const data = req.body;
                                 const branches = res.locals.branches

          
            let response = await RecurringJournalRepo.getRecurringJournalList(data, company,branches);
            return    res.send(response)

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
            resault = await RecurringJournalRepo.generateAutoJournals();
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
