/* eslint-disable prefer-const */
import { DB } from "../../dbconnection/dbconnection"
import { ResponseData } from "@src/models/ResponseData";
import { Company } from "@src/models/admin/company";
import { CompanyValdation } from "@src/validationSchema/admin/company.Schema";
import { BranchesRepo } from "./branches.repo";
import { EmployeeRepo } from "./employee.repo";
import { PoolClient } from "pg";
import { Account } from "@src/models/account/Account";
import { AccountsRepo } from "../app/accounts/account.repo";

import { PaymnetMethodRepo } from "../app/accounts/paymentMethod.repo";


import { FileStorage } from "@src/utilts/fileStorage";
import { sign, verify, decode } from 'jsonwebtoken'
import { ProductRepo } from "../app/product/product.repo";
import { MenuRepo } from "../app/product/menu.repo";
import { DepartmentRepo } from "../app/product/department.repo";
import { CategoryRepo } from "../app/product/category.repo";
import { OptionRepo } from "../app/product/option.repo";
import { RecipeRepo } from "../app/product/recipe.repo";
import { MatrixRepo } from "../app/product/matrix.repo";
import { priceManagmentRepo } from "../app/product/priceManagment.repo";
import { EmployeePrivilegeRepo } from "./EmployeePrivilege.repo";
import { EmployeePrivileg, Privilege } from "@src/models/admin/employeePrivielge";
import { KitchenSectionRepo } from "../app/product/kitchenSection.Repo";
import { TaxesRepo } from "../app/accounts/taxes.repo";
import { S3Storage } from "@src/utilts/S3Storage";

import { WebSiteBuilderRepo } from "../app/settings/webSiteBuilder.repo";
import { TablesRepo } from "../app/settings/tables.repo";
import { Service, ServiceSetting } from "@src/models/Settings/service";
import { ServiceRepo } from "./services.repo";
import { CustomerRepo } from "../app/accounts/customer.repo";
import { ProductOption } from "@src/models/product/Product";
import { Shipping } from "@src/models/Settings/Shipping";
import { BranchDeliveryAddress, BranchOption, Branches } from "@src/models/admin/Branches";
import { ValidationException } from "@src/utilts/Exception";
import { SocketCompanyRepo } from "../socket/company.socket";
import { text } from "pdfkit";
import { BudgetRepo } from "../app/accounts/Budget.repo";
import { SupplierRepo } from "../app/accounts/supplier.repo";
import { DiscountRepo } from "../app/accounts/discount.repo";
import { PriceLabel } from "@src/models/product/PriceLabel";
import { SurchargeRepo } from "../app/accounts/surcharge.repo";
import { CompanyGroupRepo } from "./companyGroups.repo";
import { AuthRepo } from "../app/auth.repo";
import { ExpenseValidation } from "@src/validationSchema/account/expense.Schema";
import { ThemeRepo } from "../ecommerce/theme.repo";
import { Employee } from "@src/models/admin/employee";
import { jofotara } from "@src/models/Settings/jofotara";
import { RedisCaching } from "@src/utilts/redisCaching";
import { ProductDimensionRepo } from "../app/product/productDimensions.repo";


export class CompanyRepo {

    //Validate Company Name Within CompanyGroup
    public static async checkIfCompanyNameExist(client: PoolClient, companyId: string | null, name: string, companyGroupId: string) {


        const query: { text: string, values: any } = {
            text: `select  count(*) as qty  from "CompanyGroups" 
                        inner join "Companies" on "Companies". "companyGroupId" = "CompanyGroups".id 
                        where  LOWER("Companies".name) = LOWER($1) 
                        and  "Companies".id <> $2 `,
            values: [
                name,
                companyId

            ],
        };
        if (companyId == null) {
            query.text = `SELECT count(*) as qty FROM "Companies" where LOWER(name) = LOWER($1)  and "companyGroupId" = $2 `;
            query.values = [name, companyGroupId];
        }

        const resault = await client.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }

