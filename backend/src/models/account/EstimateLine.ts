/* eslint-disable @typescript-eslint/no-inferrable-types */
import { Helper } from "@src/utilts/helper";
import { EstimateLineOption } from "./EstimateLineOption";
import { TaxModel } from "./InvoiceLine";
import s from "connect-redis";


export class EstimateLine {
    id = "";
    estimateId = "";
    productId: string | null;
    branchId = "";
    employeeId = "";
    accountId = "";
    salesEmployeeId: string | null;
    isVoided = false;

    qty = 0;
    price = 0;
    note = "";
    //only when product is serial , batch 
    batch = "";//serial number 
    serial = ""; //batch number 





    discountId: string | null;
    discountAmount = 0;
    discountPercentage = false
    discountTotal = 0;



    taxId: string | null;
    taxTotal = 0;
    taxes:TaxModel[] = []  // empty when selected tax  is not Group tax 
    taxType = "" //empty when selected tax  is not Group tax  [flat/stacked]
    taxPercentage = 0;
    isInclusiveTax = false;


    serviceDuration = 0;
    serviceDate  = new Date();
    productName: string = "";
    mediaUrl: string | null;
    translation:{}|null = null;


    seatNumber = 0
    subTotal = 0;
    total = 0;

    selectedItem: any = {}; // only when retrive data it have {productId, productName} for front end 

    options: EstimateLineOption[] = []
    createdAt = new Date();
    discountType="";
   employeeName= "";
   index =0 ;
    constructor() {
        this.mediaUrl = null;
        this.productId = null
        this.discountId = null;
        this.salesEmployeeId = null;
        this.taxId = null
    }
    ParseJson(json: any): void {
        for (const key in json) {
            if (key == 'options') {
                const optionsTemp: EstimateLineOption[] = [];
                let lineOption: EstimateLineOption;
                json[key].forEach((option: any) => {
                    lineOption = new EstimateLineOption();
                    lineOption.ParseJson(option);
                    optionsTemp.push(lineOption);
                })
                this.options = optionsTemp
          
            }else if (key == "taxes" && json[key] && JSON.stringify(json[key]) !='{}') {
                 const taxesTemp: TaxModel[] = [];
                let taxTemp: TaxModel;
                if (typeof json[key] == 'string') {
                    json[key] = JSON.parse(json[key])
                }
                json[key].forEach((line: any) => {
                    taxTemp = new TaxModel();
                    taxTemp.ParseJson(line);
                    taxesTemp.push(taxTemp);
                });
                this.taxes = taxesTemp;
            } else {
                if (key in this) { this[key as keyof typeof this] = json[key]; }

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
        return Helper.roundDecimal(total,afterDecimal)
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
                    const taxAmount = Helper.multiply(total , Helper.division(tax.taxPercentage , 100,afterDecimal),afterDecimal)
                    taxTotalPercentage = Helper.add(taxTotalPercentage,tax.taxPercentage,afterDecimal);
                    taxTotal = Helper.add(taxTotal,taxAmount,afterDecimal)
                    tax.taxAmount = taxAmount
                    taxesTemp.push(tax)
                });
            } else if (this.taxType == "stacked") {// stacked tax both tax depened on each other 
                this.taxes.forEach((tax: any) => {
                    tax.stackedTotal =  Helper.roundNum(tempstackedTotal,afterDecimal)
                    const taxAmount =Helper.multiply(total , Helper.division(tax.taxPercentage , 100,afterDecimal),afterDecimal)
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

    calculateTotal(afterDecimal: number) {
        let optionTotal = 0;
        this.price = Helper.roundDecimal(this.price, afterDecimal)
        this.options.forEach(element => {
            optionTotal = Helper.add(optionTotal,Helper.multiply(this.qty ,Helper.multiply( element.qty , element.price,afterDecimal),afterDecimal),afterDecimal);
        });
        this.subTotal = Helper.add(Helper.multiply(this.qty , this.price,afterDecimal), optionTotal, afterDecimal)
   
        this.total = this.subTotal;
        this.discountTotal = 0;

        if (this.discountPercentage && this.discountAmount>0) {
            this.discountTotal = Helper.multiply(this.total , Helper.division(this.discountAmount , 100,afterDecimal),afterDecimal);
        } else {
            this.discountTotal = this.discountAmount;
        }
        this.total = Helper.sub(this.total,this.discountTotal,afterDecimal);


        if (this.taxId != null && this.taxId != "") {
            this.calculateTax(afterDecimal);
            if (!this.isInclusiveTax) {
                this.total = Helper.add(this.total,this.taxTotal,afterDecimal);
            }
        }else{
            this.taxPercentage = 0;
            this.taxTotal = 0 ;
            this.taxes = [];
        }

        this.total = Helper.roundNum(this.total, afterDecimal)
    }
}