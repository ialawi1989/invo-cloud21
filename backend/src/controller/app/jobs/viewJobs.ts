
import { DB } from '@src/dbconnection/dbconnection';
import { CronJob } from 'cron';
import { ViewQueue } from '../../../utilts/viewQueue';
import { RedisClient } from '@src/redisClient';
import { json } from 'body-parser';
import { PaymentRepo } from '@src/repo/ecommerce/pament.repo';
import { RecurringBillRepo } from '@src/repo/app/accounts/RecurringBill.repo';
import { scheduledReportRepo } from '@src/repo/app/accounts/scheduledReport.repo';
//        '00 18 * * *', // cronTime
export const jobStatus = {
  isPendingPaymentRunning: false,
};
export class ViewJob {
    public paymentJob;
    public autoTransaction;
    public scheduledReport;
    constructor() {
        this.paymentJob = new CronJob(
            '*/30 * * * * *', // cronTime
            () => {if (!jobStatus.isPendingPaymentRunning)  PaymentRepo.checkPendingPaymentStatus()},
        );

        this.autoTransaction = new CronJob(
            '0 0 3 * * *',
            () => RecurringBillRepo.generateAutoTransactions(),
        );

        this.scheduledReport = new CronJob(
            '0 0 * * * *',
            () => scheduledReportRepo.getDueReports(),
        );
    }

    async refresh() {

        let redisClient = RedisClient.getRedisClient();
        let env = process.env.NODE_ENV ?? "Local";
        let key = "lockRefresh_"+ env
        try {

      
            //block
    
            let isLocked = await redisClient.get(key);
            let queue = ViewQueue.getQueue();
            if (isLocked == null) {
                if (queue && queue.viewQueue && queue.viewQueue.results && queue.viewQueue.results?.length > 0) {
                    //set the isLocked to true
                    await redisClient.set(key, JSON.stringify({ "isLocked": true }));
                    queue.viewQueue.results.splice(0, queue.viewQueue.results.length);

                    await DB.excu.query(`SELECT pg_cancel_backend(pid) FROM pg_stat_activity
                    where backend_type='client backend'
                    and datname ='production' and query Like 'REFRESH MATERIALIZED VIEW%'`);
                 
                    let inventoryView = await DB.excu.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY "InventoryMovmentView"`);
                    inventoryView = await DB.excu.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY "JournalReports"`);
                 
                    
                    if(inventoryView)
                    {
                       
                       await redisClient.deletKey(key);
                    }

                  

                }
            }
            //release
        } catch (error) {
            console.log(error)
            await redisClient.deletKey(key);
        }

    }

}