export class PhysicalCountLine{
    id="";
    physicalCountId="";
    productId="";
    enteredQty=0;
    expectedQty=0;

    unitCost = 0 // Product unitCost at the time of creating physicalCount 

    serials:PhysicalCountLine[]=[];
    batches:PhysicalCountLine[]=[];
    parentId:string|null;
    serial="";
    batch="";

    isAvailable:boolean|null;

    productType="";
    productName="";
    categoryName="";
    UOM="";
    barcode="";
    onHand =0 ;
    isDeleted = false 
    constructor(){
        this.parentId = null
        this.isAvailable = null;
    }
    ParseJson(json:any): void{
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}