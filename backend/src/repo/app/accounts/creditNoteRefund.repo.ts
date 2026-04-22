import { DB } from "@src/dbconnection/dbconnection";
import { Refund } from "@src/models/account/Refund"
import { RefundLine } from "@src/models/account/RefundLine";
import { ResponseData } from "@src/models/ResponseData";

import { SocketRefund } from "@src/repo/socket/refund.socket";

import { RefundValidation } from "@src/validationSchema/account/refund.schema";
import { PoolClient } from "pg";
import { CreditNoteRepo } from "./creditNote.Repo";
import { PaymnetMethodRepo } from "./paymentMethod.repo";

import { Company } from "@src/models/admin/company";

import { ValidationException } from "@src/utilts/Exception";

export class CreditNoteRefundRepo {


    public static async checkIfRefundIdExist(refundId: string, branchId: string) {
        try {
            const query : { text: string, values: any } = {
                text: `SELECT COUNT(*) FROM "CreditNoteRefunds" where id =$1 "branchId"=$2`,
                values: [refundId, branchId]
            }

            const refunds = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", refunds.rows)
        } catch (error: any) {
          
             throw new Error(error.message)
        }
    }
    public static async saveRefund(data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            const companyId = company.id
            const validate = await RefundValidation.validateRefund(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            const refund = new Refund();
            refund.ParseJson(data);
            refund.createdAt = new Date();
            const afterDecimal =company.afterDecimal

            refund.calculateTotal(afterDecimal);
            const creditNoteBalance =  (await CreditNoteRepo.getCreditNoteBalance( client,refund.creditNoteId)).data
            /**Validate Credit Note balance to prevent refunded amount exceed creditNote Balance */
            if (creditNoteBalance.balance < refund.total) {
                throw new ValidationException("Amount must be less than or equal to " + creditNoteBalance.balance)
            }

            await client.query("BEGIN")

            const query : { text: string, values: any } = {
                text: `INSERT INTO "CreditNoteRefunds" ("employeeId","branchId",total,"createdAt","creditNoteId","refrenceNumber","description","refundDate","companyId")
                                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
                values: [refund.employeeId, refund.branchId, refund.total, refund.createdAt, refund.creditNoteId, refund.refrenceNumber, refund.description, refund.refundDate,company.id]
            }



            const insert = await client.query(query.text, query.values)
            refund.id = insert.rows[0].id;
            for (let index = 0; index < refund.lines.length; index++) {
                const element = refund.lines[index];
                element.creditNoteRefundId = insert.rows[0].id;
      
                await this.addRefundLine(client, element, refund.branchId ,afterDecimal)
            }
            await client.query("COMMIT")
            const getCreditNotSorce = await CreditNoteRepo.getCreditNoteSource(client, refund.creditNoteId)
            if (getCreditNotSorce.source == 'POS') {
                await SocketRefund.sendRefund(refund.branchId, refund)
            }

            return new ResponseData(true, "", { id: refund.id })
        } catch (error: any) {
          
            await client.query("ROLLBACK")
             throw new Error(error.message)

        } finally {
            client.release()
        }
    }
    public static async addRefundLine(client: PoolClient, refundLine: RefundLine, branchId:string,  afterDecimal: number) {
        try {

   
            const accountId = await PaymnetMethodRepo.getPaymnetMethodaccountId(client,refundLine.paymentMethodId,branchId);
            refundLine.accountId = accountId.id;
            const query : { text: string, values: any } = {
                text: `INSERT INTO "CreditNoteRefundLines" ("creditNoteRefundId",amount,"paymentMethodId","accountId")
                                                VALUES($1,$2,$3,$4)`,
                values: [refundLine.creditNoteRefundId, refundLine.amount, refundLine.paymentMethodId, refundLine.accountId]
            }
            await client.query(query.text, query.values)
        } catch (error: any) {
          
             throw new Error(error.message);
        }
    }


    public static async getRefundedList(company: Company) {
        try {
            const companyId = company.id;
            const listOfRefund: any[] = [];
            const query : { text: string, values: any } = {
                text: `SELECT 
                           "CreditNoteRefunds"."id",
                           "CreditNoteRefunds"."employeeId",
                           "CreditNoteRefunds".total,
                           "CreditNoteRefunds"."branchId",
                           "CreditNoteRefunds"."refrenceNumber",
                           "Branches".name as "branchName",
                           "Employees".name as "employeeName",
                           "CreditNoteRefunds"."refundDate"
                        FROM "CreditNoteRefunds"
                        INNER JOIN "Branches"
                        ON "Branches".id = "CreditNoteRefunds"."branchId"
                        INNER JOIN "Employees"
                        ON "Employees".id = "CreditNoteRefunds"."employeeId"
                        WHERE   "Branches"."companyId" = $1`,
                values: [companyId]
            }


            const list: any = await DB.excu.query(query.text, query.values)
            for (let index = 0; index < list.rows.length; index++) {
                const refoundElement = list.rows[index];
                query.text = `SELECT 
                "CreditNoteRefundLines"."creditNoteId",
                "CreditNoteRefundLines"."creditNoteRefundId",
                "CreditNoteRefundLines".amount,
                "CreditNoteRefundLines"."paymentMethodId",
                "CreditNoteRefundLines"."accountId",
                "CreditNoteRefundLines"."refrenceNumber",
                "CreditNoteRefundLines"."description",
                "PaymentMethods".name as "paymentMethodName"
             FROM "CreditNoteRefundLines"
             INNER JOIN "PaymentMethods"
             ON "PaymentMethods".id = "CreditNoteRefundLines"."paymentMethodId"
             WHERE   "CreditNoteRefundLines"."creditNoteRefundId" = $1`
                query.values = [refoundElement.id]

                const line: any = await DB.excu.query(query.text, query.values);
                refoundElement.lines = line.rows;
                listOfRefund.push(refoundElement)
            }




            return new ResponseData(true, "", listOfRefund)
        } catch (error: any) {
          
             throw new Error(error.message);
        }
    }
    public static async getRefundById(refoundId: string) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")

            const query : { text: string, values: any } = {
                text: `SELECT 
                           "CreditNoteRefunds"."id",
                           "CreditNoteRefunds"."employeeId",
                           "CreditNoteRefunds".amount,
                           "CreditNoteRefunds"."branchId",
                           "Branches".name as "branchName",
                           "Employees".name as "employeeName",
                           "CreditNoteRefunds"."refrenceNumber",
                           "CreditNoteRefunds"."total",
                           "CreditNoteRefunds"."refundDate"
                        FROM "CreditNoteRefunds"
                        INNER JOIN "Branches"
                        ON "Branches".id = "CreditNoteRefunds"."branchId"
                        INNER JOIN "Employees"
                        ON "Employees".id = "CreditNoteRefunds"."employeeId"
                        WHERE   "Branches"."companyId" = $1`,
                values: [refoundId]
            }
            const refoundData: any = await client.query(query.text, query.values)

            const refoundElement = refoundData.rows[0];
            query.text = `SELECT 
                "CreditNoteRefundLines"."creditNoteId",
                "CreditNoteRefundLines"."creditNoteRefundId",
                "CreditNoteRefundLines".amount,
                "CreditNoteRefundLines"."paymentMethodId",
                "CreditNoteRefundLines"."accountId",
                "PaymentMethods".name as "paymentMethodName",
                "CreditNoteRefundLines"."refrenceNumber",
                "CreditNoteRefundLines"."description",
             FROM "CreditNoteRefundLines"
             INNER JOIN "CreditNotes"
             ON "CreditNotes".id = "CreditNoteRefundLines"."creditNoteId"
             INNER JOIN "PaymentMethods"
             ON "PaymentMethods".id = "CreditNoteRefundLines"."paymentMethodId"
             WHERE   "CreditNoteRefundLines"."creditNoteRefundId" = $1`
            query.values = [refoundElement.id]

            const line: any = await client.query(query.text, query.values);
            refoundElement.lines = line.rows;



            await client.query("COMMIT")
            return new ResponseData(true, "", refoundElement)
        } catch (error: any) {
          
            await client.query("ROLLBACK")
             throw new Error(error.message);
        } finally {
            client.release()
        }
    }
 
    public static async getCustomerCreditNote(customerId: string) {
        try {
            const query : { text: string, values: any } = {
                text: `SELECT 
                        "CreditNotes".id as "creditNoteId",
                        total,
                        "creditNoteNumber",
                        COALESCE(SUM("CreditNoteRefundLines".amount), 0) as"paidAmount",
                        "CreditNotes"."createdAt"
                 FROM  "CreditNotes" 
                 LEFT JOIN  "CreditNoteRefundLines" 
                ON "CreditNotes".id = "CreditNoteRefundLines"."creditNoteId" 
                WHERE "CreditNotes"."customerId"=$1
                group by "CreditNotes".id
                HAVING total -  COALESCE(SUM("CreditNoteRefundLines".amount), 0) > 0`,
                values: [customerId]
            }
            const creditNotes = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", creditNotes.rows)
        } catch (error: any) {
          
             throw new Error(error.message)
        }
    }
}