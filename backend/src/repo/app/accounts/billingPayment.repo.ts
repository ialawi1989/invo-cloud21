import { DB } from "@src/dbconnection/dbconnection";
import { BillingPayment } from "@src/models/account/BillingPayment";
import { BillingPaymentLine } from "@src/models/account/BillingPaymentLines";

import { ResponseData } from "@src/models/ResponseData";

import { BillingValidation } from "@src/validationSchema/account/billing.Schema";
import { PoolClient } from "pg";

import { BillingRepo } from "./billing.repo";


import { Helper } from "@src/utilts/helper";
import { PaymnetMethodRepo } from "./paymentMethod.repo";
import { SupplierRepo } from "./supplier.repo";

import { JournalRepo } from "./Journal.repo";
import { TimeHelper } from "@src/utilts/timeHelper";
import { Company } from "@src/models/admin/company";
import { EventLog, Log } from "@src/models/log";
import { ValidationException } from "@src/utilts/Exception";
import { PDFGenerator } from "@src/utilts/PDFGenerator";
import { forEach } from "lodash";
import { EventLogsRepo } from "./eventlogs.repo";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";

export class BillingPaymentRepo {


    public static async getBillPayemntDate(client: PoolClient, paymentId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT CAST("paymentDate" AS TEXT) FROM "BillingPayments" where id =$1 `,
                values: [paymentId]
            }
            let date = await client.query(query.text, query.values)
            if (date.rowCount != null && date.rowCount > 0) {
                return (<any>date.rows[0]).paymentDate
            }
            return null
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    /**Validate Bill Amount to prevent paying amount that exceeded bill actual Amount */
    public static async validateBillPaidAmount(client: PoolClient, billingId: string, amount: number, paymentId: string | null = null) {
        try {

            const query: { text: string, values: any } = {
                text: `with "billTotal" as (
                    select "Billings".id,
                           "Billings".total::text::numeric,
                           "Billings"."billingNumber"
                        from "Billings"
	                    WHERE "Billings".id = $1
                    
                    ),"appliedCredits" as (
                    select sum ("SupplierAppliedCredits"."amount"::text::numeric) as total ,"billTotal".id from "SupplierAppliedCredits"
                    left join "billTotal" on  "billTotal".id = "SupplierAppliedCredits"."billingId" 
                    group by "billTotal".id
                    ),"creditNotestotal" as (
                    select sum ("SupplierCredits"."total"::text::numeric) as total,"billTotal".id from "SupplierCredits"
                    left join "billTotal" on "billTotal".id = "SupplierCredits"."billingId" 
                    group by "billTotal".id
                    ),"billPayments" as (
                    select sum ("BillingPaymentLines"."amount"::text::numeric) as total,"billTotal".id from "BillingPaymentLines"
                    left join "billTotal" on "billTotal".id = "BillingPaymentLines"."billingId" 
                    group by "billTotal".id
                    )
                    
                    select 
                     "billTotal".total- (COALESCE("appliedCredits".total::text::numeric,0) + COALESCE("creditNotestotal".total::text::numeric,,0) + COALESCE("billPayments".total::text::numeric,,0)) as balance ,
                     "billTotal"."billingNumber"
                    from "billTotal" 
                    left join "appliedCredits" on  "billTotal".id = "appliedCredits".id 
                    left join "creditNotestotal" on  "billTotal".id = "creditNotestotal".id 
                    left join "billPayments" on  "billTotal".id = "billPayments".id  
                         `,
                values: [billingId]
            }

            if (paymentId != null && paymentId != "") {
                query.text = `with "billTotal" as (
                    select "Billings".id,
                           "Billings".total::text::numeric,
                           "Billings"."billingNumber"
                        from "Billings"
	                    WHERE "Billings".id = $1
                    
                    ),"appliedCredits" as (
                    select sum ("SupplierAppliedCredits"."amount"::text::numeric) as total ,"billTotal".id from "SupplierAppliedCredits"
                    left join "billTotal" on  "billTotal".id = "SupplierAppliedCredits"."billingId" 
                    group by "billTotal".id
                    ),"creditNotestotal" as (
                    select sum ("SupplierCredits"."total"::text::numeric) as total,"billTotal".id from "SupplierCredits"
                    left join "billTotal" on "billTotal".id = "SupplierCredits"."billingId" 
                    group by "billTotal".id
                    ),"billPayments" as (
                    select sum ("BillingPaymentLines"."amount"::text::numeric) as total,"billTotal".id from "BillingPaymentLines"
                    left join "billTotal" on "billTotal".id = "BillingPaymentLines"."billingId" 
                    where "BillingPaymentLines"."billingPaymentId" <>$2
                    group by "billTotal".id
                    )
                    
                    select 
                     "billTotal".total - (COALESCE("appliedCredits".total,0) + COALESCE("creditNotestotal".total,0) + COALESCE("billPayments".total,0)) as balance ,
                     "billTotal"."billingNumber"
                    from "billTotal" 
                    left join "appliedCredits" on  "billTotal".id = "appliedCredits".id 
                    left join "creditNotestotal" on  "billTotal".id = "creditNotestotal".id 
                    left join "billPayments" on  "billTotal".id = "billPayments".id `,
                    query.values = [billingId, paymentId]
            }
            const balanceData = await client.query(query.text, query.values);
            const balance = (<any>balanceData.rows[0]).balance
            const billingNumber = (<any>balanceData.rows[0]).billingNumber
            if (balance < amount) {
                throw new ValidationException("Invalid  Payment Amount for " + billingNumber + " (balance : " + balance + ") ")
            }

            return amount - balance;
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async getPaymentTotal(client: PoolClient, paymentId: string) {
        try {
            const query = {
                text: ` SELECT  "BillingPayments"."branchId" , CAST(sum("amount"::text::numeric)AS REAL)  as "total" 
                from "BillingPayments" 
                left join  "BillingPaymentLines" on "BillingPaymentLines"."billingPaymentId"="BillingPayments".id 
                where "BillingPayments".id =$1
                group by "BillingPayments".id
                `,
                value: [paymentId]
            }

            let payments = await client.query(query.text, query.value);

            return payments.rows && payments.rows.length > 0 ? payments.rows[0] : null
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async updatePaymentPaidAmount(client: PoolClient, paidAmount: number, paymentId: string) {
        try {
            const query: { text: any, values: any } = {
                text: `UPDATE "BillingPayments" SET  "paidAmount" =$1   where "id"=$2`,
                values: [paidAmount, paymentId]
            }

            await client.query(query.text, query.values);


        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getBillBranchId(client: PoolClient, billId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "branchId" from "Billings" where id =$1`,
                values: [billId]
            }
            let branchId = await client.query(query.text, query.values)
            return branchId.rows && branchId.rows.length > 0 ? branchId.rows[0].branchId : null;

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async addBillingPayment(data: any, company: Company, employeeId: string) {
        const client = await DB.excu.client();
        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            const validate = await BillingValidation.billnigPaymentsValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }



