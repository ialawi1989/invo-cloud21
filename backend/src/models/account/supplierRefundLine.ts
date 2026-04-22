export class SupplierRefundLine{
    id="";
    supplierRefundId="";
    paymentMethodId="" // deposit to;

    amount=0;
    accountId="";
    createdAt = new Date();
    
    ParseJson(json: any): void {
        for (const key in json) {
            if(key in this)
        {
            this[key as keyof typeof this] = json[key];
        }
        }
    }
}