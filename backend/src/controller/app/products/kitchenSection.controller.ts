import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { KitchenSectionRepo } from '@src/repo/app/product/kitchenSection.Repo';
import { Request, Response, NextFunction } from 'express';
export class KitchenSectionController{
    public static async saveKitchenSection (req: Request, res: Response, next: NextFunction){
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const data = req.body; 
            const company =res.locals.company;
            let resault;
            if(data.id == "" || data.id== null)
            {
                resault = await KitchenSectionRepo.addKitchenSection(client,data,company)
            }else{
                resault = await KitchenSectionRepo.editKitchenSection(client,data,company)
            }
            await client.query("COMMIT")
            return res.send(resault);
        } catch (error:any) {
            await client.query("ROLLBACK")
            throw error
        }finally{
            client.release()
        }
    }
    public static async getKitchenSectionList(req: Request, res: Response, next: NextFunction){
        try {
            
            const company =res.locals.company;
            const data = req.body
            const list = await KitchenSectionRepo.getKitchensSectionList(data,company)
            return res.send(list);
        } catch (error:any) {
            throw error
        }
    }
    public static async getKitchenSectionProducts(req: Request, res: Response, next: NextFunction){
        try {
            
            const company =res.locals.company;
            const data = req.body
            const list = await KitchenSectionRepo.getKitchenSectionProducts(company.id)
            return res.send(list);
        } catch (error:any) {
            throw error
        }
    }
    public static async getKitchenSectionById(req: Request, res: Response, next: NextFunction){
        try {
            
            const kitchenSectionId = req.params.kitchenSectionId;
            const kitchenSection = await KitchenSectionRepo.getKitchensSectionById(kitchenSectionId)
            return res.send(kitchenSection);
        } catch (error:any) {
            throw error
        }
    }
}