            const billingPayment = new BillingPayment();
            billingPayment.ParseJson(data)
            billingPayment.employeeId = employeeId
            billingPayment.companyId = companyId;
            billingPayment.calculateTotal(afterDecimal);
            billingPayment.afterDecimal = afterDecimal

            if (billingPayment.paidAmount < 0 || billingPayment.tenderAmount < 0) {
                throw new ValidationException("Payment Amount Cannot be Negative")
            }
            if (billingPayment.tenderAmount == 0 && billingPayment.paidAmount == 0) {
                throw new ValidationException("Payment amount must be grater than zero")
            }
            if (billingPayment.tenderAmount != 0 && billingPayment.tenderAmount < billingPayment.paidAmount) {
                throw new ValidationException("Total Paid Amount Exceeded total Recived amount (Payment Made)")
            }




            if (billingPayment.branchId != 'all') {
                if (billingPayment.branchId == null || billingPayment.branchId == "") {
                    let billId: any = billingPayment.lines[0].billingId
                    billingPayment.branchId = await this.getBillBranchId(client, billId)

                }
            }


            /** will verfiy total paid amount (used amount is not exceeding = sum lines amount) tenderamount payment amount */
            if (billingPayment.tenderAmount != 0 && billingPayment.tenderAmount * billingPayment.rate < billingPayment.paidAmount) {
                throw new ValidationException("Lines Total Exceed Payment Amount")
            }


            //?????????????????????????

            if ((billingPayment.branchId == "" || billingPayment.branchId == null) && (billingPayment.tenderAmount * billingPayment.rate) != billingPayment.paidAmount) {

                throw new ValidationException("Total Paid Amount Exceeded  total Recived amount  (Payment Made)")

            }

            //?????????????????????????


            /** Payment Cannot be made with a futur date */
            if (!billingPayment.checkBillingPaymentDate()) {
                throw new ValidationException("Invalid Payment Date")
            }
            await client.query("BEGIN")
            /**Set Payment Method Account Id
             * we set the payment method account date due to if the account of the payment  changed in the  future 
             * the payment journal willnot be affected 
             */
            const paymentAccountId = await PaymnetMethodRepo.getPaymnetMethodaccountId(client, billingPayment.paymentMethodId, billingPayment.branchId);
            billingPayment.paymentMethodAccountId = paymentAccountId.id;
            billingPayment.createdAt = new Date();



