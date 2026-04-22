import { Request, Response, NextFunction } from 'express';
import { ResponseData } from '@src/models/ResponseData';
import { salesTargetRepo } from '@src/repo/app/accounts/salesTarget.repo';
import { DB } from '@src/dbconnection/dbconnection';

export class SalesTargetController {
    static async getSalesTargetList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const result = await salesTargetRepo.getSalesTargetList(company.id, data);
            return res.send(result);
        } catch (error: any) {
            return res.send(new ResponseData(false, error.message, []));
        }
    }
    static async getTargetSales(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.params.id ;
            const company = res.locals.company;
            let data = {
                period: req.query.period,
                month: req.query.month ?? null,
                year: req.query.year ?? null,
                quarter: req.query.quarter ?? null
            }
            const resault = await salesTargetRepo.getTargetSales(id, company, data)
            return res.send(resault)
        } catch (error: any) {
            return res.send(new ResponseData(true, error.message, []))
        } finally {

        }
    }

    static async getBranchSalesTarget(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.params.id;
            const company = res.locals.company;
            let data = {
                period: req.query.period,
                month: req.query.month ?? null,
                year: req.query.year ?? null,
                quarter: req.query.quarter ?? null
            }
            const resault = await salesTargetRepo.getBranchSalesTarget(id, company, data)
            return res.send(resault)
        } catch (error: any) {
            return res.send(new ResponseData(true, error.message, []))
        } finally {

        }
    }

    static async getDailySalesTarget(req: Request, res: Response, next: NextFunction) {
        try {
            const id = req.params.id;
            const company = res.locals.company;
            let data = {
                period: req.query.period,
                month: req.query.month ?? null,
                year: req.query.year ?? null,
                quarter: req.query.quarter ?? null
            }
            const resault = await salesTargetRepo.getDailySalesTarget(id, company, data)
            return res.send(resault)
        } catch (error: any) {
            return res.send(new ResponseData(true, error.message, []))
        } finally {

        }
    }

    static async saveSalesTarget(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const resault = await salesTargetRepo.saveSalesTarget(company.id, data)
            return res.send(resault)
        } catch (error: any) {
            return res.send(new ResponseData(true, error.message, []))
        } finally {

        }
    }


    // static async saveBranchSalesTarget(req: Request, res: Response, next: NextFunction) {
    //     try {
    //         const id = req.params.id;
    //         const items = req.body.items || []; // [{branchId,totalSalesTarget,netSalesTarget}]
    //         //const company = res.locals.company;
    //         const resault = await salesTargetRepo.saveBranchSalesTarget(id, items)
    //         return res.send(resault)
    //     } catch (error: any) {
    //         return res.send(new ResponseData(true, error.message, []))
    //     } finally {

    //     }
    // }


}