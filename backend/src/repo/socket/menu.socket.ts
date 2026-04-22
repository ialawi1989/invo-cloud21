import { Socket } from 'socket.io';


import { SocketController } from '@src/socket';

import { RedisClient } from '@src/redisClient';


import { DB } from '@src/dbconnection/dbconnection';
import { ResponseData } from '@src/models/ResponseData';
import { PoolClient } from 'pg';
import { BranchesRepo } from '../admin/branches.repo';
import { logPosErrorWithContext } from '@src/middlewear/socketLogger';
export class SocketMenu {
    static redisClient: RedisClient;


    public static async sendNewdMenu(client: PoolClient, menuIds: [string], branchIds: any[]) {
        try {

            const menu = await this.getUpdatedMenus(client, menuIds);
            this.redisClient = RedisClient.getRedisClient()
            //send updated product
            const instance = SocketController.getInstance();
            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                let menuBranches = menu.data.branchIds;
                console.log("sync", menuBranches, branchId)
                let branch = menuBranches.find((f: any) => f.branchId == branchId)
                console.log("sync", menuBranches)
                let temp: any = { ...menu.data };
                if (!branch) {
                    temp.sections = [];
                    temp.enabled = false
                } else {
                    temp.enabled = true
                }
                const clientId: any = await this.redisClient.get("Socket" + branchId);

                // const newData = await Helper.trim_nulls(temp);


                instance.io.of('/api').in(clientId).emit("newMenu", JSON.stringify(temp));
            }
        } catch (error: any) {
       
            return null;
        }
    }
    /** SEND NEW/UPDATED MENU LIVE SYNC */
    public static async sendUpdatedMenu(client: PoolClient, menuIds: [string], branchIds: any[]) {
        try {

            console.log("sendUpdatedMenu", branchIds)
            const menu = await this.getUpdatedMenus(client, menuIds);
            this.redisClient = RedisClient.getRedisClient()
            //send updated product
            const instance = SocketController.getInstance();

            for (let index = 0; index < branchIds.length; index++) {
                const branchId = branchIds[index];
                console.log(menu.data)
                let menuBranches = menu.data.branchIds;
                console.log(menuBranches)

                let branch = menuBranches.find((f: any) => f.branchId == branchId)
                console.log(branch)
                let temp = { ...menu.data };
                if (!branch) {//not found

                    temp.sections = [];
                    temp.enabled = false
                } else {
                    temp.enabled = true
                }
                const clientId: any = await this.redisClient.get("Socket" + branchId);

                // const newData = await Helper.trim_nulls(temp);
                console.log(branchId)
                console.log(temp.sections)
                instance.io.of('/api').in(clientId).emit("newMenu", JSON.stringify(temp));
            }

        } catch (error: any) {
            console.log(error)
       
            return null;
        }
    }
    public static async getUpdatedMenus(client: PoolClient, menuIds: [string]) {
        try {


            const query: { text: string, values: any } = {
                text: `with  "menu" as (
                    select 
                    "Menu".id,
                    "Menu"."name",
                    "Menu"."startAt",
                    "Menu"."endAt",
                    "Menu".index,
                     "Menu"."priceLabelId",
                     "branchIds"	
            FROM "Menu" 
            where "Menu".id = any($1)
            ), "menuSection" as (
                            SELECT
                            "menu".id as "menuId",
                            json_agg(json_build_object('id',"MenuSection".id, 
                            'name',"MenuSection".name,
                            'translation',"MenuSection".translation,
                            'image',image,
                            'index',"MenuSection".index,
                            'properties',properties,
                            'products',(SELECT json_agg(json_build_object('index',index,'doubleWidth',"doubleWidth",'doubleHeight',"doubleHeight",'productId',"productId",'color',"Products".color,'page',page))
                            FROM "MenuSectionProduct" 
                            INNER JOIN "Products"
                            ON "Products".id = "MenuSectionProduct"."productId"
                            WHERE "MenuSectionProduct". "menuSectionId" = "MenuSection".id)
                            )) as sections
            FROM "MenuSection"
            INNER JOIN "menu" ON "menu".id = "MenuSection"."menuId"     
            group by "menu".id
            )
            select "menu".* , 
            "menuSection".sections
            from "menu"
            left join "menuSection" on  "menu".id =  "menuSection"."menuId"`,
                values: [menuIds]
            }

            const menus = await client.query(query.text, query.values);
            return new ResponseData(true, "", menus.rows[0])
        } catch (error: any) {
       
            throw new Error(error)
        }
    }


    //TODO:ONE FUNCTION
    public static async getMenus(client: Socket, data: any, branchId: string, callback: CallableFunction) {
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
            const menus = await this.getMenu(branchId, date);

            callback(JSON.stringify(menus.data))

        } catch (error: any) {
          
            callback(JSON.stringify(error))
            
            logPosErrorWithContext(error, data, branchId, null, "getMenus")

        }
    }
    // public static async getMenu(branchId: string, date: any | null = null) {
    //     try {

    //         const query : { text: string, values: any } = {
    //             text: `SELECT menu.id,
    //     menu."name",
    //     menu."startAt",
    //     menu."endAt",
    //     menu.index,
    //                 (SELECT
    //                    json_agg(json_build_object('id',id,
    //                         'name',name,
    //                         'translation',translation,
    //                         'image',image,
    //                         'index',index,
    //                         'properties',properties,
    //                         'products',(
    //                              SELECT json_agg(json_build_object('index',index,'doubleWidth',"doubleWidth",'doubleHeight',"doubleHeight",'productId',"productId",'color',"Products".color,'page',page))
    //                              FROM "MenuSectionProduct" 
    //                              INNER JOIN "Products"
    //                              ON "Products".id = "MenuSectionProduct"."productId"
    //                              WHERE "MenuSectionProduct". "menuSectionId" = "MenuSection".id

    //                              )
    //                 )) FROM "MenuSection"
    //                  WHERE menu.id = "MenuSection"."menuId") AS sections
    //               FROM "Menu" AS menu, jsonb_to_recordset(menu."branchIds") as "branchIds"("branchId" uuid)
    //               WHERE "branchIds"."branchId" =$1`,
    //             values: [branchId]
    //         }

    //         if (date != null && date != "") {
    //             query.text = `SELECT menu.id,
    //     menu."name",
    //     menu."startAt",
    //     menu."endAt",
    //     menu.index,
    //                 (SELECT
    //                    json_agg(json_build_object('id',id,
    //                         'name',name,
    //                         'translation',translation,
    //                         'image',image,
    //                         'index',index,
    //                         'properties',properties,
    //                         'products',(
    //                              SELECT json_agg(json_build_object('index',index,'doubleWidth',"doubleWidth",'doubleHeight',"doubleHeight",'productId',"productId",'color',"Products".color,'page',page))
    //                              FROM "MenuSectionProduct" 
    //                              INNER JOIN "Products"
    //                              ON "Products".id = "MenuSectionProduct"."productId"
    //                              WHERE "MenuSectionProduct". "menuSectionId" = "MenuSection".id

    //                              )
    //                 )) FROM "MenuSection"
    //                  WHERE menu.id = "MenuSection"."menuId") AS sections
    //               FROM "Menu" AS menu , jsonb_to_recordset(menu."branchIds") as "branchIds"("branchId" uuid)
    //               WHERE "branchIds"."branchId" =$1
    //               AND( menu."updatedDate"::timestamp>= $2::timestamp or menu."createdAt"::timestamp>=$2::timestamp)
    //       `
    //             query.values = [branchId, date]
    //         }
    //         const menus = await DB.excu.query(query.text, query.values);

    //         return new ResponseData(true, "", menus.rows)
    //     } catch (error: any) {
    //    
    //          throw new Error(error)
    //     }
    // }

    public static async getMenu(branchId: string, date: any | null = null) {
        try {

            const query: { text: string, values: any } = {
                text: `with  "menu" as (
                            select 
                            "Menu".id,
                            "Menu"."name",
                            "Menu"."startAt",
                            "Menu"."endAt",
                            "Menu".index,
                                  "Menu"."priceLabelId"	
                    FROM "Menu" , jsonb_to_recordset("Menu"."branchIds") as "branchIds"("branchId" uuid)
                     WHERE "branchIds"."branchId" =$1
                    ), "menuSection" as (
                                    SELECT
                                    "menu".id as "menuId",
                                    json_agg(json_build_object('id',"MenuSection".id, 
                                    'name',"MenuSection".name,
                                    'translation',"MenuSection".translation,
                                    'image',image,
                                    'index',"MenuSection".index,
                                    'properties',properties,
                                    'products',(SELECT json_agg(json_build_object('index',index,'doubleWidth',"doubleWidth",'doubleHeight',"doubleHeight",'productId',"productId",'color',"Products".color,'page',page))
                                    FROM "MenuSectionProduct" 
                                    INNER JOIN "Products"
                                    ON "Products".id = "MenuSectionProduct"."productId"
                                    WHERE "MenuSectionProduct". "menuSectionId" = "MenuSection".id)
                                    )) as sections
                    FROM "MenuSection"
                    INNER JOIN "menu" ON "menu".id = "MenuSection"."menuId"     
                    group by "menu".id
                    )
                    select "menu".* , 
                    "menuSection".sections
                    from "menu"
                    inner join "menuSection" on  "menu".id =  "menuSection"."menuId"
                    `,
                values: [branchId]
            }

            if (date != null && date != "") {
                query.text = `with  "menu" as (
                    select 
                    "Menu".id,
                    "Menu"."name",
                    "Menu"."startAt",
                    "Menu"."endAt",
                    "Menu".index,
                          "Menu"."priceLabelId"		
            FROM "Menu" , jsonb_to_recordset("Menu"."branchIds") as "branchIds"("branchId" uuid)
             WHERE "branchIds"."branchId" =$1 and  "Menu"."updatedDate">=$2
            ), "menuSection" as (
                            SELECT
                            "menu".id as "menuId",
                            json_agg(json_build_object('id',"MenuSection".id, 
                            'name',"MenuSection".name,
                            'translation',"MenuSection".translation,
                            'image',image,
                            'index',"MenuSection".index,
                            'properties',properties,
                            'products',(SELECT json_agg(json_build_object('index',index,'doubleWidth',"doubleWidth",'doubleHeight',"doubleHeight",'productId',"productId",'color',"Products".color,'page',page))
                            FROM "MenuSectionProduct" 
                            INNER JOIN "Products"
                            ON "Products".id = "MenuSectionProduct"."productId"
                            WHERE "MenuSectionProduct". "menuSectionId" = "MenuSection".id)
                            )) as sections
            FROM "MenuSection"
            INNER JOIN "menu" ON "menu".id = "MenuSection"."menuId"     
            group by "menu".id
            )
            select "menu".* , 
            "menuSection".sections
            from "menu"
            inner join "menuSection" on  "menu".id =  "menuSection"."menuId"
          `
                query.values = [branchId, date]
            }
            const menus = await DB.excu.query(query.text, query.values);

            return new ResponseData(true, "", menus.rows)
        } catch (error: any) {
          
            throw new Error(error)
        }
    }
    public static async getMenus2(client: Socket, data: any, branchId: string, callback: CallableFunction) {
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
            const menus = await this.getMenuWithDisableMenus(branchId, date);

            callback(JSON.stringify(menus.data))

        } catch (error: any) {
          
            callback(JSON.stringify(error))
            

            logPosErrorWithContext(error, data, branchId, null, "getMenuList")
        }
    }
    public static async getMenuWithDisableMenus(branchId: string, date: any | null = null) {
        const client = await DB.excu.client();
        try {

            await client.query("BEGIN")

            const companyId: any = (await BranchesRepo.getBranchCompanyId(client, branchId)).compayId;
            const query: { text: string, values: any } = {
                text: `with  "menu" as (
                    select 
                    "Menu".id,
                    "Menu"."name",
                    "Menu"."startAt",
                    "Menu"."endAt",
                    "Menu".index,
                          "Menu"."priceLabelId"		
                        FROM "Menu" , jsonb_to_recordset("Menu"."branchIds") as "branchIds"("branchId" uuid)
                        WHERE "branchIds"."branchId" =$1
                        ), "menuSection" as (
                                        SELECT
                                        "menu".id as "menuId",
                                        json_agg(json_build_object('id',"MenuSection".id, 
                                        'name',"MenuSection".name,
                                        'translation',"MenuSection".translation,
                                        'image',image,
                                        'index',"MenuSection".index,
                                        'properties',properties,
                                        'products',(SELECT json_agg(json_build_object('index',index,'doubleWidth',"doubleWidth",'doubleHeight',"doubleHeight",'productId',"productId",'color',"Products".color,'page',page))
                                        FROM "MenuSectionProduct" 
                                        INNER JOIN "Products"
                                        ON "Products".id = "MenuSectionProduct"."productId"
                                        WHERE "MenuSectionProduct". "menuSectionId" = "MenuSection".id)
                                        )) as sections
                        FROM "MenuSection"
                        INNER JOIN "menu" ON "menu".id = "MenuSection"."menuId"     
                        group by "menu".id
                        )
                        select "menu".* , 
                        "menuSection".sections::text::jsonb,
                        true as "enabled"
                        from "menu"
                        inner join "menuSection" on  "menu".id =  "menuSection"."menuId"
                        
                        Union 

            Select  
                                "Menu".id,
                                "Menu"."name",
                                "Menu"."startAt",
                                "Menu"."endAt",
                                "Menu".index,
                                    "Menu"."priceLabelId"	, 
                        '[]'::text::jsonb As sections,
                        false as "enabled"
                        FROM "Menu" , jsonb_to_recordset("Menu"."branchIds") as "branchIds"("branchId" uuid)
                        left JOIN "Branches" on "Branches".id = "branchIds"."branchId"
            WHERE  "Menu".id not in (select id from "menu")
            and "Branches"."companyId" = $2
                    `,
                values: [branchId, companyId]
            }

            if (date != null && date != "") {
                query.text = `with  "menu" as (
                    select 
                    "Menu".id,
                    "Menu"."name",
                    "Menu"."startAt",
                    "Menu"."endAt",
                    "Menu".index,
                          "Menu"."priceLabelId"		
            FROM "Menu" , jsonb_to_recordset("Menu"."branchIds") as "branchIds"("branchId" uuid)
             WHERE "branchIds"."branchId" =$1  and  "Menu"."updatedDate">=$2
            ), "menuSection" as (
                            SELECT
                            "menu".id as "menuId",
                            json_agg(json_build_object('id',"MenuSection".id, 
                            'name',"MenuSection".name,
                            'translation',"MenuSection".translation,
                            'image',image,
                            'index',"MenuSection".index,
                            'properties',properties,
                            'products',(SELECT json_agg(json_build_object('index',index,'doubleWidth',"doubleWidth",'doubleHeight',"doubleHeight",'productId',"productId",'color',"Products".color,'page',page))
                            FROM "MenuSectionProduct" 
                            INNER JOIN "Products"
                            ON "Products".id = "MenuSectionProduct"."productId"
                            WHERE "MenuSectionProduct". "menuSectionId" = "MenuSection".id)
                            )) as sections
            FROM "MenuSection"
            INNER JOIN "menu" ON "menu".id = "MenuSection"."menuId"     
            group by "menu".id
            )
            select "menu".* , 
            "menuSection".sections::text::jsonb,
			true as "enabled"
            from "menu"
            inner join "menuSection" on  "menu".id =  "menuSection"."menuId"
			
			Union 

                Select  
                                    "Menu".id,
                                    "Menu"."name",
                                    "Menu"."startAt",
                                    "Menu"."endAt",
                                    "Menu".index,
                                        "Menu"."priceLabelId"	, 
                            '[]'::text::jsonb As sections,
                            false as "enabled"
                            FROM "Menu" , jsonb_to_recordset("Menu"."branchIds") as "branchIds"("branchId" uuid)
                            left JOIN "Branches" on "Branches".id = "branchIds"."branchId"
                WHERE  "Menu".id not in (select id from "Menu"  , jsonb_to_recordset("Menu"."branchIds") as "branchIds"("branchId" uuid) WHERE "branchIds"."branchId" =$1 )
                and "Branches"."companyId" = $3
            
          `
                query.values = [branchId, date, companyId]
            }
            const menus = await client.query(query.text, query.values);
            await client.query("COMMIT")
            return new ResponseData(true, "", menus.rows)

        } catch (error: any) {

            await client.query("CALLBACK")
          
            throw new Error(error)
        } finally {
            client.release()
        }
    }
}