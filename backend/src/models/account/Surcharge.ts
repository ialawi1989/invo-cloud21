export class Surcharge{
    id="";
    name="";
    amount=0;
    percentage=false;
    companyId="" 
    branchId="";
    updatedDate = new Date();
    //TODO:ADD TO INSERT EDIT QUERY
    taxId:string|null;
    constructor(){
        this.taxId = null;
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