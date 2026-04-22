import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { CustomerRepo } from '@src/repo/callCenter/customer.repo';
import { Braket } from 'aws-sdk';
import { Request, Response, NextFunction } from 'express';
import { custom } from 'util.promisify';
export class CustomerController{

    public static async addCustomer(req: Request, res: Response, next: NextFunction){
        const client = await DB.excu.client();
        try {
          
            const company = res.locals.company;
            const group = res.locals.groupId;
            const data= req.body;
            let resault;
          
            await client.query("BEGIN")
            if(data.id==null|| data.id ==""){
                resault=await CustomerRepo.addCustomer(client,data,company);
            }else{
                resault=await CustomerRepo.editCustomer(client, data,company);
            }
          
            await client.query("COMMIT")

            return res.send(resault)
        } catch (error:any) {
            console.log(error)
            
            await client.query("ROLLBACK")

              throw error
        }finally{
            client.release()
        }
    }

    public static async editCustomer(req: Request, res: Response, next: NextFunction){
        const client = await DB.excu.client();
        try {
            const company =res.locals.company;
            await client.query("BEGIN")
            const edit = await CustomerRepo.editCustomer(client,req.body,company);
            await client.query("COMMIT")

            return res.send(edit)
        } catch (error:any) {
            
            await client.query("ROLLBACK")

              throw error
        }finally{
            client.release()
        }
    }
    
    public static async getSuggestion(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body
           
            const list = await CustomerRepo.getSuggestion(data, company);
            return res.send(list) 
        } catch (error:any) {
            
              throw error
        }
    }
    public static async getCustomerById(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
         
            const customerId = req.params['customerId'];

            

            const customer = await CustomerRepo.getCustomerById(customerId, company);
            return res.send(customer) 
        } catch (error:any) {
            
              throw error
        }
    }

    public static async getCustomerByNumber(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const customerNumber = req.params['number'];
            const branches = res.locals.branches
        
            
      

            const customer = await CustomerRepo.getCustomerByNumber(customerNumber,company, branches);
            return res.send(customer) 
        } catch (error:any) {
            
              throw error
        }
    }

    public static async getBranchByCustomerAddress(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body;
            const branches = res.locals.branches
            

            const customer = await CustomerRepo.getBranchByCustomerAddress(data, company, branches);
            return res.send(customer) 
        } catch (error:any) {
            
              throw error
        }
    }


    public static async getCutomerList(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const data = req.body
            const list = await CustomerRepo.getCutomerList(data,company);
            return res.send(list) 
        } catch (error:any) {
            
              throw error
        }
    }

    public static async getCustomerCredit(req: Request, res: Response, next: NextFunction){
        try {
        
            const customerId = req.params['customerId'];
            const company =res.locals.company;
            const customer = await CustomerRepo.getCustomerCredit(customerId,company);
            return res.send(customer) 
        } catch (error:any) {
            
              throw error
        }
    }
    public static async getCustomerOverView(req: Request, res: Response, next: NextFunction){
        try {
        
            
            const company =res.locals.company;
            const data = req.body
            const overView = await CustomerRepo.getCustmerOverView(data,company);
            return res.send(overView) 
        } catch (error:any) {
            
              throw error
        }
    }
    public static async getCustomerInvoiceTransactions(req: Request, res: Response, next: NextFunction){
        try {
        
        
            const data = req.body
            const invoices = await CustomerRepo.getCustomerInvoiceTransactions(data);
            return res.send(invoices) 
        } catch (error:any) {
            
              throw error
        }
    }
    public static async getCustomerEstimateTransactions(req: Request, res: Response, next: NextFunction){
        try {
        
        
            const data = req.body
            const invoices = await CustomerRepo.getCustomerEstimateTransactions(data);
            return res.send(invoices) 
        } catch (error:any) {
            
              throw error
        }
    }
    public static async getCustomerCreditNoteTransactions(req: Request, res: Response, next: NextFunction){
        try {
        
        
            const data = req.body
            const invoices = await CustomerRepo.getCustomerCreditNoteTransactions(data);
            return res.send(invoices) 
        } catch (error:any) {
            
              throw error
        }
    }
    public static async getCustomerPaymentTransactions(req: Request, res: Response, next: NextFunction){
        try {
    
            const data = req.body
            const invoices = await CustomerRepo.getCustomerPaymentTransactions(data);
            return res.send(invoices) 
        } catch (error:any) {
            
              throw error
        }
    }

}