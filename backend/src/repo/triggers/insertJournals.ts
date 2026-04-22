import { DB } from "@src/dbconnection/dbconnection"
import { ResponseData } from "@src/models/ResponseData";

import ioredis from 'ioredis';
import { TriggerQueue } from "./triggerQueue";
import { GruptechOrderQueue } from "@src/controller/admin/GruptechOrderQueue";
import { redisConnection } from "@src/routes/v1/promotions/common/background-jobs";
// Create a new connection in e
export class InsertJournalsRepo {


    public static async deleteJournals(companyId: string | null, type: string | null) {
        try {
            const deleteQuery = {
                text: `DELETE FROM "JournalRecords" WHERE ($1::uuid is null or "companyId"=$1) and ($2::text is null or "dbTable" =$2)`,
                values: [companyId, type]
            }
            await DB.excu.query(deleteQuery.text, deleteQuery.values)

            return new ResponseData(true, "", [])
        } catch (error: any) {
         
            throw new Error(error)
        }
    }
    public static async deleteMovments(companyId: string | null, type: string | null) {
        try {



            const deleteQuery = {
                text: `DELETE FROM  "InventoryMovmentRecords" WHERE ($1::uuid is null or "companyId"=$1) and ($2::text  is null or "referenceTable" =$2)`,
                values: [companyId, type]
            }


            await DB.excu.query(deleteQuery.text, deleteQuery.values)

            return new ResponseData(true, "", [])
        } catch (error: any) {
       

            throw new Error(error)
        }
    }
    public static async insertJournals(companyId: string | null, type: string | null) {
        const client = await DB.excu.client(60 * 10)

        try {

            await client.query("BEGIN")




            const query = {
                text: `
                   insert into "JournalRecords" (id,"accountId","name","amount","referenceId","createdAt","branchId","companyId","dbTable","code","chargeId","userId","userName","userType") 
                        select 
                        "JournalReports".id,
                        "JournalReports"."accountId",
                        "JournalReports".name,
                        "JournalReports".amount,
                        "JournalReports"."referenceId",
                        "JournalReports"."createdAt",
                        "JournalReports"."branchId",
                        "JournalReports"."companyId",
                        "JournalReports"."dbTable",
                        "JournalReports".code,
             
                        "JournalReports"."chargeId",
                        "JournalReports"."userId",
                        "JournalReports"."userName",
                        "JournalReports"."userType"
                        from "JournalReports" 
                        where "JournalReports"."amount" <> 0 
                        and ($1::uuid is null or "JournalReports"."companyId"=$1::uuid)
                        and($2::text is null or "JournalReports"."dbTable"=$2::text)
                      
                `,
                values: [companyId, type]
            }

            await client.query(query.text, query.values)

            await client.query("COMMIT")

            return new ResponseData(true, "", [])
        } catch (error: any) {
            console.log(error)
        
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }



    public static async insertMovment(companyId: string | null, type: string | null) {

        try {




            const query = {
                text: `
                  insert into "InventoryMovmentRecords" (id,"employeeId","productId","createdAt","referenceId","referenceTable","cost","qty","branchId","companyId") 
                                    select 
                                    "InventoryMovmentView".id,
                                    "InventoryMovmentView" ."employeeId",
                                    "InventoryMovmentView"."productId",
                                    "InventoryMovmentView"."createdAt",
                                    "InventoryMovmentView"."referenceId",
                                    "InventoryMovmentView"."refrenceTable" as "referenceTable",
                                    "InventoryMovmentView"."cost",
                                    "InventoryMovmentView"."qty",
                                    "InventoryMovmentView"."branchId",
                                    "Branches"."companyId"
                                    from "InventoryMovmentView" 
                                    inner join "Branches" on "Branches".id = "InventoryMovmentView"."branchId" 
                                    left join "InventoryMovmentRecords" on "InventoryMovmentRecords"."referenceId" = "InventoryMovmentView"."referenceId"
                                    where ($1::uuid is null or "Branches"."companyId"=$1::uuid) and ($2::text is null or "refrenceTable" =$2)
                                   and "InventoryMovmentRecords"."referenceId" is null 
                `,
                values: [companyId, type]
            }

            await DB.excu.query(query.text, query.values)


            return new ResponseData(true, "", [])
        } catch (error: any) {

        
            throw new Error(error)
        }
    }


    public static async deleteKeys() {
        try {

            let url: any = process.env.QUEUE_REDIS_CLIENT_URL;
            let keys = await (redisConnection.get()).keys(`*{JournalJobs_${process.env.NODE_ENV}}*`);
      
            if(keys.length>0)
            await (redisConnection.get()).del(...keys);

            // keys = await connection.keys("*JournalJobs*");
            // if(keys.length>0)
            // await connection.del(...keys);
            return new ResponseData(true, "", [])
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    public static async getKeys() {
        try {
            let url: any = process.env.QUEUE_REDIS_CLIENT_URL;
            let keys = await (redisConnection.get()).keys('*');
            console.log("after Keys")
            console.log(keys)
            return new ResponseData(true, "", keys)
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error)
        }
    }

    public static async retryFaildJobs(){
        try {
            let queue = TriggerQueue.getInstance().queue
            let faildJobs = await queue?.getFailed()
              if(faildJobs && faildJobs?.length >0)
              {
                console.log(faildJobs)
                for (let index = 0; index < faildJobs.length; index++) {
                    const element = faildJobs[index];
                    if(element.id)
                    {
                        const job = await queue?.getJob(element.id)
                         await job?.retry()
                    }
                }
              }
        } catch (error:any) {
            throw new Error(error)
        }
    }


    public static async getFailedJob(){
        try {
            // let queue = TriggerQueue.getInstance().queue
            // if(queue)
            // {
            //     let faildJobs = await queue?.getFailed()
            //     const waitingJobs = await queue?.getWaiting();

            //     const faildJobsCount = faildJobs.length;
            //     const waitingJobsCount = faildJobs.length;

            //     return new ResponseData(true,"",{faildJobsCount:faildJobsCount,waitingJobsCount:waitingJobsCount})
            // }
            
            let qu =  TriggerQueue.getInstance()
          let falid =   await qu.getFailed()
            return falid
        } catch (error:any) {
            throw new Error(error)
        }
    }

    public static async getGrubFailedJob(){
        try {
            // let queue = TriggerQueue.getInstance().queue
            // if(queue)
            // {
            //     let faildJobs = await queue?.getFailed()
            //     const waitingJobs = await queue?.getWaiting();

            //     const faildJobsCount = faildJobs.length;
            //     const waitingJobsCount = faildJobs.length;

            //     return new ResponseData(true,"",{faildJobsCount:faildJobsCount,waitingJobsCount:waitingJobsCount})
            // }
            
            let qu =  GruptechOrderQueue.getInstance()
          let falid =   await qu.getFailed()
            return falid
        } catch (error:any) {
            throw new Error(error)
        }
    }
}