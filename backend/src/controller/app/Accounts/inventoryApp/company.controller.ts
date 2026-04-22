import { DB } from "@src/dbconnection/dbconnection";

import { ResponseData } from "@src/models/ResponseData";
import { Request, Response, NextFunction } from 'express';


import { inventoryAppPrivielges } from "@src/models/admin/inventoryAppEmployeePrivielge";



export class inventoryAppCompanyController {

    public static async getEmployeePrivielges(req:Request,res:Response, next:NextFunction){
        try {
          //  const branchId = req.params.branchId

            const company = res.locals.company
            const Privielges = await inventoryAppPrivielges.getEmployeePrivielgesByCompany(company.id)
        
            return res.send(Privielges)
        } catch (error:any) {
       

              throw error
        }
    }



} 