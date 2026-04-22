import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import fs from 'fs';
import { SupplierRepo } from '@src/repo/app/accounts/supplier.repo';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { Request, Response, NextFunction } from 'express';
import { RedisClient } from '@src/redisClient';
import { SupplierBalanceQueue } from '@src/repo/triggers/userBalancesQueue';
export class SupplierController {
    public static async addSupplier(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            let resault;
            if (data.id == null || data.id.trim() == "") {
                resault = await SupplierRepo.addSupplier(req.body, company);
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "SupplierOpeningBalance", id: resault.data.id, companyId: company.id })

                let userBalancesQueue = SupplierBalanceQueue.getInstance();
                userBalancesQueue.createJob({ userId: resault.data.id, dbTable: 'SupplierOpeningBalance' })
            } else {
                resault = await SupplierRepo.editSupplier(req.body, company);
            }

            return res.send(resault)
        } catch (error: any) {

                throw error
        }
    }
    public static async getSupplierList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;

            const list = await SupplierRepo.getSupplierList(data, company);
            return res.send(list)
        } catch (error: any) {

                throw error
        }
    }


    public static async getSupplierMiniList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;

            const list = await SupplierRepo.getSupplierMiniList(data, company);
            return res.send(list)
        } catch (error: any) {

                throw error
        }
    }
    public static async getSupplierById(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const supplierId = req.params['supplierId']
            const supplier = await SupplierRepo.getSupplierById(supplierId, company);
            return res.send(supplier)
        } catch (error: any) {

                throw error
        }
    }

    public static async lastPaymentMadeToSupplier(req: Request, res: Response, next: NextFunction) {
        try {

            const supplierId = req.params['supplierId']
            const supplier = await SupplierRepo.lastPaymentMadeToSupplier(supplierId);
            return res.send(supplier)
        } catch (error: any) {

                throw error
        }
    }


    public static async getSupplierBills(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const supplierId = req.params.supplierId;
            const branchId = req.params.branchId;
            const company = res.locals.company;
            let bills

            console.log("BRANCCCCCCCCCCCCC", branchId)
            if (branchId) { bills = await SupplierRepo.getSupplierBills(client, supplierId, branchId) }
            else { bills = await SupplierRepo.getSupplierBillsForAllBranches(supplierId, company.id) }

            await client.query("COMMIT")

            return res.send(bills)
        } catch (error: any) {
            await client.query("ROLLBACK")

                throw error
        } finally {
            client.release()
        }
    }
    public static async getSupplierBillsbyBranch(req: Request, res: Response, next: NextFunction) {
        try {
            const supplierId = req.params.supplierId;
            const branchId = req.params.branchId;

            const bills = await SupplierRepo.getSupplierBillsbyBranch(supplierId, branchId)
            return res.send(bills)
        } catch (error: any) {

                throw error
        }
    }

    public static async getApplyCreditSupplierBills(req: Request, res: Response, next: NextFunction) {
        try {
            const supplierId = req.params.supplierId;


            const bills = await SupplierRepo.getApplyCreditSupplierBills(supplierId)
            return res.send(bills)
        } catch (error: any) {

                throw error
        }
    }
    public static async getSupplierOverView(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const supplierOverView = await SupplierRepo.getSupplierOverView(data, company)
            return res.send(supplierOverView)
        } catch (error: any) {

                throw error
        }
    }

    public static async getSupplierBillingsTransactions(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body
            const company = res.locals.company;
            const bills = await SupplierRepo.getSupplierBillsTransictions(data, company)
            return res.send(bills)
        } catch (error: any) {

                throw error
        }
    }

    public static async getSupplierPaymentsTransactions(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body
            const company = res.locals.company;
            const payments = await SupplierRepo.getSupplierPaymentsTransictions(data, company)
            return res.send(payments)
        } catch (error: any) {

                throw error
        }
    }

    public static async getSupplierCreditsTransactions(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body
            const company = res.locals.company;
            const credits = await SupplierRepo.getSupplierCreditsTransictions(data, company)
            return res.send(credits)
        } catch (error: any) {

                throw error
        }
    }

    public static async getSupplierPurchaseTransactions(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body
            const company = res.locals.company;
            const PurchaseOrders = await SupplierRepo.getSupplierPurchaseOrderTransictions(data, company)
            return res.send(PurchaseOrders)
        } catch (error: any) {

                throw error
        }
    }

    public static async supplierStatement(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company
            const data = req.body
            const invoices = await SupplierRepo.supplierStatement(data, company);
            return res.send(invoices)
        } catch (error: any) {

                throw error
        }
    }

    public static async getSupplierItems(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company
            const data = req.body
            const invoices = await SupplierRepo.getSupplierItemsBySupplierId(data, company);
            return res.send(invoices)
        } catch (error: any) {

                throw error
        }
    }

    public static async getBulkImportProgress(req: Request, res: Response, next: NextFunction) {

        try {


            let redisClient = RedisClient.getRedisClient();
            let company = res.locals.company;

            // await redisClient.deletKey("BulkImport"+company.id)

            let isBulkImport = await redisClient.get("SupplierBulkImport" + company.id)

            if (isBulkImport) {
                let data = JSON.parse(isBulkImport)
                let progress = data.progress;

                return res.send(new ResponseData(false, "A Previouse  Import is Still In Progress: " + progress, { progress: progress }))
            }




            return res.send(new ResponseData(true, "", []))
        } catch (error: any) {

                throw error
        }
    }

    public static async importFromCsv(req: Request, res: Response, next: NextFunction) {
        let redisClient = RedisClient.getRedisClient();
        let company = res.locals.company;
        try {

            let data = req.body;

            let employeeId = res.locals.user;
            let limit: any = process.env.NUMBER_OF_IMPORT_RECOREDS ?? 2000;

            let count = data.length; //3000
            let pageCount = Math.ceil(count / limit)

            let offset = 0;
            let resault = new ResponseData(true, "", [])


            // await redisClient.deletKey("BulkImport"+company.id)

            let isBulkImport = await redisClient.get("SupplierBulkImport" + company.id)

            if (isBulkImport) {
                let data = JSON.parse(isBulkImport)
                let progress = data.progress;
                return res.send(new ResponseData(false, "A Previouse Import is Still In Progress: " + progress, []))
            }


            for (let index = 0; index < pageCount; index++) {

                // if (page != 0) {
                //     offset = (limit * (page - 1))
                // }


                let supplier: any = data.splice(offset, limit)

                resault = await SupplierRepo.importFromCVS(supplier, company, employeeId, index + 1, count)

                if (resault.success && index + 1 == pageCount) {
                    await redisClient.deletKey("SupplierBulkImport" + company.id)
                }
            }



            return res.send(new ResponseData(true, "", []))
        } catch (error: any) {
            await redisClient.deletKey("SupplierBulkImport" + company.id)
                throw error
        }
    }


    public static async exprotSuppliers(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const type = req.params.type;

            console.log(req);

            const result = await SupplierRepo.exprotSuppliers(company);

            res.download(result)
            try {
                res.on('finish', () => {
                    fs.unlinkSync(result);
                });

            } catch (error: any) {
                    throw error;
            }


        } catch (error: any) {
                throw error;
        }
    }

    public static async getSupplierItemCost(req: Request, res: Response, next: NextFunction) {
        try {

            const productId = req.params.productId
            const supplierId = req.params.supplierId
            const result = await SupplierRepo.getSupplierCost(supplierId, productId);

            return res.send(result)
        } catch (error: any) {
                throw error;
        }
    }


    public static async getSupplierPayableByBranch(req: Request, res: Response, next: NextFunction) {
        try {

            const branchId = req.params.branchId
            const supplierId = req.params.supplierId
            const result = await SupplierRepo.getSupplierPayableByBranch(branchId, supplierId);

            return res.send(result)
        } catch (error: any) {
                throw error;
        }
    }


    public static async getMiniSuppliersByIds(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;

            let resData = await SupplierRepo.getMiniSuppliersByIds(data, company);
            return res.send(resData);
        } catch (error: any) {
                throw error;
        }
    }


    public static async addSupplierItem(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;

            let resData = await SupplierRepo.addSupplierItem(data, company);
            return res.send(resData);
        } catch (error: any) {
                throw error;
        }
    }

    public static async deleteSupplierItem(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;

            let resData = await SupplierRepo.deleteSupplierItemByProductId(data, company);
            return res.send(resData);
        } catch (error: any) {
                throw error;
        }
    }

    public static async getSupplierProductsByBranch(req: Request, res: Response, next: NextFunction) {

        try {

            const supplierId = req.params.supplierId;
            const branchId = req.params.branchId;
            const bills = await SupplierRepo.getSupplierProductsByBranch(supplierId, branchId)


            return res.send(bills)
        } catch (error: any) {

                throw error
        }
    }


    public static async exportSuppliersOpeningBalance(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const branchId = req.params.branchId;
            const type = req.params.type;

            console.log(req);

            const result = await SupplierRepo.exportSupplierOpeningBalance(branchId, company, type);

            res.download(result)
            try {
                res.on('finish', () => {
                    fs.unlinkSync(result);
                });

            } catch (error: any) {
                    throw error;
            }


        } catch (error: any) {
                throw error;
        }
    }

    public static async importSupplierOpeningBalance(req: Request, res: Response, next: NextFunction) {

        try {

            const data = req.body
            const company = res.locals.company
            const bills = await SupplierRepo.importSuppliersOpeningBalance(data, company);
            
            return res.send(bills)
        } catch (error: any) {

                throw error
        }
    }
}
