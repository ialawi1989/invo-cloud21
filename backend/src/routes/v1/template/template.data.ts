import { PromotionsRepository } from "../promotions/promotions.data";
import { PoolClient } from "pg";
import { Template } from "./template.modal";
import { SQL } from "../promotions/common/sql";
import { UUID } from "../promotions/common/uuid";
import { orderBy, PageInfo, queryPage } from "../promotions/common/pagination";
import { SortInfo } from "../promotions/common/sortInfo";

export class TemplateRepository {

    private client: PoolClient;
    constructor(promotionsRepository: PromotionsRepository, client: PoolClient) {
        this.client = client;
    }

    //get template
    async getTemplates(companyId: string, pageInfo?: PageInfo,
        sortInfo?:SortInfo ): Promise<Template[]> {
        const query: SQL = {
            text: `SELECT * FROM "Templates" WHERE "companyId" = $1`,
            values: [companyId]
        };
        query.text += orderBy({
            "title": "title"
        }, 'title', sortInfo)
       // const results = (await this.client.query(query.text, query.values)).rows;
        const results = (await queryPage<any>(this.client, query, pageInfo)).map(
              (row:any, index:any) => row
            );

        if (results && results.length > 0) return results;
        return [];
    }

    //get template by id
    async getTemplateById(id: string): Promise<Template | any> {
        const query: SQL = {
            text: `SELECT * FROM "Templates"
                    WHERE id=$1 LIMIT 1`,
            values: [id]
        };
        const results = (await this.client.query(query.text, query.values)).rows;
        if (results && results.length > 0) return results[0];
        return undefined;
    }

    //insert 
    async createTemplate(companyId: string, employeeId: string, template: Template) {
        template.id = UUID()
        template.createdBy = await this.getEmployeeName(employeeId, companyId)
        template.createdAt = new Date()
        template.updatedBy = await this.getEmployeeName(employeeId, companyId)
        template.updatedAt = new Date()

        const query: SQL = {
            text: `INSERT INTO "Templates" 
                    ("id", "companyId", "title", "type", "template", "outputType", "createdAt", "updatedAt", "createdBy", "updatedBy")
                    VALUES
                    ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `,
            values: [
                template.id,
                companyId,
                template.title,
                template.type,
                JSON.stringify(template.template), // TemplateContent[]
                template.outputType,
                template.createdAt,
                template.updatedAt,
                template.createdBy,
                template.updatedBy
            ]
        };

        const result = (await this.client.query(query.text, query.values)).rows;
        return result;

    }

    //update
    async updateTemplate(companyId: string, employeeId: string, id: string, template: Template) {

        template.updatedAt = new Date()
        template.updatedBy = await this.getEmployeeName(employeeId, companyId)

        const query: SQL = {
            text: `UPDATE "Templates"
                    SET "title"=$2, 
                        "type"=$3, 
                        "template"=$4::jsonb, 
                        "outputType"=$5, 
                        "updatedAt"=$6, 
                        "updatedBy"=$7 
                    WHERE id=$1`,
            values: [
                id,
                template.title,
                template.type,
                JSON.stringify(template.template),
                template.outputType,
                template.updatedAt,
                template.updatedBy
            ]
        };

        const result = (await this.client.query(query.text, query.values)).rows;
        return result;

    }

    //delete
    async deleteTemplate(employeeId: string, id: string) {
        const query: SQL = {
            text: `DELETE FROM "Templates" 
                    WHERE id=$1`,
            values: [id]
        }

        const result = (await this.client.query(query.text, query.values)).rows;
        return result;

    }

    public async getEmployeeName(employeeId: string, companyId: string) {

        const query: SQL = {
            text: `--sql
                SELECT
                    e."name"
                FROM "Employees" AS e
                WHERE e.id = $1 AND  e."companyId"=$2
                UNION
                SELECT
                    e."name"
                FROM "CompanyEmployees" AS ce
                  INNER JOIN "Employees" AS e ON e."id" = ce."employeeId"
                WHERE ce."employeeId" = $1 AND  ce."companyId"=$2`,
            values: [employeeId, companyId]
        }
        const rows = (await this.client.query(query.text, query.values)).rows;
        if (rows && rows.length > 0) return rows[0].name;
        return undefined;
    }



}