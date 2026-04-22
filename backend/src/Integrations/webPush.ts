import { DB } from "@src/dbconnection/dbconnection";
import { Shopper } from "@src/models/account/shopper";
import { Company } from "@src/models/admin/company"
import { GuestSubscription, ShopperSubscription } from "@src/models/ecommerce/subscription";
import { ResponseData } from "@src/models/ResponseData";
import { RedisClient } from "@src/redisClient";
import { CartRepo } from "@src/repo/ecommerce/cart.repo";
import { SubsriptionRepo } from "@src/repo/ecommerce/subscriptionRepo";
import webPush from "web-push"

export interface subscriptionType {
    endpoint: string, keys: { p256dh: string, auth: string }
}
export class WebPush {
    wbesiteUrl = 'mailto:your-email@example.com'
    publicKey = 'BC4mAl1kYeRKYtj0udzB1KhD-Hx9KnHjxqGPFGWqM8sCdYjYOZ-RMvWGhmfc6zi5B2i4n_ucZFMaLWR8NuLOZS0'
    privateKey = 'U0vuzWvSgQcdLuTIlmS4BGUx-8sPOxKL1qDj0gmHLVo'

    payload: { title: string, body: string, icon: string } = { title: "", body: "", icon: "" }
    subscription: subscriptionType = { endpoint: "", keys: { p256dh: "", auth: "" } };


    public static async  subscribe(data: any, company: Company, userSessionId: string) {
        try {
     

            /**logged in user*/
            // const cartSessionId = data.sessionId
            // console.table({cartSessionId:cartSessionId})
            // let caretData = await CartRepo.getRedisCart(company.id, cartSessionId);
            let result
    
              result = await this.insertShopperSubscriptions(data.subscription,company,null)

            return new ResponseData(true,"",[])
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }

    async sendNotification() {
        try {
            webPush.setVapidDetails(
                this.wbesiteUrl, // Replace with your email or wbesite URL
                this.publicKey, // public key        
                this.privateKey  // private key     
            );
            let result = await webPush.sendNotification(this.subscription, JSON.stringify(this.payload));
            console.log("testttttttttt",result)
        } catch (error: any) {
            console.log(error)
            throw new Error(error)
        }
    }


    public static async insertShopperSubscriptions(subscriptions: subscriptionType, company: Company, shopperId: string|null) {

        try {



            let returnData
            if (shopperId) {
                let shopperSubscription= new ShopperSubscription();
                shopperSubscription.subscription = subscriptions
                shopperSubscription.companyId = company.id;
                shopperSubscription.shopperId = shopperId
                returnData = await SubsriptionRepo.saveShopperSubscription(shopperSubscription) 
            } else {
                console.table(subscriptions)
                let guestsSubscription= new GuestSubscription();
                guestsSubscription.subscription = subscriptions
                guestsSubscription.companyId = company.id;
                guestsSubscription.userId = guestsSubscription.subscription.keys.auth
             
                returnData = await SubsriptionRepo.saveGuestsSubscription(guestsSubscription) 
            }



            return returnData
        } catch (error: any) {
           console.log(error)
            throw new Error(error)
        }
    }


}