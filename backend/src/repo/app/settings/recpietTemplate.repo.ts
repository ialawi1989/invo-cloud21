import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { RecieptTemplate } from "@src/models/Settings/RecipetTemplate"
import { Company } from "@src/models/admin/company";
import { RecieptTemplateValidation } from "@src/validationSchema/settings/RecieptTemplates.Schema";

import { ValidationException } from "@src/utilts/Exception";

export class RecieptTemplatesRepo {

    public static async isTemplateNameExist(templateId: string | null, companyId: string, name: string) {
        const query : { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "RecieptTemplates" where TRIM(LOWER(name)) = TRIM(LOWER($1)) and id <> $2 and "companyId" = $3`,
            values: [
                name,
                templateId,
                companyId,
            ],
        };
        if (templateId == null) {
            query.text = `SELECT count(*) as qty FROM "RecieptTemplates" where TRIM(LOWER(name)) = TRIM(LOWER($1)) and "companyId" = $2`;
            query.values = [name, companyId];
        }

        const resault = await DB.excu.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }

        return false;
    }
    public static async saveRecieptTemplates(data: any, company: Company) {
        try {

            const validate = await RecieptTemplateValidation.validateRecieptTemplate(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            const companyId = company.id;
            const recpietTemplate = new RecieptTemplate();
            recpietTemplate.ParseJson(data)
            recpietTemplate.updatedDate = new Date()

            const isTemplateNameExist = await this.isTemplateNameExist(null, company.id, recpietTemplate.name)
            if (isTemplateNameExist) {
                throw new ValidationException("Template Name Already Used")
            }
            const query : { text: string, values: any } = {
                text: `Insert INTO "RecieptTemplates" ("companyId","name","recieptTemplate","templateType","updatedDate") values ($1,$2,$3,$4,$5) returning Id`,
                values: [companyId, recpietTemplate.name, JSON.stringify(recpietTemplate.recieptTemplate), recpietTemplate.templateType, recpietTemplate.updatedDate]
            }

            const reciept = await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", { id: (<any>reciept.rows[0]).id })
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }


    public static async editRecieptTemplates(data: any, company: Company) {
        try {

            const validate = await RecieptTemplateValidation.validateRecieptTemplate(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }


            const recpietTemplate = new RecieptTemplate();
            recpietTemplate.ParseJson(data)

            const isTemplateNameExist = await this.isTemplateNameExist(recpietTemplate.id, company.id, recpietTemplate.name)
            if (isTemplateNameExist) {
                throw new ValidationException("Template Name Already Used")
            }
            recpietTemplate.updatedDate = new Date()
            const query : { text: string, values: any } = {
                text: `UPDATE "RecieptTemplates" SET "name"=$1,"recieptTemplate"=$2 ,"updatedDate"=$3 where id=$4`,
                values: [recpietTemplate.name, JSON.stringify(recpietTemplate.recieptTemplate), recpietTemplate.updatedDate, recpietTemplate.id]
            }

            await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", [])
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async oldgetRecieptTemplates(data: any, company: Company) {
        try {


            const companyId = company.id;
            let selectQuery;
            let selectValues;

            let countQuery;
            let countValues;


            let searchValue = '[A-Za-z0-9]*';
            let offset = 0;
            let sort: any;
            let sortValue;
            let sortDirection;
            let sortTerm;
            let count = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }


            const selectText = ` SELECT id,name,"templateType" FROM  "RecieptTemplates"  `

            const countText = ` Select 
                                    COUNT(*)
                            from "RecieptTemplates"`

            let filterQuery = ` Where "companyId"=$1`
            filterQuery += ` AND (Lower(name) ~ $2)`
            const limitQuery = ` LIMIT $3 OFFSET $4`

   
            selectQuery = selectText+filterQuery
            selectValues =[companyId,searchValue]
            let pageCount;
            let selectList;
            let selectCount;
            let orderByQuery; 
            
            if(data!=null && data!='' && JSON.stringify(data)!='{}'){
                offset = data.page - 1
                sort = data.sortBy;
                sortValue = !sort ? '"createdAt"' : '"' + sort.sortValue + '"';
                sortDirection = !sort ? "DESC" : sort.sortDirection;
                sortTerm = sortValue + " " + sortDirection;
                orderByQuery=" Order by "+ sortTerm
                if (data.searchTerm != null && data.searchTerm != "") {
                    searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`
                }
                selectQuery = selectText+filterQuery+orderByQuery+limitQuery
                selectValues = [companyId,searchValue,limit,offset]
                countQuery= countText+filterQuery
                countValues =[companyId,searchValue]

         
        
                selectCount = await DB.excu.query(countQuery,countValues)
                count = Number((<any>selectCount.rows[0]).count)
                pageCount = Math.ceil(count / data.limit)
            }

            selectList = await DB.excu.query(selectQuery,selectValues)
    
          
            
             offset +=1;
            let lastIndex = ((data.page) * data.limit)
            if (selectList.rows.length < data.limit || data.page == pageCount) {
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


    public static async getRecieptTemplates(data: any, company: Company) {
        try {

            const companyId = company.id



            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';
            let sort = data.sortBy;
            let sortValue = !sort ? '"createdAt"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection;
            let orderByQuery = " Order by " + sortTerm
            let offset = 0;
            let page = data.page ?? 1;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }


            const query : { text: string, values: any } = {
                text: `SELECT
                count(*) over(),
                 id,
                 name,
                 "templateType"
                FROM  "RecieptTemplates"
                 Where "companyId"=$1
                  AND (Lower(name) ~ $2)
                  ${orderByQuery}
                  LIMIT $3 OFFSET $4`,
                values: [company.id, searchValue, limit, offset]
            }
            let list = await DB.excu.query(query.text, query.values);
            let count = list.rows && list.rows.length > 0 ? Number((<any>list.rows[0]).count) : 0
            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (list.rows.length < limit || page == pageCount) {
                lastIndex = count
            }
            const resData = {
                list: list.rows,
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


    public static async getRecieptTemplate(recieptTemplateId: string) {
        try {

            const query : { text: string, values: any } = {
                text: `SELECT * FROM  "RecieptTemplates" WHERE id = $1`,
                values: [recieptTemplateId]
            }

            const reciepts = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", reciepts.rows[0])
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async deletRecieptTemplate(recieptTemplateId: string) {
        try {

            const query : { text: string, values: any } = {
                text: `Delete FROM  "RecieptTemplates" WHERE id = $1`,
                values: [recieptTemplateId]
            }

            const reciepts = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "Successfully Deleted", [])
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
}