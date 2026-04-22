export class RefundLine{
    id="";

    creditNoteRefundId="";
    paymentMethodId= "";
    accountId="";

    amount = 0;
    ParseJson(json: any): void {
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

    
}