export class Serials {
    id=""
    branchProductId="";
    serial="";
    status="";
    companyId="";
    unitCost = 0;
    createdAt= new Date();
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}