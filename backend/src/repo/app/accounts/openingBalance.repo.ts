import { DB } from "@src/dbconnection/dbconnection"
import { ResponseData } from "@src/models/ResponseData"
import { Account } from "@src/models/account/Account"
import { Company } from "@src/models/admin/company"
import { PoolClient } from "pg"
import { AccountsRepo } from "./account.repo"
import { Helper } from "@src/utilts/helper"
import { OpeningBalanceAccount } from "@src/models/account/OpeningBalanceAccount"
import { createObjectCsvWriter } from "csv-writer"
import { RedisClient } from "@src/redisClient"
import { float } from "aws-sdk/clients/cloudfront"
import { ProductController } from "@src/controller/app/products/product.controller"
import { TriggerQueue } from "@src/repo/triggers/triggerQueue"
import { ProductRepo } from "../product/product.repo"
import { concurrency } from "sharp"
import { exportHelper } from "@src/utilts/ExportHelper"
import { Log } from "@src/models/log"
import { LogsManagmentRepo } from "../settings/LogSetting.repo"

export class OpeningBalanceRepo {

    public static async getOpeningBalanceDate(client: PoolClient, branchId: string) {
        try {
            const query = {
                text: `SELECT "openingBalanceDate" from "Branches" where id =$1`,
                values: [branchId]
            }

            let branch = await client.query(query.text, query.values);
            return branch.rows && branch.rows.length > 0 ? branch.rows[0].openingBalanceDate : null
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getOpeningBalanceAccounts(branchId: string, companyId: string) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const accountTypes = ['Current Assets', 'Non Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity']

            let openingBalanceDate = await this.getOpeningBalanceDate(client, branchId);

            const query: { text: string, values: any } = {
                text: `with "excludedAccounts" as(
                    select id from "Accounts" 
                    where "companyId" = $1
                    and "Accounts".name = any (array['Account Receivable','Inventory Assets','Account Payable'])
                    and "Accounts".type = any (array['Account Payable','Inventory Assets','Account Receivable'])
                    and "default" = true 
                )
                SELECT "Accounts".id as "accountId",
                                              "Accounts"."name",
                                              "Accounts"."default",
                                              "Accounts".type, 
                                              "Accounts"."parentType",
                                              sum(case when "OpeningBalance"."openingBalance" < 0 then abs ("OpeningBalance"."openingBalance") end) as "credit",
                                              sum(case when "OpeningBalance"."openingBalance" > 0 then "OpeningBalance"."openingBalance" end) as "debit"
                                           
                                              FROM "Accounts"
                LEFT JOIN "OpeningBalance" on "Accounts".id = "OpeningBalance"."accountId"   and   "OpeningBalance"."branchId"= $3 
                where "Accounts"."parentType"=any($2)
                and "Accounts"."companyId"= $1
                and "Accounts".id not in (select * from "excludedAccounts")
                group by "Accounts".id
                
                union all 
                
                SELECT  "Accounts".id as "accountId",
                                              "Accounts"."name",
                                              "Accounts"."default",
                                              "Accounts".type, 
                                              "Accounts"."parentType",
                                              0 as "credit",
                                              sum("BranchProducts"."openingBalance" * "BranchProducts"."openingBalanceCost") as "debit"
                                            
                                              FROM "Companies"
                left join "Products" on "Products"."companyId" ="Companies".id
                left join "BranchProducts" on "BranchProducts"."productId" = "Products".id and "BranchProducts"."branchId"= $3
                left join "Accounts" on "Accounts"."companyId" = "Companies".id and "Accounts".name = 'Inventory Assets' and "Accounts".type = 'Inventory Assets' and "default" =true
                where "Companies".id = $1
                 group by  "Accounts".id
                
                
                union all 
                SELECT  "Accounts".id as "accountId",
                                              "Accounts"."name",
                                              "Accounts"."default",
                                              "Accounts".type, 
                                              "Accounts"."parentType",
                                              0 as "credit",
                                              sum("CustomerOpeningBalance"."openingBalance") as "debit"
                                
                                              FROM "Companies"
                left join "Customers" on "Customers"."companyId" ="Companies".id
                left JOIN "CustomerOpeningBalance" on "Customers".id = "CustomerOpeningBalance"."customerId"   and   "CustomerOpeningBalance"."branchId"= $3
                left join "Accounts" on "Accounts"."companyId" = "Companies".id and "Accounts".name = 'Account Receivable' and "Accounts".type = 'Account Receivable' and "default" =true 
                where "Companies".id =  $1
                group by  "Accounts".id
            
                union all 
                SELECT  "Accounts".id as "accountId",
                                              "Accounts"."name",
                                              "Accounts"."default",
                                              "Accounts".type, 
                                              "Accounts"."parentType",
                                              sum("SupplierOpeningBalance"."openingBalance") as "credit",
                                              0 as "debit"
                                           
                                              FROM "Companies"
                left join "Suppliers" on "Suppliers"."companyId" ="Companies".id
                LEFT JOIN "SupplierOpeningBalance" on "Suppliers".id = "SupplierOpeningBalance"."supplierId"   and   "SupplierOpeningBalance"."branchId"= $3
                left join "Accounts" on "Accounts"."companyId" = "Companies".id and "Accounts".name = 'Account Payable' and "Accounts".type = 'Account Payable' and "default" =true 
                where "Companies".id = $1
                group by  "Accounts".id 
           
                  `,
                values: [companyId, accountTypes, branchId]
            }

            let accounts = await client.query(query.text, query.values)


            await client.query("COMMIT")
            return new ResponseData(true, "", { accounts: accounts.rows, openingBalanceDate: openingBalanceDate })
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async getOpeningBalanceAdjusmentId(client: PoolClient, companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT * FROM "Accounts" where name ='Opening Balance Adjusment' and type ='Equity' and "default"=true and "companyId" =$1`,
                values: [companyId]
            }

            let account = await client.query(query.text, query.values);
            return account.rows && account.rows.length > 0 ? account.rows[0].id : null
        } catch (error: any) {
            throw new Error(error)
        }
    }



    public static async updateOpeningBalanceDate(client: PoolClient, openingBalanceDate: any, branchId: String) {
        try {

            const companyQuery = {
                text: `UPDATE "Branches" SET "openingBalanceDate"=$1 WHERE id =$2 `,
                values: [openingBalanceDate, branchId]
            }

            await client.query(companyQuery.text, companyQuery.values);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async checkIfOpeningBalanceExist(client: PoolClient, accountId: string, branchId: string) {
        try {

            const query = {
                text: `SELECT COUNT(*) FROM "OpeningBalance" where "accountId" =$1 and "branchId"=$2`,
                values: [accountId, branchId]
            }
            let account = await client.query(query.text, query.values);
            if (account.rows && account.rows.length > 0 && account.rows[0].count > 0) {
                return true
            } else {
                return false
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async saveAccountOpeningBalance(data: any, company: Company, employeeId: string) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            let accounts = data.accounts
            let branchId = data.branchId;
            let openingBalanceDate = data.openingBalanceDate;

            await this.updateOpeningBalanceDate(client, openingBalanceDate, branchId)

            let opeiningBalanceAdjusmentId = await this.getOpeningBalanceAdjusmentId(client, company.id)
            if (opeiningBalanceAdjusmentId == null) {
                let account = new Account();
                account.name = 'Opening Balance Adjusment';
                account.type = 'Equity';
                account.parentType = 'Equity';
                account.default = true;
                account.companyId = company.id
                opeiningBalanceAdjusmentId = (await AccountsRepo.addAccounts(client, account, company.id)).data.id

            }

            let accountsTemp = []
            let adjusment = {
                id: '',
                debit: 0,
                credit: 0,
                accountId: opeiningBalanceAdjusmentId,
            };



            let debit = 0;
            let credit = 0;



            for (let index = 0; index < accounts.length; index++) {
                const element = accounts[index];
                if (element.name != 'Opening Balance Adjusment') {
                    accountsTemp.push(element)
                    debit += element.debit
                    credit += element.credit
                } else {
                    adjusment = element
                }
            }
            // let adjusmentAmount = adjusment.debit == 0 ? adjusment.credit : adjusment.debit
            let difference = credit - debit;
            if (difference < 0) {
                adjusment.credit = Math.abs(difference)
            } else {
                adjusment.debit = Math.abs(difference)

            }

            accountsTemp.push(adjusment)

            for (let index = 0; index < accountsTemp.length; index++) {
                const element = accountsTemp[index];
                let accountOpeningBalance = new OpeningBalanceAccount();
                accountOpeningBalance.ParseJson(element)
                accountOpeningBalance.companyId = company.id;
                accountOpeningBalance.branchId = branchId;

                accountOpeningBalance.openingBalance = accountOpeningBalance.debit == 0 ? accountOpeningBalance.credit * (-1) : accountOpeningBalance.debit
                const isAccountExist = await this.checkIfOpeningBalanceExist(client, accountOpeningBalance.accountId, branchId)
                if (isAccountExist) {
                    await this.editOpeningBalanceAccount(client, accountOpeningBalance, branchId, employeeId)
                } else {
                    if (accountOpeningBalance.debit > 0 || accountOpeningBalance.credit > 0) {
                        await this.insertOpeningBalanceAccount(client, accountOpeningBalance)
                    }
                }


            }
            await client.query("COMMIT")
            return new ResponseData(true, "", [])
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }


    public static async insertOpeningBalanceAccount(client: PoolClient, account: OpeningBalanceAccount) {
        try {

            const query: { text: string, values: any } = {
                text: `INSERT INTO "OpeningBalance" ("branchId","companyId","openingBalance","accountId") values ($1,$2,$3,$4)`,
                values: [account.branchId, account.companyId, account.openingBalance, account.accountId]
            }
            await client.query(query.text, query.values)
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async editOpeningBalanceAccount(client: PoolClient, account: OpeningBalanceAccount, branchId: string, employeeId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `UPDATE "OpeningBalance" SET "openingBalance"=$1  WHERE "accountId"=$2 and "branchId" =$3`,
                values: [account.openingBalance, account.accountId, branchId]
            }
            await client.query(query.text, query.values)

            let getEmployeeName = {
                text: `SELECT "Employees"."name" as "employeeName"
                  FROM "Employees"
                  WHERE "Employees".id = $1 and "Employees"."companyId" = $2
                        `,
                values: [employeeId, account.companyId]
            }
            let employeeName = (await client.query(getEmployeeName.text, getEmployeeName.values)).rows[0].employeeName;


            let log = new Log();
            log.employeeId = employeeId
            log.action = 'Opening Balance Modified'
            log.comment = `${employeeName} has modified the opening balance`

            await LogsManagmentRepo.manageLogs(client, "openingBalance", account.accountId, [log], branchId, account.companyId, employeeId, "", "Cloud")


        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getInventoryAssetsOpeningBalanceRecords(data: any, company: Company) {
        try {

            const companyId = company.id;
            const branchId = data.branchId;
            const searchTerm = data.searchTerm ? data.searchTerm.toLowerCase().trim() : null
            let page = data.page ?? 1;
            let offset = 0
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const query: { text: string, values: any } = {
                text: `SELECT
                            count( "Products".id) over(), 
                             "Products".id,
                             "Products"."name",
                             "BranchProducts"."openingBalance" as "stock",
                             "BranchProducts"."openingBalanceCost",
                             "BranchProducts"."openingBalance" *"BranchProducts"."openingBalanceCost" as "openingBalance"

                            FROM "Products"
                      left JOIN "BranchProducts" On "BranchProducts"."productId" = "Products".id
                      where "Products"."companyId" = $1
                      and "BranchProducts"."branchId" =$2
                      and ($3::text is null or (LOWER("Products".name) ~ $3
                      or LOWER("Products"."barcode") ~ $3))
                      order by case when "BranchProducts"."openingBalance" = 0  or "BranchProducts"."openingBalance" is null  then 1 else 0 end 
                      limit $4
                      offset $5
                    `,
                values: [companyId, branchId, searchTerm, limit, offset]
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


    public static async getAccountReceivableOpeningBalanceRecords(data: any, company: Company) {
        try {

            const companyId = company.id;
            const branchId = data.branchId;
            const searchTerm = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase() + `.*$` : '[A-Za-z0-9]*'
            let page = data.page ?? 1;
            let offset = 0
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const query: { text: string, values: any } = {
                text: `SELECT  count("Customers".id) over(),
                               "Customers".id,
                               "Customers"."name",
                               "CustomerOpeningBalance"."openingBalance"
                            FROM "Customers"
                            INNER JOIN "CustomerOpeningBalance" ON "CustomerOpeningBalance"."customerId" = "Customers".id and "CustomerOpeningBalance"."branchId"=$1
                        where "Customers"."companyId" = $2
                        and "Customers".name ~ $3
                        and   "CustomerOpeningBalance"."openingBalance" <>0
                        limit $4
                        offset $5
                    `,
                values: [branchId, companyId, searchTerm, limit, offset]
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


    public static async getAccountPayableOpeningBalanceRecords(data: any, company: Company) {
        try {

            const companyId = company.id;
            const branchId = data.branchId;
            const searchTerm = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase() + `.*$` : '[A-Za-z0-9]*'
            let page = data.page ?? 1;
            let offset = 0
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const query: { text: string, values: any } = {
                text: `SELECT  count("Suppliers".id) over(),
                               "Suppliers".id,
                               "Suppliers"."name",
                               "SupplierOpeningBalance"."openingBalance"
                            FROM "Suppliers"
                        INNER JOIN "SupplierOpeningBalance" ON "SupplierOpeningBalance"."supplierId" = "Suppliers".id  AND "SupplierOpeningBalance"."branchId" = $1
                        WHERE "Suppliers"."companyId" =$2
                        AND "Suppliers".name ~ $3
                        limit $4
                        offset $5
                    `,
                values: [branchId, companyId, searchTerm, limit, offset]
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


    public static async exprotInventoryAssetsOpeningBalance(company: Company, branchId: string, type: string = 'XLSX'): Promise<string> {
        try {
            const companyId = company.id;


            const selectQuery = `
                    SELECT
                              "Products".barcode as "Barcode",
                              "Products"."name" as "Product Name",
                              COALESCE("BranchProducts"."openingBalance",0) as "Opening Balance",
                              COALESCE("BranchProducts"."openingBalanceCost",0) as  "UnitCost" 
                    FROM "Products"
                    INNER JOIN "BranchProducts" On "BranchProducts"."productId" = "Products".id
                    LEFT  JOIN( SELECT pb."productId",
                                        STRING_AGG(pb.barcode, ';') AS barcodes
                                FROM    "ProductBarcodes" pb
                                GROUP BY pb."productId"
                            ) AS barcodes_concatenated ON "Products".id = barcodes_concatenated."productId"
                    WHERE "Products"."isDeleted" = false   and "Products".type = 'inventory'
                         and  "Products"."companyId" = $1
                         and "BranchProducts"."branchId"  = $2
                 
                         `;

            const selectList: any = await DB.excu.query(selectQuery, [companyId, branchId]);

            const header = [
                { id: 'Barcode', title: 'Barcode' },
                { id: 'Product Name', title: 'Product Name' },
                { id: 'Opening Balance', title: 'Opening Balance' },
                { id: 'UnitCost', title: 'UnitCost' },
            ]

            let fileName = await exportHelper.exportCsvAndXlsx(company, type, 'InventoryAssetsOpeningBalance', selectList.rows, header)
            return fileName;


        } catch (error: any) {

            throw new Error("Error exporting Inventory Assets Opening Balance: " + error.message); // Include the actual error message
        }
    }


    public static async saveInventoryAssetsOpeningBalance(client: PoolClient, companyId: string, data: { branchId: string, productId: string, stock: float, openingBalanceCost: float }) {
        try {

            //CHECK PRODUCT TYPE = INVENTORY
            const productType = await ProductRepo.getProductType(client, data.productId)
            if (productType != "inventory") {
                return new ResponseData(false, "invalid product Type", [])
            }



            const query: { text: string, values: any } = {
                text: `update "BranchProducts" set  "openingBalance" = $3,
                                                  "openingBalanceCost" =$4
                    WHERE "productId" = $1
                    AND "branchId"  = $2 `,
                values: [data.productId, data.branchId, data.stock, data.openingBalanceCost]
            }



            const selectList = await client.query(query.text, query.values);
            return new ResponseData(true, "", [])
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
            return new ResponseData(false, error.message, [])
        }

    }

    public static async importFromCsv(client: PoolClient, company: Company, data: any) {

        let redisClient = RedisClient.getRedisClient();
        try {



            let limit: any = process.env.NUMBER_OF_IMPORT_RECOREDS ?? 2000;

            let count = data.products.length; //3000
            let pageCount = Math.ceil(count / limit)

            let offset = 0;
            let resault = new ResponseData(true, "", [])

            let productLists: any[] = []
            // await redisClient.deletKey("BulkImport"+company.id)

            let isBulkImport = await redisClient.get("BulkImport" + company.id)

            if (isBulkImport) {
                let data = JSON.parse(isBulkImport)
                let progress = data.progress;
                return new ResponseData(false, "A Previouse Product Import is Still In Progress: " + progress, [])
            }


            for (let index = 0; index < pageCount; index++) {

                // if (page != 0) {
                //     offset = (limit * (page - 1))
                // }


                let products: any = data.products.splice(offset, limit)
                console.log(products)
                console.log("hereeeeeeeeeeeeeeeeeeeeeeeeeee")
                resault = await OpeningBalanceRepo.importFromCVS(client, company, data.branchId, products, index + 1, count)
                productLists = [...productLists, ...resault.data.products]
                if (resault.success && index + 1 == pageCount) {
                    await redisClient.deletKey("BulkImport" + company.id)
                }
            }


            console.log(productLists)
            console.log("productLists")
            return productLists
        } catch (error: any) {
            console.log(error)
            await redisClient.deletKey("BulkImport" + company.id)
            return new ResponseData(false, error.message, [])
        }
    }

    public static async importFromCVS(client: PoolClient, company: Company, branchId: string, data: any, pageNumber: number, count: number) {


        let redisClient = RedisClient.getRedisClient();
        try {
            let errors = [];


            const companyId = company.id;

            let limit: any = process.env.NUMBER_OF_IMPORT_RECOREDS ?? 2000;
            const products: any[] = []
            for (let index = 0; index < data.length; index++) {

                let progress = Math.floor((((index + 1) + ((pageNumber - 1) * limit)) / count) * 100) + "%"
                await redisClient.set("BulkImport" + company.id, JSON.stringify({ progress: progress }))


                const tempElement = { ...data[index] }
                let element: { productId: string, barcode: string, openingBalance: float, openingBalanceCost: float } = {
                    productId: tempElement.productId ?? "",
                    barcode: tempElement.barcode ?? "",
                    openingBalance: Number.isNaN(parseFloat(tempElement.openingBalance?.toString())) ? 0 : parseFloat(tempElement.openingBalance.toString()),
                    openingBalanceCost: Number.isNaN(parseFloat(tempElement.openingBalanceCost?.toString())) ? 0 : parseFloat(tempElement.openingBalanceCost.toString())
                }



                if (!element.productId) {
                    element.productId = await ProductRepo.getProductIdByBarcode(client, element.barcode, companyId)


                    if (!element.productId) {
                        errors.push({ productbarcode: element.barcode, error: "barcode does not exist" })
                        continue;
                    }

                }

                if (element.productId != "" && element.productId != null) {
                    products.push(element.productId)
                    let a = await this.saveInventoryAssetsOpeningBalance(client, companyId, { branchId: branchId, productId: element.productId, stock: element.openingBalance, openingBalanceCost: element.openingBalanceCost })
                    if (a?.success == false) {
                        errors.push({ productbarcode: element.barcode, error: a.msg })
                    }

                }


            }

            return new ResponseData(true, "", { errors: errors, products: products })
        } catch (error: any) {
            console.log(error)

            return new ResponseData(false, error.message, [])

        }
    }

}

