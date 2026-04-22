import { DB } from "@src/dbconnection/dbconnection";
import { Account } from "@src/models/account/Account";
import { ResponseData } from "@src/models/ResponseData";
import { AccountValidation } from "@src/validationSchema/account/accounts.Schema";
import { PoolClient } from "pg";


import { TimeHelper } from "@src/utilts/timeHelper";
import { Company } from "@src/models/admin/company";
import { ReportRepo } from "@src/repo/reports/reports.repo";
import moment from 'moment'
import { Log } from "@src/models/log";
import { ValidationException } from "@src/utilts/Exception";
import { BranchesRepo } from "@src/repo/admin/branches.repo";

import { ReportData } from "@src/utilts/xlsxGenerator";
import { exportHelper } from "@src/utilts/ExportHelper";
import { RedisClient } from "@src/redisClient";
import { chartOfAccounts } from "@src/utilts/chartOfAccountLists";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";
import loggerTest from "@src/utilts/logFile";



export class AccountsRepo {

    public static async isAccountNameExist(client: PoolClient, companyId: string, name: string, accountId: string | null = null) {
        // when adding new account 

        const query: { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "Accounts" where LOWER(name) = LOWER($1) and id <> $2 and "companyId" = $3`,
            values: [
                name,
                accountId,
                companyId,
            ],
        };
        // when editing  existing account 
        if (accountId == null) {
            query.text = `SELECT count(*) as qty FROM "Accounts" where LOWER(name) = LOWER($1) and "companyId" = $2`;
            query.values = [name, companyId];
        }

        const resault = await client.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }

        return false;
    }
    public static async addDefaultAccounts(companyId: string) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            let acconst = new Account()
            let accounts = acconst.accountTypes()

            for (let index = 0; index < accounts.length; index++) {
                const element = accounts[index];
                await this.addAccounts(client, element, companyId)
            }
            await client.query("COMMIT")

        } catch (error: any) {
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async getLogs(client: PoolClient, accountId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT logs from "Accounts" where id =$1`,
                values: [accountId]
            }

            let log = await client.query(query.text, query.values);
            if (log.rows && log.rows.length > 0) {
                return log.rows[0].logs ?? []
            } else {
                return []
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async addAccounts(client: PoolClient, data: any, companyId: string, employeeId: string | null = null) {
        try {

            //TODO: allow only accepted account type and parentType
            const validate = await AccountValidation.accountValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }



            const isAccountNameExist = await this.isAccountNameExist(client, companyId, data.name)
            if (isAccountNameExist) {
                throw new ValidationException("Account Name Already Used")
            }

            const isAccountCodeExist = await this.isAccountCodeExist(client, companyId, data.code)
            if (isAccountCodeExist) {
                throw new ValidationException("Account Code Already Used")
            }





            const account = new Account();
            account.ParseJson(data);
            account.companyId = companyId;
            account.validateParentType();
            if (account.parentId) {
                // get type, parentType of the parent account
                const parentDate = (await this.getAccountById(account.parentId, companyId)).data
                if (!parentDate.id) { throw new ValidationException("The parent id does not exist") }
                if (parentDate.type != account.type) { throw new ValidationException("The account type should be same as parentType: " + parentDate.type) }
                if (parentDate.parentType != account.parentType) { throw new ValidationException("The account parentType should be:  " + parentDate.parentType) }
                if (parentDate.parentId) { throw new ValidationException("The child account cannot be use as parent account") }
            }

            //use in edit -> if(crrentAccount.hasChild){throw new ValidationException("The parent account cannot be use as child account" )}


            if (employeeId != null && employeeId != '') {
                Log.addLog(account, "Add new Account", "add", employeeId)
            }
            /**Insert Account Query */
            const query: { text: string, values: any } = {
                text: `INSERT INTO "Accounts"
                                            (name,
                                            code,
                                            type,
                                            "parentType",
                                            description,
                                            "companyId",
                                            "default",
                                            "parentId",
                                            "logs",
                                            "translation") 
                            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, $10) RETURNING id`,
                values: [account.name,
                account.code,
                account.type,
                account.parentType,
                account.description,
                account.companyId,
                account.default,
                account.parentId,
                JSON.stringify(account.logs),
                account.translation]
            }
            const insert = await client.query(query.text, query.values)
            const accountId = (<any>insert.rows[0]).id

            return new ResponseData(true, "Added Successfully", { id: accountId })

        } catch (error: any) {

            throw new Error(error.message)
        }
    }

    public static async isAccountDefault(client: PoolClient, accountId: string) {
        try {
            const query = {
                text: `SELECT "default" from "Accounts" where id =$1`,
                values: [accountId]
            }

            let account = await client.query(query.text, query.values);
            return account.rows[0].default
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async editAccounts(client: PoolClient, data: any, companyId: string, employeeId: string | null = null) {
        try {
            //Validate Account Data 
            const validate = await AccountValidation.accountValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            //Check If Account Name Exist 
            const isAccountNameExist = await this.isAccountNameExist(client, companyId, data.name, data.id)
            if (isAccountNameExist) {
                throw new ValidationException("Account Name Already Used")
            }

            //Check If Account Code Exist 
            const isAccountCodeExist = await this.isAccountCodeExist(client, companyId, data.code, data.id)
            if (isAccountCodeExist) {
                throw new ValidationException("Account Code Already Used")
            }


            if (data.id == "" || data.id == null) {
                throw new ValidationException("Account Id is Required")
            }








            const account = new Account();
            account.ParseJson(data);
            account.companyId = companyId;

            if (account.parentId) {
                account.hasChild = await this.isParentAccount(companyId, account.id)
                if (account.hasChild) { throw new ValidationException("The parent account cannot be use as child account") }
                // get type, parentType of the parent account
                const parentDate = (await this.getAccountById(account.parentId, companyId)).data
                if (!parentDate.id) { throw new ValidationException("The parent id does not exist") }
                if (parentDate.type != account.type) { throw new ValidationException("The account type should be same as parentType: " + parentDate.type) }
                if (parentDate.parentType != account.parentType) { throw new ValidationException("The account parentType should be:  " + parentDate.parentType) }
                if (parentDate.parentId) { throw new ValidationException("The child account cannot be use as parent account") }
            }


            account.logs = await this.getLogs(client, account.id);
            if (employeeId != null && employeeId != "") {
                Log.addLog(account, "Edit Account", "Edit", employeeId)
            }

            let isDefault = await this.isAccountDefault(client, account.id)

            //Update Account 
            const query: { text: string, values: any } = {
                text: `UPDATE public."Accounts" 
                              SET name = case when $9 = true then "name" else $1 end , 
                                  code=$2, 
                                  description=$3 ,
                                  "logs"=$4,
                                  "translation"=$5, 
                                  "parentId" =$6
                                  WHERE id=$7 
                                  AND  "companyId" =$8 `,
                values: [account.name, account.code, account.description, JSON.stringify(account.logs), account.translation, account.parentId, account.id, account.companyId, isDefault]
            }
            const insert = await client.query(query.text, query.values)
            return new ResponseData(true, "Updated Successfully", [])
        } catch (error: any) {
            console.log(error)

            throw new Error(error.message)
        }
    }
    //TODO : ACCOUNT SEARCH CHANGE IT TO SEARCH VAKLUE IS NULL OR 
    public static async getAccountList(data: any, companyId: string) {
        try {



            // let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';
            let searchValue = data.searchTerm ? data.searchTerm.toLowerCase().trim() : null;
            let offset = 0;
            let sortValue;
            let sortDirection;
            let sortTerm;

            let page = data.page ?? 1
            let sort = data.sortBy;
            const filter = data.filter;
            sortValue = !sort ? 'a."createdAt"' : '"' + sort.sortValue + '"';

            if (data.accountId != null && data.accountId != "") {
                sortValue = ` (a.id = ` + "'" + data.accountId + "'" + ` )`
            }

            sortDirection = !sort ? "DESC " : sort.sortDirection;
            sortTerm = sortValue + " " + sortDirection;
            let orderByQuery = " ORDER BY " + sortTerm


            //calculate the offset and limit for pagenation 
            // in DataBase Offset start from 0  
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            let parentTypes = filter && filter.parentType ? filter.parentType : ['Current Assets',
                'Other Current Assets',
                'Fixed Assets',
                'Current Liabilities',
                'Long Term Liabilities',
                'Equity',
                'Operating Income',
                'Costs Of Goods Sold',
                'Operating Expense',
                'Other Current Liabilities',
                'Non Current Assets'
            ]


            const query: { text: string, values: any } = {
                text: `SELECT
                        count(*) over(), 
                        a.id,
                        a.name,
                        a.type,
                        a."parentType",
                        a."default",
                        a."code",
                        a."parentId", 
                        parents.name as "parentName",
                            a."translation"
                FROM "Accounts" a
                left join "Accounts" as parents on  a."companyId" = parents."companyId" and  a."parentId" = parents.id
                Where a."companyId"=$1
                AND a."parentType" = any($2)
                AND ($3::text is null or (Lower(a.name) ~ $3 OR 
                Lower(a."parentType") ~ $3
                or Lower(a.type) ~ $3
                or lower(a."code") ~ $3
                ))
                ${orderByQuery}
                LIMIT $4 OFFSET $5
                `,
                values: [companyId, parentTypes, searchValue, limit, offset]
            }



            let selectList = await DB.excu.query(query.text, query.values)
            let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
            let pageCount = Math.ceil(count / limit)
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
            console.log(error)

            throw new Error(error.message)

        }
    }
    public static async getAccountById(accountId: string, companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "parentType",
                               type,
                               name, 
                               id,
                               code,
                               description,
                               "default",
                               "translation", 
                               "parentId", 
                                 EXISTS ( SELECT 1 FROM "Accounts" c WHERE c."parentId" = "Accounts".id  AND c."companyId"=   "Accounts"."companyId") AS "hasChild"
                       FROM public."Accounts" 
                              WHERE id=$1 
                              AND "companyId"=$2`,
                values: [accountId, companyId]
            }

            const accounts = await DB.excu.query(query.text, query.values);

            const temp = new Account();
            temp.ParseJson(accounts.rows[0])
            temp.setAccountNature();
            return new ResponseData(true, "", temp)
        } catch (error: any) {

            throw new Error(error.message)
        }
    }

    /**Return Default Sales Account Id*/
    public static async getSalesId(client: PoolClient, branchId: string | null, companyId: string | null = null) {
        try {


            let filterId = branchId ? branchId : companyId;
            let filterQuery = branchId ? `    Where  "Branches".id =$1 ` : `    Where  "Companies".id =$1 `
            filterQuery += `   and "Accounts".type = $2 AND "Accounts".name ='Sales'
                                and "Accounts"."default" = $3  Limit 1`
            const query: { text: string, values: any } = {
                text: ` SELECT 
                        "Accounts".id 
                        FROM "Accounts" 
                        INNER JOIN "Companies" 
                        ON "Companies".id = "Accounts"."companyId"
                        INNER JOIN "Branches" 
                        ON "Branches"."companyId" = "Companies".id 
                       `,
                values: [filterId, 'Sales', true]
            }
            query.text += filterQuery;
            const account = await client.query(query.text, query.values);
            return { id: (<any>account.rows[0]).id }
        } catch (error: any) {

            throw new Error(error.message)
        }

    }


    public static async getProductSalesId(client: PoolClient, branchId: string, productId: string | null) {
        try {

            let saleAccountId;
            if (productId) {
                const productTax = {
                    text: `select "saleAccountId" from "Products" where id =$1 and "saleAccountId" is not  null`,
                    values: [productId]
                }

                let product = await client.query(productTax.text, productTax.values);
                saleAccountId = product && product.rows && product.rows.length > 0 ? product.rows[0].saleAccountId : null
            }

            if (saleAccountId == null) {


                const query: { text: string, values: any } = {
                    text: ` SELECT 
                        "Accounts".id 
                        FROM "Accounts" 
                        INNER JOIN "Companies" 
                        ON "Companies".id = "Accounts"."companyId"
                        INNER JOIN "Branches" 
                        ON "Branches"."companyId" = "Companies".id 
                        Where  "Branches".id =$1
                        and  "Accounts"."name" = $2
                        and  "Accounts"."default" = $3                   
                       `,
                    values: [branchId, 'Sales', true]
                }

                const account = await client.query(query.text, query.values);
                saleAccountId = (<any>account.rows[0]).id
            }
            return { id: saleAccountId }
        } catch (error: any) {

            throw new Error(error.message)
        }

    }
    /**Return Default Sales Account Id*/
    public static async getAccountType(client: PoolClient, accountId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT 
                "Accounts".type,
                         "Accounts"."parentType" 
                       FROM "Accounts" 
                       WHERE "Accounts".id = $1 `,
                values: [accountId]
            }
            const data = await client.query(query.text, query.values)
            return { parentType: data.rows[0].parentType, type: data.rows[0].type }
        } catch (error: any) {

            throw new Error(error.message)
        }
    }

    /**Get account Id  of Cash Payment for Default Payment */
    public static async getDefaultPaymentAccountId(client: PoolClient, companyId: string, type: string) {
        try {
            /**Type here is = Cash */
            const query: { text: string, values: any } = {
                text: `SELECT 
                           id 
                       FROM "Accounts" 
                       where "companyId"=$1 
                       AND type=$2`,
                values: [companyId, type]
            }
            const account = await client.query(query.text, query.values);

            return account.rows[0].id
        } catch (error: any) {

            throw new Error(error.message);
        }
    }


    // public static async getAccountJournals(data: any, company: Company) {
    //     const client = await DB.excu.client();
    //     try {
    //         const companyId = company.id;
    //         const afterDecimal = company.afterDecimal;
    //         let from = data.from;
    //         /** From Is null ->> As Off */
    //         if (from != null) {
    //             from = new Date(data.from)
    //             from = await TimeHelper.resetHours(from)
    //         }
    //         let to: any = new Date(data.to)
    //         to = moment(to).add(1, 'day').format("YYYY-MM-DD 00:00:00");

    //         const branchId = data.branchId;


    //         await client.query("BEGIN")

    //         /**Interval Selection Query */
    //         const query: { text: string, values: any } = {
    //             text: `SELECT 
    //                         sum(case when amount >0 then amount else null end) as debit,
    //                         sum(case when amount <0 then ABS(amount) else null end) as credit,
    //                         "dbTable" as type,
    //                         "JournalRecords".code,
    //                         "referenceId",
    //                         "JournalRecords"."createdAt"::date as "createdAt",
    //                          "userId",
    //                          "userName",
    //                          "userType"
    //                     FROM "JournalRecords"
    //                     WHERE "accountId" = $1
    //                     AND "JournalRecords"."createdAt"::timeStamp>=$2::timeStamp
    //                     AND "JournalRecords"."createdAt"::timeStamp<$3::timeStamp
    //                     group by "dbTable", "JournalRecords".code, "referenceId","createdAt"::date,"userId","userName", "userType"
    //                     ORDER BY "createdAt" ASC `,
    //             values: [data.accountId, from, to]
    //         }
    //         if (branchId != null) {
    //             query.text = `SELECT 
    //             sum(case when amount >0 then amount else null end) as debit,
    //             sum(case when amount <0 then ABS(amount) else null end) as credit,
    //             "dbTable" as type,
    //             "JournalRecords".code,
    //             "referenceId",
    //             "JournalRecords"."createdAt"::date as "createdAt",
    //             "userId",
    //             "userName",
    //             "userType"
    //         FROM "JournalRecords"
    //         WHERE "accountId" = $1
    //         AND "JournalRecords"."createdAt">=$2
    //         AND "JournalRecords"."createdAt"<$3
    //         AND ( ("JournalRecords"."branchId" =$4) or("JournalRecords"."compnayId" =$5))
    //         group by "dbTable", "JournalRecords".code, "referenceId", "createdAt"::date,"userId","userName", "userType"
    //         ORDER BY "createdAt" ASC`;
    //             query.values = [data.accountId, from, to, branchId, companyId]
    //         }



    //         /**As Off Selection Query */
    //         if (from == null) {
    //             query.text = `SELECT 
    //             sum(case when amount >0 then amount else null end) as debit,
    //             sum(case when amount <0 then ABS(amount) else null end) as credit,
    //                             "dbTable" as type,
    //                             "JournalRecords".code,
    //                             "referenceId",
    //                             "JournalRecords"."createdAt",
    //                             "userId",
    //                             "userName",
    //                             "userType"
    //                         FROM "JournalRecords"
    //                         WHERE "accountId" = $1
    //                         AND "JournalRecords"."createdAt"<$2
    //                         group by "dbTable", "JournalRecords".code, "referenceId",    "JournalRecords"."createdAt","userId","userName", "userType"
    //                         ORDER BY "JournalRecords"."createdAt" ASC`,
    //                 query.values = [data.accountId, to]
    //             if (branchId != null) {
    //                 query.text = `SELECT 
    //                 sum(case when amount >0 then amount else null end) as debit,
    //                 sum(case when amount <0 then ABS(amount) else null end) as credit,
    //                 "dbTable" as type,
    //                 "JournalRecords".code,
    //                 "referenceId",
    //                 "JournalRecords"."createdAt",
    //                 "userId",
    //                 "userName",
    //                 "userType"
    //             FROM "JournalRecords"
    //             WHERE "accountId" = $1
    //             AND "JournalRecords"."createdAt"<$2
    //             AND ( ("JournalRecords"."branchId" =$3) or("JournalRecords"."branchId" =$4))
    //             group by "dbTable", "JournalRecords".code, "referenceId",    "JournalRecords"."createdAt" ,"userId","userName", "userType"
    //             ORDER BY "JournalRecords"."createdAt" ASC`,
    //                     query.values = [data.accountId, to, branchId, companyId]
    //             }
    //         }
    //         let opeiningBalance = 0;


    //         const journals = await client.query(query.text, query.values);
    //         /**Account Opening Balance Query =  sum of debit and credit of journal entries where createdAt < from  */
    //         if (from != null) {
    //             query.text = `SELECT 
    //         sum (case when amount > 0 then amount else 0 end) -  sum (case when amount < 0 then ABS(amount) else 0 end) as "opeiningBalance"
    //         FROM "JournalRecords"
    //         WHERE "accountId"= $1
    //         AND "JournalRecords"."createdAt"<$2`
    //             query.values = [data.accountId, from]

    //             if (branchId != null) {
    //                 query.text = `SELECT 
    //             sum (case when amount > 0 then amount else 0 end) -  sum (case when amount < 0 then ABS(amount) else 0 end) as "opeiningBalance"
    //             FROM "JournalRecords"
    //             WHERE "accountId"= $1
    //             AND "JournalRecords"."createdAt"<$2
    //             AND ( ("JournalRecords"."branchId" =$3) or("JournalRecords"."branchId" =$4)) `
    //                 query.values = [data.accountId, from, branchId, companyId]
    //             }

    //             const opeiningBalanceData = await client.query(query.text, query.values)
    //             const resault = opeiningBalanceData.rows[0];
    //             opeiningBalance = resault.opeiningBalance == null ? 0 : resault.opeiningBalance;
    //         }
    //         for (let index = 0; index < journals.rows.length; index++) {
    //             const element = journals.rows[index];
    //             Helper.roundNumbers(afterDecimal, journals.rows[index])

    //         }

    //         const journal = {
    //             openingBalance: opeiningBalance,
    //             journals: journals.rows
    //         }

    //         await client.query("COMMIT")
    //         return new ResponseData(true, "", journal)
    //     } catch (error: any) {
    //         await client.query("ROLLBACK")
    //       
    //         throw new Error(error.message)
    //     } finally {
    //         client.release()
    //     }
    // }


    public static async getAccountDetails(client: PoolClient | null, accountId: string, companyId: string) {
        try {
            const query = {
                text: `SELECT "name","parentType","type" from "Accounts" where id=$1 and "companyId" =$2`,
                values: [accountId, companyId]
            }
            let account = client ? await client.query(query.text, query.values) : await DB.excu.query(query.text, query.values);
            if (account.rows && account.rows.length > 0) {
                const accountInfo = new Account()
                accountInfo.ParseJson(account.rows[0])
                accountInfo.setAccountNature()
                return accountInfo
            }
            return null
        } catch (error: any) {
            throw new Error(error)
        }
    }



    public static async checkAccountJournal(accountId: string) {
        try {
            const query = {
                text: `select
                       "name",
                       "type", 
                       "parentType",
                       "default"
                      from "Accounts" where id = $1`,
                values: [accountId]
            }

            const account = await DB.excu.query(query.text, query.values)
            return {
                type: (<any>account.rows[0]).type,
                default: (<any>account.rows[0]).default,
                name: (<any>account.rows[0]).name,
                parentType: (<any>account.rows[0]).parentType
            }

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getAccountJournals(data: any, company: Company, brancheList: []) {
        const client = await DB.excu.client();
        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;
            let from = data.from;

            /** From Is null ->> As Off */
            if (from != null) {
                from = new Date(data.from)
                from = await TimeHelper.resetHours(from)
            }
            let to: any = new Date(data.to)
            to = moment(to).add(1, 'day').format("YYYY-MM-DD 00:00:00");


            const branchId = data.branchId ? [data.branchId] : brancheList;
            let filter = data.filter;
            await client.query("BEGIN")
            const query = {
                text: `SELECT 
                       CAST( sum(case when "JournalRecords".amount >0 then "JournalRecords".amount::text::numeric  else null end) AS REAL ) as debit,
                        CAST( sum(case when "JournalRecords".amount <0 then ABS("JournalRecords".amount::text::numeric ) else null end) AS REAL ) as credit,
                        "JournalRecords"."dbTable" as type,
                        "JournalRecords".code,
                        "JournalRecords"."referenceId",
                        "JournalRecords"."createdAt"::date as "createdAt",
                        "JournalRecords"."userId",
                        "JournalRecords"."userName",
                        "JournalRecords"."userType",
                        case when  "JournalRecords"."dbTable"  ='Invoice Payment' THEN  "InvoicePayments"."referenceNumber" 
                             when  "JournalRecords"."dbTable"  ='Billing Payment' THEN  "BillingPayments"."referenceNumber" 
                             when  "JournalRecords"."dbTable"  ='Credit Note Refunds' THEN  "CreditNoteRefunds"."refrenceNumber" 
                             when  "JournalRecords"."dbTable"  ='Expenses' THEN  "Expenses"."referenceNumber" 
                             when  "JournalRecords"."dbTable"  ='Supplier Refunds' THEN  "SupplierRefunds"."referenceNumber"
                             when  "JournalRecords"."dbTable"  ='Journals' THEN  "JournalLines"."code"
                        end as "referenceCode"
                    FROM "JournalRecords"
                    left join "InvoicePayments" on "InvoicePayments".id = "JournalRecords"."referenceId" and  "JournalRecords"."dbTable"  ='Invoice Payment'
                    left join "BillingPayments" on "BillingPayments".id = "JournalRecords"."referenceId" and  "JournalRecords"."dbTable"  ='Billing Payment'
                    left join "CreditNoteRefunds" on "CreditNoteRefunds".id = "JournalRecords"."referenceId" and  "JournalRecords"."dbTable"  ='Credit Note Refunds'
                    left join "Expenses" on "Expenses".id = "JournalRecords"."referenceId" and  "JournalRecords"."dbTable"  ='Expenses'
                    left join "SupplierRefunds" on "SupplierRefunds".id = "JournalRecords"."referenceId" and  "JournalRecords"."dbTable"  ='Supplier Refunds'
                    left join "JournalLines" on "JournalLines"."journalId" = "JournalRecords"."referenceId" and  "JournalRecords"."dbTable"  ='Journals'  and "JournalLines"."accountId" = $1
                    WHERE "JournalRecords"."accountId" = $1
                    AND( $2::timestamp is null or  "JournalRecords"."createdAt">=$2)
                    AND "JournalRecords"."createdAt"<$3
                    AND "JournalRecords"."companyId" =$4
                    AND (  $5::uuid[] is null or  "JournalRecords"."branchId" = ANY($5) ) 
                    group by   "JournalRecords"."dbTable", "JournalRecords".code,   "JournalRecords"."referenceId", "JournalRecords"."createdAt"::date,"userId","userName", "userType","referenceCode"
                    ORDER BY "JournalRecords"."createdAt"::date ASC`,
                values: [data.accountId, from, to, companyId, branchId]
            }
            let opeiningBalance = 0;


            const journals = await client.query(query.text, query.values);
            /**Account Opening Balance Query =  sum of debit and credit of journal entries where createdAt < from  */
            if (from != null) {
                query.text = `SELECT 
            sum (case when amount > 0 then amount::text::numeric else 0 end) -  sum (case when amount < 0 then ABS(amount::text::numeric ) else 0 end) as "opeiningBalance"
            FROM "JournalRecords"
            WHERE "accountId"= $1
            and "companyId"=$2
            AND "JournalRecords"."createdAt"<$3
			AND ($4::uuid[] IS NULL OR "JournalRecords"."branchId" = ANY($4))
			`
                query.values = [data.accountId, companyId, from, branchId]
                const opeiningBalanceData = await client.query(query.text, query.values)
                const resault = opeiningBalanceData.rows[0];
                opeiningBalance = resault.opeiningBalance == null ? 0 : resault.opeiningBalance;
            }

            const journal = {
                openingBalance: Number(opeiningBalance),
                journals: journals.rows
            }
            if (data && data.export) {
                let account = await this.getAccountDetails(client, data.accountId, company.id)
                if (account) {
                    account.openingBalance = opeiningBalance;
                    journals.rows = journals.rows
                    // journals.rows.sort((a: any, b: any) => (a.grandTypeIndex - b.grandTypeIndex|| a.parentTypeIndex - b.parentTypeIndex|| 0-(a.type>b.type?1:-1)) )
                    let report = new ReportData()
                    report.filter = {
                        title: `${account.name} Journal`,
                        fromDate: data.from ? data.from : null,
                        toDate: data.to ? data.to : new Date(),
                        branches: branchId,
                        // compareType: compareType,
                        accountDetils: account,
                    }
                    report.records = journals.rows

                    //get columns & subColumns

                    report.columns = [...[{ key: 'createdAt', header: 'Date', properties: { columnType: 'date' } },
                    { key: 'code' },
                    { key: 'type' },
                    { key: 'referenceCode', header: 'Reference Number' },
                    { key: 'debit', properties: { hasTotal: true, columnType: 'currency' } },
                    { key: 'credit', properties: { hasTotal: true, columnType: 'currency' } }
                    ], ...report.columns]
                    report.fileName = `${account.name} Journal`
                    return new ResponseData(true, "", report)
                }

            } else {
                return new ResponseData(true, "", journal)
            }

            await client.query("COMMIT")
            return new ResponseData(true, "", journal)
        } catch (error: any) {
            await client.query("ROLLBACK")

            throw new Error(error.message)
        } finally {
            client.release()
        }
    }



    /**Sales Accounts for invoices */
    public static async getSalesAccounts(companyId: string) {
        try {
            const type = ["Operating Income"]
            const query: { text: string, values: any } = {
                text: `SELECT 
                         id,
                         name,
                         "parentType",
                         "type",
                         "code"
                      FROM "Accounts"
                      WHERE "companyId" = $1
                      AND "parentType" = any($2)
                    
                       `,
                values: [companyId, type]
            }

            const accounts = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", accounts.rows)
        } catch (error: any) {

            throw new Error(error.message)
        }
    }


    /** Dashboard functions */
    /** getAccountTransactions return opening balance for giving account  + last six Month transactions Summary(for display only)*/
    public static async getAccountTransactions(companyId: string, afterDecimal: number, from: any, to: any, accountTypes: any[], branches: any[] | null) {
        try {


            /**Opening Balance */
            // const filterField = branchId != null && branchId != "" ? branchId : companyId;
            // const filterQuery = branchId != null && branchId != "" ? ' AND "JournalRecords"."branchId" = $2' : ' AND "JournalRecords"."companyId" = $2'
            // const balnacefilterQuery = filterQuery + ' AND "JournalRecords"."createdAt" >=$3   AND  "JournalRecords"."createdAt" <= $4 '
            // let groupBy = ` GROUP BY "Accounts".type, "JournalRecords"."createdAt" `

            // let balanceQuery = `select 
            // CAST( ROUND(ABS( sum("JournalRecords".amount))::numeric ,$5::INT)AS REAL) as total
            //                         from "Accounts"
            //                         join "JournalRecords" on "JournalRecords"."accountId" = "Accounts".id
            //                         where "Accounts".type=any($1)
            //                         `
            // balanceQuery += balnacefilterQuery;
            // let opeiningBalance = await client.query(balanceQuery, [accountTypes, filterField, from, to, afterDecimal])
            // opeiningBalance = (<any>opeiningBalance.rows[0]).total;



            // /**Last six month transaction summary (group by month) */
            // const lastTransactionsFilterQuery = filterQuery + ` AND "JournalRecords"."createdAt" >= CURRENT_DATE - INTERVAL '6 months'`
            // groupBy = `    group by date_trunc('month',  "JournalRecords"."createdAt")`
            // let transactionsQuery = `select
            //                             CAST( ABS(ROUND(sum ("JournalRecords".amount)::numeric ,$3::INT))AS REAL) as "total",
            //                             date_trunc('month',  "JournalRecords"."createdAt") as "createdAt"
            //                         from "Accounts"
            //                         join "JournalRecords" on "JournalRecords"."accountId" = "Accounts".id
            //                         where "Accounts".type=any($1)`
            // transactionsQuery += lastTransactionsFilterQuery + groupBy

            // let outerQuery = `select 
            // generate_series  as "createdAt",
            // COALESCE(t.total,0) as total 
            //  FROM generate_series( CURRENT_DATE - INTERVAL '6 months',CURRENT_DATE,'1 Month') left join ( `
            // const outerGroupBy = `) t on  t."createdAt" = date_trunc('month',  generate_series)`
            // outerQuery += transactionsQuery + outerGroupBy
            // const transactions = await client.query(outerQuery, [accountTypes, filterField, afterDecimal]as any);
            const query = {
                text: `SELECT ABS( sum("JournalRecords".amount::text::numeric)) as total  FROM "JournalRecords"
                       INNER JOIN "Accounts" on "Accounts".id  = "JournalRecords"."accountId"
                       where "JournalRecords"."companyId" = $2
                       AND( $3::uuid[] is null OR "JournalRecords"."branchId" =any($3))
                       AND "JournalRecords"."createdAt" >=$4   AND  "JournalRecords"."createdAt" < $5
                       AND  "Accounts".type=any($1)
                      
                       `,
                values: [accountTypes, companyId, branches, from, to]
            }

            let balance = await DB.excu.query(query.text, query.values)
            balance = (<any>balance.rows[0]).total;
            return new ResponseData(true, "", {
                lastSixMonthsSummary: [],
                balance: balance ? balance : 0,
                revenue: 0
            })

        } catch (error: any) {


            throw new Error(error)
        }
    }


    public static async getCostOfAccountTransactions(companyId: string, afterDecimal: number, from: any, to: any, accountTypes: any[], branches: any[] | null) {
        try {


            /**Opening Balance */
            // const filterField = branchId != null && branchId != "" ? branchId : companyId;
            // const filterQuery = branchId != null && branchId != "" ? ' AND "JournalRecords"."branchId" = $2' : ' AND "JournalRecords"."companyId" = $2'
            // const balnacefilterQuery = filterQuery + ' AND "JournalRecords"."createdAt" >=$3   AND  "JournalRecords"."createdAt" <= $4 '
            // let groupBy = ` GROUP BY "Accounts".type, "JournalRecords"."createdAt" `

            // let balanceQuery = `select 
            // CAST( ROUND(ABS( sum("JournalRecords".amount))::numeric ,$5::INT)AS REAL) as total
            //                         from "Accounts"
            //                         join "JournalRecords" on "JournalRecords"."accountId" = "Accounts".id
            //                         where "Accounts".type=any($1)
            //                         `
            // balanceQuery += balnacefilterQuery;
            // let opeiningBalance = await client.query(balanceQuery, [accountTypes, filterField, from, to, afterDecimal])
            // opeiningBalance = (<any>opeiningBalance.rows[0]).total;



            // /**Last six month transaction summary (group by month) */
            // const lastTransactionsFilterQuery = filterQuery + ` AND "JournalRecords"."createdAt" >= CURRENT_DATE - INTERVAL '6 months'`
            // groupBy = `    group by date_trunc('month',  "JournalRecords"."createdAt")`
            // let transactionsQuery = `select
            //                             CAST( ABS(ROUND(sum ("JournalRecords".amount)::numeric ,$3::INT))AS REAL) as "total",
            //                             date_trunc('month',  "JournalRecords"."createdAt") as "createdAt"
            //                         from "Accounts"
            //                         join "JournalRecords" on "JournalRecords"."accountId" = "Accounts".id
            //                         where "Accounts".type=any($1)`
            // transactionsQuery += lastTransactionsFilterQuery + groupBy

            // let outerQuery = `select 
            // generate_series  as "createdAt",
            // COALESCE(t.total,0) as total 
            //  FROM generate_series( CURRENT_DATE - INTERVAL '6 months',CURRENT_DATE,'1 Month') left join ( `
            // const outerGroupBy = `) t on  t."createdAt" = date_trunc('month',  generate_series)`
            // outerQuery += transactionsQuery + outerGroupBy
            // const transactions = await client.query(outerQuery, [accountTypes, filterField, afterDecimal]as any);
            const query = {
                text: `WITH "costs" as (

                            SELECT ABS( sum("InventoryMovmentRecords".qty::text::numeric *  "InventoryMovmentRecords"."cost"::text::numeric )) as total  FROM "InventoryMovmentRecords"
                                                INNER JOIN "Accounts" on "Accounts"."companyId"  = $1 and "Accounts"."name" = 'Costs Of Goods Sold' and "Accounts"."default" = true
                                                AND "InventoryMovmentRecords"."companyId" =  $1
                                                    AND(  $2::uuid[] is null OR "InventoryMovmentRecords"."branchId" =any($2))
                                                   AND "InventoryMovmentRecords"."createdAt" >=$3  AND  "InventoryMovmentRecords"."createdAt" <$4

                                                AND "InventoryMovmentRecords"."referenceTable" <> 'Opening Balance' 
                                                AND "InventoryMovmentRecords"."referenceTable" <> 'Billing' 
                                                AND "InventoryMovmentRecords"."referenceTable" <> 'Supplier Credit'
                                            
                                
                            union all 
                                
                            SELECT ABS( sum("JournalRecords".amount::text::numeric))  as total  FROM "JournalRecords"
                                                INNER JOIN "Accounts" on "Accounts"."companyId"  =   $1 and "Accounts"."name" = 'Costs Of Goods Sold' and "Accounts"."default" = true
                                             
                                                and "JournalRecords"."accountId" = "Accounts".id
                                                   where "JournalRecords"."companyId" =   $1
                                                AND( $2::uuid[] is null OR "JournalRecords"."branchId" =any($2))
                                                    and not ("Accounts".name = 'Costs Of Goods Sold' and "dbTable" in ('Invoice', 'Credit Note','Inventory Transfer','Physical Count','Opening Balance','Manual Adjusment'))

                                                AND "JournalRecords"."createdAt" >=$3  AND  "JournalRecords"."createdAt" <$4

                            )

                            select sum("total") as "total" from "costs" `,
                values: [companyId, branches, from, to]
            }

            let balance = await DB.excu.query(query.text, query.values)
            balance = (<any>balance.rows[0]).total;
            return new ResponseData(true, "", {
                lastSixMonthsSummary: [],
                balance: balance ? balance : 0,
                revenue: 0
            })

        } catch (error: any) {


            throw new Error(error)
        }
    }
    /** Expense and Income Summary*/
    public static async getIncomeExpenseTransactions(data: any, company: Company, branchList: []) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")


            const branches = data.branchId ? [data.branchId] : branchList;
            const companyId = company.id;
            let from = data.interval.from;
            let  to = data.interval.to;

            const accountTypes = ['Operating Expenses', 'Operating Income']
            const filterField = branches != null && branches.length > 0 ? branches : companyId;
            let filterQuery = branches != null && branches.length > 0 ? ' AND "JournalRecords"."branchId" = any($2)' : ' AND "JournalRecords"."companyId" = $2'
            filterQuery += ' AND "JournalRecords"."createdAt" >=$3 AND "JournalRecords"."createdAt" <=$4 '
            let groupByQuery = `  group by  "Accounts"."parentType" `
            let closingTime = "00:00:00"
            let fromDate = from ? moment(new Date(from)) : moment();
            let toDate = to ? moment(new Date(to)) : moment();




            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
             from = interval.from
             to = interval.to
            let transactionsQuery = `select 
                                        sum("JournalRecords".amount) amount,
                                        "Accounts"."parentType",
                                          TO_CHAR("JournalRecords"."createdAt", 'YYYY-MM') AS "createdAt"
                                    from "Accounts" 
                                    inner join "JournalRecords" ON  "JournalRecords"."accountId" = "Accounts".id
                                    WHERE "Accounts"."parentType" =any( $1)`
            groupByQuery += ` ,       TO_CHAR("JournalRecords"."createdAt", 'YYYY-MM')`
            transactionsQuery += filterQuery + groupByQuery
            const transactions = await client.query(transactionsQuery, [accountTypes, filterField, from, to])


            console.log(transactionsQuery)

            const expenseTransactions = transactions.rows.filter((f: any) => f.parentType == 'Operating Expenses')
            const incomeTransactions = transactions.rows.filter((f: any) => f.parentType == 'Operating Income')


            const resData = {
                expense: expenseTransactions,
                income: incomeTransactions
            }
            await client.query("COMMIT")
            return new ResponseData(true, "", resData)

        } catch (error: any) {

            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    /**
     * 
     * @param from 
     * @param numOfMonth 
     * @returns 
     * 
     * 
     * the function will return first date and last date for past giving number of month 
     * example if the interval sent by front from '1-10-2023' to '31-10-2023'
     * then the function will retrun first and last  date of last month because the interval is one month 
     * numOfMonth in the above example is one 
     * from is    '31-10-2023'
     * 
     */
    public static async getLastMonthIntervals(from: Date, numOfMonth: number) {

        try {
            var startOfLastSixMonth = new Date(from.getFullYear(), from.getMonth() - numOfMonth, 1);
            var endOfLastMonth = new Date(from.getFullYear(), from.getMonth(), 0);
            var dates = [];
            for (var i = 0; i < numOfMonth; i++) {
                var startDate = new Date(startOfLastSixMonth.getFullYear(), startOfLastSixMonth.getMonth() + i, 1);
                var endDate = new Date(startOfLastSixMonth.getFullYear(), startOfLastSixMonth.getMonth() + i + 1, 0);
                dates.push({
                    startDate: startDate,
                    endDate: endDate
                });
            }
            let interval = {
                from: dates[0].startDate,
                to: dates[dates.length - 1].endDate
            };
            return interval;
        } catch (error: any) {

            throw new Error(error)
        }
    }
    public static async getDashboardSummary(data: any, company: Company, branchList: []) {

        try {

            const branches = data.branchId ? [data.branchId] : branchList;
            const companyId = company.id;
            // let from = new Date(data.from);
            // let to = new Date(data.to);
            /** Calcuster the number of months between two intervals from-to */
            // let months = (to.getFullYear() - from.getFullYear()) * 12;
            // months -= from.getMonth();
            // months += to.getMonth();
            // months += 1;
            // let interval: any = {
            //     from: from,
            //     to: to
            // }
            /**Get last months interval: 
             * Getting last months interval will help calculting 
             * 
             * 
             */
            // if (months == 1) {
            //     interval = await this.getLastMonthIntervals(from, months)
            // } else {
            //     interval = await this.getLastMonthIntervals(from, months)
            // }



            // let fromSecondInterval = interval.from
            // fromSecondInterval.setDate(fromSecondInterval.getDate() + 1)

            // let toSecondInterval = interval.to
            // toSecondInterval.setDate(toSecondInterval.getDate() + 1)

            let from = data && data.interval ? new Date(data.interval.from) : new Date()
            from = await TimeHelper.resetHours(from)
            let to: any = data && data.interval ? new Date(data.interval.to) : new Date()
            to = moment(to).add(1, 'day').format("YYYY-MM-DD 00:00:00");
            //TODO: CLINET 
            const netProfit = (await ReportRepo.getNetProfitTotal(from, to, branches, company)).data;
            // const secondNetProfit = (await ReportRepo.calculateProfits(branchId, toSecondInterval, companyId, company.afterDecimal, fromSecondInterval)).netProfit;

            // let netProfitRevenu = Helper.roundNum(((netProfit - Math.abs(secondNetProfit)) / secondNetProfit) * 100, company.afterDecimal)


            const receivableTransations = (await this.getAccountTransactions(companyId, company.afterDecimal, from, to, ['Account Receivable'], branches)).data
            // const secondReceivableTransations = (await this.getAccountTransactions(companyId, company.afterDecimal, fromSecondInterval, toSecondInterval, ['Account Receivable'], branchId)).data
            // receivableTransations.revenue = Helper.roundNum(((receivableTransations.balance - secondReceivableTransations.balance) / secondReceivableTransations.balance) * 100, company.afterDecimal)

            const payableTransations = (await this.getAccountTransactions(companyId, company.afterDecimal, from, to, ['Account Payable'], branches)).data
            // const secondPayableTransations = (await this.getAccountTransactions(companyId, company.afterDecimal, fromSecondInterval, toSecondInterval, ['Account Payable'], branchId)).data
            // payableTransations.revenue = Helper.roundNum(((payableTransations.balance - secondPayableTransations.balance) / secondPayableTransations.balance) * 100, company.afterDecimal)



            const costsOfGoodsSoldTransations = (await this.getCostOfAccountTransactions(companyId, company.afterDecimal, from, to, ['Costs Of Goods Sold'], branches)).data
            // const secondCostsOfGoodsSoldTransations = (await this.getAccountTransactions(companyId, company.afterDecimal, fromSecondInterval, toSecondInterval, ['Costs Of Goods Sold'], branchId)).data
            // costsOfGoodsSoldTransations.revenue = Helper.roundNum(((costsOfGoodsSoldTransations.balance - secondCostsOfGoodsSoldTransations.balance) / secondCostsOfGoodsSoldTransations.balance * 100), company.afterDecimal)

            const resData = {
                // netProfit: netProfit ? netProfit : 0,
                receivable: receivableTransations,
                payable: payableTransations,
                costOfGoodsSold: costsOfGoodsSoldTransations
            }

            return new ResponseData(true, "", resData)

        } catch (error: any) {
            console.log(error)


            throw new Error(error)
        }
    }



    public static async checkIfDefaultAccountExist(client: PoolClient, accountName: string, companyId: string | null, branchId: string | null = null) {
        try {
            const query: { text: string, values: any } = {
                text: ` select COUNT(*) AS QTY from "Accounts" where "Accounts".name = $1 and "default" = true and "companyId" = $2`,
                values: [accountName, companyId]
            }
            if (branchId != null) {
                query.text = `select COUNT(*) AS QTY from "Accounts"
                              INNER JOIN "Branches" on "Branches"."companyId" = "Accounts"."companyId"
                              where "Accounts".name = $1 and "default" = true
                              and "Branches".id = $2
                              `
                query.values = [accountName, branchId]
            }

            let account = await client.query(query.text, query.values);

            if (account.rows[0].qty > 0) {
                return true
            }

            return false
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async addDefaultAccountByName(client: PoolClient, accountName: string, companyId: string) {
        try {
            let account = new Account();
            let type = account.accountTypes().find((f => f.name == accountName));
            account.ParseJson(type)
            account.companyId = companyId
            const query: { text: string, values: any } = {
                text: `INSERT INTO "Accounts" (name,"type","parentType","companyId","default") values ($1,$2,$3,$4,$5)`,
                values: [account.name, account.type, account.parentType, account.companyId, true]
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async addAccountIfNotExist(client: PoolClient, accountName: string, companyId: string | null, branchId: string | null = null) {
        try {

            let isExist = await this.checkIfDefaultAccountExist(client, accountName, companyId, branchId);
            if (!isExist) {
                if (branchId) {
                    companyId = (await BranchesRepo.getBranchCompanyId(client, branchId)).compayId
                }

                if (companyId) {
                    await this.addDefaultAccountByName(client, accountName, companyId)

                }
            }
            return new ResponseData(true, "", [])
        } catch (error: any) {


            throw new Error(error.message)
        }
    }


    public static async getDefaultAccountByName(client: PoolClient, accountName: string, companyId: string) {
        try {
            const query = {
                text: `SELECT id from "Accounts" where lower(name) = lower($1) and "companyId"=$2 and"default"= true`,
                values: [accountName, companyId]
            }

            let account = await client.query(query.text, query.values);
            if (account.rows && account.rows.length > 0) {
                return account.rows[0].id
            }

            return null
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async deleteAccount(accountId: string, company: Company, employeeId: string) {
        const client = await DB.excu.client()
        try {

            /**violates foreign */

            await client.query("Begin")

            let accountQuery = {
                text: `SELECT "Accounts"."name" as "accountName", "Employees"."name" as "employeeName" 
                        FROM "Accounts" 
                        INNER JOIN "Employees" on "Employees"."companyId" = $3 and "Employees".id = $2
                        WHERE "Accounts".id=$1 `,
                values: [accountId, employeeId, company.id]
            }

            let accountQueryResult = await client.query(accountQuery.text, accountQuery.values);
            let accountName = accountQueryResult.rows[0].accountName
            let employeeName = accountQueryResult.rows[0].employeeName

            const isDefault = await this.isAccountDefault(client, accountId);
            if (isDefault) {
                throw new ValidationException("Default Account Cannot be Deleted")
            }
            const query = {
                text: `DELETE FROM "Accounts" where id =$1 and "companyId" =$2`,
                values: [accountId, company.id]
            }

            await client.query(query.text, query.values)

            let log = new Log();
            log.employeeId = employeeId
            log.action = 'Chart Of Account Deleted'
            log.comment = `${employeeName} has deleted the chart of account (${accountName})`
            log.metaData = { "accountName": accountName, "deleted": true }
            await LogsManagmentRepo.manageLogs(client, "Accounts", accountId, [log], null, company.id, employeeId, "", "Cloud")




            await client.query("COMMIT")
            return new ResponseData(true, "", []);
        } catch (error: any) {
            await client.query("ROLLBACK")
            let err = error.message;
            if (err.includes('violates foreign')) {

                throw new Error("The Account Is Linked to Other transactions and Cannot be Deleted ")
            }
            throw new Error(error)
        } finally {
            client.release()
        }
    }



    // public static async isAggregatorPaymentMethod(client: PoolClient, companyId: string, aggrigatorName: string) {
    //     try {
    //         let accountName = aggrigatorName + ' Receivable'
    //         const parenType = 'Current assets'
    //         const type = 'Account Receivable';
    //         const isDefault = true;

    //         const query = {
    //             text: `SELECT id , accountId from "PaymentMethods" where name =$1 and "companyId"=$2`,
    //             values: [aggrigatorName, companyId]
    //         }

    //         let payment = await client.query(query.text, query.values)
    //         let paymentData = {
    //             paymentMethodId: "",
    //             paymentMethodAccountId: ""
    //         }
    //         if (payment.rows && payment.rows.length > 0 && payment.rows[0].id) {
    //             paymentData.paymentMethodId = payment.rows[0].id;
    //             paymentData.paymentMethodAccountId = payment.rows[0].accountId;
    //         } else {
    //             let account = new Account();
    //             account.name = accountName;
    //             account.type = type;
    //             account.parentType = parenType;
    //             account.default = true
    //             account.companyId = companyId
    //             account.id = (await AccountsRepo.addAccounts(client, account, companyId)).data.id;

    //             let paymentMethod = new PaymnetMethod();
    //             paymentMethod.name = 'Talabat Payment';
    //             paymentMethod.accountId = account.id;
    //             paymentMethod.type = 'Card'
    //             paymentMethod.rate = 1;
    //             paymentMethod.afterDecimal =0
    //             paymentMethod.pos = false 
    //             paymentMethod.updatedDate = new Date();

    //             paymentMethod.id = await PaymnetMethodRepo.addPaymentMethod()
    //         }
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }


    public static async getAccountName(accountId: string, company: Company) {
        try {
            const query = {
                text: `SELECT "name" from "Accounts" where id =$1 and "companyId"=$2`,
                values: [accountId, company.id]
            }

            let account = await DB.excu.query(query.text, query.values);

            const name = account.rows && account.rows.length > 0 ? (<any>account.rows[0]).name : null

            return new ResponseData(true, "", { name: name })
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getMinTrnsactionsDate(branchId: string) {
        try {
            const query = {
                text: `select 
                        case when "Branches"."openingBalanceDate" is null then "Companies"."createdAt" - interval '1 day' else  "Branches"."openingBalanceDate" + interval '1 day' end as "date"
                        from "Companies"
                        inner join "Branches" on "Branches"."companyId" = "Companies".id
                        where "Branches".id = $1`,
                values: [branchId]
            }
            const branch = await DB.excu.query(query.text, query.values);
            const date = branch.rows && branch.rows.length > 0 ? (<any>branch.rows[0]).date : null

            return new ResponseData(true, "", date);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async insertAccountTranslation(companyId: string) {
        try {

            let account = new Account();
            let accounts = account.accountTypes();

            for (let index = 0; index < accounts.length; index++) {
                const element = accounts[index];
                const query = {
                    text: `UPDATE "Accounts" SET "translation" = $1 WHERE "companyId" =$2 and name = $3 and "type" =$4 and "parentType"=$5 and "default" = $6`,
                    values: [element.translation, companyId, element.name, element.type, element.parentType, true]
                }
                await DB.excu.query(query.text, query.values)
            }

            return new ResponseData(true, "", [])

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getAccountIdByName(client: PoolClient, accountName: string, companyId: string) {
        try {
            const query = {
                text: `SELECT id from "Accounts" where lower(name) = lower($1) and "companyId"=$2 `,
                values: [accountName, companyId]
            }

            let account = await client.query(query.text, query.values);
            if (account.rows && account.rows.length > 0) {
                return account.rows[0].id
            }

            return null
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async exportAccounts(company: Company, type: string = 'XLSX') {
        try {
            const companyId = company.id;

            const selectQuery = ` SELECT  name, type, code, description, 
                                       "translation"->'name' ->> 'en' AS "English Name",
                                        "translation"->'name' ->> 'ar' AS "Arabic Name",
                                       "translation"->'description' ->> 'en' AS "English Description",
                                       "translation"->'description' ->> 'ar' AS "Arabic Description"
                                FROM "Accounts"
                                Where "companyId"=$1`;

            const selectList: any = await DB.excu.query(selectQuery, [companyId]);

            const header = [
                { id: 'name', title: 'Name' },
                { id: 'type', title: 'Type' },
                { id: 'code', title: 'Code' },
                { id: 'description', title: 'Description' },
                { id: 'English Name', title: 'English Name' },
                { id: 'Arabic Name', title: 'Arabic Name' },
                { id: 'English Description', title: 'English Description' },
                { id: 'Arabic Description', title: 'Arabic Description' },
            ]

            const accounts = await chartOfAccounts.getAccounts();
            let list = accounts.map(accounts => accounts.type)

            let fileName = await exportHelper.exportCsvAndXlsx2(company, type, 'Accounts', selectList.rows, [{ colKey: "type", dropdownValues: list }])
            return fileName;


        } catch (error: any) {
            console.log(error)
            throw new Error("Error exporting Accounts: " + error.message); // Include the actual error message
        }
    }

    public static async importFromCVS(data: any, company: Company, employeeId: string, pageNumber: number, count: number) {
        const client = await DB.excu.client(500)
        let redisClient = RedisClient.getRedisClient();

        try {
            let errors = [];
            await client.query("BEGIN")


            const companyId = company.id;

            let limit: any = process.env.NUMBER_OF_IMPORT_RECOREDS ?? 2000;

            for (let index = 0; index < data.length; index++) {

                let progress = Math.floor((((index + 1) + ((pageNumber - 1) * limit)) / count) * 100) + "%"
                await redisClient.set("AccountBulkImport" + company.id, JSON.stringify({ progress: progress }))

                const element: Account = data[index];

                element.companyId = companyId;
                element.id = await this.getAccountIdByName(client, element.name, companyId)

                const isAccountCodeExist = await this.isAccountCodeExist(client, companyId, element.code, element.id)
                if (isAccountCodeExist) {
                    errors.push({ AccountName: element.name, error: "Account Code Already Used" })
                    continue
                }

                let resault: any;
                //TODO check if product Exists by Name or Barcode
                element.companyId = companyId

                if (element.id != "" && element.id != null) {
                    const account = await (await this.getAccountById(element.id, companyId)).data


                    if (account.name != element.name && account.default == true) { errors.push({ AccountName: element.name, error: "Account name cannot be changed" }) }
                    else if (account.type != element.type) { errors.push({ AccountName: element.name, error: "Account type cannot be changed" }) }

                    else {

                        element.parentType = account.parentType
                        resault = await this.editAccounts(client, element, company.id, employeeId)
                    }


                } else {


                    const parentType = await chartOfAccounts.getAccountParentType(element.type)

                    if (!parentType) { errors.push({ AccountName: element.name, error: "Invalid Account Type" }) }
                    else {
                        element.parentType = parentType
                        resault = await this.addAccounts(client, element, company.id, employeeId);
                    }





                }

                if (resault && !resault.success) { errors.push(resault.data) }

            }

            await client.query("COMMIT")


            return new ResponseData(true, "", errors)

        } catch (error: any) {

            await client.query("ROLLBACK")
            return new ResponseData(false, error.message, [])

        } finally {
            client.release()
        }
    }

    public static async isAccountCodeExist(client: PoolClient, companyId: string, code: string, accountId: string | null = null) {

        try {
            // when adding new account 
            const query: { text: string, values: any } = {
                text: `SELECT count(*) as qty FROM "Accounts" where LOWER(code) = LOWER($1) and id <> $2 and "companyId" = $3 and "code" <> '' and "code" is not null  `,
                values: [code, accountId, companyId]
            };
            // when editing  existing account 
            if (accountId == null) {
                query.text = `SELECT count(*) as qty FROM "Accounts" where LOWER(code) = LOWER($1) and "companyId" = $2 and "code" <> '' and "code" is not null  `;
                query.values = [code, companyId];
            }

            const resault = await client.query(query.text, query.values);
            if ((<any>resault.rows[0]).qty > 0) {
                return true;
            }

            return false;
        } catch (error: any) {
            console.log(error)
            return false
        }
    }

    public static async isParentAccount(companyId: string, accountId: string): Promise<boolean> {

        try {
            const query: { text: string, values: any } = {
                text: `SELECT EXISTS (
                        SELECT 1 FROM "Accounts" c WHERE c."parentId" = $1 and "companyId" = $2
                        ) AS "hasChild"
                        `,
                values: [accountId, companyId]
            };

            const resault = await DB.excu.query(query.text, query.values);
            if (resault.rows && resault.rows.length > 0) {
                return (<any>resault.rows[0]).hasChild ?? false;
            }

            return false;
        } catch (error: any) {
            console.log(error)
            return false
        }
    }


    public static async getParentAccountListByType(data: any, companyId: string) {
        try {



            // let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';
            let searchValue = data.searchTerm ? data.searchTerm.toLowerCase().trim() : null;
            let offset = 0;
            let sortValue;
            let sortDirection;
            let sortTerm;

            let page = data.page ?? 1
            let sort = data.sortBy;
            sortValue = !sort ? '"Accounts"."createdAt"' : '"' + sort.sortValue + '"';

            if (data.accountId != null && data.accountId != "") {
                sortValue = ` ("Accounts".id = ` + "'" + data.accountId + "'" + ` )`
            }

            sortDirection = !sort ? "DESC " : sort.sortDirection;
            sortTerm = sortValue + " " + sortDirection;
            let orderByQuery = " ORDER BY " + sortTerm


            //calculate the offset and limit for pagenation 
            // in DataBase Offset start from 0  
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }


            const type = data.type ? data.type : ""
            if (!type) { throw new ValidationException("account type is required") }

            let parentTypes = data.parentType ? data.parentType : ['Current Assets',
                'Other Current Assets',
                'Fixed Assets',
                'Current Liabilities',
                'Long Term Liabilities',
                'Equity',
                'Operating Income',
                'Costs Of Goods Sold',
                'Operating Expense',
                'Other Current Liabilities'
            ]


            const query: { text: string, values: any } = {
                text: `select id, name, code, type, "parentType"
                        from "Accounts"
                        where "companyId" = $1 and type ilike ($2::text) and "parentId" is null
                AND ($3::text is null or (Lower(name) ~ $3 OR 
                Lower("parentType") ~ $3
                or Lower(type) ~ $3
                or lower("code") ~ $3
                ))
                ${orderByQuery}
                LIMIT $4 OFFSET $5
                `,
                values: [companyId, type, searchValue, limit, offset]
            }



            let selectList = await DB.excu.query(query.text, query.values)
            let count = selectList.rows && selectList.rows.length > 0 ? Number((<any>selectList.rows[0]).count) : 0
            let pageCount = Math.ceil(count / limit)
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
            console.log(error)

            throw new Error(error.message)

        }
    }



}