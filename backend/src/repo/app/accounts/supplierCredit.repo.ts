import { DB } from "@src/dbconnection/dbconnection";
import { SupplierCredit } from "@src/models/account/supplierCredit"
import { SupplierCreditLine } from "@src/models/account/supplierCreditLines";
import { PoolClient } from "pg";
import { SupplierCreditMovmentRepo } from "./supplierCreditMovment.repo";
import { ResponseData } from "@src/models/ResponseData";
import { AccountsRepo } from "./account.repo";
import { Billing } from "@src/models/account/Billing";

import { SupplierCreditValidation } from "@src/validationSchema/account/supplierCredit.Schema";
import { Helper } from "@src/utilts/helper";
import { JournalRepo } from "./Journal.repo";
import { Company } from "@src/models/admin/company";
import { BillingLine } from "@src/models/account/BillingLine";
import { ProductRepo } from "../product/product.repo";
import { TimeHelper } from "@src/utilts/timeHelper";
import { PDFGenerator } from "@src/utilts/PDFGenerator";
import { ValidationException } from "@src/utilts/Exception";
import { EventLog, Log } from "@src/models/log";
import { EventLogsRepo } from "./eventlogs.repo";
import { BillingRepo } from "./billing.repo";
import { TransactionManagements } from "@src/utilts/TransactionsManagments";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";

export class SupplierCreditRepo {


    public static async checkIfSupplierCreditNumberExist(client: PoolClient, id: string | null, supplierCreditNumber: string, companyId: string) {
        try {
            const prefixReg = "^(SCR-)"; // Pattren used to replac beginning of string in sql query 
            //**Remove SCR OF CURRENT TRANSACTION NUMBER */
            const prefix = "SCR-"
            const num = supplierCreditNumber.replace(prefix, '');
            //**In Case User Entered A New NUMBER NOT FOLLOWING pattren SCR-**  */
            const numTerm = supplierCreditNumber.toLocaleLowerCase().trim()
            const query: { text: string, values: any } = {
                text: `SELECT "supplierCreditNumber" 
                                FROM "SupplierCredits"
                                INNER JOIN "Branches" ON "Branches".id = "SupplierCredits"."branchId"
                                WHERE "Branches"."companyId"=$1
                            AND ( LOWER("supplierCreditNumber") = $2 )
`,
                values: [companyId, numTerm]
            }

            if (id != null) {
                query.text = `SELECT "supplierCreditNumber" 
                                      FROM "SupplierCredits"
                                      INNER JOIN "Branches" ON "Branches".id = "SupplierCredits"."branchId"
                                      WHERE "Branches"."companyId"=$1
                                       AND ( LOWER("supplierCreditNumber") = $2 )
                                           AND "SupplierCredits".id <> $3 `
                query.values = [companyId, numTerm, id]
            }

            console.log(query.values)
            const expenseNumberData = await client.query(query.text, query.values);
            if (expenseNumberData.rowCount != null && expenseNumberData.rowCount > 0) {
                return true;
            } else {
                return false;
            }
        } catch (error: any) {

            throw new Error(error.message)
        }
    }


