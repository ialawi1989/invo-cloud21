import { Option } from "@src/models/product/Option";
import { OptionGroup } from "@src/models/product/OptionGroup";
import { Socket } from "socket.io";


import { SocketController } from "@src/socket";
import { Helper } from "@src/utilts/helper";
import { RedisClient } from "@src/redisClient";


import { DB } from "@src/dbconnection/dbconnection";
import { ResponseData } from "@src/models/ResponseData";
import { BranchesRepo } from "../admin/branches.repo";
import { S3Storage } from "@src/utilts/S3Storage";
import format from "pg-format";
import { logPosErrorWithContext } from "@src/middlewear/socketLogger";

export class SocketOption {
    static redisClient: RedisClient;


    /** SEND NEW/UPDATED OPTIONGROUPS */
    public static async sendNewOptionGroup(optionGroup: OptionGroup, branchIds: [string]) {
        try {

            //send updated product
            optionGroup.options = optionGroup.options.map((f: any) => {

                if (f.qty == 1) {
                    f.qty = null
                }
                return f
            })
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                const newData = await Helper.trim_nulls(optionGroup);
                instance.io.of('/api').in(clientId).emit("newOptionGroup", JSON.stringify(newData));
            }



        } catch (error: any) {

          
            return null;
        }
    }
    public static async sendUpdatedOptionGroup(optionGroup: OptionGroup, branchIds: [string]) {
        try {

            //send updated product
            const instance = SocketController.getInstance();
            optionGroup.options = optionGroup.options.map((f: any) => {

                if (f.qty == 1) {
                    f.qty = null
                }
                return f
            })
            this.redisClient = RedisClient.getRedisClient()
            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                const newData = await Helper.trim_nulls(optionGroup);
                instance.io.of('/api').in(clientId).emit("updateOptionGroup", JSON.stringify(newData));
            }



        } catch (error: any) {

          
            return null;
        }
    }

    /** SEND NEW/UPDATED OPTIONS */
    public static async sendNewOption(option: Option, branchIds: [string]) {
        try {
            this.redisClient = RedisClient.getRedisClient()
            //send updated product



            if (option.mediaId != null && option.mediaId != "" && option.mediaUrl && option.mediaUrl.defaultUrl) {
                const mediaName = option.mediaUrl.defaultUrl.substring(option.mediaUrl.defaultUrl.lastIndexOf('/') + 1)
                let imageData: any = await S3Storage.getThumbnailImageUrl(mediaName, option.companyId)
                if (imageData) {
                    imageData = imageData.split(';base64,').pop();
                    option.imageUrl = imageData
                }

            }
            const instance = SocketController.getInstance();
            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                if (option.excludedBranches) {
                    const isExcludedBranch = option.excludedBranches.find(f => f == branchId)
                    if (isExcludedBranch) {
                        option.isAvailable = false
                    }
                }

                const clientId: any = await this.redisClient.get("Socket" + branchId);
                const newData = await Helper.trim_nulls(option);
                instance.io.of('/api').in(clientId).emit("newOption", JSON.stringify(newData));
            }



        } catch (error: any) {
          

            return null;
        }
    }
    public static async sendupdatedOption(option: Option, branchIds: [string]) {
        try {
            this.redisClient = RedisClient.getRedisClient()
            //send updated product

            if (option.mediaId != null && option.mediaId != "" && option.mediaUrl && option.mediaUrl.defaultUrl) {
                const mediaName = option.mediaUrl.defaultUrl.substring(option.mediaUrl.defaultUrl.lastIndexOf('/') + 1)
                let imageData: any = await S3Storage.getThumbnailImageUrl(mediaName, option.companyId)
                if (imageData) {
                    imageData = imageData.split(';base64,').pop();
                    option.imageUrl = imageData
                }

            }
            const instance = SocketController.getInstance();


            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                if (option.excludedBranches) {
                    const isExcludedBranch = option.excludedBranches.find(f => f == branchId)
                    if (isExcludedBranch) {
                        option.isAvailable = false
                    }
                }
                const clientId: any = await this.redisClient.get("Socket" + branchId);
                const newData = await Helper.trim_nulls(option);
                instance.io.of('/api').in(clientId).emit("updateOption", JSON.stringify(newData));
            }

        } catch (error: any) {

          
            return null;
        }
    }


    //TODO: ONE FUNCTIONS
    public static async getOptions(client: Socket, data: any, branchId: string, callback: CallableFunction) {
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

            const options = await this.getOptionsByBranchId(branchId, date);

            callback(JSON.stringify(options.data))

        } catch (error: any) {
          
            callback(JSON.stringify(error.message))
            

            client.emit(error)
            logPosErrorWithContext(error, data, branchId, null, "getOptions")

        }

    }
    public static async getOptionsByBranchId(branchId: string, date: any | null) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN");
            const companyId: any = (await BranchesRepo.getBranchCompanyId(client, branchId)).compayId;
            const query: { text: string, values: any } = {
                text: `SELECT 
            "Options".*,
            "Media".id as "mediaId",
            "Media".url as "mediaUrl",
              CASE WHEN "excludedBranches" @> ('["${branchId}"]')::jsonb THEN false  ELSE true END AS "isAvailable"
            FROM "Options" 
            LEFT JOIN "Media" on "Media".id = "Options"."mediaId"
            where "Options" ."companyId"=$1`,
                values: [companyId]
            }

            if (date != null && date != "") {
                query.text = `SELECT 
            "Options".*,
            "Media".id as "mediaId",
            "Media".url as "mediaUrl",
            CASE WHEN "excludedBranches" @> ('["${branchId}"]')::jsonb THEN false  ELSE true END AS "isAvailable"
            FROM "Options" 
            LEFT JOIN "Media" on "Media".id = "Options"."mediaId"
            where "Options" ."companyId"=$1
            AND "Options" ."updatedDate">=$2 ::timestamp`
                query.values = [companyId, date]
            }
            const options = await DB.excu.query(query.text, query.values);


            for (let index = 0; index < options.rows.length; index++) {
                const newData: any = options.rows[index];

                if (newData.mediaId != null && newData.mediaId != "" && newData.mediaUrl && newData.mediaUrl.defaultUrl) {
                    const mediaName = newData.mediaUrl.defaultUrl.substring(newData.mediaUrl.defaultUrl.lastIndexOf('/') + 1)
                    let imageData: any = await S3Storage.getImageUrl(mediaName, newData.companyId)

                    if (imageData) {
                        imageData = imageData.split(';base64,').pop();
                        (<any>options.rows[index]).imageUrl = imageData
                    }

                }

            }
            await client.query("COMMIT");
            return new ResponseData(true, "", options.rows)
        } catch (error: any) {
            console.log(error)
            await client.query("ROLLBACK");
            throw new Error(error)
        } finally {
            client.release();
        }
    }
    //TODO: ONE FUNCTIONS
    public static async getOptionGroups(client: Socket, data: any, branchId: string, callback: CallableFunction) {
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

            const optionGroups = await this.getOptionGroupsByBranchId(branchId, date);


            callback(JSON.stringify(optionGroups.data))

        } catch (error: any) {
          
            callback(JSON.stringify(error.message))
            
            logPosErrorWithContext(error, data, branchId, null, "getOptionGroups")


        }
    }

    public static async getOptionGroupsByBranchId(branchId: string, date: any | null = null) {
        const client = await DB.excu.client();
        try {
            /**Intiate Client */
            await client.query("BEGIN");
            const companyId: any = (await BranchesRepo.getBranchCompanyId(client, branchId)).compayId;

            const query: { text: string, values: any } = {
                text: `SELECT 
            "OptionGroups".id,
            "OptionGroups".title,
            "OptionGroups"."minSelectable",
            "OptionGroups"."maxSelectable",
            "OptionGroups"."translation",

        (    select JSON_AGG(JSON_BUILD_OBJECT('optionId', el->>'optionId' , 
                                               'index',(el->>'index')::int,
                                               'qty', case when (el->>'qty')::float = 1 or   (el->>'qty')::float is  null then null  else  (el->>'qty')::numeric::float   end 
                                                        
                                               )) FROM JSON_ARRAY_ELEMENTS( "OptionGroups"."options") el )  AS "options"
     
            from "OptionGroups"                            
            where "OptionGroups"."companyId"  =   $1`,
                values: [companyId]
            }

            if (date != null && date != "") {
                query.text = `SELECT 
            "OptionGroups".id,
            "OptionGroups".title,
            "OptionGroups"."minSelectable",
            "OptionGroups"."maxSelectable",
            "OptionGroups"."translation",

        (    select JSON_AGG(JSON_BUILD_OBJECT('optionId', el->>'optionId' , 
                                               'index',(el->>'index')::int,
                                               'qty', case when (el->>'qty')::float = 1 or   (el->>'qty')::float is  null then null  else  (el->>'qty')::numeric::float   end 
                                                        
                                               )) FROM JSON_ARRAY_ELEMENTS( "OptionGroups"."options") el )  AS "options"
     
            from "OptionGroups"    
             where "OptionGroups"."companyId"  =   $1      
            AND ("OptionGroups" ."updatedDate"::timestamp > $2::timestamp)`;
                query.values = [companyId, date]
            }
            const optionGroups = await client.query(query.text, query.values);
            /**Commit Client */

            let options: OptionGroup[] = optionGroups.rows;

            await client.query("COMMIT");
            return new ResponseData(true, "", options)
        } catch (error: any) {
            /**RollBack Client */
            console.log(error)
            await client.query("ROLLBACK");
          
            throw new Error(error)
        } finally {
            /**Release Client */
            client.release();
        }
    }

    public static async updateOptionAvailabilty(optionData: any) {
        try {
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            for (let index = 0; index < optionData.length; index++) {
                const element = optionData[index];
                const clientId: any = await this.redisClient.get("Socket" + element.branchId);

                instance.io.of('/api').in(clientId).emit("updateOptionAvailability", JSON.stringify(element.availability));
            }

        } catch (error: any) {
            throw new Error(error)
        }
    }


    public static async getOptionsAvailability(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {
            if (data) {
                data = JSON.parse(data);
            }


            let searchValue = data.searchValue && data.searchValue.trim() != '' && data.searchValue != null ? `^.*` + data.searchValue.toLowerCase().trim() + `.*$` : null;

            let page = data.page ?? 1;
            const limit = ((data.limit == null) ? 7 : data.limit);
            let offset = (limit * (page - 1))

            console.log(data)
            const query = {
                text: `SELECT
               
                 count(*) over(),
                "Options".id as "optionId", 
            "Options".name,
              CASE WHEN "excludedBranches" @>    jsonb_build_array("Branches"."id") THEN false  ELSE true END AS "isAvailable"
            FROM "Options" 
            INNER JOIN "Branches" on "Branches"."companyId"= "Options"."companyId" and "Branches" ."id"=$1
            where "Branches" ."id"=$1
            and ($2::text is null or lower(trim("Options"."name")) ~$2)
             order by "Options"."createdAt" DESC
            limit $3
            offset $4
            `,
                values: [branchId, searchValue, limit, offset]
            }
            const items = await DB.excu.query(query.text, query.values);

            let count = items.rows && items.rows.length > 0 ? Number((<any>items.rows[0]).count) : 0
            let pageCount = Math.ceil(count / limit)
            console.log(pageCount)
            callback(JSON.stringify({ options: items.rows, pageCount: pageCount }))
        } catch (error: any) {
            console.log(error)
          
            

            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, data.branchId, null, "getOptionsAvailability")
        }
    }


    public static async updateOptionAvailability(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        const dbClient = await DB.excu.client();
        try {

            await dbClient.query("BEGIN")
            if (data) {
                data = JSON.parse(data);
            }
            console.log("updateOptionAvailabilityupdateOptionAvailabilityupdateOptionAvailability", data)
            let ids = data.map((f: any) => { return f.optionId })

            const query = {
                text: `SELECT id ,"excludedBranches" FROM "Options"
                      where "Options".id = any($1)
                `,
                values: [ids]
            }
            let options = await dbClient.query(query.text, query.values);
            let optionList = options.rows

            let updatedList: Option[] = data.map((f: any) => {
                const option = new Option();
                option.ParseJson(f);
                option.id = f.optionId
                let optionTemp = optionList.find(op => op.id == f.optionId);
                if (optionTemp) {
                    if (optionTemp.excludedBranches != null) {
                        option.excludedBranches = optionTemp.excludedBranches
                    }

                }

                return option
            })

            let newLists: Option[] = [];
            for (let index = 0; index < updatedList.length; index++) {
                const element = updatedList[index];
                if (element.isAvailable) {
                    element.excludedBranches.splice(element.excludedBranches.indexOf(element.excludedBranches.find(item => item == branchId)))
                } else {
                    element.excludedBranches.push(branchId)
                }
                newLists.push(element)
            }


            console.log(newLists)
            const transactionValues = newLists.map((update: any) => [update.id, JSON.stringify(update.excludedBranches)]);
            console.log(transactionValues)
            const updateQuery = `
                                           UPDATE "Options" 
                          SET "excludedBranches" = data."excludedBranches"::JSONB
                        
                          FROM (VALUES %L) AS data("id","excludedBranches")
                          WHERE "Options"."id"= data."id"::uuid 
                    
                                            
                                                `;
            const formattedQuery = format(updateQuery, transactionValues);

            await dbClient.query(formattedQuery);
            await dbClient.query("COMMIT")
            callback(JSON.stringify({ success: true }));
        } catch (error: any) {
            console.log(error)
          
            
            await dbClient.query("ROLLBACK")
            callback(JSON.stringify(error.message))
            logPosErrorWithContext(error, data, data.branchId, null, "getOptionsAvailability")

        } finally {
            dbClient.release()
        }
    }




    public static async updateProductOptionAvailabilty(optionData: any, branchId: string) {
        try {

            console.log(optionData)
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()

            const clientId: any = await this.redisClient.get("Socket" + branchId);

            instance.io.of('/api').in(clientId).emit("updateProductOptionAvailabilty", JSON.stringify(optionData));


        } catch (error: any) {
            throw new Error(error)
        }
    }



    public static async getOptionsProductAvailability(client: Socket, data: any, branchId: string, callback: CallableFunction) {
        try {

            // const branchId = data.branchId ? data.branchId :null;
            // const prodId = data.productId ? data.productId :null;


            if (data) {
                data = JSON.parse(data)
            }
            const query: { text: string, values: any } = {
                text: `SELECT 
                  "optionGroup"->>'index' AS "groupIndex",
                  "OptionGroups".id AS "groupId",
                  "OptionGroups".title AS "groupName",
                  elem ->>'index' AS "optionIndex",
                  "Options".id AS "optionId",
                  COALESCE(NULLIF("Options"."displayName",''), "Options".name) AS "name", 
                  "branchProd"."excludedOptions",
                  COALESCE(t2->>'optionId' is null or (t2->>'optionId' is not null and  t2->>'pauseUntil' is not null), true) as "isAvailable",
                  COALESCE(t1->>'optionId' is null or (t1->>'optionId' is not null and  t1->>'pauseUntil' is not null), true) as "availableOnline",
                  CASE WHEN "excludedBranches" @> jsonb_build_array("branchProd"."branchId") THEN true ELSE false END AS "isDisabled",
                  t2->>'pauseUntil' as "pauseUntil",
                  t1->>'pauseUntil' as "OnlinePauseUntil",
                   "prod".id as "productId"
                FROM "BranchProducts" AS "branchProd"
                INNER JOIN "Products" As prod ON  prod.id = "branchProd"."productId"
                inner JOIN json_array_elements(prod."optionGroups") AS "optionGroup" ON TRUE
                inner JOIN "OptionGroups" ON "OptionGroups".id = ("optionGroup"->>'optionGroupId')::uuid AND "branchProd"."companyId" = "OptionGroups"."companyId"
                JOIN json_array_elements("OptionGroups"."options") AS elem ON TRUE
                left join jsonb_array_elements("excludedOptions") as t2 on (t2->>'optionId')::uuid = (elem->>'optionId')::uuid and (t2->>'pauseUntil' is null or CURRENT_TIMESTAMP < (t2->>'pauseUntil')::TIMESTAMP)
                left join jsonb_array_elements("onlineExcludedOptions") as t1 on (t1->>'optionId')::uuid = (elem->>'optionId')::uuid and (t1->>'pauseUntil' is null or CURRENT_TIMESTAMP < (t1->>'pauseUntil')::TIMESTAMP)
                LEFT JOIN "Options" ON "Options".id = (elem->>'optionId')::uuid
                  where "branchProd"."branchId" = $1
                    AND "branchProd"."productId" = $2::uuid`,
                values: [branchId, data.productId]
            }

            const options = await DB.excu.query(query.text, query.values);

            callback(JSON.stringify({ success: true, options: options.rows }))

        } catch (error: any) {
          
            callback(JSON.stringify({ success: false, options: error.message }))
            logPosErrorWithContext(error, data, data.branchId, null, "getOptionsProductAvailability")

            throw new Error(error)
        }
    }


    public static async optionDeleteSync(optionId: any[], branches: any[]) {
        try {
            const instance = SocketController.getInstance();
            this.redisClient = RedisClient.getRedisClient()
            for (let index = 0; index < branches.length; index++) {
                const element = branches[index];
                const clientId: any = await this.redisClient.get("Socket" + element);

                instance.io.of('/api').in(clientId).emit("deleteOptionSync", JSON.stringify(optionId));
            }

        } catch (error: any) {
            throw new Error(error)
        }
    }
}