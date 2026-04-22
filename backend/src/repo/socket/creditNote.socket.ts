import { DB } from "@src/dbconnection/dbconnection";
import { BranchesRepo } from "../admin/branches.repo";
import { Socket } from "socket.io";
import { CreditNote } from "@src/models/account/CreditNote";
import { CreditNoteRepo } from "../app/accounts/creditNote.Repo";
import { SocketController } from "@src/socket";
import { RedisClient } from "@src/redisClient";


import { TimeHelper } from "@src/utilts/timeHelper";
import { PoolClient } from "pg";

import { CompanyRepo } from "../admin/company.repo";
import { AccountsRepo } from "../app/accounts/account.repo";
import { CreditNoteLine } from "@src/models/account/CreditNoteLine";
import { ProductRepo } from "../app/product/product.repo";
import { CreditNoteMovmentRepo } from "../app/accounts/creditNoteMovment.repo";
import { ViewQueue } from "@src/utilts/viewQueue";
import { SocketInvoiceRepo } from "./invoice.socket";
import { terminalRepo } from "../app/terminal/terminal.repo";
import { SocketEstimateRepo } from "./Estimate.socket";
import { CreditNoteLineOption } from "@src/models/account/CreditNoteLineOptions";
import { TriggerQueue } from "../triggers/triggerQueue";
import { Helper } from "@src/utilts/helper";
import { ResponseData } from "@src/models/ResponseData";
import { SocketErrorLogs, SocketLogs } from "./socketErrorLogs";
import { InvoiceStatuesQueue } from "../triggers/queue/workers/invoiceStatus.worker";
import { CustomerBalanceQueue } from "../triggers/userBalancesQueue";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";

export class SocketCreditNoteRepo {
    static redisClient: any;

    public static async checkIfCreditNoteIdExist(client: PoolClient, creditNoteId: string, branchId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT COUNT(*) FROM "CreditNotes" where id = $1 and "branchId"=$2 `,
                values: [creditNoteId, branchId]
            }
            const count = await client.query(query.text, query.values);

            if ((<any>count.rows[0]).count > 0) {
                return true
            } else {
                return false
            }
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async checkIfCreditNoteOptionIdExist(client: PoolClient, optionId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT COUNT(*) FROM "CreditNoteLineOptions" where id = $1 `,
                values: [optionId]
            }
            const count = await client.query(query.text, query.values);

