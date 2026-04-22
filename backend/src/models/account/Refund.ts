import { Helper } from "@src/utilts/helper";
import { RefundLine } from "./RefundLine";

export class Refund{
    id="";
    employeeId="";
    branchId="";
    creditNoteId="";

    total = 0;
    createdAt= new Date();
    refrenceNumber="";
    lines:RefundLine[]=[];
    description="";
    refundDate = new Date();
    updatedDate = new Date()
    cashierId:string|null;
    companyId= "";
    
    constructor(){
        this.cashierId=null;
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if(key =='lines'){
                const linesTemp:RefundLine[]=[];
                let refundLine:RefundLine;
                json[key].forEach((line:any)=>{
                    refundLine = new RefundLine();
                    refundLine.ParseJson(line);
                    linesTemp.push(refundLine);
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

    calculateTotal(afterDecimal:number){
        let total =0;
        for (let index = 0; index < this.lines.length; index++) {
            const element =  this.lines[index];
            total+= element.amount;
        }

        this.total =Helper.roundNum(total,afterDecimal);
    }
}