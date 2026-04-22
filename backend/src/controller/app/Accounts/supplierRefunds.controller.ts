import { ResponseData } from '@src/models/ResponseData';
import { SupplierRefundsRepo } from '@src/repo/app/accounts/supplierRefunds.repo';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { SupplierBalanceQueue } from '@src/repo/triggers/userBalancesQueue';
import { ViewQueue } from '@src/utilts/viewQueue';
import { Request, Response, NextFunction } from 'express';
export class SupplierRefundController{
    public static async saveRefund(req: Request, res: Response, next: NextFunction){
        try {
            const company=res.locals.company;
            const employeeId = res.locals.user;
            let data = req.body;
            data.employeeId = employeeId;
            const resault = await SupplierRefundsRepo.saveSupplierRefund(req.body,company)


            const queue = ViewQueue.getQueue();
            queue.pushJob()

            
            if (resault) {
                    let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({type:"SupplierRefunds",id:resault.data.id,companyId:company.id})
                let userBalancesQueue = SupplierBalanceQueue.getInstance();
                userBalancesQueue.createJob({ transactionId: resault.data.id, dbTable: 'SupplierRefunds' })
            }
                        
            
            
            return res.send(resault)
        } catch (error:any) {
            
                 throw error
        }
    }
}