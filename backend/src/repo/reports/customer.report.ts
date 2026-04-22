import { TimeHelper } from "@src/utilts/timeHelper"
import { DB } from "@src/dbconnection/dbconnection"
import { ResponseData } from "@src/models/ResponseData"
import moment from 'moment'

import { Company } from "@src/models/admin/company";
import { ReportData } from "@src/utilts/xlsxGenerator";
import _ from "lodash";
import { CreditNoteRepo } from "../app/accounts/creditNote.Repo";
import { CustomerRepo } from "../app/accounts/customer.repo";
import { BranchesRepo } from "../admin/branches.repo";


export class CustomerReports {


    public static async getCustomerOrderHistory(data: any, companyId: string, branchList: []) {
        try {
            let filter = data.interval;

            let from: any = filter && filter.from ? moment(new Date(filter.fromDate)).startOf('day') : moment();
            let to = filter && filter.to ? moment(new Date(filter.toDate)).add(1, 'day').startOf('day') : moment();

            from = await TimeHelper.resetHours(from.toDate())
            from = moment(from)


            const branchId = data.branchId ? [data.branchId] : branchList;

            const query = {
                text: `with "values" as (
                    select 
                    $1::uuid as "companyId",
                    $2::uuid[] as "branchId",
                    $3::timeStamp as "fromDate",
                    $4::timeStamp as "toDate"
                ), "reports" as (
                SELECT  "Invoices"."invoiceDate",
                                               "Customers".name as "customerName",
                                               "Invoices".total ,
                                                "Invoices"."invoiceNumber",
                                                "Invoices".id,
                                                 "Customers".mobile as "contact"
                                FROM "Customers"
                                INNER JOIN "Invoices"ON "Invoices"."customerId" = "Customers".id
                                INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id
                                join "values" on true
                                WHERE "Branches"."companyId"="values"."companyId"
                                AND "Invoices"."status" <>'Draft'
                                and ("Branches".id = any("values"."branchId"))
                                and "Invoices"."invoiceDate" >= "values"."fromDate"  and "Invoices"."invoiceDate" <"values"."toDate" 
                )
                select * from "reports" `,
                values: [companyId, branchId, from, to]
            }


            const reports = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", reports.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    /** new Reports */

    public static async salesByCustomer(data: any, company: Company, branchList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            //-------------- filter   --------------
            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : branchList;
            let customerIds = filter && filter.customerIds && Array.isArray(filter.customerIds) ? filter.customerIds : null;


            const type = filter && filter.type ? filter.type : null
            let typefilter = ''
            if (type == 'Individual') { typefilter = `join "Customers" on i."customerId" = "Customers".id and type ='Individual' ` }
            else if (type == 'Business') { typefilter = `join "Customers" on i."customerId" = "Customers".id and type = 'Business'   ` }


            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();
            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;


            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
            }

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
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

            const query: { text: string, values: any } = {
                text: ` with "lines" as (
                        select      				     
                            il.total as "sales",
                            il."invoiceId",
                            il."branchId",
                            il."companyId"
                        from "InvoiceLines" il
                        where il."companyId" = $1
                            and  ($2::uuid[] IS NULL or  il."branchId"  =any($2::uuid[] ))
                            and (il."createdAt" >=$3 and il."createdAt" < $4)
                        ),
                        "invoiceData" as (
                        select   
                            i."customerId",
                            count(distinct "lines"."invoiceId") as "numberOfInvoices",
                            sum( "sales"::text::numeric) as "invoiceSales",
                            0  AS "numberOfCreditNotes",
                            0 AS "creditNoteSales"
                        from "lines"
                        inner join "Invoices" i on i.id = "lines"."invoiceId" and i."status" <> 'Draft'
                        ${typefilter}
                        where (array_length($5::uuid[],1) IS null or  i."customerId" = any($5::uuid[])  )
                        group by  i."customerId"
                        )
                        ,"creditNoteLines" as (	
                        select      				     
                            cl.total  as "sales",
                            cl."branchId",
                            cl."companyId",
                            cl."creditNoteId" 
                        from "CreditNoteLines" cl
                        where cl."companyId" = $1
                            and  ( $2::uuid[] IS NULL or  cl."branchId"  =any($2::uuid[]))
                            and (cl."createdAt" >=$3 and cl."createdAt" < $4)
                        ),
                        "creditNoteData" as (
                        select    
                            i."customerId",
                            0 as "numberOfInvoices",
                            0 as "invoiceSales",
                            count(distinct "creditNoteLines"."creditNoteId")  AS "numberOfCreditNotes",
                            sum("creditNoteLines"."sales"::text::numeric)  AS "creditNoteSales"
                        from "creditNoteLines"
                        inner join "CreditNotes" cn on cn.id = "creditNoteLines"."creditNoteId"
                        inner join "Invoices" i on cn."invoiceId" = i.id
                        ${typefilter}
                        where (array_length($5::uuid[],1) IS null or i."customerId" = any($5::uuid[])  )
                        group by i."customerId"
                        ),
                        T AS (          
                        select * from "invoiceData" 
                        union all 
                        select * from "creditNoteData"
                        ) 
                        select count(*) over(),
                            sum(SUM(COALESCE(T."numberOfInvoices",0)::text::numeric)) over() as "totaNumberOfInvoices",
                            sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric)) over() as "invoiceSalesTotal",
                            sum(SUM(COALESCE(T."numberOfCreditNotes",0)::text::numeric)) over() as "totalNumberOfCreditNotes",
                            sum(SUM(COALESCE(T."creditNoteSales",0)::text::numeric)) over() as "creditNoteSalesTotal",
                            sum(SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric))) over() as "salesTotal",
                            
                            "Customers".id as "customerId",
                            (case when "Customers".id is not null then COALESCE(NULLIF("Customers".name,''),'Customer') else 'Unknown' end) as "customerName",
                            SUM(COALESCE(T."numberOfInvoices",0)::text::numeric) as "numberOfInvoices",
                            SUM(COALESCE(T."invoiceSales",0)::text::numeric) as "invoiceSales",	   
                            SUM(COALESCE(T."numberOfCreditNotes",0)::text::numeric) as "numberOfCreditNotes",
                            SUM(COALESCE(T."creditNoteSales",0)::text::numeric) as "creditNoteSales",
                            SUM(COALESCE(T."invoiceSales",0)::text::numeric - (COALESCE(T."creditNoteSales",0)::text::numeric)) as "totalSales"
                            
                        from T
                        left join "Customers" on "Customers".id = T."customerId"
                        group by "Customers".id 
                        order by "Customers".id ,"customerName"
                    `,
                values: [companyId, branches, from, to, customerIds]
            }

            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`

            console.log(query.text + limitQuery, query.values)
            let records = await DB.excu.query(query.text + limitQuery, query.values)


            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { numberOfInvoices: t.totaNumberOfInvoices, invoiceSales: t.invoiceSalesTotal, numberOfCreditNotes: t.totalNumberOfCreditNotes, creditNoteSales: t.creditNoteSalesTotal, totalSales: t.salesTotal }
                resault = records.rows.map((e: any) => {
                    return {
                        customerId: e.customerId, customerName: e.customerName,
                        numberOfInvoices: e.numberOfInvoices, invoiceSales: e.invoiceSales,
                        numberOfCreditNotes: e.numberOfCreditNotes, creditNoteSales: e.creditNoteSales,
                        totalSales: e.totalSales
                    }
                })
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

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Sales By Customer",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows


                report.columns = [{ key: 'customerName' },
                { key: 'numberOfInvoices', properties: { hasTotal: true, } },
                { key: 'invoiceSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'numberOfCreditNotes', properties: { hasTotal: true } },
                { key: 'creditNoteSales', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'totalSales', properties: { hasTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'salesByCustomer'
                return new ResponseData(true, "", report)
            }


            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async salesByCustomerId(data: any, company: Company, branchList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let customerId = filter && filter.customerId ? filter.customerId : null;

            let customerName = 'WalkIn Customer'

            if (customerId) {
                customerName = await CustomerRepo.getCustomerName(customerId) ?? customerName
            }



            //if (!customerId){throw new ValidationException('customerId is required')}
            let branches = filter && filter.branches ? filter.branches : branchList;
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

            const query: { text: string, values: any } = {
                text: `with "values" as (
                    select $1::uuid as "companyId",
                           $2::uuid[] as "branches",
                           $3::timestamp as "fromDate",
                           $4::timestamp as "toDate",
                           $5::uuid as "customerId"
                    )
                    ,"invoiceData" as(
                    select  invo."customerId", 
                            invo."id" as "invoiceId",
                            invo."createdAt",
                            invo."invoiceNumber",
                            sum(case when IL."isInclusiveTax" = true then ((COALESCE(IL."subTotal",0)::text::numeric) - (COALESCE(IL."taxTotal",0)::text::numeric)) else COALESCE(IL."subTotal",0)::text::numeric end) as "invoiceSales"
                    from "InvoiceLines" as IL
                    join "values" on true
                    inner join "Invoices" as invo on invo.id = IL."invoiceId"
                    inner join "Branches" as branches on branches.id = invo."branchId"
                    where branches."companyId" = "values"."companyId"  
                    and invo."status" <> 'Draft' 
                    and (array_length("values"."branches",1) IS NULL or  branches.id = Any("values"."branches"))
                    and (IL."createdAt" >= "values"."fromDate" and IL."createdAt" < "values"."toDate"  )
                    and (invo."customerId" ="values"."customerId" or (invo."customerId" is null and "values"."customerId"  is null))
                    group by invo.id
                    )
                    select  count(*) over(), 
                            SUM(COALESCE("invoiceSales",0)::text::numeric) over() as "invoiceSalesTotal", 
                            "invoiceData".* 
                    from "invoiceData"
                    order by "createdAt"

                    limit ${limit}
                    offset ${offset}
                    `,
                values: [companyId, branches, from, to, customerId]
            }


            const records = await DB.excu.query(query.text, query.values);
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { invoiceSales: t.invoiceSalesTotal }
                resault = records.rows.map((e: any) => {
                    return {
                        customerId: e.customerId, invoiceId: e.invoiceId,
                        invoiceNumber: e.invoiceNumber, invoiceSales: e.invoiceSales
                    }
                })
            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Sales By Customer",
                    customerName: customerName,
                    filterList: { customerName: customerName },
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = resault
                report.columns = [{ key: 'invoiceNumber' },
                { key: 'invoiceSales', properties: { hasTotal: true, columnType: 'currency' } },
                ]
                report.fileName = 'SalesByCustomer'
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
          

            throw new Error(error)
        }
    }

    // public static async salesByCustomer(data: any, company: Company) {
    //     try {

    //         const companyId = company.id;
    //         const afterDecimal = company.afterDecimal;

    //         let filter = data.filter;
    //         let branches = filter && filter.branches ? filter.branches : [];
    //         let from = filter && filter.fromDate ? filter.fromDate : null;
    //         let to = filter && filter.toDate ? filter.toDate : new Date();
    //         //add one day 
    //         to =  moment(new Date(to)).add(1, 'day').format("YYYY-MM-DD 00:00:00") ;
    //         //reset hours to 00:00:00
    //         from = await TimeHelper.resetHours(from)

    //         const page = filter && filter.page ? filter.page : 1;
    //         const limit = filter && filter.limit ? filter.limit : 50;

    //         let offset = limit * (page - 1);

    //         let total ={};
    //         let count = 0 ;
    //         let resault:any[] = []; 

    //         const query: { text: string, values: any } = {
    //             text:`with "values" as (
    //                     select $1::uuid as "companyId",
    //                         $2::uuid[] as "branches",
    //                         $3::timestamp as "fromDate",
    //                         $4::timestamp as "toDate",
    //                         $5::INT as "afterDecimal"
    //                     )
    //                     SELECT 
    //                     count(*) over()::real,
    //                     sum(sum(T."invoiceCount"))  over() as "invoiceCountTotal",
    //                     sum(ROUND(sum(T."invoicesAmount"),"values"."afterDecimal"))  over() ::float as "invoicesAmountTotal",
    //                     sum(sum(T."creditNoteCount"))  over() ::real as "creditNoteCountTotal",
    //                     sum(ROUND(sum(T."creditNotesAmount"),"values"."afterDecimal"))  over()::float as "creditNotesAmountTotal",
    //                     sum(ROUND(sum(T."invoicesAmount"::text::numeric - T."creditNotesAmount"::text::numeric),"values"."afterDecimal"))  over()::real as "salesTotal",

    //                     T."customerName",
    //                     T."customerId",
    //                     sum(T."invoiceCount")  AS "invoiceCount",
    //                     CAST(sum (T."invoicesAmount") AS float) as "invoicesAmount",
    //                     sum(T."creditNoteCount")  AS "creditNoteCount",
    //                     CAST(sum (T."creditNotesAmount") AS float) as "creditNotesAmount",
    //                     sum(T."invoicesAmount"::text::numeric - T."creditNotesAmount"::text::numeric)::real as "totalSales"

    //                     FROM(SELECT	 COALESCE("Customers".name,'Others') as "customerName",
    //                                 "Customers".id as "customerId",
    //                                 count(distinct "InvoiceLines"."invoiceId") as "invoiceCount",
    //                                 sum(COALESCE("InvoiceLines"."subTotal",0)   :: text :: NUMERIC)  as "invoicesAmount",
    //                                 0  AS "creditNoteCount",
    //                                 0 AS "creditNotesAmount"
    //                         FROM "InvoiceLines"
    //                         JOIN "values" ON TRUE
    //                         INNER JOIN "Invoices" ON "InvoiceLines" ."invoiceId" = "Invoices".id
    //                         INNER JOIN "Products" ON "InvoiceLines"."productId" = "Products".id 
    //                         INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id 
    //                         INNER JOIN "Customers" ON "Invoices"."customerId" = "Customers".id
    //                         WHERE  "Branches"."companyId"= "values"."companyId"
    //                             AND( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
    //                             AND  "Invoices"."status" <>'Draft' 
    //                             AND ( "InvoiceLines"."createdAt" > "values"."fromDate" AND  "InvoiceLines"."createdAt" < "values"."toDate")
    //                         GROUP BY  "Customers".id 

    //                         union all 

    //                         SELECT  COALESCE("Customers".name,'others') "customerName",
    //                                 "Customers".id as "customerId",
    //                                 0 AS "invoiceCount",
    //                                 0 AS "invoicesAmount",
    //                                 count(distinct "CreditNoteLines"."creditNoteId") as "creditNoteCount",
    //                                 sum(COALESCE("CreditNoteLines"."subTotal",0) :: text :: NUMERIC)  as "creditNotesAmount"
    //                         FROM "CreditNoteLines"
    //                         JOIN "values" ON TRUE
    //                         INNER JOIN "CreditNotes" ON "CreditNoteLines" ."creditNoteId" = "CreditNotes".id
    //                         INNER JOIN "Invoices" ON "CreditNotes" ."invoiceId" = "Invoices".id 
    //                         INNER JOIN "Products" ON "CreditNoteLines"."productId" = "Products".id 
    //                         INNER JOIN "Branches" ON "CreditNotes"."branchId" = "Branches".id 
    //                         INNER JOIN "Customers" ON "Invoices"."customerId" = "Customers".id
    //                         WHERE  "Branches"."companyId"= "values"."companyId"
    //                                 AND( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
    //                                 AND ( "CreditNoteLines"."createdAt" > "values"."fromDate" AND  "CreditNoteLines"."createdAt" < "values"."toDate")
    //                         GROUP BY  "Customers".id

    //                     )T
    //                     JOIN "values" ON true
    //                     GROUP BY T."customerId", T."customerName", "values"."afterDecimal"
    //                     Order BY  T."customerId", T."customerName"		

    //                     limit ${limit}
    //                     offset ${offset}

    //                 `,
    //             values:[companyId,branches,from,to, afterDecimal]
    //         }


    //         const records = await DB.excu.query(query.text, query.values);

    //         if (records.rows && records.rows.length > 0 ){
    //             let t = (<any>records.rows[0])
    //             count = Number(t.count)

    //             total =  {invoiceCount:t.invoiceCountTotal, invoicesAmount: t.invoicesAmountTotal, creditNoteCount: t.creditNoteCountTotal, creditNotesAmount: t.creditNotesAmountTotal, totalSales: t.salesTotal} 
    //             resault = records.rows.map((e: any) => {return {customerName: e.customerName,  customerId: e.customerId,
    //                                                             invoiceCount: e.invoiceCount, invoicesAmount: e.invoicesAmount,
    //                                                             creditNoteCount: e.creditNoteCount, creditNotesAmount: e.creditNotesAmount, 
    //                                                             totalSales: e.totalSales }} )


    //         }

    //         let pageCount = Math.ceil(count / limit)

    //         offset += 1
    //         let lastIndex = ((page) * limit)
    //         if (records.rows.length < limit || page == pageCount) {
    //             lastIndex = count
    //         }

    //         let resData = {
    //             records: resault,
    //             count: count,
    //             total: total,
    //             pageCount: pageCount,
    //             startIndex: offset,
    //             lastIndex: lastIndex
    //         }

    //         return new ResponseData(true, "", resData)
    //     } catch (error: any) {
    //       

    //         throw new Error(error)
    //     }
    // }

    public static async customerOrderHistory(data: any, company: Company, branchList: []) {
        try {

            let filter = data.filter;
            const companyId = company.id;

            //--------------  filter  --------------
            let branches = filter && filter.branches ? filter.branches : branchList;
            let customerIds = filter && filter.customerIds && Array.isArray(filter.customerIds) ? filter.customerIds : null

            const type = filter && filter.type ? filter.type : null
            let typefilter = ''
            if (type == 'Individual') { typefilter = `and "Customers".type = 'Individual' ` }
            else if (type == 'Business') { typefilter = `and "Customers".type = 'Business'   ` }

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


            let columns = ["Name", "Total", "Invoice Number", "contact"]


             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let offset = limit * (page - 1);
            const query = {
                text: `with "values" as (
                    select 
                    $1::uuid as "companyId",
                    $2::uuid[] as "branches",
                    $3::timeStamp as "fromDate",
                    $4::timeStamp as "toDate",
                    $5::uuid[] as "customerIds"
                ), "reports" as (
                      
                SELECT         CAST (COUNT(*) OVER() AS INT) AS "count",
                              "Invoices"."invoiceDate",
                                               "Customers".name as "customerName",
                                               "Customers".id as "customerId",
                                               "Invoices".total ,
                                                "Invoices"."invoiceNumber",
                                                "Invoices".id as "invoiceId",
                                                 "Customers"."phone" as "contact"
                                FROM "Customers"
                                INNER JOIN "Invoices"ON "Invoices"."customerId" = "Customers".id
                                INNER JOIN "Branches" ON "Invoices"."branchId" = "Branches".id
                                join "values" on true
                                WHERE "Invoices"."companyId"="values"."companyId"
                                    and "Invoices"."status" <>'Draft'
                                    and ("values"."branches" is null or "Invoices"."branchId" = any("values"."branches")  )
                                    and "Invoices"."invoiceDate" >= "values"."fromDate"  and "Invoices"."invoiceDate" <"values"."toDate" 
                                    and (array_length("values"."customerIds",1) IS null or "Customers".id = any("values"."customerIds")  )
                                    ${typefilter}
                                order by  "Invoices"."invoiceDate"
                               
                )
                select * from "reports" `,
                values: [companyId, branches, from, to, customerIds]
            }

            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`

            let records = await DB.excu.query(query.text + limitQuery, query.values)
            let count = records.rows && records.rows.length > 0 ? (<any>records.rows[0]).count : 0
            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (records.rows.length < limit || page == pageCount) {
                lastIndex = count
            }
            let resData = {
                records: records.rows,
                columns: columns,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Customer Order History",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows

                report.columns = [{ key: 'customerName' },
                { key: 'contact' },
                { key: 'invoiceNumber' },
                { key: 'invoiceDate', properties: { columnType: 'date' } },
                { key: 'total', properties: { columnType: 'currency' } }
                ]
                report.fileName = 'customerOrderHistory'
                return new ResponseData(true, "", report)
            }


            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async customerBalance(data: any, company: Company, branchList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            //################ Filter ################

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : branchList;
            let customerIds = filter && filter.customerIds && Array.isArray(filter.customerIds) ? filter.customerIds : null

            const type = filter && filter.type ? filter.type : null
            let typefilter = ''
            if (type == 'Individual') { typefilter = `and "Customers".type ='Individual' ` }
            else if (type == 'Business') { typefilter = `and "Customers".type = 'Business'   ` }

            //################ set time ################
            let closingTime = "00:00:00"

            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment(new Date());
            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(null, toDate, closingTime, false, timeOffset)

            let to = interval.to

            //################ pagination ################
            if (!Array.isArray(branches) || branches.length == 0) { branches = null };

             const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let total = {};
            let count = 0;
            let resault: any[] = [];
            let offset = limit * (page - 1);

            //################   sort    ################
            let sortby = filter && filter.sortBy ? filter.sortBy : [];
            let sortList = sortby.filter((item: any) => item.sortValue && item.sortValue.trim() !== "");

            // if (sortList.length < 1) { sortList.push({ sortValue: "productName", sortDirection: 'asc' }) }

            let orderByQuery = "order by ";
            for (let i = 0; i < sortList.length; i++) {
                orderByQuery += `"${sortList[i].sortValue.trim()}" ${sortList[i].sortDirection ?? ""}`;
                orderByQuery += ", ";
            }
            orderByQuery += ` id `
            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`
            //######################################################


            const countQuery = {
                text: `with "values" as(
                    select  $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::timestamp as "toDate",
                             $4::uuid[] as "customerIds"
                    ) `,
                values: [companyId, branches, to, customerIds]
            }

            let lastIndex = ((page) * limit);
            let pageCount = Math.ceil(count / limit);
            if (limit != 0) {
                const countTemp = `${countQuery.text}
                select  count(*)
					 from "Customers"
                     join  "values" on true
                     where "Customers"."companyId" = "values"."companyId"
                     ${typefilter}
                     and (array_length("values"."customerIds",1) IS null or "Customers".id = any("values"."customerIds")  ) `

                let countData = await DB.excu.query(countTemp, countQuery.values)
                count = +Number((<any>countData.rows[0]).count)
                pageCount = Math.ceil(count / limit);
                offset += 1

                if (countData.rows.length < limit || page == pageCount) {
                    lastIndex = count
                }

            }
            const query: { text: string, values: any } = {
                text: `${countQuery.text},"customer"  as (
                        select  "Customers".id, "Customers".name , "Customers"."createdAt"  as "customerCreatedAt", "Customers"."companyId" 
                        from "Customers"
                        join  "values" on true
                        where "Customers"."companyId" = "values"."companyId"
                            and (array_length("values"."customerIds",1) IS null or "Customers".id = any("values"."customerIds")  )
                            ${typefilter}
                        order by  "customerCreatedAt"  desc
                        ${limitQuery}
                        )
                        , "openingBalance" as (
				   select "customer".id,
                            COALESCE( sum("CustomerOpeningBalance"."openingBalance"),0) as "amount" 
		
                        from "customer"
                        join "values" on true
						join "Companies" on "Companies".id = "customer"."companyId"
                        join "CustomerOpeningBalance" on "customer".id = "CustomerOpeningBalance"."customerId"  
					  	join "Branches" on "Branches"."id" = "CustomerOpeningBalance"."branchId"
                        where  (("Branches"."openingBalanceDate"  <= "values"."toDate") or( "Companies"."createdAt" - interval '1 day'  <= "values"."toDate" ))
                            
					     and (array_length("values"."branches",1) IS NULL or  "Branches"."id" = Any("values"."branches"))
                        group by "customer".id
					  
				   )
				     , "paidOpeningBalance" as (
				   select "customer".id,
                              COALESCE(sum("InvoicePaymentLines"."amount"::text::numeric),0) as "amount"
                        from "customer"
                        join "values" on true
                        inner join "InvoicePayments" on "InvoicePayments"."customerId" = "customer".id
						inner join "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId"  = "InvoicePayments".id
						join "Branches" on "Branches"."id" = "InvoicePayments"."branchId"
                         where (array_length("values"."branches",1) IS NULL or  "Branches"."id" = Any("values"."branches"))
                             and "openingBalanceId" is not null 
							and  "InvoicePaymentLines"."createdAt" <= "values"."toDate"
                        group by "customer".id
						 ),"openingBalanceTotal" as ( select"customer".id as "customerId",
                               COALESCE( "openingBalance"."amount" ::text::numeric,0) -    COALESCE("paidOpeningBalance"."amount",0 ) as "openingBalance"
                        from "customer"
                        join "values" on true
						left join "openingBalance" on "customer".id = "openingBalance".id
						left join "paidOpeningBalance" on "customer".id = "paidOpeningBalance".id
							order by  "customerCreatedAt"  desc
						
                        )
						
					

                    , "invoiceLines" as (
                    select "invoiceId", "customerId",
                           sum("InvoiceLines"."total"::text::numeric) as total
                    from "InvoiceLines"
                    join "values" on true
                    inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" and "customerId" is not null
					inner join "customer" on "customer".id = "Invoices"."customerId"
                    inner join "Branches" on "Invoices"."branchId" = "Branches".id
                    where "InvoiceLines"."companyId" = "values"."companyId"  
                           and (array_length("values"."branches",1) IS NULL or  "InvoiceLines"."branchId" = Any("values"."branches"))
                           and ("Invoices"."status" <> 'Draft') and ("InvoiceLines"."createdAt" <= "values"."toDate")
                    group by "invoiceId", "customerId"
                    )
                    ,"invoiceCharges" as (
                    select "Invoices".id as "invoiceId", "customerId",
                           COALESCE("Invoices"."chargeTotal",0)::text::numeric + COALESCE("Invoices"."deliveryCharge",0)::text::numeric as total
                    from "Invoices"
                    join "values" on true
                    inner join "Branches" on "Invoices"."branchId" = "Branches".id
					inner join "customer" on "customer".id = "Invoices"."customerId"
                    where "Invoices"."companyId" = "values"."companyId"  
                           and (array_length("values"."branches",1) IS NULL or  "Invoices"."branchId" = Any("values"."branches"))
                           and ("Invoices"."status" <> 'Draft') and ("customerId" is not null) and ("Invoices"."createdAt" <= "values"."toDate")
                    )
                    ,"invoiceTotal" as (
                    select "invoiceCharges"."customerId", "invoiceCharges"."invoiceId",
                            "invoiceCharges".total + COALESCE("invoiceLines"."total",0) as total
                    from "invoiceCharges"
                    left join "invoiceLines" on "invoiceCharges"."invoiceId" = "invoiceLines"."invoiceId"
                    )
					
				
                    , "creditLines" as (
                    select "invoiceId", "customerId",
                           sum("CreditNoteLines"."total"::text::numeric) as total
                    from "CreditNoteLines"
                    join "values" on true
                    inner join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId" 
                    inner join "Invoices" on "Invoices".id = "invoiceId" 
                    inner join "Branches" on "CreditNotes"."branchId" = "Branches".id
					inner join "customer" on "customer".id = "Invoices"."customerId"
                    where "CreditNoteLines"."companyId" = "values"."companyId"  
                           and (array_length("values"."branches",1) IS NULL or  "CreditNoteLines"."branchId" = Any("values"."branches"))
                           and ("CreditNoteLines"."createdAt" <= "values"."toDate")
                    group by "invoiceId", "customerId"
                    )
                    ,"creditCharges" as (
                    select "invoiceId", "customerId",
                           COALESCE("CreditNotes"."chargeTotal",0)::text::numeric + COALESCE("CreditNotes"."deliveryCharge",0)::text::numeric as total
                    from "CreditNotes"
                    join "values" on true
                    inner join "Invoices" on "Invoices".id = "invoiceId" 
                    inner join "Branches" on "CreditNotes"."branchId" = "Branches".id
					inner join "customer" on "customer".id = "Invoices"."customerId"
                    where "Branches"."companyId" = "values"."companyId"  
                           and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                           and ("CreditNotes"."createdAt" <= "values"."toDate")
                    )
                    ,"creditTotal" as (
                    select "creditCharges"."customerId","creditCharges"."invoiceId",
                            "creditCharges".total + COALESCE("creditLines"."total",0) as total
                    from "creditCharges"
                    left join "creditLines" on "creditCharges"."invoiceId" = "creditLines"."invoiceId"
                    )
                    ,"paymentTotal" as (
                    select "invoiceId" , "Invoices"."customerId", sum("InvoicePaymentLines".amount::text::numeric) as total
                    from "InvoicePaymentLines" 
                    join "values" on true
                    inner join "InvoicePayments" on "InvoicePayments".id = "invoicePaymentId"
                    inner join "Invoices" on "Invoices".id = "InvoicePaymentLines"."invoiceId" 
					inner join "customer" on "customer".id = "Invoices"."customerId"
                    inner join "Branches" on "InvoicePayments"."branchId" = "Branches".id
                    where "Branches"."companyId" = "values"."companyId"  
                           and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                           and ("InvoicePaymentLines"."createdAt" <= "values"."toDate")
                    group by "Invoices"."customerId", "invoiceId"	
                    ) 
                    ,"appliedCredit" as (
                    select "invoiceId" , "Invoices"."customerId", sum("AppliedCredits".amount::text::numeric) as total 
                    from "AppliedCredits" 
                    join "values" on true
                    inner join "Invoices" on "AppliedCredits"."invoiceId" = "Invoices"."id"
					inner join "customer" on "customer".id = "Invoices"."customerId"
                    inner join "Branches" on "Invoices"."branchId" = "Branches".id
                    where "Branches"."companyId" = "values"."companyId"  
                           and (array_length("values"."branches",1) IS NULL or  "Branches".id = Any("values"."branches"))
                           and ("AppliedCredits"."appliedCreditDate" <= "values"."toDate")
                    group by "Invoices"."customerId", "invoiceId"	
                    )
                    ,"Total" as (
                    select "invoiceTotal"."customerId", "invoiceTotal"."invoiceId",
                        (COALESCE("invoiceTotal".total,0) - COALESCE("paymentTotal".total,0) - ( COALESCE("creditTotal".total,0) + COALESCE("appliedCredit".total,0))) as total
                    from "invoiceTotal" 
                    left join "paymentTotal" on "invoiceTotal"."customerId" = "paymentTotal"."customerId" and  "invoiceTotal"."invoiceId" = "paymentTotal"."invoiceId"
                    left join "creditTotal"  on "invoiceTotal"."customerId" = "creditTotal"."customerId" and  "invoiceTotal"."invoiceId" = "creditTotal"."invoiceId"
                    left join "appliedCredit"  on "invoiceTotal"."customerId" = "appliedCredit"."customerId" and  "invoiceTotal"."invoiceId" = "appliedCredit"."invoiceId"
                    )
				
                    ,"refunds" as (
                    select "Invoices"."customerId",
                            sum(COALESCE("CreditNoteRefunds".total,0)::text::numeric) as total
                    from "CreditNoteRefunds"
                    inner join "CreditNotes" on "CreditNoteRefunds"."creditNoteId" = "CreditNotes".id
                    inner join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId" 
					inner join "customer" on "customer".id = "Invoices"."customerId"
                    group by  "Invoices"."customerId"
                    )
                    ,"unearendRevenue" as (
                    select 
                        "InvoicePayments"."customerId",
                        "InvoicePayments"."tenderAmount" - sum(COALESCE("InvoicePaymentLines".amount,0))as total
                        from "InvoicePayments"
                    inner join "customer" on "customer".id = "InvoicePayments"."customerId" 
                    left join "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id 
                    group by "InvoicePayments".id 
                    having "InvoicePayments"."tenderAmount" - sum(COALESCE("InvoicePaymentLines".amount,0))>0
                    )
                    ,"totalRevenue" as (
                        select 
                        "customerId",
                        sum(COALESCE(total,0))as total
                        from "unearendRevenue"
                        group by "customerId"
                    ) 
                    ,"tt" as(	select "customerId", sum(case when "Total"."total" > 0 then "Total"."total"  end) as t1 , 
					abs(sum(case when "Total"."total" < 0 then "Total"."total"  end)) as t2
					from "Total"
					group by "customerId"
					  )
	
                    ,"invoiceBalanceAndCredits" as (
                    select "customer".id, "customer".name,
                            COALESCE(tt.t1,0) + COALESCE("openingBalance" ,0) as "invoiceBalance",
                            COALESCE(tt.t2,0) - COALESCE("refunds"."total" ,0) + COALESCE("totalRevenue"."total" ,0)  as "availableCredits"
                    from "customer"
					left join "openingBalanceTotal" on "customer".id ="openingBalanceTotal"."customerId"
                    left join "tt" on "customer".id = "tt"."customerId"
                    left join "refunds" on "customer".id = "refunds"."customerId"
                    left join "totalRevenue" on "customer".id ="totalRevenue"."customerId" 
           
                    )
                    select  * , COALESCE("invoiceBalance" ,0) - COALESCE("availableCredits" ,0) as "balance"
                    from "invoiceBalanceAndCredits"
                    
                    `,
                values: [companyId, branches, to, customerIds]
            }




            let records = await DB.excu.query(query.text, query.values)

            if (records.rows && records.rows.length > 0) {

                resault = records.rows
                // total =  {numberOfInvoices: t.totaNumberOfInvoices, invoiceSales: t.invoiceSalesTotal, numberOfCreditNotes: t.totalNumberOfCreditNotes, creditNoteSales: t.creditNoteSalesTotal, totalSales : t.salesTotal} 
                // resault = records.rows.map((e: any) => {return {customerId : e.customerId, customerName:e.customerName ,
                //                                                 numberOfInvoices: t.numberOfInvoices,  invoiceSales: e.invoiceSales,
                //                                                 numberOfCreditNotes: e. numberOfCreditNotes, creditNoteSales: e.creditNoteSales, 
                //                                                 totalSales: e.totalSales }} )
            }

            // let pageCount = Math.ceil(count / limit)

            // offset += 1
            // let lastIndex = ((page) * limit)
            // if (records.rows.length < limit || page == pageCount) {
            //     lastIndex = count
            // }

            let resData = {
                records: resault,
                count: count,
                //total: total,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Customer Balance Summary",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'name', header: 'Customer Name ' },
                { key: 'invoiceBalance', properties: { columnType: 'currency' } },
                { key: 'availableCredits', properties: { columnType: 'currency' } },
                { key: 'balance', properties: { columnType: 'currency' } }
                ]
                report.fileName = 'customerBalanceSummary'
                return new ResponseData(true, "", report)
            }



            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }



    public static async paymentReceived(data: any, company: Company, brancheList: []) {
        try {


            let companyId = company.id;

            //--------------  filter  --------------
            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let customerIds = filter && filter.customerIds && Array.isArray(filter.customerIds) ? filter.customerIds : null;
            let paymentMethods = filter && filter.paymentMethods ? filter.paymentMethods : [];

            const type = filter && filter.type ? filter.type : null
            let typefilter = ' LEFT JOIN "Customers" on "Customers".id =  "InvoicePayments"."customerId" '
            if (type == 'Individual') { typefilter = ` JOIN "Customers" on "Customers".id =  "InvoicePayments"."customerId"  and "Customers".type = 'Individual' ` }
            else if (type == 'Business') { typefilter = ` JOIN "Customers" on "Customers".id =  "InvoicePayments"."customerId"  and "Customers".type = 'Business'   ` }


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

            let orderByQuery = filter ? filter.groupBy == 'Customer' ? ` "InvoicePayments"."customerId" , `
                : filter.groupBy == 'Payment Method' ? `"InvoicePayments"."paymentMethodId",  ` : `` : ``






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
                            $5::uuid[] as "customerIds"
	
                    )	
                    ,"t1" as (select 	
                            count(*) over(),
                             sum("InvoicePaymentLines".amount::text::numeric) over()::float as "totalAmount",
                            "InvoicePayments"."paymentDate", 
                            "InvoicePayments"."referenceNumber",
                            "InvoicePayments"."customerId",
                            COALESCE("Customers".name,'WalkIn Customer') as "customerName",
                            "InvoicePayments"."paymentMethodId",
                            "PaymentMethods".name  as "paymentMode",
                            "InvoicePaymentLines".note, 
                            "InvoicePaymentLines"."invoiceId", 
                            "Invoices"."invoiceNumber",
                            "InvoicePayments"."paymentMethodAccountId",
                            "Accounts".name  as "depositTo",
                            "InvoicePaymentLines".amount
                    from "InvoicePaymentLines"
                    join "values" on true
                    inner join "InvoicePayments" ON "InvoicePayments".id = "InvoicePaymentLines"."invoicePaymentId"
                    inner join "PaymentMethods" ON "PaymentMethods".id = "InvoicePayments"."paymentMethodId"
                    inner join "Branches" ON "Branches".id = "InvoicePayments"."branchId"
                    inner join "Accounts" ON "Accounts".id = "InvoicePayments"."paymentMethodAccountId"
                    inner join "Invoices" ON "Invoices".id = "InvoicePaymentLines"."invoiceId"
                    ${typefilter}
                    WHERE "Branches"."companyId"= "values"."companyId"
                            AND  "InvoicePayments"."paymentDate" >= "values"."fromDate" and  "InvoicePayments"."paymentDate" < "values"."toDate" 
							AND  ( array_length("values"."branches",1) IS NULL OR "InvoicePayments"."branchId"  = any( "values"."branches"))
                            and (array_length("values"."customerIds",1) IS null or "InvoicePayments"."customerId" = any("values"."customerIds")  )
                            
                    order by ${orderByQuery} "InvoicePayments"."paymentDate" 
                   
                   `,
                values: [companyId, branches, from, to, customerIds]
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
                        customerId: e.customerId,
                        customerName: e.customerName,
                        note: e.note,
                        invoiceId: e.invoiceId,
                        invoiceNumber: e.invoiceNumber,
                        paymentMethodAccountId: e.paymentMethodAccountId,
                        depositTo: e.depositTo,
                        amount: e.amount
                    }
                })

            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Payment Received Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                resault.forEach(elem => { elem.paymentDate = moment.utc(elem.paymentDate).utcOffset(+timeOffset).format('YYYY-MM-DD') })
                report.records = resault
                report.columns = [{ key: 'paymentDate', properties: { columnType: 'date' } },
                { key: 'referenceNumber' },
                { key: 'customerName', header: "customer Name" },
                { key: 'paymentMode', header: 'Payment Method' },
                { key: 'depositTo' },
                { key: 'invoiceNumber' },
                { key: 'note' },
                { key: 'amount', properties: { columnType: 'currency', hasTotal: true } }
                ]
                report.fileName = 'PaymentReceivedReport'
                return new ResponseData(true, "", report)
            }


            if (filter && filter.groupBy == 'Customer') {
                let groupedData = _.groupBy(resault, 'customerId');
                resault = _.map(groupedData, (g, customerId) => { return { customerId, customerName: g[0].customerName, paymentList: g } })
            } else if (filter && filter.groupBy == 'Payment Method') {
                let groupedData = _.groupBy(resault, 'paymentMethodId');
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


    public static async creditNoteReport(data: any, company: Company, brancheList: []) {

        try {
            let companyId = company.id;

            //-------------- filter  --------------
            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let customerIds = filter && filter.customerIds && Array.isArray(filter.customerIds) ? filter.customerIds : null
            const type = filter && filter.type ? filter.type : null
            let typefilter = ' LEFT JOIN "Customers" on "Customers".id =  "Invoices"."customerId" '
            if (type == 'Individual') { typefilter = ` JOIN "Customers" on "Customers".id =  "Invoices"."customerId"  and "Customers".type = 'Individual' ` }
            else if (type == 'Business') { typefilter = ` JOIN "Customers" on "Customers".id =  "Invoices"."customerId"  and "Customers".type = 'Business'   ` }


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

            let orderByQuery = filter && filter.groupBy == 'Customer' ? ` "Invoices"."customerId" , ` : ``



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
                            $5::uuid[] as "customerIds"
    
                    )	
                    select 	count(*) over(),
                            "CreditNotes"."id",
                            "CreditNotes"."creditNoteDate", 
                            "CreditNotes"."creditNoteNumber",
                            "CreditNotes"."invoiceId",
                            "Invoices"."invoiceNumber",
                            "Invoices"."customerId",
                               COALESCE("Customers".name,'WalkIn Customer') as "customerName",
                            "CreditNotes".total  as "creditNoteAmount"
                    from "CreditNotes"
                    join "values" on true
                    inner join "Branches" ON "Branches".id = "CreditNotes"."branchId"
                    inner join "Invoices" ON "Invoices".id = "CreditNotes"."invoiceId"
                    ${typefilter}
                     WHERE "Branches"."companyId"= "values"."companyId"
                            AND   "CreditNotes"."creditNoteDate" >= "values"."fromDate" and   "CreditNotes"."creditNoteDate" < "values"."toDate" 
                            AND  ( array_length("values"."branches",1) IS NULL OR "CreditNotes"."branchId"  = any( "values"."branches"))
                            and (array_length("values"."customerIds",1) IS null or "Invoices"."customerId" = any("values"."customerIds")  )
                    order by ${orderByQuery} "CreditNotes"."creditNoteDate"
                    
                
                   `,
                values: [companyId, branches, from, to, customerIds]
            }
            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                             offset ${offset}
                                                                            `


            const records = await DB.excu.query(query.text + limitQuery, query.values);
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                let invoiceIds: any[] = []
                let crediteNoteIds: any[] = []
                resault = records.rows
                records.rows.forEach((element: any) => { invoiceIds.push(element.invoiceId); crediteNoteIds.push(element.id) });
                let balanceList = await CreditNoteRepo.getRefundDueList(null, crediteNoteIds, invoiceIds)

                resault.forEach(obj1 => {

                    const match = balanceList.find(obj2 => obj2.id === obj1.id);
                    obj1.balanceAmount = match ? match.customerCredit : 0; // Merge properties from both objects
                })
            }
            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Credit Notes Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                resault.forEach(elem => { elem.creditNoteDate = moment.utc(elem.creditNoteDate).utcOffset(+timeOffset).format('YYYY-MM-DD') })
                report.records = resault
                report.columns = [{ key: 'creditNoteDate', properties: { columnType: 'date' } },
                { key: 'creditNoteNumber' },
                { key: 'customerName' },
                { key: 'creditNoteAmount', properties: { columnType: 'currency' } },
                { key: 'invoiceNumber' },
                { key: 'balanceAmount', properties: { columnType: 'currency' } }
                ]
                report.fileName = 'CreditNotesReport'
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




            return new ResponseData(true, "", resData)
        } catch (error: any) {

          

            throw new Error(error.message)
        }
    }

    public static async refundReport(data: any, company: Company, brancheList: []) {

        try {

            let companyId = company.id;

            //-------------- set time --------------
            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let customerIds = filter && filter.customerIds && Array.isArray(filter.customerIds) ? filter.customerIds : null

            let orderByQuery = filter ? filter.groupBy == 'Customer' ? ` "Customers"."id" , `
                : filter.groupBy == 'Payment Method' ? `"CreditNoteRefundLines"."paymentMethodId",  ` : `` : ``

            const type = filter && filter.type ? filter.type : null
            let typefilter = ' LEFT JOIN "Customers" on "Customers".id =  "Invoices"."customerId" '
            if (type == 'Individual') { typefilter = ` JOIN "Customers" on "Customers".id =  "Invoices"."customerId"  and "Customers".type = 'Individual' ` }
            else if (type == 'Business') { typefilter = ` JOIN "Customers" on "Customers".id =  "Invoices"."customerId"  and "Customers".type = 'Business'   ` }

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
                            $5::uuid[] as "customerIds"
    
                    )	
                    select  count(*) over(),
                            sum( sum("CreditNoteRefundLines"."amount"::text::numeric) ) over() as "totalAmount",
                            "CreditNoteRefunds".id, 
                            "CreditNoteRefunds"."refundDate", 
                            "CreditNoteRefunds"."refrenceNumber", 
                            "CreditNoteRefunds"."creditNoteId", 
                            "CreditNotes"."creditNoteNumber",
                            "Customers".id as "customerId", 
                                    COALESCE("Customers".name,'WalkIn Customer')  as "customerName", 
                            "CreditNoteRefundLines"."paymentMethodId",
                            "PaymentMethods".name as mode,
                            "CreditNoteRefunds"."description" as "note", 
                            sum("CreditNoteRefundLines"."amount"::text::numeric)::float as "amount"
                    from "CreditNoteRefundLines"
                    join "values" on true
                    inner join "CreditNoteRefunds" on "CreditNoteRefunds".id = "CreditNoteRefundLines"."creditNoteRefundId"
                    inner join "PaymentMethods" ON "PaymentMethods".id = "CreditNoteRefundLines"."paymentMethodId"
                    inner join "CreditNotes" on "CreditNotes".id = "CreditNoteRefunds"."creditNoteId"
                    inner join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId"
                    inner join "Branches" on "Branches".id = "CreditNoteRefunds"."branchId"
                    ${typefilter}
                    where "Branches"."companyId"= "values"."companyId"
                        AND   "CreditNoteRefunds"."refundDate" >= "values"."fromDate" and  "CreditNoteRefunds"."refundDate" < "values"."toDate" 
                        AND  ( array_length("values"."branches",1) IS NULL OR "Branches".id  = any( "values"."branches"))
                        and (array_length("values"."customerIds",1) IS null or "Invoices"."customerId" = any("values"."customerIds")  )
                    group by "CreditNoteRefunds".id, "Customers".id, "CreditNotes"."creditNoteNumber",	"CreditNoteRefundLines"."paymentMethodId","PaymentMethods".name
                    order by ${orderByQuery}  "CreditNoteRefunds"."refundDate"
                
                   `,
                values: [companyId, branches, from, to, customerIds]
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
                    title: "Refunds Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                resault.forEach(elem => { elem.refundDate = moment.utc(elem.refundDate).utcOffset(+timeOffset).format('YYYY-MM-DD') })
                report.records = resault
                report.columns = [{ key: 'refundDate', properties: { columnType: 'date' } },
                { key: 'referenceNumber' },
                { key: 'customerName' },
                { key: 'mode', header: 'Payment Method' },
                { key: 'creditNoteNumber' },
                { key: 'note' },
                { key: 'amount', properties: { columnType: 'currency', hasTotal: true } }
                ]
                report.fileName = 'RefundsReport'
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

    public static async clientWiseItemSalesReport(data: any, company: Company, brancheList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;


            //--------------  filter  --------------
            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;

            let productIds = filter && filter.productIds && Array.isArray(filter.productIds) ? filter.productIds : null
            let customerIds = filter && filter.customerIds && Array.isArray(filter.customerIds) ? filter.customerIds : null

            const type = filter && filter.type ? filter.type : null
            let typefilter = ''
            if (type == 'Individual') { typefilter = `join "Customers" on "Invoices"."customerId" = "Customers".id and type = 'Individual' ` }
            else if (type == 'Business') { typefilter = `join "Customers" on "Invoices"."customerId" = "Customers".id and type = 'Business'   ` }

            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = filter && filter.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter && filter.toDate ? moment(new Date(filter.toDate)) : moment();

            let applyOpeningHour = filter && filter.applyOpeningHour ? filter.applyOpeningHour : false;

            if (applyOpeningHour == true) {
                let branchId = branches[0]
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
            }

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset)
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

            const query: { text: string, values: any } = {
                text: ` WITH "lines" as (			
                        select      				     
                        (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."subTotal",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."subTotal",0)end) as "sales",
                                               (case when  "InvoiceLines"."isInclusiveTax" = true then ((COALESCE( "InvoiceLines"."price",0)) - (COALESCE( "InvoiceLines"."taxTotal",0))) else COALESCE( "InvoiceLines"."price",0)end)  as "price",
                        "InvoiceLines"."invoiceId",
                        "InvoiceLines"."createdAt",
                        "InvoiceLines"."branchId",
                        "InvoiceLines"."qty",
                        "InvoiceLines"."companyId",
                                  "InvoiceLines"."productId"
                    from "InvoiceLines"
                    where "InvoiceLines"."companyId" = $1
                    and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any ($2::uuid[]))
                    and ("InvoiceLines"."createdAt" >= $3::timestamp 	 and "InvoiceLines"."createdAt" < $4)
                      and  ($5::uuid[] IS NULL or  "InvoiceLines"."productId"  = any ($5::uuid[]))
                    ),
                    "invoiceData" as (
                    select   "Invoices"."customerId" as  "customerId",
                            "lines"."sales",
                            "lines"."price",
                            "lines"."qty",
                            "lines"."productId"
                    from "lines"
                    inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                        and  ($6::uuid[] IS NULL or  "Invoices"."customerId"  = any ($6::uuid[]))
                    ${typefilter}
                                    ),
                    "creditNoteLines" as (

                                        
                        select      				     
                        (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."subTotal",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."subTotal",0)end) as "sales",
                                               (case when  "CreditNoteLines"."isInclusiveTax" = true then ((COALESCE( "CreditNoteLines"."price",0)) - (COALESCE( "CreditNoteLines"."taxTotal",0))) else COALESCE( "CreditNoteLines"."price",0)end)  as "price",
                        "CreditNoteLines"."createdAt",
                        "CreditNoteLines"."branchId",
                        "CreditNoteLines"."creditNoteId",
                        "CreditNoteLines"."qty",
                        "CreditNoteLines"."companyId",
                               "CreditNoteLines"."productId"
                    from "CreditNoteLines"
                    where "CreditNoteLines"."companyId" = $1
                    and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId" =any($2::uuid[]))
                    and ("CreditNoteLines"."createdAt" >= $3::timestamp 	 and "CreditNoteLines"."createdAt" < $4)
                           and  ($5::uuid[] IS NULL or  "CreditNoteLines"."productId"  = any ($5::uuid[]))
                    ),
                    "creditNoteData" as (
                    select  "Invoices"."customerId"  as  "categoryId",
                             "creditNoteLines"."sales" *(-1),
                            "creditNoteLines"."price" *(-1),
                            "creditNoteLines"."qty" *(-1),
                                "creditNoteLines"."productId"
                    from "creditNoteLines"
                    inner join "CreditNotes"   on   "CreditNotes".id = "creditNoteLines"."creditNoteId"
                    inner join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId" 	
                            and  ($6::uuid[] IS NULL or  "Invoices"."customerId"  = any ($6::uuid[]))
                    ${typefilter}
                    ),
                    T AS (          
                    select * from "invoiceData" union all select * from "creditNoteData"
                    )  select count(*) over(),
                            COALESCE(sum(SUM(T."qty"::text::numeric)) over(),0) as "qtyTotal",
                            COALESCE(sum(SUM(T."sales"::text::numeric)) over(),0) as "salesTotal",
                            COALESCE( sum(SUM(T."qty"::text::numeric)) over(partition by "Customers".id),0) as "totalQtyPerCustomer",
                            COALESCE( sum(SUM(T."sales"::text::numeric)) over(partition by "Customers".id),0) as "totalSalesPerCustomer",

                            "Customers".id as "customerId",
                            COALESCE(NULLIF("Customers".name,''),'WalkIn Customer') as "customerName",
                            "productId",
                            "Products"."name" as  "productName",
                            COALESCE(SUM(T."price"::text::numeric),0) as "unitPrice",
                            COALESCE(SUM(T."qty"::text::numeric),0) as "qty",
                            COALESCE(SUM(T."sales"::text::numeric),0) as "sales"

                        from T
                        left join "Customers" on "Customers".id = T."customerId"
                        left join "Products" on "Products".id  = T."productId"
                        group by "Customers".id , "productId", "productName"
                        order by "customerName","Customers".id ,"productName", "productId"
                        `,
                values: [companyId, branches, from, to, productIds, customerIds]
            }


            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`


            let records = await DB.excu.query(query.text + limitQuery, query.values)
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { qty: t.qtyTotal, sales: t.salesTotal }
                resault = records.rows.map((e: any) => {
                    return {
                        customerId: e.customerId, customerName: e.customerName, productId: e.productId, productName: e.productName,
                        totalQtyPerCustomer: e.totalQtyPerCustomer, totalSalesPerCustomer: e.totalSalesPerCustomer,
                        unitPrice: e.unitPrice, qty: e.qty, sales: e.sales,
                    }
                })
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

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Customer Wise Item Sales Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'customerName' },
                { key: 'productName' },
                { key: 'price', properties: { columnType: 'currency' } },
                { key: 'qty', header: 'Quantity Sold', properties: { hasTotal: true, hasSubTotal: true } },
                { key: 'sales', properties: { hasTotal: true, hasSubTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'CustomerWiseItemSalesReport'
                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async clientWiseDiscountReport(data: any, company: Company, brancheList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            //--------------  filter  --------------
            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;

            let customerIds = filter && filter.customerIds && Array.isArray(filter.customerIds) ? filter.customerIds : null
            const type = filter && filter.type ? filter.type : null
            let typefilter = ''
            if (type == 'Individual') { typefilter = `join "Customers" on "Invoices"."customerId" = "Customers".id and type = 'Individual' ` }
            else if (type == 'Business') { typefilter = `join "Customers" on "Invoices"."customerId" = "Customers".id and type = 'Business'   ` }

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

            const query: { text: string, values: any } = {
                text: ` WITH "lines" as (			
                    select      				     
                        "InvoiceLines"."invoiceId",
                        "InvoiceLines"."discountId",
                        "InvoiceLines"."discountTotal",
                        "InvoiceLines"."branchId",
                        "InvoiceLines"."companyId"
                    from "InvoiceLines"
                    where "InvoiceLines"."companyId" = $1
                    and  ($2::uuid[] IS NULL or  "InvoiceLines"."branchId"  = any ($2::uuid[]))
                    and ("InvoiceLines"."createdAt" >= $3::timestamp 	 and "InvoiceLines"."createdAt" < $4)
                    ),
                    "invoiceData" as (
                    select   "Invoices"."customerId" as  "customerId",
                            "lines"."discountId",
                            "lines"."discountTotal"
                        
                    from "lines"
                    inner join "Invoices" on "Invoices".id = "lines"."invoiceId" 	  and "Invoices"."status" <> 'Draft'
                          and  ($5::uuid[] IS NULL or  "Invoices"."customerId"  = any ($5::uuid[]))   
                    ${typefilter}
                                    ),
                    "creditNoteLines" as (

                                        
                        select      				     
                     
                        "CreditNoteLines"."branchId",
                        "CreditNoteLines"."creditNoteId",
                        "CreditNoteLines"."discountId",
						    "CreditNoteLines"."discountTotal",
                        "CreditNoteLines"."companyId"
                    from "CreditNoteLines"
                    where "CreditNoteLines"."companyId" = $1
                    and  ( $2::uuid[] IS NULL or  "CreditNoteLines"."branchId" =any($2::uuid[]))
                    and ("CreditNoteLines"."createdAt" >= $3::timestamp 	 and "CreditNoteLines"."createdAt" < $4)
                 
                    ),
                    "creditNoteData" as (
                    select  "Invoices"."customerId"  as  "customerId",
                          "creditNoteLines"."discountId",
                            "creditNoteLines"."discountTotal" *(-1)
                    from "creditNoteLines"
                    inner join "CreditNotes"   on   "CreditNotes".id = "creditNoteLines"."creditNoteId"
                    inner join "Invoices"   on   "Invoices".id = "CreditNotes"."invoiceId"
                              and  ($5::uuid[] IS NULL or  "Invoices"."customerId"  = any ($5::uuid[]))  
                    ${typefilter}        
                    ),
                    T AS (          
                    select * from "invoiceData" union all select * from "creditNoteData"
                    )   select count(*) over(),
                            COALESCE(sum(SUM(T."discountTotal"::text::numeric)) over(),0) as "discountTotals",
                            COALESCE( sum(SUM(T."discountTotal"::text::numeric)) over(partition by "Customers".id),0) as "discountTotalPerCustomer",

                            "Discounts".id as "discountId",
                            "Customers".id as "customerId",
                            COALESCE(NULLIF("Discounts".name,''),'Custom') as "discountName",
                            COALESCE(NULLIF("Customers".name,''),'WalkIn Customer') as "customerName",
                            
                            COALESCE(SUM(T."discountTotal"::text::numeric),0) as "discountTotal"

                        from T
                        left join "Customers" on "Customers".id = T."customerId"
                        left join "Discounts" on  "Discounts".id = T."discountId"
                        
                        group by "Customers".id , "discountId", "discountName",  "Discounts".id
                        having COALESCE(SUM(T."discountTotal"::text::numeric),0) != 0
                        order by "customerName","Customers".id ,"discountName",  "Discounts".id
                        `,
                values: [companyId, branches, from, to, customerIds]
            }


            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`


            let records = await DB.excu.query(query.text + limitQuery, query.values)
            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                total = { discountTotal: t.discountTotals }
                resault = records.rows.map((e: any) => {
                    return {
                        customerId: e.customerId, customerName: e.customerName, discountId: e.discountId, discountName: e.discountName,
                        discountTotalPerCustomer: e.discountTotalPerCustomer,
                        discountTotal: e.discountTotal
                    }
                })
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

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Customer Wise Discount Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [{ key: 'customerName' },
                { key: 'discountName' },
                { key: 'discountTotal', properties: { hasTotal: true, hasSubTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'CustomerWiseDiscountReport'

                return new ResponseData(true, "", report)
            }

            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }



}