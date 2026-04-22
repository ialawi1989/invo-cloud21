import { DB } from "@src/dbconnection/dbconnection";
import { Company } from "@src/models/admin/company";
import { ResponseData } from "@src/models/ResponseData";
import { FileStorage } from "@src/utilts/fileStorage";
import { sign, verify } from 'jsonwebtoken'
import { InvoiceRepo } from "../app/accounts/invoice.repo";
import { PoolClient } from "pg";
import { Invoice } from "@src/models/account/Invoice";
import { PaymentRepo } from "../ecommerce/pament.repo";
import { PaymnetMethodRepo } from "../app/accounts/paymentMethod.repo";
import { InvoiceLine } from "@src/models/account/InvoiceLine";

import { ApplePay } from "@src/paymentGateways/applePay";
import { CompanyRepo } from "../admin/company.repo";

export class EinvoiceRepo {


    public static async getCompanySettings(data: any) {
        try {
            const invoiceId = data.invoiceId;

            const query = {
                text: `with "branch" as (
                            select "branchId" from "Invoices" where id =$1
                            ), "company" as(

                            select "Companies".name, 
                            "Companies".id, 
                                    "Companies"."country",
                                    "Companies"."invoiceTemplate",
                                    "Companies"."invoiceOptions",
                                    "Media"."url" as "mediaUrl"
                                from "branch" 
                            inner join "Branches" on "branch"."branchId" = "Branches".id 
                            inner join "Companies" on "Companies"."id" = "Branches"."companyId"
                            left join "Media" on "Companies"."mediaId" = "Media".id
                            )


                            select * from "company"`,
                values: [invoiceId]
            }

            let fetchData = await DB.excu.query(query.text, query.values);
            let companyData = fetchData && fetchData.rows.length > 0 ? fetchData.rows[0] : {}
            let company = new Company();
            company.ParseJson(companyData);
            const storage = new FileStorage();
            const companySettings = await storage.getCompanySettings(company.country)
            if (companySettings) {
                company.settings = companySettings.settings;
            }
            const accessToken = (await this.generateAccessToken({
                invoiceId: invoiceId,
                company: {
                    id: company.id,
                    afterDecimal: company.settings.afterDecimal
                }

            })).accessToken;

            let resData = {
                company: company,
                accessToken: accessToken
            }
            return new ResponseData(true, "", resData)
        } catch (error: any) {
            throw new Error(error)
        }


    }

