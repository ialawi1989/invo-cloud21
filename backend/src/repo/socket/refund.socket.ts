import { DB } from "@src/dbconnection/dbconnection";
import { Refund } from "@src/models/account/Refund";
import { RefundLine } from "@src/models/account/RefundLine";
import { RedisClient } from "@src/redisClient";
import { SocketController } from "@src/socket";
import { TimeHelper } from "@src/utilts/timeHelper";
import { RefundValidation } from "@src/validationSchema/account/refund.schema";
import { PoolClient } from "pg";
import { Socket } from "socket.io";
import { BranchesRepo } from "../admin/branches.repo";
import { CompanyRepo } from "../admin/company.repo";
import { PaymnetMethodRepo } from "../app/accounts/paymentMethod.repo";
import { ViewQueue } from "@src/utilts/viewQueue";
import { SocketInvoiceRepo } from "./invoice.socket";

import { SocketEstimateRepo } from "./Estimate.socket";
import { TriggerQueue } from "../triggers/triggerQueue";
import { ResponseData } from "@src/models/ResponseData";
import { SocketErrorLogs, SocketLogs } from "./socketErrorLogs";
import { CustomerBalanceQueue } from "../triggers/userBalancesQueue";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";

export class SocketRefund {
    static redisClient: any;

    public static async checkIfCreditNoteRefundExist(client: PoolClient, id: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT COUNT(*) FROM "CreditNoteRefunds" where id =$1`,
                values: [id]
            }

            let refunds = await client.query(query.text, query.values);
            if (refunds && refunds.rows && refunds.rows.length > 0 && refunds.rows[0].count > 0) {
                return true
            }
            return false;
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async saveRefund(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dBClient = await DB.excu.client();
        try {
            if (data) {
                data = JSON.parse(data);
            }
            /**Begin Client */
            await dBClient.query("BEGIN")

            const refunds = data;
            const companyId = (await BranchesRepo.getBranchCompanyId(dBClient, branchId)).compayId;
            const refundIds: any[] = [];
            const socketLogs = new SocketLogs()
            socketLogs.dbTable = "Credit Note Refunds"
            socketLogs.branchId = branchId;
            socketLogs.compnayId = companyId

            for (let index = 0; index < refunds.length; index++) {
                const element = refunds[index];
                element.branchId = branchId;
                element.refundDate = await TimeHelper.convertToDate(element.createdAt)
                element.createdAt = await TimeHelper.convertToDate(element.createdAt)
                let lines: any[] = [];

                // element.lines.forEach((line:any) => {
                //     lines.push(line.id)
                // });

                let checkCreditNoteIds = await this.checkIfCreditNoteIdExist(dBClient, [element.creditNoteId])
                if (!checkCreditNoteIds) {
                    socketLogs.logs.push({ error: "Credit Note Id is not exist", data: element })
                    await SocketErrorLogs.setLogs(dBClient, socketLogs)
                    continue;
                }
                let isRefundExist = await this.checkIfCreditNoteRefundExist(dBClient, element.id)
                let resault;
                if (!isRefundExist) {
                    resault = await this.addRefund(dBClient, element, companyId)

                }

                if (resault && resault.success == false) {
                    socketLogs.logs.push({ error: resault.msg, data: element })
                    await SocketErrorLogs.setLogs(dBClient, socketLogs)
                    continue;
                }

                refundIds.push(element.id)
            }
            /**Commit Client */
            await dBClient.query("COMMIT")
            if (refundIds.length > 0) {
                let queueInstance = TriggerQueue.getInstance();
                queueInstance.createJob({ type: "CreditNoteRefunds", id: refundIds, companyId: companyId })

                let userBalancesQueue = CustomerBalanceQueue.getInstance();
                refundIds.forEach(async (refundId) => {

                    userBalancesQueue.createJob({ transactionId: refundId, dbTable: 'CreditNoteRefunds' })

                })
            }



            callback(JSON.stringify({ success: true }))
            const queue = ViewQueue.getQueue();
            queue.pushJob()
        } catch (error: any) {
            /**ROLLBACK Client */
            await dBClient.query("ROLLBACK")
          
            ;
            let errorOpject = JSON.parse(error.message)
            let refundId = errorOpject.refundId ?? ""
            callback(JSON.stringify({ success: false, error: error.message, refundId: refundId }))

        } finally {
            /**Release Client */
            dBClient.release()
        }
    }
    public static async addRefund(client: PoolClient, data: any, companyId: string) {
        try {
            const validate = await RefundValidation.validateRefund(data);
            if (!validate.valid) {
                throw new Error(validate.error);
            }
            const refund = new Refund();
            refund.ParseJson(data);

            const afterDecimal = await CompanyRepo.getCompanyAfterDecimal(client, companyId);

            refund.calculateTotal(afterDecimal);
            const creditNoteBalance = await (await this.getCreditNoteBalance(client, refund.creditNoteId)).data
            if (creditNoteBalance && creditNoteBalance.success) {
                if (creditNoteBalance.balance < refund.total) {
                    return new ResponseData(false, "Refund Total Exceed credit note balance total" + refund.total + " balance = " + refund.total, [])
                }

            } else if (creditNoteBalance && creditNoteBalance.success == false) {
                return creditNoteBalance
            }


            const query: { text: string, values: any } = {
                text: `INSERT INTO "CreditNoteRefunds" ("id","employeeId","branchId",total,"createdAt","creditNoteId","refrenceNumber","description","refundDate","cashierId","companyId")
                                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
                values: [refund.id, refund.employeeId, refund.branchId, refund.total, refund.createdAt, refund.creditNoteId, refund.refrenceNumber, refund.description, refund.refundDate, refund.cashierId, companyId]
            }

