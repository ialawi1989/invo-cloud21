import { ResponseData } from '@src/models/ResponseData';
import { JournalRepo } from '@src/repo/app/accounts/Journal.repo';
import { LogsRepo } from '@src/repo/app/accounts/logs.repo';
import { LogsManagmentRepo } from '@src/repo/app/settings/LogSetting.repo';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { ViewQueue } from '@src/utilts/viewQueue';
import { Request, Response, NextFunction } from 'express';
export class LogController{

    public static async getLogs(req: Request, res: Response, next: NextFunction)
    {
        try {
            const data = req.body;
            const company = res.locals.company
            const list = await LogsRepo.getLogs(data,company)
            return res.send(list)
        } catch (error:any) {
            
            throw error
        }
    }

    public static async getLogReport(req: Request, res: Response, next: NextFunction)
    {
        try {
            const data = req.body;
            const company = res.locals.company
            const list = await LogsManagmentRepo.getLogsReport(data,company)
            return res.send(list)
        } catch (error:any) {
            
            throw error
        }
    }
}