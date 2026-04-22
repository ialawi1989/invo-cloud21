
import { ResponseData } from '@src/models/ResponseData';

import { BatchProductRepo } from '@src/repo/app/product/productTypes/batchProduct.reps';
import e, { Request, Response, NextFunction } from 'express';

export class BatchController{


// public static async getBatchById(req: Request, res: Response, next: NextFunction)
// {
//     try {
//         const companyId =res.locals.companyId;
//         const batchId = req.params['id']; 
//         const branchProductId = req.params['branchProductId']
//         const batch = await BatchProductRepo.getbatch(companyId,batchId,branchProductId)
//         res.send(batch)
//     } catch (error:any) {
//         res.send(new ResponseData(false,error.message,[]))
//     }
// }

// public static async getBatchListd(req: Request, res: Response, next: NextFunction)
// {
//     try {
//         const companyId =res.locals.companyId;
//         const branchProductId = req.params['branchProductId']
//         const batch = await BatchProductRepo.getbatches(branchProductId,companyId)
//         res.send(batch)
//     } catch (error:any) {
//         res.send(new ResponseData(false,error.message,[]))
//     }
// }

}