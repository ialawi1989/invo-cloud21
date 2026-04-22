
import { DB } from '@src/dbconnection/dbconnection';
import { CronJob } from 'cron';
import { ViewQueue } from '../../../utilts/viewQueue';
import { RedisClient } from '@src/redisClient';
import { ResponseData } from '@src/models/ResponseData';
import { json } from 'body-parser';
import fs from 'fs';
import { writeFile } from 'fs/promises';
import SFTPClient from 'ssh2-sftp-client';

import { Company } from '@src/models/admin/company';
import { Organizations } from 'aws-sdk';
export class MOICJob {
	public job;
	constructor() {
		this.job = new CronJob(
			'0 0 1 * * *', // cronTime
			() => this.upload(),
		);
	}


	async upload() {
		const client = await DB.excu.client();
		try {
			await client.query("BEGIN")
			let companies = await client.query(` with "pluginInfo" as (
												select 
													p.id, elem as settings , (elem->>'branchId')::uuid as "companyId"
												from "Plugins" p
												join "Branches" b on p."companyId" = b."companyId"
												join jsonb_array_elements(settings -> 'branches') elem on true
												where "pluginName" = 'MOIC' 
													and (settings ->> 'syncByBranch') = true::text
													and elem->>'branchId' = b.id::text 
													and elem->>'moic_url' is not null 
													and elem->>'enable' = 'true'
												union 
												select  
													p.id , settings,  p."companyId" as "companyId"
												from "Plugins" p
												where "pluginName" = 'MOIC' 
													and COALESCE(settings ->>'syncByBranch','false') != true::text
													and settings->>'moic_url' is not null 
													and settings->>'enable' = 'true'
												)
												select p.id, 
														p."companyId",
														COUNT(i.id) as "count", 
														SUM(il.total) as "totalSales", 
														TO_CHAR(CURRENT_DATE - 1,'YYYYMMDD') as date, 
														
														settings->>'moic_url' AS "moic_url",
														settings->>'moic_username' AS "moic_username",
														settings->>'moic_password' AS "moic_password",
														settings->>'moic_resturant_id' AS "moic_resturant_id"
												from "pluginInfo" p
												join "Branches" b ON p."companyId" = b."companyId" or p."companyId" = b.id
												join "Invoices" i ON b.id = i."branchId" and i.status <> 'Draft'
												join "InvoiceLines" il ON i.id = il."invoiceId" 
												where TO_CHAR(i."createdAt", 'YYYY-MM-DD') = (CURRENT_DATE - 1)::text 
												group by  p."companyId", p.settings,p.id`
										);

			console.log("companies")
			console.log(companies)
			console.log("companies")

			companies.rows.forEach(async (row: any) => {
				const data = row.moic_resturant_id + "|" + row.totalSales + "||||||||" + row.date;
				const checks = "Checks: " + row.count;
				const fileName = "invo__" + row.moic_resturant_id + "__room__" + row.date + ".txt";

				fs.writeFile(fileName, data + "\n" + checks, async (err) => {
					if (err) {
						console.error(err);
					} else {
						console.log('Text file created successfully.');

						// File created, now upload it to the remote server
						try {
							const content = fs.readFileSync(fileName, 'utf-8');
							const sftp = new SFTPClient();
							await sftp.connect({
								host: row.moic_url,
								port: 22, // Assuming default SFTP port is used
								username: row.moic_username,
								password: row.moic_password
							});
							await sftp.put(Buffer.from(content), '/files/' + fileName); // Upload the file content to the /files directory on the remote server
							console.log('File uploaded successfully.');
							sftp.end(); // Disconnect from the SFTP server
							const updateQuery: { text: string, values: any } = {
								text: `UPDATE "Plugins" 
									   SET logs = logs || $1 
									   WHERE id = $2`,
								values: [
									{
										date: row.date,
										totalSales: row.totalSales,
										totalInvoices: row.count,
										autoUpload: true,
										organizationId: row.companyId
									},
									row.id
								]
							};

							await client.query(updateQuery.text, updateQuery.values);

						} catch (err) {
							console.error('Error uploading file:', err);
							await client.query("ROLLBACK")
							;
						}
					}
				});
			});

			await client.query("COMMIT")
		} catch (error) {
			await client.query("ROLLBACK")
			;
			console.log(error)

		} finally {
			client.release()
		}

	}






