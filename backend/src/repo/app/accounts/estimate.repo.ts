import { DB } from "@src/dbconnection/dbconnection";
import { Estimate } from "@src/models/account/Estimate";
import { EstimateLine } from "@src/models/account/EstimateLine";
import { EstimateLineOption } from "@src/models/account/EstimateLineOption";
import { ResponseData } from "@src/models/ResponseData";
import { Helper } from "@src/utilts/helper";
import { PoolClient } from "pg";
import { InvoiceRepo } from "./invoice.repo";


import { SocketEstimateRepo } from "@src/repo/socket/Estimate.socket";
import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { EventLog, Log } from "@src/models/log";
import { PDFGenerator } from "@src/utilts/PDFGenerator";
import { EventLogsRepo } from "./eventlogs.repo";
import { EventLogsSocket } from "@src/repo/socket/eventLogs.socket";
import { TransactionManagements } from "@src/utilts/TransactionsManagments";
import { TableConfig, TableDataService, TableRequest } from "@src/utilts/TableDataService";
import { CustomizationRepo } from "../settings/Customization.repo";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";

export class EstimateRepo {

    public static async checkIsEstimateNumberExist(client: PoolClient, id: string | null, estimateNumber: string, companyId: string) {
        try {
            const prefixReg = "^(EST-)";
            const prefix = "EST-"
            const num = estimateNumber.replace(prefix, '');
            const numTerm = estimateNumber.toLocaleLowerCase().trim()
            const query: { text: string, values: any } = {
                text: `SELECT 
                         "estimateNumber" 
                    FROM "Estimates"
                    INNER JOIN "Branches"
                    ON "Branches".id = "Estimates"."branchId"
                    WHERE "Branches"."companyId"=$1
                    AND ( LOWER("estimateNumber") = $2 )
                `,
                values: [companyId, numTerm]
            }

            if (id != null) {
                query.text = `SELECT "Estimates".id,"estimateNumber" 
                FROM "Estimates"
                INNER JOIN "Branches"
                ON "Branches".id = "Estimates"."branchId"
                WHERE "Branches"."companyId"=$1
                       AND ( LOWER("estimateNumber") = $2 )
                AND "Estimates".id <> $3 `
                query.values = [companyId, numTerm, id]
            }
            const estimateNumberData = await client.query(query.text, query.values);
            if (estimateNumberData.rowCount != null && estimateNumberData.rowCount > 0) {
                return true;
            } else {
                return false;
            }
        } catch (error: any) {

            throw new Error(error.message)
        }
    }



