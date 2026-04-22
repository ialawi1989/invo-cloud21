import { DB } from "@src/dbconnection/dbconnection";
import { Supplier } from "@src/models/account/Supplier";
import { SupplierItem } from "@src/models/account/SupplierItem";
import { ResponseData } from "@src/models/ResponseData";
import { SupplierValidation } from "@src/validationSchema/account/suppliers.Schema";
import { PoolClient } from "pg";
import { ProductRepo } from "../product/product.repo";

import { Company } from "@src/models/admin/company";
import { ValidationException } from "@src/utilts/Exception";
import { BillingPaymentLine } from "@src/models/account/BillingPaymentLines";
import { TimeHelper } from "@src/utilts/timeHelper";
import moment from "moment";
import { ValidateReq } from "@src/validationSchema/validator";
import { RedisClient } from '@src/redisClient';
import { Helper } from "@src/utilts/helper";
import { ReportData } from "@src/utilts/xlsxGenerator";
import { exportHelper } from "@src/utilts/ExportHelper";
import { TelemetryAttributes } from "bullmq";
import format from "pg-format";
import { TriggerQueue } from "@src/repo/triggers/triggerQueue";
import { SupplierBalanceQueue } from "@src/repo/triggers/userBalancesQueue";
import { TableConfig, TableDataService, TableRequest } from "@src/utilts/TableDataService";
import { getValuable } from "@src/utilts/getValuable";
import { CustomizationRepo } from "../settings/Customization.repo";

export class SupplierRepo {

