import { ValidationException } from "@src/utilts/Exception";
import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Company } from "@src/models/admin/company"
import { TimeHelper } from "@src/utilts/timeHelper";


import moment from 'moment'
import { ReportData, XLSXGenerator } from "@src/utilts/xlsxGenerator";
import { Tax } from "@src/models/account/Tax";
import { BranchesRepo } from "../admin/branches.repo";

export class vatReportRepo {

    public static async salesVatReport(data: any, company: Company, brancheList: []) {
        const client = await DB.excu.client();
        try {

            let companyId = company.id
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------



            let branches = data.branchId ? [data.branchId] : brancheList;
            await client.query("BEGIN")

            const query = {
                text: `with "values" as (
                    select $1::uuid as "companyId",
                        $2::uuid[] as "branches",
                        $3::timestamp as "fromDate",
                        $4::timestamp as "toDate"
                        
                 )
                 , "taxes" as(
                    select id, name, "taxPercentage" 
                    from "Taxes" 
                    join "values" on TRUE
                    where "Taxes"."companyId" = "values"."companyId" 
                        and( jsonb_array_length ("Taxes"."taxes") = 0 or  "Taxes"."taxes" is null)
                ) 
                `,

                values: [companyId, branches, from, to]
            }


            let text =
                ` , "invoiceChargesData" as (	
                select "Invoices".id, 
                    nullif("Invoices"."chargesTaxDetails"->>'taxes','')::jsonb as taxes, 
                    "Invoices"."chargesTaxDetails"->>'type' as "type",
                    COALESCE(nullif(nullif(elem.value->>'taxId', ''),'null'),nullif(nullif("Invoices"."chargesTaxDetails"->>'taxId', ''),'null') )::uuid as "mergedTaxId",
					(elem.index -1)::real as "index",
                    COALESCE(nullif(COALESCE(elem.value->>'taxAmount', elem.value->>'taxTotal'),''))::real as "mergedTaxAmount",
                    "Invoices"."chargeTotal" as "amount",
                   ( "Invoices"."chargesTaxDetails"->>'taxAmount')::real as"taxTotal",
                    		"Invoices"."isInclusiveTax"
                from "Invoices" 
                join "values" on true
                inner join "Branches" on "Branches".id = "Invoices"."branchId"
                left  join  jsonb_array_elements(nullif( "Invoices"."chargesTaxDetails"->>'taxes','null')::jsonb )WITH ORDINALITY  elem (value, index) on true
                where "Invoices"."createdAt" >= "values"."fromDate" and "Invoices"."createdAt" <"values"."toDate"
                    and "Branches"."companyId" = "values"."companyId"
                    and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                    and "Invoices"."status" <>'Draft' 
                    and "Invoices"."chargeTotal" <> 0 
                )
                ,"ChargesStackedTax" as (	
                select "invoiceChargesData".id,  "mergedTaxId" as "taxId",
                    "mergedTaxAmount" as "taxTotal", 
                  "index"
                From "invoiceChargesData"
                
                where  "type"= 'stacked' 

                )
                ,"ChargesStackedTaxTotal" as (	
                SELECT  "taxId", 0 as "taxAmount",
                    SUM("taxTotal" ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                FROM "ChargesStackedTax"
                )

                ,"invoiceLinesData" as (	
                select "InvoiceLines".id, COALESCE(nullif(nullif(elem.value->>'taxId', ''),'null')::uuid,"InvoiceLines"."taxId" ) as "mergedTaxId",  (elem.index -1 )::real as "index",
                    COALESCE(nullif(COALESCE(elem.value->>'taxAmount', elem.value->>'taxTotal'),'')::real,"InvoiceLines"."taxTotal" ) as "mergedTaxAmount",
                    "InvoiceLines"."taxes", 
                    "InvoiceLines"."isInclusiveTax",
                    "InvoiceLines"."subTotal",
                    "InvoiceLines"."taxTotal",
                    "InvoiceLines"."taxType",
                    "InvoiceLines"."discountTotal"
                from "InvoiceLines" 
                join "values" on true
                inner join "Invoices" on "Invoices".id  =  "InvoiceLines"."invoiceId" 
                inner join "Branches" on "Branches".id = "Invoices"."branchId"
                left  join  jsonb_array_elements(nullif("InvoiceLines"."taxes",'null') ) WITH ORDINALITY  elem (value, index)  on nullif("InvoiceLines"."taxType",'') is not null
                where "InvoiceLines"."createdAt" >= "values"."fromDate" and "InvoiceLines"."createdAt" <"values"."toDate"
                    and "Branches"."companyId" = "values"."companyId"
                    and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                    and "Invoices"."status" <>'Draft' 
                )
                ,"LinesStackedTax" as (	
                select "invoiceLinesData".id, "mergedTaxId" as "taxId",
                    "mergedTaxAmount" as "taxTotal", 
                  "index"
                From "invoiceLinesData"
                where "taxType" = 'stacked'
                )
                ,"LineStackedTaxTotal" as (	
                SELECT  "taxId", 0 as "taxAmount",
                    SUM("taxTotal" ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                FROM "LinesStackedTax"
                )
			
			
                select "taxes".id  as  "taxId", "taxes".name as "taxName" , sum("amount") as "Total", 0 as  "Adjusments",  sum("taxAmount") as "vatTotal"
                from (
                select "mergedTaxId" as "taxId", 
                sum("mergedTaxAmount") as "taxAmount",
                sum( (case when "isInclusiveTax" then COALESCE("subTotal",0) -  COALESCE("taxTotal",0) else COALESCE("subTotal",0)end)  - COALESCE("discountTotal",0)  ) as "amount"
                from "invoiceLinesData"
                group by "mergedTaxId"

                union all
                select * from "LineStackedTaxTotal"
                
                union all 
                select "mergedTaxId" as "taxId", 
                sum("mergedTaxAmount") as "taxAmount",
                         sum(case when "isInclusiveTax" then  "amount" - "taxTotal" else "amount" end   ) as "amount"
                                from "invoiceChargesData"
                group by "mergedTaxId"
                
                union all
                select * from "ChargesStackedTaxTotal"
                ) T
                inner join "taxes" on "taxes".id = T."taxId" or ("taxes".name ='Exempt Tax' and T."taxId" is null) 
                group by "taxes".id , "taxName"
     

          
            
            `
            let records = await client.query(query.text + text, query.values)
            const invoicesData = records.rows && records.rows.length > 0 ? records.rows : []

            text =
                `
        , "creditNoteChargesData" as (	
            select "CreditNotes".id, 
                nullif("CreditNotes"."chargesTaxDetails"->>'taxes','')::jsonb as taxes,
                "CreditNotes"."chargesTaxDetails"->>'type' as "type",
                COALESCE(nullif(nullif(elem.value->>'taxId', ''),'null'),nullif(nullif("CreditNotes"."chargesTaxDetails"->>'taxId', ''),'null') )::uuid as "mergedTaxId",
					  (elem.index -1)::numeric as "index",
                      nullif(COALESCE(elem.value->>'taxAmount', elem.value->>'taxTotal'),'')::numeric as "mergedTaxAmount",
                "CreditNotes"."chargeTotal" as "amount",
                        ( "CreditNotes"."chargesTaxDetails"->>'taxAmount')::real as"taxTotal",
                	"CreditNotes"."isInclusiveTax"
            from "CreditNotes" 
            join "values" on true
            inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
            left  join  jsonb_array_elements(nullif( "CreditNotes"."chargesTaxDetails"->>'taxes','null')::jsonb )WITH ORDINALITY  elem (value, index) on true
            where "CreditNotes"."createdAt" >= "values"."fromDate" and "CreditNotes"."createdAt" <"values"."toDate"
                and "Branches"."companyId" = "values"."companyId"
                and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 

                and "CreditNotes"."chargeTotal" <> 0 
            )
            ,"ChargesStackedTax" as (	
            select "creditNoteChargesData".id, "mergedTaxId" as "taxId",
               "mergedTaxAmount" as "taxTotal", 
                "index"
            From "creditNoteChargesData"
           
            where  "type"= 'stacked' 

            )
            ,"ChargesStackedTaxTotal" as (	
            SELECT  "taxId", 0 as "taxAmount",
                SUM("taxTotal" ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
            FROM "ChargesStackedTax"
            )

            , "creditNoteLinesData" as (	
            select "CreditNoteLines".id, COALESCE(nullif(nullif(elem.value->>'taxId', ''),'null')::uuid,"CreditNoteLines"."taxId" ) as "mergedTaxId",
				 (elem.index - 1)::numeric as "index",
                COALESCE(nullif(COALESCE(elem.value->>'taxAmount', elem.value->>'taxTotal'),'')::numeric,"CreditNoteLines"."taxTotal" ) as "mergedTaxAmount",
                "CreditNoteLines"."taxes", 
                "CreditNoteLines"."isInclusiveTax",
                "CreditNoteLines"."subTotal",
                "CreditNoteLines"."taxTotal",
                "CreditNoteLines"."taxType",
                "CreditNoteLines"."discountTotal"

            from "CreditNoteLines" 
            join "values" on true
            inner join "CreditNotes" on "CreditNotes".id  =  "CreditNoteLines"."creditNoteId" 
            inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
            left  join  jsonb_array_elements(nullif("CreditNoteLines"."taxes",'null') )WITH ORDINALITY  elem (value, index)  on nullif("CreditNoteLines"."taxType",'') is not null
            where "CreditNoteLines"."createdAt" >= "values"."fromDate" and "CreditNoteLines"."createdAt" <"values"."toDate"
                and "Branches"."companyId" = "values"."companyId"
                and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 

            )
            ,"LinesStackedTax" as (	
            select "creditNoteLinesData".id,"mergedTaxId" as "taxId",
               "mergedTaxAmount" as "taxTotal", 
                "index" 
               
            From "creditNoteLinesData"
           
            where "taxType" = 'stacked'

            )
            ,"LineStackedTaxTotal" as (	
            SELECT  "taxId", 0 as "taxAmount",
                SUM("taxTotal" ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
            FROM "LinesStackedTax"
            )
            select "taxes".id  as  "taxId", "taxes".name as "taxName" ,0 as "Total", sum("amount")  as  "Adjusments",  sum("taxAmount") as "vatTotal"
            from (
            select "mergedTaxId" as "taxId", 
            sum("mergedTaxAmount") as "taxAmount",
            sum( (case when "isInclusiveTax" then COALESCE("subTotal",0) -  COALESCE("taxTotal",0) else COALESCE("subTotal",0)end)  - COALESCE("discountTotal",0)  ) as "amount"
            from "creditNoteLinesData"
            group by "mergedTaxId"

            union all
            select * from "LineStackedTaxTotal"
            union all 

            select "mergedTaxId" as "taxId", 
            sum("mergedTaxAmount") as "taxAmount",
              sum(case when "isInclusiveTax" then  "amount" - "taxTotal" else "amount" end   ) as "amount"
            from "creditNoteChargesData"
            group by "mergedTaxId"
            union all
            select * from "ChargesStackedTaxTotal"
            ) T
            inner join "taxes" on "taxes".id = T."taxId" or ("taxes".name ='Exempt Tax' and T."taxId" is null) 
            group by "taxes".id , "taxName"
          
            `
            records = await client.query(query.text + text, query.values)
            const creditNotesData = records.rows && records.rows.length > 0 ? records.rows : []


            let result2: any[] = [];

            creditNotesData.forEach((elem: any) => {

                let invoiceTaxData = invoicesData.find(obj => obj.taxId == elem.taxId)

                if (invoiceTaxData != null) {
                    invoicesData.splice(invoicesData.indexOf(invoiceTaxData), 1)
                    invoiceTaxData.Adjusments = elem.Adjusments
                    invoiceTaxData.vatTotal -= elem.vatTotal
                    result2.push(invoiceTaxData)
                } else {
                    result2.push(elem)
                }

            })

            let resData = [...invoicesData, ...result2]



            await client.query("COMMIT")
            return new ResponseData(true, "", resData)

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    public static async purchaseVatReport(data: any, company: Company, brancheList: []) {
        const client = await DB.excu.client();
        try {
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------
            const companyId = company.id
            let branches = data.branchId ? [data.branchId] : brancheList;

            await client.query("BEGIN")


            const query = {
                text: `with "values" as (
                    select $1::uuid as "companyId",
                        $2::uuid[] as "branches",
                        $3::timestamp as "fromDate",
                        $4::timestamp as "toDate"
                        
                 )
                 , "taxes" as(
                    select id, name, "taxPercentage" 
                    from "Taxes" 
                    join "values" on TRUE
                    where "Taxes"."companyId" = "values"."companyId" 
                        and( jsonb_array_length ("Taxes"."taxes") = 0 or  "Taxes"."taxes" is null)
                ) 
                `,

                values: [companyId, branches, from, to]
            }

            let text =
                `    ,"billingLinesData" as (	
                select "BillingLines".id, COALESCE(nullif(nullif(elem->>'taxId', ''),'null')::uuid,"BillingLines"."taxId" ) as "mergedTaxId",
				nullif(elem ->>'index','')::real as "index",
                    COALESCE(nullif(COALESCE(elem->>'taxAmount', elem->>'taxTotal'),'')::real,"BillingLines"."taxTotal" ) as "mergedTaxAmount",
                    "BillingLines"."taxes", 
                    "BillingLines"."isInclusiveTax",
                    "BillingLines"."subTotal",
                    "BillingLines"."taxableAmount",
                    "BillingLines"."taxTotal",
                    "BillingLines"."taxType"
                from "BillingLines" 
                join "values" on true
                inner join "Billings" on "Billings".id  =  "BillingLines"."billingId" 
                inner join "Branches" on "Branches".id = "Billings"."branchId"
                left  join  jsonb_array_elements(nullif("BillingLines"."taxes",'null') )as elem  on nullif("BillingLines"."taxType",'') is not null
                left join "BillOfEntryLines" on "BillOfEntryLines"."billingLineId" = "BillingLines".id
                where "Billings"."billingDate"::timestamp >= "values"."fromDate" and "Billings"."billingDate"::timestamp <"values"."toDate"
                    and "Branches"."companyId" = "values"."companyId"
                    and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                    and "Billings"."status" <>'Draft' 
                    and ( "BillOfEntryLines".id is null or ("BillOfEntryLines"."taxId" = null) or "BillOfEntryLines"."taxTotal" = 0 )
					UNION ALL
					select "ExpenseLines".id, COALESCE(nullif(nullif(elem->>'taxId', ''),'null')::uuid,"ExpenseLines"."taxId" ) as "mergedTaxId",
				nullif(elem ->>'index','')::real as "index",
                    COALESCE(nullif(COALESCE(elem->>'taxAmount', elem->>'taxTotal'),'')::real,"ExpenseLines"."taxTotal" ) as "mergedTaxAmount",
                    "ExpenseLines"."taxes", 
                    "ExpenseLines"."isInclusiveTax",
                    "ExpenseLines"."amount" as "subTotal" ,
                      case when  "ExpenseLines"."isInclusiveTax" then  "ExpenseLines"."amount" -  "ExpenseLines"."taxTotal"    else  "ExpenseLines"."amount" end as "taxableAmount", 
                    "ExpenseLines"."taxTotal",
                    "ExpenseLines"."taxType"
                from "ExpenseLines" 
                join "values" on true
                inner join "Expenses" on "Expenses".id  =  "ExpenseLines"."expenseId" 
                inner join "Branches" on "Branches".id = "Expenses"."branchId"
                left  join  jsonb_array_elements(nullif("ExpenseLines"."taxes",'null') )as elem  on nullif("ExpenseLines"."taxType",'') is not null
                where "Expenses"."expenseDate"::timestamp >= "values"."fromDate" and "Expenses"."expenseDate"::timestamp <"values"."toDate"
                    and "Branches"."companyId" = "values"."companyId"
                    and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                   
                )
                ,"LinesStackedTax" as (	
                select "billingLinesData".id, "mergedTaxId" as "taxId",
                   "mergedTaxAmount" as "taxTotal", 
                    "index"
                From "billingLinesData"
              
                where "taxType" = 'stacked'
                )
                ,"LineStackedTaxTotal" as (	
                SELECT  "taxId", 0 as "taxAmount",
                    SUM("taxTotal" ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                FROM "LinesStackedTax"
                )
                select "taxes".id  as  "taxId", "taxes".name as "taxName" , sum("amount") as "Total", 0 as  "Adjusments",  sum("taxAmount") as "vatTotal"
                from (
                select "mergedTaxId" as "taxId", 
                sum("mergedTaxAmount") as "taxAmount",
                sum( "taxableAmount" ) as "amount"
                from "billingLinesData"
                group by "mergedTaxId"

                union all
                select * from "LineStackedTaxTotal"
                
                
                ) T
                inner join "taxes" on "taxes".id = T."taxId" or ("taxes".name ='Exempt Tax' and T."taxId" is null) 
                group by "taxes".id , "taxName"
           
           
            `
            let records = await client.query(query.text + text, query.values)
            const invoicesData = records.rows && records.rows.length > 0 ? records.rows : []

            text =
                `
            , "supplierCreditLinesData" as (	
            select "SupplierCreditLines".id, COALESCE(nullif(nullif(elem->>'taxId', ''),'null')::uuid,"SupplierCreditLines"."taxId" ) as "mergedTaxId",
				 nullif(elem ->>'index','')::numeric as "index",
                COALESCE(nullif(COALESCE(elem->>'taxAmount', elem->>'taxTotal'),'')::numeric,"SupplierCreditLines"."taxTotal" ) as "mergedTaxAmount",
                "SupplierCreditLines"."taxes", 
                "SupplierCreditLines"."isInclusiveTax",
                "SupplierCreditLines"."subTotal",
                "SupplierCreditLines"."taxableAmount",
                "SupplierCreditLines"."taxTotal",
                "SupplierCreditLines"."taxType"

            from "SupplierCreditLines" 
            join "values" on true
            inner join "SupplierCredits" on "SupplierCredits".id  =  "SupplierCreditLines"."supplierCreditId" 
            inner join "Branches" on "Branches".id = "SupplierCredits"."branchId"
            left  join  jsonb_array_elements(nullif("SupplierCreditLines"."taxes",'null') )as elem  on nullif("SupplierCreditLines"."taxType",'') is not null
            where "SupplierCredits"."supplierCreditDate"::timestamp >= "values"."fromDate" and "SupplierCredits"."supplierCreditDate"::timestamp <"values"."toDate"
                and "Branches"."companyId" = "values"."companyId"
                and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 

            )
            ,"LinesStackedTax" as (	
            select "supplierCreditLinesData".id,  "mergedTaxId" as "taxId",
               "mergedTaxAmount" as "taxTotal", 
                "index"
            From "supplierCreditLinesData"
            
            where "taxType" = 'stacked'

            )
            ,"LineStackedTaxTotal" as (	
            SELECT  "taxId", 0 as "taxAmount",
                SUM("taxTotal" ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
            FROM "LinesStackedTax"
            )
            select "taxes".id  as  "taxId", "taxes".name as "taxName" ,0 as "Total", sum("amount")  as  "Adjusments",  sum("taxAmount") as "vatTotal"
            from (
            select "mergedTaxId" as "taxId", 
            sum("mergedTaxAmount") as "taxAmount",
            sum( "taxableAmount"   ) as "amount"
            from "supplierCreditLinesData"
            group by "mergedTaxId"

            union all
            select * from "LineStackedTaxTotal"

            ) T
            inner join "taxes" on "taxes".id = T."taxId" or ("taxes".name ='Exempt Tax' and T."taxId" is null) 
            group by "taxes".id , "taxName"
           
            
            `
            records = await client.query(query.text + text, query.values)
            const creditNotesData = records.rows && records.rows.length > 0 ? records.rows : []



            let result2: any[] = [];

            creditNotesData.forEach((elem: any) => {

                let invoiceTaxData = invoicesData.find(obj => obj.taxId == elem.taxId)

                if (invoiceTaxData != null) {
                    invoicesData.splice(invoicesData.indexOf(invoiceTaxData), 1)
                    invoiceTaxData.Adjusments = elem.Adjusments
                    invoiceTaxData.vatTotal -= elem.vatTotal
                    result2.push(invoiceTaxData)
                } else {
                    result2.push(elem)
                }

            })

            let resData = [...invoicesData, ...result2]

            await client.query("COMMIT")
            return new ResponseData(true, "", resData)

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async getVatDetailsReport(data: any, company: Company, brancheList: []) {
        try {

            let companyId = company.id;
            let branches = data.branchId ? [data.branchId] : null;
            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------

            const query: { text: string, values: any } = {
                text: `with "values" as (
                        select $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::timestamp as "fromDate",
                            $4::timestamp as "toDate"
                         
                         )
                        ,"InvoiceData" AS (
                        select  
                                "Invoices"."invoiceNumber" AS "referenceNumber",
                                "Invoices".id AS "referenceId",
                                Date("InvoiceLines"."createdAt")  AS "Date",
                                case when  "InvoiceLines"."taxPercentage" <> 0  then 
                                            "InvoiceLines"."subTotal" -  (case when "InvoiceLines"."isInclusiveTax" = true then COALESCE("InvoiceLines"."taxTotal",0) else 0 end) - COALESCE("InvoiceLines"."discountTotal",0) 
                                        end as "taxableAmount" ,
                                "Taxes".name as name,
                                "InvoiceLines"."taxTotal" as vat,
                                case when "InvoiceLines"."taxPercentage" = 0 then  "InvoiceLines"."subTotal" - COALESCE("InvoiceLines"."discountTotal",0) end  as "none_taxableAmount",
                                "InvoiceLines"."total" as "totalAmount"
                                from "InvoiceLines"
                            join "values" ON true
                            inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" 
                            left join "Taxes" on "Taxes".id = "InvoiceLines"."taxId"
                            inner join "Branches" on "Branches".id = "Invoices"."branchId"
                            where "InvoiceLines"."createdAt" >= "values"."fromDate" and "InvoiceLines"."createdAt" <"values"."toDate"
                                and "Branches"."companyId" = "values"."companyId"
                                and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                                and "Invoices"."status" <>'Draft'

                        union all

                        select  
                                "Invoices"."invoiceNumber" AS "referenceNumber",
                                "Invoices".id AS "referenceId",
                                Date("Invoices"."invoiceDate")  AS "Date",
                                case when  COALESCE(NULLIF("Invoices"."chargesTaxDetails"->>'taxPercentage','')::numeric,0) <> 0  then   "Invoices"."chargeTotal" end  as "taxableAmount",
                                "Taxes".name as  name,
                                NULLIF(COALESCE("Invoices"."chargesTaxDetails"->>'taxAmount',"Invoices"."chargesTaxDetails"->>'taxTotal'),'')::numeric as vat , 
                                case when  ("Invoices"."chargesTaxDetails" is null or COALESCE(NULLIF("Invoices"."chargesTaxDetails"->>'taxPercentage','')::numeric,0) = 0 ) then   "Invoices"."chargeTotal" end  as "none_taxableAmount",
                                "Invoices"."chargeTotal" + COALESCE(nullif(COALESCE("Invoices"."chargesTaxDetails"->>'taxAmount', "Invoices"."chargesTaxDetails"->>'taxTotal'),'')::numeric,0) as "totalAmount"
                        from "Invoices"
                        join "values" on true
                        left join "Taxes" on "Taxes".id = (nullIf("Invoices"."chargesTaxDetails"->>'taxId',''))::uuid
                        inner join "Branches" on "Branches".id = "Invoices"."branchId"
                        where "Invoices"."invoiceDate" >= "values"."fromDate" and "Invoices"."invoiceDate" <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                       
                            and "Invoices"."status" <>'Draft'  and  "Invoices"."chargeTotal" <> 0
                        )
                        ,"CreditNoteData" AS (
                        select  
                                "CreditNotes"."creditNoteNumber" AS "referenceNumber",
                                "CreditNotes".id AS "referenceId",
                                Date("CreditNoteLines"."createdAt")  AS "Date",
                                case when  "CreditNoteLines"."taxPercentage" <> 0  then 
                                            "CreditNoteLines"."subTotal" -  (case when "CreditNoteLines"."isInclusiveTax" = true then COALESCE("CreditNoteLines"."taxTotal",0) else 0 end) - COALESCE("CreditNoteLines"."discountTotal",0) 
                                        end*(-1) as "taxableAmount" ,
                                "Taxes".name as name,
                                "CreditNoteLines"."taxTotal"*(-1) as vat,
                                case when  "CreditNoteLines"."taxPercentage" = 0  then "CreditNoteLines"."subTotal" - COALESCE("CreditNoteLines"."discountTotal",0) end *(-1) as "none_taxableAmount",
                                "CreditNoteLines"."total" *(-1) as "totalAmount"
                                from "CreditNoteLines"
                            join "values" ON true
                            inner join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId" 
                            left join "Taxes" on "Taxes".id = "CreditNoteLines"."taxId"
                            inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
                            where "CreditNoteLines"."createdAt" >= "values"."fromDate" and "CreditNoteLines"."createdAt" <"values"."toDate"
                                and "Branches"."companyId" = "values"."companyId"
                                and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                                
                            

                        union all

                        select  
                                "CreditNotes"."creditNoteNumber" AS "referenceNumber",
                                "CreditNotes".id AS "referenceId",
                                Date("CreditNotes"."creditNoteDate")  AS "Date",
                                case when  COALESCE(NULLIF("CreditNotes"."chargesTaxDetails"->>'taxPercentage','')::numeric,0) <> 0  then   "CreditNotes"."chargeTotal" end *(-1) as "taxableAmount",
                                "Taxes".name as  name,
                                NULLIF(COALESCE("CreditNotes"."chargesTaxDetails"->>'taxAmount',"CreditNotes"."chargesTaxDetails"->>'taxTotal'),'')::numeric*(-1) as vat , 
                                case when  ("CreditNotes"."chargesTaxDetails" is null or COALESCE(NULLIF("CreditNotes"."chargesTaxDetails"->>'taxPercentage','')::numeric,0) = 0 ) then   "CreditNotes"."chargeTotal" end*(-1)  as "none_taxableAmount",
                                "CreditNotes"."chargeTotal" + COALESCE(nullif(COALESCE("CreditNotes"."chargesTaxDetails"->>'taxAmount', "CreditNotes"."chargesTaxDetails"->>'taxTotal'),'')::numeric,0)*(-1) as "totalAmount"
                        from "CreditNotes"
                        join "values" on true
                        left join "Taxes" on "Taxes".id = (nullIf("CreditNotes"."chargesTaxDetails"->>'taxId',''))::uuid
                        inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
                        where "CreditNotes"."creditNoteDate" >= "values"."fromDate" and "CreditNotes"."creditNoteDate" <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                          
                            and  "CreditNotes"."chargeTotal" <> 0
                        )
                        ,"BillingData" AS (
                        select  
                                "Billings"."billingNumber" AS "referenceNumber",
                                "Billings".id AS "referenceId",
                                Date("Billings"."billingDate")  AS "Date",
                                sum( case when  "BillingLines"."taxPercentage" <> 0  then 
                                            "BillingLines"."subTotal" -  (case when "BillingLines"."isInclusiveTax" = true then COALESCE("BillingLines"."taxTotal",0) else 0 end)
                                        end )as "taxableAmount" ,
                                array_agg(distinct "Taxes".name) as name,
                                sum("BillingLines"."taxTotal") as vat,
                                sum( case when "BillingLines"."taxPercentage" = 0 then  "BillingLines"."subTotal"  end  )as "none_taxableAmount",
                                sum("BillingLines"."total") as "totalAmount"
                                from "BillingLines"
                            join "values" ON true
                            inner join "Billings" on "Billings".id = "BillingLines"."billingId" 
                            left join "Taxes" on "Taxes".id = "BillingLines"."taxId"
                            inner join "Branches" on "Branches".id = "Billings"."branchId"
                            where "Billings"."billingDate" >= "values"."fromDate" and "Billings"."billingDate" <"values"."toDate"
                                and "Branches"."companyId" = "values"."companyId"
                                and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                             
                                and "Billings"."status" <>'Draft'
                            group by  "Billings".id
                        )
                        ,"SupplierCreditData" AS (
                        select  
                                "SupplierCredits"."supplierCreditNumber" AS "referenceNumber",
                                "SupplierCredits".id AS "referenceId",
                                Date("SupplierCredits"."supplierCreditDate")  AS "Date",
                                sum( case when  "SupplierCreditLines"."taxPercentage" <> 0  then 
                                            "SupplierCreditLines"."subTotal" -  (case when "SupplierCreditLines"."isInclusiveTax" = true then COALESCE("SupplierCreditLines"."taxTotal",0) else 0 end) 
                                        end)*(-1) as "taxableAmount" ,
                                array_agg("Taxes".name) as name,
                                sum("SupplierCreditLines"."taxTotal")*(-1) as vat,
                                sum(case when  "SupplierCreditLines"."taxPercentage" = 0  then "SupplierCreditLines"."subTotal" end) *(-1) as "none_taxableAmount",
                                sum("SupplierCreditLines"."total") *(-1) as "totalAmount"
                                from "SupplierCreditLines"
                            join "values" ON true
                            inner join "SupplierCredits" on "SupplierCredits".id = "SupplierCreditLines"."supplierCreditId" 
                            left join "Taxes" on "Taxes".id = "SupplierCreditLines"."taxId"
                            inner join "Branches" on "Branches".id = "SupplierCredits"."branchId"
                            where "SupplierCredits"."supplierCreditDate"::timestamp  >= "values"."fromDate" and "SupplierCredits"."supplierCreditDate"::timestamp <"values"."toDate"
                                and "Branches"."companyId" = "values"."companyId"
                                and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                        
                            group by "SupplierCredits".id
                        )
                        ,"ExpenseData" AS (
                        select  
                                "Expenses"."expenseNumber" AS "referenceNumber",
                                "Expenses".id AS "referenceId",
                                Date("Expenses"."expenseDate")  AS "Date",
                                sum(case when  "ExpenseLines"."taxPercentage" <> 0  then 
                                            "ExpenseLines"."amount" -  (case when "ExpenseLines"."isInclusiveTax" = true then COALESCE("ExpenseLines"."taxTotal",0) else 0 end)
                                        end) as "taxableAmount" ,
                                array_agg("Taxes".name) as name,
                                sum("ExpenseLines"."taxTotal") as vat,
                                sum( case when "ExpenseLines"."taxPercentage" = 0 then  "ExpenseLines"."amount"  end ) as "none_taxableAmount",
                                sum("ExpenseLines"."total") as "totalAmount"
                                from "ExpenseLines"
                            join "values" ON true
                            inner join "Expenses" on "Expenses".id = "ExpenseLines"."expenseId" 
                            left join "Taxes" on "Taxes".id = "ExpenseLines"."taxId"
                            inner join "Branches" on "Branches".id = "Expenses"."branchId"
                            where "Expenses"."expenseDate" >= "values"."fromDate" and "Expenses"."expenseDate" <"values"."toDate"
                                and "Branches"."companyId" = "values"."companyId"
                                and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                           
                            group by "Expenses".id
                                
                        )

                        select 'InputTax' AS "parentType",
                                'Invoice' AS "type",
                                "referenceNumber", "referenceId",
                                "Date", 
                                sum("taxableAmount") as "taxableAmount",
                                array_agg(distinct name) as name,
                                sum("vat") as "vat",
                                sum("none_taxableAmount") as "none_taxableAmount",
                                sum("totalAmount") as "totalAmount"
                        from "InvoiceData" 
                        group by  "referenceId","referenceNumber", "Date"
                                            
                        union all 
                        select  'InputTax' AS "parentType",
                                'CreditNote' AS "type",
                                "referenceNumber", "referenceId",
                                "Date", 
                                sum("taxableAmount") as "taxableAmount",
                                array_agg(distinct name) as name,
                                sum("vat") as "vat",
                                sum("none_taxableAmount") as "none_taxableAmount",
                                sum("totalAmount") as "totalAmount"
                        from "CreditNoteData" 
                        group by  "referenceId","referenceNumber", "Date"

                        union all
                        select 'OutputTax' AS "parentType",
                                'Bill' AS "type",
                                "BillingData".*
                        from "BillingData" 
                                            
                        union all 
                        select  'OutputTax' AS "parentType",
                                'SupplierCredit' AS "type",
                                "SupplierCreditData" .*
                        from "SupplierCreditData" 

                        union all 
                        select  'OutputTax' AS "parentType",
                                'Expense' AS "type",
                                "ExpenseData".*
                        from "ExpenseData" 
                       
                        order by "parentType", "Date" asc		
                    
                    `,
                values: [companyId, branches, from, to]
            }


            const records = await DB.excu.query(query.text, query.values);



            if (records.rowCount && records.rowCount > 0) {
                return new ResponseData(true, "", records.rows)
            } else {
                return new ResponseData(true, "", [])
            }

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getPurchaseVatDetailsByVatId(data: any, company: Company, brancheList: []) {
        try {

            let companyId = company.id;
            let branches = data.branchId ? [data.branchId] : brancheList;
            let taxId = data.taxId ? data.taxId : null
            if (!taxId) { throw new ValidationException("taxId is required") }


            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------


            const query: { text: string, values: any } = {
                text: `with "values" as (
                        select $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::timestamp as "fromDate",
                            $4::timestamp as "toDate",
                            $5::uuid as "taxId"
                        )
                        
                         , "TaxesData" as(
                        select "Taxes" .*
                        from "Taxes" 
                        join "values" on TRUE
                        where "Taxes"."companyId" = "values"."companyId" 
                        )

                        
                        , "expenseLinesData" as (	
                        select "ExpenseLines" .* ,
                                COALESCE(nullif(nullif(elem->>'taxId', ''),'null')::uuid,"ExpenseLines"."taxId" ) as "mergedTaxId",
							nullif(elem ->>'index','')::numeric as "taxIndex",
                                COALESCE(nullif(COALESCE(elem->>'taxAmount', elem->>'taxTotal'),'')::numeric,"ExpenseLines"."taxTotal" ) as "mergedTaxAmount"
                        from "ExpenseLines" 
                        join "values" on true
                        inner join "Expenses" on "Expenses".id  =  "ExpenseLines"."expenseId" 
                        inner join "Branches" on "Branches".id = "Expenses"."branchId"
                        left  join  jsonb_array_elements(nullif("ExpenseLines"."taxes",'null') )as elem  on true
                        inner join "TaxesData" on "TaxesData".id = "ExpenseLines"."taxId" or ("TaxesData".name ='Exempt Tax' and "ExpenseLines"."taxId" is null) or ("TaxesData".id = nullif(nullif("elem"->>'taxId','null'),'')::uuid)
                        where "Expenses"."expenseDate"::timestamp >= "values"."fromDate" and "Expenses"."expenseDate"::timestamp  <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                            
                            and "TaxesData"."companyId" = "values"."companyId"
                            and  "TaxesData".id = "values"."taxId"
                        )

                        , "ExpenseData" as ( 
                        select  'InputTax' AS "parentType",
                                'Expense' AS "type",
                                "Expenses"."expenseNumber" AS "referenceNumber",
                                "Expenses".id AS "referenceId",
                                Date("Expenses"."expenseDate")  AS "Date",
                                (case when  "expenseLinesData"."taxPercentage" <> 0  then (case when "expenseLinesData"."isInclusiveTax" = true 
                                                    then( COALESCE("expenseLinesData"."amount",0)::text::numeric -  COALESCE("expenseLinesData"."taxTotal",0)::text::numeric ) 
                                                    else COALESCE("expenseLinesData"."amount",0)::text::numeric end ) end)  as "taxableAmount" ,
                                ( "TaxesData".name) as name,
                                ("expenseLinesData"."mergedTaxAmount"::text::numeric) as vat,
                                (case when  "expenseLinesData"."taxId" is null OR "expenseLinesData"."taxPercentage"  = 0 then COALESCE("expenseLinesData"."amount",0)::text::numeric  end ) as "none_taxableAmount",
                                (case when "expenseLinesData"."isInclusiveTax" = false then( COALESCE("expenseLinesData"."amount",0)::text::numeric+  COALESCE("expenseLinesData"."mergedTaxAmount",0)::text::numeric )   
                                                                                    else COALESCE("expenseLinesData"."amount",0)::text::numeric - COALESCE("expenseLinesData"."taxTotal",0)::text::numeric +  COALESCE("expenseLinesData"."mergedTaxAmount",0)::text::numeric end ) as "totalAmount"
                        from "expenseLinesData"
                        inner join "Expenses" on "Expenses".id = "expenseLinesData"."expenseId"
                        left join "TaxesData" on "TaxesData".id = "expenseLinesData"."mergedTaxId" 
                        )

                        ,"ExpenseLinesStackedTax" as (
						select  "expenseLinesData".id, "expenseLinesData"."expenseId",  nullif(nullif("elem"->>'taxId','null'),'') ::uuid as "taxId",
                            nullif(elem ->>'taxAmount','')::numeric as "taxTotal", nullif(elem ->>'index','')::numeric as "taxIndex"
						From "expenseLinesData"
						cross  join   jsonb_array_elements("expenseLinesData"."taxes") elem
						where "expenseLinesData"."taxType" = 'stacked'
							and   NULLIF(NULLIF(( "elem"->>'taxId'),''),'null') is not null 
                        )

                        ,"ExpenseStackedTaxTotal" as (	
                        SELECT  "ExpenseLinesStackedTax"."taxId","expenseId",
                        SUM("taxTotal" ) OVER ( PARTITION BY id order by "taxIndex" ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                        FROM "ExpenseLinesStackedTax"
                        )
                        , "ExpenseT1" as (
                        select  "parentType", "type",
                            "referenceNumber", "referenceId",
                            "Date", 
                            sum("taxableAmount") as "taxableAmount",
                            array_agg(distinct  "name" ) filter(where name is not null) as name,
                            sum("vat") as "vat",
                            sum("none_taxableAmount") as "none_taxableAmount",
                            sum("totalAmount") as "totalAmount"
                        from "ExpenseData" 
                        group by  "referenceId","parentType", "type","referenceNumber", "Date"
                        )
                        , "ExpenseT2" as (
                        select  "ExpenseStackedTaxTotal".* 
                        from "ExpenseStackedTaxTotal"
                        join "values" on true 
                        where  "values"."taxId" = "ExpenseStackedTaxTotal"."taxId"
                        )

                        ,"ExpenseTotal" as (
                        select  "parentType", "type",
                            "referenceNumber", "referenceId",
                            "Date", 
                            "taxableAmount" + COALESCE( "ExpenseT2".amount,0)  as "taxableAmount",
                            name,
                            "vat",
                            "none_taxableAmount",
                            "totalAmount"+ COALESCE( "ExpenseT2".amount,0) as "totalAmount"
                        from "ExpenseT1" 
                        left join "ExpenseT2" on  "ExpenseT1"."referenceId" =  "ExpenseT2"."expenseId"

                        )

                        , "billingLinesData" as (	
                        select "BillingLines" .* ,
                                COALESCE(nullif(nullif(elem->>'taxId', ''),'null')::uuid,"BillingLines"."taxId" ) as "mergedTaxId",
							nullif(elem ->>'index','')::numeric as "taxIndex",
                                COALESCE(nullif(COALESCE(elem->>'taxAmount', elem->>'taxTotal'),'')::numeric,"BillingLines"."taxTotal" ) as "mergedTaxAmount"
                        from "BillingLines" 
                        join "values" on true
                        inner join "Billings" on "Billings".id  =  "BillingLines"."billingId" 
                        inner join "Branches" on "Branches".id = "Billings"."branchId"
                        left  join  jsonb_array_elements(nullif("BillingLines"."taxes",'null') )as elem  on true
                        inner join "TaxesData" on "TaxesData".id = "BillingLines"."taxId" or ("TaxesData".name ='Exempt Tax' and "BillingLines"."taxId" is null) or ("TaxesData".id = nullif(nullif("elem"->>'taxId','null'),'')::uuid)
                        LEFT JOIN "BillOfEntryLines" on "BillOfEntryLines"."billingLineId" = "BillingLines".id
                        where "Billings"."billingDate"::timestamp >= "values"."fromDate" and "Billings"."billingDate"::timestamp <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                            and "Billings"."status" <>'Draft' 
                            and "TaxesData"."companyId" = "values"."companyId"
                            and ("BillOfEntryLines".id is null or "BillOfEntryLines"."taxId" is null or "BillOfEntryLines"."taxTotal" = 0)
                            and  "TaxesData".id = "values"."taxId"
                        )

                        , "BillingData" as ( 
                        select  'InputTax' AS "parentType",
                                'Bill' AS "type",
                                "Billings"."billingNumber" AS "referenceNumber",
                                "Billings".id AS "referenceId",
                                Date("Billings"."billingDate")  AS "Date",
                                ("taxableAmount")  as "taxableAmount" ,
                                ( "TaxesData".name) as name,
                                ("billingLinesData"."mergedTaxAmount"::text::numeric) as vat,
                                (case when  "billingLinesData"."taxId" is null OR "billingLinesData"."taxPercentage"  = 0 then COALESCE("billingLinesData"."subTotal",0)::text::numeric  end ) as "none_taxableAmount",
                                (case when "billingLinesData"."isInclusiveTax" = false then( COALESCE("billingLinesData"."subTotal",0)::text::numeric+  COALESCE("billingLinesData"."mergedTaxAmount",0)::text::numeric )   
                                                                                    else COALESCE("billingLinesData"."subTotal",0)::text::numeric - COALESCE("billingLinesData"."taxTotal",0)::text::numeric +  COALESCE("billingLinesData"."mergedTaxAmount",0)::text::numeric end ) as "totalAmount"
                        from "billingLinesData"
                        inner join "Billings" on "Billings".id = "billingLinesData"."billingId"
                        left join "TaxesData" on "TaxesData".id = "billingLinesData"."mergedTaxId" 
                        )
                        ,"LinesStackedTax" as (
							
						select  "billingLinesData".id, "billingLinesData"."billingId",  nullif(nullif("elem"->>'taxId','null'),'') ::uuid as "taxId",
                            nullif(elem ->>'taxAmount','')::numeric as "taxTotal", nullif(elem ->>'index','')::numeric as "taxIndex"
						From "billingLinesData"
						cross  join   jsonb_array_elements("billingLinesData"."taxes") elem
						where "billingLinesData"."taxType" = 'stacked'
							and   NULLIF(NULLIF(( "elem"->>'taxId'),''),'null') is not null 
                        )

                        ,"BillingStackedTaxTotal" as (	
                        SELECT  "LinesStackedTax"."taxId","billingId",
                        SUM("taxTotal" ) OVER ( PARTITION BY id order by "taxIndex" ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                        FROM "LinesStackedTax"
                        )
                        , "BillingT1" as (
                        select  "parentType", "type",
                            "referenceNumber", "referenceId",
                            "Date", 
                            sum("taxableAmount") as "taxableAmount",
                            array_agg(distinct  "name" ) filter(where name is not null) as name,
                            sum("vat") as "vat",
                            sum("none_taxableAmount") as "none_taxableAmount",
                            sum("totalAmount") as "totalAmount"
                        from "BillingData" 
                        group by  "referenceId","parentType", "type","referenceNumber", "Date"
                        )
                        , "BillingT2" as (
                        select  "BillingStackedTaxTotal".* 
                        from "BillingStackedTaxTotal"
                        join "values" on true 
                        where  "values"."taxId" = "BillingStackedTaxTotal"."taxId"
                        )

                        ,"BillingTotal" as (
                        select  "parentType", "type",
                            "referenceNumber", "referenceId",
                            "Date", 
                            "taxableAmount" + COALESCE( "BillingT2".amount,0)  as "taxableAmount",
                            name,
                            "vat",
                            "none_taxableAmount",
                            "totalAmount"+ COALESCE( "BillingT2".amount,0) as "totalAmount"
                        from "BillingT1" 
                        left join "BillingT2" on  "BillingT1"."referenceId" =  "BillingT2"."billingId"
                        )
                        , "supplierCreditLinesData" as (	
                        select "SupplierCreditLines" .* , 
                                COALESCE(nullif(nullif(elem->>'taxId', ''),'null')::uuid,"SupplierCreditLines"."taxId" ) as "mergedTaxId",
							nullif(elem ->>'index','')::numeric as "taxIndex",
                                COALESCE(nullif(COALESCE(elem->>'taxAmount', elem->>'taxTotal'),'')::numeric,"SupplierCreditLines"."taxTotal" ) as "mergedTaxAmount"
                        from "SupplierCreditLines" 
                        join "values" on true
                        inner join "SupplierCredits" on "SupplierCredits".id  =  "SupplierCreditLines"."supplierCreditId" 
                        inner join "Branches" on "Branches".id = "SupplierCredits"."branchId"
                        left  join  jsonb_array_elements(nullif("SupplierCreditLines"."taxes",'null') )as elem  on true
                        inner join "TaxesData" on "TaxesData".id = "SupplierCreditLines"."taxId" or ("TaxesData".name ='Exempt Tax' and "SupplierCreditLines"."taxId" is null) or ("TaxesData".id =  nullif(nullif("elem"->>'taxId','null'),'')::uuid)
                        where "SupplierCredits"."supplierCreditDate"::timestamp >= "values"."fromDate" and "SupplierCredits"."supplierCreditDate"::timestamp <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                            and  "TaxesData".id = "values"."taxId"
                        )
                        , "SupplierCreditData" as ( 
                        select  'InputTax' AS "parentType",
                                'SupplierCredit' AS "type",
                                "SupplierCredits"."supplierCreditNumber" AS "referenceNumber",
                                "SupplierCredits".id AS "referenceId",
                                Date("SupplierCredits"."supplierCreditDate")  AS "Date",
                                ("taxableAmount")  as "taxableAmount" ,
                                ( "TaxesData".name) as name,
                                ("supplierCreditLinesData"."mergedTaxAmount"::text::numeric) as vat,
                                (case when  "supplierCreditLinesData"."taxId" is null OR "supplierCreditLinesData"."taxPercentage"  = 0 then COALESCE("supplierCreditLinesData"."subTotal",0)::text::numeric  end ) as "none_taxableAmount",
                                (case when "supplierCreditLinesData"."isInclusiveTax" = false then( COALESCE("supplierCreditLinesData"."subTotal",0)::text::numeric+  COALESCE("supplierCreditLinesData"."mergedTaxAmount",0)::text::numeric )  
                                                                                else COALESCE("supplierCreditLinesData"."subTotal",0)::text::numeric - COALESCE("supplierCreditLinesData"."taxTotal",0)::text::numeric +  COALESCE("supplierCreditLinesData"."mergedTaxAmount",0)::text::numeric end ) as "totalAmount"
                        from "supplierCreditLinesData"
                        inner join "SupplierCredits" on "SupplierCredits".id = "supplierCreditLinesData"."supplierCreditId"
                        left join "TaxesData" on "TaxesData".id = "supplierCreditLinesData"."mergedTaxId" 
                        )
                        ,"CreditLinesStackedTax" as (
							select  "supplierCreditLinesData".id, "supplierCreditLinesData"."supplierCreditId",  nullif(nullif("elem"->>'taxId','null'),'') ::uuid as "taxId",
                            nullif(elem ->>'taxAmount','')::numeric as "taxTotal", nullif(elem ->>'index','')::numeric as "taxIndex"
						From "supplierCreditLinesData"
						cross  join   jsonb_array_elements("supplierCreditLinesData"."taxes") elem
						where "supplierCreditLinesData"."taxType" = 'stacked'
							and   NULLIF(NULLIF(( "elem"->>'taxId'),''),'null') is not null 
                        )

                        ,"CreditStackedTaxTotal" as (	
                        SELECT  "CreditLinesStackedTax"."taxId","supplierCreditId",
                        SUM("taxTotal" ) OVER ( PARTITION BY id order by "taxIndex" ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                        FROM "CreditLinesStackedTax"

                        )
                        , "SupplierCreditT1" as (
                        select  "parentType", "type",
                            "referenceNumber", "referenceId",
                            "Date", 
                            sum("taxableAmount") as "taxableAmount",
                            array_agg(distinct  "name" ) filter(where name is not null) as name,
                            sum("vat") as "vat",
                            sum("none_taxableAmount") as "none_taxableAmount",
                            sum("totalAmount") as "totalAmount"
                        from "SupplierCreditData" 
                        group by  "referenceId","parentType", "type","referenceNumber", "Date"
                        )
                        , "SupplierCreditT2" as (
                        select  "CreditStackedTaxTotal".* from "CreditStackedTaxTotal"
                        join "values" on true 
                        where  "values"."taxId" = "CreditStackedTaxTotal"."taxId"
                        )
                        ,"SupplierCreditTotal" as (
                        select  "parentType", "type",
                                "referenceNumber", "referenceId",
                                "Date", 
                                ("taxableAmount" + COALESCE( "SupplierCreditT2".amount,0))*(-1)  as "taxableAmount",
                                name,
                                (vat)*-1 as vat,
                                ( "none_taxableAmount")*(-1),
                                ( "totalAmount"+ COALESCE( "SupplierCreditT2".amount,0))*(-1) as "totalAmount"
                        from "SupplierCreditT1" 
                        left join "SupplierCreditT2" on  "SupplierCreditT1"."referenceId" =  "SupplierCreditT2"."supplierCreditId"

                        )
                        
                      select * from "BillingTotal"  union all select * from "ExpenseTotal" union all select * from "SupplierCreditTotal"
                        order by "parentType", "Date" asc,"referenceNumber" 

                       
                    
                    `,
                values: [companyId, branches, from, to, taxId]
            }


            const reprot = await DB.excu.query(query.text, query.values);


            if (reprot.rowCount && reprot.rowCount > 0) {
                return new ResponseData(true, "", reprot.rows)
            } else {
                return new ResponseData(true, "", [])
            }


        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getSalesVatDetailsByVatId(data: any, company: Company, brancheList: []) {
        try {

            let companyId = company.id;
            let branches = data.branchId ? [data.branchId] : brancheList;
            let taxId = data.taxId ? data.taxId : null
            if (!taxId) { throw new ValidationException("taxId is required") }


            //-------------- set time --------------
            let closingTime = "00:00:00"
            let fromDate = data.interval && data.interval.from ? data.interval.from : null;
            fromDate = moment(new Date(fromDate))
            let toDate = data.interval && data.interval.to ? moment(new Date(data.interval.to)) : moment(new Date());

            let timeOffset = company.timeOffset
            let interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, false, timeOffset)
            let from = interval.from
            let to = interval.to
            //---------------------------------------


            const query: { text: string, values: any } = {
                text: `with "values" as (
                        select $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::timestamp as "fromDate",
                            $4::timestamp as "toDate",
                            $5::uuid as "taxId"
                        )
    
                    ,"TaxesData" as(
                                select "Taxes".*
                                from "Taxes" 
                                join "values" on TRUE
                                where "Taxes"."companyId" = "values"."companyId" 
                         )
					
                        ,"invoiceLinesData" as (	
                        select "InvoiceLines" .* ,
                                COALESCE(nullif(nullif(elem->>'taxId', ''),'null')::uuid,"InvoiceLines"."taxId" ) as "mergedTaxId",
                                COALESCE(nullif(COALESCE(elem->>'taxAmount', elem->>'taxTotal'),'')::numeric,"InvoiceLines"."taxTotal" ) as "mergedTaxAmount"
                        from "InvoiceLines" 
                        join "values" on true
                        inner join "Invoices" on "Invoices".id  =  "InvoiceLines"."invoiceId" 
                        inner join "Branches" on "Branches".id = "Invoices"."branchId"
                        left  join  jsonb_array_elements(nullif("InvoiceLines"."taxes",'null') )as elem  on true
                        inner join "TaxesData" on "TaxesData".id = "InvoiceLines"."taxId" or ("TaxesData".name ='Exempt Tax' and "InvoiceLines"."taxId" is null) or ("TaxesData".id = nullif(nullif("elem"->>'taxId','null'),'')::uuid)
                        where "InvoiceLines"."createdAt" >= "values"."fromDate" and "InvoiceLines"."createdAt" <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                            and "Invoices"."status" <>'Draft' 
                            and "TaxesData"."companyId" = "values"."companyId"
                            and  "TaxesData".id = "values"."taxId"
                        )

                        , "invoiceChargesData" as (
                        select  	"Invoices" .* , 
                            COALESCE(nullif(nullif(elem->>'taxId', ''),'null'), nullif("Invoices"."chargesTaxDetails"->>'taxId',''))::uuid as "mergedTaxId",
                            nullif(COALESCE(COALESCE(elem->>'taxAmount', elem->>'taxTotal'), COALESCE("Invoices"."chargesTaxDetails"->>'taxAmount',"Invoices"."chargesTaxDetails"->>'taxTotal')  ),'')::numeric as "mergedTaxAmount"
                        from "Invoices"
                        join "values" on true  
                        inner join "Branches" on "Branches".id = "Invoices"."branchId"
                        left  join  jsonb_array_elements(nullif("Invoices"."chargesTaxDetails"->>'taxes','')::jsonb )as elem  on true
                        inner join "TaxesData" on "TaxesData".id = (nullIf(nullIf("Invoices"."chargesTaxDetails"->>'taxId',''),'null'))::uuid or  ("TaxesData".name ='Exempt Tax' and (nullIf(nullIf("Invoices"."chargesTaxDetails"->>'taxId',''),'null'))::uuid is null) or ("TaxesData".id =  nullif(nullif("elem"->>'taxId','null'),'')::uuid)
                        where "Invoices"."createdAt" >= "values"."fromDate" and "Invoices"."createdAt" <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                            and "Invoices"."status" <>'Draft'   
                            and "TaxesData"."companyId" = "values"."companyId"
                            and "TaxesData".id = "values"."taxId"
                            and  "Invoices"."chargeTotal" <> 0
                        )


                        , "InvoiceData" as ( 
                        select  'InputTax' AS "parentType",
                                'Invoice' AS "type",
                                "Invoices"."invoiceNumber" AS "referenceNumber",
                                "Invoices".id AS "referenceId",
                                Date("Invoices"."createdAt")  AS "Date",
                                (case when  "invoiceLinesData"."taxPercentage" <> 0  then (case when "invoiceLinesData"."isInclusiveTax" = true 
                                                    then( COALESCE("invoiceLinesData"."subTotal",0)::text::numeric -  COALESCE("invoiceLinesData"."taxTotal",0)::text::numeric ) - COALESCE("invoiceLinesData"."discountTotal",0)::text::numeric 
                                                    else COALESCE("invoiceLinesData"."subTotal",0)::text::numeric - COALESCE("invoiceLinesData"."discountTotal",0)::text::numeric end ) end)  as "taxableAmount" ,
                                ( "TaxesData".name) as name,
                                ("invoiceLinesData"."mergedTaxAmount"::text::numeric) as vat,
                                (case when  "invoiceLinesData"."taxId" is null OR "invoiceLinesData"."taxPercentage"  = 0 then COALESCE("invoiceLinesData"."subTotal",0)::text::numeric - COALESCE("invoiceLinesData"."discountTotal",0)::text::numeric end ) as "none_taxableAmount",
                                (case when "invoiceLinesData"."isInclusiveTax" = false then( COALESCE("invoiceLinesData"."subTotal",0)::text::numeric+  COALESCE("invoiceLinesData"."mergedTaxAmount",0)::text::numeric )   - COALESCE ("invoiceLinesData"."discountTotal",0)::text::numeric 
                                                                                    else COALESCE("invoiceLinesData"."subTotal",0)::text::numeric - COALESCE("invoiceLinesData"."taxTotal",0)::text::numeric +  COALESCE("invoiceLinesData"."mergedTaxAmount",0)::text::numeric - COALESCE("invoiceLinesData"."discountTotal",0)::text::numeric end ) as "totalAmount"
                        from "invoiceLinesData"
                        inner join "Invoices" on "Invoices".id = "invoiceLinesData"."invoiceId"
                        left join "TaxesData" on "TaxesData".id = "invoiceLinesData"."mergedTaxId" 

                        union all 

                        select  'InputTax' AS "parentType",
                                'Invoice' AS "type",
                                "invoiceChargesData"."invoiceNumber" AS "referenceNumber",
                                "invoiceChargesData".id AS "referenceId",
                                Date("invoiceChargesData"."createdAt")  AS "Date",

                                case when  ("invoiceChargesData"."chargesTaxDetails"->'taxId' is not null and COALESCE( nullif("invoiceChargesData"."chargesTaxDetails"->>'taxPercentage','')::numeric,0)<>0) then COALESCE("invoiceChargesData"."chargeTotal",0)::text::numeric   end  as "taxableAmount" ,
                                "TaxesData".name as  name,
                                ("invoiceChargesData"."mergedTaxAmount"::text::numeric) as vat,
                                case when  ("invoiceChargesData"."chargesTaxDetails" is  null OR "invoiceChargesData"."chargesTaxDetails"->'taxId' is null OR  COALESCE( nullif("invoiceChargesData"."chargesTaxDetails"->>'taxPercentage','')::numeric,0)= 0) then COALESCE("invoiceChargesData"."chargeTotal",0)::text::numeric   end   as "none_taxableAmount",
                                "invoiceChargesData"."chargeTotal" + COALESCE(nullif(COALESCE("invoiceChargesData"."chargesTaxDetails"->>'taxAmount', "invoiceChargesData"."chargesTaxDetails"->>'taxTotal'),'')::numeric,0) as "totalAmount"
                        from "invoiceChargesData"
                        LEFT join "TaxesData" on "TaxesData".id = "invoiceChargesData"."mergedTaxId" 

                        )

                        ,"LinesStackedTax" as (

                        select  "invoiceLinesData".id, "invoiceLinesData"."invoiceId",  nullif(nullif("elem"->>'taxId','null'),'') ::uuid as "taxId",
                                nullif(elem ->>'taxAmount','')::numeric as "taxTotal", nullif(elem ->>'index','')::numeric as "index"
                        From "invoiceLinesData"
                        cross  join   jsonb_array_elements("invoiceLinesData"."taxes") elem
                        where "invoiceLinesData"."taxType" = 'stacked'
                        and   NULLIF(NULLIF(( "elem"->>'taxId'),''),'null') is not null 
                        )
                        ,"chargesStackedTax" as (	 
                        select	"invoiceChargesData".id,  nullif(nullif("elem"->>'taxId','null'),'') ::uuid as "taxId", nullif("elem"->>'index','')::numeric as "index",
                                nullif(COALESCE(elem ->>'taxAmount',elem ->>'totalAmount' ),'')::numeric as "taxTotal" 
                        from "invoiceChargesData"
                        cross  join   jsonb_array_elements("invoiceChargesData"."chargesTaxDetails"->'taxes') elem
                        where  "invoiceChargesData"."chargesTaxDetails"->>'type'= 'stacked'
                                and  NULLIF(NULLIF(( "elem"->>'taxId'),''),'null') is not null 
                        )
                        ,"InvoiceStackedTaxTotal" as (	

                        SELECT  "LinesStackedTax"."taxId","invoiceId",
                        SUM("taxTotal" ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                        FROM "LinesStackedTax"
                            
                        union all 
                            
                        SELECT  "chargesStackedTax"."taxId", id as "invoiceId",
                        SUM("taxTotal" ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                        FROM "chargesStackedTax"

                        )
                        , "InvoiceT1" as (
                        select  "parentType", "type",
                            "referenceNumber", "referenceId",
                            "Date", 
                            sum("taxableAmount") as "taxableAmount",
                            array_agg(distinct  "name" ) filter(where name is not null) as name,
                            sum("vat") as "vat",
                            sum("none_taxableAmount") as "none_taxableAmount",
                            sum("totalAmount") as "totalAmount"
                        from "InvoiceData" 
                        group by  "referenceId","parentType", "type","referenceNumber", "Date"
                        )
                        , "InvoiceT2" as (
                        select  "InvoiceStackedTaxTotal".* 
                        from "InvoiceStackedTaxTotal"
                        join "values" on true 
                        where  "values"."taxId" = "InvoiceStackedTaxTotal"."taxId"
                        )

                        ,"InvoiceTotal" as (
                        select  "parentType", "type",
                            "referenceNumber", "referenceId",
                            "Date", 
                            "taxableAmount" + COALESCE( "InvoiceT2".amount,0)  as "taxableAmount",
                            name,
                            "vat",
                            "none_taxableAmount",
                            "totalAmount"+ COALESCE( "InvoiceT2".amount,0) as "totalAmount"
                        from "InvoiceT1" 
                        left join "InvoiceT2" on  "InvoiceT1"."referenceId" =  "InvoiceT2"."invoiceId"

                        )

                        , "creditNoteLinesData" as (	
                        select "CreditNoteLines" .* , 
                                COALESCE(nullif(nullif(elem->>'taxId', ''),'null')::uuid,"CreditNoteLines"."taxId" ) as "mergedTaxId",
                                COALESCE(nullif(COALESCE(elem->>'taxAmount', elem->>'taxTotal'),'')::numeric,"CreditNoteLines"."taxTotal" ) as "mergedTaxAmount"
                        from "CreditNoteLines" 
                        join "values" on true
                        inner join "CreditNotes" on "CreditNotes".id  =  "CreditNoteLines"."creditNoteId" 
                        inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
                        left  join  jsonb_array_elements(nullif("CreditNoteLines"."taxes",'null') )as elem  on true
                        inner join "TaxesData" on "TaxesData".id = "CreditNoteLines"."taxId" or ("TaxesData".name ='Exempt Tax' and "CreditNoteLines"."taxId" is null) or ("TaxesData".id =  nullif(nullif("elem"->>'taxId','null'),'')::uuid)
                        where "CreditNoteLines"."createdAt" >= "values"."fromDate" and "CreditNoteLines"."createdAt" <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                            and  "TaxesData".id = "values"."taxId"
                        )
                        , "creditNoteChargesData" as (
                        select  "CreditNotes" .* , 
                                COALESCE(nullif(nullif(elem->>'taxId', ''),'null')	, nullif("CreditNotes"."chargesTaxDetails"->>'taxId',''))::uuid as "mergedTaxId",
                                nullif( COALESCE(COALESCE(elem->>'taxAmount', elem->>'taxTotal'),COALESCE("CreditNotes"."chargesTaxDetails"->>'taxAmount',"CreditNotes"."chargesTaxDetails"->>'taxTotal')  ),'')::numeric as "mergedTaxAmount"
                        from "CreditNotes"
                        join "values" on true  
                        inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
                        left  join  jsonb_array_elements(nullif("CreditNotes"."chargesTaxDetails"->>'taxes','')::jsonb )as elem  on true
                        inner join "TaxesData" on "TaxesData".id = (nullIf("CreditNotes"."chargesTaxDetails"->>'taxId',''))::uuid or  ("TaxesData".name ='Exempt Tax' and (nullIf("CreditNotes"."chargesTaxDetails"->>'taxId',''))::uuid  is null) or ("TaxesData".id =  nullif(nullif("elem"->>'taxId','null'),'')::uuid)
                        where "CreditNotes"."createdAt" >= "values"."fromDate" and "CreditNotes"."createdAt" <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                            and "TaxesData".id = "values"."taxId"
                            and  "CreditNotes"."chargeTotal" <> 0

                        )
                        , "CreditNoteData" as ( 
                        select  'InputTax' AS "parentType",
                                'CreditNote' AS "type",
                                "CreditNotes"."creditNoteNumber" AS "referenceNumber",
                                "CreditNotes".id AS "referenceId",
                                Date("CreditNotes"."createdAt")  AS "Date",
                                (case when  "creditNoteLinesData"."taxPercentage" <> 0  then (case when "creditNoteLinesData"."isInclusiveTax" = true 
                                                then( COALESCE("creditNoteLinesData"."subTotal",0)::text::numeric -  COALESCE("creditNoteLinesData"."taxTotal",0)::text::numeric ) - COALESCE("creditNoteLinesData"."discountTotal",0)::text::numeric 
                                                else COALESCE("creditNoteLinesData"."subTotal",0)::text::numeric - COALESCE("creditNoteLinesData"."discountTotal",0)::text::numeric end ) end)  as "taxableAmount" ,
                                ( "TaxesData".name) as name,
                                ("creditNoteLinesData"."mergedTaxAmount"::text::numeric) as vat,
                                (case when  "creditNoteLinesData"."taxId" is null OR "creditNoteLinesData"."taxPercentage"  = 0 then COALESCE("creditNoteLinesData"."subTotal",0)::text::numeric - COALESCE("creditNoteLinesData"."discountTotal",0)::text::numeric end ) as "none_taxableAmount",
                                (case when "creditNoteLinesData"."isInclusiveTax" = false then( COALESCE("creditNoteLinesData"."subTotal",0)::text::numeric+  COALESCE("creditNoteLinesData"."mergedTaxAmount",0)::text::numeric )   - COALESCE ("creditNoteLinesData"."discountTotal",0)::text::numeric 
                                                                                else COALESCE("creditNoteLinesData"."subTotal",0)::text::numeric - COALESCE("creditNoteLinesData"."taxTotal",0)::text::numeric +  COALESCE("creditNoteLinesData"."mergedTaxAmount",0)::text::numeric - COALESCE("creditNoteLinesData"."discountTotal",0)::text::numeric end ) as "totalAmount"
                        from "creditNoteLinesData"
                        inner join "CreditNotes" on "CreditNotes".id = "creditNoteLinesData"."creditNoteId"
                        left join "TaxesData" on "TaxesData".id = "creditNoteLinesData"."mergedTaxId" 

                        union all 

                        select  'InputTax' AS "parentType",
                                'CreditNote' AS "type",
                                "creditNoteChargesData"."creditNoteNumber" AS "referenceNumber",
                                "creditNoteChargesData".id AS "referenceId",
                                Date("creditNoteChargesData"."createdAt")  AS "Date",

                                case when  ("creditNoteChargesData"."chargesTaxDetails"->'taxId' is not null and COALESCE( nullif("creditNoteChargesData"."chargesTaxDetails"->>'taxPercentage','')::numeric,0)<>0) then COALESCE("creditNoteChargesData"."chargeTotal",0)::text::numeric   end  as "taxableAmount" ,
                                "TaxesData".name as  name,
                                ("creditNoteChargesData"."mergedTaxAmount"::text::numeric) as vat,
                                case when  ("creditNoteChargesData"."chargesTaxDetails" is  null OR "creditNoteChargesData"."chargesTaxDetails"->'taxId' is null OR  COALESCE( nullif("creditNoteChargesData"."chargesTaxDetails"->>'taxPercentage','')::numeric,0)= 0) then COALESCE("creditNoteChargesData"."chargeTotal",0)::text::numeric   end   as "none_taxableAmount",
                        "creditNoteChargesData"."chargeTotal" + COALESCE(COALESCE("creditNoteChargesData"."chargesTaxDetails"->>'taxAmount', "creditNoteChargesData"."chargesTaxDetails"->>'taxTotal')::numeric,0) as "totalAmount"
                        from "creditNoteChargesData"
                        left join "TaxesData" on "TaxesData".id = "creditNoteChargesData"."mergedTaxId" 

                        )
                        ,"CreditLinesStackedTax" as (
                        select  "creditNoteLinesData".id, "creditNoteLinesData"."creditNoteId",  nullif(nullif("elem"->>'taxId','null'),'') ::uuid as "taxId",
                            nullif (elem ->>'taxAmount','')::numeric as "taxTotal", nullif(elem ->>'index','')::numeric as "index"
                        from "creditNoteLinesData"
                        cross  join   jsonb_array_elements("creditNoteLinesData"."taxes") elem
                        where "creditNoteLinesData"."taxType" = 'stacked'
                        and   NULLIF(NULLIF(( "elem"->>'taxId'),''),'null') is not null 
                        )

                        ,"CreditChargesStackedTax" as (	 
                        select	"creditNoteChargesData".id,	  nullif(nullif("elem"->>'taxId','null'),'') ::uuid as "taxId", nullif("elem"->>'index','')::numeric as "index",
                                COALESCE(nullif(elem ->>'taxAmount',''),elem ->>'totalAmount' )::numeric as "taxTotal" 
                        from "creditNoteChargesData"
                        cross  join   jsonb_array_elements("creditNoteChargesData"."chargesTaxDetails"->'taxes') elem
                        where "creditNoteChargesData"."chargesTaxDetails"->>'type'= 'stacked'
                            and  NULLIF(NULLIF(( "elem"->>'taxId'),''),'null') is not null 
                        )
                        ,"CreditStackedTaxTotal" as (	
                        SELECT  "CreditLinesStackedTax"."taxId","creditNoteId",
                        SUM("taxTotal" ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                        FROM "CreditLinesStackedTax"

                        union all 
                            
                        SELECT  "CreditChargesStackedTax"."taxId", id as "creditNoteId",
                        SUM("taxTotal" ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                        FROM "CreditChargesStackedTax"

                        )
                        , "CreditNoteT1" as (
                        select  "parentType", "type",
                            "referenceNumber", "referenceId",
                            "Date", 
                            sum("taxableAmount") as "taxableAmount",
                            array_agg(distinct  "name" ) filter(where name is not null) as name,
                            sum("vat") as "vat",
                            sum("none_taxableAmount") as "none_taxableAmount",
                            sum("totalAmount") as "totalAmount"
                        from "CreditNoteData" 
                        group by  "referenceId","parentType", "type","referenceNumber", "Date"
                        )
                        , "CreditNoteT2" as (
                        select  "CreditStackedTaxTotal".* from "CreditStackedTaxTotal"
                        join "values" on true 
                        where  "values"."taxId" = "CreditStackedTaxTotal"."taxId"
                        )
                        ,"CreditNoteTotal" as (
                        select  "parentType", "type",
                                "referenceNumber", "referenceId",
                                "Date", 
                                ("taxableAmount" + COALESCE( "CreditNoteT2".amount,0))*(-1)  as "taxableAmount",
                                name,
                                (vat)*-1 as vat,
                                ( "none_taxableAmount")*(-1),
                                ( "totalAmount"+ COALESCE( "CreditNoteT2".amount,0))*(-1) as "totalAmount"
                        from "CreditNoteT1" 
                        left join "CreditNoteT2" on  "CreditNoteT1"."referenceId" =  "CreditNoteT2"."creditNoteId"

                        )


                   select * from "InvoiceTotal" union all select * from "CreditNoteTotal"

                    order by "parentType", "Date"  asc	,"referenceNumber"
                    
                    `,
                values: [companyId, branches, from, to, taxId]
            }


            const reprot = await DB.excu.query(query.text, query.values);

            if (reprot.rowCount && reprot.rowCount > 0) {
                return new ResponseData(true, "", reprot.rows)
            } else {
                return new ResponseData(true, "", [])
            }

            return new ResponseData(true, "", reprot.rows)
        } catch (error: any) {
            throw new Error(error)
        }
    }




    //new Reports
    public static async getSalesVatReport(data: any, company: Company, brancheList: []) {
        const client = await DB.excu.client();
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;


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
            await client.query("BEGIN")


            const query = {
                text: `with "values" as (
                    select $1::uuid as "companyId",
                        $2::uuid[] as "branches",
                        $3::timestamp as "fromDate",
                        $4::timestamp as "toDate"
                        
                 )
                 , "taxes" as(
                    select id, name, "taxPercentage" 
                    from "Taxes" 
                    join "values" on TRUE
                    where "Taxes"."companyId" = "values"."companyId" 
                        and( jsonb_array_length ("Taxes"."taxes") = 0 or  "Taxes"."taxes" is null)
                ) 
                `,

                values: [companyId, branches, from, to]
            }

            let text =
                ` , "invoiceChargesData" as (	
                select "Invoices".id, 
                    nullif("Invoices"."chargesTaxDetails"->>'taxes','')::jsonb as taxes, 
                    "Invoices"."chargesTaxDetails"->>'type' as "type",
                    COALESCE(nullif(nullif(elem.value->>'taxId', ''),'null'),nullif(nullif("Invoices"."chargesTaxDetails"->>'taxId', ''),'null') )::uuid as "mergedTaxId",
					(elem.index -1)::real as "index",
                    COALESCE(nullif(COALESCE(elem.value->>'taxAmount', elem.value->>'taxTotal'),''))::real as "mergedTaxAmount",
                    "Invoices"."chargeTotal" as "amount",
                   ( "Invoices"."chargesTaxDetails"->>'taxAmount')::real as"taxTotal",
                    		"Invoices"."isInclusiveTax"
                from "Invoices" 
                join "values" on true
                left  join  jsonb_array_elements(nullif( "Invoices"."chargesTaxDetails"->>'taxes','null')::jsonb )WITH ORDINALITY  elem (value, index) on true
                where   "Invoices"."companyId" = "values"."companyId"
                and (  array_length("values"."branches",1) IS NULL or "Invoices"."branchId" = any("values"."branches")) 
                and "Invoices"."status" <>'Draft' 
                and  "Invoices"."createdAt" >= "values"."fromDate" and "Invoices"."createdAt" <"values"."toDate" 
                    and "Invoices"."chargeTotal" <> 0 
                )
                ,"ChargesStackedTax" as (	
                select "invoiceChargesData".id,  "mergedTaxId" as "taxId",
                    "mergedTaxAmount" as "taxTotal", 
                  "index"
                From "invoiceChargesData"
                
                where  "type"= 'stacked' 

                )
                ,"ChargesStackedTaxTotal" as (	
                SELECT  "taxId", 0 as "taxAmount",
                    SUM("taxTotal" ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                FROM "ChargesStackedTax"
                )

                ,"invoiceLines" as (	
                select "InvoiceLines".id, COALESCE(nullif(nullif(elem.value->>'taxId', ''),'null')::uuid,"InvoiceLines"."taxId" ) as "mergedTaxId",  (elem.index -1 )::real as "index",
                    COALESCE(nullif(COALESCE(elem.value->>'taxAmount', elem.value->>'taxTotal'),'')::real,"InvoiceLines"."taxTotal" ) as "mergedTaxAmount",
                    "InvoiceLines"."taxes", 
                    "InvoiceLines"."isInclusiveTax",
                    "InvoiceLines"."subTotal",
                    "InvoiceLines"."taxTotal",
                    "InvoiceLines"."taxType",
                    "InvoiceLines"."discountTotal",
                    "InvoiceLines"."invoiceId"
                from "InvoiceLines" 
                join "values" on true               
                left  join  jsonb_array_elements(nullif("InvoiceLines"."taxes",'null') ) WITH ORDINALITY  elem (value, index)  on nullif("InvoiceLines"."taxType",'') is not null
                where "InvoiceLines"."companyId" = "values"."companyId"
                and (  array_length("values"."branches",1) IS NULL or "InvoiceLines"."branchId" = any("values"."branches")) 
                and "InvoiceLines"."createdAt" >= "values"."fromDate" and "InvoiceLines"."createdAt" <"values"."toDate"
                    
                   
                ), "invoiceLinesData" as (
                 
                select "invoiceLines".id, "invoiceLines"."mergedTaxId", "invoiceLines"."index",
                    "invoiceLines"."mergedTaxAmount", "invoiceLines"."taxes", 
                    "invoiceLines"."isInclusiveTax", "invoiceLines"."subTotal",
                    "invoiceLines"."taxTotal", "invoiceLines"."taxType",
                    "invoiceLines"."discountTotal", "invoiceLines"."invoiceId"

                    from "invoiceLines"
                     inner join "Invoices" on "Invoices".id  =  "invoiceLines"."invoiceId" and  "Invoices" ."status" <>'Draft'
                )
                ,"LinesStackedTax" as (	
                select "invoiceLinesData".id, "mergedTaxId" as "taxId",
                    "mergedTaxAmount" as "taxTotal", 
                  "index"
                From "invoiceLinesData"
                where "taxType" = 'stacked'
                )
                ,"LineStackedTaxTotal" as (	
                SELECT  "taxId", 0 as "taxAmount",
                    SUM("taxTotal" ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                FROM "LinesStackedTax"
                )
			
			
                select "taxes".id  as  "taxId", "taxes".name as "taxName" , sum("amount") as "Total", 0 as  "Adjusments",  sum("taxAmount") as "vatTotal"
                from (
                select "mergedTaxId" as "taxId", 
                sum("mergedTaxAmount"::text::numeric) as "taxAmount",
                sum( (case when "isInclusiveTax" then COALESCE("subTotal",0) -  COALESCE("taxTotal",0) else COALESCE("subTotal",0)end)  - COALESCE("discountTotal",0)  ) as "amount"
                from "invoiceLinesData"
                group by "mergedTaxId"

                union all
                select * from "LineStackedTaxTotal"
                
                union all 
                select "mergedTaxId" as "taxId", 
                sum("mergedTaxAmount"::text::numeric) as "taxAmount",
                         sum(case when "isInclusiveTax" then  "amount" - "taxTotal" else "amount" end   ) as "amount"
                                from "invoiceChargesData"
                group by "mergedTaxId"
                
                union all
                select * from "ChargesStackedTaxTotal"
                ) T
                inner join "taxes" on "taxes".id = T."taxId" or ("taxes".name ='Exempt Tax' and T."taxId" is null) 
                group by "taxes".id , "taxName"
     

          
            `
            let records = await client.query(query.text + text, query.values)
            const invoicesData = records.rows && records.rows.length > 0 ? records.rows : []

            text =
                `  , "creditNoteChargesData" as (	
            select "CreditNotes".id, 
                nullif("CreditNotes"."chargesTaxDetails"->>'taxes','')::jsonb as taxes,
                "CreditNotes"."chargesTaxDetails"->>'type' as "type",
                COALESCE(nullif(nullif(elem.value->>'taxId', ''),'null'),nullif(nullif("CreditNotes"."chargesTaxDetails"->>'taxId', ''),'null') )::uuid as "mergedTaxId",
					  (elem.index -1)::numeric as "index",
                      nullif(COALESCE(elem.value->>'taxAmount', elem.value->>'taxTotal'),'')::numeric as "mergedTaxAmount",
                "CreditNotes"."chargeTotal" as "amount",
                        ( "CreditNotes"."chargesTaxDetails"->>'taxAmount')::real as"taxTotal",
                	"CreditNotes"."isInclusiveTax"
            from "CreditNotes" 
            join "values" on true
            inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
            left  join  jsonb_array_elements(nullif( "CreditNotes"."chargesTaxDetails"->>'taxes','null')::jsonb )WITH ORDINALITY  elem (value, index) on true
     
                where "CreditNotes"."companyId" = "values"."companyId"
                and (  array_length("values"."branches",1) IS NULL or "CreditNotes"."branchId" = any("values"."branches")) 
                and "CreditNotes"."createdAt" >= "values"."fromDate" and "CreditNotes"."createdAt" <"values"."toDate"
                and "CreditNotes"."chargeTotal" <> 0 
            )
            ,"ChargesStackedTax" as (	
            select "creditNoteChargesData".id, "mergedTaxId" as "taxId",
               "mergedTaxAmount" as "taxTotal", 
                "index"
            From "creditNoteChargesData"
           
            where  "type"= 'stacked' 

            )
            ,"ChargesStackedTaxTotal" as (	
            SELECT  "taxId", 0 as "taxAmount",
                SUM("taxTotal" ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
            FROM "ChargesStackedTax"
            )

            , "creditNoteLinesData" as (	
            select "CreditNoteLines".id, COALESCE(nullif(nullif(elem.value->>'taxId', ''),'null')::uuid,"CreditNoteLines"."taxId" ) as "mergedTaxId",
				 (elem.index - 1)::numeric as "index",
                COALESCE(nullif(COALESCE(elem.value->>'taxAmount', elem.value->>'taxTotal'),'')::numeric,"CreditNoteLines"."taxTotal" ) as "mergedTaxAmount",
                "CreditNoteLines"."taxes", 
                "CreditNoteLines"."isInclusiveTax",
                "CreditNoteLines"."subTotal",
                "CreditNoteLines"."taxTotal",
                "CreditNoteLines"."taxType",
                "CreditNoteLines"."discountTotal"

            from "CreditNoteLines" 
            join "values" on true
            inner join "CreditNotes" on "CreditNotes".id  =  "CreditNoteLines"."creditNoteId" 
            inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
            left  join  jsonb_array_elements(nullif("CreditNoteLines"."taxes",'null') )WITH ORDINALITY  elem (value, index)  on nullif("CreditNoteLines"."taxType",'') is not null
            
                where "CreditNoteLines"."companyId" = "values"."companyId"
                and (  array_length("values"."branches",1) IS NULL or "CreditNoteLines"."branchId" = any("values"."branches")) 
                and "CreditNoteLines"."createdAt" >= "values"."fromDate" and "CreditNoteLines"."createdAt" <"values"."toDate"
            )
            ,"LinesStackedTax" as (	
            select "creditNoteLinesData".id,"mergedTaxId" as "taxId",
               "mergedTaxAmount" as "taxTotal", 
                "index" 
               
            From "creditNoteLinesData"
           
            where "taxType" = 'stacked'

            )
            ,"LineStackedTaxTotal" as (	
            SELECT  "taxId", 0 as "taxAmount",
                SUM("taxTotal" ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
            FROM "LinesStackedTax"
            )
            select "taxes".id  as  "taxId", "taxes".name as "taxName" ,0 as "Total", sum("amount")  as  "Adjusments",  sum("taxAmount") as "vatTotal"
            from (
            select "mergedTaxId" as "taxId", 
            sum("mergedTaxAmount"::text::numeric) as "taxAmount",
            sum( (case when "isInclusiveTax" then COALESCE("subTotal",0) -  COALESCE("taxTotal",0) else COALESCE("subTotal",0)end)  - COALESCE("discountTotal",0)  ) as "amount"
            from "creditNoteLinesData"
            group by "mergedTaxId"

            union all
            select * from "LineStackedTaxTotal"
            union all 

            select "mergedTaxId" as "taxId", 
            sum("mergedTaxAmount"::text::numeric) as "taxAmount",
              sum(case when "isInclusiveTax" then  "amount" - "taxTotal" else "amount" end   ) as "amount"
            from "creditNoteChargesData"
            group by "mergedTaxId"
            union all
            select * from "ChargesStackedTaxTotal"
            ) T
            inner join "taxes" on "taxes".id = T."taxId" or ("taxes".name ='Exempt Tax' and T."taxId" is null) 
            group by "taxes".id , "taxName"
          
            `
            records = await client.query(query.text + text, query.values)
            const creditNotesData = records.rows && records.rows.length > 0 ? records.rows : []


            let result2: any[] = [];

            creditNotesData.forEach((elem: any) => {

                let invoiceTaxData = invoicesData.find(obj => obj.taxId == elem.taxId)

                if (invoiceTaxData != null) {
                    invoicesData.splice(invoicesData.indexOf(invoiceTaxData), 1)
                    invoiceTaxData.Adjusments = elem.Adjusments
                    invoiceTaxData.vatTotal -= elem.vatTotal
                    result2.push(invoiceTaxData)
                } else {
                    result2.push(elem)
                }

            })

            let resData = [...invoicesData, ...result2]






            await client.query("COMMIT")
            return new ResponseData(true, "", resData)

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async getPurchaseVatReport(data: any, company: Company, brancheList: []) {
        const client = await DB.excu.client();
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;


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
            await client.query("BEGIN")


            const query = {
                text: `with "values" as (
                    select $1::uuid as "companyId",
                        $2::uuid[] as "branches",
                        $3::timestamp as "fromDate",
                        $4::timestamp as "toDate"
                        
                 )
                 , "taxes" as(
                    select id, name, "taxPercentage" 
                    from "Taxes" 
                    join "values" on TRUE
                    where "Taxes"."companyId" = "values"."companyId" 
                        and( jsonb_array_length ("Taxes"."taxes") = 0 or  "Taxes"."taxes" is null)
                ) 
                `,

                values: [companyId, branches, from, to]
            }

            let text =
                `   ,"billingLinesData" as (	
                select "BillingLines".id, COALESCE(nullif(nullif(elem->>'taxId', ''),'null')::uuid,"BillingLines"."taxId" ) as "mergedTaxId",
				nullif(elem ->>'index','')::real as "index",
                    COALESCE(nullif(COALESCE(elem->>'taxAmount', elem->>'taxTotal'),'')::real,"BillingLines"."taxTotal" ) as "mergedTaxAmount",
                    "BillingLines"."taxes", 
                    "BillingLines"."isInclusiveTax",
                    "BillingLines"."subTotal",
                    "BillingLines"."taxableAmount",
                    "BillingLines"."taxTotal",
                    "BillingLines"."taxType"
                from "BillingLines" 
                join "values" on true
                inner join "Billings" on "Billings".id  =  "BillingLines"."billingId" 
                inner join "Branches" on "Branches".id = "Billings"."branchId"
                LEFT JOIN "BillOfEntryLines" on "BillingLines"."id" = "BillOfEntryLines"."billingLineId"
                left  join  jsonb_array_elements(nullif("BillingLines"."taxes",'null') )as elem  on nullif("BillingLines"."taxType",'') is not null
                where "Billings"."billingDate"::timestamp >= "values"."fromDate" and "Billings"."billingDate"::timestamp <"values"."toDate"
                    and "Branches"."companyId" = "values"."companyId"
                    and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                    and "Billings"."status" <>'Draft' 
                    and ("BillOfEntryLines"."taxId" is null or "BillOfEntryLines"."taxTotal" = 0 or "BillOfEntryLines".id is null )
					UNION ALL
					select "ExpenseLines".id, COALESCE(nullif(nullif(elem->>'taxId', ''),'null')::uuid,"ExpenseLines"."taxId" ) as "mergedTaxId",
				nullif(elem ->>'index','')::real as "index",
                    COALESCE(nullif(COALESCE(elem->>'taxAmount', elem->>'taxTotal'),'')::real,"ExpenseLines"."taxTotal" ) as "mergedTaxAmount",
                    "ExpenseLines"."taxes", 
                    "ExpenseLines"."isInclusiveTax",
                    "ExpenseLines"."amount" as "subTotal" ,
                    case when  "ExpenseLines"."isInclusiveTax" then  "ExpenseLines"."amount" -    "ExpenseLines"."taxTotal"  else "ExpenseLines"."amount" end  as "taxableAmount" ,
                    "ExpenseLines"."taxTotal",
                    "ExpenseLines"."taxType"
                from "ExpenseLines" 
                join "values" on true
                inner join "Expenses" on "Expenses".id  =  "ExpenseLines"."expenseId" 
                inner join "Branches" on "Branches".id = "Expenses"."branchId"
                left  join  jsonb_array_elements(nullif("ExpenseLines"."taxes",'null') )as elem  on nullif("ExpenseLines"."taxType",'') is not null
                where "Expenses"."expenseDate"::timestamp >= "values"."fromDate" and "Expenses"."expenseDate"::timestamp <"values"."toDate"
                    and "Branches"."companyId" = "values"."companyId"
                    and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                   
                )
                ,"LinesStackedTax" as (	
                select "billingLinesData".id, "mergedTaxId" as "taxId",
                   "mergedTaxAmount" as "taxTotal", 
                    "index"
                From "billingLinesData"
              
                where "taxType" = 'stacked'
                )
                ,"LineStackedTaxTotal" as (	
                SELECT  "taxId", 0 as "taxAmount",
                    SUM("taxTotal" ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                FROM "LinesStackedTax"
                )
                select "taxes".id  as  "taxId", "taxes".name as "taxName" , sum("amount") as "Total", 0 as  "Adjusments",  sum("taxAmount") as "vatTotal"
                from (
                select "mergedTaxId" as "taxId", 
                sum("mergedTaxAmount") as "taxAmount",
                sum( "taxableAmount"   ) as "amount"
                from "billingLinesData"
                group by "mergedTaxId"

                union all
                select * from "LineStackedTaxTotal"
                
                
                ) T
                inner join "taxes" on "taxes".id = T."taxId" or ("taxes".name ='Exempt Tax' and T."taxId" is null) 
                group by "taxes".id , "taxName"
           
            `
            let records = await client.query(query.text + text, query.values)
            const invoicesData = records.rows && records.rows.length > 0 ? records.rows : []

            text =
                `
             , "supplierCreditLinesData" as (	
            select "SupplierCreditLines".id, COALESCE(nullif(nullif(elem->>'taxId', ''),'null')::uuid,"SupplierCreditLines"."taxId" ) as "mergedTaxId",
				 nullif(elem ->>'index','')::numeric as "index",
                COALESCE(nullif(COALESCE(elem->>'taxAmount', elem->>'taxTotal'),'')::numeric,"SupplierCreditLines"."taxTotal" ) as "mergedTaxAmount",
                "SupplierCreditLines"."taxes", 
                "SupplierCreditLines"."isInclusiveTax",
                "SupplierCreditLines"."taxableAmount",
                "SupplierCreditLines"."taxTotal",
                "SupplierCreditLines"."taxType"

            from "SupplierCreditLines" 
            join "values" on true
            inner join "SupplierCredits" on "SupplierCredits".id  =  "SupplierCreditLines"."supplierCreditId" 
            inner join "Branches" on "Branches".id = "SupplierCredits"."branchId"
            left  join  jsonb_array_elements(nullif("SupplierCreditLines"."taxes",'null') )as elem  on nullif("SupplierCreditLines"."taxType",'') is not null
            where "SupplierCredits"."supplierCreditDate"::timestamp >= "values"."fromDate" and "SupplierCredits"."supplierCreditDate"::timestamp <"values"."toDate"
                and "Branches"."companyId" = "values"."companyId"
                and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 

            )
            ,"LinesStackedTax" as (	
            select "supplierCreditLinesData".id,  "mergedTaxId" as "taxId",
               "mergedTaxAmount" as "taxTotal", 
                "index"
            From "supplierCreditLinesData"
            
            where "taxType" = 'stacked'

            )
            ,"LineStackedTaxTotal" as (	
            SELECT  "taxId", 0 as "taxAmount",
                SUM("taxTotal" ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
            FROM "LinesStackedTax"
            )
            select "taxes".id  as  "taxId", "taxes".name as "taxName" ,0 as "Total", sum("amount")  as  "Adjusments",  sum("taxAmount") as "vatTotal"
            from (
            select "mergedTaxId" as "taxId", 
            sum("mergedTaxAmount") as "taxAmount",
            sum( "taxableAmount"    ) as "amount"
            from "supplierCreditLinesData"
            group by "mergedTaxId"

            union all
            select * from "LineStackedTaxTotal"

            ) T
            inner join "taxes" on "taxes".id = T."taxId" or ("taxes".name ='Exempt Tax' and T."taxId" is null) 
            group by "taxes".id , "taxName"
           
            
            `
            records = await client.query(query.text + text, query.values)
            const creditNotesData = records.rows && records.rows.length > 0 ? records.rows : []



            let result2: any[] = [];

            creditNotesData.forEach((elem: any) => {

                let invoiceTaxData = invoicesData.find(obj => obj.taxId == elem.taxId)

                if (invoiceTaxData != null) {
                    invoicesData.splice(invoicesData.indexOf(invoiceTaxData), 1)
                    invoiceTaxData.Adjusments = elem.Adjusments
                    invoiceTaxData.vatTotal -= elem.vatTotal
                    result2.push(invoiceTaxData)
                } else {
                    result2.push(elem)
                }

            })


            query.text = `select  sum(case when "BillOfEntryLines"."isInclusiveTax" then  ("BillOfEntryLines"."subTotal" + "BillOfEntryLines"."customDuty") -  "BillOfEntryLines"."taxTotal" else( "BillOfEntryLines"."subTotal" + "BillOfEntryLines"."customDuty" ) -  ( "BillOfEntryLines"."billDiscount" + "BillOfEntryLines"."discountTotal" )  end )   as "Total",
                                sum("BillOfEntryLines"."taxTotal") as "vatTotal",
                                0 as "Adjusments",
                                'Imports subject to Vat paid at customs' as "taxName",
                                9 as "index",
                                null as "taxId"
                                        from "BillOfEntries"
            inner join "BillOfEntryLines" on "BillOfEntryLines"."billOfEntryId" = "BillOfEntries".id and "BillOfEntryLines"."taxId" is not null and "BillOfEntryLines"."taxTotal" <> 0 
            inner join "Branches" on "Branches".id = "BillOfEntries"."branchId" 
            where "BillOfEntries"."billingOfEntryDate"::timestamp >= $3 and "BillOfEntries"."billingOfEntryDate"::timestamp < $4
                            and "Branches"."companyId" = $1
                            and ($2::uuid[] IS NULL or "Branches".id = any($2)) 
                            
                            `

            let customeDuty = await client.query(query.text, query.values);
            let customDutyData = customeDuty && customeDuty.rows && customeDuty.rows.length > 0 ? customeDuty.rows : []
            console.log(customDutyData)
            let resData = [...invoicesData, ...result2, ...customDutyData]


            // if (filter.export) {
            //     let report = new ReportData()
            //     report.filter = {
            //         title: "Purchase Vat Report",
            //         fromDate: filter && filter.fromDate ? filter.fromDate : null,
            //         toDate: filter && filter.toDate ? filter.toDate : new Date(),
            //         branches: branches
            //     }
            //     report.records = resData
            //     report.columns = [{ key: 'taxName', header: 'Description' },
            //     { key: 'Total', header: 'Amount', properties: { hasTotal: true, columnType: 'currency' } },
            //     { key: 'Adjusments', properties: { hasTotal: true, columnType: 'currency' } },
            //     { key: 'vatTotal', header: 'Vat Amount', properties: { hasTotal: true, columnType: 'currency' } },
            //     ]
            //     report.fileName = 'purchaseVatReport'
            //     return new ResponseData(true, "", report)
            // }

            await client.query("COMMIT")
            return new ResponseData(true, "", resData)

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }


    // public static async getPurchaseVatReport(data:any,company:Company,brancheList:[]) {
    //     try {
    //         const companyId = company.id;
    //         const afterDecimal = company.afterDecimal;

    //         let filter = data.filter;
    //         let branches = filter && filter.branches ? filter.branches : brancheList;

    //         //-------------- set time --------------
    //         let closingTime = "00:00:00"
    //         let fromDate = filter && filter.fromDate ? filter.fromDate : null;
    //         fromDate = moment(new Date(fromDate))
    //         let toDate = filter && filter.toDate ?  moment(new Date(filter.toDate)) : moment( new Date());

    //         let timeOffset = company.timeOffset
    //         let interval = await TimeHelper.getReportTime(fromDate,toDate,closingTime,false, timeOffset)
    //         let from = interval.from
    //         let to = interval.to

    //         //---------------------------------------


    //         const query={
    //             text:`with "values" as (
    //                 select $1::uuid as "companyId",
    //                     $2::uuid[] as "branches",
    //                     $3::timestamp as "fromDate",
    //                     $4::timestamp as "toDate"
    //                 )

    //                 , "taxes" as(
    //                 select id, name, "taxPercentage" 
    //                 from "Taxes" 
    //                 join "values" on TRUE
    //                 where "Taxes"."companyId" = "values"."companyId" 
    //                     and( jsonb_array_length ("Taxes"."taxes") = 0 or  "Taxes"."taxes" is null)
    //                 ) 

    //                 ,"LinesStackedTax" as (	
    //                 select  "BillingLines".id, NULLIF(( "elem"->>'taxId'),'') ::uuid as "taxId",
    //                     nullif(COALESCE(elem ->>'taxAmount',elem ->>'totalAmount' ),'')::numeric as "taxTotal", nullif(elem ->>'index','')::numeric as "index"
    //                 From "BillingLines"
    //                 join "values" on true
    //                 inner join "Billings" on "Billings".id  =  "BillingLines"."billingId" 
    //                 inner join "Branches" on "Branches".id = "Billings"."branchId"
    //                 cross  join lateral  jsonb_array_elements("BillingLines"."taxes") elem
    //                 where "BillingLines"."createdAt" >= "values"."fromDate" and "BillingLines"."createdAt" <"values"."toDate"
    //                     and "Branches"."companyId" = "values"."companyId"
    //                     and ( "values"."branches" is null or "Billings"."branchId" = any("values"."branches")) 
    //                     and "Billings"."status" <>'Draft' 
    //                     and "BillingLines"."taxType" = 'stacked'
    //                     and   NULLIF(NULLIF(( "elem"->>'taxId'),''),'null') is not null 
    //                     union all
    //                 select  "ExpenseLines".id, NULLIF(( "elem"->>'taxId'),'') ::uuid as "taxId",
    //                    nullif( COALESCE(elem ->>'taxAmount',elem ->>'totalAmount' ),'')::numeric as "taxTotal", nullif(elem ->>'index','')::numeric as "index"
    //                 From "ExpenseLines"
    //                 join "values" on true
    //                 inner join "Expenses" on "Expenses".id  =  "ExpenseLines"."expenseId" 
    //                 inner join "Branches" on "Branches".id = "Expenses"."branchId"
    //                 cross  join lateral  jsonb_array_elements("ExpenseLines"."taxes") elem
    //                 where "ExpenseLines"."createdAt" >= "values"."fromDate" and "ExpenseLines"."createdAt" <"values"."toDate"
    //                     and "Branches"."companyId" = "values"."companyId"
    //                     and ( "values"."branches" is null or "Expenses"."branchId" = any("values"."branches")) 
    //                     and "ExpenseLines"."taxType" = 'stacked'
    //                     and   NULLIF(NULLIF(( "elem"->>'taxId'),''),'null') is not null
    //                 )

    //                 ,"LineStackedTaxTotal" as (	
    //                 SELECT  "taxId",
    //                         SUM("taxTotal"::text::numeric ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
    //                 FROM "LinesStackedTax"
    //                 )
    //                 ,"billingAmount" as (
    //                 select   "BillingLines"."taxId",
    //                         (case when  "BillingLines"."isInclusiveTax" = true then(COALESCE( "BillingLines"."subTotal"::text::numeric,0 )  -  COALESCE("BillingLines"."taxTotal"::text::numeric,0) ) else COALESCE("BillingLines"."subTotal"::text::numeric) end ) as amount
    //                 from "BillingLines"
    //                 join "values" ON true
    //                 inner join "Billings" on "Billings".id  =  "BillingLines"."billingId"
    //                 inner join  "Branches" on "Branches".id = "Billings"."branchId"
    //                 where "BillingLines"."createdAt" >= "values"."fromDate" and "BillingLines"."createdAt" <"values"."toDate"
    //                     and "Branches"."companyId" = "values"."companyId"
    //                     and ( "values"."branches" is null or "Billings"."branchId" = any("values"."branches")) 
    //                     and "Billings"."status" <>'Draft' and NullIF("BillingLines"."taxType",'')  is  NULL 

    //                 UNION ALL 

    //                 select   NULLIF(( "elem"->>'taxId'),'') ::uuid as "taxId", 
    //                         (case when  "BillingLines"."isInclusiveTax" = true then( COALESCE("BillingLines"."subTotal"::text::numeric,0)  -  COALESCE("BillingLines"."taxTotal"::text::numeric ,0)) else COALESCE("BillingLines"."subTotal"::text::numeric,0) end ) as amount   
    //                 from "BillingLines"
    //                 join "values" ON true
    //                 inner join "Billings" on "Billings".id  =  "BillingLines"."billingId" 
    //                 inner join "Branches" on "Branches".id = "Billings"."branchId"
    //                 cross  join lateral  jsonb_array_elements("BillingLines"."taxes") elem
    //                 where "BillingLines"."createdAt" >= "values"."fromDate" and "BillingLines"."createdAt" <"values"."toDate"
    //                     and "Branches"."companyId" = "values"."companyId"
    //                     and ( "values"."branches" is null or "Billings"."branchId" = any("values"."branches")) 
    //                     and "Billings"."status" <>'Draft' and NullIF("BillingLines"."taxType",'') IS not NULL

    //                 union all

    //                 select   "ExpenseLines"."taxId",
    //                         (case when  "ExpenseLines"."isInclusiveTax" = true then(COALESCE( "ExpenseLines"."amount"::text::numeric,0 )  -  COALESCE("ExpenseLines"."taxTotal"::text::numeric,0) ) else COALESCE("ExpenseLines"."amount"::text::numeric) end ) as amount
    //                 from "ExpenseLines"
    //                 join "values" ON true
    //                 inner join "Expenses" on "Expenses".id  =  "ExpenseLines"."expenseId"
    //                 inner join  "Branches" on "Branches".id = "Expenses"."branchId"
    //                 where "ExpenseLines"."createdAt" >= "values"."fromDate" and "ExpenseLines"."createdAt" <"values"."toDate"
    //                     and "Branches"."companyId" = "values"."companyId"
    //                     and ( "values"."branches" is null or "Expenses"."branchId" = any("values"."branches")) 
    //                     and NullIF("ExpenseLines"."taxType",'')  is  NULL 

    //                 UNION ALL 

    //                 select   NULLIF(( "elem"->>'taxId'),'') ::uuid as "taxId", 
    //                         (case when  "ExpenseLines"."isInclusiveTax" = true then( COALESCE("ExpenseLines"."amount"::text::numeric,0)  -  COALESCE("ExpenseLines"."taxTotal"::text::numeric ,0)) else COALESCE("ExpenseLines"."amount"::text::numeric,0) end ) as amount   
    //                 from "ExpenseLines"
    //                 join "values" ON true
    //                 inner join "Expenses" on "Expenses".id  =  "ExpenseLines"."expenseId" 
    //                 inner join "Branches" on "Branches".id = "Expenses"."branchId"
    //                 cross  join lateral  jsonb_array_elements("ExpenseLines"."taxes") elem
    //                 where "ExpenseLines"."createdAt" >= "values"."fromDate" and "ExpenseLines"."createdAt" <"values"."toDate"
    //                     and "Branches"."companyId" = "values"."companyId"
    //                     and ( "values"."branches" is null or "Expenses"."branchId" = any("values"."branches")) 
    //                     and NullIF("ExpenseLines"."taxType",'') IS not NULL


    //                 )   



    //                 ,"billingTaxes" as (
    //                 select   "BillingLines"."taxId",
    //                         "BillingLines"."taxTotal"::text::numeric
    //                 from "BillingLines"
    //                 inner join "Billings" on "Billings".id  =  "BillingLines"."billingId"  
    //                 inner join "Branches" on "Branches".id = "Billings"."branchId"
    //                 join "values" on true
    //                 where "BillingLines"."createdAt" >= "values"."fromDate" and "BillingLines"."createdAt" <"values"."toDate"
    //                     and "Branches"."companyId" = "values"."companyId"
    //                     and ( "values"."branches" is null or "Billings"."branchId" = any("values"."branches")) 
    //                     and "Billings"."status" <>'Draft' and NullIF("BillingLines"."taxType",'') IS NULL 

    //                 UNION All

    //                 select	NULLIF(( "elem"->>'taxId'),'') ::uuid as "taxId",
    //                         nullif(COALESCE(elem ->>'taxAmount',elem ->>'totalAmount' ),'')::numeric as "taxTotal"
    //                 from "BillingLines"
    //                 join "values" on true
    //                 inner join "Billings" on "Billings".id  =  "BillingLines"."billingId" 
    //                 inner join "Branches" on "Branches".id = "Billings"."branchId"
    //                 cross  join lateral  jsonb_array_elements("BillingLines"."taxes") elem
    //                 where "BillingLines"."createdAt" >= "values"."fromDate" and "BillingLines"."createdAt" <"values"."toDate"
    //                     and "Branches"."companyId" = "values"."companyId"
    //                     and ( "values"."branches" is null or "Billings"."branchId" = any("values"."branches")) 
    //                     and "Billings"."status" <>'Draft' and   NullIF("BillingLines"."taxType",'') IS not NULL 
    //                     and   NULLIF(NULLIF(( "elem"->>'taxId'),''),'null') is not null 

    //                 union all

    //                 select   "ExpenseLines"."taxId",
    //                         "ExpenseLines"."taxTotal"::text::numeric
    //                 from "ExpenseLines"
    //                 inner join "Expenses" on "Expenses".id  =  "ExpenseLines"."expenseId"  
    //                 inner join "Branches" on "Branches".id = "Expenses"."branchId"
    //                 join "values" on true
    //                 where "ExpenseLines"."createdAt" >= "values"."fromDate" and "ExpenseLines"."createdAt" <"values"."toDate"
    //                     and "Branches"."companyId" = "values"."companyId"
    //                     and ( "values"."branches" is null or "Expenses"."branchId" = any("values"."branches")) 
    //                     and NullIF("ExpenseLines"."taxType",'') IS NULL 

    //                 UNION All

    //                 select	NULLIF(( "elem"->>'taxId'),'') ::uuid as "taxId",
    //                         nullif(COALESCE(elem ->>'taxAmount',elem ->>'totalAmount' ),'')::numeric as "taxTotal"
    //                 from "ExpenseLines"
    //                 join "values" on true
    //                 inner join "Expenses" on "Expenses".id  =  "ExpenseLines"."expenseId" 
    //                 inner join "Branches" on "Branches".id = "Expenses"."branchId"
    //                 cross  join lateral  jsonb_array_elements("ExpenseLines"."taxes") elem
    //                 where "ExpenseLines"."createdAt" >= "values"."fromDate" and "ExpenseLines"."createdAt" <"values"."toDate"
    //                     and "Branches"."companyId" = "values"."companyId"
    //                     and ( "values"."branches" is null or "Expenses"."branchId" = any("values"."branches")) 
    //                     and   NullIF("ExpenseLines"."taxType",'') IS not NULL 
    //                     and   NULLIF(NULLIF(( "elem"->>'taxId'),''),'null') is not null 


    //                 )


    //                 ,"SupplierCredittLineStackedTax" as (	

    //                 select  "SupplierCreditLines".id, NULLIF(( "elem"->>'taxId'),'') ::uuid as "taxId",
    //                         nullif(COALESCE(elem ->>'taxAmount',elem ->>'totalAmount' ),'')::numeric as "taxTotal", nullif(elem ->>'index','')::numeric as "index"
    //                 from "SupplierCreditLines"
    //                 join "values" on true
    //                 inner join "SupplierCredits" on "SupplierCredits".id  =  "SupplierCreditLines"."supplierCreditId" 
    //                 inner join "Branches" on "Branches".id = "SupplierCredits"."branchId"
    //                 cross  join lateral  jsonb_array_elements("SupplierCreditLines"."taxes") elem
    //                 where "SupplierCreditLines"."createdAt" >= "values"."fromDate" and "SupplierCreditLines"."createdAt" <"values"."toDate"
    //                     and "Branches"."companyId" = "values"."companyId"
    //                     and ( "values"."branches" is null or "SupplierCredits"."branchId" = any("values"."branches")) 
    //                     and   NULLIF(NULLIF(( "elem"->>'taxId'),''),'null') is not null 
    //                     and "SupplierCreditLines"."taxType" = 'stacked'

    //                 )
    //                 ,"StackedTaxTotalForSupplierCredittLines" as (	
    //                 SELECT  "taxId",
    //                         SUM("taxTotal" ) OVER ( PARTITIon BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING and 1 PRECEDING)  AS"amount" 
    //                 FROM "SupplierCredittLineStackedTax"
    //                 )
    //                 ,  "supplierCreditAmount" as (
    //                 select  "SupplierCreditLines"."taxId",
    //                         sum(case when "SupplierCreditLines"."isInclusiveTax" = true then( COALESCE("SupplierCreditLines"."subTotal"::text::numeric,0) -  COALESCE("SupplierCreditLines"."taxTotal"::text::numeric,0) ) else COALESCE("SupplierCreditLines"."subTotal"::text::numeric,0) end ) as amount 
    //                 from "SupplierCreditLines"
    //                 join "values" on true
    //                 inner join "SupplierCredits" on "SupplierCredits".id  =  "SupplierCreditLines"."supplierCreditId" and "SupplierCreditLines"."createdAt"::date = "SupplierCredits"."supplierCreditDate"::date 
    //                 inner join "Branches" on "Branches".id = "SupplierCredits"."branchId"
    //                 where "SupplierCreditLines"."createdAt" >= "values"."fromDate" and "SupplierCreditLines"."createdAt" <"values"."toDate"
    //                     and "Branches"."companyId" = "values"."companyId"
    //                     and ( "values"."branches" is null or "SupplierCredits"."branchId" = any("values"."branches")) 
    //                     and NullIF("SupplierCreditLines"."taxType",'') IS NULL 
    //                 group by "SupplierCredits".id,"SupplierCreditLines"."taxId"

    //                 UNION All 

    //                 select  "SupplierCreditLines"."taxId",
    //                     (case when "SupplierCreditLines"."isInclusiveTax" = true then( COALESCE("SupplierCreditLines"."subTotal"::text::numeric,0) -  COALESCE("SupplierCreditLines"."taxTotal"::text::numeric,0) ) else COALESCE("SupplierCreditLines"."subTotal"::text::numeric,0) end ) as amount
    //                 from "SupplierCreditLines"
    //                 join "values" on true
    //                 inner join "SupplierCredits" on "SupplierCredits".id  =  "SupplierCreditLines"."supplierCreditId"  and "SupplierCreditLines"."createdAt"::date <> "SupplierCredits"."supplierCreditDate"::date
    //                 inner join "Branches" on "Branches".id = "SupplierCredits"."branchId"
    //                 where "SupplierCreditLines"."createdAt" >= "values"."fromDate" and "SupplierCreditLines"."createdAt" <"values"."toDate"
    //                     and "Branches"."companyId" = "values"."companyId"
    //                     and ( "values"."branches" is null or "SupplierCredits"."branchId" = any("values"."branches")) 
    //                     and NullIF("SupplierCreditLines"."taxType",'')  is not NULL 

    //                 UNION All
    //                 select    NULLIF(( "elem"->>'taxId'),'') ::uuid as "taxId",
    //                             (case when "SupplierCreditLines"."isInclusiveTax" = true then( COALESCE("SupplierCreditLines"."subTotal"::text::numeric,0) -  COALESCE("SupplierCreditLines"."taxTotal"::text::numeric,0) ) else COALESCE("SupplierCreditLines"."subTotal"::text::numeric,0) end ) as amount   
    //                 from "SupplierCreditLines"
    //                 inner join "SupplierCredits" on "SupplierCredits".id  =  "SupplierCreditLines"."supplierCreditId" 
    //                 inner join "Branches" on "Branches".id = "SupplierCredits"."branchId"
    //                 cross  join lateral  jsonb_array_elements("SupplierCreditLines"."taxes") elem
    //                 join "values" on true
    //                 where "SupplierCreditLines"."createdAt" >= "values"."fromDate" and "SupplierCreditLines"."createdAt" <"values"."toDate"
    //                     and "Branches"."companyId" = "values"."companyId"
    //                     and ( "values"."branches" is null or "SupplierCredits"."branchId" = any("values"."branches")) 
    //                     and NullIF("SupplierCreditLines"."taxType",'') IS not NULL



    //                 )

    //                 ,"supplierCreditTaxes" as (
    //                 select  "SupplierCreditLines"."taxId",
    //                         "SupplierCreditLines"."taxTotal"::text::numeric
    //                 from "SupplierCreditLines"
    //                 inner join "SupplierCredits" on "SupplierCredits".id  =  "SupplierCreditLines"."supplierCreditId"  
    //                 inner join "Branches" on "Branches".id = "SupplierCredits"."branchId"
    //                 join "values" on true
    //                 where "SupplierCreditLines"."createdAt" >= "values"."fromDate" and "SupplierCreditLines"."createdAt" <"values"."toDate"
    //                     and "Branches"."companyId" = "values"."companyId"
    //                     and ( "values"."branches" is null or "SupplierCredits"."branchId" = any("values"."branches")) 
    //                     and NullIF("SupplierCreditLines"."taxType",'') IS NULL 

    //                 UNION All

    //                 select  NULLIF(( "elem"->>'taxId'),'') ::uuid as "taxId",
    //                         nullif(COALESCE(elem ->>'taxAmount',elem ->>'totalAmount' ),'')::numeric as "taxTotal"
    //                 from "SupplierCreditLines"
    //                 inner join "SupplierCredits" on "SupplierCredits".id  =  "SupplierCreditLines"."supplierCreditId" 
    //                 inner join "Branches" on "Branches".id = "SupplierCredits"."branchId"
    //                 cross  join lateral  jsonb_array_elements("SupplierCreditLines"."taxes") elem
    //                 join "values" on true
    //                 where "SupplierCreditLines"."createdAt" >= "values"."fromDate" and "SupplierCreditLines"."createdAt" <"values"."toDate"
    //                     and "Branches"."companyId" = "values"."companyId"
    //                     and ( "values"."branches" is null or "SupplierCredits"."branchId" = any("values"."branches")) 
    //                     and   NullIF("SupplierCreditLines"."taxType",'') IS not NULL 
    //                     and   NULLIF(NULLIF(( "elem"->>'taxId'),''),'null') is not null 


    //                 )

    //                 ,"totalBillingAmount" as (
    //                 SELECT COALESCE( "taxes".name,'Exempt Tax') as "taxName", 
    //                         sum("t"."amount"::text::numeric) as "amount" 
    //                 FROM ( select * from "billingAmount"  union all select * from "LineStackedTaxTotal"  ) as t
    //                 LEFT join "taxes" on "t"."taxId" = "taxes"."id" 
    //                 group by "taxName"
    //                 )

    //                 ,"billingTaxesAmount" as (
    //                 SELECT  COALESCE( "taxes".name,'Exempt Tax') as "taxName",
    //                         sum("billingTaxes"."taxTotal"::text::numeric )as "amount" 
    //                 FROM "billingTaxes"
    //                 LEFT join "taxes" on "billingTaxes"."taxId" = "taxes"."id" 
    //                 group by "taxName"
    //                 )
    //                 ,"totalSupplierCreditAmount" as (
    //                 SELECT COALESCE( "taxes".name,'Exempt Tax') as "taxName", 
    //                         sum("t"."amount"::text::numeric) as "amount" 
    //                 FROM ( select * from "supplierCreditAmount"  union all select * from "StackedTaxTotalForSupplierCredittLines"  ) as t


    //                 LEFT join "taxes" on "t"."taxId" = "taxes"."id" 
    //                 group by "taxName"
    //                 ),
    //                 "supplierCreditTaxesAmount" as (
    //                 SELECT  COALESCE( "taxes".name,'Exempt Tax') as "taxName",
    //                         sum("supplierCreditTaxes"."taxTotal"::text::numeric )as "amount"
    //                 FROM "supplierCreditTaxes"
    //                 LEFT join "taxes" on "supplierCreditTaxes"."taxId" = "taxes"."id" 
    //                 group by "taxName"
    //                 )

    //                 SELECT  "taxes".id as "taxId",
    //                         "taxes".name as "taxName",
    //                         COALESCE("totalBillingAmount"."amount"::text::numeric,0) as "Total",
    //                         COALESCE("totalSupplierCreditAmount"."amount"::text::numeric,0) as "Adjusments",
    //                         COALESCE("billingTaxesAmount"."amount"::numeric,0) - COALESCE("supplierCreditTaxesAmount"."amount"::numeric,0) as "vatTotal"
    //                 FROM "taxes"
    //                 LEFT JOIN "billingTaxesAmount" ON "billingTaxesAmount"."taxName" = "taxes"."name" 
    //                 LEFT JOIN "totalBillingAmount" ON "totalBillingAmount"."taxName" = "taxes"."name" 
    //                 LEFT JOIN "supplierCreditTaxesAmount" ON "supplierCreditTaxesAmount"."taxName" = "taxes"."name" 
    //                 LEFT JOIN "totalSupplierCreditAmount" ON "totalSupplierCreditAmount"."taxName" = "taxes"."name" 
    //                 `,
    //           values:[companyId,branches,from,to]
    //         }

    //         const records = await DB.excu.query(query.text,query.values)

    //         const resData = records.rows && records.rows.length > 0 ? records.rows :[]
    //         if(filter.export){
    //             let report = new ReportData()
    //             report.filter = { title:"Purchase Vat Report", 
    //                               fromDate: filter && filter.fromDate ? filter.fromDate : null , 
    //                               toDate: filter && filter.toDate ? filter.toDate : new Date(),
    //                               branches: branches
    //                             }
    //             report.records = records.rows
    //             report.columns = [  {key:'taxName', header:'Description'},
    //                                 {key:'Total',header:'Amount', properties:{hasTotal:true,columnType:'currency'} },
    //                                 {key:'Adjusments',properties:{hasTotal:true,columnType:'currency'} },
    //                                 {key:'vatTotal',header:'Vat Amount', properties:{hasTotal:true,columnType:'currency'} },
    //                             ]
    //             report.fileName = 'purchaseVatReport'
    //             return new ResponseData(true, "", report)
    //         }

    //         return new ResponseData(true,"",resData)

    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }

    public static async vatDetailsReport(data: any, company: Company, brancheList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;


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

            let types = filter && filter.types ? filter.types : [];
            types = types.filter((type: string) => (["Invoice", "CreditNotes", "Bill", "SupplierCredit", "Expense", "Bill Of Entry"].includes(type)))

            const query: { text: string, values: any } = {
                text: `with "values" as (
                        select $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::timestamp as "fromDate",
                            $4::timestamp as "toDate",
                         
                            $5::varchar [] as types
                          )
                        ,"InvoiceData" AS (
                        select  
                                "Invoices"."invoiceNumber" AS "referenceNumber",
                                "Invoices".id AS "referenceId",
							    "Invoices"."customerId" as "userId", 
                                Date("InvoiceLines"."createdAt")  AS "Date",
                                case when  "InvoiceLines"."taxPercentage" <> 0  then 
                                            "InvoiceLines"."subTotal" -  (case when "InvoiceLines"."isInclusiveTax" = true then COALESCE("InvoiceLines"."taxTotal",0) else 0 end) - COALESCE("InvoiceLines"."discountTotal",0) 
                                        end as "taxableAmount" ,
                                "Taxes".name as name,
                                "InvoiceLines"."taxTotal" as vat,
                                case when "InvoiceLines"."taxPercentage" = 0 then  "InvoiceLines"."subTotal" - COALESCE("InvoiceLines"."discountTotal",0) end  as "none_taxableAmount",
                                "InvoiceLines"."total" as "totalAmount"
                                from "InvoiceLines"
                            join "values" ON true
                            inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" 
                            left join "Taxes" on "Taxes".id = "InvoiceLines"."taxId"
                            inner join "Branches" on "Branches".id = "Invoices"."branchId"
                            where 
                                 "InvoiceLines"."companyId" = "values"."companyId"
                                and ( array_length("values"."branches",1) IS NULL OR "InvoiceLines"."branchId" = any( "values"."branches"))
                               and "InvoiceLines"."createdAt" >= "values"."fromDate" and "InvoiceLines"."createdAt" <"values"."toDate"
                                and ( array_length("values"."types",1) IS NULL OR 'Invoice' = any( "values"."types"))
                                and "Invoices"."status" <>'Draft'

                        union all

                        select  
                                "Invoices"."invoiceNumber" AS "referenceNumber",
                                "Invoices".id AS "referenceId",
								    "Invoices"."customerId" as "userId", 
                                Date("Invoices"."invoiceDate")  AS "Date",
                                case when  COALESCE(NULLIF("Invoices"."chargesTaxDetails"->>'taxPercentage','')::numeric,0) <> 0  then   "Invoices"."chargeTotal" end  as "taxableAmount",
                                "Taxes".name as  name,
                                NULLIF(COALESCE("Invoices"."chargesTaxDetails"->>'taxAmount',"Invoices"."chargesTaxDetails"->>'taxTotal'),'')::numeric as vat , 
                                case when  ("Invoices"."chargesTaxDetails" is null or COALESCE(NULLIF("Invoices"."chargesTaxDetails"->>'taxPercentage','')::numeric,0) = 0 ) then   "Invoices"."chargeTotal" end  as "none_taxableAmount",
                                "Invoices"."chargeTotal" + COALESCE(nullif(COALESCE("Invoices"."chargesTaxDetails"->>'taxAmount', "Invoices"."chargesTaxDetails"->>'taxTotal'),'')::numeric,0) as "totalAmount"
                        from "Invoices"
                        join "values" on true
                        left join "Taxes" on "Taxes".id = (nullIf("Invoices"."chargesTaxDetails"->>'taxId',''))::uuid
                        inner join "Branches" on "Branches".id = "Invoices"."branchId"
                        where "Invoices"."companyId" = "values"."companyId"
                            and ( array_length("values"."branches",1) IS NULL OR "Invoices"."branchId" = any( "values"."branches"))
                            and  "Invoices"."invoiceDate" >= "values"."fromDate" and "Invoices"."invoiceDate" <"values"."toDate"
                            and ( array_length("values"."types",1) IS NULL OR 'Invoice' = any( "values"."types"))
                            and "Invoices"."status" <>'Draft'  and  "Invoices"."chargeTotal" <> 0
                        )
                        ,"CreditNoteData" AS (
                        select  
                                "CreditNotes"."creditNoteNumber" AS "referenceNumber",
                                "CreditNotes".id AS "referenceId",
							     "Invoices"."customerId" as "userId",
                                Date("CreditNoteLines"."createdAt")  AS "Date",
                                case when  "CreditNoteLines"."taxPercentage" <> 0  then 
                                            "CreditNoteLines"."subTotal" -  (case when "CreditNoteLines"."isInclusiveTax" = true then COALESCE("CreditNoteLines"."taxTotal",0) else 0 end) - COALESCE("CreditNoteLines"."discountTotal",0) 
                                        end*(-1) as "taxableAmount" ,
                                "Taxes".name as name,
                                "CreditNoteLines"."taxTotal"*(-1) as vat,
                                case when  "CreditNoteLines"."taxPercentage" = 0  then "CreditNoteLines"."subTotal" - COALESCE("CreditNoteLines"."discountTotal",0) end *(-1) as "none_taxableAmount",
                                "CreditNoteLines"."total" *(-1) as "totalAmount"
                                from "CreditNoteLines"
                            join "values" ON true
                            inner join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId"
							
                            left join "Taxes" on "Taxes".id = "CreditNoteLines"."taxId"
                            inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
							inner join "Invoices" on "Invoices"."companyId" = "values"."companyId" and "Invoices".id = "CreditNotes"."invoiceId"
                            where "CreditNoteLines"."createdAt" >= "values"."fromDate" and "CreditNoteLines"."createdAt" <"values"."toDate"
                                and "CreditNoteLines"."companyId" = "values"."companyId"
                                and ( array_length("values"."branches",1) IS NULL OR "CreditNoteLines"."branchId"= any( "values"."branches"))
                                and  "CreditNoteLines"."createdAt" >= "values"."fromDate" and "CreditNoteLines"."createdAt" <"values"."toDate"
                                and ( array_length("values"."types",1) IS NULL OR 'CreditNotes' = any( "values"."types"))
                            

                        union all

                        select  
                                "CreditNotes"."creditNoteNumber" AS "referenceNumber",
                                "CreditNotes".id AS "referenceId",
							     "Invoices"."customerId" as "userId",
                                Date("CreditNotes"."creditNoteDate")  AS "Date",
                                case when  COALESCE(NULLIF("CreditNotes"."chargesTaxDetails"->>'taxPercentage','')::numeric,0) <> 0  then   "CreditNotes"."chargeTotal" end *(-1) as "taxableAmount",
                                "Taxes".name as  name,
                                NULLIF(COALESCE("CreditNotes"."chargesTaxDetails"->>'taxAmount',"CreditNotes"."chargesTaxDetails"->>'taxTotal'),'')::numeric*(-1) as vat , 
                                case when  ("CreditNotes"."chargesTaxDetails" is null or COALESCE(NULLIF("CreditNotes"."chargesTaxDetails"->>'taxPercentage','')::numeric,0) = 0 ) then   "CreditNotes"."chargeTotal" end*(-1)  as "none_taxableAmount",
                                "CreditNotes"."chargeTotal" + COALESCE(nullif(COALESCE("CreditNotes"."chargesTaxDetails"->>'taxAmount', "CreditNotes"."chargesTaxDetails"->>'taxTotal'),'')::numeric,0)*(-1) as "totalAmount"
                        from "CreditNotes"
                        join "values" on true
                        left join "Taxes" on "Taxes".id = (nullIf("CreditNotes"."chargesTaxDetails"->>'taxId',''))::uuid
                        inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
						inner join "Invoices" on "Invoices"."companyId" = "values"."companyId" and "Invoices".id = "CreditNotes"."invoiceId"
                        where  "CreditNotes"."companyId" = "values"."companyId"
                            and ( array_length("values"."branches",1) IS NULL OR "CreditNotes"."branchId"= any( "values"."branches"))
                           and "CreditNotes"."creditNoteDate" >= "values"."fromDate" and "CreditNotes"."creditNoteDate" <"values"."toDate"
                            and ( array_length("values"."types",1) IS NULL OR 'CreditNotes' = any( "values"."types"))
                            and  "CreditNotes"."chargeTotal" <> 0
                        )
                        ,"BillingData" AS (
                        select  
                                "Billings"."billingNumber" AS "referenceNumber",
                                "Billings".id AS "referenceId",
							    "Billings"."supplierId" as "userId",
                                Date("Billings"."billingDate")  AS "Date",
                                sum( "BillingLines"."taxableAmount")as "taxableAmount" ,
                                array_agg(distinct "Taxes".name) as name,
                                sum("BillingLines"."taxTotal") as vat,
                                sum( case when "BillingLines"."taxPercentage" = 0 then  "BillingLines"."subTotal"  end  )as "none_taxableAmount",
                                sum("BillingLines"."total") as "totalAmount"
                                from "BillingLines"
                            join "values" ON true
                            inner join "Billings" on "Billings".id = "BillingLines"."billingId" 
                            left join "Taxes" on "Taxes".id = "BillingLines"."taxId"
                            inner join "Branches" on "Branches".id = "Billings"."branchId"
                            where "Billings"."billingDate" >= "values"."fromDate" and "Billings"."billingDate" <"values"."toDate"
                                and "Branches"."companyId" = "values"."companyId"
                                and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                                and ( array_length("values"."types",1) IS NULL OR 'Bill' = any( "values"."types"))
                                and "Billings"."status" <>'Draft'
                            group by  "Billings".id
                        ) ,"BillOfEntriesData" AS (
    select  
        "BillOfEntries"."billingOfEnrtyNumber" AS "referenceNumber",
        "BillOfEntries".id AS "referenceId",
        "Billings"."supplierId" as "userId",
        Date("BillOfEntries"."billingOfEntryDate")  AS "Date",

        sum(
            case 
                when "BillOfEntryLines"."taxPercentage" <> 0 then 
                    ("BillOfEntryLines"."subTotal"
                     + COALESCE("BillOfEntryLines"."customDuty",0)
                     - (COALESCE("BillOfEntryLines"."billDiscount",0)
                        + COALESCE("BillOfEntryLines"."discountTotal",0))
                     - (case 
                            when "BillOfEntryLines"."isInclusiveTax" = true 
                            then COALESCE("BillOfEntryLines"."taxTotal",0) 
                            else 0 
                        end)
                    )
            end
        ) as "taxableAmount",

        array_agg(distinct "Taxes".name) as name,
        sum("BillOfEntryLines"."taxTotal") as vat,

        sum(
            case 
                when "BillOfEntryLines"."taxPercentage" = 0 then
                    ("BillOfEntryLines"."subTotal"
                     + COALESCE("BillOfEntryLines"."customDuty",0)
                     - (COALESCE("BillOfEntryLines"."billDiscount",0)
                        + COALESCE("BillOfEntryLines"."discountTotal",0))
                    )
            end
        ) as "none_taxableAmount",

        sum("BillOfEntryLines"."total") as "totalAmount"

    from "BillOfEntryLines"
    join "values" ON true
    inner join "BillOfEntries" on "BillOfEntries".id = "BillOfEntryLines"."billOfEntryId" 
    inner join "Billings" on "Billings".id = "BillOfEntries"."billingId" 
    left join "Taxes" on "Taxes".id = "BillOfEntryLines"."taxId"
    inner join "Branches" on "Branches".id = "BillOfEntries"."branchId"

    where "BillOfEntries"."billingOfEntryDate" >= "values"."fromDate"
      and "BillOfEntries"."billingOfEntryDate" < "values"."toDate"
      and "Branches"."companyId" = "values"."companyId"
      and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any("values"."branches") )
      and ( array_length("values"."types",1) IS NULL OR 'Bill Of Entry' = any("values"."types") )
      and "BillOfEntries"."status" <> 'Draft'

    group by "BillOfEntries".id, "Billings"."supplierId"
)
                        ,"SupplierCreditData" AS (
                        select  
                                "SupplierCredits"."supplierCreditNumber" AS "referenceNumber",
                                "SupplierCredits".id AS "referenceId",
							   "Billings"."supplierId" as "userId",
                                Date("SupplierCredits"."supplierCreditDate")  AS "Date",
                                sum( "SupplierCreditLines"."taxableAmount")*(-1) as "taxableAmount" ,
                                array_agg("Taxes".name) as name,
                                sum("SupplierCreditLines"."taxTotal")*(-1) as vat,
                                sum(case when  "SupplierCreditLines"."taxPercentage" = 0  then "SupplierCreditLines"."subTotal" end) *(-1) as "none_taxableAmount",
                                sum("SupplierCreditLines"."total") *(-1) as "totalAmount"
                                from "SupplierCreditLines"
                            join "values" ON true
                            inner join "SupplierCredits" on "SupplierCredits".id = "SupplierCreditLines"."supplierCreditId" 
							inner join "Billings" on "Billings".id = "SupplierCredits"."billingId" 
                            left join "Taxes" on "Taxes".id = "SupplierCreditLines"."taxId"
                            inner join "Branches" on "Branches".id = "SupplierCredits"."branchId"
                            where "SupplierCredits"."supplierCreditDate"::timestamp  >= "values"."fromDate" and "SupplierCredits"."supplierCreditDate"::timestamp <"values"."toDate"
                                and "Branches"."companyId" = "values"."companyId"
                                and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                                and ( array_length("values"."types",1) IS NULL OR 'SupplierCredit' = any( "values"."types"))
                            group by "SupplierCredits".id, "Billings"."supplierId"
                        )
                        ,"ExpenseData" AS (
                        select  
                                "Expenses"."expenseNumber" AS "referenceNumber",
                                "Expenses".id AS "referenceId",
							    COALESCE("Expenses"."customerId","Expenses"."supplierId") as "userId",
                                Date("Expenses"."expenseDate")  AS "Date",
                                sum(case when  "ExpenseLines"."taxPercentage" <> 0  then 
                                            "ExpenseLines"."amount" -  (case when "ExpenseLines"."isInclusiveTax" = true then COALESCE("ExpenseLines"."taxTotal",0) else 0 end)
                                        end) as "taxableAmount" ,
                                array_agg("Taxes".name) as name,
                                sum("ExpenseLines"."taxTotal") as vat,
                                sum( case when "ExpenseLines"."taxPercentage" = 0 then  "ExpenseLines"."amount"  end ) as "none_taxableAmount",
                                sum("ExpenseLines"."total") as "totalAmount"
                                from "ExpenseLines"
                            join "values" ON true
                            inner join "Expenses" on "Expenses".id = "ExpenseLines"."expenseId" 
                            left join "Taxes" on "Taxes".id = "ExpenseLines"."taxId"
                            inner join "Branches" on "Branches".id = "Expenses"."branchId"
                            where "Expenses"."expenseDate" >= "values"."fromDate" and "Expenses"."expenseDate" <"values"."toDate"
                                and "Branches"."companyId" = "values"."companyId"
                                and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                                and ( array_length("values"."types",1) IS NULL OR 'Expense' = any( "values"."types"))
                            group by "Expenses".id
                                
                        ), t as 
                                (select 'InputTax' AS "parentType",
                                'Invoice' AS "type",
                                "referenceNumber", "referenceId","userId",
                                "Date", 
                                sum("taxableAmount") as "taxableAmount",
                                array_agg(distinct name) as name,
                                sum("vat") as "vat",
                                sum("none_taxableAmount") as "none_taxableAmount",
                                sum("totalAmount") as "totalAmount"
                        from "InvoiceData" 
                        group by  "referenceId","referenceNumber", "Date","userId"
                                            
                        union all 
                        select  'InputTax' AS "parentType",
                                'CreditNote' AS "type",
                                "referenceNumber", "referenceId","userId",
                                "Date", 
                                sum("taxableAmount") as "taxableAmount",
                                array_agg(distinct name) as name,
                                sum("vat") as "vat",
                                sum("none_taxableAmount") as "none_taxableAmount",
                                sum("totalAmount") as "totalAmount"
                        from "CreditNoteData" 
                        group by  "referenceId","referenceNumber", "Date","userId"

                        union all
                        select 'OutputTax' AS "parentType",
                                'Bill' AS "type",
                                "BillingData".*
                        from "BillingData" 
                                            
                        union all 
						  select 'OutputTax' AS "parentType",
                                'Bill Of Entry' AS "type",
                                "BillOfEntriesData".*
                        from "BillOfEntriesData" 
                                            
                        union all 
                        select  'OutputTax' AS "parentType",
                                'SupplierCredit' AS "type",
                                "SupplierCreditData" .*
                        from "SupplierCreditData" 

                        union all 
                        select  'OutputTax' AS "parentType",
                                'Expense' AS "type",
                                "ExpenseData".*
                        from "ExpenseData" 
                        ), "data" as (
						
						
						   select count(*) over(), 
                                                sum("taxableAmount") over() as "taxableAmountTotal",
                                                sum("vat") over() as "vatTotal",
                                                sum("none_taxableAmount") over() as "none_taxableAmountTotal",
                                                sum("totalAmount") over() as "amountTotal",
                                                t.*
                        from t
					
						
                        order by "parentType", "Date" asc,  "referenceId"	

                    
                    `,
                values: [companyId, branches, from, to, types]
            }

            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`
            let additionalQuery = `)
						select "data".*,
						COALESCE("Suppliers"."name","Customers"."name") "ContactName" 
						from "data"
							left join "Suppliers" on "Suppliers"."companyId" = $1 and  "Suppliers"."id" = "data"."userId"
						left join "Customers" on "Customers"."companyId" = $1 and "Customers"."id" = "data"."userId"`

            const records = await DB.excu.query(query.text + limitQuery + additionalQuery, query.values);

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)

                total = { taxableAmount: t.taxableAmountTotal, vat: t.vatTotal, none_taxableAmount: t.none_taxableAmountTotal, totalAmount: t.amountTotal }
                resault = records.rows.map((e: any) => {
                    return {
                        parentType: e.parentType, type: e.type,
                        referenceNumber: e.referenceNumber, ContactName: e.ContactName, referenceId: e.referenceId,
                        date: e.Date, taxableAmount: e.taxableAmount,
                        name: e.name, vat: e.vat, none_taxableAmount: e.none_taxableAmount, totalAmount: e.totalAmount
                    }
                })




            }

            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (records.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Vat Audit Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                resault.forEach(elem => { elem.date = moment.utc(elem.date).utcOffset(+timeOffset).format('YYYY-MM-DD') })
                report.records = resault
                report.columns = [{ key: 'date', properties: { columnType: 'date' } },
                { key: 'type' },
                { key: 'referenceNumber' },
                { key: 'ContactName' },
                { key: 'name' },
                { key: 'taxableAmount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'vat', header: 'Tax', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'none_taxableAmount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'totalAmount', properties: { hasTotal: true, columnType: 'currency' } },
                ]
                report.fileName = 'VatAuditReport'
                return new ResponseData(true, "", report)
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

    public static async productWiseVatReport(data: any, company: Company, brancheList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;


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


            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);


            let offset = limit * (page - 1);

            let total = {};
            let count = 0;
            let resault: any[] = [];
            //######################## sort ########################

            let sortby = filter && filter.sortBy ? filter.sortBy : [];
            let sortList = sortby.filter((item: any) => item.sortValue && item.sortValue.trim() !== "");

            // if (sortList.length < 1) { sortList.push({ sortValue: "productName", sortDirection: 'asc' }) }

            let orderByQuery = "order by ";
            for (let i = 0; i < sortList.length; i++) {
                orderByQuery += `"${sortList[i].sortValue.trim()}" ${sortList[i].sortDirection ?? ""}`;
                orderByQuery += ", ";
            }
            orderByQuery += ` "records"."productId","records"."taxId" `

            //######################################################

            const query: { text: string, values: any } = {
                text: `with "values" as (
                        select $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::timestamp as "fromDate",
                            $4::timestamp as "toDate"
                        ) , "lines" as (
						  select 	"InvoiceLines"."isInclusiveTax",
						         	"InvoiceLines"."productId",
						         	"InvoiceLines"."invoiceId",
						         	"InvoiceLines"."subTotal",
                                    "InvoiceLines"."taxId",
						         	"InvoiceLines"."taxTotal",
						         	"InvoiceLines"."discountTotal"
                        from "InvoiceLines" 
                        join "values" on true
                        where 
                                 "InvoiceLines"."companyId" = "values"."companyId"
                                and ( array_length("values"."branches",1) IS NULL OR "InvoiceLines"."branchId" = any( "values"."branches"))
                                and "InvoiceLines"."createdAt" >= "values"."fromDate" and "InvoiceLines"."createdAt" <"values"."toDate"
               
						)
                        , "salesAmount" as (
                        select 	"productId" , "taxId",
                                sum(case when "lines"."isInclusiveTax" = true then( "lines"."subTotal"::text::numeric -  COALESCE("lines"."taxTotal"::text::numeric,0) ) - COALESCE("lines"."discountTotal"::text::numeric,0) 
                                                                                    else "lines"."subTotal"::text::numeric - COALESCE("lines"."discountTotal"::text::numeric,0) end ) as total,
                                sum( "lines"."taxTotal"::text::numeric ) as "taxTotal"  
                        from "lines" 
                        inner join "Invoices" on "Invoices".id =  "lines"."invoiceId" AND "Invoices"."status" <>'Draft'
                        inner join "Branches" on "Branches".id = "Invoices"."branchId"
                        join "values" on true
                      
                        group by "productId", "taxId"
                        )
                        ,"salesAdjusments" as (
                        select  "productId", "taxId",
                                sum(case when "CreditNoteLines"."isInclusiveTax" = true then( "CreditNoteLines"."subTotal"::text::numeric -  COALESCE("CreditNoteLines"."taxTotal"::numeric,0) )- COALESCE("CreditNoteLines"."discountTotal"::text::numeric,0)
                                                                                        else "CreditNoteLines"."subTotal"::text::numeric - COALESCE("CreditNoteLines"."discountTotal"::text::numeric,0) end )*(-1)  as total, 
                                sum( "CreditNoteLines"."taxTotal"::text::numeric )*(-1) as "taxTotal"  
                        from "CreditNoteLines" 
                        inner join "CreditNotes" on "CreditNotes".id =  "CreditNoteLines"."creditNoteId"
                        inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
                        join "values" on true
                        where "CreditNoteLines"."createdAt" >= "values"."fromDate" and "CreditNoteLines"."createdAt" <"values"."toDate"
                            and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                            and "Branches"."companyId" ="values"."companyId"
                        group by "productId", "taxId"	
                        )
                        ,"salesTotal" as (
                        SELECT "productId", "taxId", sum("total"::text::numeric) as "amount", sum ("taxTotal"::text::numeric) as "taxTotal" 
                        FROM (select * from "salesAmount" union select * from "salesAdjusments")t
                        Group By "productId", "taxId"
                        )
                        ,"purchaseAmount" as (
                        select  "productId" , "taxId",
                            sum("taxableAmount" ) as total,
                            sum( "BillingLines"."taxTotal"::text::numeric ) as "taxTotal"  
                        from "BillingLines" 
                        inner join "Billings" on "Billings".id =  "BillingLines"."billingId" and "Billings"."status" <>'Draft'
                        inner join "Branches" on "Branches".id = "Billings"."branchId"
                        join "values" on true
                        where "Billings"."billingDate"::timestamp >= "values"."fromDate" and "Billings"."billingDate"::timestamp <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                        group by "productId", "taxId"
                        )
                        ,"purchaseAdjusments" as (
                        select  "productId", "taxId",
                                sum("taxableAmount" )*(-1)  as total, 
                                sum( "SupplierCreditLines"."taxTotal"::text::numeric )*(-1) as "taxTotal"  
                        from "SupplierCreditLines" 
                        inner join "SupplierCredits" on "SupplierCredits".id =  "SupplierCreditLines"."supplierCreditId"
                        inner join"Branches" on "Branches".id = "SupplierCredits"."branchId"
                        join "values" on true
                        where "SupplierCredits"."supplierCreditDate"::timestamp >= "values"."fromDate" and "SupplierCredits"."supplierCreditDate"::timestamp <"values"."toDate"
                            and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                            and "Branches"."companyId" ="values"."companyId"
                        group by "productId", "taxId"
                            
                        )  ,"billOfEntry" as (
                                select  
                                    "productId",
                                    "taxId",

                                    sum(
                                        case 
                                            when "BillOfEntryLines"."isInclusiveTax" = true then
                                                (
                                                    "BillOfEntryLines"."subTotal"::text::numeric
                                                    + COALESCE("BillOfEntryLines"."customDuty",0)
                                                    - (COALESCE("BillOfEntryLines"."billDiscount",0)
                                                    + COALESCE("BillOfEntryLines"."discountTotal",0))
                                                    - COALESCE("BillOfEntryLines"."taxTotal"::text::numeric,0)
                                                )
                                            else
                                                (
                                                    "BillOfEntryLines"."subTotal"::text::numeric
                                                    + COALESCE("BillOfEntryLines"."customDuty",0)
                                                    - (COALESCE("BillOfEntryLines"."billDiscount",0)
                                                    + COALESCE("BillOfEntryLines"."discountTotal",0))
                                                )
                                        end
                                    ) as total,

                                    sum("BillOfEntryLines"."taxTotal"::text::numeric) as "taxTotal"

                                from "BillOfEntryLines"
                                inner join "BillOfEntries" 
                                    on "BillOfEntries".id = "BillOfEntryLines"."billOfEntryId"
                                and "BillOfEntries"."status" <> 'Draft'
                                inner join "Branches" 
                                    on "Branches".id = "BillOfEntries"."branchId"
                                join "values" on true

                                where "BillOfEntries"."billingOfEntryDate"::timestamp >= "values"."fromDate"
                                and "BillOfEntries"."billingOfEntryDate"::timestamp < "values"."toDate"
                                and "Branches"."companyId" = "values"."companyId"
                                and ( array_length("values"."branches",1) IS NULL 
                                        OR "Branches".id = any("values"."branches") )

                                group by "productId", "taxId"
                            )
                        ,"purchaseTotal" as (
                        SELECT "productId", "taxId", sum("total"::text::numeric) as "amount", sum ("taxTotal"::text::numeric) as "taxTotal" 
                        FROM (select * from "purchaseAmount" union select * from "purchaseAdjusments" union select * from "billOfEntry" )t
                        group by "productId", "taxId"
                        )
                        ,"records" as (
                        SELECT COALESCE("salesTotal"."productId", "purchaseTotal"."productId") AS "productId",
                            COALESCE("salesTotal"."taxId", "purchaseTotal"."taxId") AS "taxId",
                            COALESCE("salesTotal".amount,0) As "salesAmountAfterDiscount", 
                            COALESCE("salesTotal"."taxTotal",0) AS "salesTax" , 
                            COALESCE("purchaseTotal".amount,0)  As "purchaseAmount", 
                            COALESCE("purchaseTotal"."taxTotal",0) AS "purchaseTax",
                            (  COALESCE("salesTotal"."taxTotal",0) -   COALESCE("purchaseTotal"."taxTotal",0))  as "netVat"
                        from "salesTotal"
                        full outer join "purchaseTotal" on "purchaseTotal"."productId" = "salesTotal"."productId" AND "purchaseTotal"."taxId" = "salesTotal"."taxId" 
                        order  by "salesTotal"."productId", "purchaseTotal"."productId", "salesTotal"."taxId", "purchaseTotal"."taxId"
                        )
                        select "Products".name as "productName", 
                         COALESCE("Taxes".name,'Exempt Tax') as "taxName", 
                        "records".*, 
                        count(*) over(),
                        sum("salesAmountAfterDiscount"::text::numeric) over() as "salesAmountAfterDiscountTotal",
                        sum("salesTax"::text::numeric) over() as "salesTaxTotal",
                        sum("purchaseAmount"::text::numeric) over() as "purchaseAmountTotal",
                        sum("purchaseTax"::text::numeric) over() as "purchaseTaxTotal",
                        sum("netVat"::text::numeric) over() as "netVatTaxTotal"
                        from "records"
                        left join "Products" on "Products".id = "records"."productId"
                        left join "Taxes" on "Taxes".id = "records"."taxId"
                        ${orderByQuery}
                    
                    `,
                values: [companyId, branches, from, to]
            }
            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`


            const records = await DB.excu.query(query.text + limitQuery, query.values);

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)

                total = { netVatTaxTotal: t.netVatTaxTotal, salesAmountAfterDiscount: t.salesAmountAfterDiscountTotal, salesTax: t.salesTaxTotal, purchaseAmount: t.purchaseAmountTotal, purchaseTax: t.purchaseTaxTotal }
                resault = records.rows.map((e: any) => {
                    return {
                        productName: e.productName, productId: e.productId,
                        taxName: e.taxName, taxId: e.taxId,
                        salesAmountAfterDiscount: e.salesAmountAfterDiscount, salesTax: e.salesTax,
                        purchaseAmount: e.purchaseAmount, purchaseTax: e.purchaseTax,
                        netVat: e.netVat
                    }
                })

            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Product Wise Vat Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches
                }
                report.records = records.rows
                report.columns = [
                    { key: 'productName' }, { key: 'taxName' },
                    { key: 'salesAmountAfterDiscount', properties: { hasTotal: true, columnType: 'currency' } },
                    { key: 'salesTax', properties: { hasTotal: true, columnType: 'currency' } },
                    { key: 'purchaseAmount', properties: { hasTotal: true, columnType: 'currency' } },
                    { key: 'purchaseTax', properties: { hasTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'ProductWiseVatReport'

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

    public static async taxTransactionDetailsReport(data: any, company: Company, brancheList: []) {
        try {
            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            const filter = data.filter ?? {};
            let branches = filter?.branches ?? brancheList;

            //-------------- set time --------------
            let closingTime = "00:00:00";
            let fromDate = filter?.fromDate ? moment(new Date(filter.fromDate)) : moment();
            let toDate = filter?.toDate ? moment(new Date(filter.toDate)) : moment();

            const applyOpeningHour = filter?.applyOpeningHour ?? false;

            if (applyOpeningHour === true) {
                const branchId = branches?.[0];
                closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00";
            }

            const timeOffset = company.timeOffset;
            const interval = await TimeHelper.getReportTime(fromDate, toDate, closingTime, applyOpeningHour, timeOffset);
            const from = interval.from;
            const to = interval.to;
            //---------------------------------------

            //-------------- paging --------------
            const page = data.page != null ? data.page : (filter?.page ?? 1);
            const limit = data.limit != null ? data.limit : (filter?.limit ?? 50);
            const offset = limit * (page - 1);

            //-------------- sort --------------
            const sortby = filter?.sortBy ?? [];
            const sortList = sortby.filter((item: any) => item.sortValue && item.sortValue.trim() !== "");

            let orderByQuery = `order by "date" desc, "documentType" asc, "documentNumber" asc`;
            if (sortList.length > 0) {
                orderByQuery = "order by ";
                for (let i = 0; i < sortList.length; i++) {
                    orderByQuery += `"${sortList[i].sortValue.trim()}" ${sortList[i].sortDirection ?? ""}, `;
                }
                orderByQuery += `"date" desc`;
            }

            /**
             * ✅ التقرير الجديد: VAT Transaction Details / VAT Register
             * columns:
             * Tax | Document_type | Document_Number | Date | Client/Supplier | product/description | total_(exclusive) | Tax_Amount | Total_(inclusive)
             */
            const query: { text: string; values: any } = {
                text: `
      with "values" as (
        select
          $1::uuid as "companyId",
          $2::uuid[] as "branches",
          $3::timestamp as "fromDate",
          $4::timestamp as "toDate"
      ),

      /* =========================
         SALES (Invoices) LINES
         ========================= */
      "salesLines" as (
        select
          'Sales Invoice'::text as "documentType",
          "Invoices"."invoiceNumber" as "documentNumber",
          "Invoices"."invoiceDate"::timestamp as "date",
          coalesce( "Customers"."name", '') as "partyName",
          "InvoiceLines"."productId",
          coalesce("Products"."name", "InvoiceLines"."description", "InvoiceLines"."notes", '') as "description",
          "InvoiceLines"."taxId",
          coalesce("Taxes"."name", 'Exempt Tax') as "taxName",

          /* exclusive total after discount */
          (
            case
              when "InvoiceLines"."isInclusiveTax" = true
                then ( "InvoiceLines"."subTotal"::text::numeric - coalesce("InvoiceLines"."taxTotal"::text::numeric,0) )
              else "InvoiceLines"."subTotal"::text::numeric
            end
            - coalesce("InvoiceLines"."discountTotal"::text::numeric,0)
          ) as "totalExclusive",

          coalesce("InvoiceLines"."taxTotal"::text::numeric,0) as "taxAmount",

          /* inclusive total after discount */
          (
            case
              when "InvoiceLines"."isInclusiveTax" = true
                then ( "InvoiceLines"."subTotal"::text::numeric - coalesce("InvoiceLines"."discountTotal"::text::numeric,0) )
              else ( "InvoiceLines"."subTotal"::text::numeric - coalesce("InvoiceLines"."discountTotal"::text::numeric,0) + coalesce("InvoiceLines"."taxTotal"::text::numeric,0) )
            end
          ) as "totalInclusive"
        from "InvoiceLines"
        inner join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId" and "Invoices"."status" <> 'Draft'
        inner join "Branches" on "Branches".id = "Invoices"."branchId"
        join "values" on true
        left join "Products" on "Products".id = "InvoiceLines"."productId"
        left join "Taxes" on "Taxes".id = "InvoiceLines"."taxId"
        left join "Customers" on "Customers".id = "Invoices"."customerId"

        where
          "InvoiceLines"."companyId" = "values"."companyId"
          and ( array_length("values"."branches",1) is null or "Invoices"."branchId" = any("values"."branches") )
          and "Invoices"."invoiceDate"::timestamp >= "values"."fromDate"
          and "Invoices"."invoiceDate"::timestamp <  "values"."toDate"
      ),

      /* =========================
         SALES ADJUSTMENTS (Credit Notes) LINES
         ========================= */
      "salesAdjustLines" as (
        select
          'Credit Note'::text as "documentType",
          /* ⚠️ عدّل رقم المستند حسب سكيمتك */
          "CreditNotes"."creditNoteNumber" as "documentNumber",
          "CreditNotes"."creditNoteDate"::timestamp as "date",

          coalesce("Customers"."name", '') as "partyName",

          "CreditNoteLines"."productId",
          coalesce("Products"."name", "CreditNoteLines"."description", "CreditNoteLines"."notes", '') as "description",
          "CreditNoteLines"."taxId",
          coalesce("Taxes"."name", 'Exempt Tax') as "taxName",

          (
            (
              case
                when "CreditNoteLines"."isInclusiveTax" = true
                  then ( "CreditNoteLines"."subTotal"::text::numeric - coalesce("CreditNoteLines"."taxTotal"::text::numeric,0) )
                else "CreditNoteLines"."subTotal"::text::numeric
              end
              - coalesce("CreditNoteLines"."discountTotal"::text::numeric,0)
            ) * (-1)
          ) as "totalExclusive",

          (coalesce("CreditNoteLines"."taxTotal"::text::numeric,0) * (-1)) as "taxAmount",

          (
            (
              case
                when "CreditNoteLines"."isInclusiveTax" = true
                  then ( "CreditNoteLines"."subTotal"::text::numeric - coalesce("CreditNoteLines"."discountTotal"::text::numeric,0) )
                else ( "CreditNoteLines"."subTotal"::text::numeric - coalesce("CreditNoteLines"."discountTotal"::text::numeric,0) + coalesce("CreditNoteLines"."taxTotal"::text::numeric,0) )
              end
            ) * (-1)
          ) as "totalInclusive"
        from "CreditNoteLines"
        inner join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId"
        inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
        join "values" on true
        left join "Products" on "Products".id = "CreditNoteLines"."productId"
        left join "Taxes" on "Taxes".id = "CreditNoteLines"."taxId"

        left join "Clients" on "Clients".id = "CreditNotes"."clientId"
        left join "Customers" on "Customers".id = "CreditNotes"."customerId"

        where
          "Branches"."companyId" = "values"."companyId"
          and ( array_length("values"."branches",1) is null or "Branches".id = any("values"."branches") )
          and "CreditNotes"."creditNoteDate"::timestamp >= "values"."fromDate"
          and "CreditNotes"."creditNoteDate"::timestamp <  "values"."toDate"
      ),

      /* =========================
         PURCHASE (Billings) LINES
         ========================= */
      "purchaseLines" as (
        select
          'Purchase Bill'::text as "documentType",
          "Billings"."billingNumber" as "documentNumber",
          "Billings"."billingDate"::timestamp as "date",
          coalesce("Suppliers"."name", '') as "partyName",
          "BillingLines"."productId",
          coalesce("Products"."name", "BillingLines"."description", "BillingLines"."notes", '') as "description",
          "BillingLines"."taxId",
          coalesce("Taxes"."name", 'Exempt Tax') as "taxName",

          /* في سكيمتك عندك taxableAmount جاهز */
          coalesce("BillingLines"."taxableAmount"::text::numeric, 0) as "totalExclusive",
          coalesce("BillingLines"."taxTotal"::text::numeric,0) as "taxAmount",
          (coalesce("BillingLines"."taxableAmount"::text::numeric,0) + coalesce("BillingLines"."taxTotal"::text::numeric,0)) as "totalInclusive"
        from "BillingLines"
        inner join "Billings" on "Billings".id = "BillingLines"."billingId" and "Billings"."status" <> 'Draft'
        inner join "Branches" on "Branches".id = "Billings"."branchId"
        join "values" on true
        left join "Products" on "Products".id = "BillingLines"."productId"
        left join "Taxes" on "Taxes".id = "BillingLines"."taxId"
        left join "Suppliers" on "Suppliers".id = "Billings"."supplierId"
        where
          "Branches"."companyId" = "values"."companyId"
          and ( array_length("values"."branches",1) is null or "Branches".id = any("values"."branches") )
          and "Billings"."billingDate"::timestamp >= "values"."fromDate"
          and "Billings"."billingDate"::timestamp <  "values"."toDate"
      ),

      /* =========================
         PURCHASE ADJUSTMENTS (Supplier Credits) LINES
         ========================= */
      "purchaseAdjustLines" as (
        select
          'Supplier Credit'::text as "documentType",
          coalesce("SupplierCredits"."supplierCreditNumber"::text, "SupplierCredits"."number"::text, "SupplierCredits"."code"::text, "SupplierCredits"."id"::text) as "documentNumber",
          "SupplierCredits"."supplierCreditDate"::timestamp as "date",
          coalesce("Suppliers"."name", '') as "partyName",

          "SupplierCreditLines"."productId",
          coalesce("Products"."name", "SupplierCreditLines"."description", "SupplierCreditLines"."notes", '') as "description",
          "SupplierCreditLines"."taxId",
          coalesce("Taxes"."name", 'Exempt Tax') as "taxName",

          (coalesce("SupplierCreditLines"."taxableAmount"::text::numeric,0) * (-1)) as "totalExclusive",
          (coalesce("SupplierCreditLines"."taxTotal"::text::numeric,0) * (-1)) as "taxAmount",
          ((coalesce("SupplierCreditLines"."taxableAmount"::text::numeric,0) + coalesce("SupplierCreditLines"."taxTotal"::text::numeric,0)) * (-1)) as "totalInclusive"
        from "SupplierCreditLines"
        inner join "SupplierCredits" on "SupplierCredits".id = "SupplierCreditLines"."supplierCreditId"
        inner join "Branches" on "Branches".id = "SupplierCredits"."branchId"
        join "values" on true
        left join "Products" on "Products".id = "SupplierCreditLines"."productId"
        left join "Taxes" on "Taxes".id = "SupplierCreditLines"."taxId"
        left join "Suppliers" on "Suppliers".id = "SupplierCredits"."supplierId"
        where
          "Branches"."companyId" = "values"."companyId"
          and ( array_length("values"."branches",1) is null or "Branches".id = any("values"."branches") )
          and "SupplierCredits"."supplierCreditDate"::timestamp >= "values"."fromDate"
          and "SupplierCredits"."supplierCreditDate"::timestamp <  "values"."toDate"
      ),

      /* =========================
         BILL OF ENTRY (Import) LINES
         ========================= */
      "boeLines" as (
        select
          'Bill Of Entry'::text as "documentType",
          coalesce("BillOfEntries"."billOfEntryNumber"::text, "BillOfEntries"."number"::text, "BillOfEntries"."code"::text, "BillOfEntries"."id"::text) as "documentNumber",
          "BillOfEntries"."billingOfEntryDate"::timestamp as "date",
          coalesce("Suppliers"."name", '') as "partyName",

          "BillOfEntryLines"."productId",
          coalesce("Products"."name", "BillOfEntryLines"."description", '') as "description",
          "BillOfEntryLines"."taxId",
          coalesce("Taxes"."name", 'Exempt Tax') as "taxName",

          (
            case
              when "BillOfEntryLines"."isInclusiveTax" = true then
                (
                  "BillOfEntryLines"."subTotal"::text::numeric
                  + coalesce("BillOfEntryLines"."customDuty",0)
                  - (coalesce("BillOfEntryLines"."billDiscount",0) + coalesce("BillOfEntryLines"."discountTotal",0))
                  - coalesce("BillOfEntryLines"."taxTotal"::text::numeric,0)
                )
              else
                (
                  "BillOfEntryLines"."subTotal"::text::numeric
                  + coalesce("BillOfEntryLines"."customDuty",0)
                  - (coalesce("BillOfEntryLines"."billDiscount",0) + coalesce("BillOfEntryLines"."discountTotal",0))
                )
            end
          ) as "totalExclusive",

          coalesce("BillOfEntryLines"."taxTotal"::text::numeric,0) as "taxAmount",

          (
            case
              when "BillOfEntryLines"."isInclusiveTax" = true then
                (
                  "BillOfEntryLines"."subTotal"::text::numeric
                  + coalesce("BillOfEntryLines"."customDuty",0)
                  - (coalesce("BillOfEntryLines"."billDiscount",0) + coalesce("BillOfEntryLines"."discountTotal",0))
                )
              else
                (
                  "BillOfEntryLines"."subTotal"::text::numeric
                  + coalesce("BillOfEntryLines"."customDuty",0)
                  - (coalesce("BillOfEntryLines"."billDiscount",0) + coalesce("BillOfEntryLines"."discountTotal",0))
                  + coalesce("BillOfEntryLines"."taxTotal"::text::numeric,0)
                )
            end
          ) as "totalInclusive"

        from "BillOfEntryLines"
        inner join "BillOfEntries" on "BillOfEntries".id = "BillOfEntryLines"."billOfEntryId" and "BillOfEntries"."status" <> 'Draft'
        inner join "Branches" on "Branches".id = "BillOfEntries"."branchId"
        join "values" on true
        left join "Products" on "Products".id = "BillOfEntryLines"."productId"
        left join "Taxes" on "Taxes".id = "BillOfEntryLines"."taxId"
        left join "Suppliers" on "Suppliers".id = "BillOfEntries"."supplierId"
        where
          "Branches"."companyId" = "values"."companyId"
          and ( array_length("values"."branches",1) is null or "Branches".id = any("values"."branches") )
          and "BillOfEntries"."billingOfEntryDate"::timestamp >= "values"."fromDate"
          and "BillOfEntries"."billingOfEntryDate"::timestamp <  "values"."toDate"
      ),

      /* =========================
         UNION ALL DOCUMENT LINES
         ========================= */
      "allRecords" as (
        select * from "salesLines"
        union all select * from "salesAdjustLines"
        union all select * from "purchaseLines"
        union all select * from "purchaseAdjustLines"
        union all select * from "boeLines"
      )

      select
        "taxName" as "tax",
        "documentType",
        "documentNumber",
        "date",
        "partyName" as "clientOrSupplier",
        "description" as "productOrDescription",
        "totalExclusive",
        "taxAmount",
        "totalInclusive",

        count(*) over() as "count",
        sum("totalExclusive"::numeric) over() as "totalExclusiveTotal",
        sum("taxAmount"::numeric) over() as "taxAmountTotal",
        sum("totalInclusive"::numeric) over() as "totalInclusiveTotal"

      from "allRecords"
      ${orderByQuery}
      `,
                values: [companyId, branches, from, to],
            };

            const limitQuery = filter.export && filter.export === true ? "" : ` limit ${limit} offset ${offset}`;
            const records = await DB.excu.query(query.text + limitQuery, query.values);

            let count = 0;
            let total: any = {};
            let result: any[] = [];

            if (records.rows && records.rows.length > 0) {
                const t: any = records.rows[0];
                count = Number(t.count);

                total = {
                    totalExclusive: t.totalExclusiveTotal,
                    taxAmount: t.taxAmountTotal,
                    totalInclusive: t.totalInclusiveTotal,
                };

                result = records.rows.map((e: any) => ({
                    tax: e.tax,
                    documentType: e.documentType,
                    documentNumber: e.documentNumber,
                    date: e.date,
                    clientOrSupplier: e.clientOrSupplier,
                    productOrDescription: e.productOrDescription,
                    totalExclusive: e.totalExclusive,
                    taxAmount: e.taxAmount,
                    totalInclusive: e.totalInclusive,
                }));
            }

            if (filter.export) {
                const report = new ReportData();
                report.filter = {
                    title: "VAT Transaction Details Report",
                    fromDate: filter?.fromDate ?? null,
                    toDate: filter?.toDate ?? new Date(),
                    branches: branches,
                };
                report.records = records.rows;
                report.columns = [
                    { key: "tax" },
                    { key: "documentType" },
                    { key: "documentNumber" },
                    { key: "date", properties: { columnType: "date" } },
                    { key: "clientOrSupplier" },
                    { key: "productOrDescription" },
                    { key: "totalExclusive", properties: { hasTotal: true, columnType: "currency" } },
                    { key: "taxAmount", properties: { hasTotal: true, columnType: "currency" } },
                    { key: "totalInclusive", properties: { hasTotal: true, columnType: "currency" } },
                ];
                report.fileName = "VatTransactionDetailsReport";
                return new ResponseData(true, "", report);
            }

            const pageCount = Math.ceil(count / limit);
            const startIndex = offset + 1;
            let lastIndex = page * limit;
            if (records.rows.length < limit || page === pageCount) lastIndex = count;

            return new ResponseData(true, "", {
                records: result,
                count,
                total,
                pageCount,
                startIndex,
                lastIndex,
            });
        } catch (error: any) {
          
            throw new Error(error);
        }
    }

    //subReport

    public static async salesVatDetailsByVatIdReport(data: any, company: Company, brancheList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let taxId = filter && filter.taxId ? filter.taxId : null
            if (!taxId) { throw new ValidationException("taxId is required") }


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
                            $5::uuid as "taxId"
                        )
                       ,"TaxesData" as(
                        select "Taxes".*
                        from "Taxes" 
                        join "values" on TRUE
                        where "Taxes"."companyId" = "values"."companyId" 
                        )

                        ,"invoiceLinesData" as (
                        select "InvoiceLines".*,"Invoices"."customerId", "Invoices"."invoiceNumber" , "Invoices"."createdAt" as "invoiceCreatedAt" ,
                            COALESCE(nullif(nullif(elem.value->>'taxId', ''),'null')::uuid,"InvoiceLines"."taxId" ) as "mergedTaxId",  (elem.index -1 )::real as "taxIndex",
                            COALESCE(nullif(COALESCE(elem.value->>'taxAmount', elem.value->>'taxTotal'),'')::real,"InvoiceLines"."taxTotal" ) as "mergedTaxAmount"
                        from "InvoiceLines" 
                        join "values" on true
                        inner join "Invoices" on "Invoices".id  =  "InvoiceLines"."invoiceId" 
                        inner join "Branches" on "Branches".id = "Invoices"."branchId"
                        left  join  jsonb_array_elements(nullif("InvoiceLines"."taxes",'null') ) WITH ORDINALITY  elem (value, index)  on nullif("InvoiceLines"."taxType",'') is not null
                        inner join "TaxesData" on "TaxesData".id = "InvoiceLines"."taxId" or ("TaxesData".name ='Exempt Tax' and "InvoiceLines"."taxId" is null) or ("TaxesData".id = nullif(nullif(elem.value->>'taxId','null'),'')::uuid)
                        where "InvoiceLines"."createdAt" >= "values"."fromDate" and "InvoiceLines"."createdAt" <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                            and  "TaxesData".id = "values"."taxId"
                            and "Invoices"."status" <>'Draft' 
                        )
                        , "invoiceChargesData" as (	
                        select "Invoices".*,
                            nullif("Invoices"."chargesTaxDetails"->>'taxes','')::jsonb as taxes, 
                            "Invoices"."chargesTaxDetails"->>'type' as "type",
                            COALESCE(nullif(nullif(elem.value->>'taxId', ''),'null'),nullif(nullif("Invoices"."chargesTaxDetails"->>'taxId', ''),'null') )::uuid as "mergedTaxId",
                            (elem.index -1)::real as "taxIndex",
                            COALESCE(nullif(COALESCE(elem.value->>'taxAmount', elem.value->>'taxTotal'),''))::real as "mergedTaxAmount",
                            "Invoices"."chargeTotal" as "amount",
                            ( "Invoices"."chargesTaxDetails"->>'taxAmount')::real as"taxTotal"
                        from "Invoices" 
                        join "values" on true
                        inner join "Branches" on "Branches".id = "Invoices"."branchId"
                        left  join  jsonb_array_elements(nullif( "Invoices"."chargesTaxDetails"->>'taxes','null')::jsonb )WITH ORDINALITY  elem (value, index) on true
                        inner join "TaxesData" on "TaxesData".id = (nullIf(nullIf("Invoices"."chargesTaxDetails"->>'taxId',''),'null'))::uuid or  ("TaxesData".name ='Exempt Tax' and (nullIf(nullIf("Invoices"."chargesTaxDetails"->>'taxId',''),'null'))::uuid is null) or ("TaxesData".id =  nullif(nullif("elem".value->>'taxId','null'),'')::uuid)
                        where "Invoices"."createdAt" >= "values"."fromDate" and "Invoices"."createdAt" <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                            and "Invoices"."status" <>'Draft'  and  "TaxesData".id = "values"."taxId"
                            and "Invoices"."chargeTotal" <> 0 
                        )

                        ,"ChargesStackedTax" as (	
                        select "invoiceChargesData".id,  "mergedTaxId" as "taxId", "invoiceChargesData"."customerId", 
                                "mergedTaxAmount" as "taxTotal", "taxIndex"
                        From "invoiceChargesData"
                        where  "type"= 'stacked' 

                        )
                        ,"LinesStackedTax" as (	
                        select "invoiceLinesData".id, "invoiceId" ,"mergedTaxId" as "taxId", "invoiceLinesData"."customerId", 
                                "mergedTaxAmount" as "taxTotal", "taxIndex"
                        From "invoiceLinesData"
                        where "taxType" = 'stacked'
                        )
                        ,"invoiceStackedTotal" as (	
                        select "invoiceId",  sum ("amount" ) as "amount" 
                        from (
                            SELECT  "taxId", id as "invoiceId",
                            SUM("taxTotal" ) OVER ( PARTITION BY id order by "taxIndex" ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                            FROM "ChargesStackedTax"
                            union all
                            SELECT  "taxId", "invoiceId",
                            SUM("taxTotal" ) OVER ( PARTITION BY id order by "taxIndex" ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                            FROM "LinesStackedTax"
                        )t
                        join "values" on true
                        where "values"."taxId" = t."taxId"
                        group by "invoiceId"
                        )
                        ,"invoiceLinesTotalData" as ( 
                        select  'InputTax' AS "parentType",
                                'Invoice' AS "type",
							"invoiceLinesData"."customerId",
                                "invoiceLinesData"."invoiceNumber" AS "referenceNumber",
                                "invoiceLinesData"."invoiceId" AS "referenceId",
                                Date("invoiceLinesData"."invoiceCreatedAt")  AS "Date",
                                (CASE WHEN  "invoiceLinesData"."taxPercentage" <> 0  
                                THEN (COALESCE("invoiceLinesData"."subTotal",0)::text::numeric 
                                    - (case when "invoiceLinesData"."isInclusiveTax"  then COALESCE("invoiceLinesData"."taxTotal",0)::text::numeric  else 0 end)  
                                    - COALESCE("invoiceLinesData"."discountTotal",0)::text::numeric) 
                                END) as "taxableAmount" ,
                                ( "TaxesData".name) as name,
                                ("invoiceLinesData"."mergedTaxAmount"::text::numeric) as vat,
                                (CASE WHEN  "invoiceLinesData"."taxId" is null OR "invoiceLinesData"."taxPercentage"  = 0 then COALESCE("invoiceLinesData"."subTotal",0)::text::numeric - COALESCE("invoiceLinesData"."discountTotal",0)::text::numeric END ) as "none_taxableAmount",
                                (COALESCE("invoiceLinesData"."subTotal",0)::text::numeric + COALESCE("invoiceLinesData"."mergedTaxAmount",0)::text::numeric 
                                    - (case when "invoiceLinesData"."isInclusiveTax"  then COALESCE("invoiceLinesData"."taxTotal",0)::text::numeric  else 0 end)  
                                    - COALESCE("invoiceLinesData"."discountTotal",0)::text::numeric 
                                ) as "totalAmount" 
                        from "invoiceLinesData"
                        left join "TaxesData" on "TaxesData".id = "invoiceLinesData"."mergedTaxId" 
                            
                        union all 
                            
                        select  'InputTax' AS "parentType",
                                'Invoice' AS "type",
								"invoiceChargesData"."customerId",
                                "invoiceChargesData"."invoiceNumber" AS "referenceNumber",
                                "invoiceChargesData".id AS "referenceId",
                                Date("invoiceChargesData"."createdAt")  AS "Date",
                                case when  ("invoiceChargesData"."chargesTaxDetails"->'taxId' is not null and COALESCE( nullif("invoiceChargesData"."chargesTaxDetails"->>'taxPercentage','')::numeric,0)<>0) then 
                                    COALESCE("invoiceChargesData"."chargeTotal",0)::text::numeric 
                                - ( case when "invoiceChargesData"."isInclusiveTax"  then COALESCE("invoiceChargesData"."taxTotal",0)::text::numeric  else 0 end )end  as "taxableAmount" ,
                                "TaxesData".name as  name,
                                ("invoiceChargesData"."mergedTaxAmount"::text::numeric) as vat,
                                case when  ("invoiceChargesData"."chargesTaxDetails" is  null OR "invoiceChargesData"."chargesTaxDetails"->'taxId' is null OR  COALESCE( nullif("invoiceChargesData"."chargesTaxDetails"->>'taxPercentage','')::numeric,0)= 0) then COALESCE("invoiceChargesData"."chargeTotal",0)::text::numeric   end   as "none_taxableAmount",

                                ("invoiceChargesData"."chargeTotal"+ COALESCE("invoiceChargesData"."mergedTaxAmount",0)::text::numeric 
                                    - (case when "invoiceChargesData"."isInclusiveTax"  then COALESCE("invoiceChargesData"."taxTotal",0)::text::numeric  else 0 end)  

                                ) as "totalAmount" 
                        from "invoiceChargesData"
                        LEFT join "TaxesData" on "TaxesData".id = "invoiceChargesData"."mergedTaxId" 

                        )

                        ,"invoiceLinesTotal" as (
                        select  "parentType","type","referenceNumber","referenceId", "Date", "invoiceLinesTotalData"."customerId",
                                sum("taxableAmount")as "taxableAmount"  ,
                                array_agg(distinct name)  as  name,
                                sum(vat) as vat,
                                sum("none_taxableAmount") "none_taxableAmount",
                                sum("totalAmount" ) as "totalAmount" 
                        from "invoiceLinesTotalData"
                        group by "parentType","type","referenceNumber","referenceId", "Date", "invoiceLinesTotalData"."customerId"
                        )
                        ,"InvoiceTotal" as(		
                        select  "parentType","type","referenceNumber","referenceId", "Date","invoiceLinesTotal"."customerId",
                                COALESCE("taxableAmount",0)  - COALESCE("invoiceStackedTotal"."amount",0)  as "taxableAmount",
                                name,
                                vat,
                                "none_taxableAmount",
                                COALESCE("totalAmount",0) - COALESCE("invoiceStackedTotal"."amount",0) as "totalAmount"  
                        from "invoiceLinesTotal"
                        left join "invoiceStackedTotal" on "invoiceStackedTotal"."invoiceId" = "invoiceLinesTotal"."referenceId"
                        )
                        ,"creditNoteLinesData" as (
                        select "CreditNoteLines".*,"Invoices"."customerId", "CreditNotes"."creditNoteNumber" , "CreditNotes"."createdAt" as "creditNoteCreatedAt" ,
                            COALESCE(nullif(nullif(elem.value->>'taxId', ''),'null')::uuid,"CreditNoteLines"."taxId" ) as "mergedTaxId",  (elem.index -1 )::real as "taxIndex",
                            COALESCE(nullif(COALESCE(elem.value->>'taxAmount', elem.value->>'taxTotal'),'')::real,"CreditNoteLines"."taxTotal" ) as "mergedTaxAmount"
                        from "CreditNoteLines" 
                        join "values" on true
                        inner join "CreditNotes" on "CreditNotes".id  =  "CreditNoteLines"."creditNoteId" 
                        INNER JOIN "Invoices"  on "Invoices"."companyId"= "values"."companyId" and "Invoices".id  =  "CreditNotes"."invoiceId" 
                        inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
                        left  join  jsonb_array_elements(nullif("CreditNoteLines"."taxes",'null') ) WITH ORDINALITY  elem (value, index)  on nullif("CreditNoteLines"."taxType",'') is not null
                        inner join "TaxesData" on "TaxesData".id = "CreditNoteLines"."taxId" or ("TaxesData".name ='Exempt Tax' and "CreditNoteLines"."taxId" is null) or ("TaxesData".id = nullif(nullif(elem.value->>'taxId','null'),'')::uuid)
                        where "CreditNoteLines"."createdAt" >= "values"."fromDate" and "CreditNoteLines"."createdAt" <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                            and  "TaxesData".id = "values"."taxId"
                        )
                        , "creditNoteChargesData" as (	
                        select "CreditNotes".*,"Invoices"."customerId",
                                nullif("CreditNotes"."chargesTaxDetails"->>'taxes','')::jsonb as taxes, 
                                "CreditNotes"."chargesTaxDetails"->>'type' as "type",
                                COALESCE(nullif(nullif(elem.value->>'taxId', ''),'null'),nullif(nullif("CreditNotes"."chargesTaxDetails"->>'taxId', ''),'null') )::uuid as "mergedTaxId",
                                (elem.index -1)::real as "taxIndex",
                                COALESCE(nullif(COALESCE(elem.value->>'taxAmount', elem.value->>'taxTotal'),''))::real as "mergedTaxAmount",
                                "CreditNotes"."chargeTotal" as "amount",
                                ( "CreditNotes"."chargesTaxDetails"->>'taxAmount')::real as"taxTotal"
                        from "CreditNotes" 
                        join "values" on true
                        inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
						INNER JOIN "Invoices"  on "Invoices"."companyId"= "values"."companyId" and "Invoices".id  =  "CreditNotes"."invoiceId" 
                        left  join  jsonb_array_elements(nullif( "CreditNotes"."chargesTaxDetails"->>'taxes','null')::jsonb )WITH ORDINALITY  elem (value, index) on true
                        inner join "TaxesData" on "TaxesData".id = (nullIf(nullIf("CreditNotes"."chargesTaxDetails"->>'taxId',''),'null'))::uuid or  ("TaxesData".name ='Exempt Tax' and (nullIf(nullIf("CreditNotes"."chargesTaxDetails"->>'taxId',''),'null'))::uuid is null) or ("TaxesData".id =  nullif(nullif("elem".value->>'taxId','null'),'')::uuid)
                            where "CreditNotes"."createdAt" >= "values"."fromDate" and "CreditNotes"."createdAt" <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                            and  "TaxesData".id = "values"."taxId"
                            and "CreditNotes"."chargeTotal" <> 0 
                        )			
                        ,"CNChargesStackedTax" as (	
                        select "creditNoteChargesData".id,  "mergedTaxId" as "taxId","creditNoteChargesData"."customerId",
                        "mergedTaxAmount" as "taxTotal", "taxIndex"
                        From "creditNoteChargesData"
                        where  "type"= 'stacked' 
                        )
                        ,"CNLinesStackedTax" as (	
                        select "creditNoteLinesData".id, "creditNoteId" ,"mergedTaxId" as "taxId","creditNoteLinesData"."customerId",
                        "mergedTaxAmount" as "taxTotal", "taxIndex"
                        From "creditNoteLinesData"
                        where "taxType" = 'stacked'
                        )
                        ,"creditNoteStackedTotal" as (	
                        select "creditNoteId",  sum ("amount" ) as "amount" 
                        from (
                            SELECT  "taxId", id as "creditNoteId",
                            SUM("taxTotal" ) OVER ( PARTITION BY id order by "taxIndex" ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                            FROM "CNChargesStackedTax"
                            union all
                            SELECT  "taxId", "creditNoteId",
                            SUM("taxTotal" ) OVER ( PARTITION BY id order by "taxIndex" ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                            FROM "CNLinesStackedTax"
                        )t
                        join "values" on true
                        where "values"."taxId" = t."taxId"
                        group by "creditNoteId"
                        )
                        ,"creditNoteLinesTotalData" as ( 
                        select   'InputTax' AS "parentType",
                            'CreditNote' AS "type",
							  "creditNoteLinesData"."customerId",
                            "creditNoteLinesData"."creditNoteNumber" AS "referenceNumber",
                            "creditNoteLinesData"."creditNoteId" AS "referenceId",
                            Date("creditNoteLinesData"."creditNoteCreatedAt")  AS "Date",
                            (CASE WHEN  "creditNoteLinesData"."taxPercentage" <> 0  
                                THEN (COALESCE("creditNoteLinesData"."subTotal",0)::text::numeric 
                                - (case when "creditNoteLinesData"."isInclusiveTax"  then COALESCE("creditNoteLinesData"."taxTotal",0)::text::numeric  else 0 end)  
                                - COALESCE("creditNoteLinesData"."discountTotal",0)::text::numeric) 
                            END) as "taxableAmount" ,
                            ( "TaxesData".name) as name,
                            ("creditNoteLinesData"."mergedTaxAmount"::text::numeric) as vat,
                            (CASE WHEN  "creditNoteLinesData"."taxId" is null OR "creditNoteLinesData"."taxPercentage"  = 0 then COALESCE("creditNoteLinesData"."subTotal",0)::text::numeric - COALESCE("creditNoteLinesData"."discountTotal",0)::text::numeric END ) as "none_taxableAmount",
                            (COALESCE("creditNoteLinesData"."subTotal",0)::text::numeric + COALESCE("creditNoteLinesData"."mergedTaxAmount",0)::text::numeric 
                            - (case when "creditNoteLinesData"."isInclusiveTax"  then COALESCE("creditNoteLinesData"."taxTotal",0)::text::numeric  else 0 end)  
                            - COALESCE("creditNoteLinesData"."discountTotal",0)::text::numeric 
                            ) as "totalAmount" 
                        from "creditNoteLinesData"
                        left join "TaxesData" on "TaxesData".id = "creditNoteLinesData"."mergedTaxId" 

                        union all 

                        select  'InputTax' AS "parentType",
                                'CreditNote' AS "type",
							"creditNoteChargesData"."customerId",
                                "creditNoteChargesData"."creditNoteNumber" AS "referenceNumber",
                                "creditNoteChargesData".id AS "referenceId",
                                Date("creditNoteChargesData"."createdAt")  AS "Date",
                                case when  ("creditNoteChargesData"."chargesTaxDetails"->'taxId' is not null and COALESCE( nullif("creditNoteChargesData"."chargesTaxDetails"->>'taxPercentage','')::numeric,0)<>0) then 
                                COALESCE("creditNoteChargesData"."chargeTotal",0)::text::numeric 
                                    - ( case when "creditNoteChargesData"."isInclusiveTax"  then COALESCE("creditNoteChargesData"."taxTotal",0)::text::numeric  else 0 end )end  as "taxableAmount" ,
                                "TaxesData".name as  name,
                                ("creditNoteChargesData"."mergedTaxAmount"::text::numeric) as vat,
                                case when  ("creditNoteChargesData"."chargesTaxDetails" is  null OR "creditNoteChargesData"."chargesTaxDetails"->'taxId' is null OR  COALESCE( nullif("creditNoteChargesData"."chargesTaxDetails"->>'taxPercentage','')::numeric,0)= 0) then COALESCE("creditNoteChargesData"."chargeTotal",0)::text::numeric   end   as "none_taxableAmount",

                                ("creditNoteChargesData"."chargeTotal"+ COALESCE("creditNoteChargesData"."mergedTaxAmount",0)::text::numeric 
                                - (case when "creditNoteChargesData"."isInclusiveTax"  then COALESCE("creditNoteChargesData"."taxTotal",0)::text::numeric  else 0 end)  
                                ) as "totalAmount" 

                        from "creditNoteChargesData"
                        LEFT join "TaxesData" on "TaxesData".id = "creditNoteChargesData"."mergedTaxId" 
                        )
                        ,"creditNoteLinesTotal" as (
                        select  "parentType","type","referenceNumber","referenceId", "Date","creditNoteLinesTotalData"."customerId",
                            sum("taxableAmount")as "taxableAmount"  ,
                            array_agg(distinct name)  as  name,
                            sum(vat) as vat,
                            sum("none_taxableAmount") "none_taxableAmount",
                            sum("totalAmount" ) as "totalAmount" 
                        from "creditNoteLinesTotalData"
                        group by "parentType","type","referenceNumber","referenceId", "Date","creditNoteLinesTotalData"."customerId"
                        )				
                        ,"CreditNoteTotal" as(		
                        select  "parentType","type","referenceNumber","referenceId", "Date","creditNoteLinesTotal"."customerId",
                            (COALESCE("taxableAmount",0)  - COALESCE("creditNoteStackedTotal"."amount",0)) *(-1) as "taxableAmount",
                            name, vat*(-1),
                            ("none_taxableAmount")*(-1),
                            (COALESCE("totalAmount",0) - COALESCE("creditNoteStackedTotal"."amount",0))*(-1) as "totalAmount"  
                        from "creditNoteLinesTotal"
                        left join "creditNoteStackedTotal" on "creditNoteStackedTotal"."creditNoteId" = "creditNoteLinesTotal"."referenceId"
                        )

                        select 
                        count(*) over(), 
                        sum("taxableAmount") over() as "taxableAmountTotal",
                        sum("vat") over() as "vatTotal",
                        sum("none_taxableAmount") over() as "none_taxableAmountTotal",
                        sum("totalAmount") over() as "amountTotal",
                        T.*,"Customers"."name" as "contactName"
                        from(select * from "InvoiceTotal" union select * from "CreditNoteTotal" ) T
						left join "Customers" on "Customers"."companyId" = $1 and "Customers".id = T."customerId"
                        order by "parentType", "Date" asc, "referenceNumber"		

                    
                    `,
                values: [companyId, branches, from, to, taxId]
            }

            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`


            const records = await DB.excu.query(query.text + limitQuery, query.values);

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)

                total = { taxableAmount: t.taxableAmountTotal, vat: t.vatTotal, none_taxableAmount: t.none_taxableAmountTotal, totalAmount: t.amountTotal }
                resault = records.rows.map((e: any) => {
                    return {
                        parentType: e.parentType, type: e.type,
                        referenceNumber: e.referenceNumber, referenceId: e.referenceId,
                        ContactName: e.contactName,
                        date: e.Date, taxableAmount: e.taxableAmount,
                        name: e.name, vat: e.vat, none_taxableAmount: e.none_taxableAmount, totalAmount: e.totalAmount
                    }
                })




            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Vat Audit Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches,

                }
                resault.forEach(elem => { elem.date = moment.utc(elem.date).utcOffset(+timeOffset).format('YYYY-MM-DD') })
                report.records = resault
                report.columns = [{ key: 'date', properties: { columnType: 'date' } },
                { key: 'type' },
                { key: 'referenceNumber' },
                { key: 'ContactName', header: 'Contact Name' },
                { key: 'name' },
                { key: 'taxableAmount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'vat', header: 'Tax', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'none_taxableAmount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'totalAmount', properties: { hasTotal: true, columnType: 'currency' } },
                ]
                report.fileName = 'VatAuditReport'

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

    public static async purchaseVatDetailsByVatIdReport(data: any, company: Company, brancheList: []) {
        try {


            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let taxes = filter ? filter.taxes ? filter.taxes : filter.taxId ? [filter.taxId] : [] : []
            if (taxes.length < 1) { throw new ValidationException("taxId is required") }



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
                            $5::uuid[] as "taxes"
                        )
                        ,"TaxesData" as(
                        select "Taxes".*
                        from "Taxes" 
                        join "values" on TRUE
                        where "Taxes"."companyId" = "values"."companyId" 
                        )
                        ,"expenseLinesData" as (
                        select "ExpenseLines".*, "Expenses"."expenseNumber" , "Expenses"."expenseDate" as "expenseCreatedAt" ,
                            COALESCE(nullif(nullif(elem.value->>'taxId', ''),'null')::uuid,"ExpenseLines"."taxId" ) as "mergedTaxId",  (elem.index -1 )::real as "taxIndex",
                            COALESCE(nullif(COALESCE(elem.value->>'taxAmount', elem.value->>'taxTotal'),'')::real,"ExpenseLines"."taxTotal" ) as "mergedTaxAmount"
                        from "ExpenseLines" 
                        join "values" on true
                        inner join "Expenses" on "Expenses".id  =  "ExpenseLines"."expenseId" 
                        inner join "Branches" on "Branches".id = "Expenses"."branchId"
                        left  join  jsonb_array_elements(nullif("ExpenseLines"."taxes",'null') ) WITH ORDINALITY  elem (value, index)  on nullif("ExpenseLines"."taxType",'') is not null
                        inner join "TaxesData" on "TaxesData".id = "ExpenseLines"."taxId" or ("TaxesData".name ='Exempt Tax' and "ExpenseLines"."taxId" is null) or ("TaxesData".id = nullif(nullif(elem.value->>'taxId','null'),'')::uuid)
                        where "Expenses"."expenseDate" >= "values"."fromDate" and "Expenses"."expenseDate" <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                            and  "TaxesData".id = any("values"."taxes")

                        )

                        ,"EPLinesStackedTax" as (	
                        select "expenseLinesData".id, "expenseId" ,"mergedTaxId" as "taxId",
                                "mergedTaxAmount" as "taxTotal", "taxIndex"
                        From "expenseLinesData"
                        where "taxType" = 'stacked'
                        )
                        ,"expenseStackedTotal" as (	
                        select "expenseId",  sum ("amount" ) as "amount" 
                        from (
                            SELECT  "taxId", "expenseId",
                            SUM("taxTotal" ) OVER ( PARTITION BY id order by "taxIndex" ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                            FROM "EPLinesStackedTax"
                        )t
                        join "values" on true
                        where t."taxId" = any("values"."taxes")
                        group by "expenseId"
                        )
                        ,"expenseLinesTotalData" as ( 
                        select  'InputTax' AS "parentType",
                                'Expense' AS "type",
                                "expenseLinesData"."expenseNumber" AS "referenceNumber",
                                "expenseLinesData"."expenseId" AS "referenceId",
                                Date("expenseLinesData"."expenseCreatedAt")  AS "Date",
                                (CASE WHEN  "expenseLinesData"."taxPercentage" <> 0  
                                THEN (COALESCE("expenseLinesData"."amount",0)::text::numeric 
                                    - (case when "expenseLinesData"."isInclusiveTax"  then COALESCE("expenseLinesData"."taxTotal",0)::text::numeric  else 0 end)  
                                    ) 
                                END) as "taxableAmount" ,
                                ( "TaxesData".name) as name,
                                ("expenseLinesData"."mergedTaxAmount"::text::numeric) as vat,
                                (CASE WHEN  "expenseLinesData"."taxId" is null OR "expenseLinesData"."taxPercentage"  = 0 then COALESCE("expenseLinesData"."amount",0)::text::numeric  END ) as "none_taxableAmount",
                                (COALESCE("expenseLinesData"."amount",0)::text::numeric + COALESCE("expenseLinesData"."mergedTaxAmount",0)::text::numeric 
                                    - (case when "expenseLinesData"."isInclusiveTax"  then COALESCE("expenseLinesData"."taxTotal",0)::text::numeric  else 0 end)  
                                    
                                ) as "totalAmount" 
                        from "expenseLinesData"
                        left join "TaxesData" on "TaxesData".id = "expenseLinesData"."mergedTaxId" 
                        )

                        ,"expenseLinesTotal" as (
                        select  "parentType","type","referenceNumber","referenceId", "Date",
                                sum("taxableAmount")as "taxableAmount"  ,
                                array_agg(distinct COALESCE(name,'Exempt Tax'))  as  name,
                                sum(vat) as vat,
                                sum("none_taxableAmount") "none_taxableAmount",
                                sum("totalAmount" ) as "totalAmount" 
                        from "expenseLinesTotalData"
                        group by "parentType","type","referenceNumber","referenceId", "Date"
                        )
                        ,"ExpenseTotal" as(		
                        select  "parentType","type","referenceNumber","referenceId", "Date", null::uuid as "supplierId",
                                COALESCE("taxableAmount",0)  - COALESCE("expenseStackedTotal"."amount",0)  as "taxableAmount",
                                name,
                                vat,
                                "none_taxableAmount",
                                COALESCE("totalAmount",0) - COALESCE("expenseStackedTotal"."amount",0) as "totalAmount"  
                        from "expenseLinesTotal"
                        left join "expenseStackedTotal" on "expenseStackedTotal"."expenseId" = "expenseLinesTotal"."referenceId"
                        )

                        ,"billingLinesData" as (
                        select "BillingLines".*,"Billings"."supplierId", "Billings"."billingNumber" , "Billings"."billingDate" as "billingCreatedAt" ,
                            COALESCE(nullif(nullif(elem.value->>'taxId', ''),'null')::uuid,"BillingLines"."taxId" ) as "mergedTaxId",  (elem.index -1 )::real as "taxIndex",
                            COALESCE(nullif(COALESCE(elem.value->>'taxAmount', elem.value->>'taxTotal'),'')::real,"BillingLines"."taxTotal" ) as "mergedTaxAmount"
                        from "BillingLines" 
                        join "values" on true
                        inner join "Billings" on "Billings".id  =  "BillingLines"."billingId" 
                        inner join "Branches" on "Branches".id = "Billings"."branchId"
                        left join "BillOfEntryLines" on "BillOfEntryLines"."billingLineId" = "BillingLines".id
                        left  join  jsonb_array_elements(nullif("BillingLines"."taxes",'null') ) WITH ORDINALITY  elem (value, index)  on nullif("BillingLines"."taxType",'') is not null
                        inner join "TaxesData" on "TaxesData".id = "BillingLines"."taxId" or ("TaxesData".name ='Exempt Tax' and "BillingLines"."taxId" is null) or ("TaxesData".id = nullif(nullif(elem.value->>'taxId','null'),'')::uuid)
                        where "BillingLines"."createdAt" >= "values"."fromDate" and "BillingLines"."createdAt" <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                            and  "TaxesData".id = any("values"."taxes")
                            AND  ("BillOfEntryLines"."id" is null or  "BillOfEntryLines"."taxId" is null or  "BillOfEntryLines"."taxTotal" = 0 )
                            and "Billings"."status" <>'Draft' 
                        )

                        ,"LinesStackedTax" as (	
                        select "billingLinesData".id, "billingId" ,"mergedTaxId" as "taxId","billingLinesData"."supplierId",
                                "mergedTaxAmount" as "taxTotal", "taxIndex"
                        From "billingLinesData"
                        where "taxType" = 'stacked'
                        )
                        ,"billingStackedTotal" as (	
                        select "billingId",  sum ("amount" ) as "amount" 
                        from (
                            SELECT  "taxId", "billingId",
                            SUM("taxTotal" ) OVER ( PARTITION BY id order by "taxIndex" ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                            FROM "LinesStackedTax"
                        )t
                        join "values" on true
                        where  t."taxId" = any("values"."taxes")
                        group by "billingId"
                        )
                        ,"billingLinesTotalData" as ( 
                        select  'InputTax' AS "parentType",
                                'Billing' AS "type",
                                "billingLinesData"."billingNumber" AS "referenceNumber","billingLinesData"."supplierId",
                                "billingLinesData"."billingId" AS "referenceId",
                                Date("billingLinesData"."billingCreatedAt")  AS "Date",
                                ("taxableAmount") as "taxableAmount" ,
                                ( "TaxesData".name) as name,
                                ("billingLinesData"."mergedTaxAmount"::text::numeric) as vat,
                                (CASE WHEN  "billingLinesData"."taxId" is null OR "billingLinesData"."taxPercentage"  = 0 then COALESCE("billingLinesData"."subTotal",0)::text::numeric  END ) as "none_taxableAmount",
                                (COALESCE("billingLinesData"."taxableAmount",0)::text::numeric + COALESCE("billingLinesData"."mergedTaxAmount",0)::text::numeric     
                                ) as "totalAmount" 
                        from "billingLinesData"
                        left join "TaxesData" on "TaxesData".id = "billingLinesData"."mergedTaxId" 
                        )

                        ,"billingLinesTotal" as (
                        select  "parentType","type","referenceNumber","referenceId", "Date","billingLinesTotalData"."supplierId",
                                sum("taxableAmount")as "taxableAmount"  ,
                                array_agg(distinct COALESCE(name,'Exempt Tax'))  as  name,
                                sum(vat) as vat,
                                sum("none_taxableAmount") "none_taxableAmount",
                                sum("totalAmount" ) as "totalAmount" 
                        from "billingLinesTotalData"
                        group by "parentType","type","referenceNumber","referenceId", "Date","billingLinesTotalData"."supplierId"
                        )
                        ,"BillingTotal" as(		
                        select  "parentType","type","referenceNumber","referenceId", "Date","billingLinesTotal"."supplierId",
                                COALESCE("taxableAmount",0)  - COALESCE("billingStackedTotal"."amount",0)  as "taxableAmount",
                                name,
                                vat,
                                "none_taxableAmount",
                                COALESCE("totalAmount",0) - COALESCE("billingStackedTotal"."amount",0) as "totalAmount"  
                        from "billingLinesTotal"
                        left join "billingStackedTotal" on "billingStackedTotal"."billingId" = "billingLinesTotal"."referenceId"
                        )
                        ,"supplierCreditLinesData" as (
                        select "SupplierCreditLines".*,"SupplierCredits"."supplierId", "SupplierCredits"."supplierCreditNumber" , "SupplierCredits"."supplierCreditDate" as "supplierCreditCreatedAt" ,
                            COALESCE(nullif(nullif(elem.value->>'taxId', ''),'null')::uuid,"SupplierCreditLines"."taxId" ) as "mergedTaxId",  (elem.index -1 )::real as "taxIndex",
                            COALESCE(nullif(COALESCE(elem.value->>'taxAmount', elem.value->>'taxTotal'),'')::real,"SupplierCreditLines"."taxTotal" ) as "mergedTaxAmount"
                        from "SupplierCreditLines" 
                        join "values" on true
                        inner join "SupplierCredits" on "SupplierCredits".id  =  "SupplierCreditLines"."supplierCreditId" 
                        inner join "Branches" on "Branches".id = "SupplierCredits"."branchId"
                        left  join  jsonb_array_elements(nullif("SupplierCreditLines"."taxes",'null') ) WITH ORDINALITY  elem (value, index)  on nullif("SupplierCreditLines"."taxType",'') is not null
                        inner join "TaxesData" on "TaxesData".id = "SupplierCreditLines"."taxId" or ("TaxesData".name ='Exempt Tax' and "SupplierCreditLines"."taxId" is null) or ("TaxesData".id = nullif(nullif(elem.value->>'taxId','null'),'')::uuid)
                        where "SupplierCreditLines"."createdAt" >= "values"."fromDate" and "SupplierCreditLines"."createdAt" <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                            and  "TaxesData".id = any("values"."taxes")
                        )

                        ,"CNLinesStackedTax" as (	
                        select "supplierCreditLinesData".id, "supplierCreditId" ,"mergedTaxId" as "taxId",
                        "mergedTaxAmount" as "taxTotal", "taxIndex"
                        From "supplierCreditLinesData"
                        where "taxType" = 'stacked'
                        )
                        ,"supplierCreditStackedTotal" as (	
                        select "supplierCreditId",  sum ("amount" ) as "amount" 
                        from (
                            
                            SELECT  "taxId", "supplierCreditId",
                            SUM("taxTotal" ) OVER ( PARTITION BY id order by "taxIndex" ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                            FROM "CNLinesStackedTax"
                        )t
                        join "values" on true
                        where t."taxId" = any("values"."taxes")
                        group by "supplierCreditId"
                        )
                        ,"supplierCreditLinesTotalData" as ( 
                        select   'InputTax' AS "parentType",
                            'SupplierCredit' AS "type",
                            "supplierCreditLinesData"."supplierCreditNumber" AS "referenceNumber","supplierCreditLinesData"."supplierId",
                            "supplierCreditLinesData"."supplierCreditId" AS "referenceId",
                            Date("supplierCreditLinesData"."supplierCreditCreatedAt")  AS "Date",
                            ("taxableAmount") as "taxableAmount" ,
                            ( "TaxesData".name) as name,
                            ("supplierCreditLinesData"."mergedTaxAmount"::text::numeric) as vat,
                            (CASE WHEN  "supplierCreditLinesData"."taxId" is null OR "supplierCreditLinesData"."taxPercentage"  = 0 then COALESCE("supplierCreditLinesData"."subTotal",0)::text::numeric  END ) as "none_taxableAmount",
                            (COALESCE("supplierCreditLinesData"."taxableAmount",0)::text::numeric + COALESCE("supplierCreditLinesData"."mergedTaxAmount",0)::text::numeric 
                     
                            ) as "totalAmount" 
                        from "supplierCreditLinesData"
                        left join "TaxesData" on "TaxesData".id = "supplierCreditLinesData"."mergedTaxId" 


                        )
                        ,"supplierCreditLinesTotal" as (
                        select  "parentType","type","referenceNumber","referenceId", "Date", "supplierId",
                            sum("taxableAmount")as "taxableAmount"  ,
                            array_agg(distinct COALESCE(name,'Exempt Tax'))  as  name,
                            sum(vat) as vat,
                            sum("none_taxableAmount") "none_taxableAmount",
                            sum("totalAmount" ) as "totalAmount" 
                        from "supplierCreditLinesTotalData"
                        group by "parentType","type","referenceNumber","referenceId", "Date","supplierId"
                        )				
                        ,"SupplierCreditTotal" as(		
                        select  "parentType","type","referenceNumber","referenceId", "Date","supplierId",
                            (COALESCE("taxableAmount",0)  - COALESCE("supplierCreditStackedTotal"."amount",0)) *(-1) as "taxableAmount",
                            name, vat*(-1),
                            ("none_taxableAmount")*(-1),
                            (COALESCE("totalAmount",0) - COALESCE("supplierCreditStackedTotal"."amount",0))*(-1) as "totalAmount"  
                        from "supplierCreditLinesTotal"
                        left join "supplierCreditStackedTotal" on "supplierCreditStackedTotal"."supplierCreditId" = "supplierCreditLinesTotal"."referenceId"
                        )

                        select 
                        count(*) over(), 
                        sum("taxableAmount") over() as "taxableAmountTotal",
                        sum("vat") over() as "vatTotal",
                        sum("none_taxableAmount") over() as "none_taxableAmountTotal",
                        sum("totalAmount") over() as "amountTotal",
                        t.*,"Suppliers"."name" as "ContactName"
                        from(select * from "ExpenseTotal" union all select * from "BillingTotal" union select * from "SupplierCreditTotal" ) T
                        left join "Suppliers" on "Suppliers"."companyId" = $1 and "Suppliers".id = t."supplierId"
					   order by "parentType", "Date" asc, "referenceNumber"
                    `,
                values: [companyId, branches, from, to, taxes]
            }

            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`


            const records = await DB.excu.query(query.text + limitQuery, query.values);

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)

                total = { taxableAmount: t.taxableAmountTotal, vat: t.vatTotal, none_taxableAmount: t.none_taxableAmountTotal, totalAmount: t.amountTotal }
                resault = records.rows.map((e: any) => {
                    return {
                        parentType: e.parentType, type: e.type,
                        referenceNumber: e.referenceNumber, referenceId: e.referenceId,
                        ContactName: e.ContactName,
                        date: e.Date, taxableAmount: e.taxableAmount,
                        name: e.name, vat: e.vat, none_taxableAmount: e.none_taxableAmount, totalAmount: e.totalAmount
                    }
                })

            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Vat Audit Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches,

                }
                resault.forEach(elem => { elem.date = moment.utc(elem.date).utcOffset(+timeOffset).format('YYYY-MM-DD') })
                report.records = resault
                report.columns = [{ key: 'date', properties: { columnType: 'date' } },
                { key: 'type' },
                { key: 'referenceNumber' },
                { key: "ContactName", header: 'Contact Name' },
                { key: 'name' },
                { key: 'taxableAmount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'vat', header: 'Tax', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'none_taxableAmount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'totalAmount', properties: { hasTotal: true, columnType: 'currency' } },
                ]
                report.fileName = 'VatAuditReport'

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

    public static async billOfEntryDetailsVatReport(data: any, company: Company, brancheList: []) {
        try {


            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let branches = filter && filter.branches ? filter.branches : brancheList;
            let taxId = filter && filter.taxId ? filter.taxId : null
            // if (!taxId) { throw new ValidationException("taxId is required") }


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
                            $4::timestamp as "toDate"
                         
                         )
                        ,"TaxesData" as(
                        select "Taxes".*
                        from "Taxes" 
                        join "values" on TRUE
                        where "Taxes"."companyId" = "values"."companyId" 
                        )
                       

                        ,"BillOfEntryLinesData" as (
                        select "BillOfEntryLines".*, "BillOfEntries"."billingOfEnrtyNumber" , "BillOfEntries"."billingOfEntryDate" as "billingCreatedAt" ,
                            COALESCE(nullif(nullif(elem.value->>'taxId', ''),'null')::uuid,"BillOfEntryLines"."taxId" ) as "mergedTaxId",  (elem.index -1 )::real as "index",
                            COALESCE(nullif(COALESCE(elem.value->>'taxAmount', elem.value->>'taxTotal'),'')::real,"BillOfEntryLines"."taxTotal" ) as "mergedTaxAmount"
                        from "BillOfEntryLines" 
                        join "values" on true
                        inner join "BillOfEntries" on "BillOfEntries".id  =  "BillOfEntryLines"."billOfEntryId" 
                        inner join "Branches" on "Branches".id = "BillOfEntries"."branchId"
                        left  join  jsonb_array_elements(nullif("BillOfEntryLines"."taxes",'null') ) WITH ORDINALITY  elem (value, index)  on nullif("BillOfEntryLines"."taxType",'') is not null
                        inner join "TaxesData" on "TaxesData".id = "BillOfEntryLines"."taxId" or ("TaxesData".name ='Exempt Tax' and "BillOfEntryLines"."taxId" is null) or ("TaxesData".id = nullif(nullif(elem.value->>'taxId','null'),'')::uuid)
                        where "BillOfEntryLines"."createdAt" >= "values"."fromDate" and "BillOfEntryLines"."createdAt" <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and (  array_length("values"."branches",1) IS NULL or "Branches".id = any("values"."branches")) 
                            and "BillOfEntryLines"."taxId" is not null 
                            and "BillOfEntryLines"."taxTotal" <> 0 
                            and "BillOfEntries"."status" <>'Draft' 
                        )

                        ,"LinesStackedTax" as (	
                        select "BillOfEntryLinesData".id, "billOfEntryId" ,"mergedTaxId" as "taxId",
                                "mergedTaxAmount" as "taxTotal", "index"
                        From "BillOfEntryLinesData"
                        where "taxType" = 'stacked'
                        )
                        ,"BillOfEntriestackedTotal" as (	
                        select "billOfEntryId",  sum ("amount" ) as "amount" 
                        from (
                            SELECT  "taxId", "billOfEntryId",
                            SUM("taxTotal" ) OVER ( PARTITION BY id order by index ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)  AS"amount" 
                            FROM "LinesStackedTax"
                        )t
                        join "values" on true
                      
                        group by "billOfEntryId"
                        )
                        ,"BillOfEntryLinesTotalData" as ( 
                        select  'InputTax' AS "parentType",
                                'Bill Of Entry' AS "type",
                                "BillOfEntryLinesData"."billingOfEnrtyNumber" AS "referenceNumber",
                                "BillOfEntryLinesData"."billOfEntryId" AS "referenceId",
                                Date("BillOfEntryLinesData"."billingCreatedAt")  AS "Date",
                                ((COALESCE("BillOfEntryLinesData"."subTotal" ,0)::text::numeric + COALESCE("BillOfEntryLinesData"."customDuty",0))  - (COALESCE("BillOfEntryLinesData"."billDiscount",0) + COALESCE("BillOfEntryLinesData"."discountTotal",0) ) ) 
                                 as "taxableAmount" ,
                                ( "TaxesData".name) as name,
                                ("BillOfEntryLinesData"."mergedTaxAmount"::text::numeric) as vat,
                                (CASE WHEN  "BillOfEntryLinesData"."taxId" is null OR "BillOfEntryLinesData"."taxPercentage"  = 0 then COALESCE("BillOfEntryLinesData"."subTotal",0)::text::numeric  END ) as "none_taxableAmount",
                                ((COALESCE("BillOfEntryLinesData"."subTotal",0)::text::numeric + COALESCE("BillOfEntryLinesData"."customDuty",0))  - (COALESCE("BillOfEntryLinesData"."billDiscount",0) + COALESCE("BillOfEntryLinesData"."discountTotal",0) ) + COALESCE("BillOfEntryLinesData"."mergedTaxAmount",0)::text::numeric 
                                    - (case when "BillOfEntryLinesData"."isInclusiveTax"  then COALESCE("BillOfEntryLinesData"."taxTotal",0)::text::numeric  else 0 end)  
                                    
                                ) as "totalAmount" 
                        from "BillOfEntryLinesData"
                        left join "TaxesData" on "TaxesData".id = "BillOfEntryLinesData"."mergedTaxId" 
                        )

                        ,"BillOfEntryLinesTotal" as (
                        select  "parentType","type","referenceNumber","referenceId", "Date",
                                sum("taxableAmount")as "taxableAmount"  ,
                                array_agg(distinct name)  as  name,
                                sum(vat) as vat,
                                sum("none_taxableAmount") "none_taxableAmount",
                                sum("totalAmount" ) as "totalAmount" 
                        from "BillOfEntryLinesTotalData"
                        group by "parentType","type","referenceNumber","referenceId", "Date"
                        )
                        ,"BillingTotal" as(		
                        select  "parentType","type","referenceNumber","referenceId", "Date",
                                COALESCE("taxableAmount",0)  - COALESCE("BillOfEntriestackedTotal"."amount",0)  as "taxableAmount",
                                name,
                                vat,
                                "none_taxableAmount",
                                COALESCE("totalAmount",0) - COALESCE("BillOfEntriestackedTotal"."amount",0) as "totalAmount"  
                        from "BillOfEntryLinesTotal"
                        left join "BillOfEntriestackedTotal" on "BillOfEntriestackedTotal"."billOfEntryId" = "BillOfEntryLinesTotal"."referenceId"
                        )
                       
                        select 
                        count(*) over(), 
                        sum("taxableAmount") over() as "taxableAmountTotal",
                        sum("vat") over() as "vatTotal",
                        sum("none_taxableAmount") over() as "none_taxableAmountTotal",
                        sum("totalAmount") over() as "amountTotal",
                        *
                        from(select * from "BillingTotal" ) T
                        order by "parentType", "Date" asc, "referenceNumber"
                    `,
                values: [companyId, branches, from, to]
            }

            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`


            const records = await DB.excu.query(query.text + limitQuery, query.values);

            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)

                total = { taxableAmount: t.taxableAmountTotal, vat: t.vatTotal, none_taxableAmount: t.none_taxableAmountTotal, totalAmount: t.amountTotal }
                resault = records.rows.map((e: any) => {
                    return {
                        parentType: e.parentType, type: e.type,
                        referenceNumber: e.referenceNumber, referenceId: e.referenceId,
                        date: e.Date, taxableAmount: e.taxableAmount,
                        name: e.name, vat: e.vat, none_taxableAmount: e.none_taxableAmount, totalAmount: e.totalAmount
                    }
                })

            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Vat Audit Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches,

                }
                resault.forEach(elem => { elem.date = moment.utc(elem.date).utcOffset(+timeOffset).format('YYYY-MM-DD') })
                report.records = resault
                report.columns = [{ key: 'date', properties: { columnType: 'date' } },
                { key: 'type' },
                { key: 'referenceNumber' },
                { key: 'name' },
                { key: 'taxableAmount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'vat', header: 'Tax', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'none_taxableAmount', properties: { hasTotal: true, columnType: 'currency' } },
                { key: 'totalAmount', properties: { hasTotal: true, columnType: 'currency' } },
                ]
                report.fileName = 'VatAuditReport'

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
    public static async vatReportByProductId(data: any, company: Company, brancheList: []) {
        try {

            const companyId = company.id;
            const afterDecimal = company.afterDecimal;

            let filter = data.filter;
            let productId = filter && filter.productId ? filter.productId : null
            let branches = filter && filter.branches ? filter.branches : brancheList;

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
            let productName = ''

            const query: { text: string, values: any } = {
                text: `with "values" as (
                        select $1::uuid as "companyId",
                            $2::uuid[] as "branches",
                            $3::timestamp as "fromDate",
                            $4::timestamp as "toDate",
                            $5::uuid as "productId"
                        )
                        , "salesAmount" as (
                        select 	 "taxId",
                                sum(case when "InvoiceLines"."isInclusiveTax" = true then( "InvoiceLines"."subTotal"::text::numeric -  COALESCE("InvoiceLines"."taxTotal"::text::numeric,0) ) - COALESCE("InvoiceLines"."discountTotal"::text::numeric,0) 
                                                                                    else "InvoiceLines"."subTotal"::text::numeric - COALESCE("InvoiceLines"."discountTotal"::text::numeric,0) end ) as total,
                                sum( "InvoiceLines"."taxTotal"::text::numeric ) as "taxTotal"  
                        from "InvoiceLines" 
                        inner join "Invoices" on "Invoices".id =  "InvoiceLines"."invoiceId" AND "Invoices"."status" <>'Draft'
                        inner join "Branches" on "Branches".id = "Invoices"."branchId"
                        join "values" on true
                        where  "values"."productId" = "InvoiceLines"."productId"
                                and "InvoiceLines"."createdAt" >= "values"."fromDate" and "InvoiceLines"."createdAt" <"values"."toDate"
                                and "Branches"."companyId" = "values"."companyId"
                                and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                        group by "taxId"
                        )
                        ,"salesAdjusments" as (
                        select  "taxId",
                                sum(case when "CreditNoteLines"."isInclusiveTax" = true then( "CreditNoteLines"."subTotal"::text::numeric -  COALESCE("CreditNoteLines"."taxTotal"::numeric,0) )- COALESCE("CreditNoteLines"."discountTotal"::text::numeric,0)
                                                                                        else "CreditNoteLines"."subTotal"::text::numeric - COALESCE("CreditNoteLines"."discountTotal"::text::numeric,0) end )*(-1)  as total, 
                                sum( "CreditNoteLines"."taxTotal"::text::numeric )*(-1) as "taxTotal"  
                        from "CreditNoteLines" 
                        inner join "CreditNotes" on "CreditNotes".id =  "CreditNoteLines"."creditNoteId"
                        inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
                        join "values" on true
                        where "values"."productId" = "CreditNoteLines"."productId"
                            and "CreditNoteLines"."createdAt" >= "values"."fromDate" and "CreditNoteLines"."createdAt" <"values"."toDate"
                            and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                            and "Branches"."companyId" ="values"."companyId"
                        group by "taxId"	
                        )
                        ,"salesTotal" as (
                        SELECT  "taxId", sum("total"::text::numeric) as "amount", sum ("taxTotal"::text::numeric) as "taxTotal" 
                        FROM (select * from "salesAmount" union select * from "salesAdjusments")t
                        Group By "taxId"
                        )
                        ,"purchaseAmount" as (
                        select "taxId",
                            sum(case when "BillingLines"."isInclusiveTax" = true then( "BillingLines"."subTotal"::text::numeric -  COALESCE("BillingLines"."taxTotal"::text::numeric,0) ) 
                                                                                else "BillingLines"."subTotal"::text::numeric end ) as total,
                            sum( "BillingLines"."taxTotal"::text::numeric ) as "taxTotal"  
                        from "BillingLines" 
                        inner join "Billings" on "Billings".id =  "BillingLines"."billingId" and "Billings"."status" <>'Draft'
                        inner join "Branches" on "Branches".id = "Billings"."branchId"
                        join "values" on true
                        where "values"."productId" = "BillingLines"."productId"
                            and "Billings"."billingDate"::timestamp >= "values"."fromDate" and "Billings"."billingDate"::timestamp <"values"."toDate"
                            and "Branches"."companyId" = "values"."companyId"
                            and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                        group by  "taxId"
                        )
                        ,"purchaseAdjusments" as (
                        select   "taxId",
                                sum(case when "SupplierCreditLines"."isInclusiveTax" = true then( "SupplierCreditLines"."subTotal"::text::numeric -   COALESCE("SupplierCreditLines"."taxTotal"::numeric,0) ) 
                                                                                            else "SupplierCreditLines"."subTotal"::text::numeric end )*(-1)  as total, 
                                sum( "SupplierCreditLines"."taxTotal"::text::numeric )*(-1) as "taxTotal"  
                        from "SupplierCreditLines" 
                        inner join "SupplierCredits" on "SupplierCredits".id =  "SupplierCreditLines"."supplierCreditId"
                        inner join"Branches" on "Branches".id = "SupplierCredits"."branchId"
                        join "values" on true
                        where "values"."productId" = "SupplierCreditLines"."productId"
                            and "SupplierCredits"."supplierCreditDate"::timestamp >= "values"."fromDate" and "SupplierCredits"."supplierCreditDate"::timestamp <"values"."toDate"
                            and ( array_length("values"."branches",1) IS NULL OR "Branches".id = any( "values"."branches"))
                            and "Branches"."companyId" ="values"."companyId"
                        group by  "taxId"
                            
                        )
                        ,"purchaseTotal" as (
                        SELECT  "taxId", sum("total"::text::numeric) as "amount", sum ("taxTotal"::text::numeric) as "taxTotal" 
                        FROM (select * from "purchaseAmount" union select * from "purchaseAdjusments")t
                        group by "taxId"
                        )
                        ,"records" as (
                        SELECT 
                            COALESCE("salesTotal"."taxId", "purchaseTotal"."taxId") AS "taxId",
                            COALESCE("salesTotal".amount,0) As "salesAmountAfterDiscount", 
                            COALESCE("salesTotal"."taxTotal",0) AS "salesTax" , 
                            COALESCE("purchaseTotal".amount,0)  As "purchaseAmount", 
                            COALESCE("purchaseTotal"."taxTotal",0) AS "purchaseTax"
                        from "salesTotal"
                        full outer join "purchaseTotal" on "purchaseTotal"."taxId" = "salesTotal"."taxId" 
                        order  by  "salesTotal"."taxId", "purchaseTotal"."taxId"
                        )
                        select "Products".name as "productName", 
                         COALESCE("Taxes".name,'Exempt Tax') as "taxName", 
                        "records".*, 
                        count(*) over(),
                        sum("salesAmountAfterDiscount"::text::numeric) over() as "salesAmountAfterDiscountTotal",
                        sum("salesTax"::text::numeric) over() as "salesTaxTotal",
                        sum("purchaseAmount"::text::numeric) over() as "purchaseAmountTotal",
                        sum("purchaseTax"::text::numeric) over() as "purchaseTaxTotal"
                        from "records"
                        join "values" on true
                        left join "Products" on "Products".id = "values"."productId"
                        left join "Taxes" on "Taxes".id = "records"."taxId"	
                        order by "Products"."id","records"."taxId"

                    `,
                values: [companyId, branches, from, to, productId]
            }
            let limitQuery = filter.export && filter.export === true ? '' : `limit ${limit}
                                                                            offset ${offset}`


            const records = await DB.excu.query(query.text + limitQuery, query.values);


            if (records.rows && records.rows.length > 0) {
                let t = (<any>records.rows[0])
                count = Number(t.count)
                productName = t.productName

                total = { salesAmountAfterDiscount: t.salesAmountAfterDiscountTotal, salesTax: t.salesTaxTotal, purchaseAmount: t.purchaseAmountTotal, purchaseTax: t.purchaseTaxTotal }
                resault = records.rows.map((e: any) => {
                    return {
                        productName: e.productName,
                        taxName: e.taxName, taxId: e.taxId,
                        salesAmountAfterDiscount: e.salesAmountAfterDiscount, salesTax: e.salesTax,
                        purchaseAmount: e.purchaseAmount, purchaseTax: e.purchaseTax
                    }
                })

            }

            if (filter.export) {
                let report = new ReportData()
                report.filter = {
                    title: "Product Wise Vat Report",
                    fromDate: filter && filter.fromDate ? filter.fromDate : null,
                    toDate: filter && filter.toDate ? filter.toDate : new Date(),
                    branches: branches,
                    productName: productName
                }
                report.records = records.rows
                report.columns = [
                    { key: 'taxName' },
                    { key: 'salesAmountAfterDiscount', properties: { hasTotal: true, columnType: 'currency' } },
                    { key: 'salesTax', properties: { hasTotal: true, columnType: 'currency' } },
                    { key: 'purchaseAmount', properties: { hasTotal: true, columnType: 'currency' } },
                    { key: 'purchaseTax', properties: { hasTotal: true, columnType: 'currency' } }
                ]
                report.fileName = 'ProductWiseVatReport'

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


    public static async exportTaxReport(data: any, company: Company, brancheList: []) {
        try {
            /** Default Vat Report Taxes */
            let tax = new Tax();
            let salesDefaultTaxes = tax.salesReportTaxes()
            let purchaseDefaultTaxes = tax.purchaseReportTaxes()
            let netVATDue = tax.netVATDue()
            let filter = data.filter
            filter.branches = filter && filter.branches && filter.branches.length > 0 ? filter.branches : brancheList
            /**Sales Tax Records */
            let salesVatData = await this.getSalesVatReport(data, company, brancheList)
            let salesRows: any = salesVatData && salesVatData.data ? salesVatData.data : []

            let salesUpdatedTaxArray = []
            let salesMergedArray = []

            /** Exempt Tax */
            let exemptTax = salesRows.find((f: any) => f.taxName == 'Exempt Tax')
            if (exemptTax) {
                exemptTax.boxNo = `6`
                exemptTax.Description = exemptTax.taxName
                salesRows.splice(salesRows.indexOf(exemptTax), 1);
                salesMergedArray.push(exemptTax)
            }

            /** Zero Tax */
            let zeroTax = salesRows.find((f: any) => f.taxName == 'Zero Tax')

            if (zeroTax) {
                zeroTax.boxNo = `4`
                zeroTax.description = zeroTax.taxName
                salesRows.splice(salesRows.indexOf(zeroTax), 1);
                salesMergedArray.push(zeroTax)
            }
            /**Assign other tax index to a(n) */
            if (salesRows && salesRows.length > 0) {
                salesUpdatedTaxArray = salesRows.map((item: any, index: number) => {
                    // Calculate the suffix based on the index
                    const suffix = String.fromCharCode(97 + index); // 'a' is 97 in ASCII
                    item.boxNo = `1(${suffix})`;
                    item.description = item.taxName
                    return item;
                });
            }
            /**merge sales arrays */
            salesMergedArray = [...salesMergedArray, ...salesUpdatedTaxArray, ...salesDefaultTaxes];

            /**sort arrays by index */
            const salesRecords = this.sortArray(salesMergedArray)


            /**Purchase Tax Records */
            let purchaseVatReport = await this.getPurchaseVatReport(data, company, brancheList)
            let purchaseRows = purchaseVatReport && purchaseVatReport.data ? purchaseVatReport.data : []


            let purchaseMergedArray: any[] = []
            let purchaseExemptTax = purchaseRows.find((f: any) => f.taxName == 'Exempt Tax')
            let purchaseZeroTax = purchaseRows.find((f: any) => f.taxName == 'Zero Tax')
            let customDuty = purchaseRows.find((f: any) => f.index == 9)

            if (customDuty) {
                purchaseRows.splice(purchaseRows.indexOf(customDuty), 1);
            }
            if (purchaseExemptTax) {
                purchaseRows.splice(purchaseRows.indexOf(purchaseExemptTax), 1);
            }
            if (purchaseZeroTax) {
                purchaseRows.splice(purchaseRows.indexOf(purchaseZeroTax), 1);
            }

            if (purchaseRows && purchaseRows.length > 0) {

                for (let index = 0; index < purchaseRows.length; index++) {
                    let element = { ...purchaseRows[index] }; // when assigning the purchaseRows[index] dirctly its assigned by reference any change to the element refelct on purchaseRows[index]
                    let element2 = { ...purchaseRows[index] };

                    let suffix = String.fromCharCode(97 + index);

                    /**Assign other tax index to 8(a.....Z) */
                    element.boxNo = `8(${suffix})`;
                    element.Description = element.taxName
                    purchaseMergedArray.push(element)

                    /**Assign Imports tax index to 11(a.....Z) */
                    element2.boxNo = `11(${suffix})`;
                    element2.Description = `Imports subject to Vat accounted for through reverse charge mechanism at ${element2.taxName}`
                    element2.Total = 0;
                    element2.Adjusments = 0;
                    element2.vatTotal = 0;
                    purchaseMergedArray.push(element2)
                }

            }

            let customDutyTaxPush = {
                boxNo: '9',
                Description: "Imports subject to Vat paid at customs",
                Total: customDuty.Total ?? 0,
                Adjusments: customDuty.Adjusments ?? 0,
                vatTotal: customDuty.vatTotal ?? 0
            }
            purchaseMergedArray.push(customDutyTaxPush)
            purchaseDefaultTaxes.forEach(f => {
                purchaseMergedArray.push(f)
            })


            /**PUSH non-registered ,zero-rated/exempt purchase  taxes  */
            purchaseMergedArray.push(
                {
                    boxNo: '13',
                    Description: "Purchase subject from non-registered suppliers, zero-rated/exempt purchase",
                    Total: (purchaseExemptTax ? purchaseExemptTax.Total : 0) + (purchaseZeroTax ? purchaseZeroTax.Total : 0),
                    Adjusments: (purchaseExemptTax ? purchaseExemptTax.Adjusments : 0) + (purchaseZeroTax ? purchaseZeroTax.Adjusments : 0),
                    vatTotal: 0,
                }
            )
            const purchaseRecords = this.sortArray(purchaseMergedArray)


            let summaryRows: any[] = [];

            netVATDue.forEach(f => {

                if (f.boxNo == '15') {
                    const SVT = salesRecords.reduce((a: number, b: any) => { return a + ((Number.isNaN(b.vatTotal)) ? 0 : Number(b.vatTotal)) }, 0) ?? 0
                    const PVT = purchaseRecords.reduce((a: number, b: any) => { return a + ((Number.isNaN(b.vatTotal)) ? 0 : Number(b.vatTotal)) }, 0) ?? 0
                    f.vatTotal = SVT - PVT
                }
                summaryRows.push(f)
            })


            let salesReport: any = {
                columns: {},
                records: []
            };
            let purchaseReport: any = {
                columns: {},
                records: []
            };
            let netVatReport: any = {
                columns: {},
                records: []
            };
            if (salesRecords && salesRecords.length > 0) {



                salesReport.columns = {
                    "#": {},
                    'Description': {},
                    'Amount': { hasTotal: true, columnType: 'currency' },
                    'Adjusment': { hasTotal: true, columnType: 'currency' },
                    'Vat Amount': { hasTotal: true, columnType: 'currency' }

                }


                salesReport.records = { records: salesRecords.map((e: any) => { return { '#': e.boxNo, Description: e.Description ?? e.taxName, Amount: Number(e.Total), Adjusment: e.Adjusments, 'Vat Amount': e.vatTotal } }), columns: salesReport.columns }

            }


            if (purchaseRecords && purchaseRecords.length > 0) {


                purchaseReport.columns = {
                    "#": {},
                    'Description': {},
                    'Amount': { hasTotal: true, columnType: 'currency' },
                    'Adjusment': { hasTotal: true, columnType: 'currency' },
                    'Vat Amount': { hasTotal: true, columnType: 'currency' }

                }

                purchaseReport.records = { records: purchaseRecords.map((e: any) => { return { '#': e.boxNo, Description: e.Description ?? e.taxName, Amount: Number(e.Total), Adjusment: e.Adjusments, 'Vat Amount': e.vatTotal } }), columns: purchaseReport.columns }

            }


            if (summaryRows.length > 0) {



                netVatReport.columns = {
                    "#": {},
                    'Description': {},
                    'Vat Amount': { hasTotal: true, columnType: 'currency' }

                }

                netVatReport.records = { records: summaryRows.map((e: any) => { return { '#': e.boxNo, Description: e.Description ?? e.taxName, "Vat Amount": e.vatTotal } }), columns: netVatReport.columns }

            }


            filter.title = 'Vat Report'
            let reportData: any = {
                filter: filter,
                fileName: 'Vat Report',
                records: {
                    'VAT On Sales': salesReport.records,
                    'VAT On Purchases': purchaseReport.records,
                    'Net VAT Due': netVatReport.records
                }

            }





            const resData = await XLSXGenerator.exportVatReport(reportData, company);
            return new ResponseData(true, "", reportData)


        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }


    public static sortArray(taxArray: any[]) {
        const sortedTaxArray = taxArray.sort((a, b) => {
            const aValue = a.boxNo;
            const bValue = b.boxNo;
            // Extract the numeric part and the letter part
            const aMatch = aValue.match(/(\d+)(?:\((\w)\))?/);
            const bMatch = bValue.match(/(\d+)(?:\((\w)\))?/);

            const aNum = parseInt(aMatch[1], 10); // Numeric part
            const bNum = parseInt(bMatch[1], 10); // Numeric part

            // First, compare the numeric parts
            if (aNum !== bNum) {
                return aNum - bNum; // Sort by numeric part
            }

            // If numeric parts are equal, compare the letter parts (if they exist)
            const aLetter = aMatch[2] || ''; // Get letter or empty string
            const bLetter = bMatch[2] || ''; // Get letter or empty string

            return aLetter.localeCompare(bLetter); // Sort by letter part
        });

        return sortedTaxArray
    }











}