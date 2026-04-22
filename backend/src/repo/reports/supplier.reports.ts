import { TimeHelper } from "@src/utilts/timeHelper"
import { DB } from "@src/dbconnection/dbconnection"
import { ResponseData } from "@src/models/ResponseData"
import { Company } from "@src/models/admin/company"
import moment from 'moment'
import _ from "lodash"

import { ReportData } from "@src/utilts/xlsxGenerator"
import { SupplierRepo } from "../app/accounts/supplier.repo"


export class SuppliersReports {
    public static async paymentMade(data: any, company: Company, brancheList: []) {
        try {

            let filter = data.filter;
            let companyId = company.id;
            let afterDecimal = company.afterDecimal
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let supplierIds = filter && filter.supplierIds && Array.isArray(filter.supplierIds) ? filter.supplierIds : null
            let paymentMethods = filter && filter.paymentMethods ? filter.paymentMethods : [];

            let orderByQuery = filter ? filter.groupBy == 'Supplier' ? ` "BillingPayments"."supplierId",  `
                : filter.groupBy == 'Payment Method' ? `"BillingPayments"."paymentMethodId",  ` : `` : ``



            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? filter.fromDate : null;
            fromDate = moment(new Date(fromDate))
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------

            if (!Array.isArray(branches) || branches.length == 0) { branches = null };
            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);



            let offset = limit * (page - 1);

            let total = {};
            let count = 0;
            let resault: any[] = [];


            let query = {
                text: `WITH "values" AS (
                    SELECT  $1::uuid AS "companyId",
                            $2::uuid[] AS "branches",
                            $3::timestamp As "fromDate",
                            $4::timestamp AS "toDate",
                             $5::uuid[] as "supplierIds"
    
                    )	
                    ,"t1" as (select 	
                            count(*) over(),
                             sum("BillingPaymentLines".amount::text::numeric) over()::float as "totalAmount",
                            "BillingPayments"."paymentDate", 
                            "BillingPayments"."referenceNumber",
                            "BillingPayments"."supplierId",
                            "Suppliers".name as "supplierName",
                            "BillingPayments"."paymentMethodId",
                            "PaymentMethods".name  as "paymentMode",
                            "BillingPaymentLines".note, 
                            "BillingPaymentLines"."billingId", 
                            "Billings"."billingNumber",
                            "BillingPayments"."paymentMethodAccountId",
                            "Accounts".name  as "depositTo",
                            "BillingPaymentLines".amount
                    from "BillingPaymentLines"
                    join "values" on true
                    inner join "BillingPayments" ON "BillingPayments".id = "BillingPaymentLines"."billingPaymentId"
                    inner join "PaymentMethods" ON "PaymentMethods".id = "BillingPayments"."paymentMethodId"
                    inner join "Branches" ON "Branches".id = "BillingPayments"."branchId"
                    inner join "Accounts" ON "Accounts".id = "BillingPayments"."paymentMethodAccountId"
                    inner join "Billings" ON "Billings".id = "BillingPaymentLines"."billingId"
                    left join "Suppliers" ON "Suppliers".id = "BillingPayments"."supplierId"
                    WHERE "Branches"."companyId"= "values"."companyId"
                            AND  "BillingPayments"."paymentDate" >= "values"."fromDate" and  "BillingPayments"."paymentDate" < "values"."toDate" 
                            AND  ( array_length("values"."branches",1) IS NULL OR "BillingPayments"."branchId"  = any( "values"."branches"))
                            and (array_length("values"."supplierIds",1) IS null or "BillingPayments"."supplierId" = any("values"."supplierIds")  )

                    order by ${orderByQuery}"BillingPayments"."paymentDate"
                   
                   `,
                values: [companyId, branches, from, to, supplierIds]
            }

            let limitQuery = filter.export && filter.export === true ? ' ) select * from t1' : `limit ${limit}
                                                                                                offset ${offset}
                                                                                                )
                                                                                                 select * from t1`


            const records = await DB.excu.query(query.text + limitQuery, query.values);

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { amount: t.totalAmount }
                resault = records.rows.map((e: any) => {
                    return {
                        paymentDate: e.paymentDate,
                        referenceNumber: e.referenceNumber,
                        paymentMethodId: e.paymentMethodId,
                        paymentMode: e.paymentMode,
                        supplierId: e.supplierId,
                        supplierName: e.supplierName,
                        note: e.note,
                        billingId: e.billingId,
                        billingNumber: e.billingNumber,
                        paymentMethodAccountId: e.paymentMethodAccountId,
                        depositTo: e.depositTo,
                        amount: e.amount
                    }
                })

            }


