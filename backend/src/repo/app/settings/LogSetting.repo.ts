import { DB } from "@src/dbconnection/dbconnection";
import { Company } from "@src/models/admin/company";
import { Log } from "@src/models/log";
import { ResponseData } from "@src/models/ResponseData";
import { ValidationException } from "@src/utilts/Exception";
import { publishEvent } from "@src/utilts/system-events";
import { log } from "console";
import { PoolClient, Query } from "pg";
import format from "pg-format";

export class LogsManagmentRepo {
    public static async getMaxDate(client: PoolClient | null, sourceId: string, branchId: string | null, companyId: string): Promise<Date | null> {
        try {
            const query = {
                text: `SELECT CAST (MAX("created_at") AS text) as max_date FROM "ActivityLogs" WHERE "company_id"= $1 and "branch_id"=$2 and "source_id"=$3`,
                values: [companyId, branchId, sourceId]
            }

            const res = client ? await client.query(query.text, query.values) : await DB.exec.query(query.text, query.values);
            return res && res.rows && res.rows.length > 0 ? res.rows[0].max_date : null;
        } catch (error) {
            throw new Error('Error getting max date');
        }
    }

    public static async getBranchEmployeeName(client: PoolClient | null, companyId: string, branchId: string | null, employeeId: string | null) {
        try {
            branchId = branchId ?? null;
            employeeId = employeeId ?? null
            if (!employeeId && !branchId) {
                return
            }
            const query = {
                text: `SELECT "Branches"."name" as "branchName", "Employees"."name" as "employeeName"
                        FROM "Companies" 
                        LEFT JOIN "Branches" on "Branches"."companyId" = "Companies".id and "Branches"."id" = $2
                        LEFT JOIN "Employees" on "Employees"."companyId" = "Companies".id and "Employees"."id" = $3
                        WHERE "Companies".id = $1`,
                values: [companyId, branchId, employeeId]
            }

            const res = client ? await client.query(query.text, query.values) : await DB.exec.query(query.text, query.values);
            return res && res.rows && res.rows.length > 0 ? res.rows[0] : null;

        } catch (error) {
            throw new Error('Error getting branch Name');

        }
    }

    public static async getCompanyNotification(companyId: string) {
        const getCompanyNotification = {
            text: `SELECT id
                    FROM "Companies"
                    WHERE id = $1
                    AND EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements_text("features") f
                        WHERE lower(f) = 'notifications'
                    )`,
            values: [companyId],
        }


        const companyNotification = await DB.excu.query(getCompanyNotification.text, getCompanyNotification.values)
        const cNotification = companyNotification.rows.length > 0 ? companyNotification.rows[0] : null
        return cNotification
    }

    public static async manageLogs(client: PoolClient | null, sourceTable: string, sourceId: string, logs: Log[], branchId: string | null, companyId: string, employeeId: string | null, sourceNumber: string | null, source: string | null = null) {
        try {
            if (!logs || logs.length === 0) return;
            if (source && source === 'POS') {
                const maxDate = await this.getMaxDate(client, sourceId, branchId, companyId);
                logs = logs.filter(log => {
                    const logDate = new Date(log.createdAt);
                    return !maxDate || logDate > new Date(maxDate);
                });

                //capture merge / split order

                const companyNotification = await this.getCompanyNotification(companyId)
                if (companyNotification) {
                    logs.forEach((i: any) => {
                        if (i.action.toLowerCase().includes("merge")) {
                            publishEvent("invoiceMerged", { ...i, companyId: companyId, id: sourceId });
                        }
                        else if (i.action.toLowerCase().includes("split")) {
                            publishEvent("invoiceSplit", { ...i, companyId: companyId, id: sourceId });
                        }
                        else if (i.action.toLowerCase().includes("change price")) {
                            publishEvent("invoiceChangePrice", { ...i, companyId: companyId, id: sourceId });
                        }
                    });
                }
            }

            let branchEmployee = await this.getBranchEmployeeName(client, companyId, branchId, employeeId)

            const employeeName = branchEmployee ? branchEmployee.employeeName : null
            const branchName = branchEmployee ? branchEmployee.branchName : null
            branchId = branchId ?? null
            sourceId = sourceId ?? null
            if (logs && logs.length > 0) {
                const transactionValues = logs.map((update: any, index: number) => {
                    // +1 ms per row;
                    return [companyId,
                        branchId,
                        sourceTable,
                        sourceId,
                        update.action,
                        update.createdAt,
                        update.employeeId,
                        update.comment,
                        source,
                        update.metaData,
                        branchName,
                        employeeName,
                        sourceNumber

                    ]
                });

                let query = `INSERT INTO "ActivityLogs"
                                             ("company_id",
                                             "branch_id",
                                             "source_table",
                                             "source_id",
                                             "action",
                                             "created_at",
                                             "employee_id",
                                             "comment", "source", "meta", "branchName", "employeeName", "sourceNumber")
                                             VALUES %L          
                              `

                const formattedQuery = format(query, transactionValues);
                let insertedProducts = client ? await client.query(formattedQuery) : await DB.exec.query(formattedQuery);
            }
        } catch (error: any) {
            console.log(error)
            return null
        }
    }

