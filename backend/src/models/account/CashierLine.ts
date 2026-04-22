export class CashierLine{
    id="";
    cashierId="";
    paymentMethodId="";
    
    rate=0;
    startAmount=0;
    endAmount=0;
    ParseJson(json: any): void {
        for (const key in json) {
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        }
    }

}