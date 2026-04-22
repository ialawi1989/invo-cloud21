import { ResponseData } from '@src/models/ResponseData';
import { Company } from '@src/models/admin/company';
import { Request, Response, NextFunction } from 'express';
import { purchaseReport } from '@src/repo/reports/Purchase.report';


export class purchaseReportsController {
    public static async purchaseBySupplier(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await purchaseReport.purchaseBySupplier(data, company, branches);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }

    public static async purchaseBySupplierId(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;
            const report = await purchaseReport.purchaseBySupplierId(data, company, branches);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }

    public static async purchaseByItem(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;

            let productId = data.filter && data.filter.productId ? data.filter.productId : null
            let report;
            const branches = res.locals.branches;
            if (productId) {
                report = await purchaseReport.purchaseByItemId(data, company, productId, branches);
            } else {
                report = await purchaseReport.purchaseByItem(data, company, branches);
            }


            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }

    public static async purchaseByCategory(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;

            const report = await purchaseReport.purchaseByCategory(data, company);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }

    public static async openPendingPOReport(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const branches = res.locals.branches;

            const report = await purchaseReport.openPendingPOReport(data, company, branches);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }

}