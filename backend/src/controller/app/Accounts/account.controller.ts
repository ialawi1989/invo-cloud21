
import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { Company } from '@src/models/admin/company';
import { BranchProducts } from '@src/models/product/BranchProducts';
import { RedisClient } from '@src/redisClient';
import { AccountsRepo } from '@src/repo/app/accounts/account.repo';
import { OpeningBalanceRepo } from '@src/repo/app/accounts/openingBalance.repo';

import { PaymnetMethodRepo } from '@src/repo/app/accounts/paymentMethod.repo';
import { BranchProductsRepo } from '@src/repo/app/product/branchProduct.repo';
import { ComparisonReportsRepo } from '@src/repo/reports/Comparison.report';
import { AttendanceSocket } from '@src/repo/socket/attendence.socket';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { ValidationException } from '@src/utilts/Exception';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import { validate } from 'uuid';


export class AccountController{

    public static async addToBarnch(req: Request, res: Response, next: NextFunction){
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            let branchId ='51a4ddc4-151d-4452-bcf4-3bf3a2bfa22c'
            let broductIdQuery = `
            select "Products".id from "Products" 
            left join "BranchProducts" on  "BranchProducts"."productId" =  "Products".id 
            where  "Products"."companyId" = '3c14713c-08b8-4c20-8b4c-84c55cb86a21'
            and "BranchProducts".id is null
            ` 
            
            let products = await client.query(broductIdQuery)
             let branchProducts = new BranchProducts();
            for (let index = 0; index < products.rows.length; index++) {
          
                const element:any = products.rows[index];
                branchProducts.branchId = branchId;
                branchProducts.productId = element.id
                branchProducts.companyId = '3c14713c-08b8-4c20-8b4c-84c55cb86a21'
                branchProducts.onHand =0
                await BranchProductsRepo.insertBranchProduct(client,branchProducts)
            }
            await client.query("COMMIT")
res.send(true)        } catch (error) {
            
            await client.query("ROLLBACK")

        }finally{
            client.release()
        }
    }


    
    public static async addAccount(req: Request, res: Response, next: NextFunction){
        const client = await DB.excu.client();
        try {
            const company = res.locals.company;
            const companyId = company.id;
            const data = req.body; 
            const employeeId = res.locals.user;
           await client.query("BEGIN")
            let resault;
            if(data.id== null || data.id ==""){
                resault = await AccountsRepo.addAccounts(client,data,companyId,employeeId);
     
            }else{
                resault = await AccountsRepo.editAccounts(client,data,companyId,employeeId);
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

    public static async addDefaultAccounts(req: Request, res: Response, next: NextFunction){
        try {
            let company = res.locals.company;
          await AccountsRepo.addDefaultAccounts(company.id)           
        } catch (error:any) {
         
            throw error
            
        }
    }
    public static async editAccount(req: Request, res: Response, next: NextFunction){
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const company =res.locals.company;
            const companyId = company.id;
            const data = req.body; 
            const edit = await AccountsRepo.editAccounts(client,data,companyId);
            await client.query("COMMIT")
           return res.send(edit)
        } catch (error:any) {
            await client.query("ROLLBACK")
            throw error
        }finally{
             client.release();
        }
    }
    //Get Account By Id
    public static async getAccount(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const companyId = company.id;
            const accountId = req.params["accountId"]
            const account = await AccountsRepo.getAccountById(accountId,companyId);
           return res.send(account)
        } catch (error:any) {
            
            throw error
        }
    } 
    public static async getAccountList(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const companyId = company.id;
            const data =  req.body;
            const accounts = await AccountsRepo.getAccountList(data,companyId);
           return res.send(accounts)
        } catch (error:any) {
            
            throw error
        }
    }

    //Account Journals For *** Chart Of Account ***
    public static async getAccountJournals(req: Request, res: Response, next: NextFunction){
        try {
            const data =  req.body;
            const company =res.locals.company;
            const branches = res.locals.branches
           
            let  journals    = await AccountsRepo.getAccountJournals(data,company,branches);
        
            return res.send(journals)
        } catch (error:any) {
            
            throw error
        }
    }
    //Retrive List of Sales Accounts for Invoices 
    public static async getSalesAccounts(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const companyId = company.id;
            const accounts = await AccountsRepo.getSalesAccounts(companyId);
            return res.send(accounts)
        } catch (error:any) {
            
            throw error
        }
    }

    //For Dashboard Summary 
    public static async getIncomeExpenseTransactions(req: Request, res: Response, next: NextFunction){
        try {
            const company =res.locals.company;
            const branches =res.locals.branches;
            const data = req.body;
            const accounts = await AccountsRepo.getIncomeExpenseTransactions(data,company,branches);
            return res.send(accounts)
        } catch (error:any) {
            
            throw error
        }
    }
    public static async getDashboardSummary(req: Request, res: Response, next: NextFunction){
        try {
           
            const company =res.locals.company;
            const branches =res.locals.branches;
            const data = req.body;
            const accounts = await AccountsRepo.getDashboardSummary(data,company,branches);
            return res.send(accounts)
        } catch (error:any) {
            
            throw error
        }
    }

    public static async bankOverView(req: Request, res: Response, next: NextFunction){
        try {
           
            const company =res.locals.company;
            const data = req.body
            const accounts = await PaymnetMethodRepo.getBankingOverview(data,company);
            return res.send(accounts)
        } catch (error:any) {
            
            throw error
        }
    }

    
    public static async getOpeningBalanceAccounts(req: Request, res: Response, next: NextFunction){
        try {
           
            const company =res.locals.company;
            const branchId =req.params.branchId;
            const data = req.body
            const accounts = await OpeningBalanceRepo.getOpeningBalanceAccounts(branchId,company.id);
            return res.send(accounts)
        } catch (error:any) {
            
            throw error
        }
    }
    
    public static async saveAccountsOpeningBalance(req: Request, res: Response, next: NextFunction){
        try {
           
            const company =res.locals.company;
            const data = req.body
            const employeeId = res.locals.user
            const accounts = await OpeningBalanceRepo.saveAccountOpeningBalance(data,company, employeeId);

            let queueInstance = TriggerQueue.getInstance();
            queueInstance.createJob({ type: "AccounOpeningBalance",branchId:data.branchId,companyId: company.id })
            
            return res.send(accounts)
        } catch (error:any) {
            
            throw error
        }
    }

    // public static async updateOpeningBalanceDate(req: Request, res: Response, next: NextFunction){
    //     try {
           
    //         const company =res.locals.company;
    //         const data = req.body
    //         const accounts = await OpeningBalanceRepo.updateOpeningBalanceDate(data,company);
    //         return res.send(accounts)
    //     } catch (error:any) {
            
    //         throw error
    //     }
    // }



    public static async getInventoryAssetsOpeningBalanceRecords(req: Request, res: Response, next: NextFunction){
        try {
           
            const company =res.locals.company;
            const body = req.body
            const accounts = await OpeningBalanceRepo.getInventoryAssetsOpeningBalanceRecords(body,company);
            return res.send(accounts)
        } catch (error:any) {
            
            throw error
        }
    }
    public static async getAccountPayableOpeningBalanceRecords(req: Request, res: Response, next: NextFunction){
        try {
           
            const company =res.locals.company;
            const data = req.body
            const accounts = await OpeningBalanceRepo.getAccountPayableOpeningBalanceRecords(data,company);
            return res.send(accounts)
        } catch (error:any) {
            
            throw error
        }
    }
    public static async getAccountReceivableOpeningBalanceRecords(req: Request, res: Response, next: NextFunction){
        try {
           
            const company =res.locals.company;
            const body = req.body
            const accounts = await OpeningBalanceRepo.getAccountReceivableOpeningBalanceRecords(body,company);
            return res.send(accounts)
        } catch (error:any) {
            
            throw error
        }
    }


    public static async deleteAccount(req: Request, res: Response, next: NextFunction){
        try {
           
            const company =res.locals.company;
            const accountId = req.params.accountId
            const employeeId = res.locals.user
            const accounts = await AccountsRepo.deleteAccount(accountId,company, employeeId);
            return res.send(accounts)
        } catch (error:any) {
            
            throw error
        }
    }

    public static async getTransactionsDate(req: Request, res: Response, next: NextFunction){
        try {
           
            const company =res.locals.company;
            const branchId = req.params.branchId
            const accounts = await AccountsRepo.getMinTrnsactionsDate(branchId);
            return res.send(accounts)
        } catch (error:any) {
            
            throw error
        }
    }

    public static async getAccountName(req: Request, res: Response, next: NextFunction){
        try {
           
            const company =res.locals.company;
            const accountId = req.params.accountId
            const accounts = await AccountsRepo.getAccountName(accountId,company);
            return res.send(accounts)
        } catch (error:any) {
            
            throw error
        }
    }

    public static async insertAccountTranslation(req: Request, res: Response, next: NextFunction){
        try {
           
            const companyId =req.body.companyId;

            const accounts = await AccountsRepo.insertAccountTranslation(companyId);
            return res.send(accounts)
        } catch (error:any) {
            
            throw error
        }
    }

    public static async exprotInventoryAssetsOpeningBalance(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            const branchId = req.params.branchId
            const type = req.params.type

           
            const result = await OpeningBalanceRepo.exprotInventoryAssetsOpeningBalance(company, branchId, type);

            res.download( result )

            try{
                res.on('finish', () => {
                    fs.unlinkSync(result);
                });

            }catch (error: any) {
            throw error
            }

            
        } catch (error: any) {
            throw error
        }
    }
 
    public static async saveInventoryAssetsOpeningBalance(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client(500);
        try {

            await client.query("BEGIN")

            let data = req.body;
            let company = res.locals.company;
            let employeeId = res.locals.user;
            let resData:any 
          
            if(!data.branchId){
                throw new ValidationException('branchId is required')
            }
           let openinBalanceProducts:any[]=[]
            if (data.products && data.products.length > 0){

                resData = await OpeningBalanceRepo.importFromCsv(client, company, data)
                if(resData && resData.length>0)
                    {
                        openinBalanceProducts = resData
                    }
            }else{
                resData = await OpeningBalanceRepo.saveInventoryAssetsOpeningBalance(client,company.id, data)
           
                        openinBalanceProducts = [ data.productId]
                    
            
            }
            await client.query("COMMIT") 
            if(openinBalanceProducts && openinBalanceProducts.length>0  ) 
            { let queueInstance = TriggerQueue.getInstance();
                console.log(openinBalanceProducts)
                queueInstance.createJob({ type: "OpeneingBalance", id: openinBalanceProducts, companyId: company.id, branchIds: [data.branchId] })
                queueInstance.createJob({ journalType: "Movment", type: "openingBalance", id: openinBalanceProducts })

            }
           
            return res.send(resData)

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw error
        }finally {
            client.release()
        }
    }

    public static async checksaveAttendance(req: Request, res: Response, next: NextFunction) {
        const client = await DB.excu.client()
        try {
  
           await client.query("BEGIN")
           let data = req.body.data;
           let branchId = req.body.branchId;
        
    
           let response = await AttendanceSocket.insertAttendance(client,data,branchId)
   
           await client.query("COMMIT")
           return res.send(response)
           
        } catch (error:any) {
           await client.query("ROLLBACK")
           throw error
        }finally{
           client.release()
        }
       }


       
    public static async exportAccounts(req: Request, res: Response, next: NextFunction) {
        try {
            const company = res.locals.company;
            let fileName = company.id+"Accounts"
            const type = req.params.type


            try {
                const fileBuffer = await AccountsRepo.exportAccounts(company, type);
                
                const fileExtension = type.toLowerCase() === 'xlsx' ? 'xlsx' : 'csv';
                fileName = `${fileName}.${fileExtension}`;
                
                res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
                res.setHeader('Content-Type', type.toLowerCase() === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv');
                return res.send(fileBuffer);
                
              } catch (error) {
                return   res.status(500).json({ error: 'Error generating file' });
              }

            return new ResponseData(false, "", [])


            
            
        } catch (error: any) {
            throw error
        }
    } 

    public static async importAccountsFromCsv(req: Request, res: Response, next: NextFunction) {
            let redisClient = RedisClient.getRedisClient();
            let company = res.locals.company;
            try {
    
                let data = req.body;
                let employeeId = res.locals.user;
               
                let count = data.length; //3000
                let limit: any = process.env.NUMBER_OF_IMPORT_RECOREDS ?? 2000;
                let pageCount = Math.ceil(count / limit)
              
                let offset = 0;
                let resault = new ResponseData(true, "", [])
    
                // await redisClient.deletKey("BulkImport"+company.id)
                let isBulkImport = await redisClient.get("AccountsBulkImport"+company.id)
                   
                if(isBulkImport)
                {   let data = JSON.parse(isBulkImport)
                    let progress = data.progress;
                    return res.send(new ResponseData(false,"A Previouse Import is Still In Progress: " + progress,[]))
                }
    
    
                for (let index = 0; index < pageCount; index++) {
              
                  // if (page != 0) {
                    //     offset = (limit * (page - 1))
                    // }
           
                    let accounts: any = data.splice(offset, limit)
                    resault = await AccountsRepo.importFromCVS(accounts, company, employeeId,index+1,count)
    
                    if(resault.success && index+1 == pageCount){
                        await redisClient.deletKey("AccountsBulkImport"+company.id)
                    }
                }

    
                return res.send(resault)
            } catch (error: any) {
                await redisClient.deletKey("AccountsBulkImport"+company.id)
                throw error
            }
    }

    public static async getBulkImportProgress(req: Request, res: Response, next: NextFunction) {

        try {

          
            let redisClient = RedisClient.getRedisClient();
            let company = res.locals.company;

            // await redisClient.deletKey("BulkImport"+company.id)

            let isBulkImport = await redisClient.get("AccountsBulkImport"+company.id)
               
            if(isBulkImport)
            {   let data = JSON.parse(isBulkImport)
                let progress = data.progress;
            
                return res.send(new ResponseData(false,"A Previouse  Import is Still In Progress: " + progress,{progress:progress}))
            }




            return res.send(new ResponseData(true,"",[]))
        } catch (error: any) {
   
            throw error
        }
    }

    public static async getParentAccountListByType(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const data = req.body
            const accounts = await AccountsRepo.getParentAccountListByType(data, company.id);
            return res.send(accounts)
        } catch (error: any) {

            throw error

        }
    }
}