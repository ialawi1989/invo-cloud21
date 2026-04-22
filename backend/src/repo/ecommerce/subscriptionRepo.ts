import { DB } from "@src/dbconnection/dbconnection";
import { GuestSubscription, ShopperSubscription } from "@src/models/ecommerce/subscription";
import { ResponseData } from "@src/models/ResponseData";
import { PoolClient } from "pg";


export class SubsriptionRepo {

    public static async saveShopperSubscription(subscription: ShopperSubscription) {
        try {
            const query = {
                text: `INSERT INTO "ShopperNotifications" ("companyId", "shopperId", "createdAt","subscription","userId") 
            VALUES ($1, $2, $3,$4,$5)
            ON CONFLICT ("companyId","shopperId","userId") 
            DO UPDATE SET "subscription" = EXCLUDED."subscription"
            returning id 
            `,
                values: [subscription.companyId, subscription.shopperId, subscription.createdAt, subscription.subscription,subscription.userId]

            }

            let sub = await DB.excu.query(query.text, query.values);

            const id = (<any>sub.rows[0]).id

            return new ResponseData(true, "", { id: id })
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }


    public static async saveGuestsSubscription(subscription: GuestSubscription) {
        try {
            const query = {
                text: `INSERT INTO "CompanyGuests" ("companyId", "userId", "createdAt","subscription") 
            VALUES ($1, $2, $3,$4)
            ON CONFLICT ("companyId","userId") 
            DO UPDATE SET "subscription" = EXCLUDED."subscription"
            returning id 
            `,
                values: [subscription.companyId, subscription.userId, subscription.createdAt, subscription.subscription]

            }

            let sub = await DB.excu.query(query.text, query.values);

            const id = (<any>sub.rows[0]).id

            return new ResponseData(true, "", { id: id })
        } catch (error: any) {
                       console.log(error)
            throw new Error(error)
        }
    }
    public static async getGuestsSubscription(id: string,companyId:string) {
        try {
            const query = {
                text: `select * from "CompanyGuests" where "userId" = $1 and "companyId"=$2`,
                values: [id,companyId]

            }

            let sub = await DB.excu.query(query.text, query.values);



            return new ResponseData(true, "", { subscribe: <any>sub.rows[0] })
        } catch (error: any) {
            throw new Error(error)
        }
    }
    public static async convertGuestToShopperSubscription(subscriptionId: string, shopperId: string,companyId:string) {
      
        try {

      
            let id;
            const guestSubscription = await this.deleteGuestsSubscription(subscriptionId,companyId);
            console.log(guestSubscription)
            if (guestSubscription && guestSubscription.data.subscribe) {
                let shopper = new ShopperSubscription();
                shopper.ParseJson(guestSubscription.data.subscribe)
                shopper.shopperId = shopperId
                let newShopperSubscription = await this.saveShopperSubscription(shopper)
                id = newShopperSubscription.data.id
            }
            
            return new ResponseData(true, "", { id: id })
        } catch (error: any) {
            throw new Error(error)
        } finally {
        
        }
    }
    public static async deleteGuestsSubscription(id: string,companyId:string) {
        try {
            const query = {
                text: `delete  from "CompanyGuests" where "userId" = $1 and "companyId"=$2 returning *`,
                values: [id,companyId]

            }

            let sub = await DB.excu.query(query.text, query.values);



            return new ResponseData(true, "", { subscribe: <any>sub.rows[0] })
        } catch (error: any) {
            throw new Error(error)
        }
    }

}