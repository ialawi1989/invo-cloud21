
import { ResponseData } from "@src/models/ResponseData";
import { PoolClient } from "pg";



export class BranchesRepo {
    public static async getBranchList(client: PoolClient, companyId: string, branchList :[]|null) {
        try {

            
          const query: { text: string, values: any } = {
            text: `SELECT 
            Branches.name,
            Branches.id,
            Branches.address,
            Branches.location,
            Branches."phoneNumber",
            Branches."index",
            "isEcommerceDefault"
            FROM "Branches" AS Branches
            INNER JOIN "Companies" AS Companies 
            ON Companies.id = Branches."companyId" AND 
            Companies.id = $1 
            order by Branches."index" asc
            `,
            values: [companyId]
          }
    
          if(branchList){
            query.text = 
              `SELECT 
              Branches.name,
              Branches.id,
              Branches.address,
              Branches.location,
              Branches."phoneNumber",
              Branches."index",
              "isEcommerceDefault"
              FROM "Branches" AS Branches
              INNER JOIN "Companies" AS Companies  ON Companies.id = Branches."companyId" AND  Companies.id = $1 
              where ( array_length(($2::uuid[]),1) IS NULL OR Branches.id = any( ($2::uuid[])))
              order by Branches."index" asc
              `
              query.values=  [companyId , branchList]
          }
    
    
          const branches = await client.query(query.text, query.values);
    
    
          return new ResponseData(true, "", branches.rows)
    
        } catch (error: any) {
        
          throw new Error(error.message)
        }
      }

}
