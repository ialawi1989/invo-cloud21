import { ResponseData } from '@src/models/ResponseData';
import { SurchargeRepo } from '@src/repo/app/accounts/surcharge.repo';

import { Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
export class SurchargeController {
    public static async saveSurcharge(req: Request, res: Response, next: NextFunction) {
        try {
            const company =res.locals.company;
            const insert = await SurchargeRepo.saveSurcharge(req.body, company)
            return res.send(insert)
        } catch (error: any) {
            
                 throw error
        }
    }
    public static async getSurchargeList(req: Request, res: Response, next: NextFunction) {
        try {
            const company =res.locals.company;
            const data = req.body;
            let resault;


            resault = await SurchargeRepo.getSurchargeList(data, company)

            return res.send(resault)
        } catch (error: any) {
            
                 throw error
        }
    }
    public static async getSurcharge(req: Request, res: Response, next: NextFunction) {
        try {
            const company =res.locals.company;
            const surchargeId = req.params['surchargeId']
            const surcharge = await SurchargeRepo.getSurcharge(company, surchargeId)

            return res.send(surcharge)
        } catch (error: any) {
            
                 throw error
        }
    }

        public static async getTransactionsSurchargeList(req: Request, res: Response, next: NextFunction) {
        try {
            const company =res.locals.company;
            const data = req.body
            const surcharge = await SurchargeRepo.getTransactionsSurchargeList(data, company)

            return res.send(surcharge)
        } catch (error: any) {
            
                 throw error
        }
    }
}