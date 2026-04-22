import { Service } from "@src/models/Settings/service"
import { Socket } from "socket.io"

import { SocketController } from "@src/socket";
import { Helper } from "@src/utilts/helper";
import { RedisClient } from "@src/redisClient";

import { ResponseData } from "@src/models/ResponseData";
import { DB } from "@src/dbconnection/dbconnection";
import { BranchesRepo } from "../admin/branches.repo";
import { S3Storage } from "@src/utilts/S3Storage";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";
export class SocketService {
    static redisClient: RedisClient;


    //TODO:ONE FUNCTION
    public static async getServices(client: Socket, data: any, branchId: string, callback: CallableFunction) {
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



            const services = await this.getBranchServices(branchId, date)
            callback(JSON.stringify(services.data))




        } catch (error: any) {
          
            callback(JSON.stringify(error.message))
            
            logPosErrorWithContext(error, data, branchId, null, "getServices")

        }
    }
    public static async getBranchServices(branchId: string, date: any | null = null) {
        const dbClient = await DB.excu.client()
        try {
            /**Intiate Client */
            await dbClient.query("BEGIN")
            const companyId: any = (await BranchesRepo.getBranchCompanyId(dbClient, branchId)).compayId;

            const query: { text: string, values: any } = {
                text: `with "servies" as (Select id,
                                                    name,
                                                    type,
                                                    index,
                                                    translation,
                                                    branch->>'priceLabelId' as "priceLabelId",
                                                    branch->>'chargeId' as "chargeId",
                                                    (branch->>'setting')::json as setting,
                                                    "companyId",
                                                    "isDeleted",
                                                    "menuId",
                                                    "mediaId",
                                                    "options"
                                from "Services",json_array_elements(branches) with ordinality arr(branch, position)
                                where "companyId" = $1 and branch->>'branchId' = $2
                                )
                            select  "servies".*,
                            "Media".url 
                            from "servies" 
                            left join "Media" on "Media".id = "servies"."mediaId"
                `,
                values: [companyId, branchId]
            }

            if (date != null) {
                query.text = `

                with "servies" as ( Select id,
                                            name,
                                            type,
                                            index,
                                            translation,
                                            branch->>'priceLabelId' as "priceLabelId",
                                            branch->>'chargeId' as "chargeId",
                                            (branch->>'setting')::json as setting,
                                            "companyId",
                                            "isDeleted",
                                            "menuId",
                                            "mediaId",
                                            "options"
                                    from "Services",json_array_elements(branches) with ordinality arr(branch, position)
                                    where "companyId" = $1 and branch->>'branchId' = $2
                                    AND "updatedDate" >= $3
                                    )
                                select  "servies".*,
                                "Media".url 
                                from "servies" 
                                left join "Media" on "Media".id = "servies"."mediaId"
               `
                query.values = [companyId, branchId, date]
            }
            const services = await dbClient.query(query.text, query.values)
            for (let index = 0; index < services.rows.length; index++) {
                const element = services.rows[index];


                if (element.mediaId != null && element.mediaId != "" && element.url.defaultUrl) {
                    const mediaName = element.url.defaultUrl.substring(element.url.defaultUrl.lastIndexOf('/') + 1)
                    let imageData: any = await S3Storage.getImageUrl(mediaName, element.companyId)
                    if (imageData) {
                        imageData = imageData.split(';base64,').pop();
                        services.rows[index].imageUrl = imageData
                    }

                }


            }
            /**Commit Client */

            await dbClient.query("COMMIT");

            return new ResponseData(true, "", services.rows)
        } catch (error: any) {

            /**RollBack Client */
            await dbClient.query("ROLLBACK");

          

            throw new Error(error)
        } finally {
            /**Release Client */
            dbClient.release()
        }
    }

    public static async sendNewService(service: Service) {
        try {

            //send updated product
            this.redisClient = await RedisClient.getRedisClient()
            const instance = SocketController.getInstance();
            for (let index = 0; index < service.branches.length; index++) {

                const element: any = service.branches[index];
                if (!element.setting.enabled) {
                    continue;
                }
                let serviceTemp = new Service();
                serviceTemp.ParseJson(service);

                serviceTemp.setting = element.setting;
                serviceTemp.branches = [];
                serviceTemp.chargeId = element.chargeId
                serviceTemp.priceLabelId = element.priceLabelId
                const clientId: any = await this.redisClient.get("Socket" + element.branchId);
                const newData = await Helper.trim_nulls(serviceTemp);

                instance.io.of('/api').in(clientId).emit("newService", JSON.stringify(newData));
            }


        } catch (error: any) {
          
            return null;
        }
    }
    public static async sendupdatedService(service: Service) {
        try {

            //send updated product
            this.redisClient = await RedisClient.getRedisClient()
            const instance = SocketController.getInstance();
            for (let index = 0; index < service.branches.length; index++) {
                const element: any = service.branches[index];
                let serviceTemp = new Service();
                serviceTemp.ParseJson(service);
                if (!element.setting.enabled) {
                    continue;
                }
                serviceTemp.setting = element.setting
                serviceTemp.branches = [];
                serviceTemp.chargeId = element.chargeId
                serviceTemp.priceLabelId = element.priceLabelId
                const clientId: any = await this.redisClient.get("Socket" + element.branchId);
                const newData = await Helper.trim_nulls(serviceTemp);

                instance.io.of('/api').in(clientId).emit("updateService", JSON.stringify(newData));
            }

        } catch (error: any) {
          
            return null;
        }
    }



}