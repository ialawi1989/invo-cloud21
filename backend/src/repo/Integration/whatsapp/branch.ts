import { DB } from "../../../dbconnection/dbconnection";

import { ResponseData } from "@src/models/ResponseData";


import moment from "moment-timezone";

import { Company } from "@src/models/admin/company";


import { BranchR } from "@src/Integrations/whatsapp/Branch";



export class BranchesRepo {
  
    public static async branchPush(company: Company,token:any) {
      try {
        company.id = "97d49fa3-d473-48f3-ac56-17d7baad4c34"
  
        // ------------------------------
        //test branch
        // ------------------------------
        const query : { text: string, values: any } = {
          text: `SELECT 
                  Branches.name,
                  Branches.id,
                  Branches.address,
                  Branches.location,
                  Branches."phoneNumber",
                  Branches."index",
                  Branches."companyId",
                      Branches."coveredAddresses",
                  Companies.name as "merchantName"
                  FROM "Branches" AS Branches
                  INNER JOIN "Companies" AS Companies 
                  ON Companies.id = Branches."companyId" AND 
                  Companies.id = $1 
                  order by Branches."index" asc
          `,
          values: [company.id]
        }
  
        const branches = await  DB.excu.query(query.text, query.values);

        if (branches.rows.length > 0){
          for (const index in branches.rows){
          const res = (await BranchR.addBranch(branches.rows[index],company,token))
          return new ResponseData(res.success, res.msg, res.data)
          }
        }

        return new ResponseData(true, "", {})

      } catch (error: any) {
      
        throw new Error(error.message)
      }
    }
  
  }


