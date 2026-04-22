
import { ResponseData } from '@src/models/ResponseData';
import { CustomizeReportRepo } from '@src/repo/reports/customReports/customizeReport.repo';
import { ReportModuleRepo } from '@src/repo/reports/customReports/reportModules.repo';
import { reportOptionRepo } from '@src/repo/reports/customReports/reportOptions.repo';
import { ReportQueriesRepo } from '@src/repo/reports/customReports/reportQueries.repo';
import { Request, Response, NextFunction } from 'express';
export class CustomizeReportControlle{
    public static async saveModule(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const moduleId = req.params.moduleId
            const company =res.locals.company
            let result;
            if(moduleId != "0"){
                 result = await ReportModuleRepo.editModule(data,moduleId);
            }else{
                result = await ReportModuleRepo.saveReportModule(data, company.id);
            }
         
            return res.send(result)
        } catch (error: any) {
              throw error
        }
    } 

    public static async deleteModule(req: Request, res: Response, next: NextFunction){
        try {
            const moduleId = req.params.moduleId;
           const result=  await ReportModuleRepo.deleteModule(moduleId)
            return res.send(result)
        } catch (error: any) {
              throw error
        }
    } 

    public static async getModules(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const company =res.locals.company
            const report = await ReportModuleRepo.getReportModules(data, company);
            return res.send(report)
        } catch (error: any) {
              throw error
        }
    } 

    public static async getModule(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const company =res.locals.company
            const moduleId = req.params.moduleId
            const report = await ReportModuleRepo.getReportModule(moduleId);
            return res.send(report)
        } catch (error: any) {
              throw error
        }
    } 

    public static async getOptions(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const company =res.locals.company
            const fieldName = req.params.fieldName
            const report = await reportOptionRepo.getOptions(fieldName,company.id);
            return res.send(report)
        } catch (error: any) {
              throw error
        }
    }

    public static async getSuggests(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const company =res.locals.company
            const fieldName = req.params.fieldName
            const report = await reportOptionRepo.getSuggest(fieldName,company.id);
            return res.send(report)
        } catch (error: any) {
              throw error
        }
    }

    public static async saveQuery(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const company =res.locals.company
            let result;
            if(data.id !=null&&data.id!=""){
                result = await ReportQueriesRepo.editQuerie(data);
            }else{
                result = await ReportQueriesRepo.saveReportQueries(data, company.id);
            }
         
            return res.send(result)
        } catch (error: any) {
              throw error
        }
    } 

    public static async getQueries(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const company =res.locals.company
            const report = await ReportQueriesRepo.getReportQueries(data, company);
            return res.send(report)
        } catch (error: any) {
              throw error
        }
    } 

    public static async getQuery(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body
            const company =res.locals.company
            const queryId = req.params.queryId
            const report = await ReportQueriesRepo.getReportQuerie(queryId);
            return res.send(report)
        } catch (error: any) {
              throw error
        }
    } 
    public static async deleteQuery(req: Request, res: Response, next: NextFunction){
        try {
            const queryId = req.params.queryId;
           const result=  await ReportQueriesRepo.deleteQuerie(queryId)
            return res.send(result)
        } catch (error: any) {
              throw error
        }
    } 

    public static async getCustomizeReport(req: Request, res: Response, next: NextFunction){
        try {
            const company = res.locals.company;
            const data = req.body
            const query = data.query || [];
            const tableName =   req.body.data || [];
            const columns = JSON.parse(data.columns) || [];
            const joins = data.joins || [];
            const sort = data.sort || [];
            let group= data.group || [];
            const buckets=data.buckets || [];
            if(data.group)
             group = await CustomizeReportRepo.toArray(data.group);
         //   if(data.buckets)
        //     buckets = await CustomizeReportRepo.toArray(data.buckets);
            const limit = data.limit;
            const report = await CustomizeReportRepo.generateSQL(tableName, query, columns, joins, limit, sort, group, buckets,company);
            const reportAsString = JSON.stringify(report, (key, value) => {
                if (typeof value === 'number') {
                  return value.toString();
                }
                return value;
              });
            return res.send(reportAsString)
        } catch (error: any) {
            console.log(error);
              throw error
        }
    } 

    public static async getDataSource(req: Request, res: Response, next: NextFunction){
        try {

            const report = await CustomizeReportRepo.getDataSource();
            return res.send(report)
        } catch (error: any) {
              throw error
        }
    } 
}