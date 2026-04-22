import { Dimension } from "./Dimension";

export class ProductMatrix {
    id = "";
    name = "";
    barcode = "";
    translation:any={};
    
    // dimension1 : string | undefined;
    // dimension2 : string | undefined;
    // dimension3 : string | undefined;
    dimensions:Dimension[]=[]; 
    defaultPrice =0;
    mediaId:string|null;
    products:[]=[];
    base64Image="";
    defaultImage="";
    companyId = "";
    createdAt = 0;
    
    unitCost=0;//Products Unit Cost
    constructor(){
        this.mediaId = null
    }
    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}