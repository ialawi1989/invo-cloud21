// queue/BaseBalanceQueue.ts
import { Queue, Worker, Job } from 'bullmq';
import ioredis from 'ioredis';

import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { Lazy } from '@src/utilts/Lazy';
import { queueRedisConnection } from '@src/utilts/QueueRedisConnection';
import { SocketCustomerRepo } from '../socket/customer.socket';
import { BranchesRepo } from '../admin/branches.repo';

// Redis setup


// Types
export interface BalanceJobData {
  dbTable: string;
  transactionId?: string;
  userId?: string;
}

interface UserInfo {
  id: string;
  name: string;
}

const logAndCapture = (context: any, error: any) => {
  const message = typeof error === 'string' ? error : error.message;
  console.error(`🚨 ${context}:`, message);
  ;
};

export abstract class BaseBalanceQueue {
  protected queue: Queue;
  public readonly queueName: string;
  userType:any;
  constructor(queueName: string,userType:string) {
    this.queueName = queueName;
    this.userType = userType
    this.queue = new Queue(this.queueName, { connection: queueRedisConnection.get() });
  }

  protected async fetchCustomer(dbTable: string,  id: string): Promise<any | null> {
    try {
      //this function will help with old jobs
      let selectQuery = '';
      switch (dbTable) {
        case 'Invoices':
          selectQuery = `Select "customerId" from "Invoices" where id = $1`
          break;
        case 'InvoicePayments':
          selectQuery = `Select "customerId" from "InvoicePayments" where id = $1`
          break;
      
        default:
          break;
      }
      if(selectQuery == '') return null;
      const result = await DB.excu.query(selectQuery, [id]);
      return result.rows?.[0] || null;
    } catch (err:any) {
      logAndCapture(`[fetchUser][customer]`, err);
      throw new Error(`Failed to retrieve customer info: ${err.message}`);
    }
  }
  protected async fetchSupplier(dbTable: string,  id: string): Promise<any | null> {
    try {
      //this function will help with old jobs
      let selectQuery = '';
      switch (dbTable) {
        case 'Billings':
          selectQuery = `Select "supplierId" from "Billings" where id = $1`
          break;
        case 'BillingPayments':
          selectQuery = `Select "supplierId" from "BillingPayments" where id = $1`
          break;
      
        default:
          break;
      }
      if(selectQuery == '') return null;
      const result = await DB.excu.query(selectQuery, [id]);
      return result.rows?.[0] || null;
    } catch (err:any) {
      logAndCapture(`[fetchUser][customer]`, err);
      throw new Error(`Failed to retrieve customer info: ${err.message}`);
    }
  }
  protected async fetchUser(dbTable: string,  id: string, type: 'customer' | 'supplier'): Promise<any | null> {
    try {
      const joins = this.getJoinQuery(dbTable, type);
      if (!joins.joins && !joins.column) {
        console.warn(`[fetchUser] Unsupported dbTable "${dbTable}" for ${type}`);
        return null;
      }

      let columnName = joins.column
      const selectQuery = `
        SELECT ${columnName} as id
        FROM "${dbTable}"
        ${joins.joins}
        WHERE "${dbTable}"."id" = $1;
      `;
       console.log(selectQuery)
      const result = await DB.excu.query(selectQuery, [id]);
      return result.rows|| null;
    } catch (err:any) {
      logAndCapture(`[fetchUser][${type}]`, err);
      throw new Error(`Failed to retrieve ${type} info: ${err.message}`);
    }
  }

  private getJoinQuery(dbTable: string, type: 'customer' | 'supplier'):{joins: string | null , column:string|null}{
    const joins: Record<string, string> = {
      // Customer joins
      InvoicePayments:`
       LEFT JOIN "InvoicePaymentLines" on "InvoicePayments"."id" = "InvoicePaymentLines"."invoicePaymentId"
      LEFT JOIN "CustomerOpeningBalance" on "CustomerOpeningBalance".id = "InvoicePaymentLines"."openingBalanceId"
      LEFT JOIN "Invoices" ON "Invoices".id = "InvoicePaymentLines"."invoiceId"`,
      CreditNotes: `
        JOIN "Invoices" ON "Invoices".id = "CreditNotes"."invoiceId"`,
      AppliedCredits: `
        JOIN "Invoices" ON "Invoices".id = "AppliedCredits"."invoiceId"`,
      CreditNoteRefunds: `
        JOIN "CreditNotes" ON "CreditNotes".id = "CreditNoteRefunds"."creditNoteId"
        JOIN "Invoices" ON "Invoices".id = "CreditNotes"."invoiceId"`,
      Invoices:` `,

      // Supplier joins

      SupplierCredits: `
        JOIN "Billings" ON "Billings".id = "SupplierCredits"."billingId"`,
      SupplierAppliedCredits: `
        JOIN "Billings" ON "Billings".id = "SupplierAppliedCredits"."billingId"`,
      SupplierRefunds: `
        JOIN "SupplierCredits" ON "SupplierCredits".id = "SupplierRefunds"."supplierCreditId"
        JOIN "Billings" ON "Billings".id = "SupplierCredits"."billingId"`,

      
    };
    const userColumnMap: Record<string, string> = {
      // Customer transactions
      Invoices: `"Invoices"."customerId"`,
      Customers: `"Customers"."id"`,
      InvoicePayments: `COALESCE("Invoices"."customerId","CustomerOpeningBalance"."customerId" , "InvoicePayments"."customerId")`,
      CreditNotes:`"Invoices"."customerId"` ,
      AppliedCredits:   `"Invoices"."customerId"` ,
      CreditNoteRefunds: `"Invoices"."customerId"` ,

      // Supplier transactions
      Billings:  `"Billings"."supplierId"`, 
      BillingPayments:  `"BillingPayments"."supplierId"`, 
      Suppliers: `"Suppliers"."id"`,
      SupplierCredits:  `"Billings"."supplierId"` ,
      SupplierAppliedCredits: `"Billings"."supplierId"`,
      SupplierRefunds: `"Billings"."supplierId"` ,
    };


    return {joins:joins[dbTable] || null, column:userColumnMap[dbTable]}
  }

  async createJob(data: BalanceJobData): Promise<void> {
    if (!data.userId && !data.transactionId) {
      console.warn(`[createJob] Missing userId. Job data:`, data);
      return;
    }
     let userId:any[]|null = [{id:data.userId}];
    if(!data.userId && data.transactionId)
    {
    userId = await this.fetchUser(data.dbTable,data.transactionId,this.userType)
    }

    if(!userId)
    {
       console.warn(`[createJob] Missing userId. Job data:`, data); 
        return;
    }

    if(userId && userId.length>0)

{
  
   for (let index = 0; index < userId.length; index++) {
    const element = userId[index];
    
  
   const jobId = `${this.userType}:${element.id}`;
    let existing = await this.queue.getJob(jobId);

    
        if (existing) {
          const status = await existing.getState();
          console.log('Job status:', status);

          if (status === "completed") {
            await existing.remove();
            existing = null 
          }else{
            return 
          }
        }
    try {
      await this.queue.add(this.queueName, {userId:element.id}, {
        jobId,
        attempts: 5,
        backoff: { type: 'exponential', delay: 5 * 60 * 1000 },
        removeOnComplete: true,
        removeOnFail: { age: 86400 }, // 24 hrs
      });
    } catch (err:any) {
      logAndCapture(`[createJob] Failed to add job: ${jobId}`, err);
      throw new Error(`Failed to add job: ${err.message}`);
    }
  }
   }
  }