    public static async getEstimateLineOldTotal(client: PoolClient, estimateLineId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT total from "EstimateLines" where id =$1`,
                values: [estimateLineId]
            }

            let estimate = await client.query(query.text, query.values);
            return estimate.rows[0].total;
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }
    public static async addEstimate(client: PoolClient, data: any, company: Company) {

        try {
            const companyId = company.id;


            const afterDecimal = company.afterDecimal

            const estimate = new Estimate();
            estimate.ParseJson(data);
            estimate.attachment = estimate.attachment.map((f: any) => { return { id: f.id } }) ?? []

            if (estimate.estimateNumber) {

                const isEstimateNumberExist = await this.checkIsEstimateNumberExist(client, null, estimate.estimateNumber, companyId)
                if (isEstimateNumberExist) {
                    throw new Error("Estimate Number Already Used")
                }
            }



            estimate.calculateTotal(afterDecimal);




            estimate.createdAt = new Date()
            estimate.updatedDate = new Date()
            const query: { text: string, values: any } = {
                text: `INSERT INTO "Estimates" 
                                   ( "estimateNumber",
                                     "refrenceNumber",
                                     total,
                                     note,
                                     guests,
                                     "employeeId",
                                     "tableId",
                                     "branchId",
                                     "customerId",
                                     "chargeTotal",
                                     "chargeAmount",
                                     "chargePercentage",
                                     "chargeId",
                                     "discountAmount",
                                     "discountPercentage",
                                     "discountTotal",
                                     "discountId",
                                     "deliveryCharge",
                                     "subTotal",
                                     source,
                                     "estimateDate",
                                     "isInclusiveTax",
                                     "updatedDate",
                                     "estimateExpDate",
                                     "onlineData",
                                     "serviceId",
                                     "createdAt",
                                     "customerContact",
                                     "smallestCurrency",
                                     "roundingTotal",
                                     "roundingType",
                                     "attachment",
                                     "salesEmployeeId",
                                     "customFields") 
                            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32, $33,$34) RETURNING id `,
                values: [estimate.estimateNumber,
                estimate.refrenceNumber,
                estimate.total,
                estimate.note,
                estimate.guests,
                estimate.employeeId,
                estimate.tableId,
                estimate.branchId,
                estimate.customerId,
                estimate.chargeTotal,
                estimate.chargeAmount,
                estimate.chargePercentage,
                estimate.chargeId,
                estimate.discountAmount,
                estimate.discountPercentage,
                estimate.discountTotal,
                estimate.discountId,
                estimate.deliveryCharge,
                estimate.subTotal,
                estimate.source,
                estimate.estimateDate,
                estimate.isInclusiveTax,
                estimate.updatedDate,
                estimate.estimateExpDate,
                estimate.onlineData,
                estimate.serviceId,
                estimate.createdAt,
                estimate.customerContact,
                estimate.smallestCurrency,
                estimate.roundingTotal,
                estimate.roundingType,
                JSON.stringify(estimate.attachment),
                estimate.salesEmployeeId,
                estimate.customFields
                ]
            }


            const estimateInsert = await client.query(query.text, query.values);
            const estimateId = (<any>estimateInsert.rows[0]).id;


            // Insert InvoicLine and InvoiceLineOptions
            for (let index = 0; index < estimate.lines.length; index++) {
                const estimateLine = estimate.lines[index];
                estimateLine.employeeId = estimateLine.employeeId ? estimateLine.employeeId : estimate.employeeId;
                estimateLine.estimateId = estimateId;
                estimateLine.index = index;
                if ((estimateLine.productId == null || estimateLine.productId == "") && (estimateLine.note == null || estimateLine.note == "")) {
                    continue;
                }
                const insertInvoiveLine = await this.insertEstimateLine(client, estimateLine)
                estimateLine.id = insertInvoiveLine.data.id;
                if (estimateLine.options && estimateLine.options.length > 0) {
                    for (let index = 0; index < estimateLine.options.length; index++) {
                        const estimateLineOption = estimateLine.options[index];
                        estimateLineOption.estimateLineId = estimateLine.id;
                        await this.addEstimateLineOptions(client, estimateLineOption)
                    }
                }
            }


            return new ResponseData(true, "Added Successfully", { id: estimateId, estimate: estimate })
        } catch (error: any) {



            throw new Error(error.message)

        }
    }
    public static async editEstimate(client: PoolClient, data: any, company: Company, employeeId: string | null, source: string | null = null) {

        try {
            const companyId = company.id;


            if (data.id == "" || data.id == null) {
                throw new ValidationException("Invoice Id is Required")
            }



            const afterDecimal = company.afterDecimal;
            const estimate = new Estimate();
            estimate.ParseJson(data);
            estimate.calculateTotal(afterDecimal);

            estimate.logs = []

            estimate.updatedDate = new Date()
            estimate.attachment = estimate.attachment.map((f: any) => { return { id: f.id } }) ?? []
            if (estimate.estimateNumber) {
                const isEstimateNumberExist = await this.checkIsEstimateNumberExist(client, estimate.id, estimate.estimateNumber, companyId)
                if (isEstimateNumberExist) {
                    throw new ValidationException("Estimate Number Already Used")
                }
            }


            const deletedLine = estimate.lines.filter(f => f.isVoided)
            if (deletedLine && deletedLine.length > 0 && estimate.source == 'POS') {
                throw new ValidationException("Line Cannot Be Deleted")
            }

            if (deletedLine && deletedLine.length == estimate.lines.length) {
                throw new ValidationException("Estimates cannot be empty")
            }
            const query: { text: string, values: any } = {
                text: `UPDATE  "Estimates" SET  
                                      "estimateNumber"=$1,
                                      "refrenceNumber"=$2,
                                       total=$3,
                                       note=$4,
                                       guests=$5,
                                       "tableId"=$6,
                                       "customerId"=$7,
                                       "chargeTotal"=$8,
                                       "chargeAmount"=$9,
                                       "chargePercentage"=$10,
                                       "chargeId"=$11,
                                       "discountAmount"=$12,
                                       "discountPercentage"=$13,
                                       "discountId"=$14,
                                       "deliveryCharge"=$15,
                                       "subTotal"=$16,
                                       "estimateDate"=$17,
                                       "updatedDate"=$18,
                                       "discountTotal"=$19,
                                       "isInclusiveTax"=$20,
                                       "estimateExpDate"=$21,
                                       "onlineData" =$22,
                                       "serviceId"=$23,
                                       "customerContact"=$24,
                                       "smallestCurrency" = $25,
                                       "roundingTotal"=$26,
                                       "roundingType"=$27,
                                       "attachment"=$28,
                                       "salesEmployeeId" = $29,
                                       "branchId"=$30,
                                       "customFields" = $31
                                WHERE  id=$32  `,
                values: [estimate.estimateNumber,
                estimate.refrenceNumber,
                estimate.total,
                estimate.note,
                estimate.guests,
                estimate.tableId,
                estimate.customerId,
                estimate.chargeTotal,
                estimate.chargeAmount,
                estimate.chargePercentage,
                estimate.chargeId,
                estimate.discountAmount,
                estimate.discountPercentage,
                estimate.discountId,
                estimate.deliveryCharge,
                estimate.subTotal,
                estimate.estimateDate,
                estimate.updatedDate,
                estimate.discountTotal,
                estimate.isInclusiveTax,
                estimate.estimateExpDate,
                estimate.onlineData,
                estimate.serviceId,
                estimate.customerContact,
                estimate.smallestCurrency,
                estimate.roundingTotal,
                estimate.roundingType,
                JSON.stringify(estimate.attachment),
                estimate.salesEmployeeId,
                estimate.branchId,
                estimate.customFields,
                estimate.id


                ]
            }

            const estimateEdit = await client.query(query.text, query.values);


            for (let index = 0; index < estimate.lines.length; index++) {
                const estimateLine = estimate.lines[index];
                estimateLine.index = index;
                estimateLine.estimateId = estimate.id;
                if ((estimateLine.productId == null || estimateLine.productId == "") && (estimateLine.note == null || estimateLine.note == "")) {
                    continue;
                }
                if (estimateLine.id != null && estimateLine.id != "") {
                    let oldTotal = await this.getEstimateLineOldTotal(client, estimateLine.id)
                    if (oldTotal != estimateLine.total && employeeId) {
                        Log.addLog(estimate, "Edit Estimate Line", "Edit", employeeId)

                    }

                    if (estimateLine.isVoided) {
                        await this.deleteLine(client, estimateLine.id)
                    } else {
                        await this.updateEstimateLine(client, estimateLine)

                    }

                } else {
                    if (employeeId) {
                        estimateLine.employeeId = employeeId;
                        Log.addLog(estimate, "Add Estimate Line", "Edit", employeeId)
                    }

                    await this.insertEstimateLine(client, estimateLine)
                }

                for (let index = 0; index < estimateLine.options.length; index++) {
                    const option = estimateLine.options[index];

                    if (option.id != null && option.id != "") {

                        await this.editEstimateLineOptions(client, option)
                    } else {
                        await this.addEstimateLineOptions(client, option)
                    }
                }

            }

            if (estimate.source == "POS") {
                await SocketEstimateRepo.sendUpdateEstimate(estimate.branchId, estimate)
            }

            if (employeeId && estimate.logs.length == 0) {
                Log.addLog(estimate, "Edit", "Edit", employeeId)
            }

            await this.setEstimateLogs(client, estimate.id, estimate.logs, estimate.branchId, company.id, employeeId, estimate.estimateNumber, "Cloud")
            return new ResponseData(true, "Updated Successfully", { estimate: estimate })

        } catch (error: any) {

            console.log(error)


            throw new Error(error)

        }
    }

    public static async setEstimateLogs(client: PoolClient, estimateId: string, logs: Log[], branchId: string, companyId: string, employeeId: string | null, estimateNumber: string | null, source: string) {
        try {
            await LogsManagmentRepo.manageLogs(client, "Estimates", estimateId, logs, branchId, companyId, employeeId, estimateNumber, source)

        } catch (error: any) {
            throw new Error(error)
        }
    }
    private static async insertEstimateLine(client: PoolClient, estimateLine: EstimateLine) {
        try {


            const query: { text: string, values: any } = {
                text: `INSERT INTO "EstimateLines" 
                                   ( "estimateId",
                                      total,
                                      price,
                                      qty,
                                      "productId",
                                      "employeeId",
                                      "salesEmployeeId",
                                      "serviceDuration",
                                      "serviceDate",
                                      note,
                                      "discountAmount",
                                      "discountPercentage",
                                      "discountTotal",
                                      "taxPercentage",
                                      "taxId",
                                      "subTotal",
                                      batch,
                                      serial ,
                                      "accountId",
                                      "seatNumber",
                                      "taxTotal",
                                      "taxes",
                                      "taxType",
                                      "isInclusiveTax",
                                    "index") 
                       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING id`,
                values: [estimateLine.estimateId,
                estimateLine.total,
                estimateLine.price,
                estimateLine.qty,
                estimateLine.productId,
                estimateLine.employeeId,
                estimateLine.salesEmployeeId,
                estimateLine.serviceDuration,
                estimateLine.serviceDate,
                estimateLine.note,
                estimateLine.discountAmount,
                estimateLine.discountPercentage,
                estimateLine.discountTotal,
                estimateLine.taxPercentage,
                estimateLine.taxId,
                estimateLine.subTotal,
                estimateLine.batch,
                estimateLine.serial,
                estimateLine.accountId,
                estimateLine.seatNumber,
                estimateLine.taxTotal,
                JSON.stringify(estimateLine.taxes),
                estimateLine.taxType,
                estimateLine.isInclusiveTax,
                estimateLine.index]
            }

            const insertInvoiceLine = await client.query(query.text, query.values);
            estimateLine.id = (<any>insertInvoiceLine.rows[0]).id


            return new ResponseData(true, "", { id: estimateLine.id })
        } catch (error: any) {
            console.log(error)

            throw new Error(error.message)
        }

    }
    private static async updateEstimateLine(client: PoolClient, estimateLine: EstimateLine) {
        try {


            const query: { text: string, values: any } = {
                text: `UPDATE "EstimateLines" SET 
                                      total=$1,
                                      price=$2,
                                      qty=$3,
                                      "serviceDate"=$4 ,
                        
