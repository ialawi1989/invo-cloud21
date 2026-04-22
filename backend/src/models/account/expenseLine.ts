import { Helper } from "@src/utilts/helper";
import { TaxModel } from "./InvoiceLine";

export class ExpenseLine{
    id ="";
    expenseId="";
    accountId="";
    amount=0;

   
    taxId:string|null;
    taxTotal = 0;
    taxes:TaxModel[] = [] // empty when selected tax  is not Group tax 
    taxType="" //empty when selected tax  is not Group tax  [flat/stacked]
    taxPercentage=0;
    isInclusiveTax = false;

    total=0
    createdAt = new Date();

    note="";
    branchId="";
    companyId=""
    constructor (){
        this.taxId =null;
    }
    ParseJson(json:any): void{
        for (const key in json) {
             if (key == "taxes" && json[key] && JSON.stringify(json[key]) !='{}') {
                const taxesTemp: TaxModel[] = [];
                let taxTemp: TaxModel;
                json[key].forEach((line: any) => {
                    taxTemp = new TaxModel();
                    taxTemp.ParseJson(line);
                    taxesTemp.push(taxTemp);
                });
                this.taxes = taxesTemp;
            }else(key in this)
            {
                this[key as keyof typeof this] = json[key];
            }
        
        }
    }
    getBasePrice(total: number, taxes:TaxModel[], afterDecimal: number) {

      
        let taxesAmount = this.taxType == 'stacked' ? 1 : 0 ;
      
        taxes.forEach(element => {
            if (this.taxType == 'flat') {
                taxesAmount = Helper.add(taxesAmount, element.taxPercentage, afterDecimal);
            } else {
                taxesAmount = Helper.multiply(taxesAmount, Helper.division(Helper.add(element.taxPercentage , 100,afterDecimal),100,afterDecimal), afterDecimal)
            }
        });

        if (this.taxType == 'flat') {
            let taxTotaltemp = 0;
            taxTotaltemp = Helper.division(Helper.add(100, taxesAmount, afterDecimal), 100, afterDecimal)
            total = Helper.division(total, taxTotaltemp, afterDecimal)
        } else if (this.taxType == 'stacked') {
    
            total = Helper.division(total, taxesAmount, afterDecimal)
        }

        console.log(total)
        return Helper.roundNum(total,afterDecimal)
    }
    
    calculateTax(afterDecimal: number) {
        //If the tax applied is Group Tax 

        if (this.taxes && Array.isArray(this.taxes) && this.taxes.length > 0 && this.taxType != "") {

            let total = this.total; // qty*price
            let taxTotal = 0;
            let taxTotalPercentage = 0;
            let tempstackedTotal = 0 
            const taxesTemp: any = []
            if(this.isInclusiveTax)
                {
                   total = this.getBasePrice(total,this.taxes,afterDecimal)
                }
            if (this.taxType == "flat") { // flat tax calculate both tax separately from line total 
                this.taxes.forEach((tax: any) => {
                    const taxAmount =  Helper.multiply(total , Helper.division(tax.taxPercentage , 100,afterDecimal),afterDecimal)
                    taxTotalPercentage = Helper.add(taxTotalPercentage,tax.taxPercentage,afterDecimal);
                    taxTotal = Helper.add(taxTotal,taxAmount,afterDecimal)
                    tax.taxAmount = taxAmount
                    taxesTemp.push(tax)
                });
            } else if (this.taxType == "stacked") {// stacked tax both tax depened on each other 
                this.taxes.forEach((tax: any) => {
                    tax.stackedTotal =  Helper.roundNum(tempstackedTotal,afterDecimal)
                    const taxAmount =  Helper.multiply(total , Helper.division(tax.taxPercentage , 100,afterDecimal),afterDecimal)
                    taxTotalPercentage = Helper.add(taxTotalPercentage,tax.taxPercentage,afterDecimal);
                    taxTotal =  Helper.add(taxTotal,taxAmount,afterDecimal)
                    total =  Helper.add(total,taxAmount,afterDecimal)
                    tax.taxAmount = taxAmount
                    tempstackedTotal =taxAmount
                    taxesTemp.push(tax)
                });
            }
            this.taxPercentage = taxTotalPercentage;
            this.taxTotal = taxTotal;
            this.taxes = taxesTemp;
        } else {
            this.taxTotal = this.isInclusiveTax ? Helper.division(Helper.multiply(this.total , this.taxPercentage,afterDecimal), Helper.add(100 , this.taxPercentage,afterDecimal), afterDecimal) : Helper.multiply(this.total, Helper.division(this.taxPercentage , 100,afterDecimal), afterDecimal);
        }
    }



    calculatetotal(afterDecimal:number){
     
        this.total = this.amount;

        if (this.taxId != null || this.taxId != "" ) {
            this.calculateTax(afterDecimal);
            if(!this.isInclusiveTax) //add tax to total only when tax type is exclusive 
            {
                this.total = Helper.add(this.total,this.taxTotal,afterDecimal);
            }  
        } else{
            this.taxPercentage = 0;
            this.taxTotal = 0 ;
            this.taxes = [];
            
        }
    }
}