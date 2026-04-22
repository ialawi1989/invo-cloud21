import { Job, Queue, Worker } from 'bullmq'
import ioredis from 'ioredis';
import { DB } from '@src/dbconnection/dbconnection';
const { Logger } = require('aws-cloudwatch-log')
import { Invoice } from '@src/models/account/Invoice';
import { BranchesRepo } from '@src/repo/admin/branches.repo';
import { InvoiceLine } from '@src/models/account/InvoiceLine';
import { InvoiceLineOption } from '@src/models/account/invoiceLineOption';
import { InvoiceRepo } from '@src/repo/app/accounts/invoice.repo';

import { InvoicePaymentRepo } from '@src/repo/app/accounts/invoicePayment.repo';

import { TaxesRepo } from '@src/repo/app/accounts/taxes.repo';
import { InvoicePayment } from '@src/models/account/InvoicePayment';
import { Customer, CustomerAddress } from '@src/models/account/Customer';
import { CustomerRepo } from '@src/repo/app/accounts/customer.repo';
import { PaymnetMethodRepo } from '@src/repo/app/accounts/paymentMethod.repo';
import { InvoicePaymentLine } from '@src/models/account/InvoicePaymentLine';
import { AccountsRepo } from '@src/repo/app/accounts/account.repo';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { Branches } from '@src/models/admin/Branches';
import { FileStorage } from '@src/utilts/fileStorage';
import { PoolClient } from 'pg';
import { Company } from '@src/models/admin/company';
import { ResponseData } from '@src/models/ResponseData';
import { Lazy } from '@src/utilts/Lazy';
import { queueRedisConnection } from '@src/utilts/QueueRedisConnection';
import { InvoiceStatuesQueue } from '@src/repo/triggers/queue/workers/invoiceStatus.worker';


let instance: GruptechOrderQueue;


export class GruptechOrderQueue {
  queue?: Queue;
  redisUrl?: string = process.env.QUEUE_REDIS_CLIENT_URL

  constructor() {
    // if (this.redisUrl) {
    try {
      if (queueRedisConnection)

        this.queue = new Queue(`{GruptechOrderQueue_${process.env.NODE_ENV}}`, {
          connection: queueRedisConnection.get(),


        },)

    } catch (error) {
      console.log("errrr", error)
    }
    // }

  }

