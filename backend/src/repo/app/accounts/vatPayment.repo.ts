import { DB } from "@src/dbconnection/dbconnection";
import { VatPayment } from "@src/models/account/VatPayment";
import { Company } from "@src/models/admin/company";
import { ResponseData } from "@src/models/ResponseData";
import { PaymentRepo } from "@src/repo/ecommerce/pament.repo";
import { ValidationException } from "@src/utilts/Exception";
import { TimeHelper } from "@src/utilts/timeHelper";
import moment from "moment";
import { PoolClient } from "pg";
import { PaymnetMethodRepo } from "./paymentMethod.repo";
import { VatPaymentLine } from "@src/models/account/vatPaymentLine";
import { BranchesRepo } from "@src/repo/admin/branches.repo";

export class VatPaymentRepo {


    public static async getNetVat(data: any, company: Company) {
        try {

            let closingTime = "00:00:00"
            let fromDate = data.filter && data.filter.from ? data.filter.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.filter && data.filter.to ? moment(new Date(data.filter.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            console.log("hereeeeeeeeeeeeeeeeeeeeeeee", from, to)
            let vat = await this.calcualteVat(null, company.id, from, to)
            return (vat)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    private static async calcualteVat(client: PoolClient | null, copmanyId: string, from: any, to: any) {
        try {
            const query = {
                text: `with "values" as (
                            select  $1::uuid as "companyId",
                                    $2::timestamp   as "from",
                                    $3::timestamp as "to"
                            ),"taxes" as (

                            select sum(("chargesTaxDetails"->>'taxTotal')::text::numeric) as "sales",
                                0 as "purchase"
                            from "Invoices" 
                                join "values" on true 
                            inner join "Branches" on "Branches".id = "Invoices"."branchId" 
                            where "Branches"."companyId" = "values"."companyId"
                            and "Invoices"."invoiceDate" > "values"."from" and "Invoices"."invoiceDate" <= "values"."to"
                            union all 
                            select sum("InvoiceLines"."taxTotal"::text::numeric )as "sales",
                                    0 as "purchase"
                            from "Invoices" 
                                    join "values" on true 
                            inner join "InvoiceLines" on "InvoiceLines"."invoiceId" = "Invoices".id
                            inner join "Branches" on "Branches".id = "Invoices"."branchId" 
                            where "Branches"."companyId" = "values"."companyId"
                            and "InvoiceLines"."createdAt" > "values"."from" and "InvoiceLines"."createdAt" <="values"."to"
                            union all 
                            select sum(("chargesTaxDetails"->>'taxTotal')::text::numeric) *-1 as "sales",
                                0 as "purchase"

                            from "CreditNotes" 
                                    join "values" on true 
                            inner join "Branches" on "Branches".id = "CreditNotes"."branchId" 
                            where "Branches"."companyId" = "values"."companyId"
                            and "CreditNotes"."creditNoteDate" > "values"."from" and "CreditNotes"."creditNoteDate" <= "values"."to"
                            union all 
                            select sum("CreditNoteLines"."taxTotal"::text::numeric ) *-1 as "sales",
                                0 as "purchase"
                            from "CreditNotes" 
                                    join "values" on true 
                            inner join "CreditNoteLines" on "CreditNoteLines"."creditNoteId" = "CreditNotes".id
                            inner join "Branches" on "Branches".id = "CreditNotes"."branchId" 
                            where "Branches"."companyId" ="values"."companyId"
                            and "CreditNoteLines"."createdAt" > "values"."from" and "CreditNoteLines"."createdAt" <= "values"."to"
                            union all 
                            select 0 as "sales",
                                sum("BillingLines"."taxTotal"::text::numeric ) as "purchase"
                            from "Billings" 
                                    join "values" on true 
                            inner join "BillingLines" on "BillingLines"."billingId" = "Billings".id
                            inner join "Branches" on "Branches".id = "Billings"."branchId" 
                            where "Branches"."companyId" ="values"."companyId"
                            and "BillingLines"."createdAt" > "values"."from" and "BillingLines"."createdAt" <= "values"."to"

                            union all 
                            select 0 as "sales",
                                sum("SupplierCreditLines"."taxTotal"::text::numeric ) *-1 as "purchase"
                            from "SupplierCredits"
                                    join "values" on true 
                            inner join "SupplierCreditLines" on "SupplierCreditLines"."supplierCreditId" = "SupplierCredits".id
                            inner join "Branches" on "Branches".id = "SupplierCredits"."branchId" 
                            where "Branches"."companyId" = "values"."companyId"
                            and "SupplierCreditLines"."createdAt" > "values"."from" and "SupplierCreditLines"."createdAt" <= "values"."to"
                            union all 
                            select 0 as "sales",
                                sum("ExpenseLines"."taxTotal"::text::numeric )  as "purchase"
                            from "Expenses" 
                                    join "values" on true 
                            inner join "ExpenseLines" on "ExpenseLines"."expenseId" = "Expenses".id
                            inner join "Branches" on "Branches".id = "Expenses"."branchId" 
                            where "Branches"."companyId" = "values"."companyId"
                            and "ExpenseLines"."createdAt" > "values"."from" and "ExpenseLines"."createdAt" <= "values"."to"
                            )

                            select sum("sales"::text::numeric) - sum("purchase"::text::numeric) "netVat"  , sum("sales"::text::numeric) as "outPutVat",  sum("purchase"::text::numeric) as "inputVat"  from "taxes"`,
                values: [copmanyId, from, to]
            }
            let vat;
            if (client == null) {
                vat = await DB.excu.query(query.text, query.values);

            } else {
                vat = await client.query(query.text, query.values);
            }

            if (vat.rows && vat.rows.length > 0) {
                return new ResponseData(true, "", { netVat: (<any>vat.rows[0]).netVat, inputVat: (<any>vat.rows[0]).inputVat, outPutVat: (<any>vat.rows[0]).outPutVat })
            }

            return new ResponseData(true, "", { netVat: 0 })


        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async canBeEdited(client: PoolClient, id: string | null, from: Date | null, companyId: string) {
        try {

            id = id ?? null
            const query: { text: any, values: any } = {
                text: `select count("vp".id) from "VatPayments" 
                        inner join "VatPayments" "vp" on "vp"."companyId" = $1 and  "VatPayments"."from" <  "vp"."to" and "VatPayments"."id" <>  "vp"."id"
                       where "VatPayments"."companyId"= $1
                       and  "VatPayments".id = $2
                       `,
                values: [companyId, id]
            }

            if (id == null || id == "") {
                query.text = `select * from "VatPayments"
                             where "VatPayments"."companyId" = $1 
                             and "to" > $2`
                query.values = [companyId, from]
            }

            const vat = await client.query(query.text, query.values);
            if (vat.rows && vat.rows.length > 0 && (<any>vat.rows[0]).count > 0) {
                throw new ValidationException("Cannot Add / Edit Following VatPayment Due to Date Conflict")
            }

            return true
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async checkGCCAccountPayable(client: PoolClient, companyId: string) {
        try {
            const query = {
                text: `
                        with "valus" as (
                        select 'GCC Vat Payment' as "name",
                                'Account Payable'  as "type",
                                'Current Liabilities' as  "parentType",
                                true as "default",
                                $1::uuid as "companyId",
                                $2::timestamp as "createdAt"
                        ), inserted AS (
                            INSERT INTO "Accounts" ("name", "type","parentType","default","companyId","createdAt")
                            SELECT * FROM "valus"
                            WHERE NOT EXISTS (
                                SELECT 1 FROM "Accounts"  WHERE "type" = 'Account Payable' and "name" = 'GCC Vat Payment' and "companyId" =$1 and "default" = true
                            )
                            RETURNING id
                        )
                        SELECT id FROM inserted
                        UNION ALL
                        SELECT id FROM "Accounts"   WHERE "type" = 'Account Payable' and "name" = 'GCC Vat Payment' and "companyId" = $1 and "default" = true LIMIT 1;`,
                values: [companyId, new Date()]
            }

            let account = await client.query(query.text, query.values);
            return account && account.rows ? account.rows[0].id : null
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async isAllowedToAddNew(client: PoolClient, companyId: string) {
        try {
            const query = {
                text: `SELECT status FROM "VatPayments" 
                     where "companyId" = $1
                     order by "to" DESC 
                     limit 1 
                      `,
                values: [companyId]
            }

            let vat = await client.query(query.text, query.values);
            if (vat && vat.rows && vat.rows.length > 0 && vat.rows[0].status != 'Paid') {
                throw new ValidationException("VAT payment cannot be added until all previous VAT payments are marked as Paid. ")
            }

        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async saveVatpayment(data: any, company: Company, employeeId: string) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            const payment = new VatPayment();
            payment.ParseJson(data)
            payment.afterDecimal = company.afterDecimal
            payment.claculateTotal()
            payment.companyId = company.id
            if (payment.id == '' || payment.id == null) {
                payment.id = null
                payment.employeeId = employeeId
                /** check if allow to add new */
                await this.isAllowedToAddNew(client, payment.companyId)
                payment.status = 'Initiated'
            }

            if (payment.netVat < 0) {
                throw new ValidationException("Vat Total Must Be Greated Than Zero")
            }
            if (payment.branchId == "" || payment.branchId == null) {
                let mainBranch = await BranchesRepo.getMainBranch(client, company.id);
                console.log(mainBranch)
                payment.branchId = mainBranch.branch.id
            }

            await this.canBeEdited(client, payment.id, payment.from, company.id)

            let currentDate = new Date();
            let transactionToDate = new Date(payment.to);

            if ((currentDate.getDate() == transactionToDate.getDate() &&
                currentDate.getMonth() == transactionToDate.getMonth() &&
                currentDate.getFullYear() == transactionToDate.getFullYear()
            ) || (currentDate.getTime() < transactionToDate.getTime())
            ) {
                throw new ValidationException(" Please Select A Date Less than Today's Date ")
            }



            if ((!payment.id) && (payment.accountPayableId == "" || payment.accountPayableId == null)) {
                payment.accountPayableId = await this.checkGCCAccountPayable(client, company.id)
            }



            let closingTime = "00:00:00"
            let fromDate = payment && payment.from ? moment(new Date(payment.from)) : moment(new Date());
            let toDate = payment && payment.to ? moment(new Date(payment.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            let vat = await this.calcualteVat(null, company.id, from, to)
            if (!vat) {
                throw new ValidationException("VAT payment cannot be saved without any VAT transactions. Please add transactions first")
            } else {


                // payment.inputVat = vat.data.inputVat
                // payment.outputVat = vat.data.outputVat
                // payment.netVat = vat.data.netVat
            }

            let idNumber = ''
            let idString = ''
            if (payment.id) {
                idNumber = ',$12'
                idString = ',id'
            }
            const query = {
                text: `INSERT INTO "VatPayments" ("companyId","employeeId","from","to","accountPayableId","createdAt","inputVat","outputVat","status","netVat","branchId"${idString}) 
                      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11${idNumber})
                      ON CONFLICT ("id") 
                      DO UPDATE SET
                
                                    "inputVat" = EXCLUDED."inputVat",
                                    "outputVat" = EXCLUDED."outputVat",
                                    "netVat" = EXCLUDED."netVat",
                                     "branchId" = EXCLUDED."branchId"
                                    
                                    RETURNING id 
                                       `,
                values: [payment.companyId,
                payment.employeeId,
                payment.from,
                payment.to,
                payment.accountPayableId,
                payment.createdAt,
                payment.inputVat,
                payment.outputVat,
                payment.status,
                payment.netVat,
                payment.branchId]
            }
            if (payment.id) {
                query.values.push(payment.id)
            }
            let save = await client.query(query.text, query.values);
            console.log(save.rows[0].id)
            payment.id = save.rows[0].id
            await client.query("COMMIT")
            return new ResponseData(true, "", { id: payment.id, payableAccountId: payment.accountPayableId, from: from, to: to, companyId: company.id, branchId:payment.branchId  })

        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async getVatPaymentById(id: string, company: Company) {
        try {

            const query = {
                text: `select "VatPayments".id , "VatPayments"."accountPayableId","VatPayments"."branchId","VatPayments"."employeeId",cast("VatPayments"."from" as text) as "from" , cast("VatPayments"."to" as text) as "to" ,"inputVat","netVat","outputVat","status" , COALESCE(sum("VatPaymentLines"."amount"),0) "totalPaidAmount","Branches".translation as "branchTranslation", "Branches".name as "branchName" from "VatPayments"
                       left join "Branches" on "Branches".id = "VatPayments"."branchId" 
                       left join "VatPaymentLines" on "VatPaymentLines"."vatPaymentId" = "VatPayments".id
                       where "VatPayments".id = $1 and "VatPayments"."companyId" =$2
                       group by "VatPayments".id,"Branches".id  `,
                values: [id, company.id]
            }

            const vat = await DB.excu.query(query.text, query.values);
            if (vat.rows && vat.rows.length > 0) {
                return new ResponseData(true, "", vat.rows[0])
            }

            return new ResponseData(true, "", {})
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getVatPaymentList(data: any, company: Company, branchList: []) {
        try {



            let searchValue = data.searchTerm ?? null;
            let offset = 0;
            let sortTerm;
            let page = data.page ?? 1
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }
            let sort = data.sortBy;
            let sortValue = !sort ? ' "VatPayments"."from"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? " DESC " : sort.sortDirection;

            const branches = data.filter && data.filter.branches && data.filter.branches.length > 0 ? data.filter.branches : branchList;

            sortTerm = sortValue + " " + sortDirection;
            let orderByQuery = " ORDER BY " + sortTerm
            let orderByQuery2 = " ORDER BY " +( !sort ? ' "payments"."from"' : '"' + sort.sortValue + '"') + sortDirection

            const filter = data.filter
            const fromDate = filter && filter.fromDate ? filter.fromDate : null
            const toDate = filter && filter.toDate ? filter.toDate : null
            let status = filter && filter.status && filter.status.length > 0 ? filter.status : ['Initiated', 'Paid', 'Partially Paid', ' ', null]
            const query = {
                text: `with "payments" as  (select 
                    count(*) over(),
                        "VatPayments".id,
                   "VatPayments".from,
                   "VatPayments".to,
                   "VatPayments"."netVat",
                   "VatPayments"."outputVat",
                   "VatPayments"."inputVat",
                   "VatPayments"."status",
                   "Employees".name as "employeeName",
                    "Branches".name as "branchName"
                from "VatPayments" 
             
                inner  join "Employees" on "Employees".id = "VatPayments"."employeeId"
                         LEFT JOIN "Reconciliations" ON "Reconciliations".id = "VatPayments"."reconciliationId"
                         inner join "Branches" on "Branches".id = "VatPayments"."branchId"
                where  "VatPayments"."companyId" =$1
                and ($2::text is null or (
         
                lower("Employees".name) ~$2 or
                lower(  "Branches".name) ~$2 
         
                ))
                and ($3::date is null or  "VatPayments"."from" >= $3 )
                and ($4::date is null or  "VatPayments"."to" <= $4)
                and   "VatPayments"."status" = any($5)
                 AND (array_length($6::uuid[], 1) IS NULL OR ("Branches".id=any($6::uuid[])))
                ${orderByQuery}
                limit $7
                offset $8)

                select "payments".*, COALESCE(sum("VatPaymentLines"."amount"),0) as "totalPaidAmount" from "payments"
                left join "VatPaymentLines" on "VatPaymentLines"."vatPaymentId" = "payments".id
                  group by  "payments".id,
                   "payments".from,
                   "payments".to,
                   "payments"."netVat",
                   "payments"."status",
                   "payments"."employeeName",
                     "payments"."count",
                              "payments"."outputVat",
                              "payments"."branchName",
                   "payments"."inputVat"
                   ${orderByQuery2}
                `,
                values: [company.id, searchValue, fromDate, toDate, status, branches, limit, offset]
            }

            const selectList: any = await DB.excu.query(query.text, query.values)

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
            throw new Error(error)
        }
    }

    public static async getLatestVatPaymentDate(companyId: string) {
        try {
            const query = {
                text: `SELECT max("to") "date" FROM "VatPayments" where "companyId"=$1`,
                values: [companyId]
            }

            let date = await DB.excu.query(query.text, query.values);
            return date.rows && date.rows.length > 0 ? (<any>date.rows[0]).date : null
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getNewTransactionDate(companyId: string) {
        try {
            const query = {
                text: `SELECT CAST("to" + interval '1 day'  AS TEXT) as "date"  FROM "VatPayments" where "companyId"=$1
                order by "to" desc limit 1 
                `,
                values: [companyId]
            }

            let date = await DB.excu.query(query.text, query.values);
            console.log(date.rows)
            if (date && date.rows && date.rows.length > 0) {
                return new ResponseData(true, "", { date: (<any>date.rows[0]).date })
            } else {
                let newDate: any = await this.getMinimunTransactionDate(companyId);
                if (newDate)
                    return new ResponseData(true, "", { date: newDate.date })

            }
            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getMinimunTransactionDate(companyId: string) {
        try {
            const query = {
                text: `
                        with "values" as (
                            select $1::uuid as "companyId"
                            ),"taxes" as (

                            select 
                                min("Invoices"."invoiceDate") as "date"
                            from "Invoices" 
                                join "values" on true 
                            inner join "Branches" on "Branches".id = "Invoices"."branchId" 
                            where "Branches"."companyId" = "values"."companyId"
                            union all 
                            select    min("InvoiceLines"."createdAt") as "date"
                            from "Invoices" 
                                    join "values" on true 
                            inner join "InvoiceLines" on "InvoiceLines"."invoiceId" = "Invoices".id
                            inner join "Branches" on "Branches".id = "Invoices"."branchId" 
                            where "Branches"."companyId" = "values"."companyId"
                            union all 
                            select  min("CreditNotes"."creditNoteDate") as "date"
                            from "CreditNotes" 
                                    join "values" on true 
                            inner join "Branches" on "Branches".id = "CreditNotes"."branchId" 
                            where "Branches"."companyId" = "values"."companyId"
                            union all 
                            select  min("CreditNoteLines"."createdAt") as "date"
                            from "CreditNotes" 
                                    join "values" on true 
                            inner join "CreditNoteLines" on "CreditNoteLines"."creditNoteId" = "CreditNotes".id
                            inner join "Branches" on "Branches".id = "CreditNotes"."branchId" 
                            where "Branches"."companyId" ="values"."companyId"
                            union all 
                            select min("Billings"."billingDate") as "date"
                            from "Billings" 
                                    join "values" on true 
                            inner join "BillingLines" on "BillingLines"."billingId" = "Billings".id
                            inner join "Branches" on "Branches".id = "Billings"."branchId" 
                            where "Branches"."companyId" ="values"."companyId"

                            union all 
                            select min("SupplierCredits"."supplierCreditDate") as "date"
                            from "SupplierCredits"
                                    join "values" on true 
                            inner join "SupplierCreditLines" on "SupplierCreditLines"."supplierCreditId" = "SupplierCredits".id
                            inner join "Branches" on "Branches".id = "SupplierCredits"."branchId" 
                            where "Branches"."companyId" = "values"."companyId"
                            union all 
                            select min("Expenses"."expenseDate") as "date"
                            from "Expenses" 
                                    join "values" on true 
                            inner join "ExpenseLines" on "ExpenseLines"."expenseId" = "Expenses".id
                            inner join "Branches" on "Branches".id = "Expenses"."branchId" 
                            where "Branches"."companyId" = "values"."companyId"
                            )

                            select min("date")  AS "date" from "taxes"
                            `,
                values: [companyId]
            }

            let date = await DB.excu.query(query.text, query.values);
            console.log(date)
            return date.rows[0]
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getVatPaymentBranchId(client: PoolClient, id: string) {
        try {
            const query = {
                text: `SELECT "branchId" from "VatPayments" where id =$1 `,
                values: [id]
            }

            let payment = await client.query(query.text, query.values);
            return payment && payment.rows && payment.rows.length > 0 ? payment.rows[0].branchId : null
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getPaidBalance(client: PoolClient, id: string, paymentId: string | null) {
        try {
            const query = {
                text: `select "VatPayments"."id","VatPayments"."netVat", "VatPayments"."accountPayableId","VatPayments"."branchId", COALESCE(sum("VatPaymentLines"."amount"),0) as "paidAmount" from "VatPayments"
                       left join "VatPaymentLines" on "VatPaymentLines"."vatPaymentId" = "VatPayments".id and ($2::uuid is null or "VatPaymentLines".id <>$2)
                       where "VatPayments"."id" = $1
                       group by "VatPayments".id
                     `,
                values: [id, paymentId]
            }

            let payment = await client.query(query.text, query.values);
            return payment.rows[0]
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async saveVatPayment(data: any, employeeId: string, company: Company) {
        const client = await DB.excu.client()
        try {
            let payment = data
            const vatPayment = new VatPaymentLine();
            vatPayment.ParseJson(payment)
            vatPayment.afterDecimal = company.afterDecimal
            vatPayment.employeeId = employeeId

            vatPayment.calculateTotal()
            await client.query("BEGIN")
            console.log(vatPayment)

            if (vatPayment.paymentMethodId == "" || vatPayment.paymentMethodId == null) {
                throw new ValidationException("Please Select Payment Method to Pay");
            }
            if (vatPayment.id == "") { vatPayment.id = null }
            const paymentBalance = await this.getPaidBalance(client, vatPayment.vatPaymentId, vatPayment.id);
            let accountPayableId;
            if (paymentBalance != null) {
                vatPayment.branchId = paymentBalance.branchId;
                accountPayableId = paymentBalance.accountPayableId;
                console.log(paymentBalance.paidAmount, vatPayment.amount)
                console.log(paymentBalance.netVat)
                if (paymentBalance.netVat < paymentBalance.paidAmount + vatPayment.amount) {
                    throw new ValidationException("Paid Amount Exceed Vat Total Amount");
                }
            }
            vatPayment.paymentMethodAccountId = (await PaymnetMethodRepo.getPaymnetMethodaccountId(client, vatPayment.paymentMethodId, vatPayment.branchId)).id
            // vatPayment.branchId = await this.getVatPaymentBranchId(client, vatPayment.vatPaymentId);
            if (vatPayment.branchId == null) {
                throw new ValidationException("Please Select A Branch ");
            }
            let idNumber = ''
            let idString = ''
            if (payment.id) {
                idNumber = ',$9'
                idString = ',id'
            }
            const query = {
                text: `INSERT INTO "VatPaymentLines" ("paymentDate","vatPaymentId","amount","paymentMethodId","paymentMethodAccountId","employeeId","createdAt","referenceNumber"${idString}) 
                      values($1,$2,$3,$4,$5,$6,$7,$8${idNumber})
                      ON CONFLICT ("id") 
                      DO UPDATE SET
                            "amount" = EXCLUDED."amount",
                            "referenceNumber" = EXCLUDED."referenceNumber"
                      RETURNING id 
                                       `,
                values: [
                    vatPayment.paymentDate,
                    vatPayment.vatPaymentId,
                    vatPayment.amount,
                    vatPayment.paymentMethodId,
                    vatPayment.paymentMethodAccountId,
                    vatPayment.employeeId,
                    vatPayment.createdAt, vatPayment.referenceNumber]
            }
            if (vatPayment.id) {
                query.values.push(vatPayment.id)
            }
            let insert = await client.query(query.text, query.values)
            vatPayment.id = insert.rows[0].id


            await client.query("COMMIT")

            return new ResponseData(true, "", { vatPaymentId: vatPayment.vatPaymentId, amount: vatPayment.amount, paymentDate: vatPayment.paymentDate, id: vatPayment.id, companyId: company.id, branchId: vatPayment.branchId, paymentMethodAccountId: vatPayment.paymentMethodAccountId, payableAccountId: accountPayableId })
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    public static async getVatPayments(vatPaymentId: string) {
        try {
            const query = {
                text: `SELECT "VatPaymentLines" .id,
                             "VatPaymentLines" ."amount",
                             "VatPaymentLines" ."paymentDate",
                              "PaymentMethods"."name" as "paymentMethodName",
                              "Employees".name as "employeeName",
                              case when  "Reconciliations".id is not null then true else false end as "reconciled"
                            FROM "VatPaymentLines" 
                      inner join "PaymentMethods" on "PaymentMethods".id = "VatPaymentLines"."paymentMethodId"
                      inner join "Employees" on "Employees".id = "VatPaymentLines"."employeeId"
                      left join "Reconciliations" on "Reconciliations".id = "VatPaymentLines"."reconciliationId" and "Reconciliations"."status" = 'reconciled'
                      where "vatPaymentId" =$1
                      `,
                values: [vatPaymentId]
            }
            const payments = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", payments.rows)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getVatPaymentLineById(vatPaymentLineId: string) {
        try {
            const query = {
                text: `SELECT "VatPaymentLines" .*,
                              "PaymentMethods"."name" as "paymentMethodName",
                              "Employees".name as "employeeName",
                              case when  "Reconciliations".id is not null then true else false end as "reconciled",
                              "VatPayments"."netVat",
                              "VatPayments"."netVat" - COALESCE(sum( "otherPayment"."amount" )) as "amountDue"
                            FROM "VatPaymentLines" 
                      inner join "PaymentMethods" on "PaymentMethods".id = "VatPaymentLines"."paymentMethodId"
                      INNER join "VatPayments" on "VatPayments".id = "VatPaymentLines"."vatPaymentId" 
                      inner join "Employees" on "Employees".id = "VatPaymentLines"."employeeId"
                      left join "VatPaymentLines"  "otherPayment" on "otherPayment"."vatPaymentId" = "VatPayments".id
                      left join "Reconciliations" on "Reconciliations".id = "VatPaymentLines"."reconciliationId" and "Reconciliations"."status" = 'reconciled'
                      where "VatPaymentLines"."id" =$1
                      group by  "VatPaymentLines".id,
                                "PaymentMethods".id,
                                "Employees".id,
								 "Reconciliations".id ,
                                "VatPayments".id
                      `,
                values: [vatPaymentLineId]
            }
            const payments = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", payments.rows)
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getJournal(vatPaymentId: string) {
        try {
            const query = {
                text: `select 
                    case when sum("amount") > 0 then  sum("amount") end as "debit",
                    case when sum("amount") < 0 then  abs(sum("amount")) end as "credit",
                    "name",
                    "accountId",
                    "createdAt"
                    from "JournalRecords" where "referenceId" = $1
                    group by "name" ,"accountId",    "createdAt" `,
                values: [vatPaymentId]
            }

            let journal = await DB.excu.query(query.text, query.values);
            let journals = journal.rows;
            if (journals.length > 0) {
                let extraJournals;
                if (journals.filter((f: any) => f.name == 'Input Vat' || f.name == 'Output Vat').length > 0) {
                    extraJournals = journals.find((f: any) => f.name != 'Input Vat' && f.name != 'Output Vat')
                    if (extraJournals) {
                        let index = journals.indexOf(extraJournals)
                        journals.splice(index, 1)
                    }
                    extraJournals = [{ journals: [extraJournals] }]
                }


                let defaultJournals = journals


                query.text = `WITH "journal" as (
                        select          "JournalRecords"."name",
	                                     "JournalRecords"."createdAt",
	                                      sum(case when"JournalRecords". "amount" < 0 then abs("JournalRecords"."amount"::text::numeric)end) as "credit",
	                                        sum(case when"JournalRecords". "amount" > 0 then abs("JournalRecords"."amount"::text::numeric)end) as "debit"
	
	                         FROM "VatPaymentLines" 
                              inner join "JournalRecords" on "JournalRecords"."referenceId" = "VatPaymentLines".id
                              where "VatPaymentLines"."vatPaymentId"=$1
                              group by  "JournalRecords"."createdAt",  "JournalRecords"."name"
	
                                )

                                SELECT "journal"."createdAt",
                                                                    JSON_AGG(JSONB_BUILD_OBJECT('name',"name",'credit',"credit" ,'debit',"debit" )) as "journals"
                                                                    FROM "journal" 
                                                                    group by "journal"."createdAt"
                               `

                let paymentJournals = await DB.excu.query(query.text, query.values)
                let resData = {
                    extraJournals: extraJournals,
                    defaultJournals: defaultJournals,
                    paymentJournals: paymentJournals.rows
                }
                return new ResponseData(true, "", resData)
            }




            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async isAllowToDelete(client: PoolClient, id: string, companyId: string) {

        try {


            const query = {
                text: `select count("others".id) from "VatPayments"
                     inner join "VatPayments" "others" on "others"."companyId" = "VatPayments"."companyId"  and "others"."from" > "VatPayments"."to"
                      where "VatPayments".id =$1
                      `,
                values: [id]
            }
            let data = await client.query(query.text, query.values)

            if (data && data.rows && data.rows.length > 0 && data.rows[0].count > 0) {
                throw new ValidationException(" Only Last Vat Payment Is Allowed to be Deleted  ")
            }
            query.text = 'select count(*) from "VatPaymentLines" where "vatPaymentId" =$1'
            query.values = [id]
            data = await client.query(query.text, query.values)

            if (data && data.rows && data.rows.length > 0 && data.rows[0].count > 0) {
                throw new ValidationException(" Is Not Allowed To Be Deleted Due to Payments ")
            }
            return new ResponseData(true,"",[])

        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async deleteVatPaymnets(id: string, company: Company) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")

            await this.isAllowToDelete(client, id, company.id)

            await client.query('DELETE FROM "VatPayments" where id =$1', [id])

            await client.query('DELETE FROM "JournalRecords" where "referenceId" = $1', [id])

            await client.query("COMMIT")
            return new ResponseData(true,"",[])
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
}