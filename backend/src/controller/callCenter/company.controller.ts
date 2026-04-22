import { DB } from "@src/dbconnection/dbconnection";

import { ResponseData } from "@src/models/ResponseData";
import { BranchesRepo  } from "@src/repo/admin/branches.repo";
import { Request, Response, NextFunction } from 'express';

import { POSprivielges } from '@src/models/admin/POSEmployeePrivielge';
import { CompanyController } from "@src/repo/callCenter/company.repo";
import { FileStorage } from "@src/utilts/fileStorage";


export class CallCenterCompanyController {

    public static async getEmployeePrivielges(req:Request,res:Response, next:NextFunction){
        try {
          //  const branchId = req.params.branchId

            const company = res.locals.company
            const Privielges = await POSprivielges.getEmployeePrivielgesByCompany(company.id)
        
            return res.send(Privielges)
        } catch (error:any) {
          

              throw error  
        }
    }

    public static async getCompanyPrefrences(req:Request,res:Response, next:NextFunction){
        try {
            
            const company = res.locals.company
            const companySettings = await CompanyController.getCompanySettings(company)
        
            return res.send(companySettings)

        } catch (error:any) {
          

              throw error  
        }
    }

    public static async getCoveredAddresses(req:Request,res:Response, next:NextFunction){
        try {
            
            const company = res.locals.company
            const companySettings = await CompanyController.getCoveredAddresses(company)
        
            return res.send(companySettings)

        } catch (error:any) {
          

              throw error  
        }
    }

    public static async getCoveredAddresses2(req:Request,res:Response, next:NextFunction){
        const dbClient = await DB.excu.client();
        try {
            /**Begin */

            await dbClient.query("BEGIN");
            /**Retrive barnch Company addresses alon with branch delivery addresses */
            const company = res.locals.company
      
           
            let addresses = (await CompanyController.getAddresses(dbClient,company.id, company))
            
            /**COMMIT */
            await dbClient.query("COMMIT");


            return res.send(addresses)
        } catch (error: any) {
            console.log(error)
            /**ROLLBACK */
            await dbClient.query("ROLLBACK");

          
              throw error 
        } finally {
            /**release */
            dbClient.release();
        }


    }

    public static async getDiscountList(req: Request, res: Response, next: NextFunction) {
        try {

            const company = res.locals.company;
            const resault = await CompanyController.getDiscountList(company)
            return res.send(resault)

        } catch (error:any) {
             throw error
        }
    }



    

    


   



    



   



} 