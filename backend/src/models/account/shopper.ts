import { CustomerAddress } from "./Customer";

export class Shopper {
    id="";
    name:string|null = null 
    phone="";
    addresses:CustomerAddress[]|null=null;
    password:string|null=null;
    providerKey ="";
    provider="";

   
   
    newShopper:boolean = false;
    isPhoneValidated = false;
    isEmailValidated = false 
    email:string|null=null;
    auth:string|null;
    customerId:string|null = null ;
    constructor(){
        this.auth = null 
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}