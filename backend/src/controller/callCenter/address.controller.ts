import { DB } from "@src/dbconnection/dbconnection";

import { ResponseData } from "@src/models/ResponseData";
import { BranchesRepo  } from "@src/repo/admin/branches.repo";
import { Request, Response, NextFunction } from 'express';


export class AddressController {


 
    public static async getBranchCoveredAddresses(req:Request,res:Response, next:NextFunction){
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const branchId = req.params.branchId

            const company = res.locals.company
            const branch = await BranchesRepo.getBranchCoveredAddresses(client,branchId)
            await client.query("COMMIT")

            return res.send(branch)
        } catch (error:any) {
          
            await client.query("ROLLBACK")

              throw error  
        }finally{
            client.release()
        }
    }


} 