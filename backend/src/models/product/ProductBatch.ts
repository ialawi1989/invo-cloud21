export class ProductBatch {
    branchProductId = "";
    batch = "";
    onHand = 0;
    unitCost=0;
    prodDate = 0;
    expireDate = 0;
    companyId = "";

    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}