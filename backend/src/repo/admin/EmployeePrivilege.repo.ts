import { DB } from "@src/dbconnection/dbconnection";
import { EmployeePrivileg } from "@src/models/admin/employeePrivielge";

import { ResponseData } from "@src/models/ResponseData";
import { PoolClient } from "pg";

import { POSprivielges } from "@src/models/admin/POSEmployeePrivielge";
import { ValidationException } from "@src/utilts/Exception";
import { BranchesRepo } from "./branches.repo";
import { SocketCustomerRepo } from "../socket/customer.socket";

export class EmployeePrivilegeRepo {

    public static async checkIfPrivilegeNameExist(client:PoolClient,id:string|null,name:string,companyId:string)
    {
        try {
            const query : { text: string, values: any } = {
                text: `SELECT count(*) as qty FROM "EmployeePrivileges" where LOWER(name) = LOWER($1) and id <> $2 and "companyId" = $3 `,
                values: [
                    name,
                    id,
                    companyId,
                  
    
                ],
            };
            if (id == null) {
                query.text = `SELECT count(*) as qty FROM public."EmployeePrivileges" where LOWER(name) = LOWER($1)  and "companyId" = $2 `;
                query.values = [name, companyId];
            }
    
            const resault = await client.query(query.text, query.values);
            if ((<any>resault.rows[0]).qty > 0) {
                return true;
            }
    
            return false;       
        } catch (error:any) {
          

             throw new Error(error.message)
        }
    }
    public static async savePrivilege(client:PoolClient,data:any,companyId:string){
        try {

            /**
             * TODO: VALIDATION 
             * name => not empty string 
             * privileges array => not empty 
             */
            const role = data;
            // role.ParseJson(data);
            role.companyId =companyId;
            const isNameExist = await this.checkIfPrivilegeNameExist(client,null,role.name,companyId)
            if(isNameExist)
            {
                throw new ValidationException("Role name already used")
            }
            role.updatedDate = new Date();

             const query : { text: string, values: any } ={
                text:`Insert Into "EmployeePrivileges" (name, "privileges","companyId","updatedDate") values($1,$2,$3,$4) Returning id`,
                values:[role.name,JSON.stringify(role.privileges),role.companyId,role.updatedDate]
             }
             
             const insertRole = await client.query(query.text,query.values);
             role.id = (<any>insertRole.rows[0]).id

           
              
             
             return new ResponseData(true,"",{id:(  role.id ) ,role:role})
        } catch (error:any) {
          

             throw new Error(error.message)
        }
    }
    public static async editPrivilege(client:PoolClient,data:any,companyId:string){
        try {
            const role = data;
            // role.ParseJson(data);
            role.companyId =companyId;

            const isNameExist = await this.checkIfPrivilegeNameExist(client,role.id,role.name,companyId)
            if(isNameExist)
            {
                throw new ValidationException("Role name already used")
            }
            role.updatedDate = new Date();
             const query : { text: string, values: any } = {
                text:`UPDATE  "EmployeePrivileges" SET name =$1 ,"privileges"=$2,"updatedDate"=$3 WHERE id=$4`,
                values:[role.name,JSON.stringify(role.privileges),role.updatedDate,role.id]
             }
             
             const insertRole = await client.query(query.text,query.values);
           
             return new ResponseData(true,"",{role:role})
        } catch (error:any) {
          

             throw new Error(error.message)
        }
    }

    public static async getEmployeePrivileges(data:any,companyId:string)
    {
      try {

        let searchTerm;
        let value ;

        let sort: any;

        let sortValue;
        let sortDirection;
        let sortTerm;

        let offset;
        let count ;
        let limit;
        let roles;
        let lastIndex;
        let pageCount;
        let query={
            text:`SELECT id,name from "EmployeePrivileges" where "companyId"=$1 
            `,
            values:[companyId],
        }

         value =` `
        roles = await DB.excu.query(query.text,query.values);
        if(data!=null&&data!=""&&JSON.stringify(data)!='{}'){
             searchTerm = data.searchTerm;
             if(data.searchTerm)
             {
                value = '%' + data.searchTerm.trim().toLowerCase() + '%'

             }
    
             sort = data.sortBy;
    
             sortValue = !sort ? '"EmployeePrivileges"."createdAt"' : '"' + sort.sortValue + '"';
             sortDirection = !sort ? "DESC" : sort.sortDirection;
             sortTerm = sortValue + " " + sortDirection
    
             offset = data.page - 1
             count = 0;
             limit = ((data.limit == null) ? 15 : data.limit);
             if (data.page != 1) {
                offset = (limit * (offset))
            }

            const countQuery = {
                text: `select count(*)
                from "EmployeePrivileges" WHERE "companyId"=$1 `,
                values: [companyId]
            }
    
            if (searchTerm != null && searchTerm != "") {
                countQuery.text = `select count(*)
                from "EmployeePrivileges" WHERE "companyId"=$1 and LOWER(name) like $2`;
                countQuery.values = [companyId, value];
            }
              
        const countData = await DB.excu.query(countQuery.text, countQuery.values);
        count = (<any>countData.rows[0]).count;
         pageCount = Math.ceil(count / data.limit)

        
        query={
            text:`SELECT id,name from "EmployeePrivileges" where "companyId"=$1  order by`+sortTerm+`
            limit $2
            offset $3
            `,
            values:[companyId,limit,offset],
        }

  
        if(searchTerm!=null&& searchTerm!=""){
            query.text=`SELECT id,name from "EmployeePrivileges" where "companyId"=$1 and LOWER(name) like $2 order by `+sortTerm;
            query.values=[companyId,value]
        }
         roles = await DB.excu.query(query.text,query.values);
    
        offset += 1
         lastIndex = ((data.page) * data.limit)
        if (roles.rows.length < data.limit || data.page == pageCount) {
            lastIndex = count

        }
        }
      
        const resData = {
            list: roles.rows,
            count: +count,
            pageCount: pageCount,
            startIndex: offset,
            lastIndex: lastIndex
        }

        // let extra = await POSprivielges.getEmployeePrivielges(companyId);

        return new ResponseData(true,"",resData)

        // return {success:true,msg:"",data:resData,extraData : extra.data}
    } catch (error:any) {
      

         throw new Error(error.message)
      }

    }
    public static async getEmployeePrivilegeById(employeePrivilegeid:string)
    {
      try {
        const query={
            text:`SELECT id,name, "privileges" from "EmployeePrivileges" where "id"=$1`,
            values:[employeePrivilegeid],
        }

        const role = await DB.excu.query(query.text,query.values);
        const privilege = new EmployeePrivileg();
        // privilege.ParseJson(role.rows[0])

  
        return new ResponseData(true,"",role.rows[0])
    } catch (error:any) {
      

         throw new Error(error.message)
      }

    }
    public static async getEmployeePrivilageByEmployeeId(employeeId:string)
    {
        try {
            const query : { text: string, values: any } = {
                text:`SELECT "privileges" FROM "Employees" 
                      INNER JOIN "EmployeePrivileges" 
                      ON "EmployeePrivileges".id = "Employees"."privilegeId"
                      where "Employees".id = $1`,
                values:[employeeId]
            }

            const data = await DB.excu.query(query.text,query.values);
            return (<any> data.rows[0]).privileges
        } catch (error:any) {
          

             throw new Error(error.message)
        }
    }
}