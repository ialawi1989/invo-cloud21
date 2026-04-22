import { DB } from "../../dbconnection/dbconnection";
import { Employee } from "@src/models/admin/employee";
import { ResponseData } from "@src/models/ResponseData";
import { PoolClient } from "pg";
import { FileStorage } from "@src/utilts/fileStorage";



import { ValidationException } from "@src/utilts/Exception";
import { BranchesRepo } from "./branches.repo";
import { Helper } from "@src/utilts/helper";

import { Company } from "@src/models/admin/company";

import { EmployeeRepo } from "./employee.repo";
import { CompanyRepo } from "./company.repo";

export class companyEmployeeRepo {

    public static async checkEmployeeInventionTime(client: PoolClient, employeeId: string, companyId: string) {

        let currentDate = new Date()
        const query: { text: string, values: any } = {
            text: `SELECT id FROM "CompanyEmployees" where "employeeId"=  $1::uuid and "companyId" = $2 and ("inventionEndAt" is null or "inventionEndAt" >= $3::timestamp)`,
            values: [
                employeeId,
                companyId,
                currentDate
            ],
        };


        const resault = await client.query(query.text, query.values);
        return { id: (resault.rows && resault.rows.length > 0) ? (<any>resault.rows[0]).id : null };

    }

    public static async getEmployeeByEmail(client: PoolClient, email: any, companyId: string) {

        try {



            const query: { text: string, values: any } = {
                text: `SELECT id , name,  "companyId"
            from "Employees"
            where "Employees"."email" ilike  $1
            `,
                values: [email]
            }
            const employee = await client.query(query.text, query.values);
            if (employee.rows && employee.rows.length > 0) {

                if (employee.rows[0].companyId == companyId) {
                    return new ResponseData(false, "Employee already work in this company", { error: 2 })
                }

                const t = await companyEmployeeRepo.checkEmployeeInventionTime(client, employee.rows[0].id ?? null, companyId)
                if (t.id) {
                    return new ResponseData(false, "Employee already work in this company", {
                        error: 2, alreadyInvited: true

                    })
                }



                return new ResponseData(true, "", { employeeId: employee.rows[0].id, employeeName: employee.rows[0].name })
            }
            return new ResponseData(false, "cannot Invite User.. Email Address not recognised", { error: 1, canBeAdded: true })
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    public static async checkEmployeeExistInCompany(client: PoolClient, employeeId: string, companyId: string) {
        const query: { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "CompanyEmployees" where "employeeId"=  $1 and "companyId" = $2`,
            values: [employeeId, companyId,],
        };

        const resault = await client.query(query.text, query.values);

        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }
        return false;
    }

    public static async checkEmployeeExist(client: PoolClient, employeeId: string) {
        const query: { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "CompanyEmployees" where "employeeId"=  $1 `,
            values: [employeeId],
        };

        const resault = await client.query(query.text, query.values);

        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }
        return false;
    }

    public static async addCompanyEmployee(client: PoolClient, data: any, companyId: string) {
        try {

            //need validation
            //   const validate = await EmployeeValidation.EmployeeValidation(data);
            //   if (!validate.valid) {
            //     throw new ValidationException(validate.error)
            //   }

            //check if employee already exist in company 

            const isEmployeeAlreadyExistInCompany = await this.checkEmployeeExistInCompany(client, data.id, companyId);
            if (isEmployeeAlreadyExistInCompany) {
                throw new ValidationException("Employee is Already Exist")
            }
            const employee = new Employee();
            employee.ParseJson(data);
            employee.createdAt = new Date()
            employee.updatedDate = new Date();
            employee.inventionStartAt = new Date();




            const isEmployeeAlreadyExist = await this.checkEmployeeExist(client, data.id);
            if (!isEmployeeAlreadyExist) {
                employee.default = true
            }

            const query: { text: string, values: any } = {
                text: `INSERT INTO "CompanyEmployees" ("employeeId", "companyId", type, "user", "superAdmin", "createdAt", "isDriver", "privilegeId", admin, "mediaId",  "dashBoardOptions", branches, "inventionStartAt", "inventionEndAt", "default")
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING id;
            `, values: [employee.id,
                employee.companyId,
                employee.type,
                employee.user,
                employee.superAdmin,
                employee.createdAt,
                employee.isDriver,
                employee.privilegeId,
                employee.admin,
                employee.mediaId,
                employee.dashBoardOptions,
                JSON.stringify(employee.branches),
                employee.inventionStartAt,
                employee.inventionEndAt,
                employee.default
                ]
            }
            const employeeInsert: any = (await client.query(query.text, query.values));
            //let id = (employeeInsert && employeeInsert.rows.length > 0) ? (employeeInsert.rows[0].id) :null

            if (employeeInsert && employeeInsert.rows.length > 0) {
                return new ResponseData(true, "Added Successfully", employeeInsert.rows)
            }
            else {
                return new ResponseData(false, "", {})
            }

        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async editCompanyEmployee(client: PoolClient, data: any, companyId: string) {
        try {

            const employee = new Employee();
            employee.ParseJson(data);
            employee.companyId = companyId;
            // cheack if employeeId 
            employee.updatedDate = new Date();

            const query: { text: string, values: any } = {
                text: `UPDATE "CompanyEmployees" SET type = $1,
                                            "privilegeId" = $2,
                                            "mediaId"=$3,
                                            "branches"=$4 ,
                                            "isDriver" = $5,
                                            "updatedDate"=$6,
                                            "inventionStartAt" = $7,
                                            "inventionEndAt" = $8
                                            WHERE "employeeId"=($9) and "companyId"=$10
                                            returning *  
            `,
                values: [employee.type, employee.privilegeId, employee.mediaId, JSON.stringify(employee.branches), employee.isDriver, employee.updatedDate, employee.inventionStartAt, employee.inventionEndAt, employee.id, companyId],
            };


            const editEmployee = (await client.query(query.text, query.values));


            //   if (employee.user) {
            //     await SocketEmployee.sendUpdatedEmployee(client, employee.id)
            //   }
            if (editEmployee && editEmployee.rows.length > 0) {
                return new ResponseData(true, "Updated Successfully", editEmployee)
            }
            else {
                return new ResponseData(false, "", {})
            }

        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async saveEmployeeCompany(client: PoolClient, data: any, companyId: string) {

        try {
            //check if employee already exist in company 
            const employee = new Employee();
            employee.ParseJson(data);
            employee.companyId = companyId

            employee.id = employee.id ?? (await this.getEmployeeByEmail(client, employee.email, companyId)).data.employeeId

            const isEmployeeAlreadyExist = await this.checkEmployeeExistInCompany(client, employee.id, employee.companyId)
            let CompanyEmployeeId

            if (isEmployeeAlreadyExist) {
                //update 
                CompanyEmployeeId = await this.editCompanyEmployee(client, employee, companyId)
                return CompanyEmployeeId
            } else {
                employee.companyId = companyId;
                CompanyEmployeeId = await this.addCompanyEmployee(client, employee, companyId)
                return CompanyEmployeeId
            }



        } catch (error: any) {
          
            throw new Error(error)
        }

    }

    public static async checkInvitedEmployee(employeeId: string, companyId: string) {
        const query: { text: string, values: any } = {
            text: `SELECT true as "isInvitedUser"
                from "Employees"
                where  "Employees".id = $1 and  "Employees"."companyId" <> $2
                and Exists  (select 1 from "CompanyEmployees" where "employeeId"= $1 and "companyId" = $2 )
                `,
            values: [employeeId, companyId],
        };

        const resault = await DB.excu.query(query.text, query.values);

        if (resault.rows && resault.rows.length > 0 && (<any>resault.rows[0]).isInvitedUser) {
            return true;
        }
        return false;
    }

    public static async getSwitchEmployeeData(employeeId: string, companyId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `
                    SELECT 
                        "Employees".name,
                        "EmployeePrivileges"."privileges",
                        "Employees".id,
                        "Employees"."privilegeId",
                        "Employees"."companyId",
                        "Employees"."companyGroupId",
                        "Employees"."dashBoardOptions",
                        "Employees"."resetPasswordDate",
                        "Companies".country,
                        "Media".id as "mediaId",
                        "Media".url::jsonb as "mediaUrl"
                    FROM "Employees" 
                    LEFT JOIN "EmployeePrivileges"
                        on "EmployeePrivileges".id = "Employees"."privilegeId"
                    LEFT JOIN "Companies" 
                        on "Companies".id = "Employees"."companyId"
                    LEFT join "Media" on "Media".id = "Employees"."mediaId"
                    WHERE "Employees".id = $1 AND  "Employees"."companyId"=$2
                    union 
                    SELECT 
                        "Employees".name,
                        "EmployeePrivileges"."privileges",
                        "CompanyEmployees"."employeeId" as id,
                        "CompanyEmployees" ."privilegeId",
                        "CompanyEmployees"."companyId",
                        null as "companyGroupId",
                        "CompanyEmployees"."dashBoardOptions",
                        "Employees"."resetPasswordDate",
                        "Companies".country,
                        "Media".id as "mediaId",
                        "Media".url::jsonb as "mediaUrl"
                    FROM "CompanyEmployees" 
                    inner join "Employees" on "Employees".id =  "CompanyEmployees"."employeeId"
                    LEFT JOIN "EmployeePrivileges"
                        on "EmployeePrivileges".id = "CompanyEmployees"."privilegeId"
                    LEFT JOIN "Companies" 
                        on "Companies".id = "CompanyEmployees"."companyId"
                    LEFT join "Media" on "Media".id = "CompanyEmployees"."mediaId"
                    WHERE "CompanyEmployees"."employeeId" = $1 AND  "CompanyEmployees"."companyId"=$2
                      `,
                values: [employeeId, companyId]
            }
            const employee = await DB.excu.query(query.text, query.values);


            if (employee && employee.rows.length > 0) {
                return new ResponseData(true, "", employee.rows)
            }
            else {
                return new ResponseData(true, "", {})
            }




        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }


    public static async checkCompanyEmployeeIdExist(id: string, companyId: string) {
        const query: { text: string, values: any } = {
            text: `SELECT count(*) as qty FROM "CompanyEmployees" where  id = $1 and "companyId" = $2 `,
            values: [
                id,
                companyId,

            ],
        };
        const resault = await DB.excu.query(query.text, query.values);
        if ((<any>resault.rows[0]).qty > 0) {
            return true;
        }
        return false;
    }





    public static async getCompanyEmployeeList(data: any, company: Company) {

        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")

            const companyId = company.id;

            //############## filter ##############
            let filterQuery = ``
            let searchValue = data.searchTerm ? `%` + Helper.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `%` : null;
            if (searchValue) {
                filterQuery += `and (LOWER("Employees".name) ilike '${searchValue}'
                                        OR LOWER("Employees".email) ilike '${searchValue}'   
                                )`
            }

            //############## Sort ##############
            let sort = data.sortBy;
            let sortValue = !sort ? ' "createdAt":: timestamp:: time ' : '"' + sort.sortValue + '"';

            if (data.employeeId != null && data.employeeId != "") {
                sortValue = ` (id = ` + "'" + data.employeeId + "'" + ` )`
            }
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by` + sortTerm

            //############## limit ##############
            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            let page = data.page ?? 1
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            //############## Counter ##############

            const counterQuery: { text: string, values: any } = {
                text: `select count(*)
                        FROM (
                        select "CompanyEmployees" .id  from "CompanyEmployees" 
                        inner join "Employees"  on "Employees".id = "CompanyEmployees"."employeeId" and "Employees"."companyId"<> "CompanyEmployees"."companyId"
                        where "CompanyEmployees"."companyId" = $1
                        ${filterQuery}
                        union 
                         select id  from "Employees" Where "companyId" = $1
                      ${filterQuery}
                        )t`,
                values: [companyId]
            }
            const counter = await client.query(counterQuery.text, counterQuery.values)

            //############## Select ##############


            const query: { text: string, values: any } = {
                text: `select * from (
                    SELECT "Employees".id,
                    "Employees".name,
                    "Employees".email,
                    "CompanyEmployees".admin,
                    "CompanyEmployees"."user",
                    "CompanyEmployees"."superAdmin",
                    "CompanyEmployees"."createdAt",
                    case when "CompanyEmployees"."inventionStartAt" is not null then true else false end as "isInvitedUser",
                    "Media".url::jsonb
                    FROM "CompanyEmployees"
                    INNER JOIN "Employees"  on "Employees".id = "CompanyEmployees"."employeeId"  and "Employees"."companyId"<> "CompanyEmployees"."companyId"
                    LEFT JOIN "Media" on "Employees"."mediaId" = "Media".id
                    Where "CompanyEmployees"."companyId" = $1
                     ${filterQuery}

                    union  
                        
                    SELECT 
                    "Employees".id,
                    "Employees".name,
                    "Employees".email,
                    "Employees".admin,
                    "Employees"."user",
                    "Employees"."superAdmin",
                     "Employees"."createdAt",
                    case when "Employees"."inventionStartAt" is not null then true else false end as "isInvitedUser",
                    "Media".url::jsonb
                    FROM "Employees"
                    LEFT JOIN "Media" on "Employees"."mediaId" = "Media".id
                     where "Employees"."companyId" = $1
                      ${filterQuery}
                    )t 
                               
                                ${orderByQuery}
                                limit $2 offset $3 `,
                values: [companyId, limit, offset]
            }


            const selectList = await client.query(query.text, query.values)


            let count = counter.rows && counter.rows.length > 0 ? Number((<any>counter.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            const list: any[] = [];

            selectList.rows.forEach((element: any) => {
                if (element.url) { element.avatar = element.url.defaultUrl; }
                list.push(element);
            });

            const resData = {
                list: list,
                count: count,
                pageCount: pageCount,
                startIndex: offset,
                lastIndex: lastIndex
            }

            await client.query("COMMIT")
            return new ResponseData(true, "", resData)
        } catch (error: any) {
            await client.query("ROLLBACK")

            throw new Error(error)
        } finally {
            client.release()
        }
    }

    public static async getEmployeeCompany(client: PoolClient, employeeId: string, companyId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `select type ,
                    "user" ,
                    admin,
                    "privilegeId",
                    "mediaId",
                    "branches" ,
                    "inventionStartAt" ,
                    "inventionEndAt" 
                    from "CompanyEmployees"
                    WHERE "employeeId"=($1) and "companyId"=$2                            
            `,
                values: [employeeId, companyId],
            };


            const employee = (await client.query(query.text, query.values));

            if (employee && employee.rows.length > 0) {
                return new ResponseData(true, "", employee)
            }
            else {
                return new ResponseData(false, "", {})
            }




        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }

    public static async getCompanyGroupEmployees(client: PoolClient, data: any, employeeId: string, company: Company) {
        try {


            const isEmployeeSupperAdmin = await EmployeeRepo.isEmployeeSupperAdmin(employeeId, company.id)
            if (isEmployeeSupperAdmin != true) {
                throw new ValidationException("only super admin has access on this Data")
            }

            const companyGroupId = (await CompanyRepo.getCompanyGroupId(company.id)).data.id

            if (!companyGroupId) {
                throw new ValidationException("companyGroupId is not available")
            }

            const companyId = company.id;

            //############## filter ##############
            let filterQuery = `where companies."companyGroupId" =  "Companies"."companyGroupId" 
                        
                               `
            let searchValue = data.searchTerm ? `'^.*` + Helper.escapeSQLString(data.searchTerm.toLowerCase().trim()) + `.*$'` : null;
            if (searchValue) {
                filterQuery += `and (LOWER("Employees".name) ilike ${searchValue}
                                        OR LOWER("Employees".email) ilike ${searchValue}    
                                )`
            }


            //############## Sort ##############
            let sort = data.sortBy;
            let sortValue = !sort ? ' "Employees"."createdAt":: timestamp:: time ' : '"' + sort.sortValue + '"';
            let sortDirection = !sort ? "DESC" : sort.sortDirection;
            let sortTerm = sortValue + " " + sortDirection
            let orderByQuery = ` Order by` + sortTerm
            // let filterCompanyId = data.filter && data.filter.companyId ?  data.filter.companyId:null
            //############## limit ##############
            let offset = 0;
            const limit = ((data.limit == null) ? 15 : data.limit);
            let page = data.page ?? 1
            if (page != 1) {
                offset = (limit * (page - 1))
            }

            //############## Counter ##############

            const counterQuery: { text: string, values: any } = {
                text: `select count(*)
                        from "Employees"
                    inner join "CompanyEmployees" ON "CompanyEmployees"."employeeId" = "Employees".id
                    inner join "Companies" on "Companies".id = "CompanyEmployees"."companyId"
                    cross JOIN LATERAL  (select  * FROM "Companies"  where "companyGroupId" = $1) companies
                    ${filterQuery}
                    group by  "Employees".id 
                     
                        `,
                values: [companyGroupId]
            }
            const counter = await client.query(counterQuery.text, counterQuery.values)

            //############## Select ##############


            const query: { text: string, values: any } = {
                text: `with companies as (
                        select  * FROM "Companies"  where "companyGroupId" = $1
                    )

                    select "Employees".id, "Employees".name, 
                    jsonb_agg(jsonb_build_object('companyId',companies.id, 'companyName', companies.name, 'available',("CompanyEmployees"."companyId"= companies.id and ("CompanyEmployees"."inventionEndAt" is null or "CompanyEmployees"."inventionEndAt"  > CURRENT_TIMESTAMP ) or "Employees"."superAdmin"  ) )) as "companyList"
                    from "Employees"
                    inner join "CompanyEmployees" ON "CompanyEmployees"."employeeId" = "Employees".id
                    inner join "Companies" on "Companies".id = "CompanyEmployees"."companyId"
                    cross JOIN LATERAL  (select  * FROM "Companies"  where "companyGroupId" = $1) companies
                    ${filterQuery}

                    group by  "Employees".id 
                    ${orderByQuery}
                    limit $2 offset $3 `,
                values: [companyGroupId, limit, offset]
            }
            const selectList = await client.query(query.text, query.values)


            let count = counter.rows && counter.rows.length > 0 ? Number((<any>counter.rows[0]).count) : 0
            let pageCount = Math.ceil(count / data.limit)
            offset += 1;
            let lastIndex = ((page) * limit)
            if (selectList.rows.length < limit || page == pageCount) {
                lastIndex = count
            }

            // const list: any[] = [];

            // selectList.rows.forEach((element: any) => {
            //     if (element.url) { element.avatar = element.url.defaultUrl;}
            //     list.push(element);
            // });

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

    public static async getCompanyEmployeeId(client: PoolClient, employeeId: string | null, companyId: string) {
        try {

            const query: { text: string, values: any } = {
                text: `SELECT id 
            from "CompanyEmployees"
            where "CompanyEmployees"."employeeId"=$1
            AND "CompanyEmployees"."companyId"=$2`,
                values: [employeeId, companyId]
            }
            const branchProduct = await client.query(query.text, query.values);
            return branchProduct.rows[0].id
        } catch (error: any) {
          
            throw new Error(error)
        }
    }

    public static async getEmployeeById(employeeId: any, companyId: string) {
        try {


            const query: { text: string, values: any } = {
                text: `SELECT "Employees".id,
                        "Employees".name,
                        "Employees".email,
                        "CompanyEmployees".admin,
                        "CompanyEmployees"."user",
                        "CompanyEmployees"."superAdmin",
                        "CompanyEmployees"."branches",
                        "CompanyEmployees"."mediaId",
                        "CompanyEmployees"."privilegeId",
                        "CompanyEmployees"."dashBoardOptions",
                        "Media".url as "mediaUrl"
                        FROM "CompanyEmployees"
                        LEFT JOIN "Employees" on  "CompanyEmployees"."employeeId" = "Employees".id
						LEFT JOIN "Media" on "Media".id = "Employees"."mediaId"
                        WHERE "CompanyEmployees"."employeeId"=($1) AND "CompanyEmployees"."companyId"=($2) `,
                values: [employeeId, companyId],
            };
            const emp: any = (await DB.excu.query(query.text, query.values)).rows;
            const employee = new Employee();
            employee.ParseJson(emp[0])

            return new ResponseData(true, "", employee)

        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }

    public static async getPosEmployees(branchId: string, date: any | null = null) {
        const client = await DB.excu.client();
        try {
            await client.query("BEGIN")
            const companyId = (await BranchesRepo.getBranchCompanyId(client, branchId)).compayId;

            const query: { text: string, values: any } = {
                text: `SELECT "Employees".id,
            "Employees".name,
            "Employees"."passCode",
            "CompanyEmployees"."companyId",
            "CompanyEmployees"."privilegeId",
            "Employees"."MSR",
                (SELECT
                    json_agg(json_build_object('id',"Employees".id,
                                            'price',price,
                                            'serviceTime', "serviceTime")
                            ) FROM "EmployeePrices"
                            WHERE "Employees".id = "EmployeePrices"."employeeId") AS EmployeePrices
                            From "CompanyEmployees"
                            inner join "Employees".id = "CompanyEmployees"."employeeId" 
                            cross JOIN LATERAL JSONB_ARRAY_ELEMENTS(" "CompanyEmployees""."branches") AS "branches"(branch)
                            left JOIN "Branches"  ON ("branches".branch->>'id')::uuid  = "Branches".id  
                                        WHERE ("passCode" IS NOT NULL )
                                        AND  "CompanyEmployees"."user" = $1
                                        AND "CompanyEmployees"."companyId" =$2
                                        AND ("Branches".id =$3 or  "CompanyEmployees"."superAdmin" = true)`,
                values: [true, companyId, branchId]
            }

            if (date != null) {
                query.text = `SELECT  "Employees".id,
                                "Employees".name,
                                "Employees"."passCode",
                                "CompanyEmployees"."companyId", 
                                "CompanyEmployees"."privilegeId",
                                "Employees"."MSR",
                                        (SELECT
                                            json_agg(json_build_object('id',id,
                                                                    'price',price,
                                                                    'serviceTime', "serviceTime")
                                                    ) FROM "EmployeePrices"
                                                    WHERE "Employees".id = "EmployeePrices"."employeeId") AS EmployeePrices
                                        From  "CompanyEmployees"
                                        inner join "Employees".id = "CompanyEmployees"."employeeId"
                                        cross JOIN LATERAL JSONB_ARRAY_ELEMENTS("CompanyEmployees"."branches") AS "branches"(branch)
                                        left JOIN "Branches"  ON ("branches".branch->>'id')::uuid  = "Branches".id  
                                        WHERE ("passCode" IS NOT NULL )
                                        AND "CompanyEmployees"."user" = $1
                                        AND "CompanyEmployees"."companyId" =$2
                                        AND ("Branches".id =$3 or "CompanyEmployees"."superAdmin" = true)
                                        AND ("CompanyEmployees" ."updatedDate" >= $4 or "CompanyEmployees"."createdAt" >=$4)
                                        `
                query.values = [true, companyId, branchId, date]
            }

            const employees: any = await DB.excu.query(query.text, query.values)


            for (let index = 0; index < employees.rows.length; index++) {
                const element: any = employees.rows[index];
                const storage = new FileStorage();
                const image = await storage.getEmployeeImageBase64(element.companyId, element.id)
                employees.rows[index].defaultImage = image

            }

            //TODO: IMAGE IF EMPTY STRING THEN NULL 
            await client.query("COMMIT")
            return new ResponseData(true, "", employees.rows)

        } catch (error: any) {
            await client.query("ROLLBACK")
          
            return new ResponseData(true, error, [])
        } finally {
            client.release()
        }
    }

    public static async getCompanyList(employeeId: string, company: any) {
        try {


            let query: { text: string, values: any }
            const isEmployeeSupperAdmin = await EmployeeRepo.isEmployeeSupperAdmin(employeeId, company.id)
            if (isEmployeeSupperAdmin == true) {
                query = {
                    text: `SELECT "Companies"."name",
                              "Companies".id,
                              "Media".url::jsonb  as "mediaUrl"
                            FROM "Companies"
                            LEFT JOIN "Media" On "Media".id = "Companies"."mediaId"
                            INNER JOIN "Employees" on   "Employees"."companyId"=  "Companies".id 
                            where "Employees".id =$1
                            union
                            SELECT "Companies"."name",
                              "Companies".id,
                              "Media".url::jsonb as "mediaUrl"
                         FROM "Companies"
                         inner join "CompanyEmployees" ON "CompanyEmployees"."companyId"= "Companies".id 
                         LEFT JOIN "Media" On "Media".id = "Companies"."mediaId"
                         where "CompanyEmployees"."employeeId"= $1
                                and ("CompanyEmployees"."inventionEndAt" is null or "CompanyEmployees"."inventionEndAt"  >$2::timestamp )
                                 and ("CompanyEmployees"."inventionStartAt" is null or "CompanyEmployees"."inventionStartAt"  <=$2::timestamp )
                            `,
                    values: [employeeId, new Date()],
                }
            }
            else {
                query = {

                    text: `SELECT "Companies"."name",
                              "Companies".id,
                              "Media".url::jsonb as "mediaUrl"
                         FROM "Companies"
                         inner join "CompanyEmployees" ON "CompanyEmployees"."companyId"= "Companies".id 
                         LEFT JOIN "Media" On "Media".id = "Companies"."mediaId"
                         where "CompanyEmployees"."employeeId"= $1 
                                and ("CompanyEmployees"."inventionEndAt" is null or "CompanyEmployees"."inventionEndAt" > $2::timestamp )
                        union 
                        SELECT "Companies"."name",
                              "Companies".id,
                              "Media".url::jsonb as "mediaUrl"
                         FROM "Companies"
                         inner join "Employees" ON "Employees"."companyId"= "Companies".id 
                         LEFT JOIN "Media" On "Media".id = "Companies"."mediaId"
                         where "Employees"."id"= $1 
                                and ("Employees"."inventionEndAt" is null or "Employees"."inventionEndAt"  > $2::timestamp )
                         `,

                    // text: `SELECT "Companies"."name",
                    //           "Companies".id,
                    //           "Media".url as "mediaUrl"
                    //      FROM "Companies"
                    //      inner join "CompanyEmployees" ON "CompanyEmployees"."companyId"= "Companies".id 
                    //      LEFT JOIN "Media" On "Media".id = "Companies"."mediaId"
                    //      where "CompanyEmployees"."employeeId"= $1 
                    //             and ("CompanyEmployees"."inventionEndAt" is null or "CompanyEmployees"."inventionEndAt"  < $2::timestamp )
                    //      `,
                    values: [employeeId, new Date()],
                }

            }


            const companies = await DB.excu.query(query.text, query.values)

            return new ResponseData(true, "", companies.rows)

        } catch (error: any) {
          
            throw new Error(error.message)
        }
    }









    ///check socket
    public static async getPosEmployeeById(client: PoolClient, employeeId: string, companyId: string) {
        try {
            const query: { text: string, values: any } = {
                text: `SELECT "Employees".id,
        "Employees".name,
        "Employees"."passCode",
        "CompanyEmployees"."companyId",
        "CompanyEmployees"."privilegeId",
        "Employees"."MSR",
       "CompanyEmployees"."branches"
        from "CompanyEmployees""Employees"
         inner join "Employees".id = "CompanyEmployees"."employeeId"
                                    WHERE "passCode" IS NOT NULL 
                                    AND "CompanyEmployees"."user" = $1 
                                    AND "Employees".id = $2
                                    AND "CompanyEmployees"."companyId" = $3`,
                values: [true, employeeId, companyId]


            }

            let employee = await client.query(query.text, query.values);

            return employee.rows[0]
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async getEmployeePrices(branchId: string, date: any | null = null) {
        try {

            const query: { text: string, values: any } = {
                text: `select 
        "employeeId",
        "EmployeePrices".id,
        price,
        "productId",
        "serviceTime"
        FROM "EmployeePrices"
        Inner JOIN  "Employees" ON "Employees".id = "EmployeePrices"."employeeId"
        WHERE "Employees"."branchId" = $1 `,
                values: [branchId]
            }

            if (date != null && date != "") {

                query.text = `select 
      "employeeId",
      "EmployeePrices".id,
      price,
      "productId",
      "serviceTime",
      "EmployeePrivileges".privileges
      FROM "EmployeePrices"
      Inner JOIN  "Employees" ON "Employees".id = "EmployeePrices"."employeeId"
      LEFT JOIN "EmployeePrivileges" on "EmployeePrivileges".id ="Employees"."privilegeId" 
      WHERE "Employees"."branchId" = $1 and "EmployeePrices"."updatedDate">$2`
                query.values = [branchId, date]
            }


            const employeePrices = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", employeePrices.rows)
        } catch (error: any) {
          

            throw new Error(error.message)
        }
    }





}