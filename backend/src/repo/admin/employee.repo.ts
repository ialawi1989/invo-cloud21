import { DB } from "../../dbconnection/dbconnection";
import { Employee } from "@src/models/admin/employee";
import { EmployeeValidation } from "@src/validationSchema/admin/employee.Schema";
import { ResponseData } from "@src/models/ResponseData";
import { PoolClient } from "pg";
import { FileStorage } from "@src/utilts/fileStorage";
import { SocketEmployee } from "../socket/employee.socket";


import { HashingALgorithm } from "@src/utilts/hashing";
import { env } from "process";
import { AuthRepo } from "../app/auth.repo";
import { ValidationException } from "@src/utilts/Exception";
import { BranchesRepo } from "./branches.repo";
import { Helper } from "@src/utilts/helper";
import { SnsService } from "@src/utilts/SNS";
import { RedisClient } from "@src/redisClient";
import { SesService } from "@src/utilts/SES";
import { AWSLambda } from "@src/utilts/lambda";
import { Company } from "@src/models/admin/company";
import { S3Storage } from "@src/utilts/S3Storage";
import { companyEmployeeRepo } from "./companyEmployees.repo";
import { Extension } from "pkijs";
import { Log } from "@src/models/log";
import { LogsManagmentRepo } from "../app/settings/LogSetting.repo";

export class EmployeeRepo {



