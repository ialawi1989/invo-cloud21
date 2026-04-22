import { Department } from "@src/models/product/Department";
import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { DepartmentValidation } from "@src/validationSchema/product/departmnet.Schema";


import { Company } from "@src/models/admin/company";
import { PoolClient } from "pg";
import { BranchesRepo } from "@src/repo/admin/branches.repo";
import { ValidationException } from "@src/utilts/Exception";

import { CategoryRepo } from "./category.repo";
export class DepartmentRepo {

  public static async checkDepartmentIdExist(client: PoolClient, departmentId: string, companyId: string) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Departments" where  id = $1 and "companyId" = $2 `,
      values: [
        departmentId,
        companyId
      ],
    };
    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }
  public static async checkDepartmentNameExist(client: PoolClient, id: string | null, name: string, companyId: string) {
    const query: { text: string, values: any } = {
      text: `SELECT count(*) as qty FROM "Departments" where id<> $1 and LOWER(name) = LOWER($2) and "companyId" = $3 `,
      values: [
        id,
        name,
        companyId

      ],
    };

    if (id == null) {
      query.text = `SELECT count(*) as qty FROM "Departments" where   LOWER(name) = LOWER($1) and "companyId" = $2 `
      query.values = [name, companyId]
    }
    const resault = await client.query(query.text, query.values);
    if ((<any>resault.rows[0]).qty > 0) {
      return true;
    }
    return false;
  }
  public static async updateTranslation(data: any) {
    try {
      const query: { text: string } = {
        text: `UPDATE "Departments" SET  translation=$2 WHERE id=$1;`
      }

      data.list.forEach(async (element: { id: any; translation: any; }) => {
        await DB.excu.query(query.text, [element.id, element.translation]);
      });

      return new ResponseData(true, "nope", [])
    } catch (error: any) {

      console.log(error);
    
      throw new Error(error)
    }
  }











  public static async getDepartment(departmentId: string, company: Company) {
    try {
      const companyId = company.id;
      const query: { text: string, values: any } = {
        text: 'SELECT * FROM "Departments"  WHERE id=($1) AND "companyId"=$2',
        values: [departmentId, companyId],
      };
      const department = await DB.excu.query(query.text, query.values);

      if (department.rowCount == 0) {
        throw new ValidationException("Not Found");
      }
      const departmentObject = new Department()
      departmentObject.ParseJson(department.rows[0]);
      return new ResponseData(true, "", departmentObject)
    } catch (error: any) {
    
      throw new Error(error)
    }

  }
  public static async listDepartment(company: Company) {
    try {
      const companyId = company.id;
      const query: { text: string, values: any } = {
        text: 'SELECT * FROM "Departments"  WHERE "companyId"=($1)',
        values: [companyId],
      };
      const departments = await DB.excu.query(query.text, query.values)

      const list: Department[] = [];

      departments.rows.forEach((element: any) => {
        const temp = new Department();
        temp.ParseJson(element);
        list.push(temp);
      });

      return new ResponseData(true, "Added Successfully", { list: list })
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async getDepartmentList(data: any, company: Company) {
    try {


      const companyId = company.id;

      let searchValue = data.searchTerm ? `^.*` + data.searchTerm.toLowerCase().trim() + `.*$` : '[A-Za-z0-9]*'

      let sort = data.sortBy;
      let sortValue = !sort ? '"createdAt"' : '"' + sort.sortValue + '"';
      let sortDirection = !sort ? " DESC " : sort.sortDirection;

      if (data.departmentId != null && data.departmentId != "") {
        sortValue = ` ("Departments".id = ` + "'" + data.departmentId + "'" + ` )`
      }
      let sortTerm = sortValue + " " + sortDirection;
      let orderByQuery = " ORDER BY " + sortTerm

      let offset = 0;
      let page = data.page ?? 1;
      const limit = ((data.limit == null) ? 15 : data.limit);
      if (page != 1) {
        offset = (limit * (page - 1))
      }
      const query = {
        text: `SELECT
        COUNT(*) OVER(),
                     name ,
                      id,
                    translation 
              FROM "Departments"
              where "companyId"=$1
                and (LOWER("Departments".name) ~ $2)
                ${orderByQuery}
                limit $3 offset $4`,
        values: [companyId, searchValue, limit, offset]
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
  public static async getDepartments(company: Company) {
    try {
      const companyId = company.id;
      const query: { text: string, values: any } = {
        text: `SELECT id,name, 
          (select json_agg(json_build_object('id', id , 'name', name )) AS categories from  "Categories" where "Categories"."departmentId" = "Departments".id)
                 FROM "Departments"  
                 WHERE "companyId"=($1)`,
        values: [companyId],
      };
      const departments = await DB.excu.query(query.text, query.values)
      const list: any[] = [];

      departments.rows.forEach((element: any) => {
        list.push(element);
      });

      return new ResponseData(true, "", list)
    } catch (error: any) {
    
      throw new Error(error)
    }
  }
  public static async addDepartment(client: PoolClient, data: any, company: Company) {
    try {
      const companyId = company.id
      const validate = await DepartmentValidation.departmentValidation(data);
      if (!validate.valid) {
        return new ResponseData(false, validate.error, null);
      }
      const department = new Department();
      department.ParseJson(data);
      department.companyId = companyId;

      const isDepartmentNameExist = await DepartmentRepo.checkDepartmentNameExist(client, null, department.name, department.companyId);
      if (isDepartmentNameExist) {
        throw new ValidationException("Department Name Already Used")
      }
      const query: { text: string, values: any } = {
        text: 'INSERT INTO "Departments"(name, "companyId","translation") VALUES($1, $2,$3) RETURNING id ',
        values: [department.name, department.companyId, department.translation],
      };
      const insert = await client.query(query.text, query.values);
      const departmentId = (<any>insert.rows[0]).id
      const resdata = {
        id: departmentId
      }
      return new ResponseData(true, "", resdata);
    } catch (error: any) {

    
      throw new Error(error);
    }
  }
  public static async editDepartment(data: any, company: Company) {
    const client = await DB.excu.client();
    try {
      const companyId = company.id;
      const validate = await DepartmentValidation.departmentValidation(data);
      if (!validate.valid) {
        return new ResponseData(false, validate.error, null);
      }

      if (data.id == null || data.id == "") {
        throw new ValidationException("Department id Is Required")
      }
      const department = new Department();
      department.ParseJson(data);
      department.companyId = companyId

      await client.query("BEGIN")
      const isDepartmentNameExist = await DepartmentRepo.checkDepartmentNameExist(client, department.id, department.name, department.companyId);
      if (isDepartmentNameExist) {
        throw new ValidationException("Department Name Already Used")
      }
      const query: { text: string, values: any } = {
        text: 'UPDATE  "Departments" SET name = ($1),"translation"=$2 WHERE "companyId"=($3) and id=($4) RETURNING id ',
        values: [department.name, department.translation, department.companyId, department.id],
      };
      const update = await DB.excu.query(query.text, query.values);
      await client.query("COMMIT")
      return new ResponseData(true, "Updated Successfully", null)
    } catch (error: any) {
      await client.query("ROLLBACK")
    
      throw new Error(error)
    } finally {
      client.release()
    }
  }
  public static async getDepartmentId(client: PoolClient, departmentName: string, companyId: string) {
    try {
      const query: { text: string, values: any } = {
        text: `select id from "Departments" where LOWER(name) = TRIM(LOWER($1)) and "companyId"=$2`,
        values: [departmentName, companyId]
      }
      const department = await client.query(query.text, query.values);
      if (department.rowCount != null && department.rowCount > 0) {
        return { id: (<any>department.rows[0]).id };
      } else {
        return { id: null };
      }

    } catch (error: any) {
    

      throw new Error(error.message)
    }
  }
  public static async getDepartmentCatogryIds(client: PoolClient, departmentId: string) {
    try {
      let categoryIds: any[] = []
      const query = {
        text: `SELECT id from "Categories" where "departmentId"=$1`,
        values: [departmentId]
      }

      let categories = await client.query(query.text, query.values);
      categories.rows.forEach((element: any) => {
        categoryIds.push(element.id)
      });
      return categoryIds
    } catch (error: any) {
      throw new Error(error)
    }
  }

  public static async deleteDepartments(departmentId: string) {
    const client = await DB.excu.client();
    try {
      await client.query("BEGIN")
      let categoryIds = await this.getDepartmentCatogryIds(client, departmentId);

      await CategoryRepo.unsetCategoriesProducts(client, categoryIds)

      const query = {
        text: `DELETE FROM "Categories" where "departmentId" =$1`,
        values: [departmentId]
      }

      await client.query(query.text, query.values);

      query.text = `DELETE FROM "Departments" where id=$1`
      await client.query(query.text, query.values)

      await client.query("COMMIT")
      return new ResponseData(true, "", [])
    } catch (error: any) {
      await client.query("ROLLBACK")
      console.log(error)

      throw new Error(error)
    } finally {
      client.release()
    }
  }


  //Socket
  public static async getDepartmentsByBranchId(branchId: string, date: any | null = null) {

    const client = await DB.excu.client();
    try {
      /**Begin */
      await client.query("BEGIN");
      const companyId: any = (await BranchesRepo.getBranchCompanyId(client, branchId)).compayId;

      const query: { text: string, values: any } = {
        text: `SELECT "Departments".* FROM "Departments"
              WHERE "Departments"."companyId" = $1 `,
        values: [companyId]
      }

      if (date != null) {
        query.text = `SELECT "Departments".* FROM "Departments" 
        WHERE "Departments"."companyId" = $1 and ("Departments"."createdAt">=$2 or "Departments"."updatedDate">=$2)`
        query.values = [companyId, date]
      }

      const list = await client.query(query.text, query.values);
      /**Commit */
      await client.query("COMMIT")
      return new ResponseData(true, "", list.rows)
    } catch (error: any) {
      /**RollBack */
      await client.query("ROLLBACK")
    

      throw new Error(error)
    } finally {
      /**Release */
      client.release();
    }


  }



}