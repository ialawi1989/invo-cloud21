import { Request, Response, NextFunction } from 'express';
import { ResponseData } from '@src/models/ResponseData';
import { InventoryRequestRepo } from '@src/repo/app/accounts/InventoryRequest.repo';
import { InventoryMovmentRepo } from '@src/repo/app/accounts/inventoryMovment.repo';
import { ViewQueue } from '@src/utilts/viewQueue';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { InventoryMovment } from '@src/models/account/InventoryMovment';
import { Helper } from '@src/utilts/helper';
import { InventoryMovmentLine } from '@src/models/account/InventoryMovmentLine';
import { ValidationException } from '@src/utilts/Exception';
import { BranchesRepo } from '@src/repo/admin/branches.repo';
export class InventoryMovementController {

    public static async saveManualAdjustmentMovement(req: Request, res: Response, next: NextFunction) {
        try {
            const employeeId = res.locals.user;
            const data = req.body;
            const company = res.locals.company
            // if (data.branchId){
            //     throw new ValidationException("branchId is required")
            // }
            let movment;
            const movmentIds: any[] = [];

            if (data.id == null || data.id == "") {

                if (data.adjustmentType == 'unitCost adjustment' && (!data.branchId)) {
                    const companyBranches = await InventoryMovmentRepo.getCompanyBranchIds(company.id)
                    for (let index = 0; index < companyBranches.length; index++) {
                        const element = companyBranches[index];
                        data.branchId = element
                        movment = await InventoryMovmentRepo.addManualAdjustmentMovement(data, employeeId, company);
                        if (movment.success && movment.data) {
                            movmentIds.push(movment.data.id)
                        }
                    }
                } else {

                    movment = await InventoryMovmentRepo.addManualAdjustmentMovement(data, employeeId, company);
                    if (movment.success && movment.data) {
                        movmentIds.push(movment.data.id)
                    }
                }
            } else {
                movment = await InventoryMovmentRepo.editManualAdjustmentMovement(data, employeeId, company);
                if (movment.success && movment.data) {
                    movmentIds.push(movment.data.id)
                }

            }

            if (movmentIds && movmentIds.length > 0) {
                let queueInstance = TriggerQueue.getInstance();
                if (data.adjustmentType == 'unitCost adjustment') {
                    queueInstance.createJob({ type: "costMovments", movmentIds: movmentIds, companyId: company.id, branchIds: [data.branchId] })
                }
                queueInstance.createJob({ journalType: "Movment", type: "manualAdjusment", ids: movmentIds, adjustmentType: data.adjustmentType })
            }



            return res.send(movment)
        } catch (error: any) {
            console.log(error)
            throw error
        }
    }

    public static async getManualAdjustmentMovementList(req: Request, res: Response, next: NextFunction) {

        try {
            const company = res.locals.company;

            const data = req.body;
            const branches = res.locals.branches;
            let resault = await InventoryMovmentRepo.getManualAdjustmentMovementList(data, company, branches);
            return res.send(resault)

        } catch (error: any) {


            throw error

        }
    }

    public static async getManualAdjustmentMovementById(req: Request, res: Response, next: NextFunction) {
        try {
            const movmentId = req.params.movmentId;
            const company = res.locals.company
            const inventoryTransfer = await InventoryMovmentRepo.getManualAdjustmentMovementById(movmentId, company);
            return res.send(inventoryTransfer)
        } catch (error: any) {

            throw error
        }
    }

    public static async deleteManualAdjustmentMovement(req: Request, res: Response, next: NextFunction) {
        try {
            const movmentId = req.params.movmentId;
            const company = res.locals.company;
            const employeeId = res.locals.user
            const resData = await InventoryMovmentRepo.deleteManualAdjustmentMovement(movmentId, employeeId)


            if (resData.success) {
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ journalType: "Movment", type: "Delete", ids: resData.data.ids })
            }

            return res.send(new ResponseData(true, "", []))

        } catch (error: any) {

            throw error
        }
    }

    public static async getManualAdjustmentProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const employeeId = res.locals.user
            const resData = await InventoryMovmentRepo.getManualAdjustmentProducts(data, company)


            return res.send(resData)

        } catch (error: any) {

            throw error
        }
    }

    public static async getManualAdjustmentProductsByBarcodes(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const branchId = req.body.branchId;
            const products = req.body.products;

            if (!branchId) {
                return res.send(new ResponseData(false, "Branch Id is Required", []));
            }


            if (!products || !Array.isArray(products)) {
                return res.send(new ResponseData(false, "Products must be an array", []));
            }
            const employeeId = res.locals.user;
            const resData = await InventoryMovmentRepo.getManualAdjustmentProductsByBarcodes(company, branchId, products);
            return res.send(resData)

        } catch (error: any) {

            throw error
        }
    }


    public static async getManualAdjustmentMovementJournal(req: Request, res: Response, next: NextFunction) {
        try {
            const manualAdjustmentId = req.params.movmentId;

            const resData = await InventoryMovmentRepo.getManualAdjustmentMovementJournal(manualAdjustmentId)


            return res.send(resData)

        } catch (error: any) {

            throw error
        }
    }
}