// import Queue from 'bee-queue'
import { JournalTriggers } from './journalTriggers';
import { InventoryMovmentTrigger } from './inventoryMovmentTrigger';
import { InvoiceStatusTriggers } from './invoiceStatusTrigger';
import { Queue, Worker } from 'bullmq'
import ioredis from 'ioredis';

import { ResponseData } from '@src/models/ResponseData';
import { BillingStatusTrigger } from './billingStatusTrigger';
import { Lazy } from '@src/utilts/Lazy';
import { queueRedisConnection } from '@src/utilts/QueueRedisConnection';

// Create a new connection in every instance

// const sharedConfig = {
//     redis: RedisClient.getRedisClient().client,
// };


let instance: TriggerQueue;

export class TriggerQueue {
  queue?: Queue;

  redisUrl?: string = process.env.QUEUE_REDIS_CLIENT_URL

  constructor() {
    if (this.redisUrl) {


      try {
        if (queueRedisConnection)

          this.queue = new Queue(`{JournalJobs_${process.env.NODE_ENV}}`, {
            connection: queueRedisConnection.get(), // ✅ must call get()
          },)

      } catch (error) {
        console.log("errrr", error)
      }
    }

  }

  public static getInstance() {
    if (!instance) {
      instance = new TriggerQueue()
    }
    return instance;
  }
  public async createJob(data: any) {
    try {
      /**Note: backoff : is to allow the process of other jobs in case the the current job fails 
       * 
       * types :
       * Fixed : is to allow retries after fixed amount of time 
       * Exponential : allow retries by multiplcation of 2  first time 5 second 10 .....
       * Exponential with Jitter : random amount of "jitter" is added to the delay. This helps prevent all retries from happening at the same time
       * Random : the delay between retries is a random amount of time within a specified range
       */

      if (this.queue) {
        let type = data.type;
        let key;
        if (data.id && data.companyId) {
          key = `${type}${data.id}${data.companyId}`;
        } else if (data.ids && data.referenceId) {
          key = `${type}${data.ids.join(',')}${data.referenceId}`;
        } else if (data.invoiceIds) {
          key = `${type}${data.invoiceIds.join(',')}`;
        } else if (data.companyId && data.branchId) {
          key = `${type}${data.companyId}${data.branchId}`;
        } else if (data.movmentIds) {
          key = `${type}${data.movmentIds}`;
        } else if (data.ids) {
          key = `${type}${data.ids}`;
        } else if (data.referenceId) {
          key = `${type}${data.referenceId}`;
        }

        if (data.journalType) {
          key = data.ids ? data.ids.join(',') : data.id;
          key = `${data.type}${key}`;
          key = `${data.journalType}${key}`;
        }

      let  existing = await this.queue.getJob(`${key}`);
    
        if (existing) {
          const status = await existing.getState();
          console.log('Job status:', status);

          if (status === "completed" || status === "failed") {
            await existing.remove();
            existing = null 
          }else{
            return 
          }
        }


        if (!existing) {
          const inventoryPriority = ['manualAdjusment', 'openingBalance', 'physicalCount', 'trensfer']
          //prioritize movement journals over other journals
          const priority = data.journalType === 'Movment' ? ((inventoryPriority.includes(data.type)) ? 1 : 2) : 3;

          await this.queue.add(`Jornal:${key}`, data, {
            jobId: `${key}`,
            removeOnComplete: 1000,
            priority: priority,
            attempts: 5, backoff: {
              type: 'exponential',
              delay: 5 * 60 * 1000 // 5 minutes in milliseconds
              //delay: 3000
            },
            removeOnFail: false
          });

          return;
        }


        // this.queue.addBulk()
      }

    } catch (error: any) {
      throw new Error(error)
    }
  }
  public async getFailed() {
    try {
      let faileds = await this.queue?.getJobs(['failed', 'delayed', 'paused']);
      let faildJobs: any[] = [];
      let counts = await this.queue?.getFailedCount()
      if (faileds && faileds.length > 0) {
        for (let index = 0; index < faileds.length; index++) {
          const element = faileds[index];
          let faild = {
            data: element.data,
            attemptsMade: element.attemptsMade,
            failedReason: element.failedReason,
            attempts: element.opts.attempts,
            status: await element.getState()
          }

          await element.retry();
          //  await element.remove();
          faildJobs.push(faild)
          // if(this.queue)
          //   {
          //     this.queue.add(`Jornal:${Date.now()}`,element.data, {
          //       removeOnComplete: true,
          //       attempts: 5, backoff: {
          //         type: 'exponential',
          //         delay: 5 * 60 * 1000 // 5 minutes in milliseconds
          //       },
          //     })
          //   } 

        }

      }

      return new ResponseData(true, "", { jobs: faildJobs, counts: counts })
    } catch (error: any) {
      throw new Error(error)
    }
  }
}
// TriggerQueue.getInstance().queue.process(async function (job: any, done: any) {
//     try {
//         console.log(`Processing job ${job.id} `);
//         console.log(job.data)
//         let resault;
//         if (job.data == 'updateInvoiceStatus') {
//             InvoiceStatusTriggers.updateInvoiceStatus(job.data.invoiceIds)
//         }
//         else {
//             if (job.data.journalType && job.data.journalType == 'Movment') {
//                 resault = await InventoryMovmentTrigger.movmentQueue(job.data)
//             } else {
//                 resault = await JournalTriggers.journalQueue(job.data)
//             }
//         }



