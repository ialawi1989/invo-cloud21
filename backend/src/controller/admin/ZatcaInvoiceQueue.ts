import { Queue, Worker } from 'bullmq'
import ioredis from 'ioredis';
import { DB } from '@src/dbconnection/dbconnection';
const { Logger } = require('aws-cloudwatch-log')
import { InvoiceRepo } from '@src/repo/app/accounts/invoice.repo';

import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { FileStorage } from '@src/utilts/fileStorage';
import { PoolClient } from 'pg';
import { Company } from '@src/models/admin/company';
import { Lazy } from '@src/utilts/Lazy';


let instance: ZatcaInvoiceQueue;
let url: any = process.env.QUEUE_REDIS_CLIENT_URL;
const connection = new Lazy<ioredis>(() => {
  const con = new ioredis(url, {
    maxRetriesPerRequest: null,

    retryStrategy: function (times) {
      return Math.max(Math.min(Math.exp(times), 20000), 1000)
    },
  });
  con.on('error', (err) => {
    console.log(err)
  });
  return con;
});



const workerConnection = new Lazy<ioredis>(() => {
  const con = new ioredis(url, {
  maxRetriesPerRequest: null,

  retryStrategy: function (times) {
    return Math.max(Math.min(Math.exp(times), 20000), 1000)
  },
  });
  con.on('error', (err) => {
    console.log(err)
  });
  return con;
});

export class ZatcaInvoiceQueue {
  queue?: Queue;
  redisUrl?: string = process.env.QUEUE_REDIS_CLIENT_URL

  static async getCompanyFromInvoice(client: PoolClient, invoiceID: any) {
    try {
      const query: { text: string, values: any } = {
        text: `select 
                c.id,
                c.name,
                c.country,
                c."vatNumber",
                m.url->>'defaultUrl || "https://www.invopos.com/wp-content/uploads/2024/06/cropped-logo-invo.png"',
                c."invoiceOptions" as logo 
                from "Invoices" i 
                inner join "Branches" b ON i."branchId" =b.id
                inner join "Companies" c on b."companyId" = c.id 
                LEFT JOIN "Media" m on c."mediaId"=m.id
                where i.id = $1`,
        values: [invoiceID]
      }
      let companyData = await client.query(query.text, query.values);
      let company = new Company();
      company.ParseJson(companyData.rows[0]);
      const storage = new FileStorage();
      let companySettings = await storage.getCompanySettings(company.country);
      let settings = companySettings?.settings;
      company.afterDecimal = settings.afterDecimal;
      company.currencySymbol = settings.currencySymbol;
      return company;
    } catch (error: any) {
      throw new Error(error)
    }
  }






  constructor() {
    try {
      if ((connection.get()))

        this.queue = new Queue(`{ZatcaInvoiceQueue_${process.env.NODE_ENV}}`, {
          connection:connection.get(),
        },)

    } catch (error) {
      console.log("errrr", error)
    }

  }

  public static getInstance() {
    if (!instance) {
      instance = new ZatcaInvoiceQueue()
    }
    return instance;
  }
  public async createJob(data: any) {
    try {
      if (this.queue) {
        await this.queue.add(`Invoice_${data}`, { id: data }, {
          removeOnComplete: {
            age: 3600 * 24 * 7, // keep up to 24 hour
            count: 7000, // keep up to 1000 jobs
          },
          attempts: 1,
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
  `{ZatcaInvoiceQueue_${process.env.NODE_ENV}}`,

  async (job) => {
    const client = await DB.excu.client();
    try {
      await client.query("BEGIN");
      const invoiceId = job.data.id;

      let company = await ZatcaInvoiceQueue.getCompanyFromInvoice(client, invoiceId);
      // Report to Zatca
      let report = await InvoiceRepo.zatcaSamplifedInvoice(client, invoiceId, company);
      await client.query(
        `UPDATE "Invoices" SET "zatca_status" = 'REPORTED' WHERE id = $1`,
        [invoiceId]
      );
      job.log("Reported Succefully");
      await client.query("COMMIT");
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error('Error processing job:', error);
      // job.log(error?.response?.data?.validationResults ? JSON.stringify(error.response.data.validationResults) : error);
      let errorMessage = "";
      let index = 0;

      let newError =
        error?.response?.data?.validationResults?.errorMessages?.length
          ? error.response.data.validationResults.errorMessages
            .map((err: any) => {
              index++;
              return `${index} - ${err.message}`;
            })
            .join("\n")
          : error?.message || String(error);



      throw { message: newError };

    } finally {
      client.release()
    }

  },
  { concurrency: 1, connection: workerConnection.get(), maxStalledCount: 3, lockDuration: 120000, }
);

worker.on("error", (err) => {
  let logger = new Logger({
    logGroupName: 'bezat',
    logStreamName: 'GrupTech',
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    uploadFreq: 10000, 	// Optional. Send logs to AWS LogStream in batches after 10 seconds intervals.
    local: false 		// Optional. If set to true, the log will fall back to the standard 'console.log'.
  });
  logger.log(err);
  // Log your error.
  console.log(err)
 
})

worker.on('stalled', async (jobId) => {
  // Use the same queue name/connection to fetch the job, not TriggerQueue
  const q = new Queue(`{ZatcaInvoiceQueue_${process.env.NODE_ENV}}`, { connection:connection.get() });
  const job = await q.getJob(jobId);
  if (job) {
    console.warn('[BullMQ] stalled job', jobId, job.data);
  }
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed!`);
});

worker.on('failed', async (job: any, err) => {
  await DB.excu.query(
    `UPDATE "Invoices"
   SET "zatca_status" = 'FAILED',
       "zatca_info"   = $2
   WHERE id = $1`,
    [job.data.id, err.message]
  );
});

worker.on('active', (job) => {
  console.log(`Job ${job.id} is now active.`);
});