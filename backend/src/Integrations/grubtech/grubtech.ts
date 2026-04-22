import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Company } from "@src/models/admin/company";
import { InvoiceRepo } from "@src/repo/app/accounts/invoice.repo";
import { MenuRepo } from "@src/repo/app/product/menu.repo";
import axios from "axios";
import { PoolClient } from "pg";
const { Logger } = require('aws-cloudwatch-log')
export class GrubTechBranchesSettings {
	menuId = "";
	storeId = "";
	branchId = "";
	isSinked = true;
	branchName = "";
	branchCurrentPage = 1

	ParseJson(json: any): void {
		for (const key in json) {
			if (key in this) {
				this[key as keyof typeof this] = json[key];
			}
		}
	}
}
export class GrubTechSettings {
	token = "";
	enable = "";
	branches: GrubTechBranchesSettings[] = [];
	services: any = {};
	serviceId="";
	ParseJson(json: any): void {
		for (const key in json) {
			if (key in this) {
				this[key as keyof typeof this] = json[key];
			}
		}
	}

}
export class grubtech {

	// ApiKey = "liqGqa3N8o3VogWVqVqM77H3f6gW3xxz7sZ5DBiL";
	ApiKey = "jZLU7ohDXO199cVr3eQyC3JetyJZ9Kxc1nsZseMY";
	Authorization = "";
	serviceId = "invopos-service-id";

	baseUrl() {
		return "";
	}








	public async acceptOrder(client: PoolClient, invoiceId: any) {
		try {
		
			let logger = new Logger({
				logGroupName: 'bezat',
				logStreamName: 'GrupTech',
				region: process.env.AWS_REGION,
				accessKeyId: process.env.AWS_ACCESS_KEY,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
				uploadFreq: 10000, 	// Optional. Send logs to AWS LogStream in batches after 10 seconds intervals.
				local: false 		// Optional. If set to true, the log will fall back to the standard 'console.log'.
			});
			
			let ApiKey = "jZLU7ohDXO199cVr3eQyC3JetyJZ9Kxc1nsZseMY";
			let arrId = await InvoiceRepo.getInvoiceAgrigatorId(client, invoiceId);
			const event = new Date();
			const currentTime = event.toISOString()
			let config = {
				method: 'POST',
				url: 'https://api.grubtech.io/commonpos/v1/invopos-service-id/orders/' + arrId.id + '/accept',
				headers: {
					'accept': 'application/json',
					'Content-Type': 'application/json',
					'X-Api-Key': ApiKey
				},
				data: {
					"acceptedAt": currentTime,
					"externalReferenceId": invoiceId
				}
			};
			let response = (await axios(config)).data

			if (response.success == true) {
				logger.log(arrId.id + "Has been created in Gruptech")
				return new ResponseData(true, "", {})
			} else {
				logger.log( new ResponseData(false, response.error + " " + response.errorText, {}))
				return new ResponseData(false, response.error + " " + response.errorText, {})
			}
		} catch (error: any) {
            console.log(error)
			let logger = new Logger({
				logGroupName: 'bezat',
				logStreamName: 'GrupTech',
				region: process.env.AWS_REGION,
				accessKeyId: process.env.AWS_ACCESS_KEY,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
				uploadFreq: 10000, 	// Optional. Send logs to AWS LogStream in batches after 10 seconds intervals.
				local: false 		// Optional. If set to true, the log will fall back to the standard 'console.log'.
			});
			logger.log(error)
			return new ResponseData(false, error.data.error + " " + error.data.errorText, {})
		}
	}


