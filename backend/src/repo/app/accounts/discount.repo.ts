import { DB } from "@src/dbconnection/dbconnection";
import { Discount } from "@src/models/account/Discount";
import { ResponseData } from "@src/models/ResponseData";
import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { SocketDiscount } from "@src/repo/socket/discount.socket";
import { DiscountValidation } from "@src/validationSchema/account/discount.Schema";


import { Helper } from "@src/utilts/helper";
import { Company } from "@src/models/admin/company";
import { PoolClient } from "pg";
import { ValidationException } from "@src/utilts/Exception";
export class DiscountRepo{


    public static async checkDiscountNameExist(client:PoolClient,id:string|null,name:string,companyId:string)
    {
        const query : { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "Discounts" where LOWER(name) = LOWER($1) and id <> $2 and "companyId" = $3`,
            values: [
                name,
                id,
                companyId,
            ],
        };
        if (id == null) {
            query.text = `SELECT count(*) as qty FROM "Discounts" where LOWER(name) = LOWER($1) and "companyId" = $2`;
            query.values = [name, companyId];
        }

        const resault = await client.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }

        return false;

    }
    public static async saveDiscount(data:any,company:Company){
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            const validate = await DiscountValidation.discountValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            let resault; 
            if(data.id == null || data.id == "" ||  data.id == undefined)
            {
                resault = await this.addDiscount(client,data,company)
            }else{
                resault = await this.editDiscount(client,data,company)
            }
            await client.query("COMMIT")

            return resault
        } catch (error:any) {
            await client.query("ROLLBACK")

          
           throw new Error(error.message)
        }finally{
            client.release()
        }
    }
    public static async addDiscount(client:PoolClient,data:any,company:Company){
        try {
  
            const validate = await DiscountValidation.discountValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            const discount = new Discount();
            discount.ParseJson(data);
            discount.companyId = company.id; 

            const isNameExist= await this.checkDiscountNameExist(client,null,discount.name,company.id);
            if(isNameExist)
            {
                throw new ValidationException("Discount Name Already Used ")
            }
            const afterDecimal =company.afterDecimal;

            discount.amount = Helper.roundDecimal(discount.amount,afterDecimal)
            let premittedEmployeesTemp:any[] = [];
            discount.permittedEmployees.forEach((element:any) => {
                if( typeof element == 'object'){
                    premittedEmployeesTemp.push(element.id);                

                }else if( typeof element == 'string'){
                    premittedEmployeesTemp.push(element);                

                }
            });


            discount.permittedEmployees = premittedEmployeesTemp;
            discount.updatedDate = new Date()
            const query : { text: string, values: any } = {
                text:`INSERT INTO "Discounts" 
                          (name,amount,percentage,"companyId","updatedDate","permittedEmployees","applyTo","items","available","availableOnline","startDate","expireDate","type","minProductQty","branches","startAtTime","expireAtTime","quantityBasedCashDiscount") 
                       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
                values:[discount.name,
                       discount.amount,
                       discount.percentage,
                       discount.companyId,
                       discount.updatedDate,
                       JSON.stringify(discount.permittedEmployees),
                       discount.applyTo,
                       JSON.stringify(discount.items),
          
                       discount.available,
                       discount.availableOnline,
                       discount.startDate,
                       discount.expireDate,
                       discount.type,
                       discount.minProductQty,
                       JSON.stringify(discount.branches),
                       discount.startAtTime,
                       discount.expireAtTime,
                       discount.quantityBasedCashDiscount
                    ]
            }

            const insert = await client.query(query.text,query.values)
            discount.id =(<any>insert.rows[0]).id
            const branchIds = await BranchesRepo.getCompanyBranchIds(client,discount.companyId);
            await SocketDiscount.sendnewDiscount(discount,branchIds)
            return new ResponseData(true,"",{id: discount.id})
        } catch (error:any) {
          
           throw new Error(error.message)
        }
    }
    public static async editDiscount(client:PoolClient,data:any,company:Company){
        try {

            const validate = await DiscountValidation.discountValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            const discount = new Discount();
            discount.ParseJson(data);
            discount.companyId = company.id; 
            const afterDecimal =company.afterDecimal;
            const isNameExist= await this.checkDiscountNameExist(client,discount.id,discount.name,company.id);
            if(isNameExist)
            {
                throw new ValidationException("Discount Name Already Used ")
            }
            discount.updatedDate = new Date()
            discount.amount = Helper.roundDecimal(discount.amount,afterDecimal)
            if(discount.id == null ||  discount.id == "" ||  discount.id == undefined)
            {
                throw new ValidationException("Discount Id Is Required")
            }

            let premittedEmployeesTemp:any[] = [];
            discount.permittedEmployees.forEach((element:any) => {
                if( typeof element == 'object'){
                    premittedEmployeesTemp.push(element.id);                

                }else if( typeof element == 'string'){
                    premittedEmployeesTemp.push(element);                

                }
            });
            discount.permittedEmployees = premittedEmployeesTemp;
            discount.updatedDate = new Date();
            const query : { text: string, values: any } = {
                text:`UPDATE "Discounts" SET 
                             name=$1,
                             amount=$2,
                             percentage=$3,
                             "updatedDate"=$4,
                             "permittedEmployees"=$5,
                             "applyTo" = $6,
                             "items" =$7,
                             "available"=$8,
                             "availableOnline"=$9,
                             "startDate" =$10,
                             "expireDate"=$11,
                             "type" =$12,
                             "minProductQty"=$13,
                             "branches"=$14,
                             "startAtTime"=$15,
                             "expireAtTime"=$16,
                             "quantityBasedCashDiscount"=$17
                      WHERE id = $18 AND"companyId"=$19 `,
                values:[discount.name,discount.amount,discount.percentage,discount.updatedDate,JSON.stringify(discount.permittedEmployees),discount.applyTo,JSON.stringify(discount.items),discount.available,discount.availableOnline,discount.startDate,discount.expireDate,discount.type,discount.minProductQty,JSON.stringify(discount.branches),discount.startAtTime,discount.expireAtTime,discount.quantityBasedCashDiscount,discount.id,discount.companyId]
            }

            const insert = await DB.excu.query(query.text,query.values)
            const branchIds = await BranchesRepo.getCompanyBranchIds(client,discount.companyId);
            await SocketDiscount.sendUpdatedDiscount(discount,branchIds)
            return new ResponseData(true,"Updated Successfully",[])
            
        } catch (error:any) {
          
           throw new Error(error.message)
        }
    }

    
  
    public static async getDiscountList(data:any,company:Company)
    {
        try {
            const companyId = company.id;

          

            let searchValue = data.searchTerm?data.searchTerm.toLowerCase().trim():'[A-Za-z0-9]*';

         

           

            let sort = data.sortBy;
            let sortValue = !sort ? '"Discounts"."createdAt"' : '"' + sort.sortValue + '"';
         
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            if (data.discountId != null && data.discountId != "") {
                sortValue = ` ("Discounts".id = ` + "'" + data.discountId + "'" + ` )`
            }
            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by ` + sortTerm;
            let page = data.page??1
            if(data.searchTerm!=null&&data.searchTerm!=""){
                searchValue = `^.*`+data.searchTerm.toLowerCase()+`.*$`
            }


        
            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }


            const query={
                text:`SELECT 
                             count(*) OVER(),
                             "Discounts".*
                     FROM  "Discounts"
                     where "companyId"=$1
                     and (LOWER("Discounts".name) ~ $2)
                     ${orderByQuery}
                     limit $3 offset $4`,
                values:[companyId,searchValue,limit,offset]
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

          
        } catch (error:any) {
          
           throw new Error(error.message)
        }
    }
    public static async getDiscount(company:Company,discountId:string)
    {
        try {
    
            
            const companyId = company.id;
            const query : { text: string, values: any } = {
                text:`SELECT
                         "Discounts".id,
                         "Discounts".name,
                         "Discounts"."applyTo",
                         "Discounts".amount,
                         "Discounts".percentage,
                         "Discounts"."taxId",
                         "Discounts"."startDate",
                         "Discounts"."expireDate",
                         "Discounts"."type",
                         "Discounts"."minProductQty",
                         "Discounts"."available",
                         "Discounts"."availableOnline",
                         "Discounts"."startAtTime",
                         "Discounts"."expireAtTime",
                         "Discounts"."quantityBasedCashDiscount",
                         "Discounts"."applyTo",
                         "Discounts"."branches",
                          (case when  "Discounts"."applyTo" = 'product' then 
                                (select JSONB_AGG(JSONB_BUILD_OBJECT('id',"Products".id,
																	 'name',"Products".name,
																	 'type',"Products".type,
																	 'defaultPrice',"Products"."defaultPrice",
																	 'categoryName', "Categories".name,
																	 'mediaUrl',case when "Media".id is not null then  JSON_BUILD_OBJECT('thumbnailUrl', CONCAT(REPLACE("url"->>'defaultUrl', split_part("url"->>'defaultUrl', '/', -1) , '') ,'Thumbnail_' ,split_part("url"->>'defaultUrl', '/', -1))) end))
								 from jsonb_array_elements_text(  "Discounts"."items") el 
                                 inner join "Products" on "Products".id =( el)::uuid
								 left join "Categories" on "Categories".id = "Products"."categoryId"
								 left join "Media" ON "Media".id = "Products"."mediaId"
                                )
                                when "Discounts"."applyTo" = 'category' then
						     (select JSONB_AGG(JSONB_BUILD_OBJECT('id',"Categories".id,
																  'name',"Categories".name,
																 'mediaUrl',case when "Media".id is not null then  JSON_BUILD_OBJECT('thumbnailUrl', CONCAT(REPLACE("url"->>'defaultUrl', split_part("url"->>'defaultUrl', '/', -1) , '') ,'Thumbnail_' ,split_part("url"->>'defaultUrl', '/', -1))) end
																 ))
							  
							  from jsonb_array_elements_text(  "Discounts"."items") el 
                                 left join "Categories" on "Categories".id =( el)::uuid
							  			 left join "Media" ON "Media".id = "Categories"."mediaId"
                                )
						   end
                           ) as "items",

                               (select JSONB_AGG(JSONB_BUILD_OBJECT('id',"Employees".id,
																  'name',"Employees".name,
																 'mediaUrl',case when "Media".id is not null then  JSON_BUILD_OBJECT('thumbnailUrl', CONCAT(REPLACE("url"->>'defaultUrl', split_part("url"->>'defaultUrl', '/', -1) , '') ,'Thumbnail_' ,split_part("url"->>'defaultUrl', '/', -1))) end
																 ))
							  
							  from jsonb_array_elements_text(  "Discounts"."permittedEmployees") el 
                                 left join "Employees" on "Employees".id =( el)::uuid
							  			 left join "Media" ON "Media".id = "Employees"."mediaId"
                                ) as "permittedEmployees"
                      FROM  "Discounts" 
                      WHERE "companyId"=$1 
                      AND id=$2 `,
                values:[companyId,discountId]
            }
            const discount = await DB.excu.query(query.text,query.values);
            return new ResponseData(true,"",discount.rows[0])
        } catch (error:any) {
          
           throw new Error(error.message)
        }
    }

    public static async getDiscountName(discountId: string) {
        try {
            const query = {
                text: `SELECT  name FROM "Discounts" where id =$1`,
                values: [discountId]
            }

            let discount = await DB.excu.query(query.text, query.values);

            return discount && (discount).rows && discount.rows.length > 0 ? (<any>discount.rows[0]).name : 'Other'
        } catch (error: any) {
            throw new Error(error)
        }


    }
}