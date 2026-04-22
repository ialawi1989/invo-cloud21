import { DB } from "@src/dbconnection/dbconnection";
import { PaymnetMethod } from "@src/models/account/PaymnetMethod"
import { ResponseData } from "@src/models/ResponseData";
import { PoolClient } from "pg";
import { AccountsRepo } from "./account.repo";


import { PaymentMethodValidation } from "@src/validationSchema/account/paymnetMethod.Schema";
import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { SocketPaymentMethod } from "@src/repo/socket/paymentMethod.socket";
import moment from "moment";
import { Account } from "@src/models/account/Account";
import { stringList } from "aws-sdk/clients/datapipeline";
export class PaymnetMethodRepo {

    public static async checkIfmethodNameExist(client: PoolClient, id: string | null, name: string, companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT count(*) as qty FROM "PaymentMethods" where lower(name) = lower($1) and id <> $2 and "companyId" = $3`,
                values: [
                    name,
                    id,
                    companyId,
                ],
            };
            if (id == null) {
                query.text = `SELECT count(*) as qty FROM "PaymentMethods" where lower(name) = lower($1) and "companyId" = $2`;
                query.values = [name, companyId];
            }

            const resault = await client.query(query.text, query.values);
            if ((<any>resault.rows[0]).qty > 0) {
                return true;
            }

            return false;
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async getPaymentLastIndex(client: PoolClient, companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `select max(index) as "maxIndex" from "PaymentMethods"
                where "companyId" =$1`,
                values: [companyId]
            }

            let payment = await client.query(query.text, query.values);
            if (payment.rows && payment.rows.length > 0) {
                return (<any>payment.rows[0]).maxIndex
            } else {
                return null
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async addPaymentMethod(client: PoolClient, data: any, companyId: string) {

        try {

            const validate = await PaymentMethodValidation.paymentMethodValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            const paymentMethod = new PaymnetMethod();
            paymentMethod.ParseJson(data)
            paymentMethod.companyId = companyId
            if (paymentMethod.type != "Card") {
                paymentMethod.bankCharge = null
            }
            const isNameExist = await this.checkIfmethodNameExist(client, null, paymentMethod.name, companyId)
            if (isNameExist) {
                throw new ValidationException("Name Already Used")
            }

            paymentMethod.updatedDate = new Date()

            paymentMethod.afterDecimal = isNaN(parseInt(paymentMethod.afterDecimal)) ? 0 : paymentMethod.afterDecimal
            let paymenIndex = await this.getPaymentLastIndex(client, companyId);
            if (paymenIndex != null) {
                paymentMethod.index = paymenIndex + 1

            } else {
                paymentMethod.index = 0;
            }
            const accounts = paymentMethod.branchesAccounts;
            if (Array.isArray(accounts)) {
                  paymentMethod.branchesAccounts = accounts.reduce((obj, { branchId, accountId }) => {
                    obj[branchId] = accountId;
                    return obj;
                }, {});
            } else {
                paymentMethod.branchesAccounts = accounts ?? null;
            }
            const query: { text: string, values: any } = {
                text: `INSERT INTO "PaymentMethods" (name,type,rate,symbol,"afterDecimal","accountId","companyId","updatedDate",index,"isEnabled","settings","bankCharge", "options","mediaId","formType","translation" ,"showInAccount","currencyCode","branchesAccounts")
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, $19) RETURNING id `,
                values: [paymentMethod.name, paymentMethod.type, paymentMethod.rate, paymentMethod.symbol, paymentMethod.afterDecimal, paymentMethod.accountId, companyId, paymentMethod.updatedDate, paymentMethod.index, paymentMethod.isEnabled, paymentMethod.settings, paymentMethod.bankCharge, paymentMethod.options, paymentMethod.mediaId, paymentMethod.formType, paymentMethod.translation, paymentMethod.showInAccount, paymentMethod.currencyCode, paymentMethod.branchesAccounts]
            }

            const insert = await client.query(query.text, query.values);
            paymentMethod.id = (<any>insert.rows[0]).id;

            const branchIds = await BranchesRepo.getCompanyBranchIds(client, companyId);
            await SocketPaymentMethod.sendNewPaymentMethod(paymentMethod, branchIds)


            return new ResponseData(true, "", { id: paymentMethod.id })
        } catch (error: any) {
            console.log(error)

          
            throw new Error(error.message)
        }
    }

    public static async checkPaymentType(id: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT type from "PaymentMethods" where id =$1`,
                values: [id]
            }

            const payment = await DB.excu.query(query.text, query.values);
            return (<any>payment.rows[0]).type
        } catch (error: any) {
          

            throw new Error(error)
        }
    }
    public static async editPaymentMethod(client: PoolClient, data: any, company: Company) {

        try {
            const companyId = company.id
            const paymentMethod = new PaymnetMethod();
            paymentMethod.ParseJson(data)

            const paymentType = await this.checkPaymentType(paymentMethod.id)
            if (paymentType == 'Default Cash') {
                throw new ValidationException("Edit on this Payment is not allowed")
            }
            const accounts = paymentMethod.branchesAccounts;
            if (Array.isArray(accounts)) {
                paymentMethod.branchesAccounts = accounts.reduce((obj, { branchId, accountId }) => {
                    obj[branchId] = accountId;
                    return obj;
                }, {});
            } else {
                paymentMethod.branchesAccounts = accounts ?? null;
            }

            const isNameExist = await this.checkIfmethodNameExist(client, paymentMethod.id, paymentMethod.name, companyId)
            if (isNameExist) {
                throw new ValidationException("Name Already Used")
            }
            paymentMethod.updatedDate = new Date()
            paymentMethod.afterDecimal = isNaN(parseInt(paymentMethod.afterDecimal)) ? 0 : paymentMethod.afterDecimal

            const query: { text: string, values: any } = {
                text: `UPDATE  "PaymentMethods" set  name=$1,
                                                type=$2,
                                                rate=$3,
                                                symbol=$4,
                                                "afterDecimal"=$5,
                                                "accountId"=$6,
                                                "updatedDate"=$7,
                                                index=$8,
                                                "isEnabled"=$9,
                                                "settings"=$10,
                                                "bankCharge"=$11,
                                                "defaultImage"=$12,
                                                "options"=$13,
                                                pos=$14,
                                                "mediaId" = $15,
                                                "translation"=$16,
                                                "showInAccount" =$17,
                                                "currencyCode"=$18,
                                                "branchesAccounts" = $19
                                                where "companyId"=$20 and id=$21 `,
                values: [paymentMethod.name,
                paymentMethod.type,
                paymentMethod.rate,
                paymentMethod.symbol,
                paymentMethod.afterDecimal,
                paymentMethod.accountId,
                paymentMethod.updatedDate,
                paymentMethod.index,
                paymentMethod.isEnabled,
                paymentMethod.settings,
                paymentMethod.bankCharge,
                paymentMethod.defaultImage,
                paymentMethod.options,
                paymentMethod.pos,
                paymentMethod.mediaId,
                paymentMethod.translation,
                paymentMethod.showInAccount,
                paymentMethod.currencyCode,
                JSON.stringify(paymentMethod.branchesAccounts),
                    companyId,
                paymentMethod.id,

                ]
            }
            await client.query(query.text, query.values);

            const branchIds = await BranchesRepo.getCompanyBranchIds(client, paymentMethod.companyId);
            await SocketPaymentMethod.sendUpdatePaymentMethod(paymentMethod, branchIds)


            return new ResponseData(true, "", [])
        } catch (error: any) {

          
            throw new Error(error.message)
        }
    }

    public static async getPaymnetMethodsList(data: any, company: Company) {

        try {
            const companyId = company.id;



            let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*';


            let sort = data.sortBy;
            let sortValue = !sort ? '"PaymentMethods"."index"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? "asc" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection;
            let orderByQuery = " Order by " + sortTerm
            let types = ["Cash", "Card", "Default Cash"];

            if (data.type && data.type == 'Card') {
                types = ["Card"];
            } else if (data.type && data.type == 'Cash') {
                types = ["Cash", "Default Cash"];
            }

            let page = data.page ?? 1
            let offset = 0;

            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            const query = {
                text: `Select count(*) over(),
                            "PaymentMethods".id,
                            "PaymentMethods".name,
                            "PaymentMethods".rate,
                            "PaymentMethods".symbol,
                            "PaymentMethods"."isEnabled",
                            "PaymentMethods"."index",
                            "PaymentMethods".type
                from "PaymentMethods"
                 Where "PaymentMethods"."companyId"=$1
                AND "PaymentMethods"."settings" is null
                AND (Lower("PaymentMethods".name) ~ $2)
                AND "PaymentMethods".type = any($3)
                ${orderByQuery}
                LIMIT $4 offset $5`,
                values: [companyId, searchValue, types, limit, offset]
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

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          
            throw new Error(error.message)
        }

    }
    public static async getPaymnetMethodById(client: PoolClient, company: Company, paymentMethodId: string, branchId: string | null) {
        try {
            // `
            //             with "branchAccounts" as(
            // select 	a.id as "accountId" , 
            // 		a.name as "accountName", 
            // b.id as "branchId", b.name as "branchName"
            // FROM "PaymentMethods", jsonb_each_text("branchesAccounts") BA
            // join "Branches" b on b.id = BA.key::uuid
            // join "Accounts" a  on a.id =BA.value::uuid
            // WHERE "PaymentMethods"."companyId" = '39fde85c-bb4e-4bb8-8444-233518650d80' and "PaymentMethods".id='bb55cc3b-5fd4-4f28-b303-ba670089d8d9'
            // )`

            const companyId = company.id
            const query: { text: string, values: any } = {
                text: ` WITH branch_accounts_data AS (
                        SELECT 
                            jsonb_agg(
                                jsonb_build_object(
                                    'accountId', a.id,
                                    'accountName', a.name,
                                    'branchId', b.id,
                                    'branchName', b.name
                                )
                            ) AS accounts
                        FROM "PaymentMethods" pm
                        JOIN jsonb_each_text(pm."branchesAccounts") AS ba(key, value)
                            ON TRUE
                        JOIN "Branches" b ON b.id = ba.key::uuid
                        JOIN "Accounts" a ON a.id = ba.value::uuid
                        WHERE pm."companyId" = $1
                        AND pm.id = $2
                    )

                    SELECT 
                        pm.id,
                        pm.name,
                        pm.type,
                        pm.rate,
                        pm.symbol,
                        pm."afterDecimal",
                        pm."companyId",
                        pm."updatedDate",
                        pm."defaultImage",
                        pm.index,
                        pm."createdAt",
                        pm."isEnabled",
                        pm.settings,
                        pm."bankCharge",
                        pm.pos,
                        pm.options,
                        pm."mediaId",
                        pm."formType",
                        pm.country,
                        pm.translation,
                        pm."showInAccount",
                        pm."currencyCode",
                        m.url AS "mediaUrl",
                        a.id AS "accountId",
                        a.name AS "accountName",
                        bad.accounts AS "branchesAccounts"
                    FROM "PaymentMethods" pm
                    LEFT JOIN "Media" m ON pm."mediaId" = m.id

                    LEFT JOIN jsonb_each_text(pm."branchesAccounts") AS ba(key, value)
                        ON ba.key::uuid = $3

                    LEFT JOIN "Accounts" a ON a.id = COALESCE(ba.value::uuid, pm."accountId")

                    LEFT JOIN branch_accounts_data bad ON TRUE  -- Always join since CTE is filtered already

                    WHERE pm."companyId" = $1
                    AND pm.id = $2

                        `,
                values: [companyId, paymentMethodId, branchId]
            }
            const paymentMethod = await client.query(query.text, query.values);
            return new ResponseData(true, "", paymentMethod.rows[0])
        } catch (error: any) {
          
            throw new Error(error.message)
        }

    }
    public static async getPaymnetMethodaccountId(client: PoolClient, paymentMethodId: string, branchId: string | null) {
        try {
            if (!branchId) { branchId = null }
            const query: { text: string, values: any } = {
                text: `select COALESCE(("branchesAccounts"->>$2)::uuid, "PaymentMethods"."accountId")  as "accountId"
                        FROM "PaymentMethods"
                        where id = $1`,
                values: [paymentMethodId, branchId]
            }

            const paymentMethod = await client.query(query.text, query.values);
            return { id: (<any>paymentMethod.rows[0]).accountId };
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async addDeafultPayments(client: PoolClient, companyId: string, afterDecimal: number) {
        try {
            const payments = new PaymnetMethod();
            const defaultPayments = payments.defaultPayments();
            const query = `INSERT INTO "PaymentMethods" (name,type,rate,"afterDecimal", "accountId", "companyId",index,"options") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) Returning id`
            for (let index = 0; index < defaultPayments.length; index++) {
                const payment = defaultPayments[index];
                const accountId = await AccountsRepo.getDefaultPaymentAccountId(client, companyId, payment.payment);
                const id = await client.query(query, [payment.payment, payment.type, payment.rate, afterDecimal, accountId, companyId, index, payment.options])

            }
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async getPaymnetMethodAccounts(company: Company) {
        try {
            const companyId = company.id
            const parentType = ["Current Assets", "Current Liabilities"]
            const types = ["Cash", "Bank"]
            const query: { text: string, values: any } = {
                text: `SELECT id, name  FROM "Accounts"
                      WHERE "companyId"= $1
                      AND "parentType"=any($2)
                      AND (type =any($3) or (("type" = 'Account Receivable' and "default" = false) or ("type" = 'Account Payable' and "default" = false))) `,
                values: [companyId, parentType, types]
            }
            const accounts = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", accounts.rows)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }


    public static async getPaymentsFlow(data: any, company: Company, branchList: []) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const branches = data && data.branchId ? [data.branchId] : branchList;
            const companyId = company.id;
            const from = data && data.interval ? data.interval.from : new Date();
            const to = data && data.interval ? data.interval.to : new Date();


            let openingBalanceQuery = ` select sum("JournalRecords".amount::text::numeric)::float as balance,
                                        "Accounts".type 
                                        from "PaymentMethods" 
                                        inner join "Accounts" on "Accounts".id = "PaymentMethods"."accountId"
                                        left join "JournalRecords" on "JournalRecords"."accountId" = "Accounts".id
										WHERE "JournalRecords"."companyId" =$1
										 and ($2::uuid[] is null or "JournalRecords"."branchId" =any($2))
								    	and	 "JournalRecords"."createdAt" < $3::date
										group by "Accounts".type`

            const opeiningBalance = await client.query(openingBalanceQuery, [companyId, branches, from]);

            const opeiningBalanceData = opeiningBalance.rows;

            let transactionsQuery = `                         select 
                                        "Accounts".type,
                                     sum( case when "JournalRecords".amount>0 then "JournalRecords".amount::text::numeric  end )::float as incoming,
                                     COALESCE (sum( case when "JournalRecords".amount<0 then "JournalRecords".amount::text::numeric  end ),0)::float as outgoing,
                                        date_trunc('month',"JournalRecords"."createdAt") "createdAt"
                                    from "PaymentMethods" 
                                    inner join "Accounts" on "Accounts".id = "PaymentMethods"."accountId"
                                    left join "JournalRecords" on "JournalRecords"."accountId" = "Accounts".id
										WHERE "JournalRecords"."companyId" =$1
										 and ($2::uuid[] is null or "JournalRecords"."branchId" =any($2))
								    	and	 "JournalRecords"."createdAt" >= $3::date
								    	and	 "JournalRecords"."createdAt" <= $4::date
										group by "Accounts".type ,date_trunc('month',"JournalRecords"."createdAt")
										`

            const transactions = await client.query(transactionsQuery, [company.id, branches, from, to])
            const transactionsData = transactions.rows;


            const cash: any = {
                opeiningBalance: 0,
                transactions: []
            }


            const bank: any = {
                opeiningBalance: 0,
                transactions: []
            }


            const cashOpeningBalance = opeiningBalanceData.find((f: any) => f.type == "Cash");
            const bankOpeningBalance = opeiningBalanceData.find((f: any) => f.type == "Bank");



            const cashTransactions = transactionsData.filter((f: any) => f.type == "Cash")
            const bankTransactions = transactionsData.filter((f: any) => f.type == "Bank")

            cash.opeiningBalance = { balance: cashOpeningBalance ? cashOpeningBalance.balance : 0 }
            cash.transactions = cashTransactions;


            bank.opeiningBalance = { balance: bankOpeningBalance ? bankOpeningBalance.balance : 0 }
            bank.transactions = bankTransactions;

            const resData = {
                cash: cash,
                bank: bank
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




    public static async getPaymentMethodSettings(client: PoolClient, companyId: string, name: string) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT settings,name,id,"accountId"  from "PaymentMethods" where name =$1 and "companyId"=$2 and( ("settings" is not null and "settings"::text <>'{}') or lower("name") = 'points' )`,
                values: [name, companyId]
            }

            const paymentMethod = await client.query(query.text, query.values);
            return new ResponseData(true, "", { paymentMethod: paymentMethod.rows[0] })
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    public static async rearrangePaymentMethod(data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            let updateDate = new Date()

            for (let index = 0; index < data.length; index++) {
                const element = data[index];
                let query = `UPDATE "PaymentMethods" set index=$1,"updatedDate"=$2 where id=$3`;
                let values = [element.index, updateDate, element.id];

                await client.query(query, values)
            }
            await client.query("COMMIT")
            return new ResponseData(true, "", [])
        } catch (error: any) {
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }


    public static async getOnlinePaymentSettings(companyId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT id, name, rate,symbol,"isEnabled" from "PaymentMethods" where "companyId" =$1 and settings is not null`,
                values: [companyId]
            }

            let paymentMethods = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", { list: paymentMethods.rows })
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async enablePaymentMethods(data: any) {
        try {
            let paymentMethodId = data.paymentMethodId;
            let isEnabled = data.isEnabled;

            const query: { text: string, values: any } = {
                text: `UPDATE "PaymentMethods" set "isEnabled"=$1 where id =$2 `,
                values: [isEnabled, paymentMethodId]
            }

            await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getMiniPaymentMethodList(data: any, companyId: string) {
        try {

            const rate = data.type == 'refund' ? 1 : null
            let isBillPayment = data.isBillPayment ? 'and ("showInAccount" = true)  ' : ''
            let branchId = data.branchId ?? null
            let paymentMethodId = data.paymentMethodId ?? null
            let orderBy = ''
            if (paymentMethodId) {
                orderBy = ` order by ("PaymentMethods".id = ` + "'" + paymentMethodId + "'" + ` ) DESC`
            }

            const query: { text: string, values: any } = {
                text: `select 
                        "PaymentMethods".id,
                        "PaymentMethods".name,
                        "PaymentMethods".rate,
                        "PaymentMethods"."bankCharge",
                        "PaymentMethods"."type",
                           "PaymentMethods"."symbol",
                           "PaymentMethods"."currencyCode",
                        "Accounts".name as "accountName"
                        from "PaymentMethods" 
                        LEFT JOIN jsonb_each_text("PaymentMethods"."branchesAccounts") ba on ba.key = $3
                        LEFT JOIN "Accounts" ON "Accounts".id = COALESCE(ba.value::uuid,"PaymentMethods"."accountId" )
                        where "PaymentMethods"."companyId" =$1
                       
                        and settings is null 
                        and "isEnabled" is true
                        ${isBillPayment}
                        and ($2::numeric is null or rate =$2::numeric)
                        ${orderBy}
                        `,
                values: [companyId, rate, branchId]
            }

            let payments = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", { list: payments.rows })
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getPaymentMethodBalance(payemntMethodId: string, branchId: string | null) {

        try {

            const query = {
                text: `  with payment as (
                        select COALESCE(ba.value::uuid,"PaymentMethods"."accountId" ) as "accountId"
                        from "PaymentMethods"
                        left join jsonb_each_text("PaymentMethods"."branchesAccounts") ba on ba.key = $2
                        where "PaymentMethods".id = $1
                        )
                        select COALESCE(sum("JournalRecords"."amount"),0) as "accountBalance" from payment 
                        inner join "JournalRecords" ON "JournalRecords"."accountId" = payment."accountId"
                    `,
                values: [payemntMethodId, branchId ?? null]
            }

            let payemntMethod = await DB.excu.query(query.text, query.values);

            if (payemntMethod.rows && payemntMethod.rows.length > 0) {
                return new ResponseData(true, "", payemntMethod.rows[0])
            } else {
                return new ResponseData(true, "", { "accountBalance": 0 });
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getBankingOverview(data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const branchId = data.branchId;
            const companyId = company.id;
            // let from = data.from
            let to: any = new Date()
            to = moment(to).add(1, 'day').format("YYYY-MM-DD 00:00:00");
            // from = await TimeHelper.resetHours(from)


            const query = {
                text: `  with company_accounts as (
                        select "accountId", "branchesAccounts"
                        from "PaymentMethods" 
                        where "companyId" = $1
                        )
                        ,payment_accounts as (
                        select "accountId" from company_accounts
                        union 
                        select ba.value::uuid as "accountId" from "company_accounts" 
                        CROSS JOIN LATERAL jsonb_each_text("company_accounts"."branchesAccounts") ba
	                     where "branchesAccounts" is not null 
                        )
                        ,"accounts" as (
                        Select distinct "accountId" as id,
                            "Accounts".name,
                            "Accounts".type 
                        from "payment_accounts"
                        inner join "Accounts" on "Accounts"."id" = "payment_accounts"."accountId" 
                        where  "Accounts"."type" not in ('Bank','Cash')
                        union all 
                        Select distinct "id" as id,
                            "Accounts".name,
                            "Accounts".type 
                        from "Accounts"
                        where "Accounts"."companyId" = $1
                        and "Accounts"."type" in ('Bank','Cash')
                        )
                            
                            select sum("JournalRecords".amount::numeric) as balance,
                                    "accounts".name,
                                    "accounts".id,
                                    "accounts".type
                            from "JournalRecords"
                            inner join "accounts" on "accounts"."id" = "JournalRecords"."accountId" 
                            where  "JournalRecords"."companyId" = $1
                            and ($3::uuid is null or "JournalRecords"."branchId" = $3::uuid)
                            and "JournalRecords"."createdAt" < $2 
                            group by   "accounts".name,
                                    "accounts".id,
                                    "accounts".type`,
                values: [companyId, to, branchId]
            }




            // let filterQuery = branchId != null && branchId != "" ? ` WHERE "JournalRecords"."branchId" =$1 or ("JournalRecords"."branchId" IS NULL AND "JournalRecords"."companyId" =$2 )` : ` WHERE "JournalRecords"."companyId" =$1`
            // let groupByQuery = '   group by "Accounts".id'

            // let values=[companyId,from,to];
            // let  opeiningBalanceFilter = filterQuery + ' and "JournalRecords"."createdAt" >= $2 and "JournalRecords"."createdAt" < $3'
            // if(branchId!=""&& branchId!=null)
            // {
            //     values = [branchId,companyId,from,to]
            //     opeiningBalanceFilter = filterQuery + ' and "JournalRecords"."createdAt" >= $3 and "JournalRecords"."createdAt" < $4'
            // }

            // let openingBalanceQuery = `select CAST(sum("JournalRecords".amount::numeric) AS REAL) as balance,
            //                                     "Accounts".name,
            //                                     "Accounts".id,
            //                                     "Accounts".type
            //                             from "PaymentMethods" 
            //                             inner join "Accounts" on "Accounts".id = "PaymentMethods"."accountId"
            //                             left join "JournalRecords" on "JournalRecords"."accountId" = "Accounts".id`;

            // openingBalanceQuery += opeiningBalanceFilter + groupByQuery;

            // const accountBalance = await client.query(openingBalanceQuery, values);
            // const balanceData = accountBalance.rows;






            // let transactionsQuery = `select 
            //                             "Accounts".type,
            //                             CAST(sum("JournalRecords".amount::numeric) AS REAL) as total,
            //                             "JournalRecords"."createdAt"
            //                         from "PaymentMethods" 
            //                         inner join "Accounts" on "Accounts".id = "PaymentMethods"."accountId"
            //                         left join "JournalRecords" on "JournalRecords"."accountId" = "Accounts".id
            //                         `;
            // groupByQuery += ` ,  "JournalRecords"."createdAt"`
            // transactionsQuery += opeiningBalanceFilter + groupByQuery

            const transactions = await client.query(query.text, query.values)
            // const transactionsData = transactions.rows;

            let resData = {
                accounts: transactions.rows,
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


    public static async createAggregatorPaymentIfNotExist(client: PoolClient, companyId: string, aggrigatorName: string) {
        try {
            let accountName = `${aggrigatorName} Payment`
            const parenType = 'Current Assets'
            const type = 'Account Receivable';



            const query = {
                text: `SELECT id , "accountId" from "PaymentMethods" where trim(lower(name)) like trim(lower($1)) and "companyId"=$2`,
                values: [accountName, companyId]
            }
            let payment = await client.query(query.text, query.values)
            let paymentData = {
                paymentMethodId: "",
                paymentMethodAccountId: ""
            }
            if (payment.rows && payment.rows.length > 0 && payment.rows[0].id) {
                paymentData.paymentMethodId = payment.rows[0].id;
                paymentData.paymentMethodAccountId = payment.rows[0].accountId;
            } else {
                let account = new Account();
                account.name = accountName;
                account.type = type;
                account.parentType = parenType;
                account.default = true
                account.companyId = companyId
                account.id = (await AccountsRepo.addAccounts(client, account, companyId)).data.id;
                paymentData.paymentMethodAccountId = account.id
                let paymentMethod = new PaymnetMethod();
                paymentMethod.name = accountName;
                paymentMethod.accountId = account.id;
                paymentMethod.type = 'Card'
                paymentMethod.rate = 1;
                paymentMethod.afterDecimal = 0
                paymentMethod.pos = false
                paymentMethod.updatedDate = new Date();

                paymentMethod.id = (await PaymnetMethodRepo.addPaymentMethod(client, paymentMethod, companyId)).data.id
                paymentData.paymentMethodId = paymentMethod.id
            }

            return paymentData
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    public static async getPaymentMethodName(paymentMethodId: string) {
        try {
            const query = {
                text: `SELECT  name FROM "PaymentMethods" where id =$1`,
                values: [paymentMethodId]
            }

            let customer = await DB.excu.query(query.text, query.values);

            return (customer && (customer).rows && customer.rows.length > 0) ? (<any>customer.rows[0]).name : null
        } catch (error: any) {
            throw new Error(error)
        }


    }


    public static async getVatPayments(vatPaymentId: string) {
        try {
            const query = {
                text: `SELECT * FROM "VatPaymentLines" 
                
                      `
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }

}