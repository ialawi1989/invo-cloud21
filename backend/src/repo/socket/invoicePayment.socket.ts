import { DB } from "@src/dbconnection/dbconnection";
import { InvoicePayment } from "@src/models/account/InvoicePayment";
import { InvoicePaymentLine } from "@src/models/account/InvoicePaymentLine";
import { RedisClient } from "@src/redisClient";
import { SocketController } from "@src/socket";
import { TimeHelper } from "@src/utilts/timeHelper";
import { PoolClient } from "pg";
import { Socket } from "socket.io";
import { BranchesRepo } from "../admin/branches.repo";
import { CompanyRepo } from "../admin/company.repo";
import { InvoicePaymentRepo } from "../app/accounts/invoicePayment.repo";
import { PaymnetMethodRepo } from "../app/accounts/paymentMethod.repo";
import { ViewQueue } from "@src/utilts/viewQueue";

import { SocketInvoiceRepo } from "./invoice.socket";

import { ResponseData } from "@src/models/ResponseData";
import { TriggerQueue } from "../triggers/triggerQueue";
import { SocketErrorLogs, SocketLogs } from "./socketErrorLogs";
import { InvoiceStatuesQueue } from "../triggers/queue/workers/invoiceStatus.worker";
import { CustomerBalanceQueue } from "../triggers/userBalancesQueue";
import { LogsManagmentRepo } from "../app/settings/LogSetting.repo";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";


export class SoketInvoicePayment {
    static redisClient: any;


    public static async sendInvoicePayment(branchId: string, invoicePayment: InvoicePayment) {

        const instance = SocketController.getInstance();
        this.redisClient = RedisClient.getRedisClient()
        const clientId: any = await this.redisClient.get("Socket" + branchId);

        try {
            instance.io.of('/api').in(clientId).emit("newPayment", JSON.stringify(invoicePayment));
        } catch (error) {
          

            instance.io.of('/api').in(clientId).emit("newPayment", JSON.stringify({ success: false, error: error }));
        }
    }

    public static async sendUpdatedPayment(branchId: string, invoicePayment: InvoicePayment) {

        const instance = SocketController.getInstance();
        this.redisClient = RedisClient.getRedisClient()
        const clientId: any = await this.redisClient.get("Socket" + branchId);

        try {
            instance.io.of('/api').in(clientId).emit("updatePayment", JSON.stringify(invoicePayment));
        } catch (error) {
          

            instance.io.of('/api').in(clientId).emit("updatePayment", JSON.stringify({ success: false, error: error }));
        }
    }

