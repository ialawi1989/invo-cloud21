import { DB } from "@src/dbconnection/dbconnection";
import { BranchesRepo } from "../admin/branches.repo";
import { Socket } from "socket.io";
import { SocketController } from "@src/socket";
import { RedisClient } from "@src/redisClient";

import { Estimate } from "@src/models/account/Estimate";
import { EstimateRepo } from "../app/accounts/estimate.repo";
import { TimeHelper } from "@src/utilts/timeHelper";
import { PoolClient } from "pg";
import { CompanyRepo } from "../admin/company.repo";
import { EstimateLine } from "@src/models/account/EstimateLine";
import { ResponseData } from "@src/models/ResponseData";
import { EstimateLineOption } from "@src/models/account/EstimateLineOption";
import { AccountsRepo } from "../app/accounts/account.repo";
import { SocketInvoiceRepo } from "./invoice.socket";
import { Customer } from "@src/models/account/Customer";
import { CustomerRepo } from "../callCenter/customer.repo";
import { terminalRepo } from "../app/terminal/terminal.repo";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";

export class SocketEstimateRepo {
    static redisClient: any;


    public static async checkEsitimateIdExists(client: PoolClient, estimateId: string, branchId: string) {
        try {
            const query: { text: string, values: any } = {
                text: 'SELECT COUNT(*) FROM "Estimates" where id =$1 and "branchId"=$2 ',
                values: [estimateId, branchId]
            }
            const estimate = await client.query(query.text, query.values);
            if ((<any>estimate.rows[0]).count > 0) {
                return true
            } else {
                return false
            }
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async checkEsitimateLineIdExists(client: PoolClient, estimateLineId: string, estimateId: string) {
        try {
            const query: { text: string, values: any } = {
                text: 'SELECT COUNT(*) FROM "EstimateLines" where id =$1 and "estimateId"=$2 ',
                values: [estimateLineId, estimateId]
            }
            const estimate = await client.query(query.text, query.values);
            if ((<any>estimate.rows[0]).count > 0) {
                return true
            } else {
                return false
            }
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async checkEsitimateLineOptionIdExists(client: PoolClient, estimateLineOptionId: string, estimateLineId: string) {
        try {
            const query: { text: string, values: any } = {
                text: 'SELECT COUNT(*) FROM "EstimateLineOptions" where id =$1 and "estimateLineId"=$2 ',
                values: [estimateLineOptionId, estimateLineId]
            }
            const estimate = await client.query(query.text, query.values);
            if ((<any>estimate.rows[0]).count > 0) {
                return true
            } else {
                return false
            }
        } catch (error: any) {
          

            throw new Error(error)
        }
    }



    public static async saveEstimate(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        try {
            if (data) {
                data = JSON.parse(data);
            }
            /**Begin Client */
            await dbClient.query("BEGIN")
            const companyId = (await BranchesRepo.getBranchCompanyId(dbClient, branchId)).compayId;
            const estimates = data;
            for (let index = 0; index < estimates.length; index++) {

                const element = estimates[index];
                element.branchId = branchId;
                element.source = "POS";

                element.estimateDate = await TimeHelper.convertToDate(element.estimateDate)
                element.createdAt = await TimeHelper.convertToDate(element.createdAt)


                const isEstimateIdExist = await this.checkEsitimateIdExists(dbClient, element.id, branchId);
                if (isEstimateIdExist) {
                    await this.editEstimate(dbClient, element, companyId)
                } else {
                    await this.addEstimate(dbClient, element, companyId)
                }

            }
            /**Commit Client */
            await dbClient.query("COMMIT")
            callback(JSON.stringify({ success: true }))
        } catch (error: any) {
            /**RollBack Client */
            await dbClient.query("ROLLBACK")
          
            

            callback(JSON.stringify({ success: false, error: error.message }))
        } finally {
            /**Release Client */
            dbClient.release()
        }
    }
    public static async addEstimate(client: PoolClient, data: any, companyId: string) {
        try {

            const afterDecimal = await CompanyRepo.getCompanyAfterDecimal(client, companyId);
            const estimate = new Estimate();
            estimate.ParseJson(data);
            estimate.calculateTotal(afterDecimal);

            if (estimate.estimateNumber) {
                const isEstimateNumberExist = await EstimateRepo.checkIsEstimateNumberExist(client, null, estimate.estimateNumber, companyId);

                if (isEstimateNumberExist) {
                    estimate.estimateNumber = 'D-' + estimate.estimateNumber
                    // throw new Error("Estimate Number Already Used")
                }
            }



            /** ADD NEW CUSTOMER IF NOT EXIST */
            if (estimate.customerId != null && estimate.customerId != "" && estimate.customerId != "null") {
                const isCustomerIdExist = await SocketInvoiceRepo.chekIfCustomerIdExists(client, estimate.customerId, companyId)
                if (!isCustomerIdExist) {
                    const customer = new Customer();
                    customer.ParseJson(estimate.customer);
                    customer.birthDay = await TimeHelper.convertToDate(customer.birthDay);
                    await CustomerRepo.addPosCustomer(client, customer, companyId)
                }
            } else {
                estimate.customerId = null
            }


            const query: { text: string, values: any } = {
                text: `INSERT INTO "Estimates" 
                               ( id,
                                 "estimateNumber",
                                 "refrenceNumber",
                                 total,
                                 note,
                                 guests,
                                 "employeeId",
                                 "tableId",
                                 "branchId",
                                 "customerId",
                                 "chargeTotal",
                                 "chargeAmount",
                                 "chargePercentage",
                                 "chargeId",
                                 "discountAmount",
                                 "discountPercentage",
                                 "discountId",
                                 "deliveryCharge",
                                 "subTotal",
                                 source,
                                 "estimateDate",
                                 "isInclusiveTax",
                                 "serviceId",
                                 "discountType"
                                 ) 
                        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING id `,
                values: [estimate.id,
                estimate.estimateNumber,
                estimate.refrenceNumber,
                estimate.total,
                estimate.note,
                estimate.guests,
                estimate.employeeId,
                estimate.tableId,
                estimate.branchId,
                estimate.customerId,
                estimate.chargeTotal,
                estimate.chargeAmount,
                estimate.chargePercentage,
                estimate.chargeId,
                estimate.discountAmount,
                estimate.discountPercentage,
                estimate.discountId,
                estimate.deliveryCharge,
                estimate.subTotal,
                estimate.source,
                estimate.estimateDate,
                estimate.isInclusiveTax,
                estimate.serviceId,
                estimate.discountType
                ]
            }
            await client.query(query.text, query.values);
            const accountId = (await AccountsRepo.getSalesId(client, estimate.branchId)).id;

            for (let index = 0; index < estimate.lines.length; index++) {
                const estimateLine = estimate.lines[index];
                estimateLine.accountId = accountId;
                estimateLine.index = index
                if (estimateLine.discountId == "") {
                    estimateLine.discountId = null;
                }
                await this.addEstimateLine(client, estimateLine, estimate, afterDecimal)

                if (estimateLine.options && estimateLine.options.length > 0) {
                    for (let index = 0; index < estimateLine.options.length; index++) {
                        const option = estimateLine.options[index];
                        await this.insertEstimateLineOption(client, option)
                    }
                }
            }

        } catch (error: any) {
          
            

            console.log(error)
            logPosErrorWithContext(error, data, data.branchId, companyId, "addEstimates")
            throw new Error(error)


        }
    }
    public static async editEstimate(client: PoolClient, data: any, companyId: string) {

        try {
            // const validate = await EstimateValidation.estimateValidation(data);
            // if (!validate.valid) {
            //     throw new Error(validate.error);
            // }

            if (data.id == "" || data.id == null) {
                throw new Error("Invoice Id is Required")
            }


            const afterDecimal = await CompanyRepo.getCompanyAfterDecimal(client, companyId);
            const estimate = new Estimate();
            estimate.ParseJson(data);
            estimate.calculateTotal(afterDecimal)
            if (estimate.customerId != null && estimate.customerId != "" && estimate.customerId != "null") {
                const isCustomerIdExist = await SocketInvoiceRepo.chekIfCustomerIdExists(client, estimate.customerId, companyId)
                if (!isCustomerIdExist) {
                    const customer = new Customer();
                    customer.ParseJson(estimate.customer);
                    customer.birthDay = await TimeHelper.convertToDate(customer.birthDay);
                    await CustomerRepo.addPosCustomer(client, customer, companyId)
                }
            } else {
                estimate.customerId = null
            }

            const query: { text: string, values: any } = {
                text: `UPDATE  "Estimates" SET  
                                      "estimateNumber"=$1,
                                      "refrenceNumber"=$2,
                                       total=$3,
                                       note=$4,
                                       guests=$5,
                                       "tableId"=$6,
                                       "customerId"=$7,
                                       "chargeTotal"=$8,
                                       "chargeAmount"=$9,
                                       "chargePercentage"=$10,
                                       "chargeId"=$11,
                                       "discountAmount"=$12,
                                       "discountPercentage"=$13,
                                       "discountId"=$14,
                                       "deliveryCharge"=$15,
                                       "subTotal"=$16,
                                       "estimateDate"=$17,
                                       "updatedDate"=$18,
                                       "isInclusiveTax"=$19,
                                       "discountType"=$20,
                                       "onlineData" = jsonb_set(
                                        jsonb_set("onlineData", '{rejectReason}', to_jsonb($21::text)),
                                        '{onlineStatus}',
                                        to_jsonb($22::text)
                                    )
                                WHERE  id=$23 AND "branchId"=$24`,
                values: [estimate.estimateNumber,
                estimate.refrenceNumber,
                estimate.total,
                estimate.note,
                estimate.guests,
                estimate.tableId,
                estimate.customerId,
                estimate.chargeTotal,
                estimate.chargeAmount,
                estimate.chargePercentage,
                estimate.chargeId,
                estimate.discountAmount,
                estimate.discountPercentage,
                estimate.discountId,
                estimate.deliveryCharge,
                estimate.subTotal,
                estimate.estimateDate,
                estimate.updatedDate,
                estimate.isInclusiveTax,
                estimate.discountType,
                estimate.rejectReason,
                estimate.onlineStatus,
                estimate.id,
                estimate.branchId
                ]
            }

            await client.query(query.text, query.values);
            const accountId = (await AccountsRepo.getSalesId(client, estimate.branchId)).id;

            for (let index = 0; index < estimate.lines.length; index++) {
                const estimateLine = estimate.lines[index];
                estimateLine.accountId = accountId
                if (estimateLine.discountId == "") {
                    estimateLine.discountId = null;
                }
                estimateLine.accountId = accountId;
                if (estimateLine.discountId == "") {
                    estimateLine.discountId = null;
                }
                estimateLine.index = index
                await this.addEstimateLine(client, estimateLine, estimate, afterDecimal)




            }


            return new ResponseData(true, "Updated Successfully", [])

        } catch (error: any) {
          
            

            console.log(error)
            throw new Error(error)
        }
    }



    public static async addEstimateLine(client: PoolClient, estimateLine: EstimateLine, estimate: Estimate, afterDecimal: number) {
        try {
            estimateLine.createdAt = TimeHelper.convertToDate(estimateLine.createdAt)
            estimateLine.serviceDate = TimeHelper.convertToDate(estimateLine.serviceDate)

            estimateLine.estimateId = estimate.id;
            estimateLine.branchId = estimate.branchId;
            const accountId = (await AccountsRepo.getSalesId(client, estimate.branchId)).id;
            estimateLine.accountId = accountId
            const isLineIdExist = await this.checkEsitimateLineIdExists(client, estimateLine.id, estimateLine.estimateId)
            estimateLine.salesEmployeeId = estimateLine.salesEmployeeId?.trim() == "" ? null : estimateLine.salesEmployeeId
            if (estimateLine.qty == 0) {
                if (isLineIdExist) {
                    await EstimateRepo.deleteLine(client, estimateLine.id)
                    return
                } else { /** don't save lines with 0 qty  */
                    return
                }
            }

            if (isLineIdExist) {
                await this.updateEstimateLine(client, estimateLine)
            } else {

                await this.insertEstimateLine(client, estimateLine)
            }

            for (let index = 0; index < estimateLine.options.length; index++) {
                const option = estimateLine.options[index];
                const isOptionIdExist = await this.checkEsitimateLineOptionIdExists(client, option.id, estimateLine.id)
                if (isOptionIdExist) {
                    await this.updateEstimateLineOption(client, option)
                } else {
                    await this.insertEstimateLineOption(client, option)
                }
            }
        } catch (error: any) {

          
            

            throw new Error(error)
        }
    }
    public static async insertEstimateLine(client: PoolClient, estimateLine: EstimateLine) {
        try {

            const query: { text: string, values: any } = {
                text: `INSERT INTO "EstimateLines" 
                               ( id,
                                 "estimateId",
                                  total,
                                  price,
                                  qty,
                                  "productId",
                                  "employeeId",
                                  "serviceDuration",
                                  "serviceDate",
                                  note,
                                  "discountAmount",
                                  "discountPercentage",
                                  "discountTotal",
                                  "taxPercentage",
                                  "taxId",
                                  "subTotal",
                                   batch,
                                  serial ,
                                  "accountId",
                                  "seatNumber",
                                  "isInclusiveTax",
                                  taxes,
                                  "taxType",
                                  "taxTotal",
                                  "discountType",
                                  "salesEmployeeId",
                                   "index") 
                   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) RETURNING id`,
                values: [
                    estimateLine.id,
                    estimateLine.estimateId,
                    estimateLine.total,
                    estimateLine.price,
                    estimateLine.qty,
                    estimateLine.productId,
                    estimateLine.employeeId,
                    estimateLine.serviceDuration,
                    estimateLine.serviceDate,
                    estimateLine.note,
                    estimateLine.discountAmount,
                    estimateLine.discountPercentage,
                    estimateLine.discountTotal,
                    estimateLine.taxPercentage,
                    estimateLine.taxId,
                    estimateLine.subTotal,
                    estimateLine.batch,
                    estimateLine.serial,
                    estimateLine.accountId,
                    estimateLine.seatNumber,
                    estimateLine.isInclusiveTax,
                    JSON.stringify(estimateLine.taxes),
                    estimateLine.taxType,
                    estimateLine.taxTotal,
                    estimateLine.discountType,
                    estimateLine.salesEmployeeId,
                    estimateLine.index
                ]
            }

            const insertInvoiceLine = await client.query(query.text, query.values);
            estimateLine.id = (<any>insertInvoiceLine.rows[0]).id

            return new ResponseData(true, "", { id: estimateLine.id })
        } catch (error: any) {
            console.log(error)
          
            
            throw new Error(error)
        }
    }
    public static async updateEstimateLine(client: PoolClient, estimateLine: EstimateLine) {
        try {
            estimateLine.salesEmployeeId = estimateLine.salesEmployeeId?.trim() == "" ? null : estimateLine.salesEmployeeId
            const query: { text: string, values: any } = {
                text: `UPDATE "EstimateLines" SET 
                                      total=$1,
                                      price=$2,
                                      qty=$3,
                                      "serviceDate"=$4 ,
                                      "serviceDuration"=$5,
                                      note=$6,
                                      "discountAmount"=$7,
                                      "discountPercentage"=$8,
                                      "discountTotal"=$9,
                                      "taxPercentage"=$10,
                                      "taxId"=$11,
                                      "subTotal"=$12,
                                      batch=$13,
                                      serial=$14,
                                      "discountId" = $15,
                                      "seatNumber"=$16,
                                      "isInclusiveTax"=$17,
                                      taxes=$18,
                                      "taxType"=$19,
                                      "taxTotal" = $20,
                                      "discountType"=$21,
                                      "salesEmployeeId"=$22,
                                      "index" = $23
                    WHERE "estimateId"=$24 AND id=$25`,
                values: [estimateLine.total,
                estimateLine.price,
                estimateLine.qty,
                estimateLine.serviceDate,
                estimateLine.serviceDuration,
                estimateLine.note,
                estimateLine.discountAmount,
                estimateLine.discountPercentage,
                estimateLine.discountTotal,
                estimateLine.taxPercentage,
                estimateLine.taxId,
                estimateLine.subTotal,
                estimateLine.batch,
                estimateLine.serial,
                estimateLine.discountId,
                estimateLine.seatNumber,
                estimateLine.isInclusiveTax,
                JSON.stringify(estimateLine.taxes),
                estimateLine.taxType,
                estimateLine.taxTotal,
                estimateLine.discountType,
                estimateLine.salesEmployeeId,
                estimateLine.index,
                estimateLine.estimateId,
                estimateLine.id]
            }
            await client.query(query.text, query.values);
            return new ResponseData(true, "Updated Successfully", [])
        } catch (error: any) {
            console.log(error)

          
            

            throw new Error(error)
        }
    }



    public static async insertEstimateLineOption(client: PoolClient, estimateLineOption: EstimateLineOption) {
        try {

            const query: { text: string, values: any } = {
                text: `INSERT INTO "EstimateLineOptions" 
                                   ( id,
                                    "estimateLineId",
                                    price,
                                    qty,
                                    note,
                                    "optionId") 
                        VALUES($1,$2,$3,$4,$5,$6) RETURNING id `,
                values: [estimateLineOption.id, estimateLineOption.estimateLineId, , estimateLineOption.price, estimateLineOption.qty, estimateLineOption.note, estimateLineOption.optionId]
            }
            await client.query(query.text, query.values)
        } catch (error: any) {
          
            

            throw new Error(error)
        }
    }
    public static async updateEstimateLineOption(client: PoolClient, estimateLineOption: EstimateLineOption) {
        try {
            const query: { text: string, values: any } = {
                text: `UPDATE  "EstimateLineOptions" SET 
                                           price = $1 ,
                                           qty=$2,
                                           note=$3 
                                WHERE id = $4 
                                AND "invoiceLineId" =$5 
                                AND "optionId" =$6 `,
                values: [estimateLineOption.price, estimateLineOption.qty, estimateLineOption.note, estimateLineOption.id, estimateLineOption.estimateLineId, estimateLineOption.optionId]
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
          
            

            throw new Error(error)
        }
    }


    //Live Sync 
    //TODO:UPDATE ESTIMATE
    public static async sendEstimate(branchId: string, estimate: Estimate) {
        const instance = SocketController.getInstance();
        this.redisClient = RedisClient.getRedisClient()
        const clientId: any = await this.redisClient.get("Socket" + branchId);
        try {
            instance.io.of('/api').in(clientId).emit("newEstimate", JSON.stringify(estimate));
        } catch (error) {

            instance.io.of('/api').in(clientId).emit("newEstimate", JSON.stringify({ success: false, error: error }));
        }
    }

    public static async sendUpdateEstimate(branchId: string, estimate: Estimate) {
        const instance = SocketController.getInstance();
        this.redisClient = RedisClient.getRedisClient()
        const clientId: any = await this.redisClient.get("Socket" + branchId);
        try {
            instance.io.of('/api').in(clientId).emit("updateEstimate", JSON.stringify(estimate));
        } catch (error) {

            instance.io.of('/api').in(clientId).emit("updateEstimate", JSON.stringify({ success: false, error: error }));
        }
    }
    public static async getPosEstimate(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        try {

            await dbClient.query("BEGIN")
            let date: any;
            if (data) {
                data = JSON.parse(data)
                date = new Date()
                date.setTime(data.date);

            }

            let query: { text: string, values: any } = {
                text: `Select * from "Estimates" where source=$1 and "branchId"=$2`,
                values: ['POS', branchId]
            }

            if (date != null) {
                query.text = `Select * from "Estimates" where source=$1 and "branchId"=$2 and "updatedDate" >$3 `
                query.values = ['POS', branchId, date]
            }

            const estimates: any = await dbClient.query(query.text, query.values);
            let estimateList = [];
            for (let index = 0; index < estimates.rows.length; index++) {
                const element = estimates.rows[index];
                let estimate = new Estimate();
                estimate.ParseJson(element);

                query.text = `SELECT * FROM "EstimateLines" where "estimateId"=$1`
                query.values = [element.id]

                const lines = await dbClient.query(query.text, query.values)
                for (let index = 0; index < lines.rows.length; index++) {
                    const lineData = lines.rows[index];
                    let line = new EstimateLine();
                    line.ParseJson(lineData)

                    query.text = `SELECT * FROM "EstimateLineOptions" where "estimateLineId" =$1`
                    query.values = [line.id];
                    let options = await dbClient.query(query.text, query.values);
                    line.options = options.rows;
                    estimate.lines.push(line)
                }

                estimateList.push(estimate);
            }
            await dbClient.query("COMMIT")
            callback(JSON.stringify({ success: true, data: estimateList }))

        } catch (error: any) {
          
            await dbClient.query("ROLLBACK")

     

            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, branchId, null, "getPosEstimate")
        } finally {
            dbClient.release();
        }
    }

    public static async getLatestEstimate(dbClient: PoolClient, branchId: string) {
        try {
            let prefix = await terminalRepo.getTeminalPrefix(branchId);
            let prefixTerm = prefix + '%';

            const query: { text: string, values: any } = {
                text: `SELECT * FROM "Estimates" 
                            where "Estimates"."branchId"=$1 
                            AND "Estimates".source = 'POS' 
                            and "estimateNumber" like $2   
                            and regexp_replace("estimateNumber", $3, '') ~ '^[0-9]+$'
                            ORDER BY regexp_replace("estimateNumber", $3, '')::int desc  LIMIT 1`,
                values: [branchId, prefixTerm, prefix + '-']
            }
            let latestEstimate = await dbClient.query(query.text, query.values);
            return latestEstimate.rows[0]
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getRecoverDbEstimate(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client(500);
        try {
            let date: any;
            if (data) {
                data = JSON.parse(data)
                date = new Date()
                date.setTime(data.date);

            }

            callback(JSON.stringify({ success: true, data: [] }))

            return;
            await dbClient.query("BEGIN");

            let ids = await this.getEstimatesRecoverIds(dbClient, branchId)
            console.log("getRecoverDbEstimate", ids)
            // /**Return Open Estimates that are not converted to invoice */
            const query: { text: string, values: any } = {
                text: `select  "Estimates".* 
                from "Estimates" 
                 where "Estimates".id = any($1)`,
                values: [ids]
            }


            let estimates: any = await dbClient.query(query.text, query.values);
            let estimateList = [];
            // let estimateTemps = estimates.rows && estimates.rows.length > 0 ? estimates.rows : [];
            // /** */


            // let latestEstimate = await this.getLatestEstimate(dbClient, branchId);

            // if (estimateTemps.length > 0) {
            //     if (latestEstimate != null) {
            //         let isEstimateExist = estimateTemps.find((f: any) => f.id == latestEstimate.id)
            //         if (!isEstimateExist && latestEstimate) {
            //             estimates.rows.push(latestEstimate);
            //         }

            //     }

            //     estimates = estimates.rows
            // } else {
            //     estimates = latestEstimate ?? []
            // }


            for (let index = 0; index < estimates.length; index++) {
                const element = estimates[index];
                let estimate = new Estimate();
                estimate.ParseJson(element);
                query.text = `SELECT * FROM "EstimateLines" where "estimateId"=$1`
                query.values = [element.id]
                const lines = await dbClient.query(query.text, query.values)

                for (let index = 0; index < lines.rows.length; index++) {
                    const lineData = lines.rows[index];
                    const line = new EstimateLine();
                    line.ParseJson(lineData);
                    query.text = `SELECT * FROM "EstimateLineOptions" where "estimateLineId" =$1`;
                    query.values = [line.id];
                    let options = await dbClient.query(query.text, query.values);
                    line.options = options.rows;
                    estimate.lines.push(line);

                }

                estimateList.push(estimate);
            }

            callback(JSON.stringify({ success: true, data: estimateList }))
            await dbClient.query("COMMIT");

        } catch (error: any) {
          
            await dbClient.query("ROLLBACK");
            ;
            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, branchId, null, "getRecoverDbEstimate")
        } finally {
            dbClient.release();
        }
    }


    public static async getEstimatesPlacedOrders(client: Socket, data: any, branchId: string, callback: any) {
        const dBClient = await DB.excu.client();
        try {

            /**Begin */

            await dBClient.query("BEGIN")
            const query: { text: string, values: any } = {
                text: `
                SELECT 
                "Estimates".id,
                "Estimates"."estimateNumber",
                "Estimates"."refrenceNumber",
                "Estimates"."total",
                "Estimates"."note",
                "Estimates"."guests",
                "Estimates"."branchId",
                "Estimates"."employeeId",
                "Estimates"."tableId",
                "Estimates"."createdAt",
                "Estimates"."source",
                "Estimates"."serviceId",
                "Estimates"."customerId",
                "Estimates"."customerContact",
                "Estimates"."discountId",
                "Estimates"."discountAmount",
                "Estimates"."discountPercentage",
                "Estimates"."discountTotal",
                "Estimates"."chargeId",
                "Estimates"."chargeAmount",
                "Estimates"."chargePercentage",
                "Estimates"."chargeTotal",
                "Estimates"."subTotal",
                "Estimates"."deliveryCharge",
                "Estimates"."estimateDate",
                "Estimates"."updatedDate",
                "Estimates"."roundingType",
                "Estimates"."roundingTotal",
                "Estimates"."smallestCurrency",
                "Estimates"."isInclusiveTax",
                "Estimates"."discountType",
                "Estimates"."onlineData"->>'onlineStatus' as "onlineStatus"
                     FROM "Estimates"
                     where "onlineData"->>'onlineStatus' = 'Placed' AND "branchId"=$1`,
                values: [branchId]
            }

            let Estimates = await dBClient.query(query.text, query.values);



            let ids: any[] = [];
            let customeIds: any[] = [];
            let estimateData = Estimates.rows ?? []

            let estimateList: Estimate[] = [];

            if (estimateData.length > 0) {

                /**===================== Parse estimates ==========================*/
                let estimateTemp;
                estimateData = estimateData.map(f => {
                    estimateTemp = new Estimate()
                    estimateTemp.ParseJson(f)
                    estimateTemp.onlineStatus = 'Pending'
                    ids.push(estimateTemp.id)
                    customeIds.push(estimateTemp.customerId);
                    return estimateTemp
                })
                /**===================== Get Lines ==========================*/
                query.text = `SELECT * FROM "EstimateLines" where "estimateId"=any($1)`;
                query.values = [ids]

                let lines = await dBClient.query(query.text, query.values);
                let lineData = lines.rows ?? []
                /** invoice line ids */
                let lineIds: any[] = []
                if (lineData.length > 0) {
                    lineData.forEach(element => {
                        lineIds.push(element.id)
                    });

                    /**===================== Get Options ==========================*/
                    query.text = `SELECT * FROM "EstimateLineOptions" WHERE "estimateLineId"=any($1)`,
                        query.values = [lineIds];
                    let optionData = await dBClient.query(query.text, query.values);
                    /**===================== Map Options with lines  ==========================*/
                    let options = optionData.rows
                    lineData = lineData.map((f) => {
                        let lineOption = options.filter(item => { item.estimateLineId == f.id })

                        if (lineOption) {
                            f.options = lineOption
                        } else {
                            f.options = []
                        }
                        return f
                    })

                    /**===================== Map Lines with estimates  ==========================*/
                    estimateData = estimateData.map(invo => {
                        let lineTemp = lineData.filter((item) => item.estimateId == invo.id)


                        if (lineTemp) {
                            let pareseLine;
                            lineTemp = lineTemp.map(line => {
                                pareseLine = new EstimateLine();
                                pareseLine.ParseJson(line)

                                return pareseLine
                            });
                            invo.lines = lineTemp
                        } else {
                            invo.lines = []
                        }
                        console.log(lineTemp)
                        return invo
                    })
                    /**===================== Map Customers with estimates  ==========================*/

                    if (customeIds.length > 0) {
                        query.text = `SELECT * FROM "Customers" WHERE "id"=any($1)`,
                            query.values = [customeIds];
                        let customerData = await dBClient.query(query.text, query.values);
                        if (customerData.rows && customerData.rows.length > 0) {

                            let customers = customerData.rows

                            estimateData = estimateData.map(f => {
                                let customerTemp = customers.find(item => item.id == f.customerId)
                                if (customerTemp) {
                                    f.customer = customerTemp
                                }

                                return f
                            })
                        }
                    }

                    estimateList = estimateData
                }

            }


            /**Commit */
            await dBClient.query("COMMIT")
            callback(JSON.stringify(estimateList))
        } catch (error: any) {
            /**RollBack */
            console.log(error)
            await dBClient.query("ROLLBACK")
          
            ;

            callback(JSON.stringify(error))
            logPosErrorWithContext(error, data, branchId, null, "getEcommercePlacedEstimates")

        } finally {
            /**Release */
            dBClient.release()
        }
    }



    public static async sendOnlineEstimate(estimate: Estimate) {
        try {


            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient();


            estimate.onlineStatus = "Pending"

            const clientId: any = await this.redisClient.get("Socket" + estimate.branchId);
            if (clientId == "" || clientId == null || clientId == undefined) {
                
            }
            instance.io.of('/api').in(clientId).emit("ecommerceEstimate", JSON.stringify(estimate));
            // instance.io.of('/api').on("ecommerceInvoiceCallback", async (data: any) => {
            //     data = JSON.parse(data)
            //     console.log("ecommerceInvoiceCallback")
            //     if (data.success && invoice.onlineStatus) {
            //         await InvoiceRepo.setInvoiceStatus(data.invoiceId, invoice.onlineStatus)
            //     }
            // })
        } catch (error: any) {
          
            console.log(error)
            throw new Error(error)
        }
    }

    public static async getEstimatesRecoverIds(client: PoolClient, branchId: string) {
        try {
            const query = {
                text: `with "values" as(
                                select 
                                $1::uuid as "branchId"
                                ),"openCashiers" as (
                                select distinct "Cashiers".id from "Cashiers"
                                JOIN "values" on true
                                where "cashierOut" is null 
                                and "Cashiers"."branchId" = "values"."branchId"
                                ),"cashierPayments" as (
                                select  distinct "InvoicePayments".id from "InvoicePayments" 
                                join "values" on true 
                                join "openCashiers" on "openCashiers".id = "InvoicePayments"."cashierId"
                                where "InvoicePayments"."branchId" = "values"."branchId"
                                ),"invoices" as (
                                select distinct "Invoices".id from "Invoices"
                                join "values" on true
                                left join "InvoicePaymentLines" on "InvoicePaymentLines"."invoiceId" = "Invoices".id 
                                left join "cashierPayments"  on "cashierPayments"."id" =  "InvoicePaymentLines"."invoicePaymentId" 
                                where "Invoices"."branchId" = "values"."branchId"
                                and ("Invoices".status = 'Open' or "cashierPayments".id is not null)
                                ), "latestCreditNote" as (
                                select "Invoices".id from "CreditNotes" 
                                join "values" on true
                                inner join "Terminals" on "Terminals"."branchId" = "values"."branchId"
                                inner join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId"
                                where "Terminals"."token" is not null
                                and split_part("creditNoteNumber", '-', 1) = "Terminals"."prefix"
                                and "CreditNotes"."branchId" = "values"."branchId"
                                order by split_part("creditNoteNumber", '-', -1)::numeric desc 
                                limit 1 
                                )
                                , "latestEstimate" as (
                                select "Invoices".id from "Estimates" 
                                join "values" on true
                                inner join "Terminals" on "Terminals"."branchId" = "values"."branchId"
                                inner join "Invoices" on "Invoices"."estimateId" = "Estimates".id 
                                where "Terminals"."token" is not null
                                and split_part("estimateNumber", '-', 1) = "Terminals"."prefix"
                                and "Estimates"."branchId" = "values"."branchId"	
                                order by split_part("estimateNumber", '-', -1)::numeric desc 
                                limit 1 
                                )
                                , "lastInvoice" as (
                                select  "Invoices".id  from "Invoices"
                                join "values" on true
                                inner join "Terminals" on "Terminals"."branchId" = "values"."branchId"
                                where "Terminals"."token" is not null
                                and split_part("invoiceNumber", '-', 1) = "Terminals"."prefix"
                                and "Invoices"."branchId" = "values"."branchId"
                                order by split_part("invoiceNumber", '-', -1)::numeric desc 
                                limit 1 
                                ),"invoiceIds" as (
                                select * from "invoices"
                                union all 
                                select * from "lastInvoice"
                                union all 
                                select * from "latestEstimate"
                                union all 
                                select * from "latestCreditNote"
                                ),"estimates" as (
                                select "Estimates".id from "Estimates"
                                join "values" on true
                                left join "Invoices" on "Estimates".id = "Invoices"."estimateId"
                                where "Estimates"."branchId" = "values"."branchId"
                                and (("Invoices".id is null and "Estimates".source = 'POS' ) or ("Invoices".id = any (select * from "invoiceIds")) )
                                )

                                select JSON_AGG( "estimates".id) as  "estimateIds" from "estimates"`,

                values: [branchId]
            }


            let creditNotes = await client.query(query.text, query.values);

            return creditNotes.rows && creditNotes.rows.length > 0 ? creditNotes.rows[0].estimateIds : []
        } catch (error: any) {
            throw new Error(error)
        }
    }
}