import { DB } from "@src/dbconnection/dbconnection";
import { WorkOrder } from "@src/models/account/WorkOrder";
import { Company } from "@src/models/admin/company";
import { ResponseData } from "@src/models/ResponseData";

import { PoolClient } from "pg";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";


export class WorkOrderRepo {

    public static async checkWorkOrderIdExist(workOrderId: string, invoiceId: string, branchId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT count(*) from "WorkOrders" where id=$1 and "invoiceId"=$2 and "branchId"=$3`,
                values: [workOrderId, invoiceId, branchId]
            }

            const workOrder = await DB.excu.query(query.text, query.values);
            if ((<any>workOrder.rows[0]).count > 0) {
                return true
            }
            return false
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async saveWorkOrder(client: PoolClient, data: any,branchId:string) {
        try {

            const workOrder = new WorkOrder();
            workOrder.ParseJson(data)
            const query: { text: string, values: any } = {
                text: `INSERT INTO "WorkOrders" (id,"workOrderNumber","status","invoiceId","note","expectedStartDate","expectedEndDate","priorty","employeeId","additionalEmployees","tasks","createdAt","updatedDate") 
                      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
                values: [
                    workOrder.id,
                    workOrder.workOrderNumber,
                    workOrder.status,
                    workOrder.invoiceId,
                    workOrder.note,
                    workOrder.expectedStartDate,
                    workOrder.expectedEndDate,
                    workOrder.priorty,
                    workOrder.employeeId,
                    JSON.stringify(workOrder.additionalEmployees),
                    JSON.stringify(workOrder.tasks),
                    workOrder.createdAt,
                    workOrder.updatedDate]
            }

            await client.query(query.text, query.values);
        } catch (error: any) {
            console.log(error)
          
            logPosErrorWithContext(error, data, branchId, null, "saveWorkOrder")
            throw new Error(error.message)

        }
    }

    public static async editWorkOrder(client: PoolClient, data: any, branchId: string) {
        try {

            const workOrder = new WorkOrder();
            workOrder.ParseJson(data)
            const query: { text: string, values: any } = {
                text: `UPDATE "WorkOrders" SET "workOrderNumber"=$1,"status"=$2,"note"=$3,"expectedStartDate"=$4,"expectedEndDate"=$5,"priorty"=$6,"additionalEmployees"=$7,"tasks"=$8 ,"updatedDate"=$9
                      where id = $10`,
                values: [workOrder.workOrderNumber,
                workOrder.status,
                workOrder.note,
                workOrder.expectedStartDate,
                workOrder.expectedEndDate,
                workOrder.priorty,
                JSON.stringify(workOrder.additionalEmployees),
                JSON.stringify(workOrder.tasks),
                workOrder.updatedDate,
                workOrder.id]
            }

            await client.query(query.text, query.values);
        } catch (error: any) {
          
            console.log(error)
            logPosErrorWithContext(error, data, branchId, null, "editWorkOrder")
            throw new Error(error.message)
        }
    }

    public static async getWorkOrderList(data: any, company: Company) {
        try {
            const companyId = company.id;
            let selectQuery;
            let selectValues;

            let countQuery;
            let countValues;


            let searchValue;
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

            const selectText = `Select 
                           "WorkOrders".*
                        from "WorkOrders"
                        INNER JOIN "Invoices" ON "Invoices".id = "WorkOrders"."invoiceId" 
                        INNER JOIN "Branches" ON "Branches".id ="Invoices"."branchId"
                           `

            const countText = `Select 
                                COUNT(*)
                        from "WorkOrders"`

            const filterQuery = `Where "Branches"."companyId"=$1`
            let limitQuery = ` LIMIT $2 OFFSET $3`



            selectQuery = selectText + filterQuery
            selectValues = [companyId]
            let pageCount;
            let selectList;
            let selectCount;
            let orderByQuery;
            if (data != null && data != '' && JSON.stringify(data) != '{}') {
                searchValue = '%' + data.searchTerm.trim().toLowerCase() + '%'
                offset = data.page - 1
                sort = data.sortBy;
                sortValue = !sort ? '"createdAt"' : '"' + sort.sortValue + '"';
                sortDirection = !sort ? "DESC" : sort.sortDirection;
                sortTerm = sortValue + " " + sortDirection;
                orderByQuery = ' Order By ' + sortTerm
                selectQuery = selectText + filterQuery + orderByQuery + limitQuery
                selectValues = [companyId, limit, offset]
                countQuery = countText + filterQuery
                countValues = [companyId]

                if (data.searchTerm != "" && data.searchTerm != null) {
                    const searchQuery = ` and (LOWER("Branches".name) like $2 
                    OR LOWER("WorkOrders".note) like $2 
                    OR LOWER("WorkOrders".status) like $2 
                    OR LOWER("WorkOrders"."workOrderNumber") like $2 
                    OR nullif(regexp_replace("workOrderNumber", '[A-Z]*-', ''),'') like $2
                    )`
                    limitQuery = `  LIMIT $3 OFFSET $4 `
                    selectQuery = selectText + filterQuery + searchQuery + orderByQuery + limitQuery
                    selectValues = [companyId, searchValue, limit, offset]
                    countQuery = countText + filterQuery + searchQuery
                    countValues = [companyId, searchValue]
                }

                selectCount = await DB.excu.query(countQuery, countValues)
                count = Number((<any>selectCount.rows[0]).count)
                pageCount = Math.ceil(count / data.limit)
            }


            selectList = await DB.excu.query(selectQuery, selectValues)



            offset += 1;
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

    public static async getWorkOrderById(workOrderId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT * FROM "WorkOrders" where id =$1`,
                values: [workOrderId]
            }
            const workOrder = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", workOrder.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async getWorkOrdes(branchId: string, date: any | null = null) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT 
                        "WorkOrders".id,
                        "WorkOrders"."workOrderNumber",
                        "WorkOrders".status,
                        "WorkOrders"."invoiceId",
                        "WorkOrders".note,
                        "WorkOrders"."expectedStartDate",
                        "WorkOrders"."expectedEndDate",
                        "WorkOrders".priorty,
                        "WorkOrders"."additionalEmployees",
                        "WorkOrders".tasks,
                        "WorkOrders".tasks,
                      FROM "WorkOrders"
                      INNER JOIN "Invoices"
                      ON "Invoices".id = "WorkOrders"."invoiceId"
                      where "Invoices"."branchId" = $1`,
                values: [branchId]
            }

            if (date != null) {

                query.text = `SELECT 
                "WorkOrders".id,
                "WorkOrders"."workOrderNumber",
                "WorkOrders".status,
                "WorkOrders"."invoiceId",
                "WorkOrders".note,
                "WorkOrders"."expectedStartDate",
                "WorkOrders"."expectedEndDate",
                "WorkOrders".priorty,
                "WorkOrders"."additionalEmployees",
                "WorkOrders".tasks,
                "WorkOrders".tasks,
              FROM "WorkOrders"
              INNER JOIN "Invoices"
              ON "Invoices".id = "WorkOrders"."invoiceId"
              where "Invoices"."branchId" = $1
              and ("WorkOrders"."updatedDate">$2 or "WorkOrders"."createdAt">$2)`
                query.values = [branchId, date]
            }

            const workOrders = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", workOrders.rows[0])
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
}