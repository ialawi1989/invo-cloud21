export class Brands{
    id=""; 
    companyId="";
    name="";
    slug="";
    type=""
    translation={}; 
    createdAt= new Date(); 
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}