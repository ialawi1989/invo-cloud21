import axios from 'axios';
import { DB } from '@src/dbconnection/dbconnection';
import { CronJob } from 'cron';
import { token } from 'morgan';
import { ResponseData } from '@src/models/ResponseData';
import { Company } from '@src/models/admin/company';
import { PoolClient } from 'pg';
import { Plugin } from '@src/models/account/Plugin';
import { PluginRepo } from '@src/repo/app/accounts/plugin.repo';

export class footfallCamJob {//'00 1 * * *'
	public job;
	constructor() {
		this.job = new CronJob(
			'0 0 1 * * *', // cronTime
			() => this.upload()
		);
	}
	// async upload() {
	// 	try {
	// 		// const companies = await DB.excu.query(`WITH RECURSIVE TimeSeries AS (
	// 		//   SELECT 
	// 		// 	TIMESTAMP 'epoch' + INTERVAL '30 minutes' * floor(EXTRACT(epoch FROM TIMESTAMP 'yesterday'::date) / (30*60)) AS interval_start
	// 		//   UNION ALL
	// 		//   SELECT 
	// 		// 	interval_start + INTERVAL '30 minutes'
	// 		//   FROM 
	// 		// 	TimeSeries
	// 		//   WHERE 
	// 		// 	interval_start < TIMESTAMP 'yesterday'::date + INTERVAL '1 day' - INTERVAL '30 minutes'
	// 		// )
	// 		// SELECT 
	// 		//   jsonb_build_object(
	// 		// 	'CompanyId', p."companyId",
	// 		// 	'token', p.settings->>'token',
	// 		// 	'sales', jsonb_agg(result)
	// 		//   ) AS result_array 
	// 		// FROM (
	// 		//   SELECT 
	// 		// 	jsonb_build_object(
	// 		// 	  'StoreCode', i."branchId",
	// 		// 	  'DateTime', to_char(ts.interval_start,'YYYY-MM-DD HH:MI:SS'),
	// 		// 	  'TotalTransactionQty',  COUNT(DISTINCT i.id),
	// 		// 	  'TotalTransactionValue', COALESCE(SUM(il.total), 0)
	// 		// 	) AS result,
	// 		// 	i."branchId" AS branch_id
	// 		//   FROM 
	// 		// 	TimeSeries ts
	// 		//   LEFT JOIN 
	// 		// 	"Invoices" i ON DATE_TRUNC('hour', i."createdAt") + ((EXTRACT(MINUTE FROM i."createdAt")::int / 30) * INTERVAL '30 minutes') = ts.interval_start
	// 		//   LEFT JOIN 
	// 		// 	"InvoiceLines" il ON i.id = il."invoiceId"
	// 		//   LEFT JOIN 
	// 		// 	"Branches" B on B.id = i."branchId"  
	// 		//   WHERE
	// 		// 	b."companyId" IN (SELECT p."companyId" FROM "Plugins" p WHERE "pluginName" = 'FootfallCam' AND p.settings ->> 'enable' = 'true')
	// 		//   GROUP BY 
	// 		// 	ts.interval_start, i."branchId"
	// 		//   HAVING 
	// 		// 	COALESCE(SUM(il.total), 0) > 0
	// 		//   ORDER BY 
	// 		// 	ts.interval_start, i."branchId"
	// 		// ) AS subquery
	// 		// CROSS JOIN 
	// 		//   "Plugins" p
	// 		// WHERE 
	// 		//   p."pluginName" = 'FootfallCam' AND p.settings ->> 'enable' = 'true'
	// 		// GROUP BY 
	// 		//   p."companyId", p.settings`);
		

	// 		// const companies = await DB.excu.query(query.text)
	// 		for (let index = 0; index < companies.rows.length; index++) {
	// 			const row: any = companies.rows[index];
	// 			try {
	// 				const url = 'https://v9.footfallcam.com/v9/api/Import/Sales';
	// 				const data = row.sales; // Your JSON data here
	// 				console.log(data)
	// 				const token = row.token;
	// 				console.log("token", token)
	// 				// const email = row.email;
	// 				// console.log("uploaduploadupload",email,password)
	// 				// const tokenData = await footfallCamJob.login(password, email)
	// 				// if (!tokenData) {
	// 				// 	continue;
	// 				// }
	// 				// const token = tokenData.data.token;


