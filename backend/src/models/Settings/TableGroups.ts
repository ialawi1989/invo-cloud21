import { Tables } from "./Tables";
export class GroupProperties {
    defaultPattern = "1";
    patternSize = 20; // per percentage

    constructor() {
    }

}
export class TableGroups{
    id="";
    name="";
    index=0;
    branchId="";
    companyId="";
    properties={};
    objects=[];
    tables:Tables[]=[]
    updatedAt = new Date();


    isActive= true;
    ParseJson(json:any): void{
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        
        }
    }
}