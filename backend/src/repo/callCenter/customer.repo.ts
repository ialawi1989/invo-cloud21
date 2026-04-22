import { DB } from "@src/dbconnection/dbconnection";
import { Customer } from "@src/models/account/Customer";
import { ResponseData } from "@src/models/ResponseData";
import { CustomerValidation } from "@src/validationSchema/account/customer.Schema";




import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { SocketCustomerRepo } from "@src/repo/socket/customer.socket";
import { Company } from "@src/models/admin/company";
import { PoolClient } from "pg";
import { ValidationException } from "@src/utilts/Exception";

export class CustomerRepo {

    public static async checkIfCustomerPhoneExist(client: PoolClient, id: string | null, phone: string, companyId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `select count(*) as qty from "Customers" where  "companyId" = $1 and ("phone" = $2 or "mobile" = $2)`,
                values: [companyId, phone],
            }
            if (id != null) {
                query.text = `select count(*) as qty from "Customers" where   "companyId" = $1 and id <>$2 and ("phone" = $3 or "mobile" = $3) `
                query.values = [companyId, id, phone]
            }

            let customer = await client.query(query.text, query.values);

            if (customer.rows[0].qty > 0) {
                return true;
            } else {
                return false;
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async checkIfCustomerExists(phone: string, companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT id,"addresses"  from "Customers"where "phone"=$1 and "companyId"=$2`,
                values: [phone, companyId]
            }
            // eslint-disable-next-line prefer-const
            let customer = await DB.excu.query(query.text, query.values);
            if (customer.rowCount != null && customer.rowCount > 0) {
                return { id: (<any>customer.rows[0]).id, addresses: (<any>customer.rows[0]).addresses };
            }

            return null;
        } catch (error: any) {

          
            throw new Error(error)
        }
    }
    public static async addCustomer(client: PoolClient, data: any, company: Company) {
        try {
            const companyId = company.id
            const validate = await CustomerValidation.customerValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            const customer = new Customer();
            customer.ParseJson(data);
            customer.companyId = companyId;
            customer.updatedAt = new Date();

            /** validate customer phone if exist  */
            const isPhoneExist = await this.checkIfCustomerPhoneExist(client, null, customer.phone, company.id)
            if (isPhoneExist) {
                throw new ValidationException("A customer with phone: " + customer.phone + ' Already Exist')
            }
            const query: { text: string, values: any } = {
                text: `INSERT INTO "Customers"
                                  (saluation,name,phone,mobile,email,addresses,"companyId","birthDay",notes,"MSR","priceLabelId","discountAmount","vatNumber","updatedAt","currencyId")
                       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)RETURNING id`,
                values: [customer.saluation,
                customer.name,
                customer.phone,
                customer.mobile,
                customer.email,
                JSON.stringify(customer.addresses),
                customer.companyId,
                customer.birthDay,
                JSON.stringify(customer.notes),
                customer.MSR,
                customer.priceLabelId,
                customer.discountAmount,
                customer.vatNumber,

                customer.updatedAt,
                customer.currencyId
                ]
            }

            const insert = await client.query(query.text, query.values);
            customer.id = (<any>insert.rows[0]).id
            if (customer.openingBalance != null && Array.isArray(customer.openingBalance)) {
                for (let index = 0; index < customer.openingBalance.length; index++) {
                    const element: any = customer.openingBalance[index];
                    if (element.branchId != null && element.branchId != '') {
                        query.text = `INSERT INTO "CustomerOpeningBalance" ("customerId","branchId","companyId","openingBalance") VALUES($1,$2,$3,$4)`
                        query.values = [customer.id, element.branchId, companyId, element.openingBalance]
                        await client.query(query.text, query.values)
                    }

                }
            }
            const branchIds = await BranchesRepo.getCompanyBranchIds(client, companyId)
            await SocketCustomerRepo.sendNewCustomer(client,branchIds, customer)
            return new ResponseData(true, "Added Successfully",  customer )
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async editCustomer(client: PoolClient, data: any, company: Company) {
        try {
            const companyId = company.id
            const validate = await CustomerValidation.customerValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            const customer = new Customer();
            customer.ParseJson(data);
            customer.companyId = companyId;

            /** validate customer phone if exist  */
            const isPhoneExist = await this.checkIfCustomerPhoneExist(client, customer.id, customer.phone, company.id)
            if (isPhoneExist) {
                throw new ValidationException("A customer with phone: " + customer.phone + 'already exist')
            }
            if (customer.id == null || customer.id == "") {
                throw new ValidationException("Customer Id is Required");
            }
            customer.updatedAt = new Date();
            const query: { text: string, values: any } = {
                text: `UPDATE "Customers" SET 
                                    saluation=$1,
                                    name=$2,
                                    phone=$3,
                                    mobile=$4,
                                    emaiL=$5,
                                    addresses=$6,
                                    "birthDay"=$7,
                                    notes=$8,
                                    "MSR"=$9,
                                    "discountAmount"=$10,
                                    "priceLabelId"=$11,
                                    "vatNumber"=$12,
                                    "updatedAt" = $13,
                                    "currencyId" =$14

                            WHERE id = $15
                            AND "companyId"=$16`,
                values: [customer.saluation,
                customer.name,
                customer.phone,
                customer.mobile,
                customer.email,
                JSON.stringify(customer.addresses),
                customer.birthDay,
                JSON.stringify(customer.notes),
                customer.MSR,
                customer.discountAmount,
                customer.priceLabelId,
                customer.vatNumber,
                customer.updatedAt,
                customer.currencyId,
                customer.id,
                customer.companyId]
            }

            const insert = await client.query(query.text, query.values);


            const branchIds = await BranchesRepo.getCompanyBranchIds(client, companyId)
            await SocketCustomerRepo.sendUpdatedCustomer(client,branchIds, customer)

            return new ResponseData(true, "Updated Successfully", customer)

        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getSuggestion(data: any, company: Company) {
        try {
            const search = data.search;

            const query : { text: string, values: any } = {
                text: `SELECT cu.id, cu.name, cu.phone,cu.mobile
                FROM "Customers" cu 
                join "Companies" c  on cu."companyId"  = c.id  
                WHERE c.id = $1
                AND (cu."phone" LIKE '%' || $2 || '%' OR cu."mobile" LIKE '%' || $2 || '%')
                ORDER BY (CASE WHEN cu."phone" LIKE '%' || $2 || '%' THEN 1 ELSE 0 END) + (CASE WHEN cu."mobile" LIKE '%' || $2 || '%' THEN 1 ELSE 0 END) DESC limit 10`,
                values: [company.id, search]
            }
            

            const list = await DB.excu.query(query.text, query.values);


            return new ResponseData(true, "Successfully", list.rows)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getCustomerById(customerId: string, company: Company) {
        try {
            let companyId = company.id
            const query : { text: string, values: any } = {
                text: `SELECT * 
                       FROM "Customers" 
                       WHERE id = $1 and "companyId" = $2`,
                values: [customerId, companyId]
            }
      
            const list = await DB.excu.query(query.text, query.values);
            if(list.rows.length == 0 )  {return new ResponseData(false, "No customer with this Id",null)}


            const temp = new Customer();
            temp.ParseJson(list.rows[0])
            return new ResponseData(true, "Customer Information", temp)

        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getBranchByCustomerAddress(data: any, company: Company, brancheList :[]) {
        try {
            let companyId = company.id
            let branches = brancheList??[]
            const query : { text: string, values: any } = {
                text: `select t."branchId",t."addresses",t.name,t.type
                from (
                    select "Branches".id as "branchId" ,
                    name,
                    "coveredAddresses"->>'type' as "type",
                    jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'address'as "addresses" 
                    from "Branches" 
                where "companyId" = $1
                and( array_length(($2::uuid[]),1) IS NULL OR "Branches".id = any( ($2::uuid[])))
                group by "Branches".id )t `,
                values: [companyId, branches]
            }
      
            const list = (await DB.excu.query(query.text, query.values)).rows;
    
            

           let b = list.filter((f:any)=> (data.address.map((a:any) => String(a[f.type.toLowerCase()]).toLowerCase()).includes(String(f.addresses).toLowerCase())))

            return new ResponseData(true, "Brunches: ", b )

        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getCustomerByNumber(number: string, company: Company, brancheList :[]) {
        try {
    
            let companyId = company.id
            const query : { text: string, values: any } = {
                text: `SELECT 
                    id,
                    saluation,
                    name,
                    phone,
                    mobile,
                    email,
                    addresses,
                    "companyId",
                    notes,
                    "MSR",
                    ("birthDay"::text),
                    ("createdAt"::text),
                    ("updatedAt"::text),
                    "priceLabelId",
                    "discountAmount",
                    "companyGroupId",
                    "vatNumber",
                    "openingBalance",
                    "customergroups"
                 FROM "Customers"  WHERE "companyId" = $2 and (phone = $1 or mobile = $1)`,
                values: [number, companyId]
            }
      
            const list = await DB.excu.query(query.text, query.values);

            if(list.rows.length == 0 )  {return new ResponseData(false, "No customer with this number",null)}
            
            const temp = new Customer();
            temp.ParseJson(list.rows[0])

            return new ResponseData(true, "Customer Information", temp)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }



    

    public static async getCustomerCredit(customerId: string | null, company: Company) {
        try {

            const companyId = company.id;

            const afterDecimal = company.afterDecimal
            const query : { text: string, values: any } = {
                text: ` 
                SELECT SUM(  T."customerCredit") as "customerCredit" FROM(        
                    SELECT
                              (sum ( "CreditNotes".total)::numeric -(COALESCE(sum( "AppliedCredits".amount)::numeric,0)+COALESCE( sum(  "CreditNoteRefunds".total)::numeric,0)))
                               -("Invoices".total::numeric - sum ( "InvoicePaymentLines".amount)::numeric)  as "customerCredit"
                               FROM "CreditNotes"
                               LEFT JOIN "Invoices"
                               on "Invoices".id = "CreditNotes"."invoiceId"
                               left join "InvoicePaymentLines"
                               on "InvoicePaymentLines"."invoiceId" =  "Invoices".id
                               left join "Customers" 
                               on "Invoices"."customerId" =  "Customers".id 
                               left join "CreditNoteRefunds"
                               on "CreditNoteRefunds"."creditNoteId" = "CreditNotes".id 
                               left join "AppliedCredits"
                               on "AppliedCredits"."creditNoteId" = "CreditNotes".id 
                               where "Customers".id =$1 and "companyId" = $2
                               group by "Invoices".id,"InvoicePaymentLines".id,"CreditNotes".id,"CreditNoteRefunds".id,"AppliedCredits".id,  "Customers".id
                                having      (sum ( "CreditNotes".total)::numeric -(COALESCE(sum( "AppliedCredits".amount)::numeric,0)+COALESCE( sum(  "CreditNoteRefunds".total)::numeric,0)))
                               -("Invoices".total::numeric - sum ( "InvoicePaymentLines".amount)::numeric)>0
                                   
                                   
                                   union all
                                   
                    select 
                                                    
                                   "InvoicePayments"."tenderAmount" - COALESCE(sum ("InvoicePaymentLines".amount),0) as "customerCredit"
                                   from "Customers"
                                   left join "InvoicePayments" 
                                   on "InvoicePayments"."customerId" = "Customers".id 
                                   left join "InvoicePaymentLines"
                                   on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id
                                   where "Customers".id =$1 and "companyId" = $2
                                   group by "InvoicePayments".id,"Customers".id,   "InvoicePaymentLines".id
                                   
                                   having "InvoicePayments"."tenderAmount" > COALESCE(sum ("InvoicePaymentLines".amount),0)
                    )T
        `,
                values: [customerId,companyId]
            }
            let credit = 0;

            const customer = await DB.excu.query(query.text, query.values);

            if ((customer.rowCount != null && customer.rowCount > 0) && (<any>customer.rows[0]).customerCredit) {
                credit = ((<any>customer.rows[0]).customerCredit).toFixed(afterDecimal)
            }

            return new ResponseData(true, "", { credit: Number(credit) })
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async getCustomerOutStandingReceivable(customerId: string) {
        try {


            const query : { text: string, values: any } = {
                text: `select  COALESCE(SUM(t."outStandingRecivables"),0) as "outStandingRecivables" from 
                ( select 
                        ( "Invoices".total -   
                       ( SUM(COALESCE("CreditNotes".total,0)) +SUM(COALESCE("AppliedCredits".amount,0)) +  SUM(COALESCE("InvoicePaymentLines".amount,0))) ) as "outStandingRecivables"
                from "Customers"
                left join "Invoices" 
                on  "Invoices"."customerId" = "Customers".id 
                left join "CreditNotes" 
                on  "Invoices".id =  "CreditNotes"."invoiceId"
                left join "InvoicePaymentLines"
                on  "Invoices".id =  "InvoicePaymentLines"."invoiceId"
                left join "AppliedCredits"
                on  "Invoices".id =  "AppliedCredits"."invoiceId"
                where  "Customers".id =$1
                and "Invoices".draft = false 
                group by  "Invoices".id
                HAVING  ( "Invoices".total -   
                       ( SUM(COALESCE("CreditNotes".total,0)) +SUM(COALESCE("AppliedCredits".amount,0)) +  SUM(COALESCE("InvoicePaymentLines".amount,0))) )>0
        )t`,
                values: [customerId]
            }

            const receivable = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", { outStandingRecivables: (<any>receivable.rows[0]).outStandingRecivables })
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    /**
     * Customer Dashboard
     * GET SUMMARY OF CUSTOMER TRANSACTIONS
     * Outstanding recievable,
     * Unused Credit,
     * 
     * summary customer sales for giving period 
     */
    public static async getCustmerOverView(data: any, company: Company) {
        try {
            const customerId = data.customerId;
            const companyId = company.id;
            const interval = data.interval
            const from = interval.from;
            const to = interval.to;

            const query : { text: string, values: any } = {
                text: `SELECT SUM("Invoices".total) as total,"Invoices"."invoiceDate" as "createdAt" FROM "Invoices" 
                            WHERE "Invoices"."customerId" =$1 and "companyId" = $4
                            and "Invoices"."invoiceDate">=$2
                            and "Invoices"."invoiceDate"<=$3
                            group by "Invoices"."invoiceDate"
                            ORDER BY "Invoices"."invoiceDate" ASC`,
                values: [customerId, from, to, companyId ]
            }

            const summary = await DB.excu.query(query.text, query.values);
            const customerCredit = await this.getCustomerCredit(customerId, company)
            const outStandingRecivables = await this.getCustomerOutStandingReceivable(customerId)
            const resData = {
                summary: summary.rows,
                unusedCredit: customerCredit.data.credit,
                outStandingRecivable: outStandingRecivables.data.outStandingRecivables
            }
            return new ResponseData(true, "", resData)


        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async getCustomerInvoiceTransactions(data: any) {
        try {
            let offset = 0;
            let count = 0;
            const customerId = data.customerId;
            let pageCount = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }

            const countQuery = {
                text: `SELECT COUNT(*) 
                       FROM "Invoices" 
                      where "Invoices"."customerId" =$1`,
                values: [customerId]
            }

            const countData = await DB.excu.query(countQuery.text, countQuery.values);
            count = (<any>countData.rows[0]).count;
            pageCount = Math.ceil(count / data.limit)
            const query : { text: string, values: any } = {
                text: `select 
                "Invoices"."invoiceNumber",
                "Invoices".id,
                "Invoices".total, 
                COALESCE(sum("AppliedCredits".amount),0)+ COALESCE(sum("InvoicePaymentLines".amount),0) as "paidAmount",
                "Invoices".total - (COALESCE(sum("AppliedCredits".amount),0)+ COALESCE(sum("InvoicePaymentLines".amount),0)) as "balance"
                from "Invoices"
                LEFT JOIN "InvoicePaymentLines" 
                ON "InvoicePaymentLines"."invoiceId" = "Invoices".id
                LEFT JOIN "AppliedCredits" 
                ON "AppliedCredits"."invoiceId" = "Invoices".id
                where "Invoices"."customerId" =$1
                group by "Invoices".id
                offset $2
                limit $3`,
                values: [customerId, offset, limit]
            }
            const customerInvoices = await DB.excu.query(query.text, query.values);
            offset += 1;
            let lastIndex = ((data.page) * data.limit)
            if (customerInvoices.rows.length < data.limit || data.page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: customerInvoices.rows,
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
    public static async getCustomerEstimateTransactions(data: any) {
        try {
            let offset = 0;
            let count = 0;
            const customerId = data.customerId;
            let pageCount = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }

            const countQuery = {
                text: `SELECT COUNT(*) 
                       FROM "Estimates" 
                      where "Estimates"."customerId" =$1`,
                values: [customerId]
            }

            const countData = await DB.excu.query(countQuery.text, countQuery.values);
            count = (<any>countData.rows[0]).count;
            pageCount = Math.ceil(count / data.limit)
            const query : { text: string, values: any } = {
                text: `select 
                "Estimates"."estimateNumber",
                "Estimates".id,
                "Estimates".total
                from "Estimates"
                where "Estimates"."customerId" =$1
                offset $2
                limit $3`,
                values: [customerId, offset, limit]
            }
            const customerEstimates = await DB.excu.query(query.text, query.values);
            offset += 1;
            let lastIndex = ((data.page) * data.limit)
            if (customerEstimates.rows.length < data.limit || data.page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: customerEstimates.rows,
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
    public static async getCustomerCreditNoteTransactions(data: any) {
        try {
            let offset = 0;
            let count = 0;
            const customerId = data.customerId;
            let pageCount = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }

            const countQuery = {
                text: `SELECT COUNT(*) 
                       FROM "CreditNotes" 
                       INNER JOIN "Invoices"
                       ON "Invoices".id = "CreditNotes"."invoiceId"
                      where "Invoices"."customerId" =$1`,
                values: [customerId]
            }

            const countData = await DB.excu.query(countQuery.text, countQuery.values);
            count = (<any>countData.rows[0]).count;
            pageCount = Math.ceil(count / data.limit)
            const query : { text: string, values: any } = {
                text: `select 
                "CreditNotes"."creditNoteNumber",
                "CreditNotes".id,
                "CreditNotes".total
                FROM "CreditNotes" 
                INNER JOIN "Invoices"
                ON "Invoices".id = "CreditNotes"."invoiceId"
               where "Invoices"."customerId" =$1
               offset $2
               limit $3
               `,
                values: [customerId, offset, limit]
            }
            const customerCreditNotes = await DB.excu.query(query.text, query.values);
            offset += 1;
            let lastIndex = ((data.page) * data.limit)
            if (customerCreditNotes.rows.length < data.limit || data.page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: customerCreditNotes.rows,
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
    public static async getCustomerPaymentTransactions(data: any) {
        try {
            let offset = 0;
            let count = 0;
            const customerId = data.customerId;
            let pageCount = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }

            const countQuery = {
                text: `SELECT COUNT(*) 
                       FROM "InvoicePayments" 
                      where "InvoicePayments"."customerId" =$1`,
                values: [customerId]
            }

            const countData = await DB.excu.query(countQuery.text, countQuery.values);
            count = (<any>countData.rows[0]).count;
            pageCount = Math.ceil(count / data.limit)
            const query : { text: string, values: any } = {
                text: `select 
                'Customer Payment' as code,
                "InvoicePayments".id,
                "InvoicePayments"."tenderAmount",
                "InvoicePayments"."paidAmount" 
                FROM "InvoicePayments" 
               where "InvoicePayments"."customerId" =$1
               offset $2
               limit $3
               `,
                values: [customerId, offset, limit]
            }
            const customerPayments = await DB.excu.query(query.text, query.values);
            offset += 1;
            let lastIndex = ((data.page) * data.limit)
            if (customerPayments.rows.length < data.limit || data.page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: customerPayments.rows,
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

    /**Add Ecommerce Customers
     * if customer exist
     * update customer addresses if new Address where added by the customer
     */
    public static async addEcommerceCustomer(client: PoolClient, customerId: string | null, customer: any, company: Company, comanyGroupId:string ) {
        try {
            let customerAddresses: any[] = [];

            if (customer && (customerId == "" || customerId == null)) {
                let customerData = (await CustomerRepo.checkIfCustomerExists(customer.phone, company.id))
                if (customerData) {
                    customerAddresses = customerData.addresses;
                    customerId = customerData.id;

                    if (customerAddresses && customerAddresses != undefined && customer.address && customer.address != null) {
                        let indexofAddress = customerAddresses.indexOf(customer.address)
                        if (indexofAddress == -1 && JSON.stringify(customer.address) != '{}' && customer.address != null && customer.address != "") {
                            customerAddresses.push(customer.address)
                        }

                    }

                    await this.setCustomerAddress(client, customerAddresses, customerId)

                } else if (customer && customer.phone != null && customer.phone != "") {
                    let customerTemp = new Customer()
                    customerTemp.ParseJson(customer);
                    if (JSON.stringify(customer.address) != '{}' && customer.address != null && customer.address != "") {
                        customerTemp.addresses.push(customer.address)
                    }
                    customerId = (await CustomerRepo.addCustomer(client, customerTemp, company)).data.id;
                }


            } else {
                if (customer && customer.address && customerId) {
                    customerAddresses = await this.getCustomerAddress(customerId)
                    let indexofAddress = customerAddresses.indexOf(customer.address)
                    if (indexofAddress == -1 && JSON.stringify(customer.address) != '{}' && customer.address != null && customer.address != "") {
                        customerAddresses.push(customer.address)
                    }
                    await this.setCustomerAddress(client, customerAddresses, customerId)
                }

            }
            return customerId;

        } catch (error: any) {
          
            throw new Error(error)
        }
    }
    public static async getCustomerAddress(customerId: string) {
        try {
            const query : { text: string, values: any } = {
                text: `SELECT addresses from "Customers" where id = $1 `,
                values: [customerId]
            }

            let customer = await DB.excu.query(query.text, query.values);
            return (<any>customer.rows[0]).addresses
        } catch (error: any) {
          
            throw new Error(error)
        }
    }
    public static async setCustomerAddress(client: PoolClient, addresses: any, customerId: string | null) {
        try {
            const query : { text: string, values: any } = {
                text: `Update "Customers" set addresses=$1 where id = $2 `,
                values: [JSON.stringify(addresses), customerId]
            }

            await client.query(query.text, query.values);
            return new ResponseData(true, "", [])
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    ///SOCKET
   
    public static async addPosCustomer(client:PoolClient,data: any, companyId: string) {

        try {
            const validate = await CustomerValidation.customerValidation(data);
            if (!validate.valid) {
                throw new Error(validate.error);
            }

            await client.query("BEGIN")
            const customer = new Customer();
            customer.ParseJson(data);
            customer.companyId = companyId;
            const query : { text: string, values: any } = {
                text: `INSERT INTO "Customers"
                                  (id,saluation,name,phone,mobile,email,addresses,"companyId","birthDay",notes,"MSR")
                       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)RETURNING id`,
                values: [
                    customer.id,
                    customer.saluation,
                    customer.name,
                    customer.phone,
                    customer.mobile,
                    customer.email,
                    JSON.stringify(customer.addresses),
                    customer.companyId,
                    customer.birthDay,
                    JSON.stringify(customer.notes),
                    customer.MSR]
            }

            const insert = await client.query(query.text, query.values);
            customer.id = (<any>insert.rows[0]).id


            const branchIds = await BranchesRepo.getCompanyBranchIds(client,companyId)
            await SocketCustomerRepo.sendNewCustomer(client,branchIds, customer)
    

            return new ResponseData(true, "Added Successfully", { id: customer.id })
        } catch (error: any) {
        

          

            throw new Error(error.message)
        }
    }

    
    public static async getCutomerList(data: any, company: Company) {
        try {
            const companyId = company.id;
            let selectQuery;
            let selectValues;

            let countQuery;
            let countValues;


            let searchValue = '[A-Za-z0-9]*';
            let offset = 0;
            let sort: any;
            let sortValue;
            let sortDirection;
            let sortTerm;
            let count = 0;
            let pageCount = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }


            const selectText = `SELECT 
                                   id,
                                   name, 
                                   email,
                                   phone,
                                   saluation
            FROM "Customers"`

            const countText = `SELECT COUNT(*)
                             FROM "Customers"`

            let filterQuery = ` WHERE "Customers"."companyId" =$1`
            filterQuery += ` and (LOWER("Customers".name) ~ $2)`
            let orderByQuery = `Order By` + sortTerm



            const limitQuery = ` limit $3 offset $4`

            let selectCount;
            selectQuery = selectText + filterQuery
            selectValues = [companyId, searchValue]
            if (data != null && data != '' && JSON.stringify(data) != '{}') {

                sort = data.sortBy;
                sortValue = !sort ? '"createdAt"' : '"' + sort.sortValue + '"';
                sortDirection = !sort ? "DESC" : sort.sortDirection;
                sortTerm = sortValue + " " + sortDirection
                orderByQuery = ` Order by ` + sortTerm;
                if (data.searchTerm != "" && data.searchTerm != null) {
                    searchValue = `^.*` + data.searchTerm.toLowerCase() + `.*$`
                }
                selectQuery = selectText + filterQuery + orderByQuery + limitQuery
                selectValues = [companyId, searchValue, limit, offset]
                countQuery = countText + filterQuery
                countValues = [companyId, searchValue]
                selectCount = await DB.excu.query(countQuery, countValues)
                count = Number((<any>selectCount.rows[0]).count)
                pageCount = Math.ceil(count / data.limit)
            }
            const selectList: any = await DB.excu.query(selectQuery, selectValues)

            // for (let index = 0; index < selectList.rows.length; index++) {
            //     const element = selectList.rows[index];
            //     selectList.rows[index].outStandingRecivable = (await this.getCustomerOutStandingReceivable(element.id)).data.outStandingRecivables;
            // }

            offset += 1
            let lastIndex = ((data.page) * data.limit)
            if (selectList.rows.length < data.limit || data.page == pageCount) {
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
}