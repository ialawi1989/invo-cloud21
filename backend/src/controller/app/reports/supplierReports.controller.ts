import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { PaymentMethodReports } from '@src/repo/reports/paymentMethod.reports';
import { SuppliersReports } from '@src/repo/reports/supplier.reports';

import { Request, Response, NextFunction } from 'express';
export class supplierReoportsController{
  
    public static async paymentMade(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const company =res.locals.company
            const branches = res.locals.branches
            const report = await SuppliersReports.paymentMade(data, company,branches);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }

    public static async supplierCreditReport(req: Request, res: Response, next: NextFunction){
       
        try {
            const data = req.body
            const company =res.locals.company
            const branches = res.locals.branches
            
            const report = await SuppliersReports.supplierCreditReport(data, company,branches);
            
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }

    public static async supplierRefundReport(req: Request, res: Response, next: NextFunction){
       
        try {
            const data = req.body
            const company =res.locals.company
            const branches = res.locals.branches
            
            const report = await SuppliersReports.supplierRefundReport(data, company,branches);
            
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }
    public static async supplierChangePriceReport(req: Request, res: Response, next: NextFunction){
       
        try {
            const data = req.body
            const company =res.locals.company
            const branches = res.locals.branches
            
            const report = await SuppliersReports.supplierChangePriceReport(data, company,branches);
            
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }
}