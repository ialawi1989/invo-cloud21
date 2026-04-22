import { Product } from "aws-sdk/clients/ssm";

export class Brands {

  
    id : string | null = null;
    companyid : string | null = null;
    name = "";
    options: Product[] = [];
    translation: any = {};
	updatedDate = new Date()

	ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }




}

