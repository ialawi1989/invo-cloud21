// import Queue from 'bee-queue'
import { InventoryMovmentTrigger } from './inventoryMovmentTrigger';
import { Queue, Worker, DelayedError } from 'bullmq'
import ioredis from 'ioredis';

import { ResponseData } from '@src/models/ResponseData';
import { Lazy } from '@src/utilts/Lazy';
import { queueRedisConnection } from '@src/utilts/QueueRedisConnection';
import { CostAllocationManager } from './costAllocation';

// Create a new connection in every instance

// const sharedConfig = {
//     redis: RedisClient.getRedisClient().client,
// };


const redis = queueRedisConnection.get(); // reuse same redis
let instance: UnitCostQueue;
export class UnitCostQueue {
  queue?: Queue;

  redisUrl?: string = process.env.QUEUE_REDIS_CLIENT_URL

  constructor() {
    if (this.redisUrl) {


      try {
        if (queueRedisConnection)

          this.queue = new Queue(`{UnitCostQueue_${process.env.NODE_ENV}}`, {
            connection: redis
          },)

      } catch (error) {
        console.log("errrr", error)
      }
    }

  }

  public static getInstance() {
    if (!instance) {
      instance = new UnitCostQueue()
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

        if (data && data.data) {
          let type = data.type;
          let key;
          if (data.type === 'CompanyUnitCostAllocation') {
            key = `${type}${data.data.branchId}`
          } else if (data.type === 'setBranchUnitCost') {
            key = `${type}${data.data.productId}${data.data.branchId}`
          } else if (data.type === 'reallocateTheProducts'){
            key = `${type}${data.data.companyId}${data.data.branchId}${data.data.batchNumber}`

          }else {
            key = `${type}${data.data.costId}${data.data.productId}${data.data.branchId} ${data.data.companyId}`
          }

          let existing = await this.queue.getJob(`${key}`);

          if (existing) {
            const status = await existing.getState();
            console.log('Job status:', status);

            if (status === "completed") {
              await existing.remove();
              existing = null
            } else {
              return
            }
          }

          if (!existing) {
            await this.queue.add(`unitCost:${Date.now()}`, data, {
              jobId: `${key}`,
              removeOnComplete: true,
              attempts: 5, backoff: {
                type: 'exponential',
                delay: 5 * 60 * 1000 // 5 minutes in milliseconds
                //delay: 3000
              },

            });
          }
          // this.queue.addBulk()
        }
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
  `{UnitCostQueue_${process.env.NODE_ENV}}`,
  async (job) => {
    let jobs: any[] = [];
    if (Array.isArray(job.data)) {
      jobs = job.data
    } else {
      jobs = [job.data]
    }
    try {

      for (let index = 0; index < jobs.length; index++) {
        const element = jobs[index];


        if (element.type === 'CompanyUnitCostAllocation') {
          await InventoryMovmentTrigger.ProductUnitCostAllocation(element.data);
        } else if (element.type === 'setBranchUnitCost') {
          await InventoryMovmentTrigger.setBranchUnitCost(element.data)
        } else if (element.type === 'reallocateTheProducts'){
          await CostAllocationManager.reallocateTheProducts(job, element.data)
        } else {
          await CostAllocationManager.reallocateCost(job, element.data.productId, element.data.costId, element.data.branchId, element.data.companyId, element.data.isDeleted)
        }
      }


      return;
    } catch (error: any) {
  

      throw error;
    }
  },
  { concurrency: 3, lockDuration: 60000, connection: queueRedisConnection.get() }
);

worker.on("error", (err) => {
  // Log your error.



})


worker.on('stalled', async (jobId) => {
  const queue = UnitCostQueue.getInstance();
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
  // console.log(`Job failed: ${job}`);
  // console.log(job.data)
  // console.error(`Error: ${err.message}`);
});