  async getFailedJobs() {
    try {
      const failedJobs = await this.queue.getJobs(['failed', 'delayed', 'paused']);
      const count = await this.queue.getFailedCount();

      const processed = await Promise.all(
        failedJobs.map(async (job) => {
          const status = await job.getState();
          await job.retry(); // Optionally comment this out
          return {
            data: job.data,
            attemptsMade: job.attemptsMade,
            failedReason: job.failedReason,
            attempts: job.opts.attempts,
            status,
          };
        })
      );

      return new ResponseData(true, '', { jobs: processed, counts: count });
    } catch (err) {
      logAndCapture(`[getFailedJobs]`, err);
      throw err;
    }
  }
}

export class CustomerBalanceQueue extends BaseBalanceQueue {
  private static instance: CustomerBalanceQueue;

  private constructor() {
    super(`{CustomerBalance_${process.env.NODE_ENV || 'dev'}}`,'customer');
  }

  static getInstance(): CustomerBalanceQueue {
    if (!this.instance) {
      this.instance = new CustomerBalanceQueue();
    }
    return this.instance;
  }

  async customerBalance(data: BalanceJobData): Promise<void> {
    let userId = data.userId 
    

    if (!userId && data.transactionId) {
      const customer = await this.fetchCustomer(data.dbTable, data.transactionId);
      if (!customer) throw new Error(`Customer not found for ${data.transactionId}`);
      userId = customer.id
    }
    let skipUsers = ['49765178-697f-4399-8af3-664ca14ea21e','408b7cd5-e9de-46e2-a4c8-c5c15a6b989b','27c2f355-a8ba-401e-b914-c7245caf905c']
    
    if(userId&&skipUsers.includes(userId))
    {
      return; 
    }
    if(userId)
    if (!userId) throw new Error('Unable to determine customer ID');
     const client = await DB.excu.client();
    // Actual balance logic 
    const query = { 
      text: `--sql
              WITH c AS (
                SELECT id AS customer_id, "companyId" AS company_id
                FROM "Customers"
                WHERE id =$1
               ),

              "invoice_totals" AS (   
                SELECT i.id AS invoice_id,
                      i."customerId" AS customer_id,
                      i.total
                FROM "Invoices" i
                JOIN c ON  true
                WHERE i."companyId" = c.company_id
				 and i."customerId" = c."customer_id" 
				 and i."status" <> 'Draft'
              ), "credit_totals" AS (
                SELECT cn."invoiceId" AS invoice_id,
                     sum(cn.total::text::numeric) as "total"
                FROM "CreditNotes" cn
                JOIN c ON  true
                WHERE cn."companyId" = c.company_id and cn."invoiceId" IN (SELECT invoice_id FROM invoice_totals)
                GROUP BY cn."invoiceId"
              ) ,
              payment_totals AS (
                SELECT ipl."invoiceId" AS invoice_id,
                      SUM(ipl."amount"::text::numeric) AS total
                FROM "InvoicePayments" ip
				JOIN "InvoicePaymentLines" ipl ON  ip.id = ipl."invoicePaymentId"
				JOIN c ON true
                WHERE ip."companyId" = c.company_id  
				 and  ipl."invoiceId" IN (SELECT invoice_id FROM invoice_totals)
                GROUP BY ipl."invoiceId"
              ),
              applied_credits AS (
                SELECT ac."invoiceId" AS invoice_id,
                      SUM(ac."amount"::text::numeric) AS total
                FROM "AppliedCredits" ac
                WHERE ac."invoiceId" IN (SELECT invoice_id FROM invoice_totals)
                GROUP BY ac."invoiceId"
              ),
              per_invoice_balance AS (
                SELECT it.customer_id,
                      it.invoice_id,
                      (COALESCE(it.total::text::numeric,0)
                        - COALESCE(pt.total::text::numeric,0)
                        - COALESCE(ct.total::text::numeric,0)
                        - COALESCE(ac.total::text::numeric,0)) AS balance
                FROM invoice_totals it
                LEFT JOIN payment_totals pt ON pt.invoice_id = it.invoice_id
                LEFT JOIN credit_totals  ct ON ct.invoice_id = it.invoice_id
                LEFT JOIN applied_credits ac ON ac.invoice_id = it.invoice_id
              ),
              inv_pos_neg AS (
                SELECT customer_id,
                      SUM( balance ) FILTER (WHERE balance > 0)        AS receivables_from_invoices,
                      SUM(-balance) FILTER (WHERE balance < 0)        AS credits_from_invoices
                FROM per_invoice_balance
                GROUP BY customer_id
              ),

              opening_balance AS (
                SELECT c.customer_id,
                      COALESCE(SUM(cob."openingBalance"::numeric),0) AS amount
                FROM c
                JOIN "CustomerOpeningBalance" cob  on cob."customerId" = c.customer_id
				  where    cob."companyId" = c.company_id
                GROUP BY c.customer_id
              ),

              paid_opening_balance AS (
                SELECT c.customer_id,
                      COALESCE(SUM(ipl."amount"::text::numeric),0) AS amount
                FROM c
                JOIN "InvoicePayments" ip
                  ON ip."customerId" = c.customer_id 
                JOIN "InvoicePaymentLines" ipl
                  ON ipl."invoicePaymentId" = ip.id
                WHERE ip."companyId" = c.company_id and ipl."openingBalanceId" IS NOT NULL
                GROUP BY c.customer_id
              ),

              opening_net AS (
                SELECT ob.customer_id,
                      COALESCE(ob.amount::text::numeric,0) - COALESCE(pob.amount::text::numeric,0) AS opening_balance_net
                FROM opening_balance ob
                LEFT JOIN paid_opening_balance pob ON pob.customer_id = ob.customer_id
              ),

              credit_refunds AS (
                SELECT c.customer_id,
                      COALESCE(SUM(cnr.total::text::numeric),0) AS total
                FROM "CreditNotes" cn 
                JOIN c  on true
                JOIN "CreditNoteRefunds" cnr ON cnr."creditNoteId" = cn.id
                WHERE  cn."companyId" = c.company_id
				and cn."invoiceId" IN (SELECT invoice_id FROM invoice_totals)
                GROUP BY c.customer_id
              ),total_Applied_Credit as (
			   select COALESCE(SUM(total::text::numeric),0) AS total from "applied_credits"
			  ),

              unearned_payments AS (
                SELECT c.customer_id,
				  ip.id, 
                   COALESCE( GREATEST(ip."tenderAmount"::text::numeric -   COALESCE(SUM( "InvoicePaymentLines"."amount" ::text::numeric),0::text::numeric),0::text::numeric),0::text::numeric) AS total
                FROM c
                JOIN "InvoicePayments" ip ON  ip."customerId" = c.customer_id
                left join "InvoicePaymentLines" ON "InvoicePaymentLines"."invoicePaymentId" = ip.id
                 where ip."companyId" = c.company_id
				GROUP BY c.customer_id ,ip.id
              ), unearned_revenue AS (
			  select "unearned_payments".customer_id, sum("total"::text::numeric) AS total  from "unearned_payments" group by "unearned_payments".customer_id
			  ),
              finals AS (
                SELECT
                  c.customer_id AS id,
                  COALESCE(inv.receivables_from_invoices,0)
                    + COALESCE(op.opening_balance_net,0)               AS receivables,
                  COALESCE(inv.credits_from_invoices,0)
                    - COALESCE(cr.total,0) - COALESCE(ap.total,0) 
                    + COALESCE(ur.total,0)                             AS credits
                FROM c
                LEFT JOIN inv_pos_neg       inv ON inv.customer_id = c.customer_id
                LEFT JOIN opening_net       op  ON op.customer_id  = c.customer_id
                LEFT JOIN credit_refunds    cr  ON cr.customer_id  = c.customer_id
                LEFT JOIN unearned_revenue  ur  ON ur.customer_id  = c.customer_id
	        			LEFT JOIN total_Applied_Credit   ap  ON true
              )
                     UPDATE "Customers" AS cu
                      SET "accountReceivable" = f.receivables,
                          "availableCredit"   = f.credits
                      FROM finals f
                      WHERE cu.id = f.id;`, 
      values: [userId] 
    };

    try {
 
      await client.query("BEGIN")
      // for (let index = 0; index < users.length; index++) {
        // const userId = users[index];
         query.values = [userId]
        let customer =   await client.query(query.text, query.values);
       if(customer && customer.rows && customer.rows.length>0)
        {
           let customerObj:any = customer.rows[0]
          let companyId = customerObj.companyId;
          const branchIds = await BranchesRepo.getCompanyBranchIds(client, companyId)
          await  SocketCustomerRepo.sendUpdatedCustomer(client,branchIds,customerObj)
        } 
      // }
  
      
       await client.query("COMMIT")
    } catch (err:any) {
      logAndCapture(`[CustomerBalanceQueue.createJob]`, err);
      throw new Error(`Failed to update customer balance: ${err.message}`);
    }finally{
      client.release()
    }
  }
}

