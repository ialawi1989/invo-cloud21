
import { ResponseData } from '@src/models/ResponseData';


import { Request, Response, NextFunction } from 'express';
import { SerialProductRepo } from '@src/repo/app/product/productTypes/serilizedProduct.repo';
export class SerialController{




    // public static async getAllserials(req:Request,res:Response, next: NextFunction){
    //     try {
    //         const companyId =res.locals.companyId;
    //         const branchProductId = req.params['branchProductId']; 
    //         const list = await SerialProductRepo.getSerialList(branchProductId,companyId);
    //         res.send(list)
    //     } catch (error:any) {
    //         return res.send(new ResponseData(false,error.message,[]))
    //     }
    // }
    // public static async getserial(req:Request,res:Response, next: NextFunction){
    //     try {
    //         const companyId =res.locals.companyId;
    //         const branchProductId = req.params['branchProductId']; 
    //         const serialId = req.params['id']; 
    //         const list = await SerialProductRepo.getSerial(branchProductId,serialId,companyId);
    //         res.send(list)
    //     } catch (error:any) {
    //         return res.send(new ResponseData(false,error.message,[]))
    //     }
    // }

    // public static async editSerial(req:Request,res:Response, next: NextFunction){
    //     try {
    //         const companyId =res.locals.companyId;
    //         const data :any = req.body;
    //         data.companyId = companyId;
    //         const edit = await SerialProductRepo.editSerial(req.body,companyId);
    //         res.send(edit)
    //     } catch (error:any) {
    //         return res.send(new ResponseData(false,error.message,[]))
    //     }
    // }

}