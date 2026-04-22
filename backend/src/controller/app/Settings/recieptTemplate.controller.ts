import { ResponseData } from '@src/models/ResponseData';
import { RecieptTemplatesRepo } from '@src/repo/app/settings/recpietTemplate.repo';
import { Request, Response, NextFunction } from 'express';
export class RecieptTemplateController {
    public static async saveRecieptTemplate(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company =res.locals.company;

            let resault;
            if (data.id == null || data.id == "") {
                resault = await RecieptTemplatesRepo.saveRecieptTemplates(data, company)
            }else{
                resault = await RecieptTemplatesRepo.editRecieptTemplates(data,company)
            }
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async getRecieptTemplates(req: Request, res: Response, next: NextFunction) {
        try {

            const company =res.locals.company;
            const data = req.body;
            let resault;
            resault = await RecieptTemplatesRepo.getRecieptTemplates(data,company)

            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async getRecieptTemplateById(req: Request, res: Response, next: NextFunction) {
        try {

            const recieptTemplateId = req.params.recieptTemplateId;
            let resault;
            resault = await RecieptTemplatesRepo.getRecieptTemplate(recieptTemplateId)

            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async deleteRecieptTemplateById(req: Request, res: Response, next: NextFunction) {
        try {

            const recieptTemplateId = req.params.recieptTemplateId;
            let resault;
            resault = await RecieptTemplatesRepo.deletRecieptTemplate(recieptTemplateId)

            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
}