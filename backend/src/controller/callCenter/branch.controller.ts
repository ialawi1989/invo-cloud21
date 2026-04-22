import { DB } from "@src/dbconnection/dbconnection";

import { ResponseData } from "@src/models/ResponseData";
import { BranchesRepo } from "@src/repo/callCenter/branch.repo";
import { Request, Response, NextFunction } from 'express';


import { order } from "@src/Integrations/whatsapp/Order"

export class BranchController { 

    public static async getBranchesList(req:Request,res:Response, next:NextFunction){
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            const companyId =res.locals.company.id;   
            const brancheList = res.locals.branches
            const branches = await BranchesRepo.getBranchList(client,companyId,brancheList);
            await client.query("COMMIT");
            return res.send(branches)

        } catch (error:any) {
          
            await client.query("ROLLBACK")

            await client.query("rollback");
         throw error  
        }finally{
            client.release();
        }
    } 

}