	public async cancelOrder(invoiceId: any) {
			const client = await DB.excu.client();
		try {
			let ApiKey = "jZLU7ohDXO199cVr3eQyC3JetyJZ9Kxc1nsZseMY";
		
			await client.query("BEGIN")
			let arrId = await InvoiceRepo.getInvoiceAgrigatorId(client, invoiceId);
			const now = new Date();
			const options = { hour12: false };
			const currentTime = now.toLocaleTimeString(undefined, options);
			let config = {
				method: 'POST',
				url: 'https://api.grubtech.io/commonpos/v1/invopos-service-id/orders/' + arrId.id + '/cancel',
				headers: {
					'accept': 'application/json',
					'Content-Type': 'application/json',
					'X-Api-Key': ApiKey
				},
				data: { "reason": "OTHER" }
			};
			let response = (await axios(config)).data
			await client.query("Commit")
			if (response.success == true) {
				return new ResponseData(true, "", {})
			} else {
				return new ResponseData(false, response.error + " " + response.errorText, {})
			}
		} catch (error: any) {
			await client.query("ROLLBACK")
			throw new Error(error)
		}finally{
			client.release()
		}


	}

	public async rejectOrder(client:PoolClient,invoiceId: any) {
		try {
			let ApiKey = "jZLU7ohDXO199cVr3eQyC3JetyJZ9Kxc1nsZseMY";
			let arrId = await InvoiceRepo.getInvoiceAgrigatorId(client, invoiceId);
			const now = new Date();
			const options = { hour12: false };
			const currentTime = now.toLocaleTimeString(undefined, options);
			let config = {
				method: 'POST',
				url: 'https://api.grubtech.io/commonpos/v1/invopos-service-id/orders/' + arrId.id + '/reject',
				headers: {
					'accept': 'application/json',
					'Content-Type': 'application/json',
					'X-Api-Key': ApiKey
				},
				data: { "reason": "OTHER" }
			};
			let response = (await axios(config)).data
			if (response.success == true) {
				return new ResponseData(true, "", {})
			} else {
				return new ResponseData(false, response.error + " " + response.errorText, {})
			}
		} catch (error: any) {
			
			return new ResponseData(false, error.error + " " + error.errorText, {})
		}


	}

	public async orderStarted(client:PoolClient,invoiceId: any) {
		try {

			let logger = new Logger({
				logGroupName: 'bezat',
				logStreamName: 'GrupTech',
				region: process.env.AWS_REGION,
				accessKeyId: process.env.AWS_ACCESS_KEY,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
				uploadFreq: 10000, 	// Optional. Send logs to AWS LogStream in batches after 10 seconds intervals.
				local: false 		// Optional. If set to true, the log will fall back to the standard 'console.log'.
			});
			let ApiKey = "jZLU7ohDXO199cVr3eQyC3JetyJZ9Kxc1nsZseMY";
			let arrId = await InvoiceRepo.getInvoiceAgrigatorId(client, invoiceId);
			let config = {
				method: 'POST',
				url: 'https://api.grubtech.io/commonpos/v1/invopos-service-id/orders/' + arrId.id + '/started',
				headers: {
					'accept': 'application/json',
					'Content-Type': 'application/json',
					'X-Api-Key': ApiKey
				}
			};
			let response = (await axios(config)).data
			console.log(response);
			if (response.success == true) {
				logger.log(arrId.id+" has been prepared")
				return new ResponseData(true, "", {})
			} else {
				logger.log(response);
				return new ResponseData(false, response.error + " " + response.errorText, {})
			}
		} catch (error: any) {
			let logger = new Logger({
				logGroupName: 'bezat',
				logStreamName: 'GrupTech',
				region: process.env.AWS_REGION,
				accessKeyId: process.env.AWS_ACCESS_KEY,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
				uploadFreq: 10000, 	// Optional. Send logs to AWS LogStream in batches after 10 seconds intervals.
				local: false 		// Optional. If set to true, the log will fall back to the standard 'console.log'.
			});
			logger.log(error)
		   return new ResponseData(false,error,[])
		}

	}




