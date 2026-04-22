import { Helper } from "@src/utilts/helper";
import { VatPaymentLine } from "./vatPaymentLine";

export class VatPayment {
    id:string|null;
    companyId=""
    from=new Date()
    to=new Date()

    accountPayableId="" /** when null set default GCC VAT PAYMENT */

    employeeId="";

    
    createdAt = new Date()

    outputVat = 0
    inputVat = 0
    status = 'Initiated'
    netVat = 0 
    paymentDate:Date|null;
    branchId:string|null 
    lines:VatPaymentLine[]=[]
    afterDecimal = 3 ;
    constructor(){
        this.id=null

        this.paymentDate = null;
        this.branchId = null
    }
    ParseJson(json:any): void{
        for (const key in json) {
           if(key =='lines'){
            const linesTemp:VatPaymentLine[]=[];
            let journalLine:VatPaymentLine;
            json[key].forEach((line:any)=>{
                journalLine = new VatPaymentLine();
                journalLine.ParseJson(line);
                linesTemp.push(journalLine);
            })
            this.lines = linesTemp;
           }else{
            if(key in this){
                if(key in this)
                {
                    this[key as keyof typeof this] = json[key];
                }
            }
          

           }
         
        }
    }

    claculateTotal()

    {
        this.netVat =  Helper.roundDecimal(this.netVat,this.afterDecimal)
        this.outputVat =  Helper.roundDecimal(this.outputVat,this.afterDecimal)
        this.inputVat =  Helper.roundDecimal(this.inputVat,this.afterDecimal)
    }
}