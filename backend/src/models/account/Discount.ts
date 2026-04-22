export class Discount {
    id = "";
    companyId = ""
    name = "";
    amount = 0;
    percentage = false;
    updatedDate = new Date();
    startDate: Date = new Date();
    expireDate:Date|null;
    type= "";
    available= true;
    availableOnline= true;
    items = [];
    minProductQty = 0;

    expireAtTime:string|null;
    startAtTime:string|null;

    permittedEmployees: any[] = []; /**List Of EMPLOYEES ALLOWED TO APPLY DISCOUNT  */
    
    applyTo=""
    //TODO:ADD TO INSERT EDIT QUERY
    taxId: string | null;

  quantityBasedCashDiscount  = false 
    constructor() {
        this.taxId = null;

        this.expireDate = null
        this.expireAtTime = null
        this.startAtTime = null 
    }

    branches:[]=[];
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}

export class ProductDiscount {
    id = "";
    name = "";
    amount = 0;
    percentage = false;
    updatedDate = new Date();
    minProductQty = 0;
   
    //TODO:ADD TO INSERT EDIT QUERY
    taxId: string | null =null;

  
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}