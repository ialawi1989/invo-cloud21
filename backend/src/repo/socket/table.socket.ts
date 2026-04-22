
import { Socket } from 'socket.io'
import { TablesRepo } from '../app/settings/tables.repo';
import { SocketController } from '@src/socket';
import { Helper } from '@src/utilts/helper';
import { RedisClient } from '@src/redisClient';



import { CompanyRepo } from '../admin/company.repo';
import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { logPosErrorWithContext } from '@src/middlewear/socketLogger';
export class SocketTableRepo {
    static redisClient: RedisClient;



    /** SEND UPDATED/NEW TABLE LIVE SYNC */
    public static async sendNewTable(tableGroup: [], branchId: string) {
        try {
            // const table = await TablesRepo.getEditedTableGroupbyId(branchId, tableGroupIds);
            //send new  product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            const clientId: any = await this.redisClient.get("Socket" + branchId);
            const newData = await Helper.trim_nulls(tableGroup);
            instance.io.of('/api').in(clientId).emit("newTable", JSON.stringify(newData));

        } catch (error: any) {
          
            return null;
        }
    }
    public static async sendUpdatedTable(tableGroup: [], branchId: string) {
        try {

            // const table = await TablesRepo.getEditedTableGroupbyId(branchId, tableGroupIds);
            this.redisClient = RedisClient.getRedisClient()
            //send updated product
            const instance = SocketController.getInstance();
            const clientId: any = await this.redisClient.get("Socket" + branchId);
            const newData = await Helper.trim_nulls(tableGroup);

            instance.io.of('/api').in(clientId).emit("updateTable", JSON.stringify(newData));

        } catch (error: any) {
       
            return null;
        }
    }

    //TODO:ONE FUNCTION
    public static async getTables(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {
            let date;
            if (data) {
                data = JSON.parse(data)
                if (data.date != null && data.date != "") {
                    const currentDate = new Date()
                    currentDate.setTime(data.date);
                    date = currentDate;
                }
            }


            const tables = await this.getTablesByBranch(branchId, date)

            callback(JSON.stringify(tables.data))


        } catch (error: any) {
            callback(JSON.stringify(error.message))

            logPosErrorWithContext(error, data, branchId, null, "getTables")
        }
    }
    public static async getTablesByBranch(branchId: string, date: any | null = null) {
        try {
            const query: { text: string, values: any } = {
                text: `with "tableGroups" as (
                select * from "TableGroups" 
                WHERE "TableGroups"."branchId" =$1
                ), "tables" as (
                    select "tableGroups".id,
                      json_agg(json_build_object('id',"Tables".id,'maxSeat', "maxSeat" ,  'image', "Tables".image, 'name',"Tables".name ,'properties',"Tables".properties,'settings',"Tables"."settings")) AS tables 
                from "Tables" 
                inner join "tableGroups" on "tableGroups".id = "Tables"."tableGroupId"
                group by "tableGroups".id
                )
                select "tableGroups".*,
                        "tables"."tables"
                from "tableGroups"
                inner join "tables" on  "tables".id = "tableGroups".id
              `,
                values: [branchId]
            }

            if (date != null && date != "") {
                query.text = ` with "tableGroups" as (
                select * from "TableGroups" 
                WHERE "TableGroups"."branchId" =$1	
                AND("TableGroups"."updatedDate"::timestamp >= ($2)::timestamp)
                ), "tables" as (
                    select "tableGroups".id,
                      json_agg(json_build_object('id',"Tables".id,'maxSeat', "maxSeat" ,  'image', "Tables".image, 'name',"Tables".name ,'properties',"Tables".properties,'settings',"Tables"."settings")) AS tables 
                from "Tables" 
                inner join "tableGroups" on "tableGroups".id = "Tables"."tableGroupId"
                group by "tableGroups".id
                )
                select "tableGroups".*,
                        "tables"."tables"
                from "tableGroups"
                inner join "tables" on  "tables".id = "tableGroups".id`
                query.values = [branchId, date]
            }
            const tables = await DB.excu.query(query.text, query.values);
            const data = tables.rows

            return new ResponseData(true, "", data);
        } catch (error: any) {
     
          throw new Error(error);
        }
    }

    /** RETURN HIDE TABLES */
    public static async getDeletedTables(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {

            const query = {
                text: `SELECT id FORM "Tables" where "branchId"=$1 and "companyGroupId" is null`,
                values: [branchId]
            }

            let tables = await DB.excu.query(query.text, query.values);
            callback(JSON.stringify(tables.rows))
        } catch (error:any) {
       
         

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "getDeletedTables")
        }
    }
    //TODO: DELETE THIS NO LONGER USED
    public static async getTableQR(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {


            let slug = await CompanyRepo.getCompanySlug(branchId);
            let tableId = data;
            let url = '/v1/ecommerce/' + slug + "/load/" + branchId + '/' + tableId
            callback(url)


        } catch (error: any) {
            callback(JSON.stringify(error.message))
            console.log(error)
          
            logPosErrorWithContext(error, data, branchId, null, "getTableQR")

        }
    }
}