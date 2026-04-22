import { DB } from "@src/dbconnection/dbconnection";
import { Journal } from "@src/models/account/Journal";
import { JournalLine } from "@src/models/account/JournalsLine";
import { ResponseData } from "@src/models/ResponseData";
import { JournalValidation } from "@src/validationSchema/account/Journal.Schema";
import { PoolClient } from "pg";



import { Company } from "@src/models/admin/company";
import { Helper } from "@src/utilts/helper";
import { ValidationException } from "@src/utilts/Exception";
import { EventLog, Log } from "@src/models/log";
import { EventLogsRepo } from "./eventlogs.repo";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";
export class JournalRepo {
   public static async addManualJournal(data: any, company: Company) {
      const client = await DB.excu.client()
      try {
         const validate = await JournalValidation.journalValidation(data);
         if (!validate.valid) {
            throw new ValidationException(validate.error);
         }
         await client.query("BEGIN")
         const journal = new Journal();
         journal.ParseJson(data);
         journal.companyId = company.id;

         await this.checkJournalTotal(journal.lines.filter(f => !f.isVoided), company.afterDecimal);

         journal.createdAt = new Date()
         const insert = await this.insertJournal(client, journal)

         journal.id = insert.id;

         // journal total must be = 0;
         for (let index = 0; index < journal.lines.length; index++) {
            const journalLine = journal.lines[index];
            const temp = new JournalLine();
            temp.ParseJson(journalLine)
            if (temp.credit > 0) {
               temp.amount = temp.credit * (-1);
            } else if (temp.debit > 0) {
               temp.amount = temp.debit;
            }

            temp.journalId = journal.id;
            temp.companyId = company.id;
            temp.branchId = journal.branchId
            await this.addJournalLine(client, temp);
         }
         const journaldata = {
            id: journal.id
         }
         await client.query("COMMIT")

         return new ResponseData(true, "Added Successfully", journaldata)
      } catch (error: any) {
       

         await client.query("ROLLBACK")
         throw new Error(error)

      } finally {
         client.release()
      }
   }
   public static async insertJournal(client: PoolClient, journal: Journal) {
      try {
         const query: { text: string, values: any } = {
            text: `INSERT INTO "Journals" (notes,reference,"createdAt","branchId",system,"journalDate","employeeId","status","attachment","recurringJournalId","companyId" ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id `,
            values: [journal.notes, journal.reference, journal.createdAt, journal.branchId, journal.system, journal.journalDate, journal.employeeId, journal.status, JSON.stringify(journal.attachment), journal.recurringJournalId, journal.companyId]
         }

         const insert = await client.query(query.text, query.values);
         const data = {
            id: (<any>insert.rows[0]).id
         }
         return data;
      } catch (error: any) {
       
         throw new Error(error.message)
      }
   }
   public static async editManualJournal(data: any, company: Company, employeeId: string) {
      const client = await DB.excu.client()
      try {
         const validate = await JournalValidation.journalValidation(data);
         if (!validate.valid) {
            throw new ValidationException(validate.error);
         }
         await client.query("BEGIN")
         const journal = new Journal();
         journal.ParseJson(data);
         await this.checkJournalTotal(journal.lines.filter(f => !f.isVoided), company.afterDecimal);

         //journal.logs = await this.getLogs(client, journal.id);
         journal.logs = []

         //Log.addLog(journal, "Edit Jouranl", "Edit", employeeId)

         const query: { text: string, values: any } = {
            text: `UPDATE "Journals" SET notes=$1,
                                                reference=$2,
                                                "journalDate"=$3,
                                                status =$4,
                                                "attachment"=$5
                                                 WHERE id = $6 AND "branchId"=$7`,
            values: [journal.notes, journal.reference, journal.journalDate, journal.status, JSON.stringify(journal.attachment), journal.id, journal.branchId]
         }

         for (let index = 0; index < journal.lines.length; index++) {
            const journalLine = journal.lines[index];
            const temp = new JournalLine();
            temp.ParseJson(journalLine)
            temp.journalId = journal.id;
            temp.companyId = company.id;
            temp.branchId = journal.branchId;

            if (temp.credit > 0) {
               temp.amount = temp.credit * (-1);
            } else if (temp.debit > 0) {
               temp.amount = temp.debit;
            }
            if (temp.id == null || temp.id == "") {
               await this.addJournalLine(client, temp);
            } else {
               if (temp.isVoided) {
                  await this.deleteJournalLine(client, temp)
               } else {
                  await this.editJournalLine(client, temp)
               }
            }

         }
         const update = await client.query(query.text, query.values);

         if (employeeId && journal.logs.length == 0) {
            Log.addLog(journal, "Edit Jouranl ", "Edit", employeeId)
         }

         await this.setLogs(client, journal.id, journal.logs, journal.branchId, company.id,employeeId,journal.reference,  "Cloud")

         await client.query("COMMIT")

         return new ResponseData(true, "Updated Successfully", { id: journal.id })
      } catch (error: any) {
         await client.query("ROLLBACK")
       
         throw new Error(error)
      } finally {
         client.release()
      }
   }
   public static async addJournalLine(client: PoolClient, journalLine: JournalLine) {
      try {

         const query: { text: string, values: any } = {
            text: `INSERT INTO "JournalLines" ("dbTable","dbTableId",code,description,"journalId","accountId",amount,"branchId","companyId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            values: [journalLine.dbTable,
            journalLine.dbTableId,
            journalLine.code,
            journalLine.description,
            journalLine.journalId,
            journalLine.accountId,
            journalLine.amount,
            journalLine.branchId,
            journalLine.companyId
            ]
         }

         const insert = await client.query(query.text, query.values);
         return new ResponseData(true, "Added Successfully", [])
      } catch (error: any) {
       
         throw new Error(error.message)
      }
   }
   private static async editJournalLine(client: PoolClient, journalLine: JournalLine) {
      try {
         const query: { text: string, values: any } = {
            text: `UPDATE "JournalLines" SET"dbTable"=$1,"dbTableId"=$2,code=$3,description=$4,"accountId"=$5,amount =$6 WHERE id=$7 AND "journalId"=$8`,
            values: [journalLine.dbTable,
            journalLine.dbTableId,
            journalLine.code,
            journalLine.description,
            journalLine.accountId,
            journalLine.amount,
            journalLine.id,
            journalLine.journalId]
         }

         await client.query(query.text, query.values);

      } catch (error: any) {
       
         throw new Error(error.message)
      }
   }

   private static async deleteJournalLine(client: PoolClient, journalLine: JournalLine) {
      try {
         const query: { text: string, values: any } = {
            text: `Delete From "JournalLines" where id = $1`,
            values: [journalLine.id]
         }

         await client.query(query.text, query.values);

      } catch (error: any) {
       
         throw new Error(error.message)
      }
   }



   public static async getManualJournalList(branchId: string) {
      try {
         const journalList: any[] = [];
         const query: { text: string, values: any } = {
            text: `SELECT * FROM "Journals" where "branchId" = $1`,
            values: [branchId]
         }

         // const query : { text: string, values: any } = {
         //    text:`SELECT * FROM "ManualJournals" INNER JOIN   "JournalLines" 
         //    ON "ManualJournals".id = "JournalLines"."journalId"
         //   AND "branchId" = $1`,
         //    values:[branchId]
         // }

         // const list = await DB.excu.query(query.text, query.values)
         // let data = {
         //    list: list.rows
         // }

         const list = await DB.excu.query(query.text, query.values)
         for (let index = 0; index < list.rows.length; index++) {
            const journal = list.rows[index];
            const temp = new Journal();
            temp.ParseJson(journal);
            query.text = `SELECT * FROM "JournalLines" WHERE "journalId" = $1`
            query.values = [temp.id]

            const journalLine: any = await DB.excu.query(query.text, query.values);
            temp.lines.push(journalLine.rows[0]);

            journalList.push(temp);
         }

         const data = {
            list: journalList
         }
         return new ResponseData(true, "", data)
      } catch (error: any) {
       
         throw new Error(error)
      }
   }
   public static async getManualJournalById(journalId: string, companyId: string) {
      const client = await DB.excu.client()
      try {
         await client.query("BEGIN")
         const query: { text: string, values: any } = {
            text: `SELECT 
            "Journals".id,
            "Journals".notes,
            "Journals".reference,
            "Journals".status,
            (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',COALESCE("Media"."url"->>'downloadUrl',"Media"."url"->>'defaultUrl'),'mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("Journals"."attachment") as attachments(attachments)
            inner join "Media" on "Media".id = (attachments->>'id')::uuid
            ) as "attachment",
           CAST ("Journals"."journalDate" AS TEXT) AS "journalDate",
            
            (
             SELECT json_agg(json_build_object('employeeId',"comments"."employeeId",
                                  'employeeName',"Employees".name,
                                  'comment',"comments"."comment",
                                  'date',"comments"."date"))
               FROM  jsonb_to_recordset("Journals"."comments") as "comments"("employeeId" uuid, "comment" text, "date" timestamp  )
              INNER JOIN "Employees" on  "Employees" .id = "comments"."employeeId"        
                         
            ) as "comments",
            "Journals"."branchId",
            "Branches".name as "branchName"
          FROM "Journals"   
          INNER JOIN "Branches"
          ON "Branches".id= "Journals"."branchId"
          WHERE  "Journals".id=$1 
          and "Branches"."companyId"=$2`,
            values: [journalId, companyId]
         }

         const data = await client.query(query.text, query.values)
         const journaldata = data.rows[0]
         const journal = new Journal();
         journal.ParseJson(journaldata)



         if (journal.id != "" && journal.id != null) {
            query.text = `SELECT 
                           "JournalLines".id,
                           "JournalLines".code,
                           "JournalLines".description,
                           case when amount >0 then amount else 0 end as debit,
                           case when amount <0 then ABS(amount)  else 0 end as credit,
                           "JournalLines"."createdAt" ,
                           "Accounts".name as "accountName",
                           "JournalLines"."accountId",
                           CASE WHEN "Reconciliations"."id" is not null and "Reconciliations"."status" = 'reconciled' then true else false end as "reconciled"
                       FROM "JournalLines" 
                       INNER JOIN "Accounts" ON "Accounts".id = "JournalLines"."accountId"
                       LEFT JOIN "Reconciliations" ON "Reconciliations".id = "JournalLines"."reconciliationId"
                       WHERE "journalId" = $1`
            query.values = [journalId]
            const journalLine: any = await client.query(query.text, [journalId]);
            for (let index = 0; index < journalLine.rows.length; index++) {
               const element = journalLine.rows[index];
               journal.lines.push(element);
            }
         }

         journal.setReconciled()
         await client.query("COMMIT")

         return new ResponseData(true, "", journal)
      } catch (error: any) {
       
         await client.query("ROLLBACK")
         throw new Error(error)
      } finally {
         client.release();
      }
   }

   //TODO: remove 
   public static async getBranchJournals(branchId: string) {
      try {
         const query: { text: string, values: any } = {
            text: `SELECT
            Journals.id,
            Journals.notes,
            Journals.reference,
            Journals."journalDate",
            (SELECT json_agg(
               json_build_object('dbTable', "dbTable",'dbTableId',"dbTableId",'code',code,'description',description,'debit',debit,'credit',credit,'accountId',"accountId")
               )FROM "JournalLines"  
               WHERE "JournalLines"."journalId" = Journals.id
               )as JournalLines
            FROM "Journals" AS Journals
                WHERE Journals."branchId" = $1
               
            `,
            values: [branchId]
         }

         const journal = await DB.excu.query(query.text, query.values);
         return new ResponseData(true, "", journal.rows)
      } catch (error: any) {
       
         return new ResponseData(false, "", [])
      }
   }

   public static async isJournalReconcilied(client: PoolClient, journalIds: any[]) {
      try {
         const query = {
            text: `select 
                 case when  count("JournalLines".id) > 0 then true else false end as "reconciled",
                  "JournalLines"."journalId"

                  from "JournalLines" 
                  LEFT JOIN "Reconciliations" ON "Reconciliations".id = "JournalLines"."reconciliationId" 
                  where "Reconciliations"."status" = 'reconciled'
                  and "JournalLines"."journalId" = any($1)
                  group by    "JournalLines"."journalId"
                  `,

            values: [journalIds]
         }

         let reconcileds = await client.query(query.text, query.values);

         return reconcileds.rows
      } catch (error: any) {
         throw new Error(error)
      }
   }
   public static async getJournals(data: any, company: Company, branchList: []) {
      const client = await DB.excu.client()
      try {

         await client.query("BEGIN")
         const companyId = company.id
         const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;


         let searchValue = data && data.searchTerm ? data.searchTerm.toLowerCase().trim() : null



         let sort = data.sortBy;
         let sortValue = !sort ? '"Journals"."createdAt"' : '"' + sort.sortValue + '"';
         let sortDirection = !sort ? " DESC " : sort.sortDirection;

         let sortTerm = sortValue + " " + sortDirection;
         let orderByQuery = " ORDER BY " + sortTerm

         let page = data.page ?? 1
         let offset = 0;
         const limit = ((data.limit == null) ? 15 : data.limit);
         if (page != 1) {
            offset = (limit * (page - 1))
         }

         const query = {
            text: `SELECT
            COUNT(*) OVER(),
            "Journals".id,
            "Journals".notes,
            "Journals".reference,
            "Journals"."journalDate",
            "Journals"."status",
            "Journals"."createdAt",
            "Branches".name as "branchName",
            sum(case when "JournalLines"."amount" > 0 then  "JournalLines"."amount" else 0 end) as "amount",
            "Employees".name as "employeeName"
            FROM "Journals"
            INNER JOIN "Branches" ON "Branches".id = "Journals"."branchId"
            INNER JOIN "JournalLines" ON  "JournalLines"."journalId" = "Journals".id
            INNER JOIN "Employees" ON "Employees".id = "Journals"."employeeId"
            Where "Branches"."companyId"=$1
            AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
            and ($3::text is null or  ( LOWER("Branches".name) ~ $3
                  OR LOWER("Journals"."reference") ~ $3))
            GROUP BY "Branches".id  ,  "Employees".id , "Journals".id
            ${orderByQuery}
            limit $4 offset $5`,
            values: [companyId, branches, searchValue, limit, offset]
         }

         const selectList: any = await client.query(query.text, query.values)


         const ids: any[] = [];
         selectList.rows.forEach((element: any) => {
            ids.push(element.id)
         });
         const reconciledInfo = await this.isJournalReconcilied(client, ids)

         if (reconciledInfo && reconciledInfo.length > 0) {
            selectList.rows = selectList.rows.map((f: any) => {
               let journalReconcile = reconciledInfo.find(item => item.journalId == f.id)

               if (journalReconcile) {
                  f.reconciled = journalReconcile.reconciled
               } else {
                  f.reconciled = false
               }

               return f
            })
         }
         let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
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

         await client.query("COMMIT")
         return new ResponseData(true, "", resData);


      } catch (error: any) {
         await client.query("ROLLBACK")
       
         throw new Error(error.message)
      } finally {
         client.release()
      }
   }


   public static async checkJournalTotal(journalLines: JournalLine[], afterDecimal: number) {
      try {

         if (journalLines.length < 2) {
            throw new ValidationException("Invalid Journal Line")
         }
         let total = 0;
         for (let index = 0; index < journalLines.length; index++) {
            const element = journalLines[index];
            if (element.debit > 0) {
               total = Helper.add(total, element.debit, afterDecimal);
            } else if (element.credit > 0) {

               total = Helper.add(total, element.credit * (-1), afterDecimal);

            }
         }
         if (total != 0) {
            throw new ValidationException("Invalid Journal Total")
         }


      } catch (error: any) {
       
         throw new Error(error.message)
      }
   }



   public static async checkIfJournalExistsByTodayDate(client: PoolClient, branchId: string) {
      try {
         const currentDate = new Date();
         // let date =  currentDate.getFullYear() + "-" + (currentDate.getMonth()  + 1) + "-" + currentDate.getDate(); 
         const query: { text: string, values: any } = {
            text: `SELECT id FROM "Journals" WHERE  "branchId" = $1 AND "createdAt" = $2 and system=$3 `,
            values: [branchId, currentDate, true]
         }

         const journal = await client.query(query.text, query.values);

         if (journal.rowCount != null && journal.rowCount > 0) {
            return journal.rows[0]
         } else {
            return null
         }
      } catch (error: any) {
       
         throw new Error(error.message)
      }
   }

   public static async getJournal(id: string, company: Company) {
      const client = await DB.excu.client();
      const afterDecimal = company.afterDecimal
      try {
         await client.query("BEGIN")
         const query: { text: string, values: any } = {
            text: `
            SELECT 
                                 case when sum(amount) > 0 then sum(amount::text::NUMERIC )end  as debit,
                                 case when sum(amount) < 0 then ABS(sum(amount::text::NUMERIC))end   as credit,
                                 name as "accountType"
                            
                           FROM "JournalRecords"
                           where "referenceId" = $1
                        and "amount" <> 0 
                           group by "accountId" , name ,"referenceId" 
               `,
            values: [id]
         }

         const journal = await client.query(query.text, query.values);

         // journal.rows.forEach(element => {
         //    console.log(element)
         //    journal.rows.splice(journal.rows.indexOf(journal.rows.find(f=> f.debit ==0 && f.credit == 0)), 1)
         // });
         await client.query("COMMIT")

         return new ResponseData(true, "", journal.rows)
      } catch (error: any) {
         await client.query("ROLLBACK")
       
         throw new Error(error.message)
      } finally {
         client.release()
      }
   }
   public static async saveJournalComments(data: any, employeeId: string) {
      const client = await DB.excu.client();
      try {
         await client.query("BEGIN")

         for (let index = 0; index < data.comments.length; index++) {
            const notes = data.comments[index];

            if (notes.employeeId == "" || notes.employeeId == null) {
               data.comments[index].employeeId = employeeId;
               data.comments[index].date = new Date();
            }
         }

         const query: { text: string, values: any } = {
            text: `UPDATE "Journals" set comments= $1 where id=$2`,
            values: [JSON.stringify(data.comments), data.journalId]
         }

         await client.query(query.text, query.values);
         await client.query("COMMIT")

         return new ResponseData(true, "", data.comments)
      } catch (error: any) {
       
         await client.query("ROLLBACK")
         throw new Error(error.message)
      } finally {
         client.release()
      }
   }

   public static async deleteJournal(journalId: string, company: Company, employeeId: string) {
      const client = await DB.excu.client();
      try {
         await client.query("BEGIN")
         let journal = await client.query(
                           `Select "Journals"."branchId", "Journals"."reference",
                           "Employees"."name" as "employeeName"
                           from "Journals" 
                           INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2
                           where "Journals".id =$1`, 
                           [journalId, employeeId, company.id]
                        );
         let branchId = journal.rows && journal.rows.length > 0 && journal.rows[0].branchId ? journal.rows[0].branchId : null
         let reference = journal.rows && journal.rows.length > 0 && journal.rows[0].reference ? `${journal.rows[0].reference}` : ''
         let employeeName = journal.rows && journal.rows.length > 0 && journal.rows[0].employeeName ? `${journal.rows[0].employeeName}` : ''


         const query: { text: string, values: any } = {
            text: `DELETE FROM "JournalLines" where "journalId" =$1`,
            values: [journalId]
         }

         await client.query(query.text, query.values);

         query.text = `DELETE FROM "Journals"where id=$1`
         await client.query(query.text, query.values);
         //addLog 

         let log = new Log();
         log.employeeId = employeeId
         log.action = 'Journal Deleted'
         log.comment = `${employeeName} has deleted Journal number ${reference}`
         log.metaData = {"deleted": true}
         await LogsManagmentRepo.manageLogs(client, "Journals", journalId, [log], branchId, company.id,employeeId, reference, "Cloud")

         await client.query("COMMIT")

         return new ResponseData(true, "Deleted Successfully", [])
      } catch (error: any) {
         await client.query("ROLLBACK")
       

         throw new Error(error)
      } finally {
         client.release()
      }
   }


   public static async saveOpenJournal(journalId: string) {
      try {

         const query: { text: string, values: any } = {
            text: `UPDATE "Journals" SET "status" ='Open' where id =$1`,
            values: [journalId]
         }

         await DB.excu.query(query.text, query.values);



         return new ResponseData(true, "Deleted Successfully", [])
      } catch (error: any) {
       

         throw new Error(error)
      }
   }

   public static async setLogs(client: PoolClient, journalId: string, logs: Log[], branchId: string, companyId: string, employeeId:string, journalNumber:string | null, source:string) {
      try {
         await LogsManagmentRepo.manageLogs(client, "Journals", journalId, logs, branchId, companyId, employeeId, journalNumber,  source)

      } catch (error: any) {
         throw new Error(error)
      }
   }

   public static async getLogs(client: PoolClient, journalId: string) {
      try {
         const query = {
            text: `select   "logs"   from "Journals" where id =$1`,
            values: [journalId]
         }
         let journal = await client.query(query.text, query.values);

         return journal.rows[0].logs ?? []
      } catch (error: any) {
         throw new Error(error)
      }
   }
}