import { ResponseData } from '@src/models/ResponseData';
import { WorkOrderRepo } from '@src/repo/app/accounts/workOrder.repo';
import { Request, Response, NextFunction } from 'express';
export class WorkOrderController {
    // public static async saveWorkOrder(req: Request, res: Response, next: NextFunction){
    //     try {
    //         const company =res.locals.company;
    //         const data = req.body;
    //         let resault;

    //         if(data.id == null || data.id =="")
    //         {
    //             resault = await WorkOrderRepo.saveWorkOrder(data)
    //         }else{
    //             resault = await WorkOrderRepo.editWorkOrder(data)
    //         }
            
    //         return res.send(resault)
    //     } catch (error:any) {
            
    //         throw error
    //     }
    // }
    public static async getWorkOrders(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const resault = WorkOrderRepo.getWorkOrderList(data,company)
            
            return res.send(resault)
        } catch (error:any) {
            
            throw error
        }  
    }
    public static async getWorkOrderById(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const workOrderId = req.params.workOrderId;
            const resault = WorkOrderRepo.getWorkOrderById(workOrderId)
            
            return res.send(resault)
        } catch (error:any) {
            
            throw error
        }  
    }
}