export class SupplierBalanceQueue extends BaseBalanceQueue {
  private static instance: SupplierBalanceQueue;

  private constructor() {
    super(`{SupplierBalance_${process.env.NODE_ENV || 'dev'}}`,'supplier');
  }

  static getInstance(): SupplierBalanceQueue {
    if (!this.instance) {
      this.instance = new SupplierBalanceQueue();
    }
    return this.instance;
  }

  async supplierBalance(data: BalanceJobData): Promise<void> {
    let userId = data.userId;

   if (!userId && data.transactionId) {
      const supplier = await this.fetchSupplier(data.dbTable, data.transactionId);
      if (!supplier) throw new Error(`Supplier not found for ${data.transactionId}`);

      userId = supplier.id
    }

    
    

    if (!userId) throw new Error('Unable to determine supplier ID');

    const query = {
      text: `--sql
      WITH s AS (
        SELECT id AS supplier_id, "companyId" AS company_id
        FROM "Suppliers"
        WHERE id =$1
       ),

      bil AS (
        SELECT id
        FROM s
        JOIN  "Billings" b ON b."supplierId" = s.supplier_id 
		 where "b"."companyId" = s.company_id
        and b."status" <> 'Draft'
      ) ,
   
      billing_totals AS (
        SELECT b.id AS billing_id,
              b."supplierId" AS supplier_id,
              COALESCE(b."shipping"::text::numeric,0::text::numeric)::text::numeric
              + COALESCE(sum("BillingLines"."total"::text::numeric),0)  AS total
        FROM s
        JOIN"Billings" b  ON  "b"."companyId" = s.company_id and  b."supplierId" = s.supplier_id 
		inner join "BillingLines" on "BillingLines"."billingId" = b.id
        where b."status" <> 'Draft'
		  group by  b.id
      ),

      credit_totals AS (
        SELECT sc."billingId" AS billing_id,
              SUM(
                COALESCE(sc."shipping"::text::numeric,0::text::numeric)::text::numeric
                + COALESCE((
                    SELECT SUM(scl."total"::text::numeric)
                    FROM "SupplierCreditLines" scl
                      where scl."supplierCreditId" = sc.id
                  ),0)
              ) AS total
        FROM "SupplierCredits" sc
        WHERE sc."billingId" IN (SELECT id FROM bil)
        GROUP BY sc."billingId"
      ),

      payment_totals AS (
        SELECT bpl."billingId" AS billing_id,
              SUM(bpl."amount"::text::numeric) AS total
        FROM "BillingPaymentLines" bpl
        JOIN "BillingPayments" bp ON bp.id = bpl."billingPaymentId"
        JOIN s ON bp."companyId" = s.company_id AND bp."supplierId" = s.supplier_id
        WHERE bpl."billingId" IN (SELECT id FROM bil)
        GROUP BY bpl."billingId"
      ),

      applied_credits AS (
        SELECT sac."billingId" AS billing_id,
              SUM(sac."amount"::text::numeric) AS total
        FROM "SupplierAppliedCredits" sac
        WHERE sac."billingId" IN (SELECT id FROM bil)
        GROUP BY sac."billingId"
      ),

      per_billing_balance AS (
        SELECT bt.supplier_id,
              bt.billing_id,
              (COALESCE(bt.total,0)
                - COALESCE(pt.total,0)
                - COALESCE(ct.total,0)
                - COALESCE(ac.total,0)) AS balance
        FROM billing_totals bt
        LEFT JOIN payment_totals pt ON pt.billing_id = bt.billing_id
        LEFT JOIN credit_totals  ct ON ct.billing_id = bt.billing_id
        LEFT JOIN applied_credits ac ON ac.billing_id = bt.billing_id
      ),

      bil_pos_neg AS (
        SELECT supplier_id,
              SUM(balance) FILTER (WHERE balance > 0) AS payables_from_billings,
              SUM(-balance) FILTER (WHERE balance < 0) AS credits_from_billings
        FROM per_billing_balance
        GROUP BY supplier_id
      ),

      opening_balance AS (
        SELECT s.supplier_id,
              COALESCE(SUM(sob."openingBalance"::text::numeric),0) AS amount
        FROM s
        JOIN "SupplierOpeningBalance" sob
          ON sob."companyId" = s.company_id AND sob."supplierId" = s.supplier_id
        GROUP BY s.supplier_id
      ),

      paid_opening_balance AS (
        SELECT s.supplier_id,
              COALESCE(SUM(bpl."amount"::text::numeric),0) AS amount
        FROM s
        JOIN "BillingPayments" bp
          ON bp."supplierId" = s.supplier_id AND bp."companyId" = s.company_id
        JOIN "BillingPaymentLines" bpl
          ON bpl."billingPaymentId" = bp.id
        WHERE bpl."openingBalanceId" IS NOT NULL
        GROUP BY s.supplier_id
      ),

      opening_net AS (
        SELECT ob.supplier_id,
              COALESCE(ob.amount,0) - COALESCE(pob.amount,0) AS opening_balance_net
        FROM opening_balance ob
        LEFT JOIN paid_opening_balance pob ON pob.supplier_id = ob.supplier_id
      ),

      credit_refunds AS (
        SELECT s.supplier_id,
              COALESCE(SUM(sr.total::text::numeric),0) AS total
        FROM s
        JOIN "SupplierCredits" sc ON sc."supplierId" = s.supplier_id
        JOIN "SupplierRefunds" sr ON sr."supplierCreditId" = sc.id
        WHERE sc."billingId" IN (SELECT id FROM bil)
        GROUP BY s.supplier_id
      ),unearned_payment as(
	  select s.supplier_id ,  bp.id,  COALESCE(GREATEST(bp."tenderAmount"::text::numeric - COALESCE(sum("BillingPaymentLines"."amount"::text::numeric), 0)),0) as "total"  FROM s
	  JOIN "BillingPayments" bp ON bp."companyId" = s.company_id AND bp."supplierId" = s.supplier_id  
	  LEFT JOIN "BillingPaymentLines" on "BillingPaymentLines"."billingPaymentId" = bp.id
		  group by  s.supplier_id , bp.id
	  ),

      unearned_revenue AS (
        select supplier_id , sum("total"::text::numeric)  as "total" from "unearned_payment" group by  supplier_id
      ), total_applied_credits as (
	  select sum ("total"::text::numeric)  as "total" from "applied_credits"
	  ),

      finals AS (
        SELECT
          s.supplier_id AS id,
          COALESCE(bilpn.payables_from_billings,0)
            + COALESCE(op.opening_balance_net,0) AS payables,
          COALESCE(bilpn.credits_from_billings,0)
            - COALESCE(cr.total,0)
            + COALESCE(ur.total,0) - COALESCE(tapc."total",0) AS credits
        FROM s
        LEFT JOIN bil_pos_neg       bilpn ON bilpn.supplier_id = s.supplier_id
        LEFT JOIN opening_net       op    ON op.supplier_id    = s.supplier_id
        LEFT JOIN credit_refunds    cr    ON cr.supplier_id    = s.supplier_id
        LEFT JOIN unearned_revenue  ur    ON ur.supplier_id    = s.supplier_id
        LEFT JOIN total_applied_credits tapc on true 
      )
      UPDATE "Suppliers" AS sup
                            SET "outStandingPayable" = f.payables,
                                "availableCredit"   = f.credits
                            FROM finals f
                            WHERE sup.id = f.id
              
      `,
      values: [userId]
    };

    try {
      await DB.excu.query(query.text, query.values);
    } catch (err:any) {
      logAndCapture(`[SupplierBalanceQueue.createJob]`, err);
      throw new Error(`Failed to update supplier balance: ${err.message}`);
    }
  }
}


