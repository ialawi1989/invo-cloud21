import { KitchenSection } from "@src/models/product/KitchenSection";
import { Socket } from "socket.io";


import { SocketController } from "@src/socket";
import { Helper } from "@src/utilts/helper";
import { RedisClient } from "@src/redisClient";


import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { BranchesRepo } from "../admin/branches.repo";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";
export class SocketKitchenSection {
    static redisClient: RedisClient;

    constructor() {
    }


    public static async sendnewKitchenSection(kitchenSection: KitchenSection, branchIds: []) {
        try {

            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                const newData = await Helper.trim_nulls(kitchenSection);
                instance.io.of('/api').in(clientId).emit("newKitchenSection", JSON.stringify(newData));
            }
        } catch (error: any) {

       
            return null;
        }
    }
    public static async sendUpdatedKitchenSection(kitchenSection: KitchenSection, branchIds: []) {
        try {

            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                const newData = await Helper.trim_nulls(kitchenSection);
                instance.io.of('/api').in(clientId).emit("updateKitchenSection", JSON.stringify(newData));
            }
        } catch (error: any) {
       
            return null;
        }
    }

    //TODO: ONE FUNCTION
    public static async getKitchenSections(client: Socket, data: any, branchId: string, callback: CallableFunction) {
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


            const kitchenSection = await this.getKitchenSectionList(branchId, date)

            callback(JSON.stringify(kitchenSection.data))


        } catch (error: any) {

       
         

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, branchId, null, "getKitchenSections")
            return error
        }
    }
    public static async getKitchenSectionList(branchId: string, date: any | null = null) {
        const client = await DB.excu.client();
        try {
            /**Intiate Client */
            await client.query("BEGIN");
            const companyId: any = (await BranchesRepo.getBranchCompanyId(client, branchId)).compayId;

            const query: { text: string, values: any } = {
                text: `SELECT "KitchenSections".* FROM "KitchenSections"
            WHERE  "KitchenSections"."companyId" =$1`,
                values: [companyId]
            }
            if (date != null && date != "") {
                query.text = `SELECT "KitchenSections".* FROM "KitchenSections"
                                    WHERE  "KitchenSections"."companyId" =$1
                                    AND ("KitchenSections"."updatedDate">=$2 or "KitchenSections"."createdAt">=$2) `;
                query.values = [companyId, date]
            }
            const list = await client.query(query.text, query.values);
            /**COMMIT Client */
            await client.query("COMMIT");
            return new ResponseData(true, "", list.rows)
        } catch (error: any) {
            /**ROLLBACK Client */
            await client.query("ROLLBACK");
       
            throw new Error(error)
        } finally {
            /**RELEASE Client */
            client.release()
        }
    }
}