            if (filter.export) {

                let report = new ReportData()
                report.filter = {
                    title: "Payment Made Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                resault.forEach(elem => { elem.paymentDate = moment.utc(elem.paymentDate).utcOffset(+timeOffset).format('YYYY-MM-DD') })
                report.records = resault
                report.columns = [{ key: 'paymentDate', properties: { columnType: 'date' } },
                { key: 'referenceNumber' },
                { key: 'supplierName' },
                { key: 'paymentMode', header: 'Payment Method' },
                { key: 'depositTo' },
                { key: 'billingNumber' },

                { key: 'amount', properties: { columnType: 'currency', hasTotal: true } }
                ]
                report.fileName = 'Payment Made Report'

                return new ResponseData(true, "", report)
            }


            if (filter && filter.groupBy == 'Supplier') {
                let groupedData = _.groupBy(resault, 'supplierId');
                resault = _.map(groupedData, (g, supplierId) => { return { supplierId, supplierName: g[0].supplierName, paymentList: g } })
            } else if (filter && filter.groupBy == 'Supplier') {
                let groupedData = _.groupBy(resault, 'Payment Method');
                resault = _.map(groupedData, (g, paymentMethodId) => { return { paymentMethodId, paymentMode: g[0].paymentMode, paymentList: g } })

            }







            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (records.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            let resData = {
                records: resault,
                count: count,
                total: total,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }






            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async supplierCreditReport(data: any, company: Company, brancheList: []) {
        const client = await DB.excu.client();
        try {

            let filter = data.filter;
            let companyId = company.id;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let supplierIds = filter && filter.supplierIds && Array.isArray(filter.supplierIds) ? filter.supplierIds : null

            let orderByQuery = filter && filter.groupBy == 'Supplier' ? ` "Billings"."supplierId", ` : ``

            //add one day
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? filter.fromDate : null;
            fromDate = moment(new Date(fromDate))
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------

            if (!Array.isArray(branches) || branches.length == 0) { branches = null };
            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);



            let offset = limit * (page - 1);

            let total = {};
            let count = 0;
            let resault: any[] = [];
            await client.query("BEGIN")


            let query = {
                text: `WITH "values" AS (
                    SELECT  $1::uuid AS "companyId",
                            $2::uuid[] AS "branches",
                            $3::timestamp As "fromDate",
                            $4::timestamp AS "toDate",
                            $5::uuid[] as "supplierIds"

    
                    )	
                    select 	count(*) over(),
                            "SupplierCredits"."id",
                            "SupplierCredits"."supplierCreditDate", 
                            "SupplierCredits"."supplierCreditNumber",
                            "SupplierCredits"."billingId",
                            "Billings"."billingNumber",
                            "Billings"."supplierId",
                            "Suppliers".name as "supplierName",
                            "SupplierCredits".total  as "supplierCreditAmount"
                    from "SupplierCredits"
                    join "values" on true
                    inner join "Branches" ON "Branches".id = "SupplierCredits"."branchId"
                    inner join "Billings" ON "Billings".id = "SupplierCredits"."billingId"
                    left join "Suppliers" ON "Suppliers".id = "Billings"."supplierId"
                     WHERE "Branches"."companyId"= "values"."companyId"
                            AND   "SupplierCredits"."supplierCreditDate" >= "values"."fromDate" and   "SupplierCredits"."supplierCreditDate" < "values"."toDate" 
                            AND  ( array_length("values"."branches",1) IS NULL OR "SupplierCredits"."branchId"  = any( "values"."branches"))
                            and (array_length("values"."supplierIds",1) IS null or "Billings"."supplierId" = any("values"."supplierIds")  )

                    order by ${orderByQuery} "SupplierCredits"."supplierCreditDate"
                
                
                   `,
                values: [companyId, branches, from, to, supplierIds]
            }

            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                             offset ${offset}
                                                                            `


            const records = await client.query(query.text + limitQuery, query.values);
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                let billingIds: any[] = []
                let crediteNoteIds: any[] = []
                resault = records.rows
                records.rows.forEach((element: any) => { billingIds.push(element.billingId); crediteNoteIds.push(element.id) });
                let balanceList = await SupplierRepo.getRefundDueList(client, crediteNoteIds, billingIds)

                resault.forEach(obj1 => {
                    const match = balanceList.find((obj2: any) => obj2.id === obj1.id);
                    obj1.balanceAmount = match ? match.supplierCredit : 0; // Merge properties from both objects
                })
            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Supplier Credits Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                resault.forEach(elem => { elem.supplierCreditDate = moment.utc(elem.supplierCreditDate).utcOffset(+timeOffset).format('YYYY-MM-DD') })
                report.records = resault
                report.columns = [{ key: 'supplierCreditDate', properties: { columnType: 'date' } },
                { key: 'supplierCreditNumber' },
                { key: 'supplierName' },
                { key: 'supplierCreditAmount', properties: { columnType: 'currency' } },
                { key: 'billingNumber' },
                { key: 'balanceAmount', properties: { columnType: 'currency' } }
                ]
                report.fileName = 'SupplierCreditsReport'
                return new ResponseData(true, "", report)
            }


            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (records.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            let resData = {
                records: resault,
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
            client.release();
        }
    }

    public static async supplierRefundReport(data: any, company: Company, brancheList: []) {

        try {

            let filter = data.filter;
            let companyId = company.id;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let supplierIds = filter && filter.supplierIds && Array.isArray(filter.supplierIds) ? filter.supplierIds : null
            let orderByQuery = filter ? filter.groupBy == 'Supplier' ? ` "Suppliers"."id" , `
                : filter.groupBy == 'Payment Method' ? `"SupplierRefundLines"."paymentMethodId",  ` : `` : ``


            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? filter.fromDate : null;
            fromDate = moment(new Date(fromDate))
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };

            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);



            let offset = limit * (page - 1);

            let total = {};
            let count = 0;
            let resault: any[] = [];


            let query = {
                text: `WITH "values" AS (
                    SELECT  $1::uuid AS "companyId",
                            $2::timestamp As "fromDate",
                            $3::timestamp AS "toDate",
                            $4::uuid[] as "supplierIds"
    
                    )	
                    select  count(*) over(),
                            sum( sum("SupplierRefundLines"."amount"::text::numeric) ) over() as "totalAmount",
                            "SupplierRefunds".id, 
                            "SupplierRefunds"."refundedDate" as "refundDate", 
                            "SupplierRefunds"."referenceNumber" as "refrenceNumber", 
                            "SupplierRefunds"."supplierCreditId", 
                            "SupplierCredits"."supplierCreditNumber",
                            "Suppliers".id as "supplierId", 
                            "Suppliers".name as "supplierName", 
                            "SupplierRefundLines"."paymentMethodId",
                            "PaymentMethods".name as mode,
                            "SupplierRefunds"."description" as "note", 
                            sum("SupplierRefundLines"."amount"::text::numeric)::float as "amount"
                    from "SupplierRefundLines"
                    join "values" on true
                    inner join "SupplierRefunds" on "SupplierRefunds".id = "SupplierRefundLines"."supplierRefundId"
                    inner join "PaymentMethods" ON "PaymentMethods".id = "SupplierRefundLines"."paymentMethodId"
                    inner join "SupplierCredits" on "SupplierCredits".id = "SupplierRefunds"."supplierCreditId"
                    inner join "Billings" on "Billings".id = "SupplierCredits"."billingId"
                    left join "Suppliers" on "Suppliers".id = "Billings"."supplierId"
                    where "SupplierRefunds"."companyId"= "values"."companyId"
                        AND   "SupplierRefunds"."refundedDate" >= "values"."fromDate" and  "SupplierRefunds"."refundedDate" < "values"."toDate" 
                        and (array_length("values"."supplierIds",1) IS null or "Billings"."supplierId" = any("values"."supplierIds")  )
                    group by "SupplierRefunds".id, "Suppliers".id, "SupplierCredits"."supplierCreditNumber",	"SupplierRefundLines"."paymentMethodId","PaymentMethods".name
                    order by ${orderByQuery}  "SupplierRefunds"."refundedDate"
                  
                
                   `,
                values: [companyId, from, to, supplierIds]
            }

            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                             offset ${offset}
                                                                            `


            const records = await DB.excu.query(query.text + limitQuery, query.values);

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { amount: Number(t.totalAmount) }
                let tt = records.rows
                resault = tt.map(({ count, totalAmount, ...rest }: any) => rest)
            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Supplier Refunds Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                resault.forEach(elem => { elem.refundDate = moment.utc(elem.refundDate).utcOffset(+timeOffset).format('YYYY-MM-DD') })
                report.records = resault
                report.columns = [{ key: 'refundDate', properties: { columnType: 'date' } },
                { key: 'referenceNumber' },
                { key: 'supplierName' },
                { key: 'mode', header: 'Payment Method' },
                { key: 'supplierCreditNumber' },
                { key: 'note' },
                { key: 'amount', properties: { columnType: 'currency', hasTotal: true } }
                ]
                report.fileName = 'SupplierRefundsReport'
                return new ResponseData(true, "", report)
            }


            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (records.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            let resData = {
                records: resault,
                count: count,
                total: total,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }




            return new ResponseData(true, "", resData)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async supplierChangePriceReport(data: any, company: Company, brancheList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;

            let supplierIds = filter && filter.supplierIds && Array.isArray(filter.supplierIds) ? filter.supplierIds : null

            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? filter.fromDate : null;
            fromDate = moment(new Date(fromDate))
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };

            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);



            let offset = limit * (page - 1);

            let count = 0;
            let resault: any[] = [];

            const query: { text: string, values: any } = {
                text: `with "values" as (
                        select $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::timestamp as "fromDate",
                            $4::timestamp as "toDate",
                           $5::uuid[] as "supplierIds"
                        ),
                        "records" as (
                        select "Billings"."supplierId","Suppliers".name as "supplierName",
                        "BillingLines"."productId",
                        "BillingLines"."unitCost"::text::numeric as "oldPrice", 
                        lead("BillingLines"."unitCost" ::text::numeric) over(PARTITION by "Billings"."supplierId","BillingLines"."productId" order by  "BillingLines"."createdAt" ) as "newPrice",
                        lead("BillingLines"."createdAt" ) over(PARTITION by "Billings"."supplierId","BillingLines"."productId" order by  "BillingLines"."createdAt" ) as "effectiveDate"
                                        from "BillingLines"
                        join "values" on true
                        inner join "Billings" ON "Billings".id = "BillingLines"."billingId"
                        inner join "Branches" ON "Branches".id = "Billings"."branchId"
                        inner join "Suppliers" ON "Suppliers".id = "Billings"."supplierId"
                        WHERE "Branches"."companyId"= "values"."companyId"
                                AND   "BillingLines"."createdAt" >= "values"."fromDate" and "BillingLines"."createdAt" < "values"."toDate" 
                                AND  ( array_length("values"."branches",1) IS NULL OR  "Branches".id  = any( "values"."branches"))
                                and (array_length("values"."supplierIds",1) IS null or "Billings"."supplierId" = any("values"."supplierIds")  )

                        order by "Billings"."supplierId","BillingLines"."productId", "BillingLines"."createdAt"
                        ) 
                        select count(*) over(), "supplierId",  "productId", "supplierName", "Products".name as "productName", "oldPrice"::float, "newPrice"::float, 
                        case when "oldPrice"!= 0 then ((("newPrice" -"oldPrice")/"oldPrice")::float)*100 end  as "priceChange", 
                        "effectiveDate"
                        from "records"

                        inner join "Products" on "Products".id = "records"."productId"
                        where "newPrice" is not null and "newPrice" !=  "oldPrice"
                        `,
                values: [companyId, branches, from, to, supplierIds]
            }


            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`


            let records = await DB.excu.query(query.text + limitQuery, query.values)
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                resault = records.rows.map(({ count, ...rest }: any) => rest)
            }

            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (records.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            let resData = {
                records: resault,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Supplier Change Price Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'supplierName' },
                { key: 'productName' },
                { key: 'oldPrice', properties: { columnType: 'currency' } },
                { key: 'newPrice', properties: { columnType: 'currency' } },
                { key: 'priceChange', properties: { columnType: 'percentage' } },
                { key: 'effectiveDate', properties: { columnType: 'date' } }
                ]
                report.fileName = 'supplierChangePriceReport'
                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }




}