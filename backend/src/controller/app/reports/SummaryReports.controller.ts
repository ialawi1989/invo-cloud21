import { ResponseData } from '@src/models/ResponseData';
import { SummaryReport } from '@src/repo/reports/Summary.report';
import { EmployeeReports } from '@src/repo/reports/employee.reports';
import { InvenoryReports } from '@src/repo/reports/inventory.reports';
import { MenuReports } from '@src/repo/reports/menu.report';
import { Request, Response, NextFunction } from 'express';
export class SummaryReportsController{
 public static async getSalesByCategory(req: Request, res: Response, next: NextFunction){
    try {
        const data = req.body;
        const company=res.locals.company;
        const branches = res.locals.branches;
        const resault = await SummaryReport.getSalesByCategory(data,company,branches)
        return res.send(resault)
    } catch (error:any) {
        throw error
    }
 }  

 public static async stats(req: Request, res: Response, next: NextFunction){
    try {
        const data = req.body;
        const company=res.locals.company;
        const branches = res.locals.branches;
        const resault = await SummaryReport.stats(data,company,branches)
        return res.send(resault)
    } catch (error:any) {
        throw error
    }
 }  

 public static async paymentReceived(req: Request, res: Response, next: NextFunction){
    try {
        const data = req.body;
        const company=res.locals.company;
        const branches = res.locals.branches;
        const resault = await SummaryReport.received(data,company,branches)
        return res.send(resault)
    } catch (error:any) {
        throw error
    }
 } 
 
 public static async discount(req: Request, res: Response, next: NextFunction){
    try {
        const data = req.body;
        const company=res.locals.company;
        const branches = res.locals.branches;
        const resault = await SummaryReport.discount(data,company,branches)
        return res.send(resault)
    } catch (error:any) {
        throw error
    }
 } 

 public static async getSalesByServices (req: Request, res: Response, next: NextFunction){
    try {
        const data = req.body;
        const company=res.locals.company;
        const branches = res.locals.branches;
        const resault = await SummaryReport.getSalesByServices(data,company,branches)
        return res.send(resault)
    } catch (error:any) {
        throw error
    }
 } 
 public static async taxDetails (req: Request, res: Response, next: NextFunction){
    try {
        const data = req.body;
        const company=res.locals.company;
        const branches = res.locals.branches;
        const resault = await SummaryReport.taxDetails(data,company,branches)
        return res.send(resault)
    } catch (error:any) {
        throw error
    }
 }




 
 


}