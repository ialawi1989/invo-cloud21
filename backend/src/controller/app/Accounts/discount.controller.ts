import { ResponseData } from '@src/models/ResponseData';
import { DiscountRepo } from '@src/repo/app/accounts/discount.repo';
import { Request, Response, NextFunction } from 'express';
export class DiscountController{
    public static async saveDiscount(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const insert = await DiscountRepo.saveDiscount(req.body,company)
            return res.send(insert)
        } catch (error:any) {
            
                 throw error
        }
    }
    public static async getDiscountList(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
         
            let resault;
                resault= await DiscountRepo.getDiscountList(data,company)
            return res.send(resault)
        } catch (error:any) {
            
                 throw error
        }
    }
    public static async getDiscount(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const discountId = req.params['discountId']
            const discount = await DiscountRepo.getDiscount(company,discountId)

            return res.send(discount)
        } catch (error:any) {
            
                 throw error
        }
    }
    
}