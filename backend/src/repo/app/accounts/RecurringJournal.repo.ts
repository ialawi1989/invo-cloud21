import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Helper } from "@src/utilts/helper";
import { PoolClient } from "pg";


import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { RecurringJournal } from "@src/models/account/RecurringJournal";
import { JournalValidation } from "@src/validationSchema/account/Journal.Schema";
import { JournalRepo } from '@src/repo/app/accounts/Journal.repo';
import { Journal } from "@src/models/account/Journal";
import { CompanyRepo } from "@src/repo/admin/company.repo";
import moment from "moment";
import { TriggerQueue } from "@src/repo/triggers/triggerQueue";
import { recurringDueWhere, nextOccurrence, runWithConcurrency, RECURRING_AUTO_CONCURRENCY } from "./recurringSchedule.sql";

export class RecurringJournalRepo {


    public static async checkIsRecurringJournalNameExist(client: PoolClient, id: string | null, name: string, companyId: string) {
        try {

            const searchTerm = '%' + Helper.escapeSQLString(name.toLowerCase().trim()) + '%'
            const query: { text: string, values: any } = {
                text: `SELECT 
                        "RecurringJournals". "name" 
                    FROM "RecurringJournals"
                    INNER JOIN "Branches" ON "Branches".id = "RecurringJournals"."branchId"
                    WHERE "Branches"."companyId"=$1
                            AND lower("RecurringJournals".name) ILIKE $2
                `,
                values: [companyId, searchTerm]
            }

            if (id != null) {
                query.text = `SELECT 
                         "RecurringJournals"."name" 
                    FROM "RecurringJournals"
                    INNER JOIN "Branches" ON "Branches".id = "RecurringJournals"."branchId"
                    WHERE "Branches"."companyId"=$1
                          AND lower("RecurringJournals".name) ILIKE $2
                          AND "RecurringJournals".id <> $3 `
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

    public static async checkIsRecurringJournalHasChildJournals(client: PoolClient, recurringJournalId: string) {
        try {


            const query: { text: string, values: any } = {
                text: `SELECT id from "Journals" where "Journals"."recurringJournalId" = $1 `,
                values: [recurringJournalId]
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



    public static trim_Date(data: any) {
        let y;
        for (const x in data) {
            y = data[x];
            if (["dueDate", "createdAt", "journalDate", "prodDate", "expireDate"].includes(x)) {
                delete data[x];

            }
            if (y instanceof Object) y = this.trim_Date(y);
        }
        return data;
    }

    public static async addRecurringJournal(client: PoolClient, data: any, company: Company, employeeId: string) {

        try {
            const companyId = company.id;

            const recurringJournal = new RecurringJournal();
            recurringJournal.ParseJson(data);
            if (recurringJournal.name) {
                const isRecurringJournalNameExist = await this.checkIsRecurringJournalNameExist(client, null, recurringJournal.name, companyId)
                if (isRecurringJournalNameExist) {
                    throw new ValidationException("Recurring Journal Name Already Used")
                }
            }



            // ############## Journal Validation  ##############     

            if (!recurringJournal.transactionDetails) { throw new ValidationException("transaction Details is required") }
            const validate = await JournalValidation.journalValidationForRecurringJournal(recurringJournal.transactionDetails);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            let journal = new Journal()
            journal.ParseJson(recurringJournal.transactionDetails)
            await JournalRepo.checkJournalTotal(journal.lines.filter(f => !f.isVoided), company.afterDecimal);


            recurringJournal.transactionDetails.employeeId = employeeId
            recurringJournal.transactionDetails = this.trim_Date(recurringJournal.transactionDetails)
            // ###############################################

            recurringJournal.createdAt = new Date()
            recurringJournal.updatedDate = new Date()


            const query: { text: string, values: any } = {
                text: `INSERT INTO "RecurringJournals" 
                                   ( name, type, "createdAt", "updatedDate",  "branchId", "transactionDetails", "startDate", "endDate", "endTerm", "repeatData", "journalCreatedBefore") 
                            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id `,
                values: [
                    recurringJournal.name,
                    recurringJournal.type,
                    recurringJournal.createdAt,
                    recurringJournal.updatedDate,
                    recurringJournal.branchId,
                    JSON.stringify(recurringJournal.transactionDetails),
                    recurringJournal.startDate,
                    recurringJournal.endDate,
                    recurringJournal.endTerm,
                    JSON.stringify(recurringJournal.repeatData),
                    recurringJournal.journalCreatedBefore
                ]
            }




            const recurringJournalInsert = await client.query(query.text, query.values);

            if (recurringJournalInsert.rows && recurringJournalInsert.rows.length > 0) {
                const recurringJournalId = (<any>recurringJournalInsert.rows[0]).id;
                recurringJournal.id = recurringJournalId
                return new ResponseData(true, "Added Successfully", { id: recurringJournalId, recurringJournal: recurringJournal })
            }

            return new ResponseData(false, "", {})

        } catch (error: any) {

          

            throw new Error(error.message)

        }
    }

    public static async editRecurringJournal(client: PoolClient, data: any, company: Company, employeeId: string | null, source: string | null = null) {

        try {

            if (data.id == "" || data.id == null) { throw new ValidationException("Recurring Journal Id is Required") }

            const companyId = company.id;
            const recurringJournal = new RecurringJournal();
            recurringJournal.ParseJson(data);
            recurringJournal.updatedDate = new Date()

            if (recurringJournal.name) {
                const isEstimateNumberExist = await this.checkIsRecurringJournalNameExist(client, recurringJournal.id, recurringJournal.name, companyId)
                if (isEstimateNumberExist) { throw new ValidationException("Recurring Journal Name Already Used") }
            }


            // ############## Journal Validation  ##############     
            if (!recurringJournal.transactionDetails) { throw new ValidationException("transaction Details is required") }
            const validate = await JournalValidation.journalValidationForRecurringJournal(recurringJournal.transactionDetails);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            let journal = new Journal()
            journal.ParseJson(recurringJournal.transactionDetails)
            await JournalRepo.checkJournalTotal(journal.lines.filter(f => !f.isVoided), company.afterDecimal);

            recurringJournal.transactionDetails.employeeId = employeeId
            recurringJournal.transactionDetails = this.trim_Date(recurringJournal.transactionDetails)
            // ###############################################

            const query: { text: string, values: any } = {
                text: `UPDATE "RecurringJournals"
	                    SET name=$1, 
                            type=$2, 
                            "updatedDate"=$3,  
                            "startDate"=$4, 
                            "endDate"=$5, 
                            "endTerm"=$6, 
                            "repeatData"=$7, 
                            "transactionDetails" = $8,
                            "journalCreatedBefore"=$9
                            
                        WHERE  id=$10 AND "branchId"=$11 RETURNING *`,

                values: [recurringJournal.name,
                recurringJournal.type,
                recurringJournal.updatedDate,

                recurringJournal.startDate,
                recurringJournal.endDate,
                recurringJournal.endTerm,
                JSON.stringify(recurringJournal.repeatData),
                JSON.stringify(recurringJournal.transactionDetails),
                recurringJournal.journalCreatedBefore,
                recurringJournal.id,
                recurringJournal.branchId
                ]
            }



            const recurringJournalEdit = await client.query(query.text, query.values);

            if (recurringJournalEdit.rows && recurringJournalEdit.rows.length > 0) {
                const recurringJournalId = (<any>recurringJournalEdit.rows[0]).id;
                recurringJournal.id = recurringJournalId
                return new ResponseData(true, "Updated Successfully", { id: recurringJournalId, recurringJournal: recurringJournal })
            }

            return new ResponseData(false, "", {})

        } catch (error: any) {
            console.log(error)
          
            throw new Error(error)
        }
    }

    public static async getRecurringJournalById(recurringJournalId: string, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            const companyId = company.id;
            const query: { text: string, values: any } = {
                text: `SELECT  "RecurringJournals".* 
                        from "RecurringJournals"
                        Inner join "Branches" ON "Branches".id = "RecurringJournals"."branchId"
                        WHERE "RecurringJournals".id =$1 AND "Branches"."companyId"=$2
                      `,
                values: [recurringJournalId, company.id]
            }

            const recurringJournalData = await client.query(query.text, query.values);
            const recurringJournal = new RecurringJournal();
            recurringJournal.ParseJson(recurringJournalData.rows[0]);

            // ############## Journal Validation  ##############     
            if (!recurringJournal.transactionDetails) { throw new ValidationException("transaction Details is required") }
            // const validate = await JournalValidation.journalValidationForRecurringJournal(recurringJournal.transactionDetails);
            // if (!validate.valid) {
            //     throw new ValidationException(validate.error);
            // }

            recurringJournal.transactionDetails = this.trim_Date(recurringJournal.transactionDetails)
            // ###############################################

            await client.query("COMMIT");

            return new ResponseData(true, "", recurringJournal);
        } catch (error: any) {
            await client.query("ROLLBACK");
          
            throw new Error(error.message)
        } finally {
            client.release();
        }
    }

    public static async getRecurringJournalOverview(recurringJournalId: string, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            const companyId = company.id;
            const query: { text: string, values: any } = {
                text: `with "t1" as (
                            SELECT   "RecurringJournals".id,
                                    "RecurringJournals".name, 
                                    "Branches".name as "branchName",
                                    "RecurringJournals"."createdAt",
                                    "RecurringJournals"."updatedDate", 
                                    
                                    "RecurringJournals"."branchId", 
                                    "RecurringJournals"."startDate", 
                                    "RecurringJournals"."endDate", 
                                    "RecurringJournals"."endTerm", 
                                    "RecurringJournals"."repeatData"
                                
                            FROM "RecurringJournals"
                            Inner JOIN "Branches"  on "Branches".id = "RecurringJournals"."branchId"
                           
                            WHERE "RecurringJournals".id = $1
                                AND "Branches"."companyId"= $2
                            )
                            ,"t2" as (
                            SELECT  count(*) over(),
                                    "Journals".id,
                                    "Journals"."createdAt",
                                    "Journals".notes, 
                                    "Journals".reference,
                                    "Journals".status,
                                    "Journals"."journalDate",
                                    "Journals"."recurringJournalId"
                            FROM "Journals"
                            left JOIN "Branches"  ON "Branches".id =  "Journals"."branchId"
                            where "Branches"."companyId"= $2
                            and "Journals"."recurringJournalId" = $1
                            
                            )
                            select "t1".*, 
                                    case WHEN "t2"."recurringJournalId" is not null then json_agg("t2".*) end as "childJournals"
                            from "t1"
                            left join "t2" on "t1".id = "t2"."recurringJournalId"
                            group by "t1".id, "t1".name, "t1"."branchName","t1"."createdAt", "t1"."updatedDate",  "t1"."branchId", 
                                     "t1"."startDate",  "t1"."endDate", "t1"."endTerm", "t1"."repeatData",   "t2"."recurringJournalId"
                      `,
                values: [recurringJournalId, company.id]
            }

            const records = await client.query(query.text, query.values);

            let recurringJournal

            // ############## NEXT BILL DATE  ############## 
            if (records.rows && records.rows.length > 0) {
                recurringJournal = records.rows[0]
                let startDate = moment(new Date(recurringJournal.startDate))


                let nextJournalDate = await this.getNextJournalDate(startDate, recurringJournal.repeatData)


                // let firstJournalDate = startDate.clone().set('date', recurringJournal.repeatData.on ); 
                // if (startDate.date() > Number(recurringJournal.repeatData.on)  ){
                //     (firstJournalDate.add(1, 'month'))
                // }

                // let diff = moment().diff(firstJournalDate, 'months') +1
                // let nextJournalDate = firstJournalDate.clone().add((diff% Number(recurringJournal.repeatData.periodQty))*  Number(recurringJournal.repeatData.periodQty), 'month')

                recurringJournal.nextJournalDate = nextJournalDate


            }
            // ###############################################

            await client.query("COMMIT");

            return new ResponseData(true, "", recurringJournal ?? {});
        } catch (error: any) {
            await client.query("ROLLBACK");
          
            throw new Error(error.message)
        } finally {
            client.release();
        }
    }

    public static async getNextJournalDate(startDate: moment.Moment, repeatData: { on: any, periodQty: any, periodicity: any }) {
        try {
            return nextOccurrence(startDate, repeatData);
        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    public static async getRecurringJournalList(data: any, company: Company,branchList:any[]) {

        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")

            const companyId = company.id;
           const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;


            //############## filter ##############
            let filterQuery = `Where "Branches"."companyId" = $1    AND (array_length($2::uuid[], 1) IS NULL OR ("RecurringJournals"."branchId"=any($2::uuid[])))`
            let searchValue = data.searchTerm ? `'^.*` + Helper.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `.*$'` : null;
            if (searchValue) {
                filterQuery += `and (LOWER("RecurringJournals".name) ilike ${searchValue}
                                        OR LOWER("Branches".name) ilike ${searchValue}    
                                )`
            }

            //############## Sort ##############
            let sort = data.sortBy;
            let sortValue = !sort ? ' "RecurringJournals"."createdAt":: timestamp:: time ' : '"' + sort.sortValue + '"';
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
                        FROM "RecurringJournals"
                        Inner JOIN "Branches"  on "Branches".id = "RecurringJournals"."branchId"
                        ${filterQuery}
                        `,
                values: [companyId,branches]
            }
            const counter = await client.query(counterQuery.text, counterQuery.values)

            //############## Select ##############


            const query: { text: string, values: any } = {
                text: `with "list" as (  SELECT   "RecurringJournals".id,
                                "RecurringJournals".name, 
                                "RecurringJournals"."createdAt",
                                "RecurringJournals"."updatedDate", 
                              
                                "RecurringJournals"."branchId", 
                                "RecurringJournals"."startDate", 
                                "RecurringJournals"."endDate", 
                                "RecurringJournals"."endTerm", 
                                "RecurringJournals"."repeatData", 
                                "Branches".name as "branchName"
                        FROM "RecurringJournals"
                        Inner JOIN "Branches"  on "Branches".id = "RecurringJournals"."branchId"
                       
                        ${filterQuery}
                        group by "RecurringJournals".id, "Branches".name 
                        ${orderByQuery}
                        limit $3 offset $4)
                        select "list".*, count("Journals"."recurringJournalId")::int as "childJournalsQty" from "list"
                        left join "Journals" on "list".id = "Journals"."recurringJournalId"
                        group by "list".id,
                                "list".name, 
                                "list"."createdAt",
                                "list"."updatedDate", 
                              
                                "list"."branchId", 
                                "list"."startDate", 
                                "list"."endDate", 
                                "list"."endTerm", 
                                "list"."repeatData", 
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

    public static async deleteRecurringJournal(client: PoolClient, id: string) {
        try {

            const isRecurringJournalNameExist = await this.checkIsRecurringJournalHasChildJournals(client, id)
            if (isRecurringJournalNameExist) {
                throw new ValidationException("cannot delete Recurring Journal with child Journals")
            }

            const query: { text: string, values: any } = {
                text: `Delete FROM "RecurringJournals" where id = ($1)  `,
                values: [id]
            }

            const data = await client.query(query.text, query.values);
            return new ResponseData(true, "", data.rows[0]);
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async generateAutoJournals() {
        // SELECT through the pool. JournalRepo.addManualJournal manages its
        // own DB connection internally, so we don't need to hold a client at
        // all here. Per-iteration try/catch still isolates failures.
        let recurringJournals: any
        try {
            const queryText = `select "RecurringJournals".*
                        from "RecurringJournals"
                        where ${recurringDueWhere({
                recurringTable: '"RecurringJournals"',
                childTable: '"Journals"',
                childFkColumn: '"recurringJournalId"',
            })}`
            recurringJournals = await DB.excu.query(queryText, [new Date()])
        } catch (error: any) {
            console.log("generateAutoJournals: failed to load due recurring journals", error)
            throw new Error(error)
        }

        await runWithConcurrency(recurringJournals.rows, RECURRING_AUTO_CONCURRENCY, async (recurringRow: any) => {
            try {
                const element = new RecurringJournal()
                element.ParseJson(recurringRow)
                let journalData = new Journal()
                journalData.ParseJson(element.transactionDetails)
                journalData.status = 'Open'

                // Lightweight company loader: skips the heavy SELECT and the
                // S3 logo fetch that the cron does not need. We pass null
                // because this path doesn't hold its own transaction —
                // JournalRepo.addManualJournal manages its own connection.
                const company = await CompanyRepo.getCompanyMinimalForBranch(null, journalData.branchId)
                if (!company) {
                    console.log(`generateAutoJournals: branch not found for recurring journal id=${recurringRow?.id} branchId=${journalData.branchId}`)
                    return
                }

                element.transactionDetails.recurringJournalId = element.id
                element.transactionDetails.createdAt = String((new Date()).toISOString())
                element.transactionDetails.status = 'Open'

                let response = await JournalRepo.addManualJournal(element.transactionDetails, company)

                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "ManualJournal", id: response.data.id, companyId: company.id })
            } catch (innerError: any) {
                console.log(`generateAutoJournals: failed for recurring journal id=${recurringRow?.id}`, innerError)
                // continue with the next recurring journal instead of aborting the whole batch
            }
        })
    }


}