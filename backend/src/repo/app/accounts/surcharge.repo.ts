import { DB } from "@src/dbconnection/dbconnection";
import { Surcharge } from "@src/models/account/Surcharge";
import { ResponseData } from "@src/models/ResponseData";
import { SurchargeValidation } from "@src/validationSchema/account/surcharge.Schema";


import { Company } from "@src/models/admin/company";

import { PoolClient } from "pg";
import { ValidationException } from "@src/utilts/Exception";
import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { SocketChargesRepo } from "@src/repo/socket/charges.socket";
export class SurchargeRepo {
    public static async checkIfSurchargeNameExists(client:PoolClient,surchargeId: string | null, name: string, companyId: string): Promise<boolean> {
        const query : { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "Surcharges" where LOWER(name) = LOWER($1) and id <> $2 and "companyId" = $3`,
            values: [
                name,
                surchargeId,
                companyId,
            ],
        };
        if (surchargeId == null) {
            query.text = `SELECT count(*) as qty FROM "Surcharges" where LOWER(name) = LOWER($1) and "companyId" = $2`;
            query.values = [name, companyId];
        }

        const resault = await client.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }

        return false;

    }
    public static async saveSurcharge(data: any, company: Company) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            const companyId =company.id;
            let resault;
            if (data.id == null || data.id == "") {
                resault = await this.addSurcharge(client,data, companyId)
            } else {
                resault = await this.editSurcharge(client,data, companyId)
            }
            await client.query("COMMIT")
            return resault
        } catch (error: any) {
          
            await client.query("ROLLBACK")
      throw new Error(error.message)
        }finally{
            client.release()
        }
    }

    public static async addSurcharge(client:PoolClient,data: any, companyId: string) {
        try {

            const surcharge = new Surcharge();
            surcharge.ParseJson(data);
            surcharge.companyId = companyId;
            const validate = await SurchargeValidation.surchargeValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            const isSurchargeNameExist = await this.checkIfSurchargeNameExists(client,null, surcharge.name, companyId)
            if (isSurchargeNameExist) {
                throw new ValidationException("Surcharge name already Exist ")
            }
            
            surcharge.updatedDate = new Date();
            const query : { text: string, values: any } = {
                text: `INSERT INTO "Surcharges" (name,amount,percentage,"companyId","updatedDate","taxId") 
                VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
                values: [surcharge.name, surcharge.amount, surcharge.percentage, surcharge.companyId,surcharge.updatedDate,surcharge.taxId]
            }

            const insert = await client.query(query.text, query.values)
           surcharge.id = (<any>insert.rows[0]).id;
            const branchIds = await BranchesRepo.getCompanyBranchIds(client,surcharge.companyId);
            await SocketChargesRepo.sendnewSurcharge(surcharge,branchIds)
            return new ResponseData(true, "", { id: (<any>insert.rows[0]).id })

            
        } catch (error: any) {
          
      throw new Error(error.message)
        }
    }
    public static async editSurcharge(client:PoolClient,data: any, companyId: string) {
        try {

            const surcharge = new Surcharge();
            surcharge.ParseJson(data);
            surcharge.companyId = companyId;
            const validate = await SurchargeValidation.surchargeValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            if (surcharge.id == null || surcharge.id == "" || surcharge.id == undefined) {
                throw new ValidationException("Surcharge Id Is Required")
            }


            const isSurchargeNameExist = await this.checkIfSurchargeNameExists(client,surcharge.id, surcharge.name, companyId)
            if (isSurchargeNameExist) {
                throw new ValidationException("Surcharge name already Exist ")
            }
            surcharge.updatedDate = new Date();
            const query : { text: string, values: any } = {
                text: `UPDATE "Surcharges" SET name=$1,amount=$2,percentage=$3,"updatedDate"=$4,"taxId"=$5
                WHERE id = $6 `,
                values: [surcharge.name, surcharge.amount, surcharge.percentage,surcharge.updatedDate,surcharge.taxId, surcharge.id]
            }

            const insert = await client.query(query.text, query.values)
            const branchIds = await BranchesRepo.getCompanyBranchIds(client,surcharge.companyId);
            await SocketChargesRepo.sendUpdatedSurcharge(surcharge,branchIds)
            return new ResponseData(true, "Updated Successfully", [])
        } catch (error: any) {
          
      throw new Error(error.message)
        }
    }

    public static async getSurchargeList(data:any,company: Company) {
        try {
            const companyId = company.id;
            
            let searchValue = data.searchTerm ?`^.*` + data.searchTerm.toLowerCase().trim() + `.*$` :'[A-Za-z0-9]*';
       
          let  sort = data.sortBy;
          let sortValue = !sort ? '"createdAt"' : '"' + sort.sortValue + '"';
          let sortDirection = !sort ? "DESC" : sort.sortDirection;
          if (data&& data.chargeId != null && data.chargeId != "") {
            sortValue = ` ("Surcharges".id = ` + "'" + data.chargeId + "'" + ` )`
        }
          let sortTerm = sortValue + " " + sortDirection;
          let orderByQuery=" Order by "+ sortTerm
            if (data.searchTerm != null && data.searchTerm != "") {
                searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`
            }
          let page = data.page??1
          let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const query={
                text:`Select 
                           COUNT(*) OVER(),
                            id, 
                            name,
                            amount,
                            "percentage",
                             "taxId"
                        from "Surcharges"
                        Where "companyId"=$1
                        AND (Lower(name) ~ $2)
                        ${orderByQuery}
                        LIMIT $3 OFFSET $4`,
                values:[companyId,searchValue,limit,offset]
            }
            const selectList = await DB.excu.query(query.text, query.values)


            let count = selectList.rows && selectList.rows.length>0? Number((<any>selectList.rows[0]).count):0
            let pageCount = Math.ceil(count / limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }
          
            const resData = {
                list: selectList.rows,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          
      throw new Error(error.message)
        }
    }
 

    public static async getSurcharge(company: Company, SurchargeId: string) {
        try {
            const companyId =company.id;
            const query : { text: string, values: any } = {
                text: `SELECT "Surcharges".*,
                        "Taxes".name as "taxName"
                      FROM  "Surcharges"
                       left join "Taxes" on "Taxes".id = "Surcharges"."taxId"
                       WHERE "Surcharges"."companyId"=$1 AND "Surcharges".id=$2 `,
                values: [companyId, SurchargeId]
            }
            const surcharge = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", surcharge.rows[0])
        } catch (error: any) {
          
      throw new Error(error.message)
        }
    }

    


    public static async getSurchargeTax(client:PoolClient,surchargeId:string)
    {
        try {
            const query = {
                text:`SELECT "Taxes".id,
                "Taxes"."taxType",
                "Taxes"."taxes",
                "Taxes"."taxPercentage"
                FROM "Taxes" 
                inner JOIN "Surcharges" on "Taxes".id = "Surcharges"."taxId"
                WHERE "Surcharges".id = $1
                `,
                values:[surchargeId]
            }

            let tax = await client.query(query.text,query.values);
            if(tax.rows&& tax.rows.length>0 )
            {
                return new ResponseData(true,"",tax.rows[0])

            }else{
                return new ResponseData(true,"",null)
 
            }
        } catch (error:any) {
            throw new Error(error)
        }
    }
 

    public static async getTransactionsSurchargeList(data:any,company: Company) {
        try {
            const companyId = company.id;
            
            let searchValue = data &&data.searchTerm ? data.searchTerm.toLowerCase().trim() :null;
       
          let  sort = data.sortBy;
          let sortValue = !sort ? '"Surcharges"."createdAt"' : '"' + sort.sortValue + '"';
          let sortDirection = !sort ? "DESC" : sort.sortDirection;
          if (data&& data.chargeId != null && data.chargeId != "") {
            sortValue = ` ("Surcharges".id = ` + "'" + data.chargeId + "'" + ` )`
        }
          let sortTerm = sortValue + " " + sortDirection;
          let orderByQuery=" Order by "+ sortTerm
            if (data.searchTerm != null && data.searchTerm != "") {
                searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`
            }
          let page = data.page??1
          let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const query={
                text:`Select 
                           COUNT(*) OVER(),
                            "Surcharges".id, 
                            "Surcharges".name,
                            "Surcharges".amount,
                            "Surcharges"."percentage",
                            row_to_json("Taxes".*) as "tax"
                        from "Surcharges"
						   left join "Taxes" on "Surcharges"."taxId" = "Taxes".id
                                                   Where "Surcharges"."companyId"=$1
                        AND ($2::text is null or (Lower(   "Surcharges".name) ~ $2))
                        ${orderByQuery}
                        LIMIT $3 OFFSET $4`,
                values:[companyId,searchValue,limit,offset]
            }
            const selectList = await DB.excu.query(query.text, query.values)


            let count = selectList.rows && selectList.rows.length>0? Number((<any>selectList.rows[0]).count):0
            let pageCount = Math.ceil(count / limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }
          
            const resData = {
                list: selectList.rows,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          
      throw new Error(error.message)
        }
    }
}