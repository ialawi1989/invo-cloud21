
import { ResponseData } from '@src/models/ResponseData';
import { CustomizationRepo } from '@src/repo/app/settings/Customization.repo';
import { Request, Response, NextFunction } from 'express';

export class CustomizationController{
    public static async saveCustomization(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company =res.locals.company;

            let resault;
            if (data.data.id == null || data.data.id == "") {
                resault = await CustomizationRepo.saveCustomization(data.data, company)
            }else{
                resault = await CustomizationRepo.editCustomization(data.data,data.key, company)
            }
            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }

    public static async getCustomizations(req: Request, res: Response, next: NextFunction) {
        try {

            const company =res.locals.company;
            const data =req.body;
            let resault = await CustomizationRepo.getCustomizations(data,company)
            
            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }


    public static async getCustomizationById(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company =res.locals.company;

            let resault = await CustomizationRepo.getById(data,company)
            
            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }


    public static async getCustomizationByKey(req: Request, res: Response, next: NextFunction) {
        try {
            const type = req.params.type;
            const key = req.params.key;
            const company =res.locals.company;

            let resault = await CustomizationRepo.getCustomizationByKey(type,key,company)
            
            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }

    public static async getCustomizationByType(req: Request, res: Response, next: NextFunction) {
        try {
            const type = req.params.type;
            const key = req.params.key;
            const company =res.locals.company;

            let resault = await CustomizationRepo.getCustomizationByType(type,company)
            
            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }
}