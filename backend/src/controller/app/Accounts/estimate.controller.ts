import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { EstimateRepo } from '@src/repo/app/accounts/estimate.repo';
import { ViewQueue } from '@src/utilts/viewQueue';
import { Request, Response, NextFunction } from 'express';
import { EstimateValidation } from "@src/validationSchema/account/Estimate.Schema";
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { PDFGenerator } from '@src/utilts/PDFGenerator';
import { InvoiceStatuesQueue } from '@src/repo/triggers/queue/workers/invoiceStatus.worker';

export class EstimateController {
    public static async addEstimate(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client();
        try {

            const company = res.locals.company;
            const employeeId = res.locals.user
            const data = req.body;
            let result;
            await client.query("BEGIN");
            if (data.id != null && data.id != "") {
                const validate = await EstimateValidation.estimateValidation(data);
                if (!validate.valid) {
                    throw new Error(validate.error);
                }
                result = await EstimateRepo.editEstimate(client, data, company, employeeId)

            } else {

                data.employeeId = employeeId;
                const validate = await EstimateValidation.estimateValidation(data);
                if (!validate.valid) {
                    throw new Error(validate.error);
                }

                result = await EstimateRepo.addEstimate(client, data, company)

            }

            await client.query("COMMIT");
            return res.send(result)
        } catch (error: any) {
            await client.query("ROLLBACK");
                throw error
        } finally {
            client.release()
        }
    }





    public static async getEstimatePdf(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;

            const pdfBuffer = await PDFGenerator.estimatePdfGenerator(req.params.id)
            // res.send(pdfBuffer);
            // Send the PDF buffer as the response
            // return res.send(new ResponseData(true, "", pdfBuffer));
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename=invoice_${req.params.id}.pdf`);
            res.send(pdfBuffer); // Not res.json
            // res.send (pdfBuffer)

            // let chunks: Buffer[] = [];
            // pdfBuffer.on("data", (chunk:any) => {
            //     chunks.push(chunk);
            // });

            // pdfBuffer.on("end", () => {
            //     const result = Buffer.concat(chunks);

            //     res.setHeader("Content-Type", "application/pdf");
            //     res.setHeader("Content-Disposition", "inline; filename=example.pdf");

            //     res.send(result);
            // });

            // pdfBuffer.end();


        } catch (error: any) {
            console.log(error);
                throw error
        }
    }




    // public static async editEstimate(req: Request, res: Response, next: NextFunction){
    //     try {
    //         const company =res.locals.company;
    //         const employeeId =res.locals.user
    //         const edit = await EstimateRepo.editEstimate(req.body,company)
    //         return res.send(edit) 
    //     } catch (error:any) {

    //           throw error
    //     }
    // }
    public static async getEstimateById(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;

            const estimateId = req.params['estimateId']
            const estimate = await EstimateRepo.getEstimateById(estimateId, company)
            return res.send(estimate)
        } catch (error: any) {

                throw error
        }
    }
    public static async convertToInvoice(req: Request, res: Response, next: NextFunction) {
        try {
            const employeeId = res.locals.user;
            const company = res.locals.company;
            const invoice = await EstimateRepo.convertToInvoice(req.body, employeeId, company)
            const queue = ViewQueue.getQueue();
            queue.pushJob()
            if (req.body.status != "Draft") {
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "Invoices", id: [invoice.data.invoice.id], companyId: company.id })
                // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [invoice.data.invoice.id] })
                InvoiceStatuesQueue.get().createJob({
                    id: invoice.data.invoice.id
                } as any);
                queueInstance.createJob({ journalType: "Movment", type: "invoice", id: [invoice.data.invoice.id] })
                queueInstance.createJob({ journalType: "Movment", type: "parentChildMovment", ids: [invoice.data.invoice.id] })
            }

            return res.send(invoice)

        } catch (error: any) {

                throw error
        }
    }
    public static async getEstimates(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const data = req.body
            const branches = res.locals.branches
            const estimates = await EstimateRepo.getEstimates(data, company, branches);
            return res.send(estimates)
        } catch (error: any) {

                throw error
        }
    }
    public static async getEstimateNumber(req: Request, res: Response, next: NextFunction) {
        try {
            const branchId = req.params.branchId;
            const company = res.locals.company;
            const estimates = await EstimateRepo.getEstimateNumber(branchId, company);
            return res.send(estimates)
        } catch (error: any) {

                throw error
        }
    }
        public static async deleteEstimate(req: Request, res: Response, next: NextFunction){
        try {
           const id = req.params.id;
           const company =res.locals.company;
           const user =res.locals.user;
           const estimates = await EstimateRepo.deleteEstimate(id,company.id,user);
           return res.send(estimates) 
        }catch (error:any) {
            
              throw error
        }
    }
    public static async sendEstimateEmail(req: Request, res: Response, next: NextFunction) {
        try {
            const data = req.body;
            const company = res.locals.company;
            const pdfBuffer = await EstimateRepo.sendEmail(data, company)


            // Send the PDF buffer as the response
            return res.send(pdfBuffer);

            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                throw error
        }
    }
    public static async viewEstimatePdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                estimateId: req.params.estimateId
            }
            const company = res.locals.company;

            const pdfBuffer = await EstimateRepo.getPdf(data, company)

            // Send the PDF buffer as the response
            return res.send(new ResponseData(true, "", pdfBuffer));

            // res.send (pdfBuffer)


        } catch (error: any) {
            console.log(error);
                throw error
        }
    }
}