import { FileStorage } from "@src/utilts/fileStorage";
import { Socket } from "socket.io";
import { BranchesRepo } from "../admin/branches.repo";
import { CompanyRepo } from "../admin/company.repo";
import { DB } from "@src/dbconnection/dbconnection";


import { Company } from "@src/models/admin/company";
import { S3Storage } from "@src/utilts/S3Storage";
import { ResponseData } from "@src/models/ResponseData";
import { SocketController } from "@src/socket";
import { RedisClient } from "@src/redisClient";

import { PoolClient } from "pg";
import { VatPaymentRepo } from "../app/accounts/vatPayment.repo";
import { BranchValdation } from "@src/validationSchema/admin/branch.Schema";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";


export class SocketCompanyRepo {
    static redisClient: RedisClient;

    public static async getCompanyPrefrences(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        let companyId;
        try {
            let date: any;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }
            await dbClient.query("BEGIN")
            const company = await this.getCompanySettings(dbClient, branchId, date);

            // const companyId = (await BranchesRepo.getBranchCompanyId(branchId)).compayId;
            // const storage = new FileStorage();
            // // company.dataconsole.logo = await storage.getCompanyLogoBase64(companyId)

            companyId =  company.data ? company.data.id: null


            if (company.data != null) {
                const aggregators = await this.getAggregatorList(dbClient, branchId, date)

                company.data.aggregators = aggregators

                callback(JSON.stringify(company.data))

            } else {
                callback("");
            }
            await dbClient.query("COMMIT")


        } catch (error: any) {
            await dbClient.query("ROLLBACK")

          
            
            logPosErrorWithContext(error, data, branchId, companyId, "getCompanyPrefrences")

            callback(JSON.stringify(error.message))
        } finally {
            dbClient.release()

        }
    }


    public static async getCompanySettings(client: PoolClient, branchId: string, date: any) {


        try {

            const companyId: any = (await BranchesRepo.getBranchCompanyId(client, branchId)).compayId;

            // ["a",]
            // [{},{}]
            let query = `SELECT "Companies".id,
                                "Companies".name,
                                "Companies".translation,
                                "Companies".country,
                                "Companies".slug,
                                "Companies"."smallestCurrency",
                                "Companies"."roundingType",
                                "Companies"."options",
                                "Companies"."mediaId",
                                "Companies"."voidReasons",
                                "Companies"."vatNumber",
                                "Companies"."isInclusiveTax",
                                "Companies"."printingOptions",
                                "Companies"."invoiceOptions",
                                case when  "CustomizationSettings".id is null then  (  "Companies"."productOptions"->> 'customFields' )::jsonb else  ( "CustomizationSettings"."settings"->>'customFields')::jsonb  end as "customFields" ,
                                "Media".url as "mediaUrl",
                                "Media"."size",
                                "Branches"."zatca",
                                "Branches".id as "branchId",
                                "Branches"."workingHours",
                                "Branches"."name" as "branchName",
                                "Branches"."location" as "branchLocation",
                                "Branches"."address" as "branchAddress",
                                "Branches"."startSubscriptionDate",
                                "Branches"."endSubscriptionDate",
                          
                                    "Branches"."closingTime",
                                "Branches"."phoneNumber" 
                            FROM "Companies" 
                            left join "Media" on "Media".id = "Companies"."mediaId"
                            INNER JOIN "Branches" ON "Branches"."companyId" = "Companies".id  and "Branches".id = $2
                            LEFT JOIN "CustomizationSettings" ON "CustomizationSettings"."companyId" =  "Companies".id and "CustomizationSettings"."type" = 'product'
                            where "Companies".id =$1
                            `
            let values = [companyId, branchId];
            if (date != null) {
                query += ` AND ( "Companies"."updatedDate">= $3 or "Branches"."updatedTime">=$3)`
                values = [companyId, branchId, date]
            }

            const companyData = await client.query(query, values)


            if (companyData && companyData.rows && companyData.rows.length > 0) {
                let company = new Company();
                company.ParseJson(companyData.rows[0]);
                company.vatPaymentDate = await VatPaymentRepo.getLatestVatPaymentDate(company.id)
                const storage = new FileStorage();
                const companySettings = await storage.getCompanySettings(company.country)
                if (companySettings) {
                    company.settings = companySettings.settings
                }

                // if (company.customFields != null ) {
                //     company.customFields = JSON.parse(company.customFields)
                // }



                if (company.mediaUrl && company.mediaUrl.defaultUrl && company.mediaId) {

                    const mediaName = company.mediaUrl.defaultUrl.substring(company.mediaUrl.defaultUrl.lastIndexOf('/') + 1)
                    const extension = mediaName.split('.')[1]
                    const imageData = await S3Storage.getDefaultImageBase64(mediaName.split('.')[0], company.id, extension);
                    if (imageData) {
                        let imageTemp = imageData.media.split(';base64,').pop();
                        company.base64Image = imageTemp ?? "";
                    }
                }

                console.log(company)
                return new ResponseData(true, "", company)
            } else {
                return new ResponseData(true, "", null)
            }


        } catch (error: any) {
            console.log(error);

            throw new Error(error.message)
        }
    }
    public static async getCompanyLogo(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        try {
            await dbClient.query("BEGIN")
            const companyId = (await BranchesRepo.getBranchCompanyId(dbClient, branchId)).compayId;

            const storage = new FileStorage();
            const logo = await storage.getCompanyLogoBase64(companyId)
            const data = {
                logo: logo
            }
            await dbClient.query("COMMIT")
            callback(JSON.stringify(data))
        } catch (error: any) {
            await dbClient.query("ROLLBACK")

          

            callback(JSON.stringify(error.message))

            logPosErrorWithContext(error, data, branchId, null, "getCompanyLogo")

        } finally {
            dbClient.release()
        }
    }


    public static async getlabelTemplates(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client()
        let companyId;
        try {
            let date: any;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }
            /**Begin */
            await dbClient.query("BEGIN")
            companyId = (await BranchesRepo.getBranchCompanyId(dbClient, branchId)).compayId;

            const query: { text: string, values: any } = {
                text: `SELECT "LabelTemplates" .*
                      from "LabelTemplates" 
                      WHERE "LabelTemplates"."companyId" = $1`,
                values: [companyId]
            }

            if (date != null) {
                query.text = `SELECT "LabelTemplates" .*
                            from "LabelTemplates" 
                            WHERE "LabelTemplates"."companyId"  = $1 AND   "LabelTemplates"."updatedDate">=$2
                            
                            `;
                query.values = [companyId, date]
            }

            const list = await dbClient.query(query.text, query.values);
            /**COMMIT */
            await dbClient.query("COMMIT")

            callback(JSON.stringify(list.rows))
        } catch (error: any) {
            /**ROLLBACK */
            await dbClient.query("ROLLBACK")

          
            ;
            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, companyId, "getlabelTemplates")


        } finally {
            /**release */
            dbClient.release()
        }
    }
    public static async getRecieptTemplates(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        let companyId;
        try {


            let date: any;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }

            await dbClient.query("BEGIN");
            companyId = (await BranchesRepo.getBranchCompanyId(dbClient, branchId)).compayId;

            const query: { text: string, values: any } = {
                text: `SELECT "RecieptTemplates".id,
                              "recieptTemplate" ,
                              "RecieptTemplates".name ,
                              "templateType",
                              "RecieptTemplates"."createdAt", 
                              "RecieptTemplates" ."updatedDate"
                      from "RecieptTemplates" 
                      WHERE "RecieptTemplates"."companyId" = $1`,
                values: [companyId]
            }

            if (date != null) {
                query.text = `SELECT  "RecieptTemplates" .id,
                                      "RecieptTemplates"."recieptTemplate" ,
                                      "RecieptTemplates".name ,
                                      "RecieptTemplates"."templateType",
                                      "RecieptTemplates"."createdAt",
                                      "RecieptTemplates"."updatedDate"
                            from "RecieptTemplates" 
                            WHERE "RecieptTemplates"."companyId" = $1 AND  "RecieptTemplates"."updatedDate">=$2
                            
                            `;
                query.values = [companyId, date]
            }


            const list = await dbClient.query(query.text, query.values);
            await dbClient.query("COMMIT")
            callback(JSON.stringify(list.rows))
        } catch (error: any) {
            ;

          
            await dbClient.query("ROLLBACK")
            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, companyId, "getRecieptTemplates")
        } finally {
            dbClient.release()
        }
    }
    public static async labelTemplates(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client()
        let companyId;
        try {

            await dbClient.query("BEGIN")

            let date: any;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }
            const available = {
                text: `select JSON_AGG("LabelTemplates".id) as "ids" from "LabelTemplates" 
                    inner join "Branches" on "Branches"."companyId" = "LabelTemplates"."companyId"
                    where "Branches".id =$1
                   `,
                values: [branchId]
            }

            const labels = await dbClient.query(available.text, available.values);

            let ids: [] = labels && labels.rows && labels.rows.length > 0 ? (<any>labels.rows[0]).ids : []
            companyId = (await BranchesRepo.getBranchCompanyId(dbClient, branchId)).compayId;

            const query: { text: string, values: any } = {
                text: `SELECT "LabelTemplates" .*
                      from "LabelTemplates" 
                      WHERE "LabelTemplates"."companyId" = $1`,
                values: [companyId]
            }

            if (date != null) {
                query.text = `SELECT "LabelTemplates" .*
                            from "LabelTemplates" 
                            WHERE "LabelTemplates"."companyId"  = $1 AND   "LabelTemplates"."updatedDate">=$2
                            
                            `;
                query.values = [companyId, date]
            }

            const list = await dbClient.query(query.text, query.values);
            console.log({ success: true, ids: ids, list: list.rows })
            await dbClient.query("COMMIT")
            callback(JSON.stringify({ success: true, ids: ids, list: list.rows }))
        } catch (error: any) {
            console.log(error)
            await dbClient.query("ROLLBACK")
          
            callback(JSON.stringify({ success: false, err: error.message }))
            logPosErrorWithContext(error, data, branchId, companyId, "labelTemplates")
        } finally {
            dbClient.release()
        }
    }


    public static async recieptTemplates(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client()
        let companyId;
        try {

            await dbClient.query("BEGIN")

            let date: any;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }
            const available = {
                text: `select JSON_AGG("RecieptTemplates".id) as "ids" from "RecieptTemplates" 
                    inner join "Branches" on "Branches"."companyId" = "RecieptTemplates"."companyId"
                    where "Branches".id =$1
                   `,
                values: [branchId]
            }

            const labels = await dbClient.query(available.text, available.values);

            let ids: [] = labels && labels.rows && labels.rows.length > 0 ? (<any>labels.rows[0]).ids : []
            companyId = (await BranchesRepo.getBranchCompanyId(dbClient, branchId)).compayId;

            const query: { text: string, values: any } = {
                text: `SELECT "RecieptTemplates".id,
                              "recieptTemplate" ,
                              "RecieptTemplates".name ,
                              "templateType",
                              "RecieptTemplates"."createdAt", 
                              "RecieptTemplates" ."updatedDate"
                      from "RecieptTemplates" 
                      WHERE "RecieptTemplates"."companyId" = $1`,
                values: [companyId]
            }

            if (date != null) {
                query.text = `SELECT  "RecieptTemplates" .id,
                                      "RecieptTemplates"."recieptTemplate" ,
                                      "RecieptTemplates".name ,
                                      "RecieptTemplates"."templateType",
                                      "RecieptTemplates"."createdAt",
                                      "RecieptTemplates"."updatedDate"
                            from "RecieptTemplates" 
                            WHERE "RecieptTemplates"."companyId" = $1 AND  "RecieptTemplates"."updatedDate">=$2
                            
                            `;
                query.values = [companyId, date]
            }


            const list = await dbClient.query(query.text, query.values);
            console.log({ success: true, ids: ids, list: list.rows })
            await dbClient.query("COMMIT")
            callback(JSON.stringify({ success: true, ids: ids, list: list.rows }))
        } catch (error: any) {
            console.log(error)
            await dbClient.query("ROLLBACK")
          
            callback(JSON.stringify({ success: false, err: error.message }))
            logPosErrorWithContext(error, data, branchId, companyId, "recieptTemplates")

        } finally {
            dbClient.release()
        }
    }


    public static async getCompanyDeliveryAddresses(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        let companyId;
        try {
            /**Begin */
            await dbClient.query("BEGIN");
            /**Retrive barnch Company addresses alon with branch delivery addresses */
            const company: any = await CompanyRepo.getCompanyCountry(dbClient, branchId);
            companyId = company.id;
            let addresses = (await BranchesRepo.getBranchAddresses(dbClient, branchId, company)).data
            /**COMMIT */
            await dbClient.query("COMMIT");


            callback(JSON.stringify(addresses))
        } catch (error: any) {
            console.log(error)
            /**ROLLBACK */
            await dbClient.query("ROLLBACK");
            
          
            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, companyId, "getCompanyDeliveryAddresses")
        } finally {
            /**release */
            dbClient.release();
        }
    }
    public static async getCoveredAddresses(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        try {
            /**Retrive barnch coverd addresses */
            /**Begin */
            await dbClient.query("BEGIN")
            const addresses = await BranchesRepo.getBranchCoveredAddresses(dbClient, branchId);
            /**Commit */
            await dbClient.query("COMMIT")

            callback(JSON.stringify(addresses.data.coveredAddresses))

        } catch (error: any) {
            /**RollBack */
            await dbClient.query("ROLLBACK")
            ;

          
            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "getCoveredAddresses")
        } finally {
            /**Release */
            dbClient.release()
        }
    }

    //Live sync 
    public static async sendUpdateCompanySettings(client: PoolClient, companyId: string, branchIds: []) {
        let company;
        try {
            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                company = await this.getCompanySettings(client, branchId, null);
                companyId = company.data.id
                if (company.data != null) {
                    const aggregators = await this.getAggregatorList(client, branchId, null)
                    company.data.aggregators = aggregators
                }


                instance.io.of('/api').in(clientId).emit("updateCompanyPreferences", JSON.stringify(company));
            }

        } catch (error: any) {
          
            logPosErrorWithContext(error, company, null, companyId, "sendUpdateCompanySettings")

            return null;
        }
    }


    public static async getAggregatorList(client: PoolClient, branchId: string, date: any) {

        try {
            /**Retrive barnch coverd addresses */

            const companyId = (await BranchesRepo.getBranchCompanyId(client, branchId)).compayId;
            let query = {
                text: `select * from "Plugins" where "companyId" = $1
                and "Plugins".type ='Aggregator (Manual Entry)' and ("Plugins"."settings"->>'enable')::boolean = true`,
                values: [companyId]
            }

            // if(date!=null)
            // {
            //     query.text = ` select * from "Plugins" where "companyId" = $1
            //     and "updatedDate" > =$2
            //     and "Plugins".type ='Aggregator' and ("Plugins"."settings"->>'enable')::boolean = true `,
            //     query. values =[companyId,date]
            // }

            let aggregators = await client.query(query.text, query.values);
            return aggregators.rows


        } catch (error: any) {
            throw new Error(error)

        }
    }

    public static async getCompanyInfo(client: PoolClient, branchId: string) {
        try {
            const query = {
                text: `SELECT "Companies".id,country , "features" FROM "Companies"
                inner join "Branches" on "Branches"."companyId" = "Companies".id
                where "Branches".id =$1
                     `,
                values: [branchId]
            }

            let company = await client.query(query.text, query.values);
            return company.rows[0]
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async updateEcommerceSettings(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {

            if (data) {
                data = JSON.parse(data)
            }
            const validate = await BranchValdation.branchEcommerceSettingsValidation(data);
            if (!validate.valid) {
                callback(JSON.stringify(new ResponseData(false, validate.error, [])))
            }
            const query = {
                text: `Update "Branches"  set "ecommerceSettings" = $1  where  "Branches".id=$2 `,
                values: [data, branchId]
            }

            await DB.excu.query(query.text, query.values)
            callback(JSON.stringify(new ResponseData(true, "", [])))
        } catch (error: any) {
          
            
            callback(JSON.stringify(new ResponseData(false, error.message, [])))
            logPosErrorWithContext(error, data, branchId, null, "updateEcommerceSettings")


        }
    }


    public static async getEcommerceSettings(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {

            if (data) {
                data = JSON.parse(data)
            }

            const query = {
                text: `select  "ecommerceSettings"  from "Branches"  where  "Branches".id=$1  `,
                values: [branchId]
            }

            let settings = await DB.excu.query(query.text, query.values)
            callback(JSON.stringify(new ResponseData(true, "", settings.rows[0])))
        } catch (error: any) {
          
            
            callback(JSON.stringify(new ResponseData(false, error.message, [])))
     logPosErrorWithContext(error, data, data.branchId, null, "getEcommerceSettings")
        }
    }
}