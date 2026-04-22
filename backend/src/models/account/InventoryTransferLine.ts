import { Helper } from "@src/utilts/helper";

export class InventoryTransferLine{
    id="";
    InventoryTransferId="";
    productId="";
    qty=0;
    unitCost=0;


    serials:InventoryTransferLine[]=[];
    batches:InventoryTransferLine[]=[];

    serial="";
    batch="";
    expireDate:Date|null;
    prodDate:Date|null;


    
    parentId:string|null;


    productName="";
    categoryName="";
    barcode="";
    type="";
    UOM="";
   
    onHand =0; /** Product OnHand At the time of transfer */
    isSelected= false;
    transfer = false;
    isDeleted = false 
    constructor(){
        this.parentId=null
        this.expireDate=null;
        this.prodDate=null;

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