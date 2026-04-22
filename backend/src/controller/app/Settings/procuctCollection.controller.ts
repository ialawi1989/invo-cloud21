import { ResponseData } from '@src/models/ResponseData';
import { ProductCollectionRepo } from '@src/repo/app/settings/ProductCollection.repo';
import { Request, Response, NextFunction } from 'express';

export class ProductCollectionController{

    public static async saveProductCollection(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company =res.locals.company;

            let resault;
            if (data.id == null || data.id == "") {
                resault = await ProductCollectionRepo.addProdcutCollection(data, company)
            }else{
                resault = await ProductCollectionRepo.editProdcutCollection(data, company)
            }
            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }

    public static async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company =res.locals.company;
            const collectionId = req.params.collectionId;

            let resault = await ProductCollectionRepo.getById(collectionId,company)
          
            return res.send(resault)
        } catch (error: any) {
              throw error
        }
    }

    public static async getList(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company =res.locals.company;
  

            let resault = await ProductCollectionRepo.getList(data,company)
          
            return res.send(resault)
        } catch (error: any) {
              throw error
        } 
    }

}