function createWorker(label: string, queueName: string, handler: (job: Job<BalanceJobData>) => Promise<void>): Worker<BalanceJobData> {
  const worker = new Worker<BalanceJobData>(
    queueName,
    async (job) => {
      try {
        await handler(job);
        console.log(`✅ [${label}] Completed job ${job.id}`);
      } catch (err: any) {
        console.error(`❌ [${label}] Job ${job.id} failed: ${err.message}`);
   
        throw err;
      }
    },
     { concurrency: 1, lockDuration: 60000, connection: queueRedisConnection.get() }
    
  );

  worker.on('failed', (job, err) =>
    console.error(`❌ [${label}] Job ${job?.id} failed: ${err.message}`)
  );

  worker.on('stalled', (jobId) =>
    console.warn(`⚠️ [${label}] Job stalled: ${jobId}`)
  );

  worker.on('error', (err) =>
    console.error(`🚨 [${label}] Worker error: ${err.message}`)
  );

  return worker;
}

// Initialize queues
const customerQueue = CustomerBalanceQueue.getInstance();
const supplierQueue = SupplierBalanceQueue.getInstance();

// Customer Queue Workers
const customerWorker = createWorker('CustomerWorker', customerQueue.queueName, async (job) => {
  try {
      await customerQueue.customerBalance(job.data);
            return;
  } catch (error:any) {
   
        throw error.message;
  }

});

// Supplier queue workers

const supplierWorker = createWorker('SupplierWorker',supplierQueue.queueName, async (job) => {
    try {
  await supplierQueue.supplierBalance(job.data);
        return;
   } catch (error:any) {

          throw error.message;
  }
});







// // import Queue from 'bee-queue'
// import { Queue, Worker } from 'bullmq'
// import ioredis from 'ioredis';
// import { ResponseData } from '@src/models/ResponseData';
// 
// import { DB } from '@src/dbconnection/dbconnection';

// let instance: UserBalancesQueue;
// let url: any = process.env.QUEUE_REDIS_CLIENT_URL;
// const connection = new ioredis(url, {
//     maxRetriesPerRequest: null,

//     retryStrategy: function (times) {
//         return Math.max(Math.min(Math.exp(times), 20000), 1000)
//     },
// })

// export class UserBalancesQueue {
//     queue?: Queue;

//     redisUrl?: string = process.env.QUEUE_REDIS_CLIENT_URL

//     constructor() {
//         if (this.redisUrl) {


//             try {
//                 if (connection)

//                     this.queue = new Queue(`{UserBalances_${process.env.NODE_ENV}}`, {
//                         connection,

//                     },)

//             } catch (error) {
//                 console.log("errrr", error)
//             }
//         }

//     }


//     public static getInstance() {
//         if (!instance) {
//             instance = new UserBalancesQueue();
//         }
//         return instance;
//     }
//     public async getUser(dbTable: string, userType: string, id: string) {
//         try {