            if ((<any>count.rows[0]).count > 0) {
                return true
            } else {
                return false
            }
        } catch (error: any) {


            throw new Error(error)
        }
    }
    public static async checkIfCreditNoteLinesIdExist(client: PoolClient, creditNoteLinesId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT COUNT(*) FROM "CreditNoteLines" where id = $1 `,
                values: [creditNoteLinesId]
            }
            const count = await client.query(query.text, query.values);

            if ((<any>count.rows[0]).count > 0) {
                return true
            } else {
                return false
            }
        } catch (error: any) {


            throw new Error(error)
        }
    }

    public static async saveCreditNote(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dBClient = await DB.excu.client();
        try {
            if (data) {
                data = JSON.parse(data);
            }
            /**BEGIN CLIENT */
           await dBClient.query("BEGIN")
            const companyId = (await BranchesRepo.getBranchCompanyId(dBClient, branchId)).compayId;

            const creditNotes = data;

            let crediteNoteIds: any[] = []
            let invoiceIds: any[] = []
            for (let index = 0; index < creditNotes.length; index++) {
                const element = creditNotes[index];
                element.branchId = branchId;



                element.createdAt = await TimeHelper.convertToDate(element.createdAt);
                element.creditNoteDate = await TimeHelper.convertToDate(element.creditNoteDate);
                element.sourceType = 'POS'
                const isCreditNoteIdExist = await this.checkIfCreditNoteIdExist(dBClient, element.id, branchId)
                let resault: any;
                let continueFlag = false;
                const socketLogs = new SocketLogs()
                socketLogs.dbTable = "CreditNotes"
                socketLogs.branchId = branchId;
                socketLogs.compnayId = companyId

                /** Credit Note Id Is Empty */
                if (element.id == "" || element.id == null) {
                    socketLogs.logs.push({ error: "CreditNote Id Is Empty", data: element })
                    continueFlag = true;
                }
                /** Credit Note Invoice Id Is Empty */
                if (element.invoiceId == "" || element.invoiceId == null) {
                    socketLogs.logs.push({ error: "CreditNote invoiceId Is Empty", data: element })
                    continueFlag = true;
                }

                if (!element.lines) {
                    socketLogs.logs.push({ error: "CreditNote Lines  Is Empty", data: element })
                    continueFlag = true;

                }

                if (element.lines) {


                    /** Credit Note line Id Is Empty */

                    const lineIdIsEmpty = element.lines.find((f: any) => f.id == "" || f.id == null)
                    if (lineIdIsEmpty && lineIdIsEmpty.length > 0) {
                        socketLogs.logs.push({ error: " Line Id Is Empty ", data: element })
                        continueFlag = true;
                    }

                    /** Credit Note line invoiceLineId Is Empty */
                    const lineInvoiceIdIsEmpty = element.lines.find((f: any) => f.invoiceLineId == "" || f.invoiceLineId == null)

                    if (lineInvoiceIdIsEmpty && lineInvoiceIdIsEmpty.length > 0) {
                        socketLogs.logs.push({ error: "Credit Note line invoiceLineId Is Empty", data: element })
                        continueFlag = true;
                    }


                    if ((element.lines && element.lines.length == 0) || (!element.lines)) {
                        socketLogs.logs.push({ error: "Credit Note lines Is Empty", data: element })
                        continueFlag = true;
                    }
                }
                if (!isCreditNoteIdExist) {


                    const isCreditNoteNumberExist = await this.checkIscreditNoteNumberExist(dBClient, null, element.creditNoteNumber, companyId)
                    if (isCreditNoteNumberExist) {
                        element.creditNoteNumber = 'D-' + element.creditNoteNumber
                        // socketLogs.logs.push({ error: "Credit Note Number Exist", data: element })
                        // continueFlag = true;

                    }

                    if (continueFlag) {

                        await SocketErrorLogs.setLogs(dBClient, socketLogs)
                        continue;
                    }




                    resault = await this.addCreditNote(dBClient, element, companyId)

                    /** Only If Credit Note Total > Invoice Balance  Should be Placed After Add */
                    if (resault != null && resault.success == false && resault.success != null) {

                        socketLogs.logs.push({ error: resault.msg, data: element })
                        continueFlag = true;
                    }

                    if (continueFlag) {

                        await SocketErrorLogs.setLogs(dBClient, socketLogs)
                        continue;
                    }

                    crediteNoteIds.push(element.id)
                    invoiceIds.push(element.invoiceId)

                } else {
                    await this.editCreditNote(dBClient, element, companyId)

                    crediteNoteIds.push(element.id)
                    invoiceIds.push(element.invoiceId)
                }

            }

            /**COMMIT CLIENT */
         await   dBClient.query("COMMIT");
            const queue = ViewQueue.getQueue();
            queue.pushJob()
            let queueInstance = TriggerQueue.getInstance();

            let userBalancesQueue = CustomerBalanceQueue.getInstance();

            if (crediteNoteIds.length > 0) {
                crediteNoteIds.forEach(element => {
                    queueInstance.createJob({ type: "CreditNotes", id: [element], companyId: companyId })
                    queueInstance.createJob({ journalType: "Movment", type: "creditNote", id: [element] })
                    userBalancesQueue.createJob({ transactionId: element, dbTable: 'CreditNotes' })

                });

            }


            if (invoiceIds.length > 0) {
                // queueInstance.createJob({ type: "updateInvoiceStatus", invoiceIds: invoiceIds })
                invoiceIds.forEach((element: any) => {
                    InvoiceStatuesQueue.get().createJob({
                        id: element
                    } as any);
                });
            }
            callback(JSON.stringify({ success: true }))
        } catch (error: any) {
            console.log(error)
            /**ROLLBACK CLIENT */
          await  dBClient.query("ROLLBACK")

                ;
            callback(JSON.stringify({ success: false, error: error.message }))

        } finally {
            /**RELEASE CLIENT */

            dBClient.release(); //CLOSE DB TRANSACTION CONNECTION
        }
    }

    public static async addCreditNote(client: PoolClient, data: any, companyId: string) {
        try {

            // const validate = await CreditNoteValidation.creditNoteValidation(data);
            // if (!validate.valid) {
            //     throw new Error(validate.error);
            // }

            const creditNote = new CreditNote();
            creditNote.ParseJson(data);
            creditNote.setlogs([]);
            creditNote.companyId = companyId;
            const afterDecimal = await CompanyRepo.getCompanyAfterDecimal(client, companyId)
            const invoiceData = await CreditNoteRepo.getInvoiceInfo(client, creditNote.invoiceId);

            if (invoiceData.lines.length == 0) {
                return new ResponseData(false, "invoice lines are empty ", [])
            }
            /**Charges are only included when creditNote is fully refunded */
            // creditNote.includeCharges = await CreditNoteRepo.checkIfInvoiceFullyReturned(client, creditNote.invoiceId, creditNote.lines, afterDecimal);


            creditNote.calculateTotal(invoiceData, afterDecimal)
            let resault = await this.checkIfInvoiceFullyReturned(client, creditNote.invoiceId, creditNote.lines, afterDecimal);
            if (resault.success == false) {
                return resault
                // console.log(resault)
                // throw new Error("Returned Items Exceeded actual Amount Balance")
            }

            // const isCreditNoteNumberExist = await CreditNoteRepo.checkIscreditNoteNumberExist(client, null, creditNote.creditNoteNumber, companyId)
            // if (isCreditNoteNumberExist) {
            //     throw new Error("Credit Note Number Already Used")
            // }
            //TODO: REMOVE AND CHECK WHY IT TURNED TO NULL HERE 

            const query: { text: string, values: any } = {
                text: `INSERT INTO  "CreditNotes" 
                                    (id, 
                                    "creditNoteNumber",
                                    "refrenceNumber",
                                    total,
                                    note,
                                    "branchId",
                                    "employeeId",
                                    "invoiceId",
                                    "createdAt",
                                    "chargeTotal",
                                    "chargeAmount",
                                    "chargePercentage",
                                    "chargeId",
                                    "discountAmount",
                                    "discountPercentage",
                                    "discountId",
                                    "deliveryCharge",
                                    "subTotal",
                                    "discountTotal",
                                    "creditNoteDate",
                                    "roundingType",
                                    "roundingTotal",
                                    "smallestCurrency",
                                    "isInclusiveTax",
                                    "sourceType",
                                    "logs",
                                    "chargeType",
                                    "chargesTaxDetails",
                                    "companyId") 
                     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29) RETURNING id`,
                values: [creditNote.id,
                creditNote.creditNoteNumber,
                creditNote.refrenceNumber,
                creditNote.total,
                creditNote.note,
                creditNote.branchId,
                creditNote.employeeId,
                creditNote.invoiceId,
                creditNote.createdAt,
                creditNote.chargeTotal,
                creditNote.chargeAmount,
                creditNote.chargePercentage,
                creditNote.chargeId,
                creditNote.discountAmount,
                creditNote.discountPercentage,
                creditNote.discountId,
                creditNote.deliveryCharge,
                creditNote.subTotal,
                creditNote.discountTotal,
                creditNote.creditNoteDate,
                creditNote.roundingType,
                creditNote.roundingTotal,
                creditNote.smallestCurrency,
                creditNote.isInclusiveTax,
                creditNote.sourceType,
                JSON.stringify(creditNote.logs),
                creditNote.chargeType,
                creditNote.chargesTaxDetails,
                creditNote.companyId
                ]
            }

            const insert = await client.query(query.text, query.values);
            creditNote.id = (<any>insert.rows[0]).id;
            for (let index = 0; index < creditNote.lines.length; index++) {
                const element: any = creditNote.lines[index]
                element.creditNoteId = creditNote.id;
                element.createdAt = await TimeHelper.convertToDate(element.createdAt)
                /**SET LINE ACCOUNT ID TO DEFAULT SALES ACCOUNT ID */
                // const accountId = (await AccountsRepo.getSalesId(client, creditNote.branchId)).id;
                // element.accountId = accountId
                element.branchId = creditNote.branchId;
                element.companyId = creditNote.companyId
                const invoiceLine: any = invoiceData.lines.find((f: any) => f.id == element.invoiceLineId)
                element.invoiceLine = invoiceLine
                element.accountId = invoiceLine.accountId
                const isLineIdExist = await this.checkIfCreditNoteLinesIdExist(client, element.id)
                if (isLineIdExist) {
                    await this.editCreditNoteLine(client, element, creditNote, afterDecimal)
                } else {
                    await this.addCreditNoteLine(client, element, creditNote, afterDecimal)

                }
                /**INSERT LINE subItems ITEMS AS INVOICE LINES */
                if (element.subItems && element.subItems.length > 0) {
                    for (let index = 0; index < element.subItems.length; index++) {
                        const subItemData = element.subItems[index];
                        const subItem = new CreditNoteLine();
                        subItem.ParseJson(subItemData)
                        subItem.branchId = creditNote.branchId

                        subItem.companyId = creditNote.companyId
                        if (subItem.id == "" || subItem.id == null) {
                            throw new Error(`SubItemId is Empty ${element.subItems[index]}`)
                        }
                        subItem.parentId = element.id;
                        const invoiceLine: any = invoiceData.lines.find((f: any) => f.id == subItem.invoiceLineId)
                        subItem.invoiceLine = invoiceLine
                        const isSubItemLineIdExist = await this.checkIfCreditNoteLinesIdExist(client, subItem.id)
                        if (isSubItemLineIdExist) {
                            await this.editCreditNoteLine(client, subItem, creditNote, afterDecimal)

                        } else {
                            await this.addCreditNoteLine(client, subItem, creditNote, afterDecimal)

                        }
                    }
                }
            }
            await CreditNoteRepo.generateCreditNoteCode(client, companyId, creditNote.id, 0, creditNote.code)
        } catch (error: any) {
            console.log(error)
          
            
            logPosErrorWithContext(error, data, data.branchId, data.companyId, "addCreditNote")
            throw new Error(JSON.stringify({ branchId: data.branchId, creditNoteId: data.id, invoiceId: data.invoiceId, error: error.message, lines: data.lines, subItems: data.lines.subItems }))
        }
    }

    public static async getCreditNoteLogs(client: PoolClient, creditNoteId: string) {
        try {
            const query = {
                text: `select logs from "CreditNotes" where id =$1`,
                values: [creditNoteId]
            }

            const logs = await client.query(query.text, query.values);

            return logs && logs.rows && logs.rows.length > 0 && logs.rows[0].logs ? logs.rows[0].logs : []
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async editCreditNote(client: PoolClient, data: any, companyId: string) {
        try {
            // const validate = await CreditNoteValidation.creditNoteValidation(data);
            // if (!validate.valid) {
            //     throw new Error(validate.error);
            // }
            const afterDecimal = await CompanyRepo.getCompanyAfterDecimal(client, companyId)
            const creditNote = new CreditNote();
            let logs = await this.getCreditNoteLogs(client, data.id)
            creditNote.setlogs(logs)
            creditNote.ParseJson(data);
            const invoiceData = await CreditNoteRepo.getInvoiceInfo(client, creditNote.invoiceId);
            creditNote.calculateTotal(invoiceData, afterDecimal)
            if (creditNote.id == null || creditNote.id == "") {
                throw new Error("Credit Note Id Is Required")
            }


            //Insert Credit Note 
            const query: { text: string, values: any } = {
                text: `UPDATE "CreditNotes" SET  
                          "creditNoteNumber"=$1,
                          "refrenceNumber"=$2 ,
                           total=$3,
                           note=$4, 
                           "employeeId"=$5,
                           "chargeTotal"=$6,
                           "chargeAmount"=$7,
                           "chargePercentage"=$8,
                           "chargeId"=$9,
                           "discountAmount"=$10,
                           "discountPercentage"=$11,
                           "discountId"=$12,
                           "deliveryCharge"=$13,
                           "subTotal"=$14,
                           "updatedDate"=$15,
                           "isInclusiveTax"=$16,
                           "logs"=$17
             WHERE id=$18
             AND "branchId"=$19 `,
                values: [creditNote.creditNoteNumber,
                creditNote.refrenceNumber,
                creditNote.total,
                creditNote.note,
                creditNote.employeeId,
                creditNote.chargeTotal,
                creditNote.chargeAmount,
                creditNote.chargePercentage,
                creditNote.chargeId,
                creditNote.discountAmount,
                creditNote.discountPercentage,
                creditNote.discountId,
                creditNote.deliveryCharge,
                creditNote.subTotal,
                creditNote.updatedDate,
                creditNote.isInclusiveTax,
                JSON.stringify(creditNote.logs),
                creditNote.id,
                creditNote.branchId]
            }

            await client.query(query.text, query.values);

            //Insert Credit NoteL ines
            for (let index = 0; index < creditNote.lines.length; index++) {
                const element = creditNote.lines[index];
                if (creditNote.id) {
                    element.creditNoteId = creditNote.id;
                }
                element.branchId = creditNote.branchId;
                element.creditNoteId = creditNote.id
                const invoiceLine: any = invoiceData.lines.find((f: any) => f.id == element.invoiceLineId)
                element.invoiceLine = invoiceLine
                element.companyId = companyId;

                const isLineIdExist = await this.checkIfCreditNoteLinesIdExist(client, element.id)
                if (isLineIdExist) {
                    element.createdAt = await TimeHelper.convertToDate(element.createdAt)
                    await this.editCreditNoteLine(client, element, creditNote, afterDecimal)

                } else {
                    element.createdAt = await TimeHelper.convertToDate(element.createdAt)

                    element.accountId = invoiceLine.accountId

                    await this.addCreditNoteLine(client, element, creditNote, afterDecimal)
                }


                /**INSERT LINE subItems ITEMS AS INVOICE LINES */
                if (element.subItems && element.subItems.length > 0) {
                    for (let index = 0; index < element.subItems.length; index++) {
                        const subItemData = element.subItems[index];
                        const subItem = new CreditNoteLine();
                        subItem.ParseJson(subItemData)
                        subItem.parentId = element.id;
                        const invoiceLine: any = invoiceData.lines.find((f: any) => f.id == subItem.invoiceLineId)
                        subItem.invoiceLine = invoiceLine
                        subItem.companyId = companyId;
                        subItem.branchId = creditNote.branchId
                        const isSubItemLineIdExist = await this.checkIfCreditNoteLinesIdExist(client, subItem.id)
                        if (isSubItemLineIdExist) {
                            await this.editCreditNoteLine(client, subItem, creditNote, afterDecimal)

                        } else {
                            await this.addCreditNoteLine(client, subItem, creditNote, afterDecimal)

                        }
                    }
                }
            }
        } catch (error: any) {

            ;
            ;
            logPosErrorWithContext(error, data, data.branchId, data.companyId, "editCreditNote")
            throw new Error(JSON.stringify({ error: error.message, creditNoteId: data.id, invoiceId: data.invoiceId, lines: data.lines }))
        }
    }
    public static async addCreditNoteLine(client: PoolClient, creditNoteLine: CreditNoteLine, creditNote: CreditNote, afterDecimal: number) {
        try {
            if (creditNoteLine.productId != null && creditNoteLine.productId != "" && creditNoteLine.salesEmployeeId != null && creditNoteLine.salesEmployeeId != "") {
                const productCommission = await ProductRepo.getProductCommission(client, creditNoteLine.productId);
                if (productCommission) {
                    creditNoteLine.commissionPercentage = productCommission.commissionPercentage;
                    creditNoteLine.commissionAmount = productCommission.commissionAmount;
                }

            }

            //Insert Credit Note Line 

            if (creditNoteLine.productId != null && creditNoteLine.productId != "") {
                await CreditNoteMovmentRepo.insertInventoryMovment(client, creditNoteLine, creditNote, afterDecimal, creditNoteLine.qty)
            }

            if (creditNoteLine.productId == "") {
                creditNoteLine.productId = null
            }

            const query: { text: string, values: any } = {
                text: `INSERT INTO "CreditNoteLines" 
                                          (id,
                                            "creditNoteId",
                                            total,
                                            price,
                                            qty,
                                            "productId",
                                            "employeeId",
                                            "invoiceLineId",
                                            serial,
                                            batch,
                                            "parentId",
                                            "accountId",
                                            note,
                                            "discountTotal",
                                            "subTotal",
                                            "discountAmount",
                                            "taxId",
                                            "createdAt",
                                            "discountPercentage",
                                            "commissionPercentage",
                                            "commissionAmount",
                                            "commissionTotal",
                                            "taxTotal",
                                            "salesEmployeeId",
                                            taxes,
                                            "taxType",
                                            "taxPercentage",
                                            "isInclusiveTax",
                                            "recipe",
                                            "discountId",
                                            "companyId",
                                            "branchId"
                                          ) 
                        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32) RETURNING id`,
                values: [creditNoteLine.id,
                creditNoteLine.creditNoteId,
                creditNoteLine.total,
                creditNoteLine.price,
                creditNoteLine.qty,
                creditNoteLine.productId,
                creditNoteLine.employeeId,
                creditNoteLine.invoiceLineId,
                creditNoteLine.serial,
                creditNoteLine.batch,
                creditNoteLine.parentId,
                creditNoteLine.accountId,
                creditNoteLine.note,
                creditNoteLine.discountTotal,
                creditNoteLine.subTotal,
                creditNoteLine.discountAmount,
                creditNoteLine.taxId,
                creditNoteLine.createdAt,
                creditNoteLine.discountPercentage,
                creditNoteLine.commissionPercentage,
                creditNoteLine.commissionAmount,
                creditNoteLine.commissionTotal,
                creditNoteLine.taxTotal,
                creditNoteLine.salesEmployeeId,
                JSON.stringify(creditNoteLine.taxes),
                creditNoteLine.taxType,
                creditNoteLine.taxPercentage,
                creditNoteLine.isInclusiveTax,
                JSON.stringify(creditNoteLine.recipe),
                creditNoteLine.discountId,
                creditNoteLine.companyId,
                creditNoteLine.branchId
                ]
            }

            const insert = await client.query(query.text, query.values);
            creditNoteLine.id = (<any>insert.rows[0]).id
            //Insert Movment 
            let invoiceOption = creditNoteLine.invoiceLine &&  creditNoteLine.invoiceLine.options  &&  creditNoteLine.invoiceLine.options.length>0  ? creditNoteLine.invoiceLine.options : []

            if (creditNoteLine.options && creditNoteLine.options.length > 0) {
                for (let index = 0; index < creditNoteLine.options.length; index++) {
                    const option = creditNoteLine.options[index];
                    option.creditNoteLineId = creditNoteLine.id;
                    let currentLineOption: any = invoiceOption.find((f: any) => f.optionId == option.optionId)
                    option.invoiceOption = currentLineOption ?? [];

                    await this.addCreditnoteLineOption(client, option, creditNoteLine, afterDecimal);
                }
            }

        } catch (error: any) {
            console.log(error)

                ;
            throw new Error(JSON.stringify({ branchId: creditNote.branchId, error: error.message, creditNoteId: creditNoteLine.creditNoteId, lineId: creditNoteLine.id }))
        }
    }
    public static async editCreditNoteLine(client: PoolClient, creditNoteLine: CreditNoteLine, creditNote: CreditNote, afterDecimal: number) {
        try {

            if (creditNoteLine.productId != null && creditNoteLine.productId != "" && creditNoteLine.salesEmployeeId != null && creditNoteLine.salesEmployeeId != "") {
                const productCommission = await ProductRepo.getProductCommission(client, creditNoteLine.productId);
                creditNoteLine.commissionPercentage = productCommission.commissionPercentage;
                creditNoteLine.commissionAmount = productCommission.commissionAmount;
            }
            creditNoteLine.calculateCommission(afterDecimal);
            if (creditNoteLine.productId == "") {
                creditNoteLine.productId = null
            }
            const query: { text: string, values: any } = {
                text: `UPDATE "CreditNoteLines" SET 
                                        total=$1,
                                        price=$2,
                                        qty=$3,
                                        "discountTotal"=$4,
                                        "subTotal"=$5,
                                        "discountAmount"=$6,
                                        "discountId"=$7,
                                        "taxId"=$8,
                                        "discountPercentage"=$9,
                                        "commissionPercentage"=$10,
                                        "commissionAmount"=$11,
                                        "commissionTotal"=$12,
                                        "createdAt" = $13,
                                        taxes=$14,
                                        "taxType"=$15,
                                        "taxTotal"=$16,
                                        "taxPercentage"=$17,
                                        "isInclusiveTax"=$18
                       WHERE id = $19
                       AND "creditNoteId"=$20`,
                values: [creditNoteLine.total,
                creditNoteLine.price,
                creditNoteLine.qty,
                creditNoteLine.discountTotal,
                creditNoteLine.subTotal,
                creditNoteLine.discountAmount,
                creditNoteLine.discountId,
                creditNoteLine.taxId,
                creditNoteLine.discountPercentage,
                creditNoteLine.commissionPercentage,
                creditNoteLine.commissionAmount,
                creditNoteLine.commissionTotal,
                creditNoteLine.createdAt,
                JSON.stringify(creditNoteLine.taxes),
                creditNoteLine.taxType,
                creditNoteLine.taxTotal,
                creditNoteLine.taxPercentage,
                creditNoteLine.isInclusiveTax,
                creditNoteLine.id,
                creditNoteLine.creditNoteId]
            }

            await client.query(query.text, query.values);

            let invoiceOption = creditNoteLine.invoiceLine  &&  creditNoteLine.invoiceLine.options &&  creditNoteLine.invoiceLine.options.length>0 ? creditNoteLine.invoiceLine.options : []

            if (creditNoteLine.options && creditNoteLine.options.length > 0) {
                for (let index = 0; index < creditNoteLine.options.length; index++) {
                    const option = creditNoteLine.options[index];
                    option.creditNoteLineId = creditNoteLine.id;
                    let currentLineOption: any = invoiceOption.find((f: any) => f.optionId == option.optionId)
                    option.invoiceOption = currentLineOption ?? [];
                    const isExist = await this.checkIfCreditNoteOptionIdExist(client, option.id)
                    if (!isExist) {
                        await this.addCreditnoteLineOption(client, option, creditNoteLine, afterDecimal);
                    }

                }
            }
        } catch (error: any) {

            console.log(error)
                ;
            throw new Error(JSON.stringify({ error: error.message, creditNoteId: creditNoteLine.creditNoteId, lineId: creditNoteLine.id }))
        }
    }

    public static async addCreditnoteLineOption(client: PoolClient, creditnotelineOption: CreditNoteLineOption, creditNoteLine: CreditNoteLine, afterDecimal: number) {
        try {
            /** Option Movment */
            if (creditnotelineOption.optionId != "" && creditnotelineOption.optionId != null) {
                await CreditNoteMovmentRepo.calculateOptionMovment(client, creditnotelineOption, creditNoteLine, creditNoteLine.qty);

            }

            if (creditnotelineOption.optionId == "") {

                creditnotelineOption.optionId = null
            }
            let query: { text: string, values: any } = {
                text: `INSERT INTO  "CreditNoteLineOptions"("id","optionId", "note","price","qty","recipe","creditNoteLineId") VALUES($1,$2,$3,$4,$5,$6,$7)`,
                values: [creditnotelineOption.id, creditnotelineOption.optionId, creditnotelineOption.note, creditnotelineOption.price, creditnotelineOption.qty, JSON.stringify(creditnotelineOption.recipe), creditnotelineOption.creditNoteLineId]
            }

            await client.query(query.text, query.values);


        } catch (error: any) {
            ;
            throw new Error(JSON.stringify({ error: error.message, creditNoteId: creditNoteLine.creditNoteId, optionId: creditnotelineOption.optionId }))
        }
    }



    /**Live SYNC WHEN POS IS NOT OFFLINE ANY NEW/UPDATED CREDITNOTE WILL BE SENT TO POS DIRECTLY */
    public static async sendCreditNotes(client: PoolClient, branchId: string, creditNoteId: string) {
        const instance = SocketController.getInstance();
        this.redisClient = RedisClient.getRedisClient()
        let creditNote = await this.getPOSCreditNoteById(client, creditNoteId)
        const clientId: any = await this.redisClient.get("Socket" + branchId);
        try {
            instance.io.of('/api').in(clientId).emit("newCreditNote", JSON.stringify(creditNote));
        } catch (error) {
            instance.io.of('/api').in(clientId).emit("newCreditNote", JSON.stringify({ success: false, error: error }));
        }
    }

    public static async getPOSCreditNoteById(dbClient: PoolClient, creditNoteId: string) {

        try {

            let query: { text: string, values: any } = {
                text: `select 
                "CreditNotes".*
                    from "CreditNotes"
                WHERE "CreditNotes"."id" =$1
                `,
                values: [creditNoteId]
            }


            const list = await dbClient.query(query.text, query.values)
            const creditNotes: any[] = [];
            for (let index = 0; index < list.rows.length; index++) {
                const element: any = list.rows[index];
                let creditNote = new CreditNote();
                creditNote.ParseJson(element)
                query.text = `SELECT 
                               "CreditNoteLines".*
                          FROM "CreditNoteLines" where "creditNoteId" =$1`
                query.values = [creditNote.id];
                const lines = await dbClient.query(query.text, query.values);
                for (let index = 0; index < lines.rows.length; index++) {
                    const lineData = lines.rows[index];
                    let line = new CreditNoteLine();
                    line.ParseJson(lineData)
                    query.text = `SELECT * FROM "CreditNoteLineOptions" where "creditNoteLineId" =$1`;
                    query.values = [line.id];
                    let options = await dbClient.query(query.text, query.values);
                    line.options = options.rows;
                    creditNote.lines.push(line)
                }

                creditNotes.push(creditNote)
            }

            return creditNotes[0]

        } catch (error: any) {
            console.log(error)




        }
    }

    /**Retreive all CreditNotes or only updated creditnotes that are linked to pos */
    public static async getPOSCreditNotes(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        try {
            await dbClient.query("BEGIN")
            let date: any;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    date = new Date()
                    date.setTime(data.date);
                }
            }
            let query: { text: string, values: any } = {
                text: `select 
                "CreditNotes".*
                    from "CreditNotes"
                INNER JOIN "Invoices" ON "CreditNotes"."invoiceId" =  "Invoices".id and "Invoices".source =any($2)
                WHERE "CreditNotes"."branchId" =$1
                `,
                values: [branchId, ['POS', 'Online']]
            }

            if (date != null && date != "") {

                query.text = `select  
                "CreditNotes".*
                     from "CreditNotes"
                    INNER JOIN "Invoices" ON "CreditNotes"."invoiceId" =  "Invoices".id and "Invoices".source = any($3)
                    WHERE "CreditNotes"."branchId" =$1
                    and ("CreditNotes"."createdAt" > $2 or "CreditNotes"."updatedDate" >$2)
                    `,
                    query.values = [branchId, date, ['POS', 'Online']]

            }

            const list = await dbClient.query(query.text, query.values)
            const creditNotes: any[] = [];
            for (let index = 0; index < list.rows.length; index++) {
                const element: any = list.rows[index];
                let creditNote = new CreditNote();
                creditNote.ParseJson(element)
                query.text = `SELECT 
                               "CreditNoteLines".*
                          FROM "CreditNoteLines" where "creditNoteId" =$1`
                query.values = [creditNote.id];
                const lines = await dbClient.query(query.text, query.values);
                for (let index = 0; index < lines.rows.length; index++) {
                    const lineData = lines.rows[index];
                    let line = new CreditNoteLine();
                    line.ParseJson(lineData)
                    query.text = `SELECT * FROM "CreditNoteLineOptions" where "creditNoteLineId" =$1`;
                    query.values = [line.id];
                    let options = await dbClient.query(query.text, query.values);
                    line.options = options.rows;
                    creditNote.lines.push(line)
                }

                creditNotes.push(creditNote)
            }

            await dbClient.query("COMMIT")

            callback(JSON.stringify({ success: true, data: creditNotes }))

        } catch (error: any) {
            console.log(error)
            await dbClient.query("ROLLBACK")




            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, branchId, null, "getPOSCreditNotes")

        } finally {
            dbClient.release()
        }
    }

    /** Retreive CreditNote For Pos recover DB */

    public static async getLatestCreditNote(dBClient: PoolClient, branchId: string) {
        try {
            let prefix = await terminalRepo.getTeminalPrefix(branchId);
            let prefixTerm = prefix + '%';
            let limit = 100
            const query: { text: string, values: any } = {
                text: `select "CreditNotes".* from "Invoices"
                LEFT JOIN "CreditNotes" on "CreditNotes"."invoiceId" = "Invoices".id 
                where "Invoices"."branchId" =$1
                and "creditNoteNumber" like $2
                AND ("Invoices".source ='POS' or "Invoices".source ='Online')
                and regexp_replace("creditNoteNumber", $3, '') ~ '^[0-9]+$'
                order by  regexp_replace("creditNoteNumber", $3, '')::int desc
                limit $4 `,
                values: [branchId, prefixTerm, prefix + '-', 1]
            }

            let creditNote = await dBClient.query(query.text, query.values);

            return creditNote.rows
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async recoverDbCreditNotes(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dBClient = await DB.excu.client(500);
        try {
            callback(JSON.stringify({ success: true, data: [] }))

            return;

            await dBClient.query("BEGIN")
            // const invoiceIds = new Set(); /** Set is used to avoid dupluicated values */
            let date: any;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    date = new Date()
                    date.setTime(data.date);
                }
            }


            // let openInvoiceIds = await SocketInvoiceRepo.getOpenInvoiceIds(dBClient, branchId)
            // let lastThreeDaysInvoiceIds = await SocketInvoiceRepo.getLastThreeDaysInvoices(dBClient, branchId)

            // openInvoiceIds.forEach((element: any) => {
            //     invoiceIds.add(element.id)
            // });
            // lastThreeDaysInvoiceIds.forEach((element: any) => {
            //     invoiceIds.add(element.id)
            // })


            // let invoiceData = await SocketEstimateRepo.getLatestEstimate(dBClient, branchId)
            // if (invoiceData) {
            //     invoiceIds.add(invoiceData.invoiceId)
            // }
            const creditNoteIds = await this.getCreditNoteInvoiceIds(dBClient, branchId)
            console.log("recoverDbCreditNotes", creditNoteIds)

            const query: { text: string, values: any } = {
                text: `
                select "CreditNotes".* from "CreditNotes"
                where "CreditNotes"."id" = any($1)
                `,
                values: [creditNoteIds]
            }
            const list = await dBClient.query(query.text, query.values)
            const creditNotes: any[] = [];
            // let latestCreditNote = await this.getLatestCreditNote(dBClient, branchId);
            // if (latestCreditNote.length > 0) {
            //     list.rows.push(latestCreditNote[0])
            // }
            console.log("payments.rows.length", list.rows.length)

            for (let index = 0; index < list.rows.length; index++) {
                const element: any = list.rows[index];
                let creditNote = new CreditNote();
                creditNote.ParseJson(element);

                query.text = `SELECT 
                               "CreditNoteLines".*
                          FROM "CreditNoteLines" where "creditNoteId" =$1`
                query.values = [element.id];
                const lines = await dBClient.query(query.text, query.values);
                for (let index = 0; index < lines.rows.length; index++) {
                    const lineData = lines.rows[index];
                    let line: any = new CreditNoteLine();
                    line.ParseJson(lineData);

                    query.text = `SELECT * FROM "CreditNoteLineOptions" where "creditNoteLineId"=$1`;
                    query.values = [line.id];
                    let options = await dBClient.query(query.text, query.values);
                    line.options = options.rows;

                    creditNote.lines.push(line)
                }


                creditNotes.push(creditNote)
            }

            console.log(creditNotes)
            callback(JSON.stringify({ success: true, data: creditNotes }))
            await dBClient.query("COMMIT")
        } catch (error: any) {

            console.log(error)
            await dBClient.query("ROLLBACK")



            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, branchId, null, "recoverDbCreditNotes")
        } finally {
            dBClient.release()
        }
    }

    public static async getCreditNoteInvoiceIds(client: PoolClient, branchId: string) {
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
                                        ),"creditNotes" as (
                                        select "CreditNotes".id from "CreditNotes"
                                        inner join "invoiceIds" on "invoiceIds".id = "CreditNotes"."invoiceId" 
                                        )

                                        select JSON_AGG( "creditNotes".id) as  "creditNoteIds" from "creditNotes"`,
                values: [branchId]
            }

            let creditNotes = await client.query(query.text, query.values);

            return creditNotes.rows && creditNotes.rows.length > 0 ? creditNotes.rows[0].creditNoteIds : []
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async checkIfInvoiceFullyReturned(client: PoolClient, invoiceId: string, lines: any[], afterDecimal: number, creditNoteId: string | null = null) {
        try {

            let currentCreditNoteTotal = 0;

            lines.forEach((element: any) => {
                currentCreditNoteTotal += Helper.roundNum(element.total, afterDecimal)

            });

            /**total of  invoice */
            const query: { text: string, values: any } = {
                text: `SELECT sum ("InvoiceLines".total::text::numeric) as "invoiceTotal"
                
                from "Invoices"
                INNER JOIN "InvoiceLines"
                ON "InvoiceLines"."invoiceId" = "Invoices".id
				where "Invoices".id = $1`,
                values: [invoiceId]
            }
            const invoice = await client.query(query.text, query.values);
            const total = invoice.rows[0].invoiceTotal;

            /**total of Previous creditnotes credited on same invoice */
            query.text = `SELECT  CAST (COALESCE(sum ("CreditNoteLines".total::numeric),0) AS REAL)  as "creditNoteTotal"
           

            from "Invoices"
            LEFT JOIN "CreditNotes"  on "CreditNotes"."invoiceId" = "Invoices".id 
            LEFT JOIN "CreditNoteLines" on  "CreditNotes".id = "CreditNoteLines"."creditNoteId"
            where "Invoices".id = $1
			group by "Invoices".id`

            if (creditNoteId != null) {

                query.text = `SELECT  CAST (COALESCE(sum ("CreditNoteLines".total::numeric),0) AS REAL)  as "creditNoteTotal"
                from "Invoices"
                LEFT JOIN "CreditNotes"  on "CreditNotes"."invoiceId" = "Invoices".id 
                LEFT JOIN "CreditNoteLines" on  "CreditNotes".id = "CreditNoteLines"."creditNoteId" and "CreditNoteLines"."creditNoteId" <>$2
                where "Invoices".id = $1
                group by "Invoices".id`
                query.values = [invoiceId, creditNoteId]
            }
            const creditNote = await client.query(query.text, query.values);
            const creditNoteTotal = creditNote.rows && creditNote.rows.length > 0 ? creditNote.rows[0].creditNoteTotal : 0


            /**If totl of credit note exceeded invoice total
             * 
             * currently created credit note total + previously created  creditNote total most be less than invoice total 
             */

            if (Helper.roundDecimal(+Number(total ?? 0), afterDecimal) < Helper.addWithRounding(currentCreditNoteTotal, creditNoteTotal, afterDecimal)) {
                console.log("hereeeeeeeeeeeeeeeeeeeeeeeeeee", Number(total), Helper.add(currentCreditNoteTotal, creditNoteTotal, afterDecimal))
                return new ResponseData(false, "Returned Items Exceeded actual Amount Balance = " + (currentCreditNoteTotal + creditNoteTotal) + " ,total = " + total, []);

            } else {


                return new ResponseData(true, "", [])


            }




        } catch (error: any) {


            throw new Error(error.message)
        }
    }

    public static async checkIscreditNoteNumberExist(client: PoolClient, id: string | null, creditNoteNumber: string, companyId: string) {
        try {
            const prefixReg = "^(CR-)";
            const prefix = "CR-"
            const num = creditNoteNumber.replace(prefix, '');
            const numTerm = creditNoteNumber.toLocaleLowerCase()
            const query: { text: string, values: any } = {
                text: `SELECT 
                          "creditNoteNumber" 
                    FROM "CreditNotes"
                    INNER JOIN "Branches"
                    ON "Branches".id = "CreditNotes"."branchId"
                    WHERE "Branches"."companyId"=$1
                    AND LOWER("CreditNotes"."creditNoteNumber") =  LOWER($2)
                `,
                values: [companyId, numTerm]
            }

            if (id != null) {
                query.text = `SELECT "creditNoteNumber" 
                FROM "CreditNotes"
                INNER JOIN "Branches"
                ON "Branches".id = "CreditNotes"."branchId"
                WHERE "Branches"."companyId"=$1
                  AND LOWER("CreditNotes"."creditNoteNumber") =  LOWER($2)
                AND "CreditNotes".id <> $3 `
                query.values = [companyId, numTerm, id]
            }
            const creditNoteNumberData = await client.query(query.text, query.values);
            if (creditNoteNumberData.rowCount != null && creditNoteNumberData.rowCount > 0) {
                return true;
            } else {
                return false;
            }
        } catch (error: any) {

            throw new Error(error.message)
        }
    }


}