    public static async checkIfSupplierPhoneExist(client: PoolClient, id: string | null, phones: any[], companyId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `select count(*) as qty from "Suppliers" where  "companyId" = $1 and ("phone" =ANY( $2 ) )`,
                values: [companyId, phones],
            }
            if (id != null) {
                query.text = `select count(*) as qty from "Suppliers" where   "companyId" = $1 and id <>$2 and ("phone" = ANY($3) ) `
                query.values = [companyId, id, phones]
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

    public static async checkIfSupplierEmailExist(client: PoolClient, id: string | null, emails: any[], companyId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `select count(*) as qty from "Suppliers" where  "companyId" = $1 and ("email" =ANY( $2 ) )`,
                values: [companyId, emails],
            }
            if (id != null) {
                query.text = `select count(*) as qty from "Suppliers" where   "companyId" = $1 and id <>$2 and ("email" = ANY($3) ) `
                query.values = [companyId, id, emails]
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
    public static async checkIfSupplierProductExist(client: PoolClient, supplierId: string, productId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT COUNT(*) AS qty from "SupplierItems" where "productId" =$1 and "supplierId"=$2`,
                values: [productId, supplierId]
            }

            let product = await client.query(query.text, query.values);

            if (product.rows[0].qty > 0) {
                return true
            }

            return false
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }



    public static async addSupplier(data: any, company: Company) {
        const client = await DB.excu.client()
        try {
            const companyId = company.id;
            const validate = await SupplierValidation.supplierValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            await client.query("BEGIN")

            const supplier = new Supplier();
            supplier.ParseJson(data);
            supplier.companyId = companyId
            supplier.updatedDate = new Date()


            let phones: any[] = [];
            let emails: any[] = [];

            if (supplier.phone)
                phones.push(supplier.phone);

            if (supplier.email)
                emails.push(supplier.email)

            supplier.contacts.forEach((element: any) => {
                if (element.phone) {
                    phones.push(element.phone)
                }
                if (element.email) {
                    emails.push(element.email)
                }
            });
            const isSupplierPhoneExist = await this.checkIfSupplierPhoneExist(client, null, phones, company.id)
            if (isSupplierPhoneExist) {
                throw new ValidationException("Supplier Phone  Already Used")
            }


            const isSupplierEmailExist = await this.checkIfSupplierEmailExist(client, null, emails, company.id)
            if (isSupplierEmailExist) {
                throw new ValidationException("Supplier Email  Already Used")
            }
            const query: { text: string, values: any } = {
                text: `INSERT INTO "Suppliers" (name,code,address,phone,email,website,note,"companyId",contacts,"country","vatNumber","currencyId","updatedDate","costCenter","paymentTerm") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id `,
                values: [supplier.name,
                supplier.code,
                supplier.address,
                supplier.phone,
                supplier.email,
                supplier.website,
                supplier.note,
                supplier.companyId,
                JSON.stringify(supplier.contacts),
                supplier.country,
                supplier.vatNumber,
                supplier.currencyId,
                supplier.updatedDate,
                supplier.costCenter,
                supplier.paymentTerm
                ]
            }

            const insert = await client.query(query.text, query.values);
            supplier.id = (<any>insert.rows[0]).id



            for (let index = 0; index < supplier.supplierItems.length; index++) {
                const element = supplier.supplierItems[index];
                const temp = new SupplierItem();
                temp.ParseJson(element);
                temp.supplierId = supplier.id;
                await this.addSupplierItems(client, temp, companyId)

            }
            if (supplier.openingBalance != null && Array.isArray(supplier.openingBalance)) {
                for (let index = 0; index < supplier.openingBalance.length; index++) {
                    const element: any = supplier.openingBalance[index];
                    if (element.branchId != null && element.branchId != '') {
                        query.text = `INSERT INTO "SupplierOpeningBalance" ("supplierId","branchId","companyId","openingBalance") VALUES($1,$2,$3,$4)`
                        query.values = [supplier.id, element.branchId, companyId, element.openingBalance]

                        await client.query(query.text, query.values)
                    }
                }
            }



            await client.query("COMMIT")
            const insertData = {
                id: supplier.id
            }
            return new ResponseData(true, "Added Successfully", insertData)
        } catch (error: any) {

          
            await client.query("ROLLBACK")

            throw new Error(error.message)
        } finally {
            client.release()
        }
    }
    public static async addSupplierItems(client: PoolClient, supplierItem: SupplierItem, companyId: string) {
        try {

            //check item type most be [Inventory, batch, serial ]
            const types: any[string] = ['inventory', 'serialized', 'batch']
            const productId = supplierItem.productId;

            const isValidType = ProductRepo.checkIfProductsTypeValid(client, [productId], types, companyId)
            if (!isValidType) {
                throw new ValidationException("Invalid Product Type");
            }


            const query: { text: string, values: any } = {
                text: `INSERT INTO "SupplierItems" ("supplierId","minimumOrder",cost,"supplierCode","productId") VALUES ($1,$2,$3,$4,$5) RETURNING id`,
                values: [supplierItem.supplierId, supplierItem.minimumOrder, supplierItem.cost, supplierItem.supplierCode, supplierItem.productId]
            }

            await client.query(query.text, query.values);
        } catch (error: any) {
          
            console.log(error)
            throw new Error(error)
        }
    }

    public static async editSupplier(data: any, company: Company) {
        const client = await DB.excu.client();
        try {
            const companyId = company.id;
            const validate = await SupplierValidation.supplierValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            await client.query("BEGIN")
            const supplier = new Supplier();
            supplier.ParseJson(data);
            supplier.companyId = companyId
            if (supplier.id == null || supplier.id == "") {
                throw new ValidationException("Supplier Id is Required");
            }
            let phones: any[] = [];
            let emails: any[] = [];

            if (supplier.phone)
                phones.push(supplier.phone);

            if (supplier.email)
                emails.push(supplier.email)

            supplier.contacts.forEach((element: any) => {
                if (element.phone) {
                    phones.push(element.phone)
                }
                if (element.email) {
                    emails.push(element.email)
                }
            });
            const isSupplierPhoneExist = await this.checkIfSupplierPhoneExist(client, supplier.id, phones, company.id)
            if (isSupplierPhoneExist) {
                throw new ValidationException("Supplier Phone  Already Used")
            }


            const isSupplierEmailExist = await this.checkIfSupplierEmailExist(client, supplier.id, emails, company.id)
            if (isSupplierEmailExist) {
                throw new ValidationException("Supplier Email  Already Used")
            }
            supplier.updatedDate = new Date()
            const query: { text: string, values: any } = {
                text: `UPDATE "Suppliers" SET name=$1,code=$2,address=$3,phone=$4,email=$5,website=$6,note=$7,contacts=$8,"country"=$9,"vatNumber"=$10,"currencyId"=$11,"updatedDate"=$12,"costCenter"=$13 , "paymentTerm" = $14 WHERE id=$15 AND "companyId"=$16 `,
                values: [supplier.name,
                supplier.code,
                supplier.address,
                supplier.phone,
                supplier.email,
                supplier.website,
                supplier.note,
                JSON.stringify(supplier.contacts),
                supplier.country,
                supplier.vatNumber,
                supplier.currencyId,
                supplier.updatedDate,
                supplier.costCenter,
                supplier.paymentTerm,
                supplier.id,
                supplier.companyId]
            }
            for (let index = 0; index < supplier.supplierItems.length; index++) {
                const element = supplier.supplierItems[index];
                const temp = new SupplierItem();
                temp.ParseJson(element);
                temp.supplierId = supplier.id
                if (temp.id == null || temp.id == "") {
                    await this.addSupplierItems(client, temp, companyId)
                } else {
                    if (temp.isDeleted && temp.id != "" && temp.id != null) {
                        await this.deleteSupplierItem(client, temp.id)
                    } else {
                        await this.editSupplierItem(client, temp)

                    }
                }

            }
            const update = await client.query(query.text, query.values);
            await client.query("COMMIT")
            return new ResponseData(true, "Updated Successfully", [])
        } catch (error: any) {
            await client.query("ROLLBACK")
          

            throw new Error(error)
        } finally {
            client.release()
        }
    }
    public static async editSupplierItem(client: PoolClient, supplierItem: SupplierItem) {

        try {
            const query: { text: string, values: any } = {
                text: `UPDATE "SupplierItems" SET "minimumOrder"=$1,cost=$2,"supplierCode"=$3 WHERE id=$4 AND "supplierId"=$5`,
                values: [supplierItem.minimumOrder, supplierItem.cost, supplierItem.supplierCode, supplierItem.id, supplierItem.supplierId]
            }

            await client.query(query.text, query.values);
        } catch (error: any) {
          
            console.log(error)
            throw new Error(error)
        }
    }



    public static async getPayables(client: PoolClient, supplierIds: any[], branchId: string | null = null) {
        try {
            const query = {
                text: `  with "supplier" as (
                        select "Suppliers".id
                            from "Suppliers"
                        where id = any($1)
                        )
                        ,"openingBalance" as (
                        select 
                            "supplier"."id" as "supplierId",
                            sum("SupplierOpeningBalance"."openingBalance"::text::numeric)  as total 
                            from "SupplierOpeningBalance" 
                        inner join "supplier" on "SupplierOpeningBalance"."supplierId" = "supplier".id 
                            where ($2::uuid is null or "SupplierOpeningBalance"."branchId"=$2)
                        group by  "supplier"."id"
                        )
                        ,"billings" as (
                        select "Billings".id,
                            "Billings"."supplierId",
                            "Billings".total - SUM(COALESCE("BillingPaymentLines".amount::text::numeric,0))as total 
                            from "Billings" 
                        left join "BillingPaymentLines" on "BillingPaymentLines"."billingId" = "Billings".id
                        inner join "supplier" on "Billings"."supplierId" = "supplier".id 
                                where ($2::uuid is null or "Billings"."branchId"=$2)
                            group by "Billings".id
                        ),"billingCredits" as(
                        select 
                        "billings".id,
                        "billings"."supplierId",
                        "billings".total - sum(COALESCE("SupplierCreditLines".total::text::numeric,0))as total
                        from "billings"
						inner join "BillingLines" on "BillingLines"."billingId" = "billings".id 
                        left join "SupplierCreditLines" on "SupplierCreditLines"."billingLineId" = "BillingLines".id 
                        group by "billings".id,"billings"."supplierId","billings".total
                        ),"appliedCredits" as (
                        select "billingCredits".id,
                        "billingCredits"."supplierId",
                        "billingCredits".total - sum(COALESCE("SupplierAppliedCredits".amount::text::numeric,0)) as total
                            from "billingCredits"
                        left join "SupplierAppliedCredits" on "SupplierAppliedCredits"."billingId" = "billingCredits".id 
                        group by "billingCredits".id,"billingCredits"."supplierId","billingCredits".total
                        )
                        ,"billingsTotal" as (
                        select "appliedCredits"."supplierId",
                            sum(case when "appliedCredits".total>0 then "appliedCredits".total::text::numeric else 0 end ) as total 
                            from "appliedCredits"
                            group by "appliedCredits"."supplierId"
                        ),"openingBalancePayments" as(
                        select 
                            "supplier".id as "supplierId",
                            COALESCE(sum("BillingPaymentLines".amount::text::numeric),0) as total
                            from "BillingPayments"
                        inner join "supplier" on "supplier".id =  "BillingPayments"."supplierId" 
                        inner join "BillingPaymentLines" on "BillingPaymentLines"."billingPaymentId" = "BillingPayments".id and "BillingPaymentLines"."billingId" is null and"BillingPaymentLines"."openingBalanceId" is not null  
                                    where ($2::uuid is null or "BillingPayments"."branchId"=$2)
                        group by "supplier".id 
                        )

                        select COALESCE("billingsTotal".total::text::numeric,0) + (COALESCE("openingBalance"."total"::text::numeric,0)- COALESCE("openingBalancePayments"."total"::text::numeric,0)) as "outStandingPayable" ,"supplier".id  from "supplier"
                        left join "billingsTotal" on "billingsTotal"."supplierId" = "supplier".id
                        left join "openingBalancePayments" on "supplier".id =  "openingBalancePayments"."supplierId"
                        left join "openingBalance" on "openingBalance"."supplierId" = "supplier".id`,
                values: [supplierIds, branchId]
            }

            const payables = await client.query(query.text, query.values);

            return payables.rows && payables.rows.length > 0 ? payables.rows : []
        } catch (error: any) {
            throw new Error(error)
        }
    }

 public static async getSupplierList(data: any, company: Company, branchList: [] = []): Promise<ResponseData> {
    try {
        const companyId = company.id;

        // --- Normalize paging/sorting/search ---
        const page = Number.isFinite(+data?.page) && +data.page > 0 ? +data.page : 1;
        const limit = Number.isFinite(+data?.limit) && +data.limit > 0 ? +data.limit : 15;

        const searchTerm: string | undefined =
            typeof data?.searchTerm === 'string' && data.searchTerm.trim() !== ''
                ? data.searchTerm.trim()
                : undefined;

        const supplierIds: string[] = data?.supplierIds ?? [];

        // --- Sorting ---
        const incomingSortBy = data?.sortBy?.sortValue as string | undefined;
        const incomingSortDir = String(data?.sortBy?.sortDirection || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const sortByKey = incomingSortBy ? incomingSortBy : 'createdAt';
        const sortDir = incomingSortDir;

        // --- TableDataService config for Suppliers ---
        const aliasMap = { s: 'Suppliers' } as const;

        const joinDefs = {
            // Example if Suppliers had a related table (branches/customers/etc.)
            // joinBranch: { joinTable: 'b', onLocal: 's.branchId', onForeign: 'b.id' },
        };

        const columnMap: TableConfig['columnMap'] = {
            id: { table: 's', dbCol: 'id' },
            name: { table: 's', dbCol: 'name' },
            phone: { table: 's', dbCol: 'phone' },
            email: { table: 's', dbCol: 'email' },
            code: { table: 's', dbCol: 'code' },
            outStandingPayable: { table: 's', dbCol: 'outStandingPayable', cast: 'numeric' },
            createdAt: { table: 's', dbCol: 'createdAt', cast: 'timestamp' },
            companyId: { table: 's', dbCol: 'companyId' },

            
            time: { rawExpr: `s."createdAt"::timestamp::time`, table: 's', dbCol: 'createdAt' }


        };


        const supplierCF = await CustomizationRepo.getCustomizationByKey('supplier', 'customFields', company);
        for (const field of (supplierCF?.data?.customFields || [])) {
            const key = String(field.id).replace(/"/g, '');
            const outKey = String(field.abbr || key).replace(/\s+/g, '_');
            columnMap[outKey] = { table: 's', dbCol: 'customFields', jsonKV: { key: field.id, cast: 'text' } };
        }

        

        const searchableColumns = ['name', 'phone', 'email', 'code'];
        const DEFAULT_COLUMNS = ['id', 'name', 'phone', 'email', 'code', 'outStandingPayable', 'createdAt'];
        const selectableColumns = [...DEFAULT_COLUMNS, ...Object.keys(columnMap).filter(k => !DEFAULT_COLUMNS.includes(k))];

        const SupplierConfig: TableConfig = {
            aliasMap: aliasMap as any,
            columnMap,
            joinDefs,
            searchableColumns,
            selectableColumns,
        };

        const service = new TableDataService(SupplierConfig);

        // --- Build filters ---
        const filters: TableRequest['filters'] = [{ column: 'companyId', operator: 'eq', value: companyId }];

        if (supplierIds.length) filters.push({ column: 'id', operator: 'in', value: supplierIds });

        // --- Columns selection ---
        const userCols = Array.isArray(data?.columns) ? (data.columns as string[]).map(String) : DEFAULT_COLUMNS;
        let selectColumns = userCols.filter(c => selectableColumns.includes(c));
        if (!selectColumns.length) selectColumns = DEFAULT_COLUMNS;
        if (!selectColumns.includes('id')) selectColumns.push('id');

        // --- Build TableRequest ---
        const req: TableRequest = {
            table_name: 'Suppliers',
            select_columns: selectColumns as any,
            filters,
            search_term: searchTerm,
            sort_by: selectableColumns.includes(sortByKey) ? (sortByKey as any) : ('createdAt' as any),
            sort_order: sortDir,
            page_number: page,
            page_size: limit,
        };

        // --- Execute via TableDataService ---
        const result = await service.getTableData<any>(req);

        // --- Map response ---
        const list = result.data;
        const total_count = result.total_count;
        const pageCount = Math.ceil(total_count / limit) || 1;
        const startIndex = (page - 1) * limit + 1;
        const lastIndex = Math.min(page * limit, total_count);

        const resData = {
            list,
            count: total_count,
            pageCount,
            startIndex,
            lastIndex,
        };

        return new ResponseData(true, '', resData);
    } catch (error: any) {
      
        throw new Error(error?.message ?? String(error));
    }
}




    public static async getSupplierList1(data: any, company: Company) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            const companyId = company.id;

            const searchTerm = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase() + `.*$` : '[A-Za-z0-9]*'
            let offset = 0;
            let page = data.page == null || isNaN(data.page) ? 1 : data.page
            const limit = ((data.limit == null || isNaN(data.limit)) ? 15 : data.limit);
            offset = (limit * (page - 1))

            let sort = data.sortBy;
            let sortValue = !sort ? '"Suppliers"."createdAt"' : '"' + sort.sortValue + '"';
            if (data.supplierId != null && data.supplierId != "") {
                sortValue = ` ("Suppliers".id = ` + "'" + data.supplierId + "'" + ` )`
            }
            let sortDirection = !sort ? "DESC" : sort.sortDirection;


            let supplierIds = data.supplierIds ?? []
            if (supplierIds && supplierIds.length > 0) {
                sortValue = ` case when ("Suppliers".id = any(values."supplierIds")) then 1 end	 `
                sortDirection = ``
            }



            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by ` + sortTerm;

            const query = {
                text: `with "values" as (
                                select 
                                $1::uuid as "companyId" ,
                                $2 as "searchValues", 
                                $3::uuid[] as "supplierIds"
                            ),
                        "supplierList" as (
                        SELECT 
                                count(*) over(),
                                "Suppliers".id,
                                "Suppliers".name,
                                "Suppliers".phone,
                                "Suppliers".email,
                                "Suppliers".code,
                                "Suppliers"."outStandingPayable"
                        FROM "Suppliers"
                        join "values" on true
                        WHERE "Suppliers"."companyId" ="values"."companyId"
                        and ((LOWER("Suppliers".name) ~ "values"."searchValues")or (LOWER("Suppliers".phone) ~ "values"."searchValues") or (LOWER("Suppliers".code) ~ "values"."searchValues") )
                        ${orderByQuery}
                        limit ${limit}
                        offset ${offset}
                        )
                    select "supplierList".*
                    from "supplierList" 
              `,
                values: [companyId, searchTerm, supplierIds]
            }


            let list = await client.query(query.text, query.values);
            let count = list.rows && list.rows.length > 0 ? Number((<any>list.rows[0]).count) : 0
            let pageCount = Math.ceil(count / limit)

            const ids: any[] = []
            list.rows.forEach((element: any) => {
                ids.push(element.id)
            });

            // let receivables = await this.getPayables(client, ids)
            // console.log(receivables)
            // if (receivables && receivables.length > 0) {
            //     list.rows = list.rows.map((f) => {
            //         let customer = receivables.find(customer => f.id == customer.id)
            //         if (customer) {
            //             f.outStandingPayable = customer.outStandingPayable
            //         }

            //         return f
            //     })
            // }

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
            await client.query("COMMIT")
            return new ResponseData(true, "", resData)

        } catch (error: any) {
            await client.query("ROLLBACK")
          
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }

    public static async getSupplierMiniList(data: any, company: Company) {
        try {
            const companyId = company.id;

            const searchTerm = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase() + `.*$` : '[A-Za-z0-9]*'
            let offset = 0;
            let page = data.page == null || isNaN(data.page) ? 1 : data.page
            const limit = ((data.limit == null || isNaN(data.limit)) ? 15 : data.limit);
            offset = (limit * (page - 1))

            let sort = data.sortBy;
            let sortValue = !sort ? '"Suppliers"."createdAt"' : '"' + sort.sortValue + '"';
            if (data.supplierId != null && data.supplierId != "") {
                sortValue = ` ("Suppliers".id = ` + "'" + data.supplierId + "'" + ` )`
            }
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by ` + sortTerm;

            const query = {
                text: `with "values" as (
                                select 
                                $1::uuid as "companyId" ,
                                $2 as "searchValues"
                            ),
                        "supplierList" as (
                        SELECT 
                                count(*) over(),
                                "Suppliers".id,
                                "Suppliers".name,
                                "Suppliers".phone,
                                "Suppliers"."costCenter",
                                 case when  COALESCE(NULLIF("Suppliers"."country", ''), NULL)  is not null and "Suppliers"."country" <>'${company.country}' then true else false end as "allowBillOfEntry",
                                "Suppliers".code,
                                    "paymentTerm" 
                        FROM "Suppliers"
                        join "values" on true
                        WHERE "Suppliers"."companyId" ="values"."companyId"
                        and ((LOWER("Suppliers".name) ~ "values"."searchValues")or (LOWER("Suppliers".phone) ~ "values"."searchValues") or (LOWER("Suppliers".code) ~ "values"."searchValues") )
                        ${orderByQuery}
                        limit ${limit}
                        offset ${offset}
                        )
                    select "supplierList".*
                    from "supplierList" 
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
          
            throw new Error(error.message)
        }
    }
    public static async getSupplierById(supplierId: any, company: Company) {
        try {
            const companyId = company.id;
            const query: { text: string, values: any } = {
                text: `SELECT 
                Suppliers.id,
                Suppliers.name,
                Suppliers.code,
                Suppliers.address,
                Suppliers.phone,
                Suppliers.email,
                Suppliers.website,
                Suppliers.country,
                Suppliers.note,
                Suppliers.contacts,
                Suppliers."openingBalance",
                Suppliers."vatNumber",
                Suppliers."paymentTerm",
                Suppliers."currencyId",
                Suppliers."costCenter"
               FROM "Suppliers" AS Suppliers
               WHERE 
                Suppliers."companyId"=$1 
               AND Suppliers.id = $2`,
                values: [companyId, supplierId]
            }
            const supplier = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", supplier.rows[0])
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getSupplierBills(client: PoolClient, supplierId: string, branchId: string) {

        try {

            const query: { text: string, values: any } = {
                text: `WITH "billings" as  (
                    SELECT
                                    "Billings".id AS "billingId",
                                    "Billings".total::text::numeric,
                                    "Billings"."billingNumber",
                                    "Billings"."billingDate"
                            FROM "Billings"
                         WHERE "Billings"."supplierId" =$1
                            and "Billings"."branchId" =$2
                            and "Billings".status <> 'Draft'
                    ),"supplierCredits" as (
                    
                    select "billings"."billingId",sum("SupplierCredits"."total"::text::numeric)as "total" from "SupplierCredits" join "billings" on "billings"."billingId" = "SupplierCredits"."billingId"
                    group by "billings"."billingId"
                    ),"billingPayment" as (
                    
                    select "billings"."billingId",sum("BillingPaymentLines"."amount"::text::numeric) as "total" from "BillingPaymentLines" join "billings" on "billings"."billingId" = "BillingPaymentLines"."billingId"
                    group by "billings"."billingId"
                    ),"appliedCredit" as (
                    
                    select "billings"."billingId",sum("SupplierAppliedCredits"."amount"::text::numeric) as "total" from "SupplierAppliedCredits" join "billings" on "billings"."billingId" = "SupplierAppliedCredits"."billingId"
                    group by "billings"."billingId"
                    )
                    
                    select "billings"."billingId",
                           "billings"."total",
                            "billings"."billingNumber",
                             "billings"."billingDate",
                             COALESCE("supplierCredits"."total"::text::numeric,0)+COALESCE("billingPayment"."total"::text::numeric,0) +  COALESCE("appliedCredit"."total"::text::numeric,0) as"paidAmount"
                    from "billings"
                    left join "supplierCredits" on "supplierCredits"."billingId" = "billings"."billingId"
                    left join "billingPayment" on "billingPayment"."billingId" = "billings"."billingId"
                    left join "appliedCredit" on "appliedCredit"."billingId" = "billings"."billingId"
                    group by  "billings"."billingId",
                           "billings"."total",
                            "billings"."billingNumber",
                             "billings"."billingDate",
                             "billingPayment"."total",
                             "appliedCredit"."total",
                             "supplierCredits"."total"
                             having   "billings"."total" - ( COALESCE("billingPayment"."total"::text::numeric,0) +  COALESCE("appliedCredit"."total"::text::numeric,0)  + COALESCE("supplierCredits"."total"::text::numeric,0)) >0 
                    
                      ORDER BY "billings"."billingDate" asc
         `,
                values: [supplierId, branchId]
            }
            const bills = await client.query(query.text, query.values)

            let billsTemp: any[] = bills.rows ?? []
            //  Get Supplier Opening Balance 
            const supplierBalance: any = await this.getSupplierOpeningBalance(supplierId, branchId);
            if (supplierBalance) {
                let supplierOpeningBalance = new BillingPaymentLine();
                supplierOpeningBalance.billingNumber = "Opening Balance"
                supplierOpeningBalance.note = "Opening Balance"
                if (supplierBalance) {
                    supplierOpeningBalance.openingBalanceId = supplierBalance.id;
                    supplierOpeningBalance.billingDate = supplierBalance.createdAt;
                    supplierOpeningBalance.total = supplierBalance.amount;
                    supplierOpeningBalance.paidAmount = supplierBalance.paid;
                    billsTemp.push(supplierOpeningBalance)
                }



            }

            return new ResponseData(true, "", billsTemp)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }
    public static async getSupplierBillsForAllBranches(supplierId: string, companyId: string) {

        try {

            const query: { text: string, values: any } = {
                text: `WITH "billings" as  (
                    SELECT
                                    "Billings".id AS "billingId",
                                    "Billings".total::text::numeric,
                                    "Billings"."billingNumber",
                                    "Billings"."billingDate",
                                    "Billings"."branchId",
                                    "Branches".name as "branchName"
                            FROM "Billings"
                            inner join "Branches" on "Branches".id = "Billings"."branchId"
                         WHERE "Billings"."supplierId" =$1
                            and "Branches"."companyId" =$2
                            and "Billings".status <> 'Draft'
                    ),"supplierCredits" as (
                    
                    select "billings"."billingId",sum("SupplierCredits"."total")as "total" from "SupplierCredits" join "billings" on "billings"."billingId" = "SupplierCredits"."billingId"
                    group by "billings"."billingId"
                    ),"billingPayment" as (
                    
                    select "billings"."billingId",sum("BillingPaymentLines"."amount") as "total" from "BillingPaymentLines" join "billings" on "billings"."billingId" = "BillingPaymentLines"."billingId"
                    group by "billings"."billingId"
                    ),"appliedCredit" as (
                    
                    select "billings"."billingId",sum("SupplierAppliedCredits"."amount") as "total" from "SupplierAppliedCredits" join "billings" on "billings"."billingId" = "SupplierAppliedCredits"."billingId"
                    group by "billings"."billingId"
                    )
                    
                    select "billings"."billingId",
                           "billings"."total",
                            "billings"."billingNumber",
                            "billings"."billingDate",
                            "billings"."branchId",
                            "billings"."branchName",
                            COALESCE("supplierCredits"."total"::text::numeric,0)+COALESCE("billingPayment"."total"::text::numeric,0) +  COALESCE("appliedCredit"."total"::text::numeric,0) as"paidAmount"
                    from "billings"
                    left join "supplierCredits" on "supplierCredits"."billingId" = "billings"."billingId"
                    left join "billingPayment" on "billingPayment"."billingId" = "billings"."billingId"
                    left join "appliedCredit" on "appliedCredit"."billingId" = "billings"."billingId"
                    group by    "billings"."billingId",
                                "billings"."total",
                                "billings"."billingNumber",
                                "billings"."billingDate",
                                "billings"."branchId",
                                "billings"."branchName",
                                "billingPayment"."total",
                                "appliedCredit"."total",
                                "supplierCredits"."total"
                                having   "billings"."total" - ( COALESCE("billingPayment"."total"::text::numeric,0) +  COALESCE("appliedCredit"."total"::text::numeric,0)  + COALESCE("supplierCredits"."total"::text::numeric,0)) >0 

                    ORDER BY "billings"."billingDate" asc
         `,
                values: [supplierId, companyId]
            }
            const bills = await DB.excu.query(query.text, query.values)

            let billsTemp: any[] = bills.rows ?? []


            //  Get Supplier Opening Balance 
            const supplierBalance: any = await this.getSupplierOpeningBalance(supplierId);
            if (supplierBalance) {

                supplierBalance.forEach((element: any) => {
                    let supplierOpeningBalance: any = new BillingPaymentLine();
                    supplierOpeningBalance.ParseJson(element)
                    supplierOpeningBalance.createdAt = element.date
                    supplierOpeningBalance.total = element.amount
                    supplierOpeningBalance.branchName = element.branchName
                    supplierOpeningBalance.paidAmount = element.paid
                    supplierOpeningBalance.amount = 0
                    billsTemp.push(supplierOpeningBalance)
                });


            }

            return new ResponseData(true, "", billsTemp)
        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }


    public static async getSupplierOpeningBalance(supplierId: string, branchId: string | null = null) {
        try {
            const query: { text: string, values: any } = {
                text: `select "SupplierOpeningBalance".id, "SupplierOpeningBalance"."openingBalance" as  amount,COALESCE(sum("BillingPaymentLines"."amount"),0) AS "paid" ,
                               "SupplierOpeningBalance"."branchId",
                               "Branches"."name" as "branchName",
                                case when "Branches"."openingBalanceDate" is null then "Companies"."createdAt" - interval '1 day' else "Branches"."openingBalanceDate" end "date" 
                from "SupplierOpeningBalance" 
                Left join "BillingPaymentLines" on "BillingPaymentLines"."openingBalanceId" = "SupplierOpeningBalance".id
                      left join "Branches" on "Branches".id = "SupplierOpeningBalance"."branchId"
                left join "Companies" on "Companies".id = "Branches"."companyId"
                where "SupplierOpeningBalance"."supplierId" = $1
                and ($2::uuid is null or "SupplierOpeningBalance"."branchId" = $2)
                group by  "SupplierOpeningBalance"."supplierId","SupplierOpeningBalance".id ,"date", "Branches".id
                HAVING "SupplierOpeningBalance"."openingBalance" - COALESCE(sum("BillingPaymentLines"."amount"),0)>0 `,
                values: [supplierId, branchId]
            }

            query.text = `select 
                'Opening Balance' as "billingNumber",
                'Opening Balance' as "note",
                "SupplierOpeningBalance".id as "openingBalanceId",
                "SupplierOpeningBalance"."openingBalance" as  amount,COALESCE(sum("BillingPaymentLines"."amount"),0) AS "paid" ,
                "SupplierOpeningBalance"."branchId",
                 "Branches".name as "branchName", 
                case when "Branches"."openingBalanceDate" is null then "Companies"."createdAt" - interval '1 day' else "Branches"."openingBalanceDate" end "date" 
                from "SupplierOpeningBalance" 
                Left join "BillingPaymentLines" on "BillingPaymentLines"."openingBalanceId" = "SupplierOpeningBalance".id
                      left join "Branches" on "Branches".id = "SupplierOpeningBalance"."branchId"
                left join "Companies" on "Companies".id = "Branches"."companyId"
                where "SupplierOpeningBalance"."supplierId" =$1
                and ($2::uuid is null or "SupplierOpeningBalance"."branchId" = $2)
                group by  "SupplierOpeningBalance"."supplierId","SupplierOpeningBalance".id ,"date" , "Branches".id
                HAVING "SupplierOpeningBalance"."openingBalance" - COALESCE(sum("BillingPaymentLines"."amount"),0)>0`
            let openingBalance = await DB.excu.query(query.text, query.values);

            if (openingBalance.rowCount != null && openingBalance.rowCount > 0 && branchId) {
                return { amount: (<any>openingBalance.rows[0]).amount, id: (<any>openingBalance.rows[0]).id, paid: (<any>openingBalance.rows[0]).paid, createdAt: (<any>openingBalance.rows[0]).date, branchId: (<any>openingBalance.rows[0]).branchId }
            } else {

                console.log(openingBalance.rows)
                return openingBalance.rows

            }

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async validateOpeningBalancePaidAmount(client: PoolClient, openingBlanceId: string, amount: Number, paymentId: string | null = null) {
        try {



            paymentId = paymentId ?? ""
            const query: { text: string, values: any } = {
                text: `select "SupplierOpeningBalance"."branchId", "SupplierOpeningBalance"."openingBalance"- COALESCE(sum("BillingPaymentLines"."amount"),0) AS "balance" 
                from "SupplierOpeningBalance" 
                Left join "BillingPaymentLines" on "BillingPaymentLines"."openingBalanceId" = "SupplierOpeningBalance".id and "BillingPaymentLines"."billingPaymentId"::text<>$2
                where "SupplierOpeningBalance"."id" = $1
                group by  "SupplierOpeningBalance"."supplierId","SupplierOpeningBalance".id
                HAVING "SupplierOpeningBalance"."openingBalance" - COALESCE(sum("BillingPaymentLines"."amount"),0)>0 `,
                values: [openingBlanceId, paymentId]
            }




            let openingBalance = await client.query(query.text, query.values);

            if (openingBalance.rowCount != null && openingBalance.rowCount > 0) {

                if (amount > openingBalance.rows[0].balance) {
                    throw new Error("Opening Balance Paid Amunt Exceed Opening Balance Actual amount")
                } else { return openingBalance.rows[0].branchId }

            } else {
                return null

            }

        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async supplierCredit(supplierId: string, company: Company) {
        try {

            const query: { text: string, values: any } = {
                text: `select "availableCredit"  as "supplierCredit" from "Suppliers" where id = $1`,
                values: [supplierId]
            }

            const supplier = await DB.excu.query(query.text, query.values);
            let credit = 0;
            if ((supplier.rowCount != null && supplier.rowCount > 0) && (<any>supplier.rows[0]).supplierCredit) {
                credit =(<any>supplier.rows[0]).supplierCredit
            }
            return new ResponseData(true, "", { credit: Number(credit) })
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }
    public static async getSupplierOutStandingPayable(supplierId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT    "outStandingPayable"($1)`,
                values: [supplierId]
            }

            const supplier = await DB.excu.query(query.text, query.values);
            const outStandingPayable = (<any>supplier.rows[0]).outStandingPayable
            return new ResponseData(true, "", { outStandingPayable: outStandingPayable })
        } catch (error: any) {

            throw new Error(error.message)
        }
    }
    public static async getSupplierOverView(data: any, company: Company) {
        try {
            const supplierId = data.supplierId;
            const from = data.interval.from;
            const to = data.interval.to;

            const query: { text: string, values: any } = {
                text: `select "outStandingPayable" ,  "availableCredit"  from "Suppliers" where id =$1`,
                values: [supplierId]
            }

            const supplier = await DB.excu.query(query.text, query.values);
            const unusedCredit = supplier.rows && supplier.rows.length > 0 ? (<any>supplier.rows[0]).availableCredit : 0
            const outStandingPayable = supplier.rows && supplier.rows.length > 0 ? (<any>supplier.rows[0]).outStandingPayable : 0
            const resData = {
                summary: [],
                unusedCredit: unusedCredit,
                outStandingPayable: outStandingPayable
            }
            return new ResponseData(true, "", resData)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async getSupplierBillsTransictions(data: any, company: Company) {
        try {
            let offset = 0;
            let count = 0;
            const supplierId = data.supplierId;
            let pageCount = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }

            const countQuery = {
                text: `SELECT COUNT(*) 
                       FROM "Billings" 
                      where "Billings"."supplierId" =$1`,
                values: [supplierId]
            }

            const countData = await DB.excu.query(countQuery.text, countQuery.values);
            count = (<any>countData.rows[0]).count;
            pageCount = Math.ceil(count / data.limit)
            const query: { text: string, values: any } = {
                text: `select 
                "Billings"."billingNumber",
                "Billings".id,
                "Billings".total, 
                 COALESCE(sum("BillingPaymentLines".amount),0) as "paidAmount",
                "Billings".total -  COALESCE(sum("BillingPaymentLines".amount),0) as "balance"
                from "Billings"
                LEFT JOIN "BillingPaymentLines" 
                ON "BillingPaymentLines"."billingId" = "Billings".id
                where "Billings"."supplierId" =$1
                group by "Billings".id
                  order by "billingDate" desc
                offset $2
                limit $3`,
                values: [supplierId, offset, limit]
            }
            const supplierBills = await DB.excu.query(query.text, query.values);
            offset += 1;
            let lastIndex = ((data.page) * data.limit)
            if (supplierBills.rows.length < data.limit || data.page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: supplierBills.rows,
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

    public static async getSupplierPaymentsTransictions(data: any, company: Company) {
        try {
            let offset = 0;
            let count = 0;
            const supplierId = data.supplierId;
            let pageCount = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }

            const countQuery = {
                text: `SELECT COUNT(*) 
                       FROM "BillingPayments" 
                      where "BillingPayments"."supplierId" =$1`,
                values: [supplierId]
            }

            const countData = await DB.excu.query(countQuery.text, countQuery.values);
            count = (<any>countData.rows[0]).count;
            pageCount = Math.ceil(count / data.limit)
            const query: { text: string, values: any } = {
                text: `select 
                'Supplier Payment' as code,
                "BillingPayments".id,
                "BillingPayments"."tenderAmount",
                "BillingPayments"."paidAmount" 
                FROM "BillingPayments" 
               where "BillingPayments"."supplierId" =$1
                  order by "paymentDate" desc
               offset $2
               limit $3`,
                values: [supplierId, offset, limit]
            }
            const supplierBills = await DB.excu.query(query.text, query.values);
            offset += 1;
            let lastIndex = ((data.page) * data.limit)
            if (supplierBills.rows.length < data.limit || data.page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: supplierBills.rows,
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

    public static async getSupplierPurchaseOrderTransictions(data: any, company: Company) {
        try {
            let offset = 0;
            let count = 0;
            const supplierId = data.supplierId;
            let pageCount = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }

            const countQuery = {
                text: `SELECT COUNT(*) 
                       FROM "PurchaseOrders" 
                      where "PurchaseOrders"."supplierId" =$1`,
                values: [supplierId]
            }

            const countData = await DB.excu.query(countQuery.text, countQuery.values);
            count = (<any>countData.rows[0]).count;
            pageCount = Math.ceil(count / data.limit)
            const query: { text: string, values: any } = {
                text: `select 
                "PurchaseOrders"."purchaseNumber",
                "PurchaseOrders".id,
                "PurchaseOrders".total
                from "PurchaseOrders"
                where "PurchaseOrders"."supplierId" =$1
                                  order by "purchaseDate" desc
                offset $2
                limit $3`,
                values: [supplierId, offset, limit]
            }
            const supplierBills = await DB.excu.query(query.text, query.values);
            offset += 1;
            let lastIndex = ((data.page) * data.limit)
            if (supplierBills.rows.length < data.limit || data.page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: supplierBills.rows,
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

    public static async getSupplierItemsBySupplierId(data: any, company: Company) {
        try {
            let offset = 0;
            let count = 0;
            const companyId = company.id;
            const supplierId = data.supplierId;
            let pageCount = 0;
            let page = data.page ?? 1
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            let values = [companyId, supplierId, offset, limit]
            let limitQuery = `  offset $3
                        limit $4`
            if (data.export) {
                values = [companyId, supplierId]
                limitQuery = ``
            }

            const countQuery = {
                text: `with "items"  as (SELECT "Suppliers".id as "supplierId",
                                    "Suppliers".name as "supplierName",
                                "SupplierItems".id as "id",
                            
                                "minimumOrder",
                                cost,
                                "supplierCode",
                                "productId",
                                "Products".name as "productName" , 
                                "Products"."UOM",
                                "Products"."barcode",
                                "Products"."type",
                                count(*) over() 
                        FROM "Suppliers" 
                        INNER JOIN "SupplierItems" ON "Suppliers".id = "SupplierItems"."supplierId" 
                        INNER JOIN "Products" ON "Products".id = "SupplierItems"."productId"
                
                        WHERE  "Suppliers"."companyId"= $1
                                AND "Suppliers".id = $2
                           ${limitQuery}
                        
                        )

                        select  "items".*, 
                        case when "items"."type" = 'inventory' then  sum("BranchProducts"."onHand")
                        when "items"."type" = 'batch' then sum("ProductBatches"."onHand")
                        when "items"."type" = 'serialized' then count("ProductSerials"."id")
                        end as "onHand"
                        
                        from "items" 
                        inner join "BranchProducts" on "BranchProducts"."productId" =  "items"."productId"
                        left join "ProductBatches" on "ProductBatches"."branchProductId" = "BranchProducts".id 
                        left join "ProductSerials" on "ProductSerials"."branchProductId" = "BranchProducts".id  and "status"='Available'
                        group by  "items"."supplierId",
                                  "items"."supplierName",
                                  "items"."id",
                                  "items"."supplierId",  
                                  "items"."minimumOrder",
                                  "items".cost,
                                  "items"."supplierCode",
                                  "items"."productId",
                                  "items"."productName" ,
                                  "items"."UOM",
                                  "items"."barcode",
                                  	    "items".count,
                                  "items" ."type"
                        `,
                values: values
            }

            const supplierItems: any = await DB.excu.query(countQuery.text, countQuery.values);
            count = supplierItems.rows && supplierItems.rows.length > 0 ? Number((<any>supplierItems.rows[0]).count) : 0
            pageCount = Math.ceil(count / data.limit)

            offset += 1;
            let lastIndex = ((page) * data.limit)
            if (supplierItems.rows.length < data.limit || page == pageCount) {
                lastIndex = count
            }

            const supplierItemsList = supplierItems.rows.filter((e: any) => delete (<any>e).count);
            if (data.export) {
                let supplierName = supplierItems.rows[0].supplierName
                let report = new ReportData()
                report.filter = {
                    title: `${supplierName} Items`,


                }
                report.records = supplierItemsList
                report.columns = [{ key: 'productName', header: "Item" },
                { key: 'UOM' },
                { key: 'supplierCode', header: "Supplier Code" },
                { key: 'onHand', header: "onHand" },
                { key: 'minimumOrder', header: "Minimum Order", properties: { columnType: 'currency' } },
                { key: 'cost', header: "Cost", properties: { columnType: 'currency' } }
                ]
                report.fileName = supplierName
                return new ResponseData(true, "", report)
            } else {
                const resData = {
                    list: supplierItemsList,
                    count: count,
                    pageCount: pageCount,
                    startIndex: offset,
                    lastIndex: lastIndex
                }

                return new ResponseData(true, "", resData)
            }

        } catch (error: any) {
            console.log(error)
          

            throw new Error(error.message)
        }
    }

    public static async getSupplierCreditsTransictions(data: any, company: Company) {
        try {
            let offset = 0;
            let count = 0;
            const supplierId = data.supplierId;
            let pageCount = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            if (data.page != 1) {
                offset = (limit * (data.page - 1))
            }

            const countQuery = {
                text: `SELECT  COUNT(distinct "SupplierCredits".id) 
                      FROM "Billings" 
  
                inner join "BillingLines" on "BillingLines"."billingId" =  "Billings".id
                inner join "SupplierCreditLines" on "SupplierCreditLines"."billingLineId" = "BillingLines".id 
                inner join "SupplierCredits" on "SupplierCredits".id = "SupplierCreditLines"."supplierCreditId"
               where "Billings"."supplierId" =$1
			 `,
                values: [supplierId]
            }

            const countData = await DB.excu.query(countQuery.text, countQuery.values);
            count = (<any>countData.rows[0]).count;
            pageCount = Math.ceil(count / data.limit)
            const query: { text: string, values: any } = {
                text: `select 
                "SupplierCredits"."supplierCreditNumber",
                "SupplierCredits".id,
                "SupplierCredits".total
                FROM "Billings" 
  
                inner join "BillingLines" on "BillingLines"."billingId" =  "Billings".id
                inner join "SupplierCreditLines" on "SupplierCreditLines"."billingLineId" = "BillingLines".id 
                inner join "SupplierCredits" on "SupplierCredits".id = "SupplierCreditLines"."supplierCreditId"
               where "Billings"."supplierId" =$1
			   group by        "SupplierCredits"."supplierCreditNumber",      "SupplierCredits".id, "SupplierCredits".total
                     order by "supplierCreditDate" desc
               offset $2
               limit $3`,
                values: [supplierId, offset, limit]
            }
            const supplierBills = await DB.excu.query(query.text, query.values);
            offset += 1;
            let lastIndex = ((data.page) * data.limit)
            if (supplierBills.rows.length < data.limit || data.page == pageCount) {
                lastIndex = count
            }

            const resData = {
                list: supplierBills.rows,
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


    public static async getSupplierBillsbyBranch(supplierId: string, branchId: string) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN");
            const query: { text: string, values: any } = {
                text: `SELECT
                        "Billings".id ,
                        "Billings"."billingNumber",
                        "Billings".total
                FROM "Billings"
                left join "SupplierCredits" 
                ON "SupplierCredits"."billingId" = "Billings".id 
                WHERE "Billings"."supplierId" =$1
                AND "Billings"."branchId"=$2
                and "Billings".status <> 'Draft'
                GROUP BY "Billings".id
                HAVING "Billings".total::text::numeric - COALESCE(sum("SupplierCredits".total::text::numeric),0) > 0 
                order by "Billings"."createdAt" DESC
            `,
                values: [supplierId, branchId]
            }
            const bills = await client.query(query.text, query.values)
            await client.query("COMMIT")
            return new ResponseData(true, "", bills.rows)
        } catch (error: any) {
          
            await client.query("ROLLBACK")
            throw new Error(error.message)
        } finally {
            client.release()
        }
    }

    public static async getApplyCreditSupplierBills(supplierId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `
            with "billingBalance" as (
            select
                                    "Billings".id,
                                    "Billings"."billingNumber" as "code",
                                    "Billings".total::text::numeric -( COALESCE(sum("BillingPaymentLines".amount::text::numeric),0) ) as "credit" ,
                                    'SupplierCredit' as reference
                            from "Billings"
                            left  JOIN "BillingPaymentLines" ON "BillingPaymentLines"."billingId" = "Billings".id
                            where "Billings"."supplierId" =$1
                            and "Billings".status <> 'Draft' 
                            GROUP BY "Billings".id
                    ),"supplierCredit" as (

                    select sum("SupplierCredits"."total"::text::numeric) as "total",
                        "billingBalance".id 
                        from "billingBalance" 
                    left join "SupplierCredits" on "SupplierCredits"."billingId"  = "billingBalance".id 
                        group by "billingBalance".id 
                    ),"appliedCredits" as (
                    select sum("SupplierAppliedCredits"."amount"::text::numeric) as "total",
                        "billingBalance".id 
                        from "billingBalance" 
                    left join "SupplierAppliedCredits" on "SupplierAppliedCredits"."billingId"  = "billingBalance".id 
                        group by "billingBalance".id 
                    ),"bills" as (
                    select "billingBalance".id,
                        "billingBalance"."code",
                        "billingBalance"."reference",
                        ( COALESCE("billingBalance"."credit"::text::numeric,0) -  ( COALESCE("supplierCredit"."total"::text::numeric,0) -   COALESCE("appliedCredits"."total"::text::numeric,0))) as "credit"
                        from "billingBalance"
                    left join "supplierCredit" on "supplierCredit".id = "billingBalance".id 
                    left join "appliedCredits" on "appliedCredits".id = "billingBalance".id
                    where ( COALESCE("billingBalance"."credit"::text::numeric,0) -  ( COALESCE("supplierCredit"."total"::text::numeric,0) -   COALESCE("appliedCredits"."total"::text::numeric,0)))> 0 
                        
                    )
                    select * from "bills"
                `,
                values: [supplierId]
            }

            const creditApplies = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", creditApplies.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async deleteSupplierItem(client: PoolClient, supplierItemId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `DELETE FROM "SupplierItems" where id =$1 `,
                values: [supplierItemId]
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
          

            throw new Error(error)
        }
    }

    public static async lastPaymentMadeToSupplier(supplierId: string) {
        try {
            const query: { text: string, values: any } = {
                text: ` SELECT "BillingPayments".id , "BillingPayments"."paidAmount","BillingPayments"."tenderAmount" FROM "BillingPayments" where "supplierId"=$1 order by "paymentDate" DESC LIMIT 1`,
                values: [supplierId]
            }

            let payment = await DB.excu.query(query.text, query.values);
            if (payment.rows && payment.rows.length > 0) {
                return new ResponseData(true, "", payment.rows[0])

            } else {
                return new ResponseData(true, "", [])
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }

    // public static async supplierStatement(data: any , company: Company) {
    //     try {
    //         const companyId  = company.id;
    //         const supplierId = data.supplierId;
    //         console.log(data)
    //         if(!supplierId) { throw new Error("supplierId is required")}
    //         const from = data.from ? data.from : null;
    //         const to   = data.to   ? data.to   : null;
    //        const  branchId  = data.branchId   ? (data.branchId).trim()   ? (data.branchId).trim()   : null : null;
    //        // const  budgetId  = data.budgetId   ? (data.budgetId).trim()   ? (data.budgetId).trim()   : null : null;
    //        //const parentType = ['Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity'

    //        const query = {
    //         text: `with openingBalance as (
    //             select 
    //             NULL::uuid AS "accountId", 
    //             'opening Balance' AS "accountName", 
    //             c.id AS "userId",
    //             c.name AS "Username",
    //             COALESCE(max(Date(j."createdAt")),Date(c."createdAt")) AS date ,
    //             COALESCE(c."openingBalance",0) + COALESCE(sum(amount), 0) AS "amount",
    //             NULL::float as "payment",
    //             NULL AS	 "dbTable",
    //             NULL::jsonb AS "details"
    //             from "Suppliers" AS c
    //             left join "JournalRecords" as j on (j."userId"::text = c.id ::text
    //                                             and j."companyId"::text = c."companyId"::text
    //                                             and (Date(j."createdAt") IS NULL OR  Date(j."createdAt") < $4::date)
    //                                             and j.name = 'Account Payable' 
    //                                             )							
    //             where  c.id::text = $1::text  
    //             and c."companyId"::text = $3::text 
    //             group by c.id

    //             ),
    //             accountReceivable as (
    //             Select * from openingBalance	
    //             UNION 	
    //             select "JournalRecords"."accountId", 
    //             "Accounts".name as "accountName",
    //             "userId",
    //             "Suppliers".name as "Username",	
    //             Date("JournalRecords"."createdAt") as date, 	 
    //             case when "JournalRecords"."dbTable" = any (Array['Billing Payment', 'Supplier Refunds', 'Supplier Credits']) then sum("JournalRecords".amount) end as "amount", 
    //             case when "JournalRecords"."dbTable" = any (Array['Billing' ,'Supplier Applied Credit']) then sum("JournalRecords".amount)  end as "payment",
    //             "dbTable",

    //             jsonb_agg(case when "dbTable" = 'Billing Payment' and ip."billingPaymentId" = "referenceId"  then
    //                     jsonb_build_object( replace("dbTable"::text, ' ','')||'Id', "JournalRecords"."referenceId", replace(("dbTable"::text||'Number'),' ', ''), "JournalRecords"."code", 
    //                                         'amount', "JournalRecords".amount ,
    //                                         'Billings', (select json_agg("Billings"."billingNumber") as "billing"  
    //                                                         from  "Billings" 
    //                                                         where  ip."billingId" = "Billings".id)
    //                                        )
    //                     else 
    //                     jsonb_build_object(replace("dbTable"::text, ' ','')||'Id', "JournalRecords"."referenceId",  replace(("dbTable"::text||'Number'),' ', ''), "JournalRecords"."code", 
    //                                         'amount', "JournalRecords".amount 
    //                                         )
    //                     end

    //             )as "details"


    //             from "JournalRecords"
    //             inner join "Accounts" on "JournalRecords"."accountId" = "Accounts".id  
    //             left join "Suppliers" on  "Suppliers".id = "userId" 
    //             left join "BillingPaymentLines" as ip on  "dbTable" = 'Billing Payment' and ip."billingPaymentId" = "referenceId" 


    //             where "userId"::text = $1::text 
    //             and ($2::text IS NULL OR "JournalRecords"."branchId"::text = $2::text)
    //             and "JournalRecords"."companyId"::text = $3::text
    //             and "JournalRecords".name = 'Account Payable' 
    //             and (($4::DATE IS NULL OR Date("JournalRecords"."createdAt") >= $4::DATE) 
    //               AND ($5::DATE IS NULL OR Date("JournalRecords"."createdAt") <= $5::DATE) 
    //                 )
    //             group by "JournalRecords"."accountId","Accounts".name, "dbTable", "userId" , Date("JournalRecords"."createdAt"),"Username"

    //             )

    //             select "accountId", "accountName", "userId" as "customerId", "Username" as "customerName", Date, "dbTable",  "amount", "payment", 
    //             round(SUM (COALESCE(amount, payment)) OVER ( ORDER BY "accountId" desc , DATE ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::numeric,3) AS "Balance",
    //             "details"
    //             from accountReceivable
    //             order By "accountId" desc ,Date 
    //             `,
    //         values: [supplierId, branchId, companyId, from, to ]
    //     }



    //         const statement = await DB.excu.query(query.text, query.values);

    //        // journal.rows.forEach(element => {
    //        //    console.log(element)
    //        //    journal.rows.splice(journal.rows.indexOf(journal.rows.find(f=> f.debit ==0 && f.credit == 0)), 1)
    //        // });



    //        return new ResponseData(true, "", statement.rows)
    //     } catch (error: any) {

    //      
    //        throw new Error(error.message)
    //     }
    //  }

    // public static async supplierStatement(data: any , company: Company) {
    //     try {
    //         const companyId  = company.id;
    //         const supplierId = data.supplierId;
    //         console.log(data)
    //         if(!supplierId) { throw new Error("supplierId is required")}
    //         const from = data.from ? data.from : null;
    //         const to   = data.to   ? data.to   : null;
    //        const  branchId  = data.branchId   ? (data.branchId).trim()   ? (data.branchId).trim()   : null : null;
    //        // const  budgetId  = data.budgetId   ? (data.budgetId).trim()   ? (data.budgetId).trim()   : null : null;
    //        //const parentType = ['Current Assets', 'Other Current Assets', 'Fixed Assets', 'Current Liabilities', 'Long Term Liabilities', 'Equity'

    //        const query : { text: string, values: any } = {
    //         text: `with openingBalance as (
    //             select 
    //             NULL::uuid AS "accountId", 
    //             'opening Balance' AS "accountName", 
    //             c.id AS "userId",
    //             c.name AS "Username",
    //             COALESCE(max(Date(j."createdAt")),Date(c."createdAt")) AS date ,
    //             COALESCE(c."openingBalance",0) + COALESCE(sum(amount), 0) AS "amount",
    //             NULL::float as "payment",
    //             NULL AS	 "dbTable",
    //             NULL::jsonb AS "details"
    //             from "Suppliers" AS c
    //             left join "JournalRecords" as j on (j."userId"::text = c.id ::text
    //                                             and j."companyId"::text = c."companyId"::text
    //                                             and (Date(j."createdAt") IS NULL OR  Date(j."createdAt") < $4::date)
    //                                             and j.name = 'Account Payable' 
    //                                             )							
    //             where  c.id::text = $1::text  
    //             and c."companyId"::text = $3::text 
    //             group by c.id

    //             ),
    //             accountReceivable as (
    //             Select * from openingBalance	
    //             UNION 	
    //             select "JournalRecords"."accountId", 
    //             "Accounts".name as "accountName",
    //             "userId",
    //             "Suppliers".name as "Username",	
    //             Date("JournalRecords"."createdAt") as date, 	 
    //             case when "JournalRecords"."dbTable" = any (Array['Billing Payment', 'Supplier Refunds', 'Supplier Credits']) then sum("JournalRecords".amount) end as "amount", 
    //             case when "JournalRecords"."dbTable" = any (Array['Billing' ,'Supplier Applied Credit']) then sum("JournalRecords".amount)  end as "payment",
    //             "dbTable",

    //             jsonb_agg(case when "dbTable" = 'Billing Payment' and ip."billingPaymentId" = "referenceId"  then
    //                     jsonb_build_object( replace("dbTable"::text, ' ','')||'Id', "JournalRecords"."referenceId", replace(("dbTable"::text||'Number'),' ', ''), "JournalRecords"."code", 
    //                                         'amount', "JournalRecords".amount ,
    //                                         'Billings', (select json_agg("Billings"."billingNumber") as "billing"  
    //                                                         from  "Billings" 
    //                                                         where  ip."billingId" = "Billings".id)
    //                                        )
    //                     else 
    //                     jsonb_build_object(replace("dbTable"::text, ' ','')||'Id', "JournalRecords"."referenceId",  replace(("dbTable"::text||'Number'),' ', ''), "JournalRecords"."code", 
    //                                         'amount', "JournalRecords".amount 
    //                                         )
    //                     end

    //             )as "details"


    //             from "JournalRecords"
    //             inner join "Accounts" on "JournalRecords"."accountId" = "Accounts".id  
    //             left join "Suppliers" on  "Suppliers".id = "userId" 
    //             left join "BillingPaymentLines" as ip on  "dbTable" = 'Billing Payment' and ip."billingPaymentId" = "referenceId" 


    //             where "userId"::text = $1::text 
    //             and ($2::text IS NULL OR "JournalRecords"."branchId"::text = $2::text)
    //             and "JournalRecords"."companyId"::text = $3::text
    //             and "JournalRecords".name = 'Account Payable' 
    //             and (($4::DATE IS NULL OR Date("JournalRecords"."createdAt") >= $4::DATE) 
    //               AND ($5::DATE IS NULL OR Date("JournalRecords"."createdAt") <= $5::DATE) 
    //                 )
    //             group by "JournalRecords"."accountId","Accounts".name, "dbTable", "userId" , Date("JournalRecords"."createdAt"),"Username"

    //             )

    //             select "accountId", "accountName", "userId" as "customerId", "Username" as "customerName", Date, "dbTable",  "amount", "payment", 
    //             round(SUM (COALESCE(amount, payment)) OVER ( ORDER BY "accountId" desc , DATE ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::numeric,3) AS "Balance",
    //             "details"
    //             from accountReceivable
    //             order By "accountId" desc ,Date 
    //             `,
    //         values: [supplierId, branchId, companyId, from, to ]
    //     }



    //         const statement = await DB.excu.query(query.text, query.values);

    //        // journal.rows.forEach(element => {
    //        //    console.log(element)
    //        //    journal.rows.splice(journal.rows.indexOf(journal.rows.find(f=> f.debit ==0 && f.credit == 0)), 1)
    //        // });



    //        return new ResponseData(true, "", statement.rows)
    //     } catch (error: any) {

    //      
    //        throw new Error(error.message)
    //     }
    //  }

    public static async getSupplierName(supplierId: string) {
        try {
            const query = {
                text: `select name from "Suppliers" where id = $1`,
                values: [supplierId]
            }

            let supplier = await DB.excu.query(query.text, query.values);
            return supplier && supplier.rows && supplier.rows.length > 0 ? (<any>supplier.rows[0]).name : null
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async supplierStatement(data: any, company: Company) {
        try {
            const companyId = company.id;
            const supplierId = data.supplierId;

            if (!supplierId) { throw new Error("supplierId is required") }
            let from = data.from ? data.from : null;
            let to = data.to ? data.to : null;
            const branchId = data.branchId ? (data.branchId).trim() ? (data.branchId).trim() : null : null;
            if (from != null) {
                from = await TimeHelper.resetHours(from)
            }
            to = moment(to).add(1, 'day').format("YYYY-MM-DD 00:00:00");
            const query: { text: string, values: any } = {
                text: `with "values" as (
                select      $1::uuid as "supplierId",
                            $2::uuid as "branchId",
                            $3::uuid as "companyId",
                            $4::timestamp as "fromDate",
                            $5::timestamp as "toDate"
            ),
            "openingBalance" as (
                select 
                                   null::uuid as "referenceId",
                                   "values"."supplierId" as "userId",
                         COALESCE(sum("JournalRecords"."amount"::TEXT::NUMERIC *(-1)),0)   as "amount",
                                   null::real  as "payment", 
                                  '' as "dbTable",
                                  'opening Balance' as "accountName",
                                  COALESCE(max("JournalRecords"."createdAt"::date),case when  "Branches"."openingBalanceDate" is null then "Companies"."createdAt" - interval '1 days' else "Branches"."openingBalanceDate" end ) AS "date" ,
                                    '{}'::text as "details",
                                     null::text as "codes"
                          from "values" 
                           inner join "Suppliers"  on "Suppliers".id =  "values"."supplierId"
                          left join "Companies" on "Companies".id = "values"."companyId"
                          left join "JournalRecords"   on   "JournalRecords"."companyId" = "values"."companyId" and "JournalRecords"."userId" = "values"."supplierId" 
                                 left join "Branches" on "Branches".id = "JournalRecords"."branchId"

                          LEFT join "Accounts" on "Accounts".id = "JournalRecords"."accountId" 
                          where "Suppliers"."companyId" = "values"."companyId"
                               and ( "values"."branchId" is null or ("JournalRecords".id is not null and ("JournalRecords"."branchId" = "values"."branchId" or ("JournalRecords"."companyId" ="values"."companyId" and "JournalRecords"."branchId" is null) ) ) )
                               and ("Accounts".id is null OR "Accounts".type ='Account Payable' OR  "Accounts".type ='Prepaid Expenses' OR "Accounts".type='Available Credit') 
                               and   "JournalRecords"."createdAt" < "values"."fromDate"
                          group by "values"."supplierId","Suppliers"."createdAt","Branches"."openingBalanceDate","Companies"."createdAt"
               ),  "statments" as (
               
                   select 
                                   "JournalRecords"."referenceId",
                                   "JournalRecords"."userId",
                                   case when "Accounts".type ='Account Payable' and "JournalRecords"."dbTable" <> 'Billing Payment' then "JournalRecords".amount::text::numeric  *-1  end as "amount",
                                   case when  "Accounts".type ='Prepaid Expenses' OR "Accounts".type='Available Credit' or ( "Accounts".type ='Account Payable' and "JournalRecords"."dbTable" = 'Billing Payment') then "JournalRecords".amount::text::numeric *-1 end as "payment",
                                   "JournalRecords"."dbTable",
                                   "JournalRecords"."dbTable" as "accountName",
                               "JournalRecords"."createdAt" as "date",
                                    JSON_BUILD_OBJECT('referencId',"JournalRecords"."referenceId", 'referenceTable',"JournalRecords"."dbTable", 'billings', JSON_AGG(JSON_BUILD_OBJECT('billingId',"Billings".id ,'billingNumber',"Billings"."billingNumber" )) )::text as "details",
                                   string_agg("Billings"."billingNumber"::text,',') as "codes"
                          from "values" 
                          left join "JournalRecords"   on  "JournalRecords"."companyId" = "values"."companyId" and "JournalRecords"."userId" ="values"."supplierId" 
                          LEFT join "Accounts" on "Accounts".id = "JournalRecords"."accountId"   
                          left join "BillingPaymentLines" on "BillingPaymentLines"."billingPaymentId" = "JournalRecords"."referenceId"
                          left join "SupplierRefunds" on "SupplierRefunds".id = "JournalRecords"."referenceId"
                          left join "SupplierCredits" on "SupplierCredits".id = "JournalRecords"."referenceId"  or "SupplierCredits".id  = "SupplierRefunds"."supplierCreditId"
                          left join "Billings" on "Billings".id = "JournalRecords"."referenceId"  or "Billings".id =  "SupplierCredits"."billingId" or "Billings".id = "BillingPaymentLines"."billingId"
                          left join "Branches" on "Branches".id = "JournalRecords"."branchId"
                         where "JournalRecords"."companyId" = "values"."companyId"
                               and( "values"."branchId" is null or "Branches".id = "values"."branchId" or("JournalRecords"."companyId" = "values"."companyId" and "JournalRecords"."branchId" is null))
                               and   "JournalRecords"."createdAt" >= "values"."fromDate" and  "JournalRecords"."createdAt" < "values"."toDate" 
                               and  ("Accounts".type ='Account Payable' OR  "Accounts".type ='Prepaid Expenses' OR "Accounts".type='Available Credit')
                          group by "JournalRecords"."referenceId","JournalRecords"."userId","Accounts".type,"JournalRecords".amount ,	"JournalRecords"."dbTable", "JournalRecords"."createdAt"
               
               ), "records" as (
               select * from "openingBalance"
               union
               select * from "statments"	
               )
               
               
               select "records"."referenceId" ,
                      "records"."userId" ,
                      "records"."amount" ,
                      "records"."payment" ,
                      "records"."dbTable" ,
                      "records"."accountName" ,
                      "records"."date" ,
                      "records"."details"::jsonb ,
                      CAST (SUM (COALESCE("payment","amount")::text::numeric  ) OVER (order by  "date" asc , "codes"  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS FLOAT) as "Balance"
               
                                  from "records"
               order by     "date" asc ,"dbTable"
            
                `,
                values: [supplierId, branchId, companyId, from, to]
            }

            if (data.filterType && data.filterType == 'payable') {

                query.text = `with "values" as (
                select      $1::uuid as "supplierId",
                            $2::uuid as "branchId",
                            $3::uuid as "companyId",
                            $4::timestamp as "fromDate",
                            $5::timestamp as "toDate"
            ) ,"openingBalance" as(
                        select 
                                            null::uuid as "referenceId",
                                            "values"."supplierId" as "userId",
                                            SUM("JournalRecords"."amount"::text::numeric *-1 )  as "amount",
                                            null::real  as "payment", 
                                        '' as "dbTable",
                                        'opening Balance' as "accountName",
                                        COALESCE(max("JournalRecords"."createdAt"::date),"Suppliers"."createdAt"::date) AS "date" ,
                                            '{}'::text as "details",
                                            null::text as "codes"
                                    from "values" 
                                    inner join "Suppliers"  on "Suppliers".id =  "values"."supplierId"
                                    left join "JournalRecords"   on  "JournalRecords"."companyId" = "values"."companyId" and "JournalRecords"."userId" = "Suppliers".id 
                                    left join "Accounts" on "Accounts".id = "JournalRecords"."accountId" 
                                    
                                    where "Suppliers"."companyId" = "values"."companyId"
                                        and ( "values"."branchId" is null or ("JournalRecords".id is not null and "JournalRecords"."branchId" = "values"."branchId") )
                                        and ("Accounts".id is null OR "Accounts".type ='Account Payable' OR  "Accounts".type ='Prepaid Expenses') 
                                        and   "JournalRecords"."createdAt" < "values"."fromDate" 
                                        and "dbTable" in ('Billing', 'Billing Payment', 'Supplier Credits','Supplier Refunds','Opening Balance')
                                        group by "values"."supplierId","Suppliers"."createdAt"
                                        having   SUM("JournalRecords"."amount"::text::numeric *-1 )  > 0 
                        ), "supplierOpeningBalance" as (
					        select    null::uuid as "referenceId",
                                            "values"."supplierId" as "userId",
                                            SUM("JournalRecords"."amount"::text::numeric *-1 )  as "amount",
                                            null::real  as "payment", 
                                        '' as "dbTable",
                                        'opening Balance' as "accountName",
                                        "JournalRecords"."createdAt"  AS "date" ,
                                            '{}'::text as "details",
                                            null::text as "codes"
							
							from "SupplierOpeningBalance" 
							 join "values" on true
                            inner join "JournalRecords"   on  "JournalRecords"."companyId" = "values"."companyId" 
							where "dbTable" = 'Opening Balance'
							and "SupplierOpeningBalance"."supplierId" =  "values"."supplierId"
							 and ( "values"."branchId" is null or ( "SupplierOpeningBalance"."branchId" = "values"."branchId") )
							and "JournalRecords"."userId" = "values"."supplierId"
							and   "JournalRecords"."createdAt" >= "values"."fromDate" 
							and   "JournalRecords"."createdAt" < "values"."toDate" 
							group by "values"."supplierId" ,  "JournalRecords"."createdAt" 
						), "openingBalancePayments" as (
						select "BillingPaymentLines"."billingPaymentId" as "referenceId",
							    "values"."supplierId" as "userId",
							      null::numeric  as "amount",
                                  SUM("BillingPaymentLines"."amount"::text::numeric )*(-1)  as "payment", 
							     'Billing Payment' as "dbTable",
							      'Account Payable' as "accountName",
								   "BillingPayments"."paymentDate" as  "date",
								 	JSON_BUILD_OBJECT('referencId',"BillingPaymentLines"."billingPaymentId", 'referenceTable','Billing Payment', 'billings', '[]'::jsonb )::text as "details",
								 	null::text as "codes"
									from "BillingPaymentLines" 
						 join "values" on true
						 inner join "BillingPayments" ON  "BillingPayments".id = "BillingPaymentLines"."billingPaymentId"
						
					     where "BillingPayments"."supplierId" = "values"."supplierId"
							 and ( "values"."branchId" is null or ( "BillingPayments"."branchId" = "values"."branchId") )
						 and   "BillingPayments"."paymentDate" >= "values"."fromDate" 
						 and   "BillingPayments"."paymentDate" < "values"."toDate" 
						 and  "BillingPaymentLines"."openingBalanceId" is not null 
						 group by "BillingPaymentLines"."billingPaymentId" ,  "BillingPayments"."paymentDate",  "values"."supplierId" ,   "BillingPaymentLines"."createdAt"
						),"billings" as(
						
						    select "Billings" ."id" as "referenceId",
							    "values"."supplierId" as "userId",
							      "Billings"."total"::text::numeric   as "amount",
                                   null::numeric as "payment", 
							      'Billing' as "dbTable",
							      'Account Payable' as "accountName",
								  "Billings"."billingDate" as  "date",
							      JSON_BUILD_OBJECT('referencId',"Billings"."id", 'referenceTable','Billing', 'billings', JSON_AGG(JSON_BUILD_OBJECT('billingId',"Billings".id ,'billingNumber',"Billings"."billingNumber" )) )::text as "details",
								  "Billings"."billingNumber" as "codes"
							from "Billings" 
							join "values" on true
							where "Billings"."supplierId" = "values"."supplierId" 
							and ( "values"."branchId" is null or ( "Billings"."branchId" = "values"."branchId") )
							and   "Billings"."billingDate" >= "values"."fromDate" 
						    and   "Billings"."billingDate" < "values"."toDate" 
							and "Billings"."status" in( 'Open' , 'Partially Paid')
							group by "Billings" ."id",   "values"."supplierId" 
							
						), "billingPayments" as(
						select "BillingPayments"."id" as "referenceId",
							    "values"."supplierId" as "userId",
							      null::numeric  as "amount",
                                 "BillingPaymentLines"."amount"::text::numeric *(-1)  as "payment", 
							     'Billing Payment' as "dbTable",
							      'Account Payable' as "accountName",
								   "BillingPayments"."paymentDate" as  "date",
								   JSON_BUILD_OBJECT('referencId',"BillingPayments"."id", 'referenceTable','Billing Payment', 'billings', JSON_AGG(JSON_BUILD_OBJECT('billingId',"billings"."referenceId" ,'billingNumber',"billings"."codes" )) )::text as "details",
								   "billings"."codes" 
						
								    from "billings" 
						join "values" on true	
						inner join "BillingPaymentLines" on "BillingPaymentLines"."billingId" = "billings"."referenceId"
						inner join "BillingPayments" ON  "BillingPayments".id = "BillingPaymentLines"."billingPaymentId"
					     where "BillingPayments"."supplierId" = "values"."supplierId"
						 and ( "values"."branchId" is null or ( "BillingPayments"."branchId" = "values"."branchId") )
						 and   "BillingPayments"."paymentDate" >= "values"."fromDate" 
						 and   "BillingPayments"."paymentDate" < "values"."toDate" 
							group by "BillingPayments"."id" ,  "values"."supplierId", "BillingPaymentLines"."amount", "billings"."codes" 
						),"creditNotes" as (
						
						select   "SupplierCredits"."id" as "referenceId",
							    "values"."supplierId" as "userId",
							     sum("SupplierCreditLines"."total"::text::numeric) *(-1)   as "amount",
                                 null::numeric as "payment", 
							     'Supplier Credits' as "dbTable",
							      'Account Payable' as "accountName",
								   "SupplierCredits"."supplierCreditDate" as  "date",
								   JSON_BUILD_OBJECT('referencId',"SupplierCredits"."id", 'referenceTable','Supplier Credits', 'billings', JSON_AGG(JSON_BUILD_OBJECT('billingId',"billings"."referenceId" ,'billingNumber',"billings"."codes" )) )::text as "details",
								   "billings"."codes" 
						
								    from "billings" 
						join "values" on true	
						inner join "BillingLines" on "BillingLines"."billingId" = "billings"."referenceId"
						inner join "SupplierCreditLines" ON "SupplierCreditLines"."billingLineId" = "BillingLines".id 
						inner join "SupplierCredits" on "SupplierCredits".id = "SupplierCreditLines"."supplierCreditId"
								   where "SupplierCredits"."supplierId" = "values"."supplierId"
						 and ( "values"."branchId" is null or ( "SupplierCredits"."branchId" = "values"."branchId") )
						 and   "SupplierCredits"."supplierCreditDate" >= "values"."fromDate" 
						 and   "SupplierCredits"."supplierCreditDate" < "values"."toDate" 
							group by "SupplierCredits"."id" , "values"."supplierId", "billings"."codes" 
						),"appliedCredits" as (
						
						select   "SupplierAppliedCredits"."id" as "referenceId",
							    "values"."supplierId" as "userId",
							       null::numeric   as "amount",
                                   sum("SupplierAppliedCredits"."amount"::text::numeric ) *(-1)   as "payment", 
							     'Applied Credits' as "dbTable",
							      'Account Payable' as "accountName",
								   "SupplierAppliedCredits"."appliedCreditDate"  as  "date",
								   JSON_BUILD_OBJECT('referencId',"SupplierAppliedCredits"."id", 'referenceTable','Applied Credits', 'billings', JSON_AGG(JSON_BUILD_OBJECT('billingId',"billings"."referenceId" ,'billingNumber',"billings"."codes" )) )::text as "details",
								   "billings"."codes" 
						
								    from "billings" 
						join "values" on true	
						inner join "SupplierAppliedCredits" on "SupplierAppliedCredits"."billingId" = "billings"."referenceId"
			
							  

						 and   "SupplierAppliedCredits"."appliedCreditDate" >= "values"."fromDate" 
						 and   "SupplierAppliedCredits"."appliedCreditDate" < "values"."toDate" 
							group by "SupplierAppliedCredits"."id"  , "values"."supplierId", "billings"."codes" 
						), "refunds" as (
						select   "SupplierRefunds"."id" as "referenceId",
							    "values"."supplierId" as "userId",
							     null::numeric as "amount",
                                     sum("SupplierRefunds"."total"::text::numeric ) as "payment", 
							     'Supplier Refunds' as "dbTable",
							      'Account Payable' as "accountName",
								   "SupplierRefunds"."refundedDate" as  "date",
								   JSON_BUILD_OBJECT('referencId',"SupplierRefunds"."id", 'referenceTable','Supplier Refunds', 'billings',( "creditNotes"."details")::jsonb->>'billings' )::text as "details",
								   "creditNotes"."codes" 
						
								    from "creditNotes" 
						join "values" on true	
						inner join "SupplierRefunds" on "SupplierRefunds"."supplierCreditId" = "creditNotes" ."referenceId"
				
			
					    and   "SupplierRefunds"."refundedDate" >= "values"."fromDate" 
						and   "SupplierRefunds"."refundedDate" < "values"."toDate" 
						group by "SupplierRefunds"."id" , "values"."supplierId", "creditNotes"."codes"  ,"creditNotes"."details"
						
						
						),"records" as (
						 select * from "openingBalance"
						  union all 
						  select * from "supplierOpeningBalance" 
						  union  all
			          	  select * from "openingBalancePayments"
						  union all 
						  select * from "billings"
						  union all 
						  select * from "billingPayments"
						  union all
						  select * from "creditNotes"
						  union all
						  select * from "appliedCredits"
						  union all 
						  select * from "refunds")
						  
						           select "records"."referenceId" ,
                      "records"."userId" ,
                      "records"."amount" ,
                      "records"."payment" ,
                      "records"."dbTable" ,
                      "records"."accountName" ,
                      "records"."date" ,
                      "records"."details"::jsonb ,
                      CAST (SUM (COALESCE("payment","amount")::text::numeric  ) OVER (order by  "date" asc , "codes"  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS FLOAT) as "Balance"
               
                                  from "records"
               order by     "date" asc ,"dbTable"
						 
    
                            
            
            
            
            `
            }

            const statement = await DB.excu.query(query.text, query.values);
            if (data.export && data.export) {

                const supplierName = await this.getSupplierName(supplierId)
                if (supplierName) {

                    let hasOpeningBalance = statement.rows.find((f: any) => f.accountName == 'opening Balance')
                    let report = new ReportData()
                    report.filter = {
                        title: `Supplier Statment History `,
                        fromDate: data && data.from ? data.from : null,
                        toDate: data && data.to ? data.to : new Date(),
                        //  branches:branches,
                        // compareType: compareType,
                        //  accountDetils: account, 

                        statmentDetails: {
                            hasOpeningBalance: hasOpeningBalance ?? null,
                            name: supplierName
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
                    report.fileName = `${supplierName} Statment `
                    return new ResponseData(true, "", report)
                }



            } else {
                return new ResponseData(true, "", statement.rows)
            }

            // journal.rows.forEach(element => {
            //    console.log(element)
            //    journal.rows.splice(journal.rows.indexOf(journal.rows.find(f=> f.debit ==0 && f.credit == 0)), 1)
            // });



            return new ResponseData(true, "", statement.rows)
        } catch (error: any) {

          
            throw new Error(error.message)
        }
    }



    public static async importFromCVS(data: any, company: Company, employeeId: string, pageNumber: number, count: number) {
        const client = await DB.excu.client(500)


        let redisClient = RedisClient.getRedisClient();
        try {
            let errors = [];
            await client.query("BEGIN")


            const companyId = company.id;

            let limit: any = process.env.NUMBER_OF_IMPORT_RECOREDS ?? 2000;

            for (let index = 0; index < data.length; index++) {

                let progress = Math.floor((((index + 1) + ((pageNumber - 1) * limit)) / count) * 100) + "%"
                await redisClient.set("SupplierBulkImport" + company.id, JSON.stringify({ progress: progress }))

                const element: Supplier = data[index];

                element.companyId = companyId;
                element.id = await this.getSupplierIdByName(client, element.name, companyId)


                let resault: any;
                //TODO check if product Exists by Name or Barcode
                element.companyId = companyId
                if (element.id != "" && element.id != null) {
                    errors.push({ productName: element.name, error: "Supplier Name Already Used" })
                    resault = await this.updateImportSupplier(client, element, company);


                } else {
                    resault = await this.saveImportSupplier(client, element, company);
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


    public static async updateImportSupplier(client: PoolClient, data: any, company: Company) {

        let validate = await this.SupplierValidation(data);
        if (validate && !validate.valid) {
            return new ResponseData(false, "", { OptionName: data.name, error: validate.error })
        }

        data.createdAt = new Date();
        data.updatedDate = new Date();

        let supplier = data;
        const query: { text: string, values: any } = {

            text: `UPDATE "Suppliers" SET name= $1,"phone"= $2, email= $3,"website"= $4,"note"= $5, "address"= $6,"openingBalance" = $7, "country" = $8, "vatNumber" = $9, "paymentTerm" =$10
                WHERE id = $11   RETURNING id`,
            values: [supplier.name, supplier.phone, supplier.email, supplier.website, supplier.note, supplier.address, supplier.openingBalance, supplier.country, supplier.vatNumber, supplier.paymentTerm, supplier.id],

        };

        let inster = await client.query(query.text, query.values);

        return new ResponseData(true, "", []);
    }






    public static async saveImportSupplier(client: PoolClient, data: any, company: Company) {

        try {

            let validate = await this.SupplierValidation(data);
            if (validate && !validate.valid) {
                return new ResponseData(false, "", { OptionName: data.name, error: validate.error })
            }

            data.createdAt = new Date();
            data.updatedDate = new Date();
            // data.taxId = (await TaxesRepo.getDefaultTax(client,company.id)).data.id;

            const supplier: Supplier = data
            supplier.id = Helper.createGuid()
            const query: { text: string, values: any } = {
                text: `INSERT INTO  "Suppliers"(name,"phone", email,"website","note","address","openingBalance","country","vatNumber","paymentTerm", "companyId") 
                   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
                values: [supplier.name, supplier.phone, supplier.email, supplier.website, supplier.note, supplier.address, supplier.openingBalance, supplier.country, supplier.vatNumber, supplier.paymentTerm, company.id]
            };

            let inster = await client.query(query) // await client.query(query.text, query.values);

            // product.id = inster.rows[0].id;

            return new ResponseData(true, "", []);
        }
        catch (error: any) {
            console.log(error)
            return new ResponseData(false, error.message, [])
        }
    }
















    public static async SupplierValidation(data: any) {

        const schema = {
            type: "object",
            properties: {

                name: { type: 'string', "isNotEmpty": true, transform: ["trim"] },
                phone: { type: 'string' },
                email: { type: 'string' },
                website: { type: 'string' },
                note: { type: 'string' },
                address: { type: 'string' },
                openingBalance: { type: 'string' },
                country: { type: 'string' },
                vatNumber: { type: 'string' },

            },
            required: ["name", "phone", "email"],
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










    public static async getSupplierIdByName(client: PoolClient, supplierName: string, companyId: string) {
        try {
            const query: { text: string, values: any } = {

                text: `SELECT id FROM "Suppliers" where TRIM(LOWER(name)) = TRIM(LOWER($1)) and "companyId" = $2`,
                values: [supplierName, companyId]
            }

            let supplier = await client.query(query.text, query.values);

            return supplier.rows && supplier.rows.length > 0 ? supplier.rows[0].id : "";
        } catch (error: any) {
            throw new Error(error)
        }
    }




    public static async exprotSuppliers(company: Company, type: string = 'XLSX'): Promise<string> {
        try {
            const companyId = company.id;
            const selectQuery = `select name,"phone", email,"website","note","address","openingBalance","country","vatNumber" , "paymentTerm" from "Suppliers" c WHERE c."companyId" = $1`;

            const selectList: any = await DB.excu.query(selectQuery, [companyId]);

            let header = [
                { id: 'name', title: 'name' },
                { id: 'phone', title: 'phone' },
                { id: 'email', title: 'email' },
                { id: 'website', title: 'website' },
                { id: 'note', title: 'note' },
                { id: 'address', title: 'address' },
                { id: 'openingBalance', title: 'openingBalance' },
                { id: 'country', title: 'country' },
                { id: 'vatNumber', title: 'vatNumber' },
                { id: 'paymentTerm', title: 'paymentTerm' }
            ]

            let fileName = await exportHelper.exportCsvAndXlsx(company, type, 'Suppliers', selectList.rows, header)
            return fileName;



        } catch (error: any) {
          
            throw new Error("Error exporting Suppliers: " + error.message); // Include the actual error message
        }
    }


    public static async getSupplierCost(supplierId: string, productId: string) {
        try {
            const query = {
                text: `SELECT "Suppliers"."code",
                         "Suppliers".id,
                         "SupplierItems".cost,
                          "SupplierItems"."minimumOrder",
                          "Suppliers".name
                        From "Suppliers" 
                  Inner join "SupplierItems" on "SupplierItems"."supplierId" = "Suppliers".id   
                  where "SupplierItems"."productId" = $1
                  and  "Suppliers".id  = $2
            `,
                values: [productId, supplierId]
            }

            let item = await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", item.rows[0])
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getSupplierPayableByBranch(branchId: string, supplierId: string) {
        const client = await DB.excu.client()
        try {
            await client.query("BEGIN")
            let payable = await this.getPayables(client, [supplierId], branchId)
            let outStandingPayable = payable.length > 0 ? payable[0].outStandingPayable : 0
            await client.query("COMMIT")
            return new ResponseData(true, "", { outStandingPayable: outStandingPayable })

        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async getRefundDueList(client: PoolClient, supplierCreditIds: string[], billingIds: string[]) {
        try {

            const query = {
                text: `WITH "bills" AS (
                        SELECT "Billings".id,
                            "Billings"."total"::text::numeric - SUM("BillingPaymentLines"."amount"::text::numeric) AS "total"
                        FROM "Billings" 
                        INNER JOIN "BillingPaymentLines" ON "BillingPaymentLines"."billingId" = "Billings".id
                        WHERE "Billings"."id" = any($1::uuid[])
                        GROUP BY "Billings".id
                        HAVING "Billings"."total"::text::numeric - SUM("BillingPaymentLines"."amount"::text::numeric) <> "Billings"."total"::text::numeric
                    ), "billingBalance" AS (
                        SELECT "bills".id,
                            ABS("bills"."total"::text::numeric - SUM("SupplierCredits"."total"::text::numeric)) AS "total"
                        FROM "bills" 
                        INNER JOIN "SupplierCredits" ON "bills".id = "SupplierCredits"."billingId"
                        GROUP BY "bills".id, "bills"."total"
                    ), "supplieCredits" AS (
                        SELECT  
                            "SupplierCredits".id,
                            "SupplierCredits"."supplierCreditNumber" as "code",
                                'SupplierCredit' as "reference",
                            CASE 
                                WHEN ("SupplierCredits"."total" - SUM(
                                    CASE 
                                        WHEN "SupplierCredits"."total" >= "billingBalance"."total" THEN "billingBalance"."total"
                                        WHEN "SupplierCredits"."total" < "billingBalance"."total" THEN "SupplierCredits"."total"  
                                    END
                                ) OVER (ORDER BY "SupplierCredits"."createdAt" DESC) = 0) THEN 
                                    (CASE 
                                        WHEN "SupplierCredits"."total" >= "billingBalance"."total" THEN "billingBalance"."total"
                                        WHEN "SupplierCredits"."total" < "billingBalance"."total" THEN "SupplierCredits"."total" 
                                    END) 
                                ELSE 
                                    "billingBalance"."total" - SUM(case when   "SupplierCredits"."total" >=  "billingBalance"."total" then  "billingBalance"."total"
                            when  "SupplierCredits"."total" <  "billingBalance"."total" then     "SupplierCredits"."total"  end) OVER (ORDER BY "SupplierCredits"."createdAt" DESC ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) 
                            END AS "credit"
                        FROM "SupplierCredits" 
                        INNER JOIN "billingBalance" ON "billingBalance".id = "SupplierCredits"."billingId"
                        ORDER BY "SupplierCredits"."createdAt" DESC
                    ),
					"appliedCredits" as (
                        select"supplieCredits".id , sum("SupplierAppliedCredits"."amount"::text::numeric)  as "total" from "SupplierAppliedCredits" 
                        inner join  "supplieCredits" on "supplieCredits".id = "SupplierAppliedCredits"."supplierCreditId"
                        group by "supplieCredits".id 
                        ),"refunds" as (
                        select  "supplieCredits".id , sum("SupplierRefunds"."total"::text::numeric) as "total" from "SupplierRefunds" 
                        inner join  "supplieCredits" on "supplieCredits".id = "SupplierRefunds"."supplierCreditId"
                        group by "supplieCredits".id 
                        ),"creditNoteSummary" as (
                        select  "supplieCredits"."id",
                            "supplieCredits"."code",
                            "supplieCredits"."reference",
                            "supplieCredits"."credit"::text::numeric - (COALESCE("appliedCredits"."total",0) + COALESCE("refunds"."total",0)) as "credit"
                            from "supplieCredits"
                        left join "appliedCredits" on "appliedCredits".id =  "supplieCredits".id
                        left join "refunds" on "refunds".id =  "supplieCredits".id
                                            )
											
											select * from "creditNoteSummary" where id = any($2::uuid[])
                                            and "credit" > 0 `,
                values: [billingIds, supplierCreditIds]
            }

            let supplieCredits = await client.query(query.text, query.values);

            if (supplieCredits && supplieCredits.rows && supplieCredits.rows.length > 0) {
                return supplieCredits.rows
            }
            return []
        } catch (error: any) {
            throw new Error(error)
        }
    }



    public static async getMiniSuppliersByIds(data: any, company: Company) {
        try {
            let supplierIds = data.supplierIds;
            const query = {
                text: `SELECT id, name , phone from "Suppliers" where id = any($1)`,
                values: [supplierIds]
            }

            let suppliers = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", suppliers.rows)
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async addSupplierItem(data: any, company: Company) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")
            let supplierId = data.supplierId;
            let items = data.items;

            for (let index = 0; index < items.length; index++) {
                const item = items[index];
                const temp = new SupplierItem();
                temp.ParseJson(item);
                temp.supplierId = supplierId;
                await this.addSupplierItems(client, temp, company.id)
            }

            await client.query("COMMIT")

            return new ResponseData(true, "", [])
        } catch (error: any) {
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async deleteSupplierItemByProductId(data: any, company: Company) {

        try {


            let supplierId = data.supplierId;
            let productIds = data.productIds;

            await DB.excu.query('DELETE FROM "SupplierItems" where "productId" = any($1) and "supplierId" =$2', [productIds, supplierId])


            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getSupplierProductsByBranch(supplierId: string, branchId: string) {

        try {

            const query: { text: string, values: any } = {
                text: `with "records" as (
                        SELECT  "BillingLines"."productId", COALESCE("BillingLines"."note",'') as note,
                                "BillingLines".qty -   COALESCE(sum("SupplierCreditLines".qty),0) as "maxQty"
                        FROM "BillingLines"
                        inner join "Billings" on "Billings".id = "BillingLines"."billingId"
                        left join "SupplierCreditLines" on "SupplierCreditLines"."billingLineId" = "BillingLines".id
                        WHERE "Billings"."supplierId" = $1
                        AND "Billings"."branchId"= $2
                        and "Billings".status <> 'Draft'
                        group by "BillingLines".id
                        HAVING "BillingLines".qty -   COALESCE(sum("SupplierCreditLines".qty),0) > 0 
                        )
                        select distinct  "productId",
                        "Products".name,
                        note
                        from "records"
                        left join "Products" on "Products".id = "productId"
            `,
                values: [supplierId, branchId]
            }
            const bills = await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", bills.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }


    public static async exportSupplierOpeningBalance(branchId: string, company: Company, type: string = 'XLSX'): Promise<string> {
        try {
            const companyId = company.id;
            const selectQuery = `--sql
             select
             "name",
             "phone",
             "SupplierOpeningBalance"."openingBalance"
             from "Suppliers"
             inner join "SupplierOpeningBalance" on "SupplierOpeningBalance"."supplierId" = "Suppliers".id
             where  "Suppliers"."companyId" = $1
             and    ( "SupplierOpeningBalance"."branchId" = $2  )
            `;

            const selectList: any = await DB.excu.query(selectQuery, [companyId, branchId]);

            let header = [
                { id: 'name', title: 'Name' },
                { id: 'phone', title: 'Phone' },
                { id: 'openingBalance', title: 'Opening Balance' }
            ]

            let fileName = await exportHelper.exportCsvAndXlsx(company, type, 'Suppliers Opening Balance', selectList.rows, header)
            return fileName;



        } catch (error: any) {
          
            throw new Error("Error exporting Suppliers: " + error.message); // Include the actual error message
        }
    }

    public static async getSuppliersIds(client: PoolClient, companyId: string, suppliers: any[]) {
        try {
            let suppliersDetails = suppliers.map((s: any) => { return { name: s.name, phone: s.phone } })
            const query = {
                text: `WITH input AS (
                            SELECT jsonb_array_elements($1::jsonb) AS elem
                        )
                        SELECT 
                            s.id,
                            s."name",
                            s."phone"
                        FROM "Suppliers" s
                        INNER JOIN input i 
                            ON lower(trim(s."name")) = lower(trim(i.elem->>'name'))
                        AND lower(trim(s."phone")) = lower(trim(i.elem->>'phone'))
                        WHERE s."companyId" = $2;
`,
                values: [JSON.stringify(suppliersDetails), companyId]
            }

            let suppliersList = await client.query(query.text, query.values);
            let supplierIds = suppliersList.rows;
            if (supplierIds && supplierIds.length > 0) {
                suppliers = suppliers.map((s: any) => {
                    let supplier = supplierIds.find(f => String(f.phone).trim().toLowerCase() == s.phone.trim().toLowerCase() && f.name.trim().toLowerCase() == s.name.trim().toLowerCase())
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


    public static async importSuppliersOpeningBalance(data: any, company: Company) {
        const client = await DB.excu.client();
        try {

            let branchId = data.branchId;
            let supplierData = data.suppliers
            const errors: any[] = [];


            let negtiveValues = supplierData.filter((f: any) => f.openingBalance && f.openingBalance < 0)
            if (negtiveValues && negtiveValues.length > 0) {
                throw new ValidationException("Supplier Opening Balance Should be Greater than 0 ")
            }
            let emptyPhones = supplierData.filter((f: any) => !f.phone || (f.phone && String(f.phone).trim() == ''))
            if (emptyPhones && emptyPhones.length > 0) {
                throw new ValidationException("Supplier Phone Cannot be Empty")
            }
            let emptyName = supplierData.filter((f: any) => !f.name || (f.name && String(f.name).trim() == ''))
            if (emptyName && emptyName.length > 0) {
                throw new ValidationException("Supplier Name Cannot be Empty")
            }
            const duplicates = supplierData
                .map((item: any) => item.phone)
                .filter((phone: string, index: any, arr: any[]) => arr.indexOf(phone) !== index); // keep only repeated ones

            const uniqueDuplicates = [...new Set(duplicates)];

            if (uniqueDuplicates && uniqueDuplicates.length > 0) {
                throw new ValidationException("Phone Number Must be Unique")
            }
            supplierData = supplierData.filter((f: any) => f.phone && f.name && f.name.trim() && f.phone.trim())

            await client.query("BEGIN")


            const totalItems = supplierData.length;
            const pageSize = 100;

            const totalPages = Math.ceil(totalItems / pageSize)
            for (let page = 1; page <= totalPages; page++) {
                data = supplierData.splice((page - 1) * pageSize, page * pageSize);


                let suppliers = await this.getSuppliersIds(client, company.id, data)
                let notFindSuppliers = suppliers.filter((f: any) => !f.id || f.id == null)
                notFindSuppliers.forEach(element => {
                    errors.push({
                        "supplierName": element.name,
                        "error": `Supplier Not Found`
                    })
                });


                suppliers = suppliers.filter((f: any) => f.id && f.id != null)
                const query = {
                    text: `WITH input AS (
                    SELECT jsonb_array_elements(
                    $1::jsonb
                    ) AS elem
                )
                SELECT 
                    s.id,
                    CASE 
                        WHEN COALESCE(SUM(bpl."amount"), 0) > COALESCE((elem->>'openingBalance')::numeric,0)::numeric 
                        THEN false 
                        ELSE true 
                    END AS "isValid",
                    (elem->>'openingBalance')::numeric as "enteredOpeningBalance",
                    COALESCE(SUM(bpl."amount"), 0) as "paid",
                   sob.id as "openingBalanceId",
                    sob."openingBalance" as "currentOpeningBalance",
                    s.name as "supplierName" 
                FROM "Suppliers" s
                INNER JOIN input i 
                    ON s.id = (i.elem->>'id')::uuid
                LEFT JOIN "SupplierOpeningBalance" sob 
                    ON sob."supplierId" = s.id 
                AND sob."branchId" =$2
                LEFT JOIN "BillingPaymentLines" bpl 
                    ON bpl."openingBalanceId" = sob.id
                WHERE s."companyId" = $3
                GROUP BY s.id, i.elem    , sob.id, s.name;`,
                    values: [JSON.stringify(suppliers), branchId, company.id]
                }

                let supplierValidation = await client.query(query.text, query.values);
                let invalidSuppliers = supplierValidation.rows.filter((f: any) => !f.isValid)
                if (invalidSuppliers && invalidSuppliers.length > 0) {
                    invalidSuppliers.forEach((s: any) => {
                        errors.push({
                            "supplierName": s.supplierName,
                            "error": `The Opening Balance Entered ${s.enteredOpeningBalance ?? 0} is less than the paid amount ${s.paid}`
                        })
                    })
                }
                suppliers = supplierValidation.rows.filter((f: any) => f.isValid)
                let openingBalanceSuppliers: any[] = []
                /** update supplier */

                let newOpeningBalance = suppliers.filter((f: any) => (!f.openingBalanceId || f.openingBalanceId == null) && (f.enteredOpeningBalance && f.enteredOpeningBalance > 0))
                let updateOpeningBalance = suppliers.filter((f: any) => (f.openingBalanceId && f.openingBalanceId != null && (f.enteredOpeningBalance != f.currentOpeningBalance)))

                if (updateOpeningBalance && updateOpeningBalance.length > 0) {


                    const updateValues = suppliers.map((u: any) => [
                        u.id ?? null,
                        u.enteredOpeningBalance ?? null,
                        branchId ?? null
                    ]);
                    if (updateValues.length > 0) {
                        const formattedQuery = format(`
                    UPDATE "SupplierOpeningBalance" AS s
                    SET "openingBalance" = COALESCE(v.openingBalance::numeric,0)::numeric
                    FROM (VALUES %L) AS v(supplierId, openingBalance, branchId)
                    WHERE s."supplierId" = v.supplierId::uuid
                    AND s."branchId" = v.branchId::uuid
                `, updateValues);

                        await client.query(formattedQuery);
                    }
                    updateOpeningBalance.forEach(element => {
                        openingBalanceSuppliers.push(element.id)
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
                                    INSERT INTO "SupplierOpeningBalance" 
                                        ("supplierId", "openingBalance", "branchId", "companyId")
                                    VALUES %L `, insertValues);

                        await client.query(insertQuery);
                    }

                    newOpeningBalance.forEach(element => {
                        openingBalanceSuppliers.push(element.id)
                    });
                }
                await client.query('COMMIT')

                if (openingBalanceSuppliers && openingBalanceSuppliers.length > 0) {
                    let queueInstance = TriggerQueue.getInstance();
                    openingBalanceSuppliers.forEach(element => {
                        queueInstance.createJob({ type: "SupplierOpeningBalance", id: element, companyId: company.id })

                        let userBalancesQueue = SupplierBalanceQueue.getInstance();
                        userBalancesQueue.createJob({ userId: element, dbTable: 'SupplierOpeningBalance' })
                    });
                }


            }



            return new ResponseData(true, "", { errors: errors })
        } catch (error: any) {
            await client.query("ROLLBACK")
            throw new Error(error)
        } finally {
            client.release()
        }

    }


}