import { DB } from "@src/dbconnection/dbconnection";
import { Customer } from "@src/models/account/Customer";
import { ResponseData } from "@src/models/ResponseData";
import { CustomerValidation } from "@src/validationSchema/account/customer.Schema";
import { createObjectCsvWriter } from 'csv-writer';

import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { SocketCustomerRepo } from "@src/repo/socket/customer.socket";
import { Company } from "@src/models/admin/company";
import { PoolClient } from "pg";
import { ValidationException } from "@src/utilts/Exception";
import { isArray, uniq } from "lodash";
import { TimeHelper } from "@src/utilts/timeHelper";
import moment from "moment";
import { RedisClient } from '@src/redisClient';
import { ValidateReq } from "@src/validationSchema/validator";
import { Helper } from "@src/utilts/helper";
import { ReportData } from "@src/utilts/xlsxGenerator";
import xlsx from 'xlsx';
import { bool } from "aws-sdk/clients/signer";
import { exportHelper } from "@src/utilts/ExportHelper";
import format from "pg-format";
import { CustomerBalanceQueue } from "@src/repo/triggers/userBalancesQueue";
import { TriggerQueue } from "@src/repo/triggers/triggerQueue";
import { TableConfig, TableDataService, TableRequest } from "@src/utilts/TableDataService";
import { CustomizationRepo } from "../settings/Customization.repo";
import { Log } from "@src/models/log";
import { LogsManagmentRepo } from "../settings/LogSetting.repo";

export class CustomerRepo {

    public static async chekIfCustomerIdExists(client: PoolClient, customerId: string, companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT count(*) from "Customers" where id=$1 and "companyId" =$2 `,
                values: [customerId, companyId]
            }
            const customer = await client.query(query.text, query.values);

            if (customer.rows[0].count > 0) {
                return true
            } else {
                return false
            }
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

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
    public static async checkIfCustomerExists(phone: string, companyId: string, client: PoolClient | null = null) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT id,"addresses"  from "Customers"where ("phone"=$1 or "mobile" = $1)and "companyId"=$2`,
                values: [phone, companyId]
            }
            // eslint-disable-next-line prefer-const
            let customer = client ? await client.query(query.text, query.values) : await DB.excu.query(query.text, query.values);
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

            if (customer.type === 'Business') {
                if (!customer.contactName) throw new ValidationException("contactName name is required for Business Account.");
            } else { customer.contactName = null; customer.industry = null }

            // ################### subCustomer validations ###################
            if (customer.parentId) {
                if (customer.type === 'Individual') {
                    throw new ValidationException("Sorry.. only Business customer can be sub-customer.");
                }

                const parentData = (await this.getvalidationInfoForSubCustomer(customer.parentId, companyId)).data;

                if (!parentData?.id) {
                    throw new ValidationException("Parent customer does not exist.");
                }

                if (parentData.type !== 'Business') {
                    throw new ValidationException("Only Business customers can be parent customers.");
                }

                if (parentData.parentId) {
                    throw new ValidationException("Only one level of sub-customer is allowed.");
                }

            }
            // ###############################################################