	// 				axios.post(url, data, {
	// 					headers: {
	// 						'AToken': token
	// 					}
	// 				})
	// 					.then(response => {
	// 						console.log('Response:', response.data);
	// 					})
	// 					.catch(error => {
	// 						console.error('Error:', error);
	// 					});
	// 			} catch (err) {
	// 				console.error(err);
	// 			}

	// 		}
	// 		// companies.rows.forEach(async (row: any) => {
	// 		// 	try {
	// 		// 		const url = 'https://staging-env-rule.footfallcam.com/uploadSalesData';
	// 		// 		const data = row.sales; // Your JSON data here
	// 		// 		const password = row.password;
	// 		// 		const email = row.email;
	// 		// 		const token = row.token;
	// 		// 		axios.post(url, data, {
	// 		// 			headers: {
	// 		// 				Key: 'Token',
	// 		// 				'Token': token
	// 		// 			}
	// 		// 		})
	// 		// 			.then(response => {
	// 		// 				console.log('Response:', response.data);
	// 		// 			})
	// 		// 			.catch(error => {
	// 		// 				console.error('Error:', error);
	// 		// 			});
	// 		// 	} catch (err) {
	// 		// 		console.error(err);
	// 		// 	}
	// 		// });
	// 	} catch (error) {
	// 		console.log(error)
	// 	}
	// }

    async upload(){
		try {
			await footfallCamJob.syncData()	
		} catch (error) {
			
		}
		
	}
	public static async getFootCamPlugin(client: PoolClient, companyId: string) {
		try {
			const query = {
				text: `SELECT count(id) as qty from "Plugins" where "companyId"=$1 and "pluginName"=$2`,
				values: [companyId, 'FootfallCam']
			}

			let plugin = await client.query(query.text, query.values);

			if (plugin.rows && plugin.rows.length && plugin.rows[0].qty > 0) {
				return true
			}
			return false
		} catch (error: any) {
			throw new Error(error)
		}
	}

	public static async login(data: any, company: Company) {
		const client = await DB.excu.client();
		try {

			await client.query("BEGIN")
			let email = data.email;
			let password = data.password;
			const currentDate = new Date();
			const oneYearFromNow = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), currentDate.getDate());

			let body = {
				email: email,
				password: password,
				expiration: oneYearFromNow
			}
			let url = ' https://v9.footfallcam.com/account/GenerateAccessToken'

			let reqConfig = {
				method: 'post',
				url: url,
				data: body,
				headers: {
					'Content-Type': 'application/json',
				}
			}

			let response = (await axios(reqConfig)).data

			let token = response.AToken;

