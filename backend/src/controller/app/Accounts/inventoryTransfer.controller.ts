import { ResponseData } from '@src/models/ResponseData';
import { inventoryTransferRepo } from '@src/repo/app/accounts/inventoryTransfer.repo';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { ViewQueue } from '@src/utilts/viewQueue';
import { Request, Response, NextFunction } from 'express';
export class inventoryTransferContoller {



    public static async addNewInventoryTransfer(req: Request, res: Response, next: NextFunction) {
        try {
            const employeeId = res.locals.user;
            const data = req.body;
            const company = res.locals.company
            let resault;
            if (data.id == null || data.id == "") {
                resault = await inventoryTransferRepo.addNewInventoryTransfer(req.body, employeeId, company);
            } else {
                resault = await inventoryTransferRepo.editInventoryTransfer(req.body, employeeId, company);
            }
            const queue = ViewQueue.getQueue();
            queue.pushJob()


            if (data.status == 'Confirmed') {
                let queueInstance = TriggerQueue.getInstance();

                queueInstance.createJob({ type: "InventoryTransfer", id: resault.data.id, companyId: company.id, destinationBranch: data.destinationBranch })

                queueInstance.createJob({ journalType: "Movment", type: "trensfer", id: resault.data.id })

                queueInstance.createJob({ journalType: "Movment", type: "parentChildMovmentInventoryTransfer", ids: [resault.data.id] })

            }
            return res.send(resault)
        } catch (error: any) {
            console.log(error)
            throw error
        }
    }
    public static async getInventoryTransferList(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body
            const company = res.locals.company;
            const branches = res.locals.branches;
            const list = await inventoryTransferRepo.getInventoryTransferList(data, company, branches);
            return res.send(list)
        } catch (error: any) {

            throw error
        }
    }


    public static async getInventoryTransferOutList(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body
            const company = res.locals.company;
            let branches: string[] = res.locals.branches;
            const branchId: string | null = req.body.branchId ?? null;
            if (branchId != null) {
                if (!branches.includes(branchId)) {
                    return res.send(new ResponseData(false, "you don't have access to this branch", []));
                }
                branches = [branchId]
            }
            const list = await inventoryTransferRepo.getInventoryTransferOutList(data, company, branches);
            return res.send(list)
        } catch (error: any) {

            throw error
        }
    }








    public static async getInventoryTransferById(req: Request, res: Response, next: NextFunction) {
        try {
            const inventoryTransferId = req.params['inventoryTransferId'];
            const companyId = res.locals.company.id
            const inventoryTransfer = await inventoryTransferRepo.getInventoryTransferById(inventoryTransferId, companyId);
            return res.send(inventoryTransfer)
        } catch (error: any) {

            throw error
        }
    }
    public static async getTransferNumber(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const branchId = req.params.branchId;
            const inventoryTransfer = await inventoryTransferRepo.getTransferNumber(branchId, company);
            return res.send(inventoryTransfer)
        } catch (error: any) {

            throw error
        }
    }

    public static async getBatchWastageProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const inventoryTransfer = await inventoryTransferRepo.getBatchWastageProducts(data, company);
            return res.send(inventoryTransfer)
        } catch (error: any) {

            throw error
        }
    }


    public static async getTransferJournal(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const transferId = req.params.transferId;
            const inventoryTransfer = await inventoryTransferRepo.getTransferJournal(transferId, company);
            return res.send(inventoryTransfer)
        } catch (error: any) {

            throw error
        }
    }
}