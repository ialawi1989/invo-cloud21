import { ResponseData } from '@src/models/ResponseData';
import { PaymentMethodReports } from '@src/repo/reports/paymentMethod.reports';

import { Request, Response, NextFunction } from 'express';
export class PaymentMethodReoportsController{
    public static async paymentMethodReport(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const company =res.locals.company
            const branches = res.locals.branches;
            const report = await PaymentMethodReports.paymentMethodReport(data, company,branches);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }

    public static async payoutsReport(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const company =res.locals.company
            const report = await PaymentMethodReports.payoutsReport(data, company);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }

    //new Reports
    public static async getPaymentMethodReport(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const company =res.locals.company
            const branches = res.locals.branches
            const report = await PaymentMethodReports.getPaymentMethodReport2(data, company,branches);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }

    public static async paymentTransactions(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const company =res.locals.company
            const branches = res.locals.branches
            const report = await PaymentMethodReports.paymentTransactions(data, company,branches);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }

    public static async dailyPaymentReport(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const company =res.locals.company
            const branches = res.locals.branches
            const report = await PaymentMethodReports.dailyPaymentReport(data, company,branches);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }
}