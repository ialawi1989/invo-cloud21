import { JobType, Queue, Worker } from "bullmq";
import { ConnectionOptions, WorkerOptions } from "bullmq/dist/esm/interfaces";

import ioredis from "ioredis";
import { UUID } from "./uuid";
import { Lazy } from "./lazy";

let url: any = process.env.QUEUE_REDIS_CLIENT_URL;
export const redisConnection = new Lazy<ioredis>(
  () =>
    new ioredis(url, {
      maxRetriesPerRequest: null,

      retryStrategy: function (times) {
        return Math.max(Math.min(Math.exp(times), 20000), 1000);
      },
    })
);

const defaultOptions = new Lazy<WorkerOptions>(() => {
  return {
    concurrency: 3,
    lockDuration: 60000,
    connection: redisConnection.get(),
  } as WorkerOptions;
});

export async function NewQueueWorker(
  queueName: string,
  func: (job: QueueJob) => void,
  opts?: WorkerOptions
) {
  if (opts) {
    opts.connection = opts.connection || defaultOptions.get().connection;
    opts.concurrency = opts.concurrency || defaultOptions.get().concurrency;
    opts.lockDuration = opts.lockDuration || defaultOptions.get().lockDuration;
  }
  const worker = new Worker(
    `{${queueName}_${process.env.NODE_ENV}}`,
    async (job) => {
      let jobs: any[] = [];
      if (Array.isArray(job.data)) {
        jobs = job.data;
      } else {
        jobs = [job.data];
      }
      try {
        for (let index = 0; index < jobs.length; index++) {
          const job = jobs[index] as QueueJob;
          await func(job);
        }

        return;
      } catch (error: any) {
    
        if (
          error &&
          error.message &&
          typeof error.message === "string" &&
          error.message.includes("UnbalancedJournalError")
        ) {
          console.log(`Skipping retry for job ${job.id} due to: ${error}`);
          await job.moveToFailed(error.message, job.token ?? "", true); // `true` = no retry
          return;
          // Do nothing, job stays failed
        }
        console.error("Error processing job:", error);
        throw error;
      }
    },
    opts || defaultOptions.get()
  );

  worker.on("error", (err) => {
    // Log your error.
    console.log(err);

  });
  return worker;
}

export interface QueueJob {
  type: string;
  data: any;
}

export class JobsQueue {
  private queue?: Queue;
  private jobsPrefix: string;
  private keyGenerator?: (data: QueueJob) => Promise<string | undefined>;
  constructor(
    queueName: string,
    jobsPrefix: string,
    keyGenerator?: (data: QueueJob) => Promise<string | undefined>,
    connection?: ConnectionOptions
  ) {
    this.queue = new Queue(`{${queueName}_${process.env.NODE_ENV}}`, {
      connection: connection || redisConnection.get(),
    });
    this.jobsPrefix = jobsPrefix;
    this.keyGenerator = keyGenerator;
  }

  public async createJob(data: QueueJob) {
    if (!this.queue) return;

    let key = this.keyGenerator
      ? (await this.keyGenerator(data)) || UUID()
      : UUID();

    const existing = this.keyGenerator && (await this.queue.getJob(`${key}`));

    if (existing) return;

    /**Note: backoff : is to allow the process of other jobs in case the the current job fails
     *
     * types :
     * Fixed : is to allow retries after fixed amount of time
     * Exponential : allow retries by multiplication of 2  first time 5 second 10 .....
     * Exponential with Jitter : random amount of "jitter" is added to the delay. This helps prevent all retries from happening at the same time
     * Random : the delay between retries is a random amount of time within a specified range
     */

    await this.queue.add(`${this.jobsPrefix}:${key}`, data, {
      jobId: `${key}`,
      removeOnComplete: true,
      priority: 2,
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 5 * 60 * 1000, // 5 minutes in milliseconds
        //delay: 3000
      },
    });
  }

  public async getFailed() {
    let failedJobs = await this.getJobs(["failed", "delayed", "paused"]);
    let counts = await this.queue?.getFailedCount();
    if (failedJobs && failedJobs.length > 0) {
      for (let index = 0; index < failedJobs.length; index++) {
        const element = failedJobs[index];
        await element.retry();
      }
    }

    return { jobs: failedJobs, counts: counts };
  }

  public async getJobs(
    types?: JobType | JobType[] | undefined,
    start?: number,
    end?: number,
    asc?: boolean
  ) {
    let queueJobs = await this.queue?.getJobs(types, start, end, asc);
    let jobs: any[] = [];
    if (queueJobs && queueJobs.length > 0) {
      for (let index = 0; index < queueJobs.length; index++) {
        const element = queueJobs[index];
        let job = {
          data: element.data,
          attemptsMade: element.attemptsMade,
          failedReason: element.failedReason,
          attempts: element.opts.attempts,
          status: await element.getState(),
          retry: element.retry,
        };
        jobs.push(job);
      }
    }

    return jobs;
  }
}
