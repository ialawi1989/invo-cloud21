import { PoolClient } from 'pg';
import { Socket } from 'socket.io';
import { Helper } from '@src/utilts/helper';
import { AuthRepo } from '@src/repo/app/auth.repo';
import { CompanyRepo } from '../admin/company.repo';
import { DB } from '@src/dbconnection/dbconnection';
import { Invoice } from '@src/models/account/Invoice';
import { FileStorage } from '@src/utilts/fileStorage';
import { BranchesRepo } from '../admin/branches.repo';
import { ResponseData } from '@src/models/ResponseData';
import { DriverSocketRepo } from '../socket/delivery/driver.socket';
import { ValidationException } from '@src/utilts/Exception';
import { EmployeeRepo } from '@src/repo/admin/employee.repo';
import { InvoiceLine } from '@src/models/account/InvoiceLine';
import { EmployeeShift } from '@src/models/admin/employeeShift';
import { AuthValidation } from '@src/validationSchema/auth.Schema';

import { Company } from '@src/models/admin/company';
import { Employee } from '@src/models/admin/employee';
import { promises } from 'dns';
import { any } from 'bluebird';



export class DriverRepo {
      public static async loginTest2(data: any): Promise<ResponseData> {
        const email = data.email.trim().toLowerCase();
        let failCount = 0;

        try {
            // 1. Check if account is locked
            const [isLocked, failedAttemptStr] = await Promise.all([
                AuthRepo.getLocked(email),
                AuthRepo.getRedisLoginAttempt(email)
            ]);

            if (isLocked) {
                await AuthRepo.deleteAttempts(email);
                return new ResponseData(
                    false,
                    "Your account is temporarily locked due to multiple failed login attempts.",
                    []
                );
            }

            // 2. Count failed attempts
            failCount = failedAttemptStr ? Number(failedAttemptStr) + 1 : 1;
            if (failCount > 2) {
                await AuthRepo.setLocked(email, 30); // Lock for 30 minutes
                return new ResponseData(
                    false,
                    "Your account is temporarily locked due to multiple failed login attempts.",
                    []
                );
            }

            // 3. Validate input
            const validate = await AuthValidation.validateAuth(data);
            if (!validate.valid) throw new ValidationException(validate.error);

            const hashedPassword = await AuthRepo.hashPassword(data.password);

            // 4. Query employee
            const query = {
                text: `
                with t1 as (
                SELECT 
                    "Employees".name,"Employees".id,
                    "CompanyEmployees"."companyId",
                    "Companies".name as "companyName",
                    "Companies".country,
                    "Media".id as "mediaId",
                    "Media".url ::jsonb as "mediaUrl" 
                FROM "Employees" 
                INNER JOIN "CompanyEmployees" ON "CompanyEmployees"."employeeId" = "Employees".id 
                LEFT JOIN "Companies" on "Companies".id = "CompanyEmployees"."companyId"
                LEFT join "Media" on "Media".id = "Employees"."mediaId"
                WHERE LOWER(email)=LOWER($1) AND password=$2 AND "CompanyEmployees"."isDriver" = true

                UNION 

                SELECT 
                    "Employees".name,"Employees".id,
                    "Employees"."companyId",
                    "Companies".name as "companyName",
                    "Companies".country,
                    "Media".id as "mediaId",
                    "Media".url ::jsonb as "mediaUrl" 
                FROM "Employees" 
                LEFT JOIN "Companies" on "Companies".id = "Employees"."companyId"
                LEFT join "Media" on "Media".id = "Employees"."mediaId"
                WHERE LOWER(email)=LOWER($1) AND password=$2 AND "Employees"."isDriver" = true
                )

                select id, name , "mediaId", "mediaUrl"
                , jsonb_agg(jsonb_build_object('country',"country",'companyId',"companyId", 'companyName', "companyName") ) as "companies"
                from t1
                group by id, name, "mediaId", "mediaUrl"
            `,
                values: [email, hashedPassword],
            };

            const result = await DB.exec.query(query.text, query.values);

            if (result.rows.length === 0) {
                await AuthRepo.setRedisLoginAttempt(email, failCount);
                return new ResponseData(false, "Wrong email or password", []);
            }



            const employee = result.rows[0];
            const {  id: employeeId, companies } = employee;

            // 5. Fetch company settings
            if (companies && Array.isArray(companies)) {
                const fileStorage = new FileStorage();
                const enrichedCompanies = await Promise.all(
                    companies.map(async (company: any) => {
                        const settings = (await fileStorage.getCompanySettings(company.country))?.settings;

                        return {
                            ...company,
                            afterDecimal: settings?.afterDecimal ?? 2,
                            timeOffset: settings?.timeOffset ?? 0,
                            currencySymbol: settings?.currencySymbol ?? 'BHD',
                        };
                    })
                );

                employee.companies = enrichedCompanies;
            }
          

           
           
            //const settings = (await fileStorage.getCompanySettings(country))?.settings;

            // 6. Build token payload
            const tokenPayload = {
                employeeId,
                
            };

            const tokens = await CompanyRepo.getToken(tokenPayload);

            if (!tokens) {
                await AuthRepo.setRedisLoginAttempt(email, failCount);
                return new ResponseData(false, "Authentication failed. Please try again.", []);
            }

            // 7. Success: clear failed attempts and return tokens
            await AuthRepo.deleteAttempts(email);
            await DriverSocketRepo.terminateOldSocket(employeeId)
            await AuthRepo.setRedis(`session:${email.toLowerCase()}`, tokens.accessToken, 60 * 60 * 24); // For enforcing single-device login (optional) // 24 hours

            return new ResponseData(true, "", {
                refreshToken: tokens.refreshToken,
                accessToken: tokens.accessToken,
                employee
            });

        } catch (error: any) {
            console.error("Login error:", error);

            // Optional: Count this as a failed login if unexpected
            await AuthRepo.setRedisLoginAttempt(email, failCount);

            return new ResponseData(false, error?.message || "Internal server error", []);
        }
    }

   
    public static async loginTest(data: any): Promise<ResponseData> {
        const email = data.email.trim().toLowerCase();
        let failCount = 0;

        try {
            // 1. Check if account is locked
            const [isLocked, failedAttemptStr] = await Promise.all([
                AuthRepo.getLocked(email),
                AuthRepo.getRedisLoginAttempt(email)
            ]);

            if (isLocked) {
                await AuthRepo.deleteAttempts(email);
                return new ResponseData(
                    false,
                    "Your account is temporarily locked due to multiple failed login attempts.",
                    []
                );
            }

            // 2. Count failed attempts
            failCount = failedAttemptStr ? Number(failedAttemptStr) + 1 : 1;
            if (failCount > 2) {
                await AuthRepo.setLocked(email, 30); // Lock for 30 minutes
                return new ResponseData(
                    false,
                    "Your account is temporarily locked due to multiple failed login attempts.",
                    []
                );
            }

            // 3. Validate input
            const validate = await AuthValidation.validateAuth(data);
            if (!validate.valid) throw new ValidationException(validate.error);

            const hashedPassword = await AuthRepo.hashPassword(data.password);

            // 4. Query employee
            const query = {
                text: `
                SELECT "Employees".name,
                              "EmployeePrivileges"."privileges",
                              "Employees".name,"Employees".id,
                              "Employees"."companyId",
                              "Employees"."companyGroupId",
                              "Employees"."dashBoardOptions",
                              "Employees"."resetPasswordDate",
                              "Companies".country,
                              "Media".id as "mediaId",
                              "Media".url as "mediaUrl"
                               FROM "Employees" 
                      INNER JOIN "CompanyEmployees" ON "CompanyEmployees"."employeeId" = "Employees".id 
                      LEFT JOIN "EmployeePrivileges"
                      on "EmployeePrivileges".id = "Employees"."privilegeId"
                      LEFT JOIN "Companies" 
                      on "Companies".id = "Employees"."companyId"
                      LEFT join "Media" on "Media".id = "Employees"."mediaId"
                      WHERE LOWER(email)=LOWER($1) AND password=$2 AND "CompanyEmployees"."isDriver" = true
                      
                      UNION ALL
                      
                      SELECT "Employees".name,
                              "EmployeePrivileges"."privileges",
                              "Employees".name,"Employees".id,
                              "Employees"."companyId",
                              "Employees"."companyGroupId",
                              "Employees"."dashBoardOptions",
                              "Employees"."resetPasswordDate",
                              "Companies".country,
                              "Media".id as "mediaId",
                              "Media".url as "mediaUrl"
                               FROM "Employees" 
                      LEFT JOIN "EmployeePrivileges"
                      on "EmployeePrivileges".id = "Employees"."privilegeId"
                      LEFT JOIN "Companies" 
                      on "Companies".id = "Employees"."companyId"
                      LEFT join "Media" on "Media".id = "Employees"."mediaId"
                      WHERE LOWER(email)=LOWER($1) AND password=$2 AND "Employees"."isDriver" = true
            `,
                values: [email, hashedPassword],
            };

            const result = await DB.exec.query(query.text, query.values);

            if (result.rows.length === 0) {
                await AuthRepo.setRedisLoginAttempt(email, failCount);
                return new ResponseData(false, "Wrong email or password", []);
            }

            const employee = result.rows[0];
            const { companyId, id: employeeId, country } = employee;

            // 5. Fetch company settings
            const fileStorage = new FileStorage();
            const settings = (await fileStorage.getCompanySettings(country))?.settings;

            // 6. Build token payload
            const tokenPayload = {
                employeeId,
                companyId,
                company: {
                    id: companyId,
                    country,
                    afterDecimal: settings?.afterDecimal ?? 2,
                    timeOffset: settings?.timeOffset ?? 0
                }
            };

            const tokens = await CompanyRepo.getToken(tokenPayload);

            if (!tokens) {
                await AuthRepo.setRedisLoginAttempt(email, failCount);
                return new ResponseData(false, "Authentication failed. Please try again.", []);
            }

            // 7. Success: clear failed attempts and return tokens
            await AuthRepo.deleteAttempts(email);
            await DriverSocketRepo.terminateOldSocket(employeeId)
            await AuthRepo.setRedis(`session:${email.toLowerCase()}`, tokens.accessToken, 60 * 60 * 24); // For enforcing single-device login (optional) // 24 hours

            return new ResponseData(true, "", {
                refreshToken: tokens.refreshToken,
                accessToken: tokens.accessToken,
                employee
            });

        } catch (error: any) {
            console.error("Login error:", error);

            // Optional: Count this as a failed login if unexpected
            await AuthRepo.setRedisLoginAttempt(email, failCount);

            return new ResponseData(false, error?.message || "Internal server error", []);
        }
    }

