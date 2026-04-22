import { Discount } from "@src/models/account/Discount";
import { Socket } from "socket.io";
import { DiscountRepo } from "../app/accounts/discount.repo";

import { SocketController } from "@src/socket";
import { Helper } from "@src/utilts/helper";
import { RedisClient } from "@src/redisClient";


import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { BranchesRepo } from "../admin/branches.repo";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";
export class SocketDiscount {
    static redisClient: RedisClient;

    constructor() {
    }

    public static async sendnewDiscount(discount: Discount, branchIds: []) {
        try {

            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                const newData = await Helper.trim_nulls(discount);
                instance.io.of('/api').in(clientId).emit("newDiscount", JSON.stringify(newData));
            }


        } catch (error: any) {
          
            return null;
        }
    }
    public static async sendUpdatedDiscount(discount: Discount, branchIds: []) {
        try {
            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);

                // const newData = await Helper.trim_nulls(discount);
                // console.log(newData)
                instance.io.of('/api').in(clientId).emit("updateDiscount", JSON.stringify(discount));
            }

        } catch (error: any) {
          


            return null;
        }
    }


    //TODO: ONE FUNCTION 
    public static async getDiscounts(client: Socket, data: any, branchId: string, callback: CallableFunction) {
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


            const discounts = await this.getDiscountListByBranchId(branchId, date)
            callback(JSON.stringify(discounts.data))

        } catch (error: any) {
          
            


            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "getDiscounts")
        }
    }
    public static async getDiscountListByBranchId(branchId: string, date: any | null = null) {

        const client = await DB.excu.client()
        try {
            /**Intiate Client */
            await client.query("BEGIN")
            const companyId: any = (await BranchesRepo.getBranchCompanyId(client, branchId)).compayId;
            const branches = `["${branchId}"]`

            const query: { text: string, values: any } = {
                text: `SELECT 
                            "Discounts".id,
                            "Discounts".amount,
                            "Discounts"."name",
                            "Discounts".percentage,
                            "Discounts"."permittedEmployees",
                            "Discounts"."taxId",
                            "Discounts"."startDate",
                                       "Discounts"."quantityBasedCashDiscount",
                            "Discounts"."expireDate",
                                 "Discounts"."startAtTime",
                         "Discounts"."expireAtTime",
                            "Discounts"."type",
                            "Discounts"."minProductQty",
                            "Discounts"."applyTo",
                                   case when  ("branches" @> $2::jsonb) and "type" = 'automatic' then "Discounts"."available" 
							 when ("branches" <@ $2::jsonb) and "type" = 'automatic' then false 
							 when "type" = 'manual'  or "type" is null then true  
                             else false
							 end as "available",
                            "Discounts"."items"
                         FROM  "Discounts" 
                         where "Discounts"."companyId" = $1
           
                         `,
                values: [companyId, branches]
            }

            if (date != null) {

                query.text = `SELECT 
                    "Discounts".id,
                    "Discounts".amount,
                    "Discounts"."name",
                    "Discounts".percentage,
                    "Discounts"."permittedEmployees",
                    "Discounts"."taxId",
                    "Discounts"."startDate",
                    "Discounts"."expireDate",
                    "Discounts"."quantityBasedCashDiscount",
                    "Discounts"."type",
                         "Discounts"."startAtTime",
                         "Discounts"."expireAtTime",
                    "Discounts"."minProductQty",
                    "Discounts"."applyTo",
                          case when  ("branches" @> $3::jsonb) and "type" = 'automatic' then "Discounts"."available" 
							 when ("branches" <@ $3::jsonb) and "type" = 'automatic' then false 
							 when "type" = 'manual'  or "type" is null then true  
                             else false
							 end as "available",
                    "Discounts"."items"
                    FROM "Discounts"
                    where "Discounts"."companyId" = $1
                    AND ("Discounts"."updatedDate"::timestamp>=$2::timestamp )
                          `
                query.values = [companyId, date, branches]
            }
            const list = await client.query(query.text, query.values);
            /**Commit Client */
            await client.query("COMMIT")

            return new ResponseData(true, "", list.rows)
        } catch (error: any) {
            /**ROLLBACK Client */
            await client.query("ROLLBACK")


          
            throw new Error(error.message)
        } finally {
            /**Release Client */
            client.release()
        }
    }
}