    public static async checkIfInvoicesIdsExists(client: PoolClient, invoiceIds: any[]) {
        try {
            const query = {
                text: `select count(id) as count from "Invoices" where id = any($1)`,
                values: [invoiceIds]
            }

            let payment = await client.query(query.text, query.values);
            if (payment && payment.rows && payment.rows.length > 0 && payment.rows[0].count == invoiceIds.length) {
                return true
            }

            return false
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async checkIfPaymentIdExist(client: PoolClient, invoicePaymentId: string, branchId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT count(*) from "InvoicePayments" WHERE id =$1 and "branchId"=$2 `,
                values: [invoicePaymentId, branchId]
            }

            const count = await client.query(query.text, query.values);

            if ((<any>count.rows[0]).count > 0) {
                return true;
            } else {
                return false
            }
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async checkIfPaymentLineIdExist(client: PoolClient, lineId: string, invoicePaymentId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT count(*) from "InvoicePaymentLines" WHERE id =$1 and "invoicePaymentId"=$2 `,
                values: [lineId, invoicePaymentId]
            }

            const count = await client.query(query.text, query.values);

            if ((<any>count.rows[0]).count > 0) {
                return true;
            } else {
                return false
            }
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    //http://10.2.2.75:4200/account/supplier-credit/view/54aeaa55-c7fb-4c94-b6c9-ae9edb524864?pageNum=1&pageLimit=15

    /**supplier applied credit  */

    public static async getCustomerId(client: PoolClient, invoiceIds: any[]) {
        try {
            console.log(invoiceIds)
            const query = {
                text: `select JSONB_AGG(DISTINCT "Invoices"."customerId") "customerId" from "Invoices" where "id" = any($1)
                  having count(distinct "Invoices"."customerId")=1`,
                values: [invoiceIds]
            }

            const customer = await client.query(query.text, query.values);

            const customeId = customer.rows && customer.rows.length > 0 && customer.rows[0].customerId && customer.rows[0].customerId.length == 1 ? customer.rows[0].customerId[0] : null;

            return customeId

        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async saveInvoicePayments(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client(30)
        try {

            if (data) {
                data = JSON.parse(data);
            }
            /**Begin Client */
            await dbClient.query("BEGIN")
            const payments = data;
            const companyId = (await BranchesRepo.getBranchCompanyId(dbClient, branchId)).compayId;
            let invoicePayments: any[] = [];
            let invoices: any[] = [];

            const socketLogs = new SocketLogs()
            for (let index = 0; index < payments.length; index++) {

                const element: any = payments[index];
                element.branchId = branchId
                const invoicePayment = new InvoicePayment();
                let flagContinue = false;
                invoicePayment.ParseJson(element);
                invoicePayment.createdAt = await TimeHelper.convertToDate(invoicePayment.createdAt)
                invoicePayment.paymentDate = await TimeHelper.convertToDate(invoicePayment.paymentDate)

                if (invoicePayment.id == "" || invoicePayment.id == null) {
                    flagContinue = true
                    socketLogs.compnayId = companyId;
                    socketLogs.branchId = branchId;
                    socketLogs.dbTable = "InvoicePayments"
                    socketLogs.referenceId = invoicePayment.id;
                    socketLogs.logs.push({ error: 'Invoice Payment Id Is Empty', data: invoicePayment })

                } else {
                    invoicePayments.push(invoicePayment.id)
                }

                invoicePayment.lines.forEach(line => {

                    if (line.invoiceId == "" || line.invoiceId == null) {
                        flagContinue = true
                        socketLogs.compnayId = companyId;
                        socketLogs.branchId = branchId;
                        socketLogs.dbTable = "InvoicePayments"
                        socketLogs.referenceId = invoicePayment.id;
                        socketLogs.logs.push({ error: 'Invoice Payment Invoice Id  Is Empty', reference: "line", referenceId: element.id, data: invoicePayment })
                    }

                    if (line.id == "" || line.id == null) {
                        flagContinue = true
                        socketLogs.compnayId = companyId;
                        socketLogs.branchId = branchId;
                        socketLogs.dbTable = "InvoicePayments"
                        socketLogs.referenceId = invoicePayment.id;
                        socketLogs.logs.push({ error: 'Invoice Payment line Id  Is Empty', reference: "Invoice Payment", referenceId: invoicePayment.id, data: invoicePayment })

                    }

                    if (line.id != "" && line.id != null && line.invoiceId != "" && line.invoiceId != null) {
                        if (!invoices.includes(line.invoiceId)) {
                            invoices.push(line.invoiceId);
                        }

                    }
                });

                let isInvoicesExists = await this.checkIfInvoicesIdsExists(dbClient, invoices)

                if (!isInvoicesExists) {
                    socketLogs.compnayId = companyId;
                    socketLogs.branchId = branchId;
                    socketLogs.dbTable = "InvoicePayments"
                    socketLogs.referenceId = invoicePayment.id;
                    socketLogs.logs.push({ error: 'Invoice is not exist ', reference: "Invoice Payment", referenceId: invoicePayment.id, data: invoicePayment })

                    flagContinue = true
                }


                if (flagContinue == true) {
                    await SocketErrorLogs.setLogs(dbClient, socketLogs)
                    continue;
                }

                const checkIfInvoicePaymentExist = await InvoicePaymentRepo.checkIfInvoicePaymentExist(dbClient, element.id, branchId)
                if (!checkIfInvoicePaymentExist) {
                    await this.addInvoicePayment(dbClient, invoicePayment, companyId)
                }
                else {
                    await this.editInvoicePayment(dbClient, invoicePayment, companyId)
                }

            }
            /**Commit Client */
            await dbClient.query("COMMIT")
            callback(JSON.stringify({ success: true }))
            let queueInstance = TriggerQueue.getInstance();
            let userBalancesQueue = CustomerBalanceQueue.getInstance();

            if (invoicePayments.length > 0) {
                invoicePayments.forEach(element => {
                    queueInstance.createJob({ type: "InvoicePayments", id: [element], companyId: companyId })
                    userBalancesQueue.createJob({ transactionId: element, dbTable: 'InvoicePayments' })

                });

            }

            if (invoices.length > 0) {

                for (let index = 0; index < invoices.length; index++) {
                    const element = invoices[index];
                    // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: [element] })
                    InvoiceStatuesQueue.get().createJob({
                        id: element
                    } as any);
                    // queueInstance.createJob({ type: "pushPaidNotifictios", invoiceIds: [element] })
                }

            }


            const queue = ViewQueue.getQueue();
            queue.pushJob()
        } catch (error: any) {
            console.log(error)
          

            ;
            /**ROLLBACK Client */
            await dbClient.query("ROLLBACK")
            let errorOpject = JSON.parse(error.message)
            let paymentId = errorOpject.paymentId ?? ""

            callback(JSON.stringify({ success: false, error: error.message, paymentId: paymentId }))
        } finally {
            /**release Client */
            dbClient.release();
        }
    }
    public static async addInvoicePayment(client: PoolClient, data: any, companyId: string) {
        try {
            //Payments Recived From POS
            // const validate = await InvoicePaymentValidation.invoicePaymentValidation(data);


            // if (!validate.valid) {
            //     throw new Error(validate.error);
            // }
            const afterDecimal = await CompanyRepo.getCompanyAfterDecimal(client, companyId)
            const invoicePayment = new InvoicePayment();
            invoicePayment.ParseJson(data);
            invoicePayment.calculateTotal(afterDecimal);
            invoicePayment.setlogs([])
            invoicePayment.companyId = companyId
            if (!invoicePayment.checkPaymentDate()) {
                throw new Error("Invalid Payment Date")
            }
            let invoiceIds: any[] = Array.from(new Set(invoicePayment.lines.map(f => f.invoiceId))); //only unique invoice ids 
            invoicePayment.customerId = invoicePayment.customerId != "" && invoicePayment.customerId != null ? invoicePayment.customerId : await this.getCustomerId(client, invoiceIds)
            console.log("addInvoicePaymentaddInvoicePaymentaddInvoicePaymentaddInvoicePaymentaddInvoicePayment", invoicePayment.customerId)
            // if ((invoicePayment.branchId == "" || invoicePayment.branchId == null) && invoicePayment.lines.length>0) {
            //     invoicePayment.branchId = (await InvoiceRepo.getInvoiceBranchId(client, invoicePayment.lines[0].invoiceId)).id
            // }
            // if ((invoicePayment.customerId == "" || invoicePayment.customerId == null)&& invoicePayment.lines.length>0) {
            //     invoicePayment.customerId = (await InvoiceRepo.getInvoiceCustomerId(client, invoicePayment.lines[0].invoiceId)).id
            // }


            invoicePayment.customerId = invoicePayment.customerId == "" ? null : invoicePayment.customerId

            invoicePayment.employeeId = invoicePayment.employeeId == "" ? null : invoicePayment.employeeId
            invoicePayment.cashierId = invoicePayment.cashierId == "" ? null : invoicePayment.cashierId
            /** Set payment Method Account Id */
            const accountId = (await PaymnetMethodRepo.getPaymnetMethodaccountId(client, invoicePayment.paymentMethodId, invoicePayment.branchId)).id
            invoicePayment.paymentMethodAccountId = accountId;
            invoicePayment.status = invoicePayment.status ?? 'SUCCESS'

            /**When Payments Are Received from kiosk */
            invoicePayment.employeeId = invoicePayment.employeeId == "" ? null : invoicePayment.employeeId
            invoicePayment.cashierId = invoicePayment.cashierId == "" ? null : invoicePayment.cashierId


            const query: { text: string, values: any } = {
                text: `INSERT INTO "InvoicePayments" (id,
                                                            "createdAt",
                                                            "tenderAmount",
                                                            "branchId",
                                                            "paymentMethodId",
                                                            "employeeId",
                                                            "cashierId",
                                                            "paymentMethodAccountId",
                                                            "customerId",
                                                            "paidAmount",
                                                            "rate",
                                                            "paymentDate",
                                                            "status",
                                                            "bankCharge",
                                                            "changeAmount",
                                                            "referenceNumber",
                                                            "deviceId",
                                                            "logs",
                                                        "companyId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
                values: [invoicePayment.id,
                invoicePayment.createdAt,
                invoicePayment.tenderAmount,
                invoicePayment.branchId,
                invoicePayment.paymentMethodId,
                invoicePayment.employeeId,
                invoicePayment.cashierId,
                invoicePayment.paymentMethodAccountId,
                invoicePayment.customerId,
                invoicePayment.paidAmount,
                invoicePayment.rate,
                invoicePayment.paymentDate,
                invoicePayment.status,
                invoicePayment.bankCharge,
                invoicePayment.changeAmount,
                invoicePayment.referenceNumber,
                invoicePayment.deviceId,
                JSON.stringify(invoicePayment.logs),
                invoicePayment.companyId
                ]
            }
            await client.query(query.text, query.values);

            for (let index = 0; index < invoicePayment.lines.length; index++) {
                const paymentLine = invoicePayment.lines[index];
                paymentLine.invoicePaymentId = invoicePayment.id;
                paymentLine.branchId = paymentLine.branchId ?? invoicePayment.branchId;
                paymentLine.companyId = companyId;
                if (paymentLine.amount > 0) {
                    paymentLine.createdAt = await TimeHelper.convertToDate(paymentLine.createdAt)
                    await this.addInvoicePaymentLine(client, paymentLine)
                }
            }
        } catch (error: any) {
          
            
            console.log(error)
            logPosErrorWithContext(error, data, data.branchId, data.companyId, "addInvoicePayment")
            throw new Error(JSON.stringify({ branchId: data.branchId, error: error.message, paymentId: data.id }))

        }
    }
    public static async addInvoicePaymentLine(client: PoolClient, invoicePaymentLine: InvoicePaymentLine) {
        try {



            const query: { text: string, values: any } = {
                text: `INSERT INTO "InvoicePaymentLines" (id,"invoiceId","invoicePaymentId",amount,"createdAt","companyId","branchId") VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
                values: [invoicePaymentLine.id, invoicePaymentLine.invoiceId, invoicePaymentLine.invoicePaymentId, invoicePaymentLine.amount, invoicePaymentLine.createdAt, invoicePaymentLine.companyId, invoicePaymentLine.branchId]
            }
            await client.query(query.text, query.values);
        } catch (error: any) {
            console.log(error)
            ;
            throw new Error(JSON.stringify({ error: error.message, invoiceId: invoicePaymentLine.invoiceId, paymentId: invoicePaymentLine.invoicePaymentId }))
        }
    }

    public static async getPaymentLogs(client: PoolClient, invoiceId: string) {
        try {
            const query = {
                text: `SELECT "logs" FROM "InvoicePayments" where id=$1`,
                values: [invoiceId]
            }

            let invoiceLog = await client.query(query.text, query.values);

            return invoiceLog.rows && invoiceLog.rows.length > 0 && invoiceLog.rows[0] && invoiceLog.rows[0].logs ? invoiceLog.rows[0].logs : []
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async editInvoicePayment(client: PoolClient, data: any, companyId: string) {
        try {
            //Payments Recived From POS
            // const validate = await InvoicePaymentValidation.invoicePaymentValidation(data);


            // if (!validate.valid) {
            //     throw new Error(validate.error);
            // }
            const afterDecimal = await CompanyRepo.getCompanyAfterDecimal(client, companyId)
            const invoicePayment = new InvoicePayment();
            invoicePayment.ParseJson(data);
            invoicePayment.calculateTotal(afterDecimal);
            //let logs = await this.getPaymentLogs(client, invoicePayment.id)
            //invoicePayment.setlogs(logs)
            if (invoicePayment.logs) {
                invoicePayment.parsePosLogs()
                await LogsManagmentRepo.manageLogs(client, "InvoicePayments", invoicePayment.id, invoicePayment.logs, invoicePayment.branchId, companyId, invoicePayment.employeeId, invoicePayment.referenceNumber, 'POS');

            }


            let invoiceIds: any[] = Array.from(new Set(invoicePayment.lines.map(f => f.invoiceId))); //only unique invoice ids 

            if (!invoicePayment.checkPaymentDate()) {
                throw new Error("Invalid Payment Date")
            }

            invoicePayment.customerId = invoicePayment.customerId != "" && invoicePayment.customerId != null ? invoicePayment.customerId : await this.getCustomerId(client, invoiceIds)


            // if (invoicePayment.branchId == "" || invoicePayment.branchId == null) {
            //     invoicePayment.branchId = (await InvoiceRepo.getInvoiceBranchId(client, invoicePayment.lines[0].invoiceId)).id
            // }
            // if (invoicePayment.customerId == "" || invoicePayment.customerId == null) {
            //     invoicePayment.customerId = (await InvoiceRepo.getInvoiceCustomerId(client, invoicePayment.lines[0].invoiceId)).id
            // }
            const accountId = (await PaymnetMethodRepo.getPaymnetMethodaccountId(client, invoicePayment.paymentMethodId, invoicePayment.branchId)).id
            invoicePayment.paymentMethodAccountId = accountId;

            invoicePayment.employeeId = invoicePayment.employeeId == "" ? null : invoicePayment.employeeId
            invoicePayment.cashierId = invoicePayment.cashierId == "" ? null : invoicePayment.cashierId
            const query: { text: string, values: any } = {
                text: `UPDATE "InvoicePayments" SET 
                                                            "tenderAmount"=$1,
                                                            "paymentMethodId"=$2,
                                                            "employeeId"=$3,
                                                            "cashierId"=$4,
                                                            "paymentMethodAccountId"=$5,
                                                            "customerId"=$6,
                                                            "paidAmount"=$7,
                                                            "rate"=$8,
                                                            "paymentDate"=$9,
                                                            "changeAmount" =$10,
                                                            "referenceNumber" =$11,
                                                            "deviceId"=$12
                                                             WHERE  id= $13`,
                values: [
                    invoicePayment.tenderAmount,
                    invoicePayment.paymentMethodId,
                    invoicePayment.employeeId,
                    invoicePayment.cashierId,
                    invoicePayment.paymentMethodAccountId,
                    invoicePayment.customerId,
                    invoicePayment.paidAmount,
                    invoicePayment.rate,
                    invoicePayment.paymentDate,
                    invoicePayment.changeAmount,
                    invoicePayment.referenceNumber,
                    invoicePayment.deviceId,
                    invoicePayment.id]
            }
            await client.query(query.text, query.values);
            for (let index = 0; index < invoicePayment.lines.length; index++) {
                const paymentLine = invoicePayment.lines[index];
                paymentLine.invoicePaymentId = invoicePayment.id;

                if (paymentLine.amount > 0) {
                    paymentLine.createdAt = await TimeHelper.convertToDate(paymentLine.createdAt)
                    const isLineIdExist = await this.checkIfPaymentLineIdExist(client, paymentLine.id, paymentLine.invoicePaymentId)
                    if (isLineIdExist) {
                        await this.editInvoicePaymentLine(client, paymentLine)
                    } else {
                        await this.addInvoicePaymentLine(client, paymentLine)

                    }
                }
            }
        } catch (error: any) {
            console.log(error)
          
            
            logPosErrorWithContext(error, data, data.branchId, data.companyId, "editInvoicePayment")
            throw new Error(JSON.stringify({ branchId: data.branchId, error: error.message, paymentId: data.invoicePaymentId }))
        }
    }
    public static async editInvoicePaymentLine(client: PoolClient, invoicePaymentLine: InvoicePaymentLine) {
        try {
            const query: { text: string, values: any } = {
                text: `UPDATE "InvoicePaymentLines" SET amount=$1  WHERE id=$2`,
                values: [invoicePaymentLine.amount, invoicePaymentLine.id]
            }
            await client.query(query.text, query.values);
        } catch (error: any) {
          
            ;

            throw new Error(JSON.stringify({ error: error.message, invoiceId: invoicePaymentLine.invoiceId, paymentId: invoicePaymentLine.invoicePaymentId }))
        }
    }


    /**Retreive Recover POS DB Payments*/
    public static async getPOSInvoicePayments(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {

            let date: any;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null) {
                    date = new Date()
                    date.setTime(data.date);

                }

            }
            const query: { text: string, values: any } = {
                text: `SELECT "InvoicePayments".id,
                "InvoicePayments"."createdAt",
                "InvoicePayments"."paymentMethodId",
                "InvoicePayments"."tenderAmount",
                "InvoicePayments"."paidAmount",
                "InvoicePayments"."cashierId" ,
                "InvoicePayments"."employeeId" ,
                "InvoicePayments"."customerId" ,
                "InvoicePayments"."paymentDate" ,
                "InvoicePayments"."updatedDate" ,
                "InvoicePayments".rate,
                "InvoicePayments".status,
                "InvoicePayments"."referenceNumber",
                "InvoicePayments"."bankCharge",
                "InvoicePayments"."changeAmount",
                 "InvoicePayments"."deviceId"
                 FROM "InvoicePayments" 
                      INNER JOIN "InvoicePaymentLines" ON "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id 
                      INNER JOIN "Invoices" ON "InvoicePaymentLines"."invoiceId" = "Invoices".id 
                      WHERE "InvoicePayments"."branchId"=$2
                      and "Invoices".source = any($1)
                      AND "InvoicePayments"."status" = 'SUCCESS'
                      `,
                values: [['POS', 'Online'], branchId]
            }


            if (date != null) {
                query.text = `SELECT "InvoicePayments".id,
                "InvoicePayments"."createdAt",
                "InvoicePayments"."paymentMethodId",
                "InvoicePayments"."tenderAmount",
                "InvoicePayments"."paidAmount",
                "InvoicePayments"."cashierId" ,
                "InvoicePayments"."employeeId" ,
                "InvoicePayments"."customerId" ,
                "InvoicePayments"."paymentDate" ,
                "InvoicePayments"."updatedDate" ,
         
                "InvoicePayments".rate,
                "InvoicePayments".status,
                "InvoicePayments"."referenceNumber",
                "InvoicePayments"."bankCharge",
                "InvoicePayments"."changeAmount",
                   "InvoicePayments"."deviceId"
                 FROM "InvoicePayments" 
                INNER JOIN "InvoicePaymentLines" ON "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id 
                INNER JOIN "Invoices" ON "InvoicePaymentLines"."invoiceId" = "Invoices".id 
                WHERE  "InvoicePayments"."branchId"=$2
                AND "Invoices".source =any($1)
                AND "InvoicePayments"."status" = 'SUCCESS'
                AND ("InvoicePayments"."updatedDate">=$3 or "InvoicePayments"."createdAt">=$3)`;
                query.values = [['POS', 'Online'], branchId, date]
            }

            const payments: any = await DB.excu.query(query.text, query.values);

            for (let index = 0; index < payments.rows.length; index++) {
                const element: any = payments.rows[index];
                const lineQuery = {
                    text: `SELECT   id,
                                 "invoiceId",
                                 "invoicePaymentId",
                                  amount, 
                                  "createdAt"
                                FROM "InvoicePaymentLines" where "invoicePaymentId" = $1` ,
                    values: [element.id]
                }
                const lines = await DB.excu.query(lineQuery.text, lineQuery.values);

                payments.rows[index].lines = lines.rows;
            }

            callback(JSON.stringify({ success: true, data: payments.rows }))
        } catch (error: any) {
            console.log(error)
          
            ;

            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, branchId, null, "getPOSInvoicePayments")
        }
    }

    /**Retreive Recover POS DB Payments*/
    public static async getPaymentsOfOpenCahsiers(branchId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `     SELECT "InvoicePayments".id FROM "InvoicePayments"
                INNER JOIN "InvoicePaymentLines" ON "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id 
                INNER JOIN "Invoices" ON "InvoicePaymentLines"."invoiceId" = "Invoices".id  AND  "Invoices".source ='POS'
                INNER JOIN "Cashiers" on "InvoicePayments"."cashierId" = "Cashiers".id 
                WHERE"InvoicePayments"."branchId"=$1
                AND ("Cashiers"."createdAt" >= CURRENT_DATE - INTERVAL '3 DAY' AND "Cashiers"."createdAt" <= CURRENT_DATE) or("Cashiers"."cashierOut" is null)`,
                values: [branchId]
            }

            const payments = await DB.excu.query(query.text, query.values);

            return payments.rows

        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    // public static async getRecoverDbInvoicePayments(client: Socket, data: any, branchId: string, callback: CallableFunction) {
    //     try {

    //         const invoiceIds = new Set();
    //         let invoiceData = await this.getPaymentsOfOpenCahsiers(branchId)
    //         invoiceData.forEach((element:any)=> {
    //             invoiceIds.add(element.id)
    //         });

    //         let ids = Array.from(invoiceIds);
    //         const query : { text: string, values: any } = {
    //             text: `SELECT "InvoicePayments".* FROM "InvoicePayments"
    //             INNER JOIN "InvoicePaymentLines" ON "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id 
    //             INNER JOIN "Invoices" ON "InvoicePaymentLines"."invoiceId" = "Invoices".id  AND  "Invoices".source ='POS'
    //             WHERE "InvoicePayments"."branchId"=$1
    //             And (("InvoicePayments"."createdAt" >= CURRENT_DATE - INTERVAL '3 DAY' AND "InvoicePayments"."createdAt" <= CURRENT_DATE) or "InvoicePayments".id =any($2) )

    //                  `,
    //             values: [branchId,ids]
    //         }


    //         const payments: any = await DB.excu.query(query.text, query.values);

    //         for (let index = 0; index < payments.rows.length; index++) {
    //             const element: any = payments.rows[index];
    //             const lineQuery = {
    //                 text: `SELECT   id,
    //                              "invoiceId",
    //                              "invoicePaymentId",
    //                               amount, 
    //                               "createdAt"
    //                             FROM "InvoicePaymentLines" where "invoicePaymentId" = $1` ,
    //                 values: [element.id]
    //             }
    //             const lines = await DB.excu.query(lineQuery.text, lineQuery.values);

    //             payments.rows[index].lines = lines.rows;
    //         }
    //         callback(JSON.stringify({ success: true, data: payments.rows }))

    //     } catch (error: any) {
    //    
    //      ;

    //         callback(JSON.stringify({ success: false, error: error.message }))
    //     }
    // }



    public static async getRecoverDbInvoicePayments(client: Socket, data: any, branchId: string, callback: CallableFunction) {

        const dbClient = await DB.excu.client(500);
        try {

            await dbClient.query("BEGIN");
            // const invoiceIds = new Set();
            // const cashierIds = new Set();
            // let invoiceData: any = await SocketInvoiceRepo.getOpenInvoiceIds(dbClient, branchId)
            // invoiceData.forEach((element: any) => {
            //     invoiceIds.add(element.id)
            // });

            // invoiceData = await SocketInvoiceRepo.getLastThreeDaysInvoices(dbClient, branchId)
            // invoiceData.forEach((element: any) => {
            //     invoiceIds.add(element.id)
            // });

            // invoiceData = await SocketEstimateRepo.getLatestEstimate(dbClient, branchId)
            // if (invoiceData) {
            //     invoiceIds.add(invoiceData.invoiceId)
            // }

            // invoiceData = await SocketCreditNoteRepo.getLatestCreditNote(dbClient, branchId)
            // if (invoiceData.length > 0) {
            //     invoiceData.forEach((element: any) => {
            //         invoiceIds.add(element.invoiceId)
            //     });
            // }

            // let cashiers = await SocketCashier.getOpenCashiers(dbClient, branchId);
            // if (cashiers.length > 0) {
            //     cashiers.forEach((element: any) => {
            //         cashierIds.add(element.id)
            //     });
            // }

            // let ids = Array.from(invoiceIds);
            // let cashierIdList = Array.from(cashierIds);
            let invoiceIds = await SocketInvoiceRepo.getRecoverInvoicesIds(dbClient, branchId);

            const query: { text: string, values: any } = {
                text: `SELECT "InvoicePayments".* FROM "InvoicePayments"
                INNER JOIN "InvoicePaymentLines" ON "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id 
                where "InvoicePaymentLines"."invoiceId" = any($1) 
                and "InvoicePayments"."status" = 'SUCCESS'
                     `,
                values: [invoiceIds]
            }



            const payments: any = await dbClient.query(query.text, query.values);


            for (let index = 0; index < payments.rows.length; index++) {
                const element: any = payments.rows[index];
                const lineQuery = {
                    text: `SELECT   id,
                                 "invoiceId",
                                 "invoicePaymentId",
                                  amount, 
                                  "createdAt"
                                FROM "InvoicePaymentLines" where "invoicePaymentId" = $1` ,
                    values: [element.id]
                }
                const lines = await dbClient.query(lineQuery.text, lineQuery.values);

                payments.rows[index].lines = lines.rows;
            }
            // const PAYMENTS = Helper.trim_nulls(payments.rows);
            // console.log(PAYMENTS)
            await dbClient.query("COMMIT");
            callback(JSON.stringify({ success: true, data: payments.rows }))

        } catch (error: any) {
            await dbClient.query("ROLLBACK");
          
            ;
            console.log(error)

            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, branchId, null, "getRecoverDbInvoicePayments")
        } finally {
            dbClient.release()
        }
    }

    public static async getOpeniInvoicesIds(branchId: string) {
        try {
            const query = {
                text: `select id from "Invoices" where "branchId" =$1 and ("status" = 'Open' or "status" = 'Partially Paid')`,
                values: [branchId]
            }

            let invoices = await DB.excu.query(query.text, query.values);
            return invoices.rows
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    public static async getInvoicePayment(branchId: string, invoiceIds: any[]) {

        const instance = SocketController.getInstance();
        this.redisClient = RedisClient.getRedisClient()
        const clientId: any = await this.redisClient.get("Socket" + branchId);
        invoiceIds = invoiceIds ?? [];
        try {



            if (clientId == null) {
                return new ResponseData(false, "Branch Is disconnected (Client Not Fount in Redis) ", [])
            } else {

                const client = instance.io.of('/api').sockets.get(clientId)

                if (client) {
                    if (invoiceIds.length <= 0) {
                        let invoices = await this.getOpeniInvoicesIds(branchId);
                        let ids: any[] = [];
                        if (invoices.length > 0) {
                            invoices.forEach((element: any) => {
                                ids.push(element.id)
                            });
                        }
                        if (ids.length > 0) {
                            invoiceIds = ids
                        }
                    }
                    let response = await client.emitWithAck("getInvoicePayments", invoiceIds);
                    console.log(response)
                    if (response) {
                        return new ResponseData(true, "", [])
                    } else {
                        return new ResponseData(false, response, [])
                    }
                } else {
                    return new ResponseData(false, "Branch Is disconnected (Client Not Found  in Socket)", [])
                }
                // return new Promise((resolve, reject) => {
                //     instance.io.of('/api').in(clientId).timeout(5000).emit("getInvoicePayments", invoiceIds, (err: any, res: any) => {
                //         if (err) {

                //             resolve(err.message)
                //         }

                //         if (res && res.length > 0) {
                //             let reData = res[0];


                //             resolve(new ResponseData(reData, "", []))
                //         }
                //     })
                // });

            }
            return new ResponseData(true, "", [])
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }
}