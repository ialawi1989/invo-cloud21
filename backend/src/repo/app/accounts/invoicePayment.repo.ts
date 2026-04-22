import { DB } from "@src/dbconnection/dbconnection";
import { InvoicePayment } from "@src/models/account/InvoicePayment";
import { InvoicePaymentLine } from "@src/models/account/InvoicePaymentLine";

import { ResponseData } from "@src/models/ResponseData";

import { InvoicePaymentValidation } from "@src/validationSchema/account/invoicePayment.Schema";
import { PoolClient } from "pg";

import { InvoiceRepo } from "./invoice.repo";


import { PaymnetMethodRepo } from "./paymentMethod.repo";
import { TimeHelper } from "@src/utilts/timeHelper";
import { SoketInvoicePayment } from "@src/repo/socket/invoicePayment.socket";
import { JournalRepo } from "./Journal.repo";
import { AppliedCreditsValidation } from "@src/validationSchema/account/appliedCredit.Schema";
import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { EventLog, Log } from "@src/models/log";
import { PDFGenerator } from "@src/utilts/PDFGenerator";
import { Helper } from "@src/utilts/helper";
import { EventLogsRepo } from "./eventlogs.repo";
import { EventLogsSocket } from "@src/repo/socket/eventLogs.socket";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";


export class InvoicePaymentRepo {



    public static async getInvoicePayemntDate(paymentId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT CAST("paymentDate" AS TEXT) FROM "InvoicePayments" where id =$1 `,
                values: [paymentId]
            }
            let date = await DB.excu.query(query.text, query.values)
            if (date.rowCount != null && date.rowCount > 0) {
                return (<any>date.rows[0]).paymentDate
            }
            return null
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async getInvoicePayemntLineDate(paymentLineId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "createdAt" FROM "InvoicePaymentLines" where id =$1 `,
                values: [paymentLineId]
            }
            let date = await DB.excu.query(query.text, query.values)
            if (date.rowCount != null && date.rowCount > 0) {
                return (<any>date.rows[0]).createdAt
            }
            return null
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async checkIfInvoicePaymentExist(client: PoolClient, invoicePaymentId: string, branchId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT COUNT(*) FROM "InvoicePayments" where id = $1 and "branchId"=$2`,
                values: [invoicePaymentId, branchId]
            }
            const payment = await client.query(query.text, query.values);

            if ((<any>payment.rows[0]).count > 0) {
                return true
            } else {
                return false
            }
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async checkIfInvoicePaymnetLineExist(invoicePaymentLineId: string, invoicePaymentId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT COUNT(*) FROM "InvoicePaymentLines" where id = $1 and "invoicePaymentId"=$2`,
                values: [invoicePaymentLineId, invoicePaymentId]
            }
            const payment = await DB.excu.query(query.text, query.values);

