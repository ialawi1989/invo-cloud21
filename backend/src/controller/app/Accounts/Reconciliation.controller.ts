

import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { ReconciliationRepo } from '@src/repo/app/accounts/reconciliation.Repo';
import  { Request, Response, NextFunction } from 'express';

export class ReconciliationController {





    public static async saveReconciliation(req:Request,res:Response, next:NextFunction){
        const client= await DB.excu.client();
        try {
            
            const employeeId =res.locals.user; 
            const data= req.body;
            const company =res.locals.company;
            let resault;
            await client.query("BEGIN")
            if(data.id == null || data.id =="")
            {   
                data.employeeId = employeeId;
                resault = await ReconciliationRepo.saveReconciliation(client,data,company);
            }else{
                resault = await ReconciliationRepo.editReconciliation(client,data,company);
            }
            await client.query("COMMIT")
            return res.send(resault)
        } catch (error:any) {
            await client.query("ROLLBACK")
                 throw error
        }finally{
            client.release()
        }
    }

    public static async getReconcilationList(req: Request, res: Response, next: NextFunction)
    {
        try {
            const data = req.body;
            const company = res.locals.company;
            const list = await ReconciliationRepo.getListReconciliation(data,company)
            return res.send(list)
        } catch (error:any) {
            
                 throw error
        }
    }


    public static async getById(req: Request, res: Response, next: NextFunction)
    {
        try {
            const id = req.params.id
            const company = res.locals.company;
            const list = await ReconciliationRepo.getById(id,company)
            return res.send(list)
        } catch (error:any) {
            
                 throw error
        }
    }

    
    public static async getReconcilationRecordsById(req: Request, res: Response, next: NextFunction)
    {
        try {
            const data = req.body
            const company = res.locals.company;
            const list = await ReconciliationRepo.getReconcilationRecordsById(data,company)
            return res.send(list)
        } catch (error:any) {
            
                 throw error
        }
    }


    public static async getRecords(req: Request, res: Response, next: NextFunction)
    {
        try {
            const data = req.body
            const company = res.locals.company;
            const list = await ReconciliationRepo.getRecords(data,company)
            return res.send(list)
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async getReconcilationRecords(req: Request, res: Response, next: NextFunction)
    {
        try {
            const data = req.body
            const company = res.locals.company;
            const list = await ReconciliationRepo.getReconcilationRecordsById(data,company)
            return res.send(list)
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async getReconcilationDate(req: Request, res: Response, next: NextFunction)
    {
        try {
            const data = req.body
            const company = res.locals.company;
            const list = await ReconciliationRepo.getReconciliationDate(data,company)
            return res.send(list)
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async deleteReconcilation(req: Request, res: Response, next: NextFunction)
    {
        try {
            const id = req.params.id 
            const company = res.locals.company;
            const list = await ReconciliationRepo.deleteReconciliation(id,company)
            return res.send(list)
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async undoReconcilation(req: Request, res: Response, next: NextFunction)
    {
        try {
            const id = req.params.id 
            const company = res.locals.company;
            const list = await ReconciliationRepo.undoReconcilation(id)
            return res.send(list)
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async getAccountOpeningBalance(req: Request, res: Response, next: NextFunction)
    {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            const data = req.body
            const company = res.locals.company;
            const list = await ReconciliationRepo.getOpeningBalance(client,data,company)
            await client.query("COMMIT")
            return res.send(list)
        } catch (error:any) {
            await client.query("ROLLBACK")
                 throw error
        }finally{
            client.release()
        }
    }
}