import { DB } from "@src/dbconnection/dbconnection";

import { ResponseData } from "@src/models/ResponseData";
import { BranchesRepo } from "@src/repo/callCenter/branch.repo";
import { Request, Response, NextFunction } from 'express';


import { order } from "@src/Integrations/whatsapp/Order"
import { NotificationTemplateRepo } from "@src/repo/app/accounts/NotificationTemplate.repo";

export class NotificationTemplateController{


    public static async saveNotificationTemplate(req: Request, res: Response, next: NextFunction) {
        try {

            const data = req.body;
            const companyId = res.locals.company.id;
     
            const response = await NotificationTemplateRepo.saveNotificationTemplate(companyId, data);
            return res.send(response);

        } catch (error: any) {

          
            throw error

        }
    } 

    public static async getNotificationTemplateById(req: Request, res: Response, next: NextFunction) {
        try {

            const id = req.params.id;
            const companyId = res.locals.company.id;
     
            const response = await NotificationTemplateRepo.getNotificationTemplateById(companyId, id);
            return res.send(response);

        } catch (error: any) {

          
            throw error
            
        }
    } 

    public static async getNotificationTemplateList(req: Request, res: Response, next: NextFunction) {
        try {

            const companyId = res.locals.company.id;

            const response = await NotificationTemplateRepo.getNotificationTemplateList(companyId);
            return res.send(response);

        } catch (error: any) {

          
            throw error
            
        }
    } 

    public static async deleteNotificationTemplate(req: Request, res: Response, next: NextFunction) {
        try {

            const id = req.params.id;
            const companyId = res.locals.company.id;
     
            const response = await NotificationTemplateRepo.deleteNotificationTemplate(companyId, id);
            return res.send(response);

        } catch (error: any) {

          
            throw error
            
        }
    } 

    public static async sendNotificationByBranch(req: Request, res: Response, next: NextFunction) {
        try {

            const id = req.params.id;
            const data = req.body;
            const branchId = req.params.branchId;
            const companyId = res.locals.company.id;
     
            const response = await NotificationTemplateRepo.sendNotificationByBranch(companyId,branchId, id, data);
            return res.send(response);

        } catch (error: any) {

          
            throw error
            
        }
    }


}