    public static async getLogs(client: PoolClient | null, sourceId: string, companyId: string): Promise<any[]> {
        try {

            const query = {
                text: `SELECT "employee_id" ,CAST("created_at" as text) as "createdAt", action, comment, "employeeName" FROM "ActivityLogs" 
                WHERE "company_id"= $2 and "source_id"= $1 ORDER BY "created_at" ASC`,
                values: [sourceId, companyId]
            }

            let res = client ? await client.query(query.text, query.values) : await DB.exec.query(query.text, query.values);
            return res && res.rows ? res.rows : [];
        } catch (error) {
            throw new Error('Error getting logs');
        }
    }

    public static async getLogsReport(data: any, company: Company) {
        try {

            const source_table = data.source_table && Array.isArray(data.source_table) ? data.source_table : data.source_table ? [data.source_table] : ["Invoices", "InvoicePayments", "Billings", "BillingPayments", "Expenses", "Estimates", "PurchaseOrders", "Journals", "CreditNotes", "SupplierCredits", "SupplierAppliedCredits", "AppliedCredits", "RecurringBills", "RecurringExpenses", "BillOfEntries", "Customers", "Accounts", "openingBalance", "Employees", "Products", "Recipe", "MenuRecipe", "PhysicalCounts", "Terminals"];
            const searchTerm = data.searchTerm ? `%${data.searchTerm.toLowerCase().trim()}%` : null;
            const source_id = data.source_id && data.source_id.length > 0 ? data.source_id : null
            const branch_id = data.branch_id && data.branch_id.length > 0 ? data.branch_id : null
            const employee_id = data.employee_id && data.employee_id.length > 0 ? data.employee_id : null
            const date_from = data.date_from ? data.date_from : null
            const date_to = data.date_to ? data.date_to : null

            const page = data.page ?? 1
            const limitBase = data.limit ?? 15
            const limit = (data.limit ?? 15) + 1
            const offset = limit * (page - 1)

            if (!source_table) {
                throw new ValidationException("Source Table is Required!")
            }


            const query = {
                text: `SELECT "created_at","action", "comment","source","branch_id","branchName", "employeeName","employee_id","source_table", "source_id", "sourceNumber", "meta"
                    FROM "ActivityLogs"
                      where "ActivityLogs"."company_id" = $1
                      and ($2::text is null or (lower(trim("ActivityLogs".action)) ilike $2 or 
                           lower(trim("employeeName")) ilike $2))
                      and ($3::uuid[] is null or "source_id" = any($3::uuid[]))
                      and ($4::uuid[] is null or "branch_id" = any($4::uuid[]))
                      and ($5::uuid[] is null or "employee_id" = any($5::uuid[]))
                      and ($6::text[] is null or "source_table" = any($6::text[]))
                      and ($7::date is null or "created_at"::date >= $7::date)
                      and ($8::date is null or "created_at"::date <= $8::date)
                      order by "created_at" desc
                      limit $9
                      offset $10
                `,
                values: [company.id, searchTerm, source_id, branch_id, employee_id, source_table, date_from, date_to, limit, offset]
            }



            const list = await DB.excu.query(query.text, query.values);
            let rows = list.rows;
            const hasNext = rows && rows.length > limitBase ? true : false;
            rows = rows.length > limitBase
                ? rows.slice(0, limitBase)
                : rows;
            return new ResponseData(true, "", { list: rows, hasNext: hasNext })

        } catch (error: any) {
            throw new Error(error)
        }
    }

}