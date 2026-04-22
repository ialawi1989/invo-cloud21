export class Department {
    id = "";
    name = "";
    translation = {};
    companyId="";
    createdAt = new Date;
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}