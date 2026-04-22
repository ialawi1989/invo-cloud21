import { BillingRepo } from "@src/repo/app/accounts/billing.repo";
import { Helper } from "@src/utilts/helper";
import { BillingPaymentLine } from "./BillingPaymentLines";
import { Log } from "../log";

export class BillingPayment{
    id="";
    companyId="";
    employeeId="";
    supplierId="";
    paymentMethodId="";
    paymentMethodAccountId:string|null ="";

    tenderAmount=0; // sum of line amount  

   /**
    * 
    * tenderAmount : is handed over money total amount paid
    * 
    * paidAmount: is total used amount from the tendered amount
    */

   
    rate=1;
    paidAmount =0; //totally paid amount 

    createdAt = new Date();
    paymentDate= new Date(); // account id of payment method (paymentMethodId)

    lines:BillingPaymentLine[]=[]
   

    mediaId:string|null;
    mediaUrl ="";

    attachment=[];
    paymentMethodName = "";


    logs:Log[] = [];

    branchId="";
    referenceNumber:string|null;
    constructor(){
        this.mediaId = null;
        this.referenceNumber = null;
    }
    afterDecimal = 3 
    ParseJson(json:any): void{
        for (const key in json) {
       
           if(key=='lines'){
            const linesTemp:BillingPaymentLine[]=[];
            let paymentLine:BillingPaymentLine;
            json[key].forEach((line:any)=>{
                paymentLine = new BillingPaymentLine();
                paymentLine.ParseJson(line);
                linesTemp.push(paymentLine)
            })
            this.lines = linesTemp;
           }else{
            if(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
           }
        }
    }
    
    /**
     * 
     * Bill Payment Journal
     * 
     * payment on expense (prepaid)
     * 
     * Prepaid Expenses => debit 
     * payment method Account ID => credit 
     * 
     * payment (without excess amount )
     * 
     * Account Payable => debit 
     * payment method Account ID => credit 
     * 
     * paymnet  (with excess amount )
     * 
     * Account Payable => debit (sum of lines paid same day of payment)
     * payment method Account ID => credit  (total paid amount )
     * Prepaid Expenses => debit  (total paid amount -  sum of lines paid same day of payment)
     * 
     */

    calculateTotal(afterDecimal:number){


    let total = 0
        for (let index = 0; index < this.lines.length; index++) {
            const element = this.lines[index];
            total += Helper.roundDecimal(element.amount,afterDecimal) 
        }
        
        this.paidAmount = Helper.roundDecimal(total,afterDecimal);

        
    }



    checkBillingPaymentDate(){
        const currentDate = new Date();
        currentDate.setHours(0,0,0,0)
        const newDate = new Date(this.createdAt)
        newDate.setHours(0,0,0,0)

        if(currentDate<newDate)
        {
           return false
        }

        return true
    }

}