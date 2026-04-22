import { DB } from "@src/dbconnection/dbconnection";

import { ResponseData } from "@src/models/ResponseData";
import { Request, Response, NextFunction } from 'express';


import { order } from "@src/Integrations/whatsapp/Order"
import { BranchesRepo  } from "@src/repo/Integration/whatsapp/branch";
import { ProductsRepo } from "@src/repo/Integration/whatsapp/products";
import { WhatsAppAuthRepo } from "@src/repo/Integration/whatsapp/auth";


import { token } from "morgan";


export class whatsappOrderController { 

    public static async login(req:Request,res:Response, next:NextFunction){
        try {
           
            const company = res.locals.company ;          
            let data = req.body;
            const auth = await WhatsAppAuthRepo.login(data, company);
            return res.send(auth)

        } catch (error:any) {
          
              throw error

        }
    } 

    public static async OrderStatus(req:Request,res:Response, next:NextFunction){
       
        try {
            
            const company = res.locals.company ;  
            const data =  req.body;
            const token = req.headers['Authorization'];  
            const products = await ProductsRepo.orderStatus(data, company, token);
            return res.send(products)

        } catch (error:any) {
          
            
            throw new Error(error) 

        }
    }
    

    public static async addOrder(req:Request,res:Response, next:NextFunction){
        const client = await DB.excu.client();
        try {
            const company =res.locals.company ;             
           //const branches = await BranchesRepo.getBranchListTest(company);
        let data = req.body;
        await client.query("BEGIN")
         const branches = await order.checkOut(client, data, company);
         await client.query("COMMIT");
            return res.send(branches)
        } catch (error:any) {
          
            await client.query("ROLLBACK");

              throw error
        }finally{
            client.release()
        
    }
    } 

    public static async pushBranch(req:Request,res:Response, next:NextFunction){
        
        const client = await DB.excu.client();
        try {
            const company =res.locals.company ; 
            const token = req.headers['Authorization'];   
            await client.query("BEGIN");       

            const branch = await BranchesRepo.branchPush(company,token);

            await client.query("COMMIT");
            return res.send(branch)
        } catch (error:any) {
          
            await client.query("ROLLBACK");

              throw error
        }finally{
            client.release()
        
    }
    } 

    public static async getMenuList(req:Request,res:Response, next:NextFunction){
       
        try {
            
            const company = res.locals.company ;  
            const data =  req.body;
            const products = await ProductsRepo.getMenuList(data, company);
            return res.send(products)

        } catch (error:any) {
          
            
            throw new Error(error) 

        }
    }

    public static async pushMenu(req:Request,res:Response, next:NextFunction){
        const client = await DB.excu.client();
         try {
                     
             const company =res.locals.company ;
             const data = req.body;
             const token = req.headers['Authorization'];   
             
             await client.query("BEGIN")
             const options  = await ProductsRepo.pushCompanyOptions(client, company,token);
             const products = await ProductsRepo.pushMenuProducts(client, data, company,token);
    
 
             await client.query("COMMIT")
 
             if (options.success, products.success )
             return res.send({"success":true, "msg":"The Menu has been added to Whatsapp Successfuly" ,"data":[]})
 
         } catch (error:any) {
             await client.query("ROLLBACK")
           
               throw error
         } finally{
             client.release()
         }
     } 

     public static async pushOptions(req:Request,res:Response, next:NextFunction){
       
        const client = await DB.excu.client();
        try {
                    
            const company =res.locals.company ;
          
            await client.query("BEGIN")
            const options  = await ProductsRepo.pushCompanyOptions(client, company,token);
            await client.query("COMMIT")
            return res.send(options)

        } catch (error:any) {
            await client.query("ROLLBACK")
          
              throw error
        } finally{
            client.release()
        }
    }

    public static async pushMenuProducts(req:Request,res:Response, next:NextFunction){
        const client = await DB.excu.client();
         try {


            const token = req.headers['Authorization'];
                     
             const company =res.locals.company ;
             const data = req.body;
             
             await client.query("BEGIN")
             const products = await ProductsRepo.pushMenuProducts(client, data, company,token);
             await client.query("COMMIT")
             return res.send(products)
 
         } catch (error:any) {
             await client.query("ROLLBACK")
           
               throw error
         } finally{
             client.release()
         }
    } 

    public static async getServiceList(req:Request,res:Response, next:NextFunction){
       
        try {
            
            const company = res.locals.company ;  
            const data =  req.body;
            const products = await ProductsRepo.getServiceList(data, company);
            return res.send(products)

        } catch (error:any) {
          
            
            throw new Error(error) 

        }
    }

    public static async setServices(req:Request,res:Response, next:NextFunction){
       
        try {
            
            const company = res.locals.company ;  
            const data =  req.body;
            
            const products = await ProductsRepo.setServices(data, company);
            return res.send(products)

        } catch (error:any) {
          
            
            throw new Error(error) 

        }
    }

    public static async getCatalog(req:Request,res:Response, next:NextFunction){
       
        try {
            
            const company =res.locals.company ; 
            const token = req.headers['Authorization'];          
            const catalog = await ProductsRepo.getCatalog(company, token);

            return res.send(catalog)

        } catch (error:any) {
          
            throw new Error(error) 
        }
    } 









    public static async branchVisibilities(req:Request,res:Response, next:NextFunction){
        try {
            const company =res.locals.company ; 
            const token = req.headers['Authorization'];   

            const branch = await BranchesRepo.branchPush(company,token);
            return res.send(branch)
        } catch (error:any) {
         

              throw error
        }
    } 
 
    public static async pushProducts(req:Request,res:Response, next:NextFunction){
       
        try {
            
            const company =res.locals.company ;  
            const token = req.headers['Authorization'];   
            const products = await ProductsRepo.pushProducts(company,token);
            return res.send(products)

        } catch (error:any) {
          
            
            throw new Error(error) 

        }
    }
    
    public static async pushSections(req:Request,res:Response, next:NextFunction){
        const client = await DB.excu.client();
        try {
                    
            const company =res.locals.company ;
            const data = req.body;
            const token = req.headers['Authorization'];
            
            await client.query("BEGIN")
            const sections = await ProductsRepo.pushMenuSections(client, data, company,token);

            await client.query("COMMIT")
            return res.send(sections)

        } catch (error:any) {
            await client.query("ROLLBACK")
          
              throw error
        } finally{
            client.release()
        }
    }

    public static async test(req:Request,res:Response, next:NextFunction){
       
        try {
                    
           //const branches = await BranchesRepo.getBranchListTest(company);
      
            return res.send("branches")
        } catch (error:any) {
          
              throw error
       
        
    }
    } 

}