import { Queue, Worker } from 'bullmq'
import ioredis from 'ioredis';

import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { Lazy } from '@src/utilts/Lazy';
import { queueRedisConnection } from '@src/utilts/QueueRedisConnection';

import { publishEvent } from '@src/utilts/system-events';


let instance: InvoiceStatusUpdate;


export class InvoiceStatusUpdate {
  queue?: Queue;
  redisUrl?: string = process.env.QUEUE_REDIS_CLIENT_URL








  constructor() {
    // if (this.redisUrl) {
    try {
      if (queueRedisConnection)

        this.queue = new Queue(`{InvoiceStatusUpdate_${process.env.NODE_ENV}}`, {
          connection:queueRedisConnection.get(),
        },)

    } catch (error) {
      console.log("errrr", error)
    }
    // }

  }

  public static getInstance() {
    if (!instance) {
      instance = new InvoiceStatusUpdate()
    }
    return instance;
  }
  public async createJob(data: any) {
    try {
      if (this.queue) {
        await this.queue.add(`Invoices_${data}`, { data: data }, {
          removeOnComplete: {
            age: 3600 * 24 * 7, // keep up to 24 hour
            count: 7000, // keep up to 1000 jobs
          },
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 3 * 1000 // 3 sec in milliseconds
          },
        },);

      }

    } catch (error: any) {
      throw new Error(error)
    }
  }



}









const worker = new Worker(
  `{InvoiceStatusUpdate_${process.env.NODE_ENV}}`,

  async (job) => {
    try {
      await Promise.all(
        job.data.data.map(async (invoice: any) => {
          switch (invoice.newStatus) {
            case "Paid": 
              return publishEvent("Invoice-Paid", invoice);
            case "Voided":  
             return publishEvent("Invoice-Voided", invoice); 
            case "Closed":  
             return publishEvent("Invoice-Closed", invoice); 
            default:
              return;
          }
        })
      );




    } catch (error: any) {
      console.error('Error processing job:', error);
      throw new Error(error);
    }



  },
  { concurrency: 1, connection: queueRedisConnection.get(), maxStalledCount: 3 }
);

worker.on("error", (err) => {

})

worker.on('stalled', async (jobId) => {
  const queue = TriggerQueue.getInstance();
  const job = await queue.queue?.getJob(jobId)
  if (job && jobId) {
    console.log("=======stalled Job===================", job.data)
  }
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed!`);
});

worker.on('failed', (job: any, err) => {
  console.log(`Job ${job.id} failed with error: ${err.message}`);
});

worker.on('active', (job) => {
  console.log(`Job ${job.id} is now active.`);
});