            const insert = await client.query(query.text, query.values)
            refund.id = insert.rows[0].id;
            for (let index = 0; index < refund.lines.length; index++) {
                const element = refund.lines[index];
                element.creditNoteRefundId = refund.id
                await this.addRefundLine(client, element, refund.branchId)
            }

        } catch (error: any) {
          
            ;
            console.log(error)
            logPosErrorWithContext(error, data, data.branchId, companyId, "addRefund")

            throw new Error(JSON.stringify({ branchId: data.branchId, error: error.message, refundId: data.id }))
        }
    }
    public static async addRefundLine(client: PoolClient, refundLine: RefundLine, branchId: string) {
        try {
            const accountId = await PaymnetMethodRepo.getPaymnetMethodaccountId(client, refundLine.paymentMethodId, branchId);
            refundLine.accountId = accountId.id;
            const query: { text: string, values: any } = {
                text: `INSERT INTO "CreditNoteRefundLines" (  id,"creditNoteRefundId",amount,"paymentMethodId","accountId")
                                                VALUES($1,$2,$3,$4,$5)`,
                values: [refundLine.id, refundLine.creditNoteRefundId, refundLine.amount, refundLine.paymentMethodId, refundLine.accountId]
            }
            await client.query(query.text, query.values)
        } catch (error: any) {
          
            ;

            throw new Error(error)
        }
    }

    public static async sendRefund(branchId: string, refund: Refund) {
        const instance = SocketController.getInstance();
        this.redisClient = RedisClient.getRedisClient()
        const clientId: any = await this.redisClient.get("Socket" + branchId);
        try {
            instance.io.of('/api').in(clientId).emit("newRefund", JSON.stringify(refund));
        } catch (error) {
          

            instance.io.of('/api').in(clientId).emit("newRefund", JSON.stringify({ success: false, error: error }));
        }
    }


    public static async getPosRefundList(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {

            let date: any;
            if (data) {
                data = JSON.parse(data)
                date = new Date()
                date.setTime(data.date);

            }

            let query: { text: string, values: any } = {
                text: `SELECT 
                        "CreditNoteRefunds".*
                    FROM "CreditNoteRefunds"
					inner join "CreditNotes" on "CreditNotes".id = "CreditNoteRefunds"."creditNoteId"
					inner join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId"
                    where  "CreditNoteRefunds"."branchId" = $1
					and    "Invoices".source =  any($2)
					`,
                values: [branchId, ['POS', 'Online']]
            }

            if (date != null) {
                query.text = `SELECT 
                        "CreditNoteRefunds".*
                    FROM "CreditNoteRefunds"
					inner join "CreditNotes" on "CreditNotes".id = "CreditNoteRefunds"."creditNoteId"
					inner join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId"
                    where  "CreditNoteRefunds"."branchId" = $1
					and    "Invoices".source =  any($2)
					and ("CreditNoteRefunds"."createdAt" > $3 or "CreditNoteRefunds"."updatedDate" >$3)`;
                query.values = [branchId, ['POS', 'Online'], date]
            }

            const refoundData: any = await DB.excu.query(query.text, query.values)


            for (let index = 0; index < refoundData.rows.length; index++) {
                const element = refoundData.rows[index];
                query.text = `SELECT 
                "CreditNoteRefundLines".*
             FROM "CreditNoteRefundLines"
      
             WHERE   "CreditNoteRefundLines"."creditNoteRefundId" = $1`
                query.values = [element.id]

                const lines = await DB.excu.query(query.text, query.values)

                refoundData.rows[index].lines = lines.rows;
            }
            callback(JSON.stringify({ success: true, data: refoundData.rows }))

        } catch (error: any) {
          
            ;

            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, branchId, null, "getPosRefundList")
        }
    }
    public static async getRecoverDbRefunds(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dBClient = await DB.excu.client();
        try {

            callback(JSON.stringify({ success: true, data: [] }))
            return;

            let date;
            if (data) {
                data = JSON.parse(data)
                date = new Date()
                date.setTime(data.date);

            }
            await dBClient.query("BEGIN");
            const invoiceIds = new Set();
            let openInvoiceIds = await SocketInvoiceRepo.getOpenInvoiceIds(dBClient, branchId)
            let lastThreeDaysInvoiceIds = await SocketInvoiceRepo.getLastThreeDaysInvoices(dBClient, branchId)

            openInvoiceIds.forEach((element: any) => {
                invoiceIds.add(element.id)
            });
            lastThreeDaysInvoiceIds.forEach((element: any) => {
                invoiceIds.add(element.id)
            })


            let invoiceData = await SocketEstimateRepo.getLatestEstimate(dBClient, branchId)
            if (invoiceData) {
                invoiceIds.add(invoiceData.invoiceId)
            }


            let ids = Array.from(invoiceIds);
            const query: { text: string, values: any } = {
                text: `select "CreditNoteRefunds".* from "CreditNoteRefunds" 
                INNER  JOIN "CreditNotes" ON "CreditNoteRefunds"."creditNoteId" = "CreditNotes".id 
                INNER JOIN "Invoices" ON "Invoices".id = "CreditNotes"."invoiceId" 
                where "Invoices"."branchId" = $1
                and "Invoices".source = 'POS'
                and "Invoices".id = any($2)
                 `,
                values: [branchId, ids]
            }



            const refoundData: any = await dBClient.query(query.text, query.values)


            for (let index = 0; index < refoundData.rows.length; index++) {
                const element = refoundData.rows[index];
                query.text = `SELECT 
                "CreditNoteRefundLines".*
             FROM "CreditNoteRefundLines"
             WHERE   "CreditNoteRefundLines"."creditNoteRefundId" = $1`
                query.values = [element.id]

                const lines = await dBClient.query(query.text, query.values)

                refoundData.rows[index].lines = lines.rows;
            }
            await dBClient.query("COMMIT");

            callback(JSON.stringify({ success: true, data: refoundData.rows }))

        } catch (error: any) {
          
            ;
            await dBClient.query("ROLLBACK");

            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, branchId, null, "getRecoverDbRefunds")
        } finally {
            dBClient.release()
        }
    }

    public static async getCreditNoteBalance(client: PoolClient, creditNoteId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT
                "CreditNotes".total -(COALESCE( sum( "CreditNoteRefunds".total) ,0) + COALESCE( sum( "AppliedCredits".amount),0))AS balance,
                "CreditNotes"."creditNoteNumber"
                FROM "CreditNotes"
                LEFT JOIN "AppliedCredits" ON "AppliedCredits"."creditNoteId" = "CreditNotes".id
                LEFT JOIN "CreditNoteRefunds" ON "CreditNoteRefunds"."creditNoteId" = "CreditNotes".id
                where "CreditNotes".id=$1
                GROUP by "CreditNotes".id`,
                values: [creditNoteId]
            }
            const balance = await client.query(query.text, query.values);
            if (balance && balance.rows && balance.rows.length == 0) {
                return new ResponseData(false, "CreditNote Not found", [])
            }
            return new ResponseData(true, "", { balance: (<any>balance.rows[0]).balance, creditNoteNumber: (<any>balance.rows[0]).creditNoteNumber })
        } catch (error: any) {
          
            throw new Error(error.message)
        }

    }


    public static async checkIfCreditNoteIdExist(client: PoolClient, creditNoteIds: any[]) {
        try {
            const query = {
                text: `SELECT count(*) as count FROM "CreditNotes" where id = any($1)`,
                values: [creditNoteIds]
            }

            let creditNotes = await client.query(query.text, query.values);

            if (creditNotes && creditNotes.rows && creditNotes.rows.length > 0 && creditNotes.rows[0].count == creditNoteIds.length) {
                return true
            } else {
                return false
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getPosRefunds(branchId: string, creditNoteIds: any[]) {
        try {

            const query = {
                text: `with "refunds" as (select id,"branchId", "companyId",(el->>'data')::jsonb->>'id' as "refundId" from "SocketLogs" , JSONB_ARRAY_ELEMENTS("logs") el 
                    where "dbTable" = 'Credit Note Refunds'
                    and "branchId" =$1)
            
              

                    select JSON_AGG("refundId") as ids from "refunds"`,
                values: [branchId]
            }

            const refunds = await DB.excu.query(query.text, query.values);
            console.log(refunds.rows)
            if (refunds && refunds.rows && refunds.rows.length > 0) {
                const ids = creditNoteIds ?? (<any>refunds.rows[0]).ids
                if (ids) {

                    const instance = SocketController.getInstance();
                    this.redisClient = RedisClient.getRedisClient()
                    const clientId: any = await this.redisClient.get("Socket" + branchId);
                    if (clientId == null) {
                        return new ResponseData(false, "Branch Is disconnected", [])
                    } else {

                        const client = instance.io.of('/api').sockets.get(clientId)

                        if (client) {


                            let response = await client.emitWithAck("fetchRefunds", ids);

                            if (response) {
                                return new ResponseData(true, "", [])
                            } else {
                                return new ResponseData(false, response, [])
                            }
                        } else {
                            return new ResponseData(false, "Branch Is disconnected", [])
                        }

                    }

                }
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getMissingCreditNotes(data: any) {
        try {

            const branchId = data.branchId;


            const query = {
                text: `with "refunds" as (select id,"branchId", "companyId",(el->>'data')::jsonb->>'creditNoteId' as "creditNoteId" from "SocketLogs" , JSONB_ARRAY_ELEMENTS("logs") el 
                    where "dbTable" = 'Credit Note Refunds'
                    and "branchId" =$1
                    and  el->>'error' = 'Credit Note Id is not exist'),
                    "creditNOteNoteExist" as (
                    select JSON_AGG("refunds"."creditNoteId") AS ids from "refunds"
                        left join "CreditNotes" on "CreditNotes".id = "refunds"."creditNoteId"::uuid
                        where "CreditNotes".id is null 
                    )

                    select * from "creditNOteNoteExist"`,
                values: [branchId]

            }

            let credits = await DB.excu.query(query.text, query.values);
            console.log(credits.rows)
            if (credits && credits.rows && credits.rows.length > 0) {

                const ids = (<any>credits.rows[0]).ids
                if (ids) {

                    const instance = SocketController.getInstance();
                    this.redisClient = RedisClient.getRedisClient()
                    const clientId: any = await this.redisClient.get("Socket" + branchId);
                    if (clientId == null) {

                        return new ResponseData(false, "Branch Is disconnected", [])
                    } else {

                        const client = instance.io.of('/api').sockets.get(clientId)

                        if (client) {
                            console.log("before res")
                            let response = await client.emitWithAck("fetchCreditNotes", ids);
                            console.log("after res")
                            if (response) {
                                return new ResponseData(true, "", [])
                            } else {
                                return new ResponseData(false, response, [])
                            }
                        } else {

                            return new ResponseData(false, "Branch Is disconnected", [])
                        }

                    }

                }
                console.log("fifthhhhhhhhhhhhsss")
            }
            return new ResponseData(true, "", [])
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }
}