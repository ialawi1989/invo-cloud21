import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { PaymnetMethodRepo } from "@src/repo/app/accounts/paymentMethod.repo";
import { Request, Response, NextFunction } from 'express';

export class PaymnetMethodController{
    public static async savePaymentMethod(req: Request, res: Response, next: NextFunction){
        const client = await DB.excu.client()
        try {
            const company =res.locals.company;
            const data = req.body; 
            let resault ; 
            await client.query("BEGIN")
            if(data.id == "" || data.id==null)
            {
                resault = await PaymnetMethodRepo.addPaymentMethod(client,data,company.id)
            }else{
                resault = await PaymnetMethodRepo.editPaymentMethod(client,data,company)
            }
            await client.query("COMMIT")
            return res.send(resault)
        } catch (error:any) {
            await client.query("ROLLBACK")
                 throw error
        }finally{
            client.release()
        }
    }
    public static async getPaymentMethod(req: Request, res: Response, next: NextFunction){
        const client = await DB.excu.client();
        try {
           await client.query("BEGIN")
            const paymentMethodId = req.params.paymentMethodId;
            const company =res.locals.company;
            const paymentMethod = await PaymnetMethodRepo.getPaymnetMethodById(client,company,paymentMethodId, null)
            await  client.query("COMMIT")

            return res.send(paymentMethod)
        } catch (error:any) {
            client.query("ROLLBACK")

                 throw error
        }finally{
            client.release()
        }
    }
    public static async getPaymentMethodList(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const list = await PaymnetMethodRepo.getPaymnetMethodsList(data,company)
            return res.send(list)
        } catch (error:any) {
            
                 throw error
        }
    }
    public static async getPaymentAccounts(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const list = await PaymnetMethodRepo.getPaymnetMethodAccounts(company)
            return res.send(list)
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async getPaymentsFlow(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const branches =res.locals.branches;
            const data = req.body;
        
            const list = await PaymnetMethodRepo.getPaymentsFlow(data,company,branches)
            return res.send(list)
        } catch (error:any) {
            
                 throw error
        }
    }
    public static async rearrangePaymentMethod(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;

            const list = await PaymnetMethodRepo.rearrangePaymentMethod(data,company)
            return res.send(list)
        } catch (error:any) {
            
                 throw error
        }
    }

    public static async getOnlinePaymentMethods(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;

            const list = await PaymnetMethodRepo.getOnlinePaymentSettings(company.id)
            return res.send(list)
        } catch (error:any) {
            
                 throw error
        }
    }  

    public static async getMiniPaymentMethodList(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            
            const list = await PaymnetMethodRepo.getMiniPaymentMethodList(data,company.id)
            return res.send(list)
        } catch (error:any) {
            
                 throw error
        }
    }  

    public static async getPaymentMethodBalance(req: Request, res: Response, next: NextFunction){
        try {

            const paymentMethodId = req.params.paymentMethodId;
            const branchId = req.params.branchId;
            const list = await PaymnetMethodRepo.getPaymentMethodBalance(paymentMethodId, branchId)
            return res.send(list)

        } catch (error:any) {
            
                 throw error
        }
    }  

    public static async enablePaymentMethods(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;

            const list = await PaymnetMethodRepo.enablePaymentMethods(data)
            return res.send(list)
        } catch (error:any) {
            
                 throw error
        }
    }  

}