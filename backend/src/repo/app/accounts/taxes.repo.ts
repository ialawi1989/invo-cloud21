import { DB } from "@src/dbconnection/dbconnection";
import { Tax } from "@src/models/account/Tax";
import { ResponseData } from "@src/models/ResponseData";


import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { SocketTaxRepo } from "@src/repo/socket/tax.socket";

import { TaxValidation } from "@src/validationSchema/account/tax.Schema";
import { Company } from "@src/models/admin/company";
import { PoolClient } from "pg";
import { ValidationException } from "@src/utilts/Exception";
export class TaxesRepo {

    public static async checkIfTaxNameExists(client:PoolClient,taxId: string | null, name: string, companyId: string): Promise<boolean> {
        const query : { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "Taxes" where LOWER(name) = LOWER($1) and id <> $2 and "companyId" = $3`,
            values: [
                name,
                taxId,
                companyId,
            ],
        };
        if (taxId == null) {
            query.text = `SELECT count(*) as qty FROM "Taxes" where LOWER(name) = LOWER($1) and "companyId" = $2`;
            query.values = [name, companyId];
        }

        const resault = await client.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }

        return false;

    }
    public static async addTax(client:PoolClient,data: any, company: Company) {
        try {
            const companyId = company.id
            const validate = await TaxValidation.taxValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            const tax = new Tax()
            tax.ParseJson(data);
            tax.calculateTaxPercentage()
            
            const isTaxNameExist = await this.checkIfTaxNameExists(client,null, tax.name, companyId);
            if (isTaxNameExist) {
                throw new ValidationException("Tax Name ALready Used")
            }


            tax.updatedAt = new Date();
            for (let index = 0; index < tax.taxes.length; index++) {
              tax.taxes[index].index = index;
                
            }
            const query : { text: string, values: any } = {
                text: `INSERT INTO "Taxes" 
                      (name,"taxPercentage","companyId","taxes","taxType","default","updatedAt")
                      values($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
                values: [tax.name, tax.taxPercentage, companyId,JSON.stringify(tax.taxes),tax.taxType,tax.default,tax.updatedAt]
            }

            const taxData = await client.query(query.text, query.values);
            const branchIds = await BranchesRepo.getCompanyBranchIds(client,companyId)
            tax.id = (<any>taxData.rows[0]).id
            await SocketTaxRepo.sendNewTax(branchIds, tax)
            return new ResponseData(true, "", { id: (<any>taxData.rows[0]).id })
        } catch (error: any) {
          
             throw new Error(error.message)
        }

    }

    public static async editTax(client:PoolClient,data: any, company: Company) {

        try {
            const companyId = company.id
            const validate = await TaxValidation.taxValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            const tax = new Tax()
            tax.ParseJson(data);
            tax.calculateTaxPercentage()
            tax.updatedAt= new Date();

            if(tax.name.trim() == 'Exempt Tax' || tax.name.trim()=='Zero Tax' || tax.name.trim()=='VAT 10%')
            {
                throw new ValidationException("Cannot Edit "+ tax.name)
            }
            const isTaxNameExist = await this.checkIfTaxNameExists(client,tax.id, tax.name, companyId);
            if (isTaxNameExist) {
                throw new ValidationException("Tax Name ALready Used")
            }
            for (let index = 0; index < tax.taxes.length; index++) {
                tax.taxes[index].index = index;
                  
              }
            tax.updatedAt = new Date();
            const query : { text: string, values: any } = {
                text: `UPDATE  "Taxes" 
                      SET name=$1,
                          "taxPercentage"=$2,
                          "taxes"=$3,
                          "taxType"=$4,
                          "updatedAt"=$5
                      WHERE id = $6
                      AND "companyId"=$7`,
                values: [tax.name, tax.taxPercentage,JSON.stringify(tax.taxes),tax.taxType,tax.updatedAt, tax.id, companyId]
            }

            await client.query(query.text, query.values);

            const branchIds = await BranchesRepo.getCompanyBranchIds(client,companyId)
            await SocketTaxRepo.sendUpdatedTax(branchIds, tax)
            return new ResponseData(true, "", [])
        } catch (error: any) {
          
             throw new Error(error.message)
        }

    }

