import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { SupplierAppliedCredit } from "@src/models/account/supplierAppliedCredit"
import { BillingRepo } from "./billing.repo";
import { AppliedCreditsValidation } from "@src/validationSchema/account/appliedCredit.Schema";
import { BillingPaymentLine } from "@src/models/account/BillingPaymentLines";
import { BillingPaymentRepo } from "./billingPayment.repo";

import { Company } from "@src/models/admin/company";

import { ValidationException } from "@src/utilts/Exception";
import { BillingPayment } from "@src/models/account/BillingPayment";
import { PoolClient } from "pg";
import { SupplierCreditRepo } from "./supplierCredit.repo";
import { EventLog, Log } from "@src/models/log";
import { EventLogsRepo } from "./eventlogs.repo";
import { CompanyRepo } from "@src/repo/admin/company.repo";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";

export class SupplierAppliedCreditRepo {
    public static async applyCredit(data: any, company: Company, employeeId: string) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const validate = await AppliedCreditsValidation.billingAppliedCredit(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            if (data.billingId) /** If Not Paying Supplier Opening Balance  check status of bill only open bill are allowd to be paid*/ {
                let billStatus = await BillingRepo.getBillingCurrentStatus(client, data.billingId)

                if (billStatus == "Draft") {
                    throw new ValidationException("Cannot Apply Credit On Draft Bill")
                }
            }


            await BillingRepo.validateBillPaidAmount(client, data.billingId, data.amount, company.afterDecimal);
            const appliedCredit = new SupplierAppliedCredit();
            appliedCredit.ParseJson(data);
            appliedCredit.supplierCreditId = data.id;

            let supplierCreditBalance = await SupplierCreditRepo.getRefundDue(client, appliedCredit.supplierCreditId, appliedCredit.billingId)
            console.log(supplierCreditBalance)
            if (supplierCreditBalance < appliedCredit.amount) {
                throw new ValidationException('Amount Credited Exceeds Credit Note Balance')

            }
            const query: { text: string, values: any } = {
                text: `INSERT INTO "SupplierAppliedCredits" ("supplierCreditId","billingId",amount,"appliedCreditDate","employeeId") VALUES ($1,$2,$3,$4,$5) RETURNING id`,
                values: [appliedCredit.supplierCreditId, appliedCredit.billingId, appliedCredit.amount, appliedCredit.appliedCreditDate, employeeId]
            }

            let res = await client.query(query.text, query.values)
            await client.query("COMMIT")

            return new ResponseData(true, "", { id: res.rows[0].id })
        } catch (error: any) {

            console.log(error)
            await client.query("ROLLBACK")
          

            throw new Error(error.message)
        } finally {
            client.release()
        }
    }

    public static async getAvailableCreditList(supplierId: string) {
        try {



            const query: { text: string, values: any } = {
                text: `with "supplier" as(
                        select $1::uuid "supplierId"
                            ),"supplierBillings" as(

                        select "Billings".id , "Billings"."billingNumber", "Billings"."total"  from "Billings" 
                        inner join "supplier" on "Billings"."supplierId" = "supplier"."supplierId"
                            group by  "Billings".id
                        ), "payments" as(
                        select  "supplierBillings".id , sum("BillingPaymentLines"."amount")as "total" from "supplierBillings"
                        inner JOIN "BillingPaymentLines" ON "BillingPaymentLines"."billingId" = "supplierBillings".id 
                            group by "supplierBillings".id
                        ),"appliedCredits" as(
                        select  "supplierBillings".id , sum("SupplierAppliedCredits"."amount")as "total" from "supplierBillings"
                        inner JOIN "SupplierAppliedCredits" ON "SupplierAppliedCredits"."billingId" = "supplierBillings".id 
                        group by "supplierBillings".id
                        ),"billings" as(
                        select "supplierBillings".id,
                            case when "supplierBillings"."total" - (COALESCE("payments"."total",0) + COALESCE("appliedCredits"."total",0)) = 0 then COALESCE("payments"."total",0) + COALESCE("appliedCredits"."total",0) else   "supplierBillings"."total" - (COALESCE("payments"."total",0) + COALESCE("appliedCredits"."total",0)) end as "totalPaid"
                            from "supplierBillings"
                        left join "payments" on "payments".id = "supplierBillings".id 
                        left join "appliedCredits" on "appliedCredits".id = "supplierBillings".id 
                        where (COALESCE("appliedCredits"."total",0) > 0 or COALESCE("payments"."total",0) > 0)
                        ), "supplierCredits" as (

                        select "totalPaid","SupplierCreditLines".id, "SupplierCredits"."supplierCreditNumber", "SupplierCreditLines"."supplierCreditId", "SupplierCreditLines"."total", sum("SupplierCreditLines"."total") over(partition by  "billings".id order by  "SupplierCreditLines"."createdAt" DESC ) AS "cumulativeTotal" from "billings" 
                        inner join "BillingLines" on "BillingLines"."billingId" = "billings".id
                        inner join "SupplierCreditLines" ON "SupplierCreditLines"."billingLineId" = "BillingLines".id 
                        inner join "SupplierCredits" ON "SupplierCreditLines"."supplierCreditId" = "SupplierCredits".id 
                        ), "supplierCreditsBalance" as(

                        select 
                        "supplierCredits"."supplierCreditId", 
                        "supplierCredits"."id", 
                        "supplierCredits"."supplierCreditNumber", 

                        sum(
                                CASE
                                        WHEN "cumulativeTotal" <= "totalPaid"  THEN  "total" 
                                        WHEN "cumulativeTotal" > "totalPaid"  AND"cumulativeTotal"-  "total" < "totalPaid" THEN  "total" - ("cumulativeTotal" - "totalPaid")
                                        ELSE 0
                                    END
                            ) as "total"
                                
                        from "supplierCredits"
                        WHERE "cumulativeTotal" <= "totalPaid" OR ("cumulativeTotal" - "total" < "totalPaid")
                        group by "supplierCredits"."supplierCreditId","supplierCredits"."id","supplierCredits"."supplierCreditNumber" 
                        ), "supplierCreditsBalanceTotal" as(
                        select "supplierCreditId" as id , 
                            "supplierCreditsBalance"."supplierCreditNumber",
                            sum("total") as "total"
                        from "supplierCreditsBalance"
                            group by "supplierCreditId", 
                            "supplierCreditsBalance"."supplierCreditNumber"
                        ),"refunds" as (
						  select "supplierCreditsBalanceTotal".id, sum("SupplierRefunds"."total") as "total" from "supplierCreditsBalanceTotal"
						inner join "SupplierRefunds" on "SupplierRefunds"."supplierCreditId" = "supplierCreditsBalanceTotal".id
						 group by "supplierCreditsBalanceTotal".id
						), "creditLits" as (
						  select "supplierCreditsBalanceTotal".id,
                            "supplierCreditsBalanceTotal"."supplierCreditNumber" as "code", 
                                "supplierCreditsBalanceTotal"."total" - COALESCE(sum("SupplierAppliedCredits".amount),0) -   COALESCE("refunds"."total",0) as "credit",
                                'SupplierCredit' as "reference"
                        from "supplierCreditsBalanceTotal"
                        left join "refunds" on "refunds".id = "supplierCreditsBalanceTotal".id 
                        left join "SupplierAppliedCredits" ON "SupplierAppliedCredits"."supplierCreditId"  = "supplierCreditsBalanceTotal".id 
                        group by "supplierCreditsBalanceTotal".id,
                            "supplierCreditsBalanceTotal"."supplierCreditNumber",
                                "supplierCreditsBalanceTotal"."total", "refunds"."total"
                        having  "supplierCreditsBalanceTotal"."total" - COALESCE(sum("SupplierAppliedCredits".amount),0) > 0 
						), "expesnses" as (
						
						select "BillingPayments".id,
							   'Prepaid Expenses' as "code",
							     "BillingPayments"."tenderAmount" -  COALESCE(sum("BillingPaymentLines".amount),0)   as "credit",
							'BillingPayment' as  "reference"
							from "supplier" 
						inner join "BillingPayments" on "BillingPayments"."supplierId" = "supplier"."supplierId"
						left join "BillingPaymentLines" on "BillingPaymentLines"."billingPaymentId" = "BillingPayments".id
							group by "BillingPayments".id
							having  "BillingPayments"."tenderAmount" -  COALESCE(sum("BillingPaymentLines".amount),0) > 0 
						)
						
						select * from "creditLits" where "credit">0 
						union all 
								select * from "expesnses"
 `,
                values: [supplierId]
            }

            const creditApplies = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", creditApplies.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async checkIfBillExist(client: PoolClient, paymentId: string, billingId: string) {
        try {
            const query = {
                text: `SELECT * FROM "BillingPaymentLines" where "billingPaymentId" =$1 and "billingId"=$2`,
                values: [paymentId, billingId]
            }

            let bill = await client.query(query.text, query.values);

            return bill.rows && bill.rows.length > 0 ? bill.rows[0] : null
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async applyPrepaidExpenseCredit(data: any, company: Company, employeeId: string) {
        const client = await DB.excu.client()
        try {
            const validate = await AppliedCreditsValidation.billingAppliedCredit(data);

            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            await client.query("BEGIN")




            let payment = await BillingPaymentRepo.getPaymentTotal(client, data.id)

            const billingPayment = new BillingPayment();
            const billingPaymentLine = new BillingPaymentLine();

            const isBillExist = await this.checkIfBillExist(client, data.id, data.billingId)
            if (isBillExist) {
                billingPaymentLine.ParseJson(isBillExist)
                billingPaymentLine.amount += data.amount;


                await BillingPaymentRepo.editBillingPaymentLine(client, billingPayment, billingPaymentLine, company.afterDecimal, employeeId)

            } else {

                billingPaymentLine.billingId = data.billingId;
                billingPaymentLine.billingPaymentId = data.id;
                billingPaymentLine.amount = data.amount;
                billingPaymentLine.companyId = company.id;
                billingPaymentLine.branchId = payment ? payment.branchId : null
                await BillingPaymentRepo.addBillingPaymentLine(client, billingPaymentLine, billingPayment)

            }
            let newTotal = data.amount;
            if (payment && payment.total) {
                newTotal += payment.total
            }
            await BillingPaymentRepo.updatePaymentPaidAmount(client, newTotal, data.id)
            await client.query("COMMIT")
            return new ResponseData(true, "", [])
        } catch (error: any) {
            await client.query("ROLLBACK")
          
            console.log(error)
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async deleteAppliedCredit(appliedCreditId: string, company: Company, employeeId: string) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const query = {
                text: `SELECT "billingId","Billings"."branchId","SupplierAppliedCredits"."appliedCreditDate", "Employees"."name" as "employeeName"  
                    from "SupplierAppliedCredits"
                        inner join "Billings" on "Billings".id = "SupplierAppliedCredits"."billingId"
                        INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2
                        WHERE "SupplierAppliedCredits".id = $1`,
                values: [appliedCreditId, employeeId, company.id]
            }

            let invoice = await client.query(query.text, query.values);
            let billingId = invoice && invoice.rows && invoice.rows.length > 0 ? invoice.rows[0].billingId : null
            let branchId = invoice && invoice.rows && invoice.rows.length > 0 ? invoice.rows[0].branchId : null
            let employeeName = invoice && invoice.rows && invoice.rows.length > 0 ? invoice.rows[0].employeeName : null
            let appliedCreditDate = invoice && invoice.rows && invoice.rows.length > 0 ? invoice.rows[0].appliedCreditDate : null
            await CompanyRepo.validateTransactionDate(client, appliedCreditDate, branchId, company.id)
            query.text = `delete from "SupplierAppliedCredits" WHERE id =$1`
            await client.query(query.text, query.values);


            let log = new Log();
            log.employeeId = employeeId

            log.action = 'SupplierAppliedCredits Deleted'
            log.comment = `${employeeName} has deleted SupplierAppliedCredits`
            log.metaData = {"deleted": true}
            await LogsManagmentRepo.manageLogs(client, "SupplierAppliedCredits", appliedCreditId, [log], branchId, company.id,employeeId, null, "Cloud")


            await client.query("COMMIT")
            return new ResponseData(true, "", [])

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

}