import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { InvoiceRepo } from '@src/repo/app/accounts/invoice.repo';
import { SocketInvoiceRepo } from '@src/repo/socket/invoice.socket';
import { PDFGenerator } from '@src/utilts/PDFGenerator';
import { ViewQueue } from '@src/utilts/viewQueue';
import { InvoiceValidation } from '@src/validationSchema/account/invoice.Schema';
import { Request, Response, NextFunction } from 'express';
export class pdfController {
 public static async InvoicePdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                id:req.params.id,
                type:"invoice"
            }
            const pdfGenerator = new PDFGenerator()
            const pdfBuffer = await pdfGenerator.getPdf(data);
            const buffer = Buffer.from(pdfBuffer as any as any, 'base64');
            res.setHeader('Content-Type', 'application/pdf');
            return res.send (buffer)
        } catch (error: any) {
            console.log(error);
             throw error
        }
    }
 public static async POPdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                id:req.params.id,
                type:"PO"
            }
            const pdfBuffer = await InvoiceRepo.getPdf(data) 
            const buffer = Buffer.from(pdfBuffer as any as any, 'base64');
            res.setHeader('Content-Type', 'application/pdf');
            return res.send (buffer)
        } catch (error: any) {
            console.log(error);
             throw error
        }
    }
 public static async billsPdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                id:req.params.id,
                type:"bills"
            }
            const pdfBuffer = await InvoiceRepo.getPdf(data) 
            const buffer = Buffer.from(pdfBuffer as any, 'base64');
            res.setHeader('Content-Type', 'application/pdf');
            return res.send (buffer)
        } catch (error: any) {
            console.log(error);
             throw error
        }
    }
 public static async billPaymentPdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                id:req.params.id,
                type:"billPayment"
            }
            const pdfBuffer = await InvoiceRepo.getPdf(data) 
            const buffer = Buffer.from(pdfBuffer as any, 'base64');
            res.setHeader('Content-Type', 'application/pdf');
            return res.send (buffer)
        } catch (error: any) {
            console.log(error);
             throw error
        }
    }
 public static async invoicePaymentPdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                id:req.params.id,
                type:"invoicePayment"
            }
            const pdfBuffer = await InvoiceRepo.getPdf(data) 
            const buffer = Buffer.from(pdfBuffer as any, 'base64');
            res.setHeader('Content-Type', 'application/pdf');
            return res.send (buffer)
        } catch (error: any) {
            console.log(error);
             throw error
        }
    }
 public static async estimatePdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                id:req.params.id,
                type:"estimate"
            }
            const pdfBuffer = await InvoiceRepo.getPdf(data) 
            const buffer = Buffer.from(pdfBuffer as any, 'base64');
            res.setHeader('Content-Type', 'application/pdf');
            return res.send (buffer)
        } catch (error: any) {
            console.log(error);
             throw error
        }
    }
 public static async creditNotePdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                id:req.params.id,
                type:"creditNote"
            }
            const pdfBuffer = await InvoiceRepo.getPdf(data) 
            const buffer = Buffer.from(pdfBuffer as any, 'base64');
            res.setHeader('Content-Type', 'application/pdf');
            return  res.send (buffer)
        } catch (error: any) {
            console.log(error);
             throw error
        }
    }
 public static async supplierCreditNotePdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                id:req.params.id,
                type:"supplierCreditNote"
            }
            const pdfBuffer = await InvoiceRepo.getPdf(data) 
            const buffer = Buffer.from(pdfBuffer as any, 'base64');
            res.setHeader('Content-Type', 'application/pdf');
            return res.send (buffer)
        } catch (error: any) {
            console.log(error);
             throw error
        }
    }


    public static async expensePdf(req: Request, res: Response, next: NextFunction) {
        try {
            const data = {
                id:req.params.id,
                type:"expense"
            }
            const pdfBuffer = await InvoiceRepo.getPdf(data) 
            const buffer = Buffer.from(pdfBuffer as any, 'base64');
            res.setHeader('Content-Type', 'application/pdf');
            return res.send (buffer)
        } catch (error: any) {
            console.log(error);
             throw error
        }
    }
















}