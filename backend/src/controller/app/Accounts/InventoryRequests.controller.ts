import { Request, Response, NextFunction } from 'express';
import { ResponseData } from '@src/models/ResponseData';
import { InventoryRequestRepo } from '@src/repo/app/accounts/InventoryRequest.repo';
export class InventoryRequestController{
    
    public static async addInventoryRequest(req: Request, res: Response, next: NextFunction){
     
        try {
            const company = res.locals.company;
            const companyId = company.id;
            const data = req.body; 
            const employeeId = res.locals.user;
    
            let resault;
            if(data.id== null || data.id ==""){
                resault = await InventoryRequestRepo.insertInventoryRequest(data,companyId,employeeId);
     
            }else{
                resault = await InventoryRequestRepo.editRequestInventory(data,companyId);
            }


           return res.send(resault)
           
        } catch (error:any) {

            
            throw error
            
        }
    }

    public static async getList(req: Request, res: Response, next: NextFunction){
     
        try {
            const company = res.locals.company;
    
            const data = req.body; 
            const branches = res.locals.branches;
            let resault = await InventoryRequestRepo.getRequestInventoryList(data,company,branches);
     
         


           return res.send(resault)
           
        } catch (error:any) {

            
            throw error
            
        }
    }

    public static async getById(req: Request, res: Response, next: NextFunction){
     
        try {
            const company = res.locals.company;
  
            const requestId = req.params.requestId;
    
             let   resault = await InventoryRequestRepo.getById(requestId,company);
     


           return res.send(resault)
           
        } catch (error:any) {

            
            throw error
            
        }
    }

    public static async delete(req: Request, res: Response, next: NextFunction){
     
        try {
            const company = res.locals.company;
  
            const requestId = req.params.requestId;
    
             let   resault = await InventoryRequestRepo.delete(requestId);
     


           return res.send(resault)
           
        } catch (error:any) {

            
            throw error
            
        }
    }


    public static async convertToPurchaseOrder(req: Request, res: Response, next: NextFunction){
     
        try {
            const company = res.locals.company;
  
            const employeeId = res.locals.user;
            const data = req.body

    
             let   resault = await InventoryRequestRepo.convertToPurchaseOrder(data,company,employeeId);
     


           return res.send(resault)
           
        } catch (error:any) {

            
            throw error
            
        }
    }
}