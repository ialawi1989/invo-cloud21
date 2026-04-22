import { DB } from "@src/dbconnection/dbconnection";
import { CreditNote } from "@src/models/account/CreditNote";
import { CreditNoteLine } from "@src/models/account/CreditNoteLine";
import { Invoice } from "@src/models/account/Invoice";
import { ResponseData } from "@src/models/ResponseData";
import { CompanyRepo } from "@src/repo/admin/company.repo";
import { Helper } from "@src/utilts/helper";
import { CreditNoteValidation } from "@src/validationSchema/account/creditNote.Schema";
import { PoolClient } from "pg";
import { CreditNoteMovmentRepo } from "./creditNoteMovment.repo";
import { InvoiceRepo } from "./invoice.repo";

import { InvoiceLine } from "@src/models/account/InvoiceLine";

import { ProductRepo } from "../product/product.repo";

import { SocketCreditNoteRepo } from "@src/repo/socket/creditNote.socket";

import { Company } from "@src/models/admin/company";
import { TimeHelper } from "@src/utilts/timeHelper";
import { CreditNoteLineOption } from "@src/models/account/CreditNoteLineOptions";

import { BatchProductRepo } from "../product/productTypes/batchProduct.reps";
import { SerialProductRepo } from "../product/productTypes/serilizedProduct.repo";
import { RecipeRepo } from "../product/recipe.repo";
import { InvoiceInventoryMovmentRepo } from "./InvoiceInventoryMovment.repo";
import { ValidationException } from "@src/utilts/Exception";

import { SurchargeRepo } from "./surcharge.repo";
import { PDFGenerator } from "@src/utilts/PDFGenerator";


import { EventLog, Log } from "@src/models/log";
import { EventLogsRepo } from "./eventlogs.repo";
import { EventLogsSocket } from "@src/repo/socket/eventLogs.socket";
import { TransactionManagements } from "@src/utilts/TransactionsManagments";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";
import { publishEvent } from "@src/utilts/system-events";
import { BranchesRepo } from "@src/repo/admin/branches.repo";


export class CreditNoteRepo {