//             /** THE FOLLOWING FUNCTION WILL RETURN THE USER INFO NAME , ID BASE ON TABLE 
//              * WHY SAVING THE USER IN JournalRecords ? -> OTHER WISE WE WILL NEED TO JOIN EVEREY JOURNAL WITH THE USER TABLE [CUSTOMER,SUPPLIER]
//              * WHY SAVING THE USER IN JournalRecords ? -> OTHER WISE WE WILL NEED TO JOIN EVEREY JOURNAL WITH THE USER TABLE [CUSTOMER,SUPPLIER]
//              * IN ORDER TO GET THE NAME AND ID OF THE USER IN REPORTS AND ACCOUNT JOURNALS 
//              * 
//              * USER TYPE -> IS SAVED FOR THE FRONT TO DIFFERENTIATE BETWEEN CUSTOMER AND SUPPLIER ON REDIRECTING USER    
//              */
//             let joinTable = userType == 'Customer' ? 'Customers' : 'Suppliers';
//             let joinColumn = '';
//             let joinQuery = '';
//             let userData = {
//                 id: "",
//                 name: ""
//             }
//             if (dbTable != userType) {
//                 joinColumn = userType == "Customer" ? "customerId" : "supplierId";
//                 joinQuery = `JOIN "${joinTable}" ON "${dbTable}"."${joinColumn}" = "${joinTable}"."id"`;
//                 if (dbTable == 'CreditNotes') {
//                     joinQuery = `JOIN "Invoices" ON "Invoices".id = "CreditNotes"."invoiceId"
//                                JOIN "${joinTable}" ON "${joinTable}"."id" = "Invoices"."customerId" `
//                 } else if (dbTable == 'AppliedCredits') {
//                     joinQuery = `JOIN "Invoices" ON "Invoices".id = "AppliedCredits"."invoiceId"
//                                JOIN "${joinTable}" ON "${joinTable}"."id" = "Invoices"."customerId" `
//                 } else if (dbTable == 'CreditNoteRefunds') {
//                     joinQuery = `JOIN "CreditNotes" ON "CreditNotes".id = "CreditNoteRefunds"."creditNoteId"
//                                JOIN "Invoices" ON "Invoices".id = "CreditNotes"."invoiceId"
//                                JOIN "${joinTable}" ON "${joinTable}"."id" = "Invoices"."customerId" `
//                 } else if (dbTable == 'SupplierAppliedCredits') {
//                     joinQuery = `
                               
//                                JOIN "Billings" ON "Billings".id = "SupplierAppliedCredits"."billingId"
//                                JOIN "${joinTable}" ON "${joinTable}"."id" = "Billings"."supplierId" `
//                 }
//                 else if (dbTable == 'SupplierRefunds') {
//                     joinQuery = `JOIN "SupplierCredits" ON "SupplierCredits".id = "SupplierRefunds"."supplierCreditId"
//                                JOIN "Billings" ON "Billings".id = "SupplierCredits"."billingId"
//                                JOIN "${joinTable}" ON "${joinTable}"."id" = "Billings"."supplierId" `
//                 } else if (dbTable == 'SupplierRefunds') {
//                     joinQuery = `JOIN "SupplierCredits" ON "SupplierCredits".id = "SupplierRefunds"."supplierCreditId"
//                                JOIN "Billings" ON "Billings".id = "SupplierCredits"."billingId"
//                                JOIN "${joinTable}" ON "${joinTable}"."id" = "Billings"."supplierId" `
//                 }
//             }
//             let selectQuery = `SELECT "${joinTable}"."id",
//                                         "${joinTable}"."name"
//                                  from "${dbTable}"
//                                  ${joinQuery}
//                                  where "${dbTable}"."id" = $1 
//                                  `

//             let user = await DB.excu.query(selectQuery, [id]);
//             let usertemp = user.rows && user.rows.length > 0 ? user.rows[0] : null

//             userData.id = usertemp ? usertemp.id : "";
//             userData.name = usertemp ? usertemp.name : "";


//             return usertemp != null ? userData : null
//         } catch (error: any) {
//             );

//             throw new Error(error)
//         }
//     }


//     public async createJob(data: any) {
//         try {
//             /**Note: backoff : is to allow the process of other jobs in case the the current job fails 
//              * 
//              * types :
//              * Fixed : is to allow retries after fixed amount of time 
//              * Exponential : allow retries by multiplcation of 2  first time 5 second 10 .....
//              * Exponential with Jitter : random amount of "jitter" is added to the delay. This helps prevent all retries from happening at the same time
//              * Random : the delay between retries is a random amount of time within a specified range
//              */

//             if (this.queue) {
//                 let key;
//                 let dbTable = data.dbTable;
//                 let userType = data.userType;
//                 let transactionId = data.transactionId;
//                 let userData
//                 if (!data.userId) {
//                     userData = await this.getUser(dbTable, userType, transactionId);
//                     if (!userData) {
//                         return
//                     }
//                     userData = {
//                         "userType": userType,
//                         "userId": userData.id
//                     }

//                 } else {
//                     userData = {
//                         "userType": userType,
//                         "userId": data.userId
//                     }
//                 }


//                 key = `${userData.userType}:${userData.userId}`;
//                 const existing = await this.queue.getJob(`${key}`);

//                 if (!existing) {
//                     await this.queue.add(`UserBalance:${key}`, userData, {
//                         jobId: `${key}`,
//                         removeOnComplete: true,
//                         priority: 2,
//                         attempts: 5, backoff: {
//                             type: 'exponential',
//                             delay: 5 * 60 * 1000 // 5 minutes in milliseconds
//                             //delay: 3000
//                         },

//                     });

//                     return;
//                 }


//                 // this.queue.addBulk()
//             }

//         } catch (error: any) {
//             throw new Error(error)
//         }
//     }
//     public async getFailed() {
//         try {
//             let faileds = await this.queue?.getJobs(['failed', 'delayed', 'paused']);
//             let faildJobs: any[] = [];
//             let counts = await this.queue?.getFailedCount()
//             if (faileds && faileds.length > 0) {
//                 for (let index = 0; index < faileds.length; index++) {
//                     const element = faileds[index];
//                     let faild = {
//                         data: element.data,
//                         attemptsMade: element.attemptsMade,
//                         failedReason: element.failedReason,
//                         attempts: element.opts.attempts,
//                         status: await element.getState()
//                     }

//                     await element.retry();
//                     //  await element.remove();
//                     faildJobs.push(faild)
//                     // if(this.queue)
//                     //   {
//                     //     this.queue.add(`Jornal:${Date.now()}`,element.data, {
//                     //       removeOnComplete: true,
//                     //       attempts: 5, backoff: {
//                     //         type: 'exponential',
//                     //         delay: 5 * 60 * 1000 // 5 minutes in milliseconds
//                     //       },
//                     //     })
//                     //   } 

//                 }

//             }

//             return new ResponseData(true, "", { jobs: faildJobs, counts: counts })
//         } catch (error: any) {
//             throw new Error(error)
//         }
//     }

