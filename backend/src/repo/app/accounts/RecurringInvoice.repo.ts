import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Helper } from "@src/utilts/helper";
import { PoolClient } from "pg";




import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { RecurringInvoice } from "@src/models/account/RecurringInvoice";
import { InvoiceValidation } from "@src/validationSchema/account/invoice.Schema";
import { InvoiceRepo } from "./invoice.repo";
import { Invoice } from "@src/models/account/Invoice";
import { CompanyRepo } from "@src/repo/admin/company.repo";
import moment from "moment";
import { ProductRepo } from "../product/product.repo";
import { TriggerQueue } from "@src/repo/triggers/triggerQueue";
import { InvoiceStatuesQueue } from "@src/repo/triggers/queue/workers/invoiceStatus.worker";
import { recurringDueWhere, nextOccurrence, runWithConcurrency, RECURRING_AUTO_CONCURRENCY } from "./recurringSchedule.sql";

export class RecurringInvoiceRepo {

    public static async checkIsRecurringInvoiceNameExist(client: PoolClient, id: string | null, name: string, companyId: string) {
        try {

            const searchTerm = '%' + Helper.escapeSQLString(name.toLowerCase().trim()) + '%'
            const query: { text: string, values: any } = {
                text: `SELECT 
                        "RecurringInvoices". "name" 
                    FROM "RecurringInvoices"
                    INNER JOIN "Branches" ON "Branches".id = "RecurringInvoices"."branchId"
                    WHERE "Branches"."companyId"=$1
                            AND lower("RecurringInvoices".name) ILIKE $2
                `,
                values: [companyId, searchTerm]
            }

            if (id != null) {
                query.text = `SELECT 
                         "RecurringInvoices"."name" 
                    FROM "RecurringInvoices"
                    INNER JOIN "Branches" ON "Branches".id = "RecurringInvoices"."branchId"
                    WHERE "Branches"."companyId"=$1
                          AND lower("RecurringInvoices".name) ILIKE $2
                          AND "RecurringInvoices".id <> $3 `
                query.values = [companyId, searchTerm, id]
            }





            const records = await client.query(query.text, query.values);
            if (records.rowCount != null && records.rowCount > 0) {
                return true;
            } else {
                return false;
            }
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getsRecurringInvoiceCustomerId(client: PoolClient, id: string) {
        try {


            const query: { text: string, values: any } = {
                text: `SELECT 
                        "customerId"
                    FROM "RecurringInvoices"
                    WHERE id = $1
                `,
                values: [id]
            }
            const records = await client.query(query.text, query.values);
            if (records.rowCount != null && records.rowCount > 0) {
                return records.rows[0].customerId;
            } else {
                return null;
            }
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async checkIsRecurringInvoiceHasChildInvoices(client: PoolClient, recurringInvoiceId: string) {
        try {


            const query: { text: string, values: any } = {
                text: `SELECT id from "Invoices" where "Invoices"."recurringInvoiceId" = $1 `,
                values: [recurringInvoiceId]
            }
            const records = await client.query(query.text, query.values);
            if (records.rowCount != null && records.rowCount > 0) {
                return true;
            } else {
                return false;
            }
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getInvoiceNumber(client: PoolClient, companyId: string) {
        try {

            let invoiceNumber = "(^RINV)[_\-]"

            const regexp = '^RINV[_-]*';
            const numberPattern = '^[0-9\.]+$'

            const query: { text: string, values: any } = {
                text: `SELECT "invoiceNumber" 
                        FROM "Invoices"
                        Where "Invoices"."companyId" = $1
                        and "invoiceNumber" ~ $2
                        and nullif(regexp_replace("invoiceNumber", $3, '', 'g'), '') ~ $4
                        ORDER BY( nullif(regexp_replace("invoiceNumber", $3 , ''),'')::int )DESC
                        LIMIT 1`,
                values: [companyId, invoiceNumber, regexp, numberPattern]
            }

            const data = await client.query(query.text, query.values);
            if (data.rowCount != null && data.rowCount <= 0) {
                invoiceNumber = "RINV-1";
            } else {
                invoiceNumber = await Helper.generateNumber((<any>data.rows[0]).invoiceNumber)
            }


            return invoiceNumber
        } catch (error: any) {
            console.log(error.message)
          
            throw new Error(error.message)
        }
    }

    public static trim_Date(data: any) {
        let y;
        for (const x in data) {
            y = data[x];
            if (["dueDate", "createdAt", "invoiceDate", "prodDate", "expireDate"].includes(x)) {
                delete data[x];

            }
            if (y instanceof Object) y = this.trim_Date(y);
        }
        return data;
    }

    public static async addRecurringInvoice(client: PoolClient, data: any, company: Company, employeeId: string) {

        try {
            const companyId = company.id;

            const recurringInvoice = new RecurringInvoice();
            recurringInvoice.ParseJson(data);
            if (recurringInvoice.name) {
                const isRecurringInvoiceNameExist = await this.checkIsRecurringInvoiceNameExist(client, null, recurringInvoice.name, companyId)
                if (isRecurringInvoiceNameExist) {
                    throw new ValidationException("Recurring Invoice Name Already Used")
                }
            }



            // ############## Invoice Validation  ##############     
            if (!recurringInvoice.transactionDetails) { throw new ValidationException("transaction Details is required") }
            const validate = await InvoiceValidation.invoiceValidationForReurringInvoice(recurringInvoice.transactionDetails);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            recurringInvoice.transactionDetails.employeeId = employeeId
            recurringInvoice.transactionDetails = this.trim_Date(recurringInvoice.transactionDetails)


            //***********products type validation ***********/
            let productIds: string[] = [];
            recurringInvoice.transactionDetails.lines.forEach((elem: any) => { if (elem.productId) productIds.push(elem.productId); })

            //batch and serialized can't be added in Recurring Invoice
            const types: any[string] = ["inventory", "kit", "menuItem", "menuSelection", "package", "service"];

            const isProductTypeValide = await ProductRepo.checkIfProductsTypeValid(client, productIds ?? [], types, companyId);
            if (!isProductTypeValide) {
                throw new ValidationException("Invalid Product Type")
            }


            // ###############################################

            recurringInvoice.createdAt = new Date()
            recurringInvoice.updatedDate = new Date()


            const query: { text: string, values: any } = {
                text: `INSERT INTO "RecurringInvoices" 
                                   ( name, type, "createdAt", "updatedDate", "customerId", "branchId", "transactionDetails", "startDate", "endDate", "endTerm", "repeatData", "invoiceCreatedBefore") 
                            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, $12) RETURNING id `,
                values: [
                    recurringInvoice.name,
                    recurringInvoice.type,
                    recurringInvoice.createdAt,
                    recurringInvoice.updatedDate,
                    recurringInvoice.customerId,
                    recurringInvoice.branchId,
                    JSON.stringify(recurringInvoice.transactionDetails),
                    recurringInvoice.startDate,
                    recurringInvoice.endDate,
                    recurringInvoice.endTerm,
                    JSON.stringify(recurringInvoice.repeatData),
                    recurringInvoice.invoiceCreatedBefore
                ]
            }




            const recurringInvoiceInsert = await client.query(query.text, query.values);

            if (recurringInvoiceInsert.rows && recurringInvoiceInsert.rows.length > 0) {
                const recurringInvoiceId = (<any>recurringInvoiceInsert.rows[0]).id;
                recurringInvoice.id = recurringInvoiceId
                return new ResponseData(true, "Added Successfully", { id: recurringInvoiceId, recurringInvoice: recurringInvoice })
            }

            return new ResponseData(false, "", {})

        } catch (error: any) {
            console.log(error)
            //;

            throw new Error(error.message)

        }
    }

    public static async editRecurringInvoice(client: PoolClient, data: any, company: Company, employeeId: string | null, source: string | null = null) {

        try {

            if (data.id == "" || data.id == null) { throw new ValidationException("Recurring Invoice Id is Required") }

            const companyId = company.id;
            const recurringInvoice = new RecurringInvoice();
            recurringInvoice.ParseJson(data);
            recurringInvoice.updatedDate = new Date()

            if (recurringInvoice.name) {
                const isEstimateNumberExist = await this.checkIsRecurringInvoiceNameExist(client, recurringInvoice.id, recurringInvoice.name, companyId)
                if (isEstimateNumberExist) { throw new ValidationException("Recurring Invoice Name Already Used") }
            }


            // ############## Invoice Validation  ##############     
            if (!recurringInvoice.transactionDetails) { throw new ValidationException("transaction Details is required") }
            const validate = await InvoiceValidation.invoiceValidationForReurringInvoice(recurringInvoice.transactionDetails);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            recurringInvoice.transactionDetails.employeeId = employeeId
            recurringInvoice.transactionDetails = this.trim_Date(recurringInvoice.transactionDetails)

            //***********Cusomer validation(perevent supplier change) ***********/

            recurringInvoice.hasInvoices = await this.checkIsRecurringInvoiceHasChildInvoices(client, recurringInvoice.id)



            if (recurringInvoice.hasInvoices) {
                recurringInvoice.customerId = null
                recurringInvoice.branchId = null
            }



            //***********products type validation ***********/
            let productIds: any = [];
            recurringInvoice.transactionDetails.lines.forEach((elem: any) => { if (elem.productId) productIds.push(elem.productId); })

            //batch and serialized can't be added in Recurring Invoice
            const types: any[string] = ["inventory", "kit", "menuItem", "menuSelection", "package", "service"];
            const isProductTypeValide = await ProductRepo.checkIfProductsTypeValid(client, productIds, types, companyId);
            if (!isProductTypeValide) {
                throw new ValidationException("Invalid Product Type")
            }

            // ###############################################

            const query: { text: string, values: any } = {
                text: `UPDATE "RecurringInvoices"
	                    SET name=$1, 
                            type=$2, 
                            "updatedDate"=$3, 
                           
                            "startDate"=$4, 
                            "endDate"=$5, 
                            "endTerm"=$6, 
                            "repeatData"=$7, 
                            "transactionDetails" = $8,
                            "invoiceCreatedBefore"=$9,
                             "customerId" = COALESCE($10,"customerId")  ,
                            "branchId"= COALESCE($11,"branchId")
                            
                        WHERE  id=$12   RETURNING *`,

                values: [recurringInvoice.name,
                recurringInvoice.type,
                recurringInvoice.updatedDate,

                recurringInvoice.startDate,
                recurringInvoice.endDate,
                recurringInvoice.endTerm,
                JSON.stringify(recurringInvoice.repeatData),
                JSON.stringify(recurringInvoice.transactionDetails),
                recurringInvoice.invoiceCreatedBefore,
                recurringInvoice.customerId ?? null,
                recurringInvoice.branchId ?? null,
                recurringInvoice.id

                ]
            }



            const recurringInvoiceEdit = await client.query(query.text, query.values);

            if (recurringInvoiceEdit.rows && recurringInvoiceEdit.rows.length > 0) {
                const recurringInvoiceId = (<any>recurringInvoiceEdit.rows[0]).id;
                recurringInvoice.id = recurringInvoiceId
                return new ResponseData(true, "Updated Successfully", { id: recurringInvoiceId, recurringInvoice: recurringInvoice })
            }

            return new ResponseData(false, "", {})

        } catch (error: any) {
            console.log(error)
          
            throw new Error(error)
        }
    }

    public static async getRecurringInvoiceById(recurringInvoiceId: string, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            const companyId = company.id;
            const query: { text: string, values: any } = {
                text: `SELECT  "RecurringInvoices".* 
                        from "RecurringInvoices"
                        Inner join "Branches" ON "Branches".id = "RecurringInvoices"."branchId"
                        WHERE "RecurringInvoices".id =$1 AND "Branches"."companyId"=$2
                      `,
                values: [recurringInvoiceId, company.id]
            }

            const recurringInvoiceData = await client.query(query.text, query.values);
            const recurringInvoice = new RecurringInvoice();
            recurringInvoice.ParseJson(recurringInvoiceData.rows[0]);

            recurringInvoice.hasInvoices = await this.checkIsRecurringInvoiceHasChildInvoices(client, recurringInvoiceId)

            // ############## Invoice Validation  ##############     
            if (!recurringInvoice.transactionDetails) { throw new ValidationException("transaction Details is required") }
            // const validate = await InvoiceValidation.invoiceValidation(recurringInvoice.transactionDetails);
            // if (!validate.valid) {
            //     throw new ValidationException(validate.error);
            // }

            recurringInvoice.transactionDetails = this.trim_Date(recurringInvoice.transactionDetails)
            // ###############################################

            await client.query("COMMIT");

            return new ResponseData(true, "", recurringInvoice);
        } catch (error: any) {
            await client.query("ROLLBACK");
          
            throw new Error(error.message)
        } finally {
            client.release();
        }
    }

    public static async getRecurringInvoiceOverview(recurringInvoiceId: string, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            const companyId = company.id;
            const query: { text: string, values: any } = {
                text: `with "t1" as (
                            SELECT   "RecurringInvoices".id,
                                    "RecurringInvoices".name, 
                                    "Branches".name as "branchName",
                                    "RecurringInvoices"."createdAt",
                                    "RecurringInvoices"."updatedDate", 
                                    "RecurringInvoices"."customerId", 
                                    "RecurringInvoices"."branchId", 
                                    "RecurringInvoices"."startDate", 
                                    "RecurringInvoices"."endDate", 
                                    "RecurringInvoices"."endTerm", 
                                    "RecurringInvoices"."repeatData", 
                                    "Customers".name as "customerName"
                                
                            FROM "RecurringInvoices"
                            Inner JOIN "Branches"  on "Branches".id = "RecurringInvoices"."branchId"
                            left join "Customers" on "Customers".id = "RecurringInvoices"."customerId"
                            WHERE "RecurringInvoices".id = $1
                                AND "Branches"."companyId"= $2
                            )
                            ,"t2" as (
                            SELECT  count(*) over(),
                                    "Invoices".id,
                                    "Invoices"."invoiceNumber",
                                    "Invoices"."createdAt",
                                    "Invoices"."dueDate",
                                    "Invoices".note, 
                                    "Invoices".status,
                                    "Invoices".total,
                                    "Invoices"."invoiceDate",
                                    "Invoices"."recurringInvoiceId",
                                    sum("CreditNotes".total) as refunded,
                                    sum("AppliedCredits".amount) as "appliedCredit",
                                    sum("InvoicePaymentLines".amount) as "paidAmount"
                            FROM "Invoices"
                            left JOIN "Branches"  ON "Branches".id =  "Invoices"."branchId"
                            left join "CreditNotes" ON "CreditNotes"."invoiceId" ="Invoices".id 
                            left join "AppliedCredits" ON "AppliedCredits"."invoiceId" ="Invoices".id
                            left join "InvoicePaymentLines" ON "InvoicePaymentLines"."invoiceId" ="Invoices".id
                            where "Branches"."companyId"= $2
                            and "Invoices"."recurringInvoiceId" = $1
                            group by  "Invoices".id
                            )
                            select "t1".*, 
                                    case WHEN "t2"."recurringInvoiceId" is not null then json_agg("t2".*) end as "childInvoices"
                            from "t1"
                            left join "t2" on "t1".id = "t2"."recurringInvoiceId"
                            group by "t1".id, "t1".name, "t1"."branchName","t1"."createdAt", "t1"."updatedDate", "t1"."customerId", "t1"."branchId", 
                                     "t1"."startDate",  "t1"."endDate", "t1"."endTerm", "t1"."repeatData", "t1"."customerName",  "t2"."recurringInvoiceId"
                      `,
                values: [recurringInvoiceId, company.id]
            }

            const records = await client.query(query.text, query.values);

            let recurringInvoice

            // ############## NEXT BILL DATE  ############## 
            if (records.rows && records.rows.length > 0) {
                recurringInvoice = records.rows[0]
                let startDate = moment(new Date(recurringInvoice.startDate))


                let nextInvoiceDate = await this.getNextInvoiceDate(startDate, recurringInvoice.repeatData)


                // let firstInvoiceDate = startDate.clone().set('date', recurringInvoice.repeatData.on ); 
                // if (startDate.date() > Number(recurringInvoice.repeatData.on)  ){
                //     (firstInvoiceDate.add(1, 'month'))
                // }

                // let diff = moment().diff(firstInvoiceDate, 'months') +1
                // let nextInvoiceDate = firstInvoiceDate.clone().add((diff% Number(recurringInvoice.repeatData.periodQty))*  Number(recurringInvoice.repeatData.periodQty), 'month')

                recurringInvoice.nextInvoiceDate = nextInvoiceDate


            }
            // ###############################################

            await client.query("COMMIT");

            return new ResponseData(true, "", recurringInvoice ?? {});
        } catch (error: any) {
            await client.query("ROLLBACK");
          
            throw new Error(error.message)
        } finally {
            client.release();
        }
    }

    public static async getNextInvoiceDate(startDate: moment.Moment, repeatData: { on: any, periodQty: any, periodicity: any }) {
        try {
            return nextOccurrence(startDate, repeatData);
        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    public static async getRecurringInvoiceList(data: any, company: Company,branchList:any[]) {

        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const filter = data.filter 
            const branches = filter && filter.branches && filter.branches.length > 0 ? filter.branches : branchList;

            const companyId = company.id;

            //############## filter ##############
            let filterQuery = `Where "Branches"."companyId" = $1  AND (array_length($2::uuid[], 1) IS NULL OR ("RecurringInvoices"."branchId"=any($2::uuid[])))
 `
            let searchValue = data.searchTerm ? `'^.*` + Helper.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `.*$'` : null;
            if (searchValue) {
                filterQuery += `and (LOWER("RecurringInvoices".name) ilike ${searchValue}
                                        OR LOWER("Branches".name) ilike ${searchValue}    
                                )`
            }

            //############## Sort ##############
            let sort = data.sortBy;
            let sortValue = !sort ? ' "RecurringInvoices"."createdAt":: timestamp:: time ' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by` + sortTerm

            //############## limit ##############
            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            let page = data.page ?? 1
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            //############## Counter ##############

            const counterQuery: { text: string, values: any } = {
                text: `select count(*)
                        FROM "RecurringInvoices"
                        Inner JOIN "Branches"  on"Branches"."companyId" = $1 and   "Branches".id = "RecurringInvoices"."branchId"
                        ${filterQuery}
                        `,
                values: [companyId,branches]
            }
            const counter = await client.query(counterQuery.text, counterQuery.values)

            //############## Select ##############


            const query: { text: string, values: any } = {
                text: `with "list" as ( SELECT   "RecurringInvoices".id,
                                "RecurringInvoices".name, 
                                "RecurringInvoices"."createdAt",
                                "RecurringInvoices"."updatedDate", 
                                "RecurringInvoices"."customerId", 
                                "RecurringInvoices"."branchId", 
                                "RecurringInvoices"."startDate", 
                                "RecurringInvoices"."endDate", 
                                "RecurringInvoices"."endTerm", 
                                "RecurringInvoices"."repeatData", 
                          
                                "Customers".name as "customerName",
                                "Branches".name as "branchName"
                        FROM "RecurringInvoices"
                        Inner JOIN "Branches"  on "Branches"."companyId" = $1 and "Branches".id = "RecurringInvoices"."branchId"
                        left join "Customers" on "Customers"."companyId" = $1 and  "Customers".id = "RecurringInvoices"."customerId"
                        ${filterQuery}
                        group by "RecurringInvoices".id, "Customers".name, "Branches".name
                        ${orderByQuery}
                        limit $3 offset $4)
                        select "list".*,count("Invoices"."recurringInvoiceId")::int as "childInvoicesQty" from "list"
                        left join "Invoices" on "Invoices"."companyId" = $1 and "list".id = "Invoices"."recurringInvoiceId"
                        group by 
                                "list".id,
                                "list".name, 
                                "list"."createdAt",
                                "list"."updatedDate", 
                                "list"."customerId", 
                                "list"."branchId", 
                                "list"."startDate", 
                                "list"."endDate", 
                                "list"."endTerm", 
                                "list"."repeatData", 
                                "list"."customerName",
                                "list"."branchName"
                               
                        `,
                values: [companyId,branches, limit, offset]
            }
            const selectList = await client.query(query.text, query.values)


            let count = counter.rows && counter.rows.length > 0 ? Number((<any>counter.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const list: any[] = selectList.rows ?? [];


            const resData = {
                list: list,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            await client.query("COMMIT")
            return new ResponseData(true, "", resData)
        } catch (error: any) {
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async deleteRecurringInvoice(client: PoolClient, id: string) {
        try {

            const isRecurringInvoiceNameExist = await this.checkIsRecurringInvoiceHasChildInvoices(client, id)
            if (isRecurringInvoiceNameExist) {
                throw new ValidationException("cannot delete Recurring Invoice with child Invoices")
            }

            const query: { text: string, values: any } = {
                text: `Delete FROM "RecurringInvoices" where id = ($1)  `,
                values: [id]
            }

            const data = await client.query(query.text, query.values);
            return new ResponseData(true, "", data.rows[0]);
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async generateAutoInvoices() {
        // See generateAutoBills in RecurringBill.repo.ts for the rationale:
        // SELECT through the pool, then a fresh client per iteration so the
        // 60s auto-release timer in DB.excu.client() cannot kill the cron
        // mid-batch and we never sit "idle in transaction".
        let recurringInvoices: any
        try {
            const queryText = `select "RecurringInvoices".*
                        from "RecurringInvoices"
                        where ${recurringDueWhere({
                recurringTable: '"RecurringInvoices"',
                childTable: '"Invoices"',
                childFkColumn: '"recurringInvoiceId"',
            })}`
            recurringInvoices = await DB.excu.query(queryText, [new Date()])
        } catch (error: any) {
            console.log("generateAutoInvoices: failed to load due recurring invoices", error)
            throw new Error(error)
        }

        await runWithConcurrency(recurringInvoices.rows, RECURRING_AUTO_CONCURRENCY, async (recurringRow: any) => {
            const client = await DB.excu.client()
            try {
                await client.query("BEGIN")

                const element = new RecurringInvoice()
                element.ParseJson(recurringRow)
                let invoiceData = new Invoice()
                invoiceData.ParseJson(element.transactionDetails)

                // Lightweight, in-transaction loader (see generateAutoBills
                // in RecurringBill.repo.ts for the full rationale).
                const company = await CompanyRepo.getCompanyMinimalForBranch(client, invoiceData.branchId)
                if (!company) {
                    await client.query("ROLLBACK")
                    console.log(`generateAutoInvoices: branch not found for recurring invoice id=${recurringRow?.id} branchId=${invoiceData.branchId}`)
                    return
                }

                let invoiceNumber = await RecurringInvoiceRepo.getInvoiceNumber(client, company.id)
                invoiceData.invoiceNumber = invoiceNumber ?? ""
                invoiceData.recurringInvoiceId = element.id
                let response = await InvoiceRepo.addInvoice(client, invoiceData, company)

                if (!response || !response.success) {
                    await client.query("ROLLBACK")
                    console.log(`generateAutoInvoices: addInvoice returned non-success for recurring invoice id=${recurringRow?.id}`, response)
                    return
                }

                await client.query("COMMIT")

                let queueInstance = TriggerQueue.getInstance();
                InvoiceStatuesQueue.get().createJob({
                    id: response.data.invoice.id
                } as any);
                queueInstance.createJob({ journalType: "Movment", type: "invoice", id: [response.data.invoice.id] })
                queueInstance.createJob({ journalType: "Movment", type: "parentChildMovment", ids: [response.data.invoice.id] })
                queueInstance.createJob({ type: "Invoices", id: [response.data.invoice.id], companyId: company.id })
            } catch (innerError: any) {
                try { await client.query("ROLLBACK") } catch (_) { /* ignore */ }
                console.log(`generateAutoInvoices: failed for recurring invoice id=${recurringRow?.id}`, innerError)
                // continue with the next recurring invoice instead of aborting the whole batch
            } finally {
                client.release()
            }
        })

    }


}