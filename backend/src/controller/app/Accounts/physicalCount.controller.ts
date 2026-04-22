
import { DB } from '@src/dbconnection/dbconnection';
import { ProductBatch } from '@src/models/product/ProductBatch';
import { ResponseData } from '@src/models/ResponseData';
import { PhysicalCountRepo } from '@src/repo/app/accounts/physicalCounts.repo';
import { ProductRepo } from '@src/repo/app/product/product.repo';
import { BatchProductRepo } from '@src/repo/app/product/productTypes/batchProduct.reps';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { ViewQueue } from '@src/utilts/viewQueue';
import e, { Request, Response, NextFunction } from 'express';
export class PhysicalCountController {

    public static async addNewPhysicalCount(req: Request, res: Response, next: NextFunction) {
        try {
            console.log(req.body)
            const employeeId = res.locals.user;
            const data = req.body;
            const company = res.locals.company;
            let resault;
            if (data.id == null || data.id == "") {
                console.log("new");
                resault = await PhysicalCountRepo.addNewPhysicalCount(req.body, employeeId, company);
            } else {
                console.log("edit");
                resault = await PhysicalCountRepo.editPhysicalCount(req.body, employeeId, company);
            }
            const queue = ViewQueue.getQueue();
            queue.pushJob()
            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ type: "PhysicalCount", id: resault.data.id, companyId: company.id })
            queueInstance.createJob({ journalType: "Movment", type: "physicalCount", id: resault.data.id })
            return res.send(resault)
        } catch (error: any) {

            throw error
        }
    }
    public static async editPhysicalCount(req: Request, res: Response, next: NextFunction) {
        try {
            const employeeId = res.locals.user;
            const company = res.locals.company;

            const edit = await PhysicalCountRepo.editPhysicalCount(req.body, employeeId, company);
            return res.send(edit)
        } catch (error: any) {

            throw error
        }
    }
    public static async getPhysicalCountList(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let branches: string[] = res.locals.branches;
            const branchId: string | null = req.body.branchId ?? null;
            if (branchId != null) {
                if (!branches.includes(branchId)) {
                    return res.send(new ResponseData(false, "you don't have access to this branch", []));
                }
                branches = [branchId]
            }
            const physicalCountList = await PhysicalCountRepo.getPhysicalCountList(data, company, branches)
            return res.send(physicalCountList)
        } catch (error: any) {
            throw error
        }
    }

    public static async getOpenPhysicalCountList(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let branches: string[] = res.locals.branches;
            const branchId: string | null = req.body.branchId ?? null;
            if (branchId != null) {
                if (!branches.includes(branchId)) {
                    return res.send(new ResponseData(false, "you don't have access to this branch", []));
                }
                branches = [branchId]
            }
            data.status = ['Open']
            const physicalCountList = await PhysicalCountRepo.getPhysicalCountListByStatus(data, company, branches)
            return res.send(physicalCountList)
        } catch (error: any) {
            throw error
        }
    }

    public static async getClosedPhysicalCountList(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let branches: string[] = res.locals.branches;
            const branchId: string | null = req.body.branchId ?? null;
            if (branchId != null) {
                if (!branches.includes(branchId)) {
                    return res.send(new ResponseData(false, "you don't have access to this branch", []));
                }
                branches = [branchId]
            }
            data.status = ['Closed']
            const physicalCountList = await PhysicalCountRepo.getPhysicalCountListByStatus(data, company, branches)
            return res.send(physicalCountList)
        } catch (error: any) {
            throw error
        }
    }
    public static async getCalculatedPhysicalCountList(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            let branches: string[] = res.locals.branches;
            const branchId: string | null = req.body.branchId ?? null;
            if (branchId != null) {
                if (!branches.includes(branchId)) {
                    return res.send(new ResponseData(false, "you don't have access to this branch", []));
                }
                branches = [branchId]
            }
            data.status = ['Calculated']
            const physicalCountList = await PhysicalCountRepo.getPhysicalCountListByStatus(data, company, branches)
            return res.send(physicalCountList)
        } catch (error: any) {
            throw error
        }
    }





    public static async getPhysicalCountbyId(req: Request, res: Response, next: NextFunction) {
        try {

            const physicalCountId = req.params['physicalCountId']
            const companyId = res.locals.company.id
            const physicalCount = await PhysicalCountRepo.getPhysicalCountByID(physicalCountId, companyId)
            return res.send(physicalCount)
        } catch (error: any) {

            throw error
        }
    }
    public static async getPhysicalCountProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company

            const products = await PhysicalCountRepo.getPhysicalCountProducts(data, company)

            return res.send(products)
        } catch (error: any) {

            throw error
        }
    }


    public static async getBranchProductByBarcode(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");

            const data = req.body
            const company = res.locals.company;
            const product = await PhysicalCountRepo.getBranchProductByBarcode(data, company, client);
            const batches = await PhysicalCountRepo.getProductBatches(data.branchId, product.data.id, client);
            product.data.batches = batches.data;
            console.log(product);
            await client.query("COMMIT");
            return res.send(product)
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw error
        } finally {
            client.release()
        }
    }










    public static async getPhysicalCountProductsbyInventory(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const products = await PhysicalCountRepo.getPhysicalCountProductsbyInventory(data)

            return res.send(products)
        } catch (error: any) {

            throw error
        }
    }
    public static async getPhysicalCountProductsbyCategory(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const products = await PhysicalCountRepo.getPhysicalCountProductsbyCategory(data)

            return res.send(products)
        } catch (error: any) {

            throw error
        }
    }

    public static async getPhysicalCountJournal(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const physicalCountId = req.params.physicalCountId;
            const inventoryTransfer = await PhysicalCountRepo.getPhysicalCountJournal(physicalCountId, company);
            return res.send(inventoryTransfer)
        } catch (error: any) {

            throw error
        }
    }


    public static async deletePhysicalCount(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const physicalCountId = req.params.physicalCountId;
            const employeeId = res.locals.user
            const inventoryTransfer = await PhysicalCountRepo.deletePhysicalCount(physicalCountId, company, employeeId);


            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ type: "DeleteJournal", referenceId: physicalCountId })
            queueInstance.createJob({ journalType: "Movment", type: "DeletePhysicalCount", ids: inventoryTransfer.data.ids })


            return res.send(inventoryTransfer)


        } catch (error: any) {
            console.log(error)
            throw error
        }
    }
}