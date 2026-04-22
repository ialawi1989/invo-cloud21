import { Socket } from "socket.io";
import { BranchesRepo } from "../admin/branches.repo";
import { TaxesRepo } from "../app/accounts/taxes.repo";


import { SocketController } from "@src/socket";
import { RedisClient } from "@src/redisClient";
import { Helper } from "@src/utilts/helper";
import { Tax } from "@src/models/account/Tax";
import { DB } from "@src/dbconnection/dbconnection";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";
export class SocketTaxRepo {
    static redisClient: RedisClient;
    public static async getTax(client: Socket, data: any, branchId: string, callback: CallableFunction) {
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

            const taxes = await TaxesRepo.getTaxes(dbClient, companyId, date)

            callback(JSON.stringify(taxes.data))
            /**Commit Client */
            await dbClient.query("COMMIT")

        } catch (error: any) {
            /**ROLLBACK Client */
            await dbClient.query("ROLLBACK")

       
         

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, companyId, "getTax")
        } finally {
            /**Release Client */
            dbClient.release()
        }
    }

    /** SEND NEW/UPDATED TAX LIVE SYNC */
    public static async sendNewTax(branchIds: [string], tax: Tax) {
        try {

            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = await RedisClient.getRedisClient()
            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                const newData = await Helper.trim_nulls(tax);

                instance.io.of('/api').in(clientId).emit("newTax", JSON.stringify(newData));
            }


           } catch (error:any) {
          
            
             return  null;
           }
    }
    public static async sendUpdatedTax(branchIds: [string], tax: Tax) {
        try {

            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                const newData = await Helper.trim_nulls(tax);

                instance.io.of('/api').in(clientId).emit("updateTax", JSON.stringify(newData));

            }


        
           } catch (error:any) {
          
             return  null;
           }
    }
}