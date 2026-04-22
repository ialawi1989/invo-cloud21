/* eslint-disable prefer-const */
import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { ProductRepo } from '@src/repo/app/product/product.repo';

import { Company } from "@src/models/admin/company";
import { BranchesRepo } from "../admin/branches.repo";
import { EmployeeRepo } from "../admin/employee.repo";
import { InvoiceRepo } from "../app/accounts/invoice.repo";
import { Invoice } from "@src/models/account/Invoice";
import { PoolClient } from "pg";
import { Customer } from "@src/models/account/Customer";
import { CustomerRepo } from "../app/accounts/customer.repo";
import { CompanyRepo } from "../admin/company.repo";
import { AccountsRepo } from "../app/accounts/account.repo";
import { TimeHelper } from "@src/utilts/timeHelper";
import { InvoiceLine } from "@src/models/account/InvoiceLine";
import { InvoiceLineOption } from "@src/models/account/invoiceLineOption";
import { InvoiceInventoryMovmentRepo } from "../app/accounts/InvoiceInventoryMovment.repo";
import { SocketInvoiceRepo } from '@src/repo/socket/invoice.socket';
import { Helper } from '@src/utilts/helper';
import { ValidationException } from '@src/utilts/Exception';
import moment from 'moment';

export class InvoiceController{