            /**Insert Payment */
            const query: { text: string, values: any } = {
                text: `INSERT INTO "BillingPayments" 
                                   ("tenderAmount",
                                    "paymentMethodId",
                                    "employeeId",
                                    "companyId",
                                    "createdAt",
                                    "paidAmount",
                                    "supplierId",
                                    "paymentMethodAccountId",
                                    "paymentDate",
                                    "rate",
                                    "attachment",
                                    "branchId",
                                    "referenceNumber") 
                                 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
                values: [billingPayment.tenderAmount,
                billingPayment.paymentMethodId,
                billingPayment.employeeId,
                billingPayment.companyId,
                billingPayment.createdAt,
                billingPayment.paidAmount,
                billingPayment.supplierId,
                billingPayment.paymentMethodAccountId,
                billingPayment.paymentDate,
                billingPayment.rate,
                JSON.stringify(billingPayment.attachment),
                billingPayment.branchId,
                billingPayment.referenceNumber

                ]
            }

            const insert = await client.query(query.text, query.values)
            billingPayment.id = (<any>insert.rows[0]).id;


            /**Insert Payment Lines */
            for (let index = 0; index < billingPayment.lines.length; index++) {
                const line: BillingPaymentLine = billingPayment.lines[index];
                line.billingPaymentId = billingPayment.id
                line.branchId = line.branchId ?? billingPayment.branchId
                line.companyId = company.id
                if (line.amount > 0) {

                    line.createdAt = TimeHelper.getCreatedAt(billingPayment.paymentDate, company.timeOffset);

                    await this.addBillingPaymentLine(client, line, billingPayment)
                }
            }


            await client.query("COMMIT")

            return new ResponseData(true, "", { id: billingPayment.id })
        } catch (error: any) {
            await client.query("ROLLBACK")
          
            throw new Error(error.message)

        } finally {
            client.release();
        }
    }
    public static async addBillingPaymentLine(client: PoolClient, billingPaymentLine: BillingPaymentLine, billPayment: BillingPayment) {
        try {


            if (billingPaymentLine.billingId == "") {
                billingPaymentLine.billingId = null
            }
            if (billingPaymentLine.billingId) /** If Not Paying Supplier Opening Balance  check status of bill only open bill are allowd to be paid*/ {
                let billStatus = await BillingRepo.getBillingCurrentStatus(client, billingPaymentLine.billingId)

                if (billStatus == "Draft") {
                    throw new ValidationException("Draft Bill Are Not Allowed to be Paid")
                }
            }


            /** To prevent paying bill amount that exceeded the bill balance  */
            if (billingPaymentLine.billingId != null) {

                billingPaymentLine.branchId = (await BillingRepo.validateBillPaidAmount(client, billingPaymentLine.billingId, billingPaymentLine.amount, billPayment.afterDecimal, billingPaymentLine.billingPaymentId)).branchId

            } else {
                //?????????? when billingPaymentLine.billingPaymentId is null the validation will reurn the total openieng balance even when it's paid or partialy paid
                billingPaymentLine.branchId = await SupplierRepo.validateOpeningBalancePaidAmount(client, billingPaymentLine.openingBalanceId ?? "", billingPaymentLine.amount, billingPaymentLine.billingPaymentId)
            }



            /** Billing Line Can be either billingId or note when only paying supplier Opening balance " */
            billingPaymentLine.note = billingPaymentLine.billingId != null && billingPaymentLine.id != "" ? billingPaymentLine.note : "Opening Balance"

            const query: { text: string, values: any } = {
                text: `INSERT INTO "BillingPaymentLines" 
                                   (amount,
                                    "billingPaymentId",
                                    "billingId",
                                    "branchId",
                                    "createdAt",
                                    "note",
                                    "openingBalanceId",
                                    "companyId") 
                             VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
                values: [billingPaymentLine.amount,
                billingPaymentLine.billingPaymentId,
                billingPaymentLine.billingId,
                billingPaymentLine.branchId,
                billingPaymentLine.createdAt,
                billingPaymentLine.note,
                billingPaymentLine.openingBalanceId,
                billingPaymentLine.companyId
                ]
            }
            let id = await client.query(query.text, query.values)
            return id.rows[0].id
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async getPaymentLogs(client: PoolClient, paymentId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT logs from "BillingPayments" WHERE id  =$1`,
                values: [paymentId]
            }

            let logData = await client.query(query.text, query.values);
            return logData.rows[0].logs ?? []
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async addPaymentLogs(payment: BillingPayment, action: string, comment: string, employeeId: string) {
        try {
            const log = new Log();
            log.action = action;
            log.comment = comment;
            log.createdAt = new Date();
            log.employeeId = employeeId;
            if (payment.logs == null) {
                payment.logs = [];
            }
            payment.logs.push(log);
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async lineOldDate(client: PoolClient, lineId: string) {
        try {

            const query = {
                text: `SELECT cast ("createdAt" as text) "createdAt" FROM "BillingPaymentLines" where id  =$1`,
                values: [lineId]
            }
            let line = await client.query(query.text, query.values);
            return line.rows && line.rows.length > 0 ? line.rows[0].createdAt : null
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getOldPaymentMethod(client: PoolClient, paymentId: string) {
        try {
            const query = {
                text: `SELECT "PaymentMethods".id,
                "PaymentMethods".name,
                            COALESCE(("branchesAccounts"->>("branchId"::text))::uuid, "PaymentMethods"."accountId"  ) as "accountId"
                    , "BillingPayments"."paymentMethodAccountId" 
                    FROM "PaymentMethods" 
                    inner join "BillingPayments" on "BillingPayments"."paymentMethodId" =  "PaymentMethods".id
                    where "BillingPayments".id  = $1`,
                values: [paymentId]
            }
            let payment = await client.query(query.text, query.values);

            return payment.rows[0]
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async deleteZeroLines(client: PoolClient, lineIds: any[], paymentId: string) {
        try {
            await client.query('DELETE FROM "BillingPaymentLines" where  "billingPaymentId" =$2 and id <> ALL($1)', [lineIds, paymentId])
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async editBillingPayment(data: any, company: Company, employeeId: string) {
        const client = await DB.excu.client();
        try {
            const companyId = company.id
            const validate = await BillingValidation.billnigPaymentsValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            const afterDecimal = company.afterDecimal;
            const billingPayment = new BillingPayment();
            billingPayment.ParseJson(data)
            billingPayment.employeeId = employeeId
            billingPayment.calculateTotal(afterDecimal)
            if (billingPayment.tenderAmount == 0 && billingPayment.paidAmount == 0) {
                throw new ValidationException("Payment amount must be grater than zero")
            }
            //billingPayment.logs = await this.getPaymentLogs(client, billingPayment.id);

            billingPayment.logs = []

            await Helper.roundNumbers(afterDecimal, billingPayment)
            if (billingPayment.tenderAmount != 0 && billingPayment.tenderAmount < billingPayment.paidAmount) {
                throw new ValidationException("Total Paid Amount Exceeded total Recived amount (Payment Made) ")
            }
            /** will verfiy total paid amount (used amount is not exceeding = sum lines amount) tenderamount payment amount */
            if (billingPayment.tenderAmount != 0 && billingPayment.tenderAmount * billingPayment.rate < billingPayment.paidAmount) {
                throw new ValidationException("Lines Total Exceed Payment Amount")
            }
            await client.query("BEGIN")

            let oldPaymentDate = await this.getBillPayemntDate(client, billingPayment.id)
            let oldPaymentMethodData = await this.getOldPaymentMethod(client, billingPayment.id,);
            const paymentAccountId = await PaymnetMethodRepo.getPaymnetMethodaccountId(client, billingPayment.paymentMethodId, billingPayment.branchId);
            billingPayment.paymentMethodAccountId = paymentAccountId.id;

            //Log.addLog(billingPayment, "Edit", "Edit", employeeId)
            /** if payment change change accountId */
            /** if  payment method not change check accountId received with  selected payment method  if not equal set to null  so its not changed */
            if (oldPaymentMethodData && oldPaymentMethodData.id != billingPayment.paymentMethodId) {
                //this.addPaymentLogs(billingPayment, "edit", "Change Payment Method", employeeId);
                Log.addLog(billingPayment, `Change Payment Method from ${oldPaymentMethodData.name} to ${billingPayment.paymentMethodName}`, "edit", employeeId, {"oldPayment": oldPaymentMethodData.name, "newPayment": billingPayment.paymentMethodName})

                billingPayment.paymentMethodAccountId = paymentAccountId.id;

            } else if (oldPaymentMethodData && oldPaymentMethodData.paymentMethodAccountId != paymentAccountId.id) {
                billingPayment.paymentMethodAccountId = null
            }



            if (billingPayment.paymentMethodAccountId == "") {
                billingPayment.paymentMethodAccountId = null
            }
            const query: { text: string, values: any } = {
                text: `UPDATE "BillingPayments"
                               SET "tenderAmount"=$1,
                                   "paymentMethodId"=$2,
                                   "employeeId"=$3,
                                    "paymentDate"=$4,
                                    "attachment"=$5,
                                    "paidAmount"=$6,
                                    "referenceNumber"=$7,
                                    "paymentMethodAccountId"= case when $8::uuid is null then "paymentMethodAccountId" else $8 end ,
                                    "rate" = $9
                               WHERE "companyId"=$10
                               AND id=$11`,
                values: [billingPayment.tenderAmount, billingPayment.paymentMethodId, billingPayment.employeeId, billingPayment.paymentDate, JSON.stringify(billingPayment.attachment), billingPayment.paidAmount, billingPayment.referenceNumber, billingPayment.paymentMethodAccountId, billingPayment.rate, companyId, billingPayment.id]
            }
            const insert = await client.query(query.text, query.values)
            const lineIds: any[] = []
            billingPayment.lines.forEach(element => {
                if (element.id != "" && element.id != null && element.amount != 0)
                    lineIds.push(element.id)
            });
            for (let index = 0; index < billingPayment.lines.length; index++) {
                const line = billingPayment.lines[index];
                line.billingPaymentId = billingPayment.id;
                line.branchId = line.branchId ?? billingPayment.branchId;
                line.companyId = company.id
                if ((line.id == "" || line.id == null)) {
                    if (line.amount > 0) {
                        //this.addPaymentLogs(billingPayment, "edit", "Add New Line", employeeId);
                        Log.addLog(billingPayment, "Add New Line", "edit", employeeId)

                        line.createdAt = TimeHelper.getCreatedAt(billingPayment.paymentDate, company.timeOffset);
                        let id = await this.addBillingPaymentLine(client, line, billingPayment)
                        lineIds.push(id)
                    }

                } else {

                    const oldLineDate = await this.lineOldDate(client, line.id)
                    let lineDate = new Date(oldLineDate);
                    let billDate = new Date(oldPaymentDate)
                    // billDate.setHours(0, 0, 0, 0);

                    if (lineDate.getUTCFullYear() == lineDate.getUTCFullYear() && lineDate.getUTCMonth() == billDate.getUTCMonth() && lineDate.getUTCDate() == billDate.getUTCDate()) {

                        line.createdAt = billingPayment.paymentDate
                    } else {
                        let currentPaymentDate = new Date(billingPayment.paymentDate)

                        console.log(lineDate.getTime(), currentPaymentDate.getTime())
                        console.log(lineDate.getTime() < currentPaymentDate.getTime())
                        if (lineDate.getTime() < currentPaymentDate.getTime()) {
                            line.createdAt = TimeHelper.getCreatedAt(billingPayment.paymentDate, company.timeOffset);

                        }
                    }

                    await this.editBillingPaymentLine(client, billingPayment, line, afterDecimal, employeeId)
                }

            }

            if (employeeId && billingPayment.logs.length == 0) {
                //this.addPaymentLogs(billingPayment, "Edit", "Edit", employeeId)
                Log.addLog(billingPayment, "Edit", "edit", employeeId)

            }
            

            await this.setPaymentLogs(client, billingPayment.logs, billingPayment.id, billingPayment.branchId, company.id,employeeId, billingPayment.referenceNumber, "Cloud")

            await this.deleteZeroLines(client, lineIds, billingPayment.id)
            await client.query("COMMIT")
            const resaData = {
                id: billingPayment.id
            }
            return new ResponseData(true, "", resaData)
        } catch (error: any) {
            console.log(error)
          
            await client.query("ROLLBACK")

            throw new Error(error.message)

        } finally {
            client.release();
        }
    }

    public static async setPaymentLogs(client: PoolClient, logs: Log[], paymentId: string, branchId: string, companyId: string, employeeId:string,paymentNumber:string | null, source:string) {
        try {
            await LogsManagmentRepo.manageLogs(client, "BillingPayments", paymentId, logs, branchId, companyId,employeeId, paymentNumber, source)

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getOldLineAmount(client: PoolClient, lineId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "BillingPaymentLines".amount FROM "BillingPaymentLines" where id =$1`,
                values: [lineId]
            }

