import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Helper } from "@src/utilts/helper";
import { PoolClient } from "pg";



import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { RecurringBill } from "@src/models/account/RecurringBills";
import { BillingValidation } from "@src/validationSchema/account/billing.Schema";
import { BillingRepo } from "./billing.repo";
import { Billing } from "@src/models/account/Billing";
import { CompanyRepo } from "@src/repo/admin/company.repo";
import moment from "moment";
import { ProductRepo } from "../product/product.repo";
import { RecurringExpenseRepo } from "./RecurringExpense.repo";
import { RecurringInvoiceRepo } from "./RecurringInvoice.repo";
import { RecurringJournalRepo } from "./RecurringJournal.repo";
import { TriggerQueue } from "@src/repo/triggers/triggerQueue";
import { Log } from "@src/models/log";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";
import { recurringDueWhere, nextOccurrence, runWithConcurrency, RECURRING_AUTO_CONCURRENCY } from "./recurringSchedule.sql";

export class RecurringBillRepo {

    public static async checkIsRecurringBillNameExist(client: PoolClient, id: string | null, name: string, companyId: string) {
        try {

            const searchTerm = '%' + Helper.escapeSQLString(name.toLowerCase().trim()) + '%'
            const query: { text: string, values: any } = {
                text: `SELECT 
                        "RecurringBills". "name" 
                    FROM "RecurringBills"
                    INNER JOIN "Branches" ON "Branches".id = "RecurringBills"."branchId"
                    WHERE "Branches"."companyId"=$1
                            AND lower("RecurringBills".name) ILIKE $2
                `,
                values: [companyId, searchTerm]
            }

            if (id != null) {
                query.text = `SELECT 
                         "RecurringBills"."name" 
                    FROM "RecurringBills"
                    INNER JOIN "Branches" ON "Branches".id = "RecurringBills"."branchId"
                    WHERE "Branches"."companyId"=$1
                          AND lower("RecurringBills".name) ILIKE $2
                          AND "RecurringBills".id <> $3 `
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

    public static async getsRecurringBillSupplierId(client: PoolClient, id: string) {
        try {


            const query: { text: string, values: any } = {
                text: `SELECT 
                        "supplierId", "branchId"
                    FROM "RecurringBills"
                    WHERE id = $1
                `,
                values: [id]
            }
            const records = await client.query(query.text, query.values);
            if (records.rowCount != null && records.rowCount > 0) {
                return { supplierId: records.rows[0].supplierId, branchId: records.rows[0].branchId };
            } else {
                return {};
            }
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async checkIsRecurringBillHasChildBills(client: PoolClient, recurringBillId: string) {
        try {


            const query: { text: string, values: any } = {
                text: `SELECT id from "Billings" where "Billings"."recurringBillId" = $1 `,
                values: [recurringBillId]
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

    public static async getBillingNumber(client: PoolClient, companyId: string) {
        try {

            let billingNumber = "(^BB)[_\-]"

            const regexp = '^BB[_-]*';
            const numberPattern = '^[0-9\.]+$'

            const query: { text: string, values: any } = {
                text: `SELECT "billingNumber" 
                        FROM "Billings"
                        Where "Billings"."companyId" = $1
                        and "billingNumber" ~ $2
                        and nullif(regexp_replace("billingNumber", $3, '', 'g'), '') ~ $4
                        ORDER BY( nullif(regexp_replace("billingNumber", $3 , ''),'')::int )DESC
                        LIMIT 1`,
                values: [companyId, billingNumber, regexp, numberPattern]
            }

            const data = await client.query(query.text, query.values);
            if (data.rowCount != null && data.rowCount <= 0) {
                billingNumber = "BB-1";
            } else {
                billingNumber = await Helper.generateNumber((<any>data.rows[0]).billingNumber)
            }


            return billingNumber
        } catch (error: any) {
            console.log(error.message)
          
            throw new Error(error.message)
        }
    }

    public static trim_Date(data: any) {
        let y;
        for (const x in data) {
            y = data[x];
            if (["dueDate", "createdAt", "billingDate", "prodDate", "expireDate"].includes(x)) {
                delete data[x];

            }
            if (y instanceof Object) y = this.trim_Date(y);
        }
        return data;
    }

    public static async addRecurringBill(client: PoolClient, data: any, company: Company, employeeId: string) {

        try {
            const companyId = company.id;

            const recurringBill = new RecurringBill();
            recurringBill.ParseJson(data);
            if (recurringBill.name) {
                const isRecurringBillNameExist = await this.checkIsRecurringBillNameExist(client, null, recurringBill.name, companyId)
                if (isRecurringBillNameExist) {
                    throw new ValidationException("Recurring Bill Name Already Used")
                }
            }



            // ############## Bill Validation  ##############     
            if (!recurringBill.transactionDetails) { throw new ValidationException("transaction Details is required") }
            const validate = await BillingValidation.billingValidationForReurringBill(recurringBill.transactionDetails);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            recurringBill.transactionDetails.employeeId = employeeId
            recurringBill.transactionDetails = this.trim_Date(recurringBill.transactionDetails)

            let productIds: any = [];
            recurringBill.transactionDetails.lines.forEach((elem: any) => { if (elem.productId) productIds.push(elem.productId); })

            //batch and serialized can't be added in Recurring Bill
            const types: any[string] = ["inventory", "kit", "menuItem", "menuSelection", "package", "service"];
            const isProductTypeValide = await ProductRepo.checkIfProductsTypeValid(client, productIds, types, companyId);
            if (!isProductTypeValide) {
                throw new ValidationException("Invalid Product Type")
            }
            // ###############################################

            recurringBill.createdAt = new Date()
            recurringBill.updatedDate = new Date()


            const query: { text: string, values: any } = {
                text: `INSERT INTO "RecurringBills" 
                                   ( name, type, "createdAt", "updatedDate", "supplierId", "branchId", "transactionDetails", "startDate", "endDate", "endTerm", "repeatData", "billCreatedBefore") 
                            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, $12) RETURNING id `,
                values: [
                    recurringBill.name,
                    recurringBill.type,
                    recurringBill.createdAt,
                    recurringBill.updatedDate,
                    recurringBill.supplierId,
                    recurringBill.branchId,
                    JSON.stringify(recurringBill.transactionDetails),
                    recurringBill.startDate,
                    recurringBill.endDate,
                    recurringBill.endTerm,
                    JSON.stringify(recurringBill.repeatData),
                    recurringBill.billCreatedBefore
                ]
            }




            const recurringBillInsert = await client.query(query.text, query.values);

            if (recurringBillInsert.rows && recurringBillInsert.rows.length > 0) {
                const recurringBillId = (<any>recurringBillInsert.rows[0]).id;
                recurringBill.id = recurringBillId
                return new ResponseData(true, "Added Successfully", { id: recurringBillId, recurringBill: recurringBill })
            }

            return new ResponseData(false, "", {})

        } catch (error: any) {

          

            throw new Error(error.message)

        }
    }

    public static async editRecurringBill(client: PoolClient, data: any, company: Company, employeeId: string | null, source: string | null = null) {

        try {

            if (data.id == "" || data.id == null) { throw new ValidationException("Recurring Bill Id is Required") }

            const companyId = company.id;
            const recurringBill = new RecurringBill();
            recurringBill.ParseJson(data);
            recurringBill.updatedDate = new Date()

            if (recurringBill.name) {
                const isEstimateNumberExist = await this.checkIsRecurringBillNameExist(client, recurringBill.id, recurringBill.name, companyId)
                if (isEstimateNumberExist) { throw new ValidationException("Recurring Bill Name Already Used") }
            }


            // ############## Bill Validation  ##############     
            if (!recurringBill.transactionDetails) { throw new ValidationException("transaction Details is required") }
            const validate = await BillingValidation.billingValidationForReurringBill(recurringBill.transactionDetails);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            recurringBill.transactionDetails.employeeId = employeeId
            recurringBill.transactionDetails = this.trim_Date(recurringBill.transactionDetails)

            //***********Supplier validation(perevent supplier& branch change) ***********/

            recurringBill.hasBills = await this.checkIsRecurringBillHasChildBills(client, recurringBill.id)



            if (recurringBill.hasBills) {
                recurringBill.supplierId = null
                recurringBill.branchId = null
            }




            //***********products type validation ***********/
            let productIds: any = [];
            recurringBill.transactionDetails.lines.forEach((elem: any) => { if (elem.productId) productIds.push(elem.productId); })

            //batch and serialized can't be added in Recurring Bill
            const types: any[string] = ["inventory", "kit", "menuItem", "menuSelection", "package", "service"];
            const isProductTypeValide = await ProductRepo.checkIfProductsTypeValid(client, productIds, types, companyId);
            if (!isProductTypeValide) {
                throw new ValidationException("Invalid Product Type")
            }


            // ###############################################

            const query: { text: string, values: any } = {
                text: `UPDATE "RecurringBills"
	                    SET name=$1, 
                            type=$2, 
                            "updatedDate"=$3, 
                            "startDate"=$4, 
                            "endDate"=$5, 
                            "endTerm"=$6, 
                            "repeatData"=$7, 
                            "transactionDetails" = $8,
                            "billCreatedBefore"=$9,
                            "supplierId" = COALESCE($10,"supplierId")  ,
                            "branchId"= COALESCE($11,"branchId")
                            
                        WHERE  id=$12   RETURNING *`,

                values: [recurringBill.name,
                recurringBill.type,
                recurringBill.updatedDate,
                recurringBill.startDate,
                recurringBill.endDate,
                recurringBill.endTerm,
                JSON.stringify(recurringBill.repeatData),
                JSON.stringify(recurringBill.transactionDetails),
                recurringBill.billCreatedBefore,
                recurringBill.supplierId ?? null,
                recurringBill.branchId ?? null,
                recurringBill.id

                ]
            }



            const recurringBillEdit = await client.query(query.text, query.values);

            if (recurringBillEdit.rows && recurringBillEdit.rows.length > 0) {
                const recurringBillId = (<any>recurringBillEdit.rows[0]).id;
                recurringBill.id = recurringBillId
                return new ResponseData(true, "Updated Successfully", { id: recurringBillId, recurringBill: recurringBill })
            }

            return new ResponseData(false, "", {})

        } catch (error: any) {
            console.log(error)
          
            throw new Error(error)
        }
    }

    public static async getRecurringBillById(recurringBillId: string, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            const companyId = company.id;
            const query: { text: string, values: any } = {
                text: `SELECT  "RecurringBills".* 
                        from "RecurringBills"
                        Inner join "Branches" ON "Branches".id = "RecurringBills"."branchId"
                        WHERE "RecurringBills".id =$1 AND "Branches"."companyId"=$2
                      `,
                values: [recurringBillId, company.id]
            }

            const recurringBillData = await client.query(query.text, query.values);
            const recurringBill = new RecurringBill();
            recurringBill.ParseJson(recurringBillData.rows[0]);

            recurringBill.hasBills = await this.checkIsRecurringBillHasChildBills(client, recurringBillId)


            // ############## Bill Validation  ##############     
            if (!recurringBill.transactionDetails) { throw new ValidationException("transaction Details is required") }
            // const validate = await BillingValidation.billingValidation(recurringBill.transactionDetails);
            // if (!validate.valid) {
            //     throw new ValidationException(validate.error);
            // }

            recurringBill.transactionDetails = this.trim_Date(recurringBill.transactionDetails)
            // ###############################################

            await client.query("COMMIT");

            return new ResponseData(true, "", recurringBill);
        } catch (error: any) {
            await client.query("ROLLBACK");
          
            throw new Error(error.message)
        } finally {
            client.release();
        }
    }

    public static async getRecurringBillOverview(recurringBillId: string, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            const companyId = company.id;
            const query: { text: string, values: any } = {
                text: `with "t1" as (
                            SELECT   "RecurringBills".id,
                                    "RecurringBills".name, 
                                    "Branches".name as "branchName",
                                    "RecurringBills"."createdAt",
                                    "RecurringBills"."updatedDate", 
                                    "RecurringBills"."supplierId", 
                                    "RecurringBills"."branchId", 
                                    "RecurringBills"."startDate", 
                                    "RecurringBills"."endDate", 
                                    "RecurringBills"."endTerm", 
                                    "RecurringBills"."repeatData", 
                                    "Suppliers".name as "supplierName"
                                
                            FROM "RecurringBills"
                            Inner JOIN "Branches"  on "Branches".id = "RecurringBills"."branchId"
                            left join "Suppliers" on "Suppliers".id = "RecurringBills"."supplierId"
                            WHERE "RecurringBills".id = $1
                                AND "Branches"."companyId"= $2
                            )
                            ,"t2" as (
                            SELECT  count(*) over(),
                                    "Billings".id,
                                    "Billings"."billingNumber",
                                    "Billings"."createdAt",
                                    "Billings"."dueDate",
                                    "Billings".note, 
                                    "Billings".reference,
                                    "Billings".status,
                                    "Billings".total,
                                    "Billings"."billingDate",
                                    "Billings"."recurringBillId",
                                    sum("SupplierCredits".total) as refunded,
                                    sum("SupplierAppliedCredits".amount) as "appliedCredit",
                                    sum("BillingPaymentLines".amount) as "paidAmount"
                            FROM "Billings"
                            left JOIN "Branches"  ON "Branches".id =  "Billings"."branchId"
                            left join "SupplierCredits" ON "SupplierCredits"."billingId" ="Billings".id 
                            left join "SupplierAppliedCredits" ON "SupplierAppliedCredits"."billingId" ="Billings".id
                            left join "BillingPaymentLines" ON "BillingPaymentLines"."billingId" ="Billings".id
                            where "Branches"."companyId"= $2
                            and "Billings"."recurringBillId" = $1
                            group by  "Billings".id
                            )
                            select "t1".*, 
                                    case WHEN "t2"."recurringBillId" is not null then json_agg("t2".*) end as "childBills"
                            from "t1"
                            left join "t2" on "t1".id = "t2"."recurringBillId"
                            group by "t1".id, "t1".name, "t1"."branchName","t1"."createdAt", "t1"."updatedDate", "t1"."supplierId", "t1"."branchId", 
                                     "t1"."startDate",  "t1"."endDate", "t1"."endTerm", "t1"."repeatData", "t1"."supplierName",  "t2"."recurringBillId"
                      `,
                values: [recurringBillId, company.id]
            }

            const records = await client.query(query.text, query.values);

            let recurringBill

            // ############## NEXT BILL DATE  ############## 
            if (records.rows && records.rows.length > 0) {
                recurringBill = records.rows[0]
                let startDate = moment(new Date(recurringBill.startDate))


                let nextBillDate = await this.getNextBillDate(startDate, recurringBill.repeatData)


                // let firstBillDate = startDate.clone().set('date', recurringBill.repeatData.on ); 
                // if (startDate.date() > Number(recurringBill.repeatData.on)  ){
                //     (firstBillDate.add(1, 'month'))
                // }

                // let diff = moment().diff(firstBillDate, 'months') +1
                // let nextBillDate = firstBillDate.clone().add((diff% Number(recurringBill.repeatData.periodQty))*  Number(recurringBill.repeatData.periodQty), 'month')

                recurringBill.nextBillDate = nextBillDate


            }
            // ###############################################

            await client.query("COMMIT");

            return new ResponseData(true, "", recurringBill ?? {});
        } catch (error: any) {
            await client.query("ROLLBACK");
          
            throw new Error(error.message)
        } finally {
            client.release();
        }
    }

    public static async getNextBillDate(startDate: moment.Moment, repeatData: { on: any, periodQty: any, periodicity: any }) {
        try {
            return nextOccurrence(startDate, repeatData);
        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    public static async getRecurringBillList(data: any, company: Company, branchList: any[]) {

        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")

            const companyId = company.id;
            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;

            //############## filter ##############
            let filterQuery = `Where "Branches"."companyId" = $1   AND (array_length($2::uuid[], 1) IS NULL OR ("RecurringBills"."branchId"=any($2::uuid[]))) `
            let searchValue = data.searchTerm ? `'^.*` + Helper.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `.*$'` : null;
            if (searchValue) {
                filterQuery += `and (LOWER("RecurringBills".name) ilike ${searchValue}
                                        OR LOWER("Branches".name) ilike ${searchValue}    
                                )`
            }

            //############## Sort ##############
            let sort = data.sortBy;
            let sortValue = !sort ? ' "RecurringBills"."createdAt":: timestamp:: time ' : '"' + sort.sortValue + '"';
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
                        FROM "RecurringBills"
                        Inner JOIN "Branches"  on "Branches".id = "RecurringBills"."branchId"
                        ${filterQuery}
                        `,
                values: [companyId, branches]
            }
            const counter = await client.query(counterQuery.text, counterQuery.values)

            //############## Select ##############


            const query: { text: string, values: any } = {
                text: `with "list" as (SELECT   "RecurringBills".id,
                                "RecurringBills".name, 
                                "RecurringBills"."createdAt",
                                "RecurringBills"."updatedDate", 
                                "RecurringBills"."supplierId", 
                                "RecurringBills"."branchId", 
                                "RecurringBills"."startDate", 
                                "RecurringBills"."endDate", 
                                "RecurringBills"."endTerm", 
                                "RecurringBills"."repeatData", 
                              
                                "Suppliers".name as "supplierName",
                                "Branches".name as "branchName"
                        FROM "RecurringBills"
                        Inner JOIN "Branches"  on "Branches".id = "RecurringBills"."branchId"
                        left join "Suppliers" on "Suppliers".id = "RecurringBills"."supplierId"
                        ${filterQuery}
                        group by "RecurringBills".id, "Suppliers".name, "Branches".name
                        ${orderByQuery}
                        limit $3 offset $4)
                        select "list".*,  count("Billings"."recurringBillId")::int as "childBillsQty" from "list"
                        left join "Billings" on "list".id = "Billings"."recurringBillId"
                        group by 
                        "list".id,
                                "list".name, 
                                "list"."createdAt",
                                "list"."updatedDate", 
                                "list"."supplierId", 
                                "list"."branchId", 
                                "list"."startDate", 
                                "list"."endDate", 
                                "list"."endTerm", 
                                "list"."repeatData", 
                              
                                "list"."supplierName",
                               "list"."branchName"

                        `,
                values: [companyId, branches, limit, offset]
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

    public static async deleteRecurringBill(client: PoolClient, id: string, company: Company, employeeId:string) {
        try {

            const isRecurringBillNameExist = await this.checkIsRecurringBillHasChildBills(client, id)
            if (isRecurringBillNameExist) {
                throw new ValidationException("cannot delete Recurring Bill with child Bills")
            }

            let recurringBillQuery = {
                text: `SELECT "RecurringBills"."branchId", "Employees"."name" as "employeeName"
                        FROM "RecurringBills"
                        INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2
                        WHERE "RecurringBills".id = $1`,
                values: [id, employeeId, company.id]
            }

            let recBillResult = await client.query(recurringBillQuery.text, recurringBillQuery.values);
            let branchId = recBillResult.rows && recBillResult.rows.length > 0 && recBillResult.rows[0].branchId ? recBillResult.rows[0].branchId : null
            let employeeName = recBillResult.rows && recBillResult.rows.length > 0 && recBillResult.rows[0].employeeName ? recBillResult.rows[0].employeeName : ''


            const query: { text: string, values: any } = {
                text: `Delete FROM "RecurringBills" where id = ($1)  `,
                values: [id]
            }

            let log = new Log();
            log.employeeId = employeeId
            log.action = 'Recurring Bill Deleted'
            log.comment = `${employeeName} has deleted Recurring Bill`
            log.metaData = {"deleted": true}
            await LogsManagmentRepo.manageLogs(client, "RecurringBills",id,[log], branchId, company.id, employeeId,"", "Cloud")
            

            const data = await client.query(query.text, query.values);
            return new ResponseData(true, "", data.rows[0]);
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async generateAutoBills() {
        // Step 1: load the due rules through the pool (no client held).
        // This avoids holding a single client for the entire batch, which
        // would otherwise (a) trip the 60s auto-release timer in
        // DB.excu.client() and kill the cron mid-batch, and (b) sit "idle in
        // transaction" while we await helpers that check out their own clients.
        let recurringBills: any
        try {
            const queryText = `select "RecurringBills".*
                        from "RecurringBills"
                        where ${recurringDueWhere({
                recurringTable: '"RecurringBills"',
                childTable: '"Billings"',
                childFkColumn: '"recurringBillId"',
            })}`
            recurringBills = await DB.excu.query(queryText, [new Date()])
        } catch (error: any) {
            console.log("generateAutoBills: failed to load due recurring bills", error)
            throw new Error(error)
        }

        // Step 2: process each rule on its own fresh client + own transaction,
        // with bounded parallelism so a large batch can finish in reasonable
        // wall time without overwhelming the DB pool. One bad row no longer
        // aborts the rest of the batch (per-iteration try/catch).
        await runWithConcurrency(recurringBills.rows, RECURRING_AUTO_CONCURRENCY, async (recurringRow: any) => {
            const client = await DB.excu.client()
            try {
                await client.query("BEGIN")

                const element = new RecurringBill()
                element.ParseJson(recurringRow)
                let billData = new Billing()
                billData.ParseJson(element.transactionDetails)

                // Use the lightweight, in-transaction loader so we don't
                // check out a second pool client while our BEGIN is open
                // (which would leave this client "idle in transaction").
                const company = await CompanyRepo.getCompanyMinimalForBranch(client, billData.branchId)
                if (!company) {
                    await client.query("ROLLBACK")
                    console.log(`generateAutoBills: branch not found for recurring bill id=${recurringRow?.id} branchId=${billData.branchId}`)
                    return
                }

                let billingNumber = await RecurringBillRepo.getBillingNumber(client, company.id)
                billData.billingNumber = billingNumber ?? ""
                billData.recurringBillId = element.id
                let response = await BillingRepo.addBilling(client, billData, company, billData.employeeId)

                await client.query("COMMIT")

                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "Billings", id: response.data.id, companyId: company.id })
                queueInstance.createJob({ type: "updateBillStatus", ids: [response.data.id], companyId: company.id })
                queueInstance.createJob({ journalType: "Movment", type: "billing", id: response.data.id, deleteLines: response.data.deletedLines })
                queueInstance.createJob({ journalType: "Movment", type: "DeleteCost", ids: response.data.deletedLines ?? [] })
            } catch (innerError: any) {
                try { await client.query("ROLLBACK") } catch (_) { /* ignore */ }
                console.log(`generateAutoBills: failed for recurring bill id=${recurringRow?.id}`, innerError)
                // continue with the next recurring bill instead of aborting the whole batch
            } finally {
                client.release()
            }
        })
    }

    public static async generateAutoTransactions() {

        try {

            console.log(">>>>>>>>>");
            try {
                await RecurringBillRepo.generateAutoBills()

            } catch (error) {
                console.log(error)
            }

            try {
                await RecurringExpenseRepo.generateAutoExpenses()

            } catch (error) {
                console.log(error)
            }

            try {
                await RecurringInvoiceRepo.generateAutoInvoices()
            } catch (error) {
                console.log(error)
            }
            try {
                await RecurringJournalRepo.generateAutoJournals()
            } catch (error) {
                console.log(error)
            }



        } catch (error: any) {
            console.log(error)

            throw new Error(error);
        }


    }


}