            const query: { text: string, values: any } = {
                text: `INSERT INTO public."Customers"
                                  (saluation,name,"contactName", industry,  phone,mobile,email,addresses,"companyId","birthDay",notes,"MSR","priceLabelId","discountAmount","vatNumber","updatedAt","currencyId", "paymentTerm","customFields","oneSignalSegment","options", "type", "parentId", "creditLimit")
                       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19, $20, $21,$22, $23, $24)RETURNING id`,
                values: [customer.saluation,
                customer.name,
                customer.contactName,
                customer.industry,
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
                customer.currencyId,
                customer.paymentTerm,
                JSON.stringify(customer.customFields),
                customer.oneSignalSegment,
                customer.options,
                customer.type,
                customer.parentId,
                customer.creditLimit
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
            await SocketCustomerRepo.sendNewCustomer(client, branchIds, customer)
            return new ResponseData(true, "Added Successfully", { id: (<any>insert.rows[0]).id })
        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }
    public static async editCustomer(client: PoolClient, data: any, company: Company, employeeId?: string) {
        try {
            const companyId = company.id
            const validate = await CustomerValidation.customerValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            const customer = new Customer();
            customer.ParseJson(data);
            customer.companyId = companyId;


            let customerLogs: Log[] = [];
            /** validate customer phone if exist  */
            const isPhoneExist = await this.checkIfCustomerPhoneExist(client, customer.id, customer.phone, company.id)
            if (isPhoneExist) {
                throw new ValidationException("A customer with phone: " + customer.phone + 'already exist')
            }
            if (customer.id == null || customer.id == "") {
                throw new ValidationException("Customer Id is Required");
            }


            if (customer.type === 'Business') {
                if (!customer.contactName) throw new ValidationException("contactName name is required for Business Account.");
            } else { customer.contactName = null; customer.industry = null }

            // ################### type validations ###################
            customer.hasChild = await this.isParentCustomer(companyId, customer.id);
            if (customer.hasChild && customer.type !== 'Business') {
                throw new ValidationException(
                    "Cannot change the customer type. A customer with sub-customers must be of type 'Business'."
                );
            }

            // ################### subCustomer validations ###################
            if (customer.parentId == customer.id) { customer.parentId = null }
            if (customer.parentId) {
                if (customer.type === 'Individual') {
                    throw new ValidationException("Sorry.. only Business customer can be sub-customer.");
                }

                if (customer.hasChild) {
                    throw new ValidationException("A customer with children cannot be a sub-customer.");
                }

                const parentData = (await this.getvalidationInfoForSubCustomer(customer.parentId, companyId)).data;

                if (!parentData?.id) {
                    throw new ValidationException("Parent customer does not exist.");
                }

                if (parentData.type !== 'Business') {
                    throw new ValidationException("Only Business customers can be parent customers.");
                }

                if (parentData.parentId) {
                    throw new ValidationException("Only one level of sub-customer is allowed.");
                }


            }

            let oldDataResult = await this.getOldData(client, customer.id, company.id, customer.priceLabelId ?? null)
            let oldLimit = oldDataResult.creditLimit ? oldDataResult.creditLimit : 0

            let oldDiscount = oldDataResult.discountAmount ? oldDataResult.discountAmount : 0;
            let oldPriceLabel = oldDataResult.oldPriceId;
            let oldPriceLabelName = oldDataResult.oldPriceName;
            let priceLabelName = oldDataResult.newPriceName;


            // ###############################################################
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
                                    "currencyId" =$14,
                                    "paymentTerm"=$15,
                                    "customFields" = $16,
                                    "options" =$17, 
                                    "type" = $18,
                                    "parentId" = $19, 
                                    "contactName" = $20,
                                    "industry" = $21,
                                    "creditLimit" = $22

                            WHERE id = $23
                            AND "companyId"=$24`,
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
                customer.paymentTerm,
                JSON.stringify(customer.customFields),
                customer.options,
                customer.type,
                customer.parentId,
                customer.contactName,
                customer.industry,
                customer.creditLimit,
                customer.id,
                customer.companyId]
            }

            const insert = await client.query(query.text, query.values);

            let getEmployeeName = {
                text: `SELECT "Employees"."name" as "employeeName"
                  FROM "Employees"
                  WHERE "Employees".id = $1 and "Employees"."companyId" = $2
                        `,
                values: [employeeId, companyId]
            }
            let employeeName = (await client.query(getEmployeeName.text, getEmployeeName.values)).rows[0].employeeName;

            let customerCreditLimit
            customerCreditLimit = customer.creditLimit ? customer.creditLimit : 0
            if (oldLimit != customerCreditLimit) {

                Log.addLog(customerLogs, `${employeeName} changed the customer credit limit from (${oldLimit}) to (${customerCreditLimit})`, 'Customer Credit Limit Changed', employeeId ? employeeId : '', {
                    "customerId": customer.id,
                    "oldLimit": oldLimit,
                    "newLimit": customerCreditLimit,
                    "currency": company.currencySymbol
                })
            }

            if (oldDiscount != customer.discountAmount) {

                Log.addLog(customerLogs,
                    `${employeeName} has changed the customer Discount from (${oldDiscount}%) to (${customer.discountAmount}%)`,
                    'Customer Discount Changed',
                    employeeId ? employeeId : '',
                    {
                        "customerId": customer.id,
                        "oldDiscount": oldDiscount,
                        "newDiscount": customer.discountAmount
                    }
                )
            }


            if (oldPriceLabel != customer.priceLabelId) {
                let comment =
                    priceLabelName == null
                        ? `changed the customer (${customer.name}) price scheme (${oldPriceLabelName})`
                        : oldPriceLabelName != null
                            ? `changed the customer (${customer.name}) price scheme from (${oldPriceLabelName}) to (${priceLabelName})`
                            : `assigned the customer (${customer.name}) price scheme (${priceLabelName})`;
                
                Log.addLog(customerLogs,
                    `${employeeName} ${comment}`,
                    'Customer Price Scheme Changed',
                    employeeId ? employeeId : '',
                    {
                        "customerId": customer.id,
                        "customerName": customer.name,
                        ...(oldPriceLabelName != null && { "oldScheme": oldPriceLabelName }),
                        ...(priceLabelName != null && { "newScheme": priceLabelName })
                    }
                )

            }


            await this.setInvoiceLog(client, customer.id, customerLogs, null, company.id, employeeId ? employeeId : '', "", "Cloud");



            const branchIds = await BranchesRepo.getCompanyBranchIds(client, companyId)
            await SocketCustomerRepo.sendUpdatedCustomer(client, branchIds, customer)

            return new ResponseData(true, "Updated Successfully", [])

        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getOldData(client: PoolClient, customerId: string | null, companyId: string, priceLabelId: string | null) {
        try {
            const getData = {
                text: `SELECT "Customers"."creditLimit" , "Customers"."discountAmount", "oldPriceLabel".id as "oldPriceId", "oldPriceLabel"."name" as "oldPriceName",
                                "newPriceLabel".id as "newPriceId", "newPriceLabel"."name" as "newPriceName"
                        FROM "Customers" 
                        left join "PriceLabels" "oldPriceLabel" on "oldPriceLabel"."companyId" = $2 and "oldPriceLabel".id = "Customers"."priceLabelId"
                        left join "PriceLabels" "newPriceLabel" on "newPriceLabel"."companyId" = $2 and "newPriceLabel".id = $3
                        WHERE "Customers".id= $1`,
                values: [customerId, companyId, priceLabelId]
            }

            let oldData = (await client.query(getData.text, getData.values))
            return oldData.rows && oldData.rows.length > 0 && oldData.rows[0] ? oldData.rows[0] : null

        } catch (error: any) {
            throw new Error(error)
        }

    }

    public static async setInvoiceLog(client: PoolClient, customerId: string, logs: Log[], branchId: string | null, companyId: string, employeeId: string | null, Number: string | null, source: string) {
        try {
            await LogsManagmentRepo.manageLogs(client, "Customers", customerId, logs, branchId, companyId, employeeId, Number, source)
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async isParentCustomer(companyId: string, customerId: string): Promise<boolean> {

        try {
            const query: { text: string, values: any } = {
                text: `SELECT EXISTS (
                        SELECT 1 FROM "Customers" c WHERE c."parentId" = $1 and "companyId" = $2
                        ) AS "hasChild"
                        `,
                values: [customerId, companyId]
            };

            const resault = await DB.excu.query(query.text, query.values);
            if (resault.rows && resault.rows.length > 0) {
                return (<any>resault.rows[0]).hasChild ?? false;
            }

            return false;
        } catch (error: any) {
            console.log(error)
            return false
        }
    }

    public static async getvalidationInfoForSubCustomer(customerId: string, companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT   id,
                               "parentId", "type",
                                 EXISTS ( SELECT 1 FROM "Customers" c WHERE c."parentId" = "Customers".id  AND c."companyId"=   "Customers"."companyId") AS "hasChild"
                        FROM "Customers" 
                        WHERE id=$1 
                        AND "companyId"=$2`,
                values: [customerId, companyId]
            }

            const customer = await DB.excu.query(query.text, query.values);
            if (customer.rows && customer.rows.length > 0) {
                return new ResponseData(true, "", customer.rows[0])
            }
            return new ResponseData(true, "", {})

        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getCustomerIdByName(client: PoolClient, custoemrName: string, companyId: string) {
        try {
            const query: { text: string, values: any } = {

                text: `SELECT id FROM "Customers" where TRIM(LOWER(name)) = TRIM(LOWER($1)) and "companyId" = $2`,
                values: [custoemrName, companyId]
            }

            let customer = await client.query(query.text, query.values);

            return customer.rows && customer.rows.length > 0 ? customer.rows[0].id : "";
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async customerValidation(data: any) {

        const schema = {
            type: "object",
            properties: {

                name: { type: 'string', "isNotEmpty": true, transform: ["trim"] },
                phone: { type: 'string' },
                mobile: { type: 'string' },
                email: { type: 'string' },
                addresses: { type: 'array' },
                birthDay: { type: 'string' },
                // displayName:{type:'string' },
                // translation:{type:['object','null']}, // not empty {}
                // price:{type:'number'}, //default:0
                // isMultiple:{type:'boolean'},
                // brandId:{type:'string'},
                // isVisible:{type:'boolean'},
            },
            required: ["name", "phone", "addresses"],
            additionalProperties: true,
            errorMessage: {
                properties: {
                    name: "name Must Be String",

                },
                required: {
                    name: "name is Required",

                },
            }
        }

        return await ValidateReq.reqValidate(schema, data);
    }

    public static async updateImportCustomer(client: PoolClient, data: any, company: Company) {
        try {
            let validate = await this.customerValidation(data);
            if (validate && !validate.valid) {
                return new ResponseData(false, "", { OptionName: data.name, error: validate.error })
            }

            data.createdAt = new Date();
            data.updatedDate = new Date();

            let option = data;
            const query: { text: string, values: any } = {

                text: `UPDATE "Options" SET name= $1,"displayName"= $2,translation= $3, price= $4,"isMultiple"= $5,"isVisible"= $6, "updatedDate"= $7 ,"kitchenName"=$8
                WHERE id = $9   RETURNING id`,
                values: [option.name, option.displayName, option.translation, option.price, option.isMultiple, option.isVisible, option.updatedDate, option.kitchenName, option.id],

            };

            let inster = await client.query(query.text, query.values);

            return new ResponseData(true, "", []);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async updateImportCustomers(client: PoolClient, data: any, company: Company) {
        try {
            let validate = await CustomerValidation.customerValidation(data);
            if (validate && !validate.valid) {
                return new ResponseData(false, "", { OptionName: data.name, error: validate.error })
            }

            data.createdAt = new Date();
            data.updatedDate = new Date();


            let customer = data;
            const query: { text: string, values: any } = {

                text: `UPDATE "Customers" SET name= $1,"phone"= $2,mobile= $3, email= $4,"addresses"= $5,"birthDay"= $6::date ,"updatedAt"= $7  WHERE id = $8  RETURNING id`,
                values: [customer.name, customer.phone, customer.mobile, customer.email, JSON.stringify(customer.addresses), customer.birthDay, new Date(), customer.id],

            };

            let inster = await client.query(query.text, query.values);

            return new ResponseData(true, "", []);
        } catch (error: any) {
            throw new Error(error)
        }

    }

    public static async saveImportCustomers(client: PoolClient, data: any, company: Company) {

        try {

            let validate = await CustomerValidation.customerValidation(data);
            if (validate && !validate.valid) {
                return new ResponseData(false, "", { OptionName: data.name, error: validate.error })
            }

            data.createdAt = new Date();
            data.updatedDate = new Date();
            // data.taxId = (await TaxesRepo.getDefaultTax(client,company.id)).data.id;

            const customer: Customer = data
            customer.id = Helper.createGuid()
            const query: { text: string, values: any } = {
                text: ` INSERT INTO  "Customers"(name,"phone",mobile, email,"addresses","birthDay","companyId") 
                   VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
                values: [customer.name, customer.phone, customer.mobile, customer.email, JSON.stringify(customer.addresses), customer.birthDay, company.id]
            };

            let inster = await client.query(query.text, query.values) // await client.query(query.text, query.values);

            // product.id = inster.rows[0].id;

            return new ResponseData(true, "", []);
        }
        catch (error: any) {
            console.log(error)
            return new ResponseData(false, error.message, [])
        }
    }

    public static async importFromCVS(data: any, company: Company, employeeId: string, pageNumber: number, count: number) {
        const client = await DB.excu.client(500);
        let redisClient = RedisClient.getRedisClient();
        try {
            let errors = [];
            await client.query("BEGIN")


            const companyId = company.id;

            let limit: any = process.env.NUMBER_OF_IMPORT_RECOREDS ?? 2000;

            for (let index = 0; index < data.length; index++) {

                let progress = Math.floor((((index + 1) + ((pageNumber - 1) * limit)) / count) * 100) + "%"
                await redisClient.set("CustomerBulkImport" + company.id, JSON.stringify({ progress: progress }))

                const element: Customer = data[index];

                element.companyId = companyId;
                element.id = await this.getCustomerIdByName(client, element.name, companyId)


                let resault: any;
                //TODO check if product Exists by Name or Barcode
                element.companyId = companyId
                if (element.id != "" && element.id != null) {
                    errors.push({ productName: element.name, error: "Product Name Already Used" })
                    resault = await this.updateImportCustomers(client, element, company);


                } else {
                    resault = await this.saveImportCustomers(client, element, company);
                    if (!resault.success) {
                        errors.push(resault.data)

                    }
                }

            }
            await client.query("COMMIT")

            return new ResponseData(true, "", errors)
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")

            return new ResponseData(false, error.message, [])

        } finally {

            client.release()



        }
    }


    public static async getReceivables(client: PoolClient, ids: any[], branchId: string | null = null) {
        try {

            console.log(ids, branchId)
            const query = {
                text: `with "customerOpeningBalance" as (
                    select "Customers".id,
                        COALESCE( sum("CustomerOpeningBalance"."openingBalance"),0) as "openingBalance",
	                    case when $2::uuid is null then null else "CustomerOpeningBalance"."branchId"   end as "openingBalanceBranchId"
                        from "Customers"
                        left join "CustomerOpeningBalance" on "Customers".id = "CustomerOpeningBalance"."customerId"           and ($2::uuid is null or "CustomerOpeningBalance"."branchId" = $2)
                    where "Customers".id = any ($1)
	      
                    group by "Customers".id,"openingBalanceBranchId"
                    ),"customer" as (
                        select 
                        "customerOpeningBalance".id,
                        "customerOpeningBalance"."openingBalance" ::text::numeric - COALESCE(sum("InvoicePaymentLines"."amount"::text::numeric),0) as "openingBalance"
                        from "customerOpeningBalance"
                        LEFT join "InvoicePayments" on "InvoicePayments"."customerId" = "customerOpeningBalance".id
                        LEFT join "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId"  = "InvoicePayments".id and "openingBalanceId" is not null 
						        and ($2::uuid is null or "customerOpeningBalance"."openingBalanceBranchId" = $2)
                    group by "customerOpeningBalance".id,"customerOpeningBalance"."openingBalance" 
                    ),"invoices" as (
                    select "Invoices".id,
                        "Invoices"."customerId",
                        "Invoices".total - SUM(COALESCE("InvoicePaymentLines".amount,0))as total 
                        from "Invoices" 
                    left join "InvoicePaymentLines" on "InvoicePaymentLines"."invoiceId" = "Invoices".id    and ($2::uuid is null or "Invoices"."branchId" =$2)
                    inner join "customer" on "Invoices"."customerId" = "customer".id 
						where "Invoices"."status" not in ('Draft')
                        group by "Invoices".id
                    ),"invoiceCredits" as(
                    select 
                    "invoices".id,
                    "invoices"."customerId",
                    "invoices".total - sum(COALESCE("CreditNotes".total,0))as total
                    from "invoices"
                    left join "CreditNotes" on "CreditNotes"."invoiceId" = "invoices".id 
                    group by "invoices".id,"invoices"."customerId","invoices".total
                    ),"invoiceAppliedCredits" as (
                    select "invoiceCredits".id,
                    "invoiceCredits"."customerId",
                    "invoiceCredits".total - sum(COALESCE("AppliedCredits".amount,0)) as total
                        from "invoiceCredits"
                    left join "AppliedCredits" on "AppliedCredits"."invoiceId" = "invoiceCredits".id 
                    group by "invoiceCredits".id,"invoiceCredits"."customerId","invoiceCredits".total
                    )
                    ,"invoicesTotal" as (
                    select "invoiceAppliedCredits"."customerId",
                        sum(case when "invoiceAppliedCredits".total>0 then "invoiceAppliedCredits".total else 0 end ) as total 
                        from "invoiceAppliedCredits"
                        group by "invoiceAppliedCredits"."customerId"
                    ),"openingBalancePayments" as(
                    select 
                        "customer".id as "customerId",
                        COALESCE(sum("InvoicePaymentLines".amount),0) as total
                        from "InvoicePayments"
                    inner join "customer" on "customer".id =  "InvoicePayments"."customerId" 
                    inner join "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "InvoicePayments".id and "InvoicePaymentLines"."invoiceId" is null and
                    "InvoicePaymentLines"."openingBalanceId" is not null 
							        where ($2::uuid is null or "InvoicePayments"."branchId" = $2)
                    group by "customer".id 
                    )
		

                    select "customer".id , cast  (COALESCE("invoicesTotal".total,0) +( COALESCE("customer"."openingBalance",0) )as real)as "ouStandingRecievable" from "customer"
                    left join "invoicesTotal" on "invoicesTotal"."customerId" = "customer".id`,
                values: [ids, branchId]
            }

            const receivables = await client.query(query.text, query.values);

            return receivables.rows && receivables.rows.length > 0 ? receivables.rows : []
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    public static async getCutomerList(data: any, company: Company): Promise<ResponseData> {
        try {
            const companyId = company.id;

            // --- Normalize inputs ---
            const page = Number.isFinite(+data?.page) && +data.page > 0 ? +data.page : 1;
            const limit = Number.isFinite(+data?.limit) && +data.limit > 0 ? +data.limit : 15;
            const searchTerm: string | undefined =
                typeof data?.searchTerm === 'string' && data.searchTerm.trim() !== ''
                    ? data.searchTerm.trim()
                    : undefined;

            // --- Validate/normalize type filter ---
            const allowedTypes = ['individual', 'business'];
            let normalizedType: 'Individual' | 'Business' | undefined;
            if (data?.filter?.type) {
                const t = String(data.filter.type).toLowerCase();
                if (!allowedTypes.includes(t)) {
                    throw new ValidationException(`Invalid customer filter type: '${data.filter.type}'`);
                }
                normalizedType = (t.charAt(0).toUpperCase() + t.slice(1)) as 'Individual' | 'Business';
            }

            // --- Sorting ---
            const incomingSortBy = data?.sortBy?.sortValue as string | undefined;
            const incomingSortDir = String(data?.sortBy?.sortDirection || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

            const sortByKey = incomingSortBy ? incomingSortBy : 'createdAt';
            const sortDir = incomingSortDir;

            let columnMap: { [key: string]: any } = {
                id: { table: 'c', dbCol: 'id' },
                name: { table: 'c', dbCol: 'name' },
                email: { table: 'c', dbCol: 'email' },
                phone: { table: 'c', dbCol: 'phone' },
                mobile: { table: 'c', dbCol: 'mobile' },
                saluation: { table: 'c', dbCol: 'saluation' },
                outStandingRecivable: { table: 'c', dbCol: 'accountReceivable' }, // aliasing to match previous output
                type: { table: 'c', dbCol: 'type' },
                createdAt: { table: 'c', dbCol: 'createdAt' },
                companyId: { table: 'c', dbCol: 'companyId' },
                // choose: {
                //     table: 'c',
                //     dbCol: 'customFields',
                //     jsonArrayPick: { matchKey: 'name', matchValue: 'Choose', returnKey: 'value', cast: 'text' }
                // },
                // choose: { table: 'c', dbCol: 'customFields', jsonPath: ['Choose'], cast: 'text' }
            };

            let selectableColumns = [
                'id',
                'name',
                'email',
                'phone',
                'mobile',
                'saluation',
                'outStandingRecivable',
                'type',
                'createdAt',
                'companyId',
                'choose'
            ];

            //load custom fields config
            const customFields = await CustomizationRepo.getCustomizationByKey('customer', 'customFields', company);
            for (const field of customFields.data.customFields || []) {
                if (field.name == null || field.name.trim() === '') continue;
                const nameKey: string = field.abbr.replace(/\s+/g, '_');
                columnMap[nameKey] = { table: 'c', dbCol: 'customFields', jsonKV: { key: field.id, cast: 'text' } };
                selectableColumns.push(nameKey);
            }

            console.log(columnMap);
            // --- Build TableConfig for Customers ---
            const CustomerConfig: TableConfig = {
                aliasMap: {
                    c: 'Customers',
                },
                columnMap: columnMap,
                joinDefs: {},
                searchableColumns: ['name', 'phone', 'mobile'],
                // Whitelist: only these can be selected/sorted/filtered from outside
                selectableColumns: selectableColumns,
            };

            const service = new TableDataService(CustomerConfig);

            // --- Build filters ---
            const filters: TableRequest['filters'] = [
                { column: 'companyId', operator: 'eq', value: companyId },
            ];

            if (normalizedType) {
                filters.push({ column: 'type', operator: 'eq', value: normalizedType });
            }

            // Optional branch: if you want to restrict to a set of customerIds
            // (NOTE: this *filters* the list; the legacy function used the ids for ordering/prioritization.
            // If you need the old prioritization behavior, see the raw-order note below.)
            const customerIds: string[] = Array.isArray(data?.customerIds) ? data.customerIds : [];
            if (customerIds.length > 0) {
                filters.push({ column: 'id', operator: 'in', value: customerIds });
            }

            const defaultCols = [
                'id',
                'name',
                'email',
                'phone',
                'mobile',
                'saluation',
                'outStandingRecivable',
                'createdAt',
            ];

            const whitelist = CustomerConfig.selectableColumns ?? Object.keys(CustomerConfig.columnMap);
            const userCols = Array.isArray(data?.columns)
                ? (data.columns as string[]).map(String)
                : defaultCols;

            // Keep only allowed ones
            let selectColumns = userCols.filter((c) => whitelist.includes(c));

            // Fallback to defaults if nothing valid
            if (selectColumns.length === 0) {
                selectColumns = defaultCols;
            }

            //add id if not included (to keep unique rows)
            if (!selectColumns.includes('id')) {
                selectColumns.push('id');
            }
            console.log(selectColumns);
            // --- Build request ---
            const req: TableRequest = {
                table_name: 'Customers',
                select_columns: selectColumns,
                filters,
                search_term: searchTerm,
                sort_by: selectableColumns.includes(sortByKey) ? (sortByKey as any) : ('createdAt' as any),
                sort_order: sortDir,
                page_number: page,
                page_size: limit,
            };

            // --- Execute via TableDataService ---
            const result = await service.getTableData<{
                id: string;
                name: string;
                email: string | null;
                phone: string | null;
                mobile: string | null;
                saluation: string | null;
                outStandingRecivable: number | null;
                createdAt: string;
            }>(req);

            // --- Build the same response shape as before ---
            const { total_count } = result;
            const pageCount = Math.ceil(total_count / limit) || 1;

            // startIndex (1-based within the whole result set)
            const startIndex = (page - 1) * limit + 1;
            // lastIndex: clamp to total_count
            const lastIndex = Math.min(page * limit, total_count);

            const resData = {
                list: result.data,
                count: total_count,
                pageCount,
                startIndex,
                lastIndex,
            };

            return new ResponseData(true, '', resData);
        } catch (error: any) {
          
            console.error(error);
            throw new Error(error?.message ?? String(error));
        }
    }

    public static async getCustomerById(customerId: string, company: Company) {
        try {
            const companyId = company.id;
            const query: { text: string, values: any } = {
                text: `SELECT "Customers" .  id, 
                        "Customers" .  saluation,
                        "Customers" .  name,
                        "Customers" . "contactName", 
                        "Customers" . industry,
                        "Customers" .  phone,
                        "Customers" .  mobile,
                        "Customers" .  email,
                        "Customers"."createdAt", 
                        "Customers"."parentId", 
                        parent.name as "parentName", 
                        "Customers" . "creditLimit", 
                        "Customers"."type",
                        EXISTS (
                                SELECT 1 FROM "Customers" c WHERE c."parentId" = $1 and "companyId" = $2
                                ) AS "hasChild",

                        case when "Customers" ."addresses" is null then '[]'::json else "Customers" .addresses end as addresses,
                    "Customers" ."birthDay",
                    "Customers" ."MSR",
                    "Customers" ."priceLabelId",
                    "Customers" ."discountAmount",
                    "Customers" ."vatNumber",
                    "Customers" ."currencyId",
                    "Customers" ."customergroups",
                    "Customers" ."paymentTerm",
                    "Customers" ."options",
                    "Customers" ."customFields",
                    ( select json_agg(json_build_object('note',case when el->>'note' is null then trim(both '"' from el::text)  ELSE ( el->>'note')::text  end , 
                                                        'employeeId',"Employees".id ,
                                                        'createdAt' ,( el->>'createdAt')::text, 
                                                        'employeeName' , "Employees".name ,
                                                        'isNew', case when "Employees".id is null then false else true end  )) as  "notes" 
                    from json_array_elements ("Customers"."notes") el
                    left join "Employees" on "Employees".id =(el->>'employeeId')::uuid
                    )
                FROM "Customers" 
                left join lateral (select id , name from "Customers" c where c.id = "Customers"."parentId" limit 1) parent on true
                WHERE "Customers".id = $1
                AND "companyId"= $2`,
                values: [customerId, companyId]
            }
            const list = await DB.excu.query(query.text, query.values);


            const temp = new Customer();

            temp.ParseJson(list.rows[0])

            return new ResponseData(true, "Added Successfully", temp)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }


    public static async getCustomerCredit(customerId: string | null, company: Company, includeSubCustomers?: boolean) {
        try {

            const companyId = company.id;

            const afterDecimal = company.afterDecimal
            let query: { text: string, values: any } = {
                // text: ` SELECT "customerCredits"($1) as "customerCredit" `,
                text: ` SELECT "availableCredit" as "customerCredit" from  "Customers" WHERE id = $1 `,
                values: [customerId]
            }




            if (includeSubCustomers === true) {
                // query.text  = `WITH "customerIds" AS (
                //                     SELECT id 
                //                     FROM "Customers"
                //                     WHERE id = $1 
                //                     OR "parentId" = $1
                //                 )
                //                 SELECT 
                //                     SUM(credit) AS "customerCredit"
                //                 FROM  "customerIds",
                //                 LATERAL "customerCredits"("customerIds".id) AS credit_result(credit)`
                query.text = ` SELECT 
                                    SUM("availableCredit"::text::numeric)::float AS "customerCredit"
                                FROM "Customers"
                                WHERE "companyId" = $2 and (id = $1 OR "parentId" = $1)`
                query.values = [customerId, company.id]
            }
            let credit = 0;

            const customer = await DB.excu.query(query.text, query.values);
            console.log(query.text)
            if ((customer.rowCount != null && customer.rowCount > 0) && (<any>customer.rows[0]).customerCredit) {
                credit = ((<any>customer.rows[0]).customerCredit).toFixed(afterDecimal)
            }

            return new ResponseData(true, "", { credit: Number(credit) })
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async getCustomerOutStandingReceivable(customerId: string, company: Company, includeSubCustomers?: boolean) {
        try {


            const query: { text: string, values: any } = {
                // text: `   SELECT "outStandingRecivable"($1) as "outStandingRecivables"`,
                text: `SELECT "accountReceivable" as "outStandingRecivables" from  "Customers" WHERE id = $1`,
                values: [customerId]
            }

            if (includeSubCustomers === true) {
                // query.text  = `WITH "customerIds" AS (
                //                     SELECT id 
                //                     FROM "Customers"
                //                     WHERE id = $1 
                //                     OR "parentId" = $1
                //                 )
                //                 SELECT 
                //                     SUM(outstanding) AS "outStandingRecivables"
                //                 FROM  "customerIds",
                //                 LATERAL "outStandingRecivable"("customerIds".id) AS r(outstanding)`
                query.text = ` SELECT 
                                    SUM("accountReceivable"::text::numeric)::float AS "outStandingRecivables"
                                FROM "Customers"
                                WHERE "companyId" = $2 and (id = $1 OR "parentId" = $1)`
                query.values = [customerId, company.id]
            }
            console.log(query.text)
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
            const includeSubCustomers = data.includeSubCustomers;
            const customerId = data.customerId;
            // const interval = data.interval
            const from = data.from;
            const to = data.to;


            const subCustomerQuery = includeSubCustomers == true ? `OR c."parentId" = $1` : ''
            const query: { text: string, values: any } = {
                text: `SELECT  SUM(i.total) as total,   
                                i."invoiceDate" as "createdAt" 
                        FROM "Invoices" i
                        JOIN "Customers" c ON i."customerId" = c.id
                        WHERE (c.id = $1 ${subCustomerQuery})
                          and i."invoiceDate" >= $2
                          and i."invoiceDate" <= $3
                        group by i."invoiceDate"
                        ORDER BY i."invoiceDate" ASC `,
                values: [customerId, from, to]
            }

            const summary = await DB.excu.query(query.text, query.values);
            const customerCredit = await this.getCustomerCredit(customerId, company, includeSubCustomers)
            const outStandingRecivables = await this.getCustomerOutStandingReceivable(customerId, company, includeSubCustomers)
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
            const includeSubCustomers = data.includeSubCustomers;
            const subCustomerQuery = includeSubCustomers === true ? `or c."parentId" = $1 ` : ``
            let pageCount = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }

            const countQuery = {
                text: `SELECT COUNT(*) 
                       FROM "Customers"  c
                        JOIN "Invoices" on c.id = "Invoices"."customerId"
                        WHERE c.id = $1 ${subCustomerQuery}`,
                values: [customerId]
            }

            const countData = await DB.excu.query(countQuery.text, countQuery.values);
            count = (<any>countData.rows[0]).count;
            pageCount = Math.ceil(count / data.limit)
            const query: { text: string, values: any } = {
                text: ` select  i.id,
                                i.total, 
                                i."invoiceNumber",
                                COALESCE(sum(ac.amount),0) + COALESCE(sum(ipl.amount),0) as "paidAmount",
                                i.total - (COALESCE(sum(ac.amount),0)+ COALESCE(sum(ipl.amount),0)) as "balance"
                        FROM "Invoices" i
                        JOIN "Customers" c
                            ON c.id = i."customerId" 
                        LEFT JOIN "InvoicePaymentLines" ipl
                            ON ipl."invoiceId" = i.id
                        LEFT JOIN "AppliedCredits" ac
                            ON ac."invoiceId" = i.id
                        where c.id = $1 ${subCustomerQuery}
                        group by i.id
                        order by "invoiceDate" desc
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
            const includeSubCustomers = data.includeSubCustomers;
            const subCustomerQuery = includeSubCustomers === true ? `or "Customers"."parentId" = $1` : ``
            let pageCount = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }

            const countQuery = {
                text: `SELECT COUNT(*) 
                       FROM "Customers" 
                       JOIN "Estimates" on "Customers".id = "Estimates"."customerId" 
                       WHERE "Customers".id = $1 ${subCustomerQuery} `,
                values: [customerId]
            }

            const countData = await DB.excu.query(countQuery.text, countQuery.values);
            count = (<any>countData.rows[0]).count;
            pageCount = Math.ceil(count / data.limit)
            const query: { text: string, values: any } = {
                text: `select 
                "Estimates".id,
                "Estimates".total,
                "Estimates"."estimateNumber"
                FROM "Customers" 
                JOIN "Estimates" 
                    ON "Customers".id = "Estimates"."customerId"
                where "Customers".id =$1 ${subCustomerQuery}
                order by "estimateDate" desc
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
            const includeSubCustomers = data.includeSubCustomers;
            const subCustomerQuery = includeSubCustomers === true ? `or "Customers"."parentId" = $1 ` : ``
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
                       INNER JOIN "Customers" 
                         ON "Customers".id = "Invoices"."customerId" 
                       where "Customers"."id" =$1 ${subCustomerQuery}`,
                values: [customerId]
            }

            const countData = await DB.excu.query(countQuery.text, countQuery.values);
            count = (<any>countData.rows[0]).count;
            pageCount = Math.ceil(count / data.limit)
            const query: { text: string, values: any } = {
                text: `select 
                            "CreditNotes".id, 
                            "CreditNotes".total ,
                            "CreditNotes"."creditNoteNumber"
                        FROM "CreditNotes" 
                        INNER JOIN "Invoices"
                            ON "Invoices".id = "CreditNotes"."invoiceId"
                        INNER JOIN "Customers" 
                            ON "Customers".id = "Invoices"."customerId" 
                        Where "Customers".id =$1 ${subCustomerQuery}
                        Order by "creditNoteDate" desc
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
            const includeSubCustomers = data.includeSubCustomers;
            const subCustomerQuery = includeSubCustomers === true ? ` or "Customers"."parentId" = $1 ` : ``
            let pageCount = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }

            const countQuery = {
                text: `SELECT COUNT(*) 
                       FROM "Customers" 
                       INNER JOIN "InvoicePayments" 
                        ON "Customers".id = "InvoicePayments"."customerId"
                      where "Customers".id =$1  ${subCustomerQuery}`,
                values: [customerId]
            }

            const countData = await DB.excu.query(countQuery.text, countQuery.values);
            count = (<any>countData.rows[0]).count;
            pageCount = Math.ceil(count / data.limit)
            const query: { text: string, values: any } = {
                text: `select 
                "InvoicePayments".id,
                'Customer Payment' as code,
                "InvoicePayments"."paidAmount",
                "InvoicePayments"."tenderAmount"
                FROM "Customers" 
                JOIN "InvoicePayments" 
                        ON "Customers".id = "InvoicePayments"."customerId" 
                where "Customers".id = $1 ${subCustomerQuery}
               order by "paymentDate" desc
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

    public static async customerLastPayment(customerId: string, companyId: string) {
        try {
            const query = {
                text: `Select "InvoicePayments".id, "InvoicePayments"."paidAmount","InvoicePayments"."paymentDate","InvoicePayments"."tenderAmount" from "InvoicePayments" where "companyId" = $1 and "customerId" =$2 order by "paymentDate" DESC LIMIT 1`,
                values: [companyId, customerId]
            }

            let payment = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", payment.rows[0])

        } catch (error: any) {
            throw new Error(error)
        }
    }

    /**Add Ecommerce Customers
     * if customer exist
     * update customer addresses if new Address where added by the customer
     */
    public static async addEcommerceCustomer(client: PoolClient, customerId: string | null, customer: any, company: Company) {
        try {
            let customerAddresses: any[] = [];


            if (customer && customer.address) {
                customer.address.title = customer.address && customer.address.title ? customer.address.title : 'Home'

            }
            if (customer && (customerId == "" || customerId == null)) {

                let customerData = (await CustomerRepo.checkIfCustomerExists(customer.phone, company.id))
                if (customerData) {
                    customerAddresses = customerData.addresses ?? [];
                    customerId = customerData.id;

                    if (customer && customerAddresses && customerAddresses != undefined && customer.address && customer.address != null) {
                        let currentAddress = customerAddresses.find((f: any) => f.title == customer.address.title);


                        let indexofAddress = customerAddresses.indexOf(currentAddress)
                        if (indexofAddress == -1 && JSON.stringify(customer.address) != '{}' && customer.address != null && customer.address != "") {
                            customerAddresses.push(customer.address)
                        }

                    }

                    await this.setCustomerAddress(client, customer.name, customerAddresses, customerId)

                } else if (customer && customer.phone != null && customer.phone != "") {
                    let customerTemp = new Customer()
                    customerTemp.ParseJson(customer);
                    if (JSON.stringify(customer.address) != '{}' && customer.address != null && customer.address != "") {
                        customerTemp.addresses.push(customer.address)
                    }
                    customerId = (await CustomerRepo.addCustomer(client, customerTemp, company)).data.id;
                }


            } else {
                if (customerId && customer && customer.address) {
                    customerAddresses = await this.getCustomerAddress(customerId, company.id)
                    let currentAddress = customerAddresses.find((f: any) => f.title == customer.address.title);

                    let indexofAddress = customerAddresses.indexOf(currentAddress)
                    if (indexofAddress == -1 && JSON.stringify(customer.address) != '{}' && customer.address != null && customer.address != "") {
                        customerAddresses.push(customer.address)
                    } else {
                        customerAddresses[indexofAddress] = customer.address;
                    }
                    await this.setCustomerAddress(client, customer.name, customerAddresses, customerId)
                }

            }
            return customerId;

        } catch (error: any) {
            console.log(error)
          
            throw new Error(error)
        }
    }
    public static async getCustomerAddress(customerId: string, companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT addresses from "Customers" where id = $1 `,
                values: [customerId]
            }

            let customer = await DB.excu.query(query.text, query.values);
            return (<any>customer.rows[0]).addresses ?? []
        } catch (error: any) {
          
            throw new Error(error)
        }
    }
    public static async setCustomerAddress(client: PoolClient, name: string, addresses: any, customerId: string | null) {
        try {
            const query: { text: string, values: any } = {
                text: `Update "Customers" set addresses=$1,name=$2 where id = $3 `,
                values: [JSON.stringify(addresses), name, customerId]
            }

            await client.query(query.text, query.values);
            return new ResponseData(true, "", [])
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    ///SOCKET
    public static async getCustomers(client: PoolClient, companyId: string, date: any | null = null) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT  "Customers".*
                       FROM "Customers" 
                       WHERE "companyId"= $1`,
                values: [companyId]
            }



            if (date != null) {
                query.text = `SELECT   "Customers".*
                FROM "Customers" 
                WHERE "companyId"= $1
                AND "updatedAt">=$2`
                query.values = [companyId, date];
            }
            const list = await client.query(query.text, query.values);
            const customers: Customer[] = [];

            for (let index = 0; index < list.rows.length; index++) {
                const element = list.rows[index];
                const customer = new Customer();
                customer.ParseJson(element)
                customers.push(customer)
                // let customerCredit = await this.getCustomerCredit(customer.id, company);
                // customer.customerCredit = Number(customerCredit.data.credit);
            }

            const data = {
                list: customers
            }
            return new ResponseData(true, "Added Successfully", data)
        } catch (error: any) {
          
            throw new Error(error)
        }
    }
    public static async addPosCustomer(client: PoolClient, data: any, companyId: string) {
        try {
            const validate = await CustomerValidation.customerValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            const customer = new Customer();
            customer.ParseJson(data);
            customer.companyId = companyId;
            const query: { text: string, values: any } = {
                text: `INSERT INTO "Customers"
                                  (id,saluation,name,phone,mobile,email,addresses,"companyId","birthDay",notes,"MSR","options")
                       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)RETURNING id`,
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
                    customer.MSR,
                    customer.options
                ]
            }

            const insert = await client.query(query.text, query.values);
            customer.id = (<any>insert.rows[0]).id


            const branchIds = await BranchesRepo.getCompanyBranchIds(client, companyId)
            await SocketCustomerRepo.sendNewCustomer(client, branchIds, customer)
            return new ResponseData(true, "Added Successfully", { id: customer.id })
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async getCustomerOpeningBalance(customerId: string, branchId: string | null = null) {
        try {

            const query: { text: string, values: any } = {
                text: `select "CustomerOpeningBalance"."branchId" , "CustomerOpeningBalance".id, "CustomerOpeningBalance"."openingBalance" as  amount,COALESCE(sum("InvoicePaymentLines"."amount"),0) AS "paidAmount",
                case when "Branches"."openingBalanceDate" is null then "Companies"."createdAt" - interval '1 day' else "Branches"."openingBalanceDate" end "date" ,
                "Branches"."name" as "branchName"
                from "CustomerOpeningBalance" 
                Left join "InvoicePaymentLines" on "InvoicePaymentLines"."openingBalanceId" = "CustomerOpeningBalance".id
                left join "Branches" on "Branches".id = "CustomerOpeningBalance"."branchId"
                left join "Companies" on "Companies".id = "Branches"."companyId"

                where "CustomerOpeningBalance"."customerId" = $2
                AND  ( $1::uuid IS NULL OR  "CustomerOpeningBalance"."branchId" = $1)
                group by  "CustomerOpeningBalance"."customerId","CustomerOpeningBalance".id, "date" ,"CustomerOpeningBalance"."branchId", "Branches".id
                HAVING "CustomerOpeningBalance"."openingBalance" - COALESCE(sum("InvoicePaymentLines"."amount"),0)>0 `,
                values: [branchId, customerId]
            }

            let openingBalance = await DB.excu.query(query.text, query.values);

            if (openingBalance.rowCount != null && openingBalance.rowCount > 0 && branchId) {
                return { amount: (<any>openingBalance.rows[0]).amount, id: (<any>openingBalance.rows[0]).id, paid: (<any>openingBalance.rows[0]).paidAmount, createdAt: (<any>openingBalance.rows[0]).date }
            } else {
                console.log(openingBalance.rows)
                return openingBalance.rows

            }

        } catch (error: any) {
            console.log(error)
          
            throw new Error(error)
        }
    }

    public static async newCustomers(data: any, company: Company) {
        try {
            const query: { text: string, values: any } = {
                text: `select id, name ,"createdAt" ,"Customers".saluation
                from "Customers"
                where "companyId"=$1 
                order by "createdAt" desc 
                limit $2`,
                values: [company.id, 10]
            }

            let customers = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", customers.rows)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getCustomerName(customerId: string) {
        try {
            const query = {
                text: `SELECT  name FROM "Customers" where id =$1`,
                values: [customerId]
            }

            let customer = await DB.excu.query(query.text, query.values);

            return customer && (customer).rows && customer.rows.length > 0 ? (<any>customer.rows[0]).name : null
        } catch (error: any) {
            throw new Error(error)
        }


    }

    public static async customerStatement(data: any, company: Company) {
        try {

            const companyId = company.id;
            const customerId = data.customerId;
            const includeSubCustomers = data.includeSubCustomers
            const subCustomerQuery = includeSubCustomers === true ? ' or "Customers"."parentId" = $1 ' : ''
            if (!customerId) { throw new Error("userId is required") }
            let from = data.from ? data.from : null;
            let to = data.to ? data.to : null;
            const branchId = data.branchId ? (data.branchId).trim() ? (data.branchId).trim() : null : null;
            if (from != null) {
                from = await TimeHelper.resetHours(from)
            }
            to = moment(to).add(1, 'day').format("YYYY-MM-DD 00:00:00");

            let details = ''
            if (data.export) {
                details = `(select string_agg((el->>'invoiceNumber')::text,',') from jsonb_array_elements(("records"."details"::jsonb->>'invoices')::jsonb) el ) as "details"`
            } else {
                details = `   "records"."details"::jsonb  `
            }

            let transactions = ``

            if (data.export) {
                transactions = ` case when  "records"."dbTable" = '' or  "records"."dbTable" = null then    "records"."accountName"  else  "records"."dbTable" end as "dbTable"`
            } else {
                transactions = ' "records"."dbTable"'
            }
            const query: { text: string, values: any } = {
                text: `with "values" as (
                        select      $1::uuid as "customerId",
                                    $2::uuid as "branchId",
                                    $3::uuid as "companyId",
                                    $4::timestamp as "fromDate",
                                $5::timestamp as "toDate"
                        )
                        ,"payments" as(
                        select 
                            sum("JournalRecords".amount)   as "amount"
                        from "Invoices" 
                        left join "values" on true  
                        inner join "Customers" 
                            on "Customers".id = "Invoices"."customerId" 
                        inner join "InvoicePaymentLines" 
                            on "InvoicePaymentLines"."invoiceId" = "Invoices"."id"
                        inner join "JournalRecords" 
                            on "JournalRecords"."referenceId" = "InvoicePaymentLines"."invoicePaymentId" 
                        inner join "Accounts" 
                            on "Accounts".id = "JournalRecords"."accountId"
                        inner join "Branches" 
                            on "Branches".id = "JournalRecords"."branchId"
                        where "Branches"."companyId" = "values"."companyId"
                            and ("Customers".id  ="values"."customerId" ${subCustomerQuery})
                            and ("values"."branchId" is null or "Branches".id = "values"."branchId")
                            and  "JournalRecords"."createdAt" < "values"."fromDate"
                            and ("JournalRecords"."userId" is null)
                            and ( "JournalRecords"."dbTable" = 'Invoice Payment' and  "Accounts".type ='Account Receivable' )
                        )
                        ,"openingBalanceSum" as(
                        select 
                            null::uuid as "referenceId",
                            "values"."customerId" as "userId",
                            SUM("JournalRecords"."amount"::text::numeric)  as "amount",
                            null::real  as "payment", 
                            '' as "dbTable",
                            'opening Balance' as "accountName",
                            COALESCE(max("JournalRecords"."createdAt"::date),"Customers"."createdAt"::date) AS "date" ,
                            '{}'::text as "details",
                            null::text as "codes"
                        from "values" 
                        inner join "Customers"  on "Customers".id =  "values"."customerId" ${subCustomerQuery}
                        left join "JournalRecords"   on  "JournalRecords"."companyId" = "values"."companyId" and "JournalRecords"."userId" = "Customers".id 
                        left join "Accounts" on "Accounts".id = "JournalRecords"."accountId" 
                        where "Customers"."companyId" = "values"."companyId"
                            and ( "values"."branchId" is null or ("JournalRecords".id is not null and "JournalRecords"."branchId" = "values"."branchId") )
                            and ("Accounts".id is null OR "Accounts".type ='Account Receivable' OR  "Accounts".type ='Unearend Revenue' OR "Accounts".type='Customer Credit') 
                            and   "JournalRecords"."createdAt" < "values"."fromDate" 
                        group by "values"."customerId","Customers"."createdAt"
                        )
                        ,"openingBalance" as (
                        select 
                            null::uuid as "referenceId",
                            "openingBalanceSum"."userId" as "userId",
                            "openingBalanceSum"."amount"::text::numeric +     COALESCE("payments"."amount"::text::numeric,0)  as "amount",
                            null::real  as "payment", 
                            '' as "dbTable",
                            'opening Balance' as "accountName",
                            "openingBalanceSum"."date" AS "date" ,
                            '{}'::text as "details",
                            null::text as "codes"
                        from "openingBalanceSum" 
                        join "payments" on true 
                        )
                        , "statments" as (
                        select 
                            "JournalRecords"."referenceId",
                            "JournalRecords"."userId",
                            case when "Accounts".type ='Account Receivable' and "JournalRecords"."dbTable" <> 'Invoice Payment'  and "JournalRecords"."dbTable" <> 'Credit Note Refunds'  then "JournalRecords".amount  end as "amount",
                            case when  "Accounts".type ='Customer Credit' OR "Accounts".type='Unearend Revenue' or ( "Accounts".type ='Account Receivable' and "JournalRecords"."dbTable" = 'Invoice Payment' OR    "JournalRecords"."dbTable" = 'Credit Note Refunds')  then "JournalRecords".amount  end as "payment",
                            "JournalRecords"."dbTable",
                            "JournalRecords"."dbTable" as "accountName",
                            "JournalRecords"."createdAt" as "date",
                            JSON_BUILD_OBJECT('referencId',"JournalRecords"."referenceId", 'referenceTable',"JournalRecords"."dbTable", 'invoices', JSON_AGG(JSON_BUILD_OBJECT('invoiceId',"Invoices".id ,'invoiceNumber',"Invoices"."invoiceNumber" )) )::text as "details",
                            string_agg("Invoices"."invoiceNumber"::text,',') as "codes"
                        from "Customers"
                        join "values" on true
                        left join "JournalRecords"   on  "JournalRecords"."companyId" = "values"."companyId"  and "JournalRecords"."userId" = "Customers".id
                        left join "Accounts" on "Accounts".id = "JournalRecords"."accountId"   
                        left join "InvoicePaymentLines" on "InvoicePaymentLines"."invoicePaymentId" = "JournalRecords"."referenceId"
                        left join "CreditNoteRefunds" on "CreditNoteRefunds".id = "JournalRecords"."referenceId"
                        left join "CreditNotes" on "CreditNotes".id = "JournalRecords"."referenceId"  or "CreditNotes".id  = "CreditNoteRefunds"."creditNoteId"
                        left join "Invoices" on "Invoices".id = "JournalRecords"."referenceId"  or "Invoices".id =  "CreditNotes"."invoiceId" or "Invoices".id = "InvoicePaymentLines"."invoiceId"
                        inner join "Branches" on "Branches".id = "JournalRecords"."branchId"
                        where "Branches"."companyId" = "values"."companyId"
                            and( "values"."branchId" is null or "Branches".id = "values"."branchId")
                            and ( "Customers".id ="values"."customerId" ${subCustomerQuery})
                            and ("Accounts".type ='Account Receivable' OR  "Accounts".type ='Unearend Revenue' OR "Accounts".type='Customer Credit')  
                            and   "JournalRecords"."createdAt" >= "values"."fromDate" and  "JournalRecords"."createdAt" < "values"."toDate"
                        group by "JournalRecords"."referenceId","JournalRecords"."userId","Accounts".type,"JournalRecords".amount ,	"JournalRecords"."dbTable", "JournalRecords"."createdAt"

                        ),"invoicePayments" as (
                        select 
                            "JournalRecords"."referenceId",
                            "JournalRecords"."userId",
                            0 as "amount",
                            "JournalRecords".amount   as "payment",
                            "JournalRecords"."dbTable",
                            "JournalRecords"."dbTable" as "accountName",
                            "JournalRecords"."createdAt" as "date",
                            JSON_BUILD_OBJECT('referencId',"JournalRecords"."referenceId", 'referenceTable',"JournalRecords"."dbTable", 'invoices', JSON_AGG(JSON_BUILD_OBJECT('invoiceId',"Invoices".id ,'invoiceNumber',"Invoices"."invoiceNumber" )) )::text as "details",
                                        string_agg("Invoices"."invoiceNumber"::text,',') as "codes"
                        from "Invoices" 
                        left join "values" on true  
                        join "Customers" on "Customers".id = "Invoices"."customerId"
                        inner join "InvoicePaymentLines" on "InvoicePaymentLines"."invoiceId" = "Invoices"."id"
                        inner join "JournalRecords" on "JournalRecords"."referenceId" = "InvoicePaymentLines"."invoicePaymentId" 
                        inner join "Accounts" on "Accounts".id = "JournalRecords"."accountId"
                        inner join "Branches" on "Branches".id = "JournalRecords"."branchId"

                        where "Branches"."companyId" = "values"."companyId"
                        and ( "Customers".id ="values"."customerId"  ${subCustomerQuery})
                        and( "values"."branchId" is null or "Branches".id = "values"."branchId")
                        and  "JournalRecords"."createdAt" >= "values"."fromDate" and  "JournalRecords"."createdAt" < "values"."toDate"

                        and ("JournalRecords"."userId" is null)
                        and ( "JournalRecords"."dbTable" = 'Invoice Payment' and  "Accounts".type ='Account Receivable' )
                        group by "JournalRecords"."referenceId","JournalRecords"."userId","Accounts".type,"JournalRecords".amount ,	"JournalRecords"."dbTable", "JournalRecords"."createdAt"


                        ), "records" as (
                        select * from "openingBalance"
                        union
                        select * from "statments"
                        union 
                        select * from "invoicePayments"
                        )
                        select "records"."referenceId" ,
                            "records"."userId" ,
                            "records"."amount"  ,
                            "records"."payment" ,
                            ${transactions} ,
                            "records"."accountName" ,
                            "records"."date" ,
                            ${details},
                            "records"."codes",

                        CAST (SUM (COALESCE("payment","amount")::text::numeric  ) OVER (    order by  "date"::date asc ,      "records"."codes",
                        CASE "dbTable" 
                        WHEN 'Invoice' THEN 1
                        WHEN 'Invoice Payment' THEN  2
                        WHEN 'Credit Note' THEN 3
                        WHEN 'Credit Note Refunds' THEN 4   
                        else 5 END ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS REAL) as "Balance"

                        from "records"
                        order by  "date"::date asc ,      "records"."codes",
                        CASE "dbTable" 
                        WHEN 'Invoice' THEN 1
                        WHEN 'Invoice Payment' THEN  2
                        WHEN 'Credit Note' THEN 3
                        WHEN 'Credit Note Refunds' THEN 4   
                        else 5 
                        END
            
                `,
                values: [customerId, branchId, companyId, from, to]
            }
            if (data.filterType && data.filterType == 'outstanding') {

                query.text = `with "values" as (
                      select      $1::uuid as "customerId",
                            $2::uuid as "branchId",
                            $3::uuid as "companyId",
                            $4::timestamp as "fromDate",
                           $5::timestamp as "toDate"
                        ),"openingBalance" as(
                        select 
                                            null::uuid as "referenceId",
                                            "values"."customerId" as "userId",
                                            SUM("JournalRecords"."amount"::text::numeric  )  as "amount",
                                            null::real  as "payment", 
                                        '' as "dbTable",
                                        'opening Balance' as "accountName",
                                        COALESCE(max("JournalRecords"."createdAt"::date),"Customers"."createdAt"::date) AS "date" ,
                                            '{}'::text as "details",
                                            null::text as "codes"
                                    from "values" 
                                    inner join "Customers"  on "Customers".id =  "values"."customerId"  ${subCustomerQuery}
                                    left join "JournalRecords"   on  "JournalRecords"."companyId" = "values"."companyId" and "JournalRecords"."userId" = "Customers".id 
                                    left join "Accounts" on "Accounts".id = "JournalRecords"."accountId" 
                        
                                    where "Customers"."companyId" = "values"."companyId"
                                        and ( "values"."branchId" is null or ("JournalRecords".id is not null and "JournalRecords"."branchId" = "values"."branchId") )
                                        and ("Accounts".id is null OR "Accounts".type ='Account Receivable' OR  "Accounts".type ='Unearend Revenue' OR "Accounts".type='Customer Credit') 
                                        and   "JournalRecords"."createdAt" < "values"."fromDate" 
                                        and "dbTable" in ('Invoice', 'Opening Balance', 'Credit Note','Invoice Payment','Credit Note Refunds')
                                        group by "values"."customerId","Customers"."createdAt"
                                        having   SUM("JournalRecords"."amount"::text::numeric  )  > 0 
                        ),"invo" as (

                        select  "Invoices".id::uuid as "referenceId", 
                                "values"."customerId",
                                "Invoices"."total"::text::numeric as "amount",
                                null::real  as "payment",
                                'Invoice' as "dbTable",
                                'Invoice' as "accountName",
                                "Invoices"."invoiceDate"  AS "date" ,
                                JSON_BUILD_OBJECT('referencId',"Invoices"."id", 'referenceTable','Invoice', 'invoices', JSON_AGG(JSON_BUILD_OBJECT('invoiceId',"Invoices".id ,'invoiceNumber',"Invoices"."invoiceNumber" )) )::text as "details",
                                "Invoices"."invoiceNumber" as "code"
                        from "values" 
                        inner join "Customers" on "Customers".id = "values"."customerId" ${subCustomerQuery}
                        inner join "Invoices" on "Invoices"."customerId" = "Customers".id
                        inner join "Branches" on "Branches".id = "Invoices"."branchId"
                        inner join "Companies" on "Companies".id = "Branches"."companyId"
                                where "Companies"."id" = "values"."companyId"
                                and ( "values"."branchId" is null or ("Branches".id is not null and "Branches"."id" = "values"."branchId") )
                                and   "Invoices"."invoiceDate"  >= "values"."fromDate"
                                and   "Invoices"."invoiceDate" <= "values"."toDate"
                                and "Invoices"."status" in ('Open', 'Partially Paid')
                            group by    "Invoices".id,"values"."customerId"
                        ),"invoicePayments" as (
                        select "InvoicePaymentLines"."invoicePaymentId"::uuid as "referenceId",
                            "values"."customerId",
                            null::real   as "amount",
                            sum("InvoicePaymentLines"."amount"::text::numeric) * -1 as "payment",
                            'Invoice Payment' as "dbTable",
                            'Invoice Payment' as "accountName",
                            "InvoicePaymentLines"."createdAt"  AS "date",
                            JSON_BUILD_OBJECT('referencId',"InvoicePaymentLines"."invoicePaymentId", 'referenceTable','Invoice Payment', 'invoices', JSON_AGG(JSON_BUILD_OBJECT('invoiceId',"invo"."referenceId" ,'invoiceNumber',"invo"."code" )) )::text as "details",
                            "invo"."code" as "code"
                            from "invo"
                            inner join "values" on true 
                        inner join "InvoicePaymentLines" on "invo"."referenceId" = "InvoicePaymentLines"."invoiceId"
                                    where "InvoicePaymentLines"."createdAt"  >= "values"."fromDate"
                                and   "InvoicePaymentLines"."createdAt" <= "values"."toDate"
                            group by "InvoicePaymentLines"."invoicePaymentId", "values"."customerId",	 "InvoicePaymentLines"."createdAt" , "invo"."code"
                        ),"creditNotes" as (
                        select "CreditNotes"."id"::uuid as "referenceId",
                            "values"."customerId",
                                sum("CreditNotes"."total"::text::numeric) * -1 as "amount",
                                null::real   as "payment",
                            'Credit Note' as "dbTable",
                            'Credit Note' as "accountName",
                            "CreditNotes"."creditNoteDate"  AS "date",
                            JSON_BUILD_OBJECT('referencId',"CreditNotes"."id", 'referenceTable','Credit Note', 'invoices', JSON_AGG(JSON_BUILD_OBJECT('invoiceId',"invo"."referenceId" ,'invoiceNumber',"invo"."code" )) )::text as "details",
                            "invo"."code" as "code"
                            from "invo"
                            inner join "values" on true 
                        inner join "CreditNotes" on "invo"."referenceId" = "CreditNotes"."invoiceId"
                                    where "CreditNotes"."creditNoteDate" >= "values"."fromDate"
                                and   "CreditNotes"."creditNoteDate" <= "values"."toDate"
                            group by "CreditNotes"."id", "values"."customerId" , "invo"."code"
                        ),"appliedCredits" as (
                        select "AppliedCredits"."id"::uuid as "referenceId",
                            "values"."customerId",
                                null::real as "amount",
                                    sum("AppliedCredits"."amount"::text::numeric) *-1  as "payment",
                            'Applied Credit' as "dbTable",
                            'Applied Credit' as "accountName",
                            "AppliedCredits"."appliedCreditDate"  AS "date",
                            JSON_BUILD_OBJECT('referencId',"AppliedCredits"."id", 'referenceTable','Applied Credit', 'invoices', JSON_AGG(JSON_BUILD_OBJECT('invoiceId',"invo"."referenceId" ,'invoiceNumber',"invo"."code" )) )::text as "details",
                            "invo"."code" as "code"
                            from "invo"
                            inner join "values" on true 
                        inner join "AppliedCredits" on "invo"."referenceId" = "AppliedCredits"."invoiceId"
                                    where "AppliedCredits"."appliedCreditDate"  >= "values"."fromDate"
                                and   "AppliedCredits"."appliedCreditDate" <= "values"."toDate"
                            group by "AppliedCredits"."id", "values"."customerId" , "invo"."code"
                        ),"refunds" as (
                        select "CreditNoteRefunds"."id"::uuid as "referenceId",
                            "values"."customerId",
                            null::real as "amount",
                                sum("CreditNoteRefunds"."total"::text::numeric)    as "payment",
                            'Credit Note Refunds' as "dbTable",
                            'Credit Note Refunds' as "accountName",
                            "CreditNoteRefunds"."refundDate"  AS "date",
                            JSON_BUILD_OBJECT('referencId',"CreditNoteRefunds"."id", 'referenceTable','Credit Note Refunds', 'invoices', JSON_AGG(JSON_BUILD_OBJECT('invoiceId',"invo"."referenceId" ,'invoiceNumber',"invo"."code" )) )::text as "details",
                            "invo"."code" as "code"
                            from "invo"
                            inner join "values" on true 
                        inner join "CreditNotes" on "invo"."referenceId" = "CreditNotes"."invoiceId"
                        inner join "CreditNoteRefunds" on "CreditNoteRefunds"."creditNoteId" = "CreditNotes".id
                                    where "CreditNoteRefunds"."refundDate" > "values"."fromDate"
                                and   "CreditNoteRefunds"."refundDate" <= "values"."toDate"
                            group by "CreditNoteRefunds"."id", "values"."customerId" , "invo"."code"
                        ), "records" as 
                        (select * from "invo"
                        union all 
                        select * from "invoicePayments"
                        union all 
                        select * from "creditNotes"
                        UNION all 
                        select * from "appliedCredits"
                        union all 
                        select * from "refunds"
                        union all
                        select * from "openingBalance" 
                        )

                        select  "referenceId",
                         "amount",
                        "payment",
                        "dbTable",
                        "accountName",
                         "date",
                         "details":: JSON,
                         "code",
                         
                               CAST (SUM (COALESCE("payment","amount")::text::numeric  ) OVER (    order by  "date"::date asc ,      "records"."code",
										    CASE "dbTable" 
                                            WHEN 'Invoice' THEN 1
                                            WHEN 'Invoice Payment' THEN  2
                                            WHEN 'Credit Note' THEN 3
                                            WHEN 'Credit Note Refunds' THEN 4   
                                            else 5 END ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS REAL) as "Balance"
                            from "records"
                            order by  "date"::date asc ,      "code",
                                                                    CASE "dbTable" 
                                                                    WHEN 'Invoice' THEN 1
                                                                    WHEN 'Invoice Payment' THEN  2
                                                                    WHEN 'Credit Note' THEN 3
                                                                    WHEN 'Credit Note Refunds' THEN 4   
                                                                    else 5 
                                                                END`}


            const statement = await DB.excu.query(query.text, query.values);


            // journal.rows.forEach(element => {
            //    console.log(element)
            //    journal.rows.splice(journal.rows.indexOf(journal.rows.find(f=> f.debit ==0 && f.credit == 0)), 1)
            // });




            if (data.export && data.export) {

                const customerName = await this.getCustomerName(customerId)
                if (customerName) {

                    let hasOpeningBalance = statement.rows.find((f: any) => f.accountName == 'opening Balance')
                    let report = new ReportData()
                    report.filter = {
                        title: `Customer Statment History `,
                        fromDate: data && data.from ? data.from : null,
                        toDate: data && data.to ? data.to : new Date(),
                        //  branches:branches,
                        // compareType: compareType,
                        //  accountDetils: account, 

                        statmentDetails: {
                            hasOpeningBalance: hasOpeningBalance ?? null,
                            name: customerName
                        }
                    }
                    report.records = statement.rows

                    //get columns & subColumns

                    report.columns = [...[{ key: 'date', header: 'Date', properties: { columnType: 'date' } },
                    { key: 'dbTable', header: 'Transactions' },
                    { key: 'details', header: 'Details' },
                    { key: 'amount', properties: { hasTotal: true, columnType: 'currency' } },
                    { key: 'payment', header: 'Payments', properties: { hasTotal: true, columnType: 'currency' } },
                    { key: 'Balance', properties: { hasTotal: true, columnType: 'currency' } }
                    ], ...report.columns]
                    report.fileName = `${customerName} Statment `
                    return new ResponseData(true, "", report)
                }



            } else {
                return new ResponseData(true, "", statement.rows)
            }


        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)
        }
    }

    public static async exportCustomers(company: Company, type: string = 'XLSX'): Promise<ResponseData> {
        try {
            const companyId = company.id;
            const selectQuery = `select name,phone,email,addresses ,  TO_CHAR("birthDay", 'YYYY-MM-DD') AS "birthDay"  from "Customers" c WHERE c."companyId" = $1`;

            const selectList: any = await DB.excu.query(selectQuery, [companyId]);

            // Modify the addresses field to be a string
            const formattedSelectList = selectList.rows.map((row: any) => {
                return {
                    ...row,
                    addresses: JSON.stringify(row.addresses)
                };
            });







            if (type.toLowerCase() == 'csv') {
                console.log(">>>>>>>>>>csv")
                const csvWriter = createObjectCsvWriter({
                    path: companyId + 'customers.csv',
                    header: [
                        { id: 'name', title: 'name' },
                        { id: 'phone', title: 'phone' },
                        { id: 'email', title: 'email' },
                        { id: 'addresses', title: 'addresses' },
                        { id: 'birthDay', title: 'birthDay' }
                    ],
                });

                // Write the data to the CSV file
                await csvWriter.writeRecords(formattedSelectList);


            } else {
                console.log(">>>>>>>>>>xlsx")

                // Create a new workbook
                const workbook = xlsx.utils.book_new()

                // Specify the headers based on your data keys
                const headers = Object.keys(formattedSelectList[0]); // Get headers from the first object

                // Convert the array to a worksheet
                const worksheet = xlsx.utils.json_to_sheet(formattedSelectList, { header: headers, skipHeader: false });

                // Calculate maximum width for each column based on the content
                const colWidths = headers.map(header => {
                    // Get maximum length of corresponding column values
                    const maxLength = Math.max(
                        ...formattedSelectList.map((row: any) => {
                            const value = row[header];
                            return value ? value.toString().length : 0; // Use 0 for empty values
                        })
                    );

                    // Return the width in pixels, ensuring a minimum width
                    return { wpx: Math.max(maxLength * 10, 50) }; // Adjust multiplier as needed
                });

                // Set the column widths
                worksheet['!cols'] = colWidths;

                // Append the worksheet to the workbook
                xlsx.utils.book_append_sheet(workbook, worksheet, 'Data');

                // Generate a binary string for the workbook
                xlsx.writeFile(workbook, companyId + 'customers.xlsx');


            }




            // Define the CSV writer
            const csvWriter = createObjectCsvWriter({
                path: companyId + 'customers.csv',
                header: [
                    { id: 'name', title: 'name' },
                    { id: 'phone', title: 'phone' },
                    { id: 'email', title: 'email' },
                    { id: 'addresses', title: 'addresses' },
                    { id: 'birthDay', title: 'birthDay' }
                ],
            });

            // Write the data to the CSV file
            await csvWriter.writeRecords(formattedSelectList);

            return new ResponseData(true, "", "Products exported successfully.");
        } catch (error: any) {
          
            throw new Error("Error exporting products: " + error.message); // Include the actual error message
        }

    }

    public static async getCustomerMiniList(data: any, company: Company) {
        try {
            const companyId = company.id;

            const searchTerm = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase() + `.*$` : '[A-Za-z0-9]*'
            let offset = 0;
            let page = data.page == null || isNaN(data.page) ? 1 : data.page
            const limit = ((data.limit == null || isNaN(data.limit)) ? 15 : data.limit);
            offset = (limit * (page - 1))

            let sort = data.sortBy;
            let sortValue = !sort ? '"Customers"."createdAt"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            if (data.customerId != null && data.customerId != "") {
                sortValue = ` ("Customers".id = ` + "'" + data.customerId + "'" + ` )`
            }



            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by ` + sortTerm;


            const query = {
                text: `with "values" as (
                    select 
                    $1::uuid as "companyId" ,
                    $2 as "searchValues"
                )
            
                SELECT 
                       count(*) over(),
                        id,
                        name,
                        phone,
                        "paymentTerm",
                        saluation
                FROM "Customers"
                join "values" on true
                WHERE "Customers"."companyId" ="values"."companyId"
                and ((LOWER("Customers".name) ~ "values"."searchValues")or (LOWER("Customers".phone) ~ "values"."searchValues") or (LOWER("Customers".mobile) ~ "values"."searchValues") )
                ${orderByQuery}
                limit ${limit}
                offset ${offset}
                `,
                values: [companyId, searchTerm]
            }


            let list = await DB.excu.query(query.text, query.values);
            let count = list.rows && list.rows.length > 0 ? Number((<any>list.rows[0]).count) : 0
            let pageCount = Math.ceil(count / limit)

            offset += 1
            let lastIndex = ((page) * limit)
            if (list.rows.length < limit || page == pageCount) {
                lastIndex = count
            }
            const resData = {
                list: list.rows,
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

    public static async getCustomerRecivableByBranch(branchId: string, customerId: string) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            let receivable = await this.getReceivables(client, [customerId], branchId)
            console.log(receivable)
            let customerRecivable = receivable.length > 0 ? receivable[0].ouStandingRecievable : 0
            await client.query("COMMIT")
            return new ResponseData(true, "", { outStandingRecivable: customerRecivable })

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async getMiniCustomersByIds(data: any, company: Company) {
        try {
            let customerIds = data.customerIds;
            const query = {
                text: `SELECT id, name , phone from "Customers" where id = any($1)`,
                values: [customerIds]
            }

            let customers = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", customers.rows)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async saveCustomerNotes(data: any, employeeId: string) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")

            for (let index = 0; index < data.notes.length; index++) {
                const notes = data.notes[index];

                if ((notes.employeeId == "" || notes.employeeId == null) && (!notes.date?.trim()) && notes.isNew) {
                    data.notes[index].employeeId = employeeId;
                    data.notes[index].date = new Date();
                }
            }

            const query: { text: string, values: any } = {
                text: `UPDATE "Customers" set notes= $1 where id=$2`,
                values: [JSON.stringify(data.notes), data.customerId]
            }



            await client.query(query.text, query.values);
            await client.query("COMMIT")

            return new ResponseData(true, "", data.notes)
        } catch (error: any) {
          
            await client.query("ROLLBACK")
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }

    public static async getParentCustomers(data: any, companyId: string) {
        try {

            //####################   filter   #######################
            let filterQuery = `where "companyId" = $1 and type = 'Business' and "parentId" is null `
            let currentCustomerId = data.id
            filterQuery += currentCustomerId ? ` and "Customers".id <> '${currentCustomerId}' ` : ''

            let searchValue = data.searchTerm ? `'%` + Helper.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `%'` : null;
            if (searchValue) {
                filterQuery += `and "Customers".name ilike  ${searchValue}`
            }

            //####################   sorting  #######################
            let sort = data.sortBy;
            let sortValue = !sort ? '"Customers"."createdAt"' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? "DESC " : sort.sortDirection;

            let sortTerm = ''
            if (data.customerId != null && data.customerId != "") {
                sortTerm = ` ("Customers".id = ` + "'" + data.customerId + "'" + ` ), `
            }

            sortTerm += sortValue + " " + sortDirection;
            let orderByQuery = " ORDER BY " + sortTerm

            //####################### limit ##########################
            let offset = 0;
            let page = data.page ?? 1
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            //################### Selected data ######################
            const query: { text: string, values: any } = {
                text: `select id, name 
                        from "Customers"
                        ${filterQuery}
                        ${orderByQuery}
                        LIMIT $2 OFFSET $3 `,
                values: [companyId, limit, offset]
            }

            let selectList = await DB.excu.query(query.text, query.values)
            let list: any = []
            let count = 0
            if (selectList.rows && selectList.rows.length > 0) {
                list = selectList.rows
                count = Number((<any>selectList.rows[0]).count)
            }

            //###################   pagination   ######################
            let pageCount = Math.ceil(count / limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            //################### Response ######################
            const resData = {
                list: list,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }
            return new ResponseData(true, "", resData)

        } catch (error: any) {
            console.log(error)
          
            throw new Error(error.message)

        }
    }

    public static async getSubCustomerOverView(customerId: any, companyId: string) {
        try {

            const query: { text: string, values: any } = {
                text: ` SELECT  id,
                                name, 
                                "availableCredit" as "unusedCredit", 
                                "accountReceivable" as "outStandingRecivables"
                        FROM "Customers"
                        WHERE "companyId" = $1 and "parentId" = $2 `,
                // text: `WITH "customerIds" AS (
                //                     SELECT id ,name
                //                     FROM "Customers"
                //                     WHERE "companyId" = $1 and "parentId" = $2
                //                 )
                //                 SELECT 
                // 				id, name, 
                //                    "customerCredits"("customerIds".id) AS "unusedCredit",
                // 					"outStandingRecivable"("customerIds".id) AS "outStandingRecivables"
                //                 FROM  "customerIds"`
                values: [companyId, customerId]
            }

            const data = await DB.excu.query(query.text, query.values);
            let list: any = []
            if (data.rows && data.rows.length > 0) {
                list = data.rows
            }

            return new ResponseData(true, "", list)


        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async exportCustomerOpeningBalance(branchId: string, company: Company, type: string = 'XLSX'): Promise<string> {
        try {
            const companyId = company.id;
            const selectQuery = `--sql
             select
             "name",
             "phone",
             "CustomerOpeningBalance"."openingBalance"
             from "Customers"
             inner join "CustomerOpeningBalance" on "CustomerOpeningBalance"."customerId" = "Customers".id
             where  "Customers"."companyId" = $1
             and    ( "CustomerOpeningBalance"."branchId" = $2  )
            `;

            const selectList: any = await DB.excu.query(selectQuery, [companyId, branchId]);

            let header = [
                { id: 'name', title: 'Name' },
                { id: 'phone', title: 'Phone' },
                { id: 'openingBalance', title: 'Opening Balance' }
            ]

            let fileName = await exportHelper.exportCsvAndXlsx(company, type, 'Customers Opening Balance', selectList.rows, header)
            return fileName;



        } catch (error: any) {
          
            throw new Error("Error exporting Customers: " + error.message); // Include the actual error message
        }
    }

    public static async getCustomersIds(client: PoolClient, companyId: string, suppliers: any[]) {
        try {
            let suppliersDetails = suppliers.map((s: any) => { return { name: s.name, phone: s.phone } })
            const query = {
                text: `WITH input AS (
                            SELECT jsonb_array_elements($1::jsonb) AS elem
                        )
                        SELECT 
                            c.id,
                            c."name",
                            c."phone"
                        FROM "Customers" c
                        INNER JOIN input i 
                            ON lower(trim(c."name")) = lower(trim(i.elem->>'name'))
                        AND lower(trim(c."phone")) = lower(trim(i.elem->>'phone'))
                        WHERE c."companyId" = $2;
                   `,
                values: [JSON.stringify(suppliersDetails), companyId]
            }

            let suppliersList = await client.query(query.text, query.values);
            let supplierIds = suppliersList.rows;
            if (supplierIds && supplierIds.length > 0) {
                suppliers = suppliers.map((s: any) => {
                    let supplier = supplierIds.find(f => f.phone.trim().toLowerCase() == String(s.phone).trim().toLowerCase() && f.name.trim().toLowerCase() == s.name.trim().toLowerCase())
                    if (supplier) {
                        s.id = supplier.id
                    } else {
                        s.id = null
                    }
                    return s
                })
            }
            return suppliers;
        } catch (error: any) {
            throw new Error(error)
        }

    }


    public static async importCustomersOpeningBalance(data: any, company: Company) {
        const client = await DB.excu.client();
        try {

            let branchId = data.branchId;
            let customerData = data.customers
            const errors: any[] = [];


            const duplicates = customerData
                .map((item: any) => item.phone)
                .filter((phone: string, index: any, arr: any[]) => arr.indexOf(phone) !== index); // keep only repeated ones

            const uniqueDuplicates = [...new Set(duplicates)];

            if (uniqueDuplicates && uniqueDuplicates.length > 0) {
                throw new ValidationException("Phone Number Must be Unique")
            }


            let negtiveValues = customerData.filter((f: any) => f.openingBalance && f.openingBalance < 0)
            if (negtiveValues && negtiveValues.length > 0) {
                throw new ValidationException("Customer Opening Balance Should be Greater than 0 ")
            }
            let emptyPhones = customerData.filter((f: any) => !f.phone || (f.phone && String(f.phone).trim() == ''))
            if (emptyPhones && emptyPhones.length > 0) {
                throw new ValidationException("Customer Phone Cannot be Empty")
            }
            let emptyName = customerData.filter((f: any) => !f.name || (f.name && f.name.trim() == ''))
            if (emptyName && emptyName.length > 0) {
                throw new ValidationException("Customer Name Cannot be Empty")
            }
            customerData = customerData.filter((f: any) => (f.name && f.name.trim()) && (f.phone && String(f.phone).trim()))

            let openingBalanceCustomers: any[] = []
            const totalItems = customerData.length;
            const pageSize = 100;

            const totalPages = Math.ceil(totalItems / pageSize)
            await client.query("BEGIN")
            for (let page = 1; page <= totalPages; page++) {

                data = customerData.slice((page - 1) * pageSize, page * pageSize);
                let customers = await this.getCustomersIds(client, company.id, data)
                let notFindCustomers = customers.filter((f: any) => !f.id || f.id == null)
                notFindCustomers.forEach(element => {
                    errors.push({
                        "customerName": element.name,
                        "error": `Customer Not Found`
                    })
                });


                customers = customers.filter((f: any) => f.id && f.id != null)
                const query = {
                    text: `--sql
                    WITH input AS (
                    SELECT jsonb_array_elements(
                    $1::jsonb
                    ) AS elem
                )
                SELECT 
                     C.id,
                    CASE 
                        WHEN COALESCE(SUM(pl."amount"), 0) > COALESCE((elem->>'openingBalance')::numeric,0)::numeric 
                        THEN false 
                        ELSE true 
                    END AS "isValid",
                    (elem->>'openingBalance')::numeric as "enteredOpeningBalance",
                    COALESCE(SUM(pl."amount"), 0) as "paid",
                   cob."openingBalance" as "currentOpeningBalance",
                   cob.id as "openingBalanceId",
                    C.name as "customerName"
                FROM "Customers" C
                INNER JOIN input i 
                    ON C.id = (i.elem->>'id')::uuid
                LEFT JOIN "CustomerOpeningBalance" cob 
                    ON cob."customerId" =  C.id 
                AND cob."branchId" =$2
                LEFT JOIN "InvoicePaymentLines" pl 
                    ON pl."openingBalanceId" = cob.id
                WHERE C."companyId" = $3
                GROUP BY C.id, i.elem, cob .id , C.name ;`,
                    values: [JSON.stringify(customers), branchId, company.id]
                }

                let supplierValidation = await client.query(query.text, query.values);
                let invalidSuppliers = supplierValidation.rows.filter((f: any) => !f.isValid)
                if (invalidSuppliers && invalidSuppliers.length > 0) {
                    invalidSuppliers.forEach((s: any) => {
                        errors.push({
                            "customerName": s.customerName,
                            "error": `The Opening Balance Entered ${s.enteredOpeningBalance ?? 0} is less than the paid amount  ${s.paid}`
                        })
                    })
                }
                customers = supplierValidation.rows.filter((f: any) => f.isValid)

                let newOpeningBalance = customers.filter((f: any) => (!f.openingBalanceId || f.openingBalanceId == null) && (f.enteredOpeningBalance && f.enteredOpeningBalance > 0))
                let updateOpeningBalance = customers.filter((f: any) => (f.openingBalanceId && f.openingBalanceId != null && (f.enteredOpeningBalance != f.currentOpeningBalance)))
                /** update supplier */
                if (updateOpeningBalance.length > 0) {
                    const updateValues = updateOpeningBalance.map((u: any) => [
                        u.id ?? null,
                        u.enteredOpeningBalance ?? null,
                        branchId ?? null
                    ]);
                    if (updateValues.length > 0) {
                        const formattedQuery = format(`
                    UPDATE "CustomerOpeningBalance" AS COB
                    SET "openingBalance" = COALESCE(v.openingBalance::numeric,0)::numeric
                    FROM (VALUES %L) AS v(customerId, openingBalance, branchId)
                    WHERE COB."customerId" = v.customerId::uuid
                    AND COB."branchId" = v.branchId::uuid
                `, updateValues);

                        await client.query(formattedQuery);
                    }
                    updateOpeningBalance.forEach(element => {
                        openingBalanceCustomers.push(element.id)
                    });
                }

                if (newOpeningBalance.length > 0) {


                    const insertValues = newOpeningBalance.map((u: any) => [
                        u.id ?? null,
                        u.enteredOpeningBalance ?? null,
                        branchId ?? null,
                        company.id
                    ]);


                    if (insertValues.length > 0) {
                        const insertQuery = format(`
                        INSERT INTO "CustomerOpeningBalance" 
                            ("customerId", "openingBalance", "branchId", "companyId")
                        VALUES %L `, insertValues);

                        await client.query(insertQuery);
                    }

                    newOpeningBalance.forEach(element => {
                        openingBalanceCustomers.push(element.id)
                    });
                }
            }
            await client.query('COMMIT')

            if (openingBalanceCustomers && openingBalanceCustomers.length > 0) {
                let queueInstance = TriggerQueue.getInstance();
                openingBalanceCustomers.forEach(element => {
                    queueInstance.createJob({ type: "CustomerOpeningBalance", id: element, companyId: company.id })

                    let userBalancesQueue = CustomerBalanceQueue.getInstance();
                    userBalancesQueue.createJob({ userId: element, dbTable: 'CustomerOpeningBalance' })
                });
            }


            return new ResponseData(true, "", { errors: errors })


        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }

    }

    public static async customerListMini(company: Company, data: any) {
        try {

            const searchTerm = data &&data.searchTerm ? `%${data.searchTerm.toLowerCase().trim()}%` : null
            const customerIds = data && data.customerIds && Array.isArray(data.customerIds) ? `(${data.customerIds.map((id: any) => `'${id}'`).join(",")})` : null;
            const sortBy = customerIds ? `"Customers".id in ${customerIds}` : `"Customers"."createdAt"`
            const orderByQuery = `Order by ${sortBy} DESC`
            const page = data &&data.page ? data.page:  1
            const limit = data&& data.limit ?data.limit :  15
            const offset = limit * (page - 1);
            const limitQuery = `
                limit ${limit}
                offset ${offset}
            `
            const query = {
                text: `SELECT count(*) over() as "count",id , "name" from "Customers" 
                where "companyId"= $1 
                and ($2::text is null or (lower(trim("name")) ilike $2 or lower(trim("phone")) ilike $2 ))
                ${orderByQuery}
                ${limitQuery}
                `,
                values: [company.id, searchTerm]
            }

            const customers = await DB.excu.query(query.text, query.values);
            const resData: { list: any, count: number, pageCount: number, startIndex: number, lastIndex: number } = {
                list: [],
                count: 0,
                pageCount: 0,
                startIndex: 0,
                lastIndex: 0
            }
            if (customers && customers.rows.length > 0) {

                const count = customers.rows[0].count;
                const pageCount = Math.ceil(count / limit)
                let lastIndex = ((page) * limit)
                if (customers.rows.length < limit || page == pageCount) {
                    lastIndex = count
                }

                resData.list = customers.rows
                resData.count = count
                resData.pageCount = pageCount
                resData.startIndex = offset +1 
                resData.lastIndex = lastIndex

            }
             return new ResponseData(true,"",resData)
        } catch (error: any) {
            throw new Error(error)
        }
    }
}