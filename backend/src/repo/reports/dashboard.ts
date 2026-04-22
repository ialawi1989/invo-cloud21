import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Company } from "@src/models/admin/company";
import { TimeHelper } from "@src/utilts/timeHelper";
import moment from "moment";

export class DashboardRepo {

    public static async getTotalGuests(data: any, company: Company) {
        try {
            const companyId = company.id;
            let from = data.interval.from;
            from = await TimeHelper.resetHours(from)
            let to = moment(data.interval.to).add(1, 'day').format("YYYY-MM-DD 00:00:00");

            let filterId = data.branchId != "" && data.branchId != null ? data.branchId : companyId;
            let filter = ` WHERE "Branches"."companyId"=$1 `
            if (data.branchId != null && data.branchId != "") {
                filter = ` WHERE "Branches".id=$1 `
            }

            filter += `AND "Invoices"."status" <>'Draft' AND "Invoices"."invoiceDate">=$2 AND "Invoices"."invoiceDate"<=$3 `
            let query = `select SUM( case when guests = 0 or guests is null then 1 else guests end  ) AS "numberOfguests" from "Invoices"
                         Inner JOIN "Branches" ON "Branches".id = "Invoices"."branchId" `
            query += filter;
            let values = [filterId, from, to];

            let reports = await DB.excu.query(query, values)
            return new ResponseData(true, "", reports.rows[0])
        } catch (error: any) {
            throw new Error(error);
        }
    }
   //TODO: USE STATUS INSTEAD 
    public static async getTotalOpenInvoices(data: any, company: Company,branchList:[]) {
        try {
            const companyId = company.id;
            let status = ['Open','Partially Paid']

            let branches = data.branchId != null && data.branchId!=""? [data.branchId] :branchList;
            let query = {
                text:`SELECT count(*) as "totalInvoices" FROM "Invoices"
                      inner join "Branches" on "Branches".id = "Invoices"."branchId" 
                  
                    where "Invoices"."companyId" =$2
                    and ($3::uuid[] is null or "Invoices"."branchId" = any($3)) 
                    and status = any($1) 
                    `,
                values:[status,company.id,branches]
            }
            // let filter = ` WHERE "Branches"."companyId"=$1 `
            // if (data.branchId != null && data.branchId != "") {
            //     filter = ` WHERE "Branches".id=$1 `
            // }

            // let query = `with "invoiceList" as (
            //                                 select "Invoices".id,
            //                                     "Invoices".total from "Invoices" 
            //                                 inner join "Branches" on "Branches".id = "Invoices"."branchId" `
            // filter += `  AND "Invoices".status <> 'Draft' and (("Invoices"."onlineData" is not null and "Invoices"."onlineData"->>'onlineStatus' <>'Rejected')   or"Invoices"."onlineData" is null ) `

            // let additionalQuery = `),  lines as (
            //                             select "invoiceList".id, sum("InvoiceLines".qty::text::numeric) as total from "invoiceList"
            //                                 inner join "InvoiceLines" on "InvoiceLines"."invoiceId" = "invoiceList".id
            //                                 group by  "invoiceList".id
            //                             ), payments as (
            //                             select "invoiceList".id , 
            //                                     sum("InvoicePaymentLines".amount::text::numeric)as total
            //                                 from "InvoicePaymentLines" 
            //                             left join "invoiceList" on"InvoicePaymentLines"."invoiceId" = "invoiceList".id 
            //                                 group by  "invoiceList".id
            //                             ), creditNotes as (
            //                             select "invoiceList".id  ,
            //                                     sum("CreditNotes".total::text::numeric)as total
            //                                 from "CreditNotes" 
            //                             left join "invoiceList" on"CreditNotes"."invoiceId" = "invoiceList".id 
            //                                 group by  "invoiceList".id
            //                             ), appliedCredit as (
            //                             select "invoiceList".id  ,
            //                                     sum("AppliedCredits".amount::text::numeric) as total
            //                                 from "AppliedCredits" 
            //                             left join "invoiceList" on"AppliedCredits"."invoiceId" = "invoiceList".id 
            //                                 group by  "invoiceList".id
            //                             )
            //                             select count("invoiceList".id) as "totalInvoices" from "invoiceList"
            //                             inner join lines on lines.id = "invoiceList".id
            //                             left join payments on payments.id= "invoiceList".id
            //                             left join appliedCredit on appliedCredit.id= "invoiceList".id
            //                             left join creditNotes on creditNotes.id= "invoiceList".id
            //                             where COALESCE(lines.total::text::numeric,0)>0
            //                             and( (COALESCE("invoiceList".total::text::numeric,0) - COALESCE(creditNotes.total::text::numeric,0)) -(COALESCE(payments.total::text::numeric,0) + COALESCE(appliedCredit.total::text::numeric,0))) >0`

            // query+=filter+additionalQuery
            // let values = [filterId]

            let invoices = await DB.excu.query(query.text,query.values);
            return new ResponseData(true, "", invoices.rows[0])
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    public static async getTotalOnlineInvoicesSummary(data: any, company: Company) {
        try {
            let branchId = data.branchId;
            let filterId = branchId != '' && branchId != null ? data.branchId : company.id
            let filter = branchId != '' && branchId != null ? ` AND "Branches".id = $1 ` : ` AND "Branches"."companyId" = $1 `

            let query = `select "Invoices"."onlineData"->>'onlineStatus',
                                    count ( "Invoices".id) as "numberOfInvoices"
                            from "Invoices" 
                            INNER JOIN "Branches" On "Branches".id = "Invoices"."branchId"
                            where "Invoices".source = 'Online' and  "Invoices"."onlineData"->>'onlineStatus' <> 'Placed' and  "Invoices"."onlineData"->>'onlineStatus' <> 'Placed'
                            `


            let groupBy = ` group by "Invoices"."onlineData"->>'onlineStatus' `

            query += filter + groupBy;

            let values = [filterId]

            let invoices = await DB.excu.query(query, values);
            return new ResponseData(true, "", invoices.rows)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    

    public static async numberOfOpenCashiers(data:any,companyId:string,branchList:[])
    {
        try {
            const branches = data.branchId? [data.branchId]:branchList
            const query={
                text:`select count(*) from "Cashiers" 
                inner join "Branches" on "Branches".id =  "Cashiers"."branchId"
                where "Cashiers"."cashierOut" is null 
                and "Branches"."companyId"=$1
                and ($2::uuid[] is null or "Branches".id =any($2))
                `,
                values:[companyId,branches]
            }

            const cashiers = await DB.excu.query(query.text,query.values);
            let number = cashiers.rows && cashiers.rows.length>0 ? (<any>cashiers.rows[0]).count:0
            return new ResponseData(true,"",{totalCashiers:number})
        } catch (error:any) {
            throw new Error(error)
        }
    }
}