export class SupplierAppliedCredit{
    id="";
    supplierCreditId="";
    billingId="";
    amount=0;
    createdAt = new Date();
    appliedCreditDate = new Date();
    employeeId="";
    
    ParseJson(json: any): void {
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        }
    }
}