//         if (resault) {
//             return done(null, job.data.x + job.data.y);
//         }
//     } catch (error) {
//         job.retry(63000, error);/** retry for the faild jobs due to an error each 1 min 30 seconds */
//         done(error);
//     }


// });
const worker = new Worker(
  `{JournalJobs_${process.env.NODE_ENV}}`,
  async (job) => {

    let jobs: any[] = [];
    if (Array.isArray(job.data)) {
      jobs = job.data
    } else {
      jobs = [job.data]
    }
    try {
      const startTime = new Date();
      await job.log(`Start Time: ${startTime.toISOString()}`);
      await job.log("Downloading");
      await job.updateProgress(10)

      for (let index = 0; index < jobs.length; index++) {
        const element = jobs[index];


        if (element.journalType === 'Movment') {
          await InventoryMovmentTrigger.movmentQueue(element);
        } else {
          switch (element.type) {
            case 'updateInvoiceStatus':
              await InvoiceStatusTriggers.updateInvoiceStatus(element.invoiceIds);
              break;
            case 'updateBillStatus':
              await BillingStatusTrigger.updateBillStatus(element.ids);
              break;
            case 'pushNotifictios':
              await InvoiceStatusTriggers.pushNotigications(element.invoiceIds);
              break;
            case 'pushPaidNotifictios':
              await InvoiceStatusTriggers.pushInvoicePaidNotifications(element.invoiceIds);
              break;
            default:
              await JournalTriggers.journalQueue(job, element);
              break;
          }
        }


      }
      const endTime = new Date();
      await job.log(`End Time: ${endTime.toISOString()}`);
      await job.log("Completed Successfully");
      await job.updateProgress(100)

      return;
    } catch (error: any) {

      if (error && typeof error.message === "string") {
        if (error.message.includes("UnbalancedJournalError") || error.message.includes("Journal is unbalanced")) {
          console.log(`Skipping retry for job ${job.id} due to: ${error.message}`);
          await job.moveToFailed(error.message, job.token ?? "", true); // no retry
          return;
        }
      }
    
      // fallback logging
      console.error("Error processing job:", error);
      throw error;
    }
  },
  { concurrency: 2, lockDuration: 60000, connection: queueRedisConnection.get() }
);

worker.on("error", (err) => {
  // Log your error.
  console.log(err)
  

})


worker.on('stalled', async (jobId) => {
  const queue = TriggerQueue.getInstance();
  const job = await queue.queue?.getJob(jobId)
  if (job && jobId) {
    console.log("stalled Job", job.data)

    // try {
    //   //  setTimeout()
    // } catch (error) {
    //   await job.moveToFailed(new Error('Processing failed due to an error'),jobId,true)
    // }

  }


});


worker.on('failed', async (job: any, err) => {
  console.log(`Job failed: ${job}`);
  console.log(job.data)
  console.error(`Error: ${err.message}`);
});