    public static async checkIscreditNoteNumberExist(client: PoolClient, id: string | null, creditNoteNumber: string, companyId: string) {
        try {
            const prefixReg = "^(CR-)";
            const prefix = "CR-"
            const num = creditNoteNumber.replace(prefix, '');
            const numTerm = creditNoteNumber.toLocaleLowerCase().trim()
            const query: { text: string, values: any } = {
                text: `SELECT 
                          "creditNoteNumber" 
                    FROM "CreditNotes"
                    INNER JOIN "Branches"
                    ON "Branches".id = "CreditNotes"."branchId"
                    WHERE "Branches"."companyId"=$1
                       AND( trim(LOWER("creditNoteNumber")) = $2 )
                `,
                values: [companyId, numTerm]
            }

            if (id != null) {
                query.text = `SELECT "creditNoteNumber" 
                FROM "CreditNotes"
                INNER JOIN "Branches"
                ON "Branches".id = "CreditNotes"."branchId"
                WHERE "Branches"."companyId"=$1
               AND( trim(LOWER("creditNoteNumber")) = $2 )
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

    public static async includeCharges(client: PoolClient, invoiceId: string, lines: any[], afterDecimal: number, creditNoteId: string | null = null) {
        try {


            let currentQty = 0;
            lines.forEach((element: any) => {
                currentQty += element.qty;
            });

            /**total of  invoice */
            const query: { text: string, values: any } = {
                text: `SELECT
                CAST (COALESCE(sum ("InvoiceLines".qty::numeric),0)  AS REAL) as "invoiceQty"
                from "Invoices"
                INNER JOIN "InvoiceLines"
                ON "InvoiceLines"."invoiceId" = "Invoices".id
				where "Invoices".id = $1`,
                values: [invoiceId]
            }
            const invoice = await client.query(query.text, query.values);

            const invoiceQty = invoice.rows && invoice.rows.length > 0 ? invoice.rows[0].invoiceQty : 0

            /**total of Previous creditnotes credited on same invoice */
            query.text = `SELECT 
            CAST (COALESCE(sum ("CreditNoteLines".qty::numeric),0)  AS REAL) as "creditNoteQty"

            from "Invoices"
            LEFT JOIN "CreditNotes"  on "CreditNotes"."invoiceId" = "Invoices".id 
            LEFT JOIN "CreditNoteLines" on  "CreditNotes".id = "CreditNoteLines"."creditNoteId"
            where "Invoices".id = $1
			group by "Invoices".id`
            console.log(creditNoteId)
            if (creditNoteId != null) {

                query.text = `SELECT  
                CAST (COALESCE(sum ("CreditNoteLines".qty::numeric),0)  AS REAL) as "creditNoteQty"
                from "Invoices"
                LEFT JOIN "CreditNotes"  on "CreditNotes"."invoiceId" = "Invoices".id 
                LEFT JOIN "CreditNoteLines" on  "CreditNotes".id = "CreditNoteLines"."creditNoteId" and "CreditNoteLines"."creditNoteId" <>$2
                where "Invoices".id = $1
                group by "Invoices".id`
                query.values = [invoiceId, creditNoteId]
            }
            const creditNote = await client.query(query.text, query.values);
            const creditNoteQty = creditNote.rows && creditNote.rows.length > 0 ? creditNote.rows[0].creditNoteQty : 0


            /**If totl of credit note exceeded invoice total
             * 
             * currently created credit note total + previously created  creditNote total most be less than invoice total 
             */


            if (invoiceQty == (creditNoteQty + currentQty)) {
                return true;

            } else {
                return false;

            }





        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    /**validate invoice balance on credit Note */
    /**Only when invoice is fully returned charges will be included */
    public static async checkIfInvoiceFullyReturned(client: PoolClient, invoiceId: string, lines: any[], afterDecimal: number, creditNoteId: string | null = null) {
        try {

            let currentCreditNoteTotal = 0;

            lines.forEach((element: any) => {
                currentCreditNoteTotal += Helper.roundNum(element.total, afterDecimal)
                currentCreditNoteTotal = Helper.roundDecimal(currentCreditNoteTotal, afterDecimal)

            });

            /**total of  invoice */
            const query: { text: string, values: any } = {
                text: `SELECT "InvoiceLines".total  
                
                from "Invoices"
                INNER JOIN "InvoiceLines"
                ON "InvoiceLines"."invoiceId" = "Invoices".id
				where "Invoices".id = $1`,
                values: [invoiceId]
            }
            const invoice = await client.query(query.text, query.values);
            const invoiceLines = invoice.rows ?? []
            let total = 0
            for (let index = 0; index < invoiceLines.length; index++) {
                const element = invoiceLines[index];
                total += Helper.roundNum(element.total, afterDecimal)
                total = Helper.roundDecimal(total, afterDecimal)
            }


            /**total of Previous creditnotes credited on same invoice */
            console.log("hereeeeeeeeeeeeeeeeeeeeeeeeeeee", creditNoteId)

            query.text = `SELECT  CAST (COALESCE(sum ("CreditNoteLines".total::numeric),0) AS REAL)  as "creditNoteTotal"
           

            from "Invoices"
            inner JOIN "CreditNotes"  on "CreditNotes"."invoiceId" = "Invoices".id 
            inner JOIN "CreditNoteLines" on  "CreditNotes".id = "CreditNoteLines"."creditNoteId"
            where "Invoices".id = $1
               and( $2::uuid is null or "CreditNotes".id  <>$2)
			group by "Invoices".id`

            // if (creditNoteId != null) {
            //    console.log("creditNoteId",creditNoteId)
            //     query.text = `SELECT  CAST (COALESCE(sum ("CreditNoteLines".total::numeric),0) AS REAL)  as "creditNoteTotal"
            //     from "Invoices"
            //     inner JOIN "CreditNotes"  on "CreditNotes"."invoiceId" = "Invoices".id 
            //     inner JOIN "CreditNoteLines" on  "CreditNotes".id = "CreditNoteLines"."creditNoteId" 
            //     where "Invoices".id = $1
            //     and "CreditNotes".id  <>$2
            //     group by "Invoices".id`

            // }
            query.values = [invoiceId, creditNoteId]
            const creditNote = await client.query(query.text, query.values);
            const creditNoteTotal = creditNote.rows && creditNote.rows.length > 0 ? creditNote.rows[0].creditNoteTotal : 0


            /**If totl of credit note exceeded invoice total
             * 
             * currently created credit note total + previously created  creditNote total most be less than invoice total 
             */

            if (Helper.roundDecimal(Number(total), afterDecimal) < Helper.addWithRounding(currentCreditNoteTotal, creditNoteTotal, afterDecimal)) {
                console.log(currentCreditNoteTotal)
                console.log(creditNoteTotal)
                throw new ValidationException("Returned Items Exceeded actual Amount Balance = " + (currentCreditNoteTotal + creditNoteTotal) + " ,total = " + total)
            } else {


                return false;


            }




        } catch (error: any) {
          
       
            throw new Error(error.message)
        }
    }

    /**Paid Credit Notes can be either refunded or it's balance can be applied on invoice */
    public static async getCreditNoteBalance(client: PoolClient, creditNoteId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT
                "CreditNotes".total -(COALESCE( sum( "CreditNoteRefunds".total) ,0) + COALESCE( sum( "AppliedCredits".amount),0))AS balance,
                "CreditNotes"."creditNoteNumber"
                FROM "CreditNotes"
                LEFT JOIN "AppliedCredits" ON "AppliedCredits"."creditNoteId" = "CreditNotes".id
                LEFT JOIN "CreditNoteRefunds" ON "CreditNoteRefunds"."creditNoteId" = "CreditNotes".id
                where "CreditNotes".id=$1
                GROUP by "CreditNotes".id`,
                values: [creditNoteId]
            }
            const balance = await client.query(query.text, query.values);
            return new ResponseData(true, "", { balance: (<any>balance.rows[0]).balance, creditNoteNumber: (<any>balance.rows[0]).creditNoteNumber })
        } catch (error: any) {
          
            throw new Error(error.message)
        }

    }


    public static async ifallowedtoCreditNote(client: PoolClient, invoiceId: string) {
        try {
            const query = {
                text: `with "creditNotes" as  (
                        select "CreditNotes"."invoiceId" , sum("CreditNotes"."total"::text::numeric) as "total" from "CreditNotes" 
                            where "CreditNotes"."invoiceId"= $1
                            group by  "CreditNotes"."invoiceId"
                        ), "payments" as(
                        select "InvoicePaymentLines"."invoiceId" , sum("InvoicePaymentLines"."amount"::text::numeric) as "total" from "InvoicePaymentLines" 
                            where "InvoicePaymentLines"."invoiceId"= $1
                            group by  "InvoicePaymentLines"."invoiceId"
                        ), "appliedCredits" as(
                        select "AppliedCredits"."invoiceId" , sum("AppliedCredits"."amount"::text::numeric) as "total" from "AppliedCredits" 
                            where "AppliedCredits"."invoiceId"=$1
                            group by  "AppliedCredits"."invoiceId"
                        )
                        select count( "Invoices".id) from "Invoices"
                        left join "creditNotes" on "creditNotes"."invoiceId" = "Invoices".id
                        left join "payments" on "payments"."invoiceId" = "Invoices".id
                        left join "appliedCredits" on "appliedCredits"."invoiceId" = "Invoices".id
                        where "Invoices".id = $1
                        group by  "Invoices".id ,"creditNotes"."total","payments"."total","appliedCredits"."total"
                        having "Invoices"."source" <> 'POS' OR ( ("Invoices"."source" = 'POS') AND ("Invoices"."total"::text::numeric - COALESCE("creditNotes"."total",0))  = COALESCE("payments"."total",0) + COALESCE("appliedCredits"."total",0))                `,
                values: [invoiceId]
            }

            const invoice = await client.query(query.text, query.values);

            if (invoice.rows && invoice.rows.length > 0 && invoice.rows[0].count > 0) {
                return true
            }

            return false
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async addNewCreditNote(client: PoolClient, data: any, company: Company, source: string | null = null) {
        try {
            const companyId = company.id
            console.log("addNewCreditNoteaddNewCreditNoteaddNewCreditNote")
            //validate Credit Note 
            const validate = await CreditNoteValidation.creditNoteValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            const afterDecimal = company.afterDecimal
            const creditNote = new CreditNote();
            creditNote.ParseJson(data);
            const invoiceData = await CreditNoteRepo.getInvoiceInfo(client, creditNote.invoiceId);

            // const invoiceDate = new Date(moment(invoiceData.invoiceDate).toDate())
            // const creditNoteDate = new Date(moment(creditNote.creditNoteDate).toDate())
            // console.log(invoiceDate)
            // console.log(creditNoteDate)
            // if (       invoiceDate.getTime()<= creditNoteDate.getTime()) {
            //     throw new ValidationException(`Invalid CreditNote Date : Credit Note Date Cannot be past InvoiceDate ${invoiceData.invoiceDate}`)
            // }
            // let isAllowedToCreditNote = await this.ifallowedtoCreditNote(client, creditNote.invoiceId);
            // if (!isAllowedToCreditNote) {
            //     throw new Error("Cannot Create Credit Note On Unpaid Invoice")
            // }

            /**must be called before calculating the total */
            let zeroLines = creditNote.lines.filter((f: CreditNoteLine) => f.qty <= 0)
            if (zeroLines.length == creditNote.lines.length) {
                throw new ValidationException("Credit Note must has atleast one Line")

            }
            creditNote.includeCharges = await CreditNoteRepo.includeCharges(client, creditNote.invoiceId, creditNote.lines, afterDecimal);
            if (creditNote.includeCharges) {
                creditNote.chargeTotal = invoiceData.chargeTotal;
                creditNote.deliveryCharge = invoiceData.deliveryCharge;
                creditNote.roundingTotal = invoiceData.roundingTotal;
                creditNote.chargeType = 'chargeBeforeTax'


                if (creditNote.chargeId != null && creditNote.chargeId != "") {
                    let chargeTax = (await SurchargeRepo.getSurchargeTax(client, creditNote.chargeId)).data;
                    if (chargeTax) {
                        if (creditNote.chargesTaxDetails) {
                            creditNote.chargesTaxDetails.taxId = chargeTax.id;
                            creditNote.chargesTaxDetails.type = chargeTax.taxType;
                            creditNote.chargesTaxDetails.taxPercentage = chargeTax.taxPercentage;
                            creditNote.chargesTaxDetails.taxes = chargeTax.taxes
                        }

                    }

                }
            } else {
                creditNote.chargeTotal = 0
                creditNote.deliveryCharge = 0
                creditNote.roundingTotal = 0
                creditNote.chargesTaxDetails = null
            }

            const lineTemps: CreditNoteLine[] = [];

            creditNote.lines.forEach((element: CreditNoteLine) => {
                const invoiceLine: any = invoiceData.lines.find((f: any) => f.id == element.invoiceLineId)
                if (!element.discountPercentage) {
                    element.calculateLineDiscountAmount(invoiceLine)
                }
                lineTemps.push(element)
            });
            creditNote.lines = lineTemps;
            creditNote.calculateTotal(invoiceData, afterDecimal)
            creditNote.companyId = companyId
            await CreditNoteRepo.checkIfInvoiceFullyReturned(client, creditNote.invoiceId, creditNote.lines, afterDecimal);

            //Check If Credit Note Number Already Used


            const invoiceStatus = await InvoiceRepo.getInvoiceStatus(client, creditNote.invoiceId)
            if (invoiceStatus == "Draft" || invoiceStatus == "writeOff") {
                throw new ValidationException(invoiceStatus + " Invoices Are not Allowed to CreditNote")
            }
            const isCreditNoteNumberExist = await this.checkIscreditNoteNumberExist(client, null, creditNote.creditNoteNumber, companyId)
            if (isCreditNoteNumberExist) {
                throw new ValidationException("Credit Note Number Already Used")
            }


            if (creditNote.branchId == null || creditNote.branchId == "") {
                const branchId = (await InvoiceRepo.getInvoiceBranchId(client, creditNote.invoiceId)).id;
                creditNote.branchId = branchId
            }



            creditNote.updatedDate = new Date()
            creditNote.createdAt = new Date()
            const query: { text: string, values: any } = {
                text: `INSERT INTO  "CreditNotes" 
                                        ( 
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
                                        "updatedDate",
                                        "attachment",
                                        "sourceType",
                                        "chargesTaxDetails",
                                        "chargeType",
                                        "companyId"
                                        ) 
                         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29) RETURNING id`,
                values: [
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
                    creditNote.updatedDate,
                    JSON.stringify(creditNote.attachment),
                    creditNote.sourceType,
                    creditNote.chargesTaxDetails,
                    creditNote.chargeType,
                    creditNote.companyId
                ]
            }
            const insert = await client.query(query.text, query.values);
            creditNote.id = (<any>insert.rows[0]).id;
            //insert creditNoteLines
            for (let index = 0; index < creditNote.lines.length; index++) {
                const element: any = creditNote.lines[index]
                element.creditNoteId = creditNote.id;
                element.branchId = creditNote.branchId;
                element.employeeId = creditNote.employeeId;
                element.companyId = creditNote.companyId;
                if (((element.productId == null || element.productId == "") && (element.note == null || element.note == "")) || element.qty <= 0) {
                    continue;
                }

                const invoiceLine: any = invoiceData.lines.find((f: any) => f.id == element.invoiceLineId)
                element.invoiceLine = invoiceLine
                element.createdAt = TimeHelper.getCreatedAt(creditNote.creditNoteDate, company.timeOffset);
                const creditNoteID = await this.addNewCreditNoteLine(client, element, creditNote, afterDecimal)

                // Only for MenuSelection and Package 
                if (element?.subItems) {
                    for (let index = 0; index < element?.subItems.length; index++) {
                        const subItem = element?.subItems[index];
                        subItem.branchId = creditNote.branchId;
                        subItem.companyId = creditNote.companyId;
                        subItem.creditNoteId = creditNote.id;
                        subItem.employeeId = element.employeeId;
                        subItem.invoiceLineId = subItem.id
                        subItem.qty = subItem.qty * element.qty;
                        subItem.parentId = creditNoteID.data.id;
                        const invoiceLine: any = invoiceData.lines.find((f: any) => f.id == subItem.invoiceLineId)
                        subItem.invoiceLine = invoiceLine
                        subItem.invoiceLine.qty = subItem.invoiceLine.qty * element.invoiceLine.qty
                        subItem.parentUsages = element.qty
                        await this.addNewCreditNoteLine(client, subItem, creditNote, afterDecimal);
                    }
                }
            }

            const creditNoteCode = await this.generateCreditNoteCode(client, company.id, creditNote.id, 0, creditNote.code)
            creditNote.code = creditNoteCode.success ? creditNoteCode.data.code : null

            // send to POS if invoice linked to this credit note is pos 
            if (invoiceData.source == "POS" || invoiceData.source == "Online") {

                await SocketCreditNoteRepo.sendCreditNotes(client, creditNote.branchId, creditNote.id)
            }

            //TODO: UPDATE INVOICE STATUS / JOURNAL 

            const resData = {
                id: creditNote.id,
                invoiceId: creditNote.invoiceId,
            }
            creditNote.companyId = company.id
            const branchName = (await BranchesRepo.getBranchName(creditNote.branchId))

            if (company.features?.map(f => f.toLowerCase()).includes('notifications')) {
                await publishEvent("creditNoteIssued", {...creditNote, branchName: branchName});
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {


          
            throw new Error(error.message)

        }
    }
    public static async addNewCreditNoteLine(client: PoolClient, creditNoteLine: CreditNoteLine, creditNote: CreditNote, afterDecimal: number) {
        try {


            if (creditNoteLine.productId != null && creditNoteLine.productId != "" && creditNoteLine.salesEmployeeId != null && creditNoteLine.salesEmployeeId != "") {
                const productCommission = await ProductRepo.getProductCommission(client, creditNoteLine.productId);
                if (productCommission) {
                    creditNoteLine.commissionPercentage = productCommission.commissionPercentage;
                    creditNoteLine.commissionAmount = productCommission.commissionAmount;
                }

            }
            creditNoteLine.calculateCommission(afterDecimal);
            /**TO UPDAT PRODUCT ONHAND */
            if (creditNoteLine.productId != null && creditNoteLine.productId != "" && creditNoteLine?.invoiceLine?.recipe && creditNoteLine.invoiceLine.recipe.length > 0) {
                await CreditNoteMovmentRepo.insertInventoryMovment(client, creditNoteLine, creditNote, afterDecimal, creditNoteLine.qty)
            }



            const query: { text: string, values: any } = {
                text: `INSERT INTO "CreditNoteLines" 
                                          (
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
                        
                                            recipe,
                                               "discountId",
                                            "branchId",
                                            "companyId"
                                        
                                         
                                          ) 
                        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31) RETURNING id`,
                values: [
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
                    creditNoteLine.branchId,
                    creditNoteLine.companyId,

                ]
            }


            const insert = await client.query(query.text, query.values);
            creditNoteLine.id = (<any>insert.rows[0]).id
            let invoiceOption = creditNoteLine.invoiceLine ? creditNoteLine.invoiceLine.options : []
            for (let index = 0; index < creditNoteLine.options.length; index++) {
                const option = creditNoteLine.options[index];
                option.creditNoteLineId = creditNoteLine.id;
                let currentLineOption: any = invoiceOption.find((f: any) => f.optionId == option.optionId)
                option.invoiceOption = currentLineOption ?? [];
                await this.addCreditnoteLineOption(client, option, creditNoteLine, creditNoteLine.qty);
            }

            return new ResponseData(true, "", { id: creditNoteLine.id })
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }
    public static async addCreditnoteLineOption(client: PoolClient, creditnotelineOption: CreditNoteLineOption, creditNoteLine: CreditNoteLine, afterDecimal: number) {
        try {
            /** Option Movment */

            if (creditnotelineOption.optionId != "" && creditnotelineOption.optionId != null && creditnotelineOption?.invoiceOption?.recipe && creditnotelineOption.invoiceOption.recipe.length > 0) {

                await CreditNoteMovmentRepo.calculateOptionMovment(client, creditnotelineOption, creditNoteLine, creditNoteLine.qty);
            }

            let query: { text: string, values: any } = {
                text: `INSERT INTO  "CreditNoteLineOptions"("optionId", "note","price","qty","recipe","creditNoteLineId") VALUES($1,$2,$3,$4,$5,$6)`,
                values: [creditnotelineOption.optionId, creditnotelineOption.optionId, creditnotelineOption.price, creditnotelineOption.qty, JSON.stringify(creditnotelineOption.recipe), creditnotelineOption.creditNoteLineId]
            }

            await client.query(query.text, query.values);


        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async editCreditNote(data: any, company: Company, employeeId: string) {
        const client = await DB.excu.client()
        try {

            console.log("editCreditNoteeditCreditNoteeditCreditNote")
            const companyId = company.id;
            const validate = await CreditNoteValidation.creditNoteValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            const afterDecimal = company.afterDecimal
            const creditNote = new CreditNote();
            creditNote.ParseJson(data);
            const invoiceData = await CreditNoteRepo.getInvoiceInfo(client, creditNote.invoiceId);

            let zeroLines = creditNote.lines.filter((f: CreditNoteLine) => f.qty <= 0)
            if (zeroLines.length == creditNote.lines.length) {
                throw new ValidationException("Credit Note must has atleast one Line")

            }

            // const invoiceDate = new Date(moment(invoiceData.invoiceDate).toDate())
            // const creditNoteDate = new Date(moment(creditNote.creditNoteDate).toDate())

            // if (       invoiceDate.getTime()<= creditNoteDate.getTime()) {
            //     throw new ValidationException(`Invalid CreditNote Date : Credit Note Date Cannot be past InvoiceDate ${invoiceData.invoiceDate}`)
            // }
            const deletedLines = creditNote.lines.filter((f) => f.isDeleted == true)
            if (deletedLines.length == creditNote.lines.length) {
                throw new ValidationException("Credit Note must has atleast one Line")
            }
            /**must be called before calculating the total */
            creditNote.includeCharges = await CreditNoteRepo.includeCharges(client, creditNote.invoiceId, creditNote.lines, afterDecimal, data.id);
            if (creditNote.includeCharges) {
                creditNote.chargeTotal = invoiceData.chargeTotal;
                creditNote.deliveryCharge = invoiceData.deliveryCharge;
                creditNote.roundingTotal = invoiceData.roundingTotal
            } else {
                creditNote.chargeTotal = 0
                creditNote.deliveryCharge = 0
                creditNote.roundingTotal = 0
                creditNote.chargesTaxDetails = null
            }
            const lineTemps: CreditNoteLine[] = [];

            creditNote.lines.forEach((element: CreditNoteLine) => {
                const invoiceLine: any = invoiceData.lines.find((f: any) => f.id == element.invoiceLineId)
                if (!element.discountPercentage) {
                    element.calculateLineDiscountAmount(invoiceLine)
                }
                lineTemps.push(element)
            });
            creditNote.lines = lineTemps;



            creditNote.calculateTotal(invoiceData, afterDecimal)
            await CreditNoteRepo.checkIfInvoiceFullyReturned(client, creditNote.invoiceId, creditNote.lines, afterDecimal, data.id);



            if (creditNote.id == null || creditNote.id == "") {
                throw new ValidationException("Credit Note Id Is Required")
            }

            const isCreditNoteNumberExist = await this.checkIscreditNoteNumberExist(client, creditNote.id, creditNote.creditNoteNumber, companyId)
            if (isCreditNoteNumberExist) {
                throw new ValidationException("Credit Note Number Already Used")
            }
            await client.query("BEGIN")
            //Insert Credit Note 
            creditNote.updatedDate = new Date()
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
                               "attachment"=$17,
                               "chargesTaxDetails"=$18,
                               "smallestCurrency"=$19,
                               "roundingTotal"=$20,
                                "roundingType"=$21
                 WHERE id=$22
                 AND "branchId"=$23 `,
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
                JSON.stringify(creditNote.attachment),
                creditNote.chargesTaxDetails,
                creditNote.smallestCurrency,
                creditNote.roundingTotal,
                creditNote.roundingType,
                creditNote.id,
                creditNote.branchId]
            }

            const insert = await client.query(query.text, query.values);

            //Insert Credit NoteL ines
            for (let index = 0; index < creditNote.lines.length; index++) {
                const element = creditNote.lines[index];
                element.creditNoteId = creditNote.id;
                element.employeeId = employeeId;
                element.branchId = creditNote.branchId;
                element.isInclusiveTax = creditNote.isInclusiveTax;
                element.createdAt = TimeHelper.getCreatedAt(creditNote.creditNoteDate, company.timeOffset);
                const invoiceLine: any = invoiceData.lines.find((f: any) => f.id == element.invoiceLineId)
                element.invoiceLine = invoiceLine
                if ((element.productId == null || element.productId == "") && (element.note == null || element.note == "")) {
                    continue;
                }
                if (element.id == null || element.id == "") {
                    await this.addNewCreditNoteLine(client, element, creditNote, afterDecimal)
                } else {
                    await this.editCreditNoteLine(client, element, creditNote, afterDecimal)
                }
            }
            await client.query("COMMIT")
            const resData = {
                id: creditNote.id,
                invoiceId: creditNote.invoiceId
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
            console.log(error)
          
            await client.query("ROLLBACK")
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }
    public static async editCreditNoteLine(client: PoolClient, creditNoteLine: CreditNoteLine, creditNote: CreditNote, afterDecimal: number) {
        try {


            if (creditNoteLine.productId != null && creditNoteLine.productId != "" && creditNoteLine.salesEmployeeId != null && creditNoteLine.salesEmployeeId != "") {
                const productCommission = await ProductRepo.getProductCommission(client, creditNoteLine.productId);
                creditNoteLine.commissionPercentage = productCommission.commissionPercentage;
                creditNoteLine.commissionAmount = productCommission.commissionAmount;
            }
            let acctualQty = 0
            creditNoteLine.calculateCommission(afterDecimal);
            if (creditNoteLine.productId != null && creditNoteLine.productId != "") {
                let oldQty = await this.getOldLineQty(client, creditNoteLine.id)
                acctualQty = creditNoteLine.isDeleted ? creditNoteLine.qty * -1 : creditNoteLine.qty - oldQty.qty;
                await CreditNoteMovmentRepo.insertInventoryMovment(client, creditNoteLine, creditNote, afterDecimal, acctualQty)
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
                                        "taxPercentage"=$16,
                                        "taxTotal"=$17,
                                        "isInclusiveTax"=$18,
                                        "recipe"=$19
                                  
                       WHERE id = $20
                       AND "creditNoteId"=$21`,
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
                creditNoteLine.taxPercentage,
                creditNoteLine.taxTotal,
                creditNoteLine.isInclusiveTax,
                JSON.stringify(creditNoteLine.recipe),
                creditNoteLine.id,
                creditNoteLine.creditNoteId]
            }

            await client.query(query.text, query.values);

            let invoiceOption = creditNoteLine.invoiceLine ? creditNoteLine.invoiceLine.options : []

            for (let index = 0; index < creditNoteLine.options.length; index++) {
                const option = creditNoteLine.options[index];
                option.creditNoteLineId = creditNoteLine.id;
                let currentLineOption: any = invoiceOption.find((f: any) => f.optionId == option.optionId)
                option.invoiceOption = currentLineOption ?? [];
                if (option.id != "" && option.id != null) {
                    await this.editCreditnoteLineOption(client, option, creditNoteLine, acctualQty);

                } else {
                    await this.addCreditnoteLineOption(client, option, creditNoteLine, creditNoteLine.qty);

                }
            }


            if (creditNoteLine.isDeleted) {
                await this.deleteCreditNoteLines(client, creditNoteLine.id)
            }


        } catch (error: any) {
          
            console.log(error)
            throw new Error(error.message)
        }
    }
    public static async editCreditnoteLineOption(client: PoolClient, creditnotelineOption: CreditNoteLineOption, creditNoteLine: CreditNoteLine, acctualQty: number) {
        try {
            /** Option Movment */

            if (acctualQty != 0) {


                await CreditNoteMovmentRepo.calculateOptionMovment(client, creditnotelineOption, creditNoteLine, acctualQty);

            }


            let query: { text: string, values: any } = {
                text: `update "CreditNoteLineOptions"  SET  "note"=$1,
                                                             "price"=$2
                                                             ,"qty"=$3,
                                                             "recipe"=$4
                                                             WHERE id =$5`,
                values: [creditnotelineOption.note, creditnotelineOption.price, creditnotelineOption.qty, JSON.stringify(creditnotelineOption.recipe), creditnotelineOption.id]
            }

            await client.query(query.text, query.values);


        } catch (error: any) {
            throw new Error(error)
        }
    }


    /**ACCORDINGLY TO INVOICE IF INVOICE SOURCE IS POS THEN THE INVOICE HAS TO BE SENT TO POS */
    public static async getCreditNoteSource(client: PoolClient, crediteNoteId: string) {

        try {
            const query: { text: string, values: any } = {
                text: `SELECT "Invoices".source FROM "CreditNotes"
                       INNER JOIN "Invoices" on "Invoices".id ="CreditNotes"."invoiceId"
                       where "CreditNotes".id =$1`,
                values: [crediteNoteId]
            }
            const creditNote = await client.query(query.text, query.values)
            return { source: creditNote.rows[0].source }
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getCeditNoteLinesLimits(client: PoolClient, lineIds: any[], creditNoteId: string) {
        try {
            const query = {
                text: `with "voided" as (
                select "InvoiceLines"."voidFrom" , suM("qty") as "voidedQty"   from "InvoiceLines" where "id" = any($1)
                    and  "InvoiceLines"."voidFrom" is not null and "qty" <0 
                    group by "InvoiceLines"."voidFrom"
                ),"lines" as(
                select  "InvoiceLines".id ,COALESCE("InvoiceLines".qty,0) -  (COALESCE("voided"."voidedQty",0) + COALESCE(sum(otherCR."qty"),0) +  COALESCE("CreditNoteLines"."qty",0) ) as "maxQty"  from "InvoiceLines"
                    inner join "CreditNoteLines" on  "CreditNoteLines" ."invoiceLineId" = "InvoiceLines".id  and "CreditNoteLines"."creditNoteId" = $2
                    left join "CreditNoteLines" otherCR ON otherCR."invoiceLineId" =  "InvoiceLines".id  and otherCR."creditNoteId" <>$2
                    left join "voided" on "voided"."voidFrom" = "InvoiceLines".id 
                    where  "InvoiceLines"."id" = any($1)
                    group by "InvoiceLines".id ,"voided"."voidedQty", "CreditNoteLines"."qty" 
                )

                select * from "lines"`,

                values: [lineIds, creditNoteId]
            }

            let lines = await client.query(query.text, query.values);

            return lines.rows
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getCreditNoteById(creditNoteId: string, company: Company) {
        const client = await DB.excu.client();

        try {
            await client.query("BEGIN")
            const query: { text: string, values: any } = {
                text: `SELECT 
                        "CreditNotes".id,
                        "CreditNotes"."creditNoteNumber",
                        "CreditNotes"."refrenceNumber",
                        "CreditNotes".total,
                        "CreditNotes".note,
                        "CreditNotes".attachment,
                        "CreditNotes"."employeeId",
                        "CreditNotes"."invoiceId",
                       CAST( "CreditNotes"."creditNoteDate" AS TEXT) AS "creditNoteDate",
                        "CreditNotes"."discountTotal",
                        "CreditNotes"."chargeTotal",
                        (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',COALESCE("Media"."url"->>'downloadUrl',"Media"."url"->>'defaultUrl'),'mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("CreditNotes"."attachment") as attachments(attachments)
                        inner join "Media" on "Media".id = (attachments->>'id')::uuid
                        ) as "attachment",
                        "CreditNotes"."chargeAmount",
                        "CreditNotes"."chargePercentage",
                        "CreditNotes"."chargeId",
                        "CreditNotes"."discountAmount",
                        "CreditNotes"."discountTotal",
                        "CreditNotes"."discountPercentage",
                        "CreditNotes"."discountId",
                        "CreditNotes"."deliveryCharge",
                        "CreditNotes"."subTotal",
                        "CreditNotes"."branchId",
                        "Branches"."customFields" as "branchCustomFields",
                        "Invoices"."invoiceNumber",
                        "Invoices".total as "invoiceTotal",
                        "Customers".name as "customerName",
                        "Customers".id as "customerId",
                        "Customers"."phone" as "customerContact",
                        "Customers"."email" as "customerEmail",
                        "Employees".name as "employeeName",
                        COALESCE(   sum( distinct "CreditNoteRefunds".total::text::numeric) ,0)as "refundedAmount",
                        COALESCE(   sum( distinct "AppliedCredits".amount ::text::numeric),0) as "appliedAmount",
                        "CreditNotes"."roundingType",
                        "CreditNotes"."roundingTotal",
                        "CreditNotes"."smallestCurrency",
                          "CreditNotes"."chargeType",
                               case when NULLIF(("CreditNotes"."chargesTaxDetails"->>'taxId'),'')::uuid is not null then JSON_BUILD_OBJECT('taxId',"CreditNotes"."chargesTaxDetails"->>'taxId',
							   'taxName',"Taxes".name,
							   'taxPercentage',"CreditNotes"."chargesTaxDetails"->>'taxPercentage',
							   'taxAmount',"CreditNotes"."chargesTaxDetails"->>'taxAmount',
							   'taxes',("CreditNotes"."chargesTaxDetails"->>'taxes')::jsonb,
                               'type',("CreditNotes"."chargesTaxDetails"->>'type')::text
							  ) end "chargesTaxDetails"
                FROM "CreditNotes"
                INNER JOIN "Invoices" ON "CreditNotes"."invoiceId" =  "Invoices".id
                LEFT JOIN "InvoicePaymentLines" ON "InvoicePaymentLines"."invoiceId" =  "Invoices".id
                LEFT JOIN "Employees" ON "Employees".id = "CreditNotes"."employeeId"
                LEFT JOIN "Customers" ON "Customers".id =  "Invoices"."customerId" 
                LEFT JOIN "CreditNoteRefunds" ON "CreditNoteRefunds"."creditNoteId" = "CreditNotes".id
                LEFT JOIN "AppliedCredits" ON "AppliedCredits"."creditNoteId" = "CreditNotes".id
                LEFT JOIN "Taxes" on "Taxes".id =      NULLIF(("CreditNotes"."chargesTaxDetails"->>'taxId'),'')::uuid 
                LEFT JOIN "Branches" ON "Branches"."id" = "CreditNotes"."branchId"
                WHERE "CreditNotes".id = $1
                and "Branches"."companyId"=$2
                GROUP BY  "CreditNotes".id, "Invoices".id, "Customers".id,     "Employees".id , "Taxes".name , "Branches".id `,
                values: [creditNoteId, company.id]
            }

            const creditNoteData: any = await client.query(query.text, query.values);

            const creditNoteInfo: CreditNote = creditNoteData.rows[0]
            const creditNote = new CreditNote();

            creditNote.ParseJson(creditNoteInfo);

            creditNote.remainingCredit = await this.getRefundDue(client, creditNote.id, creditNote.invoiceId)
            creditNote.refundDue = creditNote.remainingCredit
            creditNote.lines = []
            if (creditNote.id != "" && creditNote.id != null) {
                query.text = `SELECT "CreditNoteLines".id,
                                "CreditNoteLines"."creditNoteId",
                                "CreditNoteLines".total,
                                "CreditNoteLines".price,
                                    "CreditNoteLines"."subTotal",
                                "CreditNoteLines".qty,
                                "CreditNoteLines"."productId",
                                "CreditNoteLines".batch,
                                "CreditNoteLines".serial,
                                "CreditNoteLines"."invoiceLineId",
                                "CreditNoteLines"."parentId",
                                "CreditNoteLines".note,
                                "Products".name As "productName",
                                "CreditNoteLines"."accountId",
                                "CreditNoteLines"."discountAmount",
                                "CreditNoteLines"."taxPercentage",
                                "CreditNoteLines"."taxId",
                                "CreditNoteLines"."taxTotal",
                                "CreditNoteLines"."discountTotal",
                                  (  select
											   JSON_AGG(JSON_BUILD_OBJECT('taxId',"taxId",
                                                            'taxName',"taxName",
                                                            'taxPercentage',"taxPercentage",
                                                            'taxAmount',"taxAmount",
                                                            'taxes',"taxes",
                                                     
                                                            'index', "index"
                                                            ))
	                                           from (select 
                                                   
                                                    el->>'taxId' as "taxId",
												    "Taxes".name as "taxName",
												    CAST(el->>'taxPercentage' AS FLOAT) as "taxPercentage",
												    CAST(el->>'taxAmount' AS FLOAT) as "taxAmount",
												    el->>'taxes' as "taxes",
												  ( ROW_NUMBER() over() -1)  as "index"
                                                    from JSONB_ARRAY_ELEMENTS( "CreditNoteLines"."taxes") el 
                                                    inner join "Taxes" on "Taxes".id = NULLIF(NULLIF(el->>'taxId', ''), 'null')::uuid and  "CreditNoteLines"."taxes" <> 'null' 
                                                    )t)	as "taxes",
                                "CreditNoteLines"."taxType",
                                "CreditNoteLines"."isInclusiveTax",
                                "CreditNoteLines"."taxPercentage",
                                "Taxes".name as "taxName"
                         FROM "CreditNoteLines"
                         LEFT JOIN "Products"
                         ON "Products".id = "CreditNoteLines"."productId"
                         left join "Taxes" on "Taxes".id = "CreditNoteLines"."taxId"
                         INNER JOIN "Accounts"
                         ON "Accounts".id = "CreditNoteLines"."accountId"
                         WHERE  "CreditNoteLines"."creditNoteId"=$1
                
                         `;
                const lines = await client.query(query.text, [creditNoteId]);

                let linesIds: any[] = lines.rows && lines.rows.length > 0 ? lines.rows.map(f => { return f.invoiceLineId }) : [];
                console.log(linesIds)
                if (linesIds.length > 0) {
                    let invoiceLines = await this.getCeditNoteLinesLimits(client, linesIds, creditNoteId);
                    if (invoiceLines && invoiceLines.length > 0) {
                        lines.rows = lines.rows.map(f => {
                            let currentLine = invoiceLines.find(item => item.id == f.invoiceLineId)
                            console.log(currentLine)
                            if (currentLine) {
                                f.maxQty = currentLine.maxQty == 0 ? f.qty : currentLine.maxQty + f.qty

                            }

                            return f
                        })
                    }
                }

                console.log(lines.rows)
                for (let index = 0; index < lines.rows.length; index++) {
                    const element: any = lines.rows[index];
                    const line = new CreditNoteLine();
                    line.ParseJson(element);
                    line.selectedItem = {}
                    line.selectedItem.id = element.productId
                    line.selectedItem.name = element.productName
                    query.text = `SELECT"CreditNoteLineOptions".id ,
                                          "CreditNoteLineOptions".price,
                                          "CreditNoteLineOptions".qty,
                                          "CreditNoteLineOptions"."optionId",
                                          "CreditNoteLineOptions".note,
                                          "Options"."name" as "optionName"
                                          FROM "CreditNoteLineOptions" 
                                          LEFT JOIN "Options" on "Options".id = "CreditNoteLineOptions"."optionId"
                                          where "creditNoteLineId" =$1`,
                        query.values = [line.id];
                    let options = await client.query(query.text, query.values);
                    line.options = options.rows
                    creditNote.lines.push(line);
                }
                let parentLine: CreditNoteLine | undefined;
                creditNote.lines.filter(f => f.parentId != null).forEach(element => {
                    parentLine = creditNote.lines.find(f => f.id == element.parentId);
                    if (parentLine != null) {
                        parentLine!.subItems.push(element);
                        creditNote.lines.splice(creditNote.lines.indexOf(element), 1);
                    }
                });
            }

            creditNote.setTaxesDetails()
            await client.query("COMMIT")
            return new ResponseData(true, "", creditNote)
        } catch (error: any) {
            await client.query("ROLLBACK")
          

            throw new Error(error.message)
        } finally {
            client.release();
        }
    }
    public static async getCreditNoteList(data: any, company: Company, branchList: []) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList



            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';
            let offset = 0;
            let sortTerm;
            let page = data.page ?? 1
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }
            let sort = data.sortBy;
            let sortValue = !sort ? ' "CreditNotes"."createdAt"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? " DESC " : sort.sortDirection;

            if (sort && sort.sortValue == "creditNoteNumber") {
                sortValue = ` regexp_replace("creditNoteNumber", '[A-Za-z0-9]*[_.+=-]', '')::int`
            }

            sortTerm = sortValue + " " + sortDirection;
            let orderByQuery = " ORDER BY " + sortTerm
            let source = data.filter && data.filter.sources && data.filter.sources.length > 0 ? data.filter.sources : ["POS", "Cloud", "Online"]

            const filter = data.filter
            const fromDate = filter && filter.fromDate ? filter.fromDate : null
            const toDate = filter && filter.toDate ? filter.toDate : null

            const query = {
                text: `SELECT 
                    count(*) over(),
                    "CreditNotes"."creditNoteDate",
                    "CreditNotes".id,
                    "CreditNotes"."creditNoteNumber",
                    "CreditNotes"."refrenceNumber",
                    "CreditNotes".total,
                    "CreditNotes".note,
                    "CreditNotes"."employeeId",
                    "CreditNotes"."invoiceId",
                    "CreditNotes"."createdAt",
                    "Branches".name as "branchName",
                    "Employees".name as "employeeName",
                    "Customers".name as "customerName",
                    "CreditNotes".total as  "paidAmount",
                    "CreditNotes".total as "refundDue",
                    "Invoices"."invoiceNumber",
                    COALESCE( sum( "CreditNoteRefunds".total) ,0)as "refundedAmount",
                    COALESCE( sum( "AppliedCredits".amount),0) as "appliedAmount"
                    FROM "CreditNotes" 
                    INNER JOIN "Branches" ON "Branches".id = "CreditNotes"."branchId"		
                    INNER JOIN "Employees" ON "Employees".id = "CreditNotes"."employeeId"
                    INNER JOIN "Invoices" ON "Invoices".id = "CreditNotes"."invoiceId"
                    Left JOIN  "Customers" ON "Invoices"."customerId" = "Customers".id
                    LEFT JOIN "AppliedCredits" ON "AppliedCredits"."creditNoteId" = "CreditNotes".id
                    LEFT JOIN "CreditNoteRefunds" ON "CreditNoteRefunds"."creditNoteId" = "CreditNotes".id
                    where "Branches"."companyId"=$1
                    AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
                    and (LOWER("Customers".name) ~ $3
                        OR LOWER("Employees".name) ~ $3 
                        OR LOWER("Branches".name) ~ $3 
                        OR LOWER("CreditNotes"."creditNoteNumber") ~ $3 
                        OR nullif(regexp_replace("creditNoteNumber", '[A-Z]*-', ''),'') ~ $3)
                    and  "Invoices".source = any($4::text[])
                    AND ($5::Date IS NULL OR "CreditNotes"."creditNoteDate"::date >= $5::date)
                    AND ($6::Date IS NULL OR "CreditNotes"."creditNoteDate"::date <= $6::date)
                    group by "CreditNotes".id, "Branches".id,  "Employees".id,  "Customers".id,"Invoices".id
                    ${orderByQuery}
                    limit $7 offset $8`,
                values: [company.id, branches, searchValue, source, fromDate, toDate, limit, offset]
            }



            const selectList: any = await DB.excu.query(query.text, query.values)

            let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)

            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }
            for (let index = 0; index < selectList.rows.length; index++) {
                const element = selectList.rows[index];
                selectList.rows[index].remainingCredit = await this.getRefundDue(client, element.id, element.invoiceId)
            }

            const resData = {
                list: selectList.rows,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }
            await client.query("COMMIT")

            return new ResponseData(true, "", resData)

        } catch (error: any) {
            await client.query("ROLLBACK")

          
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }

    /** DELETE CREDITNOTES */
    public static async canBeDeleted(client: PoolClient, creditNoteId: string) {
        try {
            // const invoiceSource = {
            //     text: `SELECT "Invoices"."source" FROM "CreditNotes"
            //           inner join "Invoices"  on "Invoices".id = "CreditNotes"."invoiceId" 
            //           where "CreditNotes".id = $1`,
            //     values: [creditNoteId]
            // }
            // let source = await client.query(invoiceSource.text, invoiceSource.values)
            // if (source.rows) {
            //     let invoiceSource = source.rows.length > 0 ? source.rows[0].source : null
            //     if (invoiceSource == 'POS') {
            //         throw new Error("POS INVOIC CANNOT BE DELETED")
            //     }

            const query: { text: string, values: any } = {
                text: `SELECT COUNT(*) FROM "AppliedCredits" where "creditNoteId" = $1`,
                values: [creditNoteId]
            }
            let appliedCredits = await client.query(query.text, query.values);
            if (appliedCredits.rows[0].count > 0) {
                throw new ValidationException("Credit Note Cannot be Deleted")
            } else {
                query.text = `SELECT COUNT(*) FROM "CreditNoteRefunds" where "creditNoteId" = $1`
                let refunds = await client.query(query.text, query.values);
                if (refunds.rows[0].count > 0) {
                    throw new ValidationException("Credit Note Cannot be Deleted")
                }
            }
            // }

            return true;
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getFullCreditNote(client: PoolClient, creditNoteId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT * FROM "CreditNotes" where id = $1`,
                values: [creditNoteId]
            }

            let creditNotesData = await client.query(query.text, query.values);
            let creditNote = new CreditNote();
            creditNote.ParseJson(creditNotesData.rows[0]);

            query.text = ` SELECT * FROM "CreditNoteLines" where "creditNoteId" = $1`;
            query.values = [creditNoteId]

            let lines = await client.query(query.text, query.values);

            for (let index = 0; index < lines.rows.length; index++) {
                const element = lines.rows[index];
                let line = new CreditNoteLine();
                line.ParseJson(element)
                query.text = ` SELECT * FROM "CreditNoteLineOptions" where "creditNoteLineId" =$1`,
                    query.values = [line.id];
                let options = await client.query(query.text, query.values);
                line.options = options.rows;
                creditNote.lines.push(line)
            }

            return new ResponseData(true, "", creditNote)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async deleteCreditNote(creditNoteId: string, company: Company, employeeId: string) {

        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            // to check if invoice has payment or creditNotes or applied credit
            // await this.canBeDeleted(client, creditNoteId);
            const invoiceId = await CreditNoteRepo.getCreditNoteInvoiceId(client, creditNoteId)


            let linesQuery = {
                text: `SELECT JSON_AGG("CreditNoteLines".id) as "ids" ,
                              "CreditNotes"."creditNoteDate",
                       "Invoices"."source",
                         "Invoices"."customerId",
                       "CreditNotes"."branchId",
                       "CreditNotes"."creditNoteNumber",
                       "Employees"."name" as "employeeName"
                       FROM "CreditNoteLines" 
                       INNER JOIN "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId"
                       INNER JOIN "Invoices" on "Invoices".id = "CreditNotes"."invoiceId" 
                       INNER JOIN "Branches" on "CreditNotes"."branchId" = "Branches"."id"
                        INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2
                       where "creditNoteId" = $1
                       group by "CreditNotes".id , "Invoices".id, "Branches".id, "Employees".id `,
                values: [creditNoteId, employeeId, company.id]
            }

            let lineId = await client.query(linesQuery.text, linesQuery.values);
            let lineIds = lineId.rows && lineId.rows.length > 0 && lineId.rows[0].ids ? lineId.rows[0].ids : []
            let branchId = lineId.rows && lineId.rows.length > 0 && lineId.rows[0].branchId ? lineId.rows[0].branchId : []
            let employeeName = lineId.rows && lineId.rows.length > 0 && lineId.rows[0].employeeName ? lineId.rows[0].employeeName : []
            let customerId = lineId.rows && lineId.rows.length > 0 && lineId.rows[0].customerId ? lineId.rows[0].customerId : []
            let creditNoteNumber = lineId.rows && lineId.rows.length > 0 && lineId.rows[0].creditNoteNumber ? `${lineId.rows[0].creditNoteNumber}` : ''

            let source = lineId.rows && lineId.rows.length > 0 && lineId.rows[0].source ? lineId.rows[0].source : []
            let creditNoteDate = lineId.rows && lineId.rows.length > 0 && lineId.rows[0].creditNoteDate ? lineId.rows[0].creditNoteDate : null
            await CompanyRepo.validateTransactionDate(client, creditNoteDate, branchId, company.id)

            let creditLinesOptionsQuery = {
                text: `SELECT JSON_AGG("CreditNoteLineOptions".id) as "ids" FROM "CreditNoteLineOptions"
                         inner join "CreditNoteLines" on  "CreditNoteLineOptions"."creditNoteLineId" = "CreditNoteLines".id
                  where "creditNoteId" = $1`,
                values: [creditNoteId]
            }

            let creditLineOptionIds = await client.query(creditLinesOptionsQuery.text, creditLinesOptionsQuery.values);
            let lineOptionIds = creditLineOptionIds.rows && creditLineOptionIds.rows.length > 0 && creditLineOptionIds.rows[0].ids ? creditLineOptionIds.rows[0].ids : []
            lineOptionIds.forEach((element: any) => {
                lineIds.push(element)
            });


            // Delete movments associated with the invoice 
            await this.deleteCreditNoteMovment(client, creditNoteId)
            //Delete Invoice 

            let creditNote: any = (await this.getFullCreditNote(client, creditNoteId)).data

            await this.returnCreditNoteInventory(client, creditNote)

            const query: { text: string, values: any } = {
                text: ` DELETE FROM "CreditNoteLineOptions" using "CreditNoteLines","CreditNotes"
                WHERE "CreditNoteLineOptions"."creditNoteLineId" = "CreditNoteLines".id 
                AND "CreditNoteLines"."creditNoteId"  ="CreditNotes".id 
                AND  "CreditNotes".id =$1;
                `,
                values: [creditNoteId]
            }
            await client.query(query.text, query.values)

            query.text = `DELETE FROM "CreditNoteLines" using "CreditNotes"
            WHERE "CreditNoteLines"."creditNoteId" = "CreditNotes".id 
            AND  "CreditNotes".id =$1;`

            await client.query(query.text, query.values)

            query.text = ` DELETE FROM "CreditNotes" 
            WHERE  "CreditNotes".id =$1;`

            await client.query(query.text, query.values)


            let log = new Log();
            log.employeeId = employeeId
            log.action = 'Credit Note Deleted'
            log.comment = `${employeeName} has deleted credit note number ${creditNoteNumber}`
            log.metaData = { "deleted": true }

            await LogsManagmentRepo.manageLogs(client, "CreditNotes", creditNoteId, [log], branchId, company.id, employeeId, creditNoteNumber, "Cloud")

            EventLogsSocket.deleteCreditNoteSync(branchId, creditNoteId)
            await client.query("COMMIT")

            return new ResponseData(true, "", { ids: lineIds, invoiceId: invoiceId, customerId: customerId })
        } catch (error: any) {
          
            console.log(error)
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {

            client.release()
        }
    }

    public static async deleteCreditNoteLines(client: PoolClient, lineId: string) {
        try {
            await client.query(`delete from "CreditNoteLines" where id = $1`, [lineId])
            await client.query(`delete from "CreditNoteLineOptions" where "creditNoteLineId" = $1`, [lineId])
            await client.query(`delete from "InventoryMovmentRecords" where "referenceId" =$1`, [lineId])
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async returnCreditNoteInventory(client: PoolClient, creditNote: CreditNote) {
        try {
            /** Note that currentOnHand - creditNoteLineQty is becaues deleteing creditnote remove returned qty of creditNote  */
            for (let index = 0; index < creditNote.lines.length; index++) {
                const element = creditNote.lines[index];
                element.branchId = creditNote.branchId;
                await CreditNoteMovmentRepo.returnLineOptionsInventory(client, element.options, element)
                if (element.productId != null && element.productId != "") {
                    const productType = await ProductRepo.getProductType(client, element.productId)
                    switch (productType) {
                        case "inventory":
                            let productOnHand = await ProductRepo.getProductOnHand(client, element.productId, creditNote.branchId)
                            productOnHand -= element.qty
                            // await BranchProductsRepo.setNewOnHand(client, creditNote.branchId, element.productId, productOnHand)
                            break;
                        case "kit":
                            let kitproductOnHand = await ProductRepo.getProductOnHand(client, element.productId, creditNote.branchId)
                            kitproductOnHand -= element.qty
                            // await BranchProductsRepo.setNewOnHand(client, creditNote.branchId, element.productId, kitproductOnHand)
                            break;
                        case "batch":

                            let batch = await BatchProductRepo.getBatchOnhandAndUnitCost(client, element.batch, element.productId, creditNote.branchId);
                            let onHand = batch.onHand;
                            onHand -= element.qty;

                            // await BatchProductRepo.setBatchOnHand(client, element.batch, element.productId, creditNote.branchId, onHand)
                            break;
                        case "serialized":
                            await SerialProductRepo.setSerialStatus(client, creditNote.branchId, element.productId, "Sold", element.serial)
                            break;

                        case "menuItem":
                            await this.returnMenuItemInventory(client, element.productId, element.qty, creditNote.branchId);
                            break;
                        default:
                            break;
                    }
                }
            }

        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async returnMenuItemInventory(client: PoolClient, productId: string, qty: number, branchId: string) {
        try {
            // loop on product recipes

            let product = await InvoiceInventoryMovmentRepo.getProduct(client, productId);
            if (product.recipes && product.recipes.length > 0) {

                for (let index = 0; index < product.recipes.length; index++) {
                    const recipeItem: any = product.recipes[index];

                    if (recipeItem.recipeId) { // when menu Item recipe is a recipeId
                        //get Recipe items 
                        const recipeData = await RecipeRepo.getRecipeProducts(client, recipeItem.recipeId, recipeItem.usages)

                        for (let index = 0; index < recipeData.length; index++) {
                            const recipeInventoryItem: any = recipeData[index];


                            let productOnHand = await ProductRepo.getProductOnHand(client, recipeInventoryItem.id, branchId)
                            productOnHand -= (qty * recipeInventoryItem.totalUsage)
                            // await BranchProductsRepo.setNewOnHand(client, branchId, recipeInventoryItem.id, productOnHand)
                            // if (lineId)
                            //     await this.createCreditNoteMovment(client, creditNoteLine.employeeId, totalCost, currentOnHand, currentCost, productId, branchId, lineId, qty, afterDecimal)

                        }
                    } else { // when Menu Item is Inventory 

                        let productOnHand = await ProductRepo.getProductOnHand(client, recipeItem.inventoryId, branchId)
                        productOnHand -= (qty * recipeItem.usages)
                        // await BranchProductsRepo.setNewOnHand(client, branchId, recipeItem.inventoryId, productOnHand)
                        // if (lineId)
                        //     await this.createCreditNoteMovment(client, creditNoteLine.employeeId, totalCost, currentOnHand, currentCost, productId, branchId, lineId, qty, afterDecimal)
                    }


                }


            }
        } catch (error: any) {
            console.log(error)

          
            throw new Error(error.message)
        }
    }
    public static async deleteCreditNoteMovment(client: PoolClient, crediteNoteId: string) {
        try {

            const query: { text: string, values: any } = {
                text: ` DELETE FROM "InventoryMovmentLines" using "InventoryMovments","CreditNoteLines","CreditNotes"
                WHERE "InventoryMovmentLines"."inventoryMovmentId" = "InventoryMovments".id 
                AND "InventoryMovments"."creditNoteLineId"  ="CreditNoteLines".id 
                AND "CreditNoteLines"."creditNoteId" = "CreditNotes".id 
                AND  "CreditNotes".id =$1;
                `,
                values: [crediteNoteId]
            };
            await client.query(query.text, query.values);

            query.text = `DELETE FROM "InventoryMovments" using "CreditNoteLines","CreditNotes"
            WHERE "InventoryMovments"."creditNoteLineId"  ="CreditNoteLines".id 
            AND "CreditNoteLines"."creditNoteId" = "CreditNotes".id 
            AND  "CreditNotes".id =$1`
            await client.query(query.text, query.values);


        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    //Get Cutomer Invoices For Credit Note 
    public static async getCustomerInvoicesForCreditNote(branchId: string, customerId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "Invoices".id,"invoiceNumber" ,"Invoices".total
                            FROM "Invoices"
                            LEFT JOIN "CreditNotes"
                            ON "CreditNotes"."invoiceId" = "Invoices".id
                            WHERE "Invoices"."branchId" = $1
                            AND "Invoices"."customerId" =$2
                            and "Invoices".status <> 'Draft'
                            and "Invoices".status <> 'writeOff'
                            GROUP BY  "Invoices".id 
                            Having ("Invoices".total -  COALESCE(SUM("CreditNotes".total), 0))>0
                            ORDER BY "Invoices"."createdAt" DESC
                       `,
                values: [branchId, customerId]
            }
            const invoices = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", invoices.rows)
        } catch (error: any) {

          
            throw new Error(error.message)
        }
    }
    //Generate Credit Note Number
    public static async getCreditNoteNumber(branchId: string, company: Company, client: PoolClient | null = null) {
        try {
            const companyId = company.id;
            let prefixSettings = await TransactionManagements.getPrefix('CreditNote', company.id)
            let prefix = prefixSettings.prefix
            let width = prefixSettings.width

            const query: { text: string, values: any[] } = {
                text: `  SELECT "creditNoteNumber"
                FROM "CreditNotes"
				    INNER JOIN "Branches"
                     ON "Branches".id = "CreditNotes"."branchId"
                     Where "Branches"."companyId" = $1
                  AND "creditNoteNumber" LIKE $2
                  AND SUBSTRING("creditNoteNumber" FROM LENGTH($3)+1) ~ '^[0-9]+$'  -- only numeric suffixes
                ORDER BY 
                  CAST(SUBSTRING("creditNoteNumber" FROM LENGTH($3)+1) AS INT) DESC
                LIMIT 1`,
                values: [companyId, `${prefix}%`, prefix]
            };

            const data = client ? await client.query(query.text, query.values) : await DB.excu.query(query.text, query.values);
            const lastNumber = data.rows && data.rows.length > 0 ? data.rows[0].creditNoteNumber : null;
            let newNumber = TransactionManagements.getNumber(prefix, lastNumber, width)


            return new ResponseData(true, "", { creditNoteNumber: newNumber })
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    //When Creating creditNote on invoice 
    public static async getCreditNoteInvoice(data: any, companyId: string) {
        const client = await DB.excu.client();
        try {

            let invoiceId = data.invoiceId
            let creditNoteId = data.creditNoteId
            // let isAllowed= await this.ifallowedtoCreditNote(client,invoiceId);
            // if(!isAllowed)
            // {
            //     throw new Error("Cannot Create Credit Note On Unpaid Invoice")
            // }
            await client.query("BEGIN")
            const query: { text: string, values: any } = {
                text: `select 
                "Invoices".id,
                               "customerLatLang",
                               "customerAddress",
                               "customerContact",
                               "Invoices"."customerId",
                                  "Invoices"."invoiceDate",
                               "Invoices"."employeeId",
                               "Invoices"."branchId",
                               "Invoices".guests,
                               "Invoices".charges,
                               "invoiceNumber",
                               "Invoices".note,
                               "Invoices"."refrenceNumber", 
                               "serviceId",
                               source,
                               "Customers".name as "customerName",
                               "Employees".name as "employeeName",
                               "Branches".name as "branchName",
                               "Invoices"."tableId",
                               "Invoices".total,
                               "Invoices".status,
                               "Invoices"."discountTotal",
                               "Invoices"."chargeTotal",
                               "Invoices"."chargeAmount",
                               "Invoices"."chargePercentage",
                               "Invoices"."chargeId",
                               "Invoices"."discountAmount",
                               "Invoices"."discountPercentage",
                               "Invoices"."discountId",
                               "Invoices"."deliveryCharge",
                               "Invoices"."subTotal",
                               "Invoices"."createdAt",
                               "Invoices"."discountType",
                               "Invoices"."isInclusiveTax",
                               "Invoices"."chargeType",
                               "Invoices"."chargesTaxDetails"
                         
               from "Invoices"
               LEFT JOIN "CreditNotes" ON "CreditNotes"."invoiceId" = "Invoices".id
               LEFT JOIN "Customers"
               on  "Customers".id = "Invoices"."customerId"
               LEFT JOIN "Employees"
               on "Employees".id = "Invoices"."employeeId"
               inner join "Branches"
               on "Branches".id = "Invoices"."branchId"
               where "Invoices".id=$1 
               and "Branches"."companyId"= $2`,
                values: [invoiceId, companyId]
            }
            const invoiceData = await client.query(query.text, query.values);
            const invoice = new Invoice();
            invoice.ParseJson(invoiceData.rows[0]);
            // on line only qty difference will be returned as qty to prevent user from returning more qty than expected 
            if (invoice.id != "" && invoice.id != null) {


                query.text = `--sql
                with "voidItems" as (
                select "InvoiceLines"."voidFrom"  ,
                sum(COALESCE("InvoiceLines".qty,0)) *(-1) as qty
                from "InvoiceLines" 
                where "InvoiceLines"."invoiceId" = $1 and  "InvoiceLines"."voidFrom" is not null
                group by "InvoiceLines"."voidFrom"
                ) ,"lines" as (
				
				    SELECT 
            "Products".name as "productName",
            "Products".type as "productType", 
            "InvoiceLines".id,
            "InvoiceLines".total,
            "InvoiceLines".price,
            "InvoiceLines"."accountId",
            "InvoiceLines"."productId" ,
            "InvoiceLines"."discountAmount",
            "InvoiceLines"."taxId",
            "InvoiceLines".batch,
                    "InvoiceLines"."parentId",
            "InvoiceLines".serial,
            "InvoiceLines"."taxPercentage",
            "InvoiceLines"."taxes",
            "InvoiceLines"."taxType",
            "InvoiceLines".note,
            "InvoiceLines"."isInclusiveTax",
            "InvoiceLines"."discountId",
            "InvoiceLines"."discountPercentage",
           
            COALESCE( "InvoiceLines".qty ,0)- sum (COALESCE("CreditNoteLines".qty,0)) - sum( COALESCE("voidItems".qty ,0)) as "qty"
             FROM "InvoiceLines" 
             LEFT JOIN "Products" 
             ON  "Products".id =  "InvoiceLines"."productId"
             LEFT JOIN "CreditNoteLines"
             ON "CreditNoteLines"."invoiceLineId" = "InvoiceLines".id
			 LEFT JOIN "voidItems" on "voidItems"."voidFrom" =  "InvoiceLines".id
             where "InvoiceLines"."invoiceId" = $1 AND "InvoiceLines"."voidFrom" is null 
             group by  "Products".id,"InvoiceLines".id
			 having  COALESCE( "InvoiceLines".qty ,0)- sum (COALESCE("CreditNoteLines".qty,0)) - sum( COALESCE("voidItems".qty ,0)) >0
				)
        
		select   "lines"."productName",
            "lines"."productType", 
            "lines".id,
            "lines".total,
            "lines".price,
            "lines"."accountId",
            "lines"."productId" ,
            "lines"."discountAmount",
            "lines"."taxId",
            "lines".batch,
            "lines".serial,
            "lines"."taxPercentage",
            "lines"."taxes",
            "lines"."taxType",
            "lines".note,
            "lines"."discountId",
            "lines"."isInclusiveTax",
            "lines"."discountPercentage",
	        "lines"."qty",
               "lines"."parentId",
            "lines"."qty"  as "maxQty"
			from "lines" 
			where    "lines"."qty" <> 0
		  
	
            

             `
                const lineData = await client.query(query.text, [invoiceId])

                const lines = lineData.rows;

                for (let index = 0; index < lines.length; index++) {
                    const lineData = lines[index];
                    const line = new InvoiceLine();
                    line.ParseJson(lineData);

                    line.selectedItem.id = lineData.productId;
                    line.selectedItem.name = lineData.productName;
                    line.selectedItem.productType = lineData.productType;
                    query.text = `SELECT * FROM "InvoiceLineOptions" WHERE "invoiceLineId"=$1`
                    query.values = [line.id]
                    const optionData = await client.query(query.text, query.values);
                    const option: any = optionData.rows[0]
                    if (option) {
                        line.options.push(option)
                    }

                    invoice.lines.push(line);
                }


                let parentLine: InvoiceLine | undefined;
                invoice.lines.filter(f => f.parentId != null).forEach(element => {

                    parentLine = invoice.lines.find(f => f.id == element.parentId);

                    if (parentLine != null) {
                        parentLine!.subItems.push(element);
                        invoice.lines.splice(invoice.lines.indexOf(element), 1);
                    }
                });
            }
            await client.query("COMMIT")
            return new ResponseData(true, "", invoice);
        } catch (error: any) {
          
            await client.query("ROLLBACK")
            throw new Error(error.message)

        } finally {
            client.release()
        }
    }
    // used on calculating credit note
    public static async getInvoiceInfo(client: PoolClient, invoiceId: string) {

        try {

            const query: { text: string, values: any } = {
                text: `select 
                "Invoices".id,
                    "Invoices"."discountTotal",
                    "Invoices"."subTotal",
                    "Invoices"."total",
                    "Invoices".source,
                    "Invoices"."chargeTotal",
                    "Invoices"."deliveryCharge",
                    "Invoices"."roundingTotal",
                    "Invoices"."discountType",
                    cast ("Invoices"."invoiceDate" as text )
               from "Invoices"
               LEFT JOIN "CreditNotes" ON "CreditNotes"."invoiceId" = "Invoices".id
               LEFT JOIN "Customers"
               on  "Customers".id = "Invoices"."customerId"
               LEFT JOIN "Employees"
               on "Employees".id = "Invoices"."employeeId"
               inner join "Branches"
               on "Branches".id = "Invoices"."branchId"
               inner join "InvoiceLines"
               on "InvoiceLines"."invoiceId"  = "Invoices".id
               where "Invoices".id=$1
               group by "Invoices".id `,
                values: [invoiceId]
            }
            const invoiceData = await client.query(query.text, query.values);
            const invoice = new Invoice();
            invoice.ParseJson(invoiceData.rows[0]);
            query.text = `			 with "invoiceLines" as (
			 SELECT 
            "Products".name as "productName",
            "InvoiceLines".id,
            "InvoiceLines"."discountTotal",
            "InvoiceLines"."discountAmount",
            "InvoiceLines"."discountPercentage",
            "InvoiceLines"."accountId",
            "InvoiceLines"."discountPerQty",
            "InvoiceLines".qty,
			   "InvoiceLines"."productId",
            "InvoiceLines"."taxTotal",
            "InvoiceLines"."recipe",
            CAST(COALESCE(  sum ("CreditNoteLines".qty),0)::numeric AS REAL)  as "creditNoteQty",
            COALESCE(  sum ("CreditNoteLines"."taxTotal"),0)::numeric as "creditNoteTaxTotal",
            jsonb_agg(case when "CreditNoteLines".taxes is not null and  "CreditNoteLines".taxes::text <> '[]' then  "CreditNoteLines".taxes end) as "creditNoteTaxes",
            "InvoiceLines".taxes as "invoiceLineTaxes",
            "InvoiceLines".total
             FROM "InvoiceLines" LEFT JOIN "Products" ON  "Products".id =  "InvoiceLines"."productId"
             LEFT JOIN "CreditNoteLines" ON "CreditNoteLines"."invoiceLineId" = "InvoiceLines".id
             where "InvoiceLines"."invoiceId" = $1
             group by "CreditNoteLines"."invoiceLineId", "Products".id,"InvoiceLines".id
			 ), "options" as (
			 select  "invoiceLines".id as "lineId" , JSON_AGG("InvoiceLineOptions".*) as "options" from "InvoiceLineOptions"
        		inner join "invoiceLines" on "invoiceLines".id = "InvoiceLineOptions"."invoiceLineId"
				 group by   "invoiceLines".id
			 )
			 
			 SELECT * FROM "invoiceLines"
			 LEFT JOIN "options" ON "options"."lineId" = "invoiceLines".id
             `
            const lineData = await client.query(query.text, query.values)
            const lines = lineData.rows;

            lines.forEach(element => {
                invoice.lines.push(element);
            });

            let parentLine: InvoiceLine | undefined;
            invoice.lines.filter(f => f.parentId != null).forEach(element => {

                parentLine = invoice.lines.find(f => f.id == element.parentId);

                if (parentLine != null) {
                    parentLine!.subItems.push(element);
                    invoice.lines.splice(invoice.lines.indexOf(element), 1);
                }
            });


            return invoice;
        } catch (error: any) {
          
            throw new Error(error.message)

        }
    }
    // journal of expense payments (applied Credit)
    public static async getCreditNoteJournal(creditNoteId: string, company: Company) {
        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal

            const mainJournal: { text: string, values: any } = {
                text: `
                SELECT 
                                     case when sum(amount) > 0 then sum(amount::text::NUMERIC )end  as debit,
                                     case when sum(amount) < 0 then ABS(sum(amount::text::NUMERIC))end   as credit,
                                     name as "accountType",
                                     "branchId"
                               FROM "JournalRecords"
                               where "referenceId" = $1
                               and name not in ('Inventory Assets', 'Costs Of Goods Sold')
                            and "amount" <> 0 
                               group by "accountId" , name ,"referenceId" ,"branchId"
                   `,
                values: [creditNoteId]
            }

            const mainJournalRecords = await DB.excu.query(mainJournal.text, mainJournal.values);
            let defaultJournals: any[] = mainJournalRecords && mainJournalRecords.rows && mainJournalRecords.rows.length > 0 ? mainJournalRecords.rows : []


            let getInventoryJournals = {
                text: `select abs(sum("InventoryMovmentRecords"."cost" * "InventoryMovmentRecords"."qty" ) ) as  "cost"  from "InventoryMovmentRecords"
                        where "companyId" = $1
                         and "transactionId" = $2`,
                values: [creditNoteId, creditNoteId]
            }
            let inventoryJournal = await DB.excu.query(getInventoryJournals.text, getInventoryJournals.values);
            if (inventoryJournal && inventoryJournal.rows.length > 0) {

                const cost = (<any>inventoryJournal.rows[0]).cost;
                if (cost && cost != 0) {


                    const costData = {
                        accountType: "Costs Of Goods Sold",
                        debit: 0,
                        credit: cost,
                        dbTable: "Credit Note",
                        referenceId: creditNoteId
                    }
                    const costinvData = {
                        accountType: "Inventory Assets",
                        credit: 0,
                        debit: cost,
                        dbTable: "Credit Note",
                        referenceId: creditNoteId
                    }
                    defaultJournals.push(costinvData)
                    defaultJournals.push(costData)
                }
            }
            const journals: any[] = []
            const query: { text: string, values: any } = {
                text: `

            SELECT 
                            case when sum("JournalRecords".amount) > 0 then sum("JournalRecords".amount::NUMERIC )end  as debit,
                            case when sum("JournalRecords".amount) < 0 then ABS(sum("JournalRecords".amount::NUMERIC))end   as credit,
                            name as "accountType",
                            ''as"invoiceNumber",
                            "JournalRecords"."createdAt",
                            'Refund' as "reference",
                            "JournalRecords"."referenceId"
                    FROM "JournalRecords"
                    INNER JOIN  "CreditNoteRefunds" on "CreditNoteRefunds".id = "JournalRecords"."referenceId"
                    INNER JOIN "CreditNotes" on "CreditNotes".id = "CreditNoteRefunds"."creditNoteId"	
                    INNER JOIN "Invoices" on "Invoices".id = "CreditNotes"."invoiceId"
                    where "CreditNotes".id  =$1
                    group by  "JournalRecords"."accountId" ,  "JournalRecords".name ,"referenceId","JournalRecords"."createdAt","Invoices".id
            
            UNION ALL

            SELECT 
                    case when sum("JournalRecords".amount) > 0 then  sum("JournalRecords".amount::NUMERIC )end  as debit,
                    case when sum("JournalRecords".amount) < 0 then ABS(sum("JournalRecords".amount::NUMERIC))end   as credit,
                    name as "accountType",
                    "Invoices"."invoiceNumber" as"invoiceNumber",
                    "JournalRecords"."createdAt",
                    'Applied Credits' as "reference",
                    "JournalRecords"."referenceId"
            FROM "JournalRecords"
            INNER JOIN  "AppliedCredits" on "AppliedCredits".id = "JournalRecords"."referenceId"	
            INNER JOIN "Invoices" on "Invoices".id = "AppliedCredits"."invoiceId"
            INNER JOIN "CreditNotes" on "CreditNotes".id = "AppliedCredits"."creditNoteId"	
            where "CreditNotes".id  =$1
            group by  "JournalRecords"."accountId" ,  "JournalRecords".name ,"referenceId","JournalRecords"."createdAt","Invoices".id 
                    `,
                values: [creditNoteId]
            }


            const journal = await DB.excu.query(query.text, query.values);

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
                        invoiceNumber: element.invoiceNumber,
                        reference: element.reference,
                        journals: []
                    }

                    data.journals.push(journalInfo)
                    journals.push(data);
                }

            }
            const resaData = {
                defaultJournals: defaultJournals,
                extraJournals: journals
            }
            return new ResponseData(true, "", resaData)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getOldLineQty(client: PoolClient, creditNoteLineId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT qty,"price" from "CreditNoteLines" where "id"=$1`,
                values: [creditNoteLineId]
            }

            let creditNote = await client.query(query.text, query.values);
            return { qty: creditNote.rows[0].qty, unitCost: creditNote.rows[0].unitCost }
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async checkLineBalance(client: PoolClient, productId: string, invoiceId: string, returnedQty: number) {
        try {
            const query: { text: string, values: any } = {
                text: `select "InvoiceLines".qty - sum("CreditNoteLines".qty::text::numeric) from "InvoiceLines" 
                left  join "CreditNoteLines" on "CreditNoteLines"."invoiceLineId" = "InvoiceLines".id 
                where  "InvoiceLines"."invoiceId" = $1 and "InvoiceLines"."productId" = $2
                group by "InvoiceLines".id`,
                values: [invoiceId, productId]
            }

            let creditNote = await client.query(query.text, query.values);
            if (creditNote.rows[0].qty < returnedQty) {
                throw new Error("Returend Qty exceeded Invoice Qty")
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async sendEmail(data: any, company: Company) {
        try {

            let pdfGenerator = new PDFGenerator()
            data.type = "creditNote";
            let pdfBuffer = await pdfGenerator.sendEmail(data, company);

            return pdfBuffer
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }

    public static async getPdf(data: any, company: Company) {
        try {
            data.type = "creditNote";
            let pdfGenerator = new PDFGenerator()
            let pdfBuffer = await pdfGenerator.getPdf(data);
            return pdfBuffer
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }

    public static async getCreditNoteInvoiceId(client: PoolClient | null, crediteNoteId: string) {
        try {
            const query = {
                text: `SELECT "invoiceId" from "CreditNotes" where id =$1`,
                values: [crediteNoteId]
            }

            let invoices = client ? await client.query(query.text, query.values) : await DB.excu.query(query.text, query.values);
            return invoices.rows && invoices.rows.length > 0 && (<any>invoices.rows[0]).invoiceId ? (<any>invoices.rows[0]).invoiceId : null

        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getRefundDue(client: PoolClient | null, creditNoteId: string, invoiceId: string | null) {
        try {

            if (invoiceId == null) {
                invoiceId = await this.getCreditNoteInvoiceId(client, creditNoteId)
            }
            const query = {
                text: `WITH "invoices" AS (
                        SELECT "Invoices".id,
                            "Invoices"."total"::text::numeric - SUM("InvoicePaymentLines"."amount"::text::numeric) AS "total"
                        FROM "Invoices" 
                        INNER JOIN "InvoicePaymentLines" ON "InvoicePaymentLines"."invoiceId" = "Invoices".id
                        INNER JOIN "InvoicePayments" ON "InvoicePayments".id = "InvoicePaymentLines"."invoicePaymentId"
                       inner join "PaymentMethods" on "PaymentMethods".id = "InvoicePayments"."paymentMethodId"
                        WHERE "Invoices"."id" = $1
                         and "InvoicePayments"."status" = 'SUCCESS' 
                        AND lower("PaymentMethods"."name") != ('points')
                        GROUP BY "Invoices".id
                        HAVING "Invoices"."total"::text::numeric - SUM("InvoicePaymentLines"."amount"::text::numeric) <> "Invoices"."total"::text::numeric
                    ), "invoiceBalance" AS (
                        SELECT "invoices".id,
                            ABS("invoices"."total"::text::numeric - SUM("CreditNotes"."total"::text::numeric)) AS "total"
                        FROM "invoices" 
                        INNER JOIN "CreditNotes" ON "invoices".id = "CreditNotes"."invoiceId"
                        GROUP BY "invoices".id, "invoices"."total"
                    ), "creditNotes" AS (
                        SELECT  
                            "CreditNotes".id,
                            "CreditNotes"."creditNoteNumber" as "code",
                                'creditNote' as "reference",
                            CASE 
                                WHEN ( COALESCE("CreditNotes"."total"::text::numeric,0) - COALESCE(SUM(
                                    CASE 
                                        WHEN "CreditNotes"."total" >= "invoiceBalance"."total" THEN "invoiceBalance"."total"::text::numeric
                                        WHEN "CreditNotes"."total" < "invoiceBalance"."total" THEN "CreditNotes"."total"::text::numeric  
                                    END
                                ) OVER (ORDER BY "CreditNotes"."createdAt" DESC),0) = 0) THEN 
                                    (CASE 
                                        WHEN COALESCE("CreditNotes"."total",0) >= COALESCE("invoiceBalance"."total",0) THEN COALESCE("invoiceBalance"."total"::text::numeric,0)
                                        WHEN COALESCE("CreditNotes"."total",0) < COALESCE("invoiceBalance"."total",0) THEN COALESCE("CreditNotes"."total" ::text::numeric,0)
                                    END) 
                                ELSE 
                                   COALESCE( "invoiceBalance"."total",0) - COALESCE( SUM(case when   "CreditNotes"."total" >=  "invoiceBalance"."total" then  "invoiceBalance"."total"::text::numeric
                            when  COALESCE("CreditNotes"."total",0) <  COALESCE("invoiceBalance"."total",0) then     COALESCE("CreditNotes"."total"::text::numeric,0)  end) OVER (ORDER BY "CreditNotes"."createdAt" DESC ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) 
                            END AS "credit"
                        FROM "CreditNotes" 
                        INNER JOIN "invoiceBalance" ON "invoiceBalance".id = "CreditNotes"."invoiceId"
                        ORDER BY "CreditNotes"."createdAt" DESC
                    ),"appliedCredits" as (
                    select"creditNotes".id , sum("AppliedCredits"."amount"::text::numeric)  as "total" from "AppliedCredits" 
                    inner join  "creditNotes" on "creditNotes".id = "AppliedCredits"."creditNoteId"
                    group by "creditNotes".id 
                    ),"refunds" as (
                    select  "creditNotes".id , sum("CreditNoteRefunds"."total"::text::numeric) as "total" from "CreditNoteRefunds" 
                    inner join  "creditNotes" on "creditNotes".id = "CreditNoteRefunds"."creditNoteId"
                    group by "creditNotes".id 
                    ),"creditNoteSummary" as (
                    select  "creditNotes"."id",
                        "creditNotes"."code",
                        "creditNotes"."reference",
                        "creditNotes"."credit"::text::numeric - (COALESCE("appliedCredits"."total",0) + COALESCE("refunds"."total",0)) as "customerCredit"
                        from "creditNotes"
                    left join "appliedCredits" on "appliedCredits".id =  "creditNotes".id
                    left join "refunds" on "refunds".id =  "creditNotes".id
                    where "creditNotes".id = $2
                    )
                                    select * from "creditNoteSummary" where id =$2
                                        and "customerCredit" > 0 `,
                values: [invoiceId, creditNoteId]
            }

            let supplieCredits = client ? await client.query(query.text, query.values) : await DB.excu.query(query.text, query.values);

            if (supplieCredits && supplieCredits.rows && supplieCredits.rows.length > 0 && (<any>supplieCredits.rows[0]).customerCredit > 0) {
                return (<any>supplieCredits.rows[0]).customerCredit
            }

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getRefundDueList(client: PoolClient | null, creditNoteId: string[], invoiceId: string[]) {
        try {
            const query = {
                text: `WITH "invoices" AS (
                        SELECT "Invoices".id,
                            "Invoices"."total"::text::numeric - SUM("InvoicePaymentLines"."amount"::text::numeric) AS "total"
                        FROM "Invoices" 
                        INNER JOIN "InvoicePaymentLines" ON "InvoicePaymentLines"."invoiceId" = "Invoices".id
                        WHERE "Invoices"."id" = any($1::uuid[])
                        GROUP BY "Invoices".id
                        HAVING "Invoices"."total"::text::numeric - SUM("InvoicePaymentLines"."amount"::text::numeric) <> "Invoices"."total"::text::numeric
                    ), "invoiceBalance" AS (
                        SELECT "invoices".id,
                            ABS("invoices"."total"::text::numeric - SUM("CreditNotes"."total"::text::numeric)) AS "total"
                        FROM "invoices" 
                        INNER JOIN "CreditNotes" ON "invoices".id = "CreditNotes"."invoiceId"
                        GROUP BY "invoices".id, "invoices"."total"
                    ), "creditNotes" AS (
                        SELECT  
                            "CreditNotes".id,
                            "CreditNotes"."creditNoteNumber" as "code",
                                'creditNote' as "reference",
                            CASE 
                                WHEN ("CreditNotes"."total" - SUM(
                                    CASE 
                                        WHEN "CreditNotes"."total" >= "invoiceBalance"."total" THEN "invoiceBalance"."total"
                                        WHEN "CreditNotes"."total" < "invoiceBalance"."total" THEN "CreditNotes"."total"  
                                    END
                                ) OVER (ORDER BY "CreditNotes"."createdAt" DESC) = 0) THEN 
                                    (CASE 
                                        WHEN "CreditNotes"."total" >= "invoiceBalance"."total" THEN "invoiceBalance"."total"
                                        WHEN "CreditNotes"."total" < "invoiceBalance"."total" THEN "CreditNotes"."total" 
                                    END) 
                                ELSE 
                                    "invoiceBalance"."total" - SUM(case when   "CreditNotes"."total" >=  "invoiceBalance"."total" then  "invoiceBalance"."total"
                            when  "CreditNotes"."total" <  "invoiceBalance"."total" then     "CreditNotes"."total"  end) OVER (ORDER BY "CreditNotes"."createdAt" DESC ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) 
                            END AS "credit"
                        FROM "CreditNotes" 
                        INNER JOIN "invoiceBalance" ON "invoiceBalance".id = "CreditNotes"."invoiceId"
                        ORDER BY "CreditNotes"."createdAt" DESC
                    ),"appliedCredits" as (
                    select"creditNotes".id , sum("AppliedCredits"."amount"::text::numeric)  as "total" from "AppliedCredits" 
                    inner join  "creditNotes" on "creditNotes".id = "AppliedCredits"."creditNoteId"
                    group by "creditNotes".id 
                    ),"refunds" as (
                    select  "creditNotes".id , sum("CreditNoteRefunds"."total"::text::numeric) as "total" from "CreditNoteRefunds" 
                    inner join  "creditNotes" on "creditNotes".id = "CreditNoteRefunds"."creditNoteId"
                    group by "creditNotes".id 
                    ),"creditNoteSummary" as (
                    select  "creditNotes"."id",
                        "creditNotes"."code",
                        "creditNotes"."reference",
                        "creditNotes"."credit"::text::numeric - (COALESCE("appliedCredits"."total",0) + COALESCE("refunds"."total",0)) as "customerCredit"
                        from "creditNotes"
                    left join "appliedCredits" on "appliedCredits".id =  "creditNotes".id
                    left join "refunds" on "refunds".id =  "creditNotes".id
                    where "creditNotes".id = any($2::uuid[])
                    )
                                        
                                        select * from "creditNoteSummary" where id =any($2::uuid[])
                                        and "customerCredit" > 0 `,
                values: [invoiceId, creditNoteId]
            }

            let creditNotes = client ? await client.query(query.text, query.values) : await DB.excu.query(query.text, query.values);

            if (creditNotes && creditNotes.rows && creditNotes.rows.length > 0) {
                return creditNotes.rows
            }
            return []

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async generateCreditNoteCode(client: PoolClient, companyId: string, id: string, attempts: number = 0, creditNoteCode: string | null) {
        try {
            if (attempts == 10) return new ResponseData(false, "Faild to generate Credit Note Code", { error: 1 })
            const code = creditNoteCode ?? Helper.generate6Code(id)
            const query = {
                text: `select count(*) from "CreditNotes" where "companyId" = $1 and "code"= $2`,
                values: [companyId, code]
            }
            const isExist = await client.query(query.text, query.values);
            if (isExist && isExist.rows && isExist.rows.length > 0 && isExist.rows[0].count > 0) {
                attempts += 1
                await this.generateCreditNoteCode(client, companyId, id, attempts, null)
            }
            await client.query('UPDATE "CreditNotes" set "code" = $1 where id=$2', [code, id])
            return new ResponseData(true, "", { code: code })
        } catch (error: any) {
            throw new Error(error)
        }
    }


}