    public static async getBillingSupplierId(client: PoolClient, billingLineId: string) {
        try {
            const query = {
                text: `SELECT "Billings"."supplierId" FROM "BillingLines" 
                      inner Join "Billings" on "Billings".id = "BillingLines"."billingId"
                     where "BillingLines".id = $1
                `,
                values: [billingLineId]
            }

            let bill = await client.query(query.text, query.values);

            return bill && bill.rows && bill.rows.length > 0 ? bill.rows[0].supplierId : null
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getBillingInfo(client: PoolClient, billId: string) {
        try {
            const query = {
                text: `SELECT "status",
                             "billingDate"
                             FROM "Billings" where id =$1`,
                values: [billId]
            }

            let bill = await client.query(query.text, query.values);
            let billData = new Billing();
            billData.ParseJson(bill.rows[0])
            return billData
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getBillingIdsByLines(client: PoolClient, billingLineIds: string[]) {
        try {
            const query = {
                text: `SELECT DISTINCT "BillingLines"."billingId" FROM "BillingLines" 
                        WHERE "BillingLines".id = any($1::uuid[])`,
                values: [billingLineIds]
            }

            let bill = await client.query(query.text, query.values);
            return bill.rows.map((b) => b.billingId)
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async addSupplierCredit(data: any, company: Company) {
        const client = await DB.excu.client();
        try {

            const companyId = company.id;

            const validate = await SupplierCreditValidation.validateSupplierCredit(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            let billingIds = data.billingId ? [data.billingId] : null
            if (data.billingId == 'all') {
                data.billingId = null
                let line = data.lines[0]
                if (line && (data.supplierId == "" || data.supplierId == null)) {
                    data.supplierId = await this.getBillingSupplierId(client, line.billingLineId)
                }
                let billingLineIds = data.lines.map((l: SupplierCreditLine) => l.billingLineId)
                if (billingLineIds && billingLineIds.length > 0) {
                    billingIds = await this.getBillingIdsByLines(client, billingLineIds)
                }
            } else {
                let billData = await this.getBillingInfo(client, data.billingId)

                if (billData.status == "Draft") {
                    throw new ValidationException(" Cannot Creat Supplier Credit Out Of " + billData.status + " Bills")
                }
            }

            const isNumberExist = await this.checkIfSupplierCreditNumberExist(client, null, data.supplierCreditNumber, companyId)
            if (isNumberExist) {
                throw new ValidationException("Supplier Credit Number already Used")
            }

            await client.query("BEGIN")
            const afterDecimal = company.afterDecimal
            const supplierCredit = new SupplierCredit();
            supplierCredit.ParseJson(data);


            const lineTemps: SupplierCreditLine[] = [];
            for (const element of supplierCredit.lines) {
                if (!element.billingLineId) {
                    continue;
                }
                const billingLine: any = await BillingRepo.getBillLineInfoForCredit(element.billingLineId)
                element.discountTotal = billingLine.discountTotal
                element.discountAmount = billingLine.discountAmount
                element.supplierCreditDiscount = billingLine.billDiscount
                element.applyDiscountBeforeTax = billingLine.applyDiscountBeforeTax
                element.discountPercentage = billingLine.discountPercentage
                element.billQty = billingLine.qty
                element.totalReturnedQty = billingLine.totalReturnedQty
                element.discountIncludesTax = billingLine.discountIncludesTax

                if (billingLine && (!billingLine.discountPercentage || billingLine.billDiscount > 0)) {
                    element.calculateLineDiscountAmount(billingLine, afterDecimal)
                    console.log(element.discountTotal)
                }
                lineTemps.push(element)
            };
            supplierCredit.lines = lineTemps;

            supplierCredit.calculateTotal(afterDecimal);

            supplierCredit.createdAt = new Date();

            // if(billData.billingDate.getTime() < supplierCredit.supplierCreditDate.getTime())

            //     {throw new ValidationException(`Supplier Credit Date Cannot be Past Billing Date ${billData.billingDate}`) }

            //Insert Query
            const query: { text: string, values: any } = {
                text: `INSERT INTO "SupplierCredits" ("supplierCreditNumber",
                                                       "billingId",
                                                       shipping,
                                                       "employeeId",
                                                       total,
                                                       "supplierCreditDate",
                                                       "createdAt",
                                                       "branchId",
                                                       "attachment",
                                                       "isInclusiveTax",
                                                       "payableAccountId",
                                                        "roundingTotal",
                                                        "roundingType",
                                                        "smallestCurrency",
                                                        "supplierId", 
                                                
                                                        "discountTotal"

                                                       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, $16) RETURNING id`,
                values: [supplierCredit.supplierCreditNumber,
                supplierCredit.billingId,
                supplierCredit.shipping,
                supplierCredit.employeeId,
                supplierCredit.total,
                supplierCredit.supplierCreditDate,
                supplierCredit.createdAt,
                supplierCredit.branchId,
                JSON.stringify(supplierCredit.attachment),
                supplierCredit.isInclusiveTax,
                supplierCredit.payableAccountId,
                supplierCredit.roundingTotal,
                supplierCredit.roundingType,
                supplierCredit.smallestCurrency,
                supplierCredit.supplierId,

                supplierCredit.discountTotal
                ]
            }


            const insert = await client.query(query.text, query.values);
            supplierCredit.id = insert.rows[0].id;

            for (let index = 0; index < supplierCredit.lines.length; index++) {
                const element = supplierCredit.lines[index];
                if (element.qty == 0) {
                    continue;
                }
                element.createdAt = TimeHelper.getCreatedAt(supplierCredit.supplierCreditDate, company.timeOffset);
                element.supplierCreditId = supplierCredit.id;
                element.employeeId = supplierCredit.employeeId
                if (element.qty == 0) {
                    continue
                }
                element.id = await (await this.addSupplierCreditLine(client, element, supplierCredit.branchId, companyId, afterDecimal)).data.id
                /**Insert Line Batches and Serials as Lines batch.parentId = line.id */
                console.log(element.batches)


                if (element.batches && element.batches.length > 0) {

                    await this.addBatchesLines(client, supplierCredit, element, companyId, afterDecimal)
                }
                if (element.serials && element.serials.length > 0) {

                    await this.addSerialsLines(client, supplierCredit, element, companyId, afterDecimal)
                }

            }

            await client.query("COMMIT")

            return new ResponseData(true, "", { id: supplierCredit.id, billingIds: billingIds })
        } catch (error: any) {
            await client.query("ROLLBACK")
          
            console.log(error)
            throw new Error(error.where ? error.where : error.message)
        } finally {
            client.release()
        }
    }
    public static async addSupplierCreditLine(client: PoolClient, supplerCreditLine: SupplierCreditLine, branchId: string, companyId: string, afterDecimal: number) {
        try {

            /**Update Product onHand only when   account is of type  "Inventory Assets" ,  'Other Current Assets'  */
            const accountData = await AccountsRepo.getAccountType(client, supplerCreditLine.accountId)
            const accountType = accountData.type
            const accountParentType = accountData.parentType;
            if ((accountParentType == 'Other Current Assets' && accountType == "Inventory Assets") && (supplerCreditLine.productId != "" && supplerCreditLine.productId != null)) {
                await this.addSupplierCreditInventory(client, supplerCreditLine, branchId, companyId, afterDecimal)
            }

            const query: { text: string, values: any } = {
                text: `INSERT INTO "SupplierCreditLines" ("supplierCreditId",
                                                         "billingLineId",
                                                         note,
                                                         "productId",
                                                         "employeeId",
                                                         total,
                                                         "subTotal",
                                                         "taxId",
                                                         "taxPercentage",
                                                         "taxTotal",
                                                         "createdAt",
                                                         "unitCost",
                                                         qty ,             
                                                        "accountId",
                                                        "isInclusiveTax",
                                                        taxes,
                                                        "taxType",
                                                        "parentId",
                                                        "serial",
                                                        "batch",
                                                        "prodDate",
                                                        "expireDate",
                                                        "supplierCreditDiscount",
                                                        "discountAmount" ,
                                                        "discountPercentage",
                                                        "applyDiscountBeforeTax",
                                                        "discountTotal",
                                                        "baseAmount",
                                                        "taxableAmount"
                                                      
                                                         ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22, $23,$24,$25,$26, $27, $28,$29)
                                                         RETURNING id
                                                         `,
                values: [supplerCreditLine.supplierCreditId,
                supplerCreditLine.billingLineId,
                supplerCreditLine.note,
                supplerCreditLine.productId,
                supplerCreditLine.employeeId,
                supplerCreditLine.total,
                supplerCreditLine.subTotal,
                supplerCreditLine.taxId,
                supplerCreditLine.taxPercentage,
                supplerCreditLine.taxTotal,
                supplerCreditLine.createdAt,
                supplerCreditLine.unitCost,
                supplerCreditLine.qty,
                supplerCreditLine.accountId,
                supplerCreditLine.isInclusiveTax,
                JSON.stringify(supplerCreditLine.taxes),
                supplerCreditLine.taxType,
                supplerCreditLine.parentId,
                supplerCreditLine.serial,
                supplerCreditLine.batch,
                supplerCreditLine.prodDate,
                supplerCreditLine.expireDate,
                supplerCreditLine.supplierCreditDiscount,
                supplerCreditLine.discountAmount,
                supplerCreditLine.discountPercentage,
                supplerCreditLine.applyDiscountBeforeTax,
                supplerCreditLine.discountTotal,
                supplerCreditLine.baseAmount,
                supplerCreditLine.taxableAmount
                ]
            }
            const lineInsert = await client.query(query.text, query.values)
            supplerCreditLine.id = lineInsert.rows[0].id

            return new ResponseData(true, "", { id: supplerCreditLine.id })
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }


    public static async checkBillBalance(client: PoolClient, billingId: string, supplieCreditId: string, supplierCreditTotal: number) {
        try {
            const query = {
                text: `SELECT "Billings".total::text::numeric - COALESCE(sum("SupplierCredits"."total"::text::numeric),0) as "balance"
                        FROM "Billings" 
                        left join "SupplierCredits" on "SupplierCredits"."billingId" = "Billings".id 
                        and ($1::uuid is null or "SupplierCredits".id <>$1 )
                        where "Billings".id =$2
						group by "Billings".id`,
                values: [supplieCreditId, billingId]
            }

            console.log(supplieCreditId, billingId)

            let bill = await client.query(query.text, query.values);

            let total = bill.rows && bill.rows.length > 0 ? bill.rows[0].balance : 0

            if (total == 0 || (total - supplierCreditTotal < 0)) {
                throw new ValidationException("Returned Value Exceeds Billing Total")
            }

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async checkBillLineBalance(client: PoolClient, billingLineId: string, supplieCreditLineId: string, supplierCreditTotal: number) {
        try {
            const query = {
                text: `SELECT "BillingLines".total::text::numeric - COALESCE(sum("SupplierCreditLines"."total"::text::numeric),0) as "balance"
                        FROM "BillingLines" 
                        left join "SupplierCreditLines" on "SupplierCreditLines"."billingId" = "BillingLines".id 
                        and ($1::uuid is null or "SupplierCreditLines".id <>$1 )
                        where "BillingLines".id =$2
						group by "BillingLines".id`,
                values: [supplieCreditLineId, billingLineId]
            }

            let bill = await client.query(query.text, query.values);

            let total = bill.rows && bill.rows.length > 0 ? bill.rows[0].balance : 0

            if (total == 0 || (total - supplierCreditTotal < 0)) {
                throw new ValidationException("Returned Value Exceeds Billing Line Total")
            }

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async editSupplierCredit(data: any, company: Company, employeeId: string) {
        const client = await DB.excu.client();
        try {

            const companyId = company.id;

            const validate = await SupplierCreditValidation.validateSupplierCredit(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            let billingIds = data.billingId ? [data.billingId] : null
            if (!data.billingId || data.billingId == 'all') {
                data.billingId = null
                const billingLineIds = data.lines.map((l: SupplierCreditLine) => l.billingLineId);
                billingIds = await this.getBillingIdsByLines(client, billingLineIds);
            } else {
                let billData = await this.getBillingInfo(client, data.billingId)

                if (billData.status == "Draft") {
                    throw new ValidationException(" Cannot Creat Supplier Credit Out Of " + billData.status + " Bills")
                }
            }



            const isNumberExist = await this.checkIfSupplierCreditNumberExist(client, data.id, data.supplierCreditNumber, companyId)
            if (isNumberExist) {
                throw new ValidationException("Supplier Credit Number already Used")
            }

            await client.query("BEGIN")
            const afterDecimal = company.afterDecimal
            const supplierCredit = new SupplierCredit();
            supplierCredit.ParseJson(data);

            const lineTemps: SupplierCreditLine[] = [];
            for (const element of supplierCredit.lines) {
                if (!element.billingLineId) {
                    continue;
                }
                const billingLine: any = await BillingRepo.getBillLineInfoForCredit(element.billingLineId)
                element.discountTotal = billingLine.discountTotal
                element.discountAmount = billingLine.discountAmount
                element.supplierCreditDiscount = billingLine.billDiscount
                element.applyDiscountBeforeTax = billingLine.applyDiscountBeforeTax
                element.discountPercentage = billingLine.discountPercentage


                if (billingLine && (!billingLine.discountPercentage || billingLine.billDiscount > 0)) {
                    element.calculateLineDiscountAmount(billingLine, afterDecimal)
                    console.log(element.discountTotal)
                }
                lineTemps.push(element)
            };
            supplierCredit.lines = lineTemps;

            supplierCredit.calculateTotal(afterDecimal);
            // if(billData.billingDate.getTime() < supplierCredit.supplierCreditDate.getTime())

            //     {throw new ValidationException(`Supplier Credit Date Cannot be Past Billing Date ${billData.billingDate}`) }
            if (supplierCredit.billingId) {
                await this.checkBillBalance(client, supplierCredit.billingId, supplierCredit.id, supplierCredit.total)
            }

            supplierCredit.createdAt = new Date();
            //Insert Query

            let deletedLines = supplierCredit.lines.filter((f) => f.isDeleted == true)

            if (deletedLines.length == supplierCredit.lines.length) {
                throw new ValidationException("Supplier Credit must has atleast one line")
            }
            const query: { text: string, values: any } = {
                text: `UPDATE  "SupplierCredits" SET 
                                                       shipping =$1,
                                                       total =$2,
                                                       "supplierCreditDate" =$3,
                                                       "attachment"=$4, 
                                                       "isInclusiveTax" =$5,
                                                        "roundingTotal"=$6,
                                                        "roundingType"=$7,
                                                        "smallestCurrency"=$8,
                                                        "discountTotal" =$9
                                                         WHERE  id=$10`,
                values: [
                    supplierCredit.shipping,
                    supplierCredit.total,
                    supplierCredit.supplierCreditDate,
                    JSON.stringify(supplierCredit.attachment),
                    supplierCredit.isInclusiveTax,
                    supplierCredit.roundingTotal,
                    supplierCredit.roundingType,
                    supplierCredit.smallestCurrency,
                    supplierCredit.discountTotal,
                    supplierCredit.id
                ]
            }


            const insert = await client.query(query.text, query.values);


            for (let index = 0; index < supplierCredit.lines.length; index++) {
                const element = supplierCredit.lines[index];
                element.createdAt = TimeHelper.getCreatedAt(supplierCredit.supplierCreditDate, company.timeOffset);
                element.supplierCreditId = supplierCredit.id;

                if (!supplierCredit.billingId) {
                    await this.checkBillLineBalance(client, element.billingLineId, element.id, supplierCredit.total)
                }

                if (element.id == "" && element.id == null) {
                    element.employeeId = supplierCredit.employeeId
                    element.id = await (await this.addSupplierCreditLine(client, element, supplierCredit.branchId, companyId, afterDecimal)).data.id
                } else {
                    await this.editSupplierCreditLine(client, element, supplierCredit.branchId, companyId, afterDecimal)
                }

                /**Insert Line Batches and Serials as Lines batch.parentId = line.id */
                if (element.batches && element.batches.length > 0) {
                    await this.addBatchesLines(client, supplierCredit, element, companyId, afterDecimal)
                }
                if (element.serials && element.serials.length > 0) {
                    await this.addSerialsLines(client, supplierCredit, element, companyId, afterDecimal)
                }

            }

            await client.query("COMMIT")

            return new ResponseData(true, "", { id: supplierCredit.id, billingIds: billingIds })
        } catch (error: any) {
            await client.query("ROLLBACK")
          
            console.log(error)
            throw new Error(error.where ? error.where : error.message)
        } finally {
            client.release()
        }
    }

    public static async getOldLineQtyCost(client: PoolClient, lineId: string) {
        try {
            const query = {
                text: `SELECT QTY,"unitCost" from "SupplierCreditLines" where id =$1`,
                values: [lineId]
            }

            let line = await client.query(query.text, query.values);
            if (line.rows && line.rows.length > 0) {
                return {
                    qty: line.rows[0].qty,
                    unitCost: line.rows[0].unitCost
                }
            }

            return null
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async editSupplierCreditLine(client: PoolClient, supplerCreditLine: SupplierCreditLine, branchId: string, companyId: string, afterDecimal: number) {
        try {

            /**Update Product onHand only when   account is of type  "Inventory Assets" ,  'Other Current Assets'  */
            const accountData = await AccountsRepo.getAccountType(client, supplerCreditLine.accountId)
            const accountType = accountData.type
            const accountParentType = accountData.parentType;



            let lineCost = await this.getOldLineQtyCost(client, supplerCreditLine.id)
            if (lineCost) {

                console.log(supplerCreditLine.isDeleted)
                if ((accountParentType == 'Other Current Assets' && accountType == "Inventory Assets") && (supplerCreditLine.productId != "" && supplerCreditLine.productId != null) && ((supplerCreditLine.qty != lineCost.qty || supplerCreditLine.unitCost != lineCost.unitCost) || (supplerCreditLine.isDeleted))) {
                    console.log(supplerCreditLine.isDeleted)

                    supplerCreditLine.oldQty = lineCost.qty
                    supplerCreditLine.oldUnitCost = lineCost.unitCost
                    await this.updateSupplierCreditInventory(client, supplerCreditLine, branchId, companyId, afterDecimal)

                }


                if (supplerCreditLine.isDeleted) {
                    await this.deletSupplierCreditLine(client, supplerCreditLine.id)
                }
                const query: { text: string, values: any } = {
                    text: `UPDATE "SupplierCreditLines" SET 
                                                             note=$1,
                                                             total=$2,
                                                             "subTotal"=$3,
                                                             "taxId"=$4,
                                                             "taxPercentage"=$5,
                                                             "taxTotal"=$6,
                                                             "createdAt"= case when "createdAt"::date = $7::date then "createdAt" else $7 end,
                                                             "unitCost"=$8,
                                                             qty =$9,             
                                                            "isInclusiveTax"=$10,
                                                            taxes=$11,
                                                            "taxType"=$12,
                                                            "parentId"=$13,
                                                            "serial"=$14,
                                                            "batch"=$15,
                                                            "prodDate"=$16,
                                                            "expireDate"=$17, 
                                                            "supplierCreditDiscount" =$18,  
                                                            "discountAmount" =$19,
                                                            "discountPercentage"=$20,
                                                            "applyDiscountBeforeTax" =$21,
                                                            "discountTotal" =$22,
                                                            "baseAmount" =$23,
                                                            "taxableAmount" =$24
                                                             WHERE  id =$25
                                                             `,
                    values: [
                        supplerCreditLine.note,

                        supplerCreditLine.total,
                        supplerCreditLine.subTotal,
                        supplerCreditLine.taxId,
                        supplerCreditLine.taxPercentage,
                        supplerCreditLine.taxTotal,
                        supplerCreditLine.createdAt,
                        supplerCreditLine.unitCost,
                        supplerCreditLine.qty,

                        supplerCreditLine.isInclusiveTax,
                        JSON.stringify(supplerCreditLine.taxes),
                        supplerCreditLine.taxType,
                        supplerCreditLine.parentId,
                        supplerCreditLine.serial,
                        supplerCreditLine.batch,
                        supplerCreditLine.prodDate,
                        supplerCreditLine.expireDate,

                        supplerCreditLine.supplierCreditDiscount,
                        supplerCreditLine.discountAmount,
                        supplerCreditLine.discountPercentage,
                        supplerCreditLine.applyDiscountBeforeTax,
                        supplerCreditLine.discountTotal,
                        supplerCreditLine.baseAmount,
                        supplerCreditLine.taxableAmount,
                        supplerCreditLine.id
                    ]
                }
                const lineInsert = await client.query(query.text, query.values)


            }

            return new ResponseData(true, "", { id: supplerCreditLine.id })
        } catch (error: any) {
            console.log(error)

          
            throw new Error(error.message)
        }
    }

    public static async getSupplierCredits(data: any, company: Company, branchList: []) {
        try {
            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList


            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';


            let sort = data.sortBy;
            let sortValue = !sort ? ' "SupplierCredits"."createdAt"' : '"' + sort.sortValue + '"';

            if (sort && sort.sortValue == "supplierCreditNumber") {
                sortValue = ` regexp_replace("supplierCreditNumber", '[A-Za-z0-9]*[_.+=-]', '')::int`
            }
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = `  Order by ` + sortTerm;


            if (data.searchTerm != null && data.searchTerm != "") {
                searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`
            }

            let page = data.page ?? 1;
            let offset = 0
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }
            const filter = data.filter
            const fromDate = filter && filter.fromDate ? filter.fromDate : null
            const toDate = filter && filter.toDate ? filter.toDate : null
            const query = {
                text: `SELECT 
                        COUNT(*) OVER(),
                        "SupplierCredits".id,
                        "SupplierCredits"."billingId",
                        "SupplierCredits".total,
                        "SupplierCredits"."supplierCreditNumber",
                        "Billings"."billingNumber",
                        "Suppliers".name as "supplierName",
                        "SupplierCredits"."createdAt",
                        "SupplierCredits".shipping,
                        "SupplierCredits"."supplierCreditDate",
                        "SupplierCredits"."employeeId",
                        "Employees".name as "employeeName",
                        "Branches".name as "branchName",
                        "SupplierCredits"."branchId"
                FROM "SupplierCredits"
                left join "Billings"
                on  "Billings".id = "SupplierCredits"."billingId"
                left JOIN "Suppliers" 
                on COALESCE("Billings"."supplierId",    "SupplierCredits"."supplierId") =  "Suppliers".id
                INNER JOIN "Employees" 
                on "SupplierCredits"."employeeId" =  "Employees".id
                INNER JOIN "Branches"
                on "Branches".id =  "SupplierCredits"."branchId"
                where "Branches"."companyId"=$1
                AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
                and (LOWER("Suppliers".name) ~ $3
                    OR LOWER("Branches".name) ~ $3 
                    OR LOWER("SupplierCredits"."supplierCreditNumber") ~ $3 
                    OR nullif(regexp_replace("supplierCreditNumber", '[A-Z]*-', ''),'') ~ $3
                    )
                    AND ($4::Date IS NULL OR "SupplierCredits"."supplierCreditDate"::date >= $4::date)
                    AND ($5::Date IS NULL OR "SupplierCredits"."supplierCreditDate"::date <= $5::date)
                    ${orderByQuery}
                limit $6 offset $7`,
                values: [company.id, branches, searchValue, fromDate, toDate, limit, offset]
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

            return new ResponseData(true, "", resData);
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async getSupplierCreditById(supplierCreditId: string, company: Company) {
        const client = await DB.excu.client()
        try {
            await client.query('BEGIN')
            const query: { text: string, values: any } = {
                text: `with "suppplierCredit" as (
                                        SELECT
                                                                "SupplierCredits".*,
                                                                "Billings"."billingNumber",
                                                                "Suppliers".name as "supplierName",
                                                                "Suppliers".email as "supplierEmail",
                                                                "Billings"."supplierId",
                                                                CAST ("SupplierCredits"."supplierCreditDate" AS TEXT) AS "supplierCreditDate" ,
                                                                (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',COALESCE("Media"."url"->>'downloadUrl',"Media"."url"->>'defaultUrl'),'mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("SupplierCredits"."attachment") as attachments(attachments)
                                                                inner join "Media" on "Media".id = (attachments->>'id')::uuid
                                                                ) as "attachment",
                                                                "Employees".name as "employeeName",
                                                                "Branches".name as "branchName",
                                                                "Branches"."customFields" as "branchCustomFields",
                                                                "Billings".total as "billingTotal",
                                                                case when  COALESCE(NULLIF("Suppliers"."country", ''), NULL)  is not null and "Suppliers"."country" <>'${company.country}'  then true else false end as "allowBillOfEntry"
                                                        FROM "SupplierCredits"
                                                        left join "Billings" on  "Billings".id = "SupplierCredits"."billingId"
                                                        left JOIN "Suppliers" on "SupplierCredits"."supplierId" =  "Suppliers".id
                                                        left JOIN "Employees" on "SupplierCredits"."employeeId" =  "Employees".id
                                                        left JOIN "Branches" on "Branches".id =  "SupplierCredits"."branchId"
                                                        where "SupplierCredits".id =$1
                                                        AND "Branches"."companyId"=$2
                                        ),"paidAmount" as (

                                            select
                                            "suppplierCredit".id,
                                            COALESCE(sum(  "BillingPaymentLines".amount),0) as "paidAmount"
                                            from "suppplierCredit"
                                            inner join "Billings" on  "Billings".id = "suppplierCredit"."billingId"
                                            left join "BillingPaymentLines" on "BillingPaymentLines"."billingId" = "Billings".id
                                            group by  "suppplierCredit".id
                                        ),"applied" as (
                                            select
                                            "suppplierCredit".id,
                                            COALESCE(sum ( "SupplierAppliedCredits".amount),0) as "applied"
                                            from "suppplierCredit"
                                            left join "SupplierAppliedCredits" on "SupplierAppliedCredits"."supplierCreditId" = "suppplierCredit".id
                                            group by  "suppplierCredit".id
                                        ),"refund" as (
                                            select
                                            "suppplierCredit".id,
                                            COALESCE(sum (distinct "SupplierRefunds".total),0) as "refund"
                                            from "suppplierCredit"
                                            left join "SupplierRefunds" on "SupplierRefunds"."supplierCreditId" = "suppplierCredit".id
                                            group by  "suppplierCredit".id
                                        )


                                        select "suppplierCredit".*,
                                        "paidAmount". "paidAmount"  as "paidAmount",
                                            COALESCE("applied"."applied",0) +   COALESCE("refund"."refund",0) as "refundedAmount"
                                        from "suppplierCredit"
                                        left join "paidAmount" on "paidAmount".id = "suppplierCredit".id
                                        left join "applied" on "applied".id = "suppplierCredit".id
                                        left join "refund" on "refund".id = "suppplierCredit".id
                `,
                values: [supplierCreditId, company.id]
            }

            const supplierCreditData = await client.query(query.text, query.values);
            const supplierCreditTemp: any = supplierCreditData.rows[0];
            const supplierCredit = new SupplierCredit();
            supplierCredit.ParseJson(supplierCreditTemp);
            // supplierCredit.calculateRefundDue()

            supplierCredit.refundDue = await this.getRefundDue(client, supplierCredit.id, supplierCredit.billingId) ?? 0

            if (supplierCredit.id != "" && supplierCredit.id != null) {
                query.text = `SELECT
            "SupplierCreditLines".*,
            "Products".name as "productName",
            "Products".type as "productType",
            "Products"."barcode" as "barcode",
            "Billings"."billingNumber",
            "Suppliers".name as "supplierName",
            "Suppliers".id as "supplierId",
            "Taxes".name as "taxName"
            FROM "SupplierCreditLines"
            Left join "Products"
            on  "Products".id = "SupplierCreditLines"."productId"
            inner join "BillingLines" on "BillingLines"."id" = "SupplierCreditLines"."billingLineId"
            inner join "Billings" on "Billings"."id" = "BillingLines"."billingId"
            inner join "Suppliers" on "Suppliers"."id" = "Billings"."supplierId"
            left join "Taxes" on "Taxes"."id" = "SupplierCreditLines"."taxId"
            where "SupplierCreditLines"."supplierCreditId" =$1`

                query.values = [supplierCreditId]
                const lines: any = await client.query(query.text, [supplierCreditId]);

                const supplerCreditLines: any[] = [];

                let linesIds: any[] = lines.rows && lines.rows.length > 0 ? lines.rows.map((f: any) => { return f.billingLineId }) : [];
                console.log(linesIds)
                if (linesIds.length > 0) {
                    let invoiceLines = await this.getSupplierCeditNoteLinesLimits(client, linesIds, supplierCredit.id);
                    if (invoiceLines && invoiceLines.length > 0) {
                        lines.rows = lines.rows.map((f: any) => {
                            let currentLine = invoiceLines.find(item => item.id == f.billingLineId)
                            console.log(currentLine)
                            if (currentLine) {
                                f.maxQty = currentLine.maxQty == 0 ? f.qty : currentLine.maxQty + f.qty

                            }

                            return f
                        })
                    }
                }

                if (lines.rows) {
                    for (let index = 0; index < lines.rows.length; index++) {
                        const element = lines.rows[index];
                        let line = new SupplierCreditLine();
                        line.ParseJson(element)
                        line.isNew = false;

                        if (element.productId != null) {
                            const selectedItem: any = {}
                            line.productId = element.productId;
                            selectedItem.id = element.productId;
                            selectedItem.name = element.productName;
                            selectedItem.type = element.productType;
                            line.selectedItem = selectedItem
                        }

                        supplerCreditLines.push(line)
                    }
                    supplierCredit.lines = supplerCreditLines
                }

                /**
                 * Remove lines with parentid is not null and add them to the parent Line batches and serials 
                 */
                supplierCredit.lines.filter(f => f.parentId != null).forEach((element: any) => {
                    const Line = supplierCredit.lines.find(f => f.id == element.parentId);

                    if (Line != null) {
                        const index = supplierCredit.lines.indexOf(Line);
                        supplierCredit.lines[index].batches = []
                        supplierCredit.lines[index].serials = []
                        if (Line.productType == "batch") {
                            supplierCredit.lines[index].batches.push(element)
                        } else if (Line.productType == "serialized") {
                            supplierCredit.lines[index].serials.push(element)
                        }
                        supplierCredit.lines.splice(supplierCredit.lines.indexOf(element), 1);
                    }

                });
            }
            await client.query('COMMIT')
            supplierCredit.setData()
            // supplierCredit.setDiscountTotal()
            // supplierCredit.calculateTotal(company.afterDe)
            return new ResponseData(true, "", supplierCredit);
        } catch (error: any) {
            await client.query('ROLLBACK')

          
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }


    /** Will Retrun Bill  with its allowed qty to be returned maxQty billingLineQty - sum(all returned qty) */
    public static async getBillingForSupplierCredit(data: any, company: Company) {
        const client = await DB.excu.client();

        try {


            await client.query("BEGIN")

            const supplierCreditId = data.supplierCreditId;

            const billingId = data.billingId

            if (billingId == 'all') {
                throw new ValidationException("Billing Id Is Require")
            }
            const query: { text: string, values: any } = {
                text: `SELECT
                            "Billings".id, 
                            "Billings"."mediaId", 
                            "Media"."url"->>'defaultUrl' as "mediaUrl",
                            "Billings"."createdAt",
                            "Billings"."dueDate",
                            "Billings"."billingNumber",
                            "Billings".reference,
                            "Billings"."branchId",
                            "Billings".total,
                            "Billings".status,
                            "Billings"."billingDate",
                            "Billings"."discountTotal",
                            "Billings"."discountPercentage",
                            "Billings"."employeeId",
                            "Branches".name AS "branchName",
                            "Suppliers".name AS "supplierName",
                            "Billings"."supplierId",
                            "Billings"."isInclusiveTax",
                            "Billings"."applyDiscountBeforeTax",
                            "Billings"."discountIncludesTax",
                            COALESCE(sum(Distinct "BillingPaymentLines".amount),0) as "paidAmount",
                            COALESCE(sum(Distinct "SupplierAppliedCredits".amount),0)as "appliedCredit",
                            COALESCE(sum(Distinct"SupplierCredits".total),0)as "refunded"
                    FROM "Billings"
                    INNER JOIN "Branches"
                    ON "Branches".id = "Billings"."branchId"
                    INNER JOIN "Suppliers"
                    ON "Suppliers".id = "Billings"."supplierId"
                    LEFT JOIN "SupplierCredits" 
                    ON "SupplierCredits"."billingId" = "Billings".id 
                    LEFT JOIN "Media" 
                    ON "Media".id = "Billings"."mediaId" 
                    LEFT JOIN "BillingPaymentLines" 
                    ON "BillingPaymentLines"."billingId" = "Billings".id 
                    LEFT JOIN "SupplierAppliedCredits" 
                    ON "SupplierAppliedCredits"."billingId" = "Billings".id 
                    WHERE "Billings".id=$1
                    group by "Billings".id,"Suppliers".id ,"Branches".id,"Media".id `,
                values: [billingId]
            }
            const billingData = await client.query(query.text, query.values)
            const billing: any = billingData.rows[0];
            const bill = new Billing();
            bill.ParseJson(billing);
            bill.setBalance()


            query.text = `with "lines" as (SELECT
                            "BillingLines".id,
                            "BillingLines". qty,
                            "BillingLines".qty -   COALESCE(sum("SupplierCreditLines".qty),0) as "maxQty",
                            "BillingLines"."unitCost",
                            "BillingLines"."productId",
                            "BillingLines".barcode,
                            "BillingLines". "accountId",
                            "Accounts".name AS "accountName",
                            "BillingLines".note,
                            "BillingLines"."taxId",
                            "BillingLines"."employeeId",
                            "BillingLines"."taxPercentage",
                            "BillingLines".taxes,
                            "BillingLines"."taxType",
                            "BillingLines"."taxTotal",
                            "BillingLines"."subTotal",
                            "BillingLines"."batch",
                            "BillingLines"."serial",
                            "BillingLines"."total",
                            "BillingLines"."qty" as "billingQty",
                            "BillingLines"."isInclusiveTax",
                            "BillingLines"."parentId",
                            "BillingLines"."discountPercentage",
                            "BillingLines"."discountAmount",
                            "BillingLines"."discountTotal",
                            "BillingLines"."billDiscount" ,
                                 "BillingLines"."discountIncludesTax",
                            "Taxes".name AS "taxName",
                            "Products".name AS "productName",
                            "Products".type AS "productType",
                            "ProductBatches"."prodDate",
                            "ProductBatches"."expireDate"
                    FROM "BillingLines"
                    LEFT JOIN "Products"
                    ON "Products".id = "BillingLines"."productId"
                    INNER JOIN "Accounts" 
                    ON "Accounts".id = "BillingLines"."accountId"
                    INNER JOIN "Billings"
                    ON "Billings".id = "BillingLines"."billingId"
                     LEFT JOIN "Taxes"
                    ON "Taxes".id = "BillingLines"."taxId"
                    LEFT JOIN "SupplierCreditLines" 
                    ON "SupplierCreditLines"."billingLineId" = "BillingLines".id  and (( "Products".id is null) or ( "Products"."type"='inventory') or ("Products"."type"='batch' and  "SupplierCreditLines"."parentId" is not null) or ("Products"."type"='serialized' and  "SupplierCreditLines"."parentId" is not null) )
                    LEFT JOIN "BranchProducts" ON  "BranchProducts"."branchId" = "Billings"."branchId" and "BranchProducts"."productId" = "Products".id 
                    LEFT JOIN "ProductBatches" ON "ProductBatches"."batch" = "BillingLines"."batch" AND "ProductBatches"."branchProductId"  = "BranchProducts".id
                    WHERE "Billings".id=$1
                    group by   "BillingLines"."discountIncludesTax","BillingLines"."discountAmount", "BillingLines"."discountTotal",  "BillingLines"."qty",         "BillingLines"."discountPercentage","BillingLines"."billDiscount", "BillingLines".id,"Accounts".id, "Products".id,  "ProductBatches"."prodDate", "ProductBatches"."expireDate","Taxes".id
         )
		 
		 select "lines".* from "lines"
		 		left join "SupplierCreditLines" on "SupplierCreditLines"."billingLineId" = "lines".id 
			where    "lines"."qty" <> 0
		  and ($2::uuid is null or "SupplierCreditLines"."supplierCreditId" <> $2 or "SupplierCreditLines"."supplierCreditId" is null )
           group by  "lines".id ,
		             "lines".qty,
					 "lines"."maxQty",
					 "lines"."unitCost",
					 "lines"."productId" ,
                     "lines"."billDiscount",
					 "lines"."barcode",
					 "lines"."accountId",
					 "lines"."accountName",
					 "lines".note,
		             "lines"."taxId",
					 "lines"."employeeId",
					 "lines"."taxPercentage",
					 "lines"."taxes",
					 "lines"."taxType",
					 "lines"."taxTotal",
					 "lines"."subTotal",
					 "lines"."batch",
					 "lines"."serial",
					 "lines"."total",
					 "lines"."isInclusiveTax",
					 "lines"."parentId",
					 "lines"."productName",
					 "lines"."productType",	
					  "lines"."prodDate",
					  "lines"."taxName",
					  "lines"."expireDate",
					  "lines"."billingQty",
                      "lines"."discountPercentage",
                      "lines"."discountTotal",
                      "lines"."discountIncludesTax",
                      "lines"."discountAmount"
                    `;

            query.values = [billingId, supplierCreditId]


            if (bill) {
                const line: any = await client.query(query.text, query.values)
                if (line.rows) {
                    for (let index = 0; index < line.rows.length; index++) {
                        const element = line.rows[index];
                        let billingLine = new BillingLine();
                        billingLine.ParseJson(element)
                        if (element.productId != null) {
                            const selectedItem: any = {}
                            selectedItem.id = element.productId;
                            selectedItem.name = element.productName;
                            selectedItem.type = element.productType;
                            billingLine.selectedItem = selectedItem
                        }

                        bill.lines.push(billingLine)
                    }
                }
            }
            // bill.calculateTotal(company.afterDecimal);
            bill.lines.filter(f => f.parentId != null).forEach((element: any) => {
                const Line = bill.lines.find(f => f.id == element.parentId);

                if (Line != null) {
                    const index = bill.lines.indexOf(Line);
                    if (Line.productType == "batch") {
                        bill.lines[index].batches.push(element)
                    } else if (Line.productType == "serialized") {
                        bill.lines[index].serials.push(element)
                    }
                    bill.lines.splice(bill.lines.indexOf(element), 1);
                }

            });

            bill.lines = bill.lines.map(f => {
                if (f.batches.length > 0) {
                    f.maxQty = f.batches.reduce((sum, item) => sum + item.maxQty, 0)
                }
                return f
            })

            await client.query("COMMIT")
            return new ResponseData(true, "", bill)
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
          
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }
    public static async getSupplierCreditNumber(branchId: string, company: Company) {
        try {
            const companyId = company.id;
            let prefixSettings = await TransactionManagements.getPrefix('SupplierCredit', company.id)
            let prefix = prefixSettings.prefix
            let width = prefixSettings.width

            const query: { text: string, values: any[] } = {
                text: `  SELECT "supplierCreditNumber"
                    FROM "SupplierCredits"
                                INNER JOIN "Branches"
                                 ON "Branches".id = "SupplierCredits"."branchId"
                                 Where "Branches"."companyId" = $1
                              AND "supplierCreditNumber" LIKE $2
                              AND SUBSTRING("supplierCreditNumber" FROM LENGTH($3)+1) ~ '^[0-9]+$'  -- only numeric suffixes
                            ORDER BY 
                              CAST(SUBSTRING("supplierCreditNumber" FROM LENGTH($3)+1) AS INT) DESC
                            LIMIT 1`,
                values: [companyId, `${prefix}%`, prefix]
            };

            const data = await DB.excu.query(query.text, query.values);
            const lastNumber = data.rows && data.rows.length > 0 ? data.rows[0].supplierCreditNumber : null;
            let newNumber = TransactionManagements.getNumber(prefix, lastNumber, width)

            return new ResponseData(true, "", { supplierCreditNumber: newNumber })
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async getSupplierCreditJournals(supplierCreditId: string, company: Company) {
        try {
            const afterDecimal = company.afterDecimal

            const defaultJournals = await JournalRepo.getJournal(supplierCreditId, company)
            const journals: any[] = [];
            const query: { text: string, values: any } = {
                text: ` 
        SELECT 
                case when sum("JournalRecords".amount) > 0 then ROUND( sum("JournalRecords".amount::NUMERIC ),$2)end  as debit,
                case when sum("JournalRecords".amount) < 0 then ROUND(ABS(sum("JournalRecords".amount::NUMERIC)),$2)end   as credit,
                name as "accountType",
                "Billings"."billingNumber",
                "JournalRecords"."referenceId",
                "JournalRecords"."createdAt",
                'Refund' as reference
        FROM "JournalRecords"
        LEFT JOIN  "SupplierRefunds" on "SupplierRefunds".id = "JournalRecords"."referenceId"
        LEFT JOIN "SupplierCredits" on "SupplierCredits".id = "SupplierRefunds"."supplierCreditId"	
        LEFT JOIN "Billings" on "Billings".id = "SupplierCredits"."billingId"
        where "SupplierCredits".id  =$1
        group by  "JournalRecords"."accountId" ,  "JournalRecords".name ,"referenceId","JournalRecords"."createdAt","Billings".id
        
        UNION 

SELECT 
        case when sum("JournalRecords".amount) > 0 then ROUND( sum("JournalRecords".amount::NUMERIC ),$2)end  as debit,
        case when sum("JournalRecords".amount) < 0 then ROUND(ABS(sum("JournalRecords".amount::NUMERIC)),$2)end   as credit,
        name as "accountType",
        "Billings"."billingNumber",
        "JournalRecords"."referenceId",
        "JournalRecords"."createdAt",
        'Applied Credits' as reference
FROM "JournalRecords"
LEFT JOIN  "SupplierAppliedCredits" on "SupplierAppliedCredits".id = "JournalRecords"."referenceId"
LEFT JOIN "SupplierCredits" on "SupplierCredits".id = "SupplierAppliedCredits"."supplierCreditId"	
LEFT JOIN "Billings" on "Billings".id = "SupplierAppliedCredits"."billingId"
where "SupplierCredits".id  =$1
group by  "JournalRecords"."accountId" ,  "JournalRecords".name ,"referenceId","JournalRecords"."createdAt","Billings".id
        `,
                values: [supplierCreditId, afterDecimal]
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
                        reference: element.reference,
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



    /** Add Serials and Batches As Lines */
    public static async addSerialsLines(client: PoolClient, supplierCredit: SupplierCredit, parentLine: SupplierCreditLine, companyId: string, afterDecimal: number) {
        try {

            let serials = parentLine.serials.filter(f => f.return == true);
            for (let index = 0; index < serials.length; index++) {

                const serial = serials[index];

                let tempLine = new SupplierCreditLine();
                tempLine.ParseJson(serial)
                tempLine.qty = 1;
                tempLine.unitCost = serial.unitCost;
                tempLine.parentId = parentLine.id;
                tempLine.supplierCreditId = parentLine.supplierCreditId;
                tempLine.accountId = parentLine.accountId;
                tempLine.employeeId = parentLine.employeeId;
                tempLine.productId = parentLine.productId
                tempLine.serial = serial.serial;
                tempLine.billingLineId = serial.id;
                tempLine.createdAt = parentLine.createdAt;

                tempLine.isDeleted = parentLine.isDeleted == true ? parentLine.isDeleted : serial.isDeleted
                const isLineExist = await this.checkIfLineIdExist(client, tempLine.id)
                if (!isLineExist) {
                    await this.addSupplierCreditLine(client, tempLine, supplierCredit.branchId, companyId, afterDecimal)

                } else {
                    console.log("hereeeeeeeeeeeeeeeeeeeeee")
                    await this.editSupplierCreditLine(client, tempLine, supplierCredit.branchId, companyId, afterDecimal)
                }

            }
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async checkIfLineIdExist(client: PoolClient, id: string) {
        try {
            const query = {
                text: `select count(*) from "SupplierCreditLines" where id = $1`,
                values: [id]
            }

            let lines = await client.query(query.text, query.values);

            let counts = lines && lines.rows.length > 0 ? lines.rows[0].count : 0

            if (counts > 0) {
                return true
            }
            return false
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async addBatchesLines(client: PoolClient, supplierCredit: SupplierCredit, parentLine: SupplierCreditLine, companyId: string, afterDecimal: number) {
        try {

            let batches = parentLine.batches.filter(f => f.return == true);
            for (let index = 0; index < batches.length; index++) {

                const batch = batches[index];


                let tempLine = new SupplierCreditLine();
                tempLine.ParseJson(batch)

                tempLine.parentId = parentLine.id;
                tempLine.supplierCreditId = parentLine.supplierCreditId;
                tempLine.accountId = parentLine.accountId;
                tempLine.employeeId = parentLine.employeeId;
                tempLine.productId = parentLine.productId
                tempLine.billingLineId = batch.id;
                tempLine.createdAt = parentLine.createdAt;

                tempLine.isDeleted = parentLine.isDeleted == true ? parentLine.isDeleted : batch.isDeleted

                const isLineExist = await this.checkIfLineIdExist(client, batch.id)

                if (!isLineExist) {
                    console.log("hereeeeeeee")
                    await this.addSupplierCreditLine(client, tempLine, supplierCredit.branchId, companyId, afterDecimal)

                } else {
                    console.log("hereeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
                    await this.editSupplierCreditLine(client, tempLine, supplierCredit.branchId, companyId, afterDecimal)
                }
            }
        } catch (error: any) {
          
            console.log(error)
            throw new Error(error)
        }
    }


    /**Update Product On Hand only when the selected account is inventory Assets  */
    public static async addSupplierCreditInventory(client: PoolClient, supplerCreditLine: SupplierCreditLine, branchId: string, companyId: string, afterDecimal: number) {
        try {
            const productType = await ProductRepo.getProductType(client, supplerCreditLine.productId)
            let productId = supplerCreditLine.productId;

            switch (productType) {
                case 'inventory':
                    //Calculate and set Product Avergae unitCost and onHand

                    // await SupplierCreditMovmentRepo.insertInventorySupplierCredit(client, supplerCreditLine, branchId, afterDecimal)


                    break;
                case 'batch':
                    if ((supplerCreditLine.parentId == null || supplerCreditLine.parentId == "") && (supplerCreditLine.batches.length == 0 || supplerCreditLine.batches == null)) {

                        throw new ValidationException("Batches are Require")
                    }

                    if (supplerCreditLine.parentId != null && supplerCreditLine.productId != "") {
                        if (supplerCreditLine.batch == "" || supplerCreditLine.batch == null) {
                            throw new ValidationException("Batch Is Require")
                        }
                        await SupplierCreditMovmentRepo.addBatchInventory(client, supplerCreditLine, branchId, companyId, afterDecimal)

                    }
                    break;
                case 'serialized':
                    if ((supplerCreditLine.parentId == null || supplerCreditLine.parentId == "") && (supplerCreditLine.serials.length == 0 || supplerCreditLine.serials == null)) {
                        throw new ValidationException("Serials are Require")
                    }

                    if (supplerCreditLine.parentId != null && supplerCreditLine.productId != "") {
                        if (supplerCreditLine.serial == "" || supplerCreditLine.serial == null) {
                            throw new ValidationException("Serial Is Require")
                        }
                        await SupplierCreditMovmentRepo.addSerialInventory(client, supplerCreditLine, branchId, companyId, afterDecimal)
                    }
                    break;
                default:
                    break;
            }
        } catch (error: any) {
          

            throw new Error(error)
        }
    }


    public static async updateSupplierCreditInventory(client: PoolClient, supplerCreditLine: SupplierCreditLine, branchId: string, companyId: string, afterDecimal: number) {
        try {
            const productType = await ProductRepo.getProductType(client, supplerCreditLine.productId)
            let productId = supplerCreditLine.productId;
            const currentLineQty = supplerCreditLine.qty;
            switch (productType) {
                case 'inventory':
                    //Calculate and set Product Avergae unitCost and onHand

                    // if (supplerCreditLine.oldQty - supplerCreditLine.qty > 0 || (supplerCreditLine.isDeleted)) /** increasing   onHand */ {

                    //     const qty = supplerCreditLine.isDeleted ? supplerCreditLine.qty : supplerCreditLine.oldQty - supplerCreditLine.qty   /** so only the difference refelcte on onHand */

                    //     await ProductRepo.calculateUnitCostAvg(client, productId, branchId, qty, supplerCreditLine.unitCost, afterDecimal)
                    // } else if (supplerCreditLine.oldQty - supplerCreditLine.qty < 0 || (supplerCreditLine.qty == supplerCreditLine.unitCost && supplerCreditLine.unitCost == supplerCreditLine.oldUnitCost))/** decreasing   onHand */ {

                    //     if (supplerCreditLine.oldQty - supplerCreditLine.qty != 0) {
                    //         supplerCreditLine.qty = Math.abs(Helper.sub(supplerCreditLine.oldQty, supplerCreditLine.qty, afterDecimal))
                    //     }

                    //     await SupplierCreditMovmentRepo.insertInventorySupplierCredit(client, supplerCreditLine, branchId, afterDecimal)
                    // }

                    break;
                case 'batch':
                    if (supplerCreditLine.parentId != null && supplerCreditLine.productId != "") {

                        if (supplerCreditLine.oldQty - supplerCreditLine.qty > 0 || (supplerCreditLine.isDeleted)) /** increasing   onHand */ {
                            supplerCreditLine.qty = (supplerCreditLine.isDeleted ? supplerCreditLine.qty : supplerCreditLine.oldQty - supplerCreditLine.qty) * -1 /** so only the difference refelcte on onHand */

                        } else if (supplerCreditLine.oldQty - supplerCreditLine.qty < 0)/** decreasing   onHand */ {
                            if (supplerCreditLine.oldQty - supplerCreditLine.qty != 0) {
                                supplerCreditLine.qty = Math.abs(Helper.sub(supplerCreditLine.qty, supplerCreditLine.oldQty, afterDecimal))
                            }
                        }
                        await SupplierCreditMovmentRepo.addBatchInventory(client, supplerCreditLine, branchId, companyId, afterDecimal)

                    }
                    break;
                case 'serialized':
                    if (supplerCreditLine.parentId != null && supplerCreditLine.productId != "") {

                        console.log("isDeleteeed", supplerCreditLine.isDeleted)
                        if (supplerCreditLine.isDeleted) {
                            supplerCreditLine.qty = -1
                        }
                        await SupplierCreditMovmentRepo.addSerialInventory(client, supplerCreditLine, branchId, companyId, afterDecimal)
                    }
                    break;
                default:
                    break;
            }

            supplerCreditLine.qty = currentLineQty;

        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async sendEmail(data: any, company: Company) {
        try {

            let pdfGenerator = new PDFGenerator()
            data.type = "supplierCreditNote";
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
            data.type = "supplierCreditNote";
            let pdfBuffer = await pdfGenerator.getPdf(data);
            return pdfBuffer
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }


    public static async getCreditNoteBillingId(client: PoolClient, crediteNoteId: string) {
        try {
            const query = {
                text: `SELECT "billingId" from "SupplierCredits" where id =$1`,
                values: [crediteNoteId]
            }

            let billing = await client.query(query.text, query.values);
            return billing.rows && billing.rows.length > 0 && (<any>billing.rows[0]).billingId ? (<any>billing.rows[0]).billingId : null

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getRefundDue(client: PoolClient, supplierCreditId: string, billingId: string | null) {
        try {
            if (billingId == null) {
                billingId = await this.getCreditNoteBillingId(client, supplierCreditId)
            }
            const query = {
                text: `with "supplier" as(
                        select "supplierId" from "Billings" where id = $1
                        ),"supplierBillings" as(
                        select "Billings".id , "Billings"."billingNumber", "Billings"."total"  from "supplier" 
                            inner join "Billings" on "Billings"."supplierId" = "supplier"."supplierId"
                            group by  "Billings".id
                        ), "payments" as(
                        select  "supplierBillings".id , sum("BillingPaymentLines"."amount")as "total" from "supplierBillings"
                        inner JOIN "BillingPaymentLines" ON "BillingPaymentLines"."billingId" = "supplierBillings".id 
                            group by "supplierBillings".id
                        ) 
						
						,"appliedCredits" as(
                        select  "supplierBillings".id , sum("SupplierAppliedCredits"."amount")as "total" from "supplierBillings"
                        inner JOIN "SupplierAppliedCredits" ON "SupplierAppliedCredits"."billingId" = "supplierBillings".id 
                        group by "supplierBillings".id
                        ) ,"creditNoteTotal" as (
                       select "supplierBillings".id, sum("SupplierCreditLines"."total") as "total" from "supplierBillings" 
                        inner join "BillingLines" on "BillingLines"."billingId" = "supplierBillings".id
                        inner join "SupplierCreditLines" ON "SupplierCreditLines"."billingLineId" = "BillingLines".id 
                        inner join "SupplierCredits" ON "SupplierCreditLines"."supplierCreditId" = "SupplierCredits".id 
                        group by "supplierBillings".id
						) ,"billings" as(
                        select "supplierBillings".id,
                            abs(case when "supplierBillings"."total" - (COALESCE("payments"."total",0) + COALESCE("appliedCredits"."total",0) +   COALESCE("creditNoteTotal"."total",0)) = 0 then COALESCE("payments"."total",0) + COALESCE("appliedCredits"."total",0) else   "supplierBillings"."total" - (COALESCE("payments"."total",0) + COALESCE("appliedCredits"."total",0) +  COALESCE("creditNoteTotal"."total",0)) end) as "totalPaid"
                            from "supplierBillings"
                        left join "payments" on "payments".id = "supplierBillings".id 
                        left join "appliedCredits" on "appliedCredits".id = "supplierBillings".id 
						        left join "creditNoteTotal" on "creditNoteTotal".id = "supplierBillings".id
                        WHERE 
                            COALESCE("payments"."total", 0) > 0 
                            OR COALESCE("appliedCredits"."total", 0) > 0
                        ) , "supplierCredits" as (

                        select "totalPaid","SupplierCreditLines".id, "SupplierCredits"."supplierCreditNumber", "SupplierCreditLines"."supplierCreditId", "SupplierCreditLines"."total", sum("SupplierCreditLines"."total") over(partition by  "billings".id order by  "SupplierCreditLines"."createdAt" DESC ) AS "cumulativeTotal" from "billings" 
                        inner join "BillingLines" on "BillingLines"."billingId" = "billings".id
                        inner join "SupplierCreditLines" ON "SupplierCreditLines"."billingLineId" = "BillingLines".id 
                        inner join "SupplierCredits" ON "SupplierCreditLines"."supplierCreditId" = "SupplierCredits".id 
                        ) , "supplierCreditsBalance" as(

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
                        ), "refunds" as (
                        select "supplierCreditId", sum("SupplierRefunds".total) as "total" from "SupplierRefunds"
                        where "SupplierRefunds"."supplierCreditId" =$2
                        group by "supplierCreditId"
                        )

                        select "supplierCreditsBalanceTotal".id,
                            "supplierCreditsBalanceTotal"."supplierCreditNumber" as "code", 
                                "supplierCreditsBalanceTotal"."total" - COALESCE(sum("SupplierAppliedCredits".amount),0) - COALESCE("refunds"."total",0) as "credit",
                                'SupplierCredit' as "reference"
                        from "supplierCreditsBalanceTotal"
                        left join "SupplierAppliedCredits" ON "SupplierAppliedCredits"."supplierCreditId"  = "supplierCreditsBalanceTotal".id
                        left join "refunds" ON "refunds"."supplierCreditId"  = "supplierCreditsBalanceTotal".id
                        where   "supplierCreditsBalanceTotal".id =$2
                        group by "supplierCreditsBalanceTotal".id,
                            "supplierCreditsBalanceTotal"."supplierCreditNumber","refunds"."total",
                                "supplierCreditsBalanceTotal"."total"`,
                values: [billingId, supplierCreditId]
            }

            console.log(query.values)
            let supplieCredits = await client.query(query.text, query.values);

            if (supplieCredits && supplieCredits.rows && supplieCredits.rows.length > 0 && (<any>supplieCredits.rows[0]).credit > 0) {
                return (<any>supplieCredits.rows[0]).credit
            }
            return 0
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getFullSupplierCreditLines(client: PoolClient, supplierCreditId: string, companyId: string) {

        try {
            const query = {
                text: `SELECT "Billings"."branchId", "SupplierCredits"."supplierCreditNumber" 
                    FROM "SupplierCredits" 
                      inner join "Billings" on "Billings".id =  "SupplierCredits"."billingId"
                      where "SupplierCredits"."id" = $1
                       
                      `,
                values: [supplierCreditId]
            }
            let supplierCredit = await client.query(query.text, query.values);
            if (supplierCredit && supplierCredit.rows && supplierCredit.rows.length > 0) {

                let branchId = supplierCredit.rows[0].branchId
                let supplierCreditNumber = supplierCredit.rows[0].supplierCreditNumber ? supplierCredit.rows[0].supplierCreditNumber : null
                query.text = `SELECT 
                "SupplierCreditLines".id,
                "SupplierCreditLines"."billingLineId",
                "SupplierCreditLines"."supplierCreditId",
                "SupplierCreditLines"."note",
                "SupplierCreditLines"."productId" ,
                "SupplierCreditLines".total,
                "SupplierCreditLines"."taxId",
                "SupplierCreditLines"."taxTotal",
                "SupplierCreditLines"."taxPercentage",
                "SupplierCreditLines"."unitCost",
                "SupplierCreditLines".qty,
                "SupplierCreditLines"."accountId",
                "Products".name as "productName",
                "SupplierCreditLines"."isInclusiveTax",
                "SupplierCreditLines".taxes,
                "SupplierCreditLines"."taxType",
                "Products".type as "productType",
                "SupplierCreditLines"."parentId" ,
                "SupplierCreditLines"."serial" ,
                "SupplierCreditLines"."batch" ,
                         "SupplierCreditLines"."prodDate" ,
                "SupplierCreditLines"."expireDate" 
                FROM "SupplierCreditLines"
                inner join "Products"
                on  "Products".id = "SupplierCreditLines"."productId"
                where "SupplierCreditLines"."supplierCreditId" =$1`,
                    query.values = [supplierCreditId]


                let supplerCreditLines = await client.query(query.text, query.values);
                let lines: SupplierCreditLine[] = []
                if (supplerCreditLines && supplerCreditLines.rows) {
                    lines = supplerCreditLines.rows

                }
                return { branchId: branchId, lines: lines, supplierCreditNumber:supplierCreditNumber}
            }

            return null

        } catch (error: any) {

          
            throw new Error(error.message)
        }
    }


    public static async deleteSupplierCredit(supplierCreditId: string, company: Company, employeeId: string) {
        const client = await DB.excu.client();
        try {
            let linesIds: any[] = []
            let branchId;
            let supplierCreditNumber;

            await client.query("BEGIN")

            let getEmployeeName = {
                text: `SELECT "Employees"."name" as "employeeName"
                       FROM "SupplierCredits"
                        INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2
                       where "SupplierCredits".id = $1
                        `,
                values: [supplierCreditId, employeeId, company.id]
            }

            let employeeNameResult = await client.query(getEmployeeName.text, getEmployeeName.values);
            let employeeName = employeeNameResult.rows && employeeNameResult.rows.length > 0 && employeeNameResult.rows[0].employeeName ? employeeNameResult.rows[0].employeeName : ''

            
            let supplierCreditData = await this.getFullSupplierCreditLines(client, supplierCreditId, company.id)
            let billingLineIds;
            let billingIds;
            if (supplierCreditData) {
                branchId = supplierCreditData.branchId;
                supplierCreditNumber = supplierCreditData.supplierCreditNumber;
                const lines = supplierCreditData.lines

                if (lines.length > 0) {
                    for (let index = 0; index < lines.length; index++) {
                        const element = lines[index];
                        linesIds.push(element.id)
                        switch (element.productType) {
                            case 'inventory':
                                await ProductRepo.calculateUnitCostAvg(client, element.productId, branchId, element.qty, element.unitCost, company.afterDecimal)
                                break;
                            case 'batch':
                                if (element.parentId != null) {
                                    element.qty = element.qty * (-1) /** (-1) because in the bellow function it will be  currentonHand - (-qty)  */
                                    await SupplierCreditMovmentRepo.addBatchInventory(client, element, branchId, company.id, company.afterDecimal)
                                }
                                break;

                            case 'serialized':
                                if (element.parentId != null) {
                                    element.qty = element.qty * (-1)
                                    await SupplierCreditMovmentRepo.addSerialInventory(client, element, branchId, company.id, company.afterDecimal)
                                }
                                break;
                            default:
                                break;
                        }
                    }
                }
                billingLineIds = lines.map(f => f.billingLineId).filter(f => f != null && f != "")
                console.log(">>billingLineIds: ", billingLineIds)
                billingIds = await this.getBillingIdsByLines(client, billingLineIds)
                console.log(">>billingIds: ", billingIds)
            }


            const query = {
                text: `DELETE FROM "SupplierCreditLines" where "supplierCreditId" =$1`,
                values: [supplierCreditId]
            }

            await client.query(query.text, query.values);
            query.text = `DELETE FROM "SupplierCredits" where id = $1`;
            await client.query(query.text, query.values);

            //add logs
            let log = new Log();
            log.employeeId = employeeId
            log.action = 'Supplier Credit Deleted'
            log.comment = `${employeeName} has deleted supplier credit number ${supplierCreditNumber}`
            log.metaData = {"deleted": true}

            await LogsManagmentRepo.manageLogs(client, "SupplierCredits", supplierCreditId, [log], branchId, company.id,employeeId, supplierCreditNumber,"Cloud")


            await client.query("COMMIT")
            return new ResponseData(true, "", { linesIds: linesIds, billingIds: billingIds })

        } catch (error: any) {
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async deletSupplierCreditLine(client: PoolClient, id: string) {
        try {
            await client.query('DELETE FROM "SupplierCreditLines" where id =$1', [id])
        } catch (error: any) {
            throw new Error(error)
        }
    }

    // public static async getRefundDueList(client:PoolClient,supplierCreditIds: string[], billingIds: string[]) {
    //     try {

    //         const query = {
    //             text: `WITH "bills" AS (
    //                     SELECT "Billings".id,
    //                         "Billings"."total"::text::numeric - SUM("BillingPaymentLines"."amount"::text::numeric) AS "total"
    //                     FROM "Billings" 
    //                     INNER JOIN "BillingPaymentLines" ON "BillingPaymentLines"."billingId" = "Billings".id
    //                     WHERE "Billings"."id" = any($1::uuid[])
    //                     GROUP BY "Billings".id
    //                     HAVING "Billings"."total"::text::numeric - SUM("BillingPaymentLines"."amount"::text::numeric) <> "Billings"."total"::text::numeric
    //                 ), "billingBalance" AS (
    //                     SELECT "bills".id,
    //                         ABS("bills"."total"::text::numeric - SUM("SupplierCredits"."total"::text::numeric)) AS "total"
    //                     FROM "bills" 
    //                     INNER JOIN "SupplierCredits" ON "bills".id = "SupplierCredits"."billingId"
    //                     GROUP BY "bills".id, "bills"."total"
    //                 ), "supplieCredits" AS (
    //                     SELECT  
    //                         "SupplierCredits".id,
    //                         "SupplierCredits"."supplierCreditNumber" as "code",
    //                             'SupplierCredit' as "reference",
    //                         CASE 
    //                             WHEN ("SupplierCredits"."total" - SUM(
    //                                 CASE 
    //                                     WHEN "SupplierCredits"."total" >= "billingBalance"."total" THEN "billingBalance"."total"
    //                                     WHEN "SupplierCredits"."total" < "billingBalance"."total" THEN "SupplierCredits"."total"  
    //                                 END
    //                             ) OVER (ORDER BY "SupplierCredits"."createdAt" DESC) = 0) THEN 
    //                                 (CASE 
    //                                     WHEN "SupplierCredits"."total" >= "billingBalance"."total" THEN "billingBalance"."total"
    //                                     WHEN "SupplierCredits"."total" < "billingBalance"."total" THEN "SupplierCredits"."total" 
    //                                 END) 
    //                             ELSE 
    //                                 "billingBalance"."total" - SUM(case when   "SupplierCredits"."total" >=  "billingBalance"."total" then  "billingBalance"."total"
    //                         when  "SupplierCredits"."total" <  "billingBalance"."total" then     "SupplierCredits"."total"  end) OVER (ORDER BY "SupplierCredits"."createdAt" DESC ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) 
    //                         END AS "credit"
    //                     FROM "SupplierCredits" 
    //                     INNER JOIN "billingBalance" ON "billingBalance".id = "SupplierCredits"."billingId"
    //                     ORDER BY "SupplierCredits"."createdAt" DESC
    //                 ),
    // 				"appliedCredits" as (
    //                     select"supplieCredits".id , sum("SupplierAppliedCredits"."amount"::text::numeric)  as "total" from "SupplierAppliedCredits" 
    //                     inner join  "supplieCredits" on "supplieCredits".id = "SupplierAppliedCredits"."supplierCreditId"
    //                     group by "supplieCredits".id 
    //                     ),"refunds" as (
    //                     select  "supplieCredits".id , sum("SupplierRefunds"."total"::text::numeric) as "total" from "SupplierRefunds" 
    //                     inner join  "supplieCredits" on "supplieCredits".id = "SupplierRefunds"."supplierCreditId"
    //                     group by "supplieCredits".id 
    //                     ),"creditNoteSummary" as (
    //                     select  "supplieCredits"."id",
    //                         "supplieCredits"."code",
    //                         "supplieCredits"."reference",
    //                         "supplieCredits"."credit"::text::numeric - (COALESCE("appliedCredits"."total",0) + COALESCE("refunds"."total",0)) as "credit"
    //                         from "supplieCredits"
    //                     left join "appliedCredits" on "appliedCredits".id =  "supplieCredits".id
    //                     left join "refunds" on "refunds".id =  "supplieCredits".id
    //                                         )

    // 										select * from "creditNoteSummary" where id = any($2::uuid[])
    //                                         and "credit" > 0 `,
    //             values: [billingIds, supplierCreditIds]
    //         }

    //         let supplieCredits = await client.query(query.text,query.values);

    //         if(supplieCredits && supplieCredits.rows &&supplieCredits.rows.length>0 )
    //         {
    //             return supplieCredits.rows
    //         }
    //         return []
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }

    public static async getSupplierCeditNoteLinesLimits(client: PoolClient, lineIds: any[], creditNoteId: string) {
        try {
            const query = {
                text: `with "lines" as(
                    select  "BillingLines".id ,COALESCE("BillingLines".qty,0) -  (COALESCE(sum(otherCR."qty"),0) +  COALESCE("SupplierCreditLines"."qty",0) ) as "maxQty"  
	                 from "BillingLines"
                    inner join "SupplierCreditLines" on  "SupplierCreditLines" ."billingLineId" = "BillingLines".id  and "SupplierCreditLines"."supplierCreditId" = $1
                    left join "SupplierCreditLines" otherCR ON otherCR."billingLineId" =  "BillingLines".id  and otherCR."supplierCreditId" <>$1
                    where  "BillingLines"."id" = any($2)
                    group by "BillingLines".id , "SupplierCreditLines"."qty" 
                )

                select * from "lines"`,

                values: [creditNoteId, lineIds]
            }

            let lines = await client.query(query.text, query.values);

            return lines.rows
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getProductBillingLines(data: any) {

        try {

            let branchId = data.branchId ? (data.branchId).trim() ? (data.branchId).trim() : null : null;
            let supplierId = data.supplierId ? (data.supplierId).trim() ? (data.supplierId).trim() : null : null;

            if (!branchId) { throw new ValidationException('branchId is required') }
            if (!supplierId) { throw new ValidationException('supplierId is required') }

            let searchValue = data.searchTerm ? `'^.*` + Helper.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `.*$'` : null
            let filterQuery = ``

            if (searchValue) {
                filterQuery = `and (LOWER("Products".name) ~ ${searchValue}
                                        OR LOWER("Products".barcode) ~ ${searchValue}
                                        OR LOWER ("BillingLines"."note") ~ ${searchValue}
                                    
                                 )`
            }

            const limit = data.limit ?? 15
            const page = data.page ?? 1
            let offset = limit * (page - 1)
            const query: { text: string, values: any } = {
                text: `
                        with "lines" as (SELECT    "Billings"."billingNumber",
				 			"BillingLines"."billingId",
                            "BillingLines".id,
                            "BillingLines". qty,
                            "BillingLines".qty -   COALESCE(sum("SupplierCreditLines".qty),0) as "maxQty",
                            "BillingLines"."unitCost",
                            "BillingLines"."productId",
                            "BillingLines".barcode,
                            "BillingLines". "accountId",
                            "Accounts".name AS "accountName",
                            "BillingLines".note,
                            "BillingLines"."taxId",
                            "BillingLines"."employeeId",
                            "BillingLines"."taxPercentage",
                            "BillingLines".taxes,
                            "BillingLines"."taxType",
                            "BillingLines"."taxTotal",
                            "BillingLines"."subTotal",
                            "BillingLines"."batch",
                            "BillingLines"."serial",
                            "BillingLines"."total",
                            "BillingLines"."isInclusiveTax",
                            "BillingLines"."discountTotal" as "billingDiscountTotal",
                            "BillingLines"."billDiscount",
                            "BillingLines"."parentId",
                            "BillingLines"."qty" as "billingQty",
                            "Products".name AS "productName",
                            "Products".type AS "productType",
                            "Media".url->>'defaultUrl' as "mediaUrl",
                            "ProductBatches"."prodDate",
                            "ProductBatches"."expireDate"
                    FROM "BillingLines"
                    inner JOIN "Products" ON "Products".id = "BillingLines"."productId"
                    LEFT JOIN "Media" on "Media".id =  "Products"."mediaId"
                    INNER JOIN "Accounts"  ON "Accounts".id = "BillingLines"."accountId"
                    INNER JOIN "Billings" ON "Billings".id = "BillingLines"."billingId"
                    LEFT JOIN "SupplierCreditLines" 
                    ON "SupplierCreditLines"."billingLineId" = "BillingLines".id  and (( "Products".id is null) or ( "Products"."type"='inventory') or ("Products"."type"='batch' and  "SupplierCreditLines"."parentId" is not null) or ("Products"."type"='serialized' and  "SupplierCreditLines"."parentId" is not null) )
                    LEFT JOIN "BranchProducts" ON  "BranchProducts"."branchId" = "Billings"."branchId" and "BranchProducts"."productId" = "Products".id 
                    LEFT JOIN "ProductBatches" ON "ProductBatches"."batch" = "BillingLines"."batch" AND "ProductBatches"."branchProductId"  = "BranchProducts".id
                    WHERE "Billings"."supplierId" = $1
                    AND "Billings"."branchId"= $2
                    ${filterQuery}
                    and "Billings".status <> 'Draft'
                    group by  "BillingLines".id,"Accounts".id, "Products".id,  "ProductBatches"."prodDate", "ProductBatches"."expireDate", "Billings"."billingNumber", "Media".url->>'defaultUrl'
				 HAVING ("BillingLines".qty -   COALESCE(sum("SupplierCreditLines".qty),0)) > 0 
         )
		 
		 select "lines".* , count(*) over() from "lines"
		 left join "SupplierCreditLines" on "SupplierCreditLines"."billingLineId" = "lines".id 
		 where    "lines"."qty" <> 0 and (null::uuid is null or "SupplierCreditLines"."supplierCreditId" <> null or "SupplierCreditLines"."supplierCreditId" is null )
		  limit $3
          offset $4 
            `,
                values: [supplierId, branchId, limit, offset]
            }

            let lineList: BillingLine[] = []

            const line: any = await DB.excu.query(query.text, query.values)
            if (line.rows) {
                for (let index = 0; index < line.rows.length; index++) {
                    const element = line.rows[index];
                    let billingLine = new BillingLine();
                    billingLine.ParseJson(element)
                    if (element.productId != null) {
                        const selectedItem: any = {}
                        selectedItem.id = element.productId;
                        selectedItem.name = element.productName;
                        selectedItem.type = element.productType;
                        billingLine.selectedItem = selectedItem
                    }

                    lineList.push(billingLine)
                }
            }


            lineList.filter((f: any) => f.parentId != null).forEach((element: any) => {
                const Line = lineList.find(f => f.id == element.parentId);

                if (Line != null) {
                    const index = lineList.indexOf(Line);
                    if (Line.productType == "batch") {
                        lineList[index].batches.push(element)
                    } else if (Line.productType == "serialized") {
                        lineList[index].serials.push(element)
                    }
                    lineList.splice(lineList.indexOf(element), 1);
                }

            });

            lineList = lineList.map(f => {
                if (f.batches.length > 0) {
                    f.maxQty = f.batches.reduce((sum, item) => sum + item.maxQty, 0)
                }
                return f
            })

            let count = line.rows && line.rows.length > 0 ? Number((<any>line.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (line.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: line.rows,
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
}