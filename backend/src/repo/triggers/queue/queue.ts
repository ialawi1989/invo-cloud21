import { JobType, Queue, Worker } from 'bullmq'
import { ConnectionOptions, WorkerOptions } from "bullmq/dist/esm/interfaces"

import ioredis from 'ioredis';
import { Lazy } from '@src/utilts/Lazy';
import { Helper } from '@src/utilts/helper';
import { RedisClient } from '@src/redisClient';
import { InvoiceStatuesQueue } from './workers/invoiceStatus.worker';


let url: any = process.env.QUEUE_REDIS_CLIENT_URL;
export const redisConnection = new Lazy<ioredis>(() => new ioredis(url, {
    maxRetriesPerRequest: null,

    retryStrategy: function (times) {
        return Math.max(Math.min(Math.exp(times), 20000), 1000)
    },
}));

const defaultOptions = new Lazy<WorkerOptions>(() => {
    return { concurrency: 1, lockDuration: 60000, connection: (redisConnection.get()) } as WorkerOptions;
});

export async function AccountQueueWorker(queueName: string, func: (job: QueueManagement) => any, opts?: WorkerOptions) {
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
                jobs = job.data
            } else {
                jobs = [job.data]
            }
            try {
                for (let index = 0; index < jobs.length; index++) {
                    const job = jobs[index] as QueueManagement;
                    let data = await func(job);
                    if (data) {
                        pushPendingUpdatesJobs(data.data)
                    }
                }

                return;
            } catch (error: any) {
              
                if (error && error.message && typeof error.message === 'string' && error.message.includes('UnbalancedJournalError')) {
                    console.log(`Skipping retry for job ${job.id} due to: ${error}`);
                    await job.moveToFailed(error.message, job.token ?? "", true); // `true` = no retry
                    return;
                    // Do nothing, job stays failed
                }
                console.error('Error processing job:', error);
                throw error;
            }
        },
        opts || defaultOptions.get()
    );

    worker.on("error", (err) => {
        // Log your error.
        console.log(err)
        
    });
    return worker;
}


export interface QueueManagement {
    id: string,
    companyId: string | null
}

export class QueueManagement {
    private queue?: Queue;
    private jobsPrefix: string;
    private keyGenerator?: (data: QueueManagement) => Promise<string | undefined>;
    constructor(queueName: string, jobsPrefix: string, keyGenerator?: (data: QueueManagement) => Promise<string | undefined>, connection?: ConnectionOptions) {
        this.queue = new Queue(`{${queueName}_${process.env.NODE_ENV}}`, {
            connection: connection || (redisConnection.get()),
        },)
        this.jobsPrefix = jobsPrefix;
        this.keyGenerator = keyGenerator;
    }

    public async createJob(data: QueueManagement) {
        if (!this.queue) return;

        let key = this.keyGenerator ? await this.keyGenerator(data) || Helper.createGuid() : Helper.createGuid();
        let job = await this.queue.getJob(`${key}`);
        const existing = this.keyGenerator && job;



        if (existing) {

            /**
             * Ensures the job is reprocessed if it's currently active,
             * allowing it to use the most up-to-date data and capture any recent changes.
             * Also retries the job automatically if a previous attempt failed.
             */
            let jobStatus = await job.getState();
            switch (jobStatus) {
                case 'waiting':

                    break;
                case 'active':
                    await this.pushJobToRedis(key, data)
                    break;
                case 'completed':
                    await job.retry();
                    break;
                case 'failed':
                    await job.retry();
                    break;
                case 'delayed':

                    break;
                case 'stalled':

                    break;
                case 'paused':

                    break;
                case 'unknown': /** the job no longer exist in the redis so for Pending-Updates to be pushed again */
                    await this.pushJob(key, data)
                    break;
                default:
                    break;
            }
            return
        } else {
            await this.pushJob(key, data)
        };

        /**Note: backoff : is to allow the process of other jobs in case the the current job fails 
         * 
         * types :
         * Fixed : is to allow retries after fixed amount of time 
         * Exponential : allow retries by multiplication of 2  first time 5 second 10 .....
         * Exponential with Jitter : random amount of "jitter" is added to the delay. This helps prevent all retries from happening at the same time
         * Random : the delay between retries is a random amount of time within a specified range
         */


    }

    private async pushJob(key: string, data: any) {
        if (!this.queue) return;
        await this.queue.add(`${this.jobsPrefix}:${key}`, data, {
            jobId: `${key}`,
            removeOnComplete: true,
            attempts: 5, backoff: {
                type: 'exponential',
                delay: 5 * 60 * 1000 // 5 minutes in milliseconds
                //delay: 3000
            },
        });
    }
    public async getFailed() {
        let failedJobs = await this.getJobs(['failed', 'delayed', 'paused']);
        let counts = await this.queue?.getFailedCount()
        if (failedJobs && failedJobs.length > 0) {
            for (let index = 0; index < failedJobs.length; index++) {
                const element = failedJobs[index];
                await element.retry();
            }
        }

        return { jobs: failedJobs, counts: counts };
    }

    public async getJobs(types?: JobType | JobType[] | undefined, start?: number, end?: number, asc?: boolean) {
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
                    retry: element.retry
                }
                jobs.push(job)
            }
        }

        return jobs;
    }

    public async pushJobToRedis(key: any, job: any) {
        try {
            // 1️⃣ Get Redis client instance
            let redis = RedisClient.getRedisClient();

            // 2️⃣ Build a namespaced key to store pending updates
            key = `Pending-Updates:${key}`;

            // 3️⃣ Check if there is already a pending update for this key
            let object = await redis.get(key);
            if (object) return;
            /** 
             * If there is already a job stored in Redis for this invoice,
             * do nothing and return. This avoids overwriting or duplicating jobs.
             */

            // 4️⃣ Store the job in Redis
            await redis.set(key, JSON.stringify(job));

        } catch (error: any) {
            // 5️⃣ If something goes wrong with Redis, throw an error
            throw new Error(error);
        }
    }
}


export function pushPendingUpdatesJobs(data: any) {
    try {
        let job = data.pendingUpdates;
        const type = job.type;
        switch (type) {
            case 'updateInvoiceStatus':
                if (job.data.id) {
                    InvoiceStatuesQueue.get().createJob({
                        id: job.data.id
                    } as any);
                }
                break;

            default:
                break;
        }
    } catch (error) {

    }
}