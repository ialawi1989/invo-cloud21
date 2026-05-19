
import { Address } from "./address.model";

export class Shopper {
    id="";
    name:string|null = null 
    phone="";
    addresses:Address[]=[];
    password:any;
    providerKey ="";
    provider="";
    sessionId ="";
    newShopper:boolean = false;
    isPhoneValidated: boolean =  false;
    isEmailValidated: boolean = false;
    email: string | null = null;
    auth = ''

    ParseJson(json: any): void {
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}