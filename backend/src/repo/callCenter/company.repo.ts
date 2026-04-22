/* eslint-disable prefer-const */
import { DB } from '@src/dbconnection/dbconnection';
import { FileStorage } from "@src/utilts/fileStorage";
import { ResponseData } from '@src/models/ResponseData';

import { Company } from "@src/models/admin/company";
import { BranchesRepo } from "../admin/branches.repo";



import { PoolClient } from "pg";
import { BranchDeliveryAddress } from "@src/models/admin/Branches";

export class CompanyController{
    static redisClient: any;

public static async getCompanySettings(company:Company ){
    const client = await DB.excu.client();

    try {
        await client.query("BEGIN");
        const companyId = company.id;

        let query = `SELECT "Companies".id,
                            "Companies".name,
                            "Companies".translation,
                            "Companies".country,
                            "Companies".slug,
                            "Companies"."type",
                            "Companies"."smallestCurrency",
                            "Companies"."roundingType",
                            "Companies"."options",
                        
                            "Companies"."voidReasons",
                            "Companies"."vatNumber",
                            "Companies"."isInclusiveTax",
                            "Companies"."invoiceOptions"
                          
                        FROM "Companies" 
                       
                        where "Companies".id =$1
                        `
        let values = [companyId];
        

        const companyData = await client.query(query, values)
        await client.query("COMMIT");

        if(companyData && companyData.rows && companyData.rows.length>0)
        {
            let company = new Company();
            company.ParseJson(companyData.rows[0]);
            
            const storage = new FileStorage();
            const companySettings = await storage.getCompanySettings(company.country)
            if (companySettings) {
                company.settings = companySettings.settings
            }


            return new ResponseData(true,"",company)
        }else{
            return new ResponseData(true,"",null)
        }
       
      
    } catch (error:any) {
        console.log(error);
        await client.query("ROLLBACK");
        throw new Error(error.message)
    }finally{
        client.release()
    }
}

public static async getCoveredAddresses(company:Company) {
    try {

        let coveredAddresses = null
        
      const query : { text: string, values: any } = {
        text: ` Select  name as "branchName", 
                        id as "branchId",
                        "coveredAddresses"->>'type'  as type,
                        elem->>'address' as "address",
                        elem->>'minimumOrder' as "minimumOrder",
                        elem->>'deliveryCharge' as "deliveryCharge",
                        elem->>'freeDeliveryOver' as "freeDeliveryOver"
                from "Branches",  jsonb_array_elements("coveredAddresses"->'coveredAddresses') as elem
                where "companyId"= $1 `,
        values: [company.id]
      }
      
      const addresses = await DB.excu.query(query.text, query.values);

      

      let list: any[] = []

      if(addresses.rows && addresses.rows.length > 0){
        coveredAddresses = addresses.rows;
        const storage = new FileStorage();
        const deliveryAddresses = (await storage.getDeliveryAddresses(company.country)).addresses;

        coveredAddresses.forEach( (e : any)=> {
            let address = e.address;
            let type = e.type;
            let temp = deliveryAddresses.filter((f: any) => f[type] == address);
                    temp.forEach((element: any) => {
                      list.push(element)})}
                    )
        return new ResponseData(true, "", {"type":(<any>coveredAddresses[0]).type,"coveredAddresses": coveredAddresses, "list": list} )

      }


      return new ResponseData(true, "",  [] )
    } catch (error: any) {
    

      throw new Error(error)
    }
  }

  public static async getBranchCoveredAddresses(client: PoolClient, companyId: string, branchId: string|null) {
    try {

      branchId = branchId??null
      const query : { text: string, values: any } = {
        text: `Select "coveredAddresses" from "Branches" where "companyId" = $1 and  ( $2::uuid is null or id = $2::uuid)`,
        values: [branchId]
      }
      
      const addresses = await client.query(query.text, query.values);
   
    
      

      return new ResponseData(true, "", addresses.rows && addresses.rows.length > 0 ? addresses.rows: null)
    } catch (error: any) {
    

      throw new Error(error)
    }
  }


  public static async getAddresses(client: PoolClient, branchId: string, company: Company) {

    try {


      let comapnyAddress = (await this.getBranchCoveredAddresses(client, company.id, branchId)).data;

      const storage = new FileStorage();
      const deliveryAddresses = (await storage.getDeliveryAddresses(company.country)).addresses;


      let list: any[] = []
    //   for (let address of addresses){
    //     let type = address.type;
    //     if (address.coveredAddresses) {
    //         address.coveredAddresses.forEach((coveredAddress: any) => {
    //         let temp = deliveryAddresses.filter((f: any) => f[type] == coveredAddress.address);
    //         temp.forEach((element: any) => {
    //           list.push(element)
    //         });
    //       });
    //     }
    //   }
    //   addresses.list = list;

    comapnyAddress.forEach( (e : any)=> {
        let addresses = e.coveredAddresses
        if (addresses && JSON.stringify(addresses) != '{}') {

            let type = addresses.type;
            if (addresses.coveredAddresses) {
              
              addresses.coveredAddresses.forEach((coveredAddress: any) => {
                let temp = deliveryAddresses.filter((f: any) => f[type] == coveredAddress.address);
                temp.forEach((element: any) => {
                  list.push(element)
                });
              });
            }
            
    
            addresses.list = list;
          } else {
            addresses = new BranchDeliveryAddress()
          }
    }

    )

      


      return new ResponseData(true, "", comapnyAddress)
    } catch (error: any) {

    

      throw new Error(error)
    }
  }


  public static async getBranchAddresses(client: PoolClient, branchId: string, company: Company) {

    try {


      let addresses = (await BranchesRepo.getBranchCoveredAddresses(client, branchId)).data.coveredAddresses;

      const storage = new FileStorage();
      const deliveryAddresses = (await storage.getDeliveryAddresses(company.country)).addresses;


      let list: any[] = []

      if (addresses && JSON.stringify(addresses) != '{}') {

        let type = addresses.type;
        if (addresses.coveredAddresses) {
          addresses.coveredAddresses.forEach((coveredAddress: any) => {
            let temp = deliveryAddresses.filter((f: any) => f[type] == coveredAddress.address);
            temp.forEach((element: any) => {
              list.push(element)
            });
          });
        }

        addresses.list = list;
      } else {
        addresses = new BranchDeliveryAddress()
      }


      return new ResponseData(true, "", addresses)
    } catch (error: any) {

    

      throw new Error(error)
    }
  }

  public static async getDiscountList(company: Company) {
    try {
      
      const companyId = company.id;
      const query: { text: string, values: any } = {
        text: `SELECT 
                "Discounts".id,
                "Discounts".amount,
                "Discounts"."name",
                "Discounts".percentage,
                "Discounts"."permittedEmployees"
              FROM  "Discounts" 
              where "Discounts"."companyId"=$1`,
            values: [companyId]
        }
        
        const discountList = await DB.excu.query(query.text, query.values);
        const resData = discountList.rows && discountList.rows.length >0 ?  discountList.rows : []

      return new ResponseData(true, "", resData)

    } catch (error: any) {

    
      throw new Error(error)
    }
  }



}