    public static async getTaxList(data: any, company: Company) {
        try {
            const companyId = company.id;

            let searchValue = data.searchTerm? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$`:'[A-Za-z0-9]*';
         
      
           let sort = data.sortBy;
           let sortValue = !sort ? '"createdAt"' : '"' + sort.sortValue + '"';
           if (data.taxId != null && data.taxId != "") {
            sortValue = ` ("Taxes".id = ` + "'" + data.taxId + "'" + ` )`
        }
    
           let sortDirection = !sort ? "DESC" : sort.sortDirection;
           let sortTerm = sortValue + " " + sortDirection;
           let orderByQuery  =' Order By '+ sortTerm
         


            let page = data.page??1;
            let offset = 0;

            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }


            const query={
                text:`Select count(*) over(),
                                    id, 
                                    name,
                                    "taxType",
                                    "taxPercentage",
                                    taxes,
                                    "default"
                            from "Taxes"
                            Where "companyId"=$1
                            AND (Lower(name) ~ $2)
                            ${orderByQuery}
                            LIMIT $3 OFFSET $4`,
                values:[company.id,searchValue,limit,offset]
            }

            const selectList = await DB.excu.query(query.text, query.values)


            let count = selectList.rows && selectList.rows.length>0? Number((<any>selectList.rows[0]).count):0
            let pageCount = Math.ceil(count / data.limit)
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
            console.log(error)
          
             throw new Error(error.message)
        }

    }
    public static async getTaxes(client:PoolClient,companyId: string, date: any | null = null) {
        try {
            const query : { text: string, values: any } = {
                text: `	Select 
                            id, 
                            name,
                            "taxPercentage",
                            (
						      select JSON_AGG(JSONB_BUILD_OBJECT('taxId',t.id,'name',t.name,'taxPercentage',t."taxPercentage",'index',t."index"))  as  "taxes" 
							from (
							  select 
								"Taxes".id,
								"Taxes".name,
								"Taxes"."taxPercentage",
								(el->>'index')::int as "index"
						       from jsonb_array_elements("taxes")el
							   inner join "Taxes" on "Taxes".id = (el->>'taxId')::uuid
								order by (el->>'index')::int asc
							  ) t
							),
                            "taxType"
                      from "Taxes" 
                      WHERE "companyId"=$1`,
                values: [companyId]
            }
           
            if (date != null) {
                query.text = `Select 
                            id, 
                            name,
                            "taxPercentage",
                            (
						      select JSON_AGG(JSONB_BUILD_OBJECT('taxId',t.id,'name',t.name,'taxPercentage',t."taxPercentage",'index',t."index"))  as  "taxes" 
							from (
							  select 
								"Taxes".id,
								"Taxes".name,
								"Taxes"."taxPercentage",
								(el->>'index')::int as "index"
						       from jsonb_array_elements("taxes")el
							   inner join "Taxes" on "Taxes".id = (el->>'taxId')::uuid
								order by (el->>'index')::int asc
							  ) t
							),
                            "taxType"
                            from "Taxes"
                            WHERE "companyId"=$1
                            AND ("updatedAt">=$2 or "createdAt" >=$2)`,
                    query.values = [companyId, date]
            }

            const taxes = await client.query(query.text, query.values);
            return new ResponseData(true, "", taxes.rows)
    
        } catch (error: any) {
          
            console.log(error)
             throw new Error(error)
        }

    }

    public static async getTaxById(taxId: any, company: Company) {
        try {

           const companyId = company.id;
            const query : { text: string, values: any } = {
                text: `Select 
                            id, 
                            name,
                            "taxPercentage",
                            taxes,
                            "taxType"
                      from "Taxes" 
                      WHERE "id"=$1
                      AND "companyId" =$2`,
                values: [taxId, companyId]
            }

            const tax = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", tax.rows[0])
        } catch (error: any) {
          
             throw new Error(error.message)
        }

    }

    public static async getChildrenTexes(company:Company,taxId:string|null){
        try {
            const companyId = company.id
            const query : { text: string, values: any } = {
                text:`SELECT id,name,"taxPercentage" from "Taxes" where"companyId"=$1 and (taxes is null or  jsonb_array_length( taxes::jsonb ) = 0) `,
                values : [companyId]
            }

            if(taxId!=""&&taxId!=null)
            {
                query.text = `SELECT id,name,"taxPercentage" from "Taxes" where"companyId"=$1 and id <>$2 and (taxes is null or  jsonb_array_length( taxes::jsonb ) = 0)`,
                query.values =[companyId,taxId]
            }

            const taxes = await DB.excu.query(query.text,query.values);
            return new ResponseData(true,"",taxes.rows)
        } catch (error:any) {
             throw new Error(error.message)
        }
    }

    public static async getDefaultTax(client:PoolClient,companyId:string)

    {
        try {
            const query : { text: string, values: any } = {
                text :`SELECT id , "taxPercentage", "taxes" from "Taxes" where "companyId" = $1 AND "default"=$2  `,
                values:[companyId,true]
            }

              const data = await client.query(query.text,query.values);
              let tax:any = data.rows[0]
              let returnData={
                id: null,
                taxPercentage: 0,
                taxes:[]
              }

             if(tax!=null)
             {
                returnData.id = tax.id;
                returnData.taxPercentage = tax.taxPercentage;
                returnData.taxes = tax.taxes;
                  return new ResponseData(true,"",returnData)
             }else{
                return new ResponseData(true,"",returnData)
             }
          
        } catch (error:any) {
          
            throw new Error(error)
        }
    }


    
  public static async setDefaultTax(taxId: string, company: Company) {
    try {
      const query = {
        text: `update "Taxes" set "default" = case when id = $1::uuid then true else false end 
                 where "companyId" = $2::uuid`,
        values: [taxId, company.id]
      }

      await DB.excu.query(query.text, query.values)
      return new ResponseData(true, "", [])

    } catch (error: any) {
      throw new Error(error)
    }
  }
}