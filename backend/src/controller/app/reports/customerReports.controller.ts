import { ResponseData } from '@src/models/ResponseData';
import { CustomerReports } from '@src/repo/reports/customer.report';
import { Request, Response, NextFunction } from 'express';
export class CustomerReportsController{

    public static async getCustomerOrderHistory(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const companyId =res.locals.companyId
            const branches = res.locals.branches;
            const report = await CustomerReports.getCustomerOrderHistory(data, companyId,branches);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }


    public static async customerOrderHistory(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const company =res.locals.company
            const branches = res.locals.branches;

            const report = await CustomerReports.customerOrderHistory(data, company,branches);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }

    //new reports

    public static async salesByCustomer(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const company = res.locals.company
            const branches = res.locals.branches
            const report = await CustomerReports.salesByCustomer(data, company,branches);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }
    public static async salesByCustomerId(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            
            const company = res.locals.company
            const branches = res.locals.branches;
            const report = await CustomerReports.salesByCustomerId(data, company,branches);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }

    public static async customerBalance(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const company = res.locals.company
            const branches = res.locals.branches
            const report = await CustomerReports.customerBalance(data, company,branches);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }


    public static async paymentReceived(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const company =res.locals.company
            const branches = res.locals.branches
            const report = await CustomerReports.paymentReceived(data, company,branches);
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }


    public static async creditNoteReport(req: Request, res: Response, next: NextFunction){
       
        try {
            const data = req.body
            const company =res.locals.company
            const branches = res.locals.branches
            
            const report = await CustomerReports.creditNoteReport(data, company,branches);
            
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }

    public static async refundReport(req: Request, res: Response, next: NextFunction){
       
        try {
            const data = req.body
            const company =res.locals.company
            const branches = res.locals.branches
            
            const report = await CustomerReports.refundReport(data, company,branches);
            
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }

    public static async clientWiseDiscountReport(req: Request, res: Response, next: NextFunction){
       
        try {
            const data = req.body
            const company =res.locals.company
            const branches = res.locals.branches
            
            const report = await CustomerReports.clientWiseDiscountReport(data, company,branches);
            
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }
    public static async clientWiseItemSalesReport(req: Request, res: Response, next: NextFunction){
       
        try {
            const data = req.body
            const company =res.locals.company
            const branches = res.locals.branches
            
            const report = await CustomerReports.clientWiseItemSalesReport(data, company,branches);
            
            return res.send(report)
        } catch (error: any) {
            throw error
        }
    }

}