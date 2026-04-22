import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { TaxesRepo } from '@src/repo/app/accounts/taxes.repo';
import { Request, Response, NextFunction } from 'express';
export class TaxController {
    public static async saveTax(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const company =res.locals.company;
            const data = req.body;
            let resault;
        
            if (data.id == null || data.id == "") {
                resault = await TaxesRepo.addTax(client,data, company)
            } else {
                resault = await TaxesRepo.editTax(client,data, company)
            }
            await client.query("COMMIT")
            return res.send(resault)
        } catch (error: any) {
            await client.query("ROLLBACK")
            
                 throw error
        }finally{
            client.release()
        }
    }
    public static async getTaxesList(req: Request, res: Response, next: NextFunction) {
        try {
            const company =res.locals.company;
            const data = req.body;
            const resault = await TaxesRepo.getTaxList(data, company)
            return res.send(resault)
        } catch (error: any) {
            
                 throw error
        }
    }
    public static async getTaxById(req: Request, res: Response, next: NextFunction) {
        try {
            const company =res.locals.company;
            const taxId = req.params.taxId;

            const resault = await TaxesRepo.getTaxById(taxId, company)
            return res.send(resault)
        } catch (error: any) {
            
                 throw error
        }
    }
    public static async getChildrenTexes(req: Request, res: Response, next: NextFunction) {
        try {
            const company =res.locals.company;
            const taxId = req.body.taxId;

            const resault = await TaxesRepo.getChildrenTexes(company, taxId)
            return res.send(resault)
        } catch (error: any) {
            
                 throw error
        }
    }

    public static async setDefaultTax(req: Request, res: Response, next: NextFunction) {
        try {
            const company =res.locals.company;
            const taxId = req.body.taxId;

            const resault = await TaxesRepo.setDefaultTax(taxId,company)
            return res.send(resault)
        } catch (error: any) {
            
                 throw error
        }
    }
}