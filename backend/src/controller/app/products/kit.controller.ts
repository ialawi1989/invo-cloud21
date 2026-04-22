
import { ResponseData } from '@src/models/ResponseData';
import { KitProductRepo } from '@src/repo/app/product/productTypes/kitProduct.repo';
import { ViewQueue } from '@src/utilts/viewQueue';
import { Request, Response, NextFunction } from 'express';

export class kitController{
    public static async getMaximumAllowedQty(req: Request, res: Response, next: NextFunction){
        try {
            const branchId = req.body.branchId ;
            const productId = req.body.productId ;
            const getMaximumAllowedQty = await KitProductRepo.getMaximumAllowedQty(productId,branchId)
            return res.send(getMaximumAllowedQty)
        } catch (error:any) {
            throw error
        }
    }
    public static async buildKit(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const employeeId =res.locals.user;
            const build = await KitProductRepo.buildKit(req.body,company,employeeId)
            const queue = ViewQueue.getQueue();
            queue.pushJob()
            return res.send(build)

            
  
        } catch (error:any) {
              throw error
        }
    }
    public static async breakKit(req: Request, res: Response, next: NextFunction){
        try {
            const employeeId =res.locals.user;
            const company = res.locals.company
            const breakKit = await KitProductRepo.breakKit(req.body,employeeId,company)
            const queue = ViewQueue.getQueue();
            queue.pushJob()
            return res.send(breakKit)
        } catch (error:any) {
              throw error
        }
    }
}