export class SupplierItem{
    id="";
    supplierId="";
    minimumOrder=0;
    cost=0;
    supplierCode="";
    productId=""; 

    isDeleted = false;
    ParseJson(json: any): void {
        for (const key in json) {
            if(key in this)
        {
            this[key as keyof typeof this] = json[key];
        }
        }
    }
}