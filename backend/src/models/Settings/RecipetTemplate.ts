export class RecieptTemplate{

    id="";
    companyId="";
    name="";
    recieptTemplate:any= []
    templateType="";
    updatedDate= new Date();
    ParseJson(json:any): void{
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

}