
import { DB } from '@src/dbconnection/dbconnection';
import { CronJob } from 'cron';

import { ZatcaInvoiceQueue } from '@src/controller/admin/ZatcaInvoiceQueue';
import { now } from 'lodash';
import { JOFatooraQueue } from '@src/controller/admin/JOFatooraQueue';
export class jofotaraJob {
	public job;
	constructor() {
		this.job = new CronJob(
			'0 0 */6 * * *', // cronTime run every 6 hours
			() => this.upload(),
		);
	}


	async upload() {
		console.log("doing the job" + now())
		const client = await DB.excu.client();
		try {
			await client.query("BEGIN")
			let invoices = await client.query(`SELECT 
   count(ipl.id)  AS "invoiceId", i.id,
   c.name
FROM "Invoices" i
JOIN "Branches" b ON i."branchId" = b.id
join "Companies" c ON i."companyId" = c.id 
JOIN "InvoicePaymentLines" ipl ON ipl."invoiceId" = i.id
WHERE i.status = 'Paid' 
  AND COALESCE(i."jofotara_status", '') NOT IN ('QUEUED', 'REPORTED')
  AND c."jofotara" IS NOT NULL
GROUP BY 
    i.id, c.jofotara_startdate, c.name
    HAVING MAX(ipl."createdAt") >= c.jofotara_startdate;
    
`
			);

			let queueInstance = JOFatooraQueue.getInstance();

			for (const row of invoices.rows) {
				await queueInstance.createJob(row.invoiceId);
				await DB.excu.query(
					`UPDATE "Invoices" SET "jofotara_status" = 'QUEUED' WHERE id = $1`,
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