import { ResponseData } from '@src/models/ResponseData';
import { SupplierRepo } from '@src/repo/app/accounts/supplier.repo';
import { SupplierAppliedCreditRepo } from '@src/repo/app/accounts/supplierAppliedCredit.repo';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { SupplierBalanceQueue } from '@src/repo/triggers/userBalancesQueue';
import { ViewQueue } from '@src/utilts/viewQueue';
import { Request, Response, NextFunction } from 'express';

export class SupplierAppliedCreditController {
    public static async applyCredit(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company =res.locals.company;
            const employeeId =res.locals.user;

             let queueInstance = TriggerQueue.getInstance();
             let userBalancesQueue = SupplierBalanceQueue.getInstance();
             
    
            let resault = new ResponseData(true,"",[]);
            for (let index = 0; index < data.length; index++) {
                const element = data[index];
                if (element.amount > 0) {
                    if (element.reference == "SupplierCredit") {
                        resault = await SupplierAppliedCreditRepo.applyCredit(element, company,employeeId)
                         queueInstance.createJob({type:"SupplierAppliedCredit",id:resault.data.id,companyId:company.id})
                         userBalancesQueue.createJob({ transactionId: resault.data.id, dbTable: 'SupplierAppliedCredits' })

                    } else if (element.reference == "BillingPayment") {
                        resault = await SupplierAppliedCreditRepo.applyPrepaidExpenseCredit(element, company,employeeId)
                        queueInstance.createJob({type:"BillingPayments",id:element.id,companyId:company.id})
                         userBalancesQueue.createJob({ transactionId: resault.data.id, dbTable: 'SupplierAppliedCredits' })

                    }
                    // const queue = ViewQueue.getQueue();
                    // queue.pushJob()
                    queueInstance.createJob({ type: "updateBillStatus", ids: [element.billingId], companyId: company.id })
                }

            }
            
            return res.send(resault)
        } catch (error: any) {
            
                 throw error
        }
    }

    public static async AvailableCreditsList(req: Request, res: Response, next: NextFunction) {
        try {

            const supplierId = req.params.supplierId;

            const list = await SupplierAppliedCreditRepo.getAvailableCreditList(supplierId)
            return res.send(list);
        } catch (error: any) {
            
                 throw error
        }
    }

    public static async getSupplierCredit(req: Request, res: Response, next: NextFunction) {
        try {

            const supplierId = req.params.supplierId;
            const company =res.locals.company;
            const resault = await SupplierRepo.supplierCredit(supplierId, company)
            return res.send(resault);
        } catch (error: any) {
            
                 throw error
        }
    }


    public static async deleteAppliedCredit(req: Request, res: Response, next: NextFunction) {
        try {
            const appliedCreditId = req.params.appliedCreditId;
            const company = res.locals.company
            const employeeId = res.locals.user
            const resData = await SupplierAppliedCreditRepo.deleteAppliedCredit(appliedCreditId,company,employeeId)


            if (resData.success) {
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "DeleteJournal", referenceId: appliedCreditId })
                 
                let userBalancesQueue = SupplierBalanceQueue.getInstance();
                userBalancesQueue.createJob({transactionId: appliedCreditId, dbTable: 'SupplierAppliedCredits' })
                           


            }

            return res.send(new ResponseData(true,"",[]))

        } catch (error: any) {

                 throw error
        }
    }
}