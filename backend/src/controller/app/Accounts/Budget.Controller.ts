import { ResponseData } from '@src/models/ResponseData';
import { Company } from '@src/models/admin/company';
import { ReportRepo } from '@src/repo/reports/reports.repo';
import { vatReportRepo } from '@src/repo/reports/vatReports.report';
import { DB } from '@src/dbconnection/dbconnection';
import { BudgetRepo } from '@src/repo/app/accounts/Budget.repo';
import { ViewQueue } from '@src/utilts/viewQueue';
import { Request, Response, NextFunction } from 'express';


export class BudgetController{

    public static async saveBudget(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            const company =res.locals.company;
            const data = req.body;

            await client.query("BEGIN")
            let resault;

            if (data.id == null || data.id == "") {  
                resault = await BudgetRepo.addBudget(client,data,company);
            } else {
                resault = await BudgetRepo.editBudget(client,data,company);
            }
            await client.query("COMMIT")

            return   res.send(resault)
        } catch (error: any) {
            
            await client.query("ROLLBACK")
                 throw error
        } finally {
            client.release()
        }
    }


    
    public static async deleteBudget(req: Request, res: Response, next: NextFunction){ 
        try {
            const budgetId =req.params.budgetId
            const data = await BudgetRepo.deleteBudget(budgetId);
            
            return res.send(data)
            
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async getBudgetById(req: Request, res: Response, next: NextFunction){ 
        try {
            const budgetId =req.params.budgetId
            const company = res.locals.company
            const budget = await BudgetRepo.getBudgetById(budgetId, company);
           
            return res.send(budget)
            
        } catch (error:any) {
            
                 throw error
        }
    }
    public static async getBudgetById2(req: Request, res: Response, next: NextFunction){ 
        try {
            const budgetId =req.params.budgetId
            const company = res.locals.company
            const budget = await BudgetRepo.getBudgetById2(budgetId, company);
           
            return res.send(budget)
            
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async ActualvsPrediction(req: Request, res: Response, next: NextFunction){ 
        try {
            const budgetId =req.params.budgetId
            const company = res.locals.company
            const budget = await BudgetRepo.ActualvsPrediction(budgetId, company);
           
            return res.send(budget)
            
        } catch (error:any) {
            
                 throw error
        }
    }

   
    public static async getBudgetList(req: Request, res: Response, next: NextFunction){ 
        try {
           
            const company = res.locals.company
            const data= req.body
            const budget = await BudgetRepo.getBudgetList(data, company);
           
            return res.send(budget)
            
        } catch (error:any) {
            
                 throw error
        }
    }


    public static async getAccountList(req: Request, res: Response, next: NextFunction){ 
        try {
           
            const company = res.locals.company
            const budget = await BudgetRepo.getAccountList(company);
           
            return res.send(budget)
            
        } catch (error:any) {
            
                 throw error
        }
    }




}