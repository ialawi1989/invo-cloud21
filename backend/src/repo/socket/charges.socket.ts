import { Socket } from "socket.io";
import { BranchesRepo } from "../admin/branches.repo";



import { RedisClient } from "@src/redisClient";

import { DB } from "@src/dbconnection/dbconnection";
import { Surcharge } from "@src/models/account/Surcharge";
import { SocketController } from "@src/socket";
import { Helper } from "@src/utilts/helper";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";
export class SocketChargesRepo {
    static redisClient: RedisClient;
    public static async getCharges(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        let companyId;
        try {
            /**Begin Client */
            await dbClient.query("BEGIN")
            companyId = (await BranchesRepo.getBranchCompanyId(dbClient, branchId)).compayId;

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
                text: `SELECT "Surcharges".* 
                               FROM  "Surcharges" 
                               WHERE "companyId"=$1 `,
                values: [companyId]
            }

            if (date != null) {

                query.text = `SELECT * 
                                  FROM "Surcharges" 
                                  WHERE "companyId"=$1  AND ("updatedDate">=$2::timestamp) `
                query.values = [companyId, date]
            }
            const list = await dbClient.query(query.text, query.values);
            /**Commit Client */
            await dbClient.query("COMMIT")
            callback(JSON.stringify(list.rows))


        } catch (error: any) {
            /**RollBack Client */
            await dbClient.query("ROLLBACK")
          
            
            logPosErrorWithContext(error, data, branchId, companyId, "getCharges")

            callback(JSON.stringify(error.message))
            
        } finally {
            /**Release Client */
            dbClient.release()
        }
    }

    //TODO: LIVE SYNC

    public static async sendnewSurcharge(charge: Surcharge, branchIds: string) {
        try {

            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                const newData = await Helper.trim_nulls(charge);
                instance.io.of('/api').in(clientId).emit("newSurcharge", JSON.stringify(newData));
            }


        } catch (error: any) {
          
            logPosErrorWithContext(error, charge, null, null, "sendnewSurcharge")
            return null;
        }
    }
    public static async sendUpdatedSurcharge(charge: Surcharge, branchIds: string) {
        try {
            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                const newData = await Helper.trim_nulls(charge);
                instance.io.of('/api').in(clientId).emit("updateSurcharge", JSON.stringify(newData));
            }

        } catch (error: any) {
          
            logPosErrorWithContext(error, charge, null, null, "sendUpdatedSurcharge")

            return null;
        }
    }
}