
import { ResponseData } from '@src/models/ResponseData';
import { CreditNoteRefundRepo } from '@src/repo/app/accounts/creditNoteRefund.repo';
import { SocketRefund } from '@src/repo/socket/refund.socket';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { CustomerBalanceQueue } from '@src/repo/triggers/userBalancesQueue';
import { ViewQueue } from '@src/utilts/viewQueue';
import { Request, Response, NextFunction } from 'express';
export class RefoundController {
    public static async saveRefund(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const employeeId = res.locals.user;
            const data = req.body;
            let resault;
            data.employeeId = employeeId;
            if (data.id == null || data.id == "") {

                resault = await CreditNoteRefundRepo.saveRefund(data, company)
            }


            const queue = ViewQueue.getQueue();
            queue.pushJob()

            let queueInstance = TriggerQueue.getInstance();
            if (resault) {
                queueInstance.createJob({ type: "CreditNoteRefunds", id: [resault.data.id], companyId: company.id })
                let userBalancesQueue = CustomerBalanceQueue.getInstance();
                userBalancesQueue.createJob({ transactionId: resault.data.id, dbTable: 'CreditNoteRefunds' })
            }
            return res.send(resault)
        } catch (error: any) {

                 throw error
        }
    }
    public static async getRefoundedList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const refounds = await CreditNoteRefundRepo.getRefundedList(company)
            return  res.send(refounds)
        } catch (error: any) {

                 throw error
        }
    }
    public static async getRefundById(req: Request, res: Response, next: NextFunction) {
        try {
            const refundId = req.params.refundId;
            const refund = await CreditNoteRefundRepo.getRefundById(refundId)
            return res.send(refund)
        } catch (error: any) {

                 throw error
        }
    }
    public static async getCustomerCreditNotes(req: Request, res: Response, next: NextFunction) {
        try {
            const customerId = req.params.customerId;
            const refund = await CreditNoteRefundRepo.getCustomerCreditNote(customerId)
            return  res.send(refund)
        } catch (error: any) {

                 throw error
        }
    }

    public static async getPosRefunds(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.body.branchId;
            const creditNoteIds = req.body.creditNoteIds;
            const refund = await SocketRefund.getPosRefunds(branchId,creditNoteIds)
            return  res.send(refund)
        } catch (error: any) {

                 throw error
        }
    }

    public static async getsocketLogCreditNotes(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.body.branchId;
            const creditNoteIds = req.body.creditNoteIds;
            const refund = await SocketRefund.getMissingCreditNotes(req.body)
            return   res.send(refund)
        } catch (error: any) {

                 throw error
        }
    }

}