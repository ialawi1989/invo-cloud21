
import { DB } from '@src/dbconnection/dbconnection';
import { CronJob } from 'cron';

import { ZatcaInvoiceQueue } from '@src/controller/admin/ZatcaInvoiceQueue';
import { now } from 'lodash';
export class ZatcaJob {
	public job;
	constructor() {
		this.job = new CronJob(
			'0 0 */6 * * *', // cronTime run every 6 hours
			() => this.upload(),
		);
	}


	async upload() {
		console.log("doing the job"+ now())
		const client = await DB.excu.client();
		try {
			await client.query("BEGIN")
			let invoices = await client.query(`SELECT 
  			  i.id AS "invoiceId"
		FROM "Invoices" i
		JOIN "Branches" b ON i."branchId" = b.id
		JOIN "InvoicePaymentLines" ipl ON ipl."invoiceId" = i.id
		WHERE i.status = 'Paid' 
		AND COALESCE(i."zatca_status", '') NOT IN ('QUEUED', 'REPORTED')
		AND b."zatca" IS NOT NULL
		AND (b."zatca" ->> 'ProdrequistId') IS NOT null
		GROUP BY 
			i.id, b.zatca_startdate
		HAVING MAX(ipl."createdAt") >= b.zatca_startdate;
		`
			);

			let queueInstance = ZatcaInvoiceQueue.getInstance();

			for (const row of invoices.rows) {
				await queueInstance.createJob(row.invoiceId);
				await DB.excu.query(
					`UPDATE "Invoices" SET "zatca_status" = 'QUEUED' WHERE id = $1`,
					[row.invoiceId]
				);
			}


			await client.query("COMMIT")
		} catch (error) {
			await client.query("ROLLBACK")
			;
			console.log(error)

		} finally {
			client.release()
		}

	}



}