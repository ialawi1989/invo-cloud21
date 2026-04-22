import { DB } from "@src/dbconnection/dbconnection";
import { Billing } from "@src/models/account/Billing";
import { BillingLine } from "@src/models/account/BillingLine";
import { ResponseData } from "@src/models/ResponseData";
import { CompanyRepo } from "@src/repo/admin/company.repo";
import { Helper } from "@src/utilts/helper";
import { BillingValidation } from "@src/validationSchema/account/billing.Schema";
import { PoolClient } from "pg";
import { AccountsRepo } from "./account.repo";


import { JournalRepo } from "./Journal.repo";
import { Company } from "@src/models/admin/company";
import { ProductRepo } from "../product/product.repo";
import { BranchProductsRepo } from "../product/branchProduct.repo";
import { BatchProductRepo } from "../product/productTypes/batchProduct.reps";
import { SerialProductRepo } from "../product/productTypes/serilizedProduct.repo";

import { Batches } from "@src/models/product/Batches";
import { Serials } from "@src/models/product/Serials";
import { BranchProducts } from "@src/models/product/BranchProducts";
import { TimeHelper } from "@src/utilts/timeHelper";
import { EventLog, Log } from "@src/models/log";
import { PDFGenerator } from "@src/utilts/PDFGenerator";
import { ValidationException } from "@src/utilts/Exception";
import { SupplierItem } from "@src/models/account/SupplierItem";
import { SupplierRepo } from "./supplier.repo";

import { EventLogsRepo } from "./eventlogs.repo";
import { TransactionManagements } from "@src/utilts/TransactionsManagments";
import { TableConfig, TableDataService, TableRequest } from "@src/utilts/TableDataService";
import { CustomizationRepo } from "../settings/Customization.repo";
import { getValuable } from "@src/utilts/getValuable";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";
import { purchaseOrderStatuesQueue } from "@src/repo/triggers/queue/workers/purchaseOrder.worker";



export class BillingRepo {

    public static async checkIsBillingNumberExist(client: PoolClient, id: string | null, BillingNumber: string, companyId: string) {
        try {
            const prefixReg = "^(BILL-)";
            const prefix = "BILL-"
            const num = BillingNumber.replace(prefix, '');
            const numTerm = BillingNumber.toLocaleLowerCase().trim()
            const query: { text: string, values: any } = {
                text: `SELECT 
                             "billingNumber" 
                       FROM "Billings"
                       INNER JOIN "Branches"
                       ON "Branches".id = "Billings"."branchId"
                       WHERE "Branches"."companyId"=$1
                       AND LOWER("billingNumber") = $2
                `,
                values: [companyId, numTerm]
            }

            if (id != null) {
                query.text = `SELECT "billingNumber" 
                FROM "Billings"
                INNER JOIN "Branches"
                ON "Branches".id = "Billings"."branchId"
                WHERE "Branches"."companyId"=$1
                AND LOWER("billingNumber") = $2
                   AND "Billings".id <> $3 `
                query.values = [companyId, numTerm, id]
            }
            const billingNumberData = await client.query(query.text, query.values);
            if (billingNumberData.rowCount != null && billingNumberData.rowCount > 0) {
                return true;
            } else {
                return false;
            }
        } catch (error: any) {

            throw new Error(error.message)
        }
    }
    public static async getBillBranchId(client: PoolClient, billId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "branchId" from "Billings"
                where "Billings".id =$1`,
                values: [billId]
            }
            const branchId = await client.query(query.text, query.values);
            return branchId.rows[0].branchId
        } catch (error: any) {

            throw new Error(error.message);
        }
    }



    /**Validate Bill Amount to prevent paying amount that exceeded bill actual Amount */
    public static async validateBillPaidAmount(client: PoolClient, billingId: string, amount: number, afterDecimal: number, paymentId: string | null = null) {
        try {
            const query: { text: string, values: any } = {
                text: `with "billTotal" as (
                    select "Billings".id,
                           "Billings".total::text::numeric,
                           "Billings"."branchId",
                           "Billings"."billingNumber"
                        from "Billings"
	                    WHERE "Billings".id =$1
                    
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
                    ( "billTotal".total::text::numeric - (COALESCE("appliedCredits".total::text::numeric,0) + COALESCE("creditNotestotal".total::text::numeric,0) + COALESCE("billPayments".total::text::numeric,0)))::float as balance ,
                      "billTotal"."branchId","billTotal"."billingNumber"
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
                           "Billings".total,
                           "Billings"."branchId",
                           "Billings"."billingNumber"
                        from "Billings"
	                    WHERE "Billings".id = $1
                    
                    ),"appliedCredits" as (
                    select sum ("SupplierAppliedCredits"."amount") as total ,"billTotal".id from "SupplierAppliedCredits"
                    left join "billTotal" on  "billTotal".id = "SupplierAppliedCredits"."billingId" 
                    group by "billTotal".id
                    ),"creditNotestotal" as (
                    select sum ("SupplierCredits"."total") as total,"billTotal".id from "SupplierCredits"
                    left join "billTotal" on "billTotal".id = "SupplierCredits"."billingId" 
                    group by "billTotal".id
                    ),"billPayments" as (
                    select sum ("BillingPaymentLines"."amount") as total,"billTotal".id from "BillingPaymentLines"
                    left join "billTotal" on "billTotal".id = "BillingPaymentLines"."billingId" 
                    where "BillingPaymentLines"."billingPaymentId" <>$2
                    group by "billTotal".id
                    )
                    
                    select 
                     ("billTotal".total - (COALESCE("appliedCredits".total,0) + COALESCE("creditNotestotal".total,0) + COALESCE("billPayments".total,0)))::float as balance ,
                     "billTotal"."branchId","billTotal"."billingNumber"
                    from "billTotal" 
                    left join "appliedCredits" on  "billTotal".id = "appliedCredits".id 
                    left join "creditNotestotal" on  "billTotal".id = "creditNotestotal".id 
                    left join "billPayments" on  "billTotal".id = "billPayments".id `,
                    query.values = [billingId, paymentId]
            }
            const balanceData = await client.query(query.text, query.values);
            const balance = Helper.roundDecimal((<any>balanceData.rows[0]).balance, afterDecimal)
            const billingNumber = (<any>balanceData.rows[0]).billingNumber
            const branchId = (<any>balanceData.rows[0]).branchId

            console.table(<any>balanceData.rows[0])
            if (balance < amount) {
                throw new ValidationException("Invalid  Payment Amount for " + billingNumber + " (balance : " + balance + ") ")
            }

            return { total: amount - balance, branchId: branchId };
        } catch (error: any) {


            throw new Error(error.message)
        }
    }




    /**Return Billing Current Status (ONLY WHEN STATUS IS CHANGING FROM DRAFT TO OPEN THE INVENTORY WILL BE EFFECTED)*/
    public static async getBillingCurrentStatus(client: PoolClient, billingId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT status from "Billings" where id =$1`,
                values: [billingId]
            }