  public static async checkEmployEmailExist(client: PoolClient, id: string | null, email: string) {

    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Employees" where id <> $1 and LOWER(email) = LOWER($2)`,
      values: [
        id,
        email,
      ],
    };
    if (id == null) {
      query.text = `SELECT count(*) as qty FROM "Employees" where  LOWER(email) = LOWER($1)`
      query.values = [email]
    }
    const resault = await client.query(query.text, query.values);

    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }








  public static async checkAdminEmailExist(client: PoolClient, id: string | null, email: string) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "admins" where id <> $1 and LOWER(email) = LOWER($2)`,
      values: [
        id,
        email,
      ],
    };
    if (id == null) {
      query.text = `SELECT count(*) as qty FROM "admins" where  LOWER(email) = LOWER($1)`
      query.values = [email]
    }
    const resault = await client.query(query.text, query.values);

    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }







  public static async checkIfEmployeePassCodeExist(client: PoolClient, id: string | null, passCode: string, companyId: string) {
    try {

      passCode = await AuthRepo.hashPassword(passCode)
      const query: { text: string, values: any } = {
        text: `SELECT count(*) as qty FROM "Employees" where id <> $1 and "passCode" = LOWER($2) and "companyId"=$3`,
        values: [
          id,
          passCode,
          companyId
        ],
      };
      if (id == null) {
        query.text = `SELECT count(*) as qty FROM "Employees" where  "passCode" = $1  and "companyId"=$2`
        query.values = [passCode, companyId]
      }

      const resault = await client.query(query.text, query.values);

      if ((<any>resault.rows[0]).qty > 0) {
        return true;
      }
      return false;
    } catch (error: any) {
    

      throw new Error(error.message)
    }
  }

  public static async isEmployeeSupperAdmin(employeeId: string, companyId: string) {
    try {
      const query = {
        text: `SELECT "superAdmin" FROM "Employees" where id =$1 and "companyId" = $2
              union 
              SELECT "superAdmin" FROM "CompanyEmployees" where "employeeId" =$1 and "companyId" = $2`,
        values: [employeeId, companyId]
      }

      let employee = await DB.excu.query(query.text, query.values);
      return (<any>employee.rows[0]).superAdmin

    } catch (error: any) {
      throw new Error(error)
    }
  }
  public static async InsertEmployee(client: PoolClient, data: any, companyId: string, userId?: string) {
    try {
      const validate = await EmployeeValidation.EmployeeValidation(data);
      if (!validate.valid) {
        throw new ValidationException(validate.error)
      }
      const employee = new Employee();
      employee.ParseJson(data);
      if (employee.email) {
        const isEmailExist = await this.checkEmployEmailExist(client, null, employee.email);
        if (isEmailExist) {
          throw new ValidationException("Employee Email Already Exist")
        }
      }


      const isPassCodeExist = await this.checkIfEmployeePassCodeExist(client, null, employee.passCode, companyId);
      if (isPassCodeExist) {
        throw new ValidationException("Employee passCode Already Exist")
      }

      if (employee.passCode != "" && employee.passCode != null) {
        employee.passCode = await AuthRepo.hashPassword(employee.passCode)
      }

      if (employee.password != "" && employee.password != null) {
        employee.password = await AuthRepo.hashPassword(employee.password)
      }

      if (employee.MSR != "" && employee.MSR != null) {
        employee.MSR = await AuthRepo.hashPassword(employee.MSR)
      }

      employee.updatedDate = new Date();

      const query: { text: string, values: any } = {
        text: `INSERT INTO "Employees"(name,
                                            email,
                                            password,
                                            "companyId",
                                            admin,
                                            "user",
                                            "superAdmin",
                                            "companyGroupId",
                                            "branches",
                                            "passCode",
                                            "mediaId",
                                            "privilegeId",
                                            "MSR",
                                            "updatedDate",
                                            "isDriver",
                                             type ,
                                               "inventionStartAt",
                                               "inventionEndAt" ,
                                            "dashBoardOptions") 
        VALUES($1, $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, $19) RETURNING id`,
        values: [employee.name, employee.email, employee.password, employee.companyId, employee.admin, employee.user, employee.superAdmin, employee.companyGroupId, JSON.stringify(employee.branches), employee.passCode, employee.mediaId, employee.privilegeId, employee.MSR, employee.updatedDate, employee.isDriver, employee.type, employee.inventionStartAt, employee.inventionEndAt, employee.dashBoardOptions]
      }
      const employeeInsert: any = (await client.query(query.text, query.values)).rows;
      employee.id = (<any>employeeInsert[0]).id

      let accessList: string[] = []
      if (employee.admin) {
        accessList.push("cloud_admin")
      }
      if (employee.user) {
        accessList.push("pos_admin")
      }
      if (employee.isDriver) {
        accessList.push("driver")
      }

      let getEmployeeName = {
        text: `SELECT "Employees"."name" as "employeeName"
                  FROM "Employees"
                  WHERE "Employees".id = $1 and "Employees"."companyId" = $2
                        `,
        values: [userId, companyId]
      }
      let employeeNameResult = await client.query(getEmployeeName.text, getEmployeeName.values);
      let employeeName = employeeNameResult.rows && employeeNameResult.rows.length > 0 && employeeNameResult.rows[0].employeeName ? employeeNameResult.rows[0].employeeName : ''


      let employeePrivilegeResult = await this.getPrivilleges(client, employee.id, companyId, employee.privilegeId)
      let employeePrivilege = employeePrivilegeResult.newPrivillegesName

      let branchName: string[] = []

      if (employee.branches && employee.branches.length > 0) {
        for (let b of employee.branches) {
          branchName.push(b.name)
        }
      }

      if (userId) {
        let log = new Log();
        log.employeeId = userId ? userId : ''
        log.action = 'Employee Created'

        log.comment = `${employeeName} has created new employee (${employee.name})` +
          (employeePrivilege
            ? ` with privilege (${employeePrivilege})`
            : ` but no privileges were`
          ) +
          ` assigned to the branches (${branchName.join(', ')}) and access to (${accessList})`;


        log.metaData = { "newEmployeeId": employee.id, "newEmployeeName": employee.name, "privilegeId": employee.privilegeId, "privilegeName": employeePrivilege, "branchIds": employee.branches, "branchNames": branchName, "access": accessList }
        await LogsManagmentRepo.manageLogs(client, "Employees", employee.id, [log], null, companyId, userId ? userId : '', "", "Cloud")

      }



      // if (employee.base64Image != "") {
      //   const storage = new FileStorage()
      //   const imageUrl = await storage.saveEmployeeImage(employee.base64Image, employee.companyId, employee.id)
      //   await this.updateEmployeeDefaultImage(employee.id, employee.companyId, employee.defaultImage)
      // }



      //if (employee.id){ const insertToComapny = (await companyEmployeeRepo.saveEmployeeCompany(client,employee, companyId))}

      if (employee.user) {
        await SocketEmployee.sendNewEmployee(client, employee.id)

      }
      return new ResponseData(true, "Added Successfully", { id: (<any>employeeInsert[0].id) })

    } catch (error: any) {
    
      throw new Error(error.message)
    }
  }







  public static async InsertAdmin(client: PoolClient, data: any) {
    try {


      if (data.email) {

        const isEmailExist = await this.checkAdminEmailExist(client, null, data.email);

        if (isEmailExist) {
          throw new ValidationException("Admin Email Already Exist")
        }
      }



      if (data.password != "" && data.password != null) {
        data.password = await AuthRepo.hashPassword(data.password)
      }



      const query: { text: string, values: any } = {
        text: `INSERT INTO "admins"(name,
                                            email,
                                            password) 
        VALUES($1,$2,$3) RETURNING id`,
        values: [data.name, data.email, data.password]
      }
      const employeeInsert: any = (await client.query(query.text, query.values)).rows;
      data.id = (<any>employeeInsert[0].id)



      return new ResponseData(true, "Added Successfully", { id: (<any>employeeInsert[0].id) })

    } catch (error: any) {
    
      throw new Error(error.message)
    }
  }


  public static async updateAdmin(client: PoolClient, data: any) {
    try {

      if (data.email) {
        const isEmailExist = await this.checkAdminEmailExist(client, data.id, data.email);
        if (isEmailExist) {
          throw new ValidationException("Admin Email Already Exist")
        }
      }


      let query: { text: string, values: any };


      if (data.password != "" && data.password != null) {
        data.password = await AuthRepo.hashPassword(data.password)
      }


      if (data.password == "" || data.password == null) {
        query = {
          text: `UPDATE "admins" SET name=($1),
                                               email=($2)
                                               WHERE id=($3)
          `,
          values: [data.name, data.email, data.id],
        };

      } else {
        query = {
          text: `UPDATE "admins" SET name=($1),
                                               email=($2),
                                               password=($3)
                                               WHERE id=($4)
          `,
          values: [data.name, data.email, data.password, data.id],
        };


      }





      const update = (await client.query(query.text, query.values)).rows;




      return new ResponseData(true, "Updated Successfully", [])

    } catch (error: any) {

    

      throw new Error(error.message)
    }
  }















  public static async updateEmployee(client: PoolClient, data: any, companyId: string, userId?: string) {
    try {

      const validate = await EmployeeValidation.EmployeeValidation(data);
      if (!validate.valid) {
        throw new ValidationException(validate.error)
      }

      const employee = new Employee();
      employee.ParseJson(data);
      employee.companyId = companyId;
      if (employee.email) {
        const isEmailExist = await this.checkEmployEmailExist(client, employee.id, employee.email);
        if (isEmailExist) {
          throw new ValidationException("Employee Email Already Exist")
        }
      }
      const isPassCodeExist = await this.checkIfEmployeePassCodeExist(client, employee.id, employee.passCode, companyId);

      if (isPassCodeExist) {
        throw new ValidationException("Employee passCode Already Exist")
      }
      let imageUrl = null;
      // if (employee.base64Image != "") {
      //   const storage = new FileStorage()
      //   imageUrl = await storage.saveEmployeeImage(employee.base64Image, employee.companyId, employee.id)
      // }

      employee.updatedDate = new Date();

      //update companyEmployee
      //let companyEmployee = (await companyEmployeeRepo.saveEmployeeCompany(client, employee, companyId))

      let getCompanyIdFromEmployeeTable = (await client.query(`select "companyId" from "Employees" WHERE id=($1)`, [employee.id]))
      let companyIdInEmployeeTable = (<any>getCompanyIdFromEmployeeTable.rows[0]).companyId


      let getPrivilege = await this.getPrivilleges(client, employee.id, companyId, employee.privilegeId ?? null)
      let oldPrivilegeId = getPrivilege.oldPrivillegesId
      let oldPrivilegeName = getPrivilege.oldPrivillegesName


      let query: { text: string, values: any } = {
        text: `UPDATE "Employees" SET name=($1),
                                             email=($2),
                                             "defaultImage"=$3,
                                             "updatedDate"=$4,
                                             "dashBoardOptions"=$5
                                             WHERE id=($6) and  "companyId"<>$7
        `,
        values: [employee.name, employee.email, imageUrl, employee.updatedDate, employee.dashBoardOptions, employee.id, companyId],
      };

      //if defaualt update company info in empolyee tabel
      if (companyIdInEmployeeTable == companyId) {
        query = {
          text: `UPDATE "Employees" SET name=($1),
                                               email=($2),
                                               admin=($3),
                                               "user"=$4,
                                               "branches"=$5 ,
                                               "defaultImage"=$6,
                                               "updatedDate"=$7,
                                               "isDriver" = $8,
                                               "mediaId"=$9, 
                                               "privilegeId"=$10,
                                               type = $11,
                                               "inventionStartAt" =$12,
                                               "inventionEndAt" = $13,
                                               "dashBoardOptions"=$14
                                              
                                               WHERE "companyId"=$15 and id=($16) 
          `,
          values: [employee.name, employee.email, employee.admin, employee.user, JSON.stringify(employee.branches), imageUrl, employee.updatedDate, employee.isDriver, employee.mediaId, employee.privilegeId, employee.type, employee.inventionStartAt, employee.inventionEndAt, employee.dashBoardOptions, companyId, employee.id],
        };

      }


      //else update comman info 

      const update = (await client.query(query.text, query.values)).rows;
      if (employee.passCode != "" && employee.passCode != null) {
        employee.passCode = await AuthRepo.hashPassword(employee.passCode)
        await this.changeEmployeePassCode(client, employee.id, employee.passCode)
      }

      if (employee.password != "" && employee.password != null) {
        employee.password = await AuthRepo.hashPassword(employee.password)
        await this.changeEmployeePassword(client, employee.id, employee.password)
      }


      if (employee.MSR != "" && employee.MSR != null) {
        employee.MSR = await AuthRepo.hashPassword(employee.MSR)
        await this.changeEmployeeMsr(client, employee.id, employee.MSR)
      }

      let getEmployeeName = {
        text: `SELECT "Employees"."name" as "employeeName"
                  FROM "Employees"
                  WHERE "Employees".id = $1 and "Employees"."companyId" = $2
                        `,
        values: [userId, companyId]
      }
      let employeeNameResult = await client.query(getEmployeeName.text, getEmployeeName.values);
      let employeeName = employeeNameResult.rows && employeeNameResult.rows.length > 0 && employeeNameResult.rows[0].employeeName ? employeeNameResult.rows[0].employeeName : ''


      let getNewPrivilageName = getPrivilege.newPrivillegesName

      let branchName: string[] = []
      let branchIds: string[] = []
      if (employee.branches && employee.branches.length > 0) {
        for (let b of employee.branches) {
          branchName.push(b.name)
          branchIds.push(b.id)
        }
      }

      let accessList: string[] = []
      if (employee.admin) {
        accessList.push("cloud_admin")
      }
      if (employee.user) {
        accessList.push("pos_admin")
      }
      if (employee.isDriver) {
        accessList.push("driver")
      }


      let log = new Log();
      log.employeeId = userId ? userId : ''
      log.action = 'Employee Privilege Modified'

      log.comment = `${employeeName} has modified the privilege of (${employee.name})` +
        (getNewPrivilageName
          ? ` to the following (${getNewPrivilageName})`
          : ` but no privileges were `
        ) +
        ` assigned to the branches (${branchName.join(', ')}) and access to (${accessList})`;

      log.metaData = {
        "targetEmployeeId": employee.id,
        "targetEmployeeName": employee.name,
        ...(oldPrivilegeId != null && { "oldPrivilegeId": oldPrivilegeId }),
        ...(oldPrivilegeName != null && { "oldPrivilegeName": oldPrivilegeName }),
        ...(employee.privilegeId != null && { "newPrivilegeId": employee.privilegeId }),
        ...(getNewPrivilageName != null && { "newPrivilegeName": getNewPrivilageName }),
        "branchIds": branchIds,
        "branchNames": branchName,
        "access": accessList
      }

      await LogsManagmentRepo.manageLogs(client, "Employees", employee.id, [log], null, companyId, userId ? userId : '', "", "Cloud")



      if (employee.user) {
        await SocketEmployee.sendUpdatedEmployee(client, employee.id)
      }

      return new ResponseData(true, "Updated Successfully", [])

    } catch (error: any) {

    

      throw new Error(error.message)
    }
  }

  public static async getPrivilleges(client: PoolClient, id: string | null, companyId: string, privillegeId: string | null) {
    try {
      const query = {
        text: `SELECT "Employees"."privilegeId", "oldPrivilleges"."id" as "oldPrivillegesId" , "oldPrivilleges"."name" as "oldPrivillegesName", 
                      "newPrivilleges"."id" as "newPrivillegesId", "newPrivilleges"."name" as "newPrivillegesName"
                FROM "Employees" 
                left join "EmployeePrivileges" "oldPrivilleges" on "oldPrivilleges"."companyId" = $2 and "oldPrivilleges".id = "Employees"."privilegeId"
                left join "EmployeePrivileges" "newPrivilleges" on "newPrivilleges"."companyId" = $2 and "newPrivilleges".id = $3
                WHERE "Employees".id=$1`,
        values: [id, companyId, privillegeId]
      }

      let employeePrivilage = await client.query(query.text, query.values);
      return employeePrivilage.rows && employeePrivilage.rows.length > 0 && employeePrivilage.rows[0] ? employeePrivilage.rows[0] : null
    } catch (error: any) {
      throw new Error(error)
    }
  }


  public static async changeEmployeePassword(client: PoolClient, employeeId: string, password: string) {
    try {
      const query: { text: string, values: any } = {
        text: `UPDATE "Employees" set "password" =$1 where id =$2`,
        values: [password, employeeId]
      }
      await client.query(query.text, query.values)
    } catch (error: any) {
      throw new Error(error.message)
    }
  }

  public static async changeEmployeeMsr(client: PoolClient, employeeId: string, MSR: string) {
    try {
      const query: { text: string, values: any } = {
        text: `UPDATE "Employees" set "MSR" =$1 where id =$2`,
        values: [MSR, employeeId]
      }
      await client.query(query.text, query.values)
    } catch (error: any) {
    

      throw new Error(error.message)
    }
  }
  public static async changeEmployeePassCode(client: PoolClient, employeeId: string, passCode: string) {
    try {
      const query: { text: string, values: any } = {
        text: `UPDATE "Employees" set "passCode" =$1 where id =$2`,
        values: [passCode, employeeId]
      }
      await client.query(query.text, query.values)
    } catch (error: any) {
    

      throw new Error(error.message)
    }
  }

  // public static async getCompanyGroupSuperAdmin(companyId:string){
  //   try {

  //   } catch (error:any) {
  //     throw new Error(error)
  //   }
  // }

  public static async getEmployeeList(data: any, companyId: string) {
    try {

      let selectQuery;
      let selectValues;

      let countQuery;
      let countValues;


      let searchValue;
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
                            "Employees".id,
                            "Employees".name,
                            "Employees".email,
                            "Employees".admin,
                            "Employees"."user",
                            "Employees"."superAdmin",
                            "Media".url
                      FROM "Employees"
                      LEFT JOIN "Media" on "Employees"."mediaId" = "Media".id`
      const countText = `select count(*) FROM "Employees"`
      const filterQuery = ` WHERE "Employees"."companyId" = $1 `



      let limitQuery = ` Limit $2 offset $3`
      let selectCount;
      let orderByQuery;
      selectQuery = selectText + filterQuery;
      selectValues = [companyId]
      if (data != null && data != '' && JSON.stringify(data) != '{}') {
        if (data.searchTerm) {
          searchValue = '%' + data.searchTerm.trim().toLowerCase() + '%'

        }

        sort = data.sortBy;
        sortValue = !sort ? '"Employees"."createdAt"' : '"' + sort.sortValue + '"';
        if (data.employeeId != null && data.employeeId != "") {
          sortValue = ` ("Employees".id = ` + "'" + data.employeeId + "'" + ` )`
        }
        sortDirection = !sort ? "DESC" : sort.sortDirection;
        sortTerm = sortValue + " " + sortDirection

        orderByQuery = ` Order by ` + sortTerm;

        selectQuery = selectText + filterQuery + orderByQuery + limitQuery
        selectValues = [companyId, limit, offset]
        countQuery = countText + filterQuery
        countValues = [companyId]

        if (data.searchTerm != "" && data.searchTerm != null) {
          const searchQuery = ` AND (LOWER ("Employees".name) LIKE $2)`
          limitQuery = ` LIMIT $3 OFFSET $4`
          selectQuery = selectText + filterQuery + searchQuery + orderByQuery + limitQuery
          selectValues = [companyId, searchValue, limit, offset]
          countQuery = countText + filterQuery + searchQuery
          countValues = [companyId, searchValue]
        }


        selectCount = await DB.excu.query(countQuery, countValues)
        count = Number((<any>selectCount.rows[0]).count)
        pageCount = Math.ceil(count / data.limit)
      }

      const selectList = await DB.excu.query(selectQuery, selectValues)



      offset += 1
      let lastIndex = ((data.page) * data.limit)
      if (selectList.rows.length < data.limit || data.page == pageCount) {
        lastIndex = count
      }
      const temp: any[] = [];

      selectList.rows.forEach((element: any) => {
        if (element.url) {
          element.avatar = element.url.defaultUrl;
        }

        temp.push(element);
      });

      const resData = {
        list: temp,
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





  public static async getAllAdmins() {
    try {
      const selectText = `select id,name,email from admins`
      const selectList = await DB.excu.query(selectText)
      const resData = selectList.rows
      return new ResponseData(true, "", resData)
    } catch (error: any) {
    
      throw new Error(error.message)
    }
  }



  public static async getAdminById(AdminId: any) {
    try {
      console.log("admin");


      const query: { text: string, values: any } = {
        text: `select id,name,email from admins WHERE id=($1)`,
        values: [AdminId],
      };
      const admin: any = (await DB.excu.query(query.text, query.values)).rows[0];

      return new ResponseData(true, "", admin)
    } catch (error: any) {
    
      throw new Error(error.message)
    }
  }









  public static async getEmployeeById(localEmployeeId: string, employeeId: any, companyId: string) {
    try {

      const query: { text: string, values: any } = {
        text: `SELECT "Employees".id,
                      "Employees".name,
                      "Employees".email,
                      "Employees".admin,
                      "Employees"."user",
                      "Employees"."superAdmin",
                        (select JSON_AGG(JSON_BUILD_OBJECT('id',"Branches".id ,'name', "Branches".name))  from JSONB_ARRAY_ELEMENTS(   "Employees"."branches") EL
                        INNER JOIN "Branches" on "Branches".id = (EL->>'id')::uuid
                       )::TEXT::JSONB  as "branches",
                      "Employees"."mediaId",
                      "Employees"."privilegeId",
                      "Employees"."dashBoardOptions",
                      "Employees"."type",
                       "Employees"."isDriver",
                      "Employees"."apply2fa",
                      case when "Employees"."inventionStartAt" is not null then true else false end as "isInvitedUser",
                      "Employees"."inventionStartAt",
                      "Employees"."inventionEndAt",
                      "Media".url::jsonb as "mediaUrl"

                  FROM "Employees"
                  LEFT JOIN "Media" on "Media".id = "Employees"."mediaId"
                  WHERE "Employees".id=($1) AND "Employees"."companyId"=($2)

                  union 

                  SELECT "CompanyEmployees"."employeeId" as id,
                      "Employees".name,
                      "Employees".email,
                     
                      "CompanyEmployees".admin,
                      "CompanyEmployees".user,
                      "CompanyEmployees"."superAdmin",
                       (select JSON_AGG(JSON_BUILD_OBJECT('id',"Branches".id ,'name', "Branches".name))  from JSONB_ARRAY_ELEMENTS(  "CompanyEmployees"."branches") EL
                        INNER JOIN "Branches" on "Branches".id = (EL->>'id')::uuid
                       )::TEXT::JSONB   as "branches",
                      "CompanyEmployees"."mediaId",
                      "CompanyEmployees"."privilegeId",
                      "CompanyEmployees"."dashBoardOptions",
                      "CompanyEmployees"."type",
                      "CompanyEmployees"."isDriver",
                      "Employees"."apply2fa",
                      case when "CompanyEmployees"."inventionStartAt" is not null then true else false end as "isInvitedUser",
                      "CompanyEmployees"."inventionStartAt",
                      "CompanyEmployees"."inventionEndAt",
                      "Media".url::jsonb as "mediaUrl"
                  
                  FROM "CompanyEmployees"
                  INNER JOIN "Employees" on "CompanyEmployees"."employeeId" = "Employees".id and "CompanyEmployees"."companyId" <> "Employees"."companyId"
                  LEFT  JOIN "Media"     on "Media".id = "CompanyEmployees"."mediaId"
                  WHERE "Employees".id=($1) AND "CompanyEmployees"."companyId"=($2) `,
        values: [employeeId, companyId],
      };
      const emp: any = (await DB.excu.query(query.text, query.values)).rows;
      const employee = new Employee();
      employee.ParseJson(emp[0])
      employee.hasPermissionToChange2fa = employeeId == localEmployeeId

      return new ResponseData(true, "", employee)

    } catch (error: any) {
    
      throw new Error(error.message)
    }
  }
  public static async getEmployeeName(employeeId: any) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT name from "Employees" where id =$1`,
        values: [employeeId]
      }
      let employee = await DB.excu.query(query.text, query.values);
      return employee.rows && employee.rows.length > 0 ? (<any>employee.rows[0]).name : null
    } catch (error: any) {
    

      throw new Error(error)
    }
  }

  public static async updateEmployeeDefaultImage(employeeId: string, companyId: string, imageUrl: string) {
    try {
      const query: { text: string, values: any } = {
        text: `UPDATE "Employees" SET "defaultImage"=$1 where id=$2 `,
        values: [imageUrl, employeeId]
      }

      await DB.excu.query(query.text, query.values)
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
        "Employees"."companyId",
        "Employees"."privilegeId",
        "Employees"."MSR",
              "Media".url,
            (SELECT
                json_agg(json_build_object('id',"Employees".id,
                                           'price',price,
                                           'serviceTime', "serviceTime")
                         ) FROM "EmployeePrices"
                           WHERE "Employees".id = "EmployeePrices"."employeeId") AS EmployeePrices
                        From "Employees"
                        cross JOIN LATERAL JSONB_ARRAY_ELEMENTS("Employees"."branches") AS "branches"(branch)
                        left JOIN "Branches"  ON ("branches".branch->>'id')::uuid  = "Branches".id  
                                                            left join "Media" ON "Media".id = "Employees"."mediaId"

                                    WHERE ("passCode" IS NOT NULL )
                                    AND "user" = $1
                                    AND "Employees"."companyId" =$2
                                    AND ("Branches".id =$3 or "superAdmin" = true)`,
        values: [true, companyId, branchId]
      }

      if (date != null) {
        query.text = `SELECT  "Employees".id,
                             "Employees".name,
                              "Employees"."passCode",
                              "Employees"."companyId", 
                              "Employees"."privilegeId",
                              "Employees"."MSR",
                              "Media".url,
                                    (SELECT
                                        json_agg(json_build_object('id',id,
                                                                  'price',price,
                                                                  'serviceTime', "serviceTime")
                                                ) FROM "EmployeePrices"
                                                  WHERE "Employees".id = "EmployeePrices"."employeeId") AS EmployeePrices
                                    From "Employees" 
                                    cross JOIN LATERAL JSONB_ARRAY_ELEMENTS("Employees"."branches") AS "branches"(branch)
                                    left JOIN "Branches"  ON ("branches".branch->>'id')::uuid  = "Branches".id  
                                    left join "Media" ON "Media".id = "Employees"."mediaId"
                                    WHERE ("passCode" IS NOT NULL )
                                    AND "user" = $1
                                    AND "Employees"."companyId" =$2
                                    AND ("Branches".id =$3 or "superAdmin" = true)
                                    AND ("Employees" ."updatedDate" >= $4 or "Employees" ."createdAt" >=$4)
                                    `
        query.values = [true, companyId, branchId, date]
      }

      const employees: any = await DB.excu.query(query.text, query.values)


      for (let index = 0; index < employees.rows.length; index++) {
        const element: any = employees.rows[index];
        // const storage = new FileStorage();
        // // const image = await storage.getEmployeeImageBase64(element.companyId, element.id)
        // // employees.rows[index].defaultImage = image
        if (element && element.url && element.url.defaultUrl) {
          const mediaName = element.url.defaultUrl.substring(element.url.defaultUrl.lastIndexOf('/') + 1)

          let imageData: any = await S3Storage.getThumbnailImageUrl(mediaName, element.companyId)
          if (imageData) {
            imageData = imageData.split(';base64,').pop();
            employees.rows[index].imageUrl = imageData
          }
        }
      }


      //TODO: IMAGE IF EMPTY STRING THEN NULL 
      await client.query("COMMIT")
      return new ResponseData(true, "", employees.rows)

    } catch (error: any) {
      await client.query("ROLLBACK")
    
      console.log(error)
      return new ResponseData(true, error, [])
    } finally {
      client.release()
    }
  }


  public static async getPosEmployeeById(client: PoolClient, employeeId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT "Employees".id,
        "Employees".name,
        "Employees"."passCode",
        "Employees"."companyId",
        "Employees"."privilegeId",
        "Employees"."MSR",
        "Employees"."branches",
        "Media".url
        from "Employees"
        LEFT JOIN "Media" on "Media".id =  "Employees"."mediaId"
                                    WHERE "passCode" IS NOT NULL 
                                    AND "user" = $1 

                                    AND "Employees".id = $2`,
        values: [true, employeeId]


      }

      let employee = await client.query(query.text, query.values);
      if (employee.rows[0] && employee.rows[0].url && employee.rows[0].url.defaultUrl) {
        const mediaName = employee.rows[0].url.defaultUrl.substring(employee.rows[0].url.defaultUrl.lastIndexOf('/') + 1)

        let imageData: any = await S3Storage.getThumbnailImageUrl(mediaName, employee.rows[0].companyId)
        if (imageData) {
          imageData = imageData.split(';base64,').pop();
          employee.rows[0].imageUrl = imageData
        }
      }
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

  public static async setNewPassword(data: any, company: any) {
    try {


      let password = data.password;
      let employeeId = data.employeeId;
      let hashPassword = await AuthRepo.hashPassword(password);
      let resetPasswordDate = new Date()
      let query = {
        text: `UPDATE "Employees" set password=$1,"resetPasswordDate"=$2 where id=$3 and "companyId"=$4 `,
        values: [hashPassword, resetPasswordDate, employeeId, company.id]
      }

      await DB.excu.query(query.text, query.values);

      return new ResponseData(true, "", [])

    } catch (error: any) {
      console.log(error)
      throw new Error(error)
    }
  }


  public static async forgetPassword(data: any) {
    try {
      const method = data.method ?? 'Phone' /** send otp throw email or phone default phone */
      const email = data.email;
      const phone = data.phone ?? null;

      let otp = await Helper.generateCode(6);
      /**send otp to employee phone number */
      if (method == 'Phone') {
        if (phone == null) {
          throw new Error("Phone Number Is Required")
        }
        const sns = new SnsService();
        sns.phoneNumber = phone;
        sns.message = ``
      } else {

      }

    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async setEmployeeOTP(sessionId: string, host: string | null) {
    try {
      let redisClient = RedisClient.getRedisClient();
      const code = await Helper.generateCode(6);
      let employee: any = await this.getEmployee(sessionId);


      if (employee) {

        employee = JSON.parse(employee);

        let email = new SesService();
        email.sender = employee.companyName + '<' + employee.companySlug + '@invopos.co>'
        email.receivers.push(employee.email);

        email.subject = "resetPassword";

        email.body =
          ` 
            Dear ${employee.name},

            A password reset was requested for your account (${employee.email}) 

            OTP:  ${code}

            If you have not initited this request, you may simply ignore this email.
            This OTP will expire after 5 minute.

            `
        if (host) {
          email.body +=
            `This request was made by : 
                IP:`+ host

        }


        let res = await email.sendEmail();


        if (res?.$metadata.httpStatusCode == 200) {
          let key = "Employee_OTP" + sessionId;
          await redisClient.set(key, code, 5 * 60);
          return true

        }
        return false;

        // otpmsg.phoneNumber = employee.email

        // let msg = await otpmsg.sendSms()

        // if(msg.success){
        //     let key = "Shopper_OTP"  + sessionId;
        //     await redisClient.set(key, code, 5 * 60 * 1000);
        //     return true
        // }else{
        //     return false

        // }
      }
      return false


    } catch (error: any) {
    

      throw new Error(error)
    }
  }
  public static async checkOTP(data: any) {
    try {

      let sessionId = data.sessionId;
      let otp = data.OTP;


      let redisClient = RedisClient.getRedisClient();
      let key = "Employee_OTP" + sessionId;
      let actualOTP = await redisClient.get(key)


      if (actualOTP == otp) {

        let employee: any = await this.getEmployee(sessionId)
        employee = JSON.parse(employee)

        return new ResponseData(true, "", [])
      } else {
        return new ResponseData(false, "Invalid OTP", [])
      }


    } catch (error: any) {
    

      throw new Error(error)
    }
  }

  public static async setEmployee(sessionId: string, employee: any) {
    try {
      let redisClient = RedisClient.getRedisClient();
      let key = "Employee" + sessionId;
      return await redisClient.set(key, JSON.stringify(employee), 2 * 24 * 60 * 60 * 1000);
    } catch (error: any) {
    

      throw new Error(error)
    }
  }

  public static async getEmployee(sessionId: string): Promise<any | null> {
    try {
      let redisClient = RedisClient.getRedisClient();
      let key = "Employee" + sessionId;
      let data = await redisClient.get(key);
      if (!data) return null;

      return data

    } catch (error: any) {
    

      throw new Error(error)
    }
  }


  public static async checkEmployeeEmail(email: string, host: string | null) {
    try {

      const query: { text: string, values: any } = {
        text: `SELECT "Employees".id,  "Employees".name,email, "Companies".name as "companyName", "Companies".slug as "companySlug"
                  FROM "Employees" 
                  Inner join "Companies"  on "Employees"."companyId" = "Companies" .id
                  where email =$1`,
        values: [email]
      }

      const shopperData = await DB.excu.query(query.text, query.values);

      if (shopperData.rows.length > 0) {

        //set shopper
        let employee = new Employee();
        employee.ParseJson(shopperData.rows[0]);
        employee.sessionId = Helper.createGuid()
        await this.setEmployee(employee.sessionId, employee)

        //set otp
        if (await this.setEmployeeOTP(employee.sessionId, host)) {
          return new ResponseData(true, "", employee)
        } else {
          return new ResponseData(false, "", employee)
        }

      } else {
        return new ResponseData(false, "the email does not exists", {})
      }


    } catch (error: any) {
    

      throw new Error(error)
    }
  }




  public static async setNewPassword2(data: any) {
    try {

      let hashedPassword = await AuthRepo.hashPassword(data.password.toString())
      let empolyee: any = await this.getEmployee(data.sessionId)
      empolyee = JSON.parse(empolyee)

      let redisClient = RedisClient.getRedisClient();
      let key = "Employee_OTP" + data.sessionId;
      let actualOTP = await redisClient.get(key)


      if (actualOTP == data.OTP) {
        const query: { text: string, values: any } = {
          text: `Update "Employees" set password=$2 where email = $1  RETURNING Id`,
          values: [empolyee.email, hashedPassword]
        }
        let empolyeeId = await DB.excu.query(query.text, query.values);
        return new ResponseData(true, "", {})

      } else {

        return new ResponseData(false, "", {})
      }





    } catch (error: any) {
    
      console.log(error)
      throw new Error(error)
    }
  }



  public static async getEmployeeEmail(empolyeeId: string, companyId?: string | null) {

    try {

      let query: { text: string, values: any } = {
        text: `SELECT 
                e.email,
                e."isEmailValidated",
                CASE 
                  WHEN e."superAdmin" THEN 
                    jsonb_agg(
                      jsonb_build_object('id', b.id)
                    )
                  
                  ELSE 
                    jsonb_agg(
                      jsonb_build_object('id', b.id)
                    )
                    FILTER (
                      WHERE 
                       b.id IN (
                        SELECT (branch->>'id')::uuid 
                        FROM jsonb_array_elements(e."branches") AS branch
                      )
                    )
                END AS "branches"
              FROM "Employees" e
              INNER JOIN "Branches" b
                ON b."companyId" = e."companyId"
              WHERE e.id = $1
              GROUP BY e.id;`,
        values: [empolyeeId]
      }



      if (companyId) {

        query.text = `
         SELECT 
            e.email,
            e."isEmailValidated",
            CASE 
              WHEN e."superAdmin" THEN 
                jsonb_agg(
                  jsonb_build_object('id', b.id)
                )
               
              ELSE 
                jsonb_agg(
                  jsonb_build_object('id', b.id)
                )
                FILTER (
                  WHERE b.id IN (
                    SELECT (branch->>'id')::uuid 
                    FROM jsonb_array_elements(e."branches") AS branch
                  )
                )
            END AS "branches"
          FROM "Employees" e
          INNER JOIN "Branches" b 
            ON b."companyId" = e."companyId"
          WHERE e.id = $1
            AND e."companyId" = $2
          GROUP BY e.id, e.email, e."isEmailValidated"

          UNION

          SELECT 
            e.email,
            e."isEmailValidated",
            CASE 
              WHEN ce."superAdmin" THEN 
                jsonb_agg(
                  jsonb_build_object('id', b.id)
                )
             
              ELSE 
                jsonb_agg(
                  jsonb_build_object('id', b.id)
                )
                FILTER (
                  WHERE b.id IN (
                    SELECT (branch->>'id')::uuid 
                    FROM jsonb_array_elements(ce."branches") AS branch
                  )
                )
            END AS "branches"
          FROM "CompanyEmployees" ce
          INNER JOIN "Employees" e 
            ON e.id = ce."employeeId"
          INNER JOIN "Branches" b 
            ON b."companyId" = ce."companyId"
          WHERE ce."employeeId" = $1
            AND ce."companyId" = $2
          GROUP BY e.email, ce.id, e."isEmailValidated";`
        query.values = [empolyeeId, companyId];



      }
      let employee = (await DB.excu.query(query.text, query.values));


      let data = {
        isEmailValidated: employee.rows && employee.rows.length > 0 ? (<any>employee.rows[0]).isEmailValidated : null,
        email: employee.rows && employee.rows.length > 0 ? (<any>employee.rows[0]).email : null,
        branches: employee.rows && employee.rows.length > 0 ? (<any>employee.rows[0]).branches : null
      }
      return (data)
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async getCompanyEmployeeAccess(
    empolyeeId: string,
    companyId?: string | null
  ) {
    try {
      const filterByCompany = !!companyId;

      const query: { text: string; values: any[] } = {
        text: `
          WITH emp_companies AS (
          -- Companies from CompanyEmployees
          SELECT DISTINCT c.id AS "companyId"
          FROM "Companies" c
          INNER JOIN "CompanyEmployees" ce
            ON ce."companyId" = c.id
          WHERE ce."employeeId" = $1
            AND (ce."inventionEndAt" IS NULL OR ce."inventionEndAt" > $2::timestamp)
            AND (ce."inventionStartAt" IS NULL OR ce."inventionStartAt" <= $2::timestamp)

          UNION

          -- Companies from Employees (main company)
          SELECT DISTINCT c2.id AS "companyId"
          FROM "Companies" c2
          INNER JOIN "Employees" e2
            ON e2."companyId" = c2.id
          WHERE e2.id = $1
            AND (e2."inventionEndAt" IS NULL OR e2."inventionEndAt" > $2::timestamp)
        )

        SELECT 
          e.email,
          e."isEmailValidated",

          ARRAY_AGG(DISTINCT ec."companyId") AS "companyIds",

          jsonb_agg(
            DISTINCT jsonb_build_object('id', b.id)
          ) FILTER (
            WHERE 
              b."endSubscriptionDate" IS NOT NULL 
              AND b."endSubscriptionDate" >= NOW()
              AND (
                ce."superAdmin" = TRUE
                OR b.id IN (
                  SELECT (branch->>'id')::uuid
                  FROM jsonb_array_elements(ce."branches") AS branch
                )
                OR b.id IN (
                  SELECT (branch->>'id')::uuid
                  FROM jsonb_array_elements(e."branches") AS branch
                )
              )
          ) AS "branches"

        FROM "Employees" e

        LEFT JOIN emp_companies ec
          ON TRUE

        LEFT JOIN "CompanyEmployees" ce
          ON ce."employeeId" = e.id
        AND ce."companyId"  = ec."companyId"

        -- branches for those companies
        LEFT JOIN "Branches" b
          ON b."companyId" = ec."companyId"

        WHERE e.id = $1
          ${filterByCompany ? 'AND ec."companyId" = $3' : ''}

        GROUP BY 
          e.email,
          e."isEmailValidated";
      `,
        values: filterByCompany ? [empolyeeId, new Date(), companyId] : [empolyeeId, new Date()],
      };

      const employee = await DB.excu.query(query.text, query.values);
      const row = employee.rows?.[0] ?? null;

      return {
        email: row?.email ?? null,
        isEmailValidated: row?.isEmailValidated ?? null,
        companyIds: row?.companyIds ?? [],
        branches: row?.branches ?? []
      };

    } catch (error: any) {
      throw new Error(error);
    }
  }


  public static async setEmployeeDashboard(data: any, employeeId: string, company: Company) {
    try {

      const dashBoardOptions = data.dashBoardOptions;

      const query = {
        text: `UPDATE "Employees" SET "dashBoardOptions" = $1 WHERE id =$2 and "companyId" =$3`,
        values: [JSON.stringify(dashBoardOptions), employeeId, company.id]
      }
      await DB.excu.query(query.text, query.values)
      return new ResponseData(true, "", [])
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async getEmployeeDashboard(employeeId: string, company: Company) {
    try {


      const query = {
        text: `SELECT "dashBoardOptions" FROM "Employees" WHERE id =$1 and "companyId" =$2
                UNION
                SELECT "dashBoardOptions" FROM "CompanyEmployees" WHERE "employeeId" = $1  and "companyId" = $2
                `,
        values: [employeeId, company.id]
      }
      let dashboard = await DB.excu.query(query.text, query.values)
      let dashboardData = dashboard.rows && dashboard.rows.length > 0 && (<any>dashboard.rows[0]).dashBoardOptions ? (<any>dashboard.rows[0]).dashBoardOptions : []
      return new ResponseData(true, "", dashboardData)
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async getEmployeeIdByEmail(email: string | null): Promise<string> {
    try {
      const query: { text: string, values: any } = {
        text: `SELECT id from "Employees" where email =$1`,
        values: [email]
      }
      let employee = await DB.excu.query(query.text, query.values);
      return employee.rows && employee.rows.length > 0 ? (<any>employee.rows[0]).id : ""
    } catch (error: any) {
    

      throw new Error(error)
    }
  }


  public static async setEmployeeWorkInBranches(data: any, employeeId: string, company: Company) {
    try {

      const dashBoardOptions = data.dashBoardOptions;

      const query = {
        text: `UPDATE "Employees" SET "dashBoardOptions" = $1 WHERE id =$2 and "companyId" =$3`,
        values: [JSON.stringify(dashBoardOptions), employeeId, company.id]
      }
      await DB.excu.query(query.text, query.values)
      return new ResponseData(true, "", [])
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async getEmployeeWorkInBranches(employeeId: string, company: Company) {
    try {


      const query = {
        text: `SELECT "dashBoardOptions" FROM "Employees" WHERE id =$1 and "companyId" =$2`,
        values: [employeeId, company.id]
      }
      let dashboard = await DB.excu.query(query.text, query.values)
      let dashboardData = dashboard.rows && dashboard.rows.length > 0 && (<any>dashboard.rows[0]).dashBoardOptions ? (<any>dashboard.rows[0]).dashBoardOptions : []
      return new ResponseData(true, "", dashboardData)
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async InsertEmployee2(client: PoolClient, data: any, companyId: string, userId: string) {
    try {
      const validate = await EmployeeValidation.EmployeeValidation(data);
      if (!validate.valid) {
        throw new ValidationException(validate.error)
      }
      const employee = new Employee();
      employee.ParseJson(data);

      if (employee.email) {

        const isEmailExist = await this.checkEmployEmailExist(client, null, employee.email);
        if (isEmailExist) {

          if (employee.type == "Cloud User") {
            throw new ValidationException("Employee email already exists. You can invite this employee")
          }
          employee.id = await this.getEmployeeIdByEmail(employee.email)
          const t = await companyEmployeeRepo.checkEmployeeInventionTime(client, employee.id, companyId)
          if (t.id) { throw new ValidationException("Employee already exists.") }

          if (employee.id) { const insertToComapny = await this.updateEmployee(client, employee, companyId) }

          // if (employee.user) {
          //   await SocketEmployee.sendNewEmployee(client, employee.id)

          // }
          return new ResponseData(true, "Added Successfully", { id: employee.id })
        }



      }

      const add = await this.InsertEmployee(client, employee, companyId, userId);
      return add






    } catch (error: any) {
    
      throw new Error(error.message)
    }
  }

  public static async checkEmployeeExists(client: PoolClient, id: string | null, email: string, type: string, companyId: string) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Employees" where id <> $1 and LOWER(email) = LOWER($2)`,
      values: [
        id,
        email,
      ],
    };
    if (id == null) {
      query.text = `SELECT count(*) as qty FROM "Employees" where  LOWER(email) = LOWER($1)`
      query.values = [email]
    }
    const resault = await client.query(query.text, query.values);

    let isEmailExist = false;

    if ((<any>resault.rows[0]).qty > 0) {
      isEmailExist = true;
    }


    if (isEmailExist) {

      if (type == "Cloud User") {
        throw new ValidationException("Employee email already exists. You can invite this employee")
      }
      let employeeId = await this.getEmployeeIdByEmail(email)
      const t = await companyEmployeeRepo.checkEmployeeInventionTime(client, employeeId, companyId)
      if (t.id) { throw new ValidationException("Employee already exists.") }

      if (employeeId) { new ResponseData(true, "employee Info", { id: employeeId }) }

      // if (employee.user) {
      //   await SocketEmployee.sendNewEmployee(client, employee.id)

      // }
      return new ResponseData(true, "", {})
    }


  }

  public static async sendEmployeeInvention(employeeId: string, company: Company) {
    try {

      if (!employeeId) { throw new ValidationException("EmployeeId is required") }
      let employee: any = await this.getEmployeeEmail(employeeId, company.id);


      if (employee) {

        employee = JSON.parse(employee);

        let email = new SesService();
        email.sender = company.name + '<' + company.slug + '@invopos.co>'
        email.receivers.push(employee.email);

        email.subject = "Employee Invention";

        email.body = ` link: ${process.env.CLOUD_BASE_URL} `

        let res = await email.sendEmail();


        if (res?.$metadata.httpStatusCode == 200) {
          return new ResponseData(true, "", {})
        }
      }
      return new ResponseData(false, "", {})


    } catch (error: any) {
    

      throw new Error(error)
    }
  }


  public static async checkIfEmployeeHas2fa(employeeId: string) {

    try {

      let query: { text: string, values: any } = {
        text: `select "apply2fa" from "Employees" where id = $1`,
        values: [employeeId]
      }

      let employee = (await DB.excu.query(query.text, query.values));
      return (<any>employee.rows[0]).apply2fa ?? null


    } catch (error: any) {
      throw new Error(error)
    }
  }
  public static async getEmployeeTOTP(employeeId: string) {

    try {

      let query: { text: string, values: any } = {
        text: `select "employeeTOTP" from "Employees" where id = $1`,
        values: [employeeId]
      }

      let employee = (await DB.excu.query(query.text, query.values));
      return (<any>employee.rows[0]).employeeTOTP ?? null


    } catch (error: any) {
      throw new Error(error)
    }
  }
  public static async setEmployeeTOTP(employeeId: string, apply2fa: boolean | null, employeeTOTP?: {}) {

    try {

      let query: { text: string, values: any } = {
        text: `update "Employees"  set "employeeTOTP" = $2, "apply2fa" = $3  where "Employees".id =$1  returning "employeeTOTP"`,
        values: [employeeId, employeeTOTP ?? null, apply2fa]
      }

      let employee = (await DB.excu.query(query.text, query.values));
      return (<any>employee.rows[0]).employeeTOTP ?? null


    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async getEmployeeLoginData(employeeId: string, client: PoolClient | null = null) {

    try {

      const query: { text: string, values: any } = {
        text: `SELECT "Employees".name,
                      "EmployeePrivileges"."privileges",
                      "Employees".name,"Employees".id,
                      "Employees"."companyId",
                      "Employees"."privilegeId",
                      "Employees"."companyGroupId",
                      "Employees"."dashBoardOptions",
                      "Employees"."resetPasswordDate",
                      "Companies".country,
                      "Companies".name as "companyName",
                      "Companies".features,
                      "Media".id as "mediaId",
                      "Media".url as "mediaUrl"
                       FROM "Employees" 
              LEFT JOIN "EmployeePrivileges"
              on "EmployeePrivileges".id = "Employees"."privilegeId"
              LEFT JOIN "Companies" 
              on "Companies".id = "Employees"."companyId"
              LEFT join "Media" on "Media".id = "Employees"."mediaId"
              WHERE "Employees".id = $1`,
        values: [employeeId]
      }
      const isEmployeeExist = client ? await client.query(query.text, query.values) : await DB.excu.query(query.text, query.values);
      let data = {}
      if (isEmployeeExist && isEmployeeExist.rows.length > 0) {

        const companyId = (<any>isEmployeeExist.rows[0]).companyId;
        const employeeId = (<any>isEmployeeExist.rows[0]).id
        const country = (<any>isEmployeeExist.rows[0]).country
        const companyName = (<any>isEmployeeExist.rows[0]).companyName
        const features = (<any>isEmployeeExist.rows[0]).features
        let fileStorage = new FileStorage();
        const settings = (await fileStorage.getCompanySettings(country))?.settings





        // const afterDecimal = settings.afterDecimal

        data = {
          employeeId: employeeId,
          companyId: companyId,
          company: {
            id: companyId,
            country: country,
            afterDecimal: settings.afterDecimal,
            timeOffset: settings.timeOffset,
            name:companyName,
            features: features
          }
        }
      }

      return { data: data, employee: isEmployeeExist.rows[0] }


    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async sendEmailToEmployee(employeeId: string, subject: string, body: string, htmlbody: boolean) {

    try {

      const query: { text: string, values: any } = {
        text: `SELECT "Employees".id,  "Employees".name,email, "Companies".name as "companyName", "Companies".slug as "companySlug", "apply2fa"
                    FROM "Employees" 
                    Inner join "Companies"  on "Employees"."companyId" = "Companies" .id
                    where "Employees".id =$1`,
        values: [employeeId]
      }

      const employeeData = await DB.excu.query(query.text, query.values);
      const employee: any = employeeData.rows[0];

      let email = new SesService();
      email.sender = employee.companyName + '<' + employee.companySlug + '@invopos.co>'
      email.receivers.push(employee.email);
      email.subject = subject;

      let res

      if (htmlbody === true) {
        email.htmlContent = body
        res = await email.sendHTMLEmail();
      } else {
        email.body = body
        res = await email.sendEmail();
      }

      if (res?.$metadata.httpStatusCode == 200) {
        return new ResponseData(true, "", employee)

      }

      return new ResponseData(false, "", employee)


    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async setEmployeeOptions(data: any, employeeId: string, companyId: string) {
    try {
      const query = {
        text: `with "employee" as (update "Employees" set "options" = $1 where id = $2 and "companyId" = $3 returning id ),
                "employeeGroups" as(update "CompanyEmployees" set "options" = $1 where "employeeId" = $2 and "companyId" = $3 returning "employeeId" as "id")
                select * from "employee"
                union
                                select * from "employeeGroups" 
        `,
        values: [data, employeeId, companyId]
      }

      await DB.excu.query(query.text, query.values)
      return new ResponseData(true,"",[])
    } catch (error) {
      throw error
    }
  }

  public static async getEmployeeOptions(
    employeeId: string,
    companyId: string
  ) {
    try {
      const query = {
        text: `
      select coalesce(
        (select "options"
         from "Employees"
         where id = $1 and "companyId" = $2
         limit 1),
        (select "options"
         from "CompanyEmployees"
         where "employeeId" = $1 and "companyId" = $2
         limit 1)
      ) as "options"
    `,
        values: [employeeId, companyId],
      };

      const result = await DB.excu.query(query.text, query.values);

      return new ResponseData(true, "", result.rows[0]?.options || null)
    } catch (error) {
      throw error
    }
  }
}