	public  async orderPrepared(client:PoolClient,invoiceId: any) {
		try {

			let logger = new Logger({
				logGroupName: 'bezat',
				logStreamName: 'GrupTech',
				region: process.env.AWS_REGION,
				accessKeyId: process.env.AWS_ACCESS_KEY,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
				uploadFreq: 10000, 	// Optional. Send logs to AWS LogStream in batches after 10 seconds intervals.
				local: false 		// Optional. If set to true, the log will fall back to the standard 'console.log'.
			});
			let ApiKey = "jZLU7ohDXO199cVr3eQyC3JetyJZ9Kxc1nsZseMY";
			let arrId = await InvoiceRepo.getInvoiceAgrigatorId(client, invoiceId);
			let config = {
				method: 'POST',
				url: 'https://api.grubtech.io/commonpos/v1/invopos-service-id/orders/' + arrId.id + '/prepared',
				headers: {
					'accept': 'application/json',
					'Content-Type': 'application/json',
					'X-Api-Key': ApiKey
				}
			};
			let response = (await axios(config)).data
			console.log(response);
			if (response.success == true) {
				logger.log(arrId.id+" has been prepared")
				return new ResponseData(true, "", {})
			} else {
				logger.log(false, response.error + " " + response.errorText, {})
				return new ResponseData(false, response.error + " " + response.errorText, {})
			}
		} catch (error: any) {
			let logger = new Logger({
				logGroupName: 'bezat',
				logStreamName: 'GrupTech',
				region: process.env.AWS_REGION,
				accessKeyId: process.env.AWS_ACCESS_KEY,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
				uploadFreq: 10000, 	// Optional. Send logs to AWS LogStream in batches after 10 seconds intervals.
				local: false 		// Optional. If set to true, the log will fall back to the standard 'console.log'.
			});
			logger.log(error)
		   return new ResponseData(false,error,[])
		}


	}



	public async orderDispatched(invoiceId: any) {
		const client = await DB.excu.client();
		try {
			await client.query("BEGIN")
			let arrId = await InvoiceRepo.getInvoiceAgrigatorId(client, invoiceId);
			const now = new Date();
			const options = { hour12: false };
			const currentTime = now.toLocaleTimeString(undefined, options);
			let config = {
				method: 'POST',
				url: 'https://api.grubtech.io/commonpos/v1/invopos-service-id/orders/' + arrId.id + '/dispatched',
				headers: {
					'accept': 'application/json',
					'Content-Type': 'application/json',
					'X-API-KEY': this.ApiKey
				}
			};
			let response = (await axios(config)).data
				await client.query("COMMIT")
			if (response.success == true) {
				return new ResponseData(true, "", {})
			} else {
				return new ResponseData(false, response.error + " " + response.errorText, {})
			}
		} catch (error: any) {
				await client.query("ROLLBACK")
			throw new Error(error)
		}finally{
			client.release()
		}


	}




	public async orderCompleted(invoiceId: any) {
		const client = await DB.excu.client();
		try {
			await client.query("BEGIN")

			let arrId = await InvoiceRepo.getInvoiceAgrigatorId(client, invoiceId);
			const now = new Date();
			const options = { hour12: false };
			const currentTime = now.toLocaleTimeString(undefined, options);
			let config = {
				method: 'POST',
				url: 'https://api.grubtech.io/commonpos/v1/invopos-service-id/orders/' + arrId.id + '/completed',
				headers: {
					'accept': 'application/json',
					'Content-Type': 'application/json',
					'X-API-KEY': this.ApiKey
				}
			};
			let response = (await axios(config)).data
						await client.query("COMMIT")

			if (response.success == true) {
				return new ResponseData(true, "", {})
			} else {
				return new ResponseData(false, response.error + " " + response.errorText, {})
			}
		} catch (error: any) {
				await client.query("ROLLBACK")
			throw new Error(error)
		}finally{
			client.release()
		}


	}
	public async requestDelivery(invoiceId: any) {
		const client = await DB.excu.client();
		try {
			await client.query("BEGIN")
			let arrId = await InvoiceRepo.getInvoiceAgrigatorId(client, invoiceId);
			const now = new Date();
			const options = { hour12: false };
			const currentTime = now.toLocaleTimeString(undefined, options);
			let config = {
				method: 'POST',
				url: 'https://api.grubtech.io/commonpos/v1/invopos-service-id/orders/' + arrId.id + '/deliver',
				headers: {
					'accept': 'application/json',
					'Content-Type': 'application/json',
					'X-API-KEY': this.ApiKey
				}
			};
			let response = (await axios(config)).data
			await client.query("COMMIT")
			if (response.success == true) {
				return new ResponseData(true, "", {})
			} else {
				return new ResponseData(false, response.error + " " + response.errorText, {})
			}
		} catch (error: any) {
			await client.query("ROLLBACK")
			throw new Error(error)
		}finally{
			client.release()
		}


	}



