import { DB } from "@src/dbconnection/dbconnection";
import { PurchaseOrder } from "@src/models/account/PurchaseOrder";
import { PurchaseOrderLine } from "@src/models/account/PurchaseOrderLines";
import { ResponseData } from "@src/models/ResponseData";
import { Helper } from "@src/utilts/helper";
import { PurchaseValidation } from "@src/validationSchema/account/purchase.Schema";

import { PoolClient } from "pg";
import { BillingRepo } from "./billing.repo";


import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { Log } from "@src/models/log";
import { PDFGenerator } from "@src/utilts/PDFGenerator";
import { AccountsRepo } from "./account.repo";
import { ProductRepo } from "../product/product.repo";
import { TransactionManagements } from "@src/utilts/TransactionsManagments";
import { TableConfig, TableDataService, TableRequest } from "@src/utilts/TableDataService";
import { CustomizationRepo } from "../settings/Customization.repo";
import { getValuable } from "@src/utilts/getValuable";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";
import { CompanyRepo } from "@src/repo/admin/company.repo";

export class PurchaseOrderRepo {
    //check if purchase Number is already used or not 
    public static async checkIsPurchaseNumberExist(client: PoolClient, id: string | null, purchaseNumber: string, companyId: string) {
        try {
            const prefixReg = "^(PO-)";
            const prefix = "PO-"
            const num = purchaseNumber.replace(prefix, '');
            const numTerm = purchaseNumber.toLocaleLowerCase().trim()
            const query: { text: string, values: any } = {
                text: `SELECT "purchaseNumber" 
                FROM "PurchaseOrders"
                INNER JOIN "Branches"
                ON "Branches".id = "PurchaseOrders"."branchId"
                WHERE "Branches"."companyId"=$1
                AND ( trim(LOWER("purchaseNumber")) = $2 )
                `,
                values: [companyId, numTerm]
            }

            if (id != null) {
                query.text = `SELECT "purchaseNumber" 
                FROM "PurchaseOrders"
                INNER JOIN "Branches"
                ON "Branches".id = "PurchaseOrders"."branchId"
                WHERE "Branches"."companyId"=$1
                 AND ( trim(LOWER("purchaseNumber")) = $2 )
                AND "PurchaseOrders".id <> $3 `
                query.values = [companyId, numTerm, id]
            }

            const purchaseNumberData = await client.query(query.text, query.values);
            if (purchaseNumberData.rowCount != null && purchaseNumberData.rowCount > 0) {
                return true;
            } else {
                return false;
            }
        } catch (error: any) {

            throw new Error(error.message)
        }
    }