  public static getInstance() {
    if (!instance) {
      instance = new GruptechOrderQueue()
    }
    return instance;
  }
  public async createJob(data: any) {
    try {
      if (this.queue &&
        data &&
        typeof data === 'object' &&
        !Array.isArray(data) &&
        Object.keys(data).length > 0) {
        await this.queue.add(`order_${data.displayId}`, data, {
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


  public static async getBranchByStoreId(client: PoolClient, gruptechstoreid: string) {
    try {
      const query: { text: string, values: any } = {
        text: `select b.* from(     
            select jsonb_array_elements("settings"->'branches')->>'branchId' as  branchId ,jsonb_array_elements("settings"->'branches')->>'storeId' as storeID
            from "Plugins" p 
            where "pluginName" ='GrubTech' 
            ) as s join "Branches" b on s.branchId = b.id::text where storeID = $1`,
        values: [gruptechstoreid],
      };
      const branch = (await client.query(query.text, query.values)).rows;

      const branchObj = new Branches()
      const storage = new FileStorage();
      branchObj.ParseJson(branch[0])
      return branchObj
    } catch (error: any) {
    
      throw new Error(error.message)
    }
  }


  public static async getCompanyById(client: PoolClient, companyId: string) {
    try {

      const query: { text: string, values: any } = {
        text: 'SELECT * FROM "Companies" WHERE id=($1)',
        values: [companyId],
      }

      const company = (await client.query(query.text, query.values)).rows;
      const companyObj = new Company();
      companyObj.ParseJson(company[0])
      const storage = new FileStorage();
      const companySettings = await storage.getCompanySettings(companyObj.country)
      if (companySettings) {
        companyObj.settings = companySettings.settings;
      }
      return new ResponseData(true, "", companyObj)

    } catch (error: any) {
    
      throw new Error(error.message)
    }
  }



  public static async getPluginByName(client: PoolClient, name: string, company: Company) {
    try {
      const companyId = company.id;
      const query: { text: string, values: any } = {
        text: `SELECT * 
                 FROM "Plugins" 
                 WHERE "pluginName" = $1 
                 AND "companyId"= $2`,
        values: [name, companyId]
      }
      const list = await client.query(query.text, query.values);

      return new ResponseData(true, "", list.rows[0])
    } catch (error: any) {
    
      throw new Error(error.message)
    }
  }

  public static async getService(client: PoolClient, serviceId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT "Services".* ,
          "Media".url as "mediaUrl"
          FROM "Services" 
          left join "Media" on "mediaId" = "Media".id  

          WHERE  "Services".id=$1`,
        values: [serviceId]
      }
      const service = await client.query(query.text, query.values)
      var row: any = service.rows[0];


      if (row.branches != null) {
        for (let index = 0; index < row.branches.length; index++) {
          const element = row.branches[index];

        }
      }

      return new ResponseData(true, "", service.rows[0])
    } catch (error: any) {
    
      throw new Error(error.message)
    }
  }


  public static async getDefaultServiceByName(client: PoolClient, companyId: string, name: string) {
    try {

      const query: { text: string, values: any } = {
        text: `SELECT id from "Services" where type = $1 and "default" = true and "companyId"=$2`,
        values: [name, companyId]
      }

      let service = await client.query(query.text, query.values);
      return service.rows && service.rows.length > 0 ? (<any>service.rows[0]).id : null

    } catch (error: any) {
    

      throw new Error(error)
    }
  }

  public async getFailed() {
    try {
      let faileds = await this.queue?.getJobs(['failed', 'delayed', 'paused']);
      let faildJobs: any[] = [];
      // let counts = await this.queue?.getFailedCount()
      // if (faileds && faileds.length > 0) {
      //   for (let index = 0; index < faileds.length; index++) {
      //     const element = faileds[index];
      //     let faild = {
      //       data: element.data,
      //       attemptsMade: element.attemptsMade,
      //       failedReason: element.failedReason,
      //       attempts: element.opts.attempts,
      //       status: await element.getState()
      //     }

      //     await element.retry();
      //     //  await element.remove();
      //     faildJobs.push(faild)
      //     // if(this.queue)
      //     //   {
      //     //     this.queue.add(`Jornal:${Date.now()}`,element.data, {
      //     //       removeOnComplete: true,
      //     //       attempts: 5, backoff: {
      //     //         type: 'exponential',
      //     //         delay: 5 * 60 * 1000 // 5 minutes in milliseconds
      //     //       },
      //     //     })
      //     //   } 

      //   }



      let job = await this.queue?.getJob('119');
      console.log(await job?.getState())
      // return new ResponseData(true, "", { jobs: faildJobs, counts: counts })
    } catch (error: any) {
      throw new Error(error)
    }
  }
}

const worker = new Worker(
  `{GruptechOrderQueue_${process.env.NODE_ENV}}`,

  async (job) => {
    const client = await DB.excu.client(300);
    try {
      // await new Promise((resolve) => setTimeout(resolve, 7000));
      let logger = new Logger({
        logGroupName: 'bezat',
        logStreamName: 'GrupTech',
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        uploadFreq: 10000, 	// Optional. Send logs to AWS LogStream in batches after 10 seconds intervals.
        local: false 		// Optional. If set to true, the log will fall back to the standard 'console.log'.
      });

      let flag = false;
      await client.query("BEGIN")
      const order = job.data;
      logger.log("got an order id: " + order.displayId);
      console.log("got an order id: " + order.displayId);
      let isInvoiceExist = await InvoiceRepo.checkIfGruptechIdExist(client, order.id);

      if (isInvoiceExist) {
        console.log("invoice already existed")
        await client.query("COMMIT")
        return;
      }

      const branch = await GruptechOrderQueue.getBranchByStoreId(client, order.storeId)
      let getcompany = await BranchesRepo.getBranchCompanyId(client, branch.id);
      let companyID = getcompany.compayId;
      let companyResponce = await GruptechOrderQueue.getCompanyById(client, companyID);
      let company = companyResponce.data;

      let plugin = (await GruptechOrderQueue.getPluginByName(client, "GrubTech", company)).data;
      let devider = Math.pow(10, company.settings.afterDecimal);
      let tax = await TaxesRepo.getDefaultTax(client, companyID);
      let taxId = tax.data.id;
      company.afterDecimal = company.settings.afterDecimal;
      let customer = new Customer();
      customer.addresses[0] = new CustomerAddress();
      customer.companyId = company.id;
      const invoice = new Invoice();
      invoice.branchId = branch.id;

      const accountId = (await AccountsRepo.getSalesId(client, invoice.branchId)).id;

      invoice.note = order.instructions;
      invoice.createdAt = order.source.placedAt;
      invoice.source = "Online";
      invoice.guests = 1;
      invoice.onlineStatus = "Placed";
      invoice.onlineData.onlineStatus = "Placed";


      if (invoice.customerContact != "Unknown") {
        invoice.customerContact = order.delivery.receiverMobileNumber;
      }



      if (order.delivery.location.address == "Unknown" || order.delivery.location.address == '"Unknown"') {

        invoice.customerAddress = null;
      } else {

        invoice.customerAddress = new CustomerAddress;
        invoice.customerAddress.title = 'Home'
        invoice.customerAddress.note = order.delivery.location.address;
      }

      if (order.delivery.location.latitude == "Unknown" || order.delivery.location.latitude == '"Unknown"' || order.delivery.location.latitude == 'null' || order.delivery.location.latitude == null) {


        invoice.customerLatLang = ""

      } else {
        invoice.customerLatLang = order.delivery.location.latitude + "," + order.delivery.location.longitude;
      }



      invoice.isInclusiveTax = true;
      if (order.customer.name != "Unknown" && order.customer.name != undefined) {
        customer.name = order.customer.name;
        flag = true
      } else if (order.delivery.receiverName != "Unknown" && order.delivery.receiverName != undefined) {
        customer.name = order.delivery.receiverName;
        flag = true
      }
      if (order.customer.phone != "Unknown" && order.customer.phone != undefined) {
        customer.phone = order.customer.phone;
        flag = true
      } else if (order.delivery.receiverMobileNumber != "Unknown" && order.delivery.receiverMobileNumber != undefined) {
        customer.phone = order.delivery.receiverMobileNumber;
        flag = true
      }
      if (order.customer.email != "Unknown" && order.customer.email != undefined) {
        customer.email = order.customer.email;
      }
      if (flag) {
        customer.id = await CustomerRepo.addEcommerceCustomer(client, "", customer, company)
        invoice.customer.ParseJson(customer);
        invoice.customerId = invoice.customer.id
      }

      if (order.source.channel == "Talabat" && plugin.settings.services.Talabat != undefined && plugin.settings.services.Talabat != "") {


        let service = await GruptechOrderQueue.getService(client, plugin.settings.services.Talabat);

        if (service.success) {
          invoice.serviceId = service.data.id
        } else {
          let serviceId = await GruptechOrderQueue.getDefaultServiceByName(client, company.id, "Delivery");
          invoice.serviceId = serviceId;
        }

      } else if (order.source.channel == "Jahez" && plugin.settings.services.Jahez != undefined && plugin.settings.services.Jahez != "") {
        let service = await GruptechOrderQueue.getService(client, plugin.settings.services.Jahez);
        if (service.success) {
          invoice.serviceId = service.data.id
        } else {
          let serviceId = await GruptechOrderQueue.getDefaultServiceByName(client, company.id, "Delivery");
          invoice.serviceId = serviceId;
        }
      } else if (order.source.channel == "ChatFood" && plugin.settings.services.ChatFood != undefined && plugin.settings.services.ChatFood != "") {
        let service = await GruptechOrderQueue.getService(client, plugin.settings.services.ChatFood);
        if (service.success) {
          invoice.serviceId = service.data.id
        } else {
          let serviceId = await GruptechOrderQueue.getDefaultServiceByName(client, company.id, "Delivery");
          invoice.serviceId = serviceId;
        }
      } else {
        if (order.type == "DELIVERY_BY_RESTAURANT" || order.type == "DELIVERY_BY_FOOD_AGGREGATOR") {

          let serviceId = await GruptechOrderQueue.getDefaultServiceByName(client, company.id, "Delivery");
          invoice.serviceId = serviceId;
        } else {
          let serviceId = await GruptechOrderQueue.getDefaultServiceByName(client, company.id, "PickUp");
          invoice.serviceId = serviceId;
        }

      }

      if (order.type == "DELIVERY_BY_RESTAURANT") {

        invoice.deliveryCharge = order.payment.charges.deliveryFee.amount / devider

      }




      invoice.aggregator = order.source.channel //'Talabat'//order.source.name;
      invoice.aggregatorId = order.displayId;
      invoice.grubTechData = {
        "id": order.id,
        "invoiceNo": order.invoiceNo,
        "displayId": order.displayId,

      };
      order.items.forEach(async (item: any) => {
        let invLine = new InvoiceLine();
        invLine.productId = item.id;
        if (item.name != "Unknown") {
          invLine.productName = item.name;
        }
        invLine.qty = item.quantity;
        invLine.price = (item.price.totalPrice.amount / devider) / item.quantity;

        invLine.taxId = taxId;

        if (item.tax.length > 0) {
          invLine.taxPercentage = item.tax[0].rate;
        } else {
          invLine.taxPercentage = 0;
        }


        // invLine.taxPercentage = item.tax[0].rate;
        // invLine.discountAmount = item.price.discountAmount.amount / devider;
        invLine.note = item.instructions;
        invLine.accountId = accountId;
        // invLine.isInclusiveTax = true
        let option = new InvoiceLineOption();
        item.modifiers.forEach((modifier: any) => {
          option = new InvoiceLineOption();
          option.optionId = modifier.id;
          option.optionName = modifier.name;
          option.qty = modifier.quantity;
          option.price = modifier.price.totalPrice.amount / devider;
          invLine.options.push(option);
        });
        invoice.lines.push(invLine);
      });
      invoice.status = 'Draft'

      let invId = await InvoiceRepo.addInvoice(client, invoice, company);
      if (invId.success && invoice.aggregator != 'ChatFood') {
        let paymentData = await PaymnetMethodRepo.createAggregatorPaymentIfNotExist(client, company.id, invoice.aggregator)

        let invoicePayment = new InvoicePayment();
        invoicePayment.paymentMethodAccountId = paymentData.paymentMethodAccountId;
        invoicePayment.paymentMethodId = paymentData.paymentMethodId;
        invoicePayment.tenderAmount = invId.data.invoice.total
        invoicePayment.paidAmount = invId.data.invoice.total
        let invoiceLine = new InvoicePaymentLine();
        invoiceLine.invoiceId = invId.data.invoice.id;
        invoiceLine.amount = invId.data.invoice.total


        invoicePayment.lines.push(invoiceLine)


        let invoicePaymentSave = await InvoicePaymentRepo.addInvoicePayment(client, invoicePayment, company)

        if (invoicePaymentSave) {
          let queueInstance = TriggerQueue.getInstance();

          queueInstance.createJob({ type: "InvoicePayments", invoiceIds: invoicePaymentSave.data.invoiceIds, id: [invoicePaymentSave.data.id], companyId: company.id })
          // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: invoicePaymentSave.data.invoiceIds })
          if (invoicePaymentSave.data.invoiceIds && invoicePaymentSave.data.invoiceIds.length > 0) {
            invoicePaymentSave.data.invoiceIds.forEach((element: any) => {
              InvoiceStatuesQueue.get().createJob({
                id: element
              } as any);

            });
          }
        }

      }

      // let invoicePayment = new InvoicePayment();
      // invoicePayment.branchId = branch.id;
      // invoicePayment.tenderAmount = order.payment.paymentSettlements.amount.amount
      // invoicePayment.paidAmount = order.payment.paymentSettlements.amount.amount
      // await SocketInvoiceRepo.sendOnlineInvoice(invId.data.invoice);

      logger.log({ "id": order.id, "externalReferenceId": invId.data.invoice.id });
      await client.query("COMMIT")
      return;
    } catch (error: any) {
      await client.query("ROLLBACK")
      console.error('Error processing job:', error);
      throw new Error(error);
    } finally {
      client.release()
    }



  },
  { concurrency: 1, connection: queueRedisConnection.get(), maxStalledCount: 3 }
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
  const queue = TriggerQueue.getInstance();
  const job = await queue.queue?.getJob(jobId)
  if (job && jobId) {
    console.log("=======stalled Job===================", job.data)

    // try {
    //   //  setTimeout()
    // } catch (error) {
    //   await job.moveToFailed(new Error('Processing failed due to an error'),jobId,true)
    // }

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