        return false;
    }

    public static async checkIfCompanySlugExist(client: PoolClient, companyId: string | null, slug: string) {


        const query: { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "Companies" where LOWER("slug") = LOWER($1)  `,
            values: [
                slug

            ],
        };
        if (companyId != null) {
            query.text = `SELECT count(*) as qty FROM "Companies" where LOWER("slug") = LOWER($1)  and "id" <> $2 `;
            query.values = [slug, companyId];
        }

        const resault = await client.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }

        return false;
    }
    public static async insertCompany(client: PoolClient, data: any, adminId = null) {

        try {

            //Validate Company Data 
            const validate = await CompanyValdation.addcompanyValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            const isNameExist = await this.checkIfCompanyNameExist(client, null, data.company.name, data.company.companyGroupId);
            if (isNameExist) {

                throw new ValidationException("Company Name Already Used ")
            }
            const isSlugExist = await this.checkIfCompanySlugExist(client, null, data.company.slug);
            if (isSlugExist) {

                throw new ValidationException("Company Slug Already Used ")
            }


            const company = new Company();
            company.ParseJson(data.company);
            let employeeData;
            if (data.employee && data.employee.email != null && data.employee.email != "") {
                employeeData = new Employee();
                employeeData.ParseJson(data.employee);
            }

            const branchData = data.branch;
            //Insert Company
            const query: { text: string, values: any } = {
                text: `INSERT INTO "Companies"(name,
                                                     slug,
                                                     country,
                                                     translation,
                                                     "companyGroupId",
                                                     type,
                                                     "roundingType",
                                                     "smallestCurrency",
                                               
                                                     options,
                                                     "isInclusiveTax",
                                                     "vatNumber",
                                                     "printingOptions",
                                                     "invoiceOptions",
                                                     "updatedDate",
                                                     "features") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id,type`,
                values: [
                    company.name,
                    company.slug,
                    company.country,
                    company.translation,
                    company.companyGroupId,
                    company.type,
                    company.roundingType,
                    company.smallestCurrency,

                    company.options,
                    company.isInclusiveTax,
                    company.vatNumber,
                    company.printingOptions,
                    company.invoiceOptions,
                    company.updatedDate,
                    company.features
                ]
            }
            const companyInsert = await client.query(query.text, query.values);
            company.id = (<any>companyInsert.rows[0]).id


            if (adminId != null) {
                let logid = await CompanyGroupRepo.addAdminLog(client, `Add Company`, `Added Company ${company.name} `, adminId, company.id);
            }


            // employeeData.companyId = company.id;
            // employeeData.companyGroupId = company.companyGroupId;


            const fileStorage = new FileStorage();
            const companySettings = await fileStorage.getCompanySettings(company.country);
            const defaultTaxes = companySettings?.settings.Taxes;

            /** Assign Country Default Taxes to Company */
            if (defaultTaxes && defaultTaxes.length > 0) {
                for (let index = 0; index < defaultTaxes.length; index++) {
                    const element = defaultTaxes[index];
                    element.companyId = company.id
                    await TaxesRepo.addTax(client, element, company)
                }
            }

            //Insert A Branch 

            let branchIds = [];
            for (let index = 0; index < branchData.length; index++) {
                const element = branchData[index];
                element.companyId = company.id

                let insertBranch = await BranchesRepo.InsertBranch(client, element)
                element.id = insertBranch.data.id;


                if (adminId != null) {
                    let logid = await CompanyGroupRepo.addAdminLog(client, `Add Branch`, `Added Branch ${element.name}`, adminId, element.id);
                }

                branchIds.push(element.id)
                if (employeeData) {
                    employeeData.branches.push({ id: element.id })

                }
            }
            const companyType = company.type;
            let serviceTypes = new Service().serviceTypes();
            serviceTypes = serviceTypes.filter(t => t.companyType == companyType)
            for (let index = 0; index < serviceTypes.length; index++) {
                const element = serviceTypes[index];
                const service = new Service();
                service.ParseJson(element);
                service.index = index;
                for (let index = 0; index < branchIds.length; index++) {
                    const id = branchIds[index];
                    let serviceSetting = new ServiceSetting();
                    serviceSetting.branchId = id;
                    serviceSetting.setting = service.setting;
                    service.branches.push(serviceSetting);
                }
                await ServiceRepo.AddBranchServices(client, service, company.id)
            }

            if (employeeData) {
                employeeData.branchId = branchData.id;
                employeeData.superAdmin = true;
            }



            /**Insert Customize Privileg */
            let waiter = new EmployeePrivileg();
            waiter.name = "Waiter"
            waiter.Waiter();
            await EmployeePrivilegeRepo.savePrivilege(client, waiter, company.id)

            let cashier = new EmployeePrivileg();
            cashier.name = "Cashier"
            cashier.Cashier();
            await EmployeePrivilegeRepo.savePrivilege(client, cashier, company.id)

            let supervisor = new EmployeePrivileg();
            supervisor.name = "Supervisor"
            supervisor.Supervisor();
            await EmployeePrivilegeRepo.savePrivilege(client, supervisor, company.id)


            //Insert Owner Privilage

            const privilege = new EmployeePrivileg();
            privilege.name = "Super Admin"
            privilege.companyId = company.id;


            const privilegeData = await EmployeePrivilegeRepo.savePrivilege(client, privilege, company.id)
            if (employeeData) {
                employeeData.privilegeId = privilegeData.data.id
                employeeData.user = true;
                employeeData.admin = true;
                employeeData.passCode = "1"

            }

            // Insert Employee (Super Admin)
            if (employeeData && data.employee && data.employee.email != null && data.employee.email != "") {
                employeeData.companyId = company.id;
                let empid = (await EmployeeRepo.InsertEmployee(client, employeeData, company.id)).data.id
                if (adminId != null) {
                    let logid = await CompanyGroupRepo.addAdminLog(client, `Add Employee`, `Added Employee ${employeeData.name}`, adminId, empid);
                }
            } else { // invite companyGroup superAdmin 
                await this.inviteSuperAdmin(client, company.companyGroupId, company.id, branchIds, privilegeData.data.id)

            }





            const accounts = new Account();
            const accountTypes = accounts.accountTypes();
            for (let index = 0; index < accountTypes.length; index++) {
                const account = accountTypes[index];
                await AccountsRepo.addAccounts(client, account, company.id)
            }

            //Insert Default Payment 
            await PaymnetMethodRepo.addDeafultPayments(client, company.id, company.settings.afterDecimal);


            //Insert Company Logo
            // if (company.base64Image != null && company.base64Image != "") {
            //     const storage = new FileStorage();
            //     const logoUrl: any = await storage.saveComapnyLogo(company.id, company.base64Image)
            //     await this.setCompanyLogo(client, company.id, logoUrl) // save logo URL in DB 
            // }
            return new ResponseData(true, "", { id: company.id })

        } catch (error: any) {

            console.log(error);
            throw new Error(error.message)
        }
    }
    public static async editCompany(client: PoolClient, data: any) {

        try {

            //Validate Company



            const validate = await CompanyValdation.editCompanyValidation(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }
            const isNameExist = await this.checkIfCompanyNameExist(client, data.id, data.name, data.companyGroupId);
            if (isNameExist) {
                throw new ValidationException("Company Name Already Used ")
            }
            const isSlugExist = await this.checkIfCompanySlugExist(client, data.id, data.slug);
            if (isSlugExist) {

                throw new ValidationException("Company Slug Already Used ")
            }

            const company = new Company();
            company.ParseJson(data);
            company.updatedDate = new Date();
            const query: { text: string, values: any } = {
                text: `
                 with "oldData" as (
                 select "mediaId" as "oldMediaId" from "Companies" where "id" = $13
                 )
                UPDATE "Companies" SET name = ($1), 
                                                     translation = ($2),
                                                     "smallestCurrency"=$3,
                                                     "roundingType"=$4 ,
                                                     "mediaId"=$5,
                                                     "options"=$6,
                                                     "voidReasons"=$7,
                                                     "isInclusiveTax"=$8,
                                                     "vatNumber"=$9,
                                                     "printingOptions"=$10,
                                                     "invoiceOptions"=$11,
                                                     "updatedDate"=$12
                                                      WHERE id = ($13) 
                                                      returning (select * from "oldData")
                                                      `,
                values: [company.name,
                company.translation,
                company.smallestCurrency,
                company.roundingType,
                company.mediaId,
                company.options,
                JSON.stringify(company.voidReasons),
                company.isInclusiveTax,
                company.vatNumber,
                company.printingOptions,
                company.invoiceOptions,
                company.updatedDate,
                company.id],
            }

            let insertCompany = await client.query(query.text, query.values);

            let oldData = insertCompany.rows[0]
            if (oldData.oldMediaId != company.mediaId) {
                await S3Storage.deleteAppleSplash(company.id)
            }
            // if (company.base64Image != null && company.base64Image != "") {
            //     const storage = new FileStorage();
            //     const logoUrl: any = await storage.saveComapnyLogo(company.id, company.base64Image)
            //     await this.setCompanyLogo(client, company.id, logoUrl) // save logo URL in DB 
            // }

            // let waiter = new EmployeePrivileg();
            // waiter.name = "Waiter"
            // waiter.Waiter();
            // await EmployeePrivilegeRepo.savePrivilege(client, waiter, company.id)

            // let cashier = new EmployeePrivileg();
            // cashier.name = "Cashier"
            // cashier.Cashier();
            // await EmployeePrivilegeRepo.savePrivilege(client, cashier, company.id)

            // let supervisor = new EmployeePrivileg();
            // supervisor.name = "Supervisor"
            // supervisor.Supervisor();
            // await EmployeePrivilegeRepo.savePrivilege(client, supervisor, company.id)

            const branchIds = await BranchesRepo.getCompanyBranchIds(client, company.id);
            await SocketCompanyRepo.sendUpdateCompanySettings(client, company.id, branchIds)
            await RedisCaching.deleteCatchedData(`CompanySettings:${company.country}`)
            await RedisCaching.deleteCatchedData(`company_${company.id}_features`);
            return new ResponseData(true, "Updated Successfully", [])

        } catch (error: any) {

            console.log(error)



            throw new Error(error.message)

        }
    }
    public static async setCompanyLogo(client: PoolClient, companyId: string, logoUrl: string) {
        try {
            const query: { text: string, values: any } = {
                text: `UPDATE "Companies" 
                               SET logo=$1
                               WHERE id = $2`,
                values: [logoUrl, companyId]
            }
            await client.query(query.text, query.values)
        } catch (error: any) {


            throw new Error(error.message)
        }
    }
    public static async getCompanyAfterDecimal(client: PoolClient, companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT country from "Companies" where id=$1`,
                values: [companyId]
            }
            const companyData = await client.query(query.text, query.values);
            const country = (<any>companyData.rows[0]).country
            const company = new Company();
            company.country = country
            const storage = new FileStorage();
            const companySettings = await storage.getCompanySettings(company.country)
            if (companySettings) {
                company.settings = companySettings.settings;
            } else {
                company.settings = null
            }

            return company.settings.afterDecimal;
        } catch (error: any) {


            throw new Error(error.message)
        }
    }
    public static async getCountryAfterDecimal(country: string) {
        try {



            const storage = new FileStorage();
            let settings;
            const companySettings = await storage.getCompanySettings(country)

            if (companySettings) {
                settings = companySettings.settings;
                return settings.afterDecimal;
            } else {
                return 3
            }

        } catch (error: any) {


            throw new Error(error.message)
        }
    }
    public static async getCompanySettings(country: string) {
        try {



            const storage = new FileStorage();
            let settings;
            const companySettings = await storage.getCompanySettings(country)
            if (companySettings) {
                return companySettings.settings
            }
            return null
        } catch (error: any) {


            throw new Error(error.message)
        }
    }
    public static async getCompanySlug(branchId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT "Companies".slug from "Branches"
                       INNER JOIN "Companies" on "Companies".id = "Branches"."companyId" 
                       where "Branches".id =$1 `,
                values: [branchId]
            }

            let company = await DB.excu.query(query.text, query.values);
            return (<any>company.rows[0]).slug
        } catch (error: any) {


            throw new Error(error)
        }
    }







    public static async setApiToken(token: string, companyId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `UPDATE "Companies" SET "apiToken" = $1 WHERE id = $2;`,
                values: [token, companyId]
            }
            await DB.excu.query(query.text, query.values);
            return true;
        } catch (error: any) {

            throw new Error(error)
        }
    }

    /**
     * Lightweight company loader for background jobs (recurring bill /
     * expense / invoice / journal cron).
     *
     * Differences vs `getCompanyPrefrences`:
     *  - Uses the caller-provided client so the read participates in the
     *    same transaction. Avoids checking out a SECOND pool connection
     *    while the caller's client is sitting in BEGIN (which would leave
     *    it "idle in transaction" and risk being killed by Postgres).
     *  - Selects only the columns that the cron's downstream callers
     *    (addBilling / addExpense / addInvoice / addManualJournal) actually
     *    consume: id, country.
     *  - Skips the S3 logo fetch (`getDefaultImageBase64`) entirely — the
     *    cron does not need the company logo, and the original code was
     *    making one S3 round-trip per recurring rule.
     *  - Still loads `settings` via FileStorage (Redis-cached by country),
     *    so `afterDecimal` and `timeOffset` are populated the same way the
     *    cron callers expect.
     *
     * Returns a `Company` instance with the fields the cron needs:
     *   - id, country
     *   - settings, afterDecimal, timeOffset
     *
     * Returns `null` if the branch does not exist.
     */
    public static async getCompanyMinimalForBranch(client: PoolClient | null, branchId: string): Promise<Company | null> {
        try {
            const queryText = `SELECT "Companies".id,
                                      "Companies".country
                               FROM "Companies"
                               INNER JOIN "Branches" ON "Branches"."companyId" = "Companies".id
                               WHERE "Branches".id = $1`
            // If a client is provided, run the SELECT through it so the read
            // participates in the caller's transaction. Otherwise fall back
            // to the pool (used by callers that have no held transaction,
            // e.g. the recurring journal cron).
            const res = client
                ? await client.query(queryText, [branchId])
                : await DB.excu.query(queryText, [branchId])
            if (!res.rows || res.rows.length === 0) return null

            const company = new Company()
            company.ParseJson(res.rows[0])

            const storage = new FileStorage()
            const companySettings = await storage.getCompanySettings(company.country)
            if (companySettings) {
                company.settings = companySettings.settings
                // Mirror what generateAuto* used to do manually after the
                // getCompanyPrefrences call: hoist a couple of settings
                // fields onto the company object for downstream consumers.
                ;(company as any).afterDecimal = companySettings.settings?.afterDecimal
                ;(company as any).timeOffset = companySettings.settings?.timeOffset
            }
            return company
        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    public static async getCompanyPrefrences(companyId: string | null, branchId: string | null = null) {
        try {
            let query = `SELECT "Companies".id,
                                "Companies".name,
                                "Companies".translation,
                                "Companies".country,
                                "Companies".slug,
                                "Companies".jofotara,
                                "Companies"."smallestCurrency",
                                "Companies"."roundingType",
                                "Companies"."options",
                                "Companies"."mediaId",
                                "Companies"."voidReasons",
                                "Companies"."vatNumber",
                                "Companies"."isInclusiveTax",
                                "Companies"."printingOptions",
                                "Companies"."invoiceOptions",
                                "Companies"."invoiceTemplate",
                                "Companies"."createdAt",
                                "Companies"."openingBalanceDate",
                                "Companies"."type",
                                "Companies"."features",
                                "Media".url as "mediaUrl",
                                "Media"."size"
                        `

            if (branchId != null) {
                query += ` ,"Branches"."workingHours" `
                query += ` ,"Branches"."name" as "branchName" `
                query += ` ,"Branches"."location" as "branchLocation" `
                query += ` ,"Branches"."address" as "branchAddress" `
                query += ` ,"Branches"."phoneNumber" `
            }

            let filterQuery = ` 
            FROM "Companies" 
            left join "Media"
            on "Media".id = "Companies"."mediaId"
            INNER JOIN "Branches" ON "Branches"."companyId" = "Companies".id
            where`
            query += filterQuery;
            const filter = branchId != null ? `"Branches".id = $1` : `"Companies".id =$1`
            query += filter;
            const values = branchId != null ? [branchId] : [companyId]

            const companyData = await DB.excu.query(query, values)
            let company = new Company();
            company.ParseJson(companyData.rows[0]);


            const storage = new FileStorage();
            const companySettings = await storage.getCompanySettings(company.country)
            if (companySettings) {
                company.settings = companySettings.settings
            }


            if (company.mediaUrl && company.mediaUrl.defaultUrl && company.mediaId) {

                const mediaName = company.mediaUrl.defaultUrl.substring(company.mediaUrl.defaultUrl.lastIndexOf('/') + 1)
                const extension = mediaName.split('.')[1]
                const imageData = await S3Storage.getDefaultImageBase64(mediaName.split('.')[0], company.id, extension);
                if (branchId != null) {
                    if (imageData) {
                        let imageTemp = imageData.media.split(';base64,').pop();
                        company.base64Image = imageTemp ?? "";
                    }
                } else {
                    if (imageData) {
                        company.base64Image = 'data:image/' + extension + ';base64,' + imageData.media;
                    }
                }
            }

            //  if(branchId)
            //  {
            //     let companyTemp:any = company;
            //     companyTemp.coveredAddresses = (<any> companyData.rows[0]).coveredAddresses;
            //     company = companyTemp;
            //  }

            return new ResponseData(true, "", company)
        } catch (error: any) {


            throw new Error(error.message)
        }
    }


    public static async getMiniCompany(companyId: string) {
        try {
            const query = {
                text: ` SELECT id,country, name , slug FROM "Companies" where id = $1 `,
                values: [companyId]
            }

            let companyData = await DB.excu.query(query.text, query.values);
            if (companyData && companyData.rowCount && companyData.rowCount > 0) {
                let company = new Company()
                company.ParseJson(companyData.rows[0]);
                const storage = new FileStorage();
                const companySettings = await storage.getCompanySettings(company.country)
                if (companySettings) {
                    company.settings = companySettings.settings
                }
                company.afterDecimal = company.settings.afterDecimal
                return company;
            }
            return null;
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }
    public static async getCompanyBySubDomain(subDomain: string) {
        try {

            let query: { text: string, values: any } = {
                text: `SELECT "id","country",slug, "features" from "Companies" where trim(lower(slug))=lower($1)`,
                values: [subDomain]
            }
            let company: any = await DB.excu.query(query.text, query.values);
            let fileStorage = new FileStorage();
            if (company.rowCount > 0) {
                company.rows[0].settings = (await fileStorage.getCompanySettings(company.rows[0].country))?.settings

            } else {
                throw new ValidationException("Company Not Found")
            }
            return new ResponseData(true, "", company.rows[0])

        } catch (error: any) {


            throw new Error(error.message)
        }
    }

    public static async getAllCompanies(companyId: any) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT "Companies"."name",
                "Companies".id,
                              "Media".url as "mediaUrl"
                            FROM "Companies"
                         LEFT JOIN "Media" On "Media".id = "Companies"."mediaId"
                         WHERE "companyGroupId"= (Select "companyGroupId" from "Companies" where id = $1 ) `,
                values: [companyId],
            }
            const companies = await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", companies.rows)

        } catch (error: any) {

            throw new Error(error.message)
        }
    }



    public static async getAdminCompaniesList() {
        try {
            const query: { text: string } = {
                text: `SELECT "Companies".id, "Companies"."name",  "cg".name as "GroupName"
                FROM "Companies"
                join "CompanyGroups" cg on "cg".id = "Companies"."companyGroupId" order by "Companies"."createdAt" DESC`
            }
            const companies = await DB.excu.query(query.text)

            return new ResponseData(true, "", companies.rows)

        } catch (error: any) {

            throw new Error(error.message)
        }
    }
















    public static async getCompanyById(companyId: string) {
        try {

            const query: { text: string, values: any } = {
                text: 'SELECT * FROM "Companies" WHERE id=($1)',
                values: [companyId],
            }

            const company = (await DB.excu.query(query.text, query.values)).rows;
            const companyObj = new Company();
            companyObj.ParseJson(company[0])
            const storage = new FileStorage();
            const companySettings = await storage.getCompanySettings(companyObj.country)
            if (companySettings) {
                companyObj.settings = companySettings.settings;
            }
            return new ResponseData(true, "", companyObj)

        } catch (error: any) {

            throw new Error(error.message)
        }
    }
    public static async getToken(data: any,remeberMe:boolean=false) {
        try {

            const refreshSecretMaxAge = remeberMe ?  (process.env.REFRESH_TOKEN_MAXAGE_REMEMBERME??'7d' ): (process.env.REFRESH_TOKEN_MAXAGE??'3d')
            const accessToken = sign(data, process.env.ACCESS_TOKEN_SECRET as string, {
                expiresIn: process.env.ACCESS_TOKEN_MAXAGE
            });
            const refreshToken = sign(data, process.env.REFRESH_TOKEN_SECRET as string, { expiresIn:refreshSecretMaxAge });
            const decoded: any = decode(refreshToken);
            const refreshTokenExpiryDate = new Date(decoded.exp * 1000);

            return { accessToken: accessToken, refreshToken: refreshToken, refreshTokenExpiryDate: refreshTokenExpiryDate }
        } catch (error) {


        }
    }


    public static async getApiToken(data: any) {
        try {
            const accessToken = sign(data, process.env.ACCESS_TOKEN_SECRET as string);
            return (accessToken);
        } catch (error) {

        }
    }



    public static async getsavedApiToken(companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "apiToken" from "Companies" where id =$1`,
                values: [companyId]
            }

            const apiToken = await DB.excu.query(query.text, query.values);
            console.log(apiToken.rows)
            return new ResponseData(true, "", { token: (<any>apiToken.rows)[0].apiToken })
        } catch (error: any) {


            throw new Error(error)
        }
    }


    public static async validateName(companyId: string, data: any) {

        const client = await DB.excu.client();
        try {
            const id = data.id;
            const tableName = data.tableName;
            const name = data.name != null && data.name != "" ? data.name.trim() : null;
            const branchId = data.branchId;
            const menuId = data.menuId;

            let isNameExist;
            await client.query("BEGIN")
            if (id != null && id != "" && id != "0") {
                if (tableName == "product") {
                    isNameExist = await ProductRepo.checkIfProductNameExists(client, id, name, companyId)
                } else if (tableName == "menu") {
                    isNameExist = await MenuRepo.checkIfMenuNameExist(client, id, name, companyId)
                } else if (tableName == "menuSection") {
                    isNameExist = await MenuRepo.checkIfMenuSectionNameExist(client, id, name, menuId)
                } else if (tableName == "department") {
                    isNameExist = await DepartmentRepo.checkDepartmentNameExist(client, id, name, companyId)
                } else if (tableName == "category") {
                    isNameExist = await CategoryRepo.checkCategoryNameExist(client, id, name, companyId)
                } else if (tableName == "optionGroup") {
                    isNameExist = await OptionRepo.checkIfOptionGroupTitleExist(client, id, name, companyId)
                } else if (tableName == "option") {
                    isNameExist = await OptionRepo.checkIfOptionNameExist(client, id, name, companyId)
                } else if (tableName == "account") {
                    isNameExist = await AccountsRepo.isAccountNameExist(client, companyId, name, id)
                } else if (tableName == "recipe") {
                    isNameExist = await RecipeRepo.checkIfRecipeNameExists(client, id, name, companyId)
                } else if (tableName == "employee") {
                    isNameExist = await EmployeeRepo.checkEmployEmailExist(client, id, name)
                } else if (tableName == "matrix") {
                    isNameExist = await MatrixRepo.checkIfMatrixNameExists(client, id, name, companyId)
                } else if (tableName == "dimension") {
                    isNameExist = await ProductDimensionRepo.checkIfDimensionNameExists(client, id, name, companyId)
                } else if (tableName == "attribute") {
                    isNameExist = await ProductDimensionRepo.checkIfAttributeNameExists(client, id, name, data.code, data.dimensionId)
                } else if (tableName == "priceManage") {
                    isNameExist = await priceManagmentRepo.checkIfPriceManagementTitleExist(client, id, name, companyId)
                } else if (tableName == "priceLable") {
                    isNameExist = await priceManagmentRepo.checkIfPriceLableNameExist(client, id, name, companyId)
                }
                else if (tableName == "privilege") {
                    isNameExist = await EmployeePrivilegeRepo.checkIfPrivilegeNameExist(client, id, name, companyId)
                } else if (tableName == "passCode") {
                    isNameExist = await EmployeeRepo.checkIfEmployeePassCodeExist(client, id, name, companyId)
                } else if (tableName == "kitchenSection") {
                    isNameExist = await KitchenSectionRepo.checkIfNameExist(client, id, name, companyId)
                } else if (tableName == "paymentMethod") {
                    isNameExist = await PaymnetMethodRepo.checkIfmethodNameExist(client, id, name, companyId)
                }
                else if (tableName == "table") {
                    isNameExist = await TablesRepo.checkIfTableNameExist(client, id, name, branchId)
                }
                else if (tableName == "tableGroup") {
                    isNameExist = await TablesRepo.checkIfGroupNameExist(client, id, name, branchId)
                } else if (tableName == "customer") {
                    if (name != null && name != "") {
                        isNameExist = await CustomerRepo.checkIfCustomerPhoneExist(client, id, name, companyId);

                    }
                } else if (tableName == "inventoryLocations") {

                    isNameExist = await ProductRepo.checkIfInventoryLocaionNameExist(client, id, name, branchId);


                } else if (tableName == "Brands") {

                    isNameExist = await ProductRepo.checkIfBrandNameExist(id, name, companyId)
                } else if (tableName == "Budget") {

                    isNameExist = await BudgetRepo.checkBudgetNameExist(client, id, name, companyId)
                } else if (tableName == "supplier") {
                    if (name != null && name != "") {
                        isNameExist = await SupplierRepo.checkIfSupplierPhoneExist(client, id, [name], companyId);

                    }
                } else if (tableName == "discount") {

                    isNameExist = await DiscountRepo.checkDiscountNameExist(client, id, name, companyId);


                } else if (tableName == "priceLabel") {

                    isNameExist = await priceManagmentRepo.checkIfPriceLableNameExist(client, id, name, companyId);

                } else if (tableName == "surcharge") {

                    isNameExist = await SurchargeRepo.checkIfSurchargeNameExists(client, id, name, companyId);

                } else if (tableName == "supplierEmail") {

                    isNameExist = await SupplierRepo.checkIfSupplierEmailExist(client, id, [name], companyId);

                }
                else if (tableName == "PageSlug") {

                    isNameExist = await WebSiteBuilderRepo.checkSlug(client, id, name, companyId);

                }
            } else {

                if (tableName == "product") {
                    isNameExist = await ProductRepo.checkIfProductNameExists(client, null, name, companyId)
                } else if (tableName == "Brands") {

                    isNameExist = await ProductRepo.checkIfBrandNameExist(null, name, companyId)
                } else if (tableName == "menu") {
                    isNameExist = await MenuRepo.checkIfMenuNameExist(client, null, name, companyId)
                } else if (tableName == "menuSection") {
                    isNameExist = await MenuRepo.checkIfMenuSectionNameExist(client, null, name, menuId)
                } else if (tableName == "department") {
                    isNameExist = await DepartmentRepo.checkDepartmentNameExist(client, null, name, companyId)
                } else if (tableName == "category") {
                    isNameExist = await CategoryRepo.checkCategoryNameExist(client, null, name, companyId)
                } else if (tableName == "optionGroup") {
                    isNameExist = await OptionRepo.checkIfOptionGroupTitleExist(client, null, name, companyId)
                } else if (tableName == "option") {
                    isNameExist = await OptionRepo.checkIfOptionNameExist(client, null, name, companyId)
                } else if (tableName == "account") {
                    isNameExist = await AccountsRepo.isAccountNameExist(client, companyId, name, null)
                } else if (tableName == "recipe") {
                    isNameExist = await RecipeRepo.checkIfRecipeNameExists(client, null, name, companyId)
                } else if (tableName == "employee") {
                    isNameExist = await EmployeeRepo.checkEmployEmailExist(client, null, name)
                } else if (tableName == "matrix") {
                    isNameExist = await MatrixRepo.checkIfMatrixNameExists(client, null, name, companyId)
                } else if (tableName == "priceManage") {
                    isNameExist = await priceManagmentRepo.checkIfPriceManagementTitleExist(client, null, name, companyId)
                } else if (tableName == "priceLable") {
                    isNameExist = await priceManagmentRepo.checkIfPriceLableNameExist(client, null, name, companyId)
                } else if (tableName == "privilege") {
                    isNameExist = await EmployeePrivilegeRepo.checkIfPrivilegeNameExist(client, null, name, companyId)
                } else if (tableName == "passCode") {
                    isNameExist = await EmployeeRepo.checkIfEmployeePassCodeExist(client, null, name, companyId)
                } else if (tableName == "kitchenSection") {
                    isNameExist = await KitchenSectionRepo.checkIfNameExist(client, null, name, companyId)
                } else if (tableName == "paymentMethod") {
                    isNameExist = await PaymnetMethodRepo.checkIfmethodNameExist(client, null, name, companyId)
                } else if (tableName == "table") {
                    isNameExist = await TablesRepo.checkIfTableNameExist(client, null, name, branchId)
                }
                else if (tableName == "tableGroup") {
                    isNameExist = await TablesRepo.checkIfGroupNameExist(client, null, name, branchId)
                } else if (tableName == "customer") {
                    isNameExist = await CustomerRepo.checkIfCustomerPhoneExist(client, null, name, companyId);
                } else if (tableName == "inventoryLocations") {

                    isNameExist = await ProductRepo.checkIfInventoryLocaionNameExist(client, null, name, branchId);


                } else if (tableName == "Budget") {

                    isNameExist = await BudgetRepo.checkBudgetNameExist(client, null, name, companyId)
                } else if (tableName == "supplier") {
                    if (name != null && name != "") {
                        isNameExist = await SupplierRepo.checkIfSupplierPhoneExist(client, null, [name], companyId);

                    }
                } else if (tableName == "discount") {

                    isNameExist = await DiscountRepo.checkDiscountNameExist(client, null, name, companyId);


                } else if (tableName == "priceLabel") {

                    isNameExist = await priceManagmentRepo.checkIfPriceLableNameExist(client, null, name, companyId);

                } else if (tableName == "surcharge") {

                    isNameExist = await SurchargeRepo.checkIfSurchargeNameExists(client, null, name, companyId);

                } else if (tableName == "supplierEmail") {

                    isNameExist = await SupplierRepo.checkIfSupplierEmailExist(client, null, [name], companyId);

                } else if (tableName == "PageSlug") {

                    isNameExist = await WebSiteBuilderRepo.checkSlug(client, null, name, companyId);

                } else if (tableName == "dimension") {
                    isNameExist = await ProductDimensionRepo.checkIfDimensionNameExists(client, null, name, companyId)
                } else if (tableName == "attribute") {
                    isNameExist = await ProductDimensionRepo.checkIfAttributeNameExists(client, null, name, data.code, data.dimensionId)
                }
            }

            await client.query("COMMIT")

            if (isNameExist) {

                return new ResponseData(false, tableName + " Already Used", [])
            } else {
                return new ResponseData(true, "", [])
            }
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK")
            throw new Error(error);
        } finally {

            client.release()
        }
    }




    public static async getCompanyCountry(client: PoolClient, branchId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT country from "Companies" inner join "Branches" on "Branches"."companyId" ="Companies".id where "Branches".id =$1 `,
                values: [branchId]
            }
            const company = await client.query(query.text, query.values);
            return { country: (<any>company.rows[0]).country }
        } catch (error: any) {


            throw new Error(error.message)
        }
    }
    public static async getCompanyGroupId(companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "companyGroupId" from "Companies" where id =$1`,
                values: [companyId]
            }

            const companyGroup = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", { id: (<any>companyGroup.rows[0]).companyGroupId })
        } catch (error: any) {


            throw new Error(error)
        }
    }
    public static async getEcommerceCompanySettings(companyId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT "Companies".id,
                              "Companies".name,
                               country,
                               "isInclusiveTax",
                               url->> 'defaultUrl' as "defaultUrl",
                               translation ,
                             (  "options"->> 'noSaleWhenZero') ::boolean as "noSaleWhenZero",
                               "invoiceOptions"->>'isInvoiceOptionGroupVisible' as "isInvoiceOptionGroupVisible", 
                             "pickUpMaxDistance",
                             ("feedbackSettings"->>'googleFeedbackSettings')::jsonb as "googleFeedbackSettings"
                        from "Companies"  
                        left join "Media" on "mediaId" = "Media".id
                        where "Companies".id= $1`,
                values: [companyId]
            }

            let companyData = await DB.excu.query(query.text, query.values);
            let company: any = companyData.rows[0]
            if (!company) {
                throw new ValidationException("Company Not Found")
            }

            const storage = new FileStorage();
            let settings = await storage.getCompanySettings(company.country)


            let settingData: any = {
                countryCode: "",
                afterDecimal: 0,
                addressFormat: {},
                currencySymbol: ""
            };

            settingData.countryCode = settings?.settings.contryCode;
            settingData.afterDecimal = settings?.settings.afterDecimal;
            settingData.addressFormat = settings?.settings.addressFormat;
            settingData.currencySymbol = settings?.settings.currencySymbol;
            company.settings = settingData

            let oldThemeSettings = (await WebSiteBuilderRepo.getWebSiteThemeSettings(company.id)).data;
            let menuSettings = (await ThemeRepo.getWebsiteMenu(company.id)).data;
            let newThemeSettings = (await WebSiteBuilderRepo.getThemesByType({ type: 'ThemeSettings' }, company)).data.list[0];

            let mobileIconBar = (await WebSiteBuilderRepo.getThemesByType({ type: 'MobileIconBar' }, company)).data.list[0];
            delete company["id"]
            let resData = {
                company: company,
                oldThemeSettings: oldThemeSettings,
                menuSettings: menuSettings,
                themeSettings: newThemeSettings,
                mobileIconBar: mobileIconBar
            }
            return new ResponseData(true, "", resData)
        } catch (error: any) {

            console.log(error)
            throw new Error(error)
        }
    }


    // public static async importFromCsvFile(company: Company, employeeId: string) {
    //     const client = await DB.excu.client();
    //     try {
    //         await client.query("BEGIN")
    //         let srtoage = new FileStorage();
    //         let data = await srtoage.getCsvFile();
    //         let products: any[] = [];
    //         let branches = await BranchesRepo.getBranchList(company.id);

    //         let branchList: any[] = []


    //         branches.data.forEach((element: any) => {
    //             let branch = new BranchProducts();
    //             branch.branchId = element.id;
    //             let branchdata = { branchId: element.id }
    //             branch.companyId = company.id;
    //             branchList.push(branchdata)
    //         });

    //         data.forEach(async (element) => {
    //             element.companyId = company.id;

    //             await this.addMenuSectionProducts(element,company.id)
    //         });


    //         // data.forEach(element => {
    //         //     for(let key in element)
    //         //     {

    //         //         if (element[key]==='NULL')
    //         //         {
    //         //             element[key]= null
    //         //         }

    //         //         if(key == 'serviceTime'){
    //         //             element[key]= Number(   element[key])
    //         //         }

    //         //         if(key == 'tags'){
    //         //             element[key]=[]
    //         //         }

    //         //         if(key == 'optionGroups'){
    //         //             element[key]= JSON.parse(element[key]);

    //         //         }

    //         //         if(key == 'quickOptions'){
    //         //             let options:any[]= [];
    //         //             let quickOptions = JSON.parse(element[key]);
    //         //             if(quickOptions)
    //         //             quickOptions.forEach((element:any) => {
    //         //                 let data ={
    //         //                     id:element
    //         //                 }
    //         //                 options.push(data)
    //         //             });
    //         //             element[key]=options
    //         //         }

    //         //         if(key == 'commissionPercentage'){
    //         //             element[key]= element[key] ==='True' ? true : false
    //         //         }

    //         //         if(key == 'commissionAmount'){
    //         //             element[key]=  Number(   element[key])
    //         //         }


    //         //         if(key == 'recipes'){
    //         //             element[key]=JSON.parse(element[key]) 
    //         //         }


    //         //         if(key == 'productMedia'){
    //         //             element[key]=element[key] ? JSON.parse(element[key]) :[]
    //         //         }

    //         //         if(key == 'defaultPrice'){
    //         //             element[key]=  Number( element[key])
    //         //         }

    //         //         if(key == 'childQty'){
    //         //             element[key]=  Number( element[key])
    //         //         }

    //         //         if(key == 'orderByWeight'){
    //         //             element[key]=  element[key] ==='True' ? true : false
    //         //         }
    //         //         if(key == 'unitCost'){
    //         //             element[key]=    Number( element[key])
    //         //         }

    //         //         if(key == 'defaultImage'){
    //         //             element[key]=  ""
    //         //         }
    //         //     }
    //         //     if(element!=null){
    //         //         products.push(element)

    //         //     }
    //         // });
    //         // for (let index = 0; index < data.length; index++) {
    //         //     const element = data[index];
    //         //     console.log(element)
    //         //     element.companyId = company.id
    //         //     element.branchProduct = branchList
    //         //     if(element!=null){
    //         //         await ProductController.addNew(client,element,company,employeeId)

    //         //     }
    //         // }


    //         await client.query("COMMIT")

    //     } catch (error: any) {
    //         await client.query("ROLLBACK")
    //         console.log(error)
    //         throw new Error(error)
    //     } finally {
    //         client.release()
    //     }

    // }

    // public static async addMedia(media: any) {
    //     try {

    //         const query : { text: string, values: any } = {
    //             text: `INSERT INTO "Media" (id,"companyId",name,size,url,"createdAt","mediaSize","mediaType") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    //             values: [media.id, media.companyId, media.name, media.size, media.url, media.createdAt, media.mediaSize, media.mediaType]
    //         }

    //         await DB.excu.query(query.text, query.values)
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }

    // public static async addDep(media: any) {
    //     try {

    //         const query : { text: string, values: any } = {
    //             text: `INSERT INTO "Departments" (id,"companyId",name,"createdAt") VALUES ($1,$2,$3,$4)`,
    //             values: [media.id, media.companyId, media.name, media.createdAt]
    //         }

    //         await DB.excu.query(query.text, query.values)
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }


    // public static async addCat(media: any) {
    //     try {

    //         const query : { text: string, values: any } = {
    //             text: `INSERT INTO "Categories" (id,"companyId","departmentId",name,"createdAt") VALUES ($1,$2,$3,$4,$5)`,
    //             values: [media.id, media.companyId, media.departmentId, media.name, media.createdAt]
    //         }

    //         await DB.excu.query(query.text, query.values)
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }


    // public static async addTaxes(media: any) {
    //     try {

    //         const query : { text: string, values: any } = {
    //             text: `INSERT INTO "Taxes" (id,"companyId","taxPercentage",name,"createdAt","default") VALUES ($1,$2,$3,$4,$5,$6)`,
    //             values: [media.id, media.companyId, Number(media.taxPercentage), media.name, media.createdAt, media.default]
    //         }

    //         await DB.excu.query(query.text, query.values)
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }

    // public static async addOptions(media: any) {
    //     try {

    //         const query : { text: string, values: any } = {
    //             text: `INSERT INTO "Options" (id,"companyId","price",name,"createdAt","isMultiple","isVisible","displayName") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    //             values: [media.id, media.companyId, Number(media.price), media.name, media.createdAt, media.isMultiple, media.isVisible, media.displayName]
    //         }

    //         await DB.excu.query(query.text, query.values)
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }

    // public static async addOptiongroup(media: any) {
    //     try {

    //         const query : { text: string, values: any } = {
    //             text: `INSERT INTO "OptionGroups" (id,"companyId","minSelectable",title,"createdAt","maxSelectable","translation","options") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    //             values: [media.id, media.companyId, Number(media.minSelectable), media.title, media.createdAt, media.maxSelectable, media.translation, JSON.stringify(media.options)]
    //         }

    //         await DB.excu.query(query.text, query.values)
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }

    // public static async addMenu(media: any) {
    //     try {

    //         const query : { text: string, values: any } = {
    //             text: `INSERT INTO "Menu" (id,"companyId","name","createdAt","startAt","endAt",index,"branchIds") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    //             values: [media.id, media.companyId, media.name, media.createdAt, media.startAt, media.endAt, media.index, JSON.stringify(media.branchIds)]
    //         }

    //         await DB.excu.query(query.text, query.values)
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }

    // public static async addMenuSection(media: any) {
    //     try {

    //         const query : { text: string, values: any } = {
    //             text: `INSERT INTO "MenuSection" (id,"color","name","index","menuId","properties") VALUES ($1,$2,$3,$4,$5,$6)`,
    //             values: [media.id, media.color, media.name, media.index, media.menuId, media.properties]
    //         }

    //         await DB.excu.query(query.text, query.values)
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }

    // public static async addMenuSectionProducts(media: any,companyId:string) {
    //     try {

    //         media.productId = await this.getProductId(media.productName,companyId)
    //         const query : { text: string, values: any } = {
    //             text: `INSERT INTO "MenuSectionProduct" (id,"index","doubleWidth","doubleHeight","productId","menuSectionId","color","page") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    //             values: [media.id, media.index, media.doubleWidth, media.doubleHeight, media.productId,  media.menuSectionId,media.color, media.page]
    //         }

    //         await DB.excu.query(query.text, query.values)
    //     } catch (error: any) {
    //         throw new Error(error)
    //     }
    // }

    // public static async getProductId(name:string,companyid:string){
    //     try {

    //         console.log(name,companyid)
    //         let query={
    //             text :`SELECT id from "Products" where name =$1 and "companyId"=$2`,
    //             values:[name,companyid]
    //         }
    //         let  product = await DB.excu.query(query.text,query.values);

    //         return (<any>product.rows[0]).id
    //     } catch (error:any) {
    //         throw new Error(error)
    //     }
    // }


    public static async setProductOptions(data: any, company: Company) {
        try {
            let option = new ProductOption();
            option.ParseJson(data)

            const query: { text: string, values: any } = {
                text: `UPDATE "Companies" SET "productOptions"=$1 where id=$2 `,
                values: [JSON.stringify(option), company.id]
            }

            await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async setJofotaraConfig(data: any, company: Company) {
        try {
            let option = new jofotara();
            option.ParseJson(data)

            const query: { text: string, values: any } = {
                text: `UPDATE "Companies" SET "jofotara"=$1, "jofotara_startdate" = NOW() where id=$2 `,
                values: [JSON.stringify(option), company.id]
            }

            await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }








    public static async getProductOptions(company: Company) {
        try {


            const query: { text: string, values: any } = {
                text: `select "productOptions" from "Companies" where id=$1 `,
                values: [company.id]
            }

            let data = await DB.excu.query(query.text, query.values);

            let option = new ProductOption();
            option.ParseJson((<any>data.rows[0]).productOptions)
            return new ResponseData(true, "", option)
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async setBranchOptions(data: any, company: Company) {
        try {
            let option = new BranchOption();
            option.ParseJson(data)

            const query: { text: string, values: any } = {
                text: `UPDATE "Companies" SET "branchOptions"=$1 where id=$2 `,
                values: [JSON.stringify(option), company.id]
            }

            await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getBranchOptions(company: Company) {
        try {


            const query: { text: string, values: any } = {
                text: `select "branchOptions" from "Companies" where id=$1 `,
                values: [company.id]
            }

            let data = await DB.excu.query(query.text, query.values);

            let option = new BranchOption();
            option.ParseJson((<any>data.rows[0]).branchOptions)
            return new ResponseData(true, "", option)
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getShippingSetting(company: Company) {
        try {
            const query: { text: string, values: any } = {
                text: `select "shippingsetting" from "Companies" where id=$1 `,
                values: [company.id]
            }
            let result = await DB.excu.query(query.text, query.values);


            let shipping: Shipping[] = [];
            let data = (<any>result.rows[0]).shippingsetting as Shipping[];
            console.log(data);
            if (data == null) {
                return new ResponseData(true, "", [])

            }
            data.forEach((element: any) => {
                let zone = new Shipping();
                zone.ParseJson(element);
                shipping.push(zone);
            });

            return new ResponseData(true, "", data)
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }



    public static async getEcommorceShippingCountries(company: Company) {
        try {
            const query: { text: string, values: any } = {
                text: `select "shippingsetting" from "Companies" where id=$1 `,
                values: [company.id]
            }
            let result = await DB.excu.query(query.text, query.values);


            let shipping: Shipping[] = [];
            let data = (<any>result.rows[0]).shippingsetting as any;

            const allCountries = data.flatMap((zone: { Countries: any; }) => zone.Countries);
            let sturcture = {
                "CountriesPrices": [
                ] as any[],
                "status": true
            };

            allCountries.forEach((element: any) => {
                sturcture.CountriesPrices.push({ "CountryCode": element });

            });



            return new ResponseData(true, "", sturcture)

            return new ResponseData(true, "", data)
        } catch (error: any) {
            console.log(error);
            throw new Error(error)
        }
    }



    public static async setShippingSetting(data: any, company: Company) {
        try {
            let shipping: Shipping[] = [];
            data.forEach((element: any) => {
                let zone = new Shipping();
                zone.ParseJson(element);
                shipping.push(zone);
            });
            console.log(data);
            console.log(shipping);

            const query: { text: string, values: any } = {
                text: `UPDATE "Companies" SET "shippingsetting"=$1 where id=$2 `,
                values: [JSON.stringify(shipping), company.id]
            }

            await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getCoveredAddresses(company: Company) {
        try {
            const query: { text: string, values: any } = {
                text: `with "branchAddresses" as (
                    select 
                    "coveredAddresses"->>'type' as type,
                    jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'address'as "addresses",
                    jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'minimumOrder'as "minimumOrder",
                    jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'deliveryCharge'as "deliveryCharge",
                    jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'freeDeliveryOver'as "freeDeliveryOver",
                    jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'translation'as "translation",
                    jsonb_array_elements(("coveredAddresses"->>'coveredAddresses')::jsonb)->>'note'as "note",
                    "Branches".id as "branchId"
                    from "Branches"
                    where "companyId"=$1
                    order by "Branches".index asc
                    )
                    select 
                    "branchAddresses".type,
                    json_agg(jsonb_build_object('address',"branchAddresses"."addresses",'minimumOrder',"branchAddresses"."minimumOrder",'deliveryCharge',"branchAddresses"."deliveryCharge",'branchId',"branchAddresses"."branchId",'translation',"branchAddresses"."translation"::jsonb,'freeDeliveryOver',"freeDeliveryOver",'note',"note")) as "coveredAddresses"
                    from "branchAddresses"
                    group by "branchAddresses".type                     
                `,
                values: [company.id]
            }


            let address = await DB.excu.query(query.text, query.values);
            let companyAddresses = (<any>address.rows[0])
            const storage = new FileStorage();
            /** retrive the file of branch addresses */
            const deliveryAddresses = (await storage.getDeliveryAddresses(company.country)).addresses;


            return new ResponseData(true, "", { coveredAddresses: companyAddresses, countryAddresses: deliveryAddresses })
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async setCoveredAddresses(data: any, company: Company) {
        const client = await DB.excu.client()
        try {


            let brancheList = await BranchesRepo.getCompanyBranchIds(client, company.id);
            await client.query("BEGIN")

            const query: any = {
                text: `UPDATE "Branches" set "coveredAddresses"=$1 where id = $2`,
                values: []
            }
            const type = data.type;
            const coveredAddresses = data.coveredAddresses;
            let branches = new Set()
            const grouped = coveredAddresses.reduce((acc: any, obj: any) => {
                const key = obj.branchId;
                if (!acc[key]) {
                    acc[key] = [];
                }
                let objData = {
                    address: obj['address'],
                    deliveryCharge: obj['deliveryCharge'],
                    minimumOrder: obj['minimumOrder'],
                    freeDeliveryOver: obj['freeDeliveryOver'],
                    translation: obj['translation'],
                    note: obj['note'],
                }
                acc[key].push(objData);
                return acc;
            }, {});



            for (let index = 0; index < brancheList.length; index++) {
                let branchElement: any = brancheList[index]
                const element = grouped[branchElement] ?? []
                let branchAddresses = new BranchDeliveryAddress()
                if (element.length > 0) {
                    branchAddresses.type = type
                    branchAddresses.coveredAddresses = element
                }
                query.values = [branchAddresses, branchElement]
                await client.query(query.text, query.values)
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
    public static async setInvoiceTemplate(data: any, company: Company) {
        try {


            const query: { text: string, values: any } = {
                text: `UPDATE "Companies" SET "invoiceTemplate"=$1 where id=$2 `,
                values: [data, company.id]
            }

            await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getInvoiceTemplate(company: Company) {
        try {


            const query: { text: string, values: any } = {
                text: `select "invoiceTemplate" from "Companies" where id=$1 `,
                values: [company.id]
            }

            let data = await DB.excu.query(query.text, query.values);


            return new ResponseData(true, "", (<any>data.rows[0]).invoiceTemplate)
        } catch (error: any) {
            throw new Error(error)
        }
    }




    public static async setDomain(data: any, company: Company) {
        try {


            const query: { text: string, values: any } = {
                text: `UPDATE "Companies" SET "Domain"=$1 where id=$2 `,
                values: [data, company.id]
            }

            await DB.excu.query(query.text, query.values);


            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async clearDomain(company: Company) {
        try {
            const query: { text: string, values: any } = {
                text: `UPDATE "Companies" SET "Domain" = NULL where id=$1`,
                values: [company.id],
            }
            await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async updateDomainStatusToApproved(data: any, company: Company) {
        try {

            const query: { text: string, values: any } = {
                text: `UPDATE "Companies" SET "Domain" = jsonb_set("Domain", '{status}', '"Approved"') WHERE id = $1`,
                values: [company.id]
            }
            let resault = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getDomain(company: Company) {
        try {
            const query: { text: string, values: any } = {
                text: `select "Domain" from "Companies" where id=$1 `,
                values: [company.id]
            }

            let data = await DB.excu.query(query.text, query.values);


            return new ResponseData(true, "", data.rows[0])
        } catch (error: any) {
            throw new Error(error)
        }
    }




    public static async getSlugByDomain(domain: any) {
        try {


            const query: { text: string, values: any } = {
                text: ` SELECT  slug FROM "Companies" WHERE "Domain"->>'domain' = $1`,
                values: [domain]
            }

            let data = await DB.excu.query(query.text, query.values);
            console.log("data", data.rows.length)
            if (data.rows.length == 0) {
                return new ResponseData(false, "There is no registered Company on this domain", [])


            } else {
                return new ResponseData(true, "", data.rows[0])
            }


        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getCompanyWebsiteOptions(client: PoolClient | null, companyId: string) {
        try {
            const query = {
                text: `select "template"->>'hideOutOfStocks' as "hideOutOfStocks" ,("template"->>'enforceServiceSelection')::boolean AS "enforceServiceSelection", ("template"->>'serviceMenus')::jsonb AS "serviceMenus"  from "WebSiteBuilder"
                            where "companyId" = $1
                            and "type" = 'ThemeSettings'
                `,
                values: [companyId]
            }

            let company = client ? await client.query(query.text, query.values) : await DB.excu.query(query.text, query.values)
            if (company && company.rows && company.rows.length > 0) {
                let temp = company.rows[0]
                let data = {
                    hideOutOfStocks: temp.hideOutOfStocks ?? false,
                    enforceServiceSelection: temp.enforceServiceSelection ?? false,
                    serviceMenus: temp.serviceMenus ?? null
                }
                return new ResponseData(true, "", data)
            }
            return new ResponseData(true, "", null)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async validatePassword(employeeId: string, data: any) {
        try {

            let hashedPassword = await AuthRepo.hashPassword(data.password.toString())

            const query: { text: string, values: any } = {
                text: `select EXISTS (select 1 from "Employees"  where id = $1 and password=$2) `,
                values: [employeeId, hashedPassword]
            }
            const records = await DB.excu.query(query.text, query.values);


            if (records.rowCount != null && records.rowCount > 0 && (<any>records.rows[0]).exists == true) {
                return new ResponseData(true, "", {})
            }

            return new ResponseData(false, "Invalid Password", {});


        } catch (error: any) {

            console.log(error)
            throw new Error(error)
        }
    }
    public static async validateTransactionDate(client: PoolClient | null, date: Date, branchId: string, companyId: string) {
        try {
            const query = {
                text: `WITH "openingBalanceDate" as (
               select (case when  "Branches"."openingBalanceDate" is null then "Companies"."createdAt" - interval '1 day' else  "Branches"."openingBalanceDate" end) as "date"
	
	
              	from "Companies"
                   
	           inner join "Branches" on "Companies".id = "Branches"."companyId"
                where ( $1::uuid is  null  and "Companies".id = $2)
            	or ($1::uuid  is not  null and  "Branches".id = $1::uuid )
	             limit 1
                   ),
               "lastVatPayment" as (
               select "to" + interval '1 day' as "date" 
				      
				   from "VatPayments" where "companyId" =$2
               order by "from" desc limit 1
               ), "dates" as (
               select * from "openingBalanceDate"
               union 
               select * from     "lastVatPayment"
               )
			   
               select case when  max("date") > $3 then false else true end "isValidDate" ,   cast(max("date")::date as text) as "maxDate" from "dates"
               `,
                values: [branchId, companyId, date]
            }

            let validation
            if (client == null) {
                validation = await DB.excu.query(query.text, query.values);
            } else {
                validation = await client.query(query.text, query.values);
            }


            if (validation && validation.rows && validation.rows.length > 0) {
                console.log((<any>validation.rows[0]))
                if (!(<any>validation.rows[0]).isValidDate) {
                    throw new ValidationException(`Invalid Date: Please select a date that is later than  ${(<any>validation.rows[0]).maxDate}`)
                }
                return (<any>validation.rows[0]).isValidDate

            }
            return true
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async getTransactionDate(branchId: string, companyId: string) {
        try {
            const query = {
                text: `with "company" as (
                        select id from "Companies" where id = $1

                        ), "openingBalance" as(
                        select 
                                                case when "Branches"."openingBalanceDate" is null then "Companies"."createdAt" - interval '1 day' else  "Branches"."openingBalanceDate" + interval '1 day' end as "openingBalanceDate"
                                                from "Companies"
                                                inner join "Branches" on "Branches"."companyId" = "Companies".id
                                                where ($2::uuid is not null and  "Branches".id = $2)
                        ), "vatPayments" as (
                        select 
                                        "VatPayments"."to" as "vatPaymentDate"      
                                                from "VatPayments"
                                        
                                                where "VatPayments"."companyId"= $1
                            order by "to" DESC 
                            limit 1 
                            
                        )

                                                
                            select *  from "company"
                            left join  "openingBalance" on true 
                            left join "vatPayments" on true `,
                values: [companyId, branchId]
            }
            const branch = await DB.excu.query(query.text, query.values);
            const date = branch.rows && branch.rows.length > 0 ? (<any>branch.rows[0]) : null

            return new ResponseData(true, "", date);
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getTempToken(data: any) {
        try {
            const temporaryAccessToken = sign(data, process.env.TEMPORARY_ACCESS_TOKEN_SECRET as string, { expiresIn: process.env.TEMPORARY_ACCESS_TOKEN_MAXAGE });

            return { temporaryAccessToken: temporaryAccessToken }
        } catch (error) {


        }
    }

    public static async getEmployeeTOTP(employeeId: string, companyId?: string | null) {

        try {

            let query: { text: string, values: any } = {
                text: `SELECT "employeeTOTP"->>'base32' as "employeeTOTP"
            from "Employees" 
            where "Employees".id =$1 and "apply2fa" = true`,
                values: [employeeId]
            }


            let employee = (await DB.excu.query(query.text, query.values));
            return (<any>employee.rows[0])?.employeeTOTP ?? null

        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async updateCompanyUpdatedDate(client: PoolClient, companyId: string) {
        try {
            await client.query(`UPDATE "Companies"  set  "updatedDate"= $2 where "id"=$1`, [companyId, new Date()])
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getSlugSimilarty(slug: string) {
        try {

            const query = {
                text: `SELECT "slug", NAME   from "Companies"
                where similarity(lower("slug"), lower($1)) > 0.1 
           order by similarity(lower("slug"), lower($1)) DESC LIMIT 3`,
                values: [slug]
            }
            let list = await DB.excu.query(query.text, query.values)
            return new ResponseData(true, "", list.rows)
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getCompanyByBranchId(client: PoolClient | null, branchId: string) {
        try {
            const query = {
                text: `SELECT "Companies".id, "Companies" .country from "Branches"
                      inner join "Companies" on "Companies".id = "Branches"."companyId"
                      where "Branches".id = $1
                `,
                values: [branchId]
            }
            let selectedData;
            if (client) {
                selectedData = await client.query(query.text, query.values)
            } else {
                selectedData = await DB.excu.query(query.text, query.values)
            }

            let company = new Company();
            company.ParseJson(selectedData.rows[0])
            const storage = new FileStorage();
            let settings = await storage.getCompanySettings(company.country)
            if (settings) {
                company.afterDecimal = settings.settings.afterDecimal

            } else {
                company.afterDecimal = 3
            }
            return company
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async setpickUpMaxDistance(data: any, company: Company) {
        try {
            let pickUpMaxDistance = data.pickUpMaxDistance
            if (!pickUpMaxDistance) {
                throw new ValidationException("Distance Is Required")
            }
            const query = {
                text: `UPDATE "Companies" SET "pickUpMaxDistance"= $1 WHERE "id" =$2 `,
                values: [pickUpMaxDistance, company.id]
            }

            await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getpickUpMaxDistance(company: Company) {
        try {

            const query = {
                text: `select "pickUpMaxDistance" from "Companies" where id = $1 `,
                values: [company.id]
            }

            let distance = await DB.excu.query(query.text, query.values)
            let resData = {
                "pickUpMaxDistance": distance && distance.rows && distance.rows.length > 0 ? distance.rows[0].pickUpMaxDistance : null
            }
            return new ResponseData(true, "", resData)
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async inviteSuperAdmin(client: PoolClient, companyGroupId: string, companyId: string, branchIds: any, privilegeId: string) {
        try {
            branchIds = branchIds.map((id: any) => {
                return { id: id }
            })
            const query = {
                text: `
                      INSERT INTO "CompanyEmployees" ( "employeeId",
                                                         "companyId",
                                                         "type",
                                                         "user",
                                                         "superAdmin",
                                                         "inventionStartAt",
                                                         "inventionEndAt",
                                                         "admin",
                                                         "branches",
                                                         "privilegeId",
                                                         "mediaId",
                                                         "createdAt"
                                                        )  SELECT 
                                                               "id",
                                                                $2::uuid,
                                                                'Cloud User',
                                                                true,
                                                                true,
                                                                $3::timestamp,
                                                                null,
                                                                true,
                                                                $4::jsonb,
                                                                $5::uuid,
                                                                "mediaId",
                                                                  $6::timestamp
                                                        FROM "Employees" where "companyGroupId"= $1 and "superAdmin"= true returning id 
                `,
                values: [companyGroupId, companyId, new Date(), JSON.stringify(branchIds), privilegeId, new Date()]
            }

            let insertedData = await client.query(query.text, query.values)
            if (insertedData.rows && insertedData.rows.length == 0) {
                throw new ValidationException("Employee Is Required ")
            }

            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async clearCompany() {
        try {

            `  
              with "refunds" as(
                select "CreditNoteRefundLines".id, "CreditNoteRefunds".id as "refundId" from "CreditNoteRefundLines"
                inner join "CreditNoteRefunds" on "CreditNoteRefunds".id = "CreditNoteRefundLines"."creditNoteRefundId"
                inner join "CreditNotes" on "CreditNotes".id =  "CreditNoteRefunds"."creditNoteId"
                inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
                where"Branches"."companyId" = 'efb2d46e-7fec-4bc9-8794-fdb74cda5ce1'
                ),"delete Lines" as (
                delete  from "CreditNoteRefundLines" where id = any(select id from "refunds")  RETURNING id
                ),"delete transactions" as (
                delete  from "CreditNoteRefunds" where id = any(select "refundId" from "refunds")  RETURNING id
                )
                select * from "delete Lines"
                union all 
                select * from "delete transactions"
                
                
                with "ids" as (
                    select "CreditNoteLineOptions".id as "optionId", "CreditNoteLines".id as "lineId" , "CreditNotes".id as "creditNoteId" from "CreditNoteLines"
                    LEFT JOIN "CreditNoteLineOptions" on "CreditNoteLines".id = "CreditNoteLineOptions"."creditNoteLineId"
                    inner join "CreditNotes" on "CreditNotes".id =  "CreditNoteLines"."creditNoteId"
                    inner join "Branches" on "Branches".id = "CreditNotes"."branchId"
                    where"Branches"."companyId" = 'efb2d46e-7fec-4bc9-8794-fdb74cda5ce1'
                ),"delete options" as (
                    delete from "CreditNoteLineOptions" where id = any(select DISTINCT "optionId" from "ids" where id is not null) returning id
                ),"delete lines" as (
                delete from "CreditNoteLines" where id = any(select DISTINCT "lineId" from "ids" where id is not null) returning id
                ),"delete tran" as (

                delete from "CreditNotes" where id = any(select DISTINCT "creditNoteId" from "ids" where id is not null) returning id
                )

                select * from "delete options" 
                union all 
                select * from "delete lines" 
                union all 
                select * from "delete tran" 


                with "ids" as (
                    select "InvoicePaymentLines".id as "lineId", "InvoicePayments".id  as "paymentId" from "InvoicePaymentLines"
                    inner join "InvoicePayments" ON "InvoicePayments".id = "InvoicePaymentLines"."invoicePaymentId"
                    inner join "Branches" ON "Branches".id = "InvoicePayments"."branchId"
                        where"Branches"."companyId" = 'efb2d46e-7fec-4bc9-8794-fdb74cda5ce1'
                    ),"lines" as(
                    delete from "InvoicePaymentLines" where id = any(select distinct "lineId" from "ids") returning id 
                    ),"trans" as(
                    delete from "InvoicePayments" where id = any(select distinct "paymentId" from "ids") returning id 
                    )
                    select * from "lines"
                    union all 
                    select * from "trans"
                `


        } catch (error: any) {

        }
    }

    public static async getPerfixSettings(companyId: string) {
        try {
            let setting = await DB.excu.query(`SELECT "prefixSettings" from "Companies" where id = $1`, [companyId]);
            let prefixSettings = setting.rows && setting.rows.length ? setting.rows[0].prefixSettings : null

            return new ResponseData(true, "", { prefixSettings: prefixSettings })
        } catch (error: any) {
            throw new Error(error)
        }
    }

    public static async setPerfixSettings(data: any, companyId: string) {

        try {
            let settings = data.prefixSettings;
            if (!settings) throw new ValidationException("Settings Are Required ")
            const allowedKeys = ["Invoice", "Bill", "Estimate", "CreditNote", "Expense", "SupplierCredit", "BillOfEntry", "PurchaseOrder", "InventoryTransfer"];
            const keysToCheck = ["Invoice", "CreditNote", "Estimate"];

            keysToCheck.forEach((key) => {
                const value = settings[key].prefix;
                if (key == 'Invoice' || key == 'CreditNote' || key == 'Estimate') {
                    if (typeof value === "string" && value !== "") {
                        // Regex: starts with T + number + dash
                        if (/^T\d+-/i.test(value)) {
                            throw new ValidationException(`Invalid value for ${key}: ${value}`);
                        }
                    }
                }

                if (key == 'Invoice' && value.toLowerCase() == ('RINV-').toLowerCase())
                    throw new ValidationException(`Invalid value for ${key}: ${value}`);

                if (key == 'Bill' && value.toLowerCase() == ('BB-').toLowerCase())
                    throw new ValidationException(`Invalid value for ${key}: ${value}`);

                if (key == 'Expense' && value.toLowerCase() == ('EE-').toLowerCase())
                    throw new ValidationException(`Invalid value for ${key}: ${value}`);

            });
            const invalidKeys = Object.keys(settings).filter((key) => !allowedKeys.includes(key));
            if (invalidKeys.length > 0) {
                throw new ValidationException(`Invalid key(s): ${invalidKeys.join(", ")}`);
            }


            const cleaned = Object.fromEntries(
                Object.entries(settings).filter(([_, value]) => value != null && value !== "")
            );

            await DB.excu.query(`update "Companies" set  "prefixSettings" = $1  where id = $2`, [cleaned, companyId]);

            return new ResponseData(true, "", [])
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getFileByName(fileName: string) {
        try {
            const fileStorage = new FileStorage()
            let file: any;
            switch (fileName) {
                case "apple-developer-merchantid-domain-association.txt":
                    file = await fileStorage.getApplePayTextFile();
                    break;

                default:
                    break;
            }

            return file;
        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async isFeatureEnabled(featureName: string, companyId: string,client: PoolClient | null = null) {
        try {
            let features;
            let cachedFeatures = await RedisCaching.getCatchingData(`company_${companyId}_features`);

            if (cachedFeatures && cachedFeatures.success && cachedFeatures.data) {
                try {
                    features = JSON.parse(cachedFeatures.data);
                } catch {
                    features = null;
                }
            }
            if (!features) {
                const query = {
                    text: `SELECT "features"::jsonb from "Companies" where id = $1`,
                    values: [companyId]
                }
                let feature =  client ? await client.query(query.text, query.values) : await DB.excu.query(query.text, query.values);
                features = feature.rows && feature.rows.length > 0 ? feature.rows[0].features : null
                if (features) {
                    await RedisCaching.setCatchData(`company_${companyId}_features`, features, 1800);
                }
            }
            const normalizedFeatureName = featureName.toLowerCase();

            const hasFeature = features.some(
                (f: string) => f?.toLowerCase() === normalizedFeatureName
            );
            return hasFeature
        } catch (error: any) {
            throw new Error(error)
        }
    }



    public static async setFeature(data: any) {
        try {
            const { companyId, features } = data;
            if (!companyId || !features) {
                throw new ValidationException("Company ID and features are required");
            }

            await DB.excu.query(`update "Companies" set  "features" = $1  where id = $2`, [JSON.stringify(features), companyId]);
            await RedisCaching.deleteCatchedData(`company_${companyId}_features`);
            return new ResponseData(true, "", [])
        } catch (error) {
            throw error
        }
    }
}