            let line = await client.query(query.text, query.values);
            return line.rows[0].amount
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async editBillingPaymentLine(client: PoolClient, billingPayment: BillingPayment, billingPaymentLine: BillingPaymentLine, afterDecimal: number, employeeId: string) {
        try {
            console.log(billingPaymentLine.createdAt)

            if (billingPaymentLine.billingId) /** If Not Paying Supplier Opening Balance  check status of bill only open bill are allowd to be paid*/ {
                let billStatus = await BillingRepo.getBillingCurrentStatus(client, billingPaymentLine.billingId)

                if (billStatus == "Draft") {
                    throw new ValidationException("Draft Bill Are Not Allowed to be Paid")
                }
            }
            let oldAmount = await this.getOldLineAmount(client, billingPaymentLine.id);
            if (oldAmount != billingPaymentLine.amount) {
                //this.addPaymentLogs(billingPayment, "edit", `Update Billing Payment Amount from ${oldAmount} to ${billingPaymentLine.amount}`, employeeId)
                Log.addLog(billingPayment, `Update Billing Payment Amount from ${oldAmount} to ${billingPaymentLine.amount}`, "edit", employeeId, {"OldAmount" : oldAmount, "newAmount" : billingPaymentLine.amount})

            }

            /** To prevent paying bill amount that exceeded the bill balance  */
            if (billingPaymentLine.billingId != null) {

                billingPaymentLine.branchId = (await BillingRepo.validateBillPaidAmount(client, billingPaymentLine.billingId, billingPaymentLine.amount, billingPayment.afterDecimal, billingPaymentLine.billingPaymentId)).branchId

            } else {
                //?????????? when billingPaymentLine.billingPaymentId is null the validation will reurn the total openieng balance even when it's paid or partialy paid
                billingPaymentLine.branchId = await SupplierRepo.validateOpeningBalancePaidAmount(client, billingPaymentLine.openingBalanceId ?? "", billingPaymentLine.amount, billingPaymentLine.billingPaymentId)
            }

            const query: { text: string, values: any } = {
                text: `UPDATE "BillingPaymentLines" 
                               SET amount=$1,
                                  "billingId"=$2,
                                  "branchId" = $3,
                                  "createdAt"= case when "createdAt"::date = $4::date then "createdAt" else $4 end 
                                WHERE "billingPaymentId"=$5
                                AND id = $6`,
                values: [billingPaymentLine.amount, billingPaymentLine.billingId, billingPaymentLine.branchId, billingPaymentLine.createdAt, billingPaymentLine.billingPaymentId, billingPaymentLine.id]
            }
            await client.query(query.text, query.values)
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }

    public static async getBillingPaymentById(billingPaymentId: string, companyId: string,pdf:boolean=false) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const query: { text: string, values: any } = {
                text: `SELECT
                            "BillingPayments".id,
                            "tenderAmount",
                            "Employees".name AS "employeeName",
                            "PaymentMethods".id as "paymentMethodId",
                            "PaymentMethods".name AS "paymentName",
                            "BillingPayments"."supplierId",
                             "Suppliers".name as "supplierName",
                             "Suppliers".email as "supplierEmail",
                            "BillingPayments"."branchId",
                            "BillingPayments"."createdAt",
                                  "BillingPayments"."referenceNumber",
                            "BillingPayments"."mediaId",
                            "Media"."url"->>'defaultUrl' as "mediaUrl",
                            "BillingPayments"."paidAmount",
                            "Accounts".name as "accountName", 
                            CAST ("BillingPayments"."paymentDate" AS TEXT) AS "paymentDate" ,
                            "BillingPayments"."companyId",
                            (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',COALESCE("Media"."url"->>'downloadUrl',"Media"."url"->>'defaultUrl'),'mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("BillingPayments"."attachment") as attachments(attachments)
                            inner join "Media" on "Media".id = (attachments->>'id')::uuid
                            ) as "attachment",
                             "BillingPayments"."referenceNumber",
                            "BillingPayments"."rate",
                            CASE WHEN "Reconciliations"."id" is not null and "Reconciliations"."status" = 'reconciled' then true else false end as "reconciled"

                    FROM "BillingPayments" 
                    LEFT JOIN "Employees" ON "Employees".id ="BillingPayments"."employeeId"
                    LEFT JOIN "Media" ON "Media".id ="BillingPayments"."mediaId"
                    LEFT JOIN "PaymentMethods" ON "PaymentMethods".id = "BillingPayments"."paymentMethodId" 
                    LEFT JOIN "Accounts" on "Accounts"."id" = "BillingPayments"."paymentMethodAccountId"
                    LEFT JOIN "Reconciliations" ON "Reconciliations".id = "BillingPayments"."reconciliationId"
                    INNER JOIN "Suppliers" on "Suppliers".id = "BillingPayments"."supplierId"
                    WHERE "BillingPayments".id =$1
                    and "BillingPayments"."companyId"=$2`,
                values: [billingPaymentId, companyId]
            }
            const payments = await client.query(query.text, query.values)
            const billingPayments: any = payments.rows[0];

            billingPayments.lines = []
            if (billingPayments.id != "" && billingPayments.id != null) {
                query.text = `with  "payment" as(SELECT 
		"BillingPaymentLines".id,
		"BillingPaymentLines"."billingId",
		"BillingPaymentLines"."note",
        "BillingPaymentLines"."branchId",
	    "BillingPaymentLines"."createdAt"  AS "createdAt",
        "Branches".name as "branchName",
		"Billings".reference,
		case when  "Billings".id is null then 'Opening Balance' else   "Billings"."billingNumber"  end as "billingNumber",
		"Billings"."billingDate",
		"Billings"."dueDate",
		case when  "Billings".id is null then "SupplierOpeningBalance"."openingBalance" else "Billings"."total" end as "total",
		 case when  "Billings".id is null then  COALESCE(sum("OpeningBalancePayment".amount),0)  else COALESCE(sum("paidLines".amount),0) end as "paidAmount",
		"BillingPaymentLines".amount ,
		"SupplierOpeningBalance".id As "openingBalanceId"
            FROM "BillingPaymentLines"
            LEFT JOIN  "Billings" ON "Billings".id = "BillingPaymentLines"."billingId"
            LEFT JOIN "BillingPaymentLines" as "paidLines" on "paidLines"."billingId" = "Billings".id  and "BillingPaymentLines".id <> "paidLines".id
            LEFT JOIN "SupplierOpeningBalance"  on "BillingPaymentLines"."openingBalanceId" = "SupplierOpeningBalance".id 
            LEFT JOIN "Branches" on "Branches".id = "BillingPaymentLines"."branchId" 
            LEFT JOIN "BillingPaymentLines" as "OpeningBalancePayment"  on "OpeningBalancePayment"."openingBalanceId" = "SupplierOpeningBalance".id  and "BillingPaymentLines".id <> "OpeningBalancePayment".id
            WHERE "BillingPaymentLines"."billingPaymentId"=$1
            group by "Billings".id,"BillingPaymentLines".id,"SupplierOpeningBalance".id,     "Branches".name),
            "applyCredit"  as (
            select  "payment"."billingId" , sum("SupplierAppliedCredits".amount) as "total" from "payment"
            inner join "SupplierAppliedCredits" on "SupplierAppliedCredits"."billingId" = "payment"."billingId"
            group by "payment"."billingId"
            ),
            "supplierCredit"  as (
            select  "payment"."billingId" , sum("SupplierCredits".total) as "total" from "payment"
            inner join "SupplierCredits" on "SupplierCredits"."billingId" = "payment"."billingId"
            group by "payment"."billingId"
            )

            select "payment".id,
                    "payment"."billingId",
                    "payment"."note",
                    "payment"."createdAt",
                    "payment".reference,
                    "payment"."billingNumber",
                    "payment"."billingDate",
                    "payment"."branchName",
                    "payment"."dueDate",
                    "payment"."total" -  COALESCE("supplierCredit"."total" ,0) as "total",
                    "payment"."paidAmount"  +  COALESCE("applyCredit"."total" ,0) as "paidAmount", 
                    "payment".amount ,
                    "payment"."openingBalanceId"								
            from "payment"
            left join "applyCredit" on "applyCredit"."billingId" =      "payment"."billingId"
            left join "supplierCredit" on "supplierCredit"."billingId" =      "payment"."billingId"
                        `

                const lines = await client.query(query.text, [billingPaymentId]);

                billingPayments.lines = lines.rows
                if (!pdf&&billingPayments.tenderAmount > 0 && billingPayments.tenderAmount > billingPayments.paidAmount) {
                    const getSupplierBills = await SupplierRepo.getSupplierBills(client, billingPayments.supplierId, billingPayments.branchId)
                    getSupplierBills.data.forEach((element: any) => {

                        const temp: any = billingPayments.lines.find((f: any) => f.billingId == element.billingId)
                        if (billingPayments.lines.indexOf(temp) == -1) {
                            billingPayments.lines.push(element)
                        }


                    });
                }
            }
            await client.query("COMMIT")
            return new ResponseData(true, "", billingPayments)

        } catch (error: any) {

            await client.query("ROLLBACK")
          
            throw new Error(error.message)
        } finally {

            client.release()
        }
    }
    public static async getBillingPaymentLists(data: any, company: Company, branchlist: []) {

        try {
            const companyId = company.id
            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchlist
            let searchValue = data.searchTerm ? data.searchTerm.toLowerCase().trim() : null



            let sort = data.sortBy;
            let sortValue = !sort ? ' "BillingPayments"."createdAt"' : '"' + sort.sortValue + '"';

            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection;
            let orderByQuery = " ORDER BY " + sortTerm

            if (data.searchTerm != "" && data.searchTerm != null) {
                searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`
            }
            let offset = 0;
            let page = data.page ?? 1
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const filter = data.filter
            const fromDate = filter && filter.fromDate ? filter.fromDate : null
            const toDate = filter && filter.toDate ? filter.toDate : null

            const query: { text: string, values: any } = {
                text: `SELECT
                        count(*) over(),
                        "BillingPayments".id,
                        "tenderAmount",
                        "Employees".name AS "employeeName",
                        "PaymentMethods".name AS "paymentName",
                        "BillingPayments"."paymentDate",
                        "BillingPayments"."createdAt",
                        "BillingPayments"."paidAmount",
                               "BillingPayments"."referenceNumber",
                        "Suppliers".name as "supplierName",
                        "Suppliers".id as "supplierId",
                        "Branches".name as "branchName",
                        "BillingPayments"."branchId",
                        CASE WHEN "Reconciliations"."id" is not null and "Reconciliations"."status" = 'reconciled' then true else false end as "reconciled",
                        "BillingPayments"."paidAmount" - COALESCE(sum("BillingPaymentLines".amount),0) as "unusedAmount"
                                FROM "BillingPayments"
                                LEFT JOIN "Employees" ON "Employees".id ="BillingPayments"."employeeId"
                                LEFT JOIN "PaymentMethods" ON "PaymentMethods".id = "BillingPayments"."paymentMethodId"
                                INNER JOIN "Suppliers" ON "Suppliers".id =  "BillingPayments"."supplierId"
                                LEFT JOIN "BillingPaymentLines" ON "BillingPaymentLines"."billingPaymentId" ="BillingPayments".id 
                                LEFT JOIN "Branches" on "Branches".id = "BillingPayments"."branchId"
                                LEFT JOIN "Reconciliations" ON "Reconciliations".id = "BillingPayments"."reconciliationId"
                    where "BillingPayments"."companyId"=$1
                    and ( $2::text is null or 
                       ( LOWER("Suppliers".name) ~ $2 
                        OR LOWER("PaymentMethods".name) ~ $2
                          OR       "BillingPayments"."referenceNumber" ~ $2 
                        )
                        )
                AND (array_length($3::uuid[], 1) IS NULL OR ("Branches".id=any($3::uuid[])))
                AND ($4::Date IS NULL OR "BillingPayments"."paymentDate"::date >= $4::date)
                AND ($5::Date IS NULL OR "BillingPayments"."paymentDate"::date <= $5::date)
                                Group by "Employees".id,"PaymentMethods".id,"BillingPayments".id,"Suppliers".id , "Branches".name,"Reconciliations"."id" 
                ${orderByQuery}
                limit $6 offset $7`,

                values: [companyId, searchValue, branches, fromDate, toDate, limit, offset]
            }


            const selectList = await DB.excu.query(query.text, query.values)

            let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: selectList.rows,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }
            return new ResponseData(true, "", resData)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    /** Payable Journal  + prepaid expense journal */
    public static async getBillingPaymentJournal(billingPaymentId: string, company: Company) {
        try {
            const companyId = company.id;
            const journals: any[] = [];
            const afterDecimal = company.afterDecimal;
            const defaultJournals = await JournalRepo.getJournal(billingPaymentId, company)
            const query: { text: string, values: any } = {
                text: `SELECT  
                ROUND (sum( case when "JournalRecords".amount > 0 then "JournalRecords".amount::DECIMAL end ),$2) as debit,
                ROUND ( sum( case when "JournalRecords".amount < 0 then  ABS("JournalRecords".amount)::DECIMAL end ) ,$2) as credit,
                name as "accountType",
                "JournalRecords"."createdAt",
                "BillingPaymentLines".id,
                "Billings"."billingNumber"
          FROM "JournalRecords"
          INNER JOIN "BillingPaymentLines"
          ON "referenceId" = "BillingPaymentLines".id
          INNER JOIN "Billings"
          ON "Billings".id = "BillingPaymentLines"."billingId"
          WHERE  "BillingPaymentLines"."billingPaymentId" = $1
          group by "JournalRecords"."accountId" , name,  "JournalRecords"."createdAt","BillingPaymentLines".id, "Billings".id `,
                values: [billingPaymentId, afterDecimal]
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
                        billingNumber: element.billingNumber,
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
    public static async deleteBillPayment(billPaymentId: string, company: Company, employeeId: string) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")

            const lineIds = await client.query(`select JSON_AGG("BillingPaymentLines".id) as ids ,
                                 JSON_AGG("BillingPaymentLines"."billingId") as "billingIds" ,
                                                       "BillingPayments"."branchId", 
                                                       "BillingPayments"."supplierId",
                                                       "BillingPayments"."referenceNumber",
                                                       "Employees"."name" as "employeeName"

                FROM "BillingPayments"
                left JOIN "BillingPaymentLines" on "BillingPayments".id = "BillingPaymentLines"."billingPaymentId"
                INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2
                WHERE "BillingPayments".id =$1
                group by  "BillingPayments".id, "Employees".id
                `, [billPaymentId, employeeId, company.id])

            let ids = lineIds.rows && lineIds.rows.length > 0 ? lineIds.rows[0].ids : []
            let branchId = lineIds.rows && lineIds.rows.length > 0 ? lineIds.rows[0].branchId : null
            let billingIds = lineIds.rows && lineIds.rows.length > 0 ? lineIds.rows[0].billingIds : null
            let supplierId = lineIds.rows && lineIds.rows.length > 0 ? lineIds.rows[0].supplierId : null
            let referenceNumber = lineIds.rows && lineIds.rows.length > 0 && lineIds.rows[0].referenceNumber ? lineIds.rows[0].referenceNumber : ''
            let employeeName = lineIds.rows && lineIds.rows.length > 0 && lineIds.rows[0].employeeName ? lineIds.rows[0].employeeName : ''


            const query: { text: string, values: any } = {
                text: `DELETE FROM "BillingPaymentLines" using "BillingPayments" 
                      where "BillingPayments".id = "BillingPaymentLines"."billingPaymentId"
                      and "BillingPayments".id =$1`,
                values: [billPaymentId]
            }

            await client.query(query.text, query.values)

            query.text = `DELETE FROM "BillingPayments" 
            where "BillingPayments".id =$1`
            await client.query(query.text, query.values)


            let log = new Log();
            log.employeeId = employeeId
            log.action = 'BillPayment Deleted'
            log.comment = `${employeeName} has deleted bill payment ref number ${referenceNumber}`
            log.metaData = {"deleted": true}

            await LogsManagmentRepo.manageLogs(client, "BillingPayments", billPaymentId, [log], branchId, company.id,employeeId,referenceNumber, "Cloud")



            await client.query("COMMIT")
            return new ResponseData(true, "", { ids: ids, billingIds: billingIds, supplierId: supplierId })
        } catch (error: any) {
            await client.query("ROLLBACK")
          
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async sendEmail(data: any, company: Company) {
        try {

            let pdfGenerator = new PDFGenerator()
            data.type = 'billPayment'
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
            data.type = 'billPayment'
            let pdfBuffer = await pdfGenerator.getPdf(data);
            return pdfBuffer
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }

}