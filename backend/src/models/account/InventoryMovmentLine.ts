export class InventoryMovmentLine {
    id = "";
    productId: string | null;
    inventoryMovmentId = "";
    qty = 0;
    cost = 0; //Invenory Assets
    currentOnHand = 0; // exisiting onHand BEFORE ANY UPDATES 
    currentCost = 0 // branchProduct.onHand * Products.unitCost
    batch:string|null;
    serial:string|null;
    parentChildId:string|null;
    isDeleted:boolean = false;
    productName = "";
    barcode = "";
    UOM =""
    constructor() {
        this.productId = null
        this.batch = null;
        this.serial = null
        this.parentChildId = null;
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}