    //Insert Purchase Order
    public static async addPurchaseOrder(client: PoolClient, data: PurchaseOrder, company: Company, employeeId: string, dueDate: Date | null = null) {

        try {

            const companyId = company.id;
            const validate = await PurchaseValidation.purchaseValidationValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            const purchasOrder = new PurchaseOrder();
            const afterDecimal = company.afterDecimal



            purchasOrder.ParseJson(data);
            purchasOrder.employeeId = employeeId;
            purchasOrder.calculateTotal(afterDecimal)
            purchasOrder.dueDate = dueDate ? dueDate : purchasOrder.dueDate

            purchasOrder.createdAt = new Date();
            const isPurchaseNumberExist = await this.checkIsPurchaseNumberExist(client, null, purchasOrder.purchaseNumber, companyId)
            if (isPurchaseNumberExist) {
                throw new ValidationException("Purchase Number Already Exist")
            }


            const query: { text: string, values: any } = {
                text: `INSERT INTO "PurchaseOrders"
                                  ("purchaseNumber",
                                  reference,
                                  "employeeId",
                                  "supplierId",
                                  "dueDate",
                                  "branchId",
                                  total,
                                  "createdAt",
                                  "purchaseDate",
                                  "isInclusiveTax",
                                  "smallestCurrency",
                                  "roundingType",
                                  "roundingTotal",
                                  "customFields") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, $14)RETURNING id`,
                values: [purchasOrder.purchaseNumber,
                purchasOrder.reference,
                purchasOrder.employeeId,
                purchasOrder.supplierId,
                purchasOrder.dueDate,
                purchasOrder.branchId,
                purchasOrder.total,
                purchasOrder.createdAt,
                purchasOrder.purchaseDate,
                purchasOrder.isInclusiveTax,
                purchasOrder.smallestCurrency,
                purchasOrder.roundingType,
                purchasOrder.roundingTotal,
                JSON.stringify(purchasOrder.customFields)
                ]
            }

            const insert = await client.query(query.text, query.values);
            purchasOrder.id = (<any>insert.rows[0]).id
            let productWithEmptyAccounts = purchasOrder.lines.filter(f => f.productId && !f.accountId).map(m => { return m.productId });
            if (productWithEmptyAccounts && productWithEmptyAccounts.length > 0) {
                let accounts = await this.getProductAccountId(client, productWithEmptyAccounts, companyId);
                if (accounts && accounts.length > 0) {
                    purchasOrder.lines = purchasOrder.lines.map(line => {
                        const product = accounts.find(f => f.id == line.productId)
                        if (product && !line.accountId) {
                            line.accountId = product.accountId
                        }
                        return line
                    })
                }
            }

            for (let index = 0; index < purchasOrder.lines.length; index++) {
                const line: PurchaseOrderLine = purchasOrder.lines[index];
                line.index = index
                if ((line.productId == null || line.productId == "") && (line.note == null || line.note == "")) {
                    continue;
                }
                line.purchaseOrderId = purchasOrder.id
                await this.addPurchaseOrderLine(client, line, afterDecimal)
            }
            await client.query("COMMIT")

            return new ResponseData(true, "", { id: purchasOrder.id })

        } catch (error: any) {

            console.log(error);

            throw new Error(error.message)
        }
    }
    public static async addPurchaseOrderLine(client: PoolClient, line: PurchaseOrderLine, afterDecimal: number) {
        try {
            const purchaseOrderLine = new PurchaseOrderLine();
            purchaseOrderLine.ParseJson(line);
            purchaseOrderLine.calculateTotal(afterDecimal)
            const query: { text: string, values: any } = {
                text: `INSERT INTO "PurchaseOrderLines" 
                                     ("purchaseOrderId",
                                      "productId",
                                      barcode,
                                      qty,
                                      "unitCost",
                                      "accountId",
                                      note,
                                      "taxPercentage",
                                      taxes,
                                      "taxType",
                                      "taxTotal",
                                      "isInclusiveTax",
                                      "SIC",
                                      "total",
                                      "subTotal",
                                      "taxId",
                                      "index"
                                      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
                values: [purchaseOrderLine.purchaseOrderId,
                purchaseOrderLine.productId,
                purchaseOrderLine.barcode,
                purchaseOrderLine.qty,
                purchaseOrderLine.unitCost,
                purchaseOrderLine.accountId,
                purchaseOrderLine.note,
                purchaseOrderLine.taxPercentage,
                JSON.stringify(purchaseOrderLine.taxes),
                purchaseOrderLine.taxType,
                purchaseOrderLine.taxTotal,
                purchaseOrderLine.isInclusiveTax,
                purchaseOrderLine.SIC,
                purchaseOrderLine.total,
                purchaseOrderLine.subTotal,
                purchaseOrderLine.taxId,
                purchaseOrderLine.index
                ]
            }
            await client.query(query.text, query.values);

        } catch (error: any) {

            console.log(error)
            throw new Error(error.message)
        }
    }

    //Edit  Purchase Order
    public static async editPurchaseOrder(client: PoolClient, data: any, company: Company, employeeId: string) {

        try {
            const companyId = company.id;
            const validate = await PurchaseValidation.purchaseValidationValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            const afterDecimal = company.afterDecimal
            const purchasOrder = new PurchaseOrder();
            purchasOrder.ParseJson(data);
            purchasOrder.employeeId = employeeId;
            purchasOrder.calculateTotal(afterDecimal)

            //purchasOrder.logs = await this.getlogs(client, purchasOrder.id)

            purchasOrder.logs = []

            const isPurchaseNumberExist = await this.checkIsPurchaseNumberExist(client, purchasOrder.id, purchasOrder.purchaseNumber, companyId)
            if (isPurchaseNumberExist) {
                throw new ValidationException("Purchase Number Already Exist")
            }

            const query: { text: string, values: any } = {
                text: `UPDATE "PurchaseOrders" SET 
                                       "purchaseNumber"=$1,
                                       reference=$2,
                                       "employeeId"=$3,
                                       "supplierId"=$4,
                                       "dueDate"=$5,
                                       total=$6,
                                       "purchaseDate"=$7,
                                       "isInclusiveTax" =$8,
                                        "smallestCurrency"=$9,
                                        "roundingType"=$10,
                                        "roundingTotal"=$11, 
                                        "customFields" = $12,
                                        "branchId"= $13
                                       WHERE id= $14`,
                values: [purchasOrder.purchaseNumber,
                purchasOrder.reference,
                purchasOrder.employeeId,
                purchasOrder.supplierId,
                purchasOrder.dueDate,
                purchasOrder.total,
                purchasOrder.purchaseDate,
                purchasOrder.isInclusiveTax,
                purchasOrder.smallestCurrency,
                purchasOrder.roundingType,
                purchasOrder.roundingTotal,
                JSON.stringify(purchasOrder.customFields),
                purchasOrder.branchId,
                purchasOrder.id
                ]
            }

            const insert = await client.query(query.text, query.values);
            let productWithEmptyAccounts = purchasOrder.lines.filter(f => f.productId && !f.accountId).map(m => { return m.productId });
            if (productWithEmptyAccounts && productWithEmptyAccounts.length > 0) {
                let accounts = await this.getProductAccountId(client, productWithEmptyAccounts, companyId);
                if (accounts && accounts.length > 0) {
                    purchasOrder.lines = purchasOrder.lines.map(line => {
                        const product = accounts.find(f => f.id == line.productId)
                        if (product && !line.accountId) {
                            line.accountId = product.accountId
                        }
                        return line
                    })
                }
            }
            for (let index = 0; index < purchasOrder.lines.length; index++) {
                const line: PurchaseOrderLine = purchasOrder.lines[index];
                line.purchaseOrderId = purchasOrder.id
                line.index = index
                if ((line.productId == null || line.productId == "") && (line.note == null || line.note == "")) {
                    continue;
                }
                if (line.id == null || line.id == "") {
                    Log.addLog(purchasOrder, "Add New Purchase Order Line", "Edit", employeeId)
                    await this.addPurchaseOrderLine(client, line, afterDecimal)
                } else {
                    let oldTotal = await this.getOldLineTotal(client, line.id);
                    if (line.isDeleted) {
                        Log.addLog(purchasOrder, "Delete Purchase Order Line", "Edit", employeeId)
                        await this.deletePurchaseOrderLine(client, line.id)
                        continue
                    }


                    if (oldTotal != line.total) {
                        Log.addLog(purchasOrder, "Edit Purchase Order Line", "Edit", employeeId)

                    }
                    if (line.isDeleted) {
                        await this.deletePurchaseOrderLine(client, line.id)
                    }

                    await this.editPurchaseOrderLine(client, line, afterDecimal)
                }
            }

            if (employeeId && purchasOrder.logs.length == 0) {
                Log.addLog(purchasOrder, "Edit", "Edit", employeeId)
            }

            await this.setlogs(client, purchasOrder.id, purchasOrder.logs, purchasOrder.branchId, company.id, employeeId, purchasOrder.purchaseNumber, "Cloud")


            return new ResponseData(true, "", { id: purchasOrder.id })

        } catch (error: any) {




            throw new Error(error.message)
        }
    }


    public static async editPurchaseOrderLine(client: PoolClient, line: PurchaseOrderLine, afterDecimal: number) {
        try {
            const purchaseOrderLine = new PurchaseOrderLine();
            purchaseOrderLine.ParseJson(line);
            purchaseOrderLine.calculateTotal(afterDecimal)

            const query: { text: string, values: any } = {
                text: `UPDATE "PurchaseOrderLines" SET 
                              barcode=$1,
                              qty=$2,
                              "unitCost"=$3,
                              "accountId"=$4,
                               note=$5,
                               "taxPercentage"=$6,
                               taxes=$7,
                               "isInclusiveTax"=$8,
                               "taxType"=$9,
                               "taxTotal" =$10,
                               "productId"=$11,
                               "SIC"=$12,
                               "total"=$13,
                               "subTotal"=$14,
                               "taxId"=$15,
                               "index" = $16
                                WHERE  id=$17 `,
                values: [purchaseOrderLine.barcode,
                purchaseOrderLine.qty,
                purchaseOrderLine.unitCost,
                purchaseOrderLine.accountId,
                purchaseOrderLine.note,
                purchaseOrderLine.taxPercentage,
                JSON.stringify(purchaseOrderLine.taxes),
                purchaseOrderLine.isInclusiveTax,
                purchaseOrderLine.taxType,
                purchaseOrderLine.taxTotal,
                purchaseOrderLine.productId,

                purchaseOrderLine.SIC,
                purchaseOrderLine.total,
                purchaseOrderLine.subTotal,
                purchaseOrderLine.taxId,
                purchaseOrderLine.index,
                purchaseOrderLine.id]
            }
            await client.query(query.text, query.values);

        } catch (error: any) {

            console.log(error)
            throw new Error(error.message)
        }
    }




    public static async getPurchaseOrderById(purchaseOrderId: string, company: Company) {

        const client = await DB.excu.client();

        try {
            await client.query("BEGIN")

            const query: { text: string, values: any } = {
                text: `SELECT
                        "PurchaseOrders".id, 
                        "PurchaseOrders"."purchaseDate",
                        "PurchaseOrders"."dueDate",
                        "PurchaseOrders"."purchaseNumber",
                        "PurchaseOrders".reference,
                        "PurchaseOrders"."branchId",
                        "PurchaseOrders"."status",
                        "PurchaseOrders".total,
                        "PurchaseOrders"."isInclusiveTax",
                        "PurchaseOrders"."smallestCurrency",
                        "PurchaseOrders"."roundingType",
                        "PurchaseOrders"."roundingTotal",
                        "Branches".name AS "branchName",
                        "Branches"."customFields" as "branchCustomFields",
                          "Suppliers".email AS "supplierEmail",
                        "Suppliers".name AS "supplierName",
                        "Suppliers"."vatNumber" as "supplierVatNumber" ,
                         case when  COALESCE(NULLIF("Suppliers"."country", ''), NULL)  is not null and "Suppliers"."country" <>'${company.country}'  then true else false end as "internationalSupplier",
                        "PurchaseOrders"."supplierId",
                        "PurchaseOrders"."customFields",
                        case when "Billings"."purchaseOrderId" is null then false else true end as "isBill"

                FROM "PurchaseOrders"
                LEFT JOIN "Branches"
                ON "Branches".id = "PurchaseOrders"."branchId"
                LEFT JOIN "Suppliers"
                ON "Suppliers".id = "PurchaseOrders"."supplierId"
                LEFT JOIN "Billings" 
                ON "Billings"."purchaseOrderId" = "PurchaseOrders".id
                WHERE "PurchaseOrders".id=$1
                AND "Branches"."companyId"=$2`,
                values: [purchaseOrderId, company.id]
            }
            const purchaseData = await client.query(query.text, query.values)
            const purchase = new PurchaseOrder();
            purchase.ParseJson(purchaseData.rows[0])
            if (purchase.id != "" && purchase.id != null) {
                query.text = `with "lines" as (SELECT
                        "PurchaseOrderLines".id,
                        "PurchaseOrderLines". qty,
                        "PurchaseOrderLines"."unitCost",
                        "PurchaseOrderLines"."productId",
                        "PurchaseOrderLines".barcode,
                        "PurchaseOrderLines". "accountId",
                        "Accounts".name AS "accountName",
                        "PurchaseOrderLines".note,
                        "PurchaseOrderLines".taxes,
                            "PurchaseOrderLines"."taxId",
                            "PurchaseOrderLines"."index",
                        "PurchaseOrderLines"."taxType",
                        "PurchaseOrderLines"."taxTotal",
                        "PurchaseOrderLines"."isInclusiveTax",
                        "PurchaseOrderLines"."SIC",
                        "PurchaseOrderLines"."taxPercentage",
                        "Products".name AS "productName",
                        "Products".type AS "productType",
                        "Products"."UOM" AS "UOM"
                FROM "PurchaseOrderLines"
                LEFT JOIN "Products"
                ON "Products".id = "PurchaseOrderLines"."productId"
                LEFT JOIN "Accounts" 
                ON "Accounts".id = "PurchaseOrderLines"."accountId"
                LEFT JOIN "PurchaseOrders"
                ON "PurchaseOrders".id = "PurchaseOrderLines"."purchaseOrderId"
                WHERE "PurchaseOrders".id=$1
                ORDER BY "PurchaseOrderLines"."index" ASC , "PurchaseOrders"."createdAt" DESC )
				, "converetedQty" as (
				select "BillingLines"."productId", "BillingLines"."note", sum("qty") as "usedQty" from "Billings" 
				inner join "BillingLines" on "BillingLines"."billingId" = "Billings".id
				where "Billings"."purchaseOrderId"=$1
				group by "BillingLines"."productId", "BillingLines"."note"
				)select "lines".* , "lines"."qty" -  COALESCE("converetedQty"."usedQty" ,0) as "remainingQty" from "lines"
				left join "converetedQty" on "converetedQty"."productId" = "lines"."productId" or ( "converetedQty"."note" is not null and "converetedQty"."note" <> '' and  "converetedQty"."note" = "lines"."note")
				    ORDER BY "lines"."index" ASC 
                `;



                const line: any = await client.query(query.text, [purchaseOrderId])
                purchase.lines = [];
                if (line.rows) {
                    for (let index = 0; index < line.rows.length; index++) {
                        const element = line.rows[index];
                        let purchaseline = new PurchaseOrderLine();
                        purchaseline.ParseJson(element)
                        const selectedItem: any = {}
                        if (element.productId != null) {

                            selectedItem.id = element.productId;
                            selectedItem.name = element.productName;
                            selectedItem.type = element.productType;
                            purchaseline.selectedItem = selectedItem
                        }

                        purchase.lines.push(purchaseline)
                    }
                }
                purchase.calculateTotal(company.afterDecimal)
            }
            await client.query("COMMIT")
            return new ResponseData(true, "", purchase)
        } catch (error: any) {
            console.log(error)

            await client.query("ROLLBACK")

            throw new Error(error.message)
        } finally {
            client.release()
        }
    }

    public static async getRecommendedPurchaseProducts(data: any, company: Company) {

        const client = await DB.excu.client();

        try {


            const branchId = data.branchId ? data.branchId : null
            await client.query("BEGIN")

            const query: { text: string, values: any } = {
                text: `with "pro" as (
                        select "Products".id ,
                            "Products".name ,
                            "Products"."unitCost",
                            "Products"."companyId",
                            "Products"."type"
                            from "Products" 
                        where "Products".type  = any(Array['inventory','batch','serialized']) 
                        and "companyId" = $1
                        and "isDeleted" = false 
                        ),"proMovment" as (
                        select "pro".id,
                            sum("InventoryMovmentRecords".qty) as "stock",
                            "InventoryMovmentRecords"."branchId",
                            "pro"."companyId",
                            "pro"."type",
                            "pro".name ,
                            "pro"."unitCost"
                            from "pro" 
                        inner join "InventoryMovmentRecords" on "InventoryMovmentRecords"."productId" = "pro".id
                        where (($2::text IS NULL) OR "InventoryMovmentRecords"."branchId"::text = $2::text)
                        group by "pro".id,	
                            "InventoryMovmentRecords"."branchId",	
                            "pro"."companyId",
                            "pro"."type",
                            "pro".name ,
                            "pro"."unitCost"
                        ),"orderedQty" as(
                        select 
                            "BranchProducts"."reorderLevel" -  "proMovment"."stock" as "reorderQty" ,
                            "proMovment".id,
                            "proMovment"."branchId",
                            "proMovment"."companyId",
                            "proMovment"."type",
                            "proMovment".name ,
                            "proMovment"."unitCost"
                            from "proMovment"
                        inner join "BranchProducts" on "BranchProducts"."productId" = "proMovment".id and  "BranchProducts"."branchId" =  "proMovment"."branchId"	                
                        where   stock <=  "BranchProducts"."reorderPoint"
                        ),"recommendedSupplier" as (
                        select
                            min ( "SupplierItems"."cost" *  "SupplierItems"."minimumOrder") as cost ,
                            "SupplierItems"."productId",
                            JSON_AGG(JSON_BUILD_OBJECT('id', "Suppliers".id, 'name', "Suppliers"."name", 'cost', "SupplierItems".cost, 'minimumOrder', "SupplierItems"."minimumOrder", 'code', "Suppliers"."code")) as "supplier"
                                            
                            from "orderedQty"
                            left join "SupplierItems" on "SupplierItems"."productId" ="orderedQty"."id" 
                            inner join "Suppliers" on "Suppliers".id = "SupplierItems"."supplierId"
                            group by "SupplierItems"."productId"
                            
                        )

                        select 
                            "orderedQty".id as "productId",
                            "orderedQty"."branchId",
                            "orderedQty"."companyId",
                            "orderedQty"."type",
                            "orderedQty".name ,
                            "orderedQty"."unitCost" as "productCost",
                            ("recommendedSupplier"."supplier"->0->>'cost')::real as "supplierCost",
                            "recommendedSupplier"."supplier"->0 as "recommendedSupplier",
                            greatest(("recommendedSupplier"."supplier"->0->>'minimumOrder')::numeric,  "orderedQty"."reorderQty") "reorderAmount"
                        from "orderedQty"
                        left join  "recommendedSupplier" on "recommendedSupplier"."productId" = "orderedQty".id

                `,
                values: [company.id, branchId]
            }
            const purchaseData = await client.query(query.text, query.values)


            await client.query("COMMIT")
            return new ResponseData(true, "", purchaseData.rows)
        } catch (error: any) {

            await client.query("ROLLBACK")

            throw new Error(error.message)
        } finally {
            client.release()
        }
    }
    public static async getRecommendedPurchaseProdPerSup(data: any, company: Company) {

        const client = await DB.excu.client();

        try {


            const branchId = data.branchId ? data.branchId : null
            const supplierId = data.supplierId ? data.supplierId : null

            if (!branchId) { throw new ValidationException("BranchId IS Required") }
            if (!supplierId) { throw new ValidationException("SupplierId IS Required") }

            await client.query("BEGIN")

            const query: { text: string, values: any } = {
                text: `with reorder_amount as (
                    select invent."productId", 
                            prod.name , 	
                            prod.type,  
                            prod."companyId", 
                            prod."unitCost",
                           invent."branchId", 
                           "BranchProducts"."openingBalance",
                           "BranchProducts"."reorderLevel",
                           "BranchProducts"."reorderPoint" , 
                           sum(invent.qty) , 
                           "SupplierItems"."minimumOrder", 
                           "supplierCode",
                           case when (COALESCE(sum(qty),0)+ COALESCE("BranchProducts"."openingBalance",0)) <=  "BranchProducts"."reorderPoint" then "BranchProducts"."reorderLevel" - (sum(qty)+COALESCE("BranchProducts"."openingBalance",0) ) end as "reorderAmount"
                    from "InventoryMovmentRecords" as invent
                    inner join "Products" as prod on prod.id = invent."productId"
                    inner join "BranchProducts" on "BranchProducts"."productId" = invent."productId" 
                                                and "BranchProducts"."branchId" = invent."branchId"
                    inner join "SupplierItems" on invent."productId" = "SupplierItems"."productId"           and ($3::uuid is null  or "SupplierItems"."supplierId" = $3::uuid )
                    where prod.type  = any(Array['inventory','batch','serialized']) 
                      and prod."companyId"= $1
                      and invent."branchId" =  $2
                    group by invent."productId",  prod.name, prod.type, prod."companyId",  prod."unitCost", 
                    invent."branchId",  "BranchProducts"."openingBalance", "SupplierItems"."supplierId", 
                    "SupplierItems".cost, "SupplierItems"."minimumOrder", "supplierCode",  "BranchProducts"."reorderLevel", "BranchProducts"."reorderPoint" 
                    having  (COALESCE(sum(qty),0)+ COALESCE("BranchProducts"."openingBalance",0))<=  "BranchProducts"."reorderPoint"
                    order by invent."branchId"
                ),
                "joinTable" as (select "productId", 
                            name , 	
                            type,  
                            "companyId", 
                            "unitCost",
                          "branchId","openingBalance",sum,
                          "reorderLevel", "reorderPoint" , 
                          "minimumOrder",  "supplierCode",
                           greatest("minimumOrder", "reorderAmount") as "reorderAmount"
                    from "reorder_amount" as invent
                    group by "productId", name,type,"companyId","unitCost", "branchId", "minimumOrder",  "supplierCode",  "openingBalance","reorderAmount", "reorderLevel", "reorderPoint" ,sum
                    order by "branchId"
                )
                select * from "joinTable" 
                
                `,
                values: [company.id, branchId, supplierId]
            }
            const purchaseData = await client.query(query.text, query.values)


            await client.query("COMMIT")
            return new ResponseData(true, "", purchaseData.rows)
        } catch (error: any) {

            await client.query("ROLLBACK")

            throw new Error(error.message)
        } finally {
            client.release()
        }
    }


    public static async getPurchaseOrderList(data: any, company: Company, branchList: []): Promise<ResponseData> {
        try {
            const companyId = company.id;

            // --- Normalization ---
            const page = Number.isFinite(+data?.page) && +data.page > 0 ? +data.page : 1;
            const limit = Number.isFinite(+data?.limit) && +data.limit > 0 ? +data.limit : 15;

            const searchTerm: string | undefined =
                typeof data?.searchTerm === 'string' && data.searchTerm.trim() !== ''
                    ? data.searchTerm.trim()
                    : undefined;

            const branches: string[] =
                (data?.filter?.branches?.length ? data.filter.branches : branchList) as string[];

            const fromDate: string | undefined = data?.filter?.fromDate;
            const toDate: string | undefined = data?.filter?.toDate;

            const incomingSortBy = data?.sortBy?.sortValue as string | undefined;
            const incomingSortDir = String(data?.sortBy?.sortDirection || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

            const sortByKey = incomingSortBy === 'purchaseNumber'
                ? 'purchaseNumberSort'
                : (incomingSortBy || 'purchaseDateThenTime');
            const sortDir = incomingSortDir;

            // --- Table + Alias Definitions ---
            const aliasMap = {
                p: 'PurchaseOrders',
                b: 'Branches',
                s: 'Suppliers',
                e: 'Employees',
                bla: `(
                        SELECT
                        bl."purchaseOrderId",
                        COALESCE(
                            JSON_AGG(
                            JSON_BUILD_OBJECT(
                                'id', bl."id",
                                'billNumber', bl."billingNumber"
                            )
                            ORDER BY bl."createdAt" ASC
                            ) FILTER (WHERE bl."id" IS NOT NULL),
                            '[]'::json
                        ) AS "billingNumbers",
                        COUNT(bl."id")::int AS "billingCount"
                        FROM "Billings" bl
                        GROUP BY bl."purchaseOrderId"
                    )`
            } as const;

            const joinDefs = {
                joinBranch: { joinTable: 'b', onLocal: 'p.branchId', onForeign: 'b.id' },
                joinSupplier: { joinTable: 's', onLocal: 'p.supplierId', onForeign: 's.id' },
                joinEmployee: { joinTable: 'e', onLocal: 'p.employeeId', onForeign: 'e.id' },
                joinBillingAgg: { joinTable: 'bla', onLocal: 'p.id', onForeign: 'bla.purchaseOrderId', type: 'LEFT' as const },
            };

            const columnMap: TableConfig['columnMap'] = {
                id: { table: 'p', dbCol: 'id' },
                purchaseDate: { table: 'p', dbCol: 'purchaseDate', cast: 'timestamp' },
                dueDate: { table: 'p', dbCol: 'dueDate', cast: 'timestamp' },
                purchaseNumber: { table: 'p', dbCol: 'purchaseNumber' },
                status: { table: 'p', dbCol: 'status' },
                reference: { table: 'p', dbCol: 'reference' },
                total: { table: 'p', dbCol: 'total', cast: 'numeric' },
                createdAt: { table: 'p', dbCol: 'createdAt', cast: 'timestamp' },
                branchId: { table: 'p', dbCol: 'branchId' },
                supplierId: { table: 'p', dbCol: 'supplierId' },
                employeeId: { table: 'p', dbCol: 'employeeId' },
                companyId: { table: 'b', dbCol: 'companyId', joinRequired: 'joinBranch' },

                // Computed values
                time: { rawExpr: `p."createdAt"::timestamp::time`, table: 'p', dbCol: 'createdAt' },
                purchaseDateThenTime: {
                    rawExpr: `(p."purchaseDate"::date, p."createdAt"::timestamp::time)`,
                    table: 'p', dbCol: 'purchaseDate'
                },
                purchaseNumberSort: {
                    rawExpr: `COALESCE(NULLIF(regexp_substr(regexp_substr(p."purchaseNumber", '[_.+=-]\\d*$'), '\\d*$'), ''), '0')::int`,
                    table: 'p', dbCol: 'purchaseNumber', cast: 'int'
                },

                // Joined display fields
                branchName: { table: 'b', dbCol: 'name', joinRequired: 'joinBranch' },
                supplierName: { table: 's', dbCol: 'name', joinRequired: 'joinSupplier' },
                employeeName: { table: 'e', dbCol: 'name', joinRequired: 'joinEmployee' },
                billingNumber: { table: 'bla', dbCol: 'billingNumbers', joinRequired: 'joinBillingAgg' },
                billingCount: { table: 'bla', dbCol: 'billingCount', joinRequired: 'joinBillingAgg' },

                isBill: {
                    rawExpr: `COALESCE(bla."billingCount", 0) > 0`,
                    table: 'bla',
                    dbCol: 'billingCount'
                }
            };

            const searchableColumns = [
                'supplierName', 'branchName', 'employeeName', 'purchaseNumber', 'reference'
            ];

            const DEFAULT_COLUMNS = [
                'id', 'purchaseDate', 'dueDate', 'purchaseNumber',
                'reference', 'total', 'createdAt', 'time',
                'branchName', 'supplierName', 'employeeName',
                'billingNumber', 'billingCount', 'isBill'
            ];



            // --- 1️⃣ Load Customization (if any) ---
            const customization = await CustomizationRepo.getCustomizationByKey('purchaseOrder', 'customFields', company);
            const customFields = customization?.data?.customFields || [];
            for (const field of (customFields || [])) {
                const key = String(field.id).replace(/"/g, '');
                const outKey = String(field.abbr || key).replace(/\s+/g, '_');
                columnMap[outKey] = { table: 'p', dbCol: 'customFields', jsonKV: { key: field.id, cast: 'text' } };
            }

            const selectableColumns = [
                ...DEFAULT_COLUMNS,
                'purchaseDateThenTime',
                'purchaseNumberSort',
                'companyId',
                'branchId',
                ...Object.keys(columnMap).filter(k => !DEFAULT_COLUMNS.includes(k))
            ];
            // --- 2️⃣ Build Config and Service ---
            const PurchaseConfig: TableConfig = {
                aliasMap,
                columnMap,
                joinDefs,
                searchableColumns,
                selectableColumns
            };
            const service = new TableDataService(PurchaseConfig);

            // --- 3️⃣ Filters ---
            const filters: TableRequest['filters'] = [
                { column: 'companyId', operator: 'eq', value: companyId }
            ];

            if (branches?.length) filters.push({ column: 'branchId', operator: 'in', value: branches });
            if (fromDate) filters.push({ column: 'purchaseDate', operator: 'ge' as any, value: fromDate });
            if (toDate) filters.push({ column: 'purchaseDate', operator: 'le' as any, value: toDate });

            // --- 4️⃣ Column selection ---
            const userCols = Array.isArray(data?.columns) ? (data.columns as string[]).map(String) : DEFAULT_COLUMNS;
            let selectColumns = userCols.filter(c => selectableColumns.includes(c));
            if (!selectColumns.length) selectColumns = DEFAULT_COLUMNS;
            if (!selectColumns.includes('id')) selectColumns.push('id');

            // --- 5️⃣ Build Request ---
            const req: TableRequest = {
                table_name: 'PurchaseOrders',
                select_columns: selectColumns as any,
                filters,
                search_term: searchTerm,
                sort_by: selectableColumns.includes(sortByKey) ? (sortByKey as any) : ('purchaseDateThenTime' as any),
                sort_order: sortDir,
                page_number: page,
                page_size: limit
            };

            // --- 6️⃣ Execute and Map ---
            const result = await service.getTableData<any>(req);
            const list = result.data.map((row: any) => getValuable(row));

            // --- 7️⃣ Pagination metadata ---
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








    public static async getPurchaseOrderList1(data: any, company: Company, branchList: []) {
        try {
            const companyId = company.id;
            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;
            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';

            let page = data.page ?? 1
            let offset = 0
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            let sort = data.sortBy;
            let sortValue = !sort ? ' "PurchaseOrders"."createdAt"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? " DESC" : sort.sortDirection;
            let orderByQuery = " Order by " + sortValue + sortDirection
            if (sort && sort.sortValue == "purchaseNumber") {
                sortValue = ` regexp_replace("purchaseNumber", '[A-Za-z0-9]*[_.+=-]', '')::int`
            }
            const filter = data.filter
            const fromDate = filter && filter.fromDate ? filter.fromDate : null
            const toDate = filter && filter.toDate ? filter.toDate : null
            const query = {
                text: `SELECT
                count(*) over(),
                "PurchaseOrders".id,
                "PurchaseOrders"."purchaseDate",
                "PurchaseOrders"."dueDate",
                "PurchaseOrders"."purchaseNumber",
                "PurchaseOrders".reference,
                "PurchaseOrders".total,
                "PurchaseOrders"."createdAt",
                "Branches".name as "branchName",
                "Suppliers".name as "supplierName", 
                "Employees".name as "employeeName",
                "Billings".id as "billingId",
                "Billings"."billingNumber",
                    
                case when "Billings"."purchaseOrderId" is null then false else true end as "isBill"
                FROM "PurchaseOrders"
                INNER JOIN "Branches" ON "Branches".id = "PurchaseOrders"."branchId"
                INNER JOIN "Suppliers" ON "Suppliers".id = "PurchaseOrders"."supplierId"
                INNER JOIN "Employees" ON "Employees".id = "PurchaseOrders"."employeeId"
                LEFT JOIN "Billings" ON "Billings"."purchaseOrderId" = "PurchaseOrders".id
                where "Branches"."companyId"=$1
                AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
                and (LOWER("Suppliers".name) ~ $3 
                     OR LOWER("Branches".name) ~ $3 
                     OR LOWER("PurchaseOrders"."purchaseNumber") ~ $3 
                     OR nullif(regexp_replace("purchaseNumber", '[A-Z]*-', ''),'') ~ $3)
                     AND ($4::Date IS NULL OR "PurchaseOrders"."purchaseDate"::date >= $4::date)
                     AND ($5::Date IS NULL OR "PurchaseOrders"."purchaseDate"::date <= $5::date)
                     ${orderByQuery}
                LIMIT $6 OFFSET $7`,
                values: [companyId, branches, searchValue, fromDate, toDate, limit, offset]
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



    public static async getOpenPurchaseOrderList(data: any, company: Company, branchList: String[]) {
        try {

            const companyId = company.id;
            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;
            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';

            let page = data.page ?? 1
            let offset = 0
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            let sort = data.sortBy;
            let sortValue = !sort ? ' "PurchaseOrders"."createdAt"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? " DESC" : sort.sortDirection;
            let orderByQuery = " Order by " + sortValue + sortDirection
            if (sort && sort.sortValue == "purchaseNumber") {
                sortValue = ` regexp_replace("purchaseNumber", '[A-Za-z0-9]*[_.+=-]', '')::int`
            }
            const filter = data.filter
            const fromDate = filter && filter.fromDate ? filter.fromDate : null
            const toDate = filter && filter.toDate ? filter.toDate : null
            const query = {
                text: `SELECT
                count(*) over(),
                "PurchaseOrders".id,
                "PurchaseOrders"."purchaseDate",
                "PurchaseOrders"."dueDate",
                "PurchaseOrders"."purchaseNumber",
                "PurchaseOrders".reference,
                "PurchaseOrders".total,
                "PurchaseOrders"."createdAt",
                "Branches".name as "branchName",
                "Suppliers".name as "supplierName", 
                "Employees".name as "employeeName",
                "Billings".id as "billingId",
                "Billings"."billingNumber",
                    
                case when "Billings"."purchaseOrderId" is null then false else true end as "isBill"
                FROM "PurchaseOrders"
                INNER JOIN "Branches" ON "Branches".id = "PurchaseOrders"."branchId"
                INNER JOIN "Suppliers" ON "Suppliers".id = "PurchaseOrders"."supplierId"
                INNER JOIN "Employees" ON "Employees".id = "PurchaseOrders"."employeeId"
                LEFT JOIN "Billings" ON "Billings"."purchaseOrderId" = "PurchaseOrders".id
                where "Branches"."companyId"=$1
                AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
                and (case when "Billings"."purchaseOrderId" is null then false else true end) = false
                and (LOWER("Suppliers".name) ~ $3 
                     OR LOWER("Branches".name) ~ $3 
                     OR LOWER("PurchaseOrders"."purchaseNumber") ~ $3 
                     OR nullif(regexp_replace("purchaseNumber", '[A-Z]*-', ''),'') ~ $3)
                     AND ($4::Date IS NULL OR "PurchaseOrders"."purchaseDate"::date >= $4::date)
                     AND ($5::Date IS NULL OR "PurchaseOrders"."purchaseDate"::date <= $5::date)
                     ${orderByQuery}
                LIMIT $6 OFFSET $7`,
                values: [companyId, branches, searchValue, fromDate, toDate, limit, offset]
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


    public static async getClosedPurchaseOrderList(data: any, company: Company, branchList: String[]) {
        try {
            const companyId = company.id;
            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;
            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';

            let page = data.page ?? 1
            let offset = 0
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            let sort = data.sortBy;
            let sortValue = !sort ? ' "PurchaseOrders"."createdAt"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? " DESC" : sort.sortDirection;
            let orderByQuery = " Order by " + sortValue + sortDirection
            if (sort && sort.sortValue == "purchaseNumber") {
                sortValue = ` regexp_replace("purchaseNumber", '[A-Za-z0-9]*[_.+=-]', '')::int`
            }
            const filter = data.filter
            const fromDate = filter && filter.fromDate ? filter.fromDate : null
            const toDate = filter && filter.toDate ? filter.toDate : null
            const query = {
                text: `SELECT
                count(*) over(),
                "PurchaseOrders".id,
                "PurchaseOrders"."purchaseDate",
                "PurchaseOrders"."dueDate",
                "PurchaseOrders"."purchaseNumber",
                "PurchaseOrders".reference,
                "PurchaseOrders".total,
                "PurchaseOrders"."createdAt",
                "Branches".name as "branchName",
                "Suppliers".name as "supplierName", 
                "Employees".name as "employeeName",
                "Billings".id as "billingId",
                "Billings"."billingNumber",
                    
                case when "Billings"."purchaseOrderId" is null then false else true end as "isBill"
                FROM "PurchaseOrders"
                INNER JOIN "Branches" ON "Branches".id = "PurchaseOrders"."branchId"
                INNER JOIN "Suppliers" ON "Suppliers".id = "PurchaseOrders"."supplierId"
                INNER JOIN "Employees" ON "Employees".id = "PurchaseOrders"."employeeId"
                LEFT JOIN "Billings" ON "Billings"."purchaseOrderId" = "PurchaseOrders".id
                where "Branches"."companyId"=$1
                AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
                and (case when "Billings"."purchaseOrderId" is null then false else true end) = true
                and (LOWER("Suppliers".name) ~ $3 
                     OR LOWER("Branches".name) ~ $3 
                     OR LOWER("PurchaseOrders"."purchaseNumber") ~ $3 
                     OR nullif(regexp_replace("purchaseNumber", '[A-Z]*-', ''),'') ~ $3)
                     AND ($4::Date IS NULL OR "PurchaseOrders"."purchaseDate"::date >= $4::date)
                     AND ($5::Date IS NULL OR "PurchaseOrders"."purchaseDate"::date <= $5::date)
                     ${orderByQuery}
                LIMIT $6 OFFSET $7`,
                values: [companyId, branches, searchValue, fromDate, toDate, limit, offset]
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





    //convert purchase to bill 
    public static async convertToBilling(data: any, company: Company, employeeId: string) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            // add prurchase order id to the billing as a refrence 
            data.billing.status = data.billing.status == "" || data.billing.status == null ? "Open" : data.billing.status
            data.billing.purchaseOrderId = data.purchaseOrderId;
            const bill = await BillingRepo.addBilling(client, data.billing, company, employeeId);

            await client.query("COMMIT")
            return bill;
        } catch (error: any) {

            await client.query("ROLLBACK")
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }

    // Get the list ['inventory','batch','serialized'] products along with the supplier unitCost of existed if not product unitCost
    public static async getPurchaseProductList(data: any, company: Company) {
        try {

            const types: [string] = data.types;
            let filterType: any = types;

            const companyId = company.id;
            const supplierId = data.supplierId;
            const branchId = data.branchId
            let selectQuery;
            let selectValues;
            let countValues;
            let searchValue = data.searchTerm ? data.searchTerm.toLowerCase().trim() : null
            let offset = 0;

            let count = 0;
            let pageCount = 0;

            let page = data.page ?? 1;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }
            const exclude: [string] = data.exclude;
            const encoleded: [string] = data.include && data.include.length > 0 ? data.include : null;
            const includedTypes = encoleded ? encoleded : ['inventory', 'batch', 'serialized'];
            if (exclude && exclude.length > 0) {
                filterType = includedTypes.filter(a => !exclude.includes(a));
            } else if (!types && !exclude) {
                filterType = includedTypes
            }
            const countText = `select
                COUNT(*) 
            from "Products"
            where "companyId" = $1
            AND ( $2::text is null or lower ("Products".name) ~ $2)
            AND "Products".type = ANY($3)
            AND "isDeleted" = false
      
              `

            selectQuery = `SELECT
            "Products".name,
            "Products".id,
            "Products".type,
            "Products"."taxId",
            "Products".barcode,
            "Products"."purchaseAccountId",
            "Products"."UOM",
            "Products"."unitCost" as "productCost",
            "SupplierItems".cost as "supplierCost",
            "SupplierItems"."minimumOrder",
            "SupplierItems"."supplierCode"
    FROM "Products"
    LEFT JOIN "SupplierItems"
    ON "SupplierItems"."productId" = "Products".id
    and "SupplierItems"."supplierId" =$1
    WHERE "Products"."companyId" = $2
    AND( $3::text is null or (lower ("Products".name) ~ $3 Or lower ("Products".barcode) ~ $3  or "SupplierItems"."supplierCode" ~ $3) )
    AND "Products".type = ANY($4)
    AND "Products"."isDeleted"=false
           AND (   "Products"."isPurchaseItem" = true or  "Products"."isPurchaseItem" is null)
    limit $5 offset $6
            `

            selectValues = [supplierId, companyId, searchValue, filterType, limit, offset]

            countValues = [companyId, searchValue, filterType]

            let selectCount = await DB.excu.query(countText, countValues)
            count = Number((<any>selectCount.rows[0]).count)
            pageCount = Math.ceil(count / limit)


            const selectList: any = await DB.excu.query(selectQuery, selectValues)

            offset += 1
            let lastIndex = ((page) * limit)


            let inventoryIds = selectList.rows.map((f: any) => { if (f.type == 'inventory') return f.id })

            if (inventoryIds && inventoryIds.length > 0) {
                let costs = await ProductRepo.getLatestFIFOProductUnitCost(inventoryIds, branchId)

                if (costs && costs.length > 0) {
                    selectList.rows = selectList.rows.map((product: any) => {
                        const productCost: any = costs.find((item: any) => item.productId == product.id)
                        if (productCost) {
                            product.productCost = productCost.cost

                        }
                        return product
                    })
                }

            }
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




            // const query : { text: string, values: any } = {
            //     text: `SELECT
            //                 "Products".name,
            //                 "Products".id,
            //                 "Products".type,
            //                 "Products"."taxId",
            //                 "Products".barcode,
            //                 "Products"."UOM",
            //                 CASE WHEN  "SupplierItems".cost IS NULL THEN "Products"."unitCost" ELSE "SupplierItems".cost END  AS "unitCost",
            //                 "SupplierItems"."minimumOrder",
            //                 "SupplierItems"."supplierCode"
            //         FROM "Products"
            //         LEFT JOIN "SupplierItems"
            //         ON "SupplierItems"."productId" = "Products".id
            //         and "SupplierItems"."supplierId" =$1
            //         WHERE "Products"."companyId" = $2
            //         AND "Products".type = ANY($3)
            //         AND "Products"."isDeleted"=false`,
            //     values: [supplierId, companyId, types]
            // }
            // const products = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", resData)
        } catch (error: any) {

            throw new Error(error.message)
        }
    }

    public static async getPurchaseProductByBarcode(data: any, company: Company) {
        try {

            const types = ['inventory', 'batch', 'serialized'];

            const companyId = company.id;
            const supplierId = data.supplierId;
            let selectQuery;
            let selectValues;
            let searchValue = data.searchTerm != null && data.searchTerm != "" ? data.searchTerm.trim().toLowerCase() : null

            selectQuery = `SELECT
            "Products".name,
            "Products".id,
            "Products".type,
            "Products"."taxId",
            "Products".barcode,
            "Products"."UOM",
            CASE WHEN  "SupplierItems".cost IS NULL THEN "Products"."unitCost" ELSE "SupplierItems".cost END  AS "unitCost",
            "SupplierItems"."minimumOrder",
            "SupplierItems"."supplierCode"
    FROM "Products"
    LEFT JOIN "SupplierItems"
    ON "SupplierItems"."productId" = "Products".id
    and "SupplierItems"."supplierId" =$1
    WHERE "Products"."companyId" = $2
    AND( $3::text is null or (LOWER("Products".barcode) = $3) )
    AND "Products".type = ANY($4)
    AND "Products"."isDeleted"=false
 
            `

            selectValues = [supplierId, companyId, searchValue, types]
            const selectList: any = await DB.excu.query(selectQuery, selectValues)



            let product = selectList.rows && selectList.rows.length > 0 ? selectList.rows[0] : null
            return new ResponseData(true, "", product)
        } catch (error: any) {

            throw new Error(error.message)
        }
    }


    public static async getInventoryRequestProducts(data: any, company: Company) {
        try {

            const types = ['inventory', 'batch', 'serialized']

            const companyId = company.id;
            let selectQuery;
            let selectValues;
            let countValues;
            let searchValue = '[A-Za-z0-9]*';
            let offset = 0;
            let sort: any;
            let sortValue;
            let sortDirection;
            let sortTerm;
            let count = 0;
            let pageCount = 0;
            let orderByQuery = ""
            let page = 1
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }


            let productId = data.productId == null ? "" : data.productId
            if (data && data.searchTerm != "" && data.searchTerm != null) {
                searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`

            }
            let filterQuery = `    where  "companyId" = $1 
                            and type = any($2) 
                    
                            AND "Products"."isDeleted" = false
                            and  LOWER("Products".name) ~$3
                            `
            let limitQuery = ` limit $4 offset $5`
            const query: { text: string, values: any } = {
                text: `SELECT "Products".name,
                            "Products"."unitCost",
                            "Products".id,
                            "Products".type,
                            "Products"."taxId",
                            "Products".barcode,
                            "Products"."UOM"
                FROM "Products" 
            ` + filterQuery + limitQuery,
                values: [
                    companyId,
                    types, searchValue, limit, offset
                ],
            }

            const countQuery = {
                text: `SELECT COUNT(*) FROM "Products"` + filterQuery,
                values: [
                    companyId,
                    types,
                    searchValue
                ]
            }




            if (data != null && data != '' && JSON.stringify(data) != '{}') {
                let limitQuery;


                sort = data.sortBy;
                sortValue = !sort ? '"Products"."createdAt"' : '"' + sort.sortValue + '"';
                sortDirection = !sort ? "DESC" : sort.sortDirection;
                sortTerm = sortValue + " " + sortDirection
                orderByQuery = ` Order by ` + sortTerm;



                let selectCount = await DB.excu.query(countQuery.text, countQuery.values)
                count = Number((<any>selectCount.rows[0]).count)
                pageCount = Math.ceil(count / data.limit)
            }


            const selectList: any = await DB.excu.query(query.text, query.values)

            offset += 1
            let lastIndex = ((page) * data.limit)
            if (selectList.rows.length < data.limit || page == pageCount) {
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
    // Retrive Acceptec account list for purchase and billings  
    public static async getPurchaseAccounts(company: Company) {
        try {
            const companyId = company.id;
            const types = ['Expense', 'Other Current Assets', 'Fixed Assets', 'Costs Of Goods Sold', 'Operating Expense', 'Current Assets', 'Other Current Liabilities']
            const query: { text: string, values: any } = {
                text: `SELECT id, 
                             name,
                             type,
                             "parentType",
                             "code"
                     FROM "Accounts"
                      WHERE "companyId"=$1 
                     and "parentType"= any($2)
                    `,
                values: [companyId, types]
            }

            const accounts = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", accounts.rows)
        } catch (error: any) {

            throw new Error(error.message)
        }
    }
    // auto generate purchase number 
    public static async getPurchaseNumber(branchId: string, company: Company, client: PoolClient | null = null) {
        try {

            const companyId = company.id;
            let prefixSettings = await TransactionManagements.getPrefix('PurchaseOrder', company.id)
            let prefix = prefixSettings.prefix
            let width = prefixSettings.width

            const query: { text: string, values: any[] } = {
                text: `  SELECT "purchaseNumber"
                        FROM "PurchaseOrders"
                                INNER JOIN "Branches"
                                 ON "Branches".id = "PurchaseOrders"."branchId"
                                 Where "Branches"."companyId" = $1
                              AND "purchaseNumber" LIKE $2
                              AND SUBSTRING("purchaseNumber" FROM LENGTH($3)+1) ~ '^[0-9]+$'  -- only numeric suffixes
                            ORDER BY 
                              CAST(SUBSTRING("purchaseNumber" FROM LENGTH($3)+1) AS INT) DESC
                            LIMIT 1`,
                values: [companyId, `${prefix}%`, prefix]
            };

            const data = await DB.excu.query(query.text, query.values);
            const lastNumber = data.rows && data.rows.length > 0 ? data.rows[0].purchaseNumber : null;
            let newNumber = TransactionManagements.getNumber(prefix, lastNumber, width)


            return new ResponseData(true, "", { purchaseNumber: newNumber })
        } catch (error: any) {

            throw new Error(error.message)
        }
    }

    public static async deletePurchaseOrder(id: string, company: Company, employeeId: string) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");

            let purchaseOrderQuery = {
                text: `SELECT JSON_AGG("PurchaseOrderLines".id) as "ids",
                        "PurchaseOrders"."branchId",
                        "PurchaseOrders"."purchaseDate",
                        "PurchaseOrders"."purchaseNumber",
                         "Employees"."name" as "employeeName"
                        FROM "PurchaseOrderLines"
                        INNER JOIN "PurchaseOrders" on "PurchaseOrders".id = "PurchaseOrderLines"."purchaseOrderId"
                        INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2
                        WHERE "purchaseOrderId" = $1
                        group by "PurchaseOrders".id, "Employees".id
                    `,
                values: [id, employeeId, company.id]
            }

            let purchaseLineIds = await client.query(purchaseOrderQuery.text, purchaseOrderQuery.values);
            let branchId = purchaseLineIds.rows && purchaseLineIds.rows.length > 0 && purchaseLineIds.rows[0].branchId ? purchaseLineIds.rows[0].branchId : null
            let purchaseDate = purchaseLineIds.rows && purchaseLineIds.rows.length > 0 && purchaseLineIds.rows[0].purchaseDate ? purchaseLineIds.rows[0].purchaseDate : null
            let purchaseNumber = purchaseLineIds.rows && purchaseLineIds.rows.length > 0 && purchaseLineIds.rows[0].purchaseNumber ? `${purchaseLineIds.rows[0].purchaseNumber}` : ''
            let employeeName = purchaseLineIds.rows && purchaseLineIds.rows.length > 0 && purchaseLineIds.rows[0].employeeName ? `${purchaseLineIds.rows[0].employeeName}` : ''

            await CompanyRepo.validateTransactionDate(client, purchaseDate, branchId, company.id);


            const query: { text: string, values: any } = {
                text: `DELETE FROM "PurchaseOrderLines" USING "PurchaseOrders"
                      WHERE "PurchaseOrderLines"."purchaseOrderId" = "PurchaseOrders".id 
                      AND "PurchaseOrders".id =$1
                 `,
                values: [id]
            }
            await client.query(query.text, query.values);

            query.text = `DELETE FROM "PurchaseOrders" WHERE "PurchaseOrders".id =$1 `
            await client.query(query.text, query.values);

            //addLog 
            let log = new Log();
            log.employeeId = employeeId
            log.action = 'Purchase Order Deleted'
            log.comment = `${employeeName} has deleted Purchase Order number ${purchaseNumber}`
            log.metaData = { "deleted": true }
            await LogsManagmentRepo.manageLogs(client, "PurchaseOrders", id, [log], branchId, company.id, employeeId, purchaseNumber, "Cloud")


            await client.query("COMMIT");
            return new ResponseData(true, "", [])
        } catch (error: any) {
            await client.query("ROLLBACK");

            throw new Error(error);
        } finally {
            client.release()
        }
    }

    public static async getOldLineTotal(client: PoolClient, lineId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT total FROM "PurchaseOrderLines" where id =$1`,
                values: [lineId]
            }

            let purchaseOrder = await client.query(query.text, query.values);
            return purchaseOrder.rows[0].total

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getlogs(client: PoolClient, purchaseOrderId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT logs from "PurchaseOrders" where id =$1`,
                values: [purchaseOrderId]
            }

            let purchase = await client.query(query.text, query.values);
            return purchase.rows[0].logs ?? []
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async setlogs(client: PoolClient, purchaseOrderId: string, logs: Log[], branchId: string, companyId: string, employeeId: string, purchaseNumber: string | null, source: string) {
        try {
            await LogsManagmentRepo.manageLogs(client, "PurchaseOrders", purchaseOrderId, logs, branchId, companyId, employeeId, purchaseNumber, source)


        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async sendEmail(data: any, company: Company) {
        try {

            let pdfGenerator = new PDFGenerator()
            let pdfBuffer = await pdfGenerator.sendEmail(data, company);

            return pdfBuffer
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }


    }
    public static async getPdf(data: any, company: Company) {
        try {
            data.type = "PO"
            let pdfGenerator = new PDFGenerator()
            let pdfBuffer = await pdfGenerator.getPdf(data);
            return pdfBuffer
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }


    public static async getProductInfo(client: PoolClient, productIds: [string]) {
        try {
            const query = {
                text: `SELECT "Products".id,"taxId","Taxes"."taxPercentage","Taxes"."taxType","Taxes"."taxes"
                      from "Products"
                      left join "Taxes" on "Taxes".id = "Products"."taxId"
                      where "Products".id =any($1)
                `,
                values: [productIds]

            }

            let products = await client.query(query.text, query.values);

            return products.rows
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async convertToPurchaseOrder(data: any, company: Company, employeeId: string) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")

            let suppliers: any[] = [];
            let branchId = data.branchId;
            const dueDate = new Date();
            dueDate.setMonth(dueDate.getMonth() + 1)
            let ids: any[] = [];
            let accountId = await AccountsRepo.getDefaultAccountByName(client, "Inventory Assets", company.id)
            /** Group by SupplierId */
            if (data && data.lines.length > 0) {
                let products: [string] = data.lines.map((line: any) => line.productId);
                if (products.length > 0) {
                    let productsData = await this.getProductInfo(client, products);
                    if (productsData && productsData.length > 0) {
                        const mergedArray = data.lines.map((line: any) => {
                            const product = productsData.find((prod: any) => prod.id === line.productId);
                            if (product == null) {
                                throw new ValidationException("Product Id is Required");
                            }
                            return {
                                productId: line.productId,
                                supplierId: line.supplierId,
                                unitCost: line.unitCost,
                                qty: line.qty,
                                product: product || null // Use null if no matching product is found
                            };
                        });

                        if (mergedArray && mergedArray.length > 0) {
                            suppliers = mergedArray.reduce((acc: any, obj: any) => {
                                const { supplierId } = obj;
                                const existingEntry = acc.find((entry: any) => entry.supplierId === supplierId);
                                if (existingEntry) {
                                    existingEntry.items.push(obj);
                                } else {
                                    acc.push({ supplierId, items: [obj] });
                                }
                                return acc;
                            }, []);


                        }
                    }
                }
            }


            if (suppliers && suppliers.length > 0) {
                for (let index = 0; index < suppliers.length; index++) {
                    let purchaseOrder = new PurchaseOrder();
                    const element = suppliers[index];
                    if (element.supplierId == null || element.supplierId == "") {
                        throw new Error("Supplier Is Required")
                    }
                    if (branchId != null) {
                        purchaseOrder.branchId = branchId ?? "";
                        purchaseOrder.employeeId = employeeId;
                        purchaseOrder.dueDate = dueDate

                        purchaseOrder.purchaseNumber = (await PurchaseOrderRepo.getPurchaseNumber(branchId, company)).data.purchaseNumber;
                        purchaseOrder.supplierId = element.supplierId;
                        let line = new PurchaseOrderLine()

                        purchaseOrder.lines = []
                        element.items.forEach((element: any) => {
                            line = new PurchaseOrderLine()
                            line.productId = element.product.id;
                            line.qty = element.qty;
                            line.unitCost = element.unitCost;
                            line.accountId = accountId;
                            line.taxId = element.product.taxId;
                            line.taxes = element.product.taxes;
                            line.taxPercentage = element.product.taxPercentage;
                            line.taxType = element.product.taxType
                            purchaseOrder.lines.push(line);
                        });



                        let addPurchase = await PurchaseOrderRepo.addPurchaseOrder(client, purchaseOrder, company, employeeId, purchaseOrder.dueDate);
                        ids.push(addPurchase.data.id)
                    }
                }
            }


            await client.query("COMMIT")

            return new ResponseData(true, "", ids)
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async deletePurchaseOrderLine(client: PoolClient, lineId: string) {
        try {
            await client.query(`delete from "PurchaseOrderLines" where id=$1`, [lineId])
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getProductAccountId(client: PoolClient, productIds: any[], companyId: string) {
        try {
            const query = {
                text: ` with "inventoryAccountId" as (
                select id as "accountId" from "Accounts"
                where "companyId" = $1
                and "name" = 'Inventory Assets'
                and "type" ='Inventory Assets'
                and "default"= true
                )
                select "Products".id , COALESCE("Products"."purchaseAccountId","inventoryAccountId"."accountId") as "accountId" from "Products"
                join "inventoryAccountId" on true 
                where "companyId" = $1
                and "id" = any($2)
          
                `,
                values: [companyId, productIds]
            }

            let data = await client.query(query.text, query.values);
            return data.rows
        } catch (error: any) {
            throw new Error(error)
        }
    }

}