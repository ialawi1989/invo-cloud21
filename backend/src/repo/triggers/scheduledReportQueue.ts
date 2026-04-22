// import Queue from 'bee-queue'
import { JournalTriggers } from './journalTriggers';
import { RedisClient } from '@src/redisClient';
import { InventoryMovmentTrigger } from './inventoryMovmentTrigger';
import { InvoiceStatusTriggers } from './invoiceStatusTrigger';
import { createClient } from "redis";
import { Job, Queue, Worker } from 'bullmq'
import ioredis from 'ioredis';
import path from 'path';

import { ResponseData } from '@src/models/ResponseData';

import { RedisOptions } from 'ioredis';
import { scheduledReportRepo } from '../app/accounts/scheduledReport.repo';
import { Lazy } from '@src/utilts/Lazy';
import { queueRedisConnection } from '@src/utilts/QueueRedisConnection';

interface ReportJobData {
  userId: string;
  reportType: string;
  scheduleTime: string;
}

let url: any = process.env.QUEUE_REDIS_CLIENT_URL;

export class ScheduledReportQueue {
  private queue: Queue;
  private worker: Worker;

  constructor() {
    this.queue = new Queue(`{scheduledReports_${process.env.NODE_ENV}}`, { connection:queueRedisConnection.get() });
    this.worker = new Worker(`{scheduledReports_${process.env.NODE_ENV}}`, this.processJob.bind(this), {
      connection: queueRedisConnection.get() ,
      limiter: { max: 5, duration: 1000, },
    });

    this.worker.on('failed', (job: any, err: Error) => {
      console.error(`Job ${job.id} failed: ${err.message}`);
      // Implement custom failure handling logic
    });

    this.worker.on("error", (err) => {
      // Log your error.
      console.log(err)

    })

    this.worker.on('stalled', async (jobId) => {
      const job = await this.queue?.getJob(jobId)
      if (job && jobId) {
        console.log("stalled Job", job.data)
      }
    })

    this.worker.on('completed', (job: Job) => {
      console.log(`Job ${job.id} completed`);
      // Implement post-processing logic
    });
  }

  public async addReportJob(data: Record<string, any>) {
    try {
      await this.queue.add('sendReport', data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: {
          age: 3600 * 24 * 7, // keep up to 24 hour
          count: 50, // keep up to 1000 jobs
        }
      });
    } catch (error: any) {
      console.error('Error adding job to queue:', error.message);
      // Implement custom error handling logic
    }
  }

  private async processJob(job: Job) {
    const element: any = job.data;
    try {
      // Simulate report generation and sending
      console.log(`Generating and sending ${element.reportType}`);
      await scheduledReportRepo.sendScheduledReport(job.data);
    } catch (error: any) {
      console.error(`Error processing job ${job.id}: ${error.message}`);
      throw error; // Rethrow to trigger job failure handling
    }
  }



  public async close() {
    await this.worker.close();
    await this.queue.close();
    await queueRedisConnection.get().quit();
  }
}