    public static async getInvoices(data: any, company: Company, brancheList:[]) {
        try {
            let filter     = data.filter     ? (data.filter).trim()     ? (data.filter).trim()     : ""   :"";
            let  branchId  = data.branchId   ? (data.branchId).trim()   ? (data.branchId).trim()   : null : null;
            let employeeId = data.employeeId ? (data.employeeId).trim() ? (data.employeeId).trim() : null : null;
            let companyId = company.id;

            let branches = branchId? [branchId] : brancheList

            console.log(branches)
            
            let interval = data.interval ? data.interval : null;
            let date = new Date()
            let from = moment(date).format("YYYY-MM-DD 00:00:00")
            let to = moment(date).add(1, 'day').format("YYYY-MM-DD 00:00:00");
            

            if(interval){
                let from = data.interval.from
                let to: any = new Date(data.interval.to)
                to = moment(to).add(1, 'day').format("YYYY-MM-DD 00:00:00");
                from = await TimeHelper.resetHours(from)
            }
           


            const query : { text: string, values: any } = {
                text: `with "invoices" as (
                                select "Invoices".id,
                                    "Invoices"."mergeWith",
                                    "Branches"."name" as "branchName",
                                    "Invoices"."scheduleTime",
                                    "Invoices"."invoiceNumber",
                                    "Invoices"."refrenceNumber",
                                    "Invoices".total,
                                    "Invoices"."createdAt",
                                    "Invoices"."customerContact", 
                                    "Invoices".note, 
                                    "Invoices"."onlineData"->> 'callCenterStatus' as "callCenterStatus",
                                    "Invoices"."serviceId",
                                    "Invoices"."employeeId" ,
                                    "Invoices"."customerId",
                                    "Invoices"."driverId",
                                    "Invoices"."printTime",
                                    "Invoices"."readyTime",
                                    "Invoices"."departureTime",
                                    "Invoices"."arrivalTime"
                                from "Invoices" 
                                inner join "Branches" on "Branches".id = "Invoices"."branchId" 
                                where "Branches"."companyId" = $4
                                AND "mergeWith" IS NULL and ("Invoices"."source"= 'CallCenter' )
                                AND( array_length(($1::uuid[]),1) IS NULL OR "Branches".id = any( ($1::uuid[])))
                                AND ((($2::uuid) IS NULL) or ("Invoices"."employeeId" = $2))
                                AND ((($3::text) IS NULL) or ("Invoices"."invoiceNumber" ~ $3) or ("Invoices"."refrenceNumber" ~ $3) or ("Invoices"."customerContact" ~ $3))
                                AND ("Invoices"."createdAt" >= $5 and "Invoices"."createdAt" < $6)
                                ),"lineQty" as (
                                select "invoices".id , Sum(qty) as "itemQty"  from "invoices" 
                                inner join "InvoiceLines" on "InvoiceLines"."invoiceId" = "invoices".id
                                group by  "invoices".id
                                ), "payments" as (

                                select "invoices".id ,NULLIF(sum("InvoicePaymentLines".amount),0) as "payment"  from "invoices" 
                                inner join "InvoicePaymentLines" on "InvoicePaymentLines"."invoiceId" = "invoices".id
                                group by  "invoices".id
                                )
                                select "invoices".*,
                                    "Services".name As "serviceName",
                                        "Employees".name As "employeeName",
                                        "Customers".saluation || "Customers".name As "customerName", 
                                        "payments"."payment",
                                        driver.name As "driverName",
                                        "lineQty"."itemQty" 
                                from "invoices"
                                INNER JOIN "Services" On "invoices"."serviceId" = "Services".id
                                INNER JOIN "Employees" On "invoices"."employeeId" = "Employees".id
                                Left JOIN "Customers" On "invoices"."customerId" = "Customers".id
                                Left JOIN "Employees" As driver On "invoices"."driverId" = driver.id
                                LEFT JOIN "lineQty" ON "lineQty".id = "invoices".id 
                                LEFT JOIN "payments" ON "payments".id = "invoices".id 
                                Order By "invoices"."createdAt" desc`,
                values: [branches, employeeId, filter, companyId, from, to ]
            }
            
            let ids = (await DB.excu.query(query.text, query.values)).rows
            return ids
            return [];
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async getInvoicesByCustomerID(customerId: string, company: Company,brancheList:[]) {
        try {
            
            // let  customerId  = data.customerId   ? (data.customerId).trim()   ? (data.customerId).trim()   : null : null;
            
            // if (customerId ==  null){
            //     throw("customer Id is required")
            // }

            let branches = brancheList ?? []

            
            const query : { text: string, values: any } = {
                text: `select "Invoices".id,
                            "Invoices"."mergeWith",
                            "Invoices"."branchId",
                            "Invoices"."scheduleTime",
                            "invoiceNumber",
                            "refrenceNumber",
                            total,
                            ("Invoices"."createdAt"::text), 
                            "Services".name As "serviceName",
                            "Employees".name As "employeeName",
                            "Customers".saluation || "Customers".name As "customerName", 
                            "Invoices"."customerContact", 
                            "Invoices".note, 
                            NULLIF(sum("InvoicePaymentLines".amount),0) As "payment",
                            (Select Sum(qty) from "InvoiceLines" Where "invoiceId" = "Invoices".id) as "itemQty",
                                    "driverId", 
                                    driver.name As "driverName",
                                    "Invoices"."printTime",
                                    "Invoices"."readyTime",
                                    "Invoices"."departureTime",
                                    "Invoices"."arrivalTime"
                    from "Invoices" 
                    INNER JOIN "Services" On "Invoices"."serviceId" = "Services".id
                    INNER JOIN "Employees" On "Invoices"."employeeId" = "Employees".id
                    INNER JOIN "Branches" ON  "Branches".id = "Invoices"."branchId" 
                    Left JOIN "Customers" On "Invoices"."customerId" = "Customers".id
                    Left JOIN "Employees" As driver On "Invoices"."driverId" = driver.id
                    
                    Left JOIN "InvoicePaymentLines" On "InvoicePaymentLines"."invoiceId" = "Invoices".id
                    where "mergeWith" IS NULL and "Invoices"."customerId" = $1
                    AND( array_length(($2::uuid[]),1) IS NULL OR "Branches".id = any( ($2::uuid[])))
                    GROUP By "Invoices".id,"Invoices"."mergeWith","Invoices"."scheduleTime","invoiceNumber","refrenceNumber",total,
                    "Invoices"."createdAt", "Services".name, "Customers".saluation, driver.name, 
                                "Employees".name , "Customers".name, "Invoices"."customerContact", "Invoices".note
                    
                    Order By "Invoices"."createdAt" asc`,
                values: [customerId, branches]
            }
            
            let invoices = (await DB.excu.query(query.text, query.values))

            
            return invoices.rows
            return [];
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async saveInvoices(data: any, company: Company) {
        const dBClient = await DB.excu.client();

        try {

            const companyId = company.id
            const afterDecimal = company.afterDecimal
            
            await dBClient.query("BEGIN")



            let invoice = new Invoice();
            invoice.ParseJson(data);
            invoice.calculateTotal(afterDecimal);




            
        
            invoice.createdAt   = await TimeHelper.convertToDate(invoice.createdAt)
            invoice.invoiceDate = await TimeHelper.convertToDate(invoice.invoiceDate)

            //console.log(invoice)
            //const isInvoiceIdExist = await SocketInvoiceRepo.checkIfInvoiceIdExist(dBClient,invoice.id, invoice.branchId, invoice.createdAt)

            if (invoice.lines == null || invoice.lines.length <= 0) {
                throw new ValidationException("Invoice lines is required")
            }
            if (invoice.serviceId == null || invoice.serviceId == ""){
                throw new ValidationException("Invoice serviceId is required")
            }

            if (invoice.id != "" && invoice.id != null) { /**Invoice id exist edit invoice */
                invoice.updatedDate = await TimeHelper.convertToDate(invoice.updatedDate)
                invoice = (await this.editInvoice(dBClient, invoice, companyId)).data.invoice
            } else {
                invoice.source = "CallCenter"
                invoice = (await this.addInvoice(dBClient, invoice, company)).data.invoice
            }

                await dBClient.query("COMMIT")

                return new ResponseData(true, "Added Successfully", { invoice });
            } catch (error: any) {
                console.log(error)
                await dBClient.query("ROLLBACK")
              
                throw new Error(error.message)

        } finally {
            dBClient.release()
        }

    }  

    public static async getInvoiceNumber(client: PoolClient, branchId: string, company: Company) {
        try {
            const companyId = company.id;
            let invoiceNumber = "(^CC)[_\-]"

            const regexp = '^CC[_-]*';
            const numberPattern = '^[0-9\.]+$'

            const query: { text: string, values: any } = {
                text: `SELECT "invoiceNumber" 
                        FROM "Invoices"
                        INNER JOIN "Branches"
                        ON "Branches".id = "Invoices"."branchId"
                        Where "Branches"."companyId" = $1
                        and "invoiceNumber" ~ $2
                        and nullif(regexp_replace("invoiceNumber", $3, '', 'g'), '') ~ $4
                        ORDER BY( nullif(regexp_replace("invoiceNumber", $3 , ''),'')::int )DESC
                        LIMIT 1`,
                values: [companyId, invoiceNumber, regexp, numberPattern]
            }

            const data = await client.query(query.text, query.values);
            if (data.rowCount != null && data.rowCount <= 0) {
                invoiceNumber = "CC-1";
            } else {
                invoiceNumber = await Helper.generateNumber((<any>data.rows[0]).invoiceNumber)
            }
            

            return invoiceNumber
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async addInvoice(client: PoolClient, data: any, company: Company) {
        try {
            const companyId = company.id
            const afterDecimal = await CompanyRepo.getCompanyAfterDecimal(client,companyId)


        const invoice = new Invoice();
        invoice.ParseJson(data);
        invoice.calculateTotal(afterDecimal);
        invoice.calaculateBalance();
        invoice.onlineData.callCenterStatus = 'Placed';
        invoice.discountType = "itemDiscount"
        invoice.companyId = companyId
   

            /**CHECK NUMBER IF EXIST */
            if (invoice.invoiceNumber) {
                const isInvoiceNumberExist = await InvoiceRepo.checkIsInvoiceNumberExist(client, null, invoice.invoiceNumber, companyId);
                if (isInvoiceNumberExist) {
                    throw new Error("Invoice Number Already Used")
                }
            }else{
                let invoiceNumber = await this.getInvoiceNumber(client, invoice.branchId, company);
                invoice.invoiceNumber = invoiceNumber 
            }

            /** ADD NEW CUSTOMER IF NOT EXIST */
            let customer = invoice.customer
            if (customer && customer.phone != null && customer.phone != "") {
                    const customer = new Customer();
                    customer.ParseJson(invoice.customer);
                    let customerId = await CustomerRepo.addEcommerceCustomer(client, customer.id, customer, company)
                    invoice.customerId = customerId
            }
            else {
                invoice.customerId = null
            }
            

            /**IF customerAddress IS NOT OBJECT SET TO NULL */
            if (typeof invoice.customerAddress == 'string') {
                try{ invoice.customerAddress =  JSON.parse(invoice.customerAddress);} 
                catch{invoice.customerAddress = null}
            }

            if (invoice.chargeId == "") { invoice.chargeId = null; }

            /** CONVERT TIMES TO DATE FORMAT */
            invoice.printTime        = invoice.printTime        ? await TimeHelper.convertToDate(invoice.printTime) : null;
            invoice.readyTime        = invoice.readyTime        ? await TimeHelper.convertToDate(invoice.readyTime) : null;
            invoice.departureTime    = invoice.departureTime    ? await TimeHelper.convertToDate(invoice.departureTime) : null;
            invoice.arrivalTime      = invoice.arrivalTime      ? await TimeHelper.convertToDate(invoice.arrivalTime) : null;
            invoice.scheduleTime     = invoice.scheduleTime     ? await TimeHelper.convertToDate(invoice.scheduleTime) : null;
            invoice.onlineActionTime = invoice.onlineActionTime ? await TimeHelper.convertToDate(invoice.onlineActionTime) : null;
            invoice.refrenceNumber   = invoice.refrenceNumber   ? invoice.refrenceNumber: ""
        

            /**ADD INVOICE QUERY */
            const query : { text: string, values: any } = {
                text: `INSERT INTO "Invoices" ( "invoiceNumber",
                                                        "refrenceNumber",
                                                        total,
                                                        note,
                                                        guests,
                                                        "employeeId",
                                                        "tableId",
                                                        "branchId",
                                                        source,
                                                        "serviceId",
                                                        "customerId" ,
                                                        "customerAddress",
                                                        "customerContact",
                                                        "customerLatLang",
                                                        "createdAt",
                                                        "estimateId",
                                                        status,
                                                        "discountTotal",
                                                        "chargeTotal",
                                                        "chargeAmount",
                                                        "chargePercentage",
                                                        "chargeId",
                                                        "discountAmount",
                                                        "discountPercentage",
                                                        "discountId",
                                                        "deliveryCharge",
                                                        "subTotal",
                                                        "scheduleTime",
                                                        "mergeWith",
                                                        "invoiceDate",
                                                        "terminalId",
                                                        "roundingType",
                                                        "roundingTotal",
                                                        "smallestCurrency",
                                                        "isInclusiveTax",
                                                        "printTime",
                                                        "readyTime",
                                                        "departureTime",
                                                        "arrivalTime",
                                                        "driverId",
                                                        "onlineActionTime",
                                                        "onlineData",
                                                        "discountType",
                                                        "companyId"
                                                        ) 
                                            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44) RETURNING id `,
                values: [
                    invoice.invoiceNumber,
                    invoice.refrenceNumber,
                    invoice.total,
                    invoice.note,
                    invoice.guests,
                    invoice.employeeId,
                    invoice.tableId,
                    invoice.branchId,
                    invoice.source,
                    invoice.serviceId,
                    invoice.customerId,
                    invoice.customerAddress,
                    invoice.customerContact,
                    invoice.customerLatLang,
                    invoice.createdAt,
                    invoice.estimateId,
                    invoice.status,
                    invoice.discountTotal,
                    invoice.chargeTotal,
                    invoice.chargeAmount,
                    invoice.chargePercentage,
                    invoice.chargeId,
                    invoice.discountAmount,
                    invoice.discountPercentage,
                    invoice.discountId,
                    invoice.deliveryCharge,
                    invoice.subTotal,
                    invoice.scheduleTime,
                    invoice.mergeWith,
                    invoice.invoiceDate,
                    invoice.terminalId,
                    invoice.roundingType,
                    invoice.roundingTotal,
                    invoice.smallestCurrency,
                    invoice.isInclusiveTax,
                    invoice.printTime,
                    invoice.readyTime,
                    invoice.departureTime,
                    invoice.arrivalTime,
                    invoice.driverId,
                    invoice.onlineActionTime,
                    invoice.onlineData,
                    invoice.discountType,
                    invoice.companyId,
           

                ]
            }
            const invoiceInsert = await client.query(query.text, query.values);
            
            const invoiceId = (<any>invoiceInsert.rows[0]).id;
            invoice.id = invoiceId;
            
            
            for (let index = 0; index < invoice.lines.length; index++) {
                const invoiceLine = invoice.lines[index];
                invoiceLine.invoiceId = invoice.id
                invoiceLine.branchId = invoice.branchId
                invoiceLine.companyId = company.id
                /**INSERT INVOICE LINE */
               invoiceLine.id =  await this.addInvoiceLine(client, invoiceLine, invoice, afterDecimal)
                

                /**INSERT LINE VOIDED ITEMS AS INVOICE LINES */
                if (invoiceLine.voidedItems && invoiceLine.voidedItems.length > 0) {
                    
                    for (let index = 0; index < invoiceLine.voidedItems.length; index++) {
                        const element = invoiceLine.voidedItems[index];
                        const voidItem = new InvoiceLine();
                        voidItem.ParseJson(element)
                        voidItem.voidFrom =    invoiceLine.id
                        voidItem.invoiceId = invoice.id
                        voidItem.companyId = company.id
                        voidItem.branchId = invoice.branchId
        
                        await this.addInvoiceLine(client, voidItem, invoice, afterDecimal)
                    }
                }

                /**INSERT LINE subItems ITEMS AS INVOICE LINES */
                if (invoiceLine.subItems && invoiceLine.subItems.length > 0) {
                    for (let index = 0; index < invoiceLine.subItems.length; index++) {
                        const subItems = invoiceLine.subItems[index];
                        const subItemLine = new InvoiceLine();
                        subItemLine.companyId = company.id
                        subItemLine.ParseJson(subItems);
                        subItemLine.parentId = invoiceLine.id
                        subItemLine.invoiceId = invoice.id
                        subItemLine.branchId = invoice.branchId
                        subItemLine.companyId = company.id
                        await this.addInvoiceLine(client, subItemLine, invoice, afterDecimal)
                    }
                }


            }

            await SocketInvoiceRepo.sendCallCenterInvoice(client, invoice.branchId, invoiceId)
        
            return new ResponseData(true, "Added Successfully", { invoice: invoice});

        } catch (error: any) {
          
            console.log(error)
            throw new Error(error.message)
        }
    }

    public static async editInvoice(client: PoolClient, data: any, companyId: string) {

        try {
            const afterDecimal = await CompanyRepo.getCompanyAfterDecimal(client,companyId)

            const invoice = new Invoice();
            invoice.ParseJson(data);
            invoice.calculateTotal(afterDecimal);

            if (invoice.id == "" || invoice.id == null) {
                throw new Error("Invoice Id is Required")
            }
            
            const query2 = {
                text: `select id
                    from "InvoiceLines"
                    where  "invoiceId"= $1 `,
                values: [invoice.id]
            }
            let ids: any = []
            let tt  : any = (await DB.excu.query(query2.text, query2.values)).rows
            tt.forEach((a:any)=>ids.push(a.id));             // get lines' IDs  of the previous invoice
            let id_test= invoice.lines.map(a=> a.id);         //get lines' IDs of the current invoice
            let s = ids.filter((x:any)=> !id_test.includes(x))




            if (invoice.chargeId == "") {
                invoice.chargeId = null;
            }
            /** CONVERT TIMES TO DATE FORMAT */
            invoice.printTime = invoice.printTime ? await TimeHelper.convertToDate(invoice.printTime) : null;
            invoice.readyTime = invoice.readyTime ? await TimeHelper.convertToDate(invoice.readyTime) : null;
            invoice.departureTime = invoice.departureTime ? await TimeHelper.convertToDate(invoice.departureTime) : null;
            invoice.arrivalTime = invoice.arrivalTime ? await TimeHelper.convertToDate(invoice.arrivalTime) : null;
            invoice.scheduleTime = invoice.scheduleTime ? await TimeHelper.convertToDate(invoice.scheduleTime) : null;
            invoice.onlineActionTime = invoice.onlineActionTime ? await TimeHelper.convertToDate(invoice.onlineActionTime) : null;
            

            


            /**UPDATE INVOICE QUERY */
            const query : { text: string, values: any } = {
                text: `UPDATE  "Invoices" SET 
                                                    "refrenceNumber"=$1,
                                                    total=$2,
                                                    note=$3,
                                                    guests=$4,
                                                    "tableId"=$5,
                                                    "discountTotal"=$6,
                                                    "chargeTotal"=$7,
                                                    "chargeAmount"=$8,
                                                    "chargePercentage"=$9,
                                                    "chargeId"=$10,
                                                    "discountAmount"=$11,
                                                    "discountPercentage"=$12,
                                                    "discountId"=$13,
                                                    "deliveryCharge"=$14,
                                                    "subTotal"=$15,
                                                    "scheduleTime"=$16,
                                                    "mergeWith"=$17,
                                                    "invoiceDate"=$18,
                                                    "updatedDate" =$19,
                                                    "isInclusiveTax"=$20,
                                                    "printTime"=$21,
                                                    "readyTime"=$22,
                                                    "departureTime"=$23,
                                                    "arrivalTime"=$24,
                                                    "driverId"=$25,
                                                    "employeeId"=$26,
                                                    "onlineData" = jsonb_set(
                                                        jsonb_set("onlineData", '{rejectReason}', to_jsonb($27::text)),
                                                        '{onlineStatus}',
                                                        to_jsonb($28::text)
                                                    ),
                                                    "status"=$29,
                                                    "onlineActionTime" = $30,
                                                    "discountType"=$31
                                        WHERE  id=$32 AND "branchId"=$33`,
                values: [
                invoice.refrenceNumber,
                invoice.total,
                invoice.note,
                invoice.guests,
                invoice.tableId,
                invoice.discountTotal,
                invoice.chargeTotal,
                invoice.chargeAmount,
                invoice.chargePercentage,
                invoice.chargeId,
                invoice.discountAmount,
                invoice.discountPercentage,
                invoice.discountId,
                invoice.deliveryCharge,
                invoice.subTotal,
                invoice.scheduleTime,
                invoice.mergeWith,
                invoice.createdAt,
                invoice.updatedDate,
                invoice.isInclusiveTax,
                invoice.printTime,
                invoice.readyTime,
                invoice.departureTime,
                invoice.arrivalTime,
                invoice.driverId,
                invoice.employeeId,
                invoice.rejectReason,
                invoice.onlineStatus,
                invoice.status,
                invoice.onlineActionTime,
                invoice.discountType,
                invoice.id,
                invoice.branchId]
            }
            await client.query(query.text, query.values);

            

            for (let index = 0; index < invoice.lines.length; index++) {
                const invoiceLine = invoice.lines[index];
                invoiceLine.id =  await this.addInvoiceLine(client, invoiceLine, invoice, afterDecimal)
                invoiceLine.branchId = invoice.branchId
                /**INSERT LINE VOIDED ITEMS AS INVOICE LINES */
                if (invoiceLine.voidedItems && invoiceLine.voidedItems.length > 0) {
                    for (let index = 0; index < invoiceLine.voidedItems.length; index++) {

                        const element = invoiceLine.voidedItems[index];
                        const voidItem = new InvoiceLine();
                        voidItem.ParseJson(element)
                        voidItem.voidFrom =    invoiceLine.id
                        voidItem.invoiceId = invoice.id
                        voidItem.discountType = invoiceLine.discountType;
                        voidItem.branchId = invoice.branchId

                        await this.addInvoiceLine(client, voidItem, invoice, afterDecimal)
                    }
                }
                /**INSERT LINE subItems ITEMS AS INVOICE LINES */
                if (invoiceLine.subItems && invoiceLine.subItems.length > 0) {
                    for (let index = 0; index < invoiceLine.subItems.length; index++) {
                        const subItems = invoiceLine.subItems[index];
                        const subItem = new InvoiceLine();
                        subItem.ParseJson(subItems)
                        subItem.invoiceId = invoice.id
                        subItem.branchId = invoice.branchId
                        subItem.branchId = invoice.branchId
                        subItem.parentId = invoiceLine.id
                        await this.addInvoiceLine(client, subItem, invoice, afterDecimal)
                    }
                }
                // /**INSERT LINE Options */
                // if (invoiceLine.options && invoiceLine.options.length > 0) {
                //     for (let index = 0; index < invoiceLine.options.length; index++) {
                //         const option = invoiceLine.options[index];
                //         const isOptionIdExist = await this.checkIfInvoiceLineOptionIdExist(client, option.id, invoiceLine.id)
                //         if (isOptionIdExist) {
                //             await this.editLineOptions(client, option)
                //         } else {
                //             await this.addLineOptions(client, option)
                //         }

                //     }
                // }
            }
            
            
            await SocketInvoiceRepo.sendCallCenterInvoice(client, invoice.branchId, invoice.id)

            return new ResponseData(true, "Updated Successfully", { invoice: invoice })

        } catch (error: any) {
            console.log(error)
          
            console.log(error)

            throw new Error(error.message)
        }
    }

    public static async addInvoiceLine(client: PoolClient, invoiceLine: InvoiceLine, invoice: Invoice, afterDecimal: number) {
        try {
            
            invoiceLine.invoiceId = invoice.id;
            invoiceLine.branchId  = invoice.branchId;

            /**CONVERT LINE DATES TO DATE FORMAT */
            invoiceLine.createdAt   = await TimeHelper.convertToDate(invoiceLine.createdAt)
            invoiceLine.serviceDate = await TimeHelper.convertToDate(invoiceLine.serviceDate)
            invoiceLine.holdTime  = invoiceLine.holdTime  ? await TimeHelper.convertToDate(invoiceLine.holdTime)  : null
            invoiceLine.printTime = invoiceLine.printTime ? await TimeHelper.convertToDate(invoiceLine.printTime) : null
            invoiceLine.readyTime = invoiceLine.readyTime ? await TimeHelper.convertToDate(invoiceLine.readyTime) : null

            /**SET LINE ACCOUNT ID TO DEFAULT SALES ACCOUNT */
            const accountId = (await AccountsRepo.getSalesId(client, invoice.branchId)).id;
            invoiceLine.accountId = accountId
            

            /**SET lINE PRODUCT COMMISSION */
            if (invoiceLine.productId != null && invoiceLine.productId != "" && invoiceLine.salesEmployeeId != null && invoiceLine.salesEmployeeId != "") {
                const productCommission = await ProductRepo.getProductCommission(client, invoiceLine.productId);
                if(productCommission)
                {
                    invoiceLine.commissionPercentage = productCommission.commissionPercentage;
                    invoiceLine.commissionAmount = productCommission.commissionAmount;
                }
        
            }
            

        

            /** TO SET  mergeWith TO INVOICEID TO CURRENT INVOICEID  */
            // if (invoice.mergeWith != null && invoice.mergeWith != "") {
            //     await this.updateInvoiceLineMergeWith(client, invoiceLine.id, invoiceLine.invoiceId)
            // }

            if(invoiceLine.id == ""){
              invoiceLine.id =   await this.insertInvoiceLine(client, invoiceLine, invoice, afterDecimal);
                if (invoiceLine.priceOfferType == "buyDownPrice" && invoiceLine.productId) {
                    await SocketInvoiceRepo.updateBuyDownPrice(client, invoiceLine.productId, invoice.branchId, invoiceLine.qty)
                }
            }else{
                const isLineIdExist = await SocketInvoiceRepo.checkIfInvoiceLineIdExist(client, invoiceLine.id, invoiceLine.invoiceId)
                if (isLineIdExist) {
                    await SocketInvoiceRepo.editInvoiceLine(client, invoiceLine, invoice, afterDecimal)
                } else {
                    await this.insertInvoiceLine(client, invoiceLine, invoice, afterDecimal);
                    if (invoiceLine.priceOfferType == "buyDownPrice" && invoiceLine.productId) {
                        await SocketInvoiceRepo.updateBuyDownPrice(client, invoiceLine.productId, invoice.branchId, invoiceLine.qty)
                    }
                }
            }
            
            return    invoiceLine.id;


        } catch (error: any) {
          
            console.log(error)
       
            throw new Error(error.message)
        }
    }

    public static async insertInvoiceLine(client: PoolClient, invoiceLine: InvoiceLine, invoice: Invoice, afterDecimal: number) {
        try {

            if (invoiceLine.productId != null && invoiceLine.productId != "" && invoiceLine.salesEmployeeId != null && invoiceLine.salesEmployeeId != "") {
                const productCommission = await ProductRepo.getProductCommission(client, invoiceLine.productId);
                if(productCommission)
                {
                    invoiceLine.commissionPercentage = productCommission.commissionPercentage;
                    invoiceLine.commissionAmount = productCommission.commissionAmount;
                }
    
            }
            invoiceLine.calculateTotal(afterDecimal);



            if (invoiceLine.productId != null && invoiceLine.productId != "" && invoice.status != "Draft" && !invoiceLine.waste) {
                await InvoiceInventoryMovmentRepo.addInventoryMovment(client, invoiceLine, invoice, invoiceLine.qty, afterDecimal);
            }
            

            const query : { text: string, values: any } = {
                text: `INSERT INTO "InvoiceLines"(  
                                                        "invoiceId",
                                                            total,
                                                            price,
                                                            qty,
                                                            "productId",
                                                            "employeeId",
                                                            serial,
                                                            batch,
                                                            "parentId",
                                                            "seatNumber",
                                                            "salesEmployeeId",
                                                            "serviceDate",
                                                            "serviceDuration",
                                                            note,
                                                            "accountId",
                                                            "discountAmount" ,
                                                            "discountPercentage",
                                                            "subTotal",
                                                            "discountTotal",
                                                            "commissionPercentage",
                                                            "commissionAmount",
                                                            "taxId",
                                                            "createdAt",
                                                            "commissionTotal",
                                                            "voidFrom",
                                                            "taxTotal",
                                                            "waste",
                                                            taxes,
                                                            "taxType",
                                                            "taxPercentage",
                                                            "isInclusiveTax",
                                                            "holdTime",
                                                            "printTime",
                                                            "readyTime",
                                                            "voidReason",
                                                            "defaultPrice",
                                                            "priceOfferType",
                                                            "recipe",
                                                        "discountType"
                                                       ,
                                                        "branchId",
                                                        "companyId") 
                VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41) RETURNING id`,
                values: [
                invoiceLine.invoiceId,
                invoiceLine.total,
                invoiceLine.price,
                invoiceLine.qty,
                invoiceLine.productId,
                invoiceLine.employeeId,
                invoiceLine.serial,
                invoiceLine.batch,
                invoiceLine.parentId,
                invoiceLine.seatNumber,
                invoiceLine.salesEmployeeId,
                invoiceLine.serviceDate,
                invoiceLine.serviceDuration,
                invoiceLine.note,
                invoiceLine.accountId,
                invoiceLine.discountAmount,
                invoiceLine.discountPercentage,
                invoiceLine.subTotal,
                invoiceLine.discountTotal,
                invoiceLine.commissionPercentage,
                invoiceLine.commissionAmount,
                invoiceLine.taxId,
                invoiceLine.createdAt,
                invoiceLine.commissionTotal,
                invoiceLine.voidFrom,
                invoiceLine.taxTotal,
                invoiceLine.waste,
                JSON.stringify(invoiceLine.taxes),
                invoiceLine.taxType,
                invoiceLine.taxPercentage,
                invoiceLine.isInclusiveTax,
                invoiceLine.holdTime,
                invoiceLine.printTime,
                invoiceLine.readyTime,
                invoiceLine.voidReason,
                invoiceLine.defaultPrice,
                invoiceLine.priceOfferType,
                JSON.stringify(invoiceLine.recipe),
                invoiceLine.discountType,
                invoiceLine.branchId,
                invoiceLine.companyId
     
             
                ]
            }


            const insertInvoiceLine = await client.query(query.text, query.values);
            invoiceLine.id = (<any>insertInvoiceLine.rows[0]).id

            /**INSERT LINE Options */
            if (invoiceLine.options && invoiceLine.options.length > 0) {
                for (let index = 0; index < invoiceLine.options.length; index++) {
                    const option = invoiceLine.options[index];
                    option.invoiceLineId = invoiceLine.id;
                    if(option.id == ""){
                        await this.insertLineOption(client, option,  invoice, invoiceLine, afterDecimal)
                    }else{
                        const isOptionIdExist =  await SocketInvoiceRepo.checkIfInvoiceLineOptionIdExist(client, option.id, invoiceLine.id)
                        if (isOptionIdExist) {
                            await this.updateLineOption(client, option,  invoice, invoiceLine, afterDecimal, invoiceLine.qty)
                        } else {
                            await  this.insertLineOption(client, option,  invoice, invoiceLine, afterDecimal)
                        }
                    }
                }
            }
            return     invoiceLine.id 
        } catch (error: any) {
          
            
            console.log(error)
            throw new Error(error.message)
        }
    }

    

    private static async insertLineOption(client: PoolClient, invoiceLineOptions: InvoiceLineOption, invoice: Invoice, invoiceLine: InvoiceLine, afterDecimal: number) {
        try {
            if ((invoice.currentInvoiceStatus == "Draft" && invoice.status == "Open") || (invoiceLine.qty < 0)) {

                if (invoiceLineOptions.optionId != null && invoiceLineOptions.optionId != "" && invoice.status == "Open" && !invoiceLine.waste) {

                    await InvoiceInventoryMovmentRepo.calculateOptionMovment(client, invoiceLineOptions, invoiceLine, invoice, afterDecimal);
                }
            }
            const query: { text: string, values: any } = {
                text: `INSERT INTO "InvoiceLineOptions" ( "invoiceLineId",
                                                                      price,
                                                                      qty,
                                                                      note,
                                                                      "optionId",
                                                                      "optionGroupId",
                                                                      "recipe") 
                                                   VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id `,
                values: [invoiceLineOptions.invoiceLineId,
                invoiceLineOptions.price,
                invoiceLineOptions.qty,
                invoiceLineOptions.note,
                invoiceLineOptions.optionId,
                invoiceLineOptions.optionGroupId,
                JSON.stringify(invoiceLineOptions.recipe)]
            }

            const insert = await client.query(query.text, query.values)
            invoiceLineOptions.id = (<any>insert.rows[0]).id
            return new ResponseData(true, "Added Successfully", { id: invoiceLineOptions.id })
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }
    private static async updateLineOption(client: PoolClient, invoiceLineOptions: InvoiceLineOption, invoice: Invoice, invoiceLine: InvoiceLine, afterDecimal: number, oldLineQty: number) {
        try {
            const query: { text: string, values: any } = {
                text: `UPDATE  "InvoiceLineOptions" SET price = $1 ,qty=$2,note=$3 WHERE id = $4 `,
                values: [invoiceLineOptions.price, invoiceLineOptions.qty, invoiceLineOptions.note, invoiceLineOptions.id]
            }

            const update = await client.query(query.text, query.values)
            if ((invoice.currentInvoiceStatus == "Draft" && invoice.status == "Open") || (oldLineQty != invoiceLine.qty)) {
                if (invoiceLineOptions.optionId != null && invoiceLineOptions.optionId != "" && invoice.status == "Open" && !invoiceLine.waste) {
                    await InvoiceInventoryMovmentRepo.calculateOptionMovment(client, invoiceLineOptions, invoiceLine, invoice, afterDecimal);
                }
            }


            if (invoiceLineOptions.recipe && invoiceLineOptions.recipe.length > 0) {
                query.text = `UPDATE "InvoiceLineOptions" SET "recipe" =$1 where id =$2`,
                    query.values = [JSON.stringify(invoiceLineOptions.recipe), invoiceLineOptions.id]
            }
            await client.query(query.text, query.values);
            return new ResponseData(true, "Updated Successfully", [])
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }


    // public static async getFullInvoice( client: PoolClient, invoiceId: string, company : Company) {
    
    //     try {

    //         console.log("getFullInvoice")
    //         const query : { text: string, values: any } = {
    //             text: `SELECT "Invoices".id,
    //                         "Invoices"."invoiceNumber",
    //                         "Invoices"."refrenceNumber",
    //                         "Invoices"."total",
    //                         "Invoices"."note",
    //                         "Invoices"."guests",
    //                         "Invoices"."branchId",
    //                         "Invoices"."employeeId",
    //                         "Invoices"."tableId",
    //                         CAST  ("Invoices"."createdAt" AS TEXT)AS "createdAt",
    //                         "Invoices"."source",
    //                         "Invoices"."serviceId",
    //                         "Invoices"."customerId",
    //                         "Invoices"."customerAddress",
    //                         "Invoices"."customerContact",
    //                         "Invoices"."customerLatLang",
    //                         "Invoices"."discountId",
    //                         "Invoices"."discountAmount",
    //                         "Invoices"."discountPercentage",
    //                         "Invoices"."estimateId",
    //                         "Invoices"."status",
    //                         "Invoices"."draft",
    //                         "Invoices"."charges",
    //                         "Invoices"."discountTotal",
    //                         "Invoices"."chargeId",
    //                         "Invoices"."chargeAmount",
    //                         "Invoices"."chargePercentage",
    //                         "Invoices"."chargeTotal",
    //                         "Invoices"."subTotal",
    //                         "Invoices"."deliveryCharge",
    //                         "Invoices"."printTime",
    //                         "Invoices"."readyTime",
    //                         "Invoices"."departureTime",
    //                         "Invoices"."arrivalTime",
    //                         "Invoices"."scheduleTime",
    //                         "Invoices"."mergeWith",
    //                         ("Invoices"."invoiceDate"::text),
    //                         ("Invoices"."updatedDate"::text),
    //                         "Invoices"."terminalId",
    //                         "Invoices"."roundingType",
    //                         "Invoices"."roundingTotal",
    //                         "Invoices"."smallestCurrency",
    //                         "Invoices"."isInclusiveTax",
    //                         "Invoices"."driverId",
    //                         "Invoices"."onlineData",
                            
    //                         FROM "Invoices" where id = $1`,
    //             values: [invoiceId]
    //         }

    //         //get Invoice
    //         let invoiceData = (await client.query(query.text, query.values)).rows[0];
    //         let invoice = new Invoice();
    //         invoice.ParseJson(invoiceData);

    //         //get customer               
    //         if (invoice.customerId != null && invoice.customerId != "") {
    //             query.text = `SELECT  id, name 
    //                     FROM "Customers" where id =$1 `,
    //             query.values = [invoice.customerId]
    //             let customerInfo = (await client.query(query.text, query.values)).rows[0];
    //             if (customerInfo) invoice.customer = customerInfo ;
    //         }
            

    //         //get employee
    //         if (invoice.employeeId != null && invoice.employeeId != "") {
    //             query.text = `SELECT  id, name 
    //                         FROM "Employees" where id =$1 `,
    //             query.values = [invoice.employeeId]
    //             let employeeInfo = (await client.query(query.text, query.values));
    //             if (employeeInfo.rows.length > 0) invoice.employee = employeeInfo.rows[0] ;
    //         }

    //         //get driver
    //         if (invoice.driverId != null && invoice.driverId != "") {
    //             query.text = `SELECT  id, name 
    //                         FROM "Employees" where id =$1 `,
    //             query.values = [invoice.driverId]
    //             let driverInfo = (await client.query(query.text, query.values));
    //             if (driverInfo.rows.length > 0) invoice.driver = driverInfo.rows[0] ;
    //         }

    //         //get service
    //         let serviceInfo ;
    //         if (invoice.serviceId != null && invoice.serviceId != "") {
    //             query.text = `SELECT  id, name , type
    //                         FROM "Services" where id =$1 `,
    //             query.values = [ invoice.serviceId]
    //             serviceInfo = (await client.query(query.text, query.values));
    //             if (serviceInfo.rows.length  >0) invoice.service = serviceInfo.rows[0] ;
    //         }

    //         //get table
    //         let tableInfo;
    //         if (invoice.tableId != null && invoice.tableId != "") {
    //             query.text = `SELECT  id, name , properties
    //                         FROM "Tables" where id =$1 `,
    //             query.values = [ invoice.tableId]
    //             let tableInfo = (await client.query(query.text, query.values))
    //             if (tableInfo.rows.length > 0) invoice.table = tableInfo.rows[0] ;
    //         }


    //         //get Invoice Lines
    //         query.text = `SELECT  id,
    //                             "invoiceId",
    //                             total,
    //                             price,
    //                             qty, 
    //                             "productId",
    //                             "employeeId",
    //                             batch,
    //                             serial,
    //                             ("createdAt"::text),
    //                             "parentId",
    //                             "seatNumber",
    //                             "salesEmployeeId",
    //                             ("serviceDate"::text),
    //                             "serviceDuration",
    //                             "discountId",
    //                             "discountAmount",
    //                             "discountPercentage",
    //                             note,
    //                             status,
    //                             "accountId",
    //                             "subTotal",
    //                             "discountTotal",
    //                             "commissionPercentage",
    //                             "commissionAmount",
    //                             "taxId",
    //                             "commissionTotal",
    //                             "voidFrom",
    //                             "taxTotal",
    //                             waste,
    //                             taxes,
    //                             "taxType",
    //                             "taxPercentage",
    //                             "isInclusiveTax",
    //                             "defaultPrice",
    //                             "holdTime",
    //                             "printTime",
    //                             "readyTime",
    //                             "voidReason",
    //                             "priceOfferType",
    //                             recipe,
    //                             cost 
    //                             FROM "InvoiceLines" where "invoiceId" =$1 
    //                             Order By "InvoiceLines"."createdAt" asc`

    //         query.values = [invoice.id]
    //         let invoicelines = (await client.query(query.text, query.values)).rows;
            
    //         for (let index = 0; index < invoicelines.length; index++) {
    //             const line = invoicelines[index];
    //             const temp = new InvoiceLine();
    //             temp.ParseJson(line);

    //             query.text = `SELECT * FROM "InvoiceLineOptions" where "invoiceLineId" =$1`;
    //             query.values = [line.id];

    //             let options = await client.query(query.text, query.values);
    //             temp.options = options.rows;


    //             query.text = `Select "invoiceId",
    //                         "CreditNoteLines"."invoiceLineId",
    //                         Sum("CreditNoteLines".qty) as qty, 
    //                         Sum("CreditNoteLines".total) as total
    //                         from "CreditNotes" JOIN "CreditNoteLines" On "CreditNotes".id = "CreditNoteLines"."creditNoteId" 
    //                         where "invoiceId" = $1 and "CreditNoteLines"."invoiceLineId" =$2
    //                         Group By "invoiceId", "CreditNoteLines"."invoiceLineId"`
    //             query.values = [invoiceId, line.id];

    //             let returnLines = await client.query(query.text, query.values);
    //             temp.returnItems = returnLines.rows;



    //             query.text = `SELECT  id, name , type
    //                         FROM "Products" where id =$1 `,
    //                 query.values = [line.productId]
    //             let prodInfo = await client.query(query.text, query.values);
    //             temp.product = prodInfo.rows[0];
    //             temp.productName = prodInfo.rows[0].name;

    //             invoice.lines.push(temp);
    //         }

            
    //     //get Payment Information
    //         query.text = `Select "InvoicePaymentLines".id, 
    //                                 "InvoicePayments".id as "invoicePaymentId", 
    //                                 "invoiceId",
    //                                 rate, 
    //                                 "InvoicePaymentLines".amount / rate as amount ,
    //                                 "InvoicePayments"."tenderAmount", 
    //                                 "InvoicePayments"."changeAmount",
    //                                 "paymentMethodId",
    //                                 (select "PaymentMethods".name  from "PaymentMethods" where"PaymentMethods".id = "InvoicePayments"."paymentMethodId") ,                            
    //                                 "employeeId",
    //                                 "cashierId",
    //                                 "InvoicePaymentLines"."createdAt" 
    //                                 from "InvoicePayments" JOIN "InvoicePaymentLines" On "InvoicePayments".id = "InvoicePaymentLines"."invoicePaymentId" 
    //                                 where "invoiceId"= $1`

    //         query.values = [invoiceId];

    //         let payments = await client.query(query.text, query.values)
        
    //         invoice.invoicePayments = payments.rows;


    //         //get Return Lines
    //         // query.text = `Select "invoiceId",
    //         //                 "CreditNoteLines"."invoiceLineId",
    //         //                 Sum("CreditNoteLines".qty) as qty, 
    //         //                 Sum("CreditNoteLines".total) as total
    //         //                 from "CreditNotes" JOIN "CreditNoteLines" On "CreditNotes".id = "CreditNoteLines"."creditNoteId" 
    //         //                 where "invoiceId" = $1
    //         //                 Group By "invoiceId", "CreditNoteLines"."invoiceLineId"`

    //         // query.values = [invoiceId];

    //         // let returnLines = (await client.query(query.text, query.values)).rows
        
    //         // let temp : InvoiceLine | undefined;
    //         // for (let element of returnLines) {
    //         //   temp = invoice.lines.find((f) => f.id == element.invoiceLineId);
    //         //   if (temp != null) {
    //         //     temp.returnItems.push(element);
    //         //   }
    //         // }
        
    //         invoice.branchName = await BranchesRepo.getBranchName(invoice.branchId);
    //         invoice.employeeName = await EmployeeRepo.getEmployeeName(invoice.employeeId);

    
        
    //         return  new ResponseData(true, "", invoice);
    //     } catch (error: any) {
    //         console.log(error)
    //       

    //         throw new Error(error)
    //     }
    // }

    
    public static async getFullInvoice(client: PoolClient, invoiceId: string, company: Company) {
        try {
          // Step 1: Load Invoice
          const invoiceRes = await client.query(`
            SELECT i.*, 
            i."onlineData"->>'callCenterStatus' as "callCenterStatus",
            json_build_object('id', c.id, 'name', c.name) as "customer",
            json_build_object('id', e.id, 'name', e.name) as "employee",
            json_build_object('id', s.id, 'name', s.name) as "service",
            b.id as "branchId", b.name as "branchName"
            FROM "Invoices" i
             LEFT JOIN "Customers" c ON i."customerId" = c.id
            LEFT JOIN "Employees" e ON i."employeeId" = e.id
            LEFT JOIN "Branches" b ON i."branchId" = b.id
            LEFT JOIN "Services" s ON i."serviceId" = s.id
            WHERE i.id = $1
          `, [invoiceId]);
    
          const invoiceRow = invoiceRes.rows[0];
          if (!invoiceRow) throw new Error('Invoice not found');
    
          const invoice = new Invoice();
          invoice.ParseJson(invoiceRow);
    
          // Step 2: Load Invoice Lines
          const linesRes = await client.query(`
            SELECT * FROM "InvoiceLines"
            WHERE "invoiceId" = $1
            ORDER BY "createdAt" ASC
          `, [invoice.id]);
          const invoiceLines = linesRes.rows;
    
          // Collect unique IDs
          const productIds = new Set<string>();
          const invoiceLineIds = new Set<string>();
    
          invoiceLines.forEach(line => {
            productIds.add(line.productId);
            invoiceLineIds.add(line.id);
          });
    
          // Step 3: Bulk load Products
          const productsRes = await client.query(
            `SELECT id, name, type FROM "Products" WHERE id = ANY($1)`,
            [Array.from(productIds)]
          );
          const productMap = new Map(productsRes.rows.map(p => [p.id, p]));
    
          // Step 4: Bulk load Line Options
          const optionsRes = await client.query(
            `SELECT "InvoiceLineOptions".*, 
                case when  "InvoiceLineOptions"."optionId" is not null then   json_build_object('id', "Options".id, 'name', "Options".name, 'optionGroupId', "OptionGroups".id, 'optionGroupName', "OptionGroups".title )  end as "option"
              FROM "InvoiceLineOptions"
             left join "Options" on "Options".id = "InvoiceLineOptions"."optionId"
              left join "OptionGroups" on "OptionGroups".id =   "InvoiceLineOptions"."optionGroupId"
             WHERE "invoiceLineId" = ANY($1)`,
            [Array.from(invoiceLineIds)]
          );
          const optionsMap = new Map<string, any[]>();
          optionsRes.rows.forEach(option => {
            if (!optionsMap.has(option.invoiceLineId)) optionsMap.set(option.invoiceLineId, []);
            optionsMap.get(option.invoiceLineId)!.push(option);
          });
    
          // Step 5: Bulk load CreditNoteLines
          const returnLinesRes = await client.query(`
            SELECT "invoiceId", "CreditNoteLines"."invoiceLineId", SUM("CreditNoteLines".qty) as qty, SUM("CreditNoteLines".total) as total
            FROM "CreditNotes"
            JOIN "CreditNoteLines" ON "CreditNotes".id = "CreditNoteLines"."creditNoteId"
            WHERE "invoiceId" = $1 AND "CreditNoteLines"."invoiceLineId" = ANY($2)
            GROUP BY "invoiceId", "CreditNoteLines"."invoiceLineId"
          `, [invoiceId, Array.from(invoiceLineIds)]);
          const returnMap = new Map<string, any>();
          returnLinesRes.rows.forEach(ret => returnMap.set(ret.invoiceLineId, ret));
    
          // Step 6: Build InvoiceLines
          invoice.lines = invoiceLines.map(rawLine => {
            const line = new InvoiceLine();
            line.ParseJson(rawLine);
            line.options = optionsMap.get(rawLine.id) || [];
            line.returnItems = returnMap.get(rawLine.id) ? [returnMap.get(rawLine.id)] : [];
            const prod = productMap.get(rawLine.productId);
            if (prod) {
              line.product = prod;
              line.productName = prod.name;
            }
            return line;
          });
    
          // Step 7: Attach subItems and voidedItems
          const byId = new Map(invoice.lines.map(l => [l.id, l]));
          invoice.lines = invoice.lines.filter(line => {
            if (line.parentId) {
              const parent = byId.get(line.parentId);
              if (parent) parent.subItems.push(line);
              return false;
            }
            if (line.voidFrom) {
              const voided = byId.get(line.voidFrom);
              if (voided) voided.voidedItems.push(line);
              return false;
            }
            return true;
          });
    
          // Step 8: Payment Info
          const paymentsRes = await client.query(`
            SELECT IPL.id, IP.id as "invoicePaymentId", IPL."invoiceId", IPL.amount / IP.rate as amount,
                   PM.name as "paymentMethodName", IP."tenderAmount", IP."changeAmount",
                   IP."paymentMethodId", IP."employeeId", IP."cashierId", IPL."createdAt"
            FROM "InvoicePayments" IP
            JOIN "InvoicePaymentLines" IPL ON IP.id = IPL."invoicePaymentId"
            LEFT JOIN "PaymentMethods" PM ON PM.id = IP."paymentMethodId"
            WHERE IPL."invoiceId" = $1
          `, [invoiceId]);
    
          invoice.invoicePayments = paymentsRes.rows;
    
          // Step 9: Related Entities (employee, branch)
          invoice.branchName = await BranchesRepo.getBranchName(invoice.branchId);
          invoice.employeeName = await EmployeeRepo.getEmployeeName(invoice.employeeId);
    
          return new ResponseData(true, '', invoice);
        } catch (err:any) {
            throw new Error(err)
        }
      }



}


// public static async saveInvoice(client: PoolClient, data: any, branchId: string) {
    
//     const dBClient = await DB.excu.client();

//     const companyId = (await BranchesRepo.getBranchCompanyId(client,branchId)).compayId;
//     try {

//         await dBClient.query("BEGIN")

//         if (data) {
//             data = JSON.parse(data);
//         }
//         console.log("saveInvoice")

//         const invoices = data;

//         for (let index = 0; index < invoices.length; index++) {
//             const element = invoices[index];
//             element.branchId = branchId; //SET INVOICE BRANCHID

//             /**BECAUSE THE TIME RECIVED IS TIMESTAMP 
//              * CONVERT IT TO DATE FORMAT */
//             element.createdAt = await TimeHelper.convertToDate(element.createdAt)
//             element.invoiceDate = await TimeHelper.convertToDate(element.invoiceDate)



//             const isInvoiceIdExist = await SocketInvoiceRepo.checkIfInvoiceIdExist(dBClient,element.id, element.branchId, element.createdAt)
//             if (isInvoiceIdExist) { /**Invoice id exist edit invoice */
               
//                 //if invoice has a payment or more
//                 element.isPaid = await SocketInvoiceRepo.isInvoicePaid(dBClient, element.id)
//                 element.status = (element.isPaid) ? "Closed" : "Open"
                
//                 await SocketInvoiceRepo.editInvoice(dBClient, element, companyId)

//             } else {
//                 element.source = "CallCenter" 
//                 await SocketInvoiceRepo.addInvoice(dBClient, element, companyId)
//             }
//         }

//         await dBClient.query("COMMIT")
//         //callback(JSON.stringify({ success: true }))

//         /**REFERESH INVENTORY + JOURNAL VIEW */
//         const queue = ViewQueue.getQueue();
//         queue.pushJob()

//         return true
//     } catch (error: any) {
//         await dBClient.query("ROLLBACK")
//       
//         console.log(error)
//         return false
//         //callback(JSON.stringify({ success: false, error: error }))
//     } finally {
//         dBClient.release()
//     }
// }