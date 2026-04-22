export class Recipe {
    id="";
    name="";
    description="";
    companyId="";
    items:any=[];
    createdAt= new Date();
  
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}