			if (token) {

				let isPluginExist = await this.getFootCamPlugin(client, company.id)
				console.log(isPluginExist, token)
				if (isPluginExist) {
					let query = {
						text: `update "Plugins" set  "settings" = case when "settings" is null then JSONB_BUILD_OBJECT('token',$3::TEXT,'tokenExpiration',$4::DATE,'enable',$5::BOOLEAN)
						                                          else "settings" || JSONB_BUILD_OBJECT('token',$3::TEXT,'tokenExpiration',$4::DATE,'enable',$5::BOOLEAN) end
													where "pluginName" =$1
													and "companyId"=$2
													`,
						values: ['FootfallCam', company.id, token, oneYearFromNow, true],

					}
					await client.query(query.text, query.values)

				} else {
					let plugin = new Plugin();
					plugin.type = "FootfallCam";
					plugin.pluginName = 'FootfallCam'
					plugin.settings.enable = true;
					plugin.settings.tokenExpiration = oneYearFromNow;
					plugin.settings.token = token;
					plugin.companyId = company.id;
					await PluginRepo.addPlugin(client, plugin, company)
				}


				await client.query("COMMIT")
				return new ResponseData(true, "", { tokenExpiration: oneYearFromNow, enable: true })
			} else {

				return new ResponseData(false, response.error + ' ' + response.message, [])
			}


		} catch (error: any) {
            console.log(error)
			await client.query("ROLLBACK")

			return new ResponseData(false, error.message, [])
		} finally {
			client.release()
		}
	}

	public static async saveFootCamPlugin(data: any, company: Company) {
		try {

			const enable = data.enable;
			const branches = data.branches;
			let query = {
				text: `update "Plugins" set    "settings" = "settings" || JSONB_BUILD_OBJECT('enable',$3::boolean,'branches',$4::jsonb)
						where "pluginName" =$1
						and "companyId"=$2`,
				values: ['FootfallCam', company.id, enable,JSON.stringify(branches)],

			}
			await DB.excu.query(query.text, query.values)

			return new ResponseData(true, "", [])

		} catch (error: any) {

			return new ResponseData(false, error.message, [])
		}
	}

	public static async getPluginSettings(company: Company) {
		try {


			let query = {
				text: `SELECT id,
								"pluginName",
								JSONB_BUILD_OBJECT('tokenExpiration',settings->>'tokenExpiration','enable',(settings->>'enable')::boolean,'branches',(settings->>'branches')::jsonb) as "settings"
								FROM "Plugins" where "pluginName"=$1 and "companyId" =$2`,
				values: ['FootfallCam', company.id],

			}
			let plugin = await DB.excu.query(query.text, query.values)
			let pluginData = plugin.rows && plugin.rows.length > 0 ? plugin.rows[0] : []
			return new ResponseData(true, "", pluginData)

		} catch (error: any) {
			throw new Error(error)
		}
	}

	public static async getCompaniesSales(companyId:string|null=null,date:string|null = null)
	{
		try {
			const query={
				
					text: `with "plugin" as (
									select ("settings"->>'token') as "token",
										"Plugins"."companyId",
										 (el->>'id' )::uuid as "branchId",
										 (el->>'siteCode')as "siteCode"
												  
										from "Plugins" ,jsonb_array_elements( ("settings"->>'branches')::jsonb) el
										where "pluginName" ='FootfallCam'
										and ("settings"->>'enable')::boolean  = true
										and ("settings"->>'token') is not null 
	                                    and ($1::uuid is null or "companyId"=$1::uuid )
									),
									"transactions" as (
									select "plugin"."siteCode"  as "siteCode" ,
										"Invoices"."createdAt" as "TransactionDate",
										 1 as "TotalTransactionQuantity",
										count("InvoiceLines"."id") as "UnitPerTransaction",
										sum("InvoiceLines"."total") as "TotalTransactionAmount",
										"plugin"."branchId",
										"plugin"."token"
										from "plugin"
									inner join "Invoices" on "Invoices"."branchId" = "plugin"."branchId"  
									inner join "InvoiceLines" on "InvoiceLines"."invoiceId" = "Invoices".id and ( case when $2::date is null then "Invoices"."createdAt"::date = (current_date - interval '1 days')::date else "Invoices"."createdAt"::date = $2::date end )
									group by "plugin"."token","Invoices".id, "plugin"."siteCode", "plugin"."branchId"
							
									)
	
									select 
									 "transactions"."token",
									JSON_AGG(JSON_BUILD_OBJECT('SiteCode',"siteCode",'TransactionDate',"TransactionDate",'TotalTransactionQuantity',"TotalTransactionQuantity",'TotalTransactionAmount',"TotalTransactionAmount",'UnitPerTransaction',"UnitPerTransaction")) AS "sales"
	
									from "transactions"
	
									GROUP BY "transactions"."token"`,
			    values:[companyId,date]	
			} 

			let sales = await DB.excu.query(query.text,query.values);

			return sales.rows
		} catch (error:any) {
			throw new Error(error)
		}
	}

	public static async syncData(companyId:string|null=null,date:string|null = null){
		try {
			const url = 'https://v9.footfallcam.com/v9/api/Import/Sales';
			const companies = await this.getCompaniesSales(companyId,date)
			for (let index = 0; index < companies.length; index++) {
				const element:any = companies[index];
			
				const data = element.sales; // Your JSON data here
				const token = element.token;
			

				return axios.post(url, data, {
					headers: {
						'AToken': token
					}
				})
					.then(response => {
						console.log(response.data)
						return new ResponseData(true,"",[])
					})
					.catch(error => {
						console.log(error)
					return new ResponseData(false,"",[])  
					});
			}

		} catch (error:any) {
			throw new Error(error)
		}
	}
}