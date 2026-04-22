import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { ProductRepo } from '@src/repo/app/product/product.repo';
import { CartRepo } from '@src/repo/ecommerce/cart.repo';
import { ShopRepo } from '@src/repo/ecommerce/shop.repo';
import { EcommerceTableReservation } from '@src/repo/ecommerce/TableReservation.repo';
import { Request, Response, NextFunction } from 'express';

export class EcommerceTableReservationController {

    public static async saveReservation(req: Request, res: Response, next: NextFunction){
        try {
            const data = req.body;
            const company = res.locals.company;
            const userSessionId =  res.locals.userSessionId
            const loggedInUser = req.user;
              
            let reservation = await EcommerceTableReservation.saveReservation(data,company,userSessionId);

           
             
        
            return  res.send(reservation) 
        } catch (error:any) {
              throw error
        }
    } 


    public static async getReservationBySessionId(req: Request, res: Response, next: NextFunction){
        try {
            const sessionId = req.params.sessionId;
       
              
            let reservation = await EcommerceTableReservation.getReservationBySessionId(sessionId);

           
             
        
            return  res.send(reservation) 
        } catch (error:any) {
              throw error
        }
    } 

}