import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { SupplierRefund } from "@src/models/account/SupplierRefund";
import { SupplierRefundLine } from "@src/models/account/supplierRefundLine";

import { PaymnetMethodRepo } from "./paymentMethod.repo";
import { PoolClient } from "pg";
import { Company } from "@src/models/admin/company";


import { ValidationException } from "@src/utilts/Exception";
import { SupplierCreditRepo } from "./supplierCredit.repo";

export class SupplierRefundsRepo {
    public static async saveSupplierRefund(data: any, company: Company) {
        const client = await DB.excu.client();
        try {

            await client.query("begin")
            const afterDecimal = company.afterDecimal
            const supplierRefund = new SupplierRefund();
            supplierRefund.ParseJson(data);
            supplierRefund.companyId = company.id;
            supplierRefund.calculateTotal(afterDecimal)

            if (supplierRefund.total == 0) {
                throw new ValidationException("Refund Total Must Be Greater than 0 ")
            }

            const refundDue = await SupplierCreditRepo.getRefundDue(client, supplierRefund.supplierCreditId, null);
            if (refundDue < supplierRefund.total) {
                throw new ValidationException("Refunded Amount Exceeds Credit Balance ")
            }
            const query: { text: string, values: any } = {
                text: `INSERT INTO "SupplierRefunds" ("refundedDate",
                                                     reference,
                                                     total,
                                                     "paymentMode",
                                                     description,
                                                     "supplierCreditId",
                                                     "employeeId",
                                                     "companyId",
                                                     "referenceNumber"
                                      
                                                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) Returning id`,
                values: [supplierRefund.refundedDate, supplierRefund.reference, supplierRefund.total, supplierRefund.paymentMode, supplierRefund.description, supplierRefund.supplierCreditId, supplierRefund.employeeId, supplierRefund.companyId, supplierRefund.referenceNumber]
            }

            const insert = await client.query(query.text, query.values)
            supplierRefund.id = (<any>insert.rows[0]).id
            for (let index = 0; index < supplierRefund.lines.length; index++) {
                const element = supplierRefund.lines[index];
                element.supplierRefundId = supplierRefund.id;
                await this.saveSupplierRefundLine(client, element, '')
            }

            await client.query("COMMIT")
            return new ResponseData(true, "", { id: (<any>insert.rows[0]).id })
        } catch (error: any) {
          

            await client.query("ROLLBACK")
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }
    public static async saveSupplierRefundLine(client: PoolClient, supplierRefundLine: SupplierRefundLine, branchId: string) {
        try {
            supplierRefundLine.accountId = (await PaymnetMethodRepo.getPaymnetMethodaccountId(client, supplierRefundLine.paymentMethodId, branchId)).id;
            const query: { text: string, values: any } = {
                text: `INSERT INTO  "SupplierRefundLines" ("paymentMethodId","accountId","supplierRefundId",amount) VALUES ($1,$2,$3,$4)`,
                values: [supplierRefundLine.paymentMethodId, supplierRefundLine.accountId, supplierRefundLine.supplierRefundId, supplierRefundLine.amount]
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
}