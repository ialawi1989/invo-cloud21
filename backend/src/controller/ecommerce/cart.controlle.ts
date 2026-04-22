import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { ProductRepo } from '@src/repo/app/product/product.repo';
import { CartRepo } from '@src/repo/ecommerce/cart.repo';
import { ShopRepo } from '@src/repo/ecommerce/shop.repo';
import { Request, Response, NextFunction } from 'express';

export class CartController{

    public static async createCart(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body;
            const company = res.locals.company;
            const sessionId =  req.sessionID
            const loggedInUser = req.user;
           // let sections = await CartRepo.createCart(data,company,loggedInUser); 
           let sections;
           
           sections = await CartRepo.createCart(data,company,loggedInUser)
        
           return res.send(sections) 
        } catch (error:any) {
              throw error
        }
    } 

    // public static async createCart2(req: Request, res: Response, next: NextFunction){
    //     try {
    //         const data = req.body;
    //         const company = res.locals.company;
    //         const sessionId =  req.sessionID
    //         const loggedInUser = req.user;
    //        // let sections = await CartRepo.createCart(data,company,loggedInUser); 
    //        let sections;
           

    //         if(data.serviceName == 'Salon'){
    //            sections = await CartRepo.createEstimateCart(data,company,loggedInUser)
    //         }
    //         else{
    //             sections = await CartRepo.createCart(data,company,loggedInUser)
    //         }
             
    //         res.send(sections) 
    //     } catch (error:any) {
    //         res.send(new ResponseData(false, error.message, []))
    //     }
    // } 
    

    public static async saveInvoiceScheduleTime(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body;
            const company = res.locals.company;
            const sessionId =  req.sessionID
            
            let sections = await CartRepo.saveInvoiceScheduleTime(data,company)
            return res.send(sections) 
        } catch (error:any) {
              throw error
        }
    } 
    


    public static async getCart(req: Request, res: Response, next: NextFunction){
        try {
            const sessionId =  req.sessionID
            const cartSessionId= req.params.sessionId; 
            const company = res.locals.company
            let sections = await CartRepo.getCart(company,cartSessionId)
            return res.send(sections) 
        } catch (error:any) {
              throw error
        }
    }
    
    public static async addItemToCart(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body;
            const company = res.locals.company;
         
            let cart = await CartRepo.addItemToCart(data,company)
           return  res.send(cart) 
        } catch (error:any) {
              throw error
        }
    }  

    // public static async addItemToCart2(req: Request, res: Response, next: NextFunction){
    //     try {
    //         const data = req.body;
    //         const company = res.locals.company;

    //         let cartSessionId = data.sessionId;
    //         let cartData = await CartRepo.getRedisCart(company.id, cartSessionId);
    //         let cart;
    //         console.log("service", cartData?.serviceName)

    //         if(cartData?.serviceName =="Salon"){
    //             console.log(">>>>>Estimte")
    //            cart = await CartRepo.addItemToEstimateCart(data,company) 
    //         }
    //         else {
    //             console.log(">>>>>>>Invoice")
    //          cart = await CartRepo.addItemToCart(data,company)
    //         }
            
    //         res.send(cart) 
    //     } catch (error:any) {
    //         res.send(new ResponseData(false, error.message, []))
    //     }
    // }  
    
    public static async removeItemFromCart(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body;
            const company = res.locals.company;
         
            let cart = await CartRepo.removeItem(data,company)
            return res.send(cart) 
        } catch (error:any) {
              throw error
        }
    }  

    public static async clearCartItems(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body;
            const company = res.locals.company;
         
            let cart = await CartRepo.clearCartItems(data,company)
            return res.send(cart) 
        } catch (error:any) {
              throw error
        }
    }  

    public static async changeItemQty(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body;
            const company = res.locals.company;
         
            let cart = await CartRepo.changeItemQty(data,company)
            return res.send(cart) 
        } catch (error:any) {
              throw error
        }
    } 
    
    
    public static async checkBranchAvailability(req: Request, res: Response, next: NextFunction){
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const data = req.body;
            const company = res.locals.company;
         
            let cart = await CartRepo.checkBranchAvailability (client,data,company)
            await client.query("COMMIT")

            return res.send(cart) 
        } catch (error:any) {
            await client.query("ROLLBACK")

              throw error
        }finally{
            client.release()
        }
    }

    public static async checkOut(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body;
            const company = res.locals.company;
            const userSessionId = res.locals.userSessionId;
            console.log("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",userSessionId)
            let clientData:any =  req.headers['date'];
            let date =new Date().toISOString();


           let cart = await CartRepo.checkOut(data,company,date,userSessionId)

           return res.send(cart) 
        } catch (error:any) {
            
              throw error
        }
    }

    public static async ChangeService(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body;
            const company = res.locals.company;
            let clientData:any =  req.headers['date'];
            let date =new Date().toISOString();


           let cart = await CartRepo.ChangeService(data,company,date)

           return res.send(cart) 
        } catch (error:any) {
            
              throw error
        }
    }


    public static async getOrderBySessionId(req: Request, res: Response, next: NextFunction){
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            const sessionId = req.params.sessionId;
            const company = res.locals.company;
           

           let cart = await CartRepo.getOrderBySessionId(client,sessionId,company)
           await client.query("COMMIT")

           return  res.send(cart) 
        } catch (error:any) {
            await client.query("ROLLBACK")

              throw error
        }finally{
            client.release()
        }
    }
}