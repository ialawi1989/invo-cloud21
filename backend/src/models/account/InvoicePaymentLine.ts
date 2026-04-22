import { InvoiceRepo } from "@src/repo/app/accounts/invoice.repo";
import { InvoicePaymentRepo } from "@src/repo/app/accounts/invoicePayment.repo";
import { Helper } from "@src/utilts/helper";

export class InvoicePaymentLine{
    id="";
    invoicePaymentId="";
    invoiceId:string|null;
    amount=0;
    createdAt= new Date();
    invoiceNumber="";
    total=0; //invoice total 
    paidAmount =0;//invoicePaidAmount 


    note="";
    paymentMethodType ="";

    openingBalanceId:string|null;
    branchId:string|null
    branchName = ""

    refunded = 0 
    companyId = ""
    constructor(){
        this.invoiceId= null
        this.openingBalanceId=null;
        this.branchId = null;
    } 

    ParseJson(json:any): void{
        for (const key in json) {
            if(key in this)
            {
              
                if(key in this){
                   this[key as keyof typeof this] = json[key];  
                }
            }
        }
    }

    calculateToTal(afterDecimal:number){
    this.amount =  Helper.roundDecimal(this.amount,afterDecimal);
    }
}