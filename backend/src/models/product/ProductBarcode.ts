export class ProductBarcode {
    productId = "";
    barcode = "";
    companyId = "";
    createdAt = 0;

    ParseJson(json:any): void{
        for (const key in json) {
           this[key as keyof typeof this] = json[key];
        }
    }
}