                                      "serviceDuration"=$5,
                                      note=$6,
                                      "discountAmount"=$7,
                                      "discountPercentage"=$8,
                                      "discountTotal"=$9,
                                      "taxPercentage"=$10,
                                      "taxId"=$11,
                                      "subTotal"=$12,
                                      batch=$13,
                                      serial=$14,
                                      "discountId" = $15,
                                      "accountId"=$16,
                                      "seatNumber"=$17,
                                      "taxTotal"=$18,
                                      "taxes"=$19,
                                      "taxType"=$20,
                                      "isInclusiveTax"=$21,
                                      "salesEmployeeId" = $22,
                                      "index" = $23
                    WHERE "estimateId"=$24 AND id=$25`,
                values: [estimateLine.total,
                estimateLine.price,
                estimateLine.qty,
                estimateLine.serviceDate,
                estimateLine.serviceDuration,
                estimateLine.note,
                estimateLine.discountAmount,
                estimateLine.discountPercentage,
                estimateLine.discountTotal,
                estimateLine.taxPercentage,
                estimateLine.taxId,
                estimateLine.subTotal,
                estimateLine.batch,
                estimateLine.serial,
                estimateLine.discountId,
                estimateLine.accountId,
                estimateLine.seatNumber,
                estimateLine.taxTotal,
                JSON.stringify(estimateLine.taxes),
                estimateLine.taxType,
                estimateLine.isInclusiveTax,
                estimateLine.salesEmployeeId,
                estimateLine.index,
                estimateLine.estimateId,

                estimateLine.id]
            }
            const updateEstimateLine = await client.query(query.text, query.values);
            return new ResponseData(true, "Updated Successfully", [])
        } catch (error: any) {

            throw new Error(error.message)
        }
    }


    private static async addEstimateLineOptions(client: PoolClient, estimateLineOption: EstimateLineOption) {
        try {
            const query: { text: string, values: any } = {
                text: `INSERT INTO "EstimateLineOptions" 
                                   ("estimateLineId"
                                    ,price
                                    ,qty
                                    ,note,
                                    "optionId") 
                        VALUES($1,$2,$3,$4,$5) RETURNING id `,
                values: [estimateLineOption.estimateLineId, , estimateLineOption.price, estimateLineOption.qty, estimateLineOption.note, estimateLineOption.optionId]
            }


            const insert = await client.query(query.text, query.values)
            estimateLineOption.id = (<any>insert.rows[0]).id
            return new ResponseData(true, "Added Successfully", { id: estimateLineOption.id })
        } catch (error: any) {

            throw new Error(error.message)
        }
    }
    private static async editEstimateLineOptions(client: PoolClient, estimateLineOption: EstimateLineOption) {
        try {


            const query: { text: string, values: any } = {
                text: `UPDATE  "EstimateLineOptions" SET 
                                           price = $1 ,
                                           qty=$2,
                                           note=$3 
                                WHERE id = $4 
                                AND "invoiceLineId" =$5 
                                AND "optionId" =$6 `,
                values: [estimateLineOption.price, estimateLineOption.qty, estimateLineOption.note, estimateLineOption.id, estimateLineOption.estimateLineId, estimateLineOption.optionId]
            }

            const update = await client.query(query.text, query.values)

            return new ResponseData(true, "Updated Successfully", [])
        } catch (error: any) {

            throw new Error(error.message)
        }
    }
    public static async getEstimateSource(estimateId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT source From "Estimates" where id=$1`,
                values: [estimateId]
            }

            const estimate = await DB.excu.query(query.text, query.values);
            return { source: (<any>estimate.rows[0]).source }
        } catch (error: any) {

            throw new Error(error.message)
        }
    }


    public static async convertToInvoice(data: any, employeeId: string, company: Company) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            data.invoice.estimateId = data.estimateId;// to link converted estimate to the newly created invoice 
            data.invoice.employeeId = employeeId;
            data.invoice.estimateSource = (await this.getEstimateSource(data.estimateId)).source;
            const invoice = await InvoiceRepo.addInvoice(client, data.invoice, company)
            await client.query("COMMIT")

            return invoice;
        } catch (error: any) {
            await client.query("ROLLBACK")


            throw new Error(error.message)
        } finally {
            client.release()
        }
    }


    public static async getEstimateById(estimateId: string, company: Company) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN");
            const companyId = company.id;
            const query: { text: string, values: any } = {
                text: `SELECT   "Estimates".id,
                cast ("Estimates"."estimateDate"::date  as text ) as "estimateDate",
                "Estimates".guests,
                "estimateNumber",
                "Estimates".note,
                "Estimates"."refrenceNumber",
                "Estimates"."serviceId",
                "Estimates". source,
                "Estimates"."tableId",
                "Estimates"."branchId",
                "Estimates"."customerId",
                "Customers".name as "customerName",
                "Customers"."phone" as "customerContact",
                "Estimates"."discountTotal",
                "Estimates"."discountAmount",
                "Estimates"."deliveryCharge",
                "Estimates"."discountPercentage",
                "Estimates"."chargeId",
                "Estimates"."chargePercentage",
                "Estimates"."chargeAmount",
                "Estimates"."subTotal",
                "Estimates"."chargeTotal",
                "Estimates"."customFields",
                "Estimates"."isInclusiveTax",
                "Estimates"."discountType",
                "Estimates"."salesEmployeeId",
                "salesEmployee".name as "salesEmployeeName",
                "Estimates"."onlineData",
                (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',COALESCE("Media"."url"->>'downloadUrl',"Media"."url"->>'defaultUrl'),'mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("Estimates"."attachment") as attachments(attachments)
                   inner join "Media" on "Media".id = (attachments->>'id')::uuid
                ) as "attachment",
                "Branches".name as "branchName",
                "Branches".address as "branchAddress",
                "Branches"."phoneNumber" as "branchPhone",
                "Branches"."customFields" as "branchCustomFields",
                CAST(  "Estimates"."estimateExpDate" AS TEXT ) AS "estimateExpDate",
                "Estimates".total,
                "Invoices".id as "invoiceId",
                "Companies"."vatNumber" as "companyVatNumber",
                "Customers"."vatNumber" as "customerVatNumber",
                "Customers"."email" as "customerEmail",
                "Invoices"."invoiceNumber",
                "Employees".name as "employeeName",
                "Estimates"."smallestCurrency",
                "Estimates"."roundingTotal",
                "Estimates"."roundingType"
                 FROM "Estimates" 
                 inner join "Branches" ON "Branches".id = "Estimates"."branchId"  
                 LEFT JOIN "Invoices" ON "Invoices"."estimateId" =  "Estimates".id
                 LEFT JOIN "Customers" ON "Estimates"."customerId" =  "Customers".id
                 inner join "Companies" ON  "Companies".id = "Branches"."companyId"
                 LEFT JOIN "Employees" ON "Employees".id = "Estimates"."employeeId"
                 left join "Employees" "salesEmployee" on  "salesEmployee".id =   "Estimates"."salesEmployeeId" 

                 WHERE "Estimates".id =$1 
                 AND "Branches"."companyId"=$2
                  `,
                values: [estimateId, company.id]
            }
            const estimateData = await client.query(query.text, query.values);
            const estimate = new Estimate();
            const afterDecimal = company.afterDecimal;
            estimate.ParseJson(estimateData.rows[0]);
            if (estimate.id != "" && estimate.id != null) {
                query.text = `SELECT 
                            "Products".name as "productName",
                            "Products".type AS "productType",
                            "EstimateLines".id,
                            "EstimateLines".total,
                            "EstimateLines".price,
                            "EstimateLines".qty,
                            "EstimateLines"."productId", 
                            "EstimateLines".note,
                            "EstimateLines"."discountId",
                            "EstimateLines"."discountAmount",
                            "EstimateLines"."discountPercentage",
                            "EstimateLines"."discountTotal",
                            "EstimateLines"."taxes",
                            "EstimateLines"."taxType",
                            "EstimateLines"."taxPercentage",
                            "EstimateLines"."taxTotal",
                            "EstimateLines"."taxId",
                            "EstimateLines"."subTotal",
                            "EstimateLines"."accountId",
                            "EstimateLines".batch,
                            "EstimateLines"."isInclusiveTax",
                            "EstimateLines"."index",
                            "EstimateLines".serial
                          FROM "EstimateLines"
                          LEFT JOIN "Products"
                          ON "Products".id = "EstimateLines"."productId"
                          WHERE "estimateId" = $1
                          order by "EstimateLines"."index" ASC, "EstimateLines"."createdAt" DESC
                          `

                query.values = [estimateId]
                const estimateLinesData: any = await client.query(query.text, [estimateId])
                for (let index = 0; index < estimateLinesData.rows.length; index++) {
                    const estimateLine = estimateLinesData.rows[index];
                    const temp = new EstimateLine();
                    temp.ParseJson(estimateLine);
                    temp.selectedItem.id = estimateLine.productId;
                    temp.selectedItem.name = estimateLine.productName;
                    temp.selectedItem.type = estimateLine.productType;
                    query.text = `SELECT * FROM "EstimateLineOptions" where "estimateLineId" =$1`,
                        query.values = [temp.id];
                    let options = await client.query(query.text, query.values);
                    temp.options = options.rows;
                    estimate.lines.push(temp);
                }
            }
            await client.query("COMMIT");
            estimate.calculateTotal(afterDecimal)
            return new ResponseData(true, "", estimate);
        } catch (error: any) {
            await client.query("ROLLBACK");

            throw new Error(error.message)
        } finally {
            client.release();
        }
    }

    public static async getEstimates(data: any, company: Company, branchList: []): Promise<ResponseData> {
        try {
            const companyId = company.id;

            // --- Normalize pagination/sorting/search ---
            const page = Number.isFinite(+data?.page) && +data.page > 0 ? +data.page : 1;
            const limit = Number.isFinite(+data?.limit) && +data.limit > 0 ? +data.limit : 15;

            const searchTerm: string | undefined =
                typeof data?.searchTerm === 'string' && data.searchTerm.trim() !== ''
                    ? data.searchTerm.trim()
                    : undefined;

            // --- Filters ---
            const branches: string[] =
                (data?.filter?.branches?.length ? data.filter.branches : branchList) as string[];

            const sources: string[] =
                (data?.filter?.sources?.length ? data.filter.sources : ['POS', 'Cloud', 'Online']) as string[];

            const fromDate: string | undefined = data?.filter?.fromDate;
            const toDate: string | undefined = data?.filter?.toDate;

            // --- Sorting ---
            const incomingSortBy = data?.sort?.sortValue as string | undefined;
            const incomingSortDir = String(data?.sort?.sortDirection || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

            const productId = data?.filter?.productId ? data?.filter?.productId : null
            const salesEmployeeId = data?.filter?.salesEmployeeId ? data?.filter?.salesEmployeeId : null

            const sortByKey =
                incomingSortBy === 'estimateNumber'
                    ? 'estimateNumberSort'
                    : incomingSortBy
                        ? incomingSortBy
                        : 'estimateDateThenTime';
            const sortDir = incomingSortDir;

            // --- Table setup ---
            const aliasMap = {
                e: 'Estimates',
                b: 'Branches',
                c: 'Customers',
                emp: 'Employees',
                i: 'Invoices',
            } as const;

            const joinDefs = {
                joinBranch: { joinTable: 'b', onLocal: 'e.branchId', onForeign: 'b.id' },
                joinCustomer: { joinTable: 'c', onLocal: 'e.customerId', onForeign: 'c.id' },
                joinEmployee: { joinTable: 'emp', onLocal: 'e.employeeId', onForeign: 'emp.id' },
                joinInvoice: { joinTable: 'i', onLocal: 'e.id', onForeign: 'i.estimateId' },
            };

            // --- Column map ---
            const columnMap: TableConfig['columnMap'] = {
                id: { table: 'e', dbCol: 'id' },
                estimateDate: { table: 'e', dbCol: 'estimateDate', cast: 'timestamp' },
                guests: { table: 'e', dbCol: 'guests' },
                estimateNumber: { table: 'e', dbCol: 'estimateNumber' },
                refrenceNumber: { table: 'e', dbCol: 'refrenceNumber' },
                serviceId: { table: 'e', dbCol: 'serviceId' },
                source: { table: 'e', dbCol: 'source' },
                tableId: { table: 'e', dbCol: 'tableId' },
                branchId: { table: 'e', dbCol: 'branchId' },
                total: { table: 'e', dbCol: 'total', cast: 'numeric' },
                estimateExpDate: { table: 'e', dbCol: 'estimateExpDate', cast: 'timestamp' },
                createdAt: { table: 'e', dbCol: 'createdAt', cast: 'timestamp' },
                companyId: { table: 'b', dbCol: 'companyId', joinRequired: 'joinBranch' },

                // Computed
                time: { rawExpr: `e."createdAt"::timestamp::time`, table: 'e', dbCol: 'createdAt' },
                estimateDateThenTime: {
                    rawExpr: `(e."estimateDate"::date, e."createdAt"::timestamp::time)`,
                    table: 'e',
                    dbCol: 'estimateDate'
                },
                estimateNumberSort: {
                    rawExpr: `COALESCE(NULLIF(regexp_substr(regexp_substr(e."estimateNumber", '[_.+=-]\\d*$'), '\\d*$'), ''), '0')::int`,
                    table: 'e',
                    dbCol: 'estimateNumber',
                    cast: 'int'
                },

                // Joined display columns
                branchName: { table: 'b', dbCol: 'name', joinRequired: 'joinBranch' },
                customerName: { table: 'c', dbCol: 'name', joinRequired: 'joinCustomer' },
                employeeName: { table: 'emp', dbCol: 'name', joinRequired: 'joinEmployee' },
                invoiceId: { table: 'i', dbCol: 'id', joinRequired: 'joinInvoice' },
                invoiceNumber: { table: 'i', dbCol: 'invoiceNumber', joinRequired: 'joinInvoice' },
                isInvoice: {
                    rawExpr: `CASE WHEN i."estimateId" IS NULL THEN false ELSE true END`,
                    table: 'i',
                    dbCol: 'estimateId',
                    joinRequired: 'joinInvoice'
                },

            };

            if(productId) columnMap.productId = { table: 'el', dbCol: 'productId' };
            if(salesEmployeeId) columnMap.salesEmployeeId = { table: 'el', dbCol: 'salesEmployeeId' };

            const estimateCF = await CustomizationRepo.getCustomizationByKey('estimate', 'customFields', company);
            for (const field of (estimateCF?.data?.customFields || [])) {
                const key = String(field.id).replace(/"/g, '');
                const outKey = String(field.abbr || key).replace(/\s+/g, '_');
                columnMap[outKey] = { table: 'e', dbCol: 'customFields', jsonKV: { key: field.id, cast: 'text' } };
            }

            // --- Searchable columns ---
            const searchableColumns = [
                'customerName',
                'employeeName',
                'branchName',
                'estimateNumber',
                'refrenceNumber'
            ];

            // --- Selectable columns ---
            const DEFAULT_COLUMNS = [
                'id',
                'estimateDate',
                'guests',
                'estimateNumber',
                'refrenceNumber',
                'serviceId',
                'source',
                'tableId',
                'branchId',
                'total',
                'estimateExpDate',
                'createdAt',
                'time',
                'branchName',
                'customerName',
                'employeeName',
                'invoiceId',
                'invoiceNumber',
                'isInvoice',
              
            ];

            if(productId) DEFAULT_COLUMNS.push('productId');
            if(salesEmployeeId) DEFAULT_COLUMNS.push('salesEmployeeId');

            const selectableColumns = [
                ...DEFAULT_COLUMNS,
                'estimateDateThenTime',
                'estimateNumberSort',
                'companyId',
                ...Object.keys(columnMap).filter(k => !DEFAULT_COLUMNS.includes(k))
            ];

            const EstimateConfig: TableConfig = {
                aliasMap: aliasMap as any,
                columnMap,
                joinDefs,
                searchableColumns,
                selectableColumns
            };

            const service = new TableDataService(EstimateConfig);

            // --- Filters ---
            const filters: TableRequest['filters'] = [
                { column: 'companyId', operator: 'eq', value: companyId }
            ];

            if (branches?.length) filters.push({ column: 'branchId', operator: 'in', value: branches });
            if (sources?.length) filters.push({ column: 'source', operator: 'in', value: sources });
            if (fromDate) filters.push({ column: 'estimateDate', operator: 'ge' as any, value: fromDate });
            if (toDate) filters.push({ column: 'estimateDate', operator: 'le' as any, value: toDate });
            if (productId) filters.push({
                column: 'productId', operator: 'eq', value: [productId], query: `  EXISTS (
                                                                                    SELECT 1 
                                                                                    FROM "EstimateLines" el
                                                                                    WHERE el."estimateId" = e.id
                                                                                    AND el."productId" = ?
                                                                                )`});
            if (salesEmployeeId) filters.push({
                column: 'salesEmployeeId', operator: 'eq', value: [salesEmployeeId, salesEmployeeId], query: `     (
                                                                            e."salesEmployeeId" = ?
                                                                            OR EXISTS (
                                                                                SELECT 1
                                                                                FROM "EstimateLines" el
                                                                                WHERE el."estimateId" = e.id
                                                                                AND el."salesEmployeeId" = ?
                                                                            )
                                                                        )`});
            // --- Columns selection ---
            const userCols = Array.isArray(data?.columns) ? (data.columns as string[]).map(String) : DEFAULT_COLUMNS;
            let selectColumns = userCols.filter(c => selectableColumns.includes(c));
            if (!selectColumns.length) selectColumns = DEFAULT_COLUMNS;
            if (!selectColumns.includes('id')) selectColumns.push('id');
            if (selectColumns.includes('invoiceNumber')) selectColumns.push('invoiceId');


            // --- Build request ---
            const req: TableRequest = {
                table_name: 'Estimates',
                select_columns: selectColumns as any,
                filters,
                search_term: searchTerm,
                sort_by: selectableColumns.includes(sortByKey) ? (sortByKey as any) : ('estimateDateThenTime' as any),
                sort_order: sortDir,
                page_number: page,
                page_size: limit
            };

            // --- Execute ---
            const result = await service.getTableData<any>(req);

            // --- Prepare response ---
            const list = result.data;
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

            return new ResponseData(true, '', resData);
        } catch (error: any) {

            throw new Error(error?.message ?? String(error));
        }
    }


    public static async getEstimates1(data: any, company: Company, branchList: []) {
        try {
            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;



            let searchValue = data.searchTerm ? data.searchTerm.toLowerCase().trim() : '[A-Za-z0-9]*';

            let sources = data.filter && data.filter.sources && data.filter.sources.length > 0 ? data.filter.sources : ["POS", "Cloud", "Online"]
            const limit = ((data.limit == null) ? 15 : data.limit);
            let page = data.page ?? 1
            let offset = 0;
            if (page != 1) {
                offset = (limit * (page - 1))
            }
            let sort = data.sort;
            let sortValue = !sort ? '"Estimates"."createdAt"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? " DESC " : sort.sortDirection;
            if (sort && sort.sortValue == "estimateNumber") {
                sortValue = ` regexp_replace("estimateNumber", '[A-Za-z0-9]*[_.+=-]', '')::int `
            }

            let sortTerm = sortValue + " " + sortDirection;
            let orderByQuery = " ORDER BY " + sortTerm
            const filter = data.filter
            const fromDate = filter && filter.fromDate ? filter.fromDate : null
            const toDate = filter && filter.toDate ? filter.toDate : null

            const query = {
                text: `SELECT 
                    COUNT(*) OVER(),
                    "Estimates".id,
                    "Estimates"."estimateDate",
                    "Estimates".guests,
                    "estimateNumber",
                    "Estimates".note,
                    "Estimates"."refrenceNumber",
                    "Estimates"."serviceId",
                    "Estimates". source,
                    "Estimates"."tableId",
                    "Estimates"."branchId",
                    "Estimates".total,
                    "Estimates"."estimateExpDate",
                    "Estimates"."createdAt",
          
                    "Customers".name as "customerName",
                    "Employees".name as "employeeName",
                    "Branches".name as "branchName",
                    "Invoices".id as "invoiceId",
                    "Invoices"."invoiceNumber",
                    case when "Invoices"."estimateId" IS NULL then false else true end as "isInvoice"
                FROM "Estimates"
                LEFT JOIN "Customers" on  "Customers".id = "Estimates"."customerId"
                LEFT JOIN "Employees" on "Employees".id = "Estimates"."employeeId"
                inner join "Branches" on "Branches".id = "Estimates"."branchId"
                LEFT JOIN "Invoices"  ON "Invoices"."estimateId" =  "Estimates".id
                where "Branches"."companyId"=$1
                AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
                and (LOWER("Customers".name) ~ $3 
                    OR LOWER("Employees".name) ~ $3 
                    OR LOWER("Branches".name) ~ $3
                    OR LOWER("Estimates"."estimateNumber") ~ $3 
                    OR LOWER("Estimates"."refrenceNumber") ~ $3 
                    OR  regexp_replace("estimateNumber", '[A-Za-z_.+=-]*', '')   ~ $3
                    )
            AND "Estimates".source = any($4)
            AND ($5::Date IS NULL OR "Estimates"."estimateDate"::date >= $5::date)
            AND ($6::Date IS NULL OR "Estimates"."estimateDate"::date <= $6::date)
            ${orderByQuery}
            limit $7 offset $8`,
                values: [company.id, branches, searchValue, sources, fromDate, toDate, limit, offset]
            }




            const selectList = await DB.excu.query(query.text, query.values)


            let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
            let pageCount = Math.ceil(count / limit)

            offset += 1
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
            console.log(error)

            throw new Error(error)
        }
    }


    public static async getEstimateNumber(branchId: string, company: Company) {
        try {
            const companyId = company.id;
            let prefixSettings = await TransactionManagements.getPrefix('Estimate', company.id)
            let prefix = prefixSettings.prefix
            let width = prefixSettings.width

            const query: { text: string, values: any[] } = {
                text: `  SELECT "estimateNumber"
                FROM "Estimates"
				    INNER JOIN "Branches"
                     ON "Branches".id = "Estimates"."branchId"
                     Where "Branches"."companyId" = $1
                  AND "estimateNumber" LIKE $2
                  AND SUBSTRING("estimateNumber" FROM LENGTH($3)+1) ~ '^[0-9]+$'  -- only numeric suffixes
                ORDER BY 
                  CAST(SUBSTRING("estimateNumber" FROM LENGTH($3)+1) AS INT) DESC
                LIMIT 1`,
                values: [companyId, `${prefix}%`, prefix]
            };

            const data = await DB.excu.query(query.text, query.values);
            const lastNumber = data.rows && data.rows.length > 0 ? data.rows[0].estimateNumber : null;
            let newNumber = TransactionManagements.getNumber(prefix, lastNumber, width)

            return new ResponseData(true, "", { estimateNumber: newNumber })
        } catch (error: any) {

            throw new Error(error.message)
        }
    }


    public static async getEstimateLogs(client: PoolClient, estimateId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT logs FROM "Estimates" where id =$1`,
                values: [estimateId]
            }

            let estimate = await client.query(query.text, query.values);
            return estimate.rows[0].logs ?? []
        } catch (error: any) {
            throw new Error(error)
        }
    }
    /** */
    public static async setEstimateOnlineStatus(data: any, status: string) {
        try {
            data = data

            const query: any = {
                text: `UPDATE "Estimates" set  "onlineData" = jsonb_set("onlineData"  ,'{onlineStatus}',
                    to_jsonb($1::text))where id =$2`,
                values: []
            }
            if (data.id.length > 0) {
                for (let index = 0; index < data.id.length; index++) {
                    const element: any = data.id[index];
                    query.values = [status, element]
                    await DB.excu.query(query.text, query.values);

                }
            }



        } catch (error: any) {



            throw new Error(error)
        }
    }

    public static async sendEmail(data: any, company: Company) {
        try {

            let pdfGenerator = new PDFGenerator()
            data.type = 'estimate'
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
            data.type = 'estimate'
            let pdfBuffer = await pdfGenerator.getPdf(data);
            return pdfBuffer
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }

    public static async deleteLine(client: PoolClient, lineId: string) {
        try {
            const query = {
                text: `DELETE FROM "EstimateLines" where id = $1`,
                values: [lineId]
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async deleteEstimate(id: string, companyId: string, employeeId: string) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            let invoiceQuery = {
                text: `SELECT COUNT(id) from "Invoices" where "companyId" = $1 and "estimateId" =$2 `,
                values: [companyId, id]
            }
            let invoices = await client.query(invoiceQuery.text, invoiceQuery.values);
            if (invoices && invoices.rows && invoices.rows.length > 0 && invoices.rows[0].count > 0) {
                throw new ValidationException("Can’t delete this estimate because it’s already linked to an invoice.")
            }


            let estimate = await client.query(`
                                SELECT "Estimates"."source", "Estimates"."branchId",  "Estimates"."estimateNumber", "Employees"."name" as "employeeName" 
                                FROM "Estimates" 
                                INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2
                                where "Estimates".id = $1`,
                [id, employeeId, companyId]
            )

            let branchId = estimate.rows && estimate.rows.length > 0 ? estimate.rows[0].branchId : null
            let source = estimate.rows && estimate.rows.length > 0 ? estimate.rows[0].source : null
            let estimateNumber = estimate.rows && estimate.rows.length > 0 && estimate.rows[0].estimateNumber ? `${estimate.rows[0].estimateNumber}` : ''
            let employeeName = estimate.rows && estimate.rows.length > 0 && estimate.rows[0].employeeName ? `${estimate.rows[0].employeeName}` : ''

            if (source && source == 'POS' || source == 'Online') {
                throw new ValidationException("Cant Delete POS Estimate")

            }


            await client.query(`DELETE FROM "EstimateLines"
                                USING "Estimates"
                                WHERE "EstimateLines"."estimateId" = "Estimates".id
                                AND "Estimates".id = $1`, [id])
            await client.query('DELETE FROM "Estimates" where id = $1', [id])

            let log = new Log();
            log.employeeId = employeeId
            log.action = 'Estimate Deleted'
            log.comment = `${employeeName} has deleted estimate number ${estimateNumber}`
            log.metaData = { "deleted": true }

            await LogsManagmentRepo.manageLogs(client, "Estimates", id, [log], branchId, companyId, employeeId, estimateNumber, source)


            EventLogsSocket.deleteEstimateSync(branchId, id)
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