            if ((<any>payment.rows[0]).count > 0) {
                return true
            } else {
                return false
            }
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async getPaymentBalance(client: PoolClient, paymentId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "tenderAmount" - COALESCE(sum("InvoicePaymentLines".amount),0) as balance from "InvoicePayments" 
                        LEFT JOIN "InvoicePaymentLines" on "InvoicePayments".id  =  "InvoicePaymentLines"."invoicePaymentId"
                         where  "InvoicePayments".id = $1
                         group by "InvoicePayments".id `,
                values: [paymentId]
            }
            let balance = await client.query(query.text, query.values);
            return balance.rows[0].balance
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async addInvoicePayment(client: PoolClient, data: any, company: Company) {

        try {
            const companyId = company.id
            //validation;
            const validate = await InvoicePaymentValidation.invoicePaymentValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            let sendToPos = false; // if payment contains POS invoice 

            const afterDecimal = company.afterDecimal
            const invoicePayment = new InvoicePayment();
            invoicePayment.ParseJson(data);
            invoicePayment.companyId = company.id
            const invoiceIds: any[] = [];
            invoicePayment.lines.forEach(element => {
                invoiceIds.push(element.invoiceId)
            });

            invoicePayment.updatedDate = new Date();
            if (!invoicePayment.checkPaymentDate()) {
                throw new ValidationException("Invalid Payment Date")
            }


            if (invoicePayment.paidAmount < 0 || invoicePayment.tenderAmount < 0) {
                throw new ValidationException("Payment Amount Cannot be Negative")
            }
            //for single payment 
            let invoiceId = invoicePayment.lines.find((f: any) => f.invoiceId != "" && f.invoiceId != null)?.invoiceId
            if (invoiceId) {
                if ((invoicePayment.branchId == "" || invoicePayment.branchId == null) && invoicePayment.lines.length > 0) {
                    invoicePayment.branchId = (await InvoiceRepo.getInvoiceBranchId(client, invoiceId)).id
                }
                if (invoicePayment.customerId == "" || invoicePayment.customerId == null) {
                    invoicePayment.customerId = (await InvoiceRepo.getInvoiceCustomerId(client, invoiceId)).id
                }

            }



            const paymentMethod = (await PaymnetMethodRepo.getPaymnetMethodById(client, company, invoicePayment.paymentMethodId, invoicePayment.branchId)).data
            invoicePayment.paymentMethodAccountId = paymentMethod.accountId;
            invoicePayment.paymentMethodType = paymentMethod.type;
            invoicePayment.calculateTotal(afterDecimal);


            if (invoicePayment.tenderAmount == 0 && invoicePayment.paidAmount == 0) {
                throw new ValidationException("Payment amount must be grater than zero")
            }
            if (paymentMethod.type != 'Card' && invoicePayment.bankCharge > 0) {
                throw new ValidationException("Bank Charge Cannot be Applied on Cash Payments")
            }

            invoicePayment.createdAt = new Date();
            if (invoicePayment.tenderAmount != 0 && (invoicePayment.tenderAmount * invoicePayment.rate) < invoicePayment.paidAmount) {
                throw new ValidationException("Total Paid Amount Exceeded  total Recived amount  (Payment Made)")
            }

            const query: { text: string, values: any } = {
                text: `INSERT INTO "InvoicePayments" ("createdAt",
                                                               "tenderAmount",
                                                               "branchId",
                                                               "paymentMethodId",
                                                               "employeeId",
                                                               "cashierId",
                                                               "paymentMethodAccountId",
                                                               "customerId",
                                                               "paidAmount",
                                                               "paymentDate",
                                                               "updatedDate",
                                                               rate,
                                                               "referenceNumber",
                                                               "attachment",
                                                               "status",
                                                               "bankCharge",
                                                            "onlineData",
                                                        "companyId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
                values: [invoicePayment.createdAt,
                invoicePayment.tenderAmount,
                invoicePayment.branchId,
                invoicePayment.paymentMethodId,
                invoicePayment.employeeId,
                invoicePayment.cashierId,
                invoicePayment.paymentMethodAccountId,
                invoicePayment.customerId,
                invoicePayment.paidAmount,
                invoicePayment.paymentDate,
                invoicePayment.updatedDate,
                invoicePayment.rate,
                invoicePayment.referenceNumber,
                JSON.stringify(invoicePayment.attachment),
                invoicePayment.status,
                invoicePayment.bankCharge,
                invoicePayment.onlineData,
                invoicePayment.companyId
                ]
            }


            const insertInvoicePayment = await client.query(query.text, query.values);
            invoicePayment.id = insertInvoicePayment.rows[0].id;

            for (let index = 0; index < invoicePayment.lines.length; index++) {
                const paymentLine = invoicePayment.lines[index];
                paymentLine.invoicePaymentId = invoicePayment.id;
                paymentLine.createdAt = TimeHelper.getCreatedAt(invoicePayment.paymentDate, company.timeOffset);
                paymentLine.branchId = paymentLine.branchId ?? invoicePayment.branchId;
                paymentLine.companyId = company.id
                if (paymentLine.invoiceId) {
                    const invoiceSource = await InvoiceRepo.getInvoiceSource(client, paymentLine.invoiceId);
                    if ((invoiceSource && invoiceSource != null && invoiceSource != undefined && invoiceSource.source == "POS") || (invoiceSource.source == 'Online' && invoiceSource.onlineStatus != 'Pending Payments')) {

                        sendToPos = true
                    }
                }

                if (paymentLine.amount > 0) {
                    const insertInvoicePayment = await this.addInvoicePaymentLine(client, paymentLine, invoicePayment)
                    invoicePayment.lines[index].id = insertInvoicePayment.data.id
                }
            }

            const resData = {
                id: insertInvoicePayment.rows[0].id,
                invoiceIds: invoiceIds
            }

            if (sendToPos) {
                SoketInvoicePayment.sendInvoicePayment(invoicePayment.branchId, invoicePayment)
            }

            return new ResponseData(true, "Added Successfully", resData)
        } catch (error: any) {

          
            console.log(error)
            throw new Error(error.message)
        }
    }

    public static async validateOpeningBalancePaidAmount(client: PoolClient, customerId: string, branchId: string, amount: Number, paymentId: string | null = null) {
        try {


            paymentId = paymentId ?? ""
            const query: { text: string, values: any } = {
                text: `select "CustomerOpeningBalance"."openingBalance"- COALESCE(sum("InvoicePaymentLines"."amount"),0) AS "balance" 
                from "CustomerOpeningBalance" 
                Left join "InvoicePaymentLines" on "InvoicePaymentLines"."openingBalanceId" = "CustomerOpeningBalance".id and "InvoicePaymentLines"."invoicePaymentId"::text<>$3
                where "CustomerOpeningBalance"."branchId" = $1
                and "CustomerOpeningBalance"."customerId" = $2
                group by  "CustomerOpeningBalance"."customerId","CustomerOpeningBalance".id
                HAVING "CustomerOpeningBalance"."openingBalance" - COALESCE(sum("InvoicePaymentLines"."amount"),0)>0 `,
                values: [branchId, customerId, paymentId]
            }




            let openingBalance = await client.query(query.text, query.values);
            console.log(openingBalance, amount)
            if (openingBalance.rowCount != null && openingBalance.rowCount > 0) {

                if (amount > openingBalance.rows[0].balance) {
                    throw new Error("Opening Balance Paid Amunt Exceed Opening Balance Actual amount")
                }

            } else {
                return null

            }

        } catch (error: any) {
            throw new Error(error)
        }
    }

    private static async addInvoicePaymentLine(client: PoolClient, invoicePaymentLine: InvoicePaymentLine, invoicePayment: InvoicePayment) {
        try {



            if ((invoicePaymentLine.invoiceId == "" || invoicePaymentLine.invoiceId == null) && (invoicePaymentLine.openingBalanceId == "" || invoicePaymentLine.openingBalanceId == null)) {
                throw new ValidationException("Invoice Id or Opening Balance Id is Required")
            }



            if (invoicePaymentLine.invoiceId) {
                let invoiceStatus = await InvoiceRepo.getInvoiceStatus(client, invoicePaymentLine.invoiceId);
                if (invoiceStatus == "writeOff") {
                    throw new ValidationException("Draft/writeOff Invoices Are not allowed to be Paid")
                }
                await this.checkInvoiceAddAmount(client, invoicePaymentLine.invoiceId, invoicePaymentLine.amount, invoicePaymentLine.invoicePaymentId)
                invoicePaymentLine.branchId = await this.getInvoicePayemntLineBranchId(invoicePaymentLine.invoiceId)
            } else {

                //edit to openeing balanceId not (invoicePayment.branchId&&invoicePayment.customerId)
                if (invoicePayment.customerId) {
                    await this.validateOpeningBalancePaidAmount(client, invoicePayment.customerId, invoicePaymentLine.branchId ?? invoicePayment.branchId, invoicePaymentLine.amount, invoicePayment.id)

                }
            }

            let referenceId = invoicePaymentLine.invoiceId ?? invoicePaymentLine.openingBalanceId ?? null

            invoicePaymentLine.branchId = referenceId ? await this.getInvoicePayemntLineBranchId(referenceId) : invoicePayment.branchId


            invoicePaymentLine.note = invoicePaymentLine.invoiceId != null && invoicePaymentLine.invoiceId != "" ? invoicePaymentLine.note : "Opening Balance"
            const query: { text: string, values: any } = {
                text: `INSERT INTO "InvoicePaymentLines" ("invoiceId","invoicePaymentId",amount,"createdAt","note","openingBalanceId", "branchId","companyId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
                values: [invoicePaymentLine.invoiceId, invoicePaymentLine.invoicePaymentId, invoicePaymentLine.amount, invoicePaymentLine.createdAt, invoicePaymentLine.note, invoicePaymentLine.openingBalanceId, invoicePaymentLine.branchId, invoicePaymentLine.companyId]
            }

            const lineDate = await client.query(query.text, query.values);
            return new ResponseData(true, "", { id: lineDate.rows[0].id })

        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }

    public static async getOldLineAmount(client: PoolClient, paymentLineId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT amount from "InvoicePaymentLines" where id =$1`,
                values: [paymentLineId]
            }

            let payment = await client.query(query.text, query.values);
            return payment.rows[0].amount
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async checkIfPaymentIdExist(paymentId: string, branchId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT COUNT(*) FROM "InvoicePayments" where  id=$1 and "branchId"=$2 `,
                values: [paymentId, branchId]
            }

            const payments = await DB.excu.query(query.text, query.values);
            if ((<any>payments.rows[0]).count > 0) {
                return true;
            } else {
                return false
            }
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async checkIfPaymentLineIdExists(paymentId: string, invoiceId: string, lineId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT COUNT(*) FROM "InvoicePaymentLines" where id=$1 and "invoiceId"=$2 and "invoicePaymentId" =$3`,
                values: [lineId, invoiceId, paymentId]
            }

            const payment = await DB.excu.query(query.text, query.values)
            if ((<any>payment.rows[0]).count) {
                return true
            } else {
                return false
            }
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async getLogs(client: PoolClient, paymentId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `select logs from "InvoicePayments" where id =$1`,
                values: [paymentId]
            }

            let payment = await client.query(query.text, query.values);
            return payment.rows[0].logs ?? []
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async lineOldDate(client: PoolClient, lineId: string) {
        try {

            const query = {
                text: `SELECT cast ("createdAt" as text) "createdAt" FROM "InvoicePaymentLines" where id  =$1`,
                values: [lineId]
            }
            let line = await client.query(query.text, query.values);
            return line.rows && line.rows.length > 0 ? line.rows[0].createdAt : null
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async editInvoicePayment(client: PoolClient, data: any, company: Company, employeeId: string, source: string | null = null) {



        try {


            //validation 
            const validate = await InvoicePaymentValidation.invoicePaymentValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            const afterDecimal = company.afterDecimal
            const invoicePayment = new InvoicePayment();
            invoicePayment.ParseJson(data);
            invoicePayment.calculateTotal(afterDecimal)

            if (invoicePayment.tenderAmount == 0 && invoicePayment.paidAmount == 0) {
                throw new ValidationException("Payment amount must be grater than zero")
            }
            //invoicePayment.logs = await this.getLogs(client, invoicePayment.id)

            invoicePayment.logs = []

            let sendToPos = false;
            let oldPaymentMethodData = await this.getOldInvoicePaymentMethod(client, invoicePayment.id);
            //Log.addLog(invoicePayment, "Edit", "Edit", employeeId)
            const paymentMethod = (await PaymnetMethodRepo.getPaymnetMethodById(client, company, invoicePayment.paymentMethodId, invoicePayment.branchId)).data
            if (paymentMethod.type != 'Card' && invoicePayment.bankCharge > 0) {
                throw new ValidationException("Bank Charge Cannot be Applied on Cash Payments")
            }
            /** if payment change change accountId */
            /** if  payment method not change check accountId received with  selected payment method  if not equal set to null  so its not changed */
            if (invoicePayment.paymentMethodId != oldPaymentMethodData.id) {
                // if (oldPaymentMethodData && (oldPaymentMethodData.rate != 1 || (oldPaymentMethodData.settings != null && oldPaymentMethodData.settings != '{}'))) {
                //     invoicePayment.paymentMethodId = oldPaymentMethodData.id
                // } else {
                Log.addLog(invoicePayment, `Change Payment Method from ${oldPaymentMethodData.name} to ${invoicePayment.paymentMethodName}`, "Edit", employeeId, { "oldPayment" : oldPaymentMethodData.name, "newPayment": invoicePayment.paymentMethodName })
                invoicePayment.paymentMethodAccountId = paymentMethod.accountId;
                invoicePayment.paymentMethodType = paymentMethod.type;
                // }
            } else if (oldPaymentMethodData && oldPaymentMethodData.paymentMethodAccountId != paymentMethod.id) {
                invoicePayment.paymentMethodAccountId = null
            }

            if (invoicePayment.tenderAmount != 0 && Helper.multiply(invoicePayment.tenderAmount, invoicePayment.rate, afterDecimal) < invoicePayment.paidAmount) {
                throw new ValidationException("Total Paid Amount Exceeded total Recived amount (Payment Made) ")
            }
            if (invoicePayment.tenderAmount != 0 && invoicePayment.bankCharge > invoicePayment.tenderAmount) {
                throw new ValidationException("Bank Charge must be less than Payment Made")
            }

            let oldPaymentDate = await this.getInvoicePayemntDate(invoicePayment.id)
            if (invoicePayment.id == null || invoicePayment.id == "") {
                throw new ValidationException("Invoice Payment Id is Required")
            }

            const invoiceIds: any[] = [];

            const lineIds: any[] = [];
            invoicePayment.lines.forEach(element => {
                invoiceIds.push(element.invoiceId)
                if (element.id != "" && element.id != null && element.amount != 0)
                    lineIds.push(element.id)
            });

            if (invoicePayment.paymentMethodAccountId == "") {
                invoicePayment.paymentMethodAccountId = null
            }
            if (invoicePayment.changeAmount && (invoicePayment.tenderAmount * invoicePayment.rate - invoicePayment.paidAmount) - (invoicePayment.changeAmount * invoicePayment.rate) < 0) {
                throw new ValidationException("Used Amount Exceeded Tender Amount")
            }

            const query: { text: string, values: any } = {
                text: `UPDATE  public."InvoicePayments" SET "tenderAmount"=$1,"paymentDate"=$2,"updatedDate"=$3,"referenceNumber"=$4,"attachment"=$5,"paidAmount"=$6,"bankCharge" =$7,"paymentMethodId"=$8, "paymentMethodAccountId"= case when $9::uuid is null then "paymentMethodAccountId" else $9 end ,"rate"=$10, "changeAmount"=case when $11::float is null then "changeAmount" else $11::float   end   WHERE id = $12`,
                values: [invoicePayment.tenderAmount, invoicePayment.paymentDate, invoicePayment.updatedDate, invoicePayment.referenceNumber, JSON.stringify(invoicePayment.attachment), invoicePayment.paidAmount, invoicePayment.bankCharge, invoicePayment.paymentMethodId, invoicePayment.paymentMethodAccountId, invoicePayment.rate, invoicePayment.changeAmount, invoicePayment.id]
            }

            const updateInvoicePayment = await client.query(query.text, query.values);


            for (let index = 0; index < invoicePayment.lines.length; index++) {
                const paymentLine = invoicePayment.lines[index];
                paymentLine.invoicePaymentId = invoicePayment.id;
                paymentLine.branchId = paymentLine.branchId ?? invoicePayment.branchId;
                paymentLine.companyId = company.id
                if (paymentLine.invoiceId) {
                    const invoiceSource = await InvoiceRepo.getInvoiceSource(client, paymentLine.invoiceId);
                    if ((invoiceSource.source == "POS" || invoiceSource.source == 'Online') && invoicePayment.status == 'SUCCESS') {
                        sendToPos = true
                    }
                }


                if (paymentLine.id == null || paymentLine.id == "") {
                    if (paymentLine.amount > 0) {

                        Log.addLog(invoicePayment, "Add New Line", "Edit", employeeId)
                        const insertPaymentLine = await this.addInvoicePaymentLine(client, paymentLine, invoicePayment)
                        invoicePayment.lines[index].id = insertPaymentLine.data.id
                        lineIds.push(invoicePayment.lines[index].id)
                    }
                } else {
                    const oldLineDate = await this.lineOldDate(client, paymentLine.id)
                    let DATE1 = new Date(oldLineDate);
                    let DATE2 = new Date(oldPaymentDate)
                    // DATE2.setHours(0, 0, 0, 0);


                    if (source != "POS") {
                        if (DATE1.getUTCFullYear() == DATE1.getUTCFullYear() && DATE1.getUTCMonth() == DATE2.getUTCMonth() && DATE1.getUTCDate() == DATE2.getUTCDate()) {
                            paymentLine.createdAt = TimeHelper.getCreatedAt(invoicePayment.paymentDate, company.timeOffset);
                        } else {

                            let currentPaymentDate = new Date(invoicePayment.paymentDate)
                            if (DATE1.getTime() < currentPaymentDate.getTime()) {
                                paymentLine.createdAt = TimeHelper.getCreatedAt(invoicePayment.paymentDate, company.timeOffset);

                            }
                        }
                    }

                    let oldLineTotal = await this.getOldLineAmount(client, paymentLine.id)
                    if (paymentLine.amount != oldLineTotal) {
                        Log.addLog(invoicePayment, "Edit Line ", "Edit", employeeId)
                    }
                    await this.editInvoicePaymentLine(client, paymentLine, invoicePayment)
                }
            }
            await this.deleteZeroLines(client, lineIds, invoicePayment.id) /** when editing on invoice payment method some lines become 0 */

            if (sendToPos) {
                SoketInvoicePayment.sendUpdatedPayment(invoicePayment.branchId, invoicePayment)
            }
            const resaData = {
                id: invoicePayment.id,
                invoiceIds: invoiceIds
            }

            if (employeeId && invoicePayment.logs.length == 0) {
                Log.addLog(invoicePayment, "Edit ", "Edit", employeeId)
            }

            await this.setLogs(client, invoicePayment.id, invoicePayment.logs, invoicePayment.branchId, company.id, employeeId, invoicePayment.referenceNumber, "Cloud")
            return new ResponseData(true, "Updated Successfully", resaData)
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        } finally {

        }
    }
    private static async editInvoicePaymentLine(client: PoolClient, invoicePaymentLine: InvoicePaymentLine, invoicePayment: InvoicePayment) {
        try {


            if ((invoicePaymentLine.invoiceId == "" || invoicePaymentLine.invoiceId == null) && (invoicePaymentLine.openingBalanceId == "" || invoicePaymentLine.openingBalanceId == null)) {
                throw new ValidationException("Invoice Id or Opening Balance Id is Required")
            }
            if (invoicePaymentLine.invoiceId) {
                let invoiceStatus = await InvoiceRepo.getInvoiceStatus(client, invoicePaymentLine.invoiceId);
                if (invoiceStatus == "Draft" || invoiceStatus == "writeOff") {
                    throw new ValidationException("Draft/writeOff Invoices Are not allowed to be Paid")
                }
                await this.checkInvoiceEditAmount(client, invoicePaymentLine.invoiceId, invoicePaymentLine.amount, invoicePaymentLine.invoicePaymentId)
            } else {
                if (invoicePayment.customerId) {
                    await this.validateOpeningBalancePaidAmount(client, invoicePayment.customerId, invoicePaymentLine.branchId ?? invoicePayment.branchId, invoicePaymentLine.amount, invoicePayment.id)

                }
            }

            let referenceId = invoicePaymentLine.invoiceId ?? invoicePaymentLine.openingBalanceId ?? null

            invoicePaymentLine.branchId = referenceId ? await this.getInvoicePayemntLineBranchId(referenceId) : invoicePayment.branchId


            const query: { text: string, values: any } = {
                text: `UPDATE "InvoicePaymentLines" SET amount=$1 , "createdAt"=$2, "branchId"=$3 WHERE id=$4 AND "invoicePaymentId" = $5`,
                values: [invoicePaymentLine.amount, invoicePaymentLine.createdAt, invoicePaymentLine.branchId, invoicePaymentLine.id, invoicePaymentLine.invoicePaymentId]
            }

            const updateInvoicePaymentLine = await client.query(query.text, query.values);
            return updateInvoicePaymentLine;
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }

    public static async deleteZeroLines(client: PoolClient, lineIds: any[], paymentId: string) {
        try {
            await client.query('DELETE FROM "InvoicePaymentLines" where  "invoicePaymentId" =$2 and id <> ALL($1)', [lineIds, paymentId])
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getInvoicePaymentById(invoicePaymentId: string, company: Company,pdf:boolean=false) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "InvoicePayments"."createdAt",
                                    "InvoicePayments".id,
                                    CAST(COALESCE("InvoicePayments"."tenderAmount"::TEXT::NUMERIC,0)   as float)::float  as "tenderAmount",
                                    "InvoicePayments"."rate",
                                    "InvoicePayments"."paidAmount",
                                    "InvoicePayments"."employeeId",
                                    "InvoicePayments"."referenceNumber",
                                    "InvoicePayments"."branchId" ,
                                    (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',COALESCE("Media"."url"->>'downloadUrl',"Media"."url"->>'defaultUrl'),'mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("InvoicePayments"."attachment") as attachments(attachments)
                                    inner join "Media" on "Media".id = (attachments->>'id')::uuid
                                    ) as "attachment",
                                    case when (select count(*) from "InvoicePaymentLines" inner join "Invoices" on "InvoicePaymentLines"."invoiceId" =  "Invoices".id where "source" ='POS' and  "InvoicePaymentLines"."invoicePaymentId" ="InvoicePayments".id group by  "InvoicePaymentLines"."invoicePaymentId" ) >0 then false else true end  as "canBeDeleted",
                                    "Media"."url"->>'defaultUrl' as "mediaUrl",
                                    "Branches".name as "branchName",
                                    "Branches"."phoneNumber" as "branchPhone",
                                    "Branches"."address" as "branchAddress",
                                    "Employees".name as "employeeName",
                                    "Customers".name as "customerName",
                                    "Customers"."phone" as "customerContact",
                                     "Customers"."email" as "customerEmail",
                                    "PaymentMethods".name as "paymentMethodName",
                                    "PaymentMethods".symbol as "paymentSymbol",
                                    "InvoicePayments"."customerId",
                                    "InvoicePayments"."changeAmount",
                                    "InvoicePayments"."bankCharge",
                                    "InvoicePayments"."paymentMethodId",
                                    "Accounts".name as "accountName",
                                    CAST( "InvoicePayments"."paymentDate" AS TEXT) AS "paymentDate",
                                    CASE WHEN "Reconciliations"."id" is not null and "Reconciliations"."status" = 'reconciled' then true else false end as "reconciled"
                                    FROM "InvoicePayments"
                            INNER JOIN "Branches"  ON "Branches".id = "InvoicePayments"."branchId"
                            LEFT JOIN "Employees" ON "Employees".id = "InvoicePayments"."employeeId"
                            LEFT JOIN "Customers" ON "Customers".id = "InvoicePayments"."customerId"
                            LEFT JOIN "Media" ON "Customers".id = "InvoicePayments"."mediaId"
                            LEFT JOIN "Reconciliations" ON "Reconciliations".id = "InvoicePayments"."reconciliationId"
                            INNER JOIN "PaymentMethods" ON "PaymentMethods".id = "InvoicePayments"."paymentMethodId"
                            LEFT JOIN "Accounts" ON "Accounts".id = "InvoicePayments"."paymentMethodAccountId"
                        where "InvoicePayments".id = $1
                        AND "Branches"."companyId"=$2
                        `,
                values: [invoicePaymentId, company.id]
            }

            const selectedData = await DB.excu.query(query.text, query.values);
            const invoicePayment: any = selectedData.rows[0]

            let invoicePaymentData = new InvoicePayment()
            invoicePaymentData.ParseJson(invoicePayment)
            if (selectedData.rows && selectedData.rows.length > 0 && selectedData.rows[0] && (<any>selectedData.rows[0]).id != "" && (<any>selectedData.rows[0]).id != null) {
                invoicePayment.lines = []
                query.text = `
with "lines" as (

SELECT
            "InvoicePaymentLines".id,
            "InvoicePaymentLines".note,
            "InvoicePaymentLines"."invoiceId",
            "InvoicePaymentLines"."openingBalanceId",
            "InvoicePaymentLines"."branchId",
            "Branches"."name" as "branchName",
            "InvoicePaymentLines".amount,
            CAST( "InvoicePaymentLines"."createdAt" AS TEXT),
	        "Companies"."createdAt" as "companyCreatedAt",
	        "Branches"."openingBalanceDate" as "openingBalanceDate"
	         
            FROM "InvoicePaymentLines"
	        INNER JOIN "InvoicePayments" ON "InvoicePayments".id = "InvoicePaymentLines"."invoicePaymentId"
	        JOIN "Branches" ON "Branches".id =   COALESCE("InvoicePaymentLines"."branchId" ,"InvoicePayments"."branchId") 
            JOIN "Companies" On "Companies".id = "Branches"."companyId"
	        WHERE  "InvoicePaymentLines"."invoicePaymentId"=$1
            AND  "InvoicePaymentLines".amount > 0
),"invoices" as (

select "lines".*,
	   "Invoices"."total",
	 
	   "Invoices"."invoiceNumber",
	    "Invoices"."invoiceDate" 
	from "lines" 
inner join "Invoices" on "Invoices".id = "lines"."invoiceId"

),"creditNotes" as (
select "invoices"."invoiceId" , sum("CreditNotes"."total") as "amount" from "invoices"
inner join "CreditNotes" on "CreditNotes"."invoiceId" = "invoices"."invoiceId"
	group by "invoices"."invoiceId"
),"appliedCredit" as (
select "invoices"."invoiceId" , sum("AppliedCredits"."amount") as "amount" from "invoices"
inner join "AppliedCredits" on "AppliedCredits"."invoiceId" = "invoices"."invoiceId"
	group by "invoices"."invoiceId"
),"payments" as (
select "invoices"."invoiceId" , sum("InvoicePaymentLines"."amount") as "amount" from "invoices"
inner join "InvoicePaymentLines"on "InvoicePaymentLines"."invoiceId" = "invoices"."invoiceId"
	and "InvoicePaymentLines"."invoicePaymentId" <>$1
	group by "invoices"."invoiceId"
),"refunds" as(
select "invoices"."invoiceId" , sum("CreditNoteRefunds"."total") as "amount" from "invoices"
inner join "CreditNotes" on "CreditNotes"."invoiceId" = "invoices"."invoiceId"
INNER JOIN "CreditNoteRefunds" on "CreditNoteRefunds"."creditNoteId"= "CreditNotes"."id"
group by "invoices"."invoiceId"
),"openingBalance" as (
select "lines".*,
	"CustomerOpeningBalance"."openingBalance" as "total",
     'Opening Balance' as "invoiceNumber",
	 case when "openingBalanceDate" is not null then "openingBalanceDate" else "companyCreatedAt" - interval '1 days'  end as "invoiceDate",
	COALESCE( sum("InvoicePaymentLines"."amount"),0) as "paidAmount",
	 0 as "refunded"
	from "lines"
	inner join "CustomerOpeningBalance" on "CustomerOpeningBalance".id = "lines"."openingBalanceId"
	left join "InvoicePaymentLines" on "InvoicePaymentLines"."openingBalanceId" = "CustomerOpeningBalance".id and "InvoicePaymentLines"."invoicePaymentId" <>$1
	where "lines"."openingBalanceId" is not null 
	group by  "lines".id,
            "lines".note,
            "lines"."invoiceId",
            "lines"."openingBalanceId",
            "lines"."branchId",
             "lines"."branchName",
            "lines".amount,
            "lines"."createdAt" ,
	        "lines"."companyCreatedAt",
	        "lines"."openingBalanceDate",
	"CustomerOpeningBalance".id
), "records" as (

select "invoices".*,
        COALESCE("creditNotes"."amount",0) +   COALESCE("appliedCredit"."amount",0) +    COALESCE("payments"."amount",0)as "paidAmount",
		COALESCE("refunds"."amount",0) AS "refunded"
from "invoices"
left join "creditNotes" on "creditNotes"."invoiceId" = "invoices"."invoiceId"
left join "appliedCredit" on "appliedCredit"."invoiceId" = "invoices"."invoiceId"
left join "payments" on "payments"."invoiceId" = "invoices"."invoiceId"
left join "refunds" on "refunds"."invoiceId" = "invoices"."invoiceId"
union all 
select * from "openingBalance"	
)

select * from "records"


                               `
                query.values = [invoicePaymentId]
                let customerId;
                const paymentLineData = await DB.excu.query(query.text, [invoicePaymentId]);
                for (let index = 0; index < paymentLineData.rows.length; index++) {
                    const paymentLine: any = paymentLineData.rows[index];
                    customerId = paymentLine.customerId;
                    const temp = new InvoicePaymentLine();
                    temp.ParseJson(paymentLine);

                    invoicePaymentData.lines.push(temp)
                    invoicePayment.lines.push(paymentLine)
                }



                if (!pdf&&invoicePayment.tenderAmount > 0 && ((invoicePayment.tenderAmount * invoicePayment.rate) - (invoicePayment.changeAmount * invoicePayment.rate)) > invoicePayment.paidAmount) {
                    const customerInvoices = await InvoiceRepo.getCustomerInvoices(invoicePayment.customerId, invoicePayment.branchId)

                    customerInvoices.data.forEach((element: any) => {
                        const paymentLine = new InvoicePaymentLine();
                        paymentLine.ParseJson(element);
                        const temp: any = invoicePayment.lines.find((f: any) => f.invoiceId == element.invoiceId)

                        if (invoicePayment.lines.indexOf(temp) == -1) {
                            invoicePaymentData.lines.push(paymentLine)
                            invoicePayment.lines.push(paymentLine)
                        }

                    });
                }
            }
            //   invoicePaymentData.lines = invoicePayment.lines;
            invoicePaymentData.calculateTotal(company.afterDecimal)
            return new ResponseData(true, "", invoicePaymentData)
        } catch (error: any) {

          
            throw new Error(error.message)
        }
    }

    public static async getInvoicePaymentsList(data: any, company: Company, branchList: []) {

        try {



            //########################### Filter ########################### 

            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;

            const filter = data.filter
            let filterQuery = ``;
            const fromDate = filter && filter.fromDate ? `AND  "InvoicePayments"."paymentDate"::date >= '${filter.fromDate}'::date ` : ''
            filterQuery += fromDate
            const toDate = filter && filter.toDate ? ` AND  "InvoicePayments"."paymentDate"::date <= '${filter.toDate}'::date ` : ''
            filterQuery += toDate





            let searchValue = data.searchTerm ? `'%` + Helper.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `%'` : null;
            let joinQuery = ''
            if (searchValue || filterQuery != '') {
                if (searchValue) {
                    filterQuery += ` AND (LOWER("Customers".name) ilike ${searchValue}
                    OR LOWER("Employees".name) ilike ${searchValue}
                    OR LOWER("Branches".name) ilike ${searchValue}
                    OR LOWER("Invoices"."invoiceNumber") ilike ${searchValue} 
                    OR LOWER("Invoices"."refrenceNumber") ilike ${searchValue} 
                    OR nullif(regexp_replace("invoiceNumber", '[A-Z]*-', ''),'') ilike ${searchValue}
                           )`
                }

                joinQuery = `left join "InvoicePaymentLines" on  "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id
                             left JOIN "Invoices"  on "Invoices"."branchId" = COALESCE("InvoicePayments"."branchId", "InvoicePaymentLines"."branchId")  and  "Invoices".id = "InvoicePaymentLines"."invoiceId" 
                             and ( LOWER("Invoices"."invoiceNumber") ilike ${searchValue}  or nullif(regexp_replace("invoiceNumber", '[A-Z]*-', ''),'') ilike ${searchValue})
                             `
            }

            //########################### Sort ########################### 

            let sort = data.sortBy;
            let sortValue = !sort ? ' "InvoicePayments"."createdAt" ' : '"' + sort.sortValue + '"';
            let sortValue2 = !sort ? ' "payments"."createdAt" ' : '"' + sort.sortValue + '"';
            if (data.paymentId != null && data.paymentId != "") {
                sortValue = ` "InvoicePayments"."id" = ` + "'" + data.paymentId + "'"
            }
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection
            let sortTerm2 = sortValue2 + " " + sortDirection
            let orderByQuery = ` Order by` + sortTerm
            let orderByQuery2 = ` Order by` + sortTerm2


            //########################## Limit ########################### 

            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            let page = data.page ?? 1
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            //########################### Count ########################### 

            const counterQuery: { text: string, values: any } = {
                text: `
                       SELECT
                           count(distinct "InvoicePayments".id)
                        FROM "InvoicePayments"
                        INNER JOIN "Branches" ON "Branches".id = "InvoicePayments"."branchId"
                    
                        WHERE "InvoicePayments"."status" NOT IN ('FAILD', 'PENDING')
                            AND "Branches"."companyId" = $1 
                            AND (array_length( $2::uuid[], 1) IS NULL OR "Branches".id = ANY( $2::uuid[]))
                       
                                
                       `,
                values: [company.id, branches]
            }
            if (joinQuery != '') {
                counterQuery.text = `  SELECT
                           count(distinct "InvoicePayments".id)
                        FROM "InvoicePayments"
                        INNER JOIN "Branches" ON "Branches".id = "InvoicePayments"."branchId"
                            AND "Branches"."companyId" = $1
                        LEFT JOIN "Customers" ON "Customers".id = "InvoicePayments"."customerId"
                            AND "Customers"."companyId" =  $1
                        LEFT JOIN "Employees" ON "Employees".id = "InvoicePayments"."employeeId"
                            AND "Employees"."companyId" =  $1
                        LEFT JOIN "Reconciliations" ON "Reconciliations".id = "InvoicePayments"."reconciliationId"
                            AND "Reconciliations"."companyId" =  $1
                        ${joinQuery}
                        WHERE "InvoicePayments"."status" NOT IN ('FAILD', 'PENDING')
                            AND "Branches"."companyId" = $1 
                            AND (array_length( $2::uuid[], 1) IS NULL OR "Branches".id = ANY( $2::uuid[]))
                        ${filterQuery}`
            }
            const counterQueryRes = DB.excu.query(counterQuery.text, counterQuery.values)

            //########################### Select ########################### 

            const query: { text: string, values: any } = {

                text: `with "payments" as (SELECT
                            "InvoicePayments".id,
                            "InvoicePayments"."tenderAmount",
                            "InvoicePayments"."customerId",
                            "InvoicePayments"."paymentDate",
                            "InvoicePayments"."createdAt",
                            "InvoicePayments"."referenceNumber",
                            "InvoicePayments"."employeeId",
                            "InvoicePayments"."reconciliationId",
                            "InvoicePayments"."paymentMethodId",
                  
                            "InvoicePayments"."rate",
                            "InvoicePayments"."branchId",
                            "InvoicePayments"."paidAmount",
					        "Branches"."name" as "branchName"
                        FROM "InvoicePayments"
                             LEFT JOIN "Branches" ON "Branches".id = "InvoicePayments"."branchId"
                            AND "Branches"."companyId" = $1

                            WHERE (   $2::uuid[] IS NULL OR "InvoicePayments"."branchId" = ANY($2))
                                          AND "InvoicePayments"."status" NOT IN ('FAILD', 'PENDING')


                           ${orderByQuery}
                        LIMIT $3 OFFSET $4
                        )

                        select "payments".id,
                            "payments"."tenderAmount",
                            "payments"."customerId",
                            "payments"."paymentDate",
                            "payments"."createdAt",
                            "payments"."referenceNumber",
                            "payments"."employeeId",
                            "payments"."reconciliationId",
                            "payments"."paymentMethodId",
                            "payments"."rate",
                            "payments"."paidAmount",
                            "payments"."branchName",
                            "Employees".name as "employeeName",
                            "Customers".name as "customerName",
                            "PaymentMethods".name AS  "paymentMethodName",
                            JSON_AGG("Invoices"."invoiceNumber") as "invoicesNumber",
                                               CASE WHEN "Reconciliations"."id" is not null and "Reconciliations"."status" = 'reconciled' then true else false end as "reconciled"

                            from "payments"
                        LEFT join "InvoicePaymentLines" on  "InvoicePaymentLines"."invoicePaymentId" = "payments".id
                        LEFT JOIN "Invoices"  on "Invoices"."branchId" = COALESCE("payments"."branchId", "InvoicePaymentLines"."branchId")  and  "Invoices".id = "InvoicePaymentLines"."invoiceId"
                   
                        LEFT JOIN "PaymentMethods" ON "PaymentMethods".id = "payments"."paymentMethodId"
                            AND "PaymentMethods"."companyId" = $1
                        LEFT JOIN "Customers" ON "Customers".id = "payments"."customerId"
                            AND "Customers"."companyId" =  $1
                        LEFT JOIN "Employees" ON "Employees".id = "payments"."employeeId"
                            AND "Employees"."companyId"  =$1
                        LEFT JOIN "Reconciliations" ON "Reconciliations".id = "payments"."reconciliationId"
                        AND "Reconciliations"."companyId" = $1
						group by "payments".id,
                            "payments"."tenderAmount",
                            "payments"."customerId",
                            "payments"."paymentDate",
                            "payments"."createdAt",
                            "payments"."referenceNumber",
                            "payments"."employeeId",
                             "paymentMethodName",
                            "payments"."reconciliationId",
                            "payments"."paymentMethodId",
                            "payments"."rate",
                            "payments"."paidAmount",
                            "Reconciliations".id,
                           "branchName",
                           "employeeName",
                            "customerName"
                            ${orderByQuery2}

                                 `,
                values: [company.id, branches, limit, offset]
            }
            if (joinQuery != '' || filterQuery != '') {

                query.text = `
                       SELECT
                            "InvoicePayments".id,
                            "InvoicePayments"."tenderAmount",
                            "InvoicePayments"."customerId",
                            "InvoicePayments"."paymentDate",
                            "InvoicePayments"."createdAt",
                            "InvoicePayments"."referenceNumber",
                            "InvoicePayments"."employeeId",
                            "InvoicePayments"."reconciliationId",
                            "InvoicePayments"."paymentMethodId",
                            "InvoicePayments"."rate",
                                  "PaymentMethods"."name" as "paymentMethodName",
                            "InvoicePayments"."paidAmount",
                            "Branches".name AS "branchName",
                            "Employees".name AS "employeeName",
                            "Customers".name AS "customerName",
                             JSON_AGG("Invoices"."invoiceNumber") as "invoicesNumber",
                                                CASE WHEN "Reconciliations"."id" is not null and "Reconciliations"."status" = 'reconciled' then true else false end as "reconciled"

                        FROM "InvoicePayments"
                        LEFT JOIN "Branches" ON "Branches".id = "InvoicePayments"."branchId"
                            AND "Branches"."companyId" = $1
                               LEFT JOIN "PaymentMethods" ON "PaymentMethods".id = "InvoicePayments"."paymentMethodId"
                            AND "PaymentMethods"."companyId" = $1
                        LEFT JOIN "Customers" ON "Customers".id = "InvoicePayments"."customerId"
                            AND "Customers"."companyId" =  $1
                        LEFT JOIN "Employees" ON "Employees".id = "InvoicePayments"."employeeId"
                            AND "Employees"."companyId"  = $1
                        LEFT JOIN "Reconciliations" ON "Reconciliations".id = "InvoicePayments"."reconciliationId"
                        AND "Reconciliations"."companyId" = $1
                        ${joinQuery}
              
                            WHERE ( "InvoicePayments"."branchId" is null or   (array_length( $2::uuid[], 1) IS NULL OR "Branches".id = ANY( $2::uuid[])))
                                    AND "InvoicePayments"."status" NOT IN ('FAILD', 'PENDING')
                
                            ${filterQuery}
                        GROUP BY
                            "InvoicePayments".id,
                            "Branches".id,
                            "Employees".id,
                            "Customers".id,
                             "Reconciliations".id,
                               "PaymentMethods".id
                        ${orderByQuery}
                        LIMIT $3 OFFSET $4

                `
            }

            console.log(query.text)
            console.log(query.values)
            const selectListQueryRes = DB.excu.query(query.text, query.values)

            const results = await Promise.all([counterQueryRes, selectListQueryRes])


            const counter = results[0];
            const selectList = results[1];

            //######################## Response Data ######################## 

            const list = selectList.rows && selectList.rows.length > 0 ? selectList.rows : []
            const count = counter.rows && counter.rows.length > 0 ? Number((<any>counter.rows[0]).count) : 0
            //  const count = 222009
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: list,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getInvoicePayments(client: PoolClient, invoiceId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT "InvoicePayments".id,
                "InvoicePayments"."createdAt" ,
                              "paymentMethodId",
                              (SELECT name from "PaymentMethods" INNER JOIN "InvoicePayments" ON "InvoicePayments"."paymentMethodId" =  "PaymentMethods".id INNER JOIN "InvoicePaymentLines" ON "InvoicePaymentLines"."invoicePaymentId" ="InvoicePayments".id AND "InvoicePaymentLines"."invoiceId"=$1 ) AS "paymentType",
                              "tenderAmount",
                              "cashierId",
                              "employeeId",
                              (SELECT json_agg(
                              json_build_object('id',id,'amount',amount)
                              )FROM "InvoicePaymentLines"
                              where "InvoicePaymentLines"."invoiceId" =$1
                              )as "invoicePaymentLines"
                      FROM "InvoicePayments" 
                      INNER JOIN "InvoicePaymentLines" 
                      ON "InvoicePayments".id = "InvoicePaymentLines"."invoicePaymentId"
                      AND "InvoicePaymentLines"."invoiceId"=$1
            
                               `,
                values: [invoiceId]
            }

            const invoicePayments = await client.query(query.text, query.values);

            return invoicePayments.rows;
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getInvoicePaymentJournal(invoicePaymentId: string, company: Company) {

        try {

            //Return invoice payment journal
            //when normal payment
            // paymentMethod account (Bank or Cash):==> Credit
            // account receivable :==> Debit 
            const defaultJournals = await JournalRepo.getJournal(invoicePaymentId, company)
            const journals: any[] = [];

            let invoiceIds: any[] = [];


            //RETRIVE INVOICE PAYMENT LINES JOURNAS WHEN A INVOICE IS PAID IN A DIFFERENT DATE/TIME FROM THE PAYMENT
            //Unearned revenu ==> debit 
            //account receivable ==> credit 
            const query: { text: string, values: any } = {
                text: `SELECT  
                 sum( case when "JournalRecords".amount > 0 then "JournalRecords".amount end ) as debit,
                 sum( case when "JournalRecords".amount < 0 then  ABS("JournalRecords".amount) end )  as credit,
                name as "accountType",
                "JournalRecords"."createdAt",
                "InvoicePaymentLines".id,
                "Invoices"."invoiceNumber"
          FROM "JournalRecords"
          INNER JOIN "InvoicePaymentLines"
          ON "referenceId" = "InvoicePaymentLines".id
          INNER JOIN "Invoices"
          ON "InvoicePaymentLines"."invoiceId" = "Invoices".id
          WHERE  "InvoicePaymentLines"."invoicePaymentId" = $1
          group by "JournalRecords"."accountId" , name,  "JournalRecords"."createdAt","InvoicePaymentLines".id ,  "Invoices".id`,
                values: [invoicePaymentId]
            }

            const journal = await DB.excu.query(query.text, query.values);

            for (let index = 0; index < journal.rows.length; index++) {
                const element: any = journal.rows[index];
                const createdAt = new Date(element.createdAt).getTime();

                const journalData = journals.find((f: any) => f.id == element.id && f.createdAt == createdAt)
                const journalInfo = {
                    credit: element.credit,
                    debit: element.debit,
                    accountType: element.accountType
                }
                if (journalData) {
                    const journalIndex = journals.indexOf(journalData);
                    journals[journalIndex].journals.push(journalInfo);
                } else {
                    const data: any = {
                        createdAt: createdAt,
                        id: element.id,
                        invoiceNumber: element.invoiceNumber,
                        journals: []
                    }

                    data.journals.push(journalInfo)
                    journals.push(data);
                }

            }

            const resaData = {
                defaultJournals: defaultJournals.data,
                extraJournals: journals,
            }
            return new ResponseData(true, "", resaData)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async getPaymentTotal(client: PoolClient, paymentId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "paidAmount","branchId" from "InvoicePayments" where id =$1`,
                values: [paymentId]
            }
            const paymnet = await client.query(query.text, query.values);
            return {
                paidAmount: (<any>paymnet.rows[0]).paidAmount,
                branchId: (<any>paymnet.rows[0]).branchId
            }
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async setPaymentTotal(client: PoolClient, paymentId: string, total: number) {
        try {
            const query: { text: string, values: any } = {
                text: `UPDATE "InvoicePayments" set "paidAmount" =$1 where id=$2`,
                values: [total, paymentId]
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async checkInvoiceExist(client: PoolClient, paymentId: string, invoiceId: string) {
        try {
            const query = {
                text: `SELECT * FROM "InvoicePaymentLines" where "invoiceId"=$1 and "invoicePaymentId" =$2`,
                values: [invoiceId, paymentId]
            }

            let invoice = await client.query(query.text, query.values);

            return invoice.rows && invoice.rows.length > 0 ? invoice.rows[0] : null
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async applyInvoicePaymentUnearnedRevenue(data: any, company: Company) {
        const client = await DB.excu.client();

        try {
            const companyId = company.id;
            const validate = await AppliedCreditsValidation.invoiceApplyCreditValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            await client.query("BEGIN")
            const invoicePayment = new InvoicePayment();
            const invoicePaymentLine = new InvoicePaymentLine();

            let paymentBalance = await this.getPaymentBalance(client, data.id);
            let invoicePaymentData = (await this.getPaymentTotal(client, data.id))
            let invoicePaymentTotal = invoicePaymentData.paidAmount
            // invoicePaymentTotal += data.amount;

            if (paymentBalance < data.amount) {
                throw Error("Paid Amount Exceeded Unused payment balance")
            }

            const isInvoiceExist = await this.checkInvoiceExist(client, data.id, data.invoiceId)
            if (isInvoiceExist) {
                invoicePaymentLine.ParseJson(isInvoiceExist);
                invoicePaymentLine.amount += data.amount;
                await this.editInvoicePaymentLine(client, invoicePaymentLine, invoicePayment)
            } else {
                invoicePaymentLine.invoicePaymentId = data.id;
                invoicePaymentLine.amount = data.amount;
                invoicePaymentLine.invoiceId = data.invoiceId;
                invoicePaymentLine.companyId = company.id
                invoicePaymentLine.branchId = invoicePaymentData.branchId;
                await this.addInvoicePaymentLine(client, invoicePaymentLine, invoicePayment)
            }



            await this.setPaymentTotal(client, data.id, invoicePaymentTotal)
            await client.query("COMMIT")
            return new ResponseData(true, "", [])

        } catch (error: any) {
          
            await client.query("ROLLBACK")
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }



    public static async canPaymentBeDeleted(client: PoolClient, invoicePaymentId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT * FROM "InvoicePaymentLines"
                      inner join "Invoices" ON "InvoicePaymentLines"."invoiceId" = "Invoices".id 
                      where "Invoices"."source"= 'POS' 
                      AND "InvoicePaymentLines"."invoicePaymentId" =$1`,
                values: [invoicePaymentId]
            }

            let payment = await client.query(query.text, query.values);

            if (payment.rowCount != null && payment.rowCount > 0) {
                throw new ValidationException("Cannot be deleted")
            }

            return true
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async deleteInvoicePayments(invoicePaymentId: string, company: Company, employeeId: string) {
        const client = await DB.excu.client();
        try {

            await this.canPaymentBeDeleted(client, invoicePaymentId)

            const lineQuery = {
                text: `SELECT JSON_AGG("InvoicePaymentLines".id) as "ids",
                JSON_AGG("InvoicePaymentLines"."invoiceId") as "invoiceIds",
				JSON_AGG("Invoices"."source") as "sources","InvoicePayments"."branchId",
                  "InvoicePayments"."customerId",
                 "InvoicePayments"."paymentDate",
                 "InvoicePayments"."referenceNumber",
                 "Employees"."name" as "employeeName"
				FROM "InvoicePayments"
				left join "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id
				left join "Invoices" on "Invoices".id = "InvoicePaymentLines"."invoiceId"
                INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2
				where "InvoicePayments".id = $1
				group by "InvoicePayments".id, "Employees".id`,
                values: [invoicePaymentId, employeeId, company.id]
            }

            const lineIds = await client.query(lineQuery.text, lineQuery.values)
            let ids = lineIds.rows && lineIds.rows.length > 0 ? lineIds.rows[0].ids : []
            let invoiceIds = lineIds.rows && lineIds.rows.length > 0 ? lineIds.rows[0].invoiceIds : []
            let branchId = lineIds.rows && lineIds.rows.length > 0 ? lineIds.rows[0].branchId : null
            let sources = lineIds.rows && lineIds.rows.length > 0 ? lineIds.rows[0].sources : null
            let customerId = lineIds.rows && lineIds.rows.length > 0 ? lineIds.rows[0].customerId : null
            let referenceNumber = lineIds.rows && lineIds.rows.length > 0 && lineIds.rows[0].referenceNumber ? lineIds.rows[0].referenceNumber : ''
            let employeeName = lineIds.rows && lineIds.rows.length > 0 && lineIds.rows[0].employeeName ? lineIds.rows[0].employeeName : ''


            let paymentDate = lineIds.rows && lineIds.rows.length > 0 ? lineIds.rows[0].paymentDate : null
            const valuesToCheck = ['POS', 'Online', 'CallCenter'];
            let source = sources && valuesToCheck.some(value => sources.includes(value)) ? 'POS' : 'Cloud'

            // await this.canPaymentBeDeleted(client, invoicePaymentId)
            await client.query("BEGIN")
            const query: { text: string, values: any } = {
                text: `DELETE FROM "InvoicePaymentLines" using "InvoicePayments"
                      where "InvoicePaymentLines"."invoicePaymentId" ="InvoicePayments".id
                      and "InvoicePayments".id =$1`,
                values: [invoicePaymentId]
            }

            await client.query(query.text, query.values)
            query.text = `DELETE FROM "InvoicePayments" 
            where "InvoicePayments".id =$1`

            await client.query(query.text, query.values)

            let log = new Log();
            log.employeeId = employeeId
            log.action = 'Invoice payment Deleted'
            log.comment = `${employeeName} has deleted invoice payment ref number ${referenceNumber}`
            log.metaData = {"deleted": true}

            await LogsManagmentRepo.manageLogs(client, "InvoicePayments", invoicePaymentId, [log], branchId, company.id,employeeId, referenceNumber,source)


            EventLogsSocket.deleteInvoicePaymentSync(branchId, invoicePaymentId)
            await client.query("COMMIT")

            return new ResponseData(true, "", { ids: ids, invoiceIds: invoiceIds, customerId: customerId })
        } catch (error: any) {
          

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    public static async checkInvoiceEditAmount(client: PoolClient, invoiecId: string, amount: number, paymentId: string) {
        try {

            const balanceData = await InvoiceRepo.getInvoiceBalance(client, invoiecId, paymentId);
            let balance = balanceData.data.balance
            const invoiceNumber = balanceData.data.invoiceNumber

            if (balance && (balance < amount)) {

                throw new ValidationException("Invalid  Payment Amount for " + invoiceNumber)
            }
            return balance - amount;
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async checkInvoiceAddAmount(client: PoolClient, invoiecId: string, amount: number, invoicePaymentId: string | null = null) {
        try {

            const balanceData = await InvoiceRepo.getInvoiceBalance(client, invoiecId, invoicePaymentId);
            let balance = balanceData.data.balance
            const invoiceNumber = balanceData.data.invoiceNumber
            // if (typeof excludeAmount !== 'undefined') {
            //     balance += excludeAmount;
            // }

            if (balance && balance < amount) {

                throw new ValidationException("Invalid  Payment Amount  " + (invoiceNumber ? "for " + invoiceNumber : ""))
            }
            return balance - amount;
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }

    public static async setLogs(client: PoolClient, paymentId: string, logs: Log[], branchId: string, companyId: string,employeeId:string, invoicePaymentNumber:string | null, source:string) {
        try {
            await LogsManagmentRepo.manageLogs(client, "InvoicePayments", paymentId, logs, branchId, companyId, employeeId, invoicePaymentNumber, source)

        } catch (error: any) {
            throw new Error(error)
        }
    }




    public static async VoidGruptechPayment(client: PoolClient, invoiceId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `UPDATE "InvoicePayments" SET status = 'FAILD',"onlineData" = '{"reason": "Cancelled By Aggregator"}'WHERE id IN 
                (SELECT ip.id FROM "InvoicePayments" ip 
                INNER JOIN "InvoicePaymentLines" ipl ON ip.id = ipl."invoicePaymentId"
                 WHERE ipl."invoiceId" =$1);`,
                values: [invoiceId]
            }
            await client.query(query.text, query.values)
        } catch (error: any) {
            throw new Error(error)
        }
    }








    public static async sendEmail(data: any, company: Company) {
        try {

            let pdfGenerator = new PDFGenerator()
            data.type = "invoicePayment";
            let pdfBuffer = await pdfGenerator.sendEmail(data, company);

            return pdfBuffer
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }

    }

    public static async getPdf(data: any, company: Company) {
        try {

            let pdfGenerator = new PDFGenerator()
            data.type = "invoicePayment";
            let pdfBuffer = await pdfGenerator.getPdf(data);
            return pdfBuffer
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }

    public static async getPaymentInvoiceIds(paymentId: string) {
        try {
            const query = {
                text: `SELECT JSON_AGG("InvoicePaymentLines"."invoiceId") as "invoiceIds" from "InvoicePaymentLines" where "InvoicePaymentLines"."invoicePaymentId"=$1 `,
                values: [paymentId]
            }

            let invoices = await DB.excu.query(query.text, query.values);

            return invoices.rows && invoices.rows.length > 0 && (<any>invoices.rows)[0].invoiceIds ? (<any>invoices.rows)[0].invoiceIds : []
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getPaymentLinesIds(paymentId: string) {
        try {
            const query = {
                text: `SELECT JSON_AGG("InvoicePaymentLines"."id") as "ids" from "InvoicePaymentLines" where "InvoicePaymentLines"."invoicePaymentId"=$1 `,
                values: [paymentId]
            }

            let invoices = await DB.excu.query(query.text, query.values);

            return invoices.rows && invoices.rows.length > 0 && (<any>invoices.rows)[0].ids ? (<any>invoices.rows)[0].ids : []
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getOldInvoicePaymentMethod(client: PoolClient, invoicePaymentId: string) {
        try {
            const query = {
                text: `SELECT "PaymentMethods".rate,"PaymentMethods".name, "PaymentMethods"."settings", "PaymentMethods".id , "InvoicePayments"."paymentMethodAccountId" FROM "InvoicePayments" 
                      inner join "PaymentMethods" on "PaymentMethods".id = "InvoicePayments"."paymentMethodId"
                      where "InvoicePayments".id =$1
                `,
                values: [invoicePaymentId]
            }

            let paymentMethod = await client.query(query.text, query.values);

            return paymentMethod.rows[0]
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getInvoicPaymentIdByInvoice(client: PoolClient, invoiceId: string) {
        try {
            const query = {
                text: `SELECT "invoicePaymentId" from "InvoicePaymentLines" where "invoiceId" = $1`,
                values: [invoiceId]
            }

            let invoice = await client.query(query.text, query.values);

            return invoice && invoice.rows && invoice.rows.length > 0 && invoice.rows[0].invoicePaymentId ? invoice.rows[0].invoicePaymentId : null
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getInvoicePayemntLineBranchId(id: string) {
        try {
            const query: { text: string, values: any } = {
                text: `select "branchId" FROM "Invoices" where id =$1
                union 
                select  "branchId" FROM "CustomerOpeningBalance" where id =$1`,
                values: [id]
            }
            let date = await DB.excu.query(query.text, query.values)
            if (date.rowCount != null && date.rowCount > 0) {
                return (<any>date.rows[0]).branchId
            }
            return null
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

}