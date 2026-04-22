import { ValidationException } from "@src/utilts/Exception";
import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { Company } from "@src/models/admin/company"

import moment from 'moment'
import { DailySalesReport } from "@src/models/reports/daliySalesReport";
import { TenderDetails } from "@src/models/reports/TenderDetails";
import { CategoryDetails } from "@src/models/reports/CategoryDetails";
import { ServiceDetails } from "@src/models/reports/serviceDetails";
import { PaymentBreakdown } from "@src/models/reports/PaymentBreakdown";
import { SalesDetails } from "@src/models/reports/salesDetails";
import { BranchesRepo } from "../admin/branches.repo";
import { TenderBreakdown } from "@src/models/reports/TenderBreakdown";
import _ from "lodash";

export class dailySalesReport {




  //new Reports
  //new Reports
  public static async getdailySalesReport(data: any, company: Company, brancheList: []) {

    try {

      const companyId = company.id;
      const afterDecimal = company.afterDecimal;
      const timeOffset = company.timeOffset

      let filter = data.filter;
      let branchId = filter && filter.branchId ? filter.branchId : null;
     
      let sources = filter && filter.sources ? filter.sources : null

      let date = filter && filter.date ? moment(new Date(filter.date)) : moment();
      

      if (branchId == null) { 
        throw new ValidationException("branchId is required") 
      }

      const currentDate = timeOffset? moment.utc().utcOffset( + timeOffset ) : moment()
      let closingTime = (await BranchesRepo.getBranchClosingTime(null, branchId)).data.closingTime ?? "05:00:00"
      let fromHour = Number(closingTime.split(":")[0])
      let fromMin = Number(closingTime.split(":")[1])
      let fromSec = Number(closingTime.split(":")[3])

      if (currentDate.hour() > 0 && currentDate.hour() < fromHour) {
        date = date.clone().subtract(1, 'day')
      }
      //set opening hour
      date.set('hour', fromHour).set('minute', fromMin).set('minute', fromSec)

      let from:any = date.clone().toDate()
      let to:any = (date.clone().add(1, 'day')).clone().toDate()

      from = timeOffset ?  moment.utc(from).utcOffset(- timeOffset ).format('YYYY-MM-DD HH:mm:ss') :from ;
      to  = timeOffset ?   moment.utc(to).utcOffset(- timeOffset ).format('YYYY-MM-DD HH:mm:ss'):to ;

      let dailySalesReport = new DailySalesReport();
      dailySalesReport.from  = from
      dailySalesReport.to  = to
   
     

      let query: { text: string, values: any } = {
        text: `with "values" as (
                        select	$1::uuid as "companyId",
                                $2::uuid as "branchId",
                                $3::timestamp  as "fromDate",
                                $4::timestamp as "toDate",
                        'Accepted'::text as "status",
                        $5::text[] as "sources"
                        )
                `,
        values: [companyId, branchId, from, to, sources]
      }

      

      //##################### total Sales #####################
      let text = `SELECT
                                sum("InvoiceLines"."subTotal") - sum(CASE WHEN "InvoiceLines"."isInclusiveTax" = true THEN  "InvoiceLines"."taxTotal" ELSE 0.0 END) as "totalSales",
                                sum("InvoiceLines"."taxTotal")  as "taxTotal",
                                sum("InvoiceLines"."discountTotal") as "itemDiscount",
                                sum("InvoiceLines"."total" )   as "netSales"
                        FROM "InvoiceLines" 
                        JOIN "values" ON TRUE
                        JOIN "Invoices" ON "Invoices".id = "InvoiceLines"."invoiceId"
  
                        WHERE "InvoiceLines"."companyId" = "values"."companyId"
                        and "InvoiceLines"."branchId" = "values"."branchId" 
                            and "InvoiceLines"."createdAt" >= "values"."fromDate" and "InvoiceLines"."createdAt" < "values"."toDate" 
                            and "Invoices"."branchId" = "values"."branchId"
                            and "Invoices"."status" <>'Draft'  
                            and ("Invoices"."onlineData"->>'onlineStatus' ='Accepted' or "Invoices"."onlineData" is null or "Invoices"."onlineData"->>'onlineStatus' ='')
			                      and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
                          `
     
      let s = new Date()
     let records = await DB.excu.query(query.text + text, query.values)
     let e = new Date()
     console.log("total Sales:   ", e.getTime() - s.getTime())
   
      let temp: Array<{ [key: string]: any }> = records.rows && records.rows.length > 0 ? records.rows : []
      if (temp.length > 0) {
        if (temp[0]['totalSales'] != null) {
          dailySalesReport.sales.sales = temp[0]['totalSales'];
        }

        if (temp[0]['itemDiscount'] != null) {
          dailySalesReport.discount.sales = temp[0]['itemDiscount'];
        }

        if (temp[0]['netSales'] != null) {
          dailySalesReport.total.sales = temp[0]['netSales'];
        }

        if (temp[0]['taxTotal'] != null) {
          dailySalesReport.tax.sales = temp[0]['taxTotal'];

        }
      }

      

      


      //###TotalOrders + DeliveryCharge + DiscountTotal + TotalGuests + notRecievedPayment###
      text = `SELECT count("Invoices".id) as "totalOrders",
                            sum("deliveryCharge") as "deliveryCharge", 
                            sum("discountTotal") as "discountTotal",
                            sum(COALESCE("guests",1)) as "totalGuests",
                             Sum("Invoices".total - COALESCE((Select Sum(amount) from "InvoicePaymentLines" where "invoiceId" = "Invoices".id),0)- COALESCE((Select Sum(amount) from "AppliedCredits" where "invoiceId" = "Invoices".id),0))  as "notRecievedPayment",
                            SUM("roundingTotal") as "roundingTotal",
                            sum( case when "Invoices"."isInclusiveTax" then  "chargeTotal" - COALESCE(("chargesTaxDetails"->>'taxAmount')::real,0) else  "chargeTotal" end) as "surchargeTotal",
                            sum (("chargesTaxDetails"->>'taxAmount')::text::real)  as "surchargeTax"
                    from "Invoices" 
                    JOIN "values" ON TRUE 
                    WHERE   "Invoices"."branchId" = "values"."branchId"
                          and "Invoices"."createdAt" >= "values"."fromDate" and "Invoices"."createdAt" < "values"."toDate" 
                          and "Invoices"."status" <>'Draft' 
                          and ("Invoices"."onlineData"->>'onlineStatus' ='Accepted' or "Invoices"."onlineData" is null or "Invoices"."onlineData"->>'onlineStatus' ='')
			                    and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
                    `
      s = new Date()
      records = await DB.excu.query(query.text + text, query.values)
      e = new Date()
      console.log("TotalOrders + DeliveryCharge + DiscountTotal + TotalGuests + notRecievedPayment:  ", e.getTime() - s.getTime())

      temp = records.rows && records.rows.length > 0 ? records.rows : []
      if (temp.length > 0) { dailySalesReport.totalOrders = temp[0]['totalOrders']; }
      if (temp[0]['deliveryCharge'] != null) { dailySalesReport.deliveryCharge.sales = temp[0]['deliveryCharge']; }
      if (temp[0]['discountTotal'] != null) { dailySalesReport.discountTotal = temp[0]['discountTotal']; }
      if (temp[0]['totalGuests'] != null) { dailySalesReport.totalGuests = temp[0]['totalGuests']; }
      if (temp[0]['notRecievedPayment'] != null) { dailySalesReport.notRecievedPayment = temp[0]['notRecievedPayment']; }
      if (temp[0]['roundingTotal'] != null) { dailySalesReport.rounding .sales= temp[0]['roundingTotal']; }
      if (temp[0]['surchargeTotal'] != null) { dailySalesReport.surcharge.sales = temp[0]['surchargeTotal']; }
      if (temp[0]['surchargeTax'] != null) { dailySalesReport.surchargeTax.sales = temp[0]['surchargeTax']; }

      
      //##################### TotalReturn #####################
      text = `SELECT 
                     sum("CreditNoteLines"."subTotal") - sum(CASE WHEN "CreditNoteLines"."isInclusiveTax" = true THEN  "CreditNoteLines"."taxTotal" ELSE 0.0 END) as "totalAdjustment",
                      sum("CreditNoteLines"."taxTotal")  as "taxAdjustment",
                      sum("CreditNoteLines"."discountTotal") as "itemDiscountAdjustment",
                      sum("CreditNoteLines"."total")   as "netAdjustment"
              from "CreditNoteLines" 
              join "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId" 
              join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId" 
              join "values" on TRUE 
              join "Branches" on "Branches".id = "Invoices"."branchId"
              WHERE "CreditNoteLines"."companyId" = "values"."companyId" 
                and "CreditNoteLines"."branchId" = "values"."branchId"
                and "CreditNoteLines"."createdAt" >= "values"."fromDate" and "CreditNoteLines"."createdAt" < "values"."toDate" 
                and "Invoices"."status" <>'Draft' 
                and ("Invoices"."onlineData"->>'onlineStatus' ='Accepted' or "Invoices"."onlineData" is null or "Invoices"."onlineData"->>'onlineStatus' ='')
                and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
              `
              s = new Date()
              records = await DB.excu.query(query.text + text, query.values)
              e = new Date()
              console.log("TotalReturn:  ", e.getTime() - s.getTime())
        
      temp = records.rows && records.rows.length > 0 ? records.rows : []


      if (temp.length > 0) {
        if (temp[0]['totalAdjustment'] != null) { dailySalesReport.sales.return = temp[0]['totalAdjustment'];}
        if (temp[0]['taxAdjustment'] != null) {dailySalesReport.tax.return = temp[0]['taxAdjustment'];}
        if (temp[0]['itemDiscountAdjustment'] != null) { dailySalesReport.discount.return = temp[0]['itemDiscountAdjustment'];}
        if (temp[0]['netAdjustment'] != null) {dailySalesReport.total.return = temp[0]['netAdjustment'];}
 
      }

      //###Total surcharge Adjustment###
      text = `SELECT
                sum("CreditNotes"."deliveryCharge") as "deliveryChargeAdjustment", 
                sum("CreditNotes"."roundingTotal") as "roundingAdjustment",
                sum( case when "CreditNotes"."isInclusiveTax" then  "CreditNotes"."chargeTotal" - COALESCE(("CreditNotes"."chargesTaxDetails"->>'taxAmount')::real,0) else  "CreditNotes"."chargeTotal" end) as "surchargeAdjustment",
                sum (COALESCE(nullif("CreditNotes"."chargesTaxDetails"->>'taxAmount','')::real,0))  as "surchargeTaxAdjustment"
            from "CreditNotes" 
            JOIN "values" ON TRUE 
            JOIN "Branches" ON "Branches".id = "CreditNotes"."branchId"
            JOIN "Invoices" ON "CreditNotes"."invoiceId" = "Invoices".id
            WHERE "Branches"."companyId" = "values"."companyId" 
						and "Branches".id = "values"."branchId"
						and "CreditNotes"."createdAt" >= "values"."fromDate" and "CreditNotes"."createdAt" < "values"."toDate" 
						and "Invoices"."status" <>'Draft' 
            and ("Invoices"."onlineData"->>'onlineStatus' ='Accepted' or "Invoices"."onlineData" is null or "Invoices"."onlineData"->>'onlineStatus' ='')
						and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
                    `
                    s = new Date()
                    records = await DB.excu.query(query.text + text, query.values)
                    e = new Date()
                    console.log("Total surcharge Adjustment:  ", e.getTime() - s.getTime())
              
      temp = records.rows && records.rows.length > 0 ? records.rows : []
      if (temp.length > 0) {
      if (temp[0]['deliveryChargeAdjustment'] != null) { dailySalesReport.deliveryCharge.return = temp[0]['deliveryChargeAdjustment']; }
      if (temp[0]['roundingAdjustment'] != null) { dailySalesReport.rounding.return = temp[0]['roundingAdjustment']; }
      if (temp[0]['surchargeAdjustment'] != null) { dailySalesReport.surcharge.return = temp[0]['surchargeAdjustment']; }
      if (temp[0]['surchargeTaxAdjustment'] != null) { dailySalesReport.surchargeTax.return = temp[0]['surchargeTaxAdjustment']; }
      }



      //##################### Total Refund #####################
      text = ` SELECT sum("CreditNoteRefunds".total) as "totalRefund" 
	                  from "CreditNoteRefunds" 
                    join "CreditNotes" on "CreditNotes".id = "CreditNoteRefunds"."creditNoteId" 
                    join "Invoices" on "Invoices".id = "CreditNotes"."invoiceId" 
                    join "values" on TRUE 
                    join "Branches" on "Branches".id = "Invoices"."branchId"
                    WHERE "Branches"."companyId" = "values"."companyId" 
                      and"Branches".id = "values"."branchId"
                      and "CreditNoteRefunds"."createdAt" >= "values"."fromDate" and "CreditNoteRefunds"."createdAt" < "values"."toDate" 
                      and "Invoices"."status" <>'Draft' 
                      and ("Invoices"."onlineData"->>'onlineStatus' ='Accepted' or "Invoices"."onlineData" is null or "Invoices"."onlineData"->>'onlineStatus' ='')
			                and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
                    `
                    s = new Date()
                    records = await DB.excu.query(query.text + text, query.values)
                    e = new Date()
                    console.log("totalRefund:  ", e.getTime() - s.getTime())
              
      temp = records.rows && records.rows.length > 0 ? records.rows : []
      if (temp[0]['totalRefund'] != null) { dailySalesReport.totalRefund = temp[0]['totalRefund']; }

      
      //##################### TotalVoid #####################
      text = ` SELECT sum("InvoiceLines".total) as "totalVoid" 
                      from "InvoiceLines" 
                      join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId"
                      join "values" on TRUE 
                      join "Branches" on "Branches".id = "Invoices"."branchId"
                      WHERE "InvoiceLines"."companyId" = "values"."companyId" 
                        and"InvoiceLines"."branchId" = "values"."branchId"
                        and "InvoiceLines"."createdAt" >= "values"."fromDate" and "InvoiceLines"."createdAt" < "values"."toDate" 
                        and "Invoices"."status" <>'Draft' 
                        and ("Invoices"."onlineData"->>'onlineStatus' ='Accepted' or "Invoices"."onlineData" is null or "Invoices"."onlineData"->>'onlineStatus' ='')
			                  and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
                        and qty < 0 
                      `
                      s = new Date()
                      records = await DB.excu.query(query.text + text, query.values)
                      e = new Date()
                      console.log("totalVoid:  ", e.getTime() - s.getTime())
                
      temp = records.rows && records.rows.length > 0 ? records.rows : []
      if (temp[0]['totalVoid'] != null) { dailySalesReport.totalVoid = temp[0]['totalVoid']; }

      //################### TotalOrdersAmount ###################
      text = `SELECT sum( total) as "totalOrdersAmount" 
                      from "Invoices" 
                      join "values" on TRUE 
                      join "Branches" on "Branches".id = "Invoices"."branchId"
                      WHERE "Branches"."companyId" = "values"."companyId" 
                      and"Branches".id = "values"."branchId"
                      and "Invoices"."createdAt" >= "values"."fromDate" and "Invoices"."createdAt" < "values"."toDate" 
                      and "Invoices"."status" <>'Draft' 
                      and ("Invoices"."onlineData"->>'onlineStatus' ='Accepted' or "Invoices"."onlineData" is null or "Invoices"."onlineData"->>'onlineStatus' ='')
			                    and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
                      `
                      s = new Date()
                      records = await DB.excu.query(query.text + text, query.values)
                      e = new Date()
                      console.log("totalOrdersAmount:  ", e.getTime() - s.getTime())
                
      temp = records.rows && records.rows.length > 0 ? records.rows : []
      if (temp[0]['totalOrdersAmount'] != null) { dailySalesReport.totalOrdersAmount = temp[0]['totalOrdersAmount']; }

      //#################### Income By Tender ####################
      text = `,"refund" as (	
                      select sum("CreditNoteRefundLines".amount) as refund, "paymentMethodId" 
                      from "CreditNoteRefundLines"  
                      INNER JOIN "PaymentMethods" on  "PaymentMethods".id = "CreditNoteRefundLines"."paymentMethodId" 
                      JOIN "CreditNoteRefunds" on  "CreditNoteRefundLines"."creditNoteRefundId" = "CreditNoteRefunds".id
                      JOIN "values" on TRUE
                      JOIN "Branches" on "Branches".id = "CreditNoteRefunds"."branchId"
                      WHERE "Branches"."companyId" = "values"."companyId" 
                      and"Branches".id = "values"."branchId"
                      and "CreditNoteRefunds"."createdAt" >= "values"."fromDate" and "CreditNoteRefunds"."createdAt" < "values"."toDate" 
                      GROUP BY "PaymentMethods".name,"paymentMethodId" )

                      ,"tenderDetails" as ( 
                        select "PaymentMethods".name as "tenderType", "PaymentMethods".id as "paymentMethodId",
                        "InvoicePayments".rate , sum("InvoicePaymentLines".amount) as "expected", 
                        Sum("InvoicePaymentLines".amount * "InvoicePayments".rate) as "equivalant"
                        from "InvoicePayments" 
                        INNER JOIN "PaymentMethods" on  "PaymentMethods".id = "InvoicePayments"."paymentMethodId" 
                        INNER JOIN "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id
                        INNER JOIN "Invoices" on "Invoices".id = "InvoicePaymentLines"."invoiceId"
                        JOIN "values" on TRUE 
                        JOIN "Branches" on "Branches".id = "InvoicePayments"."branchId"
                        WHERE  "Branches"."companyId" = "values"."companyId" 
                        and"Branches".id = "values"."branchId"
                        and "InvoicePayments"."createdAt" >= "values"."fromDate" and "InvoicePayments"."createdAt" < "values"."toDate" 
                     	  and "Invoices"."status" <>'Draft'
                        and ("Invoices"."onlineData"->>'onlineStatus' ='Accepted' or "Invoices"."onlineData" is null or "Invoices"."onlineData"->>'onlineStatus' ='')
						            and "InvoicePayments".status = 'SUCCESS'  
			                  and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
                        group by "PaymentMethods".id,"InvoicePayments".rate 
                        order by "PaymentMethods".index
                        
                        )

                      SELECT "tenderDetails".*, 
                              COALESCE( "refund".refund ,0)as refund,
                              "tenderDetails".expected- COALESCE( "refund".refund ,0) as "tenderTotal"  
                      from "tenderDetails"
                      left join "refund" on "tenderDetails"."paymentMethodId" = refund."paymentMethodId"
                      `
      records = await DB.excu.query(query.text + text, query.values)
      temp = records.rows && records.rows.length > 0 ? records.rows : []
      dailySalesReport.tenderDetails = temp.map((e) => TenderDetails.fromMap(e));

      

      //#################### Total Income by Tenders #################### 
      text = ` SELECT sum("InvoicePaymentLines".amount) as "totalIncomeByTenders" 
                      from "InvoicePaymentLines"
                      JOIN "values" on TRUE
                      INNER JOIN "InvoicePayments" on  "InvoicePayments"."branchId" = "values"."branchId" and "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id
                      INNER JOIN "Invoices" on "Invoices".id = "InvoicePaymentLines"."invoiceId"
                      
                      WHERE  "InvoicePayments"."createdAt" >= "values"."fromDate" and "InvoicePayments"."createdAt" < "values"."toDate" 
                      and "InvoicePayments".status = 'SUCCESS' 
                      and ("Invoices"."onlineData"->>'onlineStatus' ='Accepted' or "Invoices"."onlineData" is null or "Invoices"."onlineData"->>'onlineStatus' ='')
			                and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
                    `
                    s = new Date()
                    records = await DB.excu.query(query.text + text, query.values)
                    e = new Date()
                    console.log("Total Income by Tenders:  ", e.getTime() - s.getTime())
              
      temp = records.rows && records.rows.length > 0 ? records.rows : []
      if (temp[0]['totalIncomeByTenders'] != null) {
        dailySalesReport.totalIncomeByTenders = temp[0]['totalIncomeByTenders'];
      }

      
     

      //#################### Sales by Category ####################
      text = ` 
               select COALESCE("Departments".name,'Other') as "departmentName", COALESCE("Categories".name,'Other') as "categoryName",  Sum("totalSales") as "totalSales" , Sum("totalReturns") as "totalReturns", Sum("salesQty") as "salesQty" , Sum("returnQty") as "returnQty"
					  from (
					  SELECT  "Products"."categoryId", 
                    Sum("InvoiceLines".total) as "totalSales",
                    0 as "totalReturns",
                    Sum("InvoiceLines".qty) as "salesQty",
                    0 as "returnQty"
                    from "InvoiceLines"
            JOIN "values" on TRUE
            JOIN  "Invoices" on "Invoices"."branchId" = "values"."branchId" and "Invoices".id = "InvoiceLines"."invoiceId" 
             and  "Invoices"."status" <>'Draft' 
             and ("Invoices"."onlineData"->>'onlineStatus' ='Accepted' or "Invoices"."onlineData" is null or "Invoices"."onlineData"->>'onlineStatus' ='')
					  LEFT JOIN "Products" on "Products"."companyId" = "values"."companyId" and "InvoiceLines"."productId" = "Products".id  
            WHERE "InvoiceLines"."companyId" = "values"."companyId" 
              and "InvoiceLines"."branchId" = "values"."branchId"
              and "InvoiceLines"."createdAt" >= "values"."fromDate" and "InvoiceLines"."createdAt" < "values"."toDate" 
              and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
            GROUP BY "Products"."categoryId"

					  union all
					  
					  SELECT "Products"."categoryId", 
                    0 as "totalSales",
                    Sum("CreditNoteLines".total) as "totalReturns",
                    0 as "salesQty",
                    Sum("CreditNoteLines".qty) as "returnQty"
            FROM "CreditNoteLines"
            JOIN "values" on TRUE
            JOIN  "CreditNotes" on "CreditNotes".id = "CreditNoteLines"."creditNoteId" and  "values"."branchId" = "CreditNotes"."branchId"
            JOIN "Invoices" ON "Invoices".id = "CreditNotes"."invoiceId"
            LEFT JOIN "Products" on "Products"."companyId" = "values"."companyId" and "CreditNoteLines"."productId" = "Products".id
             WHERE "CreditNoteLines"."companyId" = "values"."companyId" 
              and "CreditNoteLines"."branchId" = "values"."branchId"
              and "CreditNoteLines"."createdAt" >= "values"."fromDate" and "CreditNoteLines"."createdAt" < "values"."toDate" 
			          and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
            GROUP BY "Products"."categoryId"
							)t
							
						Left JOIN "Categories" On "Categories"."companyId" = $1 and "t"."categoryId" = "Categories".id
            Left JOIN "Departments" On "Departments"."companyId" = $1 and "Categories"."departmentId" = "Departments".id
							
					  group by "departmentName",  "categoryName"
            `
                     s = new Date()
                     records = await DB.excu.query(query.text + text, query.values)
                     e = new Date()
                     console.log("Category:  ", e.getTime() - s.getTime())
               
      temp = records.rows && records.rows.length > 0 ? records.rows : []
      dailySalesReport.categoryDetails = temp.map((e) => CategoryDetails.fromMap(e))

      //#################### Sales By Service  ####################
      text = ` select "serviceName", sum("numberOfInvoices") as "numberOfInvoices" , Sum("totalSales") as"totalSales" , Sum("totalReturns") as "totalReturns", Sum("salesQty") as "salesQty" , Sum("returnQty") as "returnQty"
                from (
                SELECT COALESCE("Services".name,'Other') as "serviceName",
                count(distinct "invoiceId") as "numberOfInvoices", 
                  Sum("InvoiceLines".total) as "totalSales",
                  0 as "totalReturns",
                  Sum("InvoiceLines".qty) as "salesQty",
							  0 as "returnQty"
                from "InvoiceLines"
                join "values" on TRUE 
                inner join "Invoices" On "Invoices".id = "InvoiceLines"."invoiceId" and "Invoices"."branchId" = "values"."branchId" 
                    and "Invoices"."status" <>'Draft'  
                    and ("Invoices"."onlineData"->>'onlineStatus' ='Accepted' or "Invoices"."onlineData" is null or "Invoices"."onlineData"->>'onlineStatus' ='')
                left join "Services" On "Services"."companyId" = "values"."companyId"  and  "Invoices"."serviceId" = "Services".id  
                
                  WHERE "InvoiceLines"."companyId" = "values"."companyId" 
              and "InvoiceLines"."branchId" = "values"."branchId"
                and "InvoiceLines"."createdAt" >= "values"."fromDate" and "InvoiceLines"."createdAt" < "values"."toDate" 
                  and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
                GROUP by "Services".name
                  
                union all
                  
                SELECT COALESCE("Services".name,'Other') as "serviceName",
                 0 as "numberOfInvoices", 
                  0 as "totalSales",
                  Sum("CreditNoteLines".total) as "totalReturns",
                  0 as "salesQty",
							  Sum("CreditNoteLines".qty) as "returnQty"
                from "CreditNoteLines" 
                 join "values" on TRUE
                inner join "CreditNotes" On "CreditNotes".id = "CreditNoteLines"."creditNoteId" and  "CreditNotes"."branchId" = "values"."branchId"
                inner join "Invoices" ON "Invoices".id = "CreditNotes"."invoiceId"
               
                left join "Services" On "Services"."companyId" = "values"."companyId" and "Invoices"."serviceId" = "Services".id 
                  WHERE "CreditNoteLines"."companyId" = "values"."companyId" 
              and "CreditNoteLines"."branchId" = "values"."branchId"
                and "CreditNoteLines"."createdAt" >= "values"."fromDate" and "CreditNoteLines"."createdAt" < "values"."toDate" 
                  and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
                GROUP by "Services".name
                ) t
                group by "serviceName"
                   `
                   s = new Date()
                   records = await DB.excu.query(query.text + text, query.values)
                   e = new Date()
                   console.log("Service:  ", e.getTime() - s.getTime())
             
      temp = records.rows && records.rows.length > 0 ? records.rows : []
      dailySalesReport.serviceDetails = temp.map((e) => ServiceDetails.fromMap(e))
      
      //#################### Credit Payment ####################
      text = ` SELECT  CAST(EXTRACT(EPOCH FROM "invoiceDate") * 1000 AS BIGINT) AS "invoicesDate",
                            count(DISTINCT "Invoices"."invoiceNumber") AS "invoiceQty",
                            sum(amount) AS "paymentReceived"
                    FROM "InvoicePaymentLines" 
                    JOIN "InvoicePayments" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id and "InvoicePayments".status = 'SUCCESS'
                    JOIN "Invoices" ON "InvoicePaymentLines"."invoiceId" = "Invoices".id 
                    JOIN "values" on TRUE
                    JOIN "Branches" on "Branches".id = "Invoices"."branchId"
                    WHERE 
                    "Branches"."companyId" = "values"."companyId" 
                    and"Branches".id = "values"."branchId"
                    and "InvoicePaymentLines"."createdAt" >= "values"."fromDate" and "InvoicePaymentLines"."createdAt" < "values"."toDate" 
                 and "Invoices"."status" <>'Draft' 
                 and ("Invoices"."onlineData"->>'onlineStatus' ='Accepted' or "Invoices"."onlineData" is null or "Invoices"."onlineData"->>'onlineStatus' ='')
			                     and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
                    GROUP BY  CAST(EXTRACT(EPOCH FROM "invoiceDate") * 1000 AS BIGINT)  
                  `
                  s = new Date()
                  records = await DB.excu.query(query.text + text, query.values)
                  e = new Date()
                  console.log("Credit Payment:  ", e.getTime() - s.getTime())
            
      temp = records.rows && records.rows.length > 0 ? records.rows : []

      dailySalesReport.paymentBreakdown = temp.map((e) => PaymentBreakdown.fromMap(e))

      //#################### Total Credit Payment ####################
      text = `select sum(amount) as "totalPayment"
                    from "InvoicePaymentLines" 
					          JOIN "InvoicePayments" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id and "InvoicePayments".status = 'SUCCESS'
                    JOIN "Invoices" on "InvoicePaymentLines"."invoiceId" = "Invoices".id
                    JOIN "values" on TRUE
                    
                    WHERE "values"."branchId" = "InvoicePayments"."branchId"
                    and ("Invoices"."onlineData"->>'onlineStatus' ='Accepted' or "Invoices"."onlineData" is null or "Invoices"."onlineData"->>'onlineStatus' ='')
                    and "InvoicePaymentLines"."createdAt" >= "values"."fromDate" and "InvoicePaymentLines"."createdAt" < "values"."toDate" 
			              and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
                    `
                    s = new Date()
                    records = await DB.excu.query(query.text + text, query.values)
                    e = new Date()
                    console.log("Total Credit Payment:  ", e.getTime() - s.getTime())
              
      temp = records.rows && records.rows.length > 0 ? records.rows : []
      if (temp[0]['totalPayment'] != null) { dailySalesReport.totalPayment = temp[0]['totalPayment']; }

      //####################      Sales Details    ####################
      text = ` SELECT DATE("InvoiceLines"."createdAt" )  as "salesDate", 
                      sum("InvoiceLines"."subTotal" - (CASE WHEN "InvoiceLines"."isInclusiveTax" = true then "InvoiceLines"."taxTotal" else 0.0 end)) as "totalSales", 
                      sum("InvoiceLines"."taxTotal" ::text::numeric) as "taxTotal" ,sum("InvoiceLines"."discountTotal") as "itemDiscount",  sum("InvoiceLines".total) as "netSales"
                      FROM "InvoiceLines" join "Invoices" on "Invoices".id = "InvoiceLines"."invoiceId"
                    JOIN "values" on TRUE
                    JOIN "Branches" on "Branches".id = "Invoices"."branchId"
                    WHERE "InvoiceLines"."companyId" = "values"."companyId" 
                    and"InvoiceLines"."branchId" = "values"."branchId"
                    and "InvoiceLines"."createdAt" >= "values"."fromDate" and "InvoiceLines"."createdAt" < "values"."toDate" 
                 and "Invoices"."status" <>'Draft'  
                 and ("Invoices"."onlineData"->>'onlineStatus' ='Accepted' or "Invoices"."onlineData" is null or "Invoices"."onlineData"->>'onlineStatus' ='')
			                    and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
                    GROUP BY DATE("InvoiceLines"."createdAt" ) 
                    `
                    s = new Date()
                    records = await DB.excu.query(query.text + text, query.values)
                    e = new Date()
                    console.log("Sales Details:  ", e.getTime() - s.getTime())
              
      temp = records.rows && records.rows.length > 0 ? records.rows : []
      dailySalesReport.salesDetails = temp.map((e) => SalesDetails.fromMap(e))
   

      //#################### tender Breackdown ####################
      text = ` ,"refund" as (	
                      select sum("CreditNoteRefundLines".amount) as refund, "paymentMethodId" 
                      from "CreditNoteRefundLines"  
                      INNER JOIN "PaymentMethods" on  "PaymentMethods".id = "CreditNoteRefundLines"."paymentMethodId" 
                      JOIN "CreditNoteRefunds" on  "CreditNoteRefundLines"."creditNoteRefundId" = "CreditNoteRefunds".id
                      JOIN "values" on TRUE
                      JOIN "Branches" on "Branches".id = "CreditNoteRefunds"."branchId"
                      WHERE "Branches"."companyId" = "values"."companyId" 
                      and"Branches".id = "values"."branchId"
                      and "CreditNoteRefunds"."createdAt" >= "values"."fromDate" and "CreditNoteRefunds"."createdAt" < "values"."toDate" 
                      GROUP BY "PaymentMethods".name,"paymentMethodId" )

                      ,"tenderDetails" as ( 
                        select CAST(EXTRACT(EPOCH FROM "paymentDate") * 1000 AS BIGINT) as "paymentDate",
						           "PaymentMethods".name as "tenderType", "PaymentMethods".id as "paymentMethodId",
                        "InvoicePayments".rate , sum("InvoicePaymentLines".amount) as "expected", 
                        Sum("InvoicePaymentLines".amount * "InvoicePayments".rate) as "equivalant"
                        from "InvoicePayments" 
                        INNER JOIN "PaymentMethods" on  "PaymentMethods".id = "InvoicePayments"."paymentMethodId" 
                        INNER JOIN "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id
                        INNER JOIN "Invoices" on "Invoices".id = "InvoicePaymentLines"."invoiceId"
                        JOIN "values" on TRUE 
                        JOIN "Branches" on "Branches".id = "InvoicePayments"."branchId"
                        WHERE  "Branches"."companyId" = "values"."companyId" 
                        and"Branches".id = "values"."branchId" 
                        and "InvoicePayments"."createdAt" >= "values"."fromDate" and "InvoicePayments"."createdAt" < "values"."toDate" 
                        and "Invoices"."status" <>'Draft' 
                        and ("Invoices"."onlineData"->>'onlineStatus' ='Accepted' or "Invoices"."onlineData" is null or "Invoices"."onlineData"->>'onlineStatus' ='')
                        and "InvoicePayments".status = 'SUCCESS'
			                  and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
                        GROUP BY CAST(EXTRACT(EPOCH FROM "paymentDate") * 1000 AS BIGINT), "PaymentMethods".id,"InvoicePayments".rate )

                      SELECT "tenderDetails".*, 
                              COALESCE( "refund".refund ,0)as refund,
                              "tenderDetails".expected- COALESCE( "refund".refund ,0) as "tenderTotal"  
                      from "tenderDetails"
                      left join "refund" on "tenderDetails"."paymentMethodId" = refund."paymentMethodId"
					   
                  `
                  s = new Date()
                  records = await DB.excu.query(query.text + text, query.values)
                  e = new Date()
                  console.log("tender Breackdown:  ", e.getTime() - s.getTime())
            
      temp = records.rows && records.rows.length > 0 ? records.rows : []

      dailySalesReport.tenderBreakdown = temp.map((e) => TenderBreakdown.fromMap(e))


      //#################### tax Breackdown ####################
      text = ` ,"InvoicesTax" as (
        SELECT 
          COALESCE(nullif(nullif(elem->>'taxId', ''),'null')::uuid,"InvoiceLines"."taxId" ) as tax_id, 
          sum(COALESCE(nullif(COALESCE(elem->>'taxAmount', elem->>'taxTotal'),'')::double precision,"InvoiceLines"."taxTotal" )) as invoice_tax,
          0 as credit_tax
        FROM "InvoiceLines" 
        JOIN "values" ON TRUE
        JOIN "Invoices" ON "Invoices".id = "InvoiceLines"."invoiceId"
        LEFT JOIN   jsonb_array_elements(nullif("InvoiceLines"."taxes",'null') ) elem  on nullif("InvoiceLines"."taxType",'') is not null
    
           WHERE "InvoiceLines"."companyId" = "values"."companyId" 
              and "InvoiceLines"."branchId" = "values"."branchId"
          and "InvoiceLines"."createdAt" >= "values"."fromDate" and "InvoiceLines"."createdAt" < "values"."toDate" 

          and "Invoices"."status" <>'Draft'  
         and ("Invoices"."onlineData"->>'onlineStatus' ='Accepted' or "Invoices"."onlineData" is null or "Invoices"."onlineData"->>'onlineStatus' ='')
          and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
        group by tax_id
        )
        ,"CreditsTax" AS (
        SELECT 
          COALESCE(nullif(nullif(elem->>'taxId', ''),'null')::uuid,"CreditNoteLines"."taxId" ) as  tax_id, 
          0 as invoice_tax,
          sum(COALESCE(nullif(COALESCE(elem ->> 'taxAmount', elem ->> 'taxTotal'),'')::double precision,"CreditNoteLines"."taxTotal" )) as credit_tax
        FROM "CreditNoteLines" 
        JOIN "values" ON TRUE
        JOIN "CreditNotes" ON "CreditNotes".id = "CreditNoteLines"."creditNoteId"
        JOIN "Invoices" on "Invoices".id = "CreditNotes"."invoiceId" 
        LEFT JOIN   jsonb_array_elements(nullif("CreditNoteLines"."taxes",'null') )  elem  on nullif("CreditNoteLines"."taxType",'') is not null
        WHERE "CreditNoteLines"."companyId" = "values"."companyId" 
          and "CreditNoteLines"."branchId" = "values"."branchId"
          and "CreditNoteLines"."createdAt" >= "values"."fromDate" and "CreditNoteLines"."createdAt" < "values"."toDate" 
          and "Invoices"."status" <>'Draft'  
          and ("Invoices"."onlineData"->>'onlineStatus' ='Accepted' or "Invoices"."onlineData" is null)
          and ( array_length("values"."sources",1) IS NULL OR "Invoices".source = any("values".sources) )
        group by tax_id
        )

        select  "Taxes" .name, 
                "Taxes".id as id, 
                sum(invoice_tax) as "invoiceTax", 
                sum(credit_tax) as "creditTax"
        from (select * from "InvoicesTax" union all select * from "CreditsTax" )t
        join "Taxes" on "Taxes".id =  tax_id and ( invoice_tax <> 0 or credit_tax <> 0 )
        group by "Taxes".id

            `

records = await DB.excu.query(query.text + text, query.values)
temp = records.rows && records.rows.length > 0 ? records.rows : []

dailySalesReport.taxBreakdown = temp.map((e) => ({id : e.id, name : e.name, invoiceTax :Number(e.invoiceTax) ?? 0, creditTax : Number(e.creditTax) ?? 0,}))

      

if (filter.export) {
  let salesDetailsData: any = [...dailySalesReport.salesDetails]
  //salesDetailsData.forEach((el: { salesDate: moment.MomentInput; })=>  el.salesDate =  moment.utc(el.salesDate).utcOffset( +timeOffset ).format('YYYY-MM-DD'))
  const converted = salesDetailsData.reduce((acc: any, item: any) => {
    item.salesDate = moment.utc(item.salesDate).utcOffset(+timeOffset).format('YYYY-MM-DD') ?? ''
    acc[item.salesDate] = { totalSales: item.totalSales, itemDiscount: item.itemDiscount, totalAfterDiscount: item.totalSales - item.itemDiscount, taxTotal: item.taxTotal, Total: item.netSales, };
    return acc;
  }, {});



  let t2 = [{ '#': 'Sales', 'sales': dailySalesReport.sales.sales, 'return': dailySalesReport.sales.return, 'total': dailySalesReport.sales.sales - dailySalesReport.sales.return },
  { '#': 'Discount', 'sales': dailySalesReport.discount.sales, 'return': dailySalesReport.discount.return, 'total': dailySalesReport.discount.sales - dailySalesReport.discount.return },
  { '#': 'Tax', 'sales': dailySalesReport.tax.sales, 'return': dailySalesReport.tax.return, 'total': dailySalesReport.tax.sales - dailySalesReport.tax.return },
  ...(dailySalesReport.taxBreakdown ?? []).map((e: any) => ({ '#': '  '+e.name, 'sales': e.invoiceTax , 'return': e.creditTax , total: e.invoiceTax -  e.creditTax })),
  ]

  let t4 = [
   
  { 'key': 'Sales With Tax', 'sales': dailySalesReport.total.sales, 'return': dailySalesReport.total.return, 'total': dailySalesReport.total.sales - dailySalesReport.total.return },
  { 'key': 'Surcharge', 'sales': dailySalesReport.surcharge.sales, 'return': dailySalesReport.surcharge.return, 'total': dailySalesReport.surcharge.sales - dailySalesReport.surcharge.return },
  { 'key': 'Surcharge Tax', 'sales': dailySalesReport.surchargeTax.sales, 'return': dailySalesReport.surchargeTax.return, 'total': dailySalesReport.surchargeTax.sales - dailySalesReport.surchargeTax.return },
  { 'key': 'Delivery Charge', 'sales': dailySalesReport.deliveryCharge.sales, 'return': dailySalesReport.deliveryCharge.return, 'total': dailySalesReport.deliveryCharge.sales - dailySalesReport.deliveryCharge.return },
  { 'key': 'Rounding', 'sales': dailySalesReport.rounding.sales, 'return': dailySalesReport.rounding.return, 'total': dailySalesReport.rounding.sales - dailySalesReport.rounding.return },
  ];

  // Get max lengths
  const maxKeyLength = Math.max(Math.max(...t4.map(e => e.key.length)) ,Math.max(...t2.map(e => e['#'].length)) );

  // Pad 'key' values in t4
  t4 = t4.map(e => ({
    ...e,
    key: e.key.padEnd(maxKeyLength, ' ')
  }));

  // Pad '#' values in t2
  t2 = t2.map(e => ({
    ...e,
    '#': e['#'].padEnd(maxKeyLength, ' ')
  }));

  let t3 = [{ 'key': "Not Recieved Payment", 'value': dailySalesReport.notRecievedPayment },
  { 'key': "Total Refund", 'value': dailySalesReport.totalRefund },
  { 'key': "Total Void", 'value': dailySalesReport.totalVoid }
  ];

  let tables = {
    "": {
      'records': [{ 'key': "Total Guest", 'value': dailySalesReport.totalGuests },
      { 'key': "Total Orders", 'value': dailySalesReport.totalOrders }]
      , 'columns': { 'key': {}, '': {}, 'value': {} }
    },
    " ": {
      'records': t2
      , 'columns': { '#': {}, 'sales': { columnType: 'currency' }, 'return': {  columnType: 'currency' }, 'total': { columnType: 'currency' } }
    },
    "    ": {
      'records': t4
      , 'columns': { 'key': {}, 'sales': { hasTotal: true, columnType: 'currency' }, 'return': { hasTotal: true, columnType: 'currency' }, 'total': { hasTotal: true, columnType: 'currency' } }
    },
    "  ": {
      'records': t3
      , 'columns': { 'key': {}, '': {}, 'value': { columnType: 'currency' } }
    },
    "Income By Tenders": {
      'records': dailySalesReport.tenderDetails.map((e: any) => { return { Type: e.tenderType, Income: Number(e.equivalant), refund: Number(e.refund), Total: Number(e.tenderTotal) } })
      , 'columns': { 'Type': {}, 'Income': { hasTotal: true, columnType: 'currency' }, 'Refund': { hasTotal: true, columnType: 'currency' }, 'Total': { hasTotal: true, columnType: 'currency' } }
    },
    "Sales By Category": {
      'records': dailySalesReport.categoryDetails.map((e: any) => {
        return {
          Department: e.departmentName, Category: e.categoryName
          , SalesQty: e.salesQty, Sales: e.totalSales
          , ReturnQty: e.returnQty, Return: e.totalReturns
          , NetQty: (e.salesQty - e.returnQty), Total: (e.totalSales - e.totalReturns)
        }
      })
      , 'columns': {
        'Department': {}, 'Category': {}
        , 'SalesQty': { hasTotal: true }, 'Sales': { hasTotal: true, columnType: 'currency' }
        , 'ReturnQty': { hasTotal: true }, 'Return': { hasTotal: true, columnType: 'currency' }
        , 'NetQty': { hasTotal: true }, 'Total': { hasTotal: true, columnType: 'currency' }
      }
    },
    "Sales By Service": {
      'records': dailySalesReport.serviceDetails.map((e: any) => {
        return {
          'Service[InvoiceCount]': `${e.serviceName} [${e.numberOfInvoices}]`
          , SalesQty: e.salesQty, Sales: e.totalSales
          , ReturnQty: e.returnQty, Return: e.totalReturns
          , NetQty: (e.salesQty - e.returnQty), Total: (e.totalSales - e.totalReturns)
        }
      })
      , 'columns': {
        'Service[InvoiceCount]': {}
        , 'SalesQty': { hasTotal: true }, 'Sales': { hasTotal: true, columnType: 'currency' }
        , 'ReturnQty': { hasTotal: true, }, 'Return': { hasTotal: true, columnType: 'currency' }
        , 'NetQty': { hasTotal: true }, 'Total': { hasTotal: true, columnType: 'currency' }
      }
    },
    "Sales Breakdown": {
      'records': dailySalesReport.salesDetails.map((item: any) => {
        return {
          salesDate: moment.utc(item.salesDate).utcOffset(+timeOffset).format('YYYY-MM-DD') ?? '', totalSales: item.totalSales, itemDiscount: item.itemDiscount, totalAfterDiscount: item.totalSales - item.itemDiscount, taxTotal: item.taxTotal, Total: item.netSales,
        }
      })
      , 'columns': { salesDate: {}, totalSales: { hasTotal: true, columnType: 'currency' }, itemDiscount: { hasTotal: true, columnType: 'currency' }, totalAfterDiscount: { hasTotal: true, columnType: 'currency' }, taxTotal: { hasTotal: true, columnType: 'currency' }, Total: { hasTotal: true, columnType: 'currency' } }
    },

    // "Sales Breakdown"  : {'records':converted
    //   , 'columns' :{key:{}, value: { columnType:'currency'} }, style:'object'},
    "Payment Breakdown": {
      'records': dailySalesReport.paymentBreakdown.map((e: any) => { return { InvoiceDate: moment.utc(e.invoicesDate).utcOffset(+timeOffset).format('YYYY-MM-DD') ?? '', InvoiceQty: Number(e.invoiceQty), Payments: Number(e.paymentReceived) } })
      , 'columns': { 'InvoiceDate': {}, 'InvoiceQty': { hasTotal: true }, 'Payments': { hasTotal: true, columnType: 'currency' } }
    },

  

  }


  let resData = {
    'filter': {
      title: "Daily Closing Report",
      fromDate: null,
      toDate: null,
      date: filter && filter.date ? filter.date : date.format('YYYY-MM-DD HH:mm:ss'),
      branches: branchId ? [branchId] : []
    },
    fileName: 'DailyClosingReport',
    records: tables
   
  }




  return new ResponseData(true, "", resData)
}


      return new ResponseData(true, "", dailySalesReport)

    } catch (error: any) {
      console.log(error)
 
      throw new Error(error.message)
    }
  }















}