import { Helper } from "@src/utilts/helper";
import { TaxModel } from "./InvoiceLine";


export class PurchaseOrderLine {
    id = "";
    purchaseOrderId = "";
    productId:string|null;
    barcode = "";
    qty = 0;
    unitCost = 0
    accountId = "";
    note = "";


    subTotal = 0;
    total = 0;


    taxId: string | null;
    taxTotal = 0;
    taxes = []  // empty when selected tax  is not Group tax 
    taxType = "" //empty when selected tax  is not Group tax  [flat/stacked]
    taxPercentage = 0;

    isInclusiveTax = false;
    selectedItem:any={};

    accountName="";
    SIC=""; /**Supplier Item Code*/
    isDeleted = false;
    index = 0 
    remainingQty = 0 
    UOM ="";
    constructor() {
        this.taxId = null;
        this.productId = null;
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key in this) {
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
                    const taxAmount =Helper.multiply(total , Helper.division(tax.taxPercentage , 100,afterDecimal),afterDecimal)
                    taxTotalPercentage += tax.taxPercentage;
                    taxTotal += taxAmount,afterDecimal;
                    tax.taxAmount = taxAmount,afterDecimal
                    taxesTemp.push(tax)
                });
            } else if (this.taxType == "stacked") {// stacked tax both tax depened on each other 
                this.taxes.forEach((tax: any) => {
                    tax.stackedTotal =  Helper.roundNum(tempstackedTotal,afterDecimal)
                    const taxAmount = Helper.multiply(total , Helper.division(tax.taxPercentage , 100,afterDecimal),afterDecimal)
                    taxTotalPercentage += tax.taxPercentage;
                    taxTotal +=  taxAmount
                    total +=  taxAmount,afterDecimal;
                    tax.taxAmount = taxAmount,afterDecimal
                    tempstackedTotal =taxAmount,afterDecimal
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

    calculateTotal(afterDecimal: number) {

        this.unitCost = Helper.roundDecimal(this.unitCost, afterDecimal)
        this.subTotal = this.qty * this.unitCost
        this.total = this.subTotal;
        if (this.taxId != "" && this.taxId != null) {
            this.calculateTax(afterDecimal);
            if (!this.isInclusiveTax) //add tax to total only when tax type is exclusive 
            {
                this.total += this.taxTotal;
            }
        }
    }
}