import { subscriptionType } from "@src/Integrations/webPush";

export class GuestSubscription{
    id="";
    createdAt= new Date();
    subscription:subscriptionType={ endpoint: "", keys: { p256dh: "", auth: "" } };
    companyId = ""
    userId="";/** subscription.keys.auth (unique text per browser)  */

    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    } 
}

export class ShopperSubscription{
    id="";
    createdAt= new Date();
    subscription:subscriptionType={ endpoint: "", keys: { p256dh: "", auth: "" } };
    companyId = ""
    shopperId="";
    userId=""
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    } 
}