//     public static async customerBalance(data: any) {
//         try {
//             const query = {
//                 text: `
//              with "customer" as (select id , "companyId" from "Customers" 
//                    where id = $1
//                    )  
//                         , "openingBalance" as (
//                    select "customer".id,
//                             COALESCE( sum("CustomerOpeningBalance"."openingBalance"),0) as "amount" 
    	
//                         from "customer"
                        
//                         join "Companies" on "Companies".id = "customer"."companyId"
//                         join "CustomerOpeningBalance" on "customer".id = "CustomerOpeningBalance"."customerId"  
//                             join "Branches" on "Branches"."id" = "CustomerOpeningBalance"."branchId"                            
//                         group by "customer".id
                      
//                    )
//                      , "paidOpeningBalance" as (
//                    select "customer".id,
//                               COALESCE(sum("InvoicePaymentLines"."amount"::text::numeric),0) as "amount"
//                         from "customer"
                        
//                         inner join "InvoicePayments" on "InvoicePayments"."customerId" = "customer".id
//                         inner join "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId"  = "InvoicePayments".id
//                         join "Branches" on "Branches"."id" = "InvoicePayments"."branchId"
                  
//                              where "openingBalanceId" is not null 
                        	
//                         group by "customer".id
//                          ),"openingBalanceTotal" as ( select"customer".id as "customerId",
//                                COALESCE( "openingBalance"."amount" ::text::numeric,0) -    COALESCE("paidOpeningBalance"."amount",0 ) as "openingBalance"
//                         from "customer"
                        
//                         left join "openingBalance" on "customer".id = "openingBalance".id
//                         left join "paidOpeningBalance" on "customer".id = "paidOpeningBalance".id
                    	
                    	
//                         )
                    	
                	

//                     , "invoiceLines" as (
//                     select "invoiceId", "customerId",
//                            sum("InvoiceLines"."total"::text::numeric) as total
//                     from "InvoiceLines"
             
//                     inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" and "customerId" is not null
//                     inner join "customer" on "customer".id = "Invoices"."customerId"
//                     inner join "Branches" on "Invoices"."branchId" = "Branches".id
//                     where "InvoiceLines"."companyId" = "customer"."companyId"  
                     
//                            and ("Invoices"."status" <> 'Draft') 
//                     group by "invoiceId", "customerId"
//                     )
//                     ,"invoiceCharges" as (
//                     select "Invoices".id as "invoiceId", "customerId",
//                            COALESCE("Invoices"."chargeTotal",0)::text::numeric + COALESCE("Invoices"."deliveryCharge",0)::text::numeric as total
//                     from "Invoices"
                    
//                     inner join "Branches" on "Invoices"."branchId" = "Branches".id
//                     inner join "customer" on "customer".id = "Invoices"."customerId"
//                     where "Invoices"."companyId" = "customer"."companyId"  
                          
//                            and ("Invoices"."status" <> 'Draft')
//                     )
//                     ,"invoiceTotal" as (
//                     select "invoiceCharges"."customerId", "invoiceCharges"."invoiceId",
//                             "invoiceCharges".total + COALESCE("invoiceLines"."total",0) as total
//                     from "invoiceCharges"
//                     left join "invoiceLines" on "invoiceCharges"."invoiceId" = "invoiceLines"."invoiceId"
//                     )
                	
            	
//                     , "creditLines" as (
//                     select "invoiceId", "customerId",
//                            sum("CreditNoteLines"."total"::text::numeric) as total
//                     from "CreditNoteLines"
                    
//                     inner join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId" 
//                     inner join "Invoices" on "Invoices".id = "invoiceId" 
//                     inner join "Branches" on "CreditNotes"."branchId" = "Branches".id
//                     inner join "customer" on "customer".id = "Invoices"."customerId"
//                     where "CreditNoteLines"."companyId" = "customer"."companyId"  
                  
//                     group by "invoiceId", "customerId"
//                     )
//                     ,"creditCharges" as (
//                     select "invoiceId", "customerId",
//                            COALESCE("CreditNotes"."chargeTotal",0)::text::numeric + COALESCE("CreditNotes"."deliveryCharge",0)::text::numeric as total
//                     from "CreditNotes"
                    
//                     inner join "Invoices" on "Invoices".id = "invoiceId" 
//                     inner join "Branches" on "CreditNotes"."branchId" = "Branches".id
//                     inner join "customer" on "customer".id = "Invoices"."customerId"
//                     where "Branches"."companyId" = "customer"."companyId"  
                     
//                     )
//                     ,"creditTotal" as (
//                     select "creditCharges"."customerId","creditCharges"."invoiceId",
//                             "creditCharges".total + COALESCE("creditLines"."total",0) as total
//                     from "creditCharges"
//                     left join "creditLines" on "creditCharges"."invoiceId" = "creditLines"."invoiceId"
//                     )
//                     ,"paymentTotal" as (
//                     select "invoiceId" , "Invoices"."customerId", sum("InvoicePaymentLines".amount::text::numeric) as total
//                     from "InvoicePaymentLines" 
                    
//                     inner join "InvoicePayments" on "InvoicePayments".id = "invoicePaymentId"
//                     inner join "Invoices" on "Invoices".id = "InvoicePaymentLines"."invoiceId" 
//                     inner join "customer" on "customer".id = "Invoices"."customerId"
//                     inner join "Branches" on "InvoicePayments"."branchId" = "Branches".id
//                     where "Branches"."companyId" = "customer"."companyId"  
                     
                    
//                     group by "Invoices"."customerId", "invoiceId"	
//                     ) 
//                     ,"appliedCredit" as (
//                     select "invoiceId" , "Invoices"."customerId", sum("AppliedCredits".amount::text::numeric) as total 
//                     from "AppliedCredits" 
                    
//                     inner join "Invoices" on "AppliedCredits"."invoiceId" = "Invoices"."id"
//                     inner join "customer" on "customer".id = "Invoices"."customerId"
//                     inner join "Branches" on "Invoices"."branchId" = "Branches".id
//                     where "Branches"."companyId" = "customer"."companyId"  
                      
//                     group by "Invoices"."customerId", "invoiceId"	
//                     )
//                     ,"Total" as (
//                     select "invoiceTotal"."customerId", "invoiceTotal"."invoiceId",
//                         (COALESCE("invoiceTotal".total,0) - COALESCE("paymentTotal".total,0) - ( COALESCE("creditTotal".total,0) + COALESCE("appliedCredit".total,0))) as total
//                     from "invoiceTotal" 
//                     left join "paymentTotal" on "invoiceTotal"."customerId" = "paymentTotal"."customerId" and  "invoiceTotal"."invoiceId" = "paymentTotal"."invoiceId"
//                     left join "creditTotal"  on "invoiceTotal"."customerId" = "creditTotal"."customerId" and  "invoiceTotal"."invoiceId" = "creditTotal"."invoiceId"
//                     left join "appliedCredit"  on "invoiceTotal"."customerId" = "appliedCredit"."customerId" and  "invoiceTotal"."invoiceId" = "appliedCredit"."invoiceId"
//                     )
            	
