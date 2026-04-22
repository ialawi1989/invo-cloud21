
import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { PurchaseOrderRepo } from '@src/repo/app/accounts/PurchaseOrder.Repo';
import { purchaseOrderStatuesQueue } from '@src/repo/triggers/queue/workers/purchaseOrder.worker';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { PDFGenerator } from '@src/utilts/PDFGenerator';
import { ViewQueue } from '@src/utilts/viewQueue';
import e, { Request, Response, NextFunction } from 'express';
export class PurchaseOrderController {

    public static async savePurchaseOrder(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client()
        try {
            const data = req.body;
            const company = res.locals.company;
            const employeeId = res.locals.user;
            let resault;
            await client.query("BEGIN")
            if (data.id == null || data.id == "") {
                resault = await PurchaseOrderRepo.addPurchaseOrder(client, data, company, employeeId)
            } else {
                resault = await PurchaseOrderRepo.editPurchaseOrder(client, data, company, employeeId)


            }
            await client.query("COMMIT")
            purchaseOrderStatuesQueue.get().createJob({
                id: resault.data.id
            } as any);
            return res.send(resault)
        } catch (error: any) {
            await client.query("ROLLBACK")

                 throw error
        } finally {
            client.release()
        }
    }




    public static async getPoPdf(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;

            const pdfBuffer = await PDFGenerator.poPdfGenerator(req.params.id)
            // res.send(pdfBuffer);
            // Send the PDF buffer as the response
            // return res.send(new ResponseData(true, "", pdfBuffer));
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename=invoice_${req.params.id}.pdf`);
            res.send(pdfBuffer); // Not res.json
            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }




















    public static async getPurchaseOrderById(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const purchaseOrderId = req.params.purchaseOrderId;
            const list = await PurchaseOrderRepo.getPurchaseOrderById(purchaseOrderId, company)
            return res.send(list)
        } catch (error: any) {

                 throw error
        }
    }

    public static async getRecommendedPurchaseProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const list = await PurchaseOrderRepo.getRecommendedPurchaseProducts(data, company)
            return res.send(list)
        } catch (error: any) {

                 throw error
        }
    }
    public static async getRecommendedPurchaseProdPerSup(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const list = await PurchaseOrderRepo.getRecommendedPurchaseProdPerSup(data, company)
            return res.send(list)
        } catch (error: any) {

                 throw error
        }
    }

    public static async convertToBill(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const employeeId = res.locals.user;
            const convert = await PurchaseOrderRepo.convertToBilling(data, company, employeeId)

            const queue = ViewQueue.getQueue();
            queue.pushJob();
            if (data.status != 'Draft') {
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "Billings", id: convert.data.id, companyId: company.id })
                queueInstance.createJob({ journalType: "Movment", type: "billing", id: convert.data.id })
                purchaseOrderStatuesQueue.get().createJob({
                    id: data.purchaseOrderId
                } as any);
            }

            return res.send(convert)
        } catch (error: any) {

                 throw error
        }
    }
    public static async getPurchaseOrderList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            const branches = res.locals.branches
            const list = await PurchaseOrderRepo.getPurchaseOrderList(data, company, branches)
            return res.send(list)
        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }






    public static async getOpenPurchaseOrderList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            let branches: string[] = res.locals.branches;
            const branchId: string | null = req.body.branchId ?? null;
            if (branchId != null) {
                if (!branches.includes(branchId)) {
                    return res.send(new ResponseData(false, "you don't have access to this branch", []));
                }
                branches = [branchId]
            }
            const list = await PurchaseOrderRepo.getOpenPurchaseOrderList(data, company, branches)
            return res.send(list)
        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }



    public static async getClosedPurchaseOrderList(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body;
            let branches: string[] = res.locals.branches;
            const branchId: string | null = req.body.branchId ?? null;
            if (branchId != null) {
                if (!branches.includes(branchId)) {
                    return res.send(new ResponseData(false, "you don't have access to this branch", []));
                }
                branches = [branchId]
            }
            const list = await PurchaseOrderRepo.getClosedPurchaseOrderList(data, company, branches)
            return res.send(list)
        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }













    public static async getPurchaseProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const list = await PurchaseOrderRepo.getPurchaseProductList(data, company)
            return res.send(list)
        } catch (error: any) {

                 throw error
        }
    }

    public static async getPurchaseProductByBarcode(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const list = await PurchaseOrderRepo.getPurchaseProductByBarcode(data, company)
            return res.send(list)
        } catch (error: any) {

                 throw error
        }
    }


    public static async getInventoryRequestProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const list = await PurchaseOrderRepo.getInventoryRequestProducts(data, company)
            return res.send(list)
        } catch (error: any) {

                 throw error
        }
    }
    public static async getPurchaseAccounts(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const list = await PurchaseOrderRepo.getPurchaseAccounts(company)
            return res.send(list)
        } catch (error: any) {

                 throw error
        }
    }
    public static async getPurchaseNumber(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const branchId = req.params.branchId;
            const list = await PurchaseOrderRepo.getPurchaseNumber(branchId, company)
            return res.send(list)
        } catch (error: any) {

                 throw error
        }
    }

    public static async deletePurchaseOrder(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const prurchaseOrderId = req.params.prurchaseOrderId;
            const user = res.locals.user;
            const list = await PurchaseOrderRepo.deletePurchaseOrder(prurchaseOrderId, company, user)
            return res.send(list)
        } catch (error: any) {

                 throw error
        }
    }

    public static async sendPurchaseOrderEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            data.type = 'PO'
            const pdfBuffer = await PurchaseOrderRepo.sendEmail(data, company)

            // Send the PDF buffer as the response
            return res.send(pdfBuffer);

            // res.send (pdfBuffer)
        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }
    public static async viewPurchaseOrderPdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                purchaseOrderId: req.params.purchaseOrderId
            }
            const company = res.locals.company;

            const pdfBuffer = await PurchaseOrderRepo.getPdf(data, company)

            // Send the PDF buffer as the response
            return res.send(new ResponseData(true, "", pdfBuffer));

            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }
    public static async convertAutoPurchase(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const data = req.body;
            const user = res.locals.user
            const pdfBuffer = await PurchaseOrderRepo.convertToPurchaseOrder(data, company, user)

            // Send the PDF buffer as the response
            return res.send(pdfBuffer);

            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                 throw error
        }
    }
}