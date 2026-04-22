import { OptionGroupList } from "./OptionGroupList";

export class OptionGroup {
    id  = "";
    title = "";
    alias ="";
    minSelectable = 0; // IF 0 THEN NOT REQUIRED 
    maxSelectable = 1;


    translation = {};
    options : OptionGroupList[] = [];
    companyId = "";
    brandId="";
    createdAt = 0;
    updatedDate= new Date();

    mediaId:string|null;

    constructor(){
        this.mediaId = null
    }
    ParseJson(json:any): void{
        for (const key in json) {
            if(key =='options')
            {
                const optionsTemp:OptionGroupList[]=[];
                let option:OptionGroupList;
                json[key].forEach((element:any) => {
                    option = new OptionGroupList();
                    option.ParseJson(element);
                    optionsTemp.push(option)
                });
                this.options = optionsTemp;
            }else{
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}