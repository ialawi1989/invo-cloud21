
import { writeFile } from 'fs';
import { Request, Response, NextFunction } from "express";
import { ResponseData } from "@src/models/ResponseData";
import { promisify } from 'util';
import { Invoice } from '@src/models/account/Invoice';
import { BranchesRepo } from '@src/repo/admin/branches.repo';
import { InvoiceLine } from '@src/models/account/InvoiceLine';
import { InvoiceLineOption } from '@src/models/account/invoiceLineOption';
import { InvoiceRepo } from '@src/repo/app/accounts/invoice.repo';
import { CompanyRepo } from '@src/repo/admin/company.repo';
import { DB } from '@src/dbconnection/dbconnection';
import { InvoicePayment } from '@src/models/account/InvoicePayment';
import { SocketInvoiceRepo } from '@src/repo/socket/invoice.socket';
import { Service } from './../../models/Settings/service';
import { ServiceRepo } from '@src/repo/admin/services.repo';
import { Customer, CustomerAddress } from '@src/models/account/Customer';
import { CustomerRepo } from '@src/repo/app/accounts/customer.repo';
import { TaxesRepo } from '@src/repo/app/accounts/taxes.repo';
import { PaymnetMethodRepo } from '@src/repo/app/accounts/paymentMethod.repo';
import { InvoicePaymentLine } from '@src/models/account/InvoicePaymentLine';
import { InvoicePaymentRepo } from '@src/repo/app/accounts/invoicePayment.repo';
import { AccountsRepo } from '@src/repo/app/accounts/account.repo';
import e from 'connect-timeout';
import { PluginRepo } from '@src/repo/app/accounts/plugin.repo';
import { GruptechOrderQueue } from './GruptechOrderQueue';
import { TriggerQueue } from '@src/repo/triggers/triggerQueue';
import { InvoiceStatuesQueue } from '@src/repo/triggers/queue/workers/invoiceStatus.worker';
const { Logger } = require('aws-cloudwatch-log')


let writeFileAsync = promisify(writeFile);
export class AggrigatorController {




	public static async orderCreation(req: Request, res: Response, next: NextFunction) {
		try {
			const order = req.body;
			let logger = new Logger({
				logGroupName: 'bezat',
				logStreamName: 'GruptechRecived',
				region: process.env.AWS_REGION,
				accessKeyId: process.env.AWS_ACCESS_KEY,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
				uploadFreq: 10000, 	// Optional. Send logs to AWS LogStream in batches after 10 seconds intervals.
				local: false 		// Optional. If set to true, the log will fall back to the standard 'console.log'.
			});
			logger.log(order.displayId)
			// Add a job to the queue for processing
			let queueInstance = GruptechOrderQueue.getInstance();
			queueInstance.createJob(order);

			return res.send({ success: true, message: 'Order is being processed.' });
		} catch (error: any) {
			console.error(error);
			  throw error
		}
	}









	public static async deliveryJobcreated(req: Request, res: Response, next: NextFunction) {
		try {
			const body = req.body;
			const id = req.params.id
			console.log("id", JSON.stringify(id));
			console.log("body", JSON.stringify(body));
			return res.send();
		} catch (error: any) {
			console.log(error);
			  throw error
		}
	}

	public static async driverAssigned(req: Request, res: Response, next: NextFunction) {
		try {
			const body = req.body;
			const id = req.params.id

		} catch (error: any) {
			console.log(error);
			  throw error
		}
	}



	public static async deliveryJobStarted(req: Request, res: Response, next: NextFunction) {
		try {
			const body = req.body;
			const id = req.params.id

		} catch (error: any) {
			console.log(error);
			  throw error
		}
	}



	public static async deliveryJobcompleted(req: Request, res: Response, next: NextFunction) {
		try {
			const body = req.body;
			const id = req.params.id

		} catch (error: any) {
			console.log(error);
			  throw error
		}
	}


	public static async deliveryJobcancelled(req: Request, res: Response, next: NextFunction) {
		try {

			const body = req.body;
			const id = req.params.id
			console.log("id", JSON.stringify(id));
			console.log("body", JSON.stringify(body));
			return res.send();
		} catch (error: any) {
			console.log(error);
			  throw error
		}
	}




	//ordercan

	public static async orderCancelled(req: Request, res: Response, next: NextFunction) {
		const client = await DB.excu.client();
		try {
			await client.query("BEGIN");

			const body = req.body;
			const id = req.params.id;

			console.log(id);
			let invoiceId = await InvoiceRepo.getInvoiceIdbyGruptechId(client, id)
			invoiceId = invoiceId.id;
			console.log("invoiceId")
			console.log(invoiceId)
			console.log("invoiceId")
			const invoicePaymentId = await InvoicePaymentRepo.getInvoicPaymentIdByInvoice(client, invoiceId.id)
			await InvoicePaymentRepo.VoidGruptechPayment(client, invoiceId.id);


			let company = (await InvoiceRepo.getCompanyByInvoiceId(client, invoiceId.id)).data;
			const data = (await InvoiceRepo.getFullInvoice(client, invoiceId.id));
			const invoice: Invoice = new Invoice();


			console.log("invoice.onlineData");
			console.log(invoice.onlineData);
			console.log("invoice.onlineData");
			invoice.ParseJson(data);
			const invoiceStatus = await InvoiceRepo.getInvoiceStatus(client, invoiceId.id);
			if (invoice.onlineData.onlineStatus == 'Accepted') {
				if (invoice.readyTime != null) {

					invoice.lines.forEach((line: InvoiceLine) => {
						line.isVoided = true;
						line.waste = true;
						line.recipe = []
					});

				} else {
					invoice.lines.forEach((line: InvoiceLine) => { line.isVoided = true; line.waste = false; line.recipe = [] });
				}

				invoice.onlineData.onlineStatus = 'Rejected'
				invoice.onlineData.rejectReason = 'Cancelled By Aggregator'
				invoice.status = 'Closed'

			} else {
				invoice.status = 'Closed'
			}
			const customerAddress: { address: any } = { address: invoice.customerAddress };
			invoice.customerAddress = customerAddress;
			invoice.customerAddress
			let resault = await InvoiceRepo.editInvoice(client, invoice, company);
			await SocketInvoiceRepo.sendUpdateInvoice(client, invoice.branchId, invoice.id)

			await client.query("COMMIT");

			if (resault.success) {
				if (invoice.status != 'Draft') {
					let queueInstance = TriggerQueue.getInstance();


					queueInstance.createJob({ journalType: "Movment", type: "invoice", id: [resault.data.invoice.id] })
					queueInstance.createJob({ journalType: "Movment", type: "parentChildMovment", ids: [resault.data.invoice.id] })
					queueInstance.createJob({ type: "Invoices", id: [resault.data.invoice.id], companyId: company.id })
					if (invoicePaymentId)
						queueInstance.createJob({ type: "DeleteJournal", referenceId: invoicePaymentId, ids: [] })
				}

			}
			InvoiceStatuesQueue.get().createJob({
				id: resault.data.invoice.id
			} as any);

			return res.send();
		} catch (error: any) {
			await client.query("ROLLBACK")
			console.log(error);
			  throw error
		} finally {
			client.release()
		}
	}



}


