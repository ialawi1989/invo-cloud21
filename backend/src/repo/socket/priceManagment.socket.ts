import { Socket } from "socket.io";



import { ResponseData } from "@src/models/ResponseData";
import { DB } from "@src/dbconnection/dbconnection";
import { BranchesRepo } from "../admin/branches.repo";
import { SocketController } from "@src/socket";

import { Helper } from "@src/utilts/helper";
import { RedisClient } from "@src/redisClient";
import { PriceLabel } from "@src/models/product/PriceLabel";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";

export class SocketPriceManagment {
    static redisClient: RedisClient;
    //TODO:one function
    public static async getPriceLabelByBranchId(branchId: string, date: any | null = null) {
        const client = await DB.excu.client();
        try {
            /**Begin */
            await client.query("BEGIN");

            const companyId: any = (await BranchesRepo.getBranchCompanyId(client, branchId)).compayId;

            const query: { text: string, values: any } = {
                text: `select   "PriceLabels".*
                           from "PriceLabels" 
                           where "PriceLabels"."companyId" =$1`,
                values: [companyId]
            }
            if (date != null && date != "") {
                query.text = `select   "PriceLabels".*
                                    from "PriceLabels" 
                                    where "PriceLabels"."companyId" =$1 and "PriceLabels"."updatedDate"::timestamp>=$2::timestamp`,
                    query.values = [companyId, date]
            }
            const managment = await client.query(query.text, query.values);
            /**Commit */
            await client.query("COMMIT");
            return new ResponseData(true, "", managment.rows)

        } catch (error: any) {
       
            /**RollBack */
            await client.query("ROLLBACK");

            throw new Error(error)
        } finally {
            /**Release */
            client.release()
        }
    }
    public static async getPriceLabels(client: Socket, data: any, branchId: string, callback: CallableFunction) {
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


            const priceLabel = await this.getPriceLabelByBranchId(branchId, date);

            callback(JSON.stringify(priceLabel.data))

        } catch (error: any) {

       

         ;

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "getPriceLabels")

        }
    }



    public static async getPriceManagment(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {

            if (data) {
                data = JSON.parse(data)
            }
            if (data.date == null || data.date == "") {
                const priceLabel = await this.getPriceManagmentByBranchId(branchId);
                callback(JSON.stringify(priceLabel.data))
            } else {

                const date = new Date()
                date.setTime(data.date);

                const priceLabel = await this.getPriceManagmentByBranchId(branchId, date);
                callback(JSON.stringify(priceLabel.data))
            }
        } catch (error: any) {
            console.log(error)
       
         ;

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "getPriceManagment")
        }
    }
    public static async getPriceManagmentByBranchId(branchId: string, date: any | null = null) {
        try {

            const query: { text: string, values: any } = {
                text: `select title,
                          repeat,
                          "priceLabelId",
                          "branchIds",
                          "fromDate",
                          "toDate",
                          "chargeId",
                          "discountId" 
                          from "PriceManagement", jsonb_to_recordset(menu."branchIds") as "branchIds"("branchId" uuid)
                          WHERE "branchIds"."branchId" =$1`,
                values: [branchId]
            }

            const managment = await DB.excu.query(query.text, query.values);
            return new ResponseData(true, "", managment.rows)
        } catch (error: any) {
       

            throw new Error(error)
        }
    }

    //Update/New Sync
    public static async sendnewPriceLabel(priceLabel: PriceLabel, branchIds: string) {
        try {

            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()


            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);

                const newData = await Helper.trim_nulls(priceLabel);
                instance.io.of('/api').in(clientId).emit("newPriceLabel", JSON.stringify(newData));
            }


        } catch (error: any) {
            console.log(error)
       
            return null;
        }
    }
    public static async sendUpdatedPriceLabel(priceLabel: PriceLabel, branchIds: string) {
        try {
            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                const newData = await Helper.trim_nulls(priceLabel);
                instance.io.of('/api').in(clientId).emit("updatePriceLabel", JSON.stringify(newData));
            }

        } catch (error: any) {
       

            console.log(error)
            return null;
        }
    }
}