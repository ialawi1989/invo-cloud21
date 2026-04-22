import { DB } from "@src/dbconnection/dbconnection"
import { EmployeePrivileg, Privilege } from "./employeePrivielge"
import { ResponseData } from "../ResponseData"
import { Helper } from "@src/utilts/helper"
import { BranchesRepo } from "@src/repo/admin/branches.repo"

export class inventoryAppPrivielges {
    
    "addNewPhysicalCounts"= true
    "viewPhysicalCounts"= true
    "addNewInventoryTransfer"= true
    "viewInventoryTransfer"= true



    ParseJson(json: any): void {
        for (const key in json) {
            for (const action in json[key].actions) {
                if (action in this) {
            
                    const access: any = json[key].actions[action].access
                    this[action as keyof typeof this] = access

                } else {
                    if (key == "inventoryPhysicalCountsSecurity") {
                        this["addNewPhysicalCounts"] = json[key].actions["add"].access
                        this["viewPhysicalCounts"] = json[key].actions["view"].access
                    }
                    if (key == "inventoryTransferSecurity") {
                        this["addNewInventoryTransfer"] = json[key].actions["add"].access
                        this["viewInventoryTransfer"] = json[key].actions["view"].access
                    }

                }
            }


        }
    }


    public static async getEmployeePrivielges(branchId: string) {
        const client = await DB.excu.client();
        try {
            /**intiate client */
            await client.query("BEGIN")
            const companyId: any = (await BranchesRepo.getBranchCompanyId(client,branchId)).compayId;

            const query : { text: string, values: any } = {
                text: `SELECT "EmployeePrivileges".id,
                              "EmployeePrivileges".name,
                              "EmployeePrivileges".privileges, 
                              "EmployeePrivileges"."createdAt",
                              "EmployeePrivileges"."updatedDate"
                                 FROM "EmployeePrivileges" 
                where "EmployeePrivileges"."companyId"  =$1
                    `,
                values: [companyId]
            }
            const privileges: any[] = [];
            const data = await client.query(query.text, query.values);

            for (let index = 0; index < data.rows.length; index++) {
                const element:any = data.rows[index];
                const privilege = new inventoryAppPrivielges();
                privilege.ParseJson(element.privileges)
                element.privileges = privilege
                privileges.push(element)

            }
               /**commit client */
            await client.query("COMMIT")

            return new ResponseData(true, "", privileges)
        } catch (error: any) {
               /**rollback client */
            await client.query("ROLLBACK")

            throw new Error(error)
        }finally{
              /**release client */
            client.release()
        }
    }


    public static async getEmployeePrivielgesByCompany(companyId: string) {
        try {
            const query : { text: string, values: any } = {
                text: `SELECT "EmployeePrivileges".id,
                              "EmployeePrivileges".name,
                              "EmployeePrivileges".privileges, 
                              "EmployeePrivileges"."createdAt",
                              "EmployeePrivileges"."updatedDate"
                                 FROM "EmployeePrivileges" 
                where "EmployeePrivileges"."companyId" =$1
                    `,
                values: [companyId]
            }
            const privileges: any[] = [];
            const data = await DB.excu.query(query.text, query.values);

            for (let index = 0; index < data.rows.length; index++) {
                const element:any = data.rows[index];
                const privilege = new inventoryAppPrivielges();
                privilege.ParseJson(element.privileges)
                element.privileges = privilege
                privileges.push(element)
            }
            
            return new ResponseData(true, "", privileges)
        } catch (error: any) {
            throw new Error(error)
        }
    }



    //inventoryTransferSecurity
    //inventoryPhysicalCountsSecurity
}