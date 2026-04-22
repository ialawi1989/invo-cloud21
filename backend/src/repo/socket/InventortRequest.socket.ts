import { Socket } from "socket.io";

import { BranchesRepo } from "../admin/branches.repo";
import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { InventoryRequest, InventoryRequestLine } from "@src/models/account/InventoryRequest";
import { PoolClient } from "pg";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";


export class SocketInventoryRequestRepo {
    public static async getSuppliers(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();

        try {
            await dbClient.query("BEGIN")
            const companyId: any = (await BranchesRepo.getBranchCompanyId(dbClient, branchId)).compayId;

            let date;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }

            const query: { text: string, values: any } = {
                text: `SELECT id,name from "Suppliers" where "companyId"=$1`,
                values: [companyId]
            }

            if (date != null) {
                query.text = `SELECT id,name from "Suppliers" where "companyId"=$1 and "updatedDate" >=$2`
                query.values = [companyId, date]
            }

            let suppliers = await dbClient.query(query.text, query.values);
            callback(JSON.stringify(suppliers.rows))
            await dbClient.query("COMMIT")

        } catch (error: any) {
            await dbClient.query("ROLLBACK")

       
         

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "getSuppliers")
        } finally {
            dbClient.release()
        }
    }

    public static async saveInventoryRequest(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dBClient = await DB.excu.client();
        try {

            await dBClient.query("BEGIN")


            if (data) {
                data = JSON.parse(data);
            }



            const element = data
            element.branchId = branchId

            if (element.id != null && element.id != "") {
                await this.editRequestInventory(dBClient, element);

            }
            else {

                await this.insertInventoryRequest(dBClient, element);

            }




            await dBClient.query("COMMIT")

            callback(JSON.stringify({ success: true }))


        } catch (error: any) {
            await dBClient.query("ROLLBACK")
            console.log("error", error)
       
         ;
            callback(JSON.stringify({ success: false, error: error.message }))
            logPosErrorWithContext(error, data, branchId, null, "saveInventoryRequest")
        } finally {
            dBClient.release()
        }
    }

    public static async insertInventoryRequest(client: PoolClient, data: any) {
        try {

            const request = new InventoryRequest();
            request.ParseJson(data);
            request.createdAt = new Date()
            const query: { text: string, values: any } = {
                text: `INSERT INTO "InventoryRequests" ("createdAt","branchId","employeeId") VALUES ($1,$2,$3) returning id`,
                values: [request.createdAt, request.branchId, request.employeeId]
            }

            let insert = await client.query(query.text, query.values);
            request.id = (<any>insert.rows[0]).id

            for (let index = 0; index < request.lines.length; index++) {
                const element = request.lines[index];
                element.requestId = request.id
                await this.saveLines(client, element)


            }

            return new ResponseData(true, "", { id: request.id })
        } catch (error: any) {

            throw new Error(error)
        }
    }


    public static async editRequestInventory(client: PoolClient, data: any) {

        try {

            const request = new InventoryRequest()
            request.ParseJson(data)


            //   const query : { text: string, values: any } = {
            //     text: `UPDATE "InventoryRequests" SET "branchId"=$1


            //                                                   WHERE id=$2`,
            //     values: [request.branchId, request.id]
            //   }

            //   let insert = await DB.excu.query(query.text, query.values);
            for (let index = 0; index < request.lines.length; index++) {
                const element = request.lines[index];

                if (element.id != "" && element.id != null) {
                    await this.editLines(client, element)

                } else {
                    element.requestId = request.id;
                    await this.saveLines(client, element)
                }

            }


            return new ResponseData(true, "", { id: request.id })
        } catch (error: any) {

            console.log(error)
            throw new Error(error)
        }
    }
    public static async editLines(client: PoolClient, line: InventoryRequestLine) {
        try {

            const query: { text: string, values: any } = {
                text: `UPDATE "InventoryRequestLines" SET "productId"=$1,"supplierId"=$2,"priority"=$3,qty=$4 where id=$5`,
                values: [line.productId, line.supplierId, line.priority, line.qty, line.id]
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async saveLines(client: PoolClient, line: InventoryRequestLine) {
        try {
            const query: { text: string, values: any } = {
                text: `INSERT INTO "InventoryRequestLines" ("productId","supplierId","priority","requestId","qty") VALUES($1,$2,$3,$4,$5)`,
                values: [line.productId, line.supplierId, line.priority, line.requestId, line.qty]
            }

            await client.query(query.text, query.values)
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    public static async getInventoryRequests(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        try {

            await dbClient.query("BEGIN")
            const query: { text: string, values: any } = {
                text: `select "InventoryRequests".*,
                              "Employees".name as "employeeName"
                    from "InventoryRequests"
                       INNER JOIN "Employees" on "Employees".id = "InventoryRequests"."employeeId"

                      where "InventoryRequests"."branchId"=$1`,
                values: [branchId]
            }

            let requests = await dbClient.query(query.text, query.values)



            let temps: any[] = [];
            for (let index = 0; index < requests.rows.length; index++) {
                const element = requests.rows[index]
                let requestTemp = new InventoryRequest();
                requestTemp.ParseJson(element);
                query.text = `SELECT "InventoryRequestLines".*,
                                     "Suppliers".name as "supplierName"
                              fROM "InventoryRequestLines" 
                             left join "Suppliers" on   "Suppliers".id = "InventoryRequestLines" ."supplierId"
                            where "requestId" =$1`
                query.values = [element.id]
                requestTemp.lines = (await dbClient.query(query.text, query.values)).rows;
                temps.push(requestTemp)
            }




            callback(JSON.stringify(temps))
            await dbClient.query("COMMIT")

        } catch (error: any) {
            await dbClient.query("ROLLBACK")
            logPosErrorWithContext(error, data, branchId, null, "getInventoryRequests")

            throw new Error(error)

        } finally {
            dbClient.release()
        }
    }
}