export class MenuSectionProduct{
    id="";
    index=0;
    doubleWidth=false;
    doubleHeight=false;
    productId="";
    menuSectionId="";
    color="";
    page=1;
    updatedDate=new Date();
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}