//                     ,"refunds" as (
//                     select "Invoices"."customerId",
//                             sum(COALESCE("CreditNoteRefunds".total,0)::text::numeric) as total
//                     from "CreditNoteRefunds"
//                     inner join "CreditNotes" on "CreditNoteRefunds"."creditNoteId" = "CreditNotes".id
//                     inner join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId" 
//                     inner join "customer" on "customer".id = "Invoices"."customerId"
//                     group by  "Invoices"."customerId"
//                     )
//                     ,"unearendRevenue" as (
//                     select 
//                         "InvoicePayments"."customerId",
//                         "InvoicePayments"."tenderAmount" - sum(COALESCE("InvoicePaymentLines".amount,0))as total
//                         from "InvoicePayments"
//                     inner join "customer" on "customer".id = "InvoicePayments"."customerId" 
//                     left join "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id 
//                     group by "InvoicePayments".id 
//                     having "InvoicePayments"."tenderAmount" - sum(COALESCE("InvoicePaymentLines".amount,0))>0
//                     )
//                     ,"totalRevenue" as (
//                         select 
//                         "customerId",
//                         sum(COALESCE(total,0))as total
//                         from "unearendRevenue"
//                         group by "customerId"
//                     ) 
//                     ,"tt" as(	select "customerId", sum(case when "Total"."total" > 0 then "Total"."total"  end) as t1 , 
//                     abs(sum(case when "Total"."total" < 0 then "Total"."total"  end)) as t2
//                     from "Total"
//                     group by "customerId"
//                       )
	
//                     ,"invoiceBalanceAndCredits" as (
//                     select "customer".id, 
//                             COALESCE(tt.t1,0) + COALESCE("openingBalance" ,0) as "receivables",
//                             COALESCE(tt.t2,0) - COALESCE("refunds"."total" ,0) + COALESCE("totalRevenue"."total" ,0)  as "credits"
//                     from "customer"
//                     left join "openingBalanceTotal" on "customer".id ="openingBalanceTotal"."customerId"
//                     left join "tt" on "customer".id = "tt"."customerId"
//                     left join "refunds" on "customer".id = "refunds"."customerId"
//                     left join "totalRevenue" on "customer".id ="totalRevenue"."customerId" 
           
//                     )
//                     update "Customers"  set "accountReceivable" =  t."receivables"  , "availableCredit" = t."credits" from (select * from "invoiceBalanceAndCredits" )t
// 					where "Customers".id = t.id `,
//                 values: [data.userId]
//             }
//             await DB.excu.query(query.text, query.values);
//         } catch (error: any) {
//             throw new Error(error)
//         }
//     }

// }

// const worker = new Worker(
//     `{UserBalances_${process.env.NODE_ENV}}`,
//     async (job) => {

//         let jobs: any[] = [];
//         if (Array.isArray(job.data)) {
//             jobs = job.data
//         } else {
//             jobs = [job.data]
//         }
//         try {

//             for (let index = 0; index < jobs.length; index++) {
//                 const element = jobs[index];
//                 if (element.userType == 'Customer') {
//                     await UserBalancesQueue.customerBalance(element);
//                 } else if (element.userType == 'Supplier') {
//                     // await UserBalancesQueue.supplierBalance(element);
//                 } else {
//                     console.log("Unknown user type", element.userType)
//                 }
//             }


//             return;
//         } catch (error: any) {

//             throw error;
//         }
//     },
//     { concurrency: 3, lockDuration: 60000, connection: connection }
// );

// worker.on("error", (err) => {
//     // Log your error.
//     console.log(err)
//     );

// })


// worker.on('stalled', async (jobId) => {
//     const queue = UserBalancesQueue.getInstance();
//     const job = await queue.queue?.getJob(jobId)
//     if (job && jobId) {
//         console.log("stalled Job", job.data)

//         // try {
//         //   //  setTimeout()
//         // } catch (error) {
//         //   await job.moveToFailed(new Error('Processing failed due to an error'),jobId,true)
//         // }

//     }


// });


// worker.on('failed', async (job: any, err) => {
//     console.log(`Job failed: ${job}`);
//     console.log(job.data)
//     console.error(`Error: ${err.message}`);
// });

// /**with "customer" as (select id , "companyId" from "Customers" 
//                    where id = '53082253-3f9f-40f4-accd-8c9dfbfe38fb'
//                    )  
//                         , "openingBalance" as (
//                    select "customer".id,
//                             COALESCE( sum("CustomerOpeningBalance"."openingBalance"),0) as "amount" 
    	
//                         from "customer"
                        
//                         join "Companies" on "Companies".id = "customer"."companyId"
//                         join "CustomerOpeningBalance" on "customer".id = "CustomerOpeningBalance"."customerId"  
//                             join "Branches" on "Branches"."id" = "CustomerOpeningBalance"."branchId"                            
//                         group by "customer".id
                      
//                    )
//                      , "paidOpeningBalance" as (
//                    select "customer".id,
//                               COALESCE(sum("InvoicePaymentLines"."amount"::text::numeric),0) as "amount"
//                         from "customer"
                        
//                         inner join "InvoicePayments" on "InvoicePayments"."customerId" = "customer".id
//                         inner join "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId"  = "InvoicePayments".id
//                         join "Branches" on "Branches"."id" = "InvoicePayments"."branchId"
                  
//                              where "openingBalanceId" is not null 
                        	
//                         group by "customer".id
//                          ),"openingBalanceTotal" as ( select"customer".id as "customerId",
//                                COALESCE( "openingBalance"."amount" ::text::numeric,0) -    COALESCE("paidOpeningBalance"."amount",0 ) as "openingBalance"
//                         from "customer"
                        
//                         left join "openingBalance" on "customer".id = "openingBalance".id
//                         left join "paidOpeningBalance" on "customer".id = "paidOpeningBalance".id
                    	
                    	
//                         )
                    	
                	

//                     , "invoiceLines" as (
//                     select "invoiceId", "customerId",
//                            sum("InvoiceLines"."total"::text::numeric) as total
//                     from "InvoiceLines"
             
//                     inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" and "customerId" is not null
//                     inner join "customer" on "customer".id = "Invoices"."customerId"
//                     inner join "Branches" on "Invoices"."branchId" = "Branches".id
//                     where "InvoiceLines"."companyId" = "customer"."companyId"  
                     
//                            and ("Invoices"."status" <> 'Draft') 
//                     group by "invoiceId", "customerId"
//                     )
//                     ,"invoiceCharges" as (
//                     select "Invoices".id as "invoiceId", "customerId",
//                            COALESCE("Invoices"."chargeTotal",0)::text::numeric + COALESCE("Invoices"."deliveryCharge",0)::text::numeric as total
//                     from "Invoices"
                    