    public static async checkEmployeeInShift(client: PoolClient|null, employeeId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT id FROM "EmployeeShifts" where "employeeId"=  $1 and "endShift"  is null`,
                values: [employeeId],
            };
            let resault
           

            if (client){
                resault = await client.query(query.text, query.values);
            }  else {
                resault = await DB.excu.query(query.text, query.values);
           } 
           
           const id = (resault.rows && resault.rows.length > 0) ? (<any>resault.rows[0]).id: "" 
            

            return id
        } catch (error: any) {
            throw new Error(error.message)
        }

    }

    public static async startShift(employeeId: any) {
        try {
           
            // ############## Employee already In shift ############## 
            let query: { text: string, values: any } = {
                text: `SELECT * FROM "EmployeeShifts" 
                        where "employeeId"=  $1 and "endShift"  is null`,
                values: [employeeId],
            };
            const record = await DB.excu.query(query.text, query.values);
            if (record && record.rows.length > 0) {
                return new ResponseData(true, "Employee already In Shift", record.rows[0])
            }
            
            // ################  Start Employee Shift  ################
            query = {
                text: ` INSERT INTO "EmployeeShifts"("employeeId", "startShift") 
                        VALUES ($1, $2) RETURNING *`,
                values: [employeeId, new Date()]
            }   
            const insert: any = (await DB.excu.query(query.text, query.values));
            if (insert && insert.rows.length > 0) {
                return new ResponseData(true, "Shift Started Successfully", insert.rows[0])
            }

            // ################ failed to Start  Shift ################
            return new ResponseData(false, "Shift Starting failed", {})

        } catch (error: any) {
            throw new Error(error)
        } 
    }

    public static async endShift(client: PoolClient, employeeId: string) {
        try {

            const EmployeeShiftId = await this.checkEmployeeInShift(client, employeeId);
            if (!EmployeeShiftId) {
                return new ResponseData(true, "Employee out of Shift",{} )
            }

            const query: { text: string, values: any } = {
                text: `UPDATE "EmployeeShifts" SET  "endShift"=$2 WHERE id = $1 returning *  `,
                values: [EmployeeShiftId, new Date()],
            };
            const setOutShift = (await client.query(query.text, query.values));

            if (setOutShift.rows && setOutShift.rows.length > 0) {
                return new ResponseData(true, "", setOutShift.rows[0] )
            }
            else {
                return new ResponseData(false, "", {})
            }
        } catch (error: any) {
            throw new Error(error.message)
        }

    }

    public static async pendingOrders(employeeId: string) {
        try {

            const query: { text: string, values: any } = {
                // text: `with "branches" as(
                //             select jsonb_array_elements("branches")->> 'id' as "branchId"
                //             from "CompanyEmployees" 
                //             where "employeeId" = $1 and type = 'Driver' and ("CompanyEmployees"."inventionEndAt" is null or "CompanyEmployees"."inventionEndAt" >$2)
                //         )
                //          , "invoiceTotal" as (
                //             select "Invoices".id,
                // 			"Invoices"."createdAt",
                //             "Invoices"."invoiceNumber", 
                //             "Invoices"."total", 
                //             "Invoices"."deliveryCharge", 
                //             "Companies".name as "companyName",
                //             "Branches".name as "branchName",
                //             "Branches".location as "branchLocation", 
                //             "Invoices"."customerAddress"
                //         from "Invoices"
                //         inner join "branches" on "branches"."branchId"::uuid = "Invoices"."branchId" and "driverId" is null
                //         inner join "Services" on "Services".id = "Invoices"."serviceId" and "Services".type = 'Delivery'
                //         left join "Branches" on "Branches".id = "Invoices"."branchId"
                //         left join "Companies" on "Companies".id = "Branches"."companyId"
                // 		where "Invoices"."status" <>'Draft'
                // 			order by "Invoices"."createdAt" desc


                //         ),"appliedCredits" as (
                //                         select sum ("AppliedCredits"."amount"::text::numeric) as total ,"invoiceTotal".id from "AppliedCredits"
                //                         left join "invoiceTotal" on  "invoiceTotal".id = "AppliedCredits"."invoiceId" 
                //                         group by "invoiceTotal".id
                //                         ),"creditNotestotal" as (
                //                         select sum ("CreditNotes"."total"::text::numeric) as total,"invoiceTotal".id from "CreditNotes"
                //                         left join "invoiceTotal" on "invoiceTotal".id = "CreditNotes"."invoiceId" 
                //                         group by "invoiceTotal".id
                //                         ),"invoicePayments" as (
                //                         select sum ("InvoicePaymentLines"."amount"::text::numeric) as total,"invoiceTotal".id from "InvoicePaymentLines"
                //                         left join "invoiceTotal" on "invoiceTotal".id = "InvoicePaymentLines"."invoiceId" 
                //                         left join "InvoicePayments" on "InvoicePayments".id =  "InvoicePaymentLines" ."invoicePaymentId"  
                //                         WHERE  "InvoicePayments"."status" ='SUCCESS'
                //                         group by "invoiceTotal".id
                //                         )

                //         select 
                //         "invoiceTotal".id,
                //         "invoiceTotal"."invoiceNumber", 
                // 		"invoiceTotal"."createdAt", 
                //         "invoiceTotal"."total", 
                //         "invoiceTotal"."deliveryCharge", 
                //         "invoiceTotal"."customerAddress", 
                //         "invoiceTotal"."companyName",
                //         "invoiceTotal"."branchName", 
                //         "invoiceTotal"."branchLocation", 
                //         "invoiceTotal"."customerAddress", 
                //         "invoiceTotal".total::text::numeric - (COALESCE("appliedCredits".total::text::numeric,0) + COALESCE("creditNotestotal".total::text::numeric,0) + COALESCE("invoicePayments".total::text::numeric,0)) as "unPaidAmount"
                //         from "invoiceTotal" 
                //         left join "appliedCredits" on  "invoiceTotal".id = "appliedCredits".id 
                //         left join "creditNotestotal" on  "invoiceTotal".id = "creditNotestotal".id 
                //         left join "invoicePayments" on  "invoiceTotal".id = "invoicePayments".id    `,

                text: `with "branches" as(
                         SELECT b.id AS "branchId"
						FROM "Employees" e
						JOIN "Branches" b ON e."companyId" = b."companyId"
						LEFT JOIN jsonb_array_elements(e."branches") AS elem ON e."superAdmin" <> TRUE
						WHERE e."id" = $1
						  AND e."isDriver" = TRUE
						  AND (e."superAdmin" = TRUE OR (elem->>'id')::uuid = b.id )
						union 
						SELECT b.id AS "branchId"
						FROM "CompanyEmployees" e
						JOIN "Branches" b ON e."companyId" = b."companyId"
						LEFT JOIN jsonb_array_elements(e."branches") AS elem ON e."superAdmin" <> TRUE
						WHERE e."employeeId" = $1
						  AND e."isDriver" = TRUE
						  AND (e."superAdmin" = TRUE OR (elem->>'id')::uuid = b.id )
						  and (e."inventionEndAt" is null or e."inventionEndAt" > $2)
                        )
                        , "invoiceTotal" as (
                        select "Invoices".id,
                            "Invoices"."createdAt",
                            "Invoices"."invoiceNumber", 
                            "Invoices"."total", 
                            "Invoices"."deliveryCharge", 
                            "Companies".id as "companyId",
                            "Companies".name as "companyName",
                            "Branches".name as "branchName",
                            "Branches".location as "branchLocation", 
                            "Invoices"."customerAddress"
                        from "Invoices"
                        inner join "branches" on "branches"."branchId"::uuid = "Invoices"."branchId" and "driverId" is null
                        inner join "Services" on "Services".id = "Invoices"."serviceId" and "Services".type = 'Delivery'
                        left join "Branches" on "Branches".id = "Invoices"."branchId"
                        left join "Companies" on "Companies".id = "Branches"."companyId"
                        where "Invoices"."status" <>'Draft'
                            and "Invoices"."invoiceDate" = $2::Date
                            order by "Invoices"."createdAt" desc
                        
                        
                        ),"appliedCredits" as (
                                        select sum ("AppliedCredits"."amount"::text::numeric) as total ,"invoiceTotal".id from "AppliedCredits"
                                        left join "invoiceTotal" on  "invoiceTotal".id = "AppliedCredits"."invoiceId" 
                                        group by "invoiceTotal".id
                                        ),"creditNotestotal" as (
                                        select sum ("CreditNotes"."total"::text::numeric) as total,"invoiceTotal".id from "CreditNotes"
                                        left join "invoiceTotal" on "invoiceTotal".id = "CreditNotes"."invoiceId" 
                                        group by "invoiceTotal".id
                                        ),"invoicePayments" as (
                                        select sum ("InvoicePaymentLines"."amount"::text::numeric) as total,"invoiceTotal".id from "InvoicePaymentLines"
                                        left join "invoiceTotal" on "invoiceTotal".id = "InvoicePaymentLines"."invoiceId" 
                                        left join "InvoicePayments" on "InvoicePayments".id =  "InvoicePaymentLines" ."invoicePaymentId"  
                                        WHERE  "InvoicePayments"."status" ='SUCCESS'
                                        group by "invoiceTotal".id
                                        )
                                        
                        select 
                        "invoiceTotal".id,
                        "invoiceTotal"."invoiceNumber", 
                        "invoiceTotal"."createdAt", 
                        "invoiceTotal"."total", 
                        "invoiceTotal"."deliveryCharge", 
                        "invoiceTotal"."customerAddress", 
                        "invoiceTotal"."companyId",
                        "invoiceTotal"."companyName",
                        "invoiceTotal"."branchName", 
                        "invoiceTotal"."branchLocation", 
                        "invoiceTotal"."customerAddress", 
                        "invoiceTotal".total::text::numeric - (COALESCE("appliedCredits".total::text::numeric,0) + COALESCE("creditNotestotal".total::text::numeric,0) + COALESCE("invoicePayments".total::text::numeric,0)) as "unPaidAmount"
                        from "invoiceTotal" 
                        left join "appliedCredits" on  "invoiceTotal".id = "appliedCredits".id 
                        left join "creditNotestotal" on  "invoiceTotal".id = "creditNotestotal".id 
                        left join "invoicePayments" on  "invoiceTotal".id = "invoicePayments".id    `,
                values: [employeeId, new Date()],
            };
            const records = (await DB.excu.query(query.text, query.values));

            if (records && records.rows.length > 0) {
                return new ResponseData(true, "", records.rows)
            }
            return new ResponseData(true, "", {})

        } catch (error: any) {
            throw new Error(error.message)
        }

    }

    public static async clamiedOrders(employeeId: string) {
        try {

            const query: { text: string, values: any } = {
                text: ` with  "invoiceTotal" as (
                        select "Invoices".id,
                        "Invoices"."invoiceNumber", 
                        "Invoices"."createdAt",
                        "Invoices"."total", 
                        "Invoices"."deliveryCharge", 
                        "Companies".id as "companyId",
                        "Companies".name as "companyName",
                        "Branches".name as "branchName", 
                        "Branches".location as "branchLocation",
                        "Invoices"."customerAddress"
                    from "Invoices"
                    left join "Branches" on "Branches".id = "Invoices"."branchId"
                    left join "Companies" on "Companies".id = "Branches"."companyId"
                    where "Invoices"."claimTime" is not null and "Invoices"."departureTime" is null  and  "driverId" = $1
                    
                    ),"appliedCredits" as (
                    select sum ("AppliedCredits"."amount"::text::numeric) as total ,"invoiceTotal".id from "AppliedCredits"
                    left join "invoiceTotal" on  "invoiceTotal".id = "AppliedCredits"."invoiceId" 
                    group by "invoiceTotal".id
                    ),"creditNotestotal" as (
                    select sum ("CreditNotes"."total"::text::numeric) as total,"invoiceTotal".id from "CreditNotes"
                    left join "invoiceTotal" on "invoiceTotal".id = "CreditNotes"."invoiceId" 
                    group by "invoiceTotal".id
                    ),"invoicePayments" as (
                    select sum ("InvoicePaymentLines"."amount"::text::numeric) as total,"invoiceTotal".id from "InvoicePaymentLines"
                    left join "invoiceTotal" on "invoiceTotal".id = "InvoicePaymentLines"."invoiceId" 
                    left join "InvoicePayments" on "InvoicePayments".id =  "InvoicePaymentLines" ."invoicePaymentId"  
                    WHERE  "InvoicePayments"."status" ='SUCCESS'
                    group by "invoiceTotal".id
                    )
                    
                    select 
					   "invoiceTotal".id,
					   "invoiceTotal"."invoiceNumber", 
                       "invoiceTotal"."createdAt",
					   "invoiceTotal"."total", 
					   "invoiceTotal"."deliveryCharge", 
					   "invoiceTotal"."customerAddress", 
                       "invoiceTotal"."companyId",
					   "invoiceTotal"."companyName",
					   "invoiceTotal"."branchName", 
                        "invoiceTotal"."branchLocation",
					   "invoiceTotal"."customerAddress", 
                       "invoiceTotal".total::text::numeric - (COALESCE("appliedCredits".total::text::numeric,0) + COALESCE("creditNotestotal".total::text::numeric,0) + COALESCE("invoicePayments".total::text::numeric,0)) as "unPaidAmount"
                    from "invoiceTotal" 
                    left join "appliedCredits" on  "invoiceTotal".id = "appliedCredits".id 
                    left join "creditNotestotal" on  "invoiceTotal".id = "creditNotestotal".id 
                    left join "invoicePayments" on  "invoiceTotal".id = "invoicePayments".id 
                  `,
                values: [employeeId],
            };
            const records = (await DB.excu.query(query.text, query.values));

            if (records && records.rows.length > 0) {
                return new ResponseData(true, "", records.rows)
            }
            return new ResponseData(true, "", {})

        } catch (error: any) {
            throw new Error(error.message)
        }

    }

    public static async pickedOrders(employeeId: string) {
        try {

            const query: { text: string, values: any } = {
                text: ` with  "invoiceTotal" as (
                        select "Invoices".id,
                        "Invoices"."invoiceNumber", 
                        "Invoices"."total", 
                        "Invoices"."deliveryCharge", 
                        "Invoices"."departureTime",
                        "Invoices"."createdAt", 
                        "Companies".id as "companyId",
                        "Companies".name as "companyName",
                        "Branches".name as "branchName", 
                        "Invoices"."customerAddress",
                         "Branches"."location" as "branchLocation"
                    from "Invoices"
                    left join "Branches" on "Branches".id = "Invoices"."branchId"
                    left join "Companies" on "Companies".id = "Branches"."companyId"
                    where "departureTime" is not null and "arrivalTime" is  null  and  "driverId" = $1
                    
                    ),"appliedCredits" as (
                    select sum ("AppliedCredits"."amount"::text::numeric) as total ,"invoiceTotal".id from "AppliedCredits"
                    left join "invoiceTotal" on  "invoiceTotal".id = "AppliedCredits"."invoiceId" 
                    group by "invoiceTotal".id
                    ),"creditNotestotal" as (
                    select sum ("CreditNotes"."total"::text::numeric) as total,"invoiceTotal".id from "CreditNotes"
                    left join "invoiceTotal" on "invoiceTotal".id = "CreditNotes"."invoiceId" 
                    group by "invoiceTotal".id
                    ),"invoicePayments" as (
                    select sum ("InvoicePaymentLines"."amount"::text::numeric) as total,"invoiceTotal".id from "InvoicePaymentLines"
                    left join "invoiceTotal" on "invoiceTotal".id = "InvoicePaymentLines"."invoiceId" 
                    left join "InvoicePayments" on "InvoicePayments".id =  "InvoicePaymentLines" ."invoicePaymentId"  
                    WHERE  "InvoicePayments"."status" ='SUCCESS'
                    group by "invoiceTotal".id
                    )
                    
                    select 
					   "invoiceTotal".id,
					   "invoiceTotal"."invoiceNumber", 
					   "invoiceTotal"."total", 
					   "invoiceTotal"."deliveryCharge", 
                       "invoiceTotal"."departureTime",
					   "invoiceTotal"."customerAddress", 
                       "invoiceTotal"."createdAt",
                       "invoiceTotal"."companyId",
					   "invoiceTotal"."companyName",
					   "invoiceTotal"."branchLocation",
					   "invoiceTotal"."branchName", 
					   "invoiceTotal"."customerAddress", 
                       "invoiceTotal".total::text::numeric - (COALESCE("appliedCredits".total::text::numeric,0) + COALESCE("creditNotestotal".total::text::numeric,0) + COALESCE("invoicePayments".total::text::numeric,0)) as "unPaidAmount"
                    from "invoiceTotal" 
                    left join "appliedCredits" on  "invoiceTotal".id = "appliedCredits".id 
                    left join "creditNotestotal" on  "invoiceTotal".id = "creditNotestotal".id 
                    left join "invoicePayments" on  "invoiceTotal".id = "invoicePayments".id 
                  `,
                values: [employeeId],
            };
            const records = (await DB.excu.query(query.text, query.values));

            if (records && records.rows.length > 0) {
                return new ResponseData(true, "", records.rows)
            }
            return new ResponseData(true, "", {})

        } catch (error: any) {
            throw new Error(error.message)
        }

    }

    public static async deliveredOrders(employeeId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `with "invoiceTotal" as( SELECT 
                            i.id,
                            i."invoiceNumber", 
                            i."total", 
                            i."deliveryCharge", 
                            i."createdAt", 
                            c.id as "companyId",
                            c.name AS "companyName",
                            b.name AS "branchName", 
                            i."customerAddress"
                        FROM "Invoices" i
                        JOIN LATERAL (
                            SELECT es."startShift"
                            FROM "EmployeeShifts" es
                            WHERE es."employeeId" = $1 AND es."endShift" IS NULL
                            ORDER BY es."startShift" DESC
                            LIMIT 1
                        ) s ON i."arrivalTime" >= s."startShift"::date
                        LEFT JOIN "Branches" b ON b.id = i."branchId"
                        LEFT JOIN "Companies" c ON c.id = b."companyId"
                        WHERE i."driverId" = $1 and i."arrivalTime" is not null
                        order by i."arrivalTime"
                    
                    ),"appliedCredits" as (
                    select sum ("AppliedCredits"."amount"::text::numeric) as total ,"invoiceTotal".id from "AppliedCredits"
                    left join "invoiceTotal" on  "invoiceTotal".id = "AppliedCredits"."invoiceId" 
                    group by "invoiceTotal".id
                    ),"creditNotestotal" as (
                    select sum ("CreditNotes"."total"::text::numeric) as total,"invoiceTotal".id from "CreditNotes"
                    left join "invoiceTotal" on "invoiceTotal".id = "CreditNotes"."invoiceId" 
                    group by "invoiceTotal".id
                    ),"invoicePayments" as (
                    select sum ("InvoicePaymentLines"."amount"::text::numeric) as total,"invoiceTotal".id from "InvoicePaymentLines"
                    left join "invoiceTotal" on "invoiceTotal".id = "InvoicePaymentLines"."invoiceId" 
                    left join "InvoicePayments" on "InvoicePayments".id =  "InvoicePaymentLines" ."invoicePaymentId"  
                    WHERE  "InvoicePayments"."status" ='SUCCESS'
                    group by "invoiceTotal".id
                    )
                    
                    select 
					   "invoiceTotal".id,
					   "invoiceTotal"."invoiceNumber", 
					   "invoiceTotal"."total", 
					   "invoiceTotal"."deliveryCharge", 
					   "invoiceTotal"."customerAddress", 
                       "invoiceTotal"."createdAt",
                       "invoiceTotal"."companyId",
					   "invoiceTotal"."companyName",
					   "invoiceTotal"."branchName", 
					   "invoiceTotal"."customerAddress", 
                       "invoiceTotal".total::text::numeric - (COALESCE("appliedCredits".total::text::numeric,0) + COALESCE("creditNotestotal".total::text::numeric,0) + COALESCE("invoicePayments".total::text::numeric,0)) as "unPaidAmount"
                    from "invoiceTotal" 
                    left join "appliedCredits" on  "invoiceTotal".id = "appliedCredits".id 
                    left join "creditNotestotal" on  "invoiceTotal".id = "creditNotestotal".id 
                    left join "invoicePayments" on  "invoiceTotal".id = "invoicePayments".id 
                  `,
                values: [employeeId],
            };
            const records = (await DB.excu.query(query.text, query.values));

            if (records && records.rows.length > 0) {
                return new ResponseData(true, "", records.rows)
            }
            return new ResponseData(true, "", {})

        } catch (error: any) {
            throw new Error(error.message)
        }

    }

    public static async updateOrderStatus(employeeId: string, data: any) {
        try {


            let invoiceId = data.invoiceId ? (data.invoiceId).trim() ? (data.invoiceId).trim() : null : null;
            let status = data.status ? (data.status).trim() ? (data.status).trim() : null : null;


            if (!invoiceId) { throw new ValidationException('invoiceId is required') }
            if (!status) { throw new ValidationException('status is required') }

            let statusIndex = ['claim', 'pickUp', 'delivered', 'disclaim'].indexOf(status)
            if (statusIndex == -1) { throw new ValidationException('inValid status value, must be one of [claim,pickUp,delivered, disclaim]') }

            let query: { text: string, values: any } | null = { text: '', values: [] }

            switch (status) {
                case 'claim':
                    const code = await Helper.generateCode(6);
                    query.text = ` UPDATE "Invoices" SET "driverId"=$2, "claimTime" =$3, "invoiceCode" = $4 , "updatedDate" =$3 WHERE id =$1 and "driverId" is null RETURNING id,"invoiceNumber",total,"customerAddress","branchId", "claimTime","departureTime","arrivalTime" `;
                    query.values = [invoiceId, employeeId, new Date(), code];
                    console.log(query.values)
                    break;
                case 'disclaim':
                    query.text = ` UPDATE "Invoices" SET "driverId"= null, "claimTime" =null, "invoiceCode" = null, "updatedDate" =$3  WHERE id =$1 and "driverId" = $2 RETURNING id,"invoiceNumber",total,"customerAddress","branchId", "claimTime","departureTime","arrivalTime"`;
                    query.values = [invoiceId, employeeId, new Date()];
                    console.log(query.values)
                    break;
                case 'pickUp':
                    query.text = `UPDATE "Invoices" SET  "departureTime" =$3, "updatedDate" =$3  WHERE id =$2 and "driverId" = $1 RETURNING id,"invoiceNumber",total,"customerAddress","branchId","departureTime","arrivalTime" `;
                    query.values = [employeeId, invoiceId, new Date()];
                    break;
                case 'delivered':
                    query.text = `UPDATE "Invoices" SET  "arrivalTime" =$3 , "updatedDate" =$3  WHERE id =$2 and "driverId" = $1 RETURNING id,"invoiceNumber",total,"customerAddress" ,"branchId","departureTime","arrivalTime" `;
                    query.values = [employeeId, invoiceId, new Date()];
                    break;
                default:
                    query = query
                    break;
            }


            console.log(query.text, query.values)
            const records = await DB.excu.query(query.text, query.values);


            if (records && records.rows.length > 0) {
                const branchId = (<any>records.rows[0]).branchId 
                let socketData = <any>records.rows[0]
                socketData.driverId = employeeId;
                socketData.deliveryOrderStatus = status;
                socketData.invoiceId = invoiceId;
                socketData.departureTime = (<any>records.rows[0]).departureTime;
                socketData.arrivalTime = (<any>records.rows[0]).arrivalTime;
                console.log("socketData", socketData)
                await DriverSocketRepo.sendDeliveryOrderStatus(socketData, branchId)

                return new ResponseData(true, "", records.rows)
                
            }
            return new ResponseData(false, "", {})

        } catch (error: any) {

            return new ResponseData(false, error.message, [])

        }

    }

    public static async getOrderById(invoiceId: string) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const query: { text: string, values: any } = {
                text: `SELECT "Invoices".id,
                            "Invoices"."invoiceNumber",
                            "Invoices"."refrenceNumber",
                            "Invoices"."total",
                            "Invoices"."note",
                            "Invoices"."guests",
                            "Invoices"."branchId",
                            "Invoices"."employeeId",
                            "Invoices"."tableId",
                            "Invoices"."createdAt",
                            "Invoices"."source",
                            "Invoices"."serviceId",
                            "Invoices"."customerId",
                            "Invoices"."customerAddress",
                            "Invoices"."customerContact",
                            "Invoices"."customerLatLang",
                            "Invoices"."discountId",
                            "Invoices"."discountAmount",
                            "Invoices"."discountPercentage",
                       
                            "Invoices"."estimateId",
                            "Invoices"."status",
                            "Invoices"."draft",
                            "Invoices"."charges",
                            "Invoices"."discountTotal",
                            "Invoices"."chargeId",
                            "Invoices"."chargeAmount",
                            "Invoices"."chargePercentage",
                            "Invoices"."chargeTotal",
                            "Invoices"."subTotal",
                            "Invoices"."deliveryCharge",
                            "Invoices"."printTime",
                            "Invoices"."readyTime",
                            "Invoices"."departureTime",
                            "Invoices"."arrivalTime",
                            "Invoices"."scheduleTime",
                            "Invoices"."mergeWith",
                            ("Invoices"."invoiceDate"::text),
                            ("Invoices"."updatedDate"::text),
                            "Invoices"."terminalId",
                            "Invoices"."roundingType",
                            "Invoices"."roundingTotal",
                            "Invoices"."smallestCurrency",
                            "Invoices"."isInclusiveTax",
                            "Invoices"."driverId",
                            "Invoices"."discountType",
                            "Invoices"."onlineData"->> 'callCenterStatus' as "callCenterStatus"

                            
                            FROM "Invoices" where id = $1`,
                values: [invoiceId]
            }

            //get Invoice
            let invoiceData = (await client.query(query.text, query.values)).rows[0];
            let invoice = new Invoice();
            invoice.ParseJson(invoiceData);

            //get customer               
            if (invoice.customerId != null && invoice.customerId != "") {
                query.text = `SELECT  id, name 
                        FROM "Customers" where id =$1 `,
                    query.values = [invoice.customerId]
                let customerInfo = (await client.query(query.text, query.values)).rows[0];
                if (customerInfo) invoice.customer = customerInfo;
            }


            //get employee
            if (invoice.employeeId != null && invoice.employeeId != "") {
                query.text = `SELECT  id, name 
                            FROM "Employees" where id =$1 `,
                    query.values = [invoice.employeeId]
                let employeeInfo = (await client.query(query.text, query.values));
                if (employeeInfo.rows.length > 0) invoice.employee = employeeInfo.rows[0];
            }

            //get driver
            if (invoice.driverId != null && invoice.driverId != "") {
                query.text = `SELECT  id, name 
                            FROM "Employees" where id =$1 `,
                    query.values = [invoice.driverId]
                let driverInfo = (await client.query(query.text, query.values));
                if (driverInfo.rows.length > 0) invoice.driver = driverInfo.rows[0];
            }

            //get service
            let serviceInfo;
            if (invoice.serviceId != null && invoice.serviceId != "") {
                query.text = `SELECT  id, name , type
                            FROM "Services" where id =$1 `,
                    query.values = [invoice.serviceId]
                serviceInfo = (await client.query(query.text, query.values));
                if (serviceInfo.rows.length > 0) invoice.service = serviceInfo.rows[0];
            }

            //get table
            let tableInfo;
            if (invoice.tableId != null && invoice.tableId != "") {
                query.text = `SELECT  id, name , properties
                            FROM "Tables" where id =$1 `,
                    query.values = [invoice.tableId]
                let tableInfo = (await client.query(query.text, query.values))
                if (tableInfo.rows.length > 0) invoice.table = tableInfo.rows[0];
            }


            //get Invoice Lines
            query.text = `SELECT  id,
                                "invoiceId",
                                total,
                                price,
                                qty, 
                                "productId",
                                "employeeId",
                                batch,
                                serial,
                                "createdAt",
                                "parentId",
                                "seatNumber",
                                "salesEmployeeId",
                                ("serviceDate"::text),
                                "serviceDuration",
                                "discountId", "discountType",
                                "discountAmount",
                                "discountPercentage",
                                note,
                                status,
                                "accountId",
                                "subTotal",
                                "discountTotal",
                                "commissionPercentage",
                                "commissionAmount",
                                "taxId",
                                "commissionTotal",
                                "voidFrom",
                                "taxTotal",
                                waste,
                                taxes,
                                "taxType",
                                "taxPercentage",
                                "isInclusiveTax",
                                "defaultPrice",
                                "holdTime",
                                "printTime",
                                "readyTime",
                                "voidReason",
                                "priceOfferType",
                                recipe,
                                cost 
                                FROM "InvoiceLines" where "invoiceId" =$1 
                                Order By "InvoiceLines"."createdAt" asc`

            query.values = [invoice.id]
            let invoicelines = (await client.query(query.text, query.values)).rows;

            for (let index = 0; index < invoicelines.length; index++) {
                const line = invoicelines[index];
                const temp = new InvoiceLine();
                temp.ParseJson(line);

                query.text = `select "InvoiceLineOptions" .*, 
                                     jsonb_build_object('id', "Options".id, 'name', "Options".name, 'displayName',  "Options"."displayName", 'price', "Options".price::numeric) as option
                              from "InvoiceLineOptions" 
                              left join "Options" on "Options".id = "optionId"
                              where "invoiceLineId" =$1`;
                query.values = [line.id];

                let options = await client.query(query.text, query.values);
                temp.options = options.rows;


                query.text = `Select "invoiceId",
                            "CreditNoteLines"."invoiceLineId",
                            Sum("CreditNoteLines".qty) as qty, 
                            Sum("CreditNoteLines".total) as total
                            from "CreditNotes" JOIN "CreditNoteLines" On "CreditNotes".id = "CreditNoteLines"."creditNoteId" 
                            where "invoiceId" = $1 and "CreditNoteLines"."invoiceLineId" =$2
                            Group By "invoiceId", "CreditNoteLines"."invoiceLineId"`
                query.values = [invoiceId, line.id];

                let returnLines = await client.query(query.text, query.values);
                temp.returnItems = returnLines.rows;



                query.text = `SELECT  id, name , type
                            FROM "Products" where id =$1 `,
                    query.values = [line.productId]
                let prodInfo = await client.query(query.text, query.values);
                temp.product = prodInfo.rows[0];
                temp.productName = prodInfo.rows[0].name;

                invoice.lines.push(temp);
            }

            let subLines = invoice.lines.filter(f => f.parentId != null && f.parentId != "");
            let tempInvoiceLine: InvoiceLine | undefined;
            for (let index = 0; index < subLines.length; index++) {
                const element = subLines[index];
                tempInvoiceLine = invoice.lines.find(f => f.id == element.parentId);
                if (tempInvoiceLine != null) {
                    tempInvoiceLine.subItems.push(element);
                    invoice.lines.splice(invoice.lines.indexOf(element), 1);
                }
            }


            let voidedLines = invoice.lines.filter(f => f.voidFrom != null && f.voidFrom != "");
            for (let index = 0; index < voidedLines.length; index++) {
                const element = voidedLines[index];
                tempInvoiceLine = invoice.lines.find(f => f.id == element.voidFrom);
                if (tempInvoiceLine != null) {
                    tempInvoiceLine.voidedItems.push(element);
                    invoice.lines.splice(invoice.lines.indexOf(element), 1);
                }
            }

            //get Payment Information
            query.text = `Select "InvoicePaymentLines".id, 
                                    "InvoicePayments".id as "invoicePaymentId", 
                                    "invoiceId",
                                    rate, 
                                    "InvoicePaymentLines".amount / rate as amount ,
                                    "InvoicePayments"."tenderAmount", 
                                    "InvoicePayments"."changeAmount",
                                    "paymentMethodId",
                                    (select "PaymentMethods".name  from "PaymentMethods" where"PaymentMethods".id = "InvoicePayments"."paymentMethodId") ,                            
                                    "employeeId",
                                    "cashierId",
                                    "InvoicePaymentLines"."createdAt" 
                                    from "InvoicePayments" JOIN "InvoicePaymentLines" On "InvoicePayments".id = "InvoicePaymentLines"."invoicePaymentId" 
                                    where "invoiceId"= $1`

            query.values = [invoiceId];

            let payments = await client.query(query.text, query.values)

            invoice.invoicePayments = payments.rows;



            //get Return Lines
            // query.text = `Select "invoiceId",
            //                 "CreditNoteLines"."invoiceLineId",
            //                 Sum("CreditNoteLines".qty) as qty, 
            //                 Sum("CreditNoteLines".total) as total
            //                 from "CreditNotes" JOIN "CreditNoteLines" On "CreditNotes".id = "CreditNoteLines"."creditNoteId" 
            //                 where "invoiceId" = $1
            //                 Group By "invoiceId", "CreditNoteLines"."invoiceLineId"`

            // query.values = [invoiceId];

            // let returnLines = (await client.query(query.text, query.values)).rows

            // let temp : InvoiceLine | undefined;
            // for (let element of returnLines) {
            //   temp = invoice.lines.find((f) => f.id == element.invoiceLineId);
            //   if (temp != null) {
            //     temp.returnItems.push(element);
            //   }
            // }


            invoice.branchName = await BranchesRepo.getBranchName(invoice.branchId);
            invoice.employeeName = await EmployeeRepo.getEmployeeName(invoice.employeeId);



            await client.query("COMMIT")
            return new ResponseData(true, "", invoice);
        } catch (error: any) {
            await client.query("ROLLBACK")
            return new ResponseData(false, "", error);
        } finally {
            client.release()
        }
    }

    public static async invoicePayment(employeeId: string, invoiceId: string) {
        try {

            const query: { text: string, values: any } = {
                text: ` select  "Branches"."companyId"
                        from "Invoices"
                        inner join "Branches" 
                        where "departureTime" is not null and "Invoices".id = $2  and  "driverId" = $1
                      `,
                values: [employeeId, invoiceId],
            };
            const records = (await DB.excu.query(query.text, query.values));

            if (records && records.rows.length > 0) {
                const companyId = (<any>records.rows[0]).companyId
                let token = btoa(companyId + '|+|' + invoiceId)
                let redirectUrl = process.env.CLOUD_BASE_URL + '/' + 'einvoice/' + token
                return new ResponseData(true, "", redirectUrl)
            }
            return new ResponseData(false, "", null)

        } catch (error: any) {
            throw new Error(error.message)
        }

    }

    public static async pickupOrder(invoiceCode: string | null, invoiceId: string) {
        try {

            let query: { text: string, values: any } = {
                text: ` select  id , "departureTime", "driverId"
                        from "Invoices"
                        where id = $1 
                      `,
                values: [invoiceId],
            }

            if (invoiceCode) {
                query.text = ` select  id , "departureTime", "driverId"
                                from "Invoices"
                                where id = $1 and "invoiceCode" = $2 
                             `,
                    query.values = [invoiceId, invoiceCode]
            }


            const records = (await DB.excu.query(query.text, query.values));

            if (records && records.rows.length > 0) {
                console.log("departureTime::::::::::::::::::::", (<any>records.rows[0]).departureTime)
                if ((<any>records.rows[0]).departureTime) { throw new ValidationException('The order is already shipped') }
                const driverId = (<any>records.rows[0]).driverId
                let resData = await this.updateOrderStatus(driverId, { 'invoiceId': invoiceId, 'status': 'pickUp' })
                return resData
            }
            return new ResponseData(false, "Incorrect ticket Code", null)

        } catch (error: any) {
            throw new Error(error.message)
        }

    }

    public static async setDriverLocation(employeeId: string, data: any) {
        const client = await DB.excu.client();
        try {

            /**Intiate Client */
            await client.query("BEGIN");
            const EmployeeShiftId = await this.checkEmployeeInShift(client, employeeId);

            if (!EmployeeShiftId) { throw new ValidationException("Employee out of Shift") }
            if (!data.latitude) { throw new ValidationException("latitude is required") }
            if (!data.longitude) { throw new ValidationException("longitude is required") }

            const location = { lat: data.latitude ?? null, long: data.longitude ?? null, updatedDate: new Date() }

            const query: { text: string, values: any } = {
                text: `with sliced as(
                        select elem
                        from "EmployeeShifts", jsonb_array_elements("location") elem
                        WHERE  id = $1 and "endShift" is null
                        order by (elem->> 'updatedDate')::timestamp desc
                        limit 9
                        )
                        ,locations as (
                        SELECT 
                            COALESCE(jsonb_agg(elem order by(elem->> 'updatedDate')::timestamp asc) ,'[]') || ($2::jsonb) as new_locations
                        from sliced
                        )
                        UPDATE "EmployeeShifts"
                        SET "location" = new_locations
                        from locations
                        where  id = $1 and "endShift" is null
                        returning * `,
                values: [EmployeeShiftId, JSON.stringify(location)],
            };
            const setOutShift = (await client.query(query.text, query.values));


            //send driver Loction to pos
            const branchIds = await this.getEmployeeBranchIds(employeeId);
            const socketData = { "EmployeeShiftId": EmployeeShiftId, "location": location }
            await DriverSocketRepo.sendDriverLocation(socketData, branchIds)


            /**Commit Client */
            await client.query("COMMIT");
            return new ResponseData(true, "", setOutShift.rows)
        } catch (error: any) {
            /**RollBack Client */
            await client.query("ROLLBACK");

            throw new Error(error)
        } finally {
            /**Release Client */
            client.release();
        }
    }

    public static async getAvailableDrivers(branchId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `select "EmployeeShifts"."id", "employeeId", "startShift", "endShift", "breaks",  e.name 
                        from "EmployeeShifts"
                        join "Employees" e on e.id = "EmployeeShifts"."employeeId"
                        join "Branches" b ON e."companyId" = b."companyId" and b.id = $1
                        left join jsonb_array_elements(e."branches") AS elem ON e."superAdmin" <> TRUE
                        where "isDriver" = true
                            and (e."superAdmin" = TRUE OR (elem->>'id')::uuid = b.id )
                            and "endShift"  is null

                        union

                        select "EmployeeShifts"."id", "EmployeeShifts"."employeeId", "startShift", "endShift", "breaks",  e.name 
                        from "EmployeeShifts"
                        join "CompanyEmployees" ce on ce.id = "EmployeeShifts"."employeeId"
                        join "Employees" e on e.id = ce."employeeId" and e."companyId" <> ce."companyId"
                        join "Branches" b ON ce."companyId" = b."companyId" and b.id = $1
                        left join jsonb_array_elements(ce."branches") AS elem ON ce."superAdmin" <> TRUE
                        where ce."isDriver" = true
                            and (ce."superAdmin" = TRUE OR (elem->>'id')::uuid = b.id )
                            and "endShift" is null`,
                values: [branchId],
            };
            const records = (await DB.excu.query(query.text, query.values));

            if (records && records.rows.length > 0) {
                return new ResponseData(true, "", records.rows)
            }
            return new ResponseData(true, "", {})
        } catch (error: any) {
            throw new Error(error.message)
        }

    }

    public static async getDriverList(branchId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `WITH "employee" AS (
                    SELECT 
                        e.id, 
                        e.name, 
                        "Media".url::jsonb AS "mediaUrl"
                    FROM "Employees" e
                    JOIN "Branches" b 
                        ON e."companyId" = b."companyId" 
                        AND b."id" = $1
                    LEFT JOIN "Media" ON "Media".id = e."mediaId"
                    WHERE "isDriver" = true
                        AND (
                            e."superAdmin" = TRUE 
                            OR EXISTS (
                                SELECT 1 
                                FROM jsonb_array_elements(e."branches") AS elem
                                WHERE (elem->>'id')::uuid = b.id
                            )
                        )

                    UNION

                    SELECT 
                        e.id, 
                        e.name, 
                        "Media".url::jsonb AS "mediaUrl"
                    FROM "CompanyEmployees" cs
                    JOIN "Branches" b 
                        ON cs."companyId" = b."companyId" 
                        AND b."id" = $1
                    JOIN "Employees" e 
                        ON e.id = cs."employeeId" 
                        AND e."companyId" <> cs."companyId"
                    LEFT JOIN "Media" ON "Media".id = e."mediaId"
                    WHERE cs."isDriver" = true
                        AND (
                            cs."superAdmin" = TRUE 
                            OR EXISTS (
                                SELECT 1 
                                FROM jsonb_array_elements(e."branches") AS elem
                                WHERE (elem->>'id')::uuid = b.id
                            )
                        )
                )

                ,"latest_shift" AS (
                    SELECT DISTINCT ON ("employeeId")
                        id AS "employeeShiftId",
                        "employeeId",
                        "location"[-1] AS "location"
                    FROM "EmployeeShifts"
                    WHERE "endShift" IS NULL
                    ORDER BY "employeeId", "startShift" DESC
                    
                )

                SELECT  
                    e.id, 
                    e.name,
                    e."mediaUrl",
                    ls."employeeShiftId",
                    ls."location",
                    CASE 
                        WHEN ls."employeeShiftId" IS NULL THEN 'offShift' 
                        ELSE 'onShift' 
                    END AS status
                FROM "employee" e
                LEFT JOIN "latest_shift" ls ON ls."employeeId" = e.id `,
                values: [branchId],
            };
            const records = (await DB.excu.query(query.text, query.values));

            if (records && records.rows.length > 0) {
                const list: any[] = records.rows

                for (let i = 0; i < records.rows.length; i++) {
                    let orders = []
                    orders = await this.getclaimedOrdersBybranchAndEmployee(branchId, list[i].id)
                    list[i].orders = orders
                }
                return new ResponseData(true, "", records.rows)
            }
            return new ResponseData(true, "", {})
        } catch (error: any) {
            return new ResponseData(false, error.message, {})
        }

    }

    public static async getclaimedOrdersBybranchAndEmployee(branchId: string, employeeId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `select 
                            "Invoices".id,
                            "Invoices"."invoiceNumber", 
                            "Invoices"."createdAt",
                            "Invoices"."total", 
                            "Invoices"."customerAddress"
                        from "Invoices"
                        where "Invoices"."branchId" = $1
                        and "Invoices"."driverId" = $2
                        and "Invoices"."claimTime" is not null 
                        and "Invoices"."departureTime" is null 
                    `,
                values: [branchId, employeeId],
            };
            const records = (await DB.excu.query(query.text, query.values));
            console.log(records);
            if (records && records.rows.length > 0) {
                return records.rows
            }
            return []
        } catch (error: any) {
            console.log(error.message);
            throw new Error(error.message)
        }

    }


    public static async getEmployeeBranchIds(employeeId: string) {
        try {
            const query: { name: string, text: string, values: any } = {
                name: "getEmployeeBranchIds",
                text: ` select  b.id 
						from  "Employees" e
						join "Branches" b ON e."companyId" = b."companyId"
						left join jsonb_array_elements(e."branches") AS elem ON e."superAdmin" <> TRUE
						where e."id" = $1
						  and (e."superAdmin" = TRUE OR (elem->>'id')::uuid = b.id )
						union 
						select b.id 
						from "CompanyEmployees" e
						join "Branches" b ON e."companyId" = b."companyId"
						left join jsonb_array_elements(e."branches") AS elem ON e."superAdmin" <> TRUE
						where e."employeeId" = $1
						  and (e."superAdmin" = TRUE OR (elem->>'id')::uuid = b.id )
                    `,
                values: [employeeId]
            }
            const list = await DB.excu.query(query.text, query.values);
            const branchIds: any = [];
            list.rows.forEach((element: any) => {
                branchIds.push(element.id)
            });
            return branchIds
        } catch (error: any) {
            console.log(error)
            return null
        }
    }



    // unused functions
    public static async login2(client: Socket, data: any, callback: CallableFunction) {
        const email = data.email.trim()
        let count = 0;
        try {

            //CHECK IF EXCEEDED FAIL ATTEMPT => IF FAILD ATTEMPT IS GREATED IS 3 THEN RETIRN IF NO KEY THEN PORCEED 
            // IF FAILED ATTEMTP IS LESS THAN2 PROCEED IF SUCCESSFULLY THEN DELETE KEY 


            let faildAttempt = await AuthRepo.getRedisLoginAttempt(email)
            let isLocked = await AuthRepo.getLocked(email)

            if (isLocked) {
                await AuthRepo.deleteAttempts(email)
                callback(JSON.stringify(new ResponseData(false, "Your Account has reached the maximum number of faild login attempts and has been locked temporarily", [])))
            }
            if (faildAttempt) {
                if (Number(faildAttempt) >= 2) {
                    await AuthRepo.setLocked(email, 30)
                }
                count = Number(faildAttempt) + 1
                if (count >= 3) {
                    callback(JSON.stringify(new ResponseData(false, "Your Account has reached the maximum number of faild login attempts and has been locked temporarily", [])))

                }
            }

            const validate = await AuthValidation.validateAuth(data);
            if (!validate.valid) {
                callback(JSON.stringify(new ValidationException(validate.error)));
            }

            //##check email & password then check type == driver 
            const hasedPassword = await AuthRepo.hashPassword(data.password)
            const query: { text: string, values: any } = {
                text: `SELECT "Employees".name,
                              "EmployeePrivileges"."privileges",
                              "Employees".name,"Employees".id,
                              "Employees"."companyId",
                              "Employees"."companyGroupId",
                              "Employees"."dashBoardOptions",
                              "Employees"."resetPasswordDate",
                              "Companies".country,
                              "Media".id as "mediaId",
                              "Media".url as "mediaUrl"
                               FROM "Employees" 
                      INNER JOIN "CompanyEmployees" ON "CompanyEmployees"."employeeId" = "Employees".id and "CompanyEmployees".type = 'Driver'
                      LEFT JOIN "EmployeePrivileges"
                      on "EmployeePrivileges".id = "Employees"."privilegeId"
                      LEFT JOIN "Companies" 
                      on "Companies".id = "Employees"."companyId"
                      LEFT join "Media" on "Media".id = "Employees"."mediaId"
                      WHERE LOWER(email)=LOWER($1) AND password=$2`,
                values: [email, hasedPassword]
            }
            const isEmployeeExist = await DB.excu.query(query.text, query.values);
            if (isEmployeeExist.rows.length > 0) {

                const companyId = (<any>isEmployeeExist.rows[0]).companyId;
                const employeeId = (<any>isEmployeeExist.rows[0]).id
                const country = (<any>isEmployeeExist.rows[0]).country

                const data = { employeeId: employeeId }
                const tokens = await CompanyRepo.getToken(data)

                await this.saveEmployeeShift(data)

                if (tokens && employeeId) {
                    await AuthRepo.deleteAttempts(email)
                    // await this.setToken("loggedInToken" + email, tokens.accessToken)
                    client.data.accessToken = tokens.accessToken
                    callback(JSON.stringify(new ResponseData(true, "", { refreshToken: tokens.refreshToken, accessToken: tokens.accessToken, employee: isEmployeeExist.rows[0] })))

                } else {
                    await AuthRepo.setRedisLoginAttempt(email, count)
                    callback(JSON.stringify(new ResponseData(false, "Wrong Email Or Password", [])))
                }
            } else {
                await AuthRepo.setRedisLoginAttempt(email, count)
                callback(JSON.stringify(new ResponseData(false, "Wrong Email Or Password", [])))
            }
        } catch (error: any) {

            // await this.setRedisLoginAttempt(email,count)
            console.log(error)


            callback(JSON.stringify(new ResponseData(false, error, [])));
        }


    }
    public static async login(data: any) {
        const email = data.email.trim()
        let count = 0;
        try {

            //CHECK IF EXCEEDED FAIL ATTEMPT => IF FAILD ATTEMPT IS GREATED IS 3 THEN RETIRN IF NO KEY THEN PORCEED 
            // IF FAILED ATTEMTP IS LESS THAN2 PROCEED IF SUCCESSFULLY THEN DELETE KEY 


            let faildAttempt = await AuthRepo.getRedisLoginAttempt(email)
            let isLocked = await AuthRepo.getLocked(email)

            if (isLocked) {
                await AuthRepo.deleteAttempts(email)
                return new ResponseData(false, "Your Account has reached the maximum number of faild login attempts and has been locked temporarily", [])
            }
            if (faildAttempt) {
                if (Number(faildAttempt) >= 2) {
                    await AuthRepo.setLocked(email, 30)
                }
                count = Number(faildAttempt) + 1
                if (count >= 3) {
                    return new ResponseData(false, "Your Account has reached the maximum number of faild login attempts and has been locked temporarily", [])

                }
            }

            const validate = await AuthValidation.validateAuth(data);
            if (!validate.valid) {
                throw new ValidationException(validate.error);
            }

            //##check email & password then check type == driver 
            const hasedPassword = await AuthRepo.hashPassword(data.password)


            const query: { text: string, values: any } = {
                text: `SELECT "Employees".name,
                              "EmployeePrivileges"."privileges",
                              "Employees".name,"Employees".id,
                              "Employees"."companyId",
                              "Employees"."companyGroupId",
                              "Employees"."dashBoardOptions",
                              "Employees"."resetPasswordDate",
                              "Companies".country,
                              "Media".id as "mediaId",
                              "Media".url as "mediaUrl"
                               FROM "Employees" 
                      INNER JOIN "CompanyEmployees" ON "CompanyEmployees"."employeeId" = "Employees".id 
                      LEFT JOIN "EmployeePrivileges"
                      on "EmployeePrivileges".id = "Employees"."privilegeId"
                      LEFT JOIN "Companies" 
                      on "Companies".id = "Employees"."companyId"
                      LEFT join "Media" on "Media".id = "Employees"."mediaId"
                      WHERE LOWER(email)=LOWER($1) AND password=$2
                      
                      UNION ALL
                      
                      SELECT "Employees".name,
                              "EmployeePrivileges"."privileges",
                              "Employees".name,"Employees".id,
                              "Employees"."companyId",
                              "Employees"."companyGroupId",
                              "Employees"."dashBoardOptions",
                              "Employees"."resetPasswordDate",
                              "Companies".country,
                              "Media".id as "mediaId",
                              "Media".url as "mediaUrl"
                               FROM "Employees" 
                      LEFT JOIN "EmployeePrivileges"
                      on "EmployeePrivileges".id = "Employees"."privilegeId"
                      LEFT JOIN "Companies" 
                      on "Companies".id = "Employees"."companyId"
                      LEFT join "Media" on "Media".id = "Employees"."mediaId"
                      WHERE LOWER(email)=LOWER($1) AND password=$2 AND "Employees"."isDriver" = true`,
                values: [email, hasedPassword]
            }
            const isEmployeeExist = await DB.excu.query(query.text, query.values);
            //if employeeExist need to ckeck if it its on shift => oldShift: out, newShift: in
            //update token to has employeeId + employeeShiftId
            if (isEmployeeExist.rows.length > 0) {

                const companyId = (<any>isEmployeeExist.rows[0]).companyId;
                const employeeId = (<any>isEmployeeExist.rows[0]).id
                const country = (<any>isEmployeeExist.rows[0]).country;
                const emplyeeShift = (await this.saveEmployeeShift({ employeeId: employeeId }))
                if( !emplyeeShift.success || !emplyeeShift.data.id){
                    throw new ValidationException("Look likes cannot use this app right now! ")

                }
                let fileStorage = new FileStorage();
                const settings = (await fileStorage.getCompanySettings(country))?.settings

                const data = {
                    employeeId: employeeId, 
                    employeeShiftId: emplyeeShift.data.id, 
                    companyId: companyId,
                    company: {
                        id: companyId,
                        country: country,
                        afterDecimal: settings.afterDecimal,
                        timeOffset: settings.timeOffset
                    }
                }

                const tokens = await CompanyRepo.getToken(data)



                if (tokens && employeeId) {
                    await AuthRepo.deleteAttempts(email)
                    // await this.setToken("loggedInToken" + email, tokens.accessToken)
                    return new ResponseData(true, "", { refreshToken: tokens.refreshToken, accessToken: tokens.accessToken, employee: isEmployeeExist.rows[0] })

                } else {
                    await AuthRepo.setRedisLoginAttempt(email, count)
                    return new ResponseData(false, "Wrong Email Or Password", [])
                }
            } else {
                await AuthRepo.setRedisLoginAttempt(email, count)
                return new ResponseData(false, "Wrong Email Or Password", [])
            }
        } catch (error: any) {

            // await this.setRedisLoginAttempt(email,count)
            console.log(error)


            return new ResponseData(false, error, []);
        }


    }

    public static async addEmployeeShift(client: PoolClient, data: any) {
        try {

            const employeeShift = new EmployeeShift();
            employeeShift.ParseJson(data);

            const query: { text: string, values: any } = {
                text: `INSERT INTO "EmployeeShifts"("employeeId", "startShift", "endShift", breaks, location) VALUES ($1, $2, $3, $4, $5)
                RETURNING id;
            `, values: [employeeShift.employeeId,
                employeeShift.startShift,
                employeeShift.endShift,
                JSON.stringify(employeeShift.breaks),
                JSON.stringify(employeeShift.location),
                ]
            }
            const insert: any = (await client.query(query.text, query.values));
            let id = (insert && insert.rows.length > 0) ? (insert.rows[0].id) : null
            employeeShift.id = id

            if (insert && insert.rows.length > 0) {
                return new ResponseData(true, "Added Successfully", employeeShift)
            }
            else {
                return new ResponseData(false, "", {})
            }
        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    public static async editEmployeeShift(client: PoolClient, data: any) {
        try {



            const EmployeeShiftId = await this.checkEmployeeInShift(client, data.employeeId);
            if (!EmployeeShiftId) {
                throw new ValidationException("Employee out of Shift")
            }

            const employeeShift = new EmployeeShift();
            employeeShift.ParseJson(data);
            employeeShift.id = EmployeeShiftId


            const query: { text: string, values: any } = {
                text: `UPDATE "EmployeeShifts"
                    SET "employeeId"=$1, 
            
                        "endShift"=$2, 
                        breaks=$3, 
                        location=$4
                        WHERE id = $5
                    returning *  
                  `,
                values: [employeeShift.employeeId,

                employeeShift.endShift,
                JSON.stringify(employeeShift.breaks),
                JSON.stringify(employeeShift.location),
                employeeShift.id],
            };


            const editEmployeeShift = (await client.query(query.text, query.values));

            if (editEmployeeShift && editEmployeeShift.rows.length > 0) {
                employeeShift.ParseJson(editEmployeeShift.rows[0])
                return new ResponseData(true, "Updated Successfully", employeeShift)
            }
            else {
                return new ResponseData(false, "", {})
            }
        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    public static async saveEmployeeShift(data: any) {
        const client = await DB.excu.client();
        try {
            //check if employee already exist in company 
            await client.query("BEGIN");

            const employeeShift = new EmployeeShift();
            employeeShift.ParseJson(data);

            const EmployeeShiftId = await this.checkEmployeeInShift(client, employeeShift.employeeId)
            if (EmployeeShiftId) { employeeShift.id = EmployeeShiftId }
            let CompanyEmployeeId;

            if (employeeShift.id) {
                //update 
                console.log("edit", employeeShift)
                CompanyEmployeeId = await this.editEmployeeShift(client, employeeShift)

            } else {
                console.log("add", employeeShift)
                CompanyEmployeeId = await this.addEmployeeShift(client, employeeShift)
            }

            await client.query("COMMIT");
            return CompanyEmployeeId

        } catch (error: any) {
            await client.query("ROLLBACK");
            throw new Error(error)
        } finally {
            client.release()
        }


    }











    // public static async getInvoicesList(data: any, company: Company, branchList: []) {

    //     const client = await DB.excu.client();
    //     try {

    //         await client.query("BEGIN")

    //         let searchValue = data.searchTerm ? `'^.*` + Helper.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `.*$'` : null;

    //         const filter = data.filter
    //         const fromDate = filter && filter.fromDate ? `and "Invoices"."invoiceDate"::date >= '${filter.fromDate}'::date ` : ''
    //         const toDate = filter && filter.toDate ? `and "Invoices"."invoiceDate"::date <= '${filter.toDate}'::date ` : ''

    //         let filterQuery = `Where "Branches"."companyId" = $1
    //                             AND (array_length($2::uuid[], 1) IS NULL OR ("Branches".id=any($2::uuid[])))
    //                             AND "Invoices".source = any($3)
    //                             AND "Invoices".status = any($4)
    //                             AND "Invoices".status <>'Pending Payments'
    //                             ${fromDate}
    //                             ${toDate}
    //                             `

    //         if (searchValue) {
    //             filterQuery += `and (LOWER("Customers".name) ~ ${searchValue}
    //                                     OR LOWER("Employees".name) ~ ${searchValue}
    //                                     OR LOWER("Branches".name) ~ ${searchValue}
    //                                     OR LOWER("Invoices"."invoiceNumber") ~ ${searchValue} 
    //                                     OR LOWER("Invoices"."refrenceNumber") ~ ${searchValue} 
    //                                     OR nullif(regexp_replace("invoiceNumber", '[A-Z]*-', ''),'') ~ ${searchValue}
    //                              )`
    //         }

    //         console.log(filterQuery)


    //         let sort = data.sortBy;
    //         let sortValue = !sort ? ' "invoiceDate" desc,   "Invoices"."createdAt":: timestamp:: time ' : '"' + sort.sortValue + '"';
    //         if (sort && sort.sortValue == "invoiceNumber") {
    //             sortValue = ` COALESCE(nullif(regexp_substr(regexp_substr("invoiceNumber", '[_.+=-]\\d*$'), '\\d*$'),''), '0')::int `
    //         }
    //         let sortDirection = !sort ? "DESC" : sort.sortDirection;
    //         let sortTerm = sortValue + " " + sortDirection
    //         let orderByQuery = ` Order by` + sortTerm

    //         let offset = 0;
    //         const limit = ((data.limit == null) ? 15 : data.limit);
    //         let page = data.page ?? 1
    //         if (page != 1) {
    //             offset = (limit * (page - 1))
    //         }

    //         const counterQuery: { text: string, values: any } = {

    //             text: `select count(*)
    //                                     FROM "Invoices"
    //                                     LEFT JOIN "Customers" on  "Customers".id = "Invoices"."customerId"
    //                                     LEFT JOIN "Employees"  on "Employees".id = "Invoices"."employeeId"
    //                                     inner join "Branches"  on "Branches".id = "Invoices"."branchId"
    //                             ${filterQuery}
    //                              `,
    //             values: [company.id, branches, sources, status]
    //         }
    //         const counter = await client.query(counterQuery.text, counterQuery.values)


    //         const query: { text: string, values: any } = {

    //             text: `select
    //                                     "Invoices".id ,
    //                                     "customerContact",
    //                                     "Invoices"."invoiceDate",
    //                                     "invoiceNumber",
    //                                     "Invoices"."refrenceNumber",
    //                                     "Invoices".source,
    //                                     "Invoices"."branchId",
    //                                     "Invoices"."total",
    //                                     "Invoices".status,
    //                                     "Invoices"."onlineData",
    //                                     "Invoices"."estimateId",
    //                                     "Invoices"."mergeWith",
    //                                     "Customers".name as "customerName",
    //                                     "Employees".name as "employeeName",
    //                                     "Branches".name as "branchName",
    //                                     "Invoices"."createdAt":: timestamp:: time as "time",
    //                                     "Invoices"."createdAt"::timestamp ,
    //                                     "Invoices"."paymentTerm",
    //                                     "Invoices"."dueDate",
    //                                     "Invoices"."onlineActionTime"
    //                                     FROM "Invoices"
    //                                     LEFT JOIN "Customers" on  "Customers".id = "Invoices"."customerId"
    //                                     LEFT JOIN "Employees"  on "Employees".id = "Invoices"."employeeId"
    //                                     inner join "Branches"  on "Branches".id = "Invoices"."branchId"
    //                             ${filterQuery}
    //                             ${orderByQuery}
    //                             limit $5 offset $6 `,
    //             values: [company.id, branches, sources, status, limit, offset]
    //         }
    //         const selectList = await client.query(query.text, query.values)




    //         const list: InvoiceMini[] = []
    //         for (let index = 0; index < selectList.rows.length; index++) {
    //             const element = selectList.rows[index];
    //             const invoice = new InvoiceMini()
    //             invoice.ParseJson(element)
    //             //invoice.invoiceStatus()
    //             list.push(getValuable(invoice))
    //         }


    //         let count = counter.rows && counter.rows.length > 0 ? Number((<any>counter.rows[0]).count) : 0
    //         let pageCount = Math.ceil(count / data.limit)
    //         offset += 1;
    //         let lastIndex = ((page) * limit)
    //         if (selectList.rows.length < limit || page == pageCount) {
    //             lastIndex = count
    //         }

    //         const resData = {
    //             list: list,
    //             count: count,
    //             pageCount: pageCount,
    //             startIndex: offset,
    //             lastIndex: lastIndex
    //         }



    //         await client.query("COMMIT")
    //         return new ResponseData(true, "", resData)
    //     } catch (error: any) {
    //         await client.query("ROLLBACK")

    //         throw new Error(error)
    //     } finally {
    //         client.release()
    //     }
    // }





    //     driver : id , emplyeeId, status(optional),  startShift, endShift, location
    // --> login 
    // INSERT INTO "Drivers" ("employeeId", " status", "startShiftAt","endShiftAt"(null),"location") VALUES($1,$2,$3,$4,$5) RETURNING id
    // --> logout
    // UPDATE "Driver" SET "endShiftAt"=$1, "location" =$2  WHERE id =$3
    // --> change  status {available, busy, not available, }
    // UPDATE "Driver" SET "status"=$1 WHERE id =$3

    // --- orders 
    // 		-- 	 invoice info ?????????? {id, invoiceNumber, total, deliveryCharge, status, 
    // 		-- 							  customerAddress, customerContact, customerLatLang, 
    // 		-- 							 claimTime, deliveryTime, departureTime, schedualTime }
    // 	with "branches" as(
    // 		select jsonb_array_elements("branches")->> 'id' as "branchId"
    // 		from "CompanyEmployees" 
    // 		where "employeeId" = '2d1c8b1f-134c-40c5-b84e-39ec45953951' and type = 'Driver' and ("CompanyEmployees"."inventionEndAt" is null or "CompanyEmployees"."inventionEndAt" < now())
    // 	)
    // 	select * 
    // 	from "Invoices"
    // 	inner join "branches" on "branches"."branchId"::uuid = "Invoices"."branchId" and "driverId" is null
    // 	inner join "Services" on "Services".id = "Invoices"."serviceId" and "Services".type = 'Delivery'


    // -- set claim time 
    // UPDATE "Invoices" SET "driverId"=$1, "claimTime" =$2  WHERE id =$3
    // 	-- duration ???????? 
    // 	UPDATE "Invoices" SET "driverId"=null, "claimTime" =null  WHERE id =$3

    // -- claimed orders
    // select * 
    // 	from "Invoices"
    // where "departureTime" is  null  and  "driverId" = '2d1c8b1f-134c-40c5-b84e-39ec45953951'

    // --set departureTime after scan 
    // UPDATE "Invoices" SET  "departureTime" =$2  WHERE id =$3

    // -- claimed orders
    // select * 
    // 	from "Invoices"
    // where "departureTime" is not null and "arrivalTime" is  null  and  "driverId" = '2d1c8b1f-134c-40c5-b84e-39ec45953951'

    // --set arrivaltime after delivered
    // UPDATE "Invoices" SET  "arrivalTime" =$2  WHERE id =$3






}



