            let bill = await client.query(query.text, query.values);
            return bill.rows[0].status
        } catch (error: any) {

            throw new Error(error)
        }
    }

    public static async getSupplierCountry(client: PoolClient, supplierId: string) {
        try {
            const query = {
                text: `SELECT "country" FROM "Suppliers" where id =$1 `,
                values: [supplierId]
            }

            let supplier = await client.query(query.text, query.values);
            if (supplier && supplier.rows && supplier.rows.length > 0) {
                return {
                    country: supplier.rows[0].country
                }
            }

            return null
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async addBilling(client: PoolClient, data: any, company: Company, employeeId: string) {
        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal

            /**Validate Data */
            const validate = await BillingValidation.billingValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            /**Check If Billing Number exist */
            const isBillingNumberExist = await this.checkIsBillingNumberExist(client, null, data.billingNumber, companyId);
            if (isBillingNumberExist) {
                throw new ValidationException("Billing Number Already Used")
            }


            const billing = new Billing();


            billing.ParseJson(data)
            let supplier = await this.getSupplierCountry(client, billing.supplierId)
            if (supplier && supplier.country && company.country && supplier.country != company.country) {
                billing.resetTaxes()
            }
            billing.calculateTotal(afterDecimal)
            billing.employeeId = employeeId;
            billing.status = billing.status == "" || billing.status == null ? "Open" : billing.status
            billing.createdAt = new Date();
            if (billing.status == 'Open') {
                await this.addItemToSupplier(client, billing, companyId)
            }

            /**Insert Billing Query */
            const query: { text: string, values: any } = {
                text: `INSERT INTO "Billings" 
                     ("billingNumber",
                       reference,
                       "employeeId",
                       "supplierId",
                       "dueDate",
                       "note",
                       "paymentTerm",
                       "branchId",
                        total,
                       "createdAt",
                       "purchaseOrderId",
                       "recurringBillId",
                       status,
                       "billingDate",
                       "isInclusiveTax",
                       "attachment",
                       "payableAccountId",
                       "roundingType",
                       "roundingTotal",
                       "smallestCurrency",
                       "customFields",
                        "companyId", 
                       "applyDiscountBeforeTax",
                        "discountAmount" ,
                        "discountPercentage",
                        "discountTotal",
                        "discountIncludesTax"
                       ) 
                      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, $15, $16,$17,$18,$19,$20, $21, $22, $23, $24,$25,$26,$27) RETURNING id`,
                values: [billing.billingNumber,
                billing.reference,
                billing.employeeId,
                billing.supplierId,
                billing.dueDate,
                billing.note,
                billing.paymentTerm,
                billing.branchId,
                billing.total,
                billing.createdAt,
                billing.purchaseOrderId,
                billing.recurringBillId,
                billing.status,
                billing.billingDate,
                billing.isInclusiveTax,
                JSON.stringify(billing.attachment),
                billing.payableAccountId,
                billing.roundingType,
                billing.roundingTotal,
                billing.smallestCurrency,
                JSON.stringify(billing.customFields),
                company.id,
                billing.applyDiscountBeforeTax,
                billing.discountAmount,
                billing.discountPercentage,
                billing.discountTotal,
                billing.discountIncludesTax

                ]

            }
            const insert = await client.query(query.text, query.values)
            billing.id = (<any>insert.rows[0]).id;

            /**Insert Billing Lines */
            for (let index = 0; index < billing.lines.length; index++) {
                const line: BillingLine = billing.lines[index];
                line.billingId = billing.id;
                line.branchId = billing.branchId;
                line.companyId = companyId;
                line.index = index
                line.createdAt = TimeHelper.getCreatedAt(billing.billingDate, company.timeOffset);
                line.branchId = billing.branchId;
                line.companyId = company.id
                if ((line.productId == null || line.productId == "") && (line.note == null || line.note == "")) {
                    continue;
                }

                if ((line.productId != null && line.productId != "") || (line.note != null && line.note != "")) {
                    line.employeeId = employeeId
                    if (line.isDeleted) {
                        continue;
                    }
                    let insertLine = await this.addBillingLine(client, line, companyId, afterDecimal, billing.branchId, billing)
                    line.id = insertLine.data.id;
                    /**Add Line Batches/Serials As Line */



                    if (line.qty <= 0) {
                        throw new ValidationException("Qty Is Required")
                    }

                    if (line.productId != null && line.productId != "") {
                        let productType = await ProductRepo.getProductType(client, line.productId)
                        if (productType == "serialized" && (line.serials == undefined || !line.serials || line.serials.length <= 0)) {
                            throw new ValidationException("Serilas Are Required")
                        }

                        if (productType == "batch" && (line.batches == undefined || !line.batches || line.batches.length <= 0)) {
                            throw new ValidationException("Batches Are Required")
                        }
                        if (line.batches && line.batches.length > 0) {
                            await this.addBatchesLines(client, billing, line, companyId, afterDecimal, employeeId)
                        }
                        if (line.serials && line.serials.length > 0) {
                            await this.addSerialsLines(client, billing, line, companyId, afterDecimal, employeeId)
                        }
                    }

                }
            }



            return new ResponseData(true, "", { id: billing.id })
        } catch (error: any) {

            console.log(error)
            throw new Error(error.message)
        }
    }
    public static async addBillingLine(client: PoolClient, billingLine: BillingLine, companyId: string, afterDecimal: number, branchId: string, billing: Billing) {
        try {
            const accountData = await AccountsRepo.getAccountType(client, billingLine.accountId)
            const accountType = accountData.type
            const accountParentType = accountData.parentType;
            if ((accountParentType == 'Other Current Assets' && accountType == "Inventory Assets") && (billingLine.productId != "" && billingLine.productId != null) && (billing.status == "Open")) {
                await this.addBillingInventory(client, billing, billingLine, branchId, companyId, afterDecimal)
            }

            const query: { text: string, values: any } = {
                text: `INSERT INTO "BillingLines" 
                                   (barcode,
                                    qty,
                                    "unitCost",
                                    "accountId",
                                    "billingId",
                                    "productId",
                                    total,
                                    note,
                                    "taxId",
                                    "taxPercentage",
                                    "subTotal",
                                    "taxTotal",
                                    taxes,
                                    "isInclusiveTax",
                                    "taxType",
                                    "employeeId",
                                    "parentId",
                                    "serial",
                                    "batch",
                                    "createdAt",
                                    "SIC",
                                    "expireDate",
                                    "prodDate",
                                    "companyId",
                                    "branchId",
                                     "index",
                                    "baseAmount",
                                    "billDiscount",
                                    "discountAmount" ,
                                    "discountPercentage",
                                    "applyDiscountBeforeTax",
                                    "discountTotal",
                                     "taxableAmount",
                                    "discountIncludesTax") 
                      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23, $24, $25, $26, $27, $28, $29 ,$30,$31,$32,$33,$34) RETURNING id`,
                values: [billingLine.barcode,
                billingLine.qty,
                billingLine.unitCost,
                billingLine.accountId,
                billingLine.billingId,
                billingLine.productId,
                billingLine.total,
                billingLine.note,
                billingLine.taxId,
                billingLine.taxPercentage,
                billingLine.subTotal,
                billingLine.taxTotal,
                JSON.stringify(billingLine.taxes),
                billingLine.isInclusiveTax,
                billingLine.taxType,
                billingLine.employeeId,
                billingLine.parentId,
                billingLine.serial,
                billingLine.batch,
                billingLine.createdAt,
                billingLine.SIC,
                billingLine.expireDate,
                billingLine.prodDate,
                billingLine.companyId,
                billingLine.branchId,
                billingLine.index,
                billingLine.baseAmount,
                billingLine.billDiscount,
                billingLine.discountAmount,
                billingLine.discountPercentage,
                billingLine.applyDiscountBeforeTax,
                billingLine.discountTotal,
                billingLine.taxableAmount,
                billingLine.discountIncludesTax
                ]
            }
            const insert = await client.query(query.text, query.values)
            billingLine.id = (<any>insert.rows[0]).id

            // const accountData = await AccountsRepo.getAccountType(client, billingLine.accountId)
            // const accountType = accountData.type;
            // const accountParentType = accountData.parentType;

            /**
             * Inventory Movment Affected Only When Billing lINE  A ccount Is Of TYPE Inventory Assets AND Parent Type is Other Current Assets
             * Also Billing is not Draft 
             */

            // if ((accountParentType == 'Other Current Assets' && accountType == "Inventory Assets") && (billingLine.productId != "" && billingLine.productId != null) && billing.status != "Draft") {
            //     await BillingMovmentRepo.inserInventoryMovment(client, branchId, billingLine, afterDecimal)
            // }



            return new ResponseData(true, "", { id: billingLine.id })

        } catch (error: any) {

            console.log(error)
            throw new Error(error.message)
        }
    }



    public static async getBillingLogs(client: PoolClient, billId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT logs from "Billings" where id = $1`,
                values: [billId]
            }
            let logData = await client.query(query.text, query.values);
            return logData.rows[0].logs ?? [];
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async editBilling(client: PoolClient, data: any, company: Company, employeeId: string) {

        try {

            const companyId = company.id;

            const validate = await BillingValidation.billingValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            const afterDecimal = company.afterDecimal
            const billing = new Billing();
            billing.ParseJson(data)
            let supplier = await this.getSupplierCountry(client, billing.supplierId)
            if (supplier && supplier.country && company.country && supplier.country != company.country) {
                billing.resetTaxes()
            }
            billing.calculateTotal(afterDecimal);
            //billing.logs = await this.getBillingLogs(client, billing.id)
            billing.logs = []


            const deletedLines = billing.lines.filter(f => f.isDeleted).map(item => {
                return item.id
            })
            /**Set current billing status before edit */
            billing.currentBillingStatus = await this.getBillingCurrentStatus(client, billing.id)
            const isBillingNumberExist = await this.checkIsBillingNumberExist(client, data.id, data.billingNumber, companyId);
            if (isBillingNumberExist) {
                throw new ValidationException("Billing Number Already Used")
            }

            if (billing.currentBillingStatus == "Draft" && billing.status == "Open") {
                //this.addBillingLogs(billing, "edit", "Save Draft to Open Bill", employeeId)
                Log.addLog(billing, "Save Draft to Open Bill", "edit", employeeId)


                await this.addItemToSupplier(client, billing, companyId)


            }
            console.log(billing.total, ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")



            const query: { text: string, values: any } = {
                text: `UPDATE "Billings" SET 
                                   "billingNumber"=$1,
                                   reference=$2,
                                   "employeeId"=$3,
                                   "supplierId"=$4,
                                   "dueDate"=$5, 
                                   total=$6,
                                   status=$7,
                                   "billingDate"=$8,
                                   "isInclusiveTax"=$9,
                                   "attachment"=$10,
                                   "payableAccountId"=$11,
                                   "paymentTerm"= $12,
                                   "roundingType"=$13,
                                    "roundingTotal"=$14,
                                    "smallestCurrency"=$15,
                                    "customFields" = $16, 

                                    "applyDiscountBeforeTax" =$17,
                                    "discountAmount" =$18,
                                    "discountPercentage"=$19,
                                    "discountTotal" =$20,
                                    "note"=$21,
                                    "discountIncludesTax" = $22
                        WHERE "branchId"=$23 AND id=$24 `,
                values: [billing.billingNumber, billing.reference, billing.employeeId, billing.supplierId, billing.dueDate, billing.total, billing.status, billing.billingDate, billing.isInclusiveTax, JSON.stringify(billing.attachment), billing.payableAccountId, billing.paymentTerm, billing.roundingType, billing.roundingTotal, billing.smallestCurrency, JSON.stringify(billing.customFields), billing.applyDiscountBeforeTax,
                billing.discountAmount, billing.discountPercentage, billing.discountTotal, billing.note, billing.discountIncludesTax, billing.branchId, billing.id]
            }
            const insert = await client.query(query.text, query.values)

            for (let index = 0; index < billing.lines.length; index++) {
                const line = billing.lines[index];
                const billingLine = new BillingLine();
                billingLine.index = index;
                billingLine.ParseJson(line);
                billingLine.billingId = billing.id;
                billingLine.branchId = billing.branchId;
                billingLine.companyId = company.id
                if ((billingLine.productId == null || billingLine.productId == "") && (billingLine.note == null || billingLine.note == "")) {
                    continue;
                }
                billingLine.qty = billingLine.isDeleted ? 0 : billingLine.qty
                if (billingLine.id == null || billingLine.id == "") {
                    line.createdAt = TimeHelper.getCreatedAt(billing.billingDate, company.timeOffset);
                    billingLine.employeeId = employeeId;
                    if (line.isDeleted) {
                        continue;
                    }

                    //this.addBillingLogs(billing, "edit", "Add New Line", employeeId)
                    Log.addLog(billing, "Add New Line", "edit", employeeId)

                    if (line.qty <= 0) {
                        throw new ValidationException("Qty Is Required")
                    }
                    await this.addBillingLine(client, billingLine, companyId, afterDecimal, billing.branchId, billing)
                } else {


                    if (line.qty <= 0 && !line.isDeleted) {
                        throw new ValidationException("Qty Is Required")
                    }

                    billingLine.createdAt = TimeHelper.getCreatedAt(billing.billingDate, company.timeOffset);
                    await this.editBillingLine(client, billingLine, billing.branchId, billing, companyId, afterDecimal, employeeId)
                }
                if (line.batches && line.batches.length > 0) {
                    await this.addBatchesLines(client, billing, billingLine, companyId, afterDecimal, employeeId)
                }
                if (line.serials && line.serials.length > 0) {
                    await this.addSerialsLines(client, billing, billingLine, companyId, afterDecimal, employeeId)
                }

            }
            if (employeeId && billing.logs.length == 0) {
                //this.addBillingLogs(billing, "edit", "Edit", employeeId)
                Log.addLog(billing, "Edit", "edit", employeeId)

            }



            await this.setBillingLogs(client, billing.logs, billing.id, companyId, billing.branchId, employeeId, billing.billingNumber, "Cloud");
            return new ResponseData(true, "", { id: billing.id, deletedLines: deletedLines })
        } catch (error: any) {

            console.log(error)
            throw new Error(error.message)
        }
    }
    public static async setBillingLogs(client: PoolClient, logs: any[], billingId: string, companyId: string, branchId: string, employeeId: string, billingNumber: string | null, source: string) {
        try {
            await LogsManagmentRepo.manageLogs(client, "Billings", billingId, logs, branchId, companyId, employeeId, billingNumber, source)
        }
        catch (error: any) {
            throw new Error(error)
        }
    }

    /** Check if there is a change in bill to apply it on inventory */
    public static async getOldTotal(client: PoolClient, lineId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `select qty,"unitCost",total from "BillingLines" where id=$1 `,
                values: [lineId]
            }
            let line = await client.query(query.text, query.values);

            return line.rows[0]
        } catch (error: any) {

            throw new Error(error)
        }
    }
    public static async editBillingLine(client: PoolClient, billingLine: BillingLine, branchId: string, billing: Billing, companyId: string, afterDecimal: number, employeeId: string) {
        try {

            /** GET LINE OLD TOTAL IF THERE IS A CHNAGE APPLY TO INVENTORY */
            const oldLine = await this.getOldTotal(client, billingLine.id);
            /** CHECK ACCOUNT TYPE
             * TO VALIDATE IF BILLING LINE WILL BE APPLY TO COMPANY INVNTORY 
             */
            const accountData = await AccountsRepo.getAccountType(client, billingLine.accountId)
            const accountType = accountData.type
            const accountParentType = accountData.parentType;
            /**Add Inventory Movment */



            if (oldLine && oldLine.qty && oldLine.qty != billingLine.qty && billingLine.parentId == null) {
                //this.addBillingLogs(billing, "Change Qty", `Change On ${billingLine.selectedItem.name ?? billingLine.note} Qty from ${oldLine.qty} to ${billingLine.qty}`, employeeId)
                Log.addLog(billing, `Change On ${billingLine.selectedItem.name ?? billingLine.note} Qty from ${oldLine.qty} to ${billingLine.qty}`, "Change Qty", employeeId, { "OldQty": oldLine.qty, "newQty": billingLine.qty })


            }

            if (oldLine && oldLine.unitCost && oldLine.unitCost != billingLine.unitCost && billingLine.parentId == null) {
                //this.addBillingLogs(billing, "Change Price", `Change On ${billingLine.selectedItem.name ?? billingLine.note}  Billing unitCost from ${oldLine.unitCost} to ${billingLine.unitCost}`, employeeId)
                Log.addLog(billing, `Change On ${billingLine.selectedItem.name ?? billingLine.note}  Billing unitCost from ${oldLine.unitCost} to ${billingLine.unitCost}`, "Change Price", employeeId, { "OldPrice": oldLine.qty, "newPrice": billingLine.qty })

            }


            if ((accountParentType == 'Other Current Assets' && accountType == "Inventory Assets") && (billingLine.productId != "" && billingLine.productId != null) &&
                ((billingLine.isDeleted) || (billingLine.total != oldLine.total) || (billingLine.qty != oldLine.qty) || (billingLine.unitCost != oldLine.unitCost) || ((billing.currentBillingStatus == "Draft" || billing.currentBillingStatus == null) && billing.status == "Open"))) {
                await this.addBillingInventory(client, billing, billingLine, branchId, companyId, afterDecimal)
            }


            if (billingLine.isDeleted) {
                if (billingLine.serials && billingLine.serials.length > 0 && billingLine.productId) {
                    const serials = billingLine.serials.map((F) => { return F.serial })
                    await SerialProductRepo.isSerialsHasSales(client, billingLine.productId, serials)
                }
                await this.deletBillingLine(client, billingLine.id, billingLine.productId)
                return;
            }

            const query: { text: string, values: any } = {
                text: `UPDATE  "BillingLines" SET 
                            barcode=$1,
                            qty=$2,
                            "unitCost"=$3,
                            "accountId"=$4,
                            "productId"=$5,
                            note=$6,
                            "taxId"=$7,
                            "taxPercentage"=$8,
                            "subTotal"=$9,
                            "taxTotal"=$10,
                            taxes = $11,
                            "isInclusiveTax"=$12,
                            "taxType" =$13,
                            "serial"=$14,
                            "batch"=$15,
                            "SIC"=$16,
                            "createdAt"= case when "createdAt"::date = $17::date then "createdAt" else $17 end,
                            "expireDate" =$18,
                            "prodDate"=$19,
                            "total" = $20,
                            "baseAmount" = $21, 
                            "billDiscount" =$22,  
                            "discountAmount" =$23,
                            "discountPercentage"=$24,
                            "applyDiscountBeforeTax" =$25,
                            "discountTotal" =$26,
                            "taxableAmount" = $27,
                            "discountIncludesTax" = $28,
                            "index" = $29
                        WHERE  id=$30`,
                values: [billingLine.barcode,
                billingLine.qty,
                billingLine.unitCost,
                billingLine.accountId,
                billingLine.productId,
                billingLine.note,
                billingLine.taxId,
                billingLine.taxPercentage,
                billingLine.subTotal,
                billingLine.taxTotal,
                JSON.stringify(billingLine.taxes),
                billingLine.isInclusiveTax,
                billingLine.taxType,
                billingLine.serial,
                billingLine.batch,
                billingLine.SIC,
                billingLine.createdAt,
                billingLine.expireDate,
                billingLine.prodDate,
                billingLine.total,
                billingLine.baseAmount,
                billingLine.billDiscount,
                billingLine.discountAmount,
                billingLine.discountPercentage,
                billingLine.applyDiscountBeforeTax,
                billingLine.discountTotal,
                billingLine.taxableAmount,
                billingLine.discountIncludesTax,
                billingLine.index,
                billingLine.id]
            }

            await client.query(query.text, query.values)



            // Indicates if there is a change on billing cost to update Inventory Movment 
            // const oldCost = oldCostQty.cost;
            // const newCost = billingLine.qty * billingLine.unitCost;


            // Insert Journal Only when there is difference in cost
            // if (billing.currentBillingStatus == "Draft" && billing.status == "Open") {
            //     const accountData = await AccountsRepo.getAccountType(client, billingLine.accountId)
            //     const accountType = accountData.type;
            //     const accountParentType = accountData.parentType;

            //     /**
            //      * Inventory Movment Affected Only When Billing lINE  A ccount Is Of TYPE Inventory Assets AND Parent Type is Other Current Assets
            //      * Also Billing is not Draft 
            //      */
            //     if ((accountParentType == 'Other Current Assets' && accountType == "Inventory Assets") && (billingLine.productId != "" && billingLine.productId != null)) {
            //         await BillingMovmentRepo.inserInventoryMovment(client, branchId, billingLine, afterDecimal)
            //     }
            // } else {
            //     if (newCost != oldCost && billingLine.productId != "" && billingLine.productId != null && billing.status != "Draft") {
            //         // Find cost difference between new cost and old cost when Negative(Decrease) when Positive(Increase)
            //         await BillingMovmentRepo.updateInventoryMovment(client, branchId, billingLine, afterDecimal)
            //     }
            // }


        } catch (error: any) {

            console.log(error)
            throw new Error(error.message)
        }
    }

    /**Add Line Serials / Batches as billingLine */
    public static async addSerialsLines(client: PoolClient, billing: Billing, parentLine: BillingLine, companyId: string, afterDecimal: number, employeeId: string) {
        try {

            for (let index = 0; index < parentLine.serials.length; index++) {

                const serial = parentLine.serials[index];
                if (serial.serial == null || serial.serial == "") {
                    throw new ValidationException("Serial is Required")
                }

                if (serial.id != "" && serial.id != null) {/** Edit Serial Line */
                    let tempLine = new BillingLine();
                    tempLine.ParseJson(serial)

                    await this.editBillingLine(client, serial, billing.branchId, billing, companyId, afterDecimal, employeeId)
                } else { /** Add new Serial Line */

                    let tempLine = new BillingLine();
                    tempLine.qty = 1;
                    tempLine.unitCost = serial.unitCost;
                    tempLine.parentId = parentLine.id;
                    tempLine.billingId = parentLine.billingId;
                    tempLine.accountId = parentLine.accountId;
                    tempLine.employeeId = employeeId;
                    tempLine.productId = parentLine.productId
                    tempLine.serial = serial.serial;
                    tempLine.companyId = companyId;
                    tempLine.branchId = billing.branchId;
                    tempLine.calculateTotal(afterDecimal)
                    await this.addBillingLine(client, tempLine, companyId, afterDecimal, billing.branchId, billing)
                }

            }
        } catch (error: any) {

            throw new Error(error)
        }
    }
    public static async addBatchesLines(client: PoolClient, billing: Billing, parentLine: BillingLine, companyId: string, afterDecimal: number, employeeId: string) {
        try {

            for (let index = 0; index < parentLine.batches.length; index++) {

                const batch = parentLine.batches[index];
                if (batch == null || batch.length == "") {
                    throw new ValidationException("Batch is Required");
                }

                if (batch.id != "" && batch.id != null) {/** Edit Batch Line */

                    let tempLine = new BillingLine();
                    tempLine.ParseJson(batch)
                    tempLine.calculateTotal(afterDecimal)

                    await this.editBillingLine(client, tempLine, billing.branchId, billing, companyId, afterDecimal, employeeId)
                } else {/** Add new Batch Line */
                    let tempLine = new BillingLine();
                    tempLine.ParseJson(batch)
                    tempLine.parentId = parentLine.id;
                    tempLine.billingId = parentLine.billingId;
                    tempLine.accountId = parentLine.accountId;
                    tempLine.employeeId = employeeId;
                    tempLine.productId = parentLine.productId;
                    tempLine.companyId = companyId;
                    tempLine.branchId = billing.branchId;
                    tempLine.calculateTotal(afterDecimal)
                    await this.addBillingLine(client, tempLine, companyId, afterDecimal, billing.branchId, billing)
                }

            }
        } catch (error: any) {

            throw new Error(error)
        }
    }


    public static async getBillingById(client: PoolClient, billingId: string, company: Company) {


        try {


            const query: { text: string, values: any } = {
                text: `with "bill" as (SELECT
                        "Billings".id, 
                        "Billings"."mediaId", 
                        "Media"."url"->>'defaultUrl' as "mediaUrl",
                        "Billings"."createdAt",
                        CAST("Billings"."dueDate" AS TEXT) AS "dueDate" ,
                        "Billings"."paymentTerm",
                        "Billings"."billingNumber",
                        "Billings".reference,
                        "Billings"."branchId",
                        "Billings".total,
                        "Billings".status,
                        "Billings"."discountPercentage",
                        "Billings"."purchaseOrderId",
                        "Billings"."discountTotal",
                        "Billings"."discountAmount",
                        "Billings"."applyDiscountBeforeTax",
                        "Suppliers"."vatNumber" as "supplierVatNumber" ,
                        CAST( "Billings"."billingDate"  AS TEXT) AS "billingDate" ,
                        "Billings"."employeeId",
                        (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',COALESCE("Media"."url"->>'downloadUrl',"Media"."url"->>'defaultUrl'),'mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("Billings"."attachment") as attachments(attachments)
                        inner join "Media" on "Media".id = (attachments->>'id')::uuid
                        ) as "attachment",
                        "Branches".name AS "branchName",
                        "Branches"."customFields" as "branchCustomFields",
                        "Suppliers".name AS "supplierName",
                        "Suppliers"."country" as "supplierCountry",
                        "Suppliers"."email" as "supplierEmail",
                        "Billings"."supplierId",
                        "Billings"."isInclusiveTax",
                        "Billings"."payableAccountId",
                        "Billings"."roundingType",
                        "Billings"."roundingTotal",
                        "Billings"."smallestCurrency",
                        "Billings"."discountIncludesTax",
                        "Billings"."customFields",
                        "Billings".note,
                        COALESCE(sum( "BillingPaymentLines".amount),0) as "paidAmount" ,
                         case when  COALESCE(NULLIF("Suppliers"."country", ''), NULL)  is not null and "Suppliers"."country" <>'${company.country}'  then true else false end as "internationalSupplier",
                        case when  COALESCE(NULLIF("Suppliers"."country", ''), NULL)  is not null and "Suppliers"."country" <>'${company.country}'  and "BillOfEntries".id is null then true else false end as "allowBillOfEntry",
                         "BillOfEntries".id  as "billOfEntryId",
                         "BillOfEntries"."billingOfEnrtyNumber",
                         "BillOfEntries"."total" as "billingOfEnrtyTotal",
                         "BillOfEntries"."billingOfEntryDate"
                FROM "Billings"
                INNER JOIN "Branches" ON "Branches".id = "Billings"."branchId"
                INNER JOIN "Suppliers" ON "Suppliers".id = "Billings"."supplierId"
                LEFT JOIN "BillOfEntries" ON "Billings".id = "BillOfEntries"."billingId" 
                LEFT JOIN "Media"  ON "Media".id = "Billings"."mediaId" 
                LEFT JOIN "BillingPaymentLines"   ON "BillingPaymentLines"."billingId" = "Billings".id 
                WHERE "Billings".id=$1
                and "Branches"."companyId" = $2
                group by "Billings".id,"Suppliers".id ,"Branches".id,"Media".id,   "BillOfEntries".id ), 
				
				"applyCredit" as (
				select  "bill".id , COALESCE(sum( "SupplierAppliedCredits".amount),0)as "appliedCredit"  FROM "bill"
				LEFT JOIN "SupplierAppliedCredits" 
                ON "SupplierAppliedCredits"."billingId" = "bill".id 
					group by "bill".id 
				
				),
					"refundLines" as (
				select  "bill".id ,  COALESCE(sum("SupplierCreditLines".total),0)as "refunded" FROM "bill"
                inner join "BillingLines" on "BillingLines"."billingId" = "bill".id 
				inner JOIN "SupplierCreditLines"  ON "SupplierCreditLines"."billingLineId" = "BillingLines".id 
					group by "bill".id 
				
				), "rounding" as (
                   select "bill".id  ,  COALESCE(sum("SupplierCredits"."roundingTotal" ),0) as "refunded" FROM "bill"
                   inner join "SupplierCredits" on "SupplierCredits"."billingId" = "bill".id
                   group by "bill".id 
                ),"refund" as (
			      select "refundLines".id, COALESCE("refundLines"."refunded"::text::numeric ,0) +  COALESCE("rounding"."refunded"::text::numeric ,0)    as "refunded"    from "refundLines" 
                  left join "rounding" on "rounding".id = "refundLines".id 
				)
				
				select "bill".*,
				"refund"."refunded" ,
				"applyCredit"."appliedCredit" 
				
				from "bill"
				left join "refund" on "bill".id = "refund".id
				left join "applyCredit" on "bill".id = "applyCredit".id `,
                values: [billingId, company.id]
            }
            const billingData = await client.query(query.text, query.values)
            const billing: any = billingData.rows[0];
            const bill = new Billing();
            bill.ParseJson(billing);
            bill.setBalance()


            query.text = `SELECT
                        "BillingLines".id,
                        "BillingLines". qty,
                        "BillingLines"."unitCost",
                        "BillingLines"."productId",
                        "BillingLines".barcode,
                        "BillingLines". "accountId",
                        "Accounts".name AS "accountName",
                        "Accounts"."parentType" as "accountParentType",
                        "Accounts"."type" as "accountType",
                        "BillingLines".note,
                        "BillingLines"."taxId",
                        "BillingLines"."employeeId",
                        "BillingLines"."taxPercentage",
                        "BillingLines".taxes,
                        "BillingLines"."taxType",
                        "BillingLines"."taxTotal",
                        "BillingLines"."index",
                        "BillingLines"."subTotal",
                        "BillingLines"."batch",
                        "BillingLines"."serial",
                        "BillingLines"."total",
                        "BillingLines"."SIC",
                        "BillingLines"."isInclusiveTax",
                        "BillingLines"."parentId",
                        "BillingLines"."baseAmount",
                        "BillingLines"."billDiscount",
                        "BillingLines"."discountPercentage",
                        "BillingLines"."discountTotal",
                        "BillingLines"."discountAmount",
                        "BillingLines"."taxableAmount",
                        "BillingLines"."applyDiscountBeforeTax",
                        "BillingLines"."discountIncludesTax",
                        "BillingLines"."parentId",
                        "Products".name AS "productName",
                        "Products".type AS "productType",
                        "Products"."UOM" AS "UOM",
                        "Taxes".name AS "taxName",
                        case when count( "SupplierCreditLines".id) > 0 then true else false end as "isReturned",
                        CAST ("BillingLines"."prodDate" AS TEXT ),
                        CAST ( "BillingLines"."expireDate" AS TEXT),
                        "BillingLines"."SIC"
                FROM "BillingLines"
                LEFT JOIN "Products"
                ON "Products".id = "BillingLines"."productId"
                INNER JOIN "Accounts" 
                ON "Accounts".id = "BillingLines"."accountId"
                INNER JOIN "Billings"
                ON "Billings".id = "BillingLines"."billingId"
                      left JOIN "Taxes"
                ON "Taxes".id = "BillingLines"."taxId"
                LEFT JOIN "SupplierCreditLines" 
                ON "SupplierCreditLines"."billingLineId" = "BillingLines".id
                LEFT JOIN "BranchProducts" ON  "BranchProducts"."branchId" = "Billings"."branchId" and "BranchProducts"."productId" = "Products".id 
                LEFT JOIN "ProductBatches" ON "ProductBatches"."batch" = "BillingLines"."batch" AND "ProductBatches"."branchProductId"  = "BranchProducts".id
                WHERE "Billings".id=$1
                group by  "BillingLines".id,"Accounts".id, "Products".id,  "ProductBatches"."prodDate", "ProductBatches"."expireDate","Taxes".id
                order by  "BillingLines".index ASC , "BillingLines"."createdAt" DESC 
                `;



            if (bill && (bill.id != "" && bill.id != null)) {
                const line: any = await client.query(query.text, [billingId])
                if (line.rows) {
                    for (let index = 0; index < line.rows.length; index++) {
                        const element = line.rows[index];
                        let billingLine = new BillingLine();
                        billingLine.ParseJson(element)
                        if (element.productId != null) {

                            billingLine.selectedItem.id = element.productId;
                            billingLine.selectedItem.name = element.productName;
                            billingLine.selectedItem.type = element.productType;


                        }

                        bill.lines.push(billingLine)
                    }
                }
            }
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

            bill.calculateTotal(company.afterDecimal);

            query.text = `SELECT "BillingPayments".id,
                                "BillingPaymentLines".amount,
                                "PaymentMethods".name as "paymentMethodName",
                               CAST( "BillingPaymentLines"."createdAt" AS TEXT),
                               (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',"Media"."url"->>'defaultUrl','mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("BillingPayments"."attachment") as attachments(attachments)
                               inner join "Media" on "Media".id = (attachments->>'id')::uuid
                               ) as "attachment"
                          from "BillingPayments"
                          inner join "BillingPaymentLines" on "BillingPaymentLines"."billingPaymentId"= "BillingPayments".id 
                          inner join "PaymentMethods" on "PaymentMethods".id =  "BillingPayments"."paymentMethodId"
                          LEFT JOIN "Media" ON "Media".id = "BillingPayments"."mediaId" 
                          where "BillingPaymentLines"."billingId" = $1
                     `

            query.values = [bill.id];

            let payments = await client.query(query.text, query.values)
            bill.billingPayments = payments.rows;

            return new ResponseData(true, "", bill)
        } catch (error: any) {

            throw new Error(error.message)
        }
    }

    public static async getBillById(billingId: string, company: Company) {

        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            const query: { text: string, values: any } = {
                text: `SELECT
                        "Billings".id, 
                        "Billings"."mediaId", 
                        "Media"."url"->>'defaultUrl' as "mediaUrl",
                        "Billings"."createdAt",
                        CAST("Billings"."dueDate" AS TEXT) AS "dueDate" ,
                        "Billings"."paymentTerm",
                        "Billings"."billingNumber",
                        "Billings".reference,
                        "Billings"."branchId",
                        "Billings".total,
                        "Billings".status,
                           "Billings"."smallestCurrency",
                           "Billings"."customFields",
                             "Billings"."roundingTotal",
                             "Billings"."roundingType",
                        "Suppliers"."vatNumber" as "supplierVatNumber" ,
                        CAST( "Billings"."billingDate"  AS TEXT) AS "billingDate" ,
                        "Billings"."employeeId",
                        (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',"Media"."url"->>'defaultUrl','mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("Billings"."attachment") as attachments(attachments)
                        inner join "Media" on "Media".id = (attachments->>'id')::uuid
                        ) as "attachment",
                        "Branches".name AS "branchName",
                        "Branches".address as "branchAddress",
                        "Branches"."phoneNumber" as "branchPhone",
                        "Suppliers".name AS "supplierName",
                        "Billings"."supplierId",
                        "Billings"."isInclusiveTax",
                    
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
                AND "Branches"."companyId"=$2
                group by "Billings".id,"Suppliers".id ,"Branches".id,"Media".id `,
                values: [billingId, company.id]
            }
            const billingData = await client.query(query.text, query.values)
            const billing: any = billingData.rows[0];
            const bill = new Billing();
            bill.ParseJson(billing);
            bill.setBalance()


            query.text = `SELECT
                        "BillingLines".id,
                        "BillingLines". qty,
                        "BillingLines"."unitCost",
                        "BillingLines"."productId",
                        "BillingLines".barcode,
                        "BillingLines". "accountId",
                        "Accounts".name AS "accountName",
                        "Accounts"."parentType" as "accountParentType",
                        "Accounts"."type" as "accountType",
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
                        "BillingLines"."SIC",
                        "BillingLines"."isInclusiveTax",
                        "BillingLines"."discountIncludesTax",
                        "BillingLines"."parentId",
                        "Products".name AS "productName",
                        "Products".type AS "productType",
                        "Products"."UOM" AS "UOM",
                        case when count( "SupplierCreditLines".id) > 0 then true else false end as "isReturned",
                        CAST ("BillingLines"."prodDate" AS TEXT ),
                        CAST ( "BillingLines"."expireDate" AS TEXT),
                        "BillingLines"."SIC"
                FROM "BillingLines"
                LEFT JOIN "Products"
                ON "Products".id = "BillingLines"."productId"
                INNER JOIN "Accounts" 
                ON "Accounts".id = "BillingLines"."accountId"
                INNER JOIN "Billings"
                ON "Billings".id = "BillingLines"."billingId"
                LEFT JOIN "SupplierCreditLines" 
                ON "SupplierCreditLines"."billingLineId" = "BillingLines".id
                LEFT JOIN "BranchProducts" ON  "BranchProducts"."branchId" = "Billings"."branchId" and "BranchProducts"."productId" = "Products".id 
                LEFT JOIN "ProductBatches" ON "ProductBatches"."batch" = "BillingLines"."batch" AND "ProductBatches"."branchProductId"  = "BranchProducts".id
                WHERE "Billings".id=$1
                group by  "BillingLines".id,"Accounts".id, "Products".id,  "ProductBatches"."prodDate", "ProductBatches"."expireDate"`;





            if (bill && (bill.id != "" && bill.id != null)) {
                const line: any = await client.query(query.text, [billingId])
                if (line.rows) {
                    for (let index = 0; index < line.rows.length; index++) {
                        const element = line.rows[index];
                        let billingLine = new BillingLine();
                        billingLine.ParseJson(element)
                        if (element.productId != null) {

                            billingLine.selectedItem.id = element.productId;
                            billingLine.selectedItem.name = element.productName;
                            billingLine.selectedItem.type = element.productType;
                        }

                        bill.lines.push(billingLine)
                    }
                }
            }
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

            bill.calculateTotal(company.afterDecimal);

            query.text = `SELECT "BillingPayments".id,
                                "BillingPaymentLines".amount,
                                "PaymentMethods".name as "paymentMethodName",
                               CAST( "BillingPaymentLines"."createdAt" AS TEXT),
                               (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',"Media"."url"->>'defaultUrl','mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("BillingPayments"."attachment") as attachments(attachments)
                               inner join "Media" on "Media".id = (attachments->>'id')::uuid
                               ) as "attachment"
                          from "BillingPayments"
                          inner join "BillingPaymentLines" on "BillingPaymentLines"."billingPaymentId"= "BillingPayments".id 
                          inner join "PaymentMethods" on "PaymentMethods".id =  "BillingPayments"."paymentMethodId"
                          LEFT JOIN "Media" ON "Media".id = "BillingPayments"."mediaId" 
                          where "BillingPaymentLines"."billingId" = $1
                     `

            query.values = [bill.id];

            let payments = await client.query(query.text, query.values)
            bill.billingPayments = payments.rows;

            await client.query("COMMIT");

            return new ResponseData(true, "", bill)
        } catch (error: any) {

            await client.query("ROLLBACK");
            throw new Error(error.message)
        } finally {
            client.release();
        }
    }

    public static async getBillingsList(data: any, company: Company, branchList: []): Promise<ResponseData> {
        try {
            const companyId = company.id;

            // --- Normalize paging/sorting/search ---
            const page = Number.isFinite(+data?.page) && +data.page > 0 ? +data.page : 1;
            const limit = Number.isFinite(+data?.limit) && +data.limit > 0 ? +data.limit : 15;

            const searchTerm: string | undefined =
                typeof data?.searchTerm === 'string' && data.searchTerm.trim() !== ''
                    ? data.searchTerm.trim()
                    : undefined;

            const branches: string[] =
                (data?.filter?.branches?.length ? data.filter.branches : branchList) as string[];

            const status: string[] =
                (data?.filter?.status?.length ? data.filter.status : ['Open', 'Paid', 'Partially Paid', 'Draft', 'Closed']);

            const fromDate: string | undefined = data?.filter?.fromDate;
            const toDate: string | undefined = data?.filter?.toDate;

            const incomingSortBy = data?.sortBy?.sortValue as string | undefined;
            const incomingSortDir = String(data?.sortBy?.sortDirection || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

            const sortByKey = incomingSortBy === 'billingNumber' ? 'billingNumberSort' :
                incomingSortBy ? incomingSortBy : 'billingDateThenTime';
            const sortDir = incomingSortDir;

            // --- Table + Alias Definitions ---
            const aliasMap = {
                bl: 'Billings',
                b: 'Branches',
                s: 'Suppliers',
                e: 'Employees',
                po: 'PurchaseOrders',
                boe: 'BillOfEntries'
            } as const;

            const joinDefs = {
                joinBranch: { joinTable: 'b', onLocal: 'bl.branchId', onForeign: 'b.id' },
                joinSupplier: { joinTable: 's', onLocal: 'bl.supplierId', onForeign: 's.id', type: 'LEFT' as const },
                joinEmployee: { joinTable: 'e', onLocal: 'bl.employeeId', onForeign: 'e.id', type: 'LEFT' as const },
                joinPurchaseOrder: { joinTable: 'po', onLocal: 'bl.purchaseOrderId', onForeign: 'po.id', type: 'LEFT' as const },
                joinBillOfEntry: { joinTable: 'boe', onLocal: 'bl.id', onForeign: 'boe.billingId', type: 'LEFT' as const }
            };

            const columnMap: TableConfig['columnMap'] = {
                id: { table: 'bl', dbCol: 'id' },
                billingNumber: { table: 'bl', dbCol: 'billingNumber' },
                billingDate: { table: 'bl', dbCol: 'billingDate', cast: 'timestamp' },
                createdAt: { table: 'bl', dbCol: 'createdAt', cast: 'timestamp' },
                discount: { table: 'bl', dbCol: 'discount', cast: 'numeric' },
                dueDate: { table: 'bl', dbCol: 'dueDate', cast: 'timestamp' },
                paymentTerm: { table: 'bl', dbCol: 'paymentTerm' },
                note: { table: 'bl', dbCol: 'note' },
                reference: { table: 'bl', dbCol: 'reference' },
                status: { table: 'bl', dbCol: 'status' },
                total: { table: 'bl', dbCol: 'total', cast: 'numeric' },
                supplierId: { table: 'bl', dbCol: 'supplierId' },
                purchaseOrderId: { table: 'bl', dbCol: 'purchaseOrderId' },
                companyId: { table: 'bl', dbCol: 'companyId' },
                branchId: { table: 'bl', dbCol: 'branchId' },

                // Computed columns
                time: { rawExpr: `bl."createdAt"::timestamp::time`, table: 'bl', dbCol: 'createdAt' },

                billingDateThenTime: {
                    rawExpr: `(bl."billingDate"::date, bl."createdAt"::timestamp::time)`,
                    table: 'bl', dbCol: 'billingDate'
                },

                billingNumberSort: {
                    rawExpr: `COALESCE(NULLIF(regexp_substr(regexp_substr(bl."billingNumber", '[_.+=-]\\d*$'), '\\d*$'), ''), '0')::int`,
                    table: 'bl', dbCol: 'billingNumber', cast: 'int'
                },

                // Joined display fields
                branchName: { table: 'b', dbCol: 'name', joinRequired: 'joinBranch' },
                supplierName: { table: 's', dbCol: 'name', joinRequired: 'joinSupplier' },
                employeeName: { table: 'e', dbCol: 'name', joinRequired: 'joinEmployee' },
                purchaseNumber: { table: 'po', dbCol: 'purchaseNumber', joinRequired: 'joinPurchaseOrder' },
                billOfEntryId: { table: 'boe', dbCol: 'id', joinRequired: 'joinBillOfEntry' },

                // Computed flags
                internationalSupplier: {
                    rawExpr: `CASE WHEN COALESCE(NULLIF(s."country", ''), NULL) IS NOT NULL AND s."country" <> '${company.country}' THEN true ELSE false END`,
                    table: 's', dbCol: 'country'
                },
                allowBillOfEntry: {
                    rawExpr: `CASE WHEN COALESCE(NULLIF(s."country", ''), NULL) IS NOT NULL AND s."country" <> '${company.country}' AND boe.id IS NULL THEN true ELSE false END`,
                    table: 'boe', dbCol: 'id'
                }
            };

            const searchableColumns = ['supplierName', 'branchName', 'billingNumber', 'reference'];

            const DEFAULT_COLUMNS = [
                'id', 'billingNumber', 'billingDate', 'createdAt', 'time', 'discount',
                'dueDate', 'paymentTerm', 'note', 'reference', 'status', 'total',
                'supplierId', 'supplierName', 'employeeName', 'branchName',
                'purchaseOrderId', 'purchaseNumber', 'billOfEntryId',
                'internationalSupplier', 'allowBillOfEntry'
            ];



            // --- Load Custom Fields ---
            const customization = await CustomizationRepo.getCustomizationByKey('bill', 'customFields', company);
            const customFields = customization?.data?.customFields || [];
      
            for (const field of (customFields || [])) {
                const key = String(field.id).replace(/"/g, '');
                const outKey = String(field.abbr || key).replace(/\s+/g, '_');
                columnMap[outKey] = { table: 'bl', dbCol: 'customFields', jsonKV: { key: field.id, cast: 'text' } };
            }

            const selectableColumns = [
                ...DEFAULT_COLUMNS,
                'billingDateThenTime', 'billingNumberSort', 'companyId', 'branchId',
                ...Object.keys(columnMap).filter(k => !DEFAULT_COLUMNS.includes(k))

            ];
            const BillingConfig: TableConfig = {
                aliasMap,
                columnMap,
                joinDefs,
                searchableColumns,
                selectableColumns
            };


            const service = new TableDataService(BillingConfig);

            // --- Filters ---
            const filters: TableRequest['filters'] = [
                { column: 'companyId', operator: 'eq', value: companyId }
            ];
            if (branches?.length) filters.push({ column: 'branchId', operator: 'in', value: branches });
            if (status?.length) filters.push({ column: 'status', operator: 'in', value: status });
            if (fromDate) filters.push({ column: 'billingDate', operator: 'ge' as any, value: fromDate });
            if (toDate) filters.push({ column: 'billingDate', operator: 'le' as any, value: toDate });

            // --- Column selection ---
            const userCols = Array.isArray(data?.columns) ? (data.columns as string[]).map(String) : DEFAULT_COLUMNS;
            let selectColumns = userCols.filter(c => selectableColumns.includes(c));
            if (!selectColumns.length) selectColumns = DEFAULT_COLUMNS;
            if (!selectColumns.includes('id')) selectColumns.push('id');
            if (selectColumns.includes('purchaseNumber')) selectColumns.push('purchaseOrderId');


            // --- Table Request ---
            const req: TableRequest = {
                table_name: 'Billings',
                select_columns: selectColumns as any,
                filters,
                search_term: searchTerm,
                sort_by: selectableColumns.includes(sortByKey) ? (sortByKey as any) : ('billingDateThenTime' as any),
                sort_order: sortDir,
                page_number: page,
                page_size: limit
            };

            const result = await service.getTableData<any>(req);
            const list = result.data.map((row: any) => getValuable(row));

            const total_count = result.total_count;
            const pageCount = Math.ceil(total_count / limit) || 1;
            const startIndex = (page - 1) * limit + 1;
            const lastIndex = Math.min(page * limit, total_count);

            const resData = {
                list,
                count: total_count,
                pageCount,
                startIndex,
                lastIndex
            };

            return new ResponseData(true, "", resData);

        } catch (error: any) {

            throw new Error(error?.message ?? String(error));
        }
    }



    public static async getBillingsList1(data: any, company: Company, brancheLists: []) {
        try {
            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : brancheLists

            let searchValue = data.searchTerm ? data.searchTerm.toLowerCase().trim() : null

            let offset = 0;
            let page = data.page ?? 1

            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            let sort = data.sortBy;
            let sortValue = !sort ? ' "Billings"."createdAt"' : '"' + sort.sortValue + '"';

            if (sort && sort.sortValue == "billingNumber") {
                sortValue = ` regexp_replace("billingNumber", '[A-Za-z0-9]*[_.+=-]', '')::int`
            }


            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = `  Order by ` + sortTerm;
            let billigs = [];
            const filter = data.filter
            const fromDate = filter && filter.fromDate ? filter.fromDate : null
            const toDate = filter && filter.toDate ? filter.toDate : null
            const query: { text: string, values: any } = {
                text: `
                    SELECT  count(*) over(),
                            "Billings".id,
                            "Billings"."billingNumber",
                            "Billings"."createdAt",
                            "Billings".discount, 
                            "Billings"."dueDate",
                            "Billings"."paymentTerm",
                            "Billings".note, 
                            "Billings".reference,
                            "Billings".status,
                            "Billings".total,
                            "Billings"."billingDate",
                            "Billings"."supplierId",
                            "Billings"."purchaseOrderId",
                            "PurchaseOrders"."purchaseNumber",
                            "Suppliers".name as "supplierName",
                            "Employees".name as "employeeName",
                            "Branches".name as "branchName",
                            case when  COALESCE(NULLIF("Suppliers"."country", ''), NULL)  is not null and "Suppliers"."country" <>'${company.country}'  then true else false end as "internationalSupplier",
                          case when  COALESCE(NULLIF("Suppliers"."country", ''), NULL)  is not null and "Suppliers"."country" <>'${company.country}'  and "BillOfEntries".id is null then true else false end as "allowBillOfEntry",
                
                            "BillOfEntries".id as "billOfEntryId"
                    FROM "Billings"
                    left JOIN "Suppliers" ON "Suppliers".id = "Billings"."supplierId"
                    left JOIN "Employees" ON "Employees".id = "Billings"."employeeId"
                    left JOIN "Branches"  ON "Branches".id =  "Billings"."branchId"
                    left JOIN "PurchaseOrders"  ON "PurchaseOrders".id =  "Billings"."purchaseOrderId"
                    LEFT JOIN "BillOfEntries" ON "Billings".id = "BillOfEntries"."billingId" 
                    where "Branches"."companyId"=$1
                    and ( $2::TEXT IS NULL OR
                     (   LOWER("Suppliers".name) ~$2
                        OR LOWER("Branches".name) ~$2
                        OR LOWER("Billings"."billingNumber") ~$2
                        OR nullif(regexp_replace("billingNumber", '[A-Z]*-', ''),'') ~ $2
                        OR      LOWER(         "Billings".reference)~ $2)
                         )
                    AND (array_length($3::uuid[], 1) IS NULL OR ("Branches".id=any($3::uuid[])))
                    AND ($4::Date IS NULL OR "Billings"."billingDate"::date >= $4::date)
                    AND ($5::Date IS NULL OR "Billings"."billingDate"::date <= $5::date)
                    group by "Billings".id,"Suppliers".id , "Employees".id,"Branches".id,"BillOfEntries".id, "PurchaseOrders".id
                     ${orderByQuery}
                    limit $6 offset $7
                   `,
                values: [company.id, searchValue, branches, fromDate, toDate, limit, offset]
            }


            // when data is empty return the whole list 

            const selectList = await DB.excu.query(query.text, query.values)
            for (let index = 0; index < selectList.rows.length; index++) {
                let bill = new Billing();
                const element = selectList.rows[index];
                bill.ParseJson(element);
                // bill.setStatus();
                billigs.push(bill)
            }

            let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }




            const resData = {
                list: billigs,
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


    /**When preforming single bill payment */
    public static async getBillForPayment(billId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `with  "payment" as(SELECT 
                            total::text::numeric -(COALESCE(sum("BillingPaymentLines".amount::text::numeric),0)+COALESCE(sum("SupplierAppliedCredits".amount::text::numeric),0)) as "balance",
                            "Billings"."billingNumber",
                            "Billings".id as "billingId",
                            "Billings"."supplierId",
                             "Billings"."branchId"
                FROM "Billings"
                LEFT JOIN "BillingPaymentLines" 
                ON "Billings".id = "BillingPaymentLines"."billingId"
                LEFT JOIN "SupplierAppliedCredits"
                ON "SupplierAppliedCredits". "billingId" = "Billings".id 
                WHERE "Billings".id =$1
                group by "Billings".id
                    ),
                    "supplierCreditLines"  as (
                    select  "payment"."billingId" , sum("SupplierCreditLines".total::text::numeric) as "total" from "payment"
                    inner join "BillingLines" on "BillingLines"."billingId"  =  "payment"."billingId"
                    inner join "SupplierCreditLines" on "SupplierCreditLines"."billingLineId" = "BillingLines"."id"
                    group by "payment"."billingId"
                    ),
                    "supplierCreditRounding"  as (
                    select  "payment"."billingId" , sum("SupplierCredits"."roundingTotal"::text::numeric) as "total" from "payment"
                    inner join "SupplierCredits" on "SupplierCredits"."billingId" = "payment"."billingId"
                    group by "payment"."billingId"
                    ),
                    "supplierCredit"  as (
                    select  "supplierCreditLines"."billingId" , COALESCE("supplierCreditLines".total::text::numeric,0) +  COALESCE("supplierCreditRounding".total::text::numeric,0)  as "total" from "supplierCreditLines"
                    left join "supplierCreditRounding" on "supplierCreditRounding"."billingId" = "supplierCreditLines"."billingId"
               
                    )

                    select
                               ( "payment"."balance"::text::numeric - COALESCE("supplierCredit"."total"::text::numeric,0) )::float as "balance",
                                            "payment"."billingNumber",
                                                "payment"."billingId",
                                                "payment"."supplierId"	,
                                                "payment"."branchId"					
                    from "payment"
                    left join "supplierCredit" on "supplierCredit"."billingId" =      "payment"."billingId"`,
                values: [billId]
            }
            const invoicePayment = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", invoicePayment.rows[0])
        } catch (error: any) {

            throw new Error(error.message)
        }
    }


    /**Used to convert Bill from Draft to Open */
    /** Delete only Open Bill Are Allowed to be deleted the following function check if bill has no:
     * Paymnest
     * AppliedCredit
     * SupplierCredit
     */
    public static async isBillOpen(client: PoolClient, billId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `select status from "Billings" 
                left join "SupplierCredits" on "SupplierCredits"."billingId" =   "Billings".id 
                left join "BillingPaymentLines" on "BillingPaymentLines"."billingId" =  "Billings".id 
                left join "SupplierAppliedCredits" on "SupplierAppliedCredits"."billingId" =   "Billings".id 
                where "Billings".id  = $1
                group by "Billings".id,"SupplierCredits".id ,"SupplierAppliedCredits".id,"BillingPaymentLines".id
                having sum(COALESCE("SupplierCredits"."total",0))=0 and sum(COALESCE("BillingPaymentLines".amount,0))=0 and sum(COALESCE("SupplierAppliedCredits".amount,0))=0`,
                values: [billId]
            }

            let bill = await client.query(query.text, query.values);
            if (bill.rowCount != null && bill.rowCount > 0) {

                /** check for solds serials */
                query.text = ` 
                select count("InvoiceLines".id) as "count" , Json_agg("InvoiceLines".serial) as "serilas"  
                from "BillingLines" 
                inner join "Products" on "Products".id = "BillingLines"."productId"
                inner Join "InvoiceLines" on "InvoiceLines"."productId" = "BillingLines"."productId" and "InvoiceLines".serial = "BillingLines"."serial"
                where "BillingLines"."billingId" = $1
                and "Products".type = 'serialized'
                `
                let serilaSales = await client.query(query.text, query.values);

                if (serilaSales.rows && serilaSales.rows.length > 0 && serilaSales.rows[0].count > 0) {
                    throw new Error(`Cannot Delete Bill Due To Sales on Serials : ${serilaSales.rows[0].serilas}`)
                }

                return true
            }
            throw new ValidationException("Cannot delete bill")
        } catch (error: any) {

            throw new Error(error)
        }
    }
    public static async deleteBillMovment(client: PoolClient, billId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `delete from "InventoryMovmentLines" using "InventoryMovments", "Billings", "BillingLines"
                where "InventoryMovmentLines"."inventoryMovmentId" = "InventoryMovments".id 
                and  "InventoryMovments"."billingLineId" =  "BillingLines".id 
                and  "Billings".id = "BillingLines"."billingId" 
                and "Billings".id=$1`,
                values: [billId]
            }

            await client.query(query.text, query.values)
            query.text = `delete from "InventoryMovments" using "Billings", "BillingLines"
            where  "InventoryMovments"."billingLineId" =  "BillingLines".id 
            and  "Billings".id = "BillingLines"."billingId" 
            and "Billings".id=$1`
            await client.query(query.text, query.values)

        } catch (error: any) {

            throw new Error(error)
        }
    }
    public static async deleteBill(billId: string, company: Company, employeeId: string) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            await this.isBillOpen(client, billId)



            let billingLinesQuery = {
                text: `SELECT JSON_AGG("BillingLines".id) as "ids",
                                  "Billings"."branchId",
                                   "Billings"."billingDate", 
                                   "Billings"."supplierId",
                                   "Billings"."billingNumber",
                                   "Billings"."purchaseOrderId",
                                   "Employees"."name" as "employeeName"
                        FROM "BillingLines" 
                        INNER JOIN "Billings" on "Billings".id = "BillingLines"."billingId"
                        INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2

                        where "billingId" = $1
                        group by "Billings".id, "Employees".id
                        `,
                values: [billId, employeeId, company.id]
            }

            let billingLineIds = await client.query(billingLinesQuery.text, billingLinesQuery.values);
            let lineIds = billingLineIds.rows && billingLineIds.rows.length > 0 && billingLineIds.rows[0].ids ? billingLineIds.rows[0].ids : []
            let branchId = billingLineIds.rows && billingLineIds.rows.length > 0 && billingLineIds.rows[0].branchId ? billingLineIds.rows[0].branchId : null
            let billingDate = billingLineIds.rows && billingLineIds.rows.length > 0 && billingLineIds.rows[0].billingDate ? billingLineIds.rows[0].billingDate : null
            let supplierId = billingLineIds.rows && billingLineIds.rows.length > 0 && billingLineIds.rows[0].supplierId ? billingLineIds.rows[0].supplierId : null
            let billingNumber = billingLineIds.rows && billingLineIds.rows.length > 0 && billingLineIds.rows[0].billingNumber ? `${billingLineIds.rows[0].billingNumber}` : ''
            let employeeName = billingLineIds.rows && billingLineIds.rows.length > 0 && billingLineIds.rows[0].employeeName ? `${billingLineIds.rows[0].employeeName}` : ''
            let purchaseOrderId = billingLineIds.rows && billingLineIds.rows.length > 0 && billingLineIds.rows[0].purchaseOrderId ? `${billingLineIds.rows[0].purchaseOrderId}` : ''

            await CompanyRepo.validateTransactionDate(client, billingDate, branchId, company.id);
            await this.deleteBillMovment(client, billId)
            let bill = await this.getBillingById(client, billId, company)
            /** only if account parent type = Other Current Assets'  and type = Inventory Assets */
            if (bill.data.status == "Open") {
                await this.removeBillInventory(client, bill.data, company.afterDecimal)

            }
            const query: { text: string, values: any } = {
                text: `delete from "BillingLines" using "Billings"
                where  "Billings".id = "BillingLines"."billingId" 
                and "Billings".id=$1`,
                values: [billId]
            }
            await client.query(query.text, query.values);

            query.text = `delete from "Billings" 
            where "Billings".id=$1;`
            await client.query(query.text, query.values);

            //addLog 
            let log = new Log();
            log.employeeId = employeeId
            log.action = 'Bill Deleted'
            log.comment = `${employeeName} has deleted bill number ${billingNumber}`
            log.metaData = { "deleted": true }

            await LogsManagmentRepo.manageLogs(client, "Billings", billId, [log], branchId, company.id, employeeId, billingNumber, "Cloud")


            await client.query("COMMIT")

            return new ResponseData(true, "", { ids: lineIds, supplierId: supplierId, purchaseOrderId: purchaseOrderId })
        } catch (error: any) {
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async removeBillInventory(client: PoolClient, bill: Billing, afterDecimal: number) {
        try {

            for (let index = 0; index < bill.lines.length; index++) {
                const element = bill.lines[index];
                const accountData = await AccountsRepo.getAccountType(client, element.accountId)
                const accountType = accountData.type
                const accountParentType = accountData.parentType;
                /** only if account parent type = Other Current Assets'  and type = Inventory Assets */
                if (accountParentType == 'Other Current Assets' && accountType == "Inventory Assets") {
                    if (element.productId != null && element.productId != "") {
                        const productType = await ProductRepo.getProductType(client, element.productId)
                        switch (productType) {
                            case "inventory":
                                element.qty = 0;

                                // await this.updateProductUnitCost(client, bill.branchId, element, afterDecimal)

                                break;
                            case "batch":
                                if (element.batches) {
                                    for (let index = 0; index < element.batches.length; index++) {
                                        const batchElement = element.batches[index];
                                        await BatchProductRepo.deleteBatch(client, bill.branchId, batchElement.batch)
                                    }
                                }


                                break;
                            case "serialized":
                                if (element.serials) {
                                    for (let index = 0; index < element.serials.length; index++) {
                                        const serialElement = element.serials[index];
                                        await SerialProductRepo.deleteSerial(client, serialElement.serial, bill.branchId, element.productId)
                                    }
                                }

                                break;
                            default:
                                break;
                        }
                    }
                }
            }
        } catch (error: any) {

            throw new Error(error)
        }
    }

    /**Used to convert Bill from Draft to Open */
    public static async getFullBill(client: PoolClient, billingId: string) {

        try {

            const query: { text: string, values: any } = {
                text: `SELECT * FROM "Billings"  where id =$1`,
                values: [billingId]
            }

            let bill = await client.query(query.text, query.values);

            query.text = `SELECT "BillingLines".*,
                                 "Products".type as "productType"
                         FROM "BillingLines"
                        LEFT JOIN "Products" on "BillingLines"."productId" = "Products".id
                         where "billingId" =$1`

            let lines = await client.query(query.text, query.values);

            bill.rows[0].lines = lines.rows


            bill.rows[0].lines.filter((f: any) => f.parentId != null).forEach((element: any) => {
                const Line = bill.rows[0].lines.find((f: any) => f.id == element.parentId);

                if (Line != null) {
                    const index = bill.rows[0].lines.indexOf(Line);
                    bill.rows[0].lines[index].batches = bill.rows[0].lines[index].batches ?? []
                    bill.rows[0].lines[index].serials = bill.rows[0].lines[index].serials ?? []
                    if (Line.productType == "batch") {
                        bill.rows[0].lines[index].batches.push(element)
                    } else if (Line.productType == "serialized") {
                        bill.rows[0].lines[index].serials.push(element)
                    }
                    bill.rows[0].lines.splice(bill.rows[0].lines.indexOf(element), 1);
                }

            });
            return new ResponseData(true, "", bill.rows[0])
        } catch (error: any) {


            throw new Error(error)
        }
    }
    public static async saveOpenBill(billingId: string, company: Company, employeeId: string) {
        const client = await DB.excu.client()
        try {
            let bill = (await this.getFullBill(client, billingId)).data;
            bill.status = "Open"
            await client.query("BEGIN")
            await this.editBilling(client, bill, company, employeeId)
            await client.query("COMMIT")

            return new ResponseData(true, "", { "purchaseOrderId": bill.purchaseOrderId })
        } catch (error: any) {
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    //Inventory Movment Only Applied when account type is inventory assets 
    public static async getBillingLineAccountType(client: PoolClient, lineId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "Accounts".type,"Accounts"."parentType" FROM "BillingLines"
                   INNER JOIN "Accounts"
                   on "BillingLines"."accountId" = "Accounts".id
                   where "BillingLines".id =$1`,
                values: [lineId]
            }

            const account = await client.query(query.text, query.values);

            return {
                type: account.rows[0].type,
                parentType: account.rows[0].parentType
            }
        } catch (error: any) {

            throw new Error(error.message)
        }
    }
    /**Update OnHand only when line account type is inventory Assets */
    public static async addBillingInventory(client: PoolClient, billing: Billing, billingLine: BillingLine, branchId: string, companyId: string, afterDecimal: number) {
        try {
            const productType = await ProductRepo.getProductType(client, billingLine.productId)
            let productId = billingLine.productId;
            if (productId) {
                const isProductExistInBranch = await BranchProductsRepo.checkIfProductAlreadyExistInBarnch(client, productId, branchId);
                if (!isProductExistInBranch) {
                    const branchProduct = new BranchProducts();
                    branchProduct.productId = productId;
                    branchProduct.branchId = branchId;
                    branchProduct.companyId = companyId;
                    branchProduct.onHand = 0;
                    await BranchProductsRepo.insertBranchProduct(client, branchProduct)
                }
            }
            if (productType == 'batch' && ((billingLine.batch == "" && billingLine.parentId != null) || (billingLine.parentId == null && billingLine.batches.length == 0))) {
                throw new ValidationException("batch Is Required")
            }

            if (productType == 'serialized' && ((billingLine.serial == "" && billingLine.parentId != null) || (billingLine.parentId == null && billingLine.serials.length == 0))) {
                throw new ValidationException("serial Is Required")
            }
            switch (productType) {
                case 'inventory':
                /*Edit Movment when LineId exist and current Status (before edit) is already Open*/
                // if (billingLine.id != null && billingLine.id != "" && billing.currentBillingStatus == "Open") {  //Calculate and set Product Avergae unitCost and onHand

                //     await this.updateProductUnitCost(client, branchId, billingLine, afterDecimal)

                // } else {
                //     //Recalculate and set Product Avergae unitCost and onHand (WHEN LINE IS NEW OR STATUS CHANGES FROM "DRAFT TO OPEN")
                //     await ProductRepo.calculateUnitCostAvg(client, productId, branchId, billingLine.qty, billingLine.unitCost, afterDecimal)
                // }
                // break;
                case 'batch':
                    if (billingLine.parentId != null && billingLine.productId != "") {
                        await this.addBatchInventory(client, billing, billingLine, branchId, companyId, afterDecimal)

                    }
                    break;
                case 'serialized':
                    if (billingLine.parentId != null && billingLine.productId != "") {
                        await this.addSerialInventory(client, billing, billingLine, branchId, companyId, afterDecimal)
                    }
                    break;
                default:
                    break;
            }
        } catch (error: any) {

            throw new Error(error)
        }
    }
    public static async updateProductUnitCost(client: PoolClient, branchId: string, billingLine: BillingLine, afterDecimal: number) {
        try {
            const branchProductData = await BranchProductsRepo.getBranchProductAndUnitCost(client, billingLine.productId, branchId);
            const branchProduct = new BranchProducts();
            branchProduct.ParseJson(branchProductData);
            const oldMovmentLine = await this.getOldLine(client, billingLine.id);
            const qtyDifference = oldMovmentLine.qty - billingLine.qty;
            //  if(qtyDifference<0)
            //  {
            //   return  await ProductRepo.calculateUnitCostAvg(client, billingLine.productId, branchId, qtyDifference *(-1), billingLine.unitCost, afterDecimal)
            //  }
            const productId: any = billingLine.productId;
            //calculate OriginalUnitCost of Product before first purchase of line   
            /**
             * Example: 
             * productUnitCost(original) = 10 , currentOnHand(stock) = 5
             * first purchase(bill) unitCost = 9 , purchasedQty = 8
             * 
             * productUnitCost(after first purchase) = (10*5) +(9*8) / 5+8 =9.385 
             * 
             * edit bill to  unitCost = 9 , purchasedQty = 4
             * calculate orginal (unitCost= 10 and onHand= 9 ) from old movment and currentOnHand and currentUnitCost
             * 1st: currentCost * currentOnhand = 9.385 * (8+5) = 122.005
             * 2nd: currentOnHand - oldMovmentQty = (5+8) - 8 = 5 =>> original onHand
             * 3rd: currentCost - oldMovmentQtycost= 122.005 - 72 =50.005 original cost 
             * 
             * recalculate cost => edit bill to  unitCost = 9 , purchasedQty = 4
             * 
             * (originalCost+new billing cost)/(orginial qty+ billing qty) = (50.005 +(9*4))/(5+4) = 9.556 
             * 
             * 
             */

            const currentOnHand = branchProduct.onHand;
            const oldLineCost = oldMovmentLine.isInclusiveTax ? oldMovmentLine.subTotal - oldMovmentLine.taxTotal : oldMovmentLine.subTotal
            const currentCost = Helper.multiply(currentOnHand, branchProductData.unitCost, afterDecimal)
            const originalOnHand = Helper.sub(currentOnHand, oldMovmentLine.qty, afterDecimal)
            let originalCost = Helper.sub(currentCost, oldLineCost, afterDecimal)
            originalCost = originalCost < 0 ? originalCost * -1 : originalCost
            const billingCost = billingLine.isInclusiveTax ? Helper.multiply(billingLine.qty, billingLine.unitCost, afterDecimal) - billingLine.taxTotal : Helper.multiply(billingLine.qty, billingLine.unitCost, afterDecimal)

            //calculate new unitCost by Avarage
            // average = (oldUnitCost * oldOnHand) + (UnitCostAtPurchased * QtyAtPurchased) /  (oldOnHand +QtyAtPurchased)
            // originalCost = originalCost < 0 ? originalCost * (-1) :  originalCost; 
            let newOnHand = originalOnHand + branchProductData.openingBalance < 0 ? billingLine.qty : Helper.add(originalOnHand, billingLine.qty, afterDecimal)
            let newCost = 0;
            // if (billingLine.qty == oldMovmentLine.qty) {
            //     newOnHand = originalOnHand;
            //     newCost = Helper.division(originalCost, originalOnHand, afterDecimal)
            // } else {

            // newOnHand = originalOnHand + branchProductData.openingBalance < 0 ? billingLine.qty : Helper.add(originalOnHand, billingLine.qty, afterDecimal)
            newOnHand = Helper.add(originalOnHand, billingLine.qty, afterDecimal)
            // newCost = newOnHand == 0 || branchProduct.onHand < 0 || (originalCost + billingCost) == 0 ? billingLine.unitCost : Helper.division((originalCost + billingCost), newOnHand, afterDecimal)
            // }


            newCost = currentOnHand <= 0 || newOnHand <= 0 ? billingLine.unitCost : Helper.division((originalCost + billingCost), newOnHand, afterDecimal)


            // newCost = newCost<0 && originalCost<0 ? billingLine.unitCost  : newCost <0 ? billingLine.unitCost  :newCost  

            //update the current product unitCost 
            await ProductRepo.setProductUnitCost(client, newCost, productId, afterDecimal)
            // set new Qty 

            branchProduct.onHand = newOnHand;



            //update branchProduct on Hand 
            // await BranchProductsRepo.setNewOnHand(client, branchId, billingLine.productId, newOnHand)

            // update movment corresponding  to edited Billing Line 
            // await InventoryMovmentRepo.updateMovmentCost(client, oldMovmentLine.movmentId, billingCost * (-1))
            // await InventoryMovmentRepo.updateMovmentLineCostQty(client, oldMovmentLine.lineId, billingCost, billingLine.qty, currentOnHand, currentCost)
        } catch (error: any) {

            throw new Error(error.message)
        }
    }
    public static async getOldLine(client: PoolClient, billingLineId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT * FROM "BillingLines" where id=$1`,
                values: [billingLineId]
            }

            const line = await client.query(query.text, query.values);
            return line.rows[0]
        } catch (error: any) {

            throw new Error(error)
        }
    }
    public static async addBatchInventory(client: PoolClient, billing: Billing, billingLine: BillingLine, branchId: string, companyId: string, afterDecimal: number) {
        try {
            let batch = new Batches()
            let branchProductId = await BranchProductsRepo.getBranchProductId(client, billingLine.productId, branchId);
            if (billingLine.isDeleted && billingLine.id != null && billingLine.id != "") {
                await BatchProductRepo.deleteBatch(client, branchId, billingLine.batch)
                //Delete Line 

                return
            } else {
                /**Edit batch Only when billing is already saved and open */
                if (billingLine.id != null && billingLine.id != "" && billing.currentBillingStatus == "Open") {
                    if (billingLine.productId) {
                        batch.id = await BatchProductRepo.getBatchId(client, branchId, billingLine.batch, billingLine.productId)
                    }
                    batch.unitCost = billingLine.unitCost;
                    batch.onHand = billingLine.qty;
                    batch.prodDate = billingLine.prodDate;
                    batch.expireDate = billingLine.expireDate
                    batch.branchProductId = branchProductId;
                    batch.batch = billingLine.batch;
                    await BatchProductRepo.editBatch(client, batch)
                } else {
                    let isBatchExtist = await BatchProductRepo.checkIfBatchNumberExist(client, null, batch.batch, branchProductId);
                    if (isBatchExtist) {
                        throw new ValidationException("Batch Number Already Exist")
                    }
                    /**Add batch Only when  new Open Billing Or billing status is changing from "Draft" to Open */
                    batch.unitCost = billingLine.unitCost;
                    batch.onHand = billingLine.qty;
                    batch.prodDate = billingLine.prodDate;
                    batch.expireDate = billingLine.expireDate;
                    batch.branchProductId = branchProductId;
                    batch.companyId = companyId;
                    batch.batch = billingLine.batch;
                    await BatchProductRepo.addBatch(client, batch)

                }
            }
        } catch (error: any) {

            throw new Error(error)
        }
    }


    public static async addSerialInventory(client: PoolClient, billing: Billing, billingLine: BillingLine, branchId: string, companyId: string, afterDecimal: number) {
        try {
            let serial = new Serials()
            let branchProductId = await BranchProductsRepo.getBranchProductId(client, billingLine.productId, branchId);

            if (billingLine.isDeleted && billingLine.id != null && billingLine.id != "") {
                if (billingLine.productId) {
                    await SerialProductRepo.isSerialsHasSales(client, billingLine.productId, [billingLine.serial])
                    await SerialProductRepo.deleteSerial(client, billingLine.serial, branchId, billingLine.productId)
                }
                //Delete Line 

                return
            } else {
                if (billingLine.id != null && billingLine.id != "" && billing.currentBillingStatus == "Open") {

                    serial.unitCost = billingLine.unitCost;
                    serial.serial = billingLine.serial;
                    serial.companyId = companyId
                    serial.branchProductId = branchProductId;
                    if (billingLine.productId) {
                        serial.id = await SerialProductRepo.getSerialId(client, branchId, billingLine.productId, serial.serial)
                    }

                    if (billingLine.productId) {
                        await SerialProductRepo.editSerial(client, serial, billingLine.productId)

                    }
                } else {

                    serial.unitCost = billingLine.unitCost;
                    serial.serial = billingLine.serial;
                    serial.companyId = companyId
                    serial.branchProductId = branchProductId;
                    if (billingLine.productId) {
                        let isSerialExist = await SerialProductRepo.checkIfSerialExist(client, companyId, serial.serial, billingLine.productId);
                        if (isSerialExist) {
                            throw new ValidationException("Serial Number Already Exist")
                        }
                        await SerialProductRepo.addSerial(client, serial, billingLine.productId)
                    }
                }
            }
        } catch (error: any) {

            throw new Error(error)
        }
    }
    public static async deletBillingLine(client: PoolClient, billLineId: string, productId: string | null) {
        try {


            const query: { text: string, values: any } = {
                text: `DELETE FROM "BillingLines" where id=$1`,
                values: [billLineId]
            }

            await client.query(query.text, query.values)

            // await client.query('DELETE FROM "InventoryMovmentRecords" where "referenceId"=$1', [billLineId])

            // if(productId)
            // {
            //     await InventoryMovmentTrigger.setOnHand(client,[{productId:productId}])
            // }
        } catch (error: any) {

            throw new Error(error)
        }
    }



    public static async getBillingJournal(billingId: string, company: Company) {
        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal

            /** Billing Journal*/
            const defaultJournals = await JournalRepo.getJournal(billingId, company)
            const journals: any[] = [];
            /**Supplier applied credit journal*/
            const query: { text: string, values: any } = {
                text: `SELECT 
                            case when sum("JournalRecords".amount) > 0 then  sum("JournalRecords".amount::FLOAT )end  as debit,
                            case when sum("JournalRecords".amount) < 0 then ABS(sum("JournalRecords".amount::FLOAT))end   as credit,
                            name as "accountType",
                            "SupplierCredits"."supplierCreditNumber",
                            "SupplierCredits".id as "referenceId",
                            "JournalRecords"."createdAt",
                            'Applied Credits' as reference,
                            "SupplierAppliedCredits".id as "appliedCreditId"
                    FROM "JournalRecords"
                    LEFT JOIN  "SupplierAppliedCredits" on "SupplierAppliedCredits".id = "JournalRecords"."referenceId"
                    LEFT JOIN "SupplierCredits" on "SupplierCredits".id = "SupplierAppliedCredits"."supplierCreditId"	
                    LEFT JOIN "Billings" on "Billings".id = "SupplierAppliedCredits"."billingId"
                    where "Billings".id  =$1
                    group by  "JournalRecords"."accountId" ,  "JournalRecords".name ,"referenceId","JournalRecords"."createdAt","Billings".id,"SupplierCredits".id ,   "SupplierAppliedCredits".id`,
                values: [billingId]
            }


            const journal = await DB.excu.query(query.text, query.values);

            /**Order Supplier applied Credit Journal by createdAt */
            for (let index = 0; index < journal.rows.length; index++) {
                const element: any = journal.rows[index];
                const createdAt = new Date(element.createdAt).getTime();
                const journalData = journals.find((f: any) => f.id == element.id && f.createdAt == createdAt && f.reference == element.reference)
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
                        supplierCreditNumber: element.supplierCreditNumber,
                        reference: element.reference,
                        referenceId: element.referenceId,
                        appliedCreditId: element.appliedCreditId,
                        journals: []
                    }

                    data.journals.push(journalInfo)
                    journals.push(data);
                }

            }
            const resaData = {
                defaultJournals: defaultJournals.data,
                extraJournals: journals
            }
            return new ResponseData(true, "", resaData)
        } catch (error: any) {

            throw new Error(error)
        }
    }


    /** Generate New Bill Number */
    public static async getBillingNumber(branchId: string, company: Company) {
        try {

            const companyId = company.id;
            let prefixSettings = await TransactionManagements.getPrefix('Bill', company.id)
            let prefix = prefixSettings.prefix
            let width = prefixSettings.width

            const query: { text: string, values: any } = {
                text: `  SELECT "billingNumber"
                FROM "Billings"
				    INNER JOIN "Branches"
                     ON "Branches".id = "Billings"."branchId"
                     Where "Branches"."companyId" = $1
                  AND "billingNumber" LIKE $2
                  AND SUBSTRING("billingNumber" FROM LENGTH($3)+1) ~ '^[0-9]+$'  -- only numeric suffixes
                ORDER BY 
                  CAST(SUBSTRING("billingNumber" FROM LENGTH($3)+1) AS INT) DESC
                LIMIT 1`,
                values: [companyId, `${prefix}%`, prefix]
            }

            const data = await DB.excu.query(query.text, query.values);
            const lastNumber = data.rows && data.rows.length > 0 ? data.rows[0].billingNumber : null;
            let newNumber = TransactionManagements.getNumber(prefix, lastNumber, width)

            return new ResponseData(true, "", { billingNumber: newNumber })
        } catch (error: any) {

            throw new Error(error.message)
        }
    }
    private static addBillingLogs(bill: Billing, action: string, comment: string, employeeId: string) {
        try {
            const log = new Log();
            log.action = action;
            log.comment = comment;
            log.createdAt = new Date();
            log.employeeId = employeeId;
            if (bill.logs == null) {
                bill.logs = [];
            }
            bill.logs.push(log);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async sendEmail(data: any, company: Company) {
        try {

            let pdfGenerator = new PDFGenerator()
            data.type = 'bills'
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
            data.type = 'bills'
            let pdfBuffer = await pdfGenerator.getPdf(data);
            return pdfBuffer
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }
    public static async getPayableAccounts(company: Company) {
        try {
            let types: string[] = ['Account Payable'];
            let parentType: string[] = ['Current Liabilities']
            const query = {
                text: `SELECT id,name,code FROM "Accounts" where type = any($1) and "parentType"=any($2) and "companyId" =$3`,
                values: [types, parentType, company.id]
            }
            let accounts = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", { list: accounts.rows })
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async addItemToSupplier(client: PoolClient, billing: Billing, companyId: string) {
        try {
            const supplierId = billing.supplierId;
            const productIds = billing.lines.map(f => { return f.productId })

            /** filter line products to get only produts that doesnt exist on supplier */

            if (productIds && productIds.length > 0) {
                let supplierProducts = await this.filterSupplierProducts(client, productIds, supplierId)
                if (supplierProducts && supplierProducts.length > 0) {
                    const lines: BillingLine[] = supplierProducts.map((f: any) => {
                        let item = billing.lines.find(item => f == item.productId)
                        if (item)
                            return item
                    })
                    if (lines && lines.length > 0) {
                        for (let index = 0; index < lines.length; index++) {
                            const element = lines[index];
                            if (element.productId) {
                                const supplerItem = new SupplierItem();
                                supplerItem.supplierId = supplierId;
                                supplerItem.cost = element.unitCost;
                                supplerItem.minimumOrder = 1
                                supplerItem.productId = element.productId;
                                supplerItem.supplierCode = element.SIC

                                await SupplierRepo.addSupplierItems(client, supplerItem, companyId)
                            }

                        }
                    }
                }




            }



        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async filterSupplierProducts(client: PoolClient, productIds: any[], supplierId: string) {
        try {

            const query = {
                text: `Select JSON_AGG( "Products".id) as "products" from "Products" 
                left join "SupplierItems" on "SupplierItems"."productId" = "Products".id and "SupplierItems"."supplierId" = $1
                where "Products".id = any($2)
                and "SupplierItems".id is null 
                 `,
                values: [supplierId, productIds]
            }

            let products = await client.query(query.text, query.values)

            return products && products.rows && products.rows.length > 0 ? products.rows[0].products : []
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getProductPurchaseHistory(data: any, company: Company) {
        try {

            if (data.filter && !data.filter.productId) {
                throw new Error("Product Id Is Required")
            }
            const supplierId = data.filter && data.filter.supplierId ? data.filter.supplierId : null;
            const compnayId = company.id;
            const productId = data.filter && data.filter.productId ? data.filter.productId : null;

            let page = data.page ?? 1
            let limit = data.limit ?? 15

            let offset = limit * (page - 1)
            const query = {
                text: `with "product" as(
                select id from "Products" where id  =$1
                ),"billings" as (
                select 
                    COUNT(*) OVER() AS "count",
                    "Suppliers".id as "supplierId",
                    "Suppliers".name as "supplierName",
                    "BillingLines"."unitCost" ,
                    "BillingLines".qty,
                    "BillingLines"."taxTotal",
                    "BillingLines"."total",
                    "Billings"."billingDate",
                    "Billings"."billingNumber",
                    "Billings".id as "billId"
                    from "product" 
                inner join "BillingLines" on "product".id = "BillingLines"."productId" 
                inner join "Billings" on "Billings".id = "BillingLines"."billingId" 
                inner join "Suppliers" on "Suppliers".id = "Billings"."supplierId"
                where "Suppliers"."companyId" = $2
                and ($3::uuid is null or "Suppliers".id = $3)
                limit $4
                offset $5
                )

                select * from "billings"
                `,
                values: [productId, compnayId, supplierId, limit, offset]
            }
            let list = await DB.excu.query(query.text, query.values);
            let count = list.rows && list.rows.length > 0 ? Number((<any>list.rows[0]).count) : 0
            let pageCount = Math.ceil(count / limit)
            offset += 1
            let lastIndex = ((page) * limit)
            if (list.rows.length < limit || page == pageCount) {
                lastIndex = count
            }
            const resData = {
                list: list.rows,
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

    public static async getBillLineInfoForCredit(billingLineId: string) {

        try {
            const query: { text: string, values: any } = {
                text: `SELECT
                        "BillingLines".id,
                        "BillingLines". qty,
                        "BillingLines"."discountAmount",
                        "BillingLines"."discountTotal",
                        "BillingLines"."discountPercentage",
                        "BillingLines"."applyDiscountBeforeTax",
                        "BillingLines"."billDiscount",
                        "BillingLines"."discountIncludesTax",
                        sum("SupplierCreditLines"."qty") "totalReturnedQty",
                        sum("SupplierCreditLines"."discountTotal"::text::numeric) "returnedDiscountTotal",
                        sum("SupplierCreditLines"."supplierCreditDiscount"::text::numeric) "returnedSupplierDiscountTotal"
                FROM "BillingLines"
                left join "SupplierCreditLines" on "SupplierCreditLines"."billingLineId" =  "BillingLines".id
                where "BillingLines".id = $1
                group by   "BillingLines".id`,
                values: [billingLineId]
            }
            const billingData = await DB.excu.query(query.text, query.values)
            let billingLine = null
            if (billingData.rows && billingData.rows.length > 0) {
                billingLine = billingData.rows[0];
            }
            return billingLine

        } catch (error: any) {

            throw new Error(error.message)
        }
    }


}