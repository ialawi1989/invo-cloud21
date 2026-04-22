import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { LabelTemplates } from "@src/models/Settings/LabelTemplate"
import { Company } from "@src/models/admin/company";
import { LabelTemplateValidation } from "@src/validationSchema/settings/labelTemplate.Schema";

import { ValidationException } from "@src/utilts/Exception";

export class LabelTemplateRepo {
    /**To prevent Duplication in labelName within company */
    public static async isLabelNameExist(labelId: string | null, companyId: string, name: string) {
        const query : { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "LabelTemplates" where TRIM(LOWER(name)) = TRIM(LOWER($1)) and id <> $2 and "companyId" = $3`,
            values: [
                name,
                labelId,
                companyId,
            ],
        };
        if (labelId == null) {
            query.text = `SELECT count(*) as qty FROM "LabelTemplates" where TRIM(LOWER(name)) = TRIM(LOWER($1)) and "companyId" = $2`;
            query.values = [name, companyId];
        }

        const resault = await DB.excu.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }

        return false;
    }
    public static async saveLabelTemplate(data: any, company: Company) {
        try {

            const validate = await LabelTemplateValidation.validateLabelTemplate(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }


            const labelTemplate = new LabelTemplates();
            labelTemplate.ParseJson(data);
            const companyId = company.id;


            const isLabelNameExist = await this.isLabelNameExist(null, company.id, labelTemplate.name)
            if (isLabelNameExist) {
                throw new ValidationException("Label Name Already Exist")
            }

            labelTemplate.updatedDate = new Date()
            const query : { text: string, values: any } = {
                text: `INSERT INTO "LabelTemplates" ("companyId",
                                                      name,
                                                      "template",
                                                      "ZPL",
                                                      "createdAt",
                                                      "updatedDate",
                                                      "labelHeight",
                                                      "labelWidth",
                                                      
                                                      "dpi",
                                                      "templateType")VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
                values: [companyId,
                    labelTemplate.name,
                    JSON.stringify(labelTemplate.template),
                    labelTemplate.ZPL,
                    labelTemplate.createdAt,
                    labelTemplate.updatedDate,
                    labelTemplate.labelHeight,
                    labelTemplate.labelWidth,
                    labelTemplate.dpi,
                    labelTemplate.templateType]
            }

            const resault = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", { id: (<any>resault.rows[0]).id })
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async editLabelTemplate(data: any, company: Company) {
        try {

            const validate = await LabelTemplateValidation.validateLabelTemplate(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            const labelTemplate = new LabelTemplates();
            labelTemplate.ParseJson(data);

            const isLabelNameExist = await this.isLabelNameExist(labelTemplate.id, company.id, labelTemplate.name)
            if (isLabelNameExist) {
                throw new ValidationException("Label Name Already Exist")
            }


            labelTemplate.updatedDate = new Date()
            const query : { text: string, values: any } = {
                text: `UPDATE "LabelTemplates" SET name=$1,
                                                   "template"=$2,
                                                   "ZPL"=$3,
                                                   "updatedDate"=$4,
                                                   "labelHeight"=$5,
                                                   "labelWidth"=$6,
                                                   "dpi"=$7 ,
                                                   "templateType"=$8
                                                WHERE id=$9`,
                values: [labelTemplate.name,
                JSON.stringify(labelTemplate.template),
                labelTemplate.ZPL,
                labelTemplate.createdAt,
                labelTemplate.labelHeight,
                labelTemplate.labelWidth,
                labelTemplate.dpi,
                labelTemplate.templateType,
                labelTemplate.id]
            }

            const resault = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", {})
        } catch (error: any) {

          

            throw new Error(error.message)
        }
    }
    public static async getLabelTemplates(data: any, company: Company) {
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
                "templateType" FROM  "LabelTemplates" 
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
    public static async geLabelTemplateById(labelTemplateId: string) {
        try {


            const query : { text: string, values: any } = {
                text: `SELECT id,name,template,"ZPL","labelWidth","labelHeight","dpi","templateType" FROM "LabelTemplates" where id=$1 `,
                values: [labelTemplateId]
            }

            const resault = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", resault.rows[0])
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async deleteLabelTemplateById(labelTemplateId: string) {
        try {


            const query : { text: string, values: any } = {
                text: `DELETE FROM "LabelTemplates" where id=$1 `,
                values: [labelTemplateId]
            }

            const resault = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "Successfully Deleted", [])
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
}