import { Socket } from "socket.io";



import { ResponseData } from "@src/models/ResponseData";
import { DB } from "@src/dbconnection/dbconnection";
import { S3Storage } from "@src/utilts/S3Storage";
import { BranchesRepo } from "../admin/branches.repo";
import { PaymnetMethod } from "@src/models/account/PaymnetMethod";
import { SocketController } from "@src/socket";
import { RedisClient } from "@src/redisClient";
import { Helper } from "@src/utilts/helper";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";


export class SocketPaymentMethod {
    static redisClient: RedisClient;

    //TODO:ONE FUNCTION
    public static async getPaymentMethods(client: Socket, data: any, branchId: string, callback: CallableFunction) {
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


            const paymentMethods = await this.getPaymnetMethodListByBranchId(branchId, date);
            callback(JSON.stringify(paymentMethods.data))

        } catch (error: any) {
            console.log(error)
       
         
            callback(JSON.stringify(error.message))

            logPosErrorWithContext(error, data, branchId, null, "getPaymentMethods")
        }
    }
    public static async getPaymnetMethodListByBranchId(branchId: string, date: any | null) {
        let dbClient = await DB.excu.client();
        try {
            /**Begin Client */
            await dbClient.query("BEGIN")

            const companyId: any = (await BranchesRepo.getBranchCompanyId(dbClient, branchId)).compayId;

            const query: { text: string, values: any } = {
                text: `SELECT
            
                "PaymentMethods".*,
                "Media".url
                FROM "PaymentMethods" 
                LEFT JOIN "Media" on "Media".id = "PaymentMethods"."mediaId"
                where   "PaymentMethods"."companyId" = $1
         
                `,
                values: [companyId]
            }

            if (date != null && date != "") {
                query.text = `SELECT
             
                "PaymentMethods".*,
                "Media".url
                FROM "PaymentMethods" 
                LEFT JOIN "Media" on "Media".id = "PaymentMethods"."mediaId"
                where "PaymentMethods"."companyId" = $1
                and "PaymentMethods"."updatedDate"::timestamp>= $2::timestamp
                `;
                query.values = [companyId, date]
            }
            const list: any = await dbClient.query(query.text, query.values);

            for (let index = 0; index < list.rows.length; index++) {
                const element: any = list.rows[index];

                if (element.mediaId != null && element.mediaId != "" && element.url && element.url.defaultUrl) {
                    const mediaName = element.url.defaultUrl.substring(element.url.defaultUrl.lastIndexOf('/') + 1)
                    let imageData: any = await S3Storage.getThumbnailImageUrl(mediaName, element.companyId)
                    if (imageData) {
                        imageData = imageData.split(';base64,').pop();
                        list.rows[index].imageUrl = imageData
                    }

                }
            }
            /**Commit Client */
            await dbClient.query("COMMIT")


            return new ResponseData(true, "", list.rows)
        } catch (error: any) {
            /**RollBack Client */
            await dbClient.query("ROLLBACK")

          
            throw new Error(error.message)
        } finally {
            /**release client */
            dbClient.release()
        }
    }
    //Update/New Sync
    public static async sendNewPaymentMethod(paymentMethod: PaymnetMethod, branchIds: []) {
        try {



            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()

            if (paymentMethod.mediaId != null && paymentMethod.mediaId != "" && paymentMethod.mediaUrl.defaultUrl) {
                const mediaName = paymentMethod.mediaUrl.defaultUrl.substring(paymentMethod.mediaUrl.defaultUrl.lastIndexOf('/') + 1)

                let imageData: any = await S3Storage.getThumbnailImageUrl(mediaName, paymentMethod.companyId)

                if (imageData) {
                    imageData = imageData.split(';base64,').pop();
                    paymentMethod.imageUrl = imageData

                }

            }


            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                const newData = await Helper.trim_nulls(paymentMethod);

                instance.io.of('/api').in(clientId).emit("newPaymentMethod", JSON.stringify(newData));
            }

        } catch (error: any) {
          
            return null;
        }
    }
    public static async sendUpdatePaymentMethod(paymentMethod: PaymnetMethod, branchIds: []) {
        try {
            //send updated product
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()

            if (paymentMethod.mediaId != null && paymentMethod.mediaId != "" && paymentMethod.mediaUrl.defaultUrl) {
                const mediaName = paymentMethod.mediaUrl.defaultUrl.substring(paymentMethod.mediaUrl.defaultUrl.lastIndexOf('/') + 1)
                let imageData: any = await S3Storage.getThumbnailImageUrl(mediaName, paymentMethod.companyId)
                if (imageData) {
                    imageData = imageData.split(';base64,').pop();
                    paymentMethod.imageUrl = imageData
                }

            }


            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                const newData = await Helper.trim_nulls(paymentMethod);

                instance.io.of('/api').in(clientId).emit("updatePaymentMethod", JSON.stringify(newData));
            }

        } catch (error: any) {
          


            return null;
        }
    }

} 