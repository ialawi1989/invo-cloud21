import { ResponseData } from '@src/models/ResponseData';
import { LabelTemplateRepo } from '@src/repo/app/settings/LabelTemplate.repo';
import { Request, Response, NextFunction } from 'express';
export class LabelTemplateController {
    public static async saveZPLTemplate(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company =res.locals.company;

            let resault;
            if (data.id == null || data.id == "") {
                resault = await LabelTemplateRepo.saveLabelTemplate(data, company)
            }else{
                resault = await LabelTemplateRepo.editLabelTemplate(data, company)
            }
            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async getZPLTemplates(req: Request, res: Response, next: NextFunction) {
        try {

            const company =res.locals.company;
            const data = req.body;
            let resault;
            resault = await LabelTemplateRepo.getLabelTemplates(data,company)

            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }

    public static async getZPLTemplateById(req: Request, res: Response, next: NextFunction) {
        try {

            const labelTemplateId = req.params.labelTemplateId;
            let resault;
            resault = await LabelTemplateRepo.geLabelTemplateById(labelTemplateId)

            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
    public static async deleteZPLTemplateById(req: Request, res: Response, next: NextFunction) {
        try {

            const labelTemplateId = req.params.labelTemplateId;
            let resault;
            resault = await LabelTemplateRepo.deleteLabelTemplateById(labelTemplateId)

            return res.send(resault)
        } catch (error: any) {
            throw error
        }
    }
}