	// public async acceptOrder(invoiceId: any) {
	// 	try {
	// 		const client = await DB.excu.client();
	// 		let arrId = await InvoiceRepo.getInvoiceAgrigatorId(client, invoiceId);
	// 		const currentDate = new Date();
	// 		const currentUTCTime = currentDate.toISOString();
	// 		let config = {
	// 			method: 'POST',
	// 			url: 'https://pos_order_platform_url/orders/' + arrId.id + '/accepted',
	// 			headers: {
	// 				'accept': 'application/json',
	// 				'Content-Type': 'application/json',
	// 				'X-API-KEY': this.ApiKey
	// 			},
	// 			data: { "timestamp": currentUTCTime }
	// 		};

	// 		let response = (await axios(config)).data

	// 		if (response.success == true) {
	// 			return new ResponseData(true, "", {})
	// 		} else {
	// 			return new ResponseData(false, response.error + " " + response.errorText, {})
	// 		}


	// 	} catch (error: any) {

	// 		throw new Error(error)
	// 	}


	// }
	// public async rejecteOrder(invoiceId: any) {
	// 	try {
	// 		const client = await DB.excu.client();
	// 		let arrId = await InvoiceRepo.getInvoiceAgrigatorId(client, invoiceId);
	// 		const currentDate = new Date();
	// 		const currentUTCTime = currentDate.toISOString();
	// 		let config = {
	// 			method: 'POST',
	// 			url: 'https://pos_order_platform_url/orders/' + arrId.id + '/rejected',
	// 			headers: {
	// 				'accept': 'application/json',
	// 				'Content-Type': 'application/json',
	// 				'X-API-KEY': this.ApiKey
	// 			},
	// 			data: { reason: 'OTHER', "timestamp": currentUTCTime }
	// 		};

	// 		let response = (await axios(config)).data

	// 		if (response.success == true) {
	// 			return new ResponseData(true, "", {})
	// 		} else {
	// 			return new ResponseData(false, response.error + " " + response.errorText, {})
	// 		}


	// 	} catch (error: any) {

	// 		throw new Error(error)
	// 	}


	// }
	// public async startOrder(invoiceId: any) {
	// 	try {
	// 		const client = await DB.excu.client();
	// 		let arrId = await InvoiceRepo.getInvoiceAgrigatorId(client, invoiceId);
	// 		const currentDate = new Date();
	// 		const currentUTCTime = currentDate.toISOString();
	// 		let config = {
	// 			method: 'POST',
	// 			url: 'https://pos_order_platform_url/orders/' + arrId.id + '/started',
	// 			headers: {
	// 				'accept': 'application/json',
	// 				'Content-Type': 'application/json',
	// 				'X-API-KEY': this.ApiKey
	// 			},
	// 			data: { "timestamp": currentUTCTime }
	// 		};

	// 		let response = (await axios(config)).data

	// 		if (response.success == true) {
	// 			return new ResponseData(true, "", {})
	// 		} else {
	// 			return new ResponseData(false, response.error + " " + response.errorText, {})
	// 		}


	// 	} catch (error: any) {

	// 		throw new Error(error)
	// 	}


	// }


	// public async OrderPrepared(invoiceId: any) {
	// 	try {
	// 		const client = await DB.excu.client();
	// 		let arrId = await InvoiceRepo.getInvoiceAgrigatorId(client, invoiceId);
	// 		const currentDate = new Date();
	// 		const currentUTCTime = currentDate.toISOString();
	// 		let config = {
	// 			method: 'POST',
	// 			url: 'https://pos_order_platform_url/orders/' + arrId.id + '/prepared',
	// 			headers: {
	// 				'accept': 'application/json',
	// 				'Content-Type': 'application/json',
	// 				'X-API-KEY': this.ApiKey
	// 			},
	// 			data: { "timestamp": currentUTCTime }
	// 		};

	// 		let response = (await axios(config)).data

