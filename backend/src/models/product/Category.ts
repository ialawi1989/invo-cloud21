export class Category{
    id="";
    name="";
    departmentId : string | null;
    companyId="";
    createdAt = new Date();
    mediaId:string|null;
    translation={};
    index = 0 
    constructor(){
        this.departmentId = null;
        this.mediaId = null;
    }
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}