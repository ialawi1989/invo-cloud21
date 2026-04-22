import { DB } from "@src/dbconnection/dbconnection";
import { BillOfEntry, BillOfEntryLine } from "@src/models/account/BillOfEntry";
import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { PoolClient } from "pg";
import { PaymnetMethodRepo } from "./paymentMethod.repo";

import { ResponseData } from "@src/models/ResponseData";
import { Helper } from "@src/utilts/helper";
import { Account } from "@src/models/account/Account";
import { AccountsRepo } from "./account.repo";
import { TimeHelper } from "@src/utilts/timeHelper";
import { PDFGenerator } from "@src/utilts/PDFGenerator";
import { TransactionManagements } from "@src/utilts/TransactionsManagments";
import { Log } from "@src/models/log";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";

export class BillOfEntryRepo {

    public static async checkIsBillinOfEntryNumberExist(client: PoolClient, id: string | null, BillingNumber: string, companyId: string) {
        try {
            const prefixReg = "^(BOE-)";
            const prefix = "BOE-"
            const num = BillingNumber.replace(prefix, '');
            const numTerm = BillingNumber.toLocaleLowerCase().trim()
            const query: { text: string, values: any } = {
                text: `SELECT 
                              "billingOfEnrtyNumber" 
                        FROM "BillOfEntries"
                        INNER JOIN "Branches"
                        ON "Branches".id = "BillOfEntries"."branchId"
                        WHERE "Branches"."companyId"=$1
                        AND LOWER("billingOfEnrtyNumber") = $2
                 `,
                values: [companyId, numTerm]
            }

            if (id != null) {
                query.text = `SELECT "billingOfEnrtyNumber" 
                 FROM "BillOfEntries"
                 INNER JOIN "Branches"
                 ON "Branches".id = "BillOfEntries"."branchId"
                 WHERE "Branches"."companyId"=$1
                 AND LOWER("billingOfEnrtyNumber") = $2
                    AND "BillOfEntries".id <> $3 `
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
    public static async validateSupplierCountry(client: PoolClient, supplierId: string, companyCountry: string, billingId: string, id: string | null = null) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT case when "country" = $2::text ||  "country" is null then false  else true end as "isValid" FROM "Suppliers" where id =$1`,
                values: [supplierId, companyCountry]
            }

            let supplierCountry = await client.query(query.text, query.values);
            if (supplierCountry && supplierCountry.rows && supplierCountry.rows.length > 0 && supplierCountry.rows[0].isValid) {
                query.text = `SELECT id,  "reconciliationId" FROM "BillOfEntries" where "billingId" = $1 and ($2::uuid is null or  ("BillOfEntries" .id <> $2::uuid  or "BillOfEntries"."reconciliationId" is not null) )`,
                    query.values = [billingId, id]
                let bills = await client.query(query.text, query.values);
                if (bills && bills.rows && bills.rows.length > 0 && bills.rows[0].id && id == null) {
                    throw new ValidationException("Bill of Entry Already Exist on the Following Bill.")
                }

                if (bills && bills.rows && bills.rows.length > 0 && bills.rows[0].reconciliationId) {
                    throw new ValidationException("This Bill of Entry has already been reconciled and cannot be edited.")
                }
                return true;

            }
            throw new ValidationException("Bill of Entry is only allowed for suppliers abroad.")
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async saveBillingEntry(data: any, company: Company, employeeId: string) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            let billOfEntry = new BillOfEntry()
            console.log(data)
            billOfEntry.ParseJson(data);
            billOfEntry.calculateTotal(company.afterDecimal);
            billOfEntry.isInclusiveTax = false
            billOfEntry.attachment = billOfEntry.attachment.map((f: any) => {
                if (f.id) {
                    return { id: f.id }
                }
            })
            billOfEntry.id = billOfEntry.id == "" ? null : billOfEntry.id;
            console.log(billOfEntry)
            await this.validateSupplierCountry(client, billOfEntry.supplierId, company.country, billOfEntry.billingId, billOfEntry.id)
            let isExist = await this.checkIsBillinOfEntryNumberExist(client, billOfEntry.id, billOfEntry.billingOfEnrtyNumber, company.id)
            if (isExist) {
                throw new ValidationException("Bill Of Entry Number Already Used.")
            }
            /** CHECK CUSTOM DUTY ACCOUNT EXIST IF NOT ADD NEW  */
            await this.addCustomDutyAccountIfNotExist(client, company.id)
            let idNumber = ''
            let idString = ''
            if (billOfEntry.id) {
                idNumber = ',$22'
                idString = ',id'
            }

            if (billOfEntry.id == "" || billOfEntry.id == null) {
                const paymentAccountId = await PaymnetMethodRepo.getPaymnetMethodaccountId(client, billOfEntry.paymentMethodId, billOfEntry.branchId);
                billOfEntry.paymentMethodAccountId = paymentAccountId.id;
            }

            const query: { text: string, values: any } = {
                text: `INSERT INTO "BillOfEntries" ("billingOfEnrtyNumber",
                                                    "reference",
                                                    "status",
                                                    "note",
                                                    "employeeId",
                                                    "supplierId",
                                                    "createdAt",
                                                    "branchId",
                                                    "total",
                                                    "billingOfEntryDate",
                                                    "isInclusiveTax",
                                                    "mediaId",
                                                    "attachment",
                                                    "logs",
                                                    "paymentTerm",
                                                    "roundingTotal",
                                                    "smallestCurrency",
                                                    "roundingType",
                                                    "paymentMethodId",
                                                    "paymentMethodAccountId",
                                                    "billingId"
                                                    ${idString}) 
                       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21${idNumber})
                       ON CONFLICT ("id") 
                       DO UPDATE SET
                           "billingOfEnrtyNumber" = EXCLUDED."billingOfEnrtyNumber",
                           "reference" = EXCLUDED."reference",
                           "status" = EXCLUDED."status",
                           "total" = EXCLUDED."total",        
                           "billingOfEntryDate" = EXCLUDED."billingOfEntryDate",        
                           "isInclusiveTax" = EXCLUDED."isInclusiveTax",        
                           "mediaId" = EXCLUDED."mediaId",        
                           "attachment" = EXCLUDED."attachment",        
                           "logs" = EXCLUDED."logs",        
                           "paymentTerm" = EXCLUDED."paymentTerm",        
                           "roundingTotal" = EXCLUDED."roundingTotal",        
                           "smallestCurrency" = EXCLUDED."smallestCurrency",        
                           "roundingType" = EXCLUDED."roundingType",        
                           "paymentMethodId" = EXCLUDED."paymentMethodId",        
                           "paymentMethodAccountId" = EXCLUDED."paymentMethodAccountId"      
                       RETURNING id 
                                       `,
                values: [billOfEntry.billingOfEnrtyNumber,
                billOfEntry.reference,
                billOfEntry.status,
                billOfEntry.note,
                billOfEntry.employeeId,
                billOfEntry.supplierId,
                billOfEntry.createdAt,
                billOfEntry.branchId,
                billOfEntry.total,
                billOfEntry.billingOfEntryDate,
                billOfEntry.isInclusiveTax,
                billOfEntry.mediaId,
                JSON.stringify(billOfEntry.attachment),
                JSON.stringify(billOfEntry.logs),
                billOfEntry.paymentTerm,
                billOfEntry.roundingTotal,
                billOfEntry.smallestCurrency,
                billOfEntry.roundingType,
                billOfEntry.paymentMethodId,
                billOfEntry.paymentMethodAccountId,
                billOfEntry.billingId,
                ]
            }
            if (billOfEntry.id) {
                query.values.push(billOfEntry.id)
            }
            const save = await client.query(query.text, query.values);
            if (save && save.rows && save.rows.length > 0 && save.rows[0].id) {
                billOfEntry.id = save.rows[0].id
            }
            for (let index = 0; index < billOfEntry.lines.length; index++) {
                const element = billOfEntry.lines[index];
                if (billOfEntry.id) {
                    element.billOfEntryId = billOfEntry.id;
                    element.createdAt = TimeHelper.getCreatedAt(billOfEntry.billingOfEntryDate, company.timeOffset);
                    await this.saveBillingEntryLine(client, element, employeeId)
                }
            }

            await client.query("COMMIT")

            return new ResponseData(true, "", { id: billOfEntry.id })
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async saveBillingEntryLine(client: PoolClient, line: BillOfEntryLine, employeeId: string) {
        try {

            let idNumber = ''
            let idString = ''
            if (line.id) {
                idNumber = ',$21'
                idString = ',id'
            }

            if (line.id == "" || line.id == null) {
                line.employeeId = employeeId;
            }
            console.log(line)
            const query: { text: string, values: any } = {
                text: `INSERT INTO "BillOfEntryLines" ("qty",
                                                    "unitCost",
                                                    "billOfEntryId",
                                                    "productId",
                                                    "note",
                                                    "total",
                                                    "subTotal",
                                                    "taxId",
                                                    "taxTotal",
                                                    "taxPercentage",
                                                    "isInclusiveTax",
                                                    "taxes",
                                                    "taxType",
                                                    "employeeId",
                                                    "parentId",
                                                    "createdAt",
                                                    "customDuty",
                                                    "billingLineId",
                                                    "discountTotal",
                                                    "billDiscount"
                                                    ${idString}) 
                       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20${idNumber})
                       ON CONFLICT ("id") 
                       DO UPDATE SET
                           "note" = EXCLUDED."note",
                           "total" = EXCLUDED."total",
                           "subTotal" = EXCLUDED."subTotal",
                           "taxId" = EXCLUDED."taxId",        
                           "taxTotal" = EXCLUDED."taxTotal",        
                           "taxPercentage" = EXCLUDED."taxPercentage",        
                           "isInclusiveTax" = EXCLUDED."isInclusiveTax",        
                           "taxes" = EXCLUDED."taxes",        
                           "taxType" = EXCLUDED."taxType",        
                        "createdAt" = case when "BillOfEntryLines"."createdAt"::date = EXCLUDED."createdAt"::date then    "BillOfEntryLines"."createdAt" else EXCLUDED."createdAt" end  ,        
                           "customDuty" = EXCLUDED."customDuty",      
                           "discountTotal" = EXCLUDED."discountTotal",      
                           "billDiscount" = EXCLUDED."billDiscount"     
                       RETURNING id 
                                       `,
                values: [line.qty,
                line.unitCost,
                line.billOfEntryId,
                line.productId,
                line.note,
                line.total,
                line.subTotal,
                line.taxId,
                line.taxTotal,
                line.taxPercentage,
                line.isInclusiveTax,
                JSON.stringify(line.taxes),
                line.taxType,
                line.employeeId,
                line.parentId,
                line.createdAt,
                line.customDuty,
                line.billingLineId,
                line.discountTotal,
                line.billDiscount
                ]
            }
            if (line.id) {
                query.values.push(line.id)
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }
    public static async getBillingEntryList(data: any, company: Company, brancheLists: []) {
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
            let sortValue = !sort ? ' "BillOfEntries"."createdAt"' : '"' + sort.sortValue + '"';

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
                                "BillOfEntries".id,
                                "BillOfEntries"."billingOfEnrtyNumber",
                                "BillOfEntries"."createdAt",
                    
             
                                "BillOfEntries".note, 
                                "BillOfEntries".reference,
        
                                "BillOfEntries".total,
                                "BillOfEntries"."billingOfEntryDate",
                                "BillOfEntries"."supplierId",
                                "BillOfEntries"."billingId",
                    
                                "Suppliers".name as "supplierName",
                                "Employees".name as "employeeName",
                                "Branches".name as "branchName",
                                
                                    "Billings"."billingNumber"
                        FROM "BillOfEntries"
                        inner join "Billings" ON "Billings".id = "BillOfEntries"."billingId"
                        left JOIN "Suppliers" ON "Suppliers".id = "BillOfEntries"."supplierId"
                        left JOIN "Employees" ON "Employees".id = "BillOfEntries"."employeeId"
                        left JOIN "Branches"  ON "Branches".id =  "BillOfEntries"."branchId"
                      
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
                        group by "BillOfEntries".id, "Billings".id,"Suppliers".id , "Employees".id,"Branches".id
                         ${orderByQuery}
                        limit $6 offset $7
                       `,
                values: [company.id, searchValue, branches, fromDate, toDate, limit, offset]
            }


