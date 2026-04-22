import { Helper } from "@src/utilts/helper";

export class BillingPaymentLine{
    id="";
    billingId:string|null;
    billingPaymentId="";    

    amount=0;
    total =0;
    
    createdAt = new Date();
    
    note="";
    //TODO: ADD TO DB 
    isOpeningBalance=false;

    openingBalanceId:string|null;
    billingNumber="";

    paidAmount=0;
    billingDate= new Date()
    branchId:string|null ;
    companyId= ""
    constructor(){
        this.billingId= null;
        this.openingBalanceId=null
        this.branchId = null
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