    public static async generateAccessToken(data: any) {
        try {
            const maxAge = process.env.EINVOICE_ACCESS_TOKEN_MAXAGE ?? '7h';
            const accessToken = sign(data, process.env.ACCESS_TOKEN_SECRET as string, {
                expiresIn: maxAge
            });

            return { accessToken: accessToken }

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async authenticateToken(accessToken: any) {
        try {

            const verified = verify(accessToken, process.env.ACCESS_TOKEN_SECRET as string,
                (err: any, decoded: any) => {
                    if (err) {

                        // Wrong Refesh Token
                        return new ResponseData(false, "Unauthorized", [])
                    }
                    else {
                        // Correct token we send a new access token
                        return new ResponseData(true, "", decoded)
                    }
                });

            return verified

        } catch (error: any) {
            return new ResponseData(false, "Unauthorized", [])
        }
    }

    public static async getInvoice(invoiceId: string, company: Company) {
        try {

            let invoice = await InvoiceRepo.getInvoiceById(invoiceId, company);
            return invoice
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getInvoiceBalance(client: PoolClient, invoiceId: string) {
        try {
            const balance = (await InvoiceRepo.getInvoiceBalance(client, invoiceId));
            if (balance.data && balance.data.balance) {
                return balance.data.balance
            }
            throw new Error("Invoice Not Found")
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async payInvoice(data: any, company: Company) {
        const client = await DB.excu.client()
        try {
            const invoiceId = data.invoiceId;
            const paymentName = data.paymentName


            let invoice = (await this.getInvoiceById(client, invoiceId, company)).data;
            await client.query("BEGIN")
            invoice.total = invoice.balance;
            if (invoice.total < 0) {
                throw new Error("Invoice Balance is less than 0")
            }
            invoice.countryCode = invoice.countryCode ?? company.settings.contryCode
            invoice.applePayTokendata = data.applePayTokendata
            let paymentData = (await PaymnetMethodRepo.getPaymentMethodSettings(client, company.id, paymentName)).data.paymentMethod
            let resault = await PaymentRepo.addPayments(client, paymentData, invoice, company, true)


            await client.query("COMMIT")
            return resault

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async getInvoiceById(client: PoolClient, invoiceId: string, company: Company) {

        try {
            const companyId = company.id;


            const afterDecimal = company.afterDecimal
            const query: { text: string, values: any } = {
                text: `
                with "invo" as ( SELECT 
                "Invoices".id,
                "Invoices"."customerLatLang",
                "Invoices"."customerAddress",
                "Invoices"."customerContact",
                "Invoices"."customerId",
                "Invoices"."employeeId",
                "Invoices"."branchId",
                "Invoices". guests,
                "Invoices".charges,
                "Invoices"."invoiceNumber",
                "Invoices". note,
                "Invoices". "refrenceNumber", 
                "Invoices"."serviceId",
                "Invoices".source,
                "Customers".name as "customerName",
				"Employees".name as "employeeName",
                "Branches".name as "branchName",
                "Branches"."phoneNumber" as "branchPhone",
                "Branches"."customFields" as "branchCustomFields",
                "Invoices". "tableId",
                "Invoices".total,
                "Invoices".status,
                          "Invoices"."chargeType",
                "Invoices"."discountTotal",
                "Invoices"."chargeTotal",
                "Invoices"."chargeAmount",
                "Invoices"."chargePercentage",
                "Invoices"."chargeId",
                "Invoices"."discountAmount",
                "Invoices"."discountPercentage",
                "Invoices"."discountId",
                "Invoices"."deliveryCharge",
                "Invoices"."subTotal",
                "Invoices"."onlineData",
                   "Invoices"."receivableAccountId",
                   "Branches"."address" as "branchAddress",
               CAST( "Invoices"."invoiceDate"::DATE AS TEXT) AS "invoiceDate",
                "Invoices"."estimateId",
                ("Invoices"."createdAt" ::text),
                "Invoices"."roundingType",
                "Invoices"."roundingTotal",
                "Invoices"."smallestCurrency",
                "Invoices"."mediaId",
                "Invoices"."paymentTerm",
                "Invoices"."dueDate",
                "Invoices"."mergeWith",
                "Invoices"."salesEmployeeId",
                "Invoices"."customFields",
                "Invoices"."discountType",
                "Invoices"."customerSignature",
                    "Invoices"."discountType",
                   "Invoices"."chargeType",
                   "TableGroups"."name" as "tableGroupName",
             case when NULLIF(("Invoices"."chargesTaxDetails"->>'taxId'),'')::uuid is not null then JSON_BUILD_OBJECT('taxId',"Invoices"."chargesTaxDetails"->>'taxId',
							   'taxName',"Taxes".name,
							   'taxPercentage',CAST("Invoices"."chargesTaxDetails"->>'taxPercentage' AS FLOAT),
							   'taxAmount',CAST("Invoices"."chargesTaxDetails"->>'taxAmount' AS FLOAT),
							   'taxes',("Invoices"."chargesTaxDetails"->>'taxes')::jsonb,
                               'type', ("Invoices"."chargesTaxDetails"->>'type')
							  ) end "chargesTaxDetails",
                "salesEmployee".name as "salesEmployeeName",
                "mergeWithInvoice"."invoiceNumber" as "mergeWithInvoiceNumber",
                    case when  "Invoices"."attachment" = 'null' then  null else  (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',COALESCE("Media"."url"->>'downloadUrl',"Media"."url"->>'defaultUrl'),'mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("Invoices"."attachment") as attachments(attachments)
                inner join "Media" on "Media".id = (attachments->>'id')::uuid
                ) end as  "attachment",
                "Invoices"."isInclusiveTax",
                "Services".name as "serviceName",
                "Tables".name as "tableName",
                "Companies"."vatNumber" as "companyVatNumber",
                "Customers"."vatNumber" as "customerVatNumber",
                "Customers"."phone" as "customerPhone",
                "Customers"."email" as "customerEmail"
				FROM "Invoices"
                inner join "Branches"on "Branches".id = "Invoices"."branchId"
                LEFT JOIN "Customers" on  "Customers".id = "Invoices"."customerId"
                LEFT JOIN "Media" on "Invoices"."mediaId" = "Media".id 
                LEFT JOIN "Employees"on "Employees".id = "Invoices"."employeeId"
				inner join "Companies"on  "Companies".id = "Branches"."companyId"
                left join "Services" on "Services".id = "Invoices"."serviceId"
			    left join "Invoices" "mergeWithInvoice" on  "mergeWithInvoice".id =   "Invoices"."mergeWith" 
                left join "Taxes" on "Taxes".id =      NULLIF(("Invoices"."chargesTaxDetails"->>'taxId'),'')::uuid 
                left join "Employees" "salesEmployee" on  "salesEmployee".id =   "Invoices"."salesEmployeeId" 
                LEFT JOIN "Tables" on "Tables".id = "Invoices"."tableId"
                LEFT JOIN "TableGroups" on "TableGroups".id = "Tables"."tableGroupId"
				where "Invoices".id = $1
			   and "Branches"."companyId"  = $2
			   )
			    ,"creditNotes" as (
				select  "invo".id ,Json_agg("CreditNotes".id) as "creditNote", sum("CreditNotes"."total"::text::numeric) as "total" from "invo" 
				inner join "CreditNotes" on "CreditNotes"."invoiceId" = "invo".id
				group by  "invo".id 
				), "appliedCredit" as (
				select  "invo".id, sum("AppliedCredits"."amount"::text::numeric)  as "total" from "invo" 
				inner join "AppliedCredits" on "AppliedCredits"."invoiceId" = "invo".id
				group by  "invo".id 
				),"paymnets" as (
						select  "invo".id, sum("InvoicePaymentLines"."amount"::text::numeric) as "total" from "invo" 
				inner join "InvoicePaymentLines" on "InvoicePaymentLines"."invoiceId" = "invo".id
                inner join "InvoicePayments" on "InvoicePayments".id = "InvoicePaymentLines"."invoicePaymentId"
                where "InvoicePayments".status = 'SUCCESS'
				group by  "invo".id 
				), "refunds" as (
					select  "invo".id , sum("CreditNoteRefunds"."total"::text::numeric) as "total" from "invo" 
				inner join "CreditNotes" on "CreditNotes"."invoiceId" = "invo".id
				inner join "CreditNoteRefunds" on "CreditNoteRefunds"."creditNoteId" =  "CreditNotes".id
				group by  "invo".id 
				)
				
				SELECT "invo".*,
				      COALESCE( "creditNotes"."total",0)::float as "creditNoteTotal" ,      
				        COALESCE("appliedCredit"."total",0)::float as "appliedCreditTotal",      
				        COALESCE("paymnets"."total",0)::float as "paymentTotal",      
				       COALESCE( "refunds"."total",0)::float as "refundTotal"     
				FROM "invo"
				left join "creditNotes"  on "creditNotes".id = "invo"."id"
				left join "appliedCredit"  on "appliedCredit".id = "invo"."id"
				left join "paymnets"  on "paymnets".id = "invo"."id"
				left join "refunds"  on "refunds".id = "invo"."id"
				
                 `,
                values: [invoiceId, companyId]
            }



            const invoiceData = await client.query(query.text, query.values);
            const invoice = new Invoice();
            invoice.ParseJson(invoiceData.rows[0]);
            if (invoice.id != "" && invoice.id != null) {
                query.text = `with "lines" as (

                    SELECT 
                                                "Products".name as "productName",
                                                "Products".type AS "productType",
                                                "InvoiceLines".id,
                                                "InvoiceLines".total,
                                                "InvoiceLines".price,
                                                "InvoiceLines".qty ,
                                                sum("CreditNoteLines".qty) as "returnedQty",
                                                "InvoiceLines"."accountId",
                                                "InvoiceLines"."productId" ,
                                                "InvoiceLines"."salesEmployeeId" ,
                                                "InvoiceLines"."discountAmount",
                                                "InvoiceLines"."taxId",
                                                "InvoiceLines".batch,
                                                "InvoiceLines"."discountId",
                                                "InvoiceLines".serial,
                                                "InvoiceLines".note,
                                                "InvoiceLines".index,
                                                "InvoiceLines"."discountId",
                                                "InvoiceLines"."discountPerQty",
                                                "InvoiceLines"."discountPercentage",
                                                "InvoiceLines"."discountTotal",
                                                    CAST( "InvoiceLines"."createdAt" as text ) as "createdAt",
                                                "InvoiceLines"."parentId",
                                                "InvoiceLines"."voidFrom",
                                             (  select
											   JSON_AGG(JSON_BUILD_OBJECT('taxId',"taxId",
                                                            'taxName',"taxName",
                                                            'taxPercentage',"taxPercentage",
                                                            'taxAmount',"taxAmount",
                                                            'taxes',"taxes",
                                                     
                                                            'index', "index"
                                                            ))
	                                           from (select 
                                                   
                                                    el->>'taxId' as "taxId",
												    "Taxes".name as "taxName",
												    CAST(el->>'taxPercentage' AS FLOAT) as "taxPercentage",
												    CAST(el->>'taxAmount' AS FLOAT) as "taxAmount",
												    el->>'taxes' as "taxes",
												  ( ROW_NUMBER() over() -1)  as "index"
                                                    from JSONB_ARRAY_ELEMENTS( "InvoiceLines"."taxes") el 
                                                    inner join "Taxes" on "Taxes".id = NULLIF(NULLIF(el->>'taxId', ''), 'null')::uuid and  "InvoiceLines"."taxes" <> 'null' 
                                                    )t)	as "taxes",
                                                    "InvoiceLines".waste,
                                                "InvoiceLines"."taxType",
                                                "InvoiceLines"."taxPercentage",
                                                "Products"."UOM",
                                                "Products"."barcode",
                                                 "Accounts".name as "accountName",
                                               
                                                 "Taxes".name as "taxName",
                                                CASE WHEN COUNT("CreditNoteLines"."invoiceLineId") > 0 THEN true ELSE false END as "isReturned"
                                                FROM "InvoiceLines" 
                                                LEFT JOIN "Products"  ON  "Products".id =  "InvoiceLines"."productId"
                                                LEFT JOIN "Taxes"  ON  "Taxes".id =  "InvoiceLines"."taxId"
                                                LEFT JOIN  "CreditNoteLines" ON "CreditNoteLines"."invoiceLineId"= "InvoiceLines".id
                                                INNER JOIN "Accounts" ON "Accounts".id = "InvoiceLines"."accountId"
                                                WHERE "InvoiceLines"."invoiceId"=$1
                                                group by  "Products".id , "InvoiceLines".id , "Accounts".name,  "Taxes".name 
                    ),"options" as (
                    SELECT 
                    "InvoiceLineOptions"."invoiceLineId",
                    JSON_AGG(json_build_object('id',"InvoiceLineOptions".id,'optionId',"InvoiceLineOptions"."optionId",'qty',"InvoiceLineOptions".qty,'price',"InvoiceLineOptions".price,'note',"InvoiceLineOptions".note,'optionName',"Options".name, 'optionGroupId',"InvoiceLineOptions"."optionGroupId",'optionGroupName',"OptionGroups".title)) as "options"
                    FROM "InvoiceLineOptions"
                    LEFT JOIN "Options" on "Options".id =   "InvoiceLineOptions"."optionId"
                    LEFT JOIN "OptionGroups" on "OptionGroups"."id" =   "InvoiceLineOptions"."optionGroupId"
                    inner join "lines" ON lines.id = "InvoiceLineOptions"."invoiceLineId"  
                        group by "InvoiceLineOptions"."invoiceLineId"
                    )
                    
                    select  "lines".*,"options"."options" from "lines" 
                    left join "options" on "options"."invoiceLineId" =  "lines".id
                    order by  "lines".index ASC , "lines"."createdAt" desc
                    
                    
                              `


                query.values = [invoiceId];

                const lineData = await client.query(query.text, [invoiceId])
                const lines = lineData.rows;
                for (let index = 0; index < lines.length; index++) {
                    const lineData = lines[index];
                    const line = new InvoiceLine();
                    line.isInclusiveTax = invoice.isInclusiveTax;
                    line.ParseJson(lineData);
                    line.selectedItem.id = lineData.productId; /** for front use */
                    line.selectedItem.name = lineData.productName;
                    line.selectedItem.type = lineData.productType;
                    line.selectedItem.barcode = lineData.barcode;
                    // query.text = `SELECT "InvoiceLineOptions".id,"InvoiceLineOptions"."optionId","InvoiceLineOptions".qty,"InvoiceLineOptions".price,"InvoiceLineOptions".note,"Options".name as"optionName" FROM "InvoiceLineOptions"
                    //          LEFT JOIN "Options" on "Options".id =   "InvoiceLineOptions"."optionId"
                    //         WHERE "invoiceLineId"=$1`
                    // query.values = [line.id]
                    // const optionData = await client.query(query.text, query.values);
                    // const option: any = optionData.rows[0]
                    // if (option) {
                    //     line.options = optionData.rows
                    // }

                    invoice.lines.push(line);
                }


                let parentLine: InvoiceLine | undefined;
                invoice.lines.filter(f => f.parentId != null).forEach(element => {

                    parentLine = invoice.lines.find(f => f.id == element.parentId);

                    if (parentLine != null) {
                        parentLine!.subItems.push(element);
                        invoice.lines.splice(invoice.lines.indexOf(element), 1);
                    }
                });

                invoice.lines.filter(f => f.voidFrom != null).forEach(element => {
                    parentLine = invoice.lines.find(f => f.id == element.voidFrom);
                    if (parentLine != null) {
                        parentLine!.voidedItems.push(element);
                        invoice.lines.splice(invoice.lines.indexOf(element), 1);
                    }
                });

                invoice.calculateTotal(afterDecimal);
                invoice.calaculateBalance();
                invoice.setTaxesDetails()
                query.text = `SELECT "InvoicePayments".id,
                "InvoicePayments"."referenceNumber",
                                 "InvoicePayments".rate,
                                "InvoicePaymentLines".amount,
                                CASE WHEN "InvoicePayments"."status" = 'FAILD' THEN 'FAILED' ELSE "InvoicePayments"."status" END  AS "status" ,
                                "PaymentMethods".name as "paymentMethodName",
                               CAST( "InvoicePaymentLines"."createdAt" AS TEXT),
                               (select json_agg( json_build_object('id',"Media".id,'size',"Media".size,'mediaUrl',"Media"."url"->>'defaultUrl','mediaType',"Media"."mediaType",'mediaName',"Media"."name")) from jsonb_array_elements("InvoicePayments"."attachment") as attachments(attachments)
                               inner join "Media" on "Media".id = (attachments->>'id')::uuid
                               ) as "attachment"
                          from "InvoicePayments"
                          inner join "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId"= "InvoicePayments".id 
                          inner join "PaymentMethods" on "PaymentMethods".id = "InvoicePayments"."paymentMethodId" 
                          LEFT JOIN "Media" ON "Media".id = "InvoicePayments"."mediaId" 
                          where "InvoicePaymentLines"."invoiceId" = $1
                           AND( "InvoicePayments"."status" = 'SUCCESS' OR "InvoicePayments"."status" = 'FAILD')
                           
                     `

                query.values = [invoiceId];

                let payments = await client.query(query.text, query.values)
                invoice.invoicePayments = payments.rows;
            }

            return new ResponseData(true, "", invoice);
        } catch (error: any) {

          

            throw new Error(error.message)
        }
    }


    public static async ValidateApplePay(companyId: string, data: any) {

        try {
            const url = data.validationURL
            const company = (await CompanyRepo.getMiniCompany(companyId));
            let validate;
            if (company) {
                await DB.transaction(async (client: PoolClient) => {

                    const payment = (await PaymnetMethodRepo.getPaymentMethodSettings(client, companyId, "ApplePay")).data
                    if (payment) {
                        validate = await ApplePay.MerchantValidation(company, url, payment)

                    }

                })

                return validate
            }
            return new ResponseData(false, "company not found", [])

        } catch (error) {
            throw error
        }
    }
}