            // when data is empty return the whole list 

            const selectList = await DB.excu.query(query.text, query.values)
            for (let index = 0; index < selectList.rows.length; index++) {
                let bill = new BillOfEntry();
                const element = selectList.rows[index];
                bill.ParseJson(element);

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



    public static async getBillingEntryById(id: string, company: Company) {


        try {


            const query: { text: string, values: any } = {
                text: `
                      select  "BillOfEntries".*,
                              "Billings"."billingNumber",
                              "Suppliers".name as "supplierName",
                                "Employees".name as "employeeName",
                                "Branches".name as "branchName",
                                "Branches"."customFields" as "branchCustomFields",
                                 "PaymentMethods".name as "paymentMethodName",
                                    (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',COALESCE("Media"."url"->>'downloadUrl',"Media"."url"->>'defaultUrl'),'mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("BillOfEntries"."attachment") as attachments(attachments)
                        inner join "Media" on "Media".id = (attachments->>'id')::uuid
                        ) as "attachment"
                        from "BillOfEntries"
                        inner join "Billings" ON "Billings".id = "BillOfEntries"."billingId"
                              left JOIN "PaymentMethods"  ON "PaymentMethods".id =  "BillOfEntries"."paymentMethodId"
                        left JOIN "Suppliers" ON "Suppliers".id = "BillOfEntries"."supplierId"
                        left JOIN "Employees" ON "Employees".id = "BillOfEntries"."employeeId"
                        left JOIN "Branches"  ON "Branches".id =  "BillOfEntries"."branchId"
                  
                        where  "BillOfEntries".id = $1
                        and "Branches"."companyId" = $2
                `,
                values: [id, company.id]
            }
            const billingData = await DB.excu.query(query.text, query.values)
            const billing: any = billingData.rows[0];
            const bill = new BillOfEntry();
            bill.ParseJson(billing);



            query.text = `SELECT
                            "BillOfEntryLines".id,
                            "BillOfEntryLines". qty,
                            "BillOfEntryLines"."unitCost",
                            "BillOfEntryLines"."productId",
                
                     
                            "BillOfEntryLines".note,
                            "BillOfEntryLines"."taxId",
                            "BillOfEntryLines"."employeeId",
                            "BillOfEntryLines"."taxPercentage",
                            "BillOfEntryLines".taxes,
                            "BillOfEntryLines"."taxType",
                            "BillOfEntryLines"."taxTotal",
                            "BillOfEntryLines"."subTotal",
                      
                            "BillOfEntryLines"."total",
                            "BillOfEntryLines"."SIC",
                            "BillOfEntryLines"."isInclusiveTax",
                            "BillOfEntryLines"."parentId",
                            "BillOfEntryLines"."billingLineId",
                            "BillOfEntryLines"."customDuty",
                           COALESCE( "BillOfEntryLines"."discountTotal",0) as "discountTotal",
                            COALESCE("BillOfEntryLines"."billDiscount",0) as "billDiscount",
                            "Products".name AS "productName",
                            "Products".type AS "productType",
                            "Products"."UOM" AS "UOM",
                            "BillOfEntryLines"."SIC"
                    FROM "BillOfEntryLines"
                    LEFT JOIN "Products"
                    ON "Products".id = "BillOfEntryLines"."productId"
                    WHERE "BillOfEntryLines"."billOfEntryId"=$1
                    group by  "BillOfEntryLines".id,"Products".id 
                    order by   "BillOfEntryLines"."createdAt" 
                    `;



            if (bill && (bill.id != "" && bill.id != null)) {
                const line: any = await DB.excu.query(query.text, [id])
                if (line.rows) {
                    for (let index = 0; index < line.rows.length; index++) {
                        const element = line.rows[index];
                        let billingLine = new BillOfEntryLine();
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


            bill.calculateTotal(company.afterDecimal);



            return new ResponseData(true, "", bill)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getBillingOfEntryNumber(branchId: string, company: Company) {
        try {

            const companyId = company.id;
            let prefixSettings = await TransactionManagements.getPrefix('BillOfEntry', company.id)
            let prefix = prefixSettings.prefix
            let width = prefixSettings.width

            const query: { text: string, values: any[] } = {
                text: `  SELECT "billingOfEnrtyNumber"
                            FROM "BillOfEntries"
                                INNER JOIN "Branches"
                                 ON "Branches".id = "BillOfEntries"."branchId"
                                 Where "Branches"."companyId" = $1
                              AND "billingOfEnrtyNumber" LIKE $2
                              AND SUBSTRING("billingOfEnrtyNumber" FROM LENGTH($3)+1) ~ '^[0-9]+$'  -- only numeric suffixes
                            ORDER BY 
                              CAST(SUBSTRING("billingOfEnrtyNumber" FROM LENGTH($3)+1) AS INT) DESC
                            LIMIT 1`,
                values: [companyId, `${prefix}%`, prefix]
            };

            const data = await DB.excu.query(query.text, query.values);
            const lastNumber = data.rows && data.rows.length > 0 ? data.rows[0].billingOfEnrtyNumber : null;
            let newNumber = TransactionManagements.getNumber(prefix, lastNumber, width)

            return new ResponseData(true, "", { billingNumber: newNumber })
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }


    public static async addCustomDutyAccountIfNotExist(client: PoolClient, companyId: string) {
        try {
            const query = {
                text: `SELECT count(id)  FROM "Accounts" where "name" = 'Custom Duty' and "companyId" = $1 and "default" = true`,
                values: [companyId]
            }
            let account = await client.query(query.text, query.values);
            if (account && account.rows && account.rows.length > 0 && account.rows[0].count > 0) {
                return true
            }

            let newAccount = new Account();
            newAccount.name = 'Custom Duty'
            newAccount.parentType = 'Operating Expense'
            newAccount.type = 'Expense'
            newAccount.default = true
            newAccount.companyId = companyId

            await AccountsRepo.addAccounts(client, newAccount, companyId, null)
            return true
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }


    public static async deleteBillOfEnrty(id: string, company: Company, employeeId: string) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")

            let billOfEntryLinesQuery = {
                text: `SELECT JSON_AGG("BillOfEntryLines".id) as "ids" ,
                              "BillOfEntries"."branchId",
                                   "BillOfEntries"."billingOfEnrtyNumber" as "billingOfEntryNumber",
                                   "Employees"."name" as "employeeName"
                       FROM "BillOfEntryLines"
                       INNER JOIN "BillOfEntries" on "BillOfEntries".id = "BillOfEntryLines"."billOfEntryId"
                        INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2
                       where "billOfEntryId" = $1
                        group by  "BillOfEntries".id, "Employees".id
                        `,
                values: [id, employeeId, company.id]
            }

            let billOfEnrtyResult = await client.query(billOfEntryLinesQuery.text, billOfEntryLinesQuery.values);
            let branchId = billOfEnrtyResult.rows && billOfEnrtyResult.rows.length > 0 && billOfEnrtyResult.rows[0].branchId ? billOfEnrtyResult.rows[0].branchId : null
            let billingOfEntryNumber = billOfEnrtyResult.rows && billOfEnrtyResult.rows.length > 0 && billOfEnrtyResult.rows[0].billingOfEntryNumber ? billOfEnrtyResult.rows[0].billingOfEntryNumber : ''
            let employeeName = billOfEnrtyResult.rows && billOfEnrtyResult.rows.length > 0 && billOfEnrtyResult.rows[0].employeeName ? billOfEnrtyResult.rows[0].employeeName : ''


            await client.query(`DELETE FROM "BillOfEntryLines" USING "BillOfEntries" 
                                 WHERE "BillOfEntries".id = "BillOfEntryLines"."billOfEntryId"
                                 and "BillOfEntries".id  =$1
                              `, [id])

            await client.query(`DELETE FROM "BillOfEntries" 
                                WHERE "BillOfEntries".id  =$1
                             `, [id])

            let log = new Log();
            log.employeeId = employeeId
            log.action = 'Bill Of Entry Deleted'
            log.comment = `${employeeName} has deleted Bill Of Entry number ${billingOfEntryNumber}`
            log.metaData = {"deleted": true}
            await LogsManagmentRepo.manageLogs(client, "BillOfEntries",id,[log], branchId, company.id, employeeId,billingOfEntryNumber, "Cloud")
            

            await client.query("COMMIT")
        } catch (error: any) {
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async sendBillOfEntryEmail(data: any, company: Company) {
        try {

            let pdfGenerator = new PDFGenerator()
            data.type = "BillOfEntry"
            let pdfBuffer = await pdfGenerator.sendEmail(data, company);

            return pdfBuffer
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }

    public static async getPdf(data: any) {
        try {
            let pdfGenerator = new PDFGenerator()
            let pdfBuffer = await pdfGenerator.getPdf(data);
            return pdfBuffer
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }
}