	public static async manualUpload(companyId: Company, date: any, branchId:string|null) {
		const client = await DB.excu.client();
		try {
			console.log(0);
			await client.query("BEGIN")
			let query = {
				text: `with "pluginInfo" as (
						select 
						p.id, elem as settings , (elem->>'branchId')::uuid as "companyId"
						from "Plugins" p
						join "Branches" b ON p."companyId" = b."companyId"
						join jsonb_array_elements(settings -> 'branches') elem on true
						where  b."companyId" = $1
							and "pluginName" = 'MOIC' 
							and ($2::uuid is null or b.id = $2::uuid )
							and (settings ->> 'syncByBranch') = true::text
							and elem->>'branchId' = b.id::text 
							and elem->>'moic_url' is not null 
							and elem->>'enable' = 'true'
						union 
						select  
							p.id , settings,  p."companyId" as "companyId"
						from "Plugins" p
						where  p."companyId" = $1
							and "pluginName" = 'MOIC' 
							and COALESCE(settings ->>'syncByBranch','false') <> true::text
							and settings->>'moic_url' is not null 
							and settings->>'enable' = 'true'
						)
						SELECT p.id, TO_CHAR(i."createdAt",'YYYYMMDD') as "createdAt", TO_CHAR(CURRENT_DATE,'YYYYMMDD') as date, COUNT(i.id) as "count", SUM(il.total) as "totalSales", p."companyId",
								settings->>'moic_url' AS "moic_url",
								settings->>'moic_resturant_id' AS "moic_resturant_id",
								settings->>'moic_username' AS "moic_username",
								settings->>'moic_password' AS "moic_password"
						FROM "pluginInfo" p
						JOIN "Branches" b ON p."companyId" = b."companyId" or p."companyId" = b."id"
						JOIN "Invoices" i ON b.id = i."branchId" and i.status <> 'Draft'
						JOIN "InvoiceLines" il ON i.id = il."invoiceId" 
						WHERE i."createdAt"::date =$3::date
						GROUP BY p."companyId", p.settings,TO_CHAR(i."createdAt",'YYYYMMDD') ,p.id `,
				values: [ companyId, branchId , date],
			}
			let companies = await client.query(query.text, query.values)
			console.log(companies);
			let row: any = companies.rows[0];

			if (companies.rows.length == 0) {
				return (new ResponseData(false, 'selected Date Dose Not Have Any Records', []));
			}
			const data = row.moic_resturant_id + "|" + row.totalSales + "||||||||" + row.createdAt;
			const checks = "Checks: " + row.count;
			const fileName = "invo__" + row.moic_resturant_id + "__room__" + row.createdAt + ".txt";

			console.log(1);
			 await writeFile(fileName, data + "\n" + checks);
			 console.log(2);
			// 	,async (err: any) => {
			// 	if (err) {
			// 		console.log(err);
			// 		return (new ResponseData(false, err, []));
			// 	} else {
			// 		console.log(1);
			// 		var delayInMilliseconds = 1000; //1 second
			// 		setTimeout(function () {
			// 			//your code to be executed after 1 second
			// 		}, delayInMilliseconds);
			// 		console.log(2);
			// 	}
			// });

			console.log(3);
			const content = fs.readFileSync(fileName, 'utf-8');
			const sftp = new SFTPClient();
			await sftp.connect({
				host: row.moic_url,
				port: 22, // Assuming default SFTP port is used
				username: row.moic_username,
				password: row.moic_password
			});
			await sftp.put(Buffer.from(content), '/files/' + fileName); // Upload the file content to the /files directory on the remote server
			sftp.end(); // Disconnect from the SFTP server
			console.log("25")
			let updateQuery: { text: string, values: any } = {
				text: `UPDATE "Plugins" 
					   SET logs = logs || $1 
					   WHERE id = $2`,
				values: [
					{
						date: row.createdAt,
						totalSales: row.totalSales,
						totalInvoices: row.count,
						autoUpload: false,
						organizationId: row.companyId
					},
					row.id
				]
			};

			if(branchId)

			await client.query(updateQuery.text, updateQuery.values);
			await client.query("COMMIT")
			return (new ResponseData(true, 'File uploaded successfully.', []));
		} catch (error: any) {
			await client.query("ROLLBACK")
			console.log(error);
			if (error.code == 'ECONNREFUSED') {
				return (new ResponseData(false, 'Connection Error: Please Review Your Setting', []));
			} else {

				return (new ResponseData(false, error, []));
			}
		} finally {
			client.release()
		}
	}

}