	// 		if (response.success == true) {
	// 			return new ResponseData(true, "", {})
	// 		} else {
	// 			return new ResponseData(false, response.error + " " + response.errorText, {})
	// 		}


	// 	} catch (error: any) {

	// 		throw new Error(error)
	// 	}


	// }
	// public async OrderDispatched(invoiceId: any) {
	// 	try {
	// 		const client = await DB.excu.client();
	// 		let arrId = await InvoiceRepo.getInvoiceAgrigatorId(client, invoiceId);
	// 		const currentDate = new Date();
	// 		const currentUTCTime = currentDate.toISOString();
	// 		let config = {
	// 			method: 'POST',
	// 			url: 'https://pos_order_platform_url/orders/' + arrId.id + '/dispatched',
	// 			headers: {
	// 				'accept': 'application/json',
	// 				'Content-Type': 'application/json',
	// 				'X-API-KEY': this.ApiKey
	// 			},
	// 			data: { "timestamp": currentUTCTime }
	// 		};

	// 		let response = (await axios(config)).data

	// 		if (response.success == true) {
	// 			return new ResponseData(true, "", {})
	// 		} else {
	// 			return new ResponseData(false, response.error + " " + response.errorText, {})
	// 		}


	// 	} catch (error: any) {

	// 		throw new Error(error)
	// 	}


	// }


	// public async OrderCompleted(invoiceId: any) {
	// 	try {
	// 		const client = await DB.excu.client();
	// 		let arrId = await InvoiceRepo.getInvoiceAgrigatorId(client, invoiceId);
	// 		const currentDate = new Date();
	// 		const currentUTCTime = currentDate.toISOString();
	// 		let config = {
	// 			method: 'POST',
	// 			url: 'https://pos_order_platform_url/orders/' + arrId.id + '/completed',
	// 			headers: {
	// 				'accept': 'application/json',
	// 				'Content-Type': 'application/json',
	// 				'X-API-KEY': this.ApiKey
	// 			},
	// 			data: { "timestamp": currentUTCTime }
	// 		};

	// 		let response = (await axios(config)).data

	// 		if (response.success == true) {
	// 			return new ResponseData(true, "", {})
	// 		} else {
	// 			return new ResponseData(false, response.error + " " + response.errorText, {})
	// 		}


	// 	} catch (error: any) {

	// 		throw new Error(error)
	// 	}


	// }


	public static async getGrubtechSettings(client: PoolClient, companyId: string) {
		try {
			const query = {
				text: `SELECT settings from "Plugins" where "pluginName"=$1 and "companyId"=$2 `,
				values: ['GrubTech', companyId]
			}

			let plugin = await client.query(query.text, query.values);
			let settings = plugin.rows && plugin.rows.length > 0 ? plugin.rows[0].settings : null
			return {
				settings: settings
			}

		} catch (error) {

		}
	}

	public static async updateGrubtechInvoiceStatus(client: PoolClient, invoiceId: string, status: string, companyId: string) {
		try {
			const pluginSettings = await this.getGrubtechSettings(client, companyId);
			if (pluginSettings) {
				const settings = new GrubTechSettings();
				settings.ParseJson(pluginSettings.settings)

				const grubTech = new grubtech();
				grubTech.ApiKey = settings.token;
				grubTech.serviceId = settings.serviceId;
				let resault;
				console.log("hereeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
				switch (status) {
					case 'Accepted':
						resault=await grubTech.orderStarted(client,invoiceId)
						break;
					case 'Rejected':
						resault= await grubTech.rejectOrder(client,invoiceId)

						break;
					default:
						break;
				}

				return resault;
			}
		} catch (errr: any) {
			let logger = new Logger({
				logGroupName: 'bezat',
				logStreamName: 'GrupTech',
				region: process.env.AWS_REGION,
				accessKeyId: process.env.AWS_ACCESS_KEY,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
				uploadFreq: 10000, 	// Optional. Send logs to AWS LogStream in batches after 10 seconds intervals.
				local: false 		// Optional. If set to true, the log will fall back to the standard 'console.log'.
			});

			logger.log("error in Gruptech :"+errr);
		}
	}

}