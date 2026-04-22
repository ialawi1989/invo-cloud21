import { Socket } from "socket.io"
import { DB } from "@src/dbconnection/dbconnection";
import { SocketInvoiceRepo } from "./invoice.socket";
import { SocketController } from "@src/socket";
import { RedisClient } from "@src/redisClient";
import { AppliedCredit } from "@src/models/account/appliedCredit";
import { ValidationException } from "@src/utilts/Exception";
import { BranchesRepo } from "../admin/branches.repo";
import { CreditNoteRepo } from "../app/accounts/creditNote.Repo";
import { ResponseData } from "@src/models/ResponseData";
import { PoolClient } from "pg";
import { AppliedCreditRepo } from "../app/accounts/appliedCredit.repo";
import { CompanyRepo } from "../admin/company.repo";
import { Company } from "@src/models/admin/company";
import { TriggerQueue } from "../triggers/triggerQueue";
import { CustomerBalanceQueue } from "../triggers/userBalancesQueue";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";

export class SocketAppliedCredit {
    static redisClient: any;

    public static async getAppliedCredits(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {
            let date;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }


            const query = {
                text: `select "AppliedCredits".* from "AppliedCredits" 
                        inner join "Invoices" on "Invoices".id = "AppliedCredits"."invoiceId"
                        where "Invoices"."branchId" = $1
                        and "Invoices"."source" = $2
                        and ($3::timestamp is null or  "AppliedCredits"."createdAt" >= $3)`,
                values: [branchId, 'POS', date]
            }

            let appliedList = await DB.excu.query(query.text, query.values);

            callback(JSON.stringify({ success: true, data: appliedList.rows }))

        } catch (error: any) {
          

            callback(JSON.stringify({ success: false, error: error.message }))

            logPosErrorWithContext(error, data, branchId, data.companyId, "getAppliedCredits")

        }
    }


    public static async recoverAppliedCredit(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client(500);
        try {
            await dbClient.query('BEGIN');
            let ids = await SocketInvoiceRepo.getRecoverInvoicesIds(dbClient, branchId)

            const query = {
                text: `select * from "AppliedCredits"
                      where "invoiceId" = any($1)
                     `,
                values: [ids]

            }

            let appliedCredits = await dbClient.query(query.text, query.values);

            callback(JSON.stringify({ success: true, data: appliedCredits.rows }))
            await dbClient.query('COMMIT');
        } catch (error: any) {
            await dbClient.query('ROLLBACK');
          
            logPosErrorWithContext(error, data, branchId, data.companyId, "recoverAppliedCredit")
        } finally {
            dbClient.release();
        }
    }


    public static async syncAppliedCredit(appliedCredit: AppliedCredit, branchId: string) {
        try {
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            const clientId: any = await this.redisClient.get("Socket" + branchId);
            console.log("clieeeeeeeeeeeent", clientId, branchId)
            instance.io.of('/api').in(clientId).emit("syncAppliedCredit", JSON.stringify(appliedCredit));
        } catch (error: any) {
            logPosErrorWithContext(error, appliedCredit, branchId, appliedCredit.companyId, "syncAppliedCredit")

            throw new Error(error)
        }
    }

    public static async getCreditNoteCredit(data: any, branchId: string, callback: CallableFunction) {

        let companyId;
        try {
            let creditNoteId = data.creditNoteId
            // handle empty string
            if (creditNoteId == "") {
                creditNoteId = null
            }
            const creditNoteNumber = data.creditNoteNumber
            companyId = (await BranchesRepo.getBranchCompanyId(null, branchId)).compayId;

            if (!creditNoteId && !creditNoteNumber) {
                return callback(JSON.stringify(new ResponseData(false, "creditNoteId OR  creditNoteNumber is Required", [])))
            }

            /** GET Credit Note Id */
            const query = {
                text: `SELECT * FROM "CreditNotes" where "companyId" = $1 and "branchId"=$2 and ("id"=$3 or "creditNoteCode" =$4)`,
                values: [companyId, branchId, creditNoteId, creditNoteNumber]
            }

            let creditNote = await DB.excu.query(query.text, query.values);

            if (creditNote && creditNote.rows && creditNote.rows.length > 0) {
                let creditNoteInfo = creditNote.rows[0];
                creditNoteId = creditNoteInfo.id;
                let creditNoteNumber = creditNoteInfo.creditNoteNumber;
                const refundCredit = await CreditNoteRepo.getRefundDue(null, creditNoteId, null);
                return callback(JSON.stringify(new ResponseData(true, "", { creditNoteId: creditNoteId, creditNoteNumber: creditNoteNumber, creditNoteBalance: +refundCredit })))
            }
            return callback(JSON.stringify(new ResponseData(false, "Credit Note Not Found", [])))
        } catch (error: any) {
            logPosErrorWithContext(error, data, branchId, companyId, "getCreditNoteCredit")

            return callback(JSON.stringify(new ResponseData(false, error.message, [])))
        }
    }


    public static async applyCreditNoteOnInvoice(data: any, branchId: string, callback: CallableFunction) {
        let companyId;
        try {
            const creditNoteId = data.creditNoteId;
            const amount = data.amount;
            const employeeId = data.employeeId;
            const companyData = await CompanyRepo.getCompanyByBranchId(null, branchId)
            const company = new Company()
            company.ParseJson(companyData);
            companyId = company.id
            const invoice = data.invoice;
            const invoiceId = invoice.id;

            const query = {
                text: `SELECT id FROM "Invoices" where "companyId"= $1 and "branchId"=$2 and "id" = $3`,
                values: [companyId, branchId, invoiceId]
            }

            let invo = await DB.excu.query(query.text, query.values);
            if (invo && invo.rows && invo.rows.length == 0) { await SocketInvoiceRepo.saveInvoice(null, JSON.stringify([invoice]), branchId, null) }

            query.text = `SELECT * FROM "CreditNotes" where "companyId"= $1 and "branchId"=$2 and "id" = $3`
            query.values = [companyId, branchId, creditNoteId]
            let creditNote = await DB.excu.query(query.text, query.values);
            if (creditNote && creditNote.rows && creditNote.rows.length == 0) return callback(JSON.stringify(new ResponseData(false, "CreditNote Not Found", [])))

            const appliedCreditData = {
                invoiceId: invoiceId,
                amount: amount,
                id: creditNoteId,
                employeeId: employeeId,
                reference: "creditNote"
            }

            let appliedCredit = await AppliedCreditRepo.saveApplyCredit(appliedCreditData, company)

            let queueInstance = TriggerQueue.getInstance();
            let userBalancesQueue = CustomerBalanceQueue.getInstance();
            queueInstance.createJob({ type: "AppliedCredits", id: appliedCredit.data.id, companyId: company.id })
            userBalancesQueue.createJob({ transactionId: appliedCredit.data.id, dbTable: 'AppliedCredits' })

            return callback(JSON.stringify(new ResponseData(true, "", { appliedCredit: appliedCredit.data.applyCredit })))

        } catch (error: any) {
            logPosErrorWithContext(error, data, branchId, companyId, "applyCreditNoteOnInvoice")

            return callback(JSON.stringify(new ResponseData(false, error.message, [])))
        }
    }


}