import { Helper } from "@src/utilts/helper";
import { Log } from "../log";
import { PurchaseOrderLine } from "./PurchaseOrderLines";

export class PurchaseOrder{
    id="";
    employeeId="";
    supplierId="";

    purchaseNumber="";
    reference="";


    branchId=""
    isBill=false;

    internationalSupplier = false;

    purchaseDate= new Date();
    dueDate= new Date();
    createdAt= new Date();


    total=0;
    shipping=0;
    
    lines:PurchaseOrderLine[]=[];
    isInclusiveTax =false;

    itemSubTotal =0;
    purchaseTaxTotal =0;
    

    supplierName="";
    branchName="";
    supplierVatNumber="";

    logs:Log[] =[]; 

    smallestCurrency=0;
    roundingType="";
    roundingTotal=0;
    customFields:any[]=[]
    branchCustomFields:any=null
    supplierEmail="";
    status= "Not Converted"
    ParseJson(json:any): void{
        for (const key in json) {
            if(key =='lines'){
                const linesTemp:PurchaseOrderLine[]=[];
                let purchaseLine:PurchaseOrderLine;
                json[key].forEach((line:any)=>{
                    purchaseLine = new PurchaseOrderLine();
                    purchaseLine.ParseJson(line);
                    linesTemp.push(purchaseLine);
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
        let total = 0;
let itemSubTotal=0;
let purchaseTaxTotal=0;

        for (let index = 0; index < this.lines.length; index++) {

            const element = this.lines[index];
            const line = new PurchaseOrderLine();
            if(!element.isDeleted){
                line.ParseJson(element);
                line.isInclusiveTax = this.isInclusiveTax
                line.calculateTotal(afterDecimal);
                itemSubTotal += line.subTotal;
                purchaseTaxTotal += line.taxTotal;
                total +=line.total;  
                this.lines[index] =line;
            }
         
        }
        this.itemSubTotal += itemSubTotal;
        this.purchaseTaxTotal += purchaseTaxTotal;
        this.total = total + this.shipping;
        this.calculateRounding(afterDecimal);

        this.total = Helper.add(this.total,this.roundingTotal,afterDecimal)
    }

    
    calculateRounding( afterDecimal: number) {
        if(this.smallestCurrency==0 || this.smallestCurrency == null || this.smallestCurrency == undefined)
            {
            
            this.smallestCurrency = Helper.division(1,Helper.roundNum(( Math.pow(10,parseInt(afterDecimal.toString()))),afterDecimal),afterDecimal)
            this.roundingType = 'normal'
            }
          
        if (this.smallestCurrency > 0) {
            let roundingTotal = 0;
            switch (this.roundingType) {
                case "normal":
                    roundingTotal = Math.round(this.total / this.smallestCurrency) * this.smallestCurrency;
                    break;
                case "positive":

                    roundingTotal = Math.ceil(this.total / this.smallestCurrency) * this.smallestCurrency;
                    break;
                case "negative":
                    roundingTotal = Math.trunc(this.total / this.smallestCurrency)
                    roundingTotal = roundingTotal * this.smallestCurrency
                    break;
                default:
                    break;
            }

            this.roundingTotal =  Helper.sub(roundingTotal, this.total, afterDecimal);
        }

        return 0;
    }
}