//                     inner join "Branches" on "Invoices"."branchId" = "Branches".id
//                     inner join "customer" on "customer".id = "Invoices"."customerId"
//                     where "Invoices"."companyId" = "customer"."companyId"  
                          
//                            and ("Invoices"."status" <> 'Draft')
//                     )
//                     ,"invoiceTotal" as (
//                     select "invoiceCharges"."customerId", "invoiceCharges"."invoiceId",
//                             "invoiceCharges".total + COALESCE("invoiceLines"."total",0) as total
//                     from "invoiceCharges"
//                     left join "invoiceLines" on "invoiceCharges"."invoiceId" = "invoiceLines"."invoiceId"
//                     )
                	
            	
//                     , "creditLines" as (
//                     select "invoiceId", "customerId",
//                            sum("CreditNoteLines"."total"::text::numeric) as total
//                     from "CreditNoteLines"
                    
//                     inner join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId" 
//                     inner join "Invoices" on "Invoices".id = "invoiceId" 
//                     inner join "Branches" on "CreditNotes"."branchId" = "Branches".id
//                     inner join "customer" on "customer".id = "Invoices"."customerId"
//                     where "CreditNoteLines"."companyId" = "customer"."companyId"  
                  
//                     group by "invoiceId", "customerId"
//                     )
//                     ,"creditCharges" as (
//                     select "invoiceId", "customerId",
//                            COALESCE("CreditNotes"."chargeTotal",0)::text::numeric + COALESCE("CreditNotes"."deliveryCharge",0)::text::numeric as total
//                     from "CreditNotes"
                    
//                     inner join "Invoices" on "Invoices".id = "invoiceId" 
//                     inner join "Branches" on "CreditNotes"."branchId" = "Branches".id
//                     inner join "customer" on "customer".id = "Invoices"."customerId"
//                     where "Branches"."companyId" = "customer"."companyId"  
                     
//                     )
//                     ,"creditTotal" as (
//                     select "creditCharges"."customerId","creditCharges"."invoiceId",
//                             "creditCharges".total + COALESCE("creditLines"."total",0) as total
//                     from "creditCharges"
//                     left join "creditLines" on "creditCharges"."invoiceId" = "creditLines"."invoiceId"
//                     )
//                     ,"paymentTotal" as (
//                     select "invoiceId" , "Invoices"."customerId", sum("InvoicePaymentLines".amount::text::numeric) as total
//                     from "InvoicePaymentLines" 
                    
//                     inner join "InvoicePayments" on "InvoicePayments".id = "invoicePaymentId"
//                     inner join "Invoices" on "Invoices".id = "InvoicePaymentLines"."invoiceId" 
//                     inner join "customer" on "customer".id = "Invoices"."customerId"
//                     inner join "Branches" on "InvoicePayments"."branchId" = "Branches".id
//                     where "Branches"."companyId" = "customer"."companyId"  
                     
                    
//                     group by "Invoices"."customerId", "invoiceId"	
//                     ) 
//                     ,"appliedCredit" as (
//                     select "invoiceId" , "Invoices"."customerId", sum("AppliedCredits".amount::text::numeric) as total 
//                     from "AppliedCredits" 
                    
//                     inner join "Invoices" on "AppliedCredits"."invoiceId" = "Invoices"."id"
//                     inner join "customer" on "customer".id = "Invoices"."customerId"
//                     inner join "Branches" on "Invoices"."branchId" = "Branches".id
//                     where "Branches"."companyId" = "customer"."companyId"  
                      
//                     group by "Invoices"."customerId", "invoiceId"	
//                     )
//                     ,"Total" as (
//                     select "invoiceTotal"."customerId", "invoiceTotal"."invoiceId",
//                         (COALESCE("invoiceTotal".total,0) - COALESCE("paymentTotal".total,0) - ( COALESCE("creditTotal".total,0) + COALESCE("appliedCredit".total,0))) as total
//                     from "invoiceTotal" 
//                     left join "paymentTotal" on "invoiceTotal"."customerId" = "paymentTotal"."customerId" and  "invoiceTotal"."invoiceId" = "paymentTotal"."invoiceId"
//                     left join "creditTotal"  on "invoiceTotal"."customerId" = "creditTotal"."customerId" and  "invoiceTotal"."invoiceId" = "creditTotal"."invoiceId"
//                     left join "appliedCredit"  on "invoiceTotal"."customerId" = "appliedCredit"."customerId" and  "invoiceTotal"."invoiceId" = "appliedCredit"."invoiceId"
//                     )
            	
//                     ,"refunds" as (
//                     select "Invoices"."customerId",
//                             sum(COALESCE("CreditNoteRefunds".total,0)::text::numeric) as total
//                     from "CreditNoteRefunds"
//                     inner join "CreditNotes" on "CreditNoteRefunds"."creditNoteId" = "CreditNotes".id
//                     inner join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId" 
//                     inner join "customer" on "customer".id = "Invoices"."customerId"
//                     group by  "Invoices"."customerId"
//                     )
//                     ,"unearendRevenue" as (
//                     select 
//                         "InvoicePayments"."customerId",
//                         "InvoicePayments"."tenderAmount" - sum(COALESCE("InvoicePaymentLines".amount,0))as total
//                         from "InvoicePayments"
//                     inner join "customer" on "customer".id = "InvoicePayments"."customerId" 
//                     left join "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id 
//                     group by "InvoicePayments".id 
//                     having "InvoicePayments"."tenderAmount" - sum(COALESCE("InvoicePaymentLines".amount,0))>0
//                     )
//                     ,"totalRevenue" as (
//                         select 
//                         "customerId",
//                         sum(COALESCE(total,0))as total
//                         from "unearendRevenue"
//                         group by "customerId"
//                     ) 
//                     ,"tt" as(	select "customerId", sum(case when "Total"."total" > 0 then "Total"."total"  end) as t1 , 
//                     abs(sum(case when "Total"."total" < 0 then "Total"."total"  end)) as t2
//                     from "Total"
//                     group by "customerId"
//                       )
	
//                     ,"invoiceBalanceAndCredits" as (
//                     select "customer".id, 
//                             COALESCE(tt.t1,0) + COALESCE("openingBalance" ,0) as "invoiceBalance",
//                             COALESCE(tt.t2,0) - COALESCE("refunds"."total" ,0) + COALESCE("totalRevenue"."total" ,0)  as "availableCredits"
//                     from "customer"
//                     left join "openingBalanceTotal" on "customer".id ="openingBalanceTotal"."customerId"
//                     left join "tt" on "customer".id = "tt"."customerId"
//                     left join "refunds" on "customer".id = "refunds"."customerId"
//                     left join "totalRevenue" on "customer".id ="totalRevenue"."customerId" 
           
//                     )
//                     select  * , COALESCE("invoiceBalance" ,0) - COALESCE("availableCredits" ,0) as "balance"
//                     from "invoiceBalanceAndCredits"
                	
                	
//  */