export class PriceLabel {
    id="";
    name="";
    companyId="";
    productsPrices:[]=[];
    optionsPrices:[]=[];
    updatedDate = new Date